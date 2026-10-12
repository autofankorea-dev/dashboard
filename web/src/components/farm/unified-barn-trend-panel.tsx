"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GuidedXScopeGesture } from "@/components/farm/unified-barn-trend-guided-scope";
import { buildGuidedScopePlayback } from "@/components/farm/unified-barn-trend-guided-scope";
import { UnifiedBarnTrendPanelFrame } from "@/components/farm/unified-barn-trend-panel-frame";
import type { UnifiedBarnTrendControllerRef } from "@/components/farm/unified-barn-trend-scope-marks";
import {
  resolveXScopeRangeMs,
  scopeEntryFromZoomHint,
  xScopeEntryOutOfRange,
  type PanelXScopeEntry,
} from "@/components/farm/unified-barn-trend-x-scope";
import type { SharedChartLayerDisplay } from "@/components/farm/unified-trend-layer-toolbar";
import {
  BRUSH_PERIOD_WINDOW,
  type BrushWindow,
} from "@/components/farm/unified-trend-period-brush";
import { useUnifiedBarnTrendChrome } from "@/components/farm/use-unified-barn-trend-chrome";
import { useUnifiedBarnTrendScopeActions } from "@/components/farm/use-unified-barn-trend-scope-actions";
import { useUnifiedBarnTrendSeries } from "@/components/farm/use-unified-barn-trend-series";
import { useUnifiedBarnTrendView } from "@/components/farm/use-unified-barn-trend-view";
import type { AlarmSettings } from "@/lib/domain/alarms";
import type { UnifiedMetricAvailability } from "@/lib/farm/unified-barn-trend-series";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
  TrendWindow15m,
} from "@/lib/domain/farm-trend-types";
import type { UplinkCoverageIndex } from "@/lib/farm/trend-uplink-coverage";
import type {
  ChartTrendZoomHint,
  FarmChartScope,
} from "@/lib/farm/farm-chart-scope";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import { window15mCovers } from "@/lib/farm/trend-brush-coverage";
import {
  humanizeGuidedScopeRect,
  type GuidedScopeRect,
} from "@/lib/ui/guided-scope-jitter";

export type { UnifiedBarnTrendControllerRef };

