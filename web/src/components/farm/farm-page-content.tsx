"use client";

import { useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useFarmPageContentState } from "@/components/farm/use-farm-page-content-state";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/domain/farm-trend-types";
import { FarmMapView } from "@/components/farm/farm-map-view";
import { BarnTable } from "@/components/farm/barn-table";
import { FarmFieldSplit } from "@/components/farm/farm-field-split";
import { FarmChartSlot } from "@/components/farm/farm-chart-slot";
import { FarmFeatureTour } from "@/components/onboarding/feature-tour";
import { FarmViewToggle } from "@/components/farm/farm-view-toggle";
import type { FarmHubView } from "@/lib/farm/farm-view-url";
import { isFarmHubPanelLiveActive } from "@/lib/farm/farm-hub-keepalive";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import type { FarmKey } from "@/lib/domain/farm-key";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";
import { STAGGER_MOUNT_MIN_READINGS } from "@/lib/farm/stagger-mount";

type Props = {
  readings: BarnReading[];
  barnSnapshots: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  controller?: ControllerGridData | null;
  hubMode?: boolean;
  hideViewTabs?: boolean;
  hubUrlEpoch?: number;
  onHubUrlChange?: () => void;
  gridCompactShell?: boolean;
  liveRefreshManaged?: boolean;
  /** hub 캐시 단일 농장 — 목록 탭 첫 진입 시 scoped panel 보강 */
  lazyListEnrichment?: boolean;
  /** SSR과 일치하는 초기 그리드/목록/차트 탭 (hubMode) */
  initialHubView?: FarmHubView;
  lazyListFarmKey?: FarmKey | null;
};

