/**
 * 일보 브리핑 모델 — 축사유형 집계, 30일 1시간 그래프·권장 이탈 시간, 30일 최장 연속 이탈.
 * 문장은 숫자 FACT만 (LLM 자유 문장 없음). 내부 코드·키 비노출.
 */

import { listTempAlarmBreachRuns } from "@/lib/farm/alarm-breach-x-range";
import { pigEnvBandForStallTy } from "@/lib/farm/pig-env-recommend";
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

export type EnvBand = { lo: number; hi: number };

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
  recommendTemp: EnvBand | null;
  recommendHum: EnvBand | null;
  hoursOutsideTemp30d: number | null;
  series30d: DailyReportSeries;
  barns: DailyReportBarnRow[];
};

export type DailyReportRiskSample = {
  label: string;
  temp: number | null;
  humidity: number | null;
  outsideTemp: boolean;
};

export type DailyReportRiskWindow = {
  found: boolean;
  stallLabel: string;
  hours: number;
  side: "high" | "low" | "both" | null;
  peakExcess: number;
  startLabel: string;
  endLabel: string;
  series: DailyReportSeries;
  samples: DailyReportRiskSample[];
  recommendTemp: EnvBand | null;
  recommendHum: EnvBand | null;
};

export type DailyReportBriefing = {
  farm30d: DailyReportSeries;
  farmAvgTemp30d: number | null;
  farmAvgHum30d: number | null;
  types: DailyReportTypeBrief[];
  risk: DailyReportRiskWindow;
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

/** 7일·30일 버킷은 1시간. 유한 값만 세고, 구간 밖이면 1시간으로 친다. */
export function countOutsideBand(
  values: (number | null | undefined)[],
  lo: number,
  hi: number,
): number {
  let n = 0;
  for (const v of values) {
    if (v == null || Number.isNaN(v)) continue;
    if (v < lo || v > hi) n += 1;
  }
  return n;
}

export function worstJudge(judges: string[]): string {
  if (judges.includes("통신 두절")) return "통신 두절";
  if (judges.includes("수신 지연")) return "수신 지연";
  return "정상";
}

export function sliceDailyReportSeries(
  series: DailyReportSeries,
  from: number,
  toInclusive: number,
): DailyReportSeries {
  const start = Math.max(0, Math.min(from, toInclusive));
  const end = Math.min(
    series.categories.length - 1,
    Math.max(from, toInclusive),
  );
  if (series.categories.length === 0 || start > end) {
    return emptyDailyReportSeries();
  }
  const pick = <T,>(arr: T[]) => arr.slice(start, end + 1);
  return {
    categories: pick(series.categories),
    temp: pick(series.temp),
    humidity: pick(series.humidity),
    motorA: pick(series.motorA),
    motorB: pick(series.motorB),
    motorC: pick(series.motorC),
  };
}

function fmt1(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

function fmt0(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(0);
}

function bandFromPig(code: string): {
  temp: EnvBand;
  humidity: EnvBand;
} | null {
  const row = pigEnvBandForStallTy(code);
  if (!row) return null;
  return {
    temp: { lo: row.tempMinC, hi: row.tempMaxC },
    humidity: { lo: row.humidityMinPct, hi: row.humidityMaxPct },
  };
}

function pickSampleIdx(start: number, end: number, count: number): number[] {
  const span = end - start;
  if (span < 0) return [];
  if (span === 0) return [start];
  const n = Math.min(count, span + 1);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const idx = start + Math.round((i * span) / Math.max(1, n - 1));
    if (out.at(-1) !== idx) out.push(idx);
  }
  return out;
}

function emptyRisk(): DailyReportRiskWindow {
  return {
    found: false,
    stallLabel: "",
    hours: 0,
    side: null,
    peakExcess: 0,
    startLabel: "",
    endLabel: "",
    series: emptyDailyReportSeries(),
    samples: [],
    recommendTemp: null,
    recommendHum: null,
  };
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
      const pig = bandFromPig(code);
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
        recommendTemp: pig?.temp ?? null,
        recommendHum: pig?.humidity ?? null,
        hoursOutsideTemp30d: pig
          ? countOutsideBand(series30d.temp, pig.temp.lo, pig.temp.hi)
          : null,
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

  let best: {
    type: DailyReportTypeBrief;
    start: number;
    end: number;
    hours: number;
    side: "high" | "low" | "both";
    peakExcess: number;
  } | null = null;

  for (const type of types) {
    const band = type.recommendTemp;
    if (!band) continue;
    const runs = listTempAlarmBreachRuns(
      type.series30d.temp,
      band.lo,
      band.hi,
    );
    for (const run of runs) {
      const hours = run.end - run.start + 1;
      if (
        !best ||
        hours > best.hours ||
        (hours === best.hours && run.peakExcess > best.peakExcess)
      ) {
        best = {
          type,
          start: run.start,
          end: run.end,
          hours,
          side: run.side,
          peakExcess: run.peakExcess,
        };
      }
    }
  }

  let risk = emptyRisk();
  if (best) {
    const pad = best.end - best.start < 3 ? 2 : 0;
    const from = Math.max(0, best.start - pad);
    const to = Math.min(best.type.series30d.categories.length - 1, best.end + pad);
    const rec = best.type.recommendTemp!;
    risk = {
      found: true,
      stallLabel: best.type.stallLabel,
      hours: best.hours,
      side: best.side,
      peakExcess: best.peakExcess,
      startLabel: best.type.series30d.categories[best.start] ?? "",
      endLabel: best.type.series30d.categories[best.end] ?? "",
      series: sliceDailyReportSeries(best.type.series30d, from, to),
      samples: pickSampleIdx(best.start, best.end, 4).map((i) => {
        const temp = best.type.series30d.temp[i] ?? null;
        return {
          label: best.type.series30d.categories[i] ?? "",
          temp,
          humidity: best.type.series30d.humidity[i] ?? null,
          outsideTemp:
            temp != null && !Number.isNaN(temp) && (temp < rec.lo || temp > rec.hi),
        };
      }),
      recommendTemp: rec,
      recommendHum: best.type.recommendHum,
    };
  }

  return {
    farm30d,
    farmAvgTemp30d: avgFinite(farm30d.temp),
    farmAvgHum30d: avgFinite(farm30d.humidity),
    types,
    risk,
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

  const high: string[] = [];
  const low: string[] = [];
  for (const t of briefing.types) {
    if (!t.recommendTemp || t.avgTemp30d == null) continue;
    if (t.avgTemp30d > t.recommendTemp.hi) high.push(t.stallLabel);
    else if (t.avgTemp30d < t.recommendTemp.lo) low.push(t.stallLabel);
  }
  const joinNames = (names: string[], rest: string) =>
    names.length > 1
      ? `${names.join("·")} 모두 ${rest}`
      : `${names[0]}는 ${rest}`;
  if (high.length) {
    lines[0] += ` ${joinNames(high, "생육 권장 온도보다 높았습니다.")}`;
  } else if (low.length) {
    lines[0] += ` ${joinNames(low, "생육 권장 온도보다 낮았습니다.")}`;
  }

  const ov = payload.overview;
  if (ov.alarmCount > 0 || ov.offlineCount > 0) {
    lines.push(
      `이상상황 ${ov.alarmCount}건 · 통신 두절 ${ov.offlineCount}대. 온·습 권장구간 이탈은 이상상황과 별개이며, 마지막 페이지에 30일 중 가장 긴 구간을 실었습니다.`,
    );
  } else {
    lines.push(
      "오늘 모듈 에러·통신 두절은 없습니다. 온·습 권장구간 이탈은 마지막 페이지에서 봅니다.",
    );
  }
  return lines;
}

export function typeBriefingFacts(type: DailyReportTypeBrief): string[] {
  const lines: string[] = [];
  if (type.recommendTemp) {
    const rec = `${type.recommendTemp.lo}~${type.recommendTemp.hi}℃`;
    if (type.avgTemp30d == null) {
      lines.push(`${type.stallLabel} 30일 온도 기록이 부족합니다. 권장은 ${rec}입니다.`);
    } else if (type.avgTemp30d > type.recommendTemp.hi) {
      lines.push(
        `${type.stallLabel} 30일 평균 ${fmt1(type.avgTemp30d)}℃로, 권장 ${rec}보다 높았습니다. 권장구간 밖은 ${type.hoursOutsideTemp30d ?? 0}시간입니다.`,
      );
    } else if (type.avgTemp30d < type.recommendTemp.lo) {
      lines.push(
        `${type.stallLabel} 30일 평균 ${fmt1(type.avgTemp30d)}℃로, 권장 ${rec}보다 낮았습니다. 권장구간 밖은 ${type.hoursOutsideTemp30d ?? 0}시간입니다.`,
      );
    } else {
      lines.push(
        `${type.stallLabel} 30일 평균 ${fmt1(type.avgTemp30d)}℃로, 권장 ${rec} 안에 있었습니다. 권장구간 밖은 ${type.hoursOutsideTemp30d ?? 0}시간입니다.`,
      );
    }
  } else {
    lines.push(
      `${type.stallLabel} 30일 평균 온도 ${fmt1(type.avgTemp30d)}℃, 습도 ${fmt0(type.avgHum30d)}%. 이 유형은 생육 권장 구간이 없어 가이드만 표시합니다.`,
    );
  }

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

function sidePhrase(side: "high" | "low" | "both"): string {
  if (side === "low") return "권장 하한보다 낮았습니다";
  if (side === "both") return "권장구간을 위아래로 벗어났습니다";
  return "권장 상한보다 높았습니다";
}

function peakPhrase(
  side: "high" | "low" | "both",
  peak: number,
): string {
  const n = peak.toFixed(1);
  if (side === "low") return `하한 대비 ${n}℃`;
  if (side === "both") return `이탈 폭 ${n}℃`;
  return `상한 대비 +${n}℃`;
}

export function riskBriefingFacts(risk: DailyReportRiskWindow): string[] {
  if (!risk.found) {
    return [
      "30일 동안 생육 권장 온도를 벗어난 연속 구간이 없습니다.",
      "이 페이지는 생육 권장구간 이탈입니다. 헤더 이상상황(모듈 에러·통신 두절)과는 다릅니다.",
    ];
  }
  const side = risk.side ?? "high";
  return [
    `${risk.startLabel}부터 ${risk.endLabel}까지 ${risk.hours}시간, ${risk.stallLabel} 온도가 ${sidePhrase(side)}. 최고는 ${peakPhrase(side, risk.peakExcess)}입니다.`,
    "이 페이지는 생육 권장구간 이탈입니다. 헤더 이상상황(모듈 에러·통신 두절)과는 다릅니다.",
  ];
}
