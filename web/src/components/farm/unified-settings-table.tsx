"use client";

import type { ChannelGlanceRow, PanelDraft, PanelThermoValues } from "@/lib/controllers/controller-panel-draft";
import {
  type ChannelSlot,
} from "@/lib/domain/iot-channel";
import { MENU_STEPS, type PanelMenuId } from "@/lib/controllers/controller-panel-map";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { channelSlotCopyKey, type SheetCopyKey } from "@/lib/ui/sheet-copy";
import { SettingsStepperField } from "./settings-stepper-field";
import { cn } from "@/lib/utils";

export type SettingsCell = { slot: ChannelSlot | "ctrl"; field: PanelMenuId } | { slot: "alarm"; field: "lowTempC" | "highTempC" };
const fields = [
  ["setpoint", "settings.setpoint", "setpointTemp"],
  ["deviation", "settings.deviation", "tempDeviation"],
  ["minVent", "settings.minVent", "minVentPct"],
  ["maxVent", "settings.maxVent", "maxVentPct"],
] as const;
const format = (value: number | null | undefined, field: PanelMenuId) => value == null ? "—" : `${value.toFixed(MENU_STEPS[field].decimals)}${MENU_STEPS[field].unit}`;

export function UnifiedSettingsTable({ rows, current, selected, onSelect, alarm, disabled }: {
  rows: {slot: ChannelSlot | "ctrl"; values: PanelDraft | null; present: boolean}[] | ChannelGlanceRow[];
  current: Partial<Record<ChannelSlot | "ctrl", PanelThermoValues | null>>;
  selected: SettingsCell; onSelect: (cell: SettingsCell) => void;
  alarm: {lowTempC: string; highTempC: string; currentLow?: number | null; currentHigh?: number | null}; disabled: boolean;
}) {
  const t = useSheetCopy();
  const tile = (label: string, value: string, active: boolean, changed: boolean, click: () => void, unavailable = false) => (
    <button type="button" aria-label={label} aria-pressed={active} disabled={disabled || unavailable} onClick={click}
      className={cn("relative min-h-11 w-full rounded-md border px-1 py-2 text-center text-xs tabular-nums sm:text-sm",
        active ? "border-primary bg-primary/10 text-primary ring-1 ring-primary" : "border-border bg-background",
        (disabled || unavailable) && "opacity-50")}>
      {value}{changed ? <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" aria-label={t("settings.changedMark")} /> : null}
    </button>
  );
  return <div data-unified-settings-table className="space-y-4">
    <table className="w-full table-fixed border-separate border-spacing-1" aria-label={t("settings.tableAria")}>
      <thead><tr><th className="w-8 text-xs">{t("settings.channel")}</th>{fields.map(([,labelKey]) => <th key={labelKey} className="text-[11px] font-medium text-muted-foreground">{t(labelKey)}</th>)}</tr></thead>
      <tbody>{rows.map(row => {
        const slotLabel = row.slot === "ctrl" ? t("settings.device") : t(channelSlotCopyKey(row.slot));
        const slotAria = row.slot === "ctrl" ? t("slot.controller") : t(channelSlotCopyKey(row.slot));
        return <tr key={row.slot}><th scope="row" className="text-sm">{slotLabel}</th>{fields.map(([field, labelKey, key]) => {
        const label = t(labelKey);
        const raw = current[row.slot]?.[key], value = row.values?.[key];
        return <td key={field}>{tile(t("settings.selectCell", { slot: slotAria, label }), format(value, field),
          selected.slot === row.slot && selected.field === field, value != null && raw != null && Math.abs(value-raw) > 0.05,
          () => onSelect({slot:row.slot,field}), !row.present)}</td>;
      })}</tr>;
      })}</tbody>
    </table>
    <section aria-label={t("settings.alarmSection")} className="space-y-2 border-t pt-3">
      <h3 className="text-sm font-semibold">{t("settings.alarmSection")}</h3>
      <div className="grid grid-cols-2 gap-2">{(["lowTempC","highTempC"] as const).map(field => {
        const label = field === "lowTempC" ? t("settings.lowAlarm") : t("settings.highAlarm");
        const raw = field === "lowTempC" ? alarm.currentLow : alarm.currentHigh;
        return <div key={field}><p className="mb-1 text-xs text-muted-foreground">{label}</p>{tile(label, alarm[field] ? `${Number(alarm[field]).toFixed(1)}℃` : "—",
          selected.slot === "alarm" && selected.field === field, raw != null && alarm[field] !== "" && Math.abs(Number(alarm[field])-raw)>0.05, () => onSelect({slot:"alarm",field}))}</div>;
      })}</div>
    </section>
  </div>;
}

export function SharedSettingsStepper({ selected, value, raw, disabled, onChange }: {
  selected: SettingsCell; value: number | null; raw: number | null; disabled: boolean; onChange: (value: number) => void;
}) {
  const t = useSheetCopy();
  const alarm = selected.slot === "alarm";
  const labelKey: SheetCopyKey | null = alarm
    ? selected.field === "lowTempC" ? "settings.lowAlarm" : "settings.highAlarm"
    : fields.find(([field]) => field === selected.field)?.[1] ?? null;
  const label = labelKey ? t(labelKey) : "";
  const config = alarm ? {step:0.1,min:0,max:100,decimals:1,unit:"℃"} : MENU_STEPS[selected.field as PanelMenuId];
  const slotName = alarm
    ? t("settings.alarmWord")
    : selected.slot === "ctrl"
      ? t("slot.controller")
      : t(channelSlotCopyKey(selected.slot));
  const name = `${slotName} · ${label}`;
  const received = raw == null ? "—" : `${raw.toFixed(config.decimals)}${config.unit}`;
  const input = value == null ? "—" : `${value.toFixed(config.decimals)}${config.unit}`;
  return <div data-shared-settings-stepper className="space-y-2 rounded-lg bg-muted/60 p-3">
    <p className="text-sm font-semibold">{name}</p>
    <p className="text-xs text-muted-foreground">{t("settings.receivedToInput", { received, input })}</p>
    <SettingsStepperField key={`${selected.slot}:${selected.field}`} label={name} large value={value ?? config.min} {...config} disabled={disabled} onChange={onChange} />
    <p className="text-[11px] text-muted-foreground">{t("settings.stepHint", { step: config.step, unit: config.unit })}</p>
  </div>;
}
