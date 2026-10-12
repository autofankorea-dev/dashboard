"use client";

import { cn } from "@/lib/utils";
import type { TrendLeftAxisTick } from "@/lib/farm/trend-chart-layout";
import { TrendYLabelChip } from "./trend-y-label-chip";

/**
 * Y 거터 캡션과 좌측 눈금. trend-chart.tsx JSX를 동작 변경 없이 1:1 이동.
 */
export function TrendChartYAxis({
  yGutterStartCaption,
  yGutterEndCaption,
  hideAxisChrome,
  dimPlotValues,
  leftAxisTicks,
  labelGutter,
  yLabelColumn,
}: {
  yGutterStartCaption?: string;
  yGutterEndCaption?: string;
  hideAxisChrome: boolean;
  dimPlotValues: boolean;
  leftAxisTicks: TrendLeftAxisTick[];
  labelGutter: boolean;
  yLabelColumn: boolean;
}) {
  return (
    <>
  {yGutterStartCaption && !hideAxisChrome ? (
    <span
      className={cn(
        "pointer-events-none absolute left-1 top-0.5 z-[2] farm-chart-fs-axis font-medium leading-none text-muted-foreground",
        "transition-opacity duration-motion-fast",
        dimPlotValues && "opacity-30",
      )}
    >
      {yGutterStartCaption}
    </span>
  ) : null}
  {yGutterEndCaption && !hideAxisChrome ? (
    <span
      className={cn(
        "pointer-events-none absolute right-1 top-0.5 z-[2] farm-chart-fs-axis font-medium leading-none text-muted-foreground",
        "transition-opacity duration-motion-fast",
        dimPlotValues && "opacity-30",
      )}
    >
      {yGutterEndCaption}
    </span>
  ) : null}

  {leftAxisTicks.map((tick) => (
    <span
      key={tick.id}
      className={cn(
        "pointer-events-none absolute left-1 z-[1] -translate-y-1/2 leading-none text-muted-foreground",
        labelGutter ? "farm-chart-fs-legend font-medium" : "farm-chart-fs-axis",
        "transition-opacity duration-motion-fast",
        dimPlotValues && "opacity-30",
      )}
      style={{ top: `${tick.topPct}%` }}
      aria-hidden
    >
      <TrendYLabelChip
        text={tick.text}
        className={
          labelGutter && !yLabelColumn
            ? "min-h-7 px-1.5 py-1 farm-chart-fs-legend font-medium"
            : "farm-chart-fs-axis"
        }
      />
    </span>
  ))}

    </>
  );
}
