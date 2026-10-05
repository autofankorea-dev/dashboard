"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { UnifiedBarnTrendPanel } from "@/components/farm/unified-barn-trend-panel";
import {
  BRUSH_PERIOD_WINDOW,
  type BrushWindow,
} from "@/components/farm/unified-trend-period-brush";
import {
  UnifiedTrendLayerToolbar,
  UNIFIED_LAYER_TOOLBAR_AVAILABLE,
  applyLayerGroupMode,
  detectLayerGroupMode,
  nextLayerGroupMode,
  type LayerGroupId,
  type SharedChartLayerDisplay,
} from "@/components/farm/unified-trend-layer-toolbar";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { BarnReading } from "@/lib/data/iot";
import {
  type TrendControllerPeriodData,
  type TrendPeriodId,
  type TrendWindow15m,
} from "@/lib/data/farm-trend-types";
import type { FarmKey } from "@/lib/data/farm-key";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import {
  EMPTY_FARM_CHART_LAB_SELECTION,
  toggleFarmChartComparisonKey,
  type ChartTrendZoomHint,
  buildFarmChartTree,
  chartScopeLabel,
  dismissFarmChartLabHero,
  farmChartLabControllerScopes,
  farmChartLabScopeKey,
  farmChartLabSelectionFromKeys,
  farmChartLabStallKey,
  farmChartScopeKey,
  filterReadingsByChartScope,
  indexReadingsByChartScope,
  spScopeFromStallTy,
  stallScopeFromController,
  type FarmChartControllerScope,
  type FarmChartLabMode,
  type FarmChartLabSelection,
  type FarmChartScope,
} from "@/lib/farm/farm-chart-scope";
import { useFarmTrendUplinkCoverage } from "@/lib/farm/use-farm-trend-uplink-coverage";
import type { UplinkCoverageIndex } from "@/lib/farm/trend-uplink-coverage";
import {
  DEFAULT_UNIFIED_LAYERS,
  type UnifiedMetricAvailability,
} from "@/lib/farm/unified-barn-trend-series";
import { farmChartUi } from "@/lib/ui/farm-chart-ui-scale";
import {
  dashboardElevation,
  dashboardHubSurface,
  dashboardTypography,
} from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { motionStaggerStepMs } from "@/lib/ui/motion-tokens";
import { cn } from "@/lib/utils";

export type { FarmChartLabMode };

type Props = {
  readings: BarnReading[];
  farmKey?: FarmKey | null;
  controllerTrendByPeriod?: Record<
    TrendPeriodId,
    TrendControllerPeriodData
  > | null;
  trendLoading?: boolean;
  trendError?: boolean;
  trendExtending?: boolean;
  window15mLoading?: boolean;
  window15m?: TrendWindow15m | null;
  onNeedWindow15m?: (fromMs: number, toMs: number) => void;
  period: TrendPeriodId;
  alarmSettings?: AlarmSettings;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  canCommand?: boolean;
  isMobileStack?: boolean;
  /** 차트 탭 — `chartW1`/`chartW2` 선택 */
  selection?: FarmChartLabSelection;
  onSelectionChange?: (next: FarmChartLabSelection) => void;
  layersToolbarActive?: boolean;
};

function labBatchListClass(compact: boolean): string {
  if (compact) return "grid grid-cols-2 content-start gap-2.5";
  return "flex flex-wrap content-start gap-2.5 md:gap-3";
}

