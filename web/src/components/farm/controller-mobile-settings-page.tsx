"use client";

import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import { LineChart } from "lucide-react";
import { BarnListAccordionPanel } from "@/components/farm/barn-list-accordion-panel";
import { EnvMetricPanel } from "@/components/farm/controller-summary-gauge-parts";
import {
  ChannelStrip,
  useControllerSummaryData,
} from "@/components/farm/controller-summary-parts";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

type Props = {
  reading: BarnReading;
  readings: BarnReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  commands?: import("@/lib/data/commands").ThermoCommand[];
  alarmSettings?: AlarmSettings;
  canCommand?: boolean;
  /** 명령이 접수되면 덮개로 돌아가 채널 진행을 본다 */
  onCommandQueued?: () => void;
  /** «차트에서 보기» — 해당 컨트롤러 스코프로 차트 탭 이동 (그래프 모드 은퇴 대체) */
  onOpenChart?: () => void;
};

/** 모바일 sheet — 현황 요약 + 차트 이동 + 설정. */
export function ControllerMobileSettingsPage({
  reading,
  readings,
  thermoSettings,
  commands,
  alarmSettings,
  canCommand = false,
  onCommandQueued,
  onOpenChart,
}: Props) {
  const {
    offline,
    thermo,
    thresholds,
    temp,
    humidity,
    tempAlarmBreached,
    humidityAlarmBreached,
  } = useControllerSummaryData(reading, thermoSettings, alarmSettings);

  return (
    <div
      className="min-h-min w-full pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
      data-audit-region="controller-mobile-sheet-settings"
      data-tour-id="list-settings-host"
    >
      <div className="px-3 pb-2 pt-3" data-tour-id="controller-gauge-metrics">
        <EnvMetricPanel
          className="mb-2"
          offline={offline}
          setpoint={thermo?.setpointTemp}
          setDev={thermo?.tempDeviation}
          temp={{
            value: reading.tempC,
            displayValue: temp ?? "—",
            low: thresholds.tempLow,
            high: thresholds.tempHigh,
            breached: tempAlarmBreached,
          }}
          humidity={{
            value: reading.humidityPct,
            displayValue: humidity ?? "—",
            low: thresholds.humidityLow,
            high: thresholds.humidityHigh,
            breached: humidityAlarmBreached,
          }}
        />
        <ChannelStrip
          reading={reading}
          thermo={thermo}
          compact
          hideChannelTrendExpand
        />
      </div>
      {onOpenChart ? (
        <div className="border-b bg-muted/20 px-3 py-2">
          <button
            type="button"
            onClick={onOpenChart}
            data-tour-id="panel-chart"
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg border bg-background px-3 py-2.5 text-sm font-medium text-foreground",
              motionClass.microHover,
            )}
          >
            <LineChart
              className="size-4 text-muted-foreground"
              strokeWidth={dashboardUi.iconStroke}
              aria-hidden
            />
            차트로 옮기기
          </button>
        </div>
      ) : null}
      <BarnListAccordionPanel
          reading={reading}
          readings={readings}
          thermoSettings={thermoSettings}
          commands={commands}
          alarmSettings={alarmSettings}
          canCommand={canCommand}
          collapsibleSections
          onCommandQueued={onCommandQueued}
        />
    </div>
  );
}
