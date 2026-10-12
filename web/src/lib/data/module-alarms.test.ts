import { test } from "vitest";
/**
 * 실행: npx vitest run src/lib/data/module-alarms.test.ts
 */
import assert from "node:assert/strict";
import {
  moduleAlarmToAlarmRow,
  severityForModuleErrCode,
  type ModuleAlarmDbRow,
} from "@/lib/domain/module-alarms-map";

function sample(partial: Partial<ModuleAlarmDbRow> = {}): ModuleAlarmDbRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    created_at: "2026-08-03T00:00:00Z",
    raw_id: 1,
    lsind_regist_no: "FARM99",
    item_code: "P00",
    farm_name: "테스트농장",
    module_uid: 1,
    topic: null,
    wire_ver: 12,
    err_code: 0x11,
    err_label: "A 라인 고온 경보",
    stall_ty_code: "SP02",
    stall_no: "03",
    eqpmn_no: "01",
    controller_key: "SP02:03:01",
    channel: "A",
    status: "active",
    received_at: "2026-08-03T01:00:00Z",
    ...partial,
  };
}

assert.equal(severityForModuleErrCode(0x11), "critical");
assert.equal(severityForModuleErrCode(0x12), "warning");
assert.equal(severityForModuleErrCode(0x41), "critical");

const row = moduleAlarmToAlarmRow(sample());
assert.equal(row.source, "module");
assert.equal(row.alarmType, "A 라인 고온 경보");
assert.equal(row.farmName, "테스트농장");
assert.equal(row.controllerKey, "SP02:03:01");
assert.equal(row.stallTyCode, "SP02");
assert.equal(row.stallNo, "03");
assert.equal(row.eqpmnNo, "01");
assert.equal(row.channel, "A");
assert.match(row.detail ?? "", /SP02.*03번.*01번/);
assert.equal(row.status, "active");

console.log("module-alarms.test.ts: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
