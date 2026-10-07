import { deviceAlarmThresholds } from "./device-alarm-thresholds";
import type { BarnReading, ControllerStatus } from "@/lib/data/iot";
import type { FarmKey } from "@/lib/data/farm-key";
import { appendFarmKeyParams } from "@/lib/data/farm-key";
import { buildControllerHref } from "@/lib/auth/farm-access";
import { compareReadings } from "@/lib/data/reading-hierarchy";
import { resolveThresholdsForReading } from "@/lib/data/alarm-scope";
import { normalizeStallTyCode, formatStallTypeLabel } from "@/lib/data/stall-type";
import { formatControllerSlotLabel } from "@/lib/ui/controller-labels";
import {
  applyFarmChartScopeParams,
  type FarmChartScope,
} from "@/lib/farm/farm-chart-scope";
import { applyChartViewParams } from "@/lib/farm/farm-view-url";
import { formatAlarmBaselinePair } from "@/lib/data/alarm-baseline";
import {
  pigEnvBandForStallTy,
  pigEnvFitOffBand,
  pigEnvFitToBand,
} from "@/lib/farm/pig-env-recommend";

/** 종(이상상황) 행 제목 — 델린 해설과 같은 문구 */
export const SITUATION_OFFLINE_TYPE = "통신 두절";
export const SITUATION_FIELD_ALARM_TYPE = "알람값 초과";
export const SITUATION_RECOMMEND_TYPE = "권장 이탈";

export type AlarmSeverity = "warning" | "critical";

export type AlarmRow = {
  id: string;
  occurredAt: string;
  farmKey: FarmKey;
  moduleUid: number;
  controllerKey: string;
  idx?: number;
  eqpmnNo: string;
  stallNo: string | null;
  stallTyCode: string | null;
  alarmType: string;
  severity: AlarmSeverity;
  status: "active" | "resolved";
  detail: string;
  controllerStatus: ControllerStatus;
  /** Shell 정본 — 모듈 업링크. 미설정이면 레거시(임계 파생) */
  source?: "module" | "derived";
  /** 모듈 경보 View의 농장 표시명 */
  farmName?: string | null;
  /** 모듈 wire err — A/B/C (정전은 null) */
  channel?: string | null;
};

/** 이상상황 목록 — 모듈 경보면 농장 표시명 중심 */
export function isModuleAlarmRow(a: AlarmRow): boolean {
  return a.source === "module";
}

/** 모듈 에러코드 외 — 확인(ack) 없음 · 종에서 시각 생략 */
export function isSituationLiveStateRow(a: AlarmRow): boolean {
  return !isModuleAlarmRow(a);
}

/** 일보 PDF — 모듈 에러 + 통신 두절만 (알람값 초과·권장 이탈 제외) */
export function isDailyReportSituationRow(a: AlarmRow): boolean {
  return isModuleAlarmRow(a) || a.alarmType === SITUATION_OFFLINE_TYPE;
}

/** 모듈·통신두절·환경 이상상황 행 — 부가 메타 한 줄 */
export function situationAlarmMetaLine(a: AlarmRow): string {
  if (isModuleAlarmRow(a)) {
    if (a.stallTyCode && a.stallNo && a.eqpmnNo) {
      const parts = [
        formatStallTypeLabel(a.stallTyCode),
        formatControllerSlotLabel({
          stallNo: a.stallNo,
          eqpmnNo: a.eqpmnNo,
          idx: a.idx,
        }),
      ];
      if (a.channel) parts.push(`${a.channel}라인`);
      return parts.join(" · ");
    }
    return a.farmName?.trim() || a.detail?.trim() || "모듈 경보";
  }
  const parts = [
    a.stallTyCode ? formatStallTypeLabel(a.stallTyCode) : "—",
    formatControllerSlotLabel({
      stallNo: a.stallNo,
      eqpmnNo: a.eqpmnNo,
      idx: a.idx,
    }),
  ];
  if (
    (a.alarmType === SITUATION_FIELD_ALARM_TYPE ||
      a.alarmType === SITUATION_RECOMMEND_TYPE) &&
    a.detail.trim()
  ) {
    parts.push(a.detail.trim());
  }
  return parts.join(" · ");
}

