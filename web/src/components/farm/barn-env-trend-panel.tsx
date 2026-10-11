"use client";

import { useCallback, useMemo, useState } from "react";
import { TrendChart } from "@/components/trends/trend-chart";
import type { AlarmSettings } from "@/lib/domain/alarms";
import type { BarnReading } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/domain/farm-trend-types";
import {
  findControllerTrendSeries,
  resolveReadingAlarmThresholds,
} from "@/lib/farm/controller-summary-display";
import {
  envTrendReferenceLines,
  envTrendSeries,
  humidityTrendLeftDomain,
  stallTrendHasData,
  tempTrendLeftDomain,
} from "@/lib/farm/trend-chart-series";
import {
  downsampleColumnsForChart,
  tickEveryForDisplayBars,
} from "@/lib/farm/trend-display-buckets";
import { cn } from "@/lib/utils";

type Props = {
  reading: BarnReading;
  controllerTrendByPeriod: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period: TrendPeriodId;
  alarmSettings?: AlarmSettings;
  compact?: boolean;
  dense?: boolean;
  loading?: boolean;
  className?: string;
};

/**
 * 온·습도 추이 — BarnChannelTrendPanel과 동일 높이·패딩으로 카드 인라인 배치용.
 */
export function BarnEnvTrendPanel({
  reading,
  controllerTrendByPeriod,
  period,
  alarmSettings,
  compact = false,
  dense = false,
  loading = false,
  className,
}: Props) {
  const thresholds = resolveReadingAlarmThresholds(reading, alarmSettings);
  const tempDomain = tempTrendLeftDomain(thresholds);
  const humidityDomain = humidityTrendLeftDomain(thresholds);
  const envRefs = envTrendReferenceLines(thresholds);
  const [chartPlotWidth, setChartPlotWidth] = useState(0);
  const onPlotWidthChange = useCallback((w: number) => {
    setChartPlotWidth((prev) => (Math.abs(prev - w) < 8 ? prev : w));
  }, []);
  const plotWidthPx = chartPlotWidth > 32 ? chartPlotWidth : 360;

  const periodData = controllerTrendByPeriod?.[period] ?? null;
  const controllerSeries = useMemo(
    () =>
      findControllerTrendSeries(
        controllerTrendByPeriod,
        period,
        reading.stallTyCode,
        reading.stallNo,
        reading.controllerKey,
      ),
    [
      controllerTrendByPeriod,
      period,
      reading.stallTyCode,
      reading.stallNo,
      reading.controllerKey,
    ],
  );

  const categoriesRaw = useMemo(
    () => periodData?.categories ?? [],
    [periodData?.categories],
  );
  const hasDataRaw =
    stallTrendHasData(controllerSeries) && categoriesRaw.length > 0;

  const display = useMemo(() => {
    if (!hasDataRaw || !controllerSeries) {
      return {
        categories: categoriesRaw,
        series: controllerSeries,
        tickEvery: 1,
      };
    }
    const { categories, columns } = downsampleColumnsForChart(
      categoriesRaw,
      [
        controllerSeries.temp,
        controllerSeries.humidity,
        controllerSeries.fanIntake,
        controllerSeries.fanExhaust,
        controllerSeries.fanSupply,
      ],
      plotWidthPx,
    );
    return {
      categories,
      series: {
        ...controllerSeries,
        temp: columns[0] ?? controllerSeries.temp,
        humidity: columns[1] ?? controllerSeries.humidity,
        fanIntake: columns[2] ?? controllerSeries.fanIntake,
        fanExhaust: columns[3] ?? controllerSeries.fanExhaust,
        fanSupply: columns[4] ?? controllerSeries.fanSupply,
      },
      tickEvery: dense
        ? tickEveryForDisplayBars(categories.length, { compact: true })
        : tickEveryForDisplayBars(categories.length),
    };
  }, [hasDataRaw, controllerSeries, categoriesRaw, dense, plotWidthPx]);

  if (!hasDataRaw || !display.series) {
    return (
      <div
        className={cn(
          "rounded-lg border bg-background px-2.5 text-xs text-muted-foreground",
          compact ? "min-h-[4rem] py-4" : "py-6",
          className,
        )}
      >
        {loading && !controllerTrendByPeriod
          ? "환경 추이 불러오는 중…"
          : "선택한 기간에 수신된 환경 데이터가 없습니다."}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-background px-2.5 py-2",
        compact && "py-1.5",
        className,
      )}
    >
      <p
        className={cn(
          "mb-1 font-semibold text-muted-foreground",
          compact ? "text-[0.65rem]" : "text-xs",
        )}
      >
        환경 · 온·습도
      </p>
      <TrendChart
        mode="line"
        categories={display.categories}
        series={envTrendSeries(display.series, thresholds)}
        height={dense ? 72 : compact ? 88 : 104}
        leftUnit="℃"
        rightUnit="%"
        leftDomain={tempDomain}
        rightDomain={humidityDomain}
        yAxisTicks="ends"
        referenceLines={envRefs}
        tickEvery={display.tickEvery}
        period={period}
        showLegend={!dense}
        showMarkers={false}
        onPlotWidthChange={onPlotWidthChange}
      />
    </div>
  );
}
