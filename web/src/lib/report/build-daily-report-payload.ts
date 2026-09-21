import "server-only";

import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import { getFarmControllerTrendAllPeriods } from "@/lib/data/farm-trend-history";
import type {
  TrendControllerPeriodData,
  TrendControllerSeries,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { fetchLiveReadings } from "@/lib/data/iot-live-fetch";
import { mergeSituationAlarms } from "@/lib/data/alarms";
import { buildAlarmScopeKey, resolveThresholdsForScope } from "@/lib/data/alarm-scope";
import { getAlarmSettings } from "@/lib/data/alarm-settings";
import { fetchActiveModuleAlarms } from "@/lib/data/module-alarms";
import { getFarmLocation } from "@/lib/data/farm-location";
import { farmDisplayLabel } from "@/lib/data/farm-summaries";
import { getStallTypeName } from "@/lib/data/stall-type";
import {
  barnJudgeFromControllerStatuses,
  toDailyReportAlarmRows,
} from "@/lib/report/daily-report-alarms";
import type {
  DailyReportBarn,
  DailyReportControllerRow,
  DailyReportPayload,
  DailyReportSeries,
} from "@/lib/report/daily-report-payload";

const PERIODS: TrendPeriodId[] = ["24h", "7d", "30d"];

function minMax(values: (number | null)[]): {
  min: number | null;
  max: number | null;
} {
  let min: number | null = null;
  let max: number | null = null;
  for (const v of values) {
    if (v == null || Number.isNaN(v)) continue;
    min = min == null ? v : Math.min(min, v);
    max = max == null ? v : Math.max(max, v);
  }
  return { min, max };
}

function lastFinite(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v != null && !Number.isNaN(v)) return v;
  }
  return null;
}

