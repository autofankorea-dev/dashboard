"use client";

import type { RefObject } from "react";
import type {
  TrendBreachNavTarget,
  TrendEnvelope,
  TrendHistogram,
  TrendSeries,
} from "@/lib/domain/trend-chart-types";
import {
  inferHoverMetricGroup,
  isOverlayMergedHoverGroup,
} from "@/lib/farm/trend-chart-format";
import type { UplinkCoverageBand } from "@/lib/farm/trend-uplink-coverage";
import { cn } from "@/lib/utils";
import {
  OverlayMergedPointCards,
  TrendEventCardBody,
  TrendPointCardBody,
} from "./trend-hover-card";
import { chartTipPresenceClass } from "./trend-chart-interaction";
import type { TrendHoverCardValue } from "./trend-chart-hover-live";

export type { TrendHoverCardValue } from "./trend-chart-hover-live";

/**
 * 호버 데이터 카드. 위치는 placeTipNear가 tipRef로 직접 쓴다.
 * trend-chart.tsx JSX를 동작 변경 없이 1:1 이동.
 */
export function TrendChartHoverCard({
  presence,
  tipRef,
  coverageBands,
  overlayHoverMerge,
  categories,
  series,
  envelopes,
  histograms,
  leftUnit,
  rightUnit,
  onBreachEquipmentNavigate,
}: {
  presence: {
    mounted: boolean;
    phase: "enter" | "exit";
    value: TrendHoverCardValue | null;
  };
  tipRef: RefObject<HTMLDivElement | null>;
  coverageBands: UplinkCoverageBand[];
  overlayHoverMerge: boolean;
  categories: string[];
  series: TrendSeries[];
  envelopes: TrendEnvelope[];
  histograms: TrendHistogram[];
  leftUnit: string;
  rightUnit: string;
  onBreachEquipmentNavigate?: (target: TrendBreachNavTarget) => void;
}) {
  const hoverCardPresence = presence;
  return (
    <>
  {hoverCardPresence.mounted && hoverCardPresence.value ? (
    <div
      ref={tipRef}
      className="pointer-events-none absolute left-0 top-0 z-10 w-max max-w-[16rem]"
      style={{ opacity: 0, willChange: "transform" }}
      aria-live="polite"
      data-tour-id="trend-chart-hover-card"
    >
      <div
        className={cn(
          "rounded-md border border-border/80 bg-popover/95 px-2.5 py-1.5 text-popover-foreground shadow-lg backdrop-blur-sm",
          chartTipPresenceClass(hoverCardPresence.phase),
        )}
      >
        {hoverCardPresence.value.kind === "event" ? (
          <TrendEventCardBody mark={hoverCardPresence.value.mark} />
        ) : (
          <>
            {(() => {
              const idx = hoverCardPresence.value.idx;
              const band = coverageBands.find(
                (b) => idx >= b.i0 && idx <= b.i1,
              );
              return band ? (
                <p className="mb-1 farm-chart-fs-legend text-muted-foreground">
                  {band.label}
                </p>
              ) : null;
            })()}
            {(() => {
              const card = hoverCardPresence.value;
              if (card.kind !== "point") return null;
              const hg = inferHoverMetricGroup(card.seriesKey);
              if (overlayHoverMerge && isOverlayMergedHoverGroup(hg)) {
                return (
                  <OverlayMergedPointCards
                    idx={card.idx}
                    categories={categories}
                    series={series}
                    envelopes={envelopes}
                    histograms={histograms}
                    leftUnit={leftUnit}
                    rightUnit={rightUnit}
                    onBreachEquipmentNavigate={onBreachEquipmentNavigate}
                  />
                );
              }
              return (
                <TrendPointCardBody
                  idx={card.idx}
                  seriesKey={card.seriesKey}
                  categories={categories}
                  series={series}
                  envelopes={envelopes}
                  histograms={histograms}
                  leftUnit={leftUnit}
                  rightUnit={rightUnit}
                  onBreachEquipmentNavigate={onBreachEquipmentNavigate}
                />
              );
            })()}
          </>
        )}
      </div>
    </div>
  ) : null}
    </>
  );
}