export type AlarmThresholds = {
  tempHigh: number;
  tempLow: number;
  humidityHigh: number;
  humidityLow: number;
};

export const DEFAULT_ALARM_THRESHOLDS: AlarmThresholds = {
  tempHigh: 35,
  tempLow: 10,
  humidityHigh: 90,
  humidityLow: 30,
};

export type AlarmSettings = {
  global: AlarmThresholds;
  /** @deprecated farm-scoped overrides in byScope preferred */
  byStallTyCode: Record<string, AlarmThresholds>;
  /** farm → sp → stall → controller hierarchical overrides */
  byScope?: Record<string, AlarmThresholds>;
};

export const DEFAULT_ALARM_SETTINGS: AlarmSettings = {
  global: DEFAULT_ALARM_THRESHOLDS,
  byStallTyCode: {},
  byScope: {},
};

export function resolveThresholds(
  settings: AlarmSettings,
  stallTyCode: string | null
): AlarmThresholds {
  if (stallTyCode && settings.byStallTyCode[stallTyCode]) {
    return settings.byStallTyCode[stallTyCode];
  }
  return settings.global;
}

export function deriveAlarmsFromReadings(
  readings: BarnReading[],
  _settings: AlarmSettings | AlarmThresholds = DEFAULT_ALARM_SETTINGS
): AlarmRow[] {
  const rows: AlarmRow[] = [];

  for (const r of readings) {
    const thresholds =
      deviceAlarmThresholds(r);

    if (r.tempC != null) {
      if (r.tempC >= thresholds.tempHigh) {
        rows.push(makeAlarm(r, "온도 상한 초과", "critical", `${r.tempC}℃ ≥ ${thresholds.tempHigh}℃`));
      } else if (r.tempC <= thresholds.tempLow) {
        rows.push(makeAlarm(r, "온도 하한 미만", "warning", `${r.tempC}℃ ≤ ${thresholds.tempLow}℃`));
      }
    }
    if (r.humidityPct != null) {
      if (r.humidityPct >= thresholds.humidityHigh) {
        rows.push(makeAlarm(r, "습도 상한 초과", "warning", `${r.humidityPct}% ≥ ${thresholds.humidityHigh}%`));
      } else if (r.humidityPct <= thresholds.humidityLow) {
        rows.push(makeAlarm(r, "습도 하한 미만", "warning", `${r.humidityPct}% ≤ ${thresholds.humidityLow}%`));
      }
    }
    if (r.status === "offline") {
      rows.push(
        makeAlarm(r, SITUATION_OFFLINE_TYPE, "critical", "15분 이상 미수신"),
      );
    }
  }

  return rows.sort((a, b) => {
    const hierarchyCmp = compareReadings(
      alarmAsReading(a),
      alarmAsReading(b)
    );
    if (hierarchyCmp !== 0) return hierarchyCmp;
    return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
  });
}

function alarmAsReading(a: AlarmRow): BarnReading {
  return {
    key: a.id,
    farmKey: a.farmKey,
    moduleUid: a.moduleUid,
    controllerKey: a.controllerKey,
    idx: a.idx,
    eqpmnNo: a.eqpmnNo,
    stallNo: a.stallNo,
    stallTyCode: a.stallTyCode,
    label: "",
    tempC: null,
    humidityPct: null,
    fanSupply: null,
    fanExhaust: null,
    fanIntake: null,
    fanSupplySeries: [],
    fanExhaustSeries: [],
    fanIntakeSeries: [],
    mesureDt: null,
    receivedAt: a.occurredAt,
    status: a.controllerStatus,
    packetMode: "live",
    wireVer: null,
  };
}