function avgFinite(nums: (number | null)[]): number | null {
  const v = nums.filter((n): n is number => n != null && !Number.isNaN(n));
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/** 슬롯별 컨트롤러 평균 — null 슬롯은 null 유지 */
function avgColumns(
  controllers: TrendControllerSeries[],
  pick: (c: TrendControllerSeries) => (number | null)[],
  len: number,
): (number | null)[] {
  const out = new Array<number | null>(len).fill(null);
  for (let i = 0; i < len; i++) {
    const slot: (number | null)[] = [];
    for (const c of controllers) {
      const col = pick(c);
      const v = col[i];
      if (v != null && !Number.isNaN(v)) slot.push(v);
    }
    out[i] = avgFinite(slot);
  }
  return out;
}

/**
 * PDF용 시리즈 — 허브 TREND_PERIODS 보관 (24h×96 15분 / 7d×168 1h / 30d×720 1h).
 * 공식 일보 그래프는 30일 1시간. 인쇄 다운샘플은 캔버스에서 LTTB. 축사 내 컨트롤러는 슬롯 평균.
 */
function seriesFromControllers(
  categories: string[],
  controllers: TrendControllerSeries[],
): DailyReportSeries {
  const len = categories.length;
  if (!controllers.length || !len) {
    return {
      categories: [],
      temp: [],
      humidity: [],
      motorA: [],
      motorB: [],
      motorC: [],
    };
  }
  return {
    categories: categories.slice(),
    temp: avgColumns(controllers, (c) => c.temp, len),
    humidity: avgColumns(controllers, (c) => c.humidity, len),
    motorA: avgColumns(controllers, (c) => c.fanIntake, len),
    motorB: avgColumns(controllers, (c) => c.fanExhaust, len),
    motorC: avgColumns(controllers, (c) => c.fanSupply, len),
  };
}

function detailFrom24h(series: DailyReportSeries): DailyReportBarn["detailRows"] {
  const finiteIdx: number[] = [];
  for (let i = 0; i < series.categories.length; i++) {
    if (
      series.temp[i] != null ||
      series.humidity[i] != null ||
      series.motorA[i] != null ||
      series.motorB[i] != null ||
      series.motorC[i] != null
    ) {
      finiteIdx.push(i);
    }
  }
  const pick =
    finiteIdx.length >= 8
      ? finiteIdx.filter((_, j) => j % Math.ceil(finiteIdx.length / 8) === 0).slice(0, 8)
      : finiteIdx.length > 0
        ? finiteIdx
        : Array.from(
            { length: Math.min(8, series.categories.length) },
            (_, j) =>
              Math.floor((j * Math.max(0, series.categories.length - 1)) / 7),
          );

  return pick.map((i) => ({
    label: series.categories[i] ?? "",
    temp: series.temp[i] ?? null,
    humidity: series.humidity[i] ?? null,
    motorA: series.motorA[i] ?? null,
    motorB: series.motorB[i] ?? null,
    motorC: series.motorC[i] ?? null,
  }));
}

function findStallControllers(
  data: TrendControllerPeriodData,
  stallTyCode: string,
  stallNo: string,
): TrendControllerSeries[] {
  const sp = data.sp.find((s) => s.stallTyCode === stallTyCode);
  if (!sp) return [];
  const stall = sp.stalls.find((s) => s.stallNo === stallNo);
  return stall?.controllers ?? [];
}

function formatKstDate(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

function formatKstDateTime(d = new Date()): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function countFinite(values: (number | null)[]): number {
  return values.filter((v) => v != null && !Number.isNaN(v)).length;
}

export async function buildDailyReportPayload(
  farmKey: FarmKey,
): Promise<DailyReportPayload> {
  const [trends, readings, moduleAlarms, location, alarmSettings] =
    await Promise.all([
      getFarmControllerTrendAllPeriods({ farmKey }),
      fetchLiveReadings({ farmKey }),
      fetchActiveModuleAlarms(farmKey),
      getFarmLocation(farmKey),
      getAlarmSettings(),
    ]);

  const alarmGuide = resolveThresholdsForScope(
    alarmSettings,
    buildAlarmScopeKey({ farmId: farmKeyId(farmKey) }),
  );

  const alarms = toDailyReportAlarmRows(
    mergeSituationAlarms(moduleAlarms, readings),
  );

  const barnKeys = new Map<string, { stallTyCode: string; stallNo: string }>();
  for (const period of PERIODS) {
    for (const sp of trends[period].sp) {
      for (const st of sp.stalls) {
        const id = `${sp.stallTyCode}::${st.stallNo}`;
        if (!barnKeys.has(id)) {
          barnKeys.set(id, {
            stallTyCode: sp.stallTyCode,
            stallNo: st.stallNo,
          });
        }
      }
    }
  }
  for (const r of readings) {
    const ty = (r.stallTyCode ?? "").trim();
    const no = (r.stallNo ?? "").trim();
    if (!ty || !no) continue;
    const id = `${ty}::${no}`;
    if (!barnKeys.has(id)) barnKeys.set(id, { stallTyCode: ty, stallNo: no });
  }

  const barns: DailyReportBarn[] = [...barnKeys.values()]
    .sort((a, b) => {
      const c = a.stallTyCode.localeCompare(b.stallTyCode);
      if (c !== 0) return c;
      return a.stallNo.localeCompare(b.stallNo, undefined, { numeric: true });
    })
    .map(({ stallTyCode, stallNo }) => {
      const periods = {} as Record<TrendPeriodId, DailyReportSeries>;
      for (const period of PERIODS) {
        const ctrls = findStallControllers(trends[period], stallTyCode, stallNo);
        periods[period] = seriesFromControllers(
          trends[period].categories,
          ctrls,
        );
      }

      const liveCtrls = readings
        .filter(
          (r) =>
            (r.stallTyCode ?? "").trim() === stallTyCode &&
            (r.stallNo ?? "").trim() === stallNo,
        )
        .sort(
          (a, b) =>
            Number(a.eqpmnNo) - Number(b.eqpmnNo) ||
            a.controllerKey.localeCompare(b.controllerKey),
        );

      const controllers: DailyReportControllerRow[] = liveCtrls.map((r) => {
        const chA = r.channels?.find((c) => c.channel === "A");
        const chB = r.channels?.find((c) => c.channel === "B");
        const chC = r.channels?.find((c) => c.channel === "C");
        const motorA =
          chA?.fanPct ?? r.fanIntake ?? r.fanIntakeSeries.at(-1) ?? null;
        const motorB =
          chB?.fanPct ?? r.fanExhaust ?? r.fanExhaustSeries.at(-1) ?? null;
        const motorC =
          chC?.fanPct ?? r.fanSupply ?? r.fanSupplySeries.at(-1) ?? null;
        return {
          controllerKey: r.controllerKey,
          eqpmnNo: r.eqpmnNo,
          tempC: r.tempC,
          humidityPct: r.humidityPct,
          motorA,
          motorB,
          motorC,
          status: r.status,
        };
      });

      const online = controllers.filter((c) => c.status !== "offline").length;
      const s24 = periods["24h"];
      const { min: tMin24, max: tMax24 } = minMax(s24.temp);

      return {
        stallTyCode,
        stallLabel: getStallTypeName(stallTyCode),
        stallNo,
        kpi: {
          tempNow:
            avgFinite(controllers.map((c) => c.tempC)) ?? lastFinite(s24.temp),
          humNow:
            avgFinite(controllers.map((c) => c.humidityPct)) ??
            lastFinite(s24.humidity),
          motorA:
            avgFinite(controllers.map((c) => c.motorA)) ??
            lastFinite(s24.motorA),
          motorB:
            avgFinite(controllers.map((c) => c.motorB)) ??
            lastFinite(s24.motorB),
          motorC:
            avgFinite(controllers.map((c) => c.motorC)) ??
            lastFinite(s24.motorC),
          tMin24,
          tMax24,
          online,
          total: controllers.length,
          judge: barnJudgeFromControllerStatuses(
            controllers.map((c) => c.status),
          ),
        },
        controllers,
        periods,
        detailRows: detailFrom24h(s24),
      };
    });

  const controllerCount = readings.length;
  const offlineCount = readings.filter((r) => r.status === "offline").length;

  return {
    farmKey,
    farmLabel: farmDisplayLabel(farmKey, location?.farmName),
    reportDate: formatKstDate(),
    generatedAt: formatKstDateTime(),
    overview: {
      barnCount: barns.length,
      controllerCount,
      onlineCount: controllerCount - offlineCount,
      offlineCount,
      alarmCount: alarms.length,
    },
    barns,
    alarms,
    alarmGuide,
  };
}

/** 검수용 — 시리즈에 유효 포인트가 있는지 */
export function dailyReportSeriesPointCount(series: DailyReportSeries): number {
  return Math.max(
    countFinite(series.temp),
    countFinite(series.humidity),
    countFinite(series.motorA),
    countFinite(series.motorB),
    countFinite(series.motorC),
  );
}
