"use client";

import { useCallback, useMemo, useState } from "react";
import { TrendChart } from "@/components/trends/trend-chart";
import type { TrendControllerPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import type { BarnReading } from "@/lib/data/iot";
import type { ChannelSlot } from "@/lib/data/iot-channel";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import {
  activeChannelSlotsFromReading,
  channelPercentsFromReading,
  findControllerTrendSeries,
  formatChannelPercent,
  resolveReadingChannelThermo,
} from "@/lib/farm/controller-summary-display";
import {
  channelOverlayTrendSeries,
  channelSlotTrendSeries,
  fanTrendReferenceLines,
  stallTrendHasData,
} from "@/lib/farm/trend-chart-series";
import { trendPeriodLabel } from "@/lib/farm/farm-view-url";
import {
  downsampleColumnsForChart,
  tickEveryForDisplayBars,
} from "@/lib/farm/trend-display-buckets";
import { cn } from "@/lib/utils";

type Props = {
  reading: BarnReading;
  controllerTrendByPeriod: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period: TrendPeriodId;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  /**
   * overlay = 활성 A/B/C 한 차트 (기본)
   * single = 한 채널만 (ChannelStrip 펼침)
   * split = overlay 별칭 (하위 호환)
   */
  layout?: "overlay" | "split" | "single";
  slot?: ChannelSlot;
  compact?: boolean;
  /** stack 모바일 — 차트 높이·tick 더 축소. */
  dense?: boolean;
  className?: string;
};

function tickEveryForPeriod(
  _period: TrendPeriodId,
  count: number,
  dense = false,
): number {
  return tickEveryForDisplayBars(count, { compact: dense });
}

function ChannelSlotTrendChart({
  reading,
  slot,
  controllerSeries,
  categories,
  thermo,
  tickEvery,
  period,
  compact,
  dense,
  onPlotWidthChange,
}: {
  reading: BarnReading;
  slot: ChannelSlot;
  controllerSeries: NonNullable<ReturnType<typeof findControllerTrendSeries>>;
  categories: string[];
  thermo: ReturnType<typeof resolveReadingChannelThermo>;
  tickEvery: number;
  period: TrendPeriodId;
  compact?: boolean;
  dense?: boolean;
  onPlotWidthChange?: (widthPx: number) => void;
}) {
  const series = channelSlotTrendSeries(controllerSeries, slot, thermo);
  const fanRefs = series.band ? fanTrendReferenceLines(series.band) : [];
  const pct = formatChannelPercent(channelPercentsFromReading(reading)[slot]);
  const hasPoint = series.data.some((v) => v != null && Number.isFinite(v));

  if (!hasPoint) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/80 bg-muted/15 px-2.5 py-2",
          compact && "py-1.5"
        )}
      >
        <p className="text-xs font-semibold">채널 {slot}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          추이 없음 · 현재 {pct}
          {pct !== "—" ? "%" : ""}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-channel-info/20 bg-channel-info/5 px-2.5 py-2",
        compact && "py-1.5"
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className={cn("font-semibold", compact ? "text-[0.65rem]" : "text-xs")}>
          채널 {slot}
        </p>
        <span className="shrink-0 rounded-full border border-channel-info/30 bg-background px-2 py-0.5 text-[0.65rem] font-semibold tabular-nums sm:text-xs">
          {pct}
          {pct !== "—" ? "%" : ""}
        </span>
      </div>
      <TrendChart
        mode="line"
        categories={categories}
        series={[series]}
        height={dense ? 48 : compact ? 64 : 72}
        leftUnit="%"
        leftDomain={[0, 100]}
        yAxisTicks="ends"
        referenceLines={fanRefs}
        tickEvery={tickEvery}
        period={period}
        showMarkers={false}
        onPlotWidthChange={onPlotWidthChange}
      />
    </div>
  );
}

/** 그래프(채널) — 활성 채널 오버레이(기본) 또는 단일 채널. */
export function BarnChannelTrendPanel({
  reading,
  controllerTrendByPeriod,
  period,
  thermoSettings = {},
  layout = "overlay",
  slot,
  compact = false,
  dense = false,
  className,
}: Props) {
  const resolvedLayout = layout === "split" ? "overlay" : layout;
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
        reading.controllerKey
      ),
    [
      controllerTrendByPeriod,
      period,
      reading.stallTyCode,
      reading.stallNo,
      reading.controllerKey,
    ]
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
        tickEvery: tickEveryForPeriod(period, categoriesRaw.length, dense),
      };
    }
    const { categories, columns } = downsampleColumnsForChart(
      categoriesRaw,
      [
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
        fanIntake: columns[0] ?? controllerSeries.fanIntake,
        fanExhaust: columns[1] ?? controllerSeries.fanExhaust,
        fanSupply: columns[2] ?? controllerSeries.fanSupply,
      },
      tickEvery: dense
        ? Math.max(1, Math.ceil(categories.length / 4))
        : tickEveryForDisplayBars(categories.length),
    };
  }, [hasDataRaw, controllerSeries, categoriesRaw, period, dense, plotWidthPx]);

  const categories = display.categories;
  const chartSeries = display.series;
  const tickEvery = display.tickEvery;
  const hasData = hasDataRaw && chartSeries != null;

  const activeSlots = useMemo(
    () => activeChannelSlotsFromReading(reading),
    [reading],
  );

  const overlaySeries = useMemo(() => {
    if (!chartSeries || resolvedLayout !== "overlay") return [];
    return channelOverlayTrendSeries(chartSeries, activeSlots);
  }, [chartSeries, resolvedLayout, activeSlots]);

  if (!hasData || !chartSeries) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-xs text-muted-foreground",
          compact ? "min-h-[4rem] py-4" : "py-8",
          className
        )}
      >
        채널 추이 데이터 없음
      </div>
    );
  }

  if (resolvedLayout === "single" && slot) {
    return (
      <div className={cn("space-y-2", className)}>
        <ChannelSlotTrendChart
          reading={reading}
          slot={slot}
          controllerSeries={chartSeries}
          categories={categories}
          thermo={resolveReadingChannelThermo(reading, thermoSettings, slot)}
          tickEvery={tickEvery}
          period={period}
          compact={compact}
          dense={dense}
          onPlotWidthChange={onPlotWidthChange}
        />
      </div>
    );
  }

  if (overlaySeries.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/80 bg-muted/15 px-2.5 py-3 text-xs text-muted-foreground",
          className,
        )}
      >
        활성 채널 추이 없음
      </div>
    );
  }

  const slotLabel = overlaySeries.map((s) => s.name).join("·");

  return (
    <div
      className={cn(
        "rounded-lg border border-channel-info/20 bg-channel-info/5 px-2.5 py-2",
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
        모터 · {slotLabel} · {trendPeriodLabel(period)}
      </p>
      <TrendChart
        mode="line"
        categories={categories}
        series={overlaySeries}
        height={dense ? 72 : compact ? 88 : 104}
        leftUnit="%"
        leftDomain={[0, 100]}
        yAxisTicks="ends"
        tickEvery={tickEvery}
        period={period}
        showLegend={!dense}
        showMarkers={false}
        onPlotWidthChange={onPlotWidthChange}
      />
    </div>
  );
}
