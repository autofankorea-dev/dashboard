/**
 * 차트 공통 — 컨트롤러 목록으로 UnifiedBarnTrendRaw 집계.
 * 알람 초과 X구간 계산과 패널 집계가 같은 다운샘플을 쓰도록 한다.
 */
import type { AlarmThresholds } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import {
  findControllerTrendSeries,
  formatControllerHeaderPrimary,
  formatControllerHeaderSecondary,
} from "@/lib/farm/controller-summary-display";
import { downsampleTrendAxis } from "@/lib/farm/trend-display-buckets";
import {
  aggregateUnifiedBarnTrendRaw,
  type UnifiedBarnTrendRaw,
} from "@/lib/farm/unified-barn-trend-series";

export type TrendControllerRef = {
  key: string;
  reading: BarnReading | null;
};

export function buildFarmUnifiedTrendRaw(opts: {
  controllers: TrendControllerRef[];
  controllerTrendByPeriod?: Record<
    TrendPeriodId,
    TrendControllerPeriodData
  > | null;
  period: TrendPeriodId;
  thresholds: AlarmThresholds;
}): UnifiedBarnTrendRaw | null {
  const { controllers, controllerTrendByPeriod, period, thresholds } = opts;
  const periodData = controllerTrendByPeriod?.[period] ?? null;
  const categoriesRaw = periodData?.categories ?? [];
  if (!categoriesRaw.length) return null;

  const seriesList = controllers
    .map((c) => {
      const r = c.reading;
      if (!r) return null;
      const series = findControllerTrendSeries(
        controllerTrendByPeriod,
        period,
        r.stallTyCode,
        r.stallNo,
        r.controllerKey,
      );
      if (!series) return null;
      // 표시 정본은 채널 슬롯(A/B/C) — series.fanA/B/C 를 그대로 사용한다.
      // (RPC avg_fan_a/b/c → 파이프라인 전달. eqpmnCode 재배치 불필요.)
      return {
        ...series,
        zoneLabel: formatControllerHeaderPrimary(r),
        equipmentLabel: formatControllerHeaderSecondary(r),
        stallTyCode: r.stallTyCode
          ? normalizeStallTyCode(r.stallTyCode)
          : undefined,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s != null);

  if (!seriesList.length) return null;

  const { categories, columns } = downsampleTrendAxis(
    categoriesRaw,
    seriesList.flatMap((s) => [s.fanA, s.fanB, s.fanC, s.temp, s.humidity]),
    period,
  );

  const perCtrl = 5;
  const downsampledList = seriesList.map((s, idx) => {
    const base = idx * perCtrl;
    return {
      ...s,
      fanA: columns[base] ?? s.fanA,
      fanB: columns[base + 1] ?? s.fanB,
      fanC: columns[base + 2] ?? s.fanC,
      temp: columns[base + 3] ?? s.temp,
      humidity: columns[base + 4] ?? s.humidity,
    };
  });

  return aggregateUnifiedBarnTrendRaw(downsampledList, categories, thresholds);
}
