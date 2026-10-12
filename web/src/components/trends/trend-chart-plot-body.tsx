"use client";

import {
  bindTrendPlotPaths,
  collectTrendNullGapRanges,
} from "@/lib/farm/trend-chart-geometry";
import {
  CommandSettingHitOverlay,
  EventLaneHtmlOverlay,
} from "./trend-chart-event-lane";
import { TrendChartCrosshairChip } from "./trend-chart-crosshair-chip";
import { TrendChartEdgeLabels } from "./trend-chart-edge-labels";
import { TrendChartHoverCard } from "./trend-chart-hover-card";
import { TrendChartPinnedCards } from "./trend-chart-pinned-cards";
import { TrendChartPlotSvg } from "./trend-chart-plot-svg";
import { TrendChartYAxis } from "./trend-chart-y-axis";
import {
  MAX_PINNED_TIPS,
  type PinnedTip,
} from "./trend-chart-interaction";
import { type TrendPlotGeom } from "./trend-chart-svg-layers";
import { useTrendChartDecor } from "./use-trend-chart-decor";
import { useTrendChartModel } from "./use-trend-chart-model";
import { useTrendScaleEdgeEdit } from "./use-trend-scale-edge-edit";
import { useTrendScopeGesture } from "./use-trend-scope-gesture";

type PlotBodyProps = ReturnType<typeof useTrendChartModel> &
  ReturnType<typeof useTrendChartDecor> &
  ReturnType<typeof useTrendScaleEdgeEdit> &
  ReturnType<typeof useTrendScopeGesture> & {
    clearHover: () => void;
    scopeYMax: number;
  };