export function FarmChartLabView({
  readings,
  farmKey,
  controllerTrendByPeriod,
  trendLoading = false,
  trendError = false,
  trendExtending = false,
  window15mLoading = false,
  window15m = null,
  onNeedWindow15m,
  period,
  alarmSettings,
  thermoSettings,
  canCommand = false,
  isMobileStack = false,
  selection,
  onSelectionChange,
  layersToolbarActive = true,
}: Props) {
  const scopes = useMemo(
    () => farmChartLabControllerScopes(readings),
    [readings],
  );
  const tree = useMemo(() => buildFarmChartTree(readings), [readings]);
  const readingsByScope = useMemo(
    () => indexReadingsByChartScope(readings),
    [readings],
  );
  const [openSp, setOpenSp] = useState<string | null>(null);
  const [openStall, setOpenStall] = useState<string | null>(null);
  const [localSelection, setLocalSelection] = useState<FarmChartLabSelection>(
    EMPTY_FARM_CHART_LAB_SELECTION,
  );
  const currentSelection = onSelectionChange
    ? (selection ?? EMPTY_FARM_CHART_LAB_SELECTION)
    : localSelection;
  const resolved = farmChartLabSelectionFromKeys(scopes, {
    mode: currentSelection.mode,
    primaryKey: currentSelection.primary
      ? farmChartLabScopeKey(currentSelection.primary)
      : null,
    partnerKey: currentSelection.partner
      ? farmChartLabScopeKey(currentSelection.partner)
      : null,
  });
  const { mode, primary, partner } = resolved;
  const heroScopes = [primary, partner].filter(
    (scope): scope is FarmChartControllerScope => scope != null,
  );
  const [comparisonKeys, setComparisonKeys] = useState<string[]>([]);
  const comparisonScopes = comparisonKeys.flatMap((key) => {
    const scope = scopes.find(
      (candidate) => farmChartLabScopeKey(candidate) === key,
    );
    return scope ? [scope] : [];
  });
  const toggleComparison = (key: string) => {
    setComparisonKeys((prev) =>
      toggleFarmChartComparisonKey(
        prev.filter((existing) =>
          scopes.some((scope) => farmChartLabScopeKey(scope) === existing),
        ),
        key,
      ),
    );
  };
  const [sharedBrushWindow, setSharedBrushWindow] = useState<BrushWindow>(
    () => BRUSH_PERIOD_WINDOW["24h"],
  );
  const [comparisonZoom, setComparisonZoom] =
    useState<ChartTrendZoomHint | null>(null);
  const [layers, setLayers] = useState(DEFAULT_UNIFIED_LAYERS);
  const [alarmRangeOn, setAlarmRangeOn] = useState({ temp: true, hum: true });
  const [availabilityByKey, setAvailabilityByKey] = useState<
    Record<string, UnifiedMetricAvailability>
  >({});
  const onMetricAvailable = useCallback(
    (key: string, next: UnifiedMetricAvailability) => {
      setAvailabilityByKey((prev) => {
        const old = prev[key];
        return old?.temp === next.temp &&
          old.hum === next.hum &&
          old.motors === next.motors
          ? prev
          : { ...prev, [key]: next };
      });
    },
    [],
  );
  const metricsSettled = heroScopes.every(
    (scope) => availabilityByKey[farmChartLabScopeKey(scope)] != null,
  );
  const metricAvailable = {
    temp: heroScopes.some(
      (scope) => availabilityByKey[farmChartLabScopeKey(scope)]?.temp,
    ),
    hum: heroScopes.some(
      (scope) => availabilityByKey[farmChartLabScopeKey(scope)]?.hum,
    ),
    motors: heroScopes.some(
      (scope) => availabilityByKey[farmChartLabScopeKey(scope)]?.motors,
    ),
  };
  const sharedLayers: SharedChartLayerDisplay = useMemo(
    () => ({ layers, alarmRangeOn }),
    [layers, alarmRangeOn],
  );
  const cycleGroupLayers = useCallback((group: LayerGroupId) => {
    setLayers((prev) =>
      applyLayerGroupMode(
        prev,
        group,
        nextLayerGroupMode(
          detectLayerGroupMode(prev, UNIFIED_LAYER_TOOLBAR_AVAILABLE, group),
        ),
        UNIFIED_LAYER_TOOLBAR_AVAILABLE,
      ),
    );
  }, []);
  const changeBrushWindow = useCallback((next: BrushWindow) => {
    setSharedBrushWindow(next);
    setComparisonZoom(null);
  }, []);
  const ignoreLookbackChange = useCallback((_next: BrushWindow) => {}, []);
  const [zoomPeriod, setZoomPeriod] = useState(period);
  if (period !== zoomPeriod) {
    setZoomPeriod(period);
    setComparisonZoom(null);
  }
  const labRootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef(0);
  const [expandOrigin, setExpandOrigin] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const settleExpand = useCallback(() => setExpandOrigin(null), []);
  useLayoutEffect(() => {
    if (mode === "batch" && listRef.current)
      listRef.current.scrollTop = listScrollRef.current;
  }, [mode]);
  const uplinkCoverageSnap = useFarmTrendUplinkCoverage({
    farmKey: farmKey ?? null,
    enabled: layersToolbarActive,
    h24: controllerTrendByPeriod?.["24h"],
    d30: controllerTrendByPeriod?.["30d"],
    window15m,
  });
  const uplinkCoverage = useMemo(
    () =>
      [
        uplinkCoverageSnap.window,
        uplinkCoverageSnap.h24,
        uplinkCoverageSnap.d30,
      ].filter((index): index is UplinkCoverageIndex => index != null),
    [uplinkCoverageSnap.window, uplinkCoverageSnap.h24, uplinkCoverageSnap.d30],
  );
  const commitSelection = (next: FarmChartLabSelection) => {
    if (onSelectionChange) onSelectionChange(next);
    else setLocalSelection(next);
  };
  const returnToList = () => {
    if (primary && openSp == null) {
      setOpenSp(normalizeStallTyCode(primary.stallTyCode));
      setOpenStall(farmChartLabStallKey(primary));
    }
    setExpandOrigin(null);
    commitSelection(EMPTY_FARM_CHART_LAB_SELECTION);
  };
  const openSingle = (
    scope: FarmChartControllerScope,
    tile: HTMLElement | null,
  ) => {
    listScrollRef.current = listRef.current?.scrollTop ?? 0;
    setSharedBrushWindow(BRUSH_PERIOD_WINDOW["24h"]);
    setComparisonZoom(null);
    const rect = tile?.getBoundingClientRect();
    setExpandOrigin(
      rect
        ? {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }
        : null,
    );
    commitSelection({ mode: "single", primary: scope, partner: null });
  };
  const dismissHero = (scope: FarmChartControllerScope) => {
    if (mode === "single") {
      returnToList();
      return;
    }
    const next = dismissFarmChartLabHero({
      dismissedKey: farmChartLabScopeKey(scope),
      primaryKey: primary ? farmChartLabScopeKey(primary) : null,
      partnerKey: partner ? farmChartLabScopeKey(partner) : null,
    });
    setComparisonZoom(null);
    commitSelection(farmChartLabSelectionFromKeys(scopes, next));
  };
  const chooseComparison = () => {
    setComparisonKeys(heroScopes.map(farmChartLabScopeKey));
    returnToList();
  };
  const startComparison = () => {
    if (comparisonScopes.length !== 2) return;
    listScrollRef.current = listRef.current?.scrollTop ?? 0;
    setSharedBrushWindow(BRUSH_PERIOD_WINDOW["24h"]);
    setComparisonZoom(null);
    setExpandOrigin(null);
    commitSelection({
      mode: "compare",
      primary: comparisonScopes[0],
      partner: comparisonScopes[1],
    });
  };
  const renderTile = (
    scope: FarmChartScope,
    size: "cell" | "hero",
    index = 0,
  ) => {
    const key = farmChartScopeKey(scope);
    const action =
      size !== "cell"
        ? null
        : scope.level === "sp"
          ? {
              label: `${chartScopeLabel(scope, readings)}의 축사 보기`,
              onClick: () => {
                const ty = normalizeStallTyCode(scope.stallTyCode);
                setOpenSp((prev) => (prev === ty ? null : ty));
                setOpenStall(null);
              },
            }
          : scope.level === "stall"
            ? {
                label: `${chartScopeLabel(scope, readings)}의 컨트롤러 보기`,
                onClick: () =>
                  setOpenStall((prev) =>
                    prev === farmChartLabStallKey(scope)
                      ? null
                      : farmChartLabStallKey(scope),
                  ),
              }
            : scope.level === "controller"
              ? {
                  label: `${chartScopeLabel(scope, readings)} 개별 그래프 보기`,
                  onClick: (event: MouseEvent<HTMLButtonElement>) =>
                    openSingle(
                      scope,
                      event.currentTarget.closest<HTMLElement>(
                        "[data-farm-chart-tile]",
                      ),
                    ),
                }
              : null;
    const checked = comparisonKeys.includes(key);
    return (
      <LabTile
        key={key}
        scope={scope}
        readings={readings}
        scopedReadings={
          readingsByScope.get(key) ??
          filterReadingsByChartScope(readings, scope)
        }
        size={size}
        selected={
          size === "cell" &&
          (scope.level === "sp"
            ? openSp === normalizeStallTyCode(scope.stallTyCode)
            : scope.level === "stall"
              ? openStall === farmChartLabStallKey(scope)
              : checked)
        }
        index={index}
        action={action}
        overlayControllers={false}
        onMetricAvailable={size === "hero" ? onMetricAvailable : undefined}
        controllerTrendByPeriod={controllerTrendByPeriod}
        trendLoading={trendLoading}
        trendError={trendError}
        trendExtending={trendExtending}
        window15mLoading={window15mLoading}
        window15m={window15m}
        onNeedWindow15m={onNeedWindow15m}
        uplinkCoverage={uplinkCoverage}
        period={period}
        hidePeriodBrush
        brushWindow={
          size === "cell" ? BRUSH_PERIOD_WINDOW["24h"] : sharedBrushWindow
        }
        onBrushWindowChange={
          size === "cell" ? ignoreLookbackChange : changeBrushWindow
        }
        comparisonZoom={
          size === "hero" && mode === "compare" ? comparisonZoom : undefined
        }
        onZoomChange={
          size === "hero" && mode === "compare" ? setComparisonZoom : undefined
        }
        alarmSettings={alarmSettings}
        thermoSettings={thermoSettings}
        canCommand={canCommand && mode !== "compare"}
        isMobileStack={isMobileStack}
        sharedLayers={sharedLayers}
        expandFrom={size === "hero" && mode === "single" ? expandOrigin : null}
        onExpandSettled={settleExpand}
        onDismiss={
          size === "hero" && scope.level === "controller"
            ? () => dismissHero(scope)
            : undefined
        }
        selectionControl={
          size === "cell" && scope.level === "controller" ? (
            <label className="relative z-20 flex min-h-10 cursor-pointer items-center gap-2 border-t px-2 text-xs">
              <input
                type="checkbox"
                checked={checked}
                disabled={!checked && comparisonScopes.length >= 2}
                aria-label={`${chartScopeLabel(scope, readings)} 비교 선택`}
                onChange={() => toggleComparison(key)}
              />
              비교 선택
            </label>
          ) : null
        }
      />
    );
  };
  const openSpNode = tree.find(
    (sp) => normalizeStallTyCode(sp.stallTyCode) === openSp,
  );
  const openStallNode = openSpNode?.stalls.find(
    (stall) =>
      farmChartLabStallKey({
        stallTyCode: openSpNode.stallTyCode,
        stallNo: stall.stallNo,
      }) === openStall,
  );
  const toolbar =
    mode !== "batch" && layersToolbarActive ? (
      <div className="farm-chart-ui farm-chart-toolbar-fit flex shrink-0 items-center rounded-xl border bg-muted/40 p-2">
        <UnifiedTrendLayerToolbar
          compact={isMobileStack}
          layers={layers}
          available={{
            ...UNIFIED_LAYER_TOOLBAR_AVAILABLE,
            temp: metricAvailable.temp,
            hum: metricAvailable.hum,
            motors: metricAvailable.motors,
          }}
          metricsPending={!metricsSettled}
          onCycleGroup={cycleGroupLayers}
          tempAlarmOn={alarmRangeOn.temp}
          humAlarmOn={alarmRangeOn.hum}
          tempAlarmAvailable={metricAvailable.temp && layers.temp}
          humAlarmAvailable={metricAvailable.hum && layers.hum}
          onToggleTempAlarm={() =>
            setAlarmRangeOn((prev) => ({ ...prev, temp: !prev.temp }))
          }
          onToggleHumAlarm={() =>
            setAlarmRangeOn((prev) => ({ ...prev, hum: !prev.hum }))
          }
        />
      </div>
    ) : null;
  return (
    <div
      ref={labRootRef}
      className="flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden px-1"
      data-farm-chart-lab=""
      data-tour-id="farm-chart-view"
      data-chart-lab-mode={mode}
    >
      {scopes.length === 0 ? (
        <p className={cn(dashboardTypography.meta, "px-3 py-6")}>
          컨트롤러가 없습니다.
        </p>
      ) : mode === "batch" ? (
        <>
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
            <div
              className={cn(
                "max-w-full space-y-3",
                dashboardHubSurface.well,
                dashboardHubSurface.gridGap,
              )}
            >
              <section aria-label="축사유형 미니그래프">
                <h2 className="mb-2 text-sm font-medium">축사유형</h2>
                <div
                  className={labBatchListClass(isMobileStack)}
                  data-farm-chart-lab-batch-sp=""
                >
                  {tree.map((sp, index) =>
                    renderTile(
                      spScopeFromStallTy(sp.stallTyCode),
                      "cell",
                      index,
                    ),
                  )}
                </div>
              </section>
              {openSpNode ? (
                <section aria-label={`${openSpNode.label} 축사 미니그래프`}>
                  <h2 className="mb-2 text-sm font-medium">
                    {openSpNode.label} · 축사
                  </h2>
                  <div
                    className={labBatchListClass(isMobileStack)}
                    data-farm-chart-lab-batch-stalls=""
                  >
                    {openSpNode.stalls.map((stall, index) =>
                      renderTile(
                        stallScopeFromController({
                          stallTyCode: openSpNode.stallTyCode,
                          stallNo: stall.stallNo,
                        }),
                        "cell",
                        index,
                      ),
                    )}
                  </div>
                </section>
              ) : null}
              {openSpNode && openStallNode ? (
                <section
                  aria-label={`${openSpNode.label} ${openStallNode.label} 컨트롤러 미니그래프`}
                >
                  <h2 className="mb-2 text-sm font-medium">
                    {openSpNode.label} · {openStallNode.label} · 컨트롤러
                  </h2>
                  <div
                    className={labBatchListClass(isMobileStack)}
                    data-farm-chart-lab-batch-controllers=""
                  >
                    {openStallNode.controllers.map((controller, index) =>
                      renderTile(
                        {
                          level: "controller",
                          stallTyCode: openSpNode.stallTyCode,
                          stallNo: openStallNode.stallNo,
                          controllerKey: controller.controllerKey,
                        },
                        "cell",
                        index,
                      ),
                    )}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
          <div
            className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border bg-card p-2"
            data-chart-comparison-selection=""
          >
            <span className="text-sm" role="status">
              비교 대상 {comparisonScopes.length}/2
            </span>
            {comparisonScopes.map((scope) => (
              <button
                key={farmChartLabScopeKey(scope)}
                type="button"
                className="min-h-10 rounded-md border px-2 text-xs"
                aria-label={`${chartScopeLabel(scope, readings)} 비교 선택 해제`}
                onClick={() => toggleComparison(farmChartLabScopeKey(scope))}
              >
                {chartScopeLabel(scope, readings)} ×
              </button>
            ))}
            <button
              type="button"
              className="ml-auto min-h-10 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-40"
              disabled={comparisonScopes.length !== 2}
              onClick={startComparison}
            >
              비교하기
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              className="min-h-10 rounded-md border px-3 text-sm"
              onClick={returnToList}
            >
              미니그래프 목록
            </button>
            <span className="text-sm font-medium">
              {mode === "compare" ? "컨트롤러 비교" : "컨트롤러 개별 그래프"}
            </span>
            <button
              type="button"
              className="ml-auto min-h-10 rounded-md border px-3 text-sm"
              onClick={chooseComparison}
            >
              {mode === "compare" ? "비교 대상 변경" : "비교 대상 고르기"}
            </button>
          </div>
          {toolbar}
          <div
            className={cn(
              "flex min-h-0 flex-1 gap-2.5",
              isMobileStack
                ? "flex-col overflow-y-auto"
                : "flex-row overflow-hidden",
            )}
            data-chart-comparison-panels=""
          >
            {heroScopes.map((scope, index) => (
              <div
                key={farmChartLabScopeKey(scope)}
                className={cn(
                  "flex min-w-0 flex-1 flex-col",
                  mode === "compare" && isMobileStack
                    ? "min-h-[20rem] shrink-0 basis-[20rem]"
                    : "min-h-0",
                )}
              >
                {renderTile(scope, "hero", index)}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LabTile({
  scope,
  readings,
  scopedReadings,
  size,
  selected,
  index,
  action,
  controllerTrendByPeriod,
  trendLoading,
  trendError,
  trendExtending,
  window15mLoading,
  window15m,
  onNeedWindow15m,
  uplinkCoverage,
  period,
  hidePeriodBrush,
  brushWindow,
  onBrushWindowChange,
  alarmSettings,
  thermoSettings,
  canCommand,
  isMobileStack,
  sharedLayers,
  selectionControl = null,
  comparisonZoom,
  onZoomChange,
  layerChrome = null,
  expandFrom = null,
  onExpandSettled,
  onDismiss,
  overlayControllers = false,
  hiddenCtrlKeys,
  onMetricAvailable,
}: {
  scope: FarmChartScope;
  readings: BarnReading[];
  scopedReadings: BarnReading[];
  size: "cell" | "hero" | "peer";
  selected: boolean;
  index: number;
  action: {
    label: string;
    onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  } | null;
  overlayControllers?: boolean;
  hiddenCtrlKeys?: Set<string>;
  onMetricAvailable?: (
    key: string,
    available: UnifiedMetricAvailability,
  ) => void;
  selectionControl?: ReactNode;
  comparisonZoom?: ChartTrendZoomHint | null;
  onZoomChange?: (zoom: ChartTrendZoomHint | null) => void;
  controllerTrendByPeriod?: Record<
    TrendPeriodId,
    TrendControllerPeriodData
  > | null;
  trendLoading?: boolean;
  trendError?: boolean;
  trendExtending?: boolean;
  window15mLoading?: boolean;
  window15m?: TrendWindow15m | null;
  onNeedWindow15m?: (fromMs: number, toMs: number) => void;
  uplinkCoverage: UplinkCoverageIndex[];
  period: TrendPeriodId;
  hidePeriodBrush?: boolean;
  brushWindow?: BrushWindow;
  onBrushWindowChange?: (window: BrushWindow) => void;
  alarmSettings?: AlarmSettings;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  canCommand?: boolean;
  isMobileStack?: boolean;
  sharedLayers: SharedChartLayerDisplay;
  layerChrome?: ReactNode;
  expandFrom?: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
  onExpandSettled?: () => void;
  onDismiss?: () => void;
}) {
  const tileRef = useRef<HTMLDivElement>(null);
  const scopeKey = farmChartScopeKey(scope);
  const reportMetricAvailable = useCallback(
    (available: UnifiedMetricAvailability) => {
      onMetricAvailable?.(scopeKey, available);
    },
    [scopeKey, onMetricAvailable],
  );
  const overview = size !== "hero";
  const controllers = useMemo(
    () =>
      scopedReadings
        .filter((reading) => !hiddenCtrlKeys?.has(reading.controllerKey))
        .map((reading) => ({
          key: reading.controllerKey,
          reading,
        })),
    [hiddenCtrlKeys, scopedReadings],
  );
  const controllerSelectEmpty =
    Boolean(hiddenCtrlKeys?.size) &&
    scopedReadings.length > 0 &&
    controllers.length === 0;
  const label = chartScopeLabel(scope, readings);

  useLayoutEffect(() => {
    const el = tileRef.current;
    if (size !== "hero" || !expandFrom || !el) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      onExpandSettled?.();
      return;
    }
    const dest = el.getBoundingClientRect();
    if (!(dest.width > 1) || !(dest.height > 1)) {
      onExpandSettled?.();
      return;
    }
    const dx = expandFrom.left - dest.left;
    const dy = expandFrom.top - dest.top;
    const sx = expandFrom.width / dest.width;
    const sy = expandFrom.height / dest.height;
    el.style.transformOrigin = "top left";
    el.style.transition = "none";
    el.style.opacity = "0.45";
    el.style.clipPath = "inset(10% 8% 10% 8% round 0.75rem)";
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    const play = () => {
      el.style.transition = [
        "transform var(--motion-duration-emphasis) var(--motion-ease-emphasis)",
        "opacity var(--motion-duration-moderate) var(--motion-ease-enter)",
        "clip-path var(--motion-duration-emphasis) var(--motion-ease-enter)",
      ].join(", ");
      el.style.transform = "translate(0, 0) scale(1, 1)";
      el.style.opacity = "1";
      el.style.clipPath = "inset(0 round 0.75rem)";
    };
    const frame = window.requestAnimationFrame(play);
    const done = (ev: TransitionEvent) => {
      if (ev.propertyName !== "transform") return;
      el.style.transition = "";
      el.style.transform = "";
      el.style.transformOrigin = "";
      el.style.opacity = "";
      el.style.clipPath = "";
      onExpandSettled?.();
    };
    el.addEventListener("transitionend", done);
    return () => {
      window.cancelAnimationFrame(frame);
      el.removeEventListener("transitionend", done);
    };
  }, [size, expandFrom, onExpandSettled]);

  return (
    <div
      ref={tileRef}
      data-farm-chart-tile=""
      data-chart-scope-level={scope.level}
      data-chart-lookback-hours={
        overview
          ? 24
          : brushWindow
            ? Math.round(brushWindow.width * 30 * 24)
            : undefined
      }
      data-chart-controller-key={
        scope.level === "controller" ? scope.controllerKey : undefined
      }
      className={cn(
        "relative flex min-h-0 min-w-0 flex-col overflow-hidden",
        overview ? dashboardHubSurface.tile : "rounded-xl border bg-card",
        size === "peer"
          ? "h-[7.5rem] w-[min(16rem,100%)] shrink-0"
          : size === "cell"
            ? cn("h-[7.5rem] shrink-0", isMobileStack ? "w-full" : "w-[16rem]")
            : "h-full min-h-0 flex-1 basis-0",
        size === "hero" && farmChartUi.root,
        isMobileStack && size === "hero" && farmChartUi.yGutterCompact,
        size === "hero" && !expandFrom
          ? motionClass.farmChartPanelShell
          : size !== "hero"
            ? motionClass.staggerIn
            : null,
        overview && action && dashboardElevation.interactiveHover,
        selected && "border-primary",
      )}
      style={
        overview
          ? {
              animationDelay: `${Math.min(index, 12) * motionStaggerStepMs}ms`,
            }
          : undefined
      }
    >
      {layerChrome ? (
        <div className="flex shrink-0 items-center px-2 pt-2">
          {layerChrome}
        </div>
      ) : null}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <UnifiedBarnTrendPanel
          label={label}
          controllers={controllers}
          controllerTrendByPeriod={controllerTrendByPeriod}
          trendLoading={trendLoading}
          trendError={trendError}
          trendExtending={trendExtending}
          window15mLoading={window15mLoading}
          window15m={window15m}
          onNeedWindow15m={onNeedWindow15m}
          uplinkCoverage={uplinkCoverage}
          period={period}
          alarmSettings={alarmSettings}
          thermoSettings={thermoSettings}
          chartScope={scope}
          plotFill={size === "hero"}
          overlayControllers={overlayControllers}
          onMetricAvailable={
            size === "hero" ? reportMetricAvailable : undefined
          }
          comparisonZoom={comparisonZoom}
          onZoomChange={onZoomChange}
          controllerSelectEmpty={controllerSelectEmpty}
          chartHeight={overview ? 64 : undefined}
          headingMode={overview ? "overview" : "widget"}
          hidePeriodBrush={hidePeriodBrush}
          brushWindow={brushWindow}
          onBrushWindowChange={onBrushWindowChange}
          sharedLayers={sharedLayers}
          canCommand={canCommand}
          isMobileStack={isMobileStack}
          headerActions={
            onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground",
                  "hover:bg-muted/50 hover:text-foreground",
                  motionClass.microHover,
                )}
                aria-label={`${label} 차트 끄기`}
                title="차트 끄기"
              >
                <X className="size-4" aria-hidden />
              </button>
            ) : undefined
          }
          className="mt-0 h-full min-h-0 flex-1"
        />
        {action ? (
          <button
            type="button"
            className="absolute inset-0 z-10 cursor-pointer"
            aria-label={action.label}
            title={action.label}
            onClick={action.onClick}
          />
        ) : null}
      </div>
      {selectionControl}
    </div>
  );
}
