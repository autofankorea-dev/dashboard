"use client";

import type { TrendAxisTickView } from "@/lib/farm/trend-chart-layout";
import type { TrendBrushAxisTick } from "@/lib/farm/trend-display-buckets";

/**
 * 추이 차트 X축 눈금 레일.
 * `trend-chart.tsx`에서 분리(동작 보존).
 */
export function TrendChartXAxis({
  hideAxisChrome,
  axisMarksMinors,
  axisTicks,
  axisTickViews,
  viewW,
  padL,
  innerW,
}: {
  hideAxisChrome: boolean;
  axisMarksMinors: number[];
  axisTicks: TrendBrushAxisTick[];
  axisTickViews: TrendAxisTickView[];
  viewW: number;
  padL: number;
  innerW: number;
}) {
  if (hideAxisChrome) return null;
  return (
      <div className="relative shrink-0 overflow-visible border-t border-border">
        <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1]" aria-hidden>
          {axisMarksMinors.map((t) => (
            <span
              key={`axis-minor-${t}`}
              className="absolute top-0 w-px h-1.5 -translate-x-1/2 bg-muted-foreground/30"
              style={{ left: `${viewW > 0 ? ((padL + t * innerW) / viewW) * 100 : 0}%` }}
            />
          ))}
          {axisTicks.map((m) => (
            <span
              key={`axis-major-${m.t}-${m.fullLabel}`}
              className="absolute top-0 w-px h-2 -translate-x-1/2 bg-muted-foreground/55"
              style={{
                left: `${viewW > 0 ? ((padL + m.t * innerW) / viewW) * 100 : 0}%`,
              }}
            />
          ))}
          <span
            className="absolute top-0 w-0.5 h-2.5 -translate-x-1/2 bg-muted-foreground/70"
            style={{
              left: `${viewW > 0 ? ((padL + innerW) / viewW) * 100 : 100}%`,
            }}
          />
        </div>
        <div className="relative farm-chart-tick-rail-stacked overflow-visible">
          {axisTickViews.map((v) =>
            v.parts.date ? (
              <span
                key={`tick-date-${v.key}`}
                className="pointer-events-none absolute top-0.5 -translate-x-1/2 text-center farm-chart-fs-axis leading-none text-muted-foreground tabular-nums whitespace-nowrap"
                style={{ left: `${v.leftPct}%` }}
              >
                {v.parts.date}
              </span>
            ) : null,
          )}
          {axisTickViews.map((v) =>
            v.parts.time ? (
              <span
                key={`tick-time-${v.key}`}
                className="pointer-events-none absolute bottom-0.5 -translate-x-1/2 text-center farm-chart-fs-axis leading-none text-muted-foreground tabular-nums whitespace-nowrap"
                style={{ left: `${v.leftPct}%` }}
                title={v.fullLabel}
              >
                {v.parts.time}
              </span>
            ) : null,
          )}
        </div>
        </div>
      </div>
  );
}
