/**
 * 일보 브리핑 모델 — 축사유형별 실측 집계와 30일 1시간 그래프.
 * 문장은 숫자 FACT만 (LLM 자유 문장 없음). 내부 코드·키 비노출.
 */

import {
  getStallTypeName,
  normalizeStallTyCode,
  stallTyCodeSortKey,
} from "@/lib/data/stall-type";
import type { TrendPeriodId } from "@/lib/data/farm-trend-types";
import type {
  DailyReportBarn,
  DailyReportPayload,
  DailyReportSeries,
} from "@/lib/report/daily-report-payload";


export type DailyReportBarnRow = {
  stallLabel: string;
  stallNo: string;
  total: number;
  online: number;
  tempNow: number | null;
  humNow: number | null;
  judge: string;
};

export type DailyReportTypeBrief = {
  stallTyCode: string;
  stallLabel: string;
  barnCount: number;
  controllerTotal: number;
  online: number;
  judge: string;
  avgTemp30d: number | null;
  avgHum30d: number | null;
  series30d: DailyReportSeries;
  barns: DailyReportBarnRow[];
};

export type DailyReportBriefing = {
  farm30d: DailyReportSeries;
  farmAvgTemp30d: number | null;
  farmAvgHum30d: number | null;
  types: DailyReportTypeBrief[];
};

export function avgFinite(nums: (number | null | undefined)[]): number | null {
  const v = nums.filter((n): n is number => n != null && !Number.isNaN(n));
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export function emptyDailyReportSeries(): DailyReportSeries {
  return {
    categories: [],
    temp: [],
    humidity: [],
    motorA: [],
    motorB: [],
    motorC: [],
  };
}

export function averageBarnsSeries(
  barns: DailyReportBarn[],
  period: TrendPeriodId,
): DailyReportSeries {
  if (!barns.length) return emptyDailyReportSeries();
  const categories = barns[0]!.periods[period].categories.slice();
  const len = categories.length;
  if (!len) return emptyDailyReportSeries();
  const avgCol = (
    pick: (s: DailyReportSeries) => (number | null)[],
  ): (number | null)[] => {
    const out = new Array<number | null>(len).fill(null);
    for (let i = 0; i < len; i++) {
      let sum = 0;
      let n = 0;
      for (const b of barns) {
        const v = pick(b.periods[period])[i];
        if (v != null && !Number.isNaN(v)) {
          sum += v;
          n += 1;
        }
      }
      out[i] = n ? sum / n : null;
    }
    return out;
  };
  return {
    categories,
    temp: avgCol((s) => s.temp),
    humidity: avgCol((s) => s.humidity),
    motorA: avgCol((s) => s.motorA),
    motorB: avgCol((s) => s.motorB),
    motorC: avgCol((s) => s.motorC),
  };
}

export function worstJudge(judges: string[]): string {
  if (judges.includes("통신 두절")) return "통신 두절";
  if (judges.includes("수신 지연")) return "수신 지연";
  return "정상";
}

function fmt1(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

function fmt0(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(0);
}

export function buildDailyReportBriefing(
  payload: DailyReportPayload,
): DailyReportBriefing {
  const grouped = new Map<string, DailyReportBarn[]>();
  for (const barn of payload.barns) {
    const code = normalizeStallTyCode(barn.stallTyCode);
    const list = grouped.get(code) ?? [];
    list.push(barn);
    grouped.set(code, list);
  }

  const types: DailyReportTypeBrief[] = [...grouped.entries()]
    .sort((a, b) => stallTyCodeSortKey(a[0]) - stallTyCodeSortKey(b[0]))
    .map(([code, barns]) => {
      const series30d = averageBarnsSeries(barns, "30d");
      return {
        stallTyCode: code,
        stallLabel: barns[0]?.stallLabel || getStallTypeName(code),
        barnCount: barns.length,
        controllerTotal: barns.reduce((n, b) => n + b.kpi.total, 0),
        online: barns.reduce((n, b) => n + b.kpi.online, 0),
        judge: worstJudge(barns.map((b) => b.kpi.judge)),
        avgTemp30d: avgFinite(series30d.temp),
        avgHum30d: avgFinite(series30d.humidity),
        series30d,
        barns: barns.map((b) => ({
          stallLabel: b.stallLabel,
          stallNo: b.stallNo,
          total: b.kpi.total,
          online: b.kpi.online,
          tempNow: b.kpi.tempNow,
          humNow: b.kpi.humNow,
          judge: b.kpi.judge,
        })),
      };
    });

  const farm30d = averageBarnsSeries(payload.barns, "30d");

  return {
    farm30d,
    farmAvgTemp30d: avgFinite(farm30d.temp),
    farmAvgHum30d: avgFinite(farm30d.humidity),
    types,
  };
}

export function farmBriefingFacts(
  briefing: DailyReportBriefing,
  payload: DailyReportPayload,
): string[] {
  const lines: string[] = [];
  lines.push(
    `30일 농장 평균 온도 ${fmt1(briefing.farmAvgTemp30d)}℃, 습도 ${fmt0(briefing.farmAvgHum30d)}%.`,
  );

  const ov = payload.overview;
  if (ov.alarmCount > 0 || ov.offlineCount > 0) {
    lines.push(
      `모듈 오류·통신 두절 ${ov.alarmCount}건 · 통신 두절 ${ov.offlineCount}대.`,
    );
  } else {
    lines.push(
      "오늘 모듈 오류·통신 두절은 없습니다.",
    );
  }
  return lines;
}

export function typeBriefingFacts(type: DailyReportTypeBrief): string[] {
  const lines: string[] = [];
  lines.push(
    type.avgTemp30d == null
      ? `${type.stallLabel} 30일 온도 기록이 부족합니다. 평균 습도 ${fmt0(type.avgHum30d)}%.`
      : `${type.stallLabel} 30일 평균 온도 ${fmt1(type.avgTemp30d)}℃, 습도 ${fmt0(type.avgHum30d)}%.`,
  );

  const delayed = type.barns.filter((b) => b.judge === "수신 지연").length;
  if (type.judge === "통신 두절") {
    lines.push(
      `${type.barnCount}동 중 수신은 ${type.judge}입니다. 온라인 ${type.online}/${type.controllerTotal}대.`,
    );
  } else if (delayed > 0) {
    lines.push(
      `${type.barnCount}동 중 수신 지연이 있습니다. 온라인 ${type.online}/${type.controllerTotal}대.`,
    );
  } else {
    lines.push(
      `${type.barnCount}동 모두 수신은 정상입니다. 온라인 ${type.online}/${type.controllerTotal}대.`,
    );
  }
  return lines;
}