function makeAlarm(
  r: BarnReading,
  alarmType: string,
  severity: AlarmSeverity,
  detail: string
): AlarmRow {
  return {
    id: `${r.key}-${alarmType}`,
    occurredAt: r.receivedAt,
    farmKey: r.farmKey,
    moduleUid: r.moduleUid,
    controllerKey: r.controllerKey,
    idx: r.idx,
    eqpmnNo: r.eqpmnNo,
    stallNo: r.stallNo,
    stallTyCode: r.stallTyCode,
    alarmType,
    severity,
    status: r.status === "offline" ? "active" : "active",
    detail,
    controllerStatus: r.status,
    source: "derived",
  };
}

/** LIVE offline → 이상상황 행 (모듈 에러와 함께 헤더 목록에 표시) */
export function offlineReadingsToAlarmRows(
  readings: BarnReading[],
): AlarmRow[] {
  const rows: AlarmRow[] = [];
  for (const r of readings) {
    if (r.status !== "offline") continue;
    rows.push(
      makeAlarm(r, SITUATION_OFFLINE_TYPE, "critical", "15분 이상 미수신"),
    );
  }
  return rows;
}

function situationReadingValueLabel(
  value: number,
  unit: "℃" | "%",
): string {
  if (unit === "%") return `${Math.round(value)}%`;
  return Number.isInteger(value) ? `${value}℃` : `${value.toFixed(1)}℃`;
}

/** 현장 알람 기준±편차 이탈 — 컨트롤러당 1행. 통신두절은 제외. */
export function fieldAlarmExceedToAlarmRows(
  readings: BarnReading[],
  settings: AlarmSettings,
): AlarmRow[] {
  const rows: AlarmRow[] = [];
  for (const r of readings) {
    if (r.status === "offline") continue;
    const t = resolveThresholdsForReading(settings, r);
    const parts: string[] = [];
    if (r.tempC != null && Number.isFinite(r.tempC)) {
      if (r.tempC >= t.tempHigh || r.tempC <= t.tempLow) {
        parts.push(
          `온도 ${situationReadingValueLabel(r.tempC, "℃")} (${formatAlarmBaselinePair(t.tempLow, t.tempHigh, "℃")})`,
        );
      }
    }
    if (r.humidityPct != null && Number.isFinite(r.humidityPct)) {
      if (
        r.humidityPct >= t.humidityHigh ||
        r.humidityPct <= t.humidityLow
      ) {
        parts.push(
          `습도 ${situationReadingValueLabel(r.humidityPct, "%")} (${formatAlarmBaselinePair(t.humidityLow, t.humidityHigh, "%")})`,
        );
      }
    }
    if (parts.length === 0) continue;
    rows.push(
      makeAlarm(
        r,
        SITUATION_FIELD_ALARM_TYPE,
        r.tempC != null &&
          Number.isFinite(r.tempC) &&
          (r.tempC >= t.tempHigh || r.tempC <= t.tempLow)
          ? "critical"
          : "warning",
        parts.join(" · "),
      ),
    );
  }
  return rows;
}

/** 축사유형 권장 이탈 — 현장 알람에 이미 오른 컨트롤러는 제외. */
export function recommendOffbandToAlarmRows(
  readings: BarnReading[],
  skipControllerKeys: ReadonlySet<string>,
): AlarmRow[] {
  const rows: AlarmRow[] = [];
  for (const r of readings) {
    if (r.status === "offline") continue;
    if (skipControllerKeys.has(r.controllerKey)) continue;
    const band = pigEnvBandForStallTy(r.stallTyCode);
    if (!band) continue;
    const parts: string[] = [];
    const tempFit = pigEnvFitToBand(r.tempC, band.tempMinC, band.tempMaxC);
    if (pigEnvFitOffBand(tempFit) && r.tempC != null) {
      parts.push(
        `온도 ${situationReadingValueLabel(r.tempC, "℃")} (권장 ${band.tempMinC}~${band.tempMaxC}℃)`,
      );
    }
    const humFit = pigEnvFitToBand(
      r.humidityPct,
      band.humidityMinPct,
      band.humidityMaxPct,
    );
    if (pigEnvFitOffBand(humFit) && r.humidityPct != null) {
      parts.push(
        `습도 ${situationReadingValueLabel(r.humidityPct, "%")} (권장 ${band.humidityMinPct}~${band.humidityMaxPct}%)`,
      );
    }
    if (parts.length === 0) continue;
    rows.push(
      makeAlarm(r, SITUATION_RECOMMEND_TYPE, "warning", parts.join(" · ")),
    );
  }
  return rows;
}

