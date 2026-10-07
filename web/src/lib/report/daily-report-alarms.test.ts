/**
 * 일보 PDF 이상상황 매핑 — 모듈+통신두절만 (임계 파생 제외)
 * 실행: npx tsx src/lib/report/daily-report-alarms.test.ts
 */
import assert from "node:assert/strict";
import {
  mergeSituationAlarms,
  type AlarmRow,
} from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import {
  barnJudgeFromControllerStatuses,
  toDailyReportAlarmRows,
} from "./daily-report-alarms";

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

{
  const merged = mergeSituationAlarms(
    [moduleRow],
    [
      reading({ controllerKey: "c1", status: "normal", tempC: 99 }),
      reading({ controllerKey: "c2", status: "offline" }),
      reading({ controllerKey: "c3", status: "caution", tempC: 40 }),
    ],
  );
  const rows = toDailyReportAlarmRows(merged);
  assert.ok(!merged.some((a) => a.alarmType === "권장 이탈"));
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.source, "module");
  assert.equal(rows[1]!.source, "offline");
  assert.equal(rows[1]!.alarmType, "통신 두절");
  assert.ok(!rows.some((r) => /온도|습도|권장|알람값/.test(r.alarmType)));
  console.log("daily-report-alarms: toDailyReportAlarmRows — ok");
}

{
  assert.equal(barnJudgeFromControllerStatuses(["normal", "normal"]), "정상");
  assert.equal(
    barnJudgeFromControllerStatuses(["normal", "caution"]),
    "수신 지연",
  );
  assert.equal(
    barnJudgeFromControllerStatuses(["caution", "offline"]),
    "통신 두절",
  );
  console.log("daily-report-alarms: barnJudgeFromControllerStatuses — ok");
}

console.log("daily-report-alarms.test.ts: all ok");
