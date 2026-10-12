"use client";

import type { RefObject } from "react";
import type {
  TrendEnvelope,
  TrendEventLane,
  TrendHistogram,
  TrendReferenceLine,
  TrendScaleEdgeLabel,
  TrendSeries,
} from "@/lib/domain/trend-chart-types";
import type { UplinkCoverageBand } from "@/lib/farm/trend-uplink-coverage";
import { PAD_TOP } from "@/lib/farm/trend-chart-geometry";
import type { PositionedEventMark } from "@/lib/farm/trend-chart-layout";
import { motionClass } from "@/lib/ui/motion-classes";
import type { ClipPresenceEntry } from "@/lib/ui/use-clip-presence";
import { cn } from "@/lib/utils";
import {
  chartBandGuideClass,
  chartTipPresenceClass,
  type PinnedTip,
} from "./trend-chart-interaction";
import {
  BandGuidesLayer,
  CoverageBandsLayer,
  NullGapsLayer,
  type TrendPlotGeom,
} from "./trend-chart-svg-layers";
import {
  TrendChartDataLayers,
  type TrendChartDataLayersProps,
} from "./trend-chart-data-layers";
import {
  CommandHoldLaneSvg,
  EventLaneSvgGuides,
} from "./trend-chart-event-lane";
import type { XDraftRect } from "./use-trend-scope-gesture";

/**
 * 추이 차트 플롯 SVG — 프레임, 데이터 레이어, 십자선, 스코프 드래프트.
 * `trend-chart.tsx`에서 분리(동작 보존). 포인터 핸들러는 플롯 루트에 둔다.
 */