type Props = {
  label: string;
  controllers: UnifiedBarnTrendControllerRef[];
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period: TrendPeriodId;
  onPeriodChange?: (period: TrendPeriodId) => void;
  alarmSettings?: AlarmSettings;
  /** 호출부 호환. 차트 환기 안내는 디코드 오버레이를 씀 */
  thermoSettings?: Record<string, ControllerThermoSettings>;
  /** 차트 집계 범위 — 알람 저장 계층과 동일 */
  chartScope: FarmChartScope;
  /** 한계 이탈 tip 우클릭 → 컨트롤러 스코프 */
  onScopeChange?: (scope: FarmChartScope) => void;
  /** P2 — URL 초기 확대 초기 Y밴드·X구간 */
  initialZoom?: ChartTrendZoomHint | null;
  /** 비교 두 칸의 공통 구간. undefined는 기존 개별 줌. */
  comparisonZoom?: ChartTrendZoomHint | null;
  /** E — 집중 칩·스코프 → URL chartYBand 동기화 */
  onZoomChange?: (zoom: ChartTrendZoomHint | null) => void;
  /** 컨트롤러 집계에서 명령 이력 전용 차트 */
  commandPaneOpen?: boolean;
  /**
   * 구간 안내 — 실제 X스코프 UI로 클릭→드래그→커밋 시연.
   * token 증가 시 재생. CSS 오버레이 아님.
   */
  guidedXScopeGesture?: GuidedXScopeGesture | null;
  onGuidedXScopeComplete?: () => void;
  /** 조회 전용(뷰어)이면 알람 편집 비활성 */
  canCommand?: boolean;
  isMobileStack?: boolean;
  /** 미지정 시 모바일 320 / 데스크톱 340 */
  chartHeight?: number;
  /** 차트 탭 — 남는 세로를 플롯이 채움. 임베드는 끄고 `chartHeight`만 씀 */
  plotFill?: boolean;
  /** 차트 탭 활성 시에만 TopBar 레이어 툴바 표시 */
  layersToolbarActive?: boolean;
  /** 위젯 칸 — 제목을 컨트롤러 명칭만, 헤더 우측 액션. overview는 개요 축소 칸 */
  headingMode?: "full" | "widget" | "overview";
  headerActions?: ReactNode;
  /** true면 패널 안 기간 브러시를 그리지 않음(공유 브러시) */
  hidePeriodBrush?: boolean;
  /** 있으면 내부 브러시 상태 대신 이 창을 씀 */
  brushWindow?: BrushWindow;
  onBrushWindowChange?: (window: BrushWindow) => void;
  /** 모바일 — 헤더에 집계 범위 핸들 (우측 패널 오픈) */
  mobileScopeHandle?: {
    open: boolean;
    onOpen: () => void;
  } | null;
  /** 추이 fetch 중 — 빈 화면을 '데이터 없음'과 구분 */
  trendLoading?: boolean;
  trendError?: boolean;
  /** 24시간 이후 30일 1시간을 이어 받는 중 */
  trendExtending?: boolean;
  /** 브러시 확대(≤48h) 구간 15분 */
  window15mLoading?: boolean;
  window15m?: TrendWindow15m | null;
  onNeedWindow15m?: (fromMs: number, toMs: number) => void;
  /** 추이 차트 — 희소 칸 값 유지용. 밴드·라벨은 그리지 않음. */
  uplinkCoverage?: UplinkCoverageIndex[];
  /** 있으면 칸 안 툴바 대신 페이지 공유 레이어·알람 띠를 쓴다 */
  sharedLayers?: SharedChartLayerDisplay;
  /** 펼친 축사 — 속한 컨트롤러 본선을 겹쳐 그림 (평균 칸은 끄기) */
  overlayControllers?: boolean;
  /** 시계열 있는 지표 — 공유 툴바 아이콘 정합 */
  onMetricAvailable?: (available: UnifiedMetricAvailability) => void;
  /** 컨트롤러 번호 토글로 모두 끈 상태 */
  controllerSelectEmpty?: boolean;
  className?: string;
};

/**
 * 차트 탭 통합 추이 — 온도+편차 · 모터 max/채널 · 네비 브러시.
 */
