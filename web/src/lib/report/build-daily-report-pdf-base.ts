import { CHANNEL_SLOT_LABELS } from "@/lib/data/iot-channel";
import { TREND_CHART_COLORS_PRINT } from "@/lib/farm/trend-chart-series";
import {
  averageBarnsSeries,
} from "@/lib/report/daily-report-briefing";
import {
  type DailyReportPayload,
  type DailyReportSeries,
} from "@/lib/report/daily-report-payload";
import { DAILY_REPORT_PDF_THEME } from "@/lib/report/daily-report-pdf-theme";
import type { TrendPeriodId } from "@/lib/data/farm-trend-types";

/**
 * 일일 리포트 PDF 빌더의 순수 상수·포매터·집계·가이드 로직.
 *
 * `build-daily-report-pdf.ts`에서 분리(동작 보존). 캔버스/jsPDF 드로잉에
 * 의존하지 않는 순수부만 모아 재사용·테스트를 쉽게 한다.
 */

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
export const MARGIN = 28;
export const INK = "#111827";
export const MUTED = "#6B7280";
export const RULE = "#E5E7EB";
export const DEFAULT_THEME = DAILY_REPORT_PDF_THEME;
export const FONT =
  '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", sans-serif';
/** 본문 하단(푸터 위) */
export const CONTENT_BOTTOM = PAGE_H - 36;

/** KPI/판정 색 — 정상·주의·위험 구분 (전부 빨강이면 차별 없음) */
export type KpiTone = "neutral" | "ok" | "caution" | "danger";

export const KPI_TONE: Record<
  KpiTone,
  { bg: string; border: string; value: string }
> = {
  neutral: { bg: "#F9FAFB", border: "#E5E7EB", value: INK },
  ok: { bg: "#ECFDF5", border: "#A7F3D0", value: "#047857" },
  caution: { bg: "#FFFBEB", border: "#FDE68A", value: "#B45309" },
  danger: { bg: "#FEF2F2", border: "#FECACA", value: "#B91C1C" },
};

export function toneFromControllerStatus(status: string): KpiTone {
  if (status === "offline") return "danger";
  if (status === "caution") return "caution";
  return "ok";
}

export function toneFromJudge(judge: string): KpiTone {
  if (judge === "통신 두절") return "danger";
  if (judge === "수신 지연") return "caution";
  return "ok";
}

export function fmt(n: number | null | undefined, digits = 1, unit = ""): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}${unit}`;
}

export function statusLabel(status: string): string {
  if (status === "offline") return "통신 두절";
  if (status === "caution") return "수신 지연";
  return "정상";
}

export function severityLabel(severity: "warning" | "critical"): string {
  return severity === "critical" ? "심각" : "경고";
}

export function situationSourceLabel(source: "module" | "offline"): string {
  return source === "module" ? "모듈" : "통신두절";
}

/** 축사 시리즈 슬롯 평균 → 농장 대표 시리즈 */
export function averageFarmSeries(
  barns: DailyReportPayload["barns"],
  period: TrendPeriodId,
): DailyReportSeries {
  return averageBarnsSeries(barns, period);
}

export type AttentionRow = {
  barn: string;
  eqpmnNo: string;
  status: string;
  tempC: number | null;
  humidityPct: number | null;
};

export function collectAttentionRows(
  barns: DailyReportPayload["barns"],
): AttentionRow[] {
  const rows: AttentionRow[] = [];
  for (const b of barns) {
    for (const c of b.controllers) {
      if (c.status !== "caution" && c.status !== "offline") continue;
      rows.push({
        barn: `${b.stallLabel} ${b.stallNo}`,
        eqpmnNo: c.eqpmnNo,
        status: c.status,
        tempC: c.tempC,
        humidityPct: c.humidityPct,
      });
    }
  }
  rows.sort((a, b) => {
    const rank = (s: string) => (s === "offline" ? 0 : 1);
    const d = rank(a.status) - rank(b.status);
    if (d !== 0) return d;
    return a.barn.localeCompare(b.barn, "ko");
  });
  return rows;
}

export function countSeriesPoints(
  series: { values: (number | null)[] }[],
): number {
  return series.reduce(
    (n, s) =>
      n + s.values.filter((v) => v != null && !Number.isNaN(v)).length,
    0,
  );
}

export function finiteExtent(
  cols: (number | null)[][],
): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const col of cols) {
    for (const v of col) {
      if (v == null || Number.isNaN(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

export type ChartGuide = { lo: number; hi: number; name: string };

export function farmAlarmGuides(payload: DailyReportPayload): {
  temp?: ChartGuide;
  humidity?: ChartGuide;
} {
  const g = payload.alarmGuide;
  return {
    temp: g?.tempLow != null && g?.tempHigh != null ? { lo: g.tempLow, hi: g.tempHigh, name: "현재 장비 경보" } : undefined,
    humidity: undefined,
  };
}

export const ALARM_GUIDE_LEGEND =
  "주황 파선 = 현재 장비 경보 상·하한 (공통값일 때)  ·  회색 점선 = 이 그래프의 최저·최고";

export function formatDataRange(
  ext: { min: number; max: number } | null,
  unit: string,
  digits: number,
): string {
  if (!ext) return "그래프 —";
  return `그래프 ${ext.min.toFixed(digits)}~${ext.max.toFixed(digits)}${unit}`;
}

export function stackedMetricTitle(
  name: string,
  guide: ChartGuide | undefined,
  ext: { min: number; max: number } | null,
  unit: string,
  digits: number,
  axisHint?: string,
): string {
  const parts = [name];
  if (guide) parts.push(`${guide.name} ${guide.lo}~${guide.hi}${unit}`);
  if (axisHint) parts.push(axisHint);
  parts.push(formatDataRange(ext, unit, digits));
  return parts.join("  ·  ");
}

export function printMotorSeries(print: DailyReportSeries) {
  return [
    {
      values: print.motorA,
      color: TREND_CHART_COLORS_PRINT.fanIntake,
      label: CHANNEL_SLOT_LABELS.A,
    },
    {
      values: print.motorB,
      color: TREND_CHART_COLORS_PRINT.fanExhaust,
      label: CHANNEL_SLOT_LABELS.B,
    },
    {
      values: print.motorC,
      color: TREND_CHART_COLORS_PRINT.fanSupply,
      label: CHANNEL_SLOT_LABELS.C,
    },
  ].filter((s) => s.values.some((v) => v != null && !Number.isNaN(v)));
}
