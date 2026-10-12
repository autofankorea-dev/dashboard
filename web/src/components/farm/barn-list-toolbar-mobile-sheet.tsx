"use client";

import { useMemo, useState } from "react";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { AlarmSettings } from "@/lib/domain/alarms";
import type { BarnReading } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/domain/farm-trend-types";
import { BarnControllerMobileSheet } from "@/components/farm/barn-controller-mobile-sheet";
import { ControllerMobileSettingsPage } from "@/components/farm/controller-mobile-settings-page";

type Props = {
  open: boolean;
  readings: BarnReading[];
  selectedKey: string | null;
  onSelectKey: (key: string) => void;
  onClose: () => void;
  thermoSettings: Record<string, ControllerThermoSettings>;
  commands?: import("@/lib/data/commands").ThermoCommand[];
  alarmSettings?: AlarmSettings;
  canCommand?: boolean;
  /**
   * @deprecated 그래프 모드 은퇴 — 이력은 차트 탭. 상위 배선 호환용으로만 유지.
   */
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  /** @deprecated 그래프 모드 은퇴 (호환용) */
  trendLoading?: boolean;
  /** @deprecated 그래프 모드 은퇴 (호환용) */
  trendStale?: boolean;
  /** @deprecated 그래프 모드 은퇴 (호환용) */
  bulkPeriod?: TrendPeriodId;
  /** @deprecated 그래프 모드 은퇴 (호환용) */
  panelPeriodOverrides?: Record<string, TrendPeriodId>;
  /** @deprecated 그래프 모드 은퇴 (호환용) */
  onPanelPeriodChange?: (key: string, period: TrendPeriodId) => void;
  /** «차트에서 보기» — 선택 컨트롤러 스코프로 차트 탭 이동 */
  onOpenChart?: (reading: BarnReading) => void;
  showPickerAffiliation?: boolean;
  peek?: boolean;
  onPeek?: () => void;
  onExpand?: () => void;
  /** 차트 탭 등 — peek 핸들 포털만 숨김(open/peek state 유지) */
  suppressPeekHandle?: boolean;
};

/** 모바일 목록 설정 — 단일 bottom sheet + 상단 swipe picker (그래프 모드 은퇴) */
export function BarnListToolbarMobileSheet({
  open,
  readings,
  selectedKey,
  onSelectKey,
  onClose,
  thermoSettings,
  commands,
  alarmSettings,
  canCommand = false,
  onOpenChart,
  showPickerAffiliation = true,
  peek = false,
  onPeek,
  onExpand,
  suppressPeekHandle = false,
}: Props) {
  const reading = useMemo(
    () => readings.find((r) => r.key === selectedKey) ?? null,
    [readings, selectedKey],
  );

  /** key 전환 중 reading이 잠깐 비어도 Dialog를 언마운트하지 않음 */
  const [lastReading, setLastReading] = useState<BarnReading | null>(null);
  if (reading && reading !== lastReading) {
    setLastReading(reading);
  }
  const displayReading = reading ?? lastReading;

  if (!displayReading) return null;

  return (
    <BarnControllerMobileSheet
      open={open}
      onClose={onClose}
      peek={peek}
      onPeek={onPeek}
      onExpand={onExpand}
      suppressPeekHandle={suppressPeekHandle}
      reading={displayReading}
      pickerReadings={readings}
      selectedReadingKey={selectedKey ?? displayReading.key}
      onSelectReading={onSelectKey}
      showPickerAffiliation={showPickerAffiliation}
      settingsPage={
        <ControllerMobileSettingsPage
          key={displayReading.key}
          reading={displayReading}
          readings={readings}
          thermoSettings={thermoSettings}
          commands={commands}
          alarmSettings={alarmSettings}
          canCommand={canCommand}
          onOpenChart={
            onOpenChart
              ? () => {
                  onOpenChart(displayReading);
                  if (!onPeek) onClose();
                }
              : undefined
          }
        />
      }
    />
  );
}
