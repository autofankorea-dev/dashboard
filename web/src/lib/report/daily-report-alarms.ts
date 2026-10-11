/**
 * 일보 PDF 이상상황·판정 매핑 — 서버/테스트 공유 (server-only 금지).
 */

import {
  isDailyReportSituationRow,
  isModuleAlarmRow,
  type AlarmRow,
} from "@/lib/domain/alarms";
import { getStallTypeName } from "@/lib/domain/stall-type";
import type { DailyReportAlarmRow } from "@/lib/report/daily-report-payload";

/** 이상상황 AlarmRow → 일보 PDF 행 (모듈 + 통신두절만) */
export function toDailyReportAlarmRows(
  situationAlarms: AlarmRow[],
): DailyReportAlarmRow[] {
  return situationAlarms
    .filter((a) => a.status === "active" && isDailyReportSituationRow(a))
    .map((a) => ({
      stallLabel: a.stallTyCode ? getStallTypeName(a.stallTyCode) : "—",
      stallNo: a.stallNo ?? "—",
      stallTyCode: a.stallTyCode,
      eqpmnNo: a.eqpmnNo,
      controllerKey: a.controllerKey,
      alarmType: a.alarmType,
      severity: a.severity,
      detail: a.detail,
      source: isModuleAlarmRow(a) ? ("module" as const) : ("offline" as const),
    }));
}

/** 축사 판정 — 통신두절 > 수신 지연 > 정상 (임계 이탈 미반영) */
export function barnJudgeFromControllerStatuses(
  statuses: string[],
): string {
  if (statuses.some((s) => s === "offline")) return "통신 두절";
  if (statuses.some((s) => s === "caution")) return "수신 지연";
  return "정상";
}