export function TrendChartPlotSvg({
  viewW,
  chartH,
  fillParent,
  glowFilterId,
  plotEnterKey,
  scopeMotionKey,
  animate,
  scopeMotionDir,
  coverageBands,
  nullGapRanges,
  plotGeom,
  guidePresence,
  mode,
  n,
  padL,
  padR,
  innerH,
  innerW,
  barW,
  barSlotW,
  hoverIdx,
  hoverSeries,
  edgeDragId,
  hoveredEdgeId,
  showMarkers,
  markerRadiusPx,
  series,
  histPresence,
  envelopePresence,
  seriesPresence,
  scaleEdgeLabels,
  alarmPresence,
  dedupedReferenceLines,
  pinnedTips,
  yFor,
  xFor,
  xForBar,
  markerRx,
  markerRy,
  shouldShowMarker,
  lineSegments,
  envelopePaths,
  positionedCommandHits,
  hoverEventMark,
  eventLane,
  eventLaneH,
  positionedEventMarks,
  eventLaneTop,
  crossVRef,
  crossHRef,
  draftPresence,
  scopeYMax,
}: {
  viewW: number;
  chartH: number;
  fillParent: boolean;
  glowFilterId: string;
  plotEnterKey: string;
  scopeMotionKey: number;
  animate: boolean;
  scopeMotionDir: "in" | "out";
  coverageBands: UplinkCoverageBand[];
  nullGapRanges: { i0: number; i1: number }[];
  plotGeom: TrendPlotGeom;
  guidePresence: ClipPresenceEntry<{ gy: number; i: number }>[];
  mode: TrendChartDataLayersProps["mode"];
  n: number;
  padL: number;
  padR: number;
  innerH: number;
  innerW: number;
  barW: number;
  barSlotW: number;
  hoverIdx: number | null;
  hoverSeries: string | null;
  edgeDragId: string | null;
  hoveredEdgeId: string | null;
  showMarkers: boolean;
  markerRadiusPx: number;
  series: TrendSeries[];
  histPresence: ClipPresenceEntry<TrendHistogram>[];
  envelopePresence: ClipPresenceEntry<TrendEnvelope>[];
  seriesPresence: ClipPresenceEntry<TrendSeries>[];
  scaleEdgeLabels: TrendScaleEdgeLabel[];
  alarmPresence: TrendChartDataLayersProps["uniqueAlarmBands"];
  dedupedReferenceLines: TrendReferenceLine[];
  pinnedTips: PinnedTip[];
  yFor: TrendChartDataLayersProps["yFor"];
  xFor: TrendChartDataLayersProps["xFor"];
  xForBar: TrendChartDataLayersProps["xForBar"];
  markerRx: TrendChartDataLayersProps["markerRx"];
  markerRy: TrendChartDataLayersProps["markerRy"];
  shouldShowMarker: TrendChartDataLayersProps["shouldShowMarker"];
  lineSegments: TrendChartDataLayersProps["lineSegments"];
  envelopePaths: TrendChartDataLayersProps["envelopePaths"];
  positionedCommandHits: NonNullable<TrendChartDataLayersProps["commandSettingHits"]>;
  hoverEventMark: { id: string } | null;
  eventLane: TrendEventLane | null;
  eventLaneH: number;
  positionedEventMarks: PositionedEventMark[];
  eventLaneTop: number;
  crossVRef: RefObject<SVGLineElement | null>;
  crossHRef: RefObject<SVGLineElement | null>;
  draftPresence: {
    mounted: boolean;
    phase: "enter" | "exit";
    value: XDraftRect | null;
  };
  scopeYMax: number;
}) {
  return (
      <svg
        viewBox={`0 0 ${viewW} ${chartH}`}
        preserveAspectRatio="none"
        className="w-full select-none"
        style={{ height: fillParent ? "100%" : chartH }}
        shapeRendering="geometricPrecision"
        role="img"
        aria-label="추이 차트"
      >
        <defs>
          <filter
            id={glowFilterId}
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.35" />
          </filter>
        </defs>
        <g
          key={`${plotEnterKey}:${scopeMotionKey}`}
          className={cn(
            motionClass.farmChartCrosshair,
            animate && scopeMotionKey === 0
              ? motionClass.farmChartPlotReveal
              : undefined,
            scopeMotionKey > 0
              ? scopeMotionDir === "out"
                ? motionClass.farmChartScopeZoomOut
                : motionClass.farmChartScopeZoomIn
              : undefined,
          )}
        >
        <CoverageBandsLayer bands={coverageBands} geom={plotGeom} />
        <NullGapsLayer gaps={nullGapRanges} geom={plotGeom} />
        <BandGuidesLayer
          guides={guidePresence.map(({ item, key, phase }) => ({
            key,
            value: item.gy,
            className: chartBandGuideClass(phase),
          }))}
          geom={plotGeom}
        />
        <TrendChartDataLayers
          mode={mode}
          n={n}
          padL={padL}
          padR={padR}
          viewW={viewW}
          innerH={innerH}
          innerW={innerW}
          barW={barW}
          barSlotW={barSlotW}
          hoverIdx={hoverIdx}
          hoverSeries={hoverSeries}
          edgeDragId={edgeDragId}
          hoveredEdgeId={hoveredEdgeId}
          glowFilterId={glowFilterId}
          showMarkers={showMarkers}
          markerRadiusPx={markerRadiusPx}
          series={series}
          histPresence={histPresence}
          envelopePresence={envelopePresence}
          seriesPresence={seriesPresence}
          scaleEdgeLabels={scaleEdgeLabels}
          uniqueAlarmBands={alarmPresence}
          dedupedReferenceLines={dedupedReferenceLines}
          pinnedTips={pinnedTips}
          plotGeom={plotGeom}
          yFor={yFor}
          xFor={xFor}
          xForBar={xForBar}
          markerRx={markerRx}
          markerRy={markerRy}
          shouldShowMarker={shouldShowMarker}
          lineSegments={lineSegments}
          envelopePaths={envelopePaths}
          commandSettingHits={positionedCommandHits}
          commandHoverId={hoverEventMark?.id ?? null}
        />
        {eventLane && eventLaneH > 0 ? (
          <>
            <CommandHoldLaneSvg
              marks={positionedEventMarks}
              padL={padL}
              padR={padR}
              viewW={viewW}
              laneTop={eventLaneTop}
              laneH={eventLaneH}
              rowCount={eventLane.rowLabels.length}
            />
            <EventLaneSvgGuides
              padL={padL}
              padR={padR}
              viewW={viewW}
              laneTop={eventLaneTop}
              laneH={eventLaneH}
              rowCount={eventLane.rowLabels.length}
            />
          </>
        ) : null}
        </g>
        {/* 마우스 기준 회색 십자선 — DOM 직접 갱신(리렌더 최소화) */}
        <line
          ref={crossVRef}
          x1={padL}
          x2={padL}
          y1={PAD_TOP}
          y2={PAD_TOP + innerH + eventLaneH}
          stroke="var(--muted-foreground)"
          strokeWidth={0.7}
          strokeDasharray="2.5 2"
          vectorEffect="non-scaling-stroke"
          opacity={0}
          className={motionClass.farmChartCrosshair}
          style={{ opacity: 0 }}
          pointerEvents="none"
        />
        <line
          ref={crossHRef}
          x1={padL}
          x2={viewW - padR}
          y1={PAD_TOP}
          y2={PAD_TOP}
          stroke="var(--muted-foreground)"
          strokeWidth={0.7}
          strokeDasharray="2.5 2"
          vectorEffect="non-scaling-stroke"
          opacity={0}
          className={motionClass.farmChartCrosshair}
          style={{ opacity: 0 }}
          pointerEvents="none"
        />
        {(() => {
          const win = draftPresence.mounted ? draftPresence.value : null;
          if (win == null) return null;
          const x0 = win.a;
          const x1 = win.b;
          const y0 = win.y0;
          const y1 = win.y;
          const left = Math.min(x0, x1);
          const right = Math.max(x0, x1);
          const top = Math.min(y0, y1);
          const bot = Math.max(y0, y1);
          const w = Math.max(0.5, right - left);
          const rawH = bot - top;
          const h = Math.max(3.2, rawH);
          const yMid = (top + bot) / 2;
          const yBox = Math.min(
            scopeYMax - h,
            Math.max(PAD_TOP, rawH < 3.2 ? yMid - h / 2 : top),
          );
          const rx = markerRx(4.2);
          const ry = markerRy(4.2);
          const rxEnd = markerRx(5);
          const ryEnd = markerRy(5);
          return (
            <g
              pointerEvents="none"
              aria-hidden
              className={chartTipPresenceClass(draftPresence.phase)}
            >
              <rect
                x={left}
                y={yBox}
                width={w}
                height={h}
                fill="var(--channel-hum)"
                fillOpacity={0.12}
                stroke="var(--channel-hum)"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />
              <rect
                className={motionClass.farmChartScopeHandlePulse}
                x={left}
                y={yBox}
                width={0.7}
                height={h}
                fill="var(--channel-hum)"
                opacity={0.95}
              />
              <rect
                className={motionClass.farmChartScopeHandlePulse}
                x={right - 0.7}
                y={yBox}
                width={0.7}
                height={h}
                fill="var(--channel-hum)"
                opacity={0.95}
              />
              <ellipse
                cx={x0}
                cy={y0}
                rx={rx}
                ry={ry}
                fill="var(--channel-hum)"
                stroke="#fff"
                strokeWidth={0.35}
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx={x1}
                cy={y1}
                rx={rxEnd}
                ry={ryEnd}
                fill="#fff"
                stroke="var(--channel-hum)"
                strokeWidth={0.55}
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx={x1}
                cy={y1}
                rx={markerRx(2)}
                ry={markerRy(2)}
                fill="var(--channel-hum)"
              />
              <line
                x1={x0}
                y1={y0}
                x2={x1}
                y2={y1}
                stroke="var(--channel-hum)"
                strokeWidth={0.35}
                strokeDasharray="1.2 1.2"
                vectorEffect="non-scaling-stroke"
                opacity={0.7}
              />
            </g>
          );
        })()}
      </svg>
  );
}
