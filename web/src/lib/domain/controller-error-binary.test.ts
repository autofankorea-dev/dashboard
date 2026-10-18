import { describe, expect, test } from "vitest";
import { moduleAlarmToAlarmRow, type ModuleAlarmDbRow } from "./module-alarms-map";
import { controllerErrorBytes } from "./controller-error-binary";
import type { BarnReading } from "./iot-types";

const reading = {
  farmKey: { lsindRegistNo: "TEST", itemCode: "P00" }, moduleUid: 1,
  controllerKey: "SP07:01:01",
} as BarnReading;
function alarm(code: number, legacy = false) {
  return moduleAlarmToAlarmRow({
    id: String(code), created_at: "2026-10-19T00:00:00Z", raw_id: 1,
    lsind_regist_no: "TEST", item_code: "P00", farm_name: "테스트", module_uid: 1,
    topic: null, wire_ver: 12, err_code: code, err_label: "테스트 경보",
    stall_ty_code: legacy ? null : "SP07", stall_no: legacy ? null : "01",
    eqpmn_no: legacy ? null : "01", controller_key: legacy ? null : reading.controllerKey,
    channel: null, status: "active", received_at: "2026-10-19T00:00:00Z",
  } satisfies ModuleAlarmDbRow);
}
describe("wire error to controller debug readout", () => {
  test.each([[0x11,"00010001"],[0x12,"00010010"],[0x21,"00100001"],[0x22,"00100010"],
    [0x31,"00110001"],[0x32,"00110010"],[0x41,"01000001"],[0xfe,"11111110"]])("preserves byte %i", (code, binary) => {
    expect(controllerErrorBytes(reading, [alarm(Number(code))])[0].binary).toBe(binary);
  });
  test("isolates identity, source, status and invalid bytes", () => {
    const base = alarm(0x11);
    expect(controllerErrorBytes(reading, [
      { ...base, farmKey: { ...base.farmKey, lsindRegistNo: "OTHER" } },
      { ...base, farmKey: { ...base.farmKey, itemCode: "OTHER" } },
      { ...base, moduleUid: 2 }, { ...base, controllerKey: "SP07:01:02" },
      { ...base, source: "derived" }, { ...base, status: "resolved" },
      { ...base, errCode: undefined }, { ...base, errCode: 256 }, { ...base, errCode: -1 },
    ])).toEqual([]);
  });
  test("keeps simultaneous codes separate and legacy location explicitly module scoped", () => {
    const codes = controllerErrorBytes(reading, [alarm(0x11), alarm(0x11), alarm(0x41), alarm(0x11, true)]);
    expect(codes.map(c => [c.scope,c.binary])).toEqual([
      ["controller","00010001"],["controller","01000001"],["module","00010001"],
    ]);
    expect(controllerErrorBytes(reading, [])).toEqual([]);
  });
});
