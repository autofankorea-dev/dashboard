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
