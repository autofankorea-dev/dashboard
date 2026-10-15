"use client";

import { SettingsChannelStepperGrid, SettingsChannelWell } from "./settings-channel-stepper-grid";
import { MENU_STEPS, EDIT_START_DRAFT, type PanelMenuId } from "@/lib/controllers/controller-panel-map";
import type { ChannelGlanceRow, PanelThermoValues } from "@/lib/controllers/controller-panel-draft";
import {
  type ChannelSlot,
} from "@/lib/domain/iot-channel";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { channelSlotCopyKey } from "@/lib/ui/sheet-copy";

export function SettingsAllChannelGrid({ rows, currentBySlot, disabled, onChange }: {
  rows: ChannelGlanceRow[];
  currentBySlot?: Partial<Record<ChannelSlot, PanelThermoValues | null>>;
  disabled?: boolean;
  onChange: (slot: ChannelSlot, field: PanelMenuId, value: number) => void;
}) {
  const t = useSheetCopy();
  return <div className="flex flex-col gap-3" data-all-channel-settings="">
    {rows.map((row) => <SettingsChannelWell key={row.slot} title={`${t(channelSlotCopyKey(row.slot))}${row.present ? "" : ` · ${t("settings.unused")}`}`}>
      {row.present ? <>
        <p className="text-[11px] tabular-nums text-muted-foreground">{currentBySlot?.[row.slot] ? t("settings.currentLine", { setpoint: currentBySlot[row.slot]!.setpointTemp.toFixed(1), dev: currentBySlot[row.slot]!.tempDeviation.toFixed(1), min: currentBySlot[row.slot]!.minVentPct, max: currentBySlot[row.slot]!.maxVentPct }) : t("settings.currentLoading")}</p>
        <SettingsChannelStepperGrid draft={row.values ?? EDIT_START_DRAFT}
        disabled={disabled} ventStep={MENU_STEPS.minVent.step}
        onChange={(field, value) => onChange(row.slot,
          field === "setpointTemp" ? "setpoint" : field === "tempDeviation" ? "deviation" : field === "minVentPct" ? "minVent" : "maxVent", value)}
      /></> : <p className="text-xs text-muted-foreground">{t("settings.noLinkedChannel")}</p>}
    </SettingsChannelWell>)}
  </div>;
}
