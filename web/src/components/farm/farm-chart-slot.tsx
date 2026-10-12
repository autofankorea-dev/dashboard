"use client";

import type { BarnReading } from "@/lib/data/iot";
import type { AlarmSettings } from "@/lib/domain/alarms";
import type { FarmKey } from "@/lib/domain/farm-key";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
  TrendWindow15m,
} from "@/lib/domain/farm-trend-types";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { FarmChartLabSelection } from "@/lib/farm/farm-chart-scope";
import { FarmChartLabView } from "@/components/farm/farm-chart-lab-view";
import { cn } from "@/lib/utils";

/**
 * 농장 허브 차트 탭 슬롯.
 * `farm-page-content.tsx`에서 분리(동작 보존).
 */
export function FarmChartSlot({
  className,
  active,
  keepAliveFarmId,
  readings,
  farmKey,
  controllerTrendByPeriod,
  trendLoading,
  trendError,
  trendExtending,
  window15mLoading,
  window15m,
  onNeedWindow15m,
  period,
  alarmSettings,
  thermoSettings,
  canCommand,
  isMobileStack,
  selection,
  onSelectionChange,
  layersToolbarActive,
}: {
  className?: string;
  active: boolean;
  keepAliveFarmId: string;
  readings: BarnReading[];
  farmKey: FarmKey | null;
  controllerTrendByPeriod?: Record<
    TrendPeriodId,
    TrendControllerPeriodData
  > | null;
  trendLoading: boolean;
  trendError: boolean;
  trendExtending: boolean;
  window15mLoading: boolean;
  window15m: TrendWindow15m | null;
  onNeedWindow15m: (fromMs: number, toMs: number) => void;
  period: TrendPeriodId;
  alarmSettings?: AlarmSettings;
  thermoSettings: Record<string, ControllerThermoSettings>;
  canCommand: boolean;
  isMobileStack: boolean;
  selection: FarmChartLabSelection;
  onSelectionChange: (next: FarmChartLabSelection) => void;
  layersToolbarActive: boolean;
}) {
  return (
    <div
      className={cn(
        className,
        active && "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
      )}
      aria-hidden={!active}
      data-farm-view-panel="chart"
      data-farm-view-active={active}
      data-farm-chart-shell="lab"
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <FarmChartLabView
          key={keepAliveFarmId}
          readings={readings}
          farmKey={farmKey}
          controllerTrendByPeriod={controllerTrendByPeriod}
          trendLoading={trendLoading}
          trendError={trendError}
          trendExtending={trendExtending}
          window15mLoading={window15mLoading}
          window15m={window15m}
          onNeedWindow15m={onNeedWindow15m}
          period={period}
          alarmSettings={alarmSettings}
          thermoSettings={thermoSettings}
          canCommand={canCommand}
          isMobileStack={isMobileStack}
          selection={selection}
          onSelectionChange={onSelectionChange}
          layersToolbarActive={layersToolbarActive}
        />
      </div>
    </div>
  );
}
