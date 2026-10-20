"use client";

import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import type { AlarmSettings } from "@/lib/domain/alarms";
import type { TrendPeriodId } from "@/lib/domain/farm-trend-types";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import type { BarnListViewMode, ListLayout } from "@/lib/farm/farm-view-url";
import { BarnTable } from "@/components/farm/barn-table";
import { FarmFieldStatusGrid } from "@/components/farm/farm-field-status-grid";
import type { FieldListFilterPhase } from "@/components/farm/use-field-list-filter-motion";
import { cn } from "@/lib/utils";

/**
 * 현장 통합 데스크톱 — 좌측 축사 현황과 우측 목록.
 * PC에서는 항상 가로 2열이다. 1280px 미만은 접힌 레일로 시작하고,
 * 사용자가 열면 15rem이다. 카드 열 수는 오른쪽 패널 너비를 따른다.
 */
export function FarmFieldSplit({
  fieldStatusOpen,
  barns,
  readings,
  selectedBarnId,
  onSelectBarn,
  onShowAll,
  onHideStatus,
  onShowStatus,
  alarmSettings,
  fieldFilterPhase,
  rows,
  controller,
  thermoSettings,
  canCommand,
  initialSp,
  initialListMode,
  initialListLayout,
  focusControllerKey,
  hubMode,
  onHubUrlChange,
  liveRefreshManaged,
  staggerMount,
  onRequestPanelEnrichment,
  trendPeriod,
  onOpenChart,
  panelLiveActive,
  listFilterEnterEpoch,
  onRefreshPanels,
}: {
  fieldStatusOpen: boolean;
  barns: BarnMapSnapshot[];
  readings: BarnReading[];
  selectedBarnId: string | null;
  onSelectBarn: (barn: BarnMapSnapshot) => void;
  onShowAll: () => void;
  onHideStatus: () => void;
  onShowStatus: () => void;
  alarmSettings?: AlarmSettings;
  fieldFilterPhase: FieldListFilterPhase;
  rows: BarnReading[];
  controller: ControllerGridData | null;
  thermoSettings: Record<string, ControllerThermoSettings>;
  canCommand: boolean;
  initialSp?: string;
  initialListMode: BarnListViewMode;
  initialListLayout: ListLayout;
  focusControllerKey: string | null;
  hubMode?: boolean;
  onHubUrlChange?: () => void;
  liveRefreshManaged?: boolean;
  staggerMount: boolean;
  onRequestPanelEnrichment: () => void | Promise<void>;
  trendPeriod: TrendPeriodId;
  onOpenChart: (reading: BarnReading) => void;
  panelLiveActive: boolean;
  listFilterEnterEpoch: number;
  onRefreshPanels?: () => void | Promise<void>;
}) {
  return (
    <div
      className={cn(
        "grid min-h-[28rem] items-start gap-3",
        "transition-[grid-template-columns] duration-motion-moderate ease-[var(--motion-ease-standard)]",
        fieldStatusOpen
          ? "grid-cols-[15rem_minmax(0,1fr)]"
          : "grid-cols-[2.5rem_minmax(0,1fr)]",
      )}
      data-tour-id="field-split"
      data-field-split=""
      data-field-status={fieldStatusOpen ? "open" : "collapsed"}
    >
      <div className="min-w-0 overflow-hidden">
        <div
          data-field-rail=""
          className={cn(
            "transition-[width,max-width] duration-motion-moderate ease-[var(--motion-ease-standard)]",
            fieldStatusOpen ? "w-[15rem] max-w-[15rem]" : "w-10 max-w-10",
          )}
        >
          <FarmFieldStatusGrid
            barns={barns}
            readings={readings}
            selectedBarnId={selectedBarnId}
            onSelectBarn={onSelectBarn}
            onShowAll={onShowAll}
            collapsed={!fieldStatusOpen}
            onHide={onHideStatus}
            onShow={onShowStatus}
            alarmSettings={alarmSettings}
          />
        </div>
      </div>
      <div className="min-w-0 rounded-md border">
        <div
          className={cn(
            "transition-opacity duration-motion-exit ease-[var(--motion-ease-exit)]",
            fieldFilterPhase === "exiting" ? "opacity-0" : "opacity-100",
          )}
          data-field-list-filter={fieldFilterPhase}
        >
          <BarnTable
            onRefreshPanels={onRefreshPanels}
            rows={rows}
            controller={controller}
            thermoSettings={thermoSettings}
            alarmSettings={alarmSettings}
            canCommand={canCommand}
            initialSp={initialSp}
            initialListMode={initialListMode}
            initialListLayout={initialListLayout}
            focusControllerKey={focusControllerKey}
            hubMode={hubMode}
            onHubUrlChange={onHubUrlChange}
            liveRefreshManaged={liveRefreshManaged}
            staggerMount={staggerMount}
            onRequestPanelEnrichment={onRequestPanelEnrichment}
            trendPeriod={trendPeriod}
            onOpenChart={onOpenChart}
            panelLiveActive={panelLiveActive}
            listFilterEnterEpoch={listFilterEnterEpoch}
          />
        </div>
      </div>
    </div>
  );
}
