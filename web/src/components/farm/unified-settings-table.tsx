"use client";

import type { ChannelGlanceRow, PanelDraft, PanelThermoValues } from "@/lib/controllers/controller-panel-draft";
import type { ChannelSlot } from "@/lib/data/iot-channel";
import { MENU_STEPS, type PanelMenuId } from "@/lib/controllers/controller-panel-map";
import { SettingsStepperField } from "./settings-stepper-field";
import { cn } from "@/lib/utils";

export type SettingsCell = { slot: ChannelSlot | "ctrl"; field: PanelMenuId } | { slot: "alarm"; field: "lowTempC" | "highTempC" };
const fields = [
  ["setpoint", "설정온도", "setpointTemp"], ["deviation", "편차", "tempDeviation"],
  ["minVent", "최저환기", "minVentPct"], ["maxVent", "최고환기", "maxVentPct"],
] as const;
const format = (value: number | null | undefined, field: PanelMenuId) => value == null ? "—" : `${value.toFixed(MENU_STEPS[field].decimals)}${MENU_STEPS[field].unit}`;

export function UnifiedSettingsTable({ rows, current, selected, onSelect, alarm, disabled }: {
  rows: {slot: ChannelSlot | "ctrl"; values: PanelDraft | null; present: boolean}[] | ChannelGlanceRow[];
  current: Partial<Record<ChannelSlot | "ctrl", PanelThermoValues | null>>;
  selected: SettingsCell; onSelect: (cell: SettingsCell) => void;
  alarm: {lowTempC: string; highTempC: string; currentLow?: number | null; currentHigh?: number | null}; disabled: boolean;
}) {
  const tile = (label: string, value: string, active: boolean, changed: boolean, click: () => void, unavailable = false) => (
    <button type="button" aria-label={label} aria-pressed={active} disabled={disabled || unavailable} onClick={click}
      className={cn("relative min-h-11 w-full rounded-md border px-1 py-2 text-center text-xs tabular-nums sm:text-sm",
        active ? "border-primary bg-primary/10 text-primary ring-1 ring-primary" : "border-border bg-background",
        (disabled || unavailable) && "opacity-50")}>
      {value}{changed ? <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" aria-label="변경됨" /> : null}
    </button>
  );
  return <div data-unified-settings-table className="space-y-4">
    <table className="w-full table-fixed border-separate border-spacing-1" aria-label="채널 설정">
      <thead><tr><th className="w-8 text-xs">채널</th>{fields.map(([,label]) => <th key={label} className="text-[11px] font-medium text-muted-foreground">{label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.slot}><th scope="row" className="text-sm">{row.slot === "ctrl" ? "장비" : row.slot}</th>{fields.map(([field,label,key]) => {
        const raw = current[row.slot]?.[key], value = row.values?.[key];
        return <td key={field}>{tile(`${row.slot === "ctrl" ? "컨트롤러" : `${row.slot}채널`} ${label} 선택`, format(value,field),
          selected.slot === row.slot && selected.field === field, value != null && raw != null && Math.abs(value-raw) > 0.05,
          () => onSelect({slot:row.slot,field}), !row.present)}</td>;
      })}</tr>)}</tbody>
    </table>
    <section aria-label="알람 설정" className="space-y-2 border-t pt-3">
      <h3 className="text-sm font-semibold">알람 설정</h3>
      <div className="grid grid-cols-2 gap-2">{(["lowTempC","highTempC"] as const).map(field => {
        const label = field === "lowTempC" ? "저온 경보" : "고온 경보";
        const raw = field === "lowTempC" ? alarm.currentLow : alarm.currentHigh;
        return <div key={field}><p className="mb-1 text-xs text-muted-foreground">{label}</p>{tile(`${label} 선택`, alarm[field] ? `${Number(alarm[field]).toFixed(1)}℃` : "—",
          selected.slot === "alarm" && selected.field === field, raw != null && alarm[field] !== "" && Math.abs(Number(alarm[field])-raw)>0.05, () => onSelect({slot:"alarm",field}))}</div>;
      })}</div>
    </section>
  </div>;
}

export function SharedSettingsStepper({ selected, value, raw, disabled, onChange }: {
  selected: SettingsCell; value: number | null; raw: number | null; disabled: boolean; onChange: (value: number) => void;
}) {
  const alarm = selected.slot === "alarm";
  const label = alarm ? selected.field === "lowTempC" ? "저온 경보" : "고온 경보" : fields.find(([field]) => field === selected.field)?.[1] ?? "";
  const config = alarm ? {step:0.1,min:0,max:100,decimals:1,unit:"℃"} : MENU_STEPS[selected.field as PanelMenuId];
  const name = `${alarm ? "알람" : selected.slot === "ctrl" ? "컨트롤러" : `${selected.slot}채널`} · ${label}`;
  return <div data-shared-settings-stepper className="space-y-2 rounded-lg bg-muted/60 p-3">
    <p className="text-sm font-semibold">{name}</p>
    <p className="text-xs text-muted-foreground">수신 {raw == null ? "—" : `${raw.toFixed(config.decimals)}${config.unit}`} → 입력 {value == null ? "—" : `${value.toFixed(config.decimals)}${config.unit}`}</p>
    <SettingsStepperField key={`${selected.slot}:${selected.field}`} label={name} large value={value ?? config.min} {...config} disabled={disabled} onChange={onChange} />
    <p className="text-[11px] text-muted-foreground">{config.step}{config.unit} 단위 · 길게 누르면 연속 조절</p>
  </div>;
}
