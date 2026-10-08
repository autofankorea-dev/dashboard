"use client";

import { SettingsChannelStepperGrid, SettingsChannelWell } from "./settings-channel-stepper-grid";
import { MENU_STEPS, EDIT_START_DRAFT, type PanelMenuId } from "@/lib/controllers/controller-panel-map";
import type { ChannelGlanceRow, PanelThermoValues } from "@/lib/controllers/controller-panel-draft";
import {
  CHANNEL_SLOT_LABELS,
  type ChannelSlot,
} from "@/lib/data/iot-channel";

export function SettingsAllChannelGrid({ rows, currentBySlot, disabled, onChange }: {
  rows: ChannelGlanceRow[];
  currentBySlot?: Partial<Record<ChannelSlot, PanelThermoValues | null>>;
  disabled?: boolean;
  onChange: (slot: ChannelSlot, field: PanelMenuId, value: number) => void;
}) {
  return <div className="flex flex-col gap-3" data-all-channel-settings="">
    {rows.map((row) => <SettingsChannelWell key={row.slot} title={`${CHANNEL_SLOT_LABELS[row.slot]}${row.present ? "" : " · 미사용"}`}>
      {row.present ? <>
        <p className="text-[11px] tabular-nums text-muted-foreground">{currentBySlot?.[row.slot] ? `현재 ${currentBySlot[row.slot]!.setpointTemp.toFixed(1)}℃ +${currentBySlot[row.slot]!.tempDeviation.toFixed(1)} · 환기 ${currentBySlot[row.slot]!.minVentPct}~${currentBySlot[row.slot]!.maxVentPct}%` : "현재값 확인 중"}</p>
        <SettingsChannelStepperGrid draft={row.values ?? EDIT_START_DRAFT}
        disabled={disabled} ventStep={MENU_STEPS.minVent.step}
        onChange={(field, value) => onChange(row.slot,
          field === "setpointTemp" ? "setpoint" : field === "tempDeviation" ? "deviation" : field === "minVentPct" ? "minVent" : "maxVent", value)}
      /></> : <p className="text-xs text-muted-foreground">연결된 채널이 없습니다.</p>}
    </SettingsChannelWell>)}
  </div>;
}
