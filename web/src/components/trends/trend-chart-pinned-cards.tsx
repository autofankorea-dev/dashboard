"use client";

import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type {
  TrendBreachNavTarget,
  TrendEnvelope,
  TrendHistogram,
  TrendSeries,
} from "@/lib/domain/trend-chart-types";
import { computeTipPlacement } from "@/lib/farm/trend-chart-geometry";
import {
  inferHoverMetricGroup,
  isOverlayMergedHoverGroup,
} from "@/lib/farm/trend-chart-format";
import type { ClipPresenceEntry } from "@/lib/ui/use-clip-presence";
import { isPrimaryPress } from "@/lib/ui/pointer-press";
import { cn } from "@/lib/utils";
import {
  OverlayMergedPointCards,
  TrendEventCardBody,
  TrendPointCardBody,
} from "./trend-hover-card";
import { chartTipPresenceClass, type PinnedTip } from "./trend-chart-interaction";

type PinCardDrag = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  origOx: number;
  origOy: number;
};

/**
 * 고정 데이터 카드와 앵커 점선. trend-chart.tsx JSX를 동작 변경 없이 1:1 이동.
 */
export function TrendChartPinnedCards({
  pinPresence,
  n,
  plotPx,
  pinCardSizes,
  setPinCardSizes,
  plotRef,
  bringPinToFront,
  pinCardDragRef,
  setPinnedTips,
  overlayHoverMerge,
  categories,
  series,
  envelopes,
  histograms,
  leftUnit,
  rightUnit,
  onBreachEquipmentNavigate,
}: {
  pinPresence: ClipPresenceEntry<PinnedTip>[];
  n: number;
  plotPx: { w: number; h: number };
  pinCardSizes: Record<string, { w: number; h: number }>;
  setPinCardSizes: Dispatch<SetStateAction<Record<string, { w: number; h: number }>>>;
  plotRef: RefObject<HTMLDivElement | null>;
  bringPinToFront: (id: string) => void;
  pinCardDragRef: RefObject<PinCardDrag | null>;
  setPinnedTips: Dispatch<SetStateAction<PinnedTip[]>>;
  overlayHoverMerge: boolean;
  categories: string[];
  series: TrendSeries[];
  envelopes: TrendEnvelope[];
  histograms: TrendHistogram[];
  leftUnit: string;
  rightUnit: string;
  onBreachEquipmentNavigate?: (target: TrendBreachNavTarget) => void;
}) {
  return (
    <>
    {pinPresence.length > 0 ? (
      <svg
        className="pointer-events-none absolute inset-0 z-[15] h-full w-full overflow-visible"
        aria-hidden
      >
        {pinPresence.map(({ item: pin, key, phase }) => {
          if (!pin.eventMark && (pin.idx < 0 || pin.idx >= n)) return null;
          const plotW = plotPx.w || 1;
          const plotH = plotPx.h || 1;
          const anchorX = pin.nx * plotW;
          const anchorY = pin.ny * plotH;
          const tipW = pinCardSizes[pin.id]?.w ?? 168;
          const tipH = pinCardSizes[pin.id]?.h ?? 88;
          const base = computeTipPlacement(
            anchorX,
            anchorY,
            plotW,
            plotH,
            tipW,
            tipH,
          );
          const left = base.left + pin.ox;
          const top = base.top + pin.oy;
          // 앵커에서 카드 사각형에 가장 가까운 경계점 → 배치 방향과 무관하게
          // 점선이 항상 카드 모서리에 닿는다.
          const attachX = Math.min(Math.max(anchorX, left), left + tipW);
          const attachY = Math.min(Math.max(anchorY, top), top + tipH);
          const eventStroke =
            pin.eventMark?.tone === "ok"
              ? "var(--status-ok)"
              : "var(--channel-command)";
          return (
            <g
              key={`pin-link-${key}`}
              className={chartTipPresenceClass(phase)}
            >
              {pin.eventMark ? (
                <>
                  <ellipse
                    cx={anchorX}
                    cy={anchorY}
                    rx={10}
                    ry={10}
                    fill="none"
                    stroke={eventStroke}
                    strokeWidth={1.35}
                    opacity={0.95}
                  />
                  <ellipse
                    cx={anchorX}
                    cy={anchorY}
                    rx={5}
                    ry={5}
                    fill={eventStroke}
                    opacity={0.9}
                  />
                </>
              ) : null}
              <line
                x1={anchorX}
                y1={anchorY}
                x2={attachX}
                y2={attachY}
                className="stroke-foreground/55"
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
            </g>
          );
        })}
      </svg>
    ) : null}

    {pinPresence.map(({ item: pin, key, phase }, pinOrd) => {
      if (!pin.eventMark && (pin.idx < 0 || pin.idx >= n)) return null;
      const plotW = plotPx.w || 1;
      const plotH = plotPx.h || 1;
      const anchorX = pin.nx * plotW;
      const anchorY = pin.ny * plotH;
      const tipW = pinCardSizes[pin.id]?.w ?? 168;
      const tipH = pinCardSizes[pin.id]?.h ?? 88;
      const base = computeTipPlacement(
        anchorX,
        anchorY,
        plotW,
        plotH,
        tipW,
        tipH,
      );
      const left = base.left + pin.ox;
      const top = base.top + pin.oy;
      return (
        <div
          key={key}
          ref={(el) => {
            if (!el) return;
            const w = el.offsetWidth;
            const h = el.offsetHeight;
            if (w <= 0 || h <= 0) return;
            setPinCardSizes((prev) => {
              const cur = prev[pin.id];
              if (cur && cur.w === w && cur.h === h) return prev;
              return { ...prev, [pin.id]: { w, h } };
            });
          }}
          className={cn(
            "pointer-events-auto absolute w-max max-w-[16rem] cursor-grab touch-none select-none active:cursor-grabbing",
            chartTipPresenceClass(phase),
          )}
          style={{ left, top, zIndex: 20 + pinOrd }}
          data-tour-id="trend-chart-pinned-card"
          data-pin-id={pin.id}
          aria-label="데이터 카드 · 드래그로 이동, 우클릭으로 닫기"
          title="드래그로 이동 · 우클릭으로 닫기"
          onPointerDown={(e) => {
            e.stopPropagation();
            bringPinToFront(pin.id);
            // 카드 본문 아무 곳이나 잡아 드래그(핸들바 없이). 내부 버튼/입력은 제외.
            if (!isPrimaryPress(e) || !plotRef.current) return;
            const target = e.target as HTMLElement | null;
            if (target?.closest("button, a, input, select, textarea")) return;
            e.preventDefault();
            plotRef.current.setPointerCapture(e.pointerId);
            pinCardDragRef.current = {
              id: pin.id,
              pointerId: e.pointerId,
              startX: e.clientX,
              startY: e.clientY,
              origOx: pin.ox,
              origOy: pin.oy,
            };
          }}
          onContextMenu={(e) => {
            // 카드 위 우클릭 = 닫기 (위치 이동에도 카드 자체에 붙어 따라감)
            e.preventDefault();
            e.stopPropagation();
            setPinnedTips((prev) => prev.filter((p) => p.id !== pin.id));
          }}
        >
          <div className="overflow-hidden rounded-md border border-border/80 bg-popover/95 text-popover-foreground shadow-lg backdrop-blur-sm">
            <div className="px-2.5 py-1.5">
              {pin.eventMark ? (
                <TrendEventCardBody mark={pin.eventMark} />
              ) : overlayHoverMerge &&
                isOverlayMergedHoverGroup(
                  inferHoverMetricGroup(pin.seriesKey),
                ) ? (
                <OverlayMergedPointCards
                  idx={pin.idx}
                  categories={categories}
                  series={series}
                  envelopes={envelopes}
                  histograms={histograms}
                  leftUnit={leftUnit}
                  rightUnit={rightUnit}
                  onBreachEquipmentNavigate={onBreachEquipmentNavigate}
                />
              ) : (
                <TrendPointCardBody
                  idx={pin.idx}
                  seriesKey={pin.seriesKey}
                  categories={categories}
                  series={series}
                  envelopes={envelopes}
                  histograms={histograms}
                  leftUnit={leftUnit}
                  rightUnit={rightUnit}
                  onBreachEquipmentNavigate={onBreachEquipmentNavigate}
                />
              )}
            </div>
          </div>
        </div>
      );
    })}

    </>
  );
}
