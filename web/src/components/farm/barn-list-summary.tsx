"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import {
  ControllerSummaryGaugeRow,
} from "@/components/farm/controller-summary-gauge-row";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import type { TrendControllerPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import { groupReadingsByHierarchy } from "@/lib/data/reading-hierarchy";
import { summarizeReadings } from "@/lib/data/hierarchy-summary";
import {
  isBarnListMobileSheetOpen,
  isBarnListSettingsExpanded,
  type BarnListPanelSets,
} from "@/lib/farm/barn-list-panel-state";
import { BarnListToolbarMobileSheet } from "@/components/farm/barn-list-toolbar-mobile-sheet";
import type { BarnListViewMode, ListLayout } from "@/lib/farm/farm-view-url";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { StatusBadge } from "@/components/common/status-badge";
import { EnvChip } from "@/components/common/env-chip";
import { formatSensorNumberForDisplay } from "@/lib/data/reading-display";
import { StallUnitNoMark } from "@/components/farm/controller-summary-parts";
import { dashboardChroma, dashboardUi, dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";
import { motionStaggerStepMs } from "@/lib/ui/motion-tokens";
import { useFarmTourActive, getFarmTourActiveSync } from "@/lib/onboarding/use-farm-tour-active";
import { STAGGER_MOUNT_MIN_READINGS } from "@/lib/farm/stagger-mount";

type Props = {
  readings: BarnReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  commands?: import("@/lib/data/commands").ThermoCommand[];
  alarmSettings?: AlarmSettings;
  canCommand?: boolean;
  layout?: ListLayout;
  listMode?: BarnListViewMode;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  trendLoading?: boolean;
  trendStale?: boolean;
  bulkPeriod?: TrendPeriodId;
  panelPeriodOverrides?: Record<string, TrendPeriodId>;
  onPanelPeriodChange?: (key: string, period: TrendPeriodId) => void;
  panelSets: BarnListPanelSets;
  onToggleSettings: (key: string) => void;
  /** 명령 접수 후 설정 패널을 닫는다. 한눈 행 채움 이후 필드 목록에서는 호출하지 않음. */
  onCloseSettings?: (key: string) => void;
  /** «차트에서 보기» — 카드 → 차트 탭 이동 */
  onOpenChart?: (reading: BarnReading) => void;
  bulkMode?: boolean;
  selectedSps?: ReadonlySet<string>;
  onToggleSp?: (stallTyCode: string) => void;
  /** 안 D — 첫 paint 후 idle 배치 마운트 (readings > STAGGER_MOUNT_MIN 일 때만 실제 동작) */
  staggerMount?: boolean;
  /** 현장 스플릿 우패널 — 컨트롤러 그리드 최대 2열 */
  narrowControllerGrid?: boolean;
  /** 현장 축사 필터 — 스태거 입장 epoch */
  listFilterEnterEpoch?: number;
  /** 모바일 설정 — 단일 toolbar sheet */
  mobileToolbarSheetMode?: boolean;
  toolbarSheetKey?: string | null;
  /** Dialog open — key 전환과 분리해 sheet 유지 */
  toolbarSheetOpen?: boolean;
  onToolbarSheetKeyChange?: (key: string) => void;
  onToolbarSheetClose?: () => void;
};

/** flat(일반 보기) — 전체 너비 · 최대 5열 */
const CONTROLLER_GRID_FLAT =
  "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5";

/** 현장 스플릿 우패널 — 좁은 폭 · 최대 2열 */
const CONTROLLER_GRID_NARROW =
  "grid grid-cols-1 gap-2 sm:grid-cols-2";

/** group(SP 구역) — 행별(전폭) SP 안 컨트롤러 그리드 */
const CONTROLLER_GRID_IN_SP =
  "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5";

function controllerGridClass(narrow: boolean, inSpSection: boolean): string {
  if (narrow) return CONTROLLER_GRID_NARROW;
  return inSpSection ? CONTROLLER_GRID_IN_SP : CONTROLLER_GRID_FLAT;
}

const STAGGER_INITIAL = 8;
const STAGGER_BATCH = 8;

function useStaggeredVisibleCount(total: number, enabled: boolean): number {
  const completedRef = useRef(false);
  const [visible, setVisible] = useState(() => {
    if (!enabled) return total;
    return Math.min(STAGGER_INITIAL, total);
  });

  useEffect(() => {
    if (!enabled || completedRef.current) {
      setVisible(total);
      return;
    }
    setVisible(Math.min(STAGGER_INITIAL, total));
  }, [enabled, total]);

  useEffect(() => {
    if (!enabled || completedRef.current) return;
    if (visible >= total) {
      completedRef.current = true;
      return;
    }
    const id = window.setTimeout(() => {
      setVisible((v) => {
        const next = Math.min(v + STAGGER_BATCH, total);
        if (next >= total) completedRef.current = true;
        return next;
      });
    }, 16);
    return () => window.clearTimeout(id);
  }, [enabled, visible, total]);

  return visible;
}

function ControllerCardGrid({
  readings,
  allReadings,
  thermoSettings,
  commands,
  alarmSettings,
  canCommand,
  controllerTrendByPeriod,
  trendLoading = false,
  trendStale = false,
  bulkPeriod,
  panelPeriodOverrides = {},
  onPanelPeriodChange,
  panelSets,
  listMode,
  onToggleSettings,
  onCloseSettings,
  onOpenChart,
  inSpSection = false,
  bulkMode = false,
  selectedSps,
  staggerMount = false,
  narrowControllerGrid = false,
  listFilterEnterEpoch = 0,
  showAffiliation = false,
  mobileToolbarSheetMode = false,
  toolbarSheetKey = null,
  onToolbarSheetKeyChange,
  tourFocusKey,
}: {
  readings: BarnReading[];
  allReadings: BarnReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  commands?: import("@/lib/data/commands").ThermoCommand[];
  alarmSettings?: AlarmSettings;
  canCommand: boolean;
  controllerTrendByPeriod: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  trendLoading?: boolean;
  trendStale?: boolean;
  bulkPeriod?: TrendPeriodId;
  panelPeriodOverrides?: Record<string, TrendPeriodId>;
  onPanelPeriodChange?: (key: string, period: TrendPeriodId) => void;
  panelSets: BarnListPanelSets;
  listMode: BarnListViewMode;
  onToggleSettings: (key: string) => void;
  onCloseSettings?: (key: string) => void;
  onOpenChart?: (reading: BarnReading) => void;
  inSpSection?: boolean;
  bulkMode?: boolean;
  selectedSps?: ReadonlySet<string>;
  staggerMount?: boolean;
  /** 현장 스플릿 우패널 — 컨트롤러 그리드 최대 2열 */
  narrowControllerGrid?: boolean;
  listFilterEnterEpoch?: number;
  showAffiliation?: boolean;
  mobileToolbarSheetMode?: boolean;
  toolbarSheetKey?: string | null;
  onToolbarSheetKeyChange?: (key: string) => void;
  /** 투어 — 설정 모드에서 펼칠 단일 카드 */
  tourFocusKey?: string;
}) {
  const tourActive = useFarmTourActive();
  const compact = useHydrationSafeDashboardCompact();
  const [envOpenKeys, setEnvOpenKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const envCoverEnabled = !bulkMode && !tourActive && listMode !== "settings";
  const panelLayoutVariant = compact ? ("stack" as const) : ("grid" as const);
  const staggerEnabled =
    Boolean(staggerMount) &&
    readings.length > STAGGER_MOUNT_MIN_READINGS &&
    !tourActive &&
    listFilterEnterEpoch === 0;
  const visibleCount = useStaggeredVisibleCount(
    readings.length,
    staggerEnabled,
  );
  const visibleReadings = staggerEnabled
    ? readings.slice(0, visibleCount)
    : readings;
  const filterStagger = listFilterEnterEpoch > 0;

  return (
    <div className={controllerGridClass(narrowControllerGrid, inSpSection)}>
      {visibleReadings.map((r, index) => {
        const spCode = normalizeStallTyCode(r.stallTyCode ?? "");
        const spSelected =
          !bulkMode || (selectedSps?.has(spCode) ?? false);
        return (
        <div
          key={
            filterStagger ? `${r.key}:${listFilterEnterEpoch}` : r.key
          }
          className={!tourActive ? motionClass.staggerIn : undefined}
          style={
            !tourActive
              ? {
                  animationDelay: `${Math.min(index, 12) * motionStaggerStepMs}ms`,
                }
              : undefined
          }
        >
        <ControllerSummaryGaugeRow
          reading={r}
          readings={allReadings}
          thermoSettings={thermoSettings}
          commands={commands}
          alarmSettings={alarmSettings}
          canCommand={canCommand}
          listMode={listMode}
          className={bulkMode && !spSelected ? "opacity-50" : undefined}
          settingsExpanded={
            mobileToolbarSheetMode
              ? listMode === "settings"
              : tourFocusKey != null && listMode === "settings"
                ? r.key === tourFocusKey
                : isBarnListSettingsExpanded(r.key, listMode, panelSets)
          }
          mobileSheetOpen={
            compact && !mobileToolbarSheetMode
              ? isBarnListMobileSheetOpen(r.key, panelSets)
              : false
          }
          suppressMobileInlinePanels={mobileToolbarSheetMode}
          suppressPerCardMobileSheet={mobileToolbarSheetMode}
          toolbarSheetSelected={
            mobileToolbarSheetMode && toolbarSheetKey === r.key
          }
          onToggleSettings={
            !bulkMode ? () => onToggleSettings(r.key) : undefined
          }
          onCloseSettings={
            !bulkMode && onCloseSettings
              ? () => onCloseSettings(r.key)
              : undefined
          }
          onOpenChart={
            !bulkMode && onOpenChart ? () => onOpenChart(r) : undefined
          }
          panelLayoutVariant={panelLayoutVariant}
          controllerTrendByPeriod={controllerTrendByPeriod}
          trendLoading={trendLoading}
          trendStale={trendStale}
          bulkPeriod={bulkPeriod}
          panelPeriodOverrides={panelPeriodOverrides}
          onPanelPeriodChange={onPanelPeriodChange}
          showAffiliation={showAffiliation}
          envCoverEnabled={envCoverEnabled}
          envCoverOpen={envOpenKeys.has(r.key)}
          onEnvCoverOpen={() =>
            setEnvOpenKeys((cur) => {
              if (cur.has(r.key)) return cur;
              const next = new Set(cur);
              next.add(r.key);
              return next;
            })
          }
          onEnvCoverClose={() =>
            setEnvOpenKeys((cur) => {
              if (!cur.has(r.key)) return cur;
              const next = new Set(cur);
              next.delete(r.key);
              return next;
            })
          }
          onCardActivate={
            mobileToolbarSheetMode && onToolbarSheetKeyChange
              ? () => onToolbarSheetKeyChange(r.key)
              : undefined
          }
        />
        </div>
        );
      })}
    </div>
  );
}

function SpBulkChipRow({
  groups,
  selectedSps,
  onToggleSp,
}: {
  groups: ReturnType<typeof groupReadingsByHierarchy>;
  selectedSps: ReadonlySet<string>;
  onToggleSp: (stallTyCode: string) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-2" data-audit-region="barn-list-bulk-sp-chips">
      {groups.map((sp) => {
        const code = normalizeStallTyCode(sp.stallTyCode);
        const selected = selectedSps.has(code);
        return (
          <button
            key={code}
            type="button"
            onClick={() => onToggleSp(sp.stallTyCode)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium",
              motionClass.microHover,
              selected
                ? dashboardChroma.chromeSelected
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded border",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/40 bg-background"
              )}
              aria-hidden
            >
              {selected ? <Check className="size-2.5" /> : null}
            </span>
            {sp.label}
          </button>
        );
      })}
    </div>
  );
}

export function BarnListSummary({
  readings,
  thermoSettings,
  commands,
  alarmSettings,
  canCommand = false,
  layout = "group",
  listMode = "controller",
  controllerTrendByPeriod = null,
  trendLoading = false,
  trendStale = false,
  bulkPeriod,
  panelPeriodOverrides = {},
  onPanelPeriodChange,
  panelSets,
  onToggleSettings,
  onCloseSettings,
  onOpenChart,
  bulkMode = false,
  selectedSps = new Set(),
  onToggleSp,
  staggerMount = false,
  narrowControllerGrid = false,
  listFilterEnterEpoch = 0,
  mobileToolbarSheetMode = false,
  toolbarSheetKey = null,
  toolbarSheetOpen = false,
  onToolbarSheetKeyChange,
  onToolbarSheetClose,
}: Props) {
  const tourActiveState = useFarmTourActive();
  const tourActive = tourActiveState || getFarmTourActiveSync();
  const groups = useMemo(() => groupReadingsByHierarchy(readings), [readings]);
  const visibleGroups = useMemo(
    () =>
      groups
        .map((sp) => ({
          ...sp,
          stalls: sp.stalls.filter((stall) => stall.readings.length > 0),
        }))
        .filter((sp) => sp.stalls.length > 0),
    [groups]
  );
  // 투어 중 그래프/설정 — 목록 전체에서 1장만 펼쳐 hole 과대·오타깃 방지
  const tourFocusKey =
    tourActive && !mobileToolbarSheetMode && !bulkMode
      ? readings[0]?.key
      : undefined;

  const gridProps = {
    allReadings: readings,
    thermoSettings,
    commands,
    alarmSettings,
    canCommand,
    controllerTrendByPeriod,
    trendLoading,
    trendStale,
    bulkPeriod,
    panelPeriodOverrides,
    onPanelPeriodChange,
    panelSets,
    listMode,
    onToggleSettings,
    onCloseSettings,
    onOpenChart,
    bulkMode,
    selectedSps,
    staggerMount,
    narrowControllerGrid,
    listFilterEnterEpoch,
    mobileToolbarSheetMode,
    toolbarSheetKey,
    onToolbarSheetKeyChange,
    tourFocusKey,
  };

  const toolbarSheet = mobileToolbarSheetMode && onToolbarSheetClose ? (
    <BarnListToolbarMobileSheet
      open={toolbarSheetOpen}
      readings={readings}
      selectedKey={toolbarSheetKey}
      onSelectKey={(key) => onToolbarSheetKeyChange?.(key)}
      onClose={onToolbarSheetClose}
      thermoSettings={thermoSettings}
      commands={commands}
      alarmSettings={alarmSettings}
      canCommand={canCommand}
      controllerTrendByPeriod={controllerTrendByPeriod}
      trendLoading={trendLoading}
      trendStale={trendStale}
      bulkPeriod={bulkPeriod}
      panelPeriodOverrides={panelPeriodOverrides}
      onPanelPeriodChange={onPanelPeriodChange}
      onOpenChart={onOpenChart}
      showPickerAffiliation
    />
  ) : null;

  if (readings.length === 0) {
    return (
      <p className={cn("py-10 text-center text-muted-foreground", dashboardUi.body)}>
        표시할 데이터가 없습니다.
      </p>
    );
  }

  if (layout === "flat") {
    return (
      <>
        <div className="min-w-0" data-tour-id="list-body" data-audit-region="barn-list-summary" data-list-layout="flat" data-list-mode={listMode}>
          {bulkMode && onToggleSp ? (
            <SpBulkChipRow
              groups={visibleGroups}
              selectedSps={selectedSps}
              onToggleSp={onToggleSp}
            />
          ) : null}
          <ControllerCardGrid
            readings={readings}
            showAffiliation
            {...gridProps}
          />
        </div>
        {toolbarSheet}
      </>
    );
  }

  return (
    <>
    <div
      className="grid min-w-0 grid-cols-1 gap-4"
      data-tour-id="list-body"
      data-audit-region="barn-list-summary"
      data-list-layout="group"
      data-list-mode={listMode}
      data-sp-columns="stack"
      data-bulk-mode={bulkMode ? "on" : undefined}
    >
      {visibleGroups.map((sp) => {
        const allReadings = sp.stalls.flatMap((s) => s.readings);
        const summary = summarizeReadings(allReadings);
        const ctrlCount = allReadings.length;
        const spCode = normalizeStallTyCode(sp.stallTyCode);
        const spSelected = !bulkMode || selectedSps.has(spCode);

        return (
          <section
            key={sp.stallTyCode}
            className={cn(
              "min-w-0 overflow-hidden rounded-xl border bg-muted/20",
              motionClass.transitionOpacity,
              motionClass.durationNormal,
              bulkMode && !spSelected && "opacity-50"
            )}
          >
            <header
              role={bulkMode && onToggleSp ? "button" : undefined}
              tabIndex={bulkMode && onToggleSp ? 0 : undefined}
              onClick={
                bulkMode && onToggleSp
                  ? () => onToggleSp(sp.stallTyCode)
                  : undefined
              }
              onKeyDown={
                bulkMode && onToggleSp
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggleSp(sp.stallTyCode);
                      }
                    }
                  : undefined
              }
              className={cn(
                "flex min-w-0 w-full flex-nowrap items-center gap-2 border-b bg-muted/40 px-3 py-2.5 text-left sm:px-4",
                bulkMode && onToggleSp && "cursor-pointer hover:bg-muted/60",
                bulkMode && spSelected && "bg-primary/5 ring-2 ring-inset ring-primary/40"
              )}
            >
              {bulkMode ? (
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded border",
                    spSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40 bg-background"
                  )}
                  aria-hidden
                >
                  {spSelected ? <Check className="size-3.5" /> : null}
                </span>
              ) : null}
              <h3 className={cn("min-w-0 truncate font-semibold", dashboardUi.cardTitle)}>{sp.label}</h3>
              <span className={cn("shrink-0 text-muted-foreground", dashboardTypography.meta)}>
                {ctrlCount}대
              </span>
              <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
                <StatusBadge tone={summary.status} compact />
                <EnvChip
                  kind="temp"
                  value={
                    formatSensorNumberForDisplay(summary.status, summary.tempC)
                  }
                />
                <EnvChip
                  kind="humidity"
                  value={
                    formatSensorNumberForDisplay(summary.status, summary.humidityPct, 0)
                  }
                />
              </div>
            </header>

            <div
              className={cn(
                "space-y-4 p-3 sm:p-4",
                bulkMode && !spSelected && "pointer-events-none"
              )}
            >
              {sp.stalls.map((stall) => (
                <div key={`${sp.stallTyCode}-${stall.stallKey}`} className="min-w-0">
                  <div
                    className={cn(
                      "mb-2 flex min-w-0 items-center gap-2 pl-1 sm:pl-2",
                      dashboardUi.body
                    )}
                  >
                    <StallUnitNoMark
                      stallNo={
                        stall.stallKey.startsWith("__") ? null : stall.stallKey
                      }
                      className="font-semibold text-muted-foreground"
                    />
                    <span className={cn("text-muted-foreground", dashboardTypography.meta)}>
                      {stall.readings.length}대
                    </span>
                  </div>
                  <ControllerCardGrid
                    readings={stall.readings}
                    inSpSection
                    {...gridProps}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
    {toolbarSheet}
    </>
  );
}