/**
 * 이상상황 종 = 모듈 에러코드 + 통신 두절 + 알람값 초과
 * (+ 현장 알람에 안 오른 권장 이탈).
 */
export function mergeSituationAlarms(
  moduleAlarms: AlarmRow[],
  readings: BarnReading[],
  settings?: AlarmSettings | null,
): AlarmRow[] {
  const offline = offlineReadingsToAlarmRows(readings);
  const field = fieldAlarmExceedToAlarmRows(readings, settings ?? DEFAULT_ALARM_SETTINGS);
  const fieldKeys = new Set(field.map((a) => a.controllerKey));
  const recommend = recommendOffbandToAlarmRows(readings, fieldKeys);
  const seen = new Set(
    moduleAlarms.map((a) => `${a.controllerKey}\0${a.alarmType}`),
  );
  const extras = [...offline, ...field, ...recommend].filter((o) => {
    const key = `${o.controllerKey}\0${o.alarmType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...moduleAlarms, ...extras];
}

export function summarizeAlarms(alarms: AlarmRow[]) {
  return {
    total: alarms.length,
    critical: alarms.filter((a) => a.severity === "critical").length,
    warning: alarms.filter((a) => a.severity === "warning").length,
    offline: alarms.filter((a) => a.alarmType === "통신 두절").length,
  };
}

/**
 * TopBar / FAB 알림 행 → 차트 탭 + 해당 컨트롤러(가능하면) 스코프.
 * stall/유형이 부족하면 상위 스코프로 완화.
 */
export function alarmChartHref(
  alarm: Pick<
    AlarmRow,
    "farmKey" | "stallTyCode" | "stallNo" | "controllerKey" | "id"
  >,
): string {
  const params = new URLSearchParams();
  appendFarmKeyParams(params, alarm.farmKey);
  applyChartViewParams(params);

  const sp = alarm.stallTyCode
    ? normalizeStallTyCode(alarm.stallTyCode)
    : "";
  const stall = alarm.stallNo?.trim() ?? "";
  let scope: FarmChartScope = { level: "farm" };
  if (sp && stall && alarm.controllerKey) {
    scope = {
      level: "controller",
      stallTyCode: sp,
      stallNo: stall,
      controllerKey: alarm.controllerKey,
    };
  } else if (sp && stall) {
    scope = { level: "stall", stallTyCode: sp, stallNo: stall };
  } else if (sp) {
    scope = { level: "sp", stallTyCode: sp };
  }
  applyFarmChartScopeParams(params, scope);
  if (alarm.id) params.set("alarm", alarm.id);
  return `/farm?${params.toString()}`;
}

/**
 * @deprecated 알림 행 1차는 {@link alarmChartHref}. 목록 뷰 포커스가 필요할 때만 사용.
 * TopBar bell → 컨트롤러 deep link (목록 뷰).
 */
export function alarmControlHref(
  alarm: Pick<
    AlarmRow,
    "farmKey" | "stallTyCode" | "stallNo" | "controllerKey" | "idx"
  >
): string {
  return buildControllerHref({
    farmKey: alarm.farmKey,
    sp: alarm.stallTyCode,
    stallNo: alarm.stallNo,
    controllerKey: alarm.controllerKey,
    ctrlIdx: alarm.idx,
    view: "list",
  });
}

export function validateAlarmThresholds(t: AlarmThresholds): string | null {
  if (t.tempHigh <= t.tempLow) return "온도 상한은 하한보다 커야 합니다.";
  if (t.humidityHigh <= t.humidityLow) return "습도 상한은 하한보다 커야 합니다.";
  if (t.tempLow < 10 || t.tempHigh > 35) return "온도 범위는 10~35℃ 이내로 설정하세요.";
  if (t.humidityLow < 0 || t.humidityHigh > 100) return "습도 범위는 0~100% 이내로 설정하세요.";
  return null;
}
