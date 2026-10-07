/**
 * 이상상황 종 = 모듈 + 통신두절 + 알람값 초과
 * 실행: npx tsx src/lib/data/situation-alarms.test.ts
 */
import assert from "node:assert/strict";
import {
  DEFAULT_ALARM_SETTINGS,
  SITUATION_FIELD_ALARM_TYPE,
  SITUATION_OFFLINE_TYPE,
  isModuleAlarmRow,
  mergeSituationAlarms,
  type AlarmRow,
  type AlarmSettings,
} from "./alarms";
import type { BarnReading } from "./iot";

function reading(
  partial: Pick<BarnReading, "controllerKey" | "status"> &
    Partial<BarnReading>,
): BarnReading {
  return {
    key: partial.key ?? partial.controllerKey,
    farmKey: partial.farmKey ?? { lsindRegistNo: "F1", itemCode: "P00" },
    moduleUid: partial.moduleUid ?? 1,
    controllerKey: partial.controllerKey,
    eqpmnNo: partial.eqpmnNo ?? "01",
    stallNo: partial.stallNo ?? "1",
    stallTyCode: partial.stallTyCode ?? "SP01",
    label: partial.label ?? partial.controllerKey,
    alarmLowTempC: partial.alarmLowTempC ?? 10,
    alarmHighTempC: partial.alarmHighTempC ?? 35,
    tempC: partial.tempC ?? 18,
    humidityPct: partial.humidityPct ?? 55,
    fanSupply: null,
    fanExhaust: null,
    fanIntake: null,
    fanSupplySeries: [],
    fanExhaustSeries: [],
    fanIntakeSeries: [],
    mesureDt: null,
    receivedAt: partial.receivedAt ?? new Date().toISOString(),
    status: partial.status,
    packetMode: "live",
    wireVer: null,
  };
}

const moduleRow: AlarmRow = {
  id: "m1",
  occurredAt: new Date().toISOString(),
  farmKey: { lsindRegistNo: "F1", itemCode: "P00" },
  moduleUid: 1,
  controllerKey: "c1",
  eqpmnNo: "01",
  stallNo: "1",
  stallTyCode: "SP01",
  alarmType: "E01",
  severity: "critical",
  status: "active",
  detail: "모듈 에러",
  controllerStatus: "normal",
  source: "module",
};

const tightField: AlarmSettings = {
  global: {
    tempLow: 16,
    tempHigh: 19,
    humidityLow: 30,
    humidityHigh: 90,
  },
  byStallTyCode: {},
  byScope: {},
};

{
  const merged = mergeSituationAlarms(
    [moduleRow],
    [
      reading({ controllerKey: "c1", status: "normal" }),
      reading({ controllerKey: "c2", status: "offline" }),
      reading({
        controllerKey: "c3",
        status: "caution",
        tempC: 18,
      }),
    ],
  );
  assert.equal(merged.length, 2);
  assert.ok(isModuleAlarmRow(merged[0]!));
  assert.equal(merged[1]!.alarmType, SITUATION_OFFLINE_TYPE);
  assert.equal(isModuleAlarmRow(merged[1]!), false);
  assert.ok(!merged.some((a) => a.alarmType === SITUATION_FIELD_ALARM_TYPE));
  console.log("situation-alarms: merge module+offline, in-band skip env — ok");
}

{
  const merged = mergeSituationAlarms(
    [],
    [reading({ controllerKey: "c4", status: "normal", tempC: 25 })],
  );
  assert.equal(merged.length, 0);
  console.log("situation-alarms: device band only when profile settings omitted — ok");
}

{
  const merged = mergeSituationAlarms(
    [],
    [reading({ controllerKey: "c5", status: "normal", tempC: 25, alarmLowTempC: 16, alarmHighTempC: 19 })],
    tightField,
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0]!.alarmType, SITUATION_FIELD_ALARM_TYPE);
  assert.match(merged[0]!.detail, /25/);
  console.log("situation-alarms: device alarm survives recommendation removal — ok");
}

{
  const merged = mergeSituationAlarms(
    [],
    [
      reading({
        controllerKey: "c6",
        status: "normal",
        stallTyCode: "SP07",
        tempC: 21,
        humidityPct: 50,
      }),
    ],
    DEFAULT_ALARM_SETTINGS,
  );
  assert.equal(merged.length, 0);
  console.log("situation-alarms: inside device band generates no recommendation alarm — ok");
}

{
  const merged = mergeSituationAlarms(
    [],
    [reading({ controllerKey: "c2", status: "offline", tempC: 40 })],
    tightField,
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0]!.alarmType, SITUATION_OFFLINE_TYPE);
  assert.ok(!merged.some((a) => a.alarmType === SITUATION_FIELD_ALARM_TYPE));
  console.log("situation-alarms: offline skips temperature alarm — ok");
}

console.log("situation-alarms.test.ts: all ok");

{
  const r = reading({ controllerKey: "no-device-band", status: "normal", tempC: 50, humidityPct: 99 });
  r.alarmLowTempC = null;
  r.alarmHighTempC = null;
  assert.deepEqual(mergeSituationAlarms([], [r]), []);
  r.alarmLowTempC = 10;
  r.alarmHighTempC = 60;
  assert.deepEqual(mergeSituationAlarms([], [r]), []);
  r.alarmHighTempC = 35;
  assert.equal(mergeSituationAlarms([], [r])[0]?.alarmType, SITUATION_FIELD_ALARM_TYPE);
}
