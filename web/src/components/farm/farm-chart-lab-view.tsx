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
  buildFarmChartTree,
  chartScopeLabel,
  controllersShareStall,
  dismissFarmChartLabHero,
  farmChartLabControllerScopes,
  farmChartLabScopeKey,
  farmChartLabSelectionFromKeys,
  farmChartLabStallKey,
  farmChartScopeKey,
  filterReadingsByChartScope,
  spScopeFromStallTy,
  stallScopeFromController,
  uniqueFarmChartLabStalls,
  type FarmChartControllerScope,
  type FarmChartLabMode,
  type FarmChartLabSelection,
  type FarmChartScope,
} from "@/lib/farm/farm-chart-scope";
import {
  coverageIndexesFromSnap,
  useFarmTrendUplinkCoverage,
} from "@/lib/farm/use-farm-trend-uplink-coverage";
import type { UplinkCoverageIndex } from "@/lib/farm/trend-uplink-coverage";
import {
  DEFAULT_UNIFIED_LAYERS,
  splitYVisibilityFromLayers,
  andSplitYVisibility,
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
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
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
  const stallAnchors = useMemo(
    () => uniqueFarmChartLabStalls(scopes),
    [scopes],
  );
  const [openSp, setOpenSp] = useState<string | null>(null);
  const [localMode, setLocalMode] = useState<FarmChartLabMode>("batch");
  const [localPrimaryKey, setLocalPrimaryKey] = useState<string | null>(null);
  const [localPartnerKey, setLocalPartnerKey] = useState<string | null>(null);
  const urlBound = typeof onSelectionChange === "function";
  const storedMode = urlBound ? (selection?.mode ?? "batch") : localMode;
  const primaryKey = urlBound
    ? selection?.primary
      ? farmChartLabScopeKey(selection.primary)
      : null
    : localPrimaryKey;
  const partnerKey = urlBound
    ? selection?.partner
      ? farmChartLabScopeKey(selection.partner)
      : null
    : localPartnerKey;
  /** 비교 UI는 보류. 옛 비교 URL은 펼친 축사만 연다. */
  const mode: FarmChartLabMode =
    storedMode === "compare"
      ? primaryKey
        ? "single"
        : "batch"
      : storedMode;
  const [sharedBrushWindow, setSharedBrushWindow] = useState<BrushWindow>(
    () => BRUSH_PERIOD_WINDOW["24h"],
  );
  const resetLookbackTo24h = useCallback(() => {
    setSharedBrushWindow(BRUSH_PERIOD_WINDOW["24h"]);
  }, []);
  const ignoreLookbackChange = useCallback((_next: BrushWindow) => {
    /* 일괄 칸은 24시간 고정. 펼친 카드에서 휠로 과거를 연다. */
  }, []);
  const [layers, setLayers] = useState(DEFAULT_UNIFIED_LAYERS);
  const [alarmRangeOn, setAlarmRangeOn] = useState({ temp: true, hum: true });
  const [metricAvailable, setMetricAvailable] =
    useState<UnifiedMetricAvailability>({
      temp: false,
      hum: false,
      motors: false,
    });
  const [metricsSettled, setMetricsSettled] = useState(false);
  const onMetricAvailable = useCallback((next: UnifiedMetricAvailability) => {
    setMetricsSettled(true);
    setMetricAvailable((prev) =>
      prev.temp === next.temp &&
      prev.hum === next.hum &&
      prev.motors === next.motors
        ? prev
        : next,
    );
  }, []);
  const layerVisibility = useMemo(
    () => splitYVisibilityFromLayers(layers),
    [layers],
  );
  const dataVisibility = useMemo(
    () => andSplitYVisibility(layerVisibility, metricAvailable),
    [layerVisibility, metricAvailable],
  );
  const sharedLayers: SharedChartLayerDisplay = useMemo(
    () => ({ layers, alarmRangeOn }),
    [layers, alarmRangeOn],
  );
  const cycleGroupLayers = useCallback((group: LayerGroupId) => {
    setLayers((prev) => {
      const mode = detectLayerGroupMode(
        prev,
        UNIFIED_LAYER_TOOLBAR_AVAILABLE,
        group,
      );
      return applyLayerGroupMode(
        prev,
        group,
        nextLayerGroupMode(mode),
        UNIFIED_LAYER_TOOLBAR_AVAILABLE,
      );
    });
  }, []);

  const primaryAnchor = primaryKey
    ? (scopes.find((s) => farmChartLabScopeKey(s) === primaryKey) ?? null)
    : null;
  const heroStallKey = primaryAnchor
    ? farmChartLabStallKey(primaryAnchor)
    : null;
  const [hiddenCtrlKeys, setHiddenCtrlKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [hiddenForStall, setHiddenForStall] = useState<string | null>(null);
  if (heroStallKey !== hiddenForStall) {
    setHiddenForStall(heroStallKey);
    setHiddenCtrlKeys(new Set());
  }

  const labRootRef = useRef<HTMLDivElement>(null);
  const [expandOrigin, setExpandOrigin] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const settleExpand = useCallback(() => setExpandOrigin(null), []);

  const uplinkCoverageSnap = useFarmTrendUplinkCoverage({
    farmKey: farmKey ?? null,
    enabled: true,
    h24: controllerTrendByPeriod?.["24h"],
    d30: controllerTrendByPeriod?.["30d"],
    window15m,
  });
  const uplinkCoverage = coverageIndexesFromSnap(uplinkCoverageSnap);

  const commitSelection = (next: FarmChartLabSelection) => {
    if (onSelectionChange) {
      onSelectionChange(next);
      return;
    }
    setLocalMode(next.mode);
    setLocalPrimaryKey(
      next.primary ? farmChartLabScopeKey(next.primary) : null,
    );
    setLocalPartnerKey(
      next.partner ? farmChartLabScopeKey(next.partner) : null,
    );
  };

  const openSingle = (scope: FarmChartControllerScope) => {
    if (urlBound) {
      commitSelection({ mode: "single", primary: scope, partner: null });
      return;
    }
    const key = farmChartLabScopeKey(scope);
    setLocalPrimaryKey(key);
    if (localPartnerKey === key) setLocalPartnerKey(null);
    setLocalMode("single");
  };
  const expandFromTile = (
    scope: FarmChartControllerScope,
    tileEl: HTMLElement | null,
  ) => {
    setSharedBrushWindow(BRUSH_PERIOD_WINDOW["24h"]);
    if (tileEl) {
      const r = tileEl.getBoundingClientRect();
      setExpandOrigin({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      });
    } else {
      setExpandOrigin(null);
    }
    openSingle(scope);
  };
  const dismissHero = (scope: FarmChartControllerScope) => {
    const next = dismissFarmChartLabHero({
      dismissedKey: farmChartLabScopeKey(scope),
      primaryKey,
      partnerKey,
    });
    if (next.mode === "batch") {
      setOpenSp(normalizeStallTyCode(scope.stallTyCode));
      resetLookbackTo24h();
    }
    if (urlBound) {
      commitSelection(farmChartLabSelectionFromKeys(scopes, next));
      return;
    }
    setLocalPrimaryKey(next.primaryKey);
    setLocalPartnerKey(next.partnerKey);
    setLocalMode(next.mode);
  };

  const firstCtrlOfStall = (
    stall: Extract<FarmChartScope, { level: "stall" }>,
  ) =>
    scopes.find(
      (s) =>
        farmChartLabStallKey(s) === farmChartLabStallKey(stall),
    ) ?? null;

  const isHeroAnchor = (scope: FarmChartControllerScope) => {
    if (mode === "batch") return false;
    if (!primaryAnchor) return false;
    return controllersShareStall(scope, primaryAnchor);
  };

  const renderTile = (
    scope: FarmChartScope,
    size: "cell" | "hero" | "peer",
    index = 0,
    anchor?: FarmChartControllerScope | null,
  ) => {
    const key = farmChartScopeKey(scope);
    const selected =
      size === "hero" &&
      Boolean(anchor && farmChartLabScopeKey(anchor) === primaryKey);
    const action =
      mode === "batch" && scope.level === "sp"
        ? {
            label: "이 축사유형의 축사 보기",
            onClick: () => {
              const ty = normalizeStallTyCode(scope.stallTyCode);
              setOpenSp((prev) => (prev === ty ? null : ty));
            },
          }
        : mode === "batch" && scope.level === "stall"
          ? {
              label: "이 축사 펼치기",
              onClick: (e: MouseEvent<HTMLButtonElement>) => {
                const tile = e.currentTarget.closest<HTMLElement>(
                  "[data-farm-chart-tile]",
                );
                const ctrl = firstCtrlOfStall(scope);
                if (ctrl) expandFromTile(ctrl, tile);
              },
            }
            : null;
    return (
      <LabTile
        key={key}
        scope={scope}
        readings={readings}
        size={size}
        selected={selected}
        index={index}
        action={action}
        overlayControllers={size === "hero"}
        hiddenCtrlKeys={
          size === "hero" && index === 0 ? hiddenCtrlKeys : undefined
        }
        onMetricAvailable={
          size === "hero" && index === 0 ? onMetricAvailable : undefined
        }
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
          mode === "batch"
            ? BRUSH_PERIOD_WINDOW["24h"]
            : sharedBrushWindow
        }
        onBrushWindowChange={
          mode === "batch" ? ignoreLookbackChange : setSharedBrushWindow
        }
        alarmSettings={alarmSettings}
        thermoSettings={thermoSettings}
        canCommand={canCommand}
        isMobileStack={isMobileStack}
        sharedLayers={sharedLayers}
        layerChrome={
          size === "hero" && index === 0 && layersToolbarActive
            ? layerToolbar
            : null
        }
        expandFrom={size === "hero" && index === 0 ? expandOrigin : null}
        onExpandSettled={settleExpand}
        onDismiss={
          size === "hero" && anchor
            ? () => dismissHero(anchor)
            : undefined
        }
      />
    );
  };

  const heroAnchors = stallAnchors.filter(isHeroAnchor);
  const heroControllers = primaryAnchor
    ? filterReadingsByChartScope(
        readings,
        stallScopeFromController(primaryAnchor),
      )
    : [];
  const layerToolbar = layersToolbarActive ? (
      <div
        className="farm-chart-toolbar-fit relative flex w-full min-w-0 max-w-full items-center rounded-xl border bg-muted/40 p-2 md:inline-flex md:w-auto md:flex-wrap"
        data-farm-chart-layers-shell=""
      >
      <UnifiedTrendLayerToolbar
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
        tempAlarmAvailable={Boolean(
          dataVisibility.showTemp && layers.temp,
        )}
        humAlarmAvailable={Boolean(
          dataVisibility.showHum &&
            (layers.hum ||
              layers.humDev ||
              layers.humBand ||
              layers.humEma),
        )}
        onToggleTempAlarm={() =>
          setAlarmRangeOn((prev) => ({ ...prev, temp: !prev.temp }))
        }
        onToggleHumAlarm={() =>
          setAlarmRangeOn((prev) => ({ ...prev, hum: !prev.hum }))
        }
        controllerToggles={heroControllers.map((r) => ({
          key: r.controllerKey,
          eqpmnNo: r.eqpmnNo,
          on: !hiddenCtrlKeys.has(r.controllerKey),
        }))}
        onToggleController={(key) => {
          setHiddenCtrlKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
          });
        }}
      />
    </div>
  ) : null;

  const openSpNode =
    openSp == null
      ? null
      : (tree.find(
          (sp) => normalizeStallTyCode(sp.stallTyCode) === openSp,
        ) ?? null);

  return (
    <div
      ref={labRootRef}
      className="flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden px-1"
      data-farm-chart-lab=""
      data-tour-id="farm-chart-view"
    >
      {scopes.length === 0 ? (
        <p className={cn(dashboardTypography.meta, "px-3 py-6")}>
          컨트롤러가 없습니다.
        </p>
      ) : mode === "batch" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            className={cn(
              "h-fit max-w-full space-y-2.5",
              isMobileStack ? "w-full" : "w-fit",
              dashboardHubSurface.well,
              dashboardHubSurface.gridGap,
            )}
          >
            <div
              className={labBatchListClass(isMobileStack)}
              data-farm-chart-lab-batch-sp=""
            >
              {tree.map((sp, index) => {
                const scope = spScopeFromStallTy(sp.stallTyCode);
                const dimmed =
                  openSp != null &&
                  openSp !== normalizeStallTyCode(sp.stallTyCode);
                return (
                  <div
                    key={farmChartScopeKey(scope)}
                    className={cn(
                      motionClass.transitionOpacity,
                      "duration-motion-normal",
                      dimmed && "opacity-40",
                    )}
                  >
                    {renderTile(scope, "cell", index)}
                  </div>
                );
              })}
            </div>
            {openSpNode ? (
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
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden">
            {heroAnchors.map((anchor, index) =>
              renderTile(
                stallScopeFromController(anchor),
                "hero",
                index,
                anchor,
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LabTile({
  scope,
  readings,
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
  size: "cell" | "hero" | "peer";
  selected: boolean;
  index: number;
  action: {
    label: string;
    onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  } | null;
  overlayControllers?: boolean;
  hiddenCtrlKeys?: Set<string>;
  onMetricAvailable?: (available: UnifiedMetricAvailability) => void;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
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
  const overview = size !== "hero";
  const scopedReadings = filterReadingsByChartScope(readings, scope);
  const controllers = scopedReadings
    .filter((r) => !hiddenCtrlKeys?.has(r.controllerKey))
    .map((r) => ({
      key: r.controllerKey,
      reading: r,
    }));
  const controllerSelectEmpty =
    Boolean(hiddenCtrlKeys?.size) &&
    scopedReadings.length > 0 &&
    controllers.length === 0;
  const label = chartScopeLabel(scope, readings);

  useLayoutEffect(() => {
    const el = tileRef.current;
    if (size !== "hero" || !expandFrom || !el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
        <div className="flex shrink-0 items-center px-2 pt-2">{layerChrome}</div>
      ) : null}
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
        onMetricAvailable={size === "hero" ? onMetricAvailable : undefined}
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
  );
}