/** 플롯 루트 안의 SVG·오버레이·카드. 루트 포인터는 TrendChart에 남긴다. */
export function TrendChartPlotBody(props: PlotBodyProps) {
  const {
    markerDensity,
    n,
    series,
    coverageBands,
    showNullGaps,
    mode,
    xFor,
    yFor,
    padL,
    padR,
    viewW,
    innerW,
    innerH,
    chartH,
    fillParent,
    glowFilterId,
    plotEnterKey,
    scopeMotionKey,
    animate,
    scopeMotionDir,
    guidePresence,
    barW,
    barSlotW,
    hoverIdx,
    hoverSeries,
    edgeDragId,
    hoveredEdgeId,
    showMarkers,
    markerRadiusPx,
    histPresence,
    envelopePresence,
    seriesPresence,
    scaleEdgeLabels,
    alarmPresence,
    dedupedReferenceLines,
    pinnedTips,
    xForBar,
    markerRx,
    markerRy,
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
    crossChipRef,
    crossChipTimeRef,
    crossChipTempRef,
    crossChipHumRef,
    crossChipMotorRef,
    crossChipOtherRef,
    labelGutter,
    setPinnedTips,
    hoverEventMarkRef,
    setHoverEventMark,
    hoverSeriesRef,
    hoverIdxRef,
    setHoverIdx,
    setHoverSeries,
    plotRef,
    lastAnchorRef,
    placeTipNear,
    xScopeSelect,
    beginXScopeAt,
    moveXScopeAt,
    endXScopeAt,
    onXScopePointerCancel,
    yGutterStartCaption,
    yGutterEndCaption,
    hideAxisChrome,
    dimPlotValues,
    leftAxisTicks,
    yLabelColumn,
    hoveredEdgePresence,
    edgeBandLabels,
    edgeEdit,
    setEdgeEdit,
    onScaleEdgeApply,
    onScaleEdgeRevert,
    onScaleEdgeDrag,
    setHoveredEdgeId,
    clearHover,
    labelDragArmRef,
    onScaleEdgeNumericCommit,
    beginScaleEdgeEdit,
    edgeValueMaxCh,
    commitScaleEdgeEdit,
    cancelScaleEdgeEdit,
    scaleEdgeApplyBusy,
    scaleEdgeApplyDisabled,
    pinPresence,
    plotPx,
    pinCardSizes,
    setPinCardSizes,
    bringPinToFront,
    pinCardDragRef,
    overlayHoverMerge,
    categories,
    envelopes,
    histograms,
    leftUnit,
    rightUnit,
    onBreachEquipmentNavigate,
    hoverCardPresence,
    tipRef,
  } = props;

  const markerStride =
    markerDensity === "sparse" ? Math.max(1, Math.ceil(n / 8)) : 1;
  const shouldShowMarker = (i: number) => {
    if (markerDensity === "all") return true;
    if (i === 0 || i === n - 1) return true;
    return i % markerStride === 0;
  };
  const nullGapRanges = collectTrendNullGapRanges(series, n, {
    coverageBandCount: coverageBands.length,
    showNullGaps,
    mode,
  });
  const { lineSegments, envelopePaths } = bindTrendPlotPaths(xFor, yFor, n);

  const plotGeom: TrendPlotGeom = {
    xFor,
    yFor,
    padL,
    padR,
    viewW,
    innerW,
    innerH,
    n,
  };
  return (
    <>
      <TrendChartPlotSvg
        viewW={viewW}
        chartH={chartH}
        fillParent={fillParent}
        glowFilterId={glowFilterId}
        plotEnterKey={plotEnterKey}
        scopeMotionKey={scopeMotionKey}
        animate={animate}
        scopeMotionDir={scopeMotionDir}
        coverageBands={coverageBands}
        nullGapRanges={nullGapRanges}
        plotGeom={plotGeom}
        guidePresence={guidePresence}
        mode={mode}
        n={n}
        padL={padL}
        padR={padR}
        innerH={innerH}
        innerW={innerW}
        barW={barW}
        barSlotW={barSlotW}
        hoverIdx={hoverIdx}
        hoverSeries={hoverSeries}
        edgeDragId={edgeDragId}
        hoveredEdgeId={hoveredEdgeId}
        showMarkers={showMarkers}
        markerRadiusPx={markerRadiusPx}
        series={series}
        histPresence={histPresence}
        envelopePresence={envelopePresence}
        seriesPresence={seriesPresence}
        scaleEdgeLabels={scaleEdgeLabels}
        alarmPresence={alarmPresence}
        dedupedReferenceLines={dedupedReferenceLines}
        pinnedTips={pinnedTips}
        yFor={yFor}
        xFor={xFor}
        xForBar={xForBar}
        markerRx={markerRx}
        markerRy={markerRy}
        shouldShowMarker={shouldShowMarker}
        lineSegments={lineSegments}
        envelopePaths={envelopePaths}
        positionedCommandHits={positionedCommandHits}
        hoverEventMark={hoverEventMark}
        eventLane={eventLane}
        eventLaneH={eventLaneH}
        positionedEventMarks={positionedEventMarks}
        eventLaneTop={eventLaneTop}
        crossVRef={crossVRef}
        crossHRef={crossHRef}
        draftPresence={draftPresence}
        scopeYMax={scopeYMax}
      />

      <TrendChartCrosshairChip
        chipRef={crossChipRef}
        timeRef={crossChipTimeRef}
        tempRef={crossChipTempRef}
        humRef={crossChipHumRef}
        motorRef={crossChipMotorRef}
        otherRef={crossChipOtherRef}
      />

      {eventLane && eventLaneH > 0 ? (
        <EventLaneHtmlOverlay
          lane={eventLane}
          marks={positionedEventMarks}
          viewW={viewW}
          chartH={chartH}
          laneTop={eventLaneTop}
          laneH={eventLaneH}
          padL={padL}
          padR={padR}
          labelGutter={labelGutter}
          selectedId={
            [...pinnedTips]
              .reverse()
              .find((p) => p.eventMark)?.eventMark?.id ??
            hoverEventMark?.id ??
            null
          }
          onSelect={(mark, anchor) => {
            const placed = positionedEventMarks.find(
              (row) => row.mark.id === mark.id,
            );
            if (!placed && !anchor) return;
            const id = `event:${mark.id}`;
            setPinnedTips((prev) => {
              if (prev.some((p) => p.id === id)) {
                return prev.filter((p) => p.id !== id);
              }
              const next: PinnedTip = {
                id,
                idx: 0,
                seriesKey: id,
                nx: anchor ? anchor.nx : placed!.xView / viewW,
                ny: anchor ? anchor.ny : placed!.yView / chartH,
                ox: 0,
                oy: 0,
                eventMark: mark,
                atMs: mark.atMs,
              };
              return [...prev, next].slice(-MAX_PINNED_TIPS);
            });
          }}
          onEmptyContextMenu={() => {
            // 카드가 있으면 일괄 닫기(줌인 뒤로가기보다 우선). 처리 시 true.
            if (pinnedTips.length > 0) {
              setPinnedTips([]);
              return true;
            }
            return false;
          }}
          onHover={(mark, client) => {
            if (!mark) {
              if (hoverEventMarkRef.current) {
                hoverEventMarkRef.current = null;
                setHoverEventMark(null);
              }
              if (hoverSeriesRef.current?.startsWith("event:")) {
                hoverIdxRef.current = null;
                hoverSeriesRef.current = null;
                setHoverIdx(null);
                setHoverSeries(null);
              }
              return;
            }
            const same = hoverEventMarkRef.current?.id === mark.id;
            hoverEventMarkRef.current = mark;
            if (!same) {
              hoverIdxRef.current = null;
              hoverSeriesRef.current = `event:${mark.id}`;
              setHoverIdx(null);
              setHoverSeries(`event:${mark.id}`);
              setHoverEventMark(mark);
            }
            const plot = plotRef.current;
            if (!plot) return;
            const rect = plot.getBoundingClientRect();
            const placed = positionedEventMarks.find(
              (row) => row.mark.id === mark.id,
            );
            const anchorX = client
              ? Math.min(rect.width, Math.max(0, client.x - rect.left))
              : placed
                ? (placed.xView / viewW) * rect.width
                : rect.width / 2;
            const anchorY = client
              ? Math.min(rect.height, Math.max(0, client.y - rect.top))
              : placed
                ? (placed.yView / chartH) * rect.height
                : rect.height / 2;
            lastAnchorRef.current = {
              x: anchorX,
              y: anchorY,
              w: rect.width,
              h: rect.height,
            };
            placeTipNear(anchorX, anchorY, rect.width, rect.height);
          }}
          scopeHandlers={
            xScopeSelect
              ? {
                  begin: (clientX, clientY) => {
                    const plot = plotRef.current;
                    if (!plot) return;
                    beginXScopeAt(clientX, clientY, plot);
                  },
                  move: (clientX, clientY) => {
                    const plot = plotRef.current;
                    if (!plot) return;
                    moveXScopeAt(clientX, clientY, plot);
                  },
                  end: (clientX, clientY) => {
                    const plot = plotRef.current;
                    if (!plot) return false;
                    return endXScopeAt(clientX, clientY, plot);
                  },
                  cancel: () => onXScopePointerCancel(),
                }
              : null
          }
        />
      ) : null}

      {positionedCommandHits.length > 0 ? (
        <CommandSettingHitOverlay
          hits={positionedCommandHits}
          viewW={viewW}
          chartH={chartH}
          selectedId={
            [...pinnedTips]
              .reverse()
              .find((p) => p.eventMark)?.eventMark?.id ??
            hoverEventMark?.id ??
            null
          }
          onSelect={(mark, anchor) => {
            const hit = positionedCommandHits.find(
              (row) => row.seg.mark.id === mark.id,
            );
            if (!hit && !anchor) return;
            const id = `event:${mark.id}`;
            setPinnedTips((prev) => {
              if (prev.some((p) => p.id === id)) {
                return prev.filter((p) => p.id !== id);
              }
              const nx = anchor
                ? anchor.nx
                : (hit!.x0 + hit!.x1) / 2 / viewW;
              const ny = anchor
                ? anchor.ny
                : (hit!.y + hit!.h / 2) / chartH;
              const next: PinnedTip = {
                id,
                idx: 0,
                seriesKey: id,
                nx,
                ny,
                ox: 0,
                oy: 0,
                eventMark: mark,
                atMs: mark.atMs,
              };
              return [...prev, next].slice(-MAX_PINNED_TIPS);
            });
          }}
          onEmptyContextMenu={() => {
            if (pinnedTips.length > 0) {
              setPinnedTips([]);
              return true;
            }
            return false;
          }}
          onHover={(mark, client) => {
            if (!mark) {
              if (hoverEventMarkRef.current) {
                hoverEventMarkRef.current = null;
                setHoverEventMark(null);
              }
              if (hoverSeriesRef.current?.startsWith("event:")) {
                hoverIdxRef.current = null;
                hoverSeriesRef.current = null;
                setHoverIdx(null);
                setHoverSeries(null);
              }
              return;
            }
            const same = hoverEventMarkRef.current?.id === mark.id;
            hoverEventMarkRef.current = mark;
            if (!same) {
              hoverIdxRef.current = null;
              hoverSeriesRef.current = `event:${mark.id}`;
              setHoverIdx(null);
              setHoverSeries(`event:${mark.id}`);
              setHoverEventMark(mark);
            }
            const plot = plotRef.current;
            if (!plot) return;
            const rect = plot.getBoundingClientRect();
            const hit = positionedCommandHits.find(
              (row) => row.seg.mark.id === mark.id,
            );
            const anchorX = client
              ? Math.min(rect.width, Math.max(0, client.x - rect.left))
              : hit
                ? ((hit.x0 + hit.x1) / 2 / viewW) * rect.width
                : rect.width / 2;
            const anchorY = client
              ? Math.min(rect.height, Math.max(0, client.y - rect.top))
              : hit
                ? ((hit.y + hit.h / 2) / chartH) * rect.height
                : rect.height / 2;
            lastAnchorRef.current = {
              x: anchorX,
              y: anchorY,
              w: rect.width,
              h: rect.height,
            };
            placeTipNear(anchorX, anchorY, rect.width, rect.height);
          }}
          scopeHandlers={
            xScopeSelect
              ? {
                  begin: (clientX, clientY) => {
                    const plot = plotRef.current;
                    if (!plot) return;
                    beginXScopeAt(clientX, clientY, plot);
                  },
                  move: (clientX, clientY) => {
                    const plot = plotRef.current;
                    if (!plot) return;
                    moveXScopeAt(clientX, clientY, plot);
                  },
                  end: (clientX, clientY) => {
                    const plot = plotRef.current;
                    if (!plot) return false;
                    return endXScopeAt(clientX, clientY, plot, {
                      timeOnly: true,
                    });
                  },
                  cancel: () => onXScopePointerCancel(),
                }
              : null
          }
        />
      ) : null}

      {viewW > 0
        ? coverageBands.map((g) => {
            const x0 = xFor(g.i0);
            const x1 = xFor(g.i1);
            const slot = n > 1 ? innerW / (n - 1) : innerW;
            const left = Math.max(padL, x0 - slot / 2);
            const right = Math.min(viewW - padR, x1 + slot / 2);
            const width = Math.max(0, right - left);
            if (width / viewW < 0.08 && g.i1 - g.i0 < 1) return null;
            const color =
              g.kind === "sparse"
                ? "var(--status-warn-on-canvas)"
                  : g.kind === "offline"
                  ? "var(--status-danger-on-canvas)"
                  : undefined;
            return (
              <span
                key={`cov-lab-${g.kind}-${g.i0}-${g.i1}`}
                className="pointer-events-none absolute top-1 z-[1] truncate px-0.5 farm-chart-fs-axis tabular-nums"
                style={{
                  left: `${(left / viewW) * 100}%`,
                  width: `${(width / viewW) * 100}%`,
                  color: color ?? "var(--muted-foreground)",
                }}
              >
                {g.label}
              </span>
            );
          })
        : null}

      <TrendChartYAxis
        yGutterStartCaption={yGutterStartCaption}
        yGutterEndCaption={yGutterEndCaption}
        hideAxisChrome={hideAxisChrome}
        dimPlotValues={dimPlotValues}
        leftAxisTicks={leftAxisTicks}
        labelGutter={labelGutter}
        yLabelColumn={yLabelColumn}
      />

      <TrendChartEdgeLabels
        hoveredEdgePresence={hoveredEdgePresence}
        edgeBandLabels={edgeBandLabels}
        edgeEdit={edgeEdit}
        setEdgeEdit={setEdgeEdit}
        onScaleEdgeApply={onScaleEdgeApply}
        onScaleEdgeRevert={onScaleEdgeRevert}
        labelGutter={labelGutter}
        onScaleEdgeDrag={onScaleEdgeDrag}
        yLabelColumn={yLabelColumn}
        hoveredEdgeId={hoveredEdgeId}
        setHoveredEdgeId={setHoveredEdgeId}
        dimPlotValues={dimPlotValues}
        edgeDragId={edgeDragId}
        clearHover={clearHover}
        scaleEdgeLabels={scaleEdgeLabels}
        plotRef={plotRef}
        labelDragArmRef={labelDragArmRef}
        onScaleEdgeNumericCommit={onScaleEdgeNumericCommit}
        beginScaleEdgeEdit={beginScaleEdgeEdit}
        edgeValueMaxCh={edgeValueMaxCh}
        commitScaleEdgeEdit={commitScaleEdgeEdit}
        cancelScaleEdgeEdit={cancelScaleEdgeEdit}
        scaleEdgeApplyBusy={scaleEdgeApplyBusy}
        scaleEdgeApplyDisabled={scaleEdgeApplyDisabled}
      />

      <TrendChartPinnedCards
        pinPresence={pinPresence}
        n={n}
        plotPx={plotPx}
        pinCardSizes={pinCardSizes}
        setPinCardSizes={setPinCardSizes}
        plotRef={plotRef}
        bringPinToFront={bringPinToFront}
        pinCardDragRef={pinCardDragRef}
        setPinnedTips={setPinnedTips}
        overlayHoverMerge={overlayHoverMerge}
        categories={categories}
        series={series}
        envelopes={envelopes}
        histograms={histograms}
        leftUnit={leftUnit}
        rightUnit={rightUnit}
        onBreachEquipmentNavigate={onBreachEquipmentNavigate}
      />

      <TrendChartHoverCard
        presence={hoverCardPresence}
        tipRef={tipRef}
        coverageBands={coverageBands}
        overlayHoverMerge={overlayHoverMerge}
        categories={categories}
        series={series}
        envelopes={envelopes}
        histograms={histograms}
        leftUnit={leftUnit}
        rightUnit={rightUnit}
        onBreachEquipmentNavigate={onBreachEquipmentNavigate}
      />
    </>
  );
}
