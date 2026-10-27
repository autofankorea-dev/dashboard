import { beforeEach, expect, it, vi } from "vitest";

const { insert } = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => ({ insert }) }) }));
vi.mock("@/lib/auth/get-current-user", () => ({ getCurrentUser: async () => ({ id: "test-user" }), canCommand: () => true }));
vi.mock("@/lib/auth/farm-access", () => ({ canEditFarmScope: () => true }));
vi.mock("@/lib/data/controller-meta", () => ({ upsertControllerDisplayName: vi.fn() }));
vi.mock("@/lib/data/live-cache", () => ({ revalidateLiveCache: vi.fn() }));
vi.mock("@/lib/data/commands", () => ({
  getThermoCommandById: vi.fn(), THERMO_COMMAND_SELECT: "id",
  mapThermoCommandRow: (row: Record<string, unknown>) => ({ ...row, eqpmnNo: row.eqpmn_no }),
}));

import { sendBulkThermoCommandAction, sendDeviceSettingsCommandsAction, sendThermoCommandAction } from "./actions";

const channel = { channel: "A" as const, eqpmnCode: "EC15", setpointTemp: 24, tempDeviation: 3.5, minVentPct: 25, maxVentPct: 100 };
const target = (number: number) => ({ key: `controller-${number}`, lsindRegistNo: "TEST", itemCode: "P00",
  moduleUid: 1, stallTyCode: "SP07", stallNo: "01", eqpmnNo: String(number).padStart(2, "0") });

beforeEach(() => {
  insert.mockReset();
  insert.mockImplementation((row) => ({ select: () => ({ single: async () => ({ data: { ...row, id: `id-${row.eqpmn_no}` }, error: null }) }) }));
});

it("registers all 14 combined and device settings targets, including 11..14", async () => {
  const targets = Array.from({ length: 14 }, (_, i) => target(i + 1));
  for (const send of [
    () => sendBulkThermoCommandAction(targets.map((t) => ({ ...t, ...channel }))),
    () => sendDeviceSettingsCommandsAction(targets.map((t) => ({ ...t, channels: [channel] }))),
  ]) {
    insert.mockClear();
    const result = await send();
    expect(result.sent).toBe(14);
    expect(result.failed).toEqual([]);
    expect(insert.mock.calls.map(([row]) => row.eqpmn_no)).toEqual(targets.map((t) => t.eqpmnNo));
  }
});

it("keeps legacy single and bulk commands on the same boundary", async () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({ lsind_regist_no: "TEST", item_code: "P00", module_uid: "1",
    stall_ty_code: "SP07", stall_no: "01", eqpmn_no: "48", setpoint_temp: "24", temp_deviation: "3.5", min_vent_pct: "25", max_vent_pct: "100" })) form.set(key, value);
  expect((await sendThermoCommandAction(form)).ok).toBe(true);
  expect((await sendBulkThermoCommandAction([{ ...target(48), ...channel, channel: undefined }])).sent).toBe(1);
  insert.mockClear();
  form.set("eqpmn_no", "49");
  expect((await sendThermoCommandAction(form)).ok).toBe(false);
  expect((await sendDeviceSettingsCommandsAction([{ ...target(49), channels: [channel] }])).sent).toBe(0);
  expect((await sendBulkThermoCommandAction([{ ...target(49), ...channel }])).sent).toBe(0);
  expect(insert).not.toHaveBeenCalled();
});

it("counts 14 two-channel targets as 10 queued controllers and 4 rejected controllers", async () => {
  const targets = Array.from({ length: 14 }, (_, i) => target(i + 1));
  const commands = targets.flatMap((t, index) => [channel, { ...channel, channel: "B" as const }].map((c) =>
    ({ ...t, ...c, setpointTemp: index < 10 ? 24 : 100 })));
  const result = await sendBulkThermoCommandAction(commands);
  expect(result.sent).toBe(10);
  expect(result.failed).toHaveLength(4);
  expect(result.failed.map((r) => r.key)).toEqual(targets.slice(10).map((t) => t.key));
  expect(result.sent + result.failed.length).toBe(14);
  expect(insert).toHaveBeenCalledTimes(10);
});

it("counts DB failures once per controller, for both combined and device settings paths", async () => {
  insert.mockImplementation((row) => ({ select: () => ({ single: async () => Number(row.eqpmn_no) > 10
    ? { data: null, error: { message: "database rejected" } }
    : { data: { ...row, id: `id-${row.eqpmn_no}` }, error: null } }) }));
  const targets = Array.from({ length: 14 }, (_, i) => target(i + 1));
  for (const send of [
    () => sendBulkThermoCommandAction(targets.flatMap((t) => [channel, { ...channel, channel: "B" as const }].map((c) => ({ ...t, ...c })))),
    () => sendDeviceSettingsCommandsAction(targets.map((t) => ({ ...t, channels: [channel] }))),
  ]) {
    const result = await send();
    expect(result.sent).toBe(10);
    expect(result.failed).toHaveLength(4);
    expect(new Set(result.failed.map((r) => r.key)).size).toBe(4);
  }
});