export function FarmPageContent({
  readings,
  barnSnapshots,
  gridCols,
  gridRows,
  trendByPeriod,
  controller,
  hubMode = false,
  hideViewTabs = false,
  hubUrlEpoch = 0,
  onHubUrlChange,
  gridCompactShell = false,
  liveRefreshManaged = false,
  lazyListEnrichment = false,
  lazyListFarmKey = null,
  initialHubView,
}: Props) {
  const {
    viewportCompact,
    tablistRef,
    tabPill,
    scopeToggleSlot,
    view,
    viewSlide,
    setView,
    listEverOpened,
    chartEverOpened,
    fieldMerge,
    fieldActive,
    fieldFocusCtrl,
    fieldStatusOpen,
    setFieldStatusOpen,
    selectBarnForList,
    clearFieldBarnFilter,
    fieldSelectedBarnId,
    fieldMotionRows,
    fieldFilterPhase,
    fieldFilterEnterEpoch,
    enrichListIfNeeded,
    keepAliveFarmId,
    gridFarmKey,
    trendPeriod,
    gridControllerTrend,
    gridTrendLoading,
    gridTrendStale,
    gridTrendError,
    gridTrendWindow15m,
    gridTrendExtending,
    gridTrendWindowLoading,
    ensureGridTrendWindow15m,
    urlCtrl,
    listSp,
    listMode,
    listLayout,
    chartLabSelection,
    onTrendPeriodChange,
    onOpenControllerChart,
    onChartLabSelectionChange,
    setTabPill,
  } = useFarmPageContentState({
    readings,
    barnSnapshots,
    controller,
    hubMode,
    hideViewTabs,
    hubUrlEpoch,
    onHubUrlChange,
    gridCompactShell,
    liveRefreshManaged,
    lazyListEnrichment,
    lazyListFarmKey,
    initialHubView,
  });


  const thermoSettings = controller?.thermoSettings ?? {};
  const alarmSettings = controller?.alarmSettings;

  useLayoutEffect(() => {
    const root = tablistRef.current;
    if (!root) return;
    const selected = root.querySelector<HTMLElement>(
      '[role="tab"][aria-selected="true"]',
    );
    if (!selected) return;
    const next = { left: selected.offsetLeft, width: selected.offsetWidth };
    setTabPill((prev) =>
      prev.left === next.left && prev.width === next.width ? prev : next,
    );
  }, [
    view,
    hideViewTabs,
    gridCompactShell,
    viewportCompact,
    scopeToggleSlot,
    setTabPill,
    tablistRef,
  ]);

  const panelMotionClass = (panel: FarmHubView) => {
    const active = view === panel;
    const exiting = viewSlide?.from === panel;
    const entering = viewSlide?.to === panel;
    if (!active && !exiting) return "hidden";
    return cn(
      exiting && "pointer-events-none absolute inset-x-0 top-0 z-0 w-full",
      active && "relative z-[1] w-full",
      exiting &&
        (viewSlide!.dir === 1
          ? motionClass.viewSlideExitNext
          : motionClass.viewSlideExitPrev),
      entering &&
        (viewSlide!.dir === 1
          ? motionClass.viewSlideEnterNext
          : motionClass.viewSlideEnterPrev),
    );
  };

  /** 현장 통합 — map|list 를 하나의 스플릿 패널로 */
  const fieldPanelMotionClass = () => {
    const active = fieldActive;
    const fromField =
      viewSlide != null &&
      (viewSlide.from === "map" || viewSlide.from === "list");
    const toField =
      viewSlide != null &&
      (viewSlide.to === "map" || viewSlide.to === "list");
    const exiting = Boolean(fromField && !active);
    const entering = Boolean(toField && active);
    if (!active && !exiting) return "hidden";
    return cn(
      exiting && "pointer-events-none absolute inset-x-0 top-0 z-0 w-full",
      active && "relative z-[1] w-full",
      exiting &&
        viewSlide &&
        (viewSlide.dir === 1
          ? motionClass.viewSlideExitNext
          : motionClass.viewSlideExitPrev),
      entering &&
        viewSlide &&
        (viewSlide.dir === 1
          ? motionClass.viewSlideEnterNext
          : motionClass.viewSlideEnterPrev),
    );
  };

  const embedInScopeHeader = Boolean(scopeToggleSlot);
  const awaitingScopeSlot =
    hubMode && !hideViewTabs && scopeToggleSlot === undefined;

  const viewToggle = (
    <FarmViewToggle
      hideViewTabs={hideViewTabs}
      tablistRef={tablistRef}
      embedInScopeHeader={embedInScopeHeader}
      viewportCompact={viewportCompact}
      gridCompactShell={gridCompactShell}
      tabPill={tabPill}
      fieldMerge={fieldMerge}
      fieldActive={fieldActive}
      view={view}
      onView={setView}
    />
  );

  const listFocusKey = fieldMerge
    ? fieldFocusCtrl ?? urlCtrl
    : view === "list"
      ? urlCtrl
      : null;

  return (
    <div
        className={cn(
        embedInScopeHeader ? "space-y-3" : "space-y-4",
        "flex min-h-0 flex-1 flex-col overflow-hidden",
      )}
    >
      <FarmFeatureTour
        view={view}
        setView={setView}
        enabled={!hideViewTabs}
      />
      {viewToggle && scopeToggleSlot
        ? createPortal(viewToggle, scopeToggleSlot)
        : awaitingScopeSlot
          ? null
          : viewToggle}

      <div
        className={cn(
          "relative min-h-0 flex-1",
          view === "chart"
            ? "flex flex-col overflow-hidden"
            : "overflow-x-hidden overflow-y-auto overscroll-y-contain",
        )}
        data-farm-view-slot
      >
        {fieldMerge ? (
          <div
            className={cn("min-h-0 lg:min-h-[16rem]", fieldPanelMotionClass())}
            aria-hidden={!fieldActive}
            data-farm-view-panel="field"
            data-farm-view-active={fieldActive}
          >
            {viewportCompact ? (
              <FarmMapView
                barns={barnSnapshots}
                readings={readings}
                gridCols={gridCols}
                gridRows={gridRows}
                trendByPeriod={trendByPeriod}
                controllerTrendByPeriod={gridControllerTrend}
                controller={controller}
                hubMode={hubMode}
                compactShell={gridCompactShell}
                trendPeriod={trendPeriod}
                onTrendPeriodChange={onTrendPeriodChange}
                trendLoading={gridTrendLoading}
                trendStale={gridTrendStale}
                fieldMerge
                onOpenChart={onOpenControllerChart}
                suppressBottomOverlays={view === "chart"}
              />
            ) : (
              <FarmFieldSplit
                fieldStatusOpen={fieldStatusOpen}
                barns={barnSnapshots}
                readings={readings}
                selectedBarnId={fieldSelectedBarnId}
                onSelectBarn={selectBarnForList}
                onShowAll={clearFieldBarnFilter}
                onHideStatus={() => setFieldStatusOpen(false)}
                onShowStatus={() => setFieldStatusOpen(true)}
                alarmSettings={alarmSettings}
                fieldFilterPhase={fieldFilterPhase}
                rows={fieldMotionRows}
                controller={controller ?? null}
                thermoSettings={thermoSettings}
                canCommand={controller?.canCommand ?? false}
                initialSp={listSp}
                initialListMode={listMode}
                initialListLayout={listLayout}
                focusControllerKey={listFocusKey}
                hubMode={hubMode}
                onHubUrlChange={onHubUrlChange}
                liveRefreshManaged={liveRefreshManaged}
                staggerMount={readings.length > STAGGER_MOUNT_MIN_READINGS}
                onRequestPanelEnrichment={enrichListIfNeeded}
                trendPeriod={trendPeriod}
                onOpenChart={onOpenControllerChart}
                panelLiveActive={fieldActive}
                listFilterEnterEpoch={fieldFilterEnterEpoch}
              />
            )}
          </div>
        ) : (
          <>
            <div
              className={cn(
                "min-h-0 lg:min-h-[16rem]",
                panelMotionClass("map"),
              )}
              aria-hidden={view !== "map"}
              data-farm-view-panel="map"
              data-farm-view-active={view === "map"}
            >
              <FarmMapView
                barns={barnSnapshots}
                readings={readings}
                gridCols={gridCols}
                gridRows={gridRows}
                trendByPeriod={trendByPeriod}
                controllerTrendByPeriod={gridControllerTrend}
                controller={controller}
                hubMode={hubMode}
                compactShell={gridCompactShell}
                trendPeriod={trendPeriod}
                onTrendPeriodChange={onTrendPeriodChange}
                trendLoading={gridTrendLoading}
                trendStale={gridTrendStale}
              />
            </div>

            {listEverOpened ? (
              <div
                className={panelMotionClass("list")}
                aria-hidden={view !== "list"}
                data-farm-view-panel="list"
                data-farm-view-active={view === "list"}
              >
                <BarnTable
                  rows={readings}
                  controller={controller ?? null}
                  thermoSettings={thermoSettings}
                  alarmSettings={alarmSettings}
                  canCommand={controller?.canCommand ?? false}
                  initialSp={listSp}
                  initialListMode={listMode}
                  initialListLayout={listLayout}
                  focusControllerKey={view === "list" ? urlCtrl : null}
                  hubMode={hubMode}
                  onHubUrlChange={onHubUrlChange}
                  liveRefreshManaged={liveRefreshManaged}
                  staggerMount={readings.length > STAGGER_MOUNT_MIN_READINGS}
                  onRequestPanelEnrichment={enrichListIfNeeded}
                  trendPeriod={trendPeriod}
                  onOpenChart={onOpenControllerChart}
                  panelLiveActive={isFarmHubPanelLiveActive(view, "list")}
                />
              </div>
            ) : null}
          </>
        )}

        {chartEverOpened ? (
          <FarmChartSlot
            className={panelMotionClass("chart")}
            active={view === "chart"}
            keepAliveFarmId={keepAliveFarmId}
            readings={readings}
            farmKey={gridFarmKey}
            controllerTrendByPeriod={gridControllerTrend}
            trendLoading={gridTrendLoading}
            trendError={Boolean(gridTrendError)}
            trendExtending={gridTrendExtending}
            window15mLoading={gridTrendWindowLoading}
            window15m={gridTrendWindow15m}
            onNeedWindow15m={ensureGridTrendWindow15m}
            period={trendPeriod}
            alarmSettings={alarmSettings}
            thermoSettings={thermoSettings}
            canCommand={controller?.canCommand ?? false}
            isMobileStack={viewportCompact}
            selection={chartLabSelection}
            onSelectionChange={onChartLabSelectionChange}
            layersToolbarActive={view === "chart"}
          />
        ) : null}

      </div>
    </div>
  );
}