export function UnifiedBarnTrendPanel({
  label,
  controllers,
  controllerTrendByPeriod,
  period,
  alarmSettings,
  chartScope,
  onScopeChange,
  initialZoom = null,
  comparisonZoom,
  onZoomChange,
  commandPaneOpen = false,
  guidedXScopeGesture = null,
  onGuidedXScopeComplete,
  canCommand: _canCommand = false,
  isMobileStack = false,
  chartHeight,
  plotFill = false,
  layersToolbarActive = true,
  headingMode = "full",
  headerActions = null,
  hidePeriodBrush = false,
  brushWindow: brushWindowProp,
  onBrushWindowChange,
  mobileScopeHandle = null,
  trendLoading = false,
  trendError = false,
  trendExtending = false,
  window15mLoading = false,
  window15m = null,
  onNeedWindow15m,
  uplinkCoverage = [],
  sharedLayers,
  overlayControllers = false,
  onMetricAvailable,
  controllerSelectEmpty = false,
  className,
}: Props) {

  const chrome = useUnifiedBarnTrendChrome({
    comparisonZoom,
    sharedLayers,
    headingMode,
    commandPaneOpen,
    layersToolbarActive,
    brushWindowProp,
    onBrushWindowChange,
  });
  const {
    brushSyncKey,
    brushControlled,
    brushWindow,
    applyBrushWindow,
    overview,
  } = chrome;

  const [xScopeStack, setXScopeStack] = useState<PanelXScopeEntry[]>([]);
  const xScope =
    xScopeStack.length > 0 ? xScopeStack[xScopeStack.length - 1]! : null;
  const [seenBrushKey, setSeenBrushKey] = useState(brushSyncKey);
  if (brushControlled && brushSyncKey !== seenBrushKey) {
    setSeenBrushKey(brushSyncKey);
    if (xScopeStack.length > 0) setXScopeStack([]);
  }

  const series = useUnifiedBarnTrendSeries({
    controllers,
    chartScope,
    alarmSettings,
    chrome,
    controllerTrendByPeriod,
    period,
    hidePeriodBrush,
    uplinkCoverage,
    onMetricAvailable,
    isMobileStack,
    chartHeight,
    xScope,
    overlayControllers,
  });
  const { picked, windowBundle, built, layerLayout } = series;

  const [scopeMotionKey, setScopeMotionKey] = useState(0);
  const [scopeMotionDir, setScopeMotionDir] = useState<"in" | "out">("in");
  const bumpScopeMotion = useCallback((dir: "in" | "out") => {
    setScopeMotionDir(dir);
    setScopeMotionKey((k) => k + 1);
  }, []);
  const initialZoomKeyRef = useRef<string>("");

  /** 농장 기간 변경 시 브러시 창·스코프 시드 (render-time sync — 값이 바뀔 때만) */
  const [scopePeriod, setScopePeriod] = useState(period);
  if (period !== scopePeriod) {
    setScopePeriod(period);
    setXScopeStack([]);
    if (!brushControlled) {
      const nextWindow = BRUSH_PERIOD_WINDOW["24h"];
      if (
        Math.abs(brushWindow.start - nextWindow.start) > 1e-12 ||
        Math.abs(brushWindow.width - nextWindow.width) > 1e-12
      ) {
        applyBrushWindow(nextWindow);
      }
    }
  }

  /** 데이터 길이/인덱스 불일치 시 스택 비우기 */
  if (
    xScope &&
    picked &&
    xScopeStack.length > 0 &&
    xScopeEntryOutOfRange(picked.categories.length, xScope)
  ) {
    setXScopeStack([]);
  }

  const xScopeRangeMs = useMemo(() => {
    if (!picked || !windowBundle) return null;
    return resolveXScopeRangeMs({
      overview,
      scope: xScope,
      categoryCount: picked.categories.length,
      bucketAts: windowBundle.bucketAts,
    });
  }, [overview, xScope, picked, windowBundle]);

  useEffect(() => {
    if (!xScopeRangeMs) return;
    if (window15mCovers(window15m, xScopeRangeMs.fromMs, xScopeRangeMs.toMs)) {
      return;
    }
    const timer = window.setTimeout(() => {
      onNeedWindow15m?.(xScopeRangeMs.fromMs, xScopeRangeMs.toMs);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [xScopeRangeMs, window15m, onNeedWindow15m]);

  const effectiveZoom = comparisonZoom === undefined ? initialZoom : comparisonZoom;
  const [seenComparisonZoom, setSeenComparisonZoom] = useState(comparisonZoom);
  if (comparisonZoom !== seenComparisonZoom) {
    setSeenComparisonZoom(comparisonZoom);
    if (comparisonZoom === null) setXScopeStack([]);
  }
  /** URL 힌트와 비교 두 칸의 공통 줌 적용. */
  useEffect(() => {
    if (!effectiveZoom) {
      initialZoomKeyRef.current = "";
      return;
    }
    if (!picked) return;
    const n = picked.categories.length;
    if (n < 3) return;
    const key = [
      period,
      effectiveZoom.yBands.join("+"),
      effectiveZoom.startRatio.toFixed(3),
      effectiveZoom.endRatio.toFixed(3),
      String(n),
    ].join("|");
    const entry = scopeEntryFromZoomHint(n, effectiveZoom);
    if (initialZoomKeyRef.current === key || !entry) return;
    initialZoomKeyRef.current = key;
    setXScopeStack([entry]);
    bumpScopeMotion("in");
  }, [effectiveZoom, comparisonZoom, picked, period, bumpScopeMotion]);

  const { commitXScope, popXScope, clearXScope } = useUnifiedBarnTrendScopeActions({
    series,
    xScope,
    xScopeStack,
    setXScopeStack,
    bumpScopeMotion,
    onZoomChange,
    comparisonZoom,
  });

  useEffect(() => {
    if (xScopeStack.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      popXScope();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [xScopeStack.length, popXScope]);
  const alarmEditEnabled =
    false;

  /** 가이드 제스처 토큰 변경 시 스택 비움 — TrendChart 전달은 비운 뒤 */
  const gestureToken = guidedXScopeGesture?.token ?? 0;
  const [prevGestureToken, setPrevGestureToken] = useState(0);
  const [guideReadyToken, setGuideReadyToken] = useState(0);
  if (gestureToken !== prevGestureToken) {
    setPrevGestureToken(gestureToken);
    setXScopeStack([]);
    setGuideReadyToken(gestureToken);
  }

  useLayoutEffect(() => {
    initialZoomKeyRef.current = "";
  }, [gestureToken]);

  const guidedScopeBase = useMemo(() => {
    if (!guidedXScopeGesture || !built) return null;
    return buildGuidedScopePlayback({
      gesture: guidedXScopeGesture,
      leftDomain: built.leftDomain,
      tempLo: layerLayout.tempLo,
      tempHi: layerLayout.tempHi,
    });
  }, [
    guidedXScopeGesture,
    built,
    layerLayout.tempLo,
    layerLayout.tempHi,
  ]);

  /** token당 humanize 1회 — render sync (ref 캐시 금지) */
  const [guidedJitterCache, setGuidedJitterCache] = useState<{
    token: number;
    rect: GuidedScopeRect;
  } | null>(null);
  if (guidedScopeBase) {
    if (guidedJitterCache?.token !== guidedScopeBase.token) {
      setGuidedJitterCache({
        token: guidedScopeBase.token,
        rect: humanizeGuidedScopeRect(guidedScopeBase.base),
      });
    }
  } else if (guidedJitterCache !== null) {
    setGuidedJitterCache(null);
  }

  const view = useUnifiedBarnTrendView({
    series,
    chrome,
    xScope,
    xScopeStack,
    xScopeRangeMs,
    guidedScopeBase,
    guidedJitterCache,
    guideReadyToken,
    alarmEditEnabled,
    window15m,
    controllers,
    uplinkCoverage,
    chartScope,
    commandPaneOpen,
    sharedLayers,
    layersToolbarActive,
    trendLoading,
    trendError,
    controllerTrendByPeriod,
  });

  return (
    <UnifiedBarnTrendPanelFrame
      {...chrome}
      {...series}
      {...view}
      label={label}
      className={className}
      plotFill={plotFill}
      headingMode={headingMode}
      isMobileStack={isMobileStack}
      xScope={xScope}
      xScopeStack={xScopeStack}
      chartScope={chartScope}
      controllers={controllers}
      mobileScopeHandle={mobileScopeHandle}
      headerActions={headerActions}
      period={period}
      onScopeChange={onScopeChange}
      onGuidedXScopeComplete={onGuidedXScopeComplete}
      trendExtending={trendExtending}
      window15mLoading={window15mLoading}
      trendLoading={trendLoading}
      trendError={trendError}
      controllerTrendByPeriod={controllerTrendByPeriod}
      controllerSelectEmpty={controllerSelectEmpty}
      hidePeriodBrush={hidePeriodBrush}
      scopeMotionKey={scopeMotionKey}
      scopeMotionDir={scopeMotionDir}
      clearXScope={clearXScope}
      commitXScope={commitXScope}
      popXScope={popXScope}
    />
  );
}
