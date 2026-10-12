"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { SharedChartLayerDisplay } from "@/components/farm/unified-trend-layer-toolbar";
import {
  BRUSH_PERIOD_WINDOW,
  displayPeriodFromBrushWindow,
  zoomBrushLookback,
  type BrushWindow,
} from "@/components/farm/unified-trend-period-brush";
import type { ChartTrendZoomHint } from "@/lib/farm/farm-chart-scope";
import {
  DEFAULT_COMMAND_CHANNEL_FLAGS,
  type CommandChannelFlags,
} from "@/lib/farm/command-hold-bands";
import {
  DEFAULT_UNIFIED_LAYERS,
  type UnifiedLayerFlags,
} from "@/lib/farm/unified-barn-trend-series";
import { FARM_CHART_UI_SCALE } from "@/lib/ui/farm-chart-ui-scale";

/**
 * 통합 추세 패널의 레이어·브러시·툴바 상태.
 * `unified-barn-trend-panel.tsx`에서 분리(동작 보존).
 * 줌 스택 setState는 패널에 남긴다.
 */
export function useUnifiedBarnTrendChrome({
  comparisonZoom,
  sharedLayers,
  headingMode,
  commandPaneOpen,
  layersToolbarActive,
  brushWindowProp,
  onBrushWindowChange,
}: {
  comparisonZoom: ChartTrendZoomHint | null | undefined;
  sharedLayers?: SharedChartLayerDisplay;
  headingMode: "full" | "widget" | "overview";
  commandPaneOpen: boolean;
  layersToolbarActive: boolean;
  brushWindowProp?: BrushWindow;
  onBrushWindowChange?: (window: BrushWindow) => void;
}) {
  const comparisonActive = comparisonZoom !== undefined;
  const [ownedLayers, setOwnedLayers] =
    useState<UnifiedLayerFlags>(DEFAULT_UNIFIED_LAYERS);
  const [ownedAlarmRangeOn, setOwnedAlarmRangeOn] = useState({
    temp: true,
    hum: true,
  });
  const layers = sharedLayers?.layers ?? ownedLayers;
  const alarmRangeOn = sharedLayers?.alarmRangeOn ?? ownedAlarmRangeOn;
  const overview = headingMode === "overview";
  const chartUiScale = overview ? 1 : FARM_CHART_UI_SCALE;
  const [commandChannels, setCommandChannels] = useState<CommandChannelFlags>(
    DEFAULT_COMMAND_CHANNEL_FLAGS,
  );
  const [commandPaneSeen, setCommandPaneSeen] = useState(commandPaneOpen);
  const [toolbarActiveSeen, setToolbarActiveSeen] = useState(layersToolbarActive);
  const [layersToolbarMounted, setLayersToolbarMounted] = useState(
    layersToolbarActive,
  );
  const [layersToolbarPhase, setLayersToolbarPhase] = useState<
    "enter" | "exit"
  >(layersToolbarActive ? "enter" : "exit");
  const [layersAnimKey, setLayersAnimKey] = useState(0);
  const brushControlled =
    brushWindowProp != null && onBrushWindowChange != null;
  const [innerBrushWindow, setInnerBrushWindow] = useState<BrushWindow>(
    () => BRUSH_PERIOD_WINDOW["24h"],
  );
  const brushWindow = brushControlled ? brushWindowProp : innerBrushWindow;
  const lookbackPeriod = displayPeriodFromBrushWindow(brushWindow);
  const applyBrushWindow = (next: BrushWindow) => {
    if (brushControlled) onBrushWindowChange(next);
    else setInnerBrushWindow(next);
  };
  const lookbackWinRef = useRef(brushWindow);
  useLayoutEffect(() => {
    lookbackWinRef.current = brushWindow;
  }, [brushWindow]);
  const onLookbackWheel = useCallback(
    (dir: 1 | -1) => {
      const cur = lookbackWinRef.current;
      const next = zoomBrushLookback(cur, dir);
      if (
        Math.abs(next.width - cur.width) < 1e-12 &&
        Math.abs(next.start - cur.start) < 1e-12
      ) {
        return;
      }
      lookbackWinRef.current = next;
      if (onBrushWindowChange) onBrushWindowChange(next);
      else setInnerBrushWindow(next);
    },
    [onBrushWindowChange],
  );
  const brushSyncKey = `${brushWindow.start.toFixed(4)}:${brushWindow.width.toFixed(4)}`;
  const [chartPlotWidth, setChartPlotWidth] = useState(0);
  const onChartPlotWidth = useCallback((w: number) => {
    setChartPlotWidth((prev) => (Math.abs(prev - w) < 8 ? prev : w));
  }, []);
  const plotWidthPx = chartPlotWidth > 32 ? chartPlotWidth : 800;

  if (layersToolbarActive !== toolbarActiveSeen) {
    setToolbarActiveSeen(layersToolbarActive);
    if (layersToolbarActive) {
      setLayersToolbarMounted(true);
      setLayersToolbarPhase("enter");
      setLayersAnimKey((k) => k + 1);
    } else {
      setLayersToolbarPhase("exit");
    }
  }
  if (commandPaneSeen !== commandPaneOpen) {
    setCommandPaneSeen(commandPaneOpen);
    if (!commandPaneOpen) {
      setCommandChannels(DEFAULT_COMMAND_CHANNEL_FLAGS);
    }
  }

  return {
    comparisonActive,
    layers,
    alarmRangeOn,
    overview,
    chartUiScale,
    commandChannels,
    setCommandChannels,
    brushControlled,
    brushWindow,
    lookbackPeriod,
    applyBrushWindow,
    onLookbackWheel,
    brushSyncKey,
    plotWidthPx,
    onChartPlotWidth,
    setOwnedLayers,
    setOwnedAlarmRangeOn,
    layersToolbarMounted,
    layersToolbarPhase,
    layersAnimKey,
    setLayersToolbarMounted,
  };
}

export type UnifiedBarnTrendChromeModel = ReturnType<
  typeof useUnifiedBarnTrendChrome
>;
