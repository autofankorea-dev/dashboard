"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PanelRight } from "lucide-react";
import {
  TrendChart,
  type ScaleEdgeNumericCommitEvent,
  type TrendCommandSettingSeg,
  type TrendRangeBand,
  type TrendScaleEdgeLabel,
} from "@/components/trends/trend-chart";
import { formatTrendBandEdge } from "@/components/trends/trend-chart-format";
import {
  BRUSH_PERIOD_WINDOW,
  UnifiedTrendPeriodBrush,
  displayPeriodFromBrushWindow,
  zoomBrushLookback,
  type BrushWindow,
} from "@/components/farm/unified-trend-period-brush";
import {
  UnifiedTrendLayerToolbar,
  CommandChannelLayerToolbar,
  applyLayerGroupMode,
  detectLayerGroupMode,
  nextLayerGroupMode,
  type SharedChartLayerDisplay,
} from "@/components/farm/unified-trend-layer-toolbar";
import { saveAlarmSettingsInlineAction } from "@/lib/actions/app-settings-actions";
import {
  applyScopeAlarmThresholdsWithCascade,
  resolveThresholdsForChartScope,
} from "@/lib/data/alarm-scope";
import type { AlarmSettings, AlarmThresholds } from "@/lib/data/alarms";
import {
  DEFAULT_ALARM_SETTINGS,
  validateAlarmThresholds,
} from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { pigEnvBandForStallTy } from "@/lib/farm/pig-env-recommend";
import {
  emptyTrendControllerPeriodData,
  isContextControllerTrend30d,
  pickTrendCanvasPeriod,
  TREND_MINI_STRIDE_MS,
  TREND_PERIODS,
  TREND_ZOOM_15M_MAX_DAYS,
  controllerTrendPeriodHasSeries,
  type TrendControllerPeriodData,
  type TrendControllerSeries,
  type TrendPeriodId,
  type TrendWindow15m,
} from "@/lib/data/farm-trend-types";
import {
  type UplinkCoverageIndex,
} from "@/lib/farm/trend-uplink-coverage";
import {
  applyCoverageToWindow,
  binControllerWindowToStride,
  brushSliceRange,
  bucketAtsRangeMs,
  buildTrendBrushOverview,
  controllerWindowHasValues,
  downsampleSeriesForChart,
  FARM_ALARM_RANGE_FILL,
  FARM_ALARM_RANGE_FILL_OPACITY,
  FARM_ALARM_RANGE_HUM_OVERLAY_OPACITY,
  FARM_ALARM_RANGE_TEMP_OVERLAY_OPACITY,
  farmAlarmMidValue,
  mapIndexWindowToSlice,
  sliceControllerSeries,
} from "@/components/farm/unified-barn-trend-panel-helpers";
import { applyAlarmScaleEdgeCommit } from "@/lib/data/alarm-baseline";
import {
  window15mCovers,
} from "@/lib/farm/trend-brush-coverage";
import {
  findControllerTrendSeries,
  formatControllerHeaderPrimary,
  formatControllerHeaderSecondary,
  formatControllerHeaderStallType,
} from "@/lib/farm/controller-summary-display";
import {
  ControllerAffiliationMarks,
  StallUnitNoMark,
} from "@/components/farm/controller-summary-parts";
import {
  alarmScopeKeyFromFarmChartScope,
  chartScopeEntryToZoomHint,
  type ChartTrendZoomHint,
  type FarmChartScope,
  scopesEqual,
} from "@/lib/farm/farm-chart-scope";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import { sliceControllerTrendByTime } from "@/lib/data/trend-period-slice";
import { buildDecodedSettingHoldSegments, sliceFanControlWindows } from "@/lib/farm/channel-thermo";
import {
  clipCommandSettingY,
  decodedSettingHoldToEventMark,
} from "@/lib/farm/decoded-setting-hold";
import {
  DEFAULT_COMMAND_CHANNEL_FLAGS,
  toggleCommandChannelFlag,
  type CommandChannelFlags,
} from "@/lib/farm/command-hold-bands";
import {
  tickEveryForDisplayBars,
  formatTrendScopeRangeLabel,
  parseCategoryTimelineMs,
} from "@/lib/farm/trend-display-buckets";
import { TREND_CHART_COLORS } from "@/lib/farm/trend-chart-series";
import {
  aggregateUnifiedBarnTrendRaw,
  DEFAULT_UNIFIED_LAYERS,
  mapHumPctToSplitY,
  mapMotorPctToSplitY,
  mapTempCToSplitY,
  tempBrokenAxisPlotZones,
  mapUnifiedBarnTrendRawToSplitY,
  overlayControllerMetricSeries,
  replaceAverageMetricSeries,
  metricAvailabilityFromSeriesList,
  andSplitYVisibility,
  buildSplitYBandScaleTicks,
  pickUnifiedTrendLayers,
  resolveUnifiedPlotLayout,
  sliceUnifiedTrendByIndex,
  splitYVisibilityFromLayers,
  countSplitYBands,
  hitSplitYBand,
  resolveYScopeBands,
  domainYFromViewRatio,
  visibilityForYBands,
  maskLayersForYBands,
  isSingleYBandFocus,
  allocateUnifiedChartBandHeights,
  unifiedYBandsScopeLabel,
  OVERLAY_ALIGN_ANCHOR,
  alarmEdgeDomain,
  SPLIT_Y_HUM_EDGE_PAD_PCT,
  type UnifiedLayerFlags,
  type UnifiedMetricAvailability,
  type UnifiedYBandId,
} from "@/lib/farm/unified-barn-trend-series";
import { invertSplitYCrosshairValues } from "@/lib/farm/farm-crosshair-readout";
import { useUnifiedChartBandTransition } from "@/lib/farm/use-split-y-layout-transition";
import { useFarmLiveRefreshOptional } from "@/lib/navigation/farm-live-refresh";
import { motionClass } from "@/lib/ui/motion-classes";
import { motionDuration } from "@/lib/ui/motion-tokens";
import {
  humanizeGuidedScopeRect,
  type GuidedScopeRect,
} from "@/lib/ui/delin-guided-scope-jitter";
import { dashboardChroma, dashboardControlFill, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import {
  chartUiPx,
  farmChartUi,
  FARM_CHART_UI_SCALE,
} from "@/lib/ui/farm-chart-ui-scale";
import { cn } from "@/lib/utils";

export type UnifiedBarnTrendControllerRef = {
  key: string;
  reading: BarnReading | null;
};

type ScopeEntry = {
  start: number;
  end: number;
  /** null = Y필터 없음 · ["temp","hum"] = 걸린 밴드만 */
  yBands: UnifiedYBandId[] | null;
};

/** 모바일 차트 대상 — 축사유형 + 축사/컨트롤러 아이콘·번호 */
function ChartScopeTargetMarks({
  chartScope,
  controllers,
  fallbackLabel,
  typeClassName,
}: {
  chartScope: FarmChartScope;
  controllers: UnifiedBarnTrendControllerRef[];
  fallbackLabel: string;
  typeClassName?: string;
}) {
  if (chartScope.level === "farm") {
    return fallbackLabel;
  }

  const typeLabel = formatControllerHeaderStallType({
    stallTyCode: chartScope.stallTyCode,
  });

  if (chartScope.level === "sp") {
    return <span className={cn("break-keep", typeClassName)}>{typeLabel}</span>;
  }

  const stallNo = chartScope.stallNo.startsWith("__")
    ? null
    : chartScope.stallNo;

  const controllerReading =
    chartScope.level === "controller"
      ? (controllers.find((c) => c.key === chartScope.controllerKey)?.reading ??
        controllers[0]?.reading)
      : controllers.length === 1
        ? controllers[0]?.reading
        : null;

  if (controllerReading) {
    return (
      <ControllerAffiliationMarks
        stallTyCode={chartScope.stallTyCode}
        stallNo={stallNo ?? controllerReading.stallNo}
        eqpmnNo={controllerReading.eqpmnNo}
        typeClassName={typeClassName}
      />
    );
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className={cn("break-keep", typeClassName)}>{typeLabel}</span>
      <StallUnitNoMark stallNo={stallNo} />
    </span>
  );
}

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
  /** P2 — URL/DELIN handoff 초기 Y밴드·X구간 */
  initialZoom?: ChartTrendZoomHint | null;
  /** E — 집중 칩·스코프 → URL chartYBand 동기화 */
  onZoomChange?: (zoom: ChartTrendZoomHint | null) => void;
  /** 컨트롤러 집계에서 명령 이력 전용 차트 */
  commandPaneOpen?: boolean;
  /**
   * DELIN — 실제 X스코프 UI로 클릭→드래그→커밋 시연.
   * token 증가 시 재생. CSS 오버레이 아님.
   */
  guidedXScopeGesture?: {
    token: number;
    startRatio: number;
    endRatio: number;
    startIndex?: number;
    endIndex?: number;
    /** plot 상단=0 · 하단=1. yStart/yEnd 미지정 시 온도 레인 직사각형 */
    yRatio?: number;
    yStartRatio?: number;
    yEndRatio?: number;
    durationMs?: number;
  } | null;
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
  onZoomChange,
  commandPaneOpen = false,
  guidedXScopeGesture = null,
  onGuidedXScopeComplete,
  canCommand = false,
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
  const liveRefresh = useFarmLiveRefreshOptional();
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
  /** P1/P2 스코프 스택 — X + 선택 Y밴드 */
  const [xScopeStack, setXScopeStack] = useState<ScopeEntry[]>([]);
  const xScope =
    xScopeStack.length > 0 ? xScopeStack[xScopeStack.length - 1]! : null;
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
  const [seenBrushKey, setSeenBrushKey] = useState(brushSyncKey);
  if (brushControlled && brushSyncKey !== seenBrushKey) {
    setSeenBrushKey(brushSyncKey);
    if (xScopeStack.length > 0) setXScopeStack([]);
  }
  const [chartPlotWidth, setChartPlotWidth] = useState(0);
  const onChartPlotWidth = useCallback((w: number) => {
    setChartPlotWidth((prev) => (Math.abs(prev - w) < 8 ? prev : w));
  }, []);
  const plotWidthPx = chartPlotWidth > 32 ? chartPlotWidth : 800;
  const [draftThresholds, setDraftThresholds] = useState<AlarmThresholds | null>(
    null,
  );
  const [alarmSaving, setAlarmSaving] = useState(false);
  const [alarmSaveError, setAlarmSaveError] = useState<string | null>(null);
  const draftRef = useRef<AlarmThresholds | null>(null);
  const [scopeMotionKey, setScopeMotionKey] = useState(0);
  const [scopeMotionDir, setScopeMotionDir] = useState<"in" | "out">("in");
  const bumpScopeMotion = useCallback((dir: "in" | "out") => {
    setScopeMotionDir(dir);
    setScopeMotionKey((k) => k + 1);
  }, []);
  const initialZoomKeyRef = useRef<string>("");

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

  const scopedReadings = useMemo(
    () =>
      controllers
        .map((c) => c.reading)
        .filter((r): r is BarnReading => r != null),
    [controllers],
  );

  const alarmScopeKey = useMemo(
    () => alarmScopeKeyFromFarmChartScope(scopedReadings, chartScope),
    [scopedReadings, chartScope],
  );

  const [alarmScopeEpoch, setAlarmScopeEpoch] = useState(alarmScopeKey ?? "");
  if ((alarmScopeKey ?? "") !== alarmScopeEpoch) {
    setAlarmScopeEpoch(alarmScopeKey ?? "");
    setDraftThresholds(null);
    setAlarmSaveError(null);
  }

  const baseThresholds = useMemo(() => {
    const settings = alarmSettings ?? DEFAULT_ALARM_SETTINGS;
    return resolveThresholdsForChartScope(
      settings,
      alarmScopeKey,
      scopedReadings,
    );
  }, [alarmSettings, alarmScopeKey, scopedReadings]);

  const mappingThresholds = draftThresholds ?? baseThresholds;
  const recommendBand = useMemo(() => {
    const code =
      chartScope.level === "farm" ? null : chartScope.stallTyCode;
    return pigEnvBandForStallTy(code);
  }, [chartScope]);
  const plotThresholds: AlarmThresholds = useMemo(
    () =>
      recommendBand
        ? {
            tempLow: recommendBand.tempMinC,
            tempHigh: recommendBand.tempMaxC,
            humidityLow: recommendBand.humidityMinPct,
            humidityHigh: recommendBand.humidityMaxPct,
          }
        : mappingThresholds,
    [recommendBand, mappingThresholds],
  );

  const layerVisibility = useMemo(
    () => splitYVisibilityFromLayers(layers),
    [layers],
  );
  const metricAvailable = useMemo(() => {
    const periodId = overview
      ? "24h"
      : pickTrendCanvasPeriod(
          controllerTrendByPeriod,
          period,
        );
    const periodData = controllerTrendByPeriod?.[periodId];
    if (!periodData) {
      return { temp: false, hum: false, motors: false };
    }
    const list = controllers
      .map((c) => {
        const r = c.reading;
        if (!r) return null;
        return findControllerTrendSeries(
          controllerTrendByPeriod,
          periodId,
          r.stallTyCode,
          r.stallNo,
          r.controllerKey,
        );
      })
      .filter((s): s is NonNullable<typeof s> => s != null);
    if (!list.length) {
      return { temp: false, hum: false, motors: false };
    }
    return metricAvailabilityFromSeriesList(list);
  }, [controllers, controllerTrendByPeriod, period, overview]);
  useEffect(() => {
    onMetricAvailable?.(metricAvailable);
  }, [metricAvailable, onMetricAvailable]);
  const dataVisibility = useMemo(
    () => andSplitYVisibility(layerVisibility, metricAvailable),
    [layerVisibility, metricAvailable],
  );
  /** 켜진 플롯 밴드가 2개 이상이면 오버레이(분할 보기 없음) */
  const overlayAvailable = countSplitYBands(dataVisibility) >= 2;
  const overlayActive = overlayAvailable;
  const overlayAlign = overlayActive ? OVERLAY_ALIGN_ANCHOR : undefined;
  const scopeVisibility = useMemo(() => {
    const bandVis = visibilityForYBands(xScope?.yBands ?? null);
    if (!bandVis) return dataVisibility;
    return {
      showTemp: dataVisibility.showTemp && bandVis.showTemp,
      showHum: dataVisibility.showHum && bandVis.showHum,
      showMotors: dataVisibility.showMotors && bandVis.showMotors,
      showCommand: dataVisibility.showCommand && bandVis.showCommand,
    };
  }, [dataVisibility, xScope]);
  const targetPlot = useMemo(
    () => resolveUnifiedPlotLayout(scopeVisibility, plotThresholds, overlayActive),
    [scopeVisibility, plotThresholds, overlayActive],
  );
  const chartLeftUnit = targetPlot.leftUnit;
  /** 브러시 캔버스 여부 — 높이 풀·레이아웃 보간을 같은 훅에서 맞추기 위해 조기 계산 */
  /** 펼친 카드: 30일 트랙 + 24시간 창. 휠이 왼쪽(과거)을 바로 연다. 일괄 칸은 24시간만. */
  const useBrushCanvas =
    !overview &&
    isContextControllerTrend30d(controllerTrendByPeriod?.["30d"]) &&
    controllerTrendPeriodHasSeries(controllerTrendByPeriod?.["30d"]);
  const baseChartPlotH =
    chartHeight ?? (isMobileStack ? chartUiPx(320) : chartUiPx(340));
  const targetBandHeights = useMemo(
    () =>
      allocateUnifiedChartBandHeights({
        totalContentPx: baseChartPlotH,
        visibility: {
          showTemp: scopeVisibility.showTemp,
          showHum: scopeVisibility.showHum,
          showMotors: scopeVisibility.showMotors,
          showCommand: false,
        },
        minCommandPx: chartUiPx(90),
        minPlotPx: chartUiPx(48),
        commandOnlyPlotGutterPx: chartUiPx(72),
      }),
    [
      baseChartPlotH,
      scopeVisibility.showTemp,
      scopeVisibility.showHum,
      scopeVisibility.showMotors,
    ],
  );
  const { layout, heights: bandHeights } = useUnifiedChartBandTransition(
    targetPlot.layout,
    targetBandHeights,
  );
  const chartPlotHeight = bandHeights.plotPx;
  /** 드래그 hit/미리보기 — 레이어 기준(스코프 전) */
  const layerLayout = useMemo(
    () =>
      resolveUnifiedPlotLayout(layerVisibility, plotThresholds, overlayActive)
        .layout,
    [layerVisibility, plotThresholds, overlayActive],
  );

  /** 브러시 — 30일 1시간 양호도 */
  const brushOverview = useMemo(
    () =>
      hidePeriodBrush
        ? []
        : buildTrendBrushOverview(
            controllers,
            controllerTrendByPeriod,
            alarmSettings,
          ),
    [hidePeriodBrush, controllers, controllerTrendByPeriod, alarmSettings],
  );

  const splitBandGuides = useMemo(() => {
    const guides: number[] = [];
    const motorH = layout.motorHi - layout.motorLo;
    const humH = layout.humHi - layout.humLo;
    const tempH = layout.tempHi - layout.tempLo;
    /** 모터↔환경 구분만. 온도·습도 사이 점선은 표시하지 않음 */
    if (motorH > 0.5 && (humH > 0.5 || tempH > 0.5)) {
      guides.push(layout.motorHi);
    }
    return guides;
  }, [layout]);

  const canvasPeriod: TrendPeriodId = overview
    ? "24h"
    : pickTrendCanvasPeriod(controllerTrendByPeriod, period);
  const context30d = useBrushCanvas;
  const displayPeriod = overview
    ? "24h"
    : useBrushCanvas
      ? lookbackPeriod
      : canvasPeriod;

  /** 펼친 기본·휠 = 30일 1시간 슬라이스. 미니 = 24시간 2시간 평균. 15분은 드래그 줌만. */
  const windowBundle = useMemo(() => {
    const collectRange = (periodId: TrendPeriodId, from: number, to: number) => {
      const periodData = controllerTrendByPeriod?.[periodId] ?? null;
      const categoriesRaw = periodData?.categories ?? [];
      if (!categoriesRaw.length) return null;
      const windowCategories = categoriesRaw.slice(from, to);
      if (windowCategories.length < 2) return null;

      const seriesList = controllers
        .map((c) => {
          const r = c.reading;
          if (!r) return null;
          const found = findControllerTrendSeries(
            controllerTrendByPeriod,
            periodId,
            r.stallTyCode,
            r.stallNo,
            r.controllerKey,
          );
          if (!found) return null;
          // 표시 정본 = 채널 슬롯(A/B/C) — series.fanA/B/C 를 그대로 사용.
          return {
            ...sliceControllerSeries(found, from, to),
            zoneLabel: formatControllerHeaderPrimary(r),
            equipmentLabel: formatControllerHeaderSecondary(r),
            stallTyCode: r.stallTyCode
              ? normalizeStallTyCode(r.stallTyCode)
              : undefined,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s != null);

      if (!seriesList.length) return null;
      const bucketAts = (periodData?.bucketAts ?? []).slice(from, to);
      return {
        categories: windowCategories,
        bucketAts,
        seriesList: applyCoverageToWindow(
          seriesList,
          bucketAts,
          uplinkCoverage,
        ),
      };
    };

    const collect = (periodId: TrendPeriodId, brush: boolean) => {
      const periodData = controllerTrendByPeriod?.[periodId] ?? null;
      const categoriesRaw = periodData?.categories ?? [];
      if (!categoriesRaw.length) return null;
      if (!brush) return collectRange(periodId, 0, categoriesRaw.length);
      const range = brushSliceRange(categoriesRaw.length, brushWindow);
      return collectRange(periodId, range.from, range.to);
    };

    const finish = (
      bundle: {
        categories: string[];
        bucketAts: string[];
        seriesList: ReturnType<typeof applyCoverageToWindow>;
      } | null,
    ) => {
      if (!bundle) return null;
      if (overview) {
        return binControllerWindowToStride(bundle, TREND_MINI_STRIDE_MS);
      }
      return bundle;
    };

    if (overview) {
      const h24 = collect("24h", false);
      if (h24) return finish(h24);
      const d30n = controllerTrendByPeriod?.["30d"]?.categories.length ?? 0;
      const hours24 = Math.round(
        TREND_PERIODS["24h"].durationMs / TREND_PERIODS["30d"].strideMs,
      );
      if (d30n >= hours24) {
        const tail = collectRange("30d", d30n - hours24, d30n);
        if (tail) return finish(tail);
      }
      return null;
    }

    if (useBrushCanvas && context30d) {
      const hourly = collect("30d", true);
      if (hourly && controllerWindowHasValues(hourly)) return hourly;
    }
    const h24 = collect("24h", false);
    if (h24 && controllerWindowHasValues(h24)) {
      return binControllerWindowToStride(
        h24,
        TREND_PERIODS["30d"].strideMs,
      );
    }
    if (useBrushCanvas && context30d) {
      const hourly = collect("30d", true);
      if (hourly) return hourly;
    }

    const primary = collect(canvasPeriod, false);
    if (primary) return finish(primary);
    if (canvasPeriod !== "24h") return finish(collect("24h", false));
    return null;
  }, [
    controllers,
    controllerTrendByPeriod,
    canvasPeriod,
    useBrushCanvas,
    context30d,
    brushWindow,
    uplinkCoverage,
    overview,
  ]);

  /** M1 — 다운샘플+집계는 layout 무관 1회, 보간은 Y매핑만 */
  const downsampledWindow = useMemo(() => {
    if (!windowBundle) return null;
    return downsampleSeriesForChart(
      windowBundle.seriesList,
      windowBundle.categories,
      plotWidthPx,
    );
  }, [windowBundle, plotWidthPx]);

  const trendRaw = useMemo(() => {
    if (!downsampledWindow) return null;
    return aggregateUnifiedBarnTrendRaw(
      downsampledWindow.seriesList,
      downsampledWindow.categories,
      plotThresholds,
      { includeThermo: chartScope.level === "controller" },
    );
  }, [downsampledWindow, plotThresholds, chartScope.level]);

  const built = useMemo(() => {
    if (!trendRaw) return null;
    return mapUnifiedBarnTrendRawToSplitY(
      trendRaw,
      layout,
      undefined,
      overlayAlign,
    );
  }, [trendRaw, layout, overlayAlign]);

  const picked = useMemo(() => {
    if (!built) return null;
    const pickLayers = maskLayersForYBands(layers, xScope?.yBands ?? null);
    const raw = pickUnifiedTrendLayers(built, pickLayers);
    const overlayPack =
      overlayControllers && downsampledWindow
        ? overlayControllerMetricSeries({
            seriesList: downsampledWindow.seriesList,
            categories: downsampledWindow.categories,
            thresholds: plotThresholds,
            layout,
            overlayAlign,
            layers: pickLayers,
          })
        : { series: [], tempOverflowDomain: null };
    /** 스코프 인덱스 안정 — 자동 trim과 X/Y 줌 충돌 방지 */
    return {
      categories: built.categories,
      series: replaceAverageMetricSeries(raw.series, overlayPack.series),
      envelopes: raw.envelopes,
      histograms: raw.histograms,
      trimmed: false as const,
      tempDomain: built.tempDomain,
      tempOverflowDomain: overlayPack.series.length
        ? overlayPack.tempOverflowDomain
        : built.tempOverflowDomain,
    };
  }, [
    built,
    layers,
    xScope?.yBands,
    overlayControllers,
    downsampledWindow,
    plotThresholds,
    layout,
    overlayAlign,
  ]);

  /** 농장 기간 변경 시 브러시 창·스코프 시드 (render-time sync — effect setState 회피) */
  const [scopePeriod, setScopePeriod] = useState(period);
  if (period !== scopePeriod) {
    setScopePeriod(period);
    setXScopeStack([]);
    if (!brushControlled) applyBrushWindow(BRUSH_PERIOD_WINDOW["24h"]);
  }

  /** 데이터 길이/인덱스 불일치 시 스택 비우기 */
  if (xScope && picked && xScopeStack.length > 0) {
    const n = picked.categories.length;
    if (
      n < 2 ||
      xScope.start < 0 ||
      xScope.end >= n ||
      xScope.start > xScope.end ||
      xScope.end - xScope.start < 2
    ) {
      setXScopeStack([]);
    }
  }

  const xScopeRangeMs = useMemo(() => {
    if (overview || !xScope || !picked || !windowBundle) return null;
    const slice = mapIndexWindowToSlice(
      picked.categories.length,
      xScope.start,
      xScope.end,
      windowBundle.bucketAts.length,
    );
    const range = bucketAtsRangeMs(
      windowBundle.bucketAts,
      slice.from,
      slice.to,
    );
    if (!range) return null;
    const maxMs = TREND_ZOOM_15M_MAX_DAYS * TREND_PERIODS["24h"].durationMs;
    if (range.toMs - range.fromMs > maxMs + 1) return null;
    return range;
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

  /** P2 — URL/DELIN 줌 힌트 1회 적용 (온도 레인 포커스 등) */
  useEffect(() => {
    if (!initialZoom) {
      initialZoomKeyRef.current = "";
      return;
    }
    if (!picked) return;
    const n = picked.categories.length;
    if (n < 3) return;
    const key = [
      period,
      initialZoom.yBands.join("+"),
      initialZoom.startRatio.toFixed(3),
      initialZoom.endRatio.toFixed(3),
      String(n),
    ].join("|");
    if (initialZoomKeyRef.current === key) return;
    let start: number;
    let end: number;
    if (
      initialZoom.startIndex != null &&
      initialZoom.endIndex != null &&
      Number.isFinite(initialZoom.startIndex) &&
      Number.isFinite(initialZoom.endIndex)
    ) {
      start = Math.max(
        0,
        Math.min(
          n - 1,
          Math.round(Math.min(initialZoom.startIndex, initialZoom.endIndex)),
        ),
      );
      end = Math.max(
        0,
        Math.min(
          n - 1,
          Math.round(Math.max(initialZoom.startIndex, initialZoom.endIndex)),
        ),
      );
    } else {
      const i0 = Math.round(initialZoom.startRatio * (n - 1));
      const i1 = Math.round(initialZoom.endRatio * (n - 1));
      start = Math.max(0, Math.min(i0, i1));
      end = Math.min(n - 1, Math.max(i0, i1));
    }
    if (end - start < 2) {
      if (end < n - 1) end = Math.min(n - 1, start + 2);
      else start = Math.max(0, end - 2);
    }
    if (end - start < 2) return;
    initialZoomKeyRef.current = key;
    const measureBands = initialZoom.yBands.filter((b) => b !== "command");
    setXScopeStack([
      {
        start,
        end,
        yBands: measureBands.length
          ? (measureBands as UnifiedYBandId[])
          : null,
      },
    ]);
    bumpScopeMotion("in");
  }, [initialZoom, picked, period, bumpScopeMotion]);

  const scoped = useMemo(() => {
    if (!picked) return null;
    if (!xScope) {
      return {
        categories: picked.categories,
        series: picked.series,
        envelopes: picked.envelopes,
        histograms: picked.histograms,
        tempDomain: picked.tempDomain,
        tempOverflowDomain: picked.tempOverflowDomain,
        thermoWindows: trendRaw?.thermoWindows ?? null,
      };
    }

    const buildScopedFromSeries = (
      seriesList: TrendControllerSeries[],
      cats: string[],
    ) => {
      if (cats.length < 2 || seriesList.length < 1) return null;
      const down = downsampleSeriesForChart(seriesList, cats, plotWidthPx);
      const raw = aggregateUnifiedBarnTrendRaw(
        down.seriesList,
        down.categories,
        plotThresholds,
        { includeThermo: chartScope.level === "controller" },
      );
      if (!raw) return null;
      const builtScoped = mapUnifiedBarnTrendRawToSplitY(
        raw,
        layout,
        undefined,
        overlayAlign,
      );
      if (!builtScoped) return null;
      const pickLayers = maskLayersForYBands(layers, xScope.yBands);
      const pickedScoped = pickUnifiedTrendLayers(builtScoped, pickLayers);
      return {
        categories: builtScoped.categories,
        series: pickedScoped.series,
        envelopes: pickedScoped.envelopes,
        histograms: pickedScoped.histograms,
        tempDomain: builtScoped.tempDomain,
        tempOverflowDomain: builtScoped.tempOverflowDomain,
        thermoWindows: raw.thermoWindows,
      };
    };

    if (
      xScopeRangeMs &&
      window15m &&
      window15mCovers(window15m, xScopeRangeMs.fromMs, xScopeRangeMs.toMs)
    ) {
      const sliced =
        sliceControllerTrendByTime(
          window15m.data,
          xScopeRangeMs.fromMs,
          xScopeRangeMs.toMs,
        ) ?? window15m.data;
      const fake: Record<TrendPeriodId, TrendControllerPeriodData> = {
        "24h": emptyTrendControllerPeriodData("24h"),
        "7d": emptyTrendControllerPeriodData("7d"),
        "30d": emptyTrendControllerPeriodData("30d"),
        [sliced.period]: sliced,
      };
      const seriesList = controllers
        .map((c) => {
          const r = c.reading;
          if (!r) return null;
          const found = findControllerTrendSeries(
            fake,
            sliced.period,
            r.stallTyCode,
            r.stallNo,
            r.controllerKey,
          );
          if (!found) return null;
          return {
            ...found,
            zoneLabel: formatControllerHeaderPrimary(r),
            equipmentLabel: formatControllerHeaderSecondary(r),
            stallTyCode: r.stallTyCode
              ? normalizeStallTyCode(r.stallTyCode)
              : undefined,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s != null);
      const covered = applyCoverageToWindow(
        seriesList,
        sliced.bucketAts,
        uplinkCoverage,
      );
      const from15m = buildScopedFromSeries(covered, sliced.categories);
      if (from15m) return from15m;
    }

    if (windowBundle) {
      const slice = mapIndexWindowToSlice(
        picked.categories.length,
        xScope.start,
        xScope.end,
        windowBundle.categories.length,
      );
      const cats = windowBundle.categories.slice(slice.from, slice.to);
      if (cats.length >= 2) {
        const series = windowBundle.seriesList.map((s) =>
          sliceControllerSeries(s, slice.from, slice.to),
        );
        const fromHour = buildScopedFromSeries(series, cats);
        if (fromHour) return fromHour;
      }
    }
    return {
      ...sliceUnifiedTrendByIndex(
        picked.categories,
        picked,
        xScope.start,
        xScope.end,
      ),
      tempDomain: picked.tempDomain,
      tempOverflowDomain: picked.tempOverflowDomain,
      thermoWindows: trendRaw?.thermoWindows
        ? sliceFanControlWindows(
            trendRaw.thermoWindows,
            xScope.start,
            xScope.end + 1,
          )
        : null,
    };
  }, [
    picked,
    xScope,
    xScopeRangeMs,
    window15m,
    windowBundle,
    controllers,
    uplinkCoverage,
    plotThresholds,
    layout,
    layers,
    plotWidthPx,
    chartScope.level,
    trendRaw,
    overlayAlign,
  ]);

  const chartCategories = scoped?.categories ?? [];
  const tempMapDomain = scoped?.tempDomain ?? built?.tempDomain;
  const tempMapOverflow =
    scoped?.tempOverflowDomain ?? built?.tempOverflowDomain ?? null;
  const crosshairValues = useCallback(
    (chartY: number) =>
      invertSplitYCrosshairValues(chartY, {
        layout,
        visibility: scopeVisibility,
        overlay: overlayActive,
        overlayAlign,
        tempLow: plotThresholds.tempLow,
        tempHigh: plotThresholds.tempHigh,
        humidityLow: plotThresholds.humidityLow,
        humidityHigh: plotThresholds.humidityHigh,
        tempDomain: overlayAlign ? undefined : tempMapDomain,
        tempOverflowDomain: tempMapOverflow,
      }),
    [
      layout,
      scopeVisibility,
      overlayActive,
      overlayAlign,
      plotThresholds.tempLow,
      plotThresholds.tempHigh,
      plotThresholds.humidityLow,
      plotThresholds.humidityHigh,
      tempMapDomain,
      tempMapOverflow,
    ],
  );
  const tempMapLayout = built?.layout ?? layout;
  const commandOverlayBase =
    commandPaneOpen &&
    chartScope.level === "controller" &&
    useBrushCanvas;
  const showTempCommandOverlay = commandOverlayBase && Boolean(layers.temp);
  const showMotorCommandOverlay =
    commandOverlayBase &&
    !overlayActive &&
    Boolean(layers.motors || layers.motorCh) &&
    layout.motorHi > layout.motorLo;
  const showCommandOverlay = showTempCommandOverlay || showMotorCommandOverlay;
  const commandSettingSegs = useMemo((): TrendCommandSettingSeg[] => {
    const windows = scoped?.thermoWindows;
    if (!showCommandOverlay || !built || !windows) return [];
    const cats = scoped?.categories ?? [];
    const times = parseCategoryTimelineMs(cats);
    if (!times || times.length < 1) return [];
    const endMs = times[times.length - 1]!;
    const segs = buildDecodedSettingHoldSegments(windows, times, endMs);
    const mapLo = plotThresholds.tempLow;
    const mapHi = plotThresholds.tempHigh;
    const out: TrendCommandSettingSeg[] = [];
    for (const seg of segs) {
      if (!commandChannels[seg.channel]) continue;
      const mark = decodedSettingHoldToEventMark(seg);
      if (showTempCommandOverlay) {
        const clipped = clipCommandSettingY(
          mapTempCToSplitY(
            seg.tempLo,
            mapLo,
            mapHi,
            tempMapLayout,
            overlayAlign ? undefined : tempMapDomain,
            overlayAlign,
            tempMapOverflow,
          ),
          mapTempCToSplitY(
            seg.tempHi,
            mapLo,
            mapHi,
            tempMapLayout,
            overlayAlign ? undefined : tempMapDomain,
            overlayAlign,
            tempMapOverflow,
          ),
          layout.tempLo,
          layout.tempHi,
        );
        if (clipped) {
          out.push({
            mark,
            x0Ms: seg.x0Ms,
            x1Ms: seg.x1Ms,
            yLo: clipped.yLo,
            yHi: clipped.yHi,
            band: "temp",
          });
        }
      }
      if (showMotorCommandOverlay) {
        const clipped = clipCommandSettingY(
          mapMotorPctToSplitY(seg.ventLo, tempMapLayout),
          mapMotorPctToSplitY(seg.ventHi, tempMapLayout),
          tempMapLayout.motorLo,
          tempMapLayout.motorHi,
        );
        if (clipped) {
          out.push({
            mark,
            x0Ms: seg.x0Ms,
            x1Ms: seg.x1Ms,
            yLo: clipped.yLo,
            yHi: clipped.yHi,
            band: "motor",
          });
        }
      }
    }
    return out;
  }, [
    showCommandOverlay,
    showTempCommandOverlay,
    showMotorCommandOverlay,
    built,
    scoped?.thermoWindows,
    scoped?.categories,
    plotThresholds.tempLow,
    plotThresholds.tempHigh,
    layout.tempLo,
    layout.tempHi,
    tempMapLayout,
    tempMapDomain,
    tempMapOverflow,
    overlayAlign,
    commandChannels,
  ]);
  const chartPlotHeightForChart = chartPlotHeight;

  const emitZoom = useCallback(
    (entry: ScopeEntry | null) => {
      if (!onZoomChange) return;
      const n = picked?.categories.length ?? 0;
      onZoomChange(chartScopeEntryToZoomHint(entry, n));
    },
    [onZoomChange, picked?.categories.length],
  );

  /** 부모 URL 동기화 — 렌더/updater 중 setState 금지 */
  const deferEmitZoom = useCallback(
    (entry: ScopeEntry | null) => {
      queueMicrotask(() => emitZoom(entry));
    },
    [emitZoom],
  );

  const commitXScope = (
    range: {
      start: number;
      end: number;
      yStartRatio: number;
      yEndRatio: number;
    },
    mode: "push" | "replace" = "push",
    opts?: { timeOnly?: boolean },
  ) => {
    if (!picked) return;
    const domain = built?.leftDomain ?? ([0, 100] as [number, number]);
    const timeOnly = Boolean(opts?.timeOnly);
    const domainY0 = domainYFromViewRatio(range.yStartRatio, domain);
    const domainY1 = domainYFromViewRatio(range.yEndRatio, domain);
    const multiPlot = countSplitYBands(layerVisibility) > 1;
    const detected =
      timeOnly || mode === "replace" || xScope?.yBands != null
        ? null
        : multiPlot
          ? resolveYScopeBands(domainY0, domainY1, layerLayout, layerVisibility)
          : null;
    let yBands: UnifiedYBandId[] | null =
      mode === "replace"
        ? ((overlayActive ? ["overlay"] : ["temp"]) as UnifiedYBandId[])
        : (xScope?.yBands ?? detected);
    if (timeOnly) {
      yBands = xScope?.yBands ?? null;
    } else if (mode !== "replace" && xScope?.yBands == null) {
      if (detected == null && multiPlot) {
        const centerY = (domainY0 + domainY1) / 2;
        const hit = hitSplitYBand(centerY, layerLayout, layerVisibility);
        if (hit === "overlay") {
          if (layerVisibility.showHum) yBands = ["overlay"];
        } else if (hit === "temp") yBands = ["temp"];
        else if (hit === "hum") yBands = ["hum"];
        else if (hit === "motor") yBands = ["motor"];
      }
    }
    if (yBands?.includes("command")) {
      yBands = yBands.filter((b) => b !== "command");
      if (yBands.length === 0) yBands = null;
    }
    /** replace=가이드 시연 — 전체 축 절대 인덱스(중첩 금지) */
    const next: ScopeEntry = {
      start:
        mode === "replace" || xScope == null
          ? range.start
          : xScope.start + range.start,
      end:
        mode === "replace" || xScope == null
          ? range.end
          : xScope.start + range.end,
      yBands,
    };
    if (mode === "replace") {
      setXScopeStack([next]);
    } else {
      setXScopeStack((stack) => [...stack, next]);
    }
    bumpScopeMotion("in");
    deferEmitZoom(next);
  };

  const popXScope = useCallback(() => {
    if (xScopeStack.length === 0) return;
    const nextStack = xScopeStack.slice(0, -1);
    const entry = nextStack.length > 0 ? nextStack[nextStack.length - 1]! : null;
    setXScopeStack(nextStack);
    bumpScopeMotion(xScopeStack.length <= 1 ? "out" : "in");
    deferEmitZoom(entry);
  }, [xScopeStack, bumpScopeMotion, deferEmitZoom]);

  const clearXScope = () => {
    if (xScopeStack.length > 0) bumpScopeMotion("out");
    setXScopeStack([]);
    deferEmitZoom(null);
  };

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
    canCommand && Boolean(alarmScopeKey) && !alarmSaving;

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
    const domain = built.leftDomain;
    const span = domain[1] - domain[0] || 1;
    const bandH = Math.max(0, layerLayout.tempHi - layerLayout.tempLo);
    /** 온도 레인 안 넉넉한 직사각형 — 가장자리 ~10% 여백 */
    const inset = Math.max(bandH * 0.1, 1);
    let domainYTop = layerLayout.tempHi - inset;
    let domainYBot = layerLayout.tempLo + inset;
    if (domainYTop < domainYBot) {
      const mid = (layerLayout.tempLo + layerLayout.tempHi) / 2;
      domainYTop = mid + bandH * 0.35;
      domainYBot = mid - bandH * 0.35;
    }
    const toPlotRatio = (domainY: number) =>
      Math.min(1, Math.max(0, (domain[1] - domainY) / span));

    let y0: number;
    let y1: number;
    if (
      guidedXScopeGesture.yStartRatio != null &&
      guidedXScopeGesture.yEndRatio != null
    ) {
      y0 = Math.min(
        guidedXScopeGesture.yStartRatio,
        guidedXScopeGesture.yEndRatio,
      );
      y1 = Math.max(
        guidedXScopeGesture.yStartRatio,
        guidedXScopeGesture.yEndRatio,
      );
    } else if (guidedXScopeGesture.yRatio != null) {
      const m = guidedXScopeGesture.yRatio;
      y0 = Math.max(0, m - 0.08);
      y1 = Math.min(1, m + 0.08);
    } else {
      y0 = toPlotRatio(domainYTop);
      y1 = toPlotRatio(domainYBot);
    }
    if (y1 - y0 < 0.05) {
      const mid = (y0 + y1) / 2;
      y0 = Math.max(0, mid - 0.04);
      y1 = Math.min(1, mid + 0.04);
    }

    const base: GuidedScopeRect = {
      startRatio: guidedXScopeGesture.startRatio,
      endRatio: guidedXScopeGesture.endRatio,
      yStartRatio: y0,
      yEndRatio: y1,
      durationMs: guidedXScopeGesture.durationMs,
    };

    return {
      token: guidedXScopeGesture.token,
      startRatio: guidedXScopeGesture.startRatio,
      endRatio: guidedXScopeGesture.endRatio,
      startIndex: guidedXScopeGesture.startIndex,
      endIndex: guidedXScopeGesture.endIndex,
      durationMs: guidedXScopeGesture.durationMs,
      base,
    };
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

  const resolvedGuidedXScope = useMemo(() => {
    if (
      !guidedScopeBase ||
      !guidedJitterCache ||
      guidedJitterCache.token !== guidedScopeBase.token
    ) {
      return null;
    }
    const human = guidedJitterCache.rect;
    /** X는 초과 인덱스 기준 비율 고정(좌표 드리프트 방지). Y만 humanize */
    return {
      token: guidedScopeBase.token,
      startRatio: guidedScopeBase.startRatio,
      endRatio: guidedScopeBase.endRatio,
      startIndex: guidedScopeBase.startIndex,
      endIndex: guidedScopeBase.endIndex,
      yStartRatio: human.yStartRatio,
      yEndRatio: human.yEndRatio,
      durationMs: human.durationMs ?? guidedScopeBase.durationMs,
    };
  }, [guidedScopeBase, guidedJitterCache]);

  /**
   * 스택이 비워진 뒤에만 시연 — 기존 X스코프 위에서 비율을 쓰면
   * 잘린 카테고리 기준으로 엉뚱한 구간이 커밋됨.
   */
  const activeGuidedXScope =
    resolvedGuidedXScope &&
    guideReadyToken === resolvedGuidedXScope.token &&
    xScopeStack.length === 0
      ? resolvedGuidedXScope
      : null;

  const persistAlarmDraft = (nextDraft: AlarmThresholds) => {
    if (!alarmScopeKey || !canCommand) return;
    const err = validateAlarmThresholds(nextDraft);
    if (err) {
      setAlarmSaveError(err);
      setDraftThresholds(null);
      draftRef.current = null;
      return;
    }
    const previous = alarmSettings ?? DEFAULT_ALARM_SETTINGS;
    /** farm/sp 저장 시 하위·legacy 유형 오버라이드 제거 — 스코프 상속 */
    const cascadeStallTy =
      !alarmScopeKey.includes("|stall:") &&
      !alarmScopeKey.includes("|ctrl:");
    const { settings: nextSettings } = applyScopeAlarmThresholdsWithCascade(
      previous,
      alarmScopeKey,
      nextDraft,
      cascadeStallTy
        ? {
            stallTyCodesToClear: scopedReadings
              .map((r) => normalizeStallTyCode(r.stallTyCode))
              .filter((sp) => sp !== "UNK"),
          }
        : undefined,
    );
    setAlarmSaving(true);
    setAlarmSaveError(null);
    const formData = new FormData();
    formData.set("settings_json", JSON.stringify(nextSettings));
    void (async () => {
      try {
        const result = await saveAlarmSettingsInlineAction(formData);
        if (!result.ok) {
          setAlarmSaveError(result.error ?? "임계 가이드 저장에 실패했습니다.");
          setDraftThresholds(null);
          draftRef.current = null;
          return;
        }
        liveRefresh?.patchAlarmSettings(nextSettings);
        setDraftThresholds(null);
        draftRef.current = null;
      } finally {
        setAlarmSaving(false);
      }
    })();
  };

  const onScaleEdgeNumericCommit = (event: ScaleEdgeNumericCommitEvent) => {
    if (!canCommand || !alarmScopeKey || alarmSaving) return;
    const next = applyAlarmScaleEdgeCommit(
      draftRef.current ?? baseThresholds,
      event.id,
      event.value,
    );
    if (!next) return;
    const unchanged =
      next.tempHigh === baseThresholds.tempHigh &&
      next.tempLow === baseThresholds.tempLow &&
      next.humidityHigh === baseThresholds.humidityHigh &&
      next.humidityLow === baseThresholds.humidityLow;
    if (unchanged) return;
    draftRef.current = next;
    setDraftThresholds(next);
    setAlarmSaveError(null);
    persistAlarmDraft(next);
  };

  /**
   * 우측 Y — 축사유형 권장 상·하한(숫자 저장 없음).
   * 권장 띠가 있으면 좌측은 현장 알람 기준, 구간은 기준±편차다.
   */
  const { scaleEdgeLabels, alarmRangeBands } = useMemo((): {
    scaleEdgeLabels: TrendScaleEdgeLabel[];
    alarmRangeBands: TrendRangeBand[];
  } => {
    if (!built) return { scaleEdgeLabels: [], alarmRangeBands: [] };
    const out: TrendScaleEdgeLabel[] = [];
    const rangeBands: TrendRangeBand[] = [];
    const mapLo = plotThresholds.tempLow;
    const mapHi = plotThresholds.tempHigh;
    const mapHumLo = plotThresholds.humidityLow;
    const mapHumHi = plotThresholds.humidityHigh;
    const guideEditEnabled = alarmEditEnabled && !recommendBand;
    const farmAlarmEditEnabled =
      alarmEditEnabled && (Boolean(recommendBand) || Boolean(overlayAlign));
    const tempHiTitle = recommendBand ? "권장 온도 상한" : "온도 상한";
    const tempLoTitle = recommendBand ? "권장 온도 하한" : "온도 하한";
    const humHiTitle = recommendBand ? "권장 습도 상한" : "습도 상한";
    const humLoTitle = recommendBand ? "권장 습도 하한" : "습도 하한";
    const push = (
      id: string,
      chartY: number | null,
      text: string,
      color: string,
      mark: "overline" | "underline" | undefined,
      title: string,
      showLine: boolean,
      draggable = false,
      editValue?: number,
      opts?: {
        side?: "left" | "right" | "center" | "plotStart";
        leadingText?: string;
        labelLane?: "outer" | "inner";
        lineStrokeWidth?: number;
        lineDasharray?: string;
        lineHighlight?: boolean;
        showApplyActions?: boolean;
        hideLabel?: boolean;
        labelIcon?: "temp-alarm" | "hum-alarm";
      },
    ) => {
      if (chartY == null || !Number.isFinite(chartY)) return;
      out.push({
        id,
        value: chartY,
        axis: "left",
        side: opts?.side ?? "right",
        text,
        leadingText: opts?.leadingText,
        color,
        mark,
        title,
        showLine,
        draggable,
        editValue,
        labelLane: opts?.labelLane,
        lineStrokeWidth: opts?.lineStrokeWidth,
        lineDasharray: opts?.lineDasharray,
        lineHighlight: opts?.lineHighlight,
        showApplyActions: opts?.showApplyActions,
        hideLabel: opts?.hideLabel,
        labelIcon: opts?.labelIcon,
      });
    };

    if (scopeVisibility.showTemp && layers.temp && built.available.temp) {
      push(
        "temp-hi",
        mapTempCToSplitY(
          plotThresholds.tempHigh,
          mapLo,
          mapHi,
          tempMapLayout,
          overlayAlign ? undefined : tempMapDomain,
          overlayAlign,
          tempMapOverflow,
        ),
        formatTrendBandEdge(plotThresholds.tempHigh, "℃"),
        TREND_CHART_COLORS.temp,
        "overline",
        tempHiTitle,
        true,
        guideEditEnabled,
        plotThresholds.tempHigh,
        {
          lineStrokeWidth: 1.45,
          lineDasharray: "2 2",
          lineHighlight: true,
        },
      );
      push(
        "temp-lo",
        mapTempCToSplitY(
          plotThresholds.tempLow,
          mapLo,
          mapHi,
          tempMapLayout,
          overlayAlign ? undefined : tempMapDomain,
          overlayAlign,
          tempMapOverflow,
        ),
        formatTrendBandEdge(plotThresholds.tempLow, "℃"),
        TREND_CHART_COLORS.temp,
        "underline",
        tempLoTitle,
        true,
        guideEditEnabled,
        plotThresholds.tempLow,
        {
          lineStrokeWidth: 1.45,
          lineDasharray: "2 2",
          lineHighlight: true,
        },
      );
      const breakZones = tempBrokenAxisPlotZones(tempMapLayout);
      if (breakZones) {
        push(
          "temp-break",
          breakZones.breakY,
          "",
          "var(--border)",
          undefined,
          "권장 구간 위",
          true,
          false,
          undefined,
          {
            hideLabel: true,
            lineStrokeWidth: 1,
            lineDasharray: "2 4",
          },
        );
      }
    }
    if (
      scopeVisibility.showHum &&
      (layers.hum || layers.humDev || layers.humBand || layers.humEma)
    ) {
      push(
        "hum-hi",
        mapHumPctToSplitY(
          plotThresholds.humidityHigh,
          mapHumLo,
          mapHumHi,
          layout,
          overlayAlign
            ? undefined
            : chartLeftUnit === "%"
              ? undefined
              : alarmEdgeDomain(mapHumLo, mapHumHi, SPLIT_Y_HUM_EDGE_PAD_PCT),
          overlayAlign,
        ),
        formatTrendBandEdge(plotThresholds.humidityHigh, "%"),
        TREND_CHART_COLORS.humidity,
        "overline",
        humHiTitle,
        true,
        guideEditEnabled,
        plotThresholds.humidityHigh,
        {
          lineStrokeWidth: 1.65,
          lineDasharray: "2 2",
          lineHighlight: true,
        },
      );
      push(
        "hum-lo",
        mapHumPctToSplitY(
          plotThresholds.humidityLow,
          mapHumLo,
          mapHumHi,
          layout,
          overlayAlign
            ? undefined
            : chartLeftUnit === "%"
              ? undefined
              : alarmEdgeDomain(mapHumLo, mapHumHi, SPLIT_Y_HUM_EDGE_PAD_PCT),
          overlayAlign,
        ),
        formatTrendBandEdge(plotThresholds.humidityLow, "%"),
        TREND_CHART_COLORS.humidity,
        "underline",
        humLoTitle,
        true,
        guideEditEnabled,
        plotThresholds.humidityLow,
        {
          lineStrokeWidth: 1.65,
          lineDasharray: "2 2",
          lineHighlight: true,
        },
      );
    }
    if (recommendBand) {
      const tempFarmLayout = overlayAlign ? layout : tempMapLayout;
      const tempFarmDomain = overlayAlign ? undefined : tempMapDomain;
      if (
        alarmRangeOn.temp &&
        scopeVisibility.showTemp &&
        layers.temp &&
        built.available.temp
      ) {
        const tempFarmHiY = mapTempCToSplitY(
          mappingThresholds.tempHigh,
          mapLo,
          mapHi,
          tempFarmLayout,
          tempFarmDomain,
          overlayAlign,
          tempMapOverflow,
        );
        const tempFarmLoY = mapTempCToSplitY(
          mappingThresholds.tempLow,
          mapLo,
          mapHi,
          tempFarmLayout,
          tempFarmDomain,
          overlayAlign,
          tempMapOverflow,
        );
        const tempFarmMid = farmAlarmMidValue(
          mappingThresholds.tempLow,
          mappingThresholds.tempHigh,
        );
        if (tempFarmMid != null) {
          push(
            "temp-farm-mid",
            mapTempCToSplitY(
              tempFarmMid,
              mapLo,
              mapHi,
              tempFarmLayout,
              tempFarmDomain,
              overlayAlign,
              tempMapOverflow,
            ),
            formatTrendBandEdge(tempFarmMid, "℃"),
            TREND_CHART_COLORS.temp,
            undefined,
            "온도 알람 기준",
            false,
            farmAlarmEditEnabled,
            tempFarmMid,
            { side: "left", labelIcon: "temp-alarm" },
          );
        }
        if (
          tempFarmHiY != null &&
          Number.isFinite(tempFarmHiY) &&
          tempFarmLoY != null &&
          Number.isFinite(tempFarmLoY)
        ) {
          rangeBands.push({
            id: "temp-farm-range",
            lo: tempFarmLoY,
            hi: tempFarmHiY,
            axis: "left",
            color: overlayAlign
              ? TREND_CHART_COLORS.temp
              : FARM_ALARM_RANGE_FILL,
            fillOpacity: overlayAlign
              ? FARM_ALARM_RANGE_TEMP_OVERLAY_OPACITY
              : FARM_ALARM_RANGE_FILL_OPACITY,
          });
        }
      }
      if (
        alarmRangeOn.hum &&
        scopeVisibility.showHum &&
        (layers.hum || layers.humDev || layers.humBand || layers.humEma)
      ) {
        const humDomain = overlayAlign
          ? undefined
          : alarmEdgeDomain(
              mapHumLo,
              mapHumHi,
              SPLIT_Y_HUM_EDGE_PAD_PCT,
            );
        const humFarmHiY = mapHumPctToSplitY(
          mappingThresholds.humidityHigh,
          mapHumLo,
          mapHumHi,
          layout,
          humDomain,
          overlayAlign,
        );
        const humFarmLoY = mapHumPctToSplitY(
          mappingThresholds.humidityLow,
          mapHumLo,
          mapHumHi,
          layout,
          humDomain,
          overlayAlign,
        );
        const humFarmMid = farmAlarmMidValue(
          mappingThresholds.humidityLow,
          mappingThresholds.humidityHigh,
        );
        if (humFarmMid != null) {
          push(
            "hum-farm-mid",
            mapHumPctToSplitY(
              humFarmMid,
              mapHumLo,
              mapHumHi,
              layout,
              humDomain,
              overlayAlign,
            ),
            formatTrendBandEdge(humFarmMid, "%"),
            TREND_CHART_COLORS.humidity,
            undefined,
            "습도 알람 기준",
            false,
            farmAlarmEditEnabled,
            humFarmMid,
            { side: "left", labelIcon: "hum-alarm" },
          );
        }
        if (
          humFarmHiY != null &&
          Number.isFinite(humFarmHiY) &&
          humFarmLoY != null &&
          Number.isFinite(humFarmLoY)
        ) {
          rangeBands.push({
            id: "hum-farm-range",
            lo: humFarmLoY,
            hi: humFarmHiY,
            axis: "left",
            color: overlayAlign
              ? TREND_CHART_COLORS.humidity
              : FARM_ALARM_RANGE_FILL,
            fillOpacity: overlayAlign
              ? FARM_ALARM_RANGE_HUM_OVERLAY_OPACITY
              : FARM_ALARM_RANGE_FILL_OPACITY,
          });
        }
      }
    }
    if (!chartLeftUnit) {
      const ticks = buildSplitYBandScaleTicks({
        layout,
        showTemp: Boolean(
          scopeVisibility.showTemp && layers.temp && built.available.temp,
        ),
        showHum: Boolean(
          scopeVisibility.showHum &&
            (layers.hum || layers.humDev || layers.humBand || layers.humEma),
        ),
        showMotors: Boolean(
          scopeVisibility.showMotors && (layers.motors || layers.motorCh),
        ),
        overlay: overlayActive,
        tempLow: mapLo,
        tempHigh: mapHi,
        humidityLow: mapHumLo,
        humidityHigh: mapHumHi,
      });
      for (const tick of ticks) {
        if (
          recommendBand &&
          (tick.id === "band-tick-temp-mid" || tick.id === "band-tick-hum-mid")
        ) {
          continue;
        }
        const tickIsAlarmMid =
          tick.id === "band-tick-temp-mid" || tick.id === "band-tick-hum-mid";
        if (
          tickIsAlarmMid &&
          ((tick.unit === "℃" && !alarmRangeOn.temp) ||
            (tick.unit === "%" && !alarmRangeOn.hum))
        ) {
          continue;
        }
        push(
          tick.id,
          tick.chartY,
          formatTrendBandEdge(tick.value, tick.unit),
          tickIsAlarmMid
            ? tick.unit === "℃"
              ? TREND_CHART_COLORS.temp
              : TREND_CHART_COLORS.humidity
            : "var(--muted-foreground)",
          undefined,
          tickIsAlarmMid
            ? tick.unit === "℃"
              ? "온도 알람 기준"
              : "습도 알람 기준"
            : "눈금",
          !tickIsAlarmMid,
          tickIsAlarmMid && alarmEditEnabled,
          tickIsAlarmMid ? tick.value : undefined,
          {
            side: "left",
            lineStrokeWidth: tickIsAlarmMid ? 0 : 0.35,
            lineDasharray: "solid",
            lineHighlight: false,
            labelIcon: tickIsAlarmMid
              ? tick.unit === "℃"
                ? "temp-alarm"
                : "hum-alarm"
              : undefined,
          },
        );
      }
    }
    return { scaleEdgeLabels: out, alarmRangeBands: rangeBands };
  }, [
    built,
    layers,
    plotThresholds,
    mappingThresholds,
    recommendBand,
    layout,
    scopeVisibility,
    alarmEditEnabled,
    tempMapLayout,
    tempMapDomain,
    tempMapOverflow,
    chartLeftUnit,
    overlayActive,
    overlayAlign,
    alarmRangeOn,
  ]);

  const cycleGroupLayers = (group: "temp" | "hum" | "motor") => {
    if (!built || sharedLayers) return;
    setOwnedLayers((prev) => {
      const mode = detectLayerGroupMode(prev, built.available, group);
      const nextMode = nextLayerGroupMode(mode);
      return applyLayerGroupMode(prev, group, nextMode, built.available);
    });
  };

  useEffect(() => {
    if (layersToolbarActive || layersToolbarPhase !== "exit") return;
    const t = window.setTimeout(() => {
      setLayersToolbarMounted(false);
    }, motionDuration.exit);
    return () => window.clearTimeout(t);
  }, [layersToolbarActive, layersToolbarPhase, layersAnimKey]);

  const layerToolbar =
    !sharedLayers && !overview && built != null && layersToolbarMounted ? (
      <div
        key={layersAnimKey}
        className={cn(
          "farm-chart-toolbar-fit flex w-full min-w-0 shrink-0 items-center overflow-visible",
          layersToolbarPhase === "enter"
            ? motionClass.farmChartLayersEnter
            : motionClass.farmChartLayersExit,
        )}
        data-farm-chart-layers-shell=""
        data-farm-chart-layers-placement="inline"
        aria-hidden={layersToolbarPhase === "exit"}
      >
        <UnifiedTrendLayerToolbar
          layers={layers}
          available={built.available}
          metricsPending={Boolean(
            trendLoading || (!controllerTrendByPeriod && !trendError),
          )}
          onCycleGroup={cycleGroupLayers}
          placement="inline"
          tempAlarmOn={alarmRangeOn.temp}
          humAlarmOn={alarmRangeOn.hum}
          tempAlarmAvailable={Boolean(
            scopeVisibility.showTemp && layers.temp && built.available.temp,
          )}
          humAlarmAvailable={Boolean(
            scopeVisibility.showHum &&
              built.available.hum &&
              (layers.hum || layers.humDev || layers.humBand || layers.humEma),
          )}
          onToggleTempAlarm={() =>
            setOwnedAlarmRangeOn((prev) => ({ ...prev, temp: !prev.temp }))
          }
          onToggleHumAlarm={() =>
            setOwnedAlarmRangeOn((prev) => ({ ...prev, hum: !prev.hum }))
          }
        />
      </div>
    ) : null;

  const renderHeaderTrailing = (opts?: { spacer?: boolean }) => (
    <div
      className={cn(
        "flex shrink-0 items-center justify-end gap-1",
        opts?.spacer && "invisible pointer-events-none",
      )}
      aria-hidden={opts?.spacer || undefined}
    >
      {isMobileStack && mobileScopeHandle ? (
        <button
          type="button"
          tabIndex={opts?.spacer ? -1 : undefined}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-md border px-2.5 py-1.5",
            farmChartUi.fsBody,
            dashboardControlFill.idle,
            motionClass.microHover,
          )}
          data-tour-id={opts?.spacer ? undefined : "farm-chart-scope-handle"}
          aria-label={`집계 범위 열기 · ${label}`}
          title={label}
          aria-expanded={mobileScopeHandle.open}
          onClick={opts?.spacer ? undefined : mobileScopeHandle.onOpen}
        >
          <PanelRight className="size-[1em] shrink-0" aria-hidden />
        </button>
      ) : null}
      {opts?.spacer ? (
        headerActions ? <div className="size-8" /> : null
      ) : (
        headerActions
      )}
    </div>
  );
  const hasHeaderTrailing = Boolean(
    headerActions || (isMobileStack && mobileScopeHandle),
  );

  const focusBandActive = isSingleYBandFocus(xScope?.yBands)
    ? xScope.yBands[0]
    : null;
  const scopeYLabel = unifiedYBandsScopeLabel(xScope?.yBands ?? null);

  const focusBandTint = (band: UnifiedYBandId | null | undefined) => {
    if (band === "temp" || band === "overlay") return dashboardUi.channelTintTemp;
    if (band === "hum") return dashboardUi.channelTintHum;
    if (band === "motor") return dashboardUi.channelTintMotor;
    if (band === "command") return dashboardUi.channelTintCommand;
    return dashboardUi.channelTintInfo;
  };

  return (
    <div
      className={cn(
        "select-none",
        farmChartUi.root,
        (isMobileStack || overview) && farmChartUi.yGutterCompact,
        plotFill
          ? "relative flex min-h-0 flex-1 flex-col gap-2"
          : overview
            ? "mt-0 flex min-h-0 flex-1 flex-col"
            : "mt-2 space-y-2",
        className,
      )}
      style={
        {
          ["--farm-chart-ui-scale"]: String(chartUiScale),
          ...(overview
            ? { ["--farm-chart-y-gutter-width"]: "0px" }
            : {}),
        } as CSSProperties
      }
      data-tour-id="farm-chart-unified-trend"
      data-farm-chart-ui-scale={String(chartUiScale)}
      data-farm-chart-y-bands={
        xScope?.yBands?.length ? xScope.yBands.join("+") : "all"
      }
      data-farm-chart-temp-focus={
        xScope?.yBands?.length === 1 && xScope.yBands[0] === "temp"
          ? "true"
          : "false"
      }
    >
      {headingMode === "overview" ? (
        <div className="flex h-7 min-w-0 shrink-0 items-center px-2">
          <span
            className="inline-flex min-w-0 items-center truncate text-xs font-medium"
            title={label}
          >
            <ChartScopeTargetMarks
              chartScope={chartScope}
              controllers={controllers}
              fallbackLabel={label}
              typeClassName="text-xs font-medium"
            />
          </span>
        </div>
      ) : headingMode === "widget" ? (
        <div
          className={cn(
            "grid w-full min-w-0 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center",
            isMobileStack ? "min-h-11 px-3 pt-2.5 pb-1" : "h-11 px-2",
          )}
        >
          <div className="invisible pointer-events-none" aria-hidden>
            {hasHeaderTrailing ? renderHeaderTrailing({ spacer: true }) : null}
          </div>
          <div className="flex min-w-0 items-center justify-center gap-2">
            <div
              className="flex min-w-0 items-center gap-2 overflow-hidden"
              title={label}
            >
              <span
                className={cn(
                  "inline-flex min-w-0 items-center truncate font-semibold",
                  farmChartUi.fsTitle,
                )}
              >
                <ChartScopeTargetMarks
                  chartScope={chartScope}
                  controllers={controllers}
                  fallbackLabel={label}
                  typeClassName={cn("font-semibold", farmChartUi.fsTitle)}
                />
              </span>
            </div>
            {layerToolbar}
          </div>
          {hasHeaderTrailing ? renderHeaderTrailing() : <span />}
        </div>
      ) : (
        <div className="flex w-full shrink-0 flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
            <span className={cn("shrink-0 font-semibold", farmChartUi.fsTitle)}>
              통합 추이
            </span>
            <span
              className={cn(
                "leading-snug text-muted-foreground",
                farmChartUi.fsMeta,
              )}
            >
              {label} · 집계 {built?.controllerCount ?? 0}대
              {picked?.trimmed ? " · 실데이터 구간" : ""}
            </span>
          </div>
          {layerToolbar || hasHeaderTrailing ? (
            <div className="flex shrink-0 items-center gap-1">
              {layerToolbar}
              {hasHeaderTrailing ? renderHeaderTrailing() : null}
            </div>
          ) : null}
        </div>
      )}

      {overview ? null : trendExtending || window15mLoading ? (
        <p
          className={cn("text-muted-foreground", farmChartUi.fsMeta)}
          role="status"
        >
          {window15mLoading
            ? "선택한 구간을 자세히 불러오는 중."
            : "최근 이력을 이어 받는 중."}
        </p>
      ) : null}

      {built &&
      scoped &&
      picked &&
      (scoped.series.length > 0 ||
        scoped.histograms.length > 0 ||
        showCommandOverlay) ? (
        <div
          className={cn(
            plotFill
              ? cn(
                  "flex min-h-0 flex-1 flex-col",
                  headingMode === "widget" ? "gap-1.5" : "gap-3",
                )
              : "space-y-3",
          )}
        >
        <div
          data-tour-id="chart-control-plot"
          data-chart-mode="view"
          className={plotFill ? "flex min-h-0 flex-1 flex-col" : undefined}
        >
        <div
          className={
            plotFill ? "flex h-full min-h-0 flex-1 flex-col" : undefined
          }
        >
        <TrendChart
          mode="line"
          onPlotWidthChange={onChartPlotWidth}
          fillParent={plotFill}
          categories={chartCategories}
          series={scoped.series}
          envelopes={scoped.envelopes}
          histograms={scoped.histograms}
          height={plotFill ? 48 : chartPlotHeightForChart}
          eventLane={null}
          eventLaneHeight={0}
          commandSettingSegs={commandSettingSegs}
          leftUnit={chartLeftUnit}
          yAxisTicks={chartLeftUnit ? "thirds" : "full"}
          leftDomain={built.leftDomain}
          period={displayPeriod}
          pinResetKey={`${alarmScopeKey ?? ""}|${period ?? ""}`}
          tickEvery={tickEveryForDisplayBars(chartCategories.length, {
            compact: isMobileStack || overview,
          })}
          showLegend={headingMode !== "widget" && headingMode !== "overview"}
          legendTrailing={
            xScope != null && picked ? (
              <div
                key={`scope-chip-${scopeMotionKey}`}
                className={cn(
                  "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border px-2 py-1 font-medium",
                  farmChartUi.fsMeta,
                  focusBandTint(focusBandActive),
                  motionClass.farmChartScopeChipIn,
                )}
              >
                {xScopeStack.length > 1 ? (
                  <span className="shrink-0 tabular-nums opacity-80">
                    ×{xScopeStack.length}
                  </span>
                ) : null}
                {scopeYLabel ? (
                  <span className="shrink-0 opacity-90">{scopeYLabel}</span>
                ) : null}
                <span className="min-w-0 truncate tabular-nums">
                  {formatTrendScopeRangeLabel(
                    picked.categories[xScope.start] ?? "",
                    picked.categories[xScope.end] ?? "",
                  )}
                </span>
                <button
                  type="button"
                  aria-label="스코프 해제"
                  onClick={clearXScope}
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded border border-current/30",
                    "hover:bg-black/5 dark:hover:bg-white/10",
                    motionClass.microHover,
                  )}
                >
                  ×
                </button>
              </div>
            ) : null
          }
          legendDensity={
            isMobileStack ||
            !(
              layers.ema ||
              layers.humEma ||
              layers.dev ||
              layers.humDev ||
              layers.band ||
              layers.humBand ||
              layers.motorCh
            )
              ? "core"
              : "full"
          }
          scaleEdgeHitPx={isMobileStack ? chartUiPx(22) : chartUiPx(10)}
          labelGutter={isMobileStack && !plotFill && !overview}
          hideAxisChrome={overview}
          showMarkers={!overview}
          markerDensity={displayPeriod === "24h" ? "all" : "sparse"}
          markerRadiusPx={isMobileStack ? chartUiPx(1.4) : chartUiPx(1.6)}
          animate={!overview}
          layerClipWipe={!overview}
          splitBandGuides={splitBandGuides}
          scaleEdgeLabels={overview ? [] : scaleEdgeLabels}
          rangeBands={overview ? [] : alarmRangeBands}
          xScopeSelect={!overview}
          onLookbackWheel={overview ? undefined : onLookbackWheel}
          onXScopeCommit={(range) =>
            commitXScope(range, activeGuidedXScope ? "replace" : "push")
          }
          guidedXScopeGesture={activeGuidedXScope}
          onGuidedXScopeComplete={onGuidedXScopeComplete}
          onXScopeBack={popXScope}
          scopeMotionKey={scopeMotionKey}
          scopeMotionDir={scopeMotionDir}
          onBreachEquipmentNavigate={
            onScopeChange
              ? (target) => {
                  const next: FarmChartScope = {
                    level: "controller",
                    stallTyCode: target.stallTyCode,
                    stallNo: target.stallNo,
                    controllerKey: target.controllerKey,
                  };
                  if (scopesEqual(chartScope, next)) return;
                  onScopeChange(next);
                }
              : undefined
          }
          onScaleEdgeNumericCommit={
            alarmEditEnabled ? onScaleEdgeNumericCommit : undefined
          }
          overlayHoverMerge={overlayActive}
          crosshairValues={crosshairValues}
        />
        </div>
        {showCommandOverlay ? (
          <div
            className={cn(
              headingMode === "widget"
                ? "pointer-events-none absolute bottom-[calc(1.6rem*var(--farm-chart-ui-scale,1)+0.35rem)] left-2 z-[3]"
                : "mt-2 flex shrink-0 justify-start overflow-visible",
            )}
          >
            <div
              className={
                headingMode === "widget" ? "pointer-events-auto" : undefined
              }
            >
            <CommandChannelLayerToolbar
              channels={commandChannels}
              onToggle={(channel) =>
                setCommandChannels((prev) =>
                  toggleCommandChannelFlag(prev, channel),
                )
              }
            />
            </div>
          </div>
        ) : null}
        </div>
        </div>
      ) : overview &&
        (trendLoading ||
          (!controllerTrendByPeriod && !trendError) ||
          (trendExtending && !built)) ? (
        <div
          className={cn(
            dashboardChroma.skeletonBone,
            "mx-2 mb-2 min-h-16 flex-1",
          )}
          role="status"
          aria-label="통합 추이를 불러오는 중."
        />
      ) : (
        <p className="py-6 text-center text-xs text-muted-foreground">
          {built
            ? "표시할 레이어를 선택하세요."
            : trendLoading || (!controllerTrendByPeriod && !trendError)
              ? "통합 추이를 불러오는 중."
                : trendExtending
                ? "최근 이력을 이어 받는 중."
                : window15mLoading
                  ? "선택한 구간을 자세히 불러오는 중."
                  : trendError
                    ? "통합 추이를 불러오지 못했습니다."
                    : controllerSelectEmpty
                      ? "표시할 컨트롤러를 선택하세요."
                    : "통합 추이 데이터가 없습니다."}
        </p>
      )}

      {alarmSaveError ? (
        <p
          className="text-[0.65rem] text-destructive"
          role="alert"
        >
          {alarmSaveError}
        </p>
      ) : null}

      {useBrushCanvas && !hidePeriodBrush ? (
        <div className="shrink-0">
        <UnifiedTrendPeriodBrush
          window={brushWindow}
          onWindowChange={(next) => {
            clearXScope();
            applyBrushWindow(next);
          }}
          overviewValues={brushOverview}
          xScope={xScope}
          chartPointCount={picked?.categories.length ?? 0}
        />
        </div>
      ) : null}
    </div>
  );
}
