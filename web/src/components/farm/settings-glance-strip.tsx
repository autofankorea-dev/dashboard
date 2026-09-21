"use client";

import {
  formatChannelGlanceCells,
  type ChannelGlanceRow,
  type PanelDraft,
} from "@/lib/controllers/controller-panel-draft";
import type { ChannelSlot } from "@/lib/data/iot-channel";
import { dashboardReadout } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

export type SettingsGlanceFocus = ChannelSlot | "alarm" | "ctrl";

type Props = {
  hasChannels: boolean;
  rows: ChannelGlanceRow[];
  ctrlValues: PanelDraft | null;
  ctrlDirty: boolean;
  alarmSummary: string;
  alarmDirty: boolean;
  focus: SettingsGlanceFocus;
  disabled?: boolean;
  onFocus: (focus: SettingsGlanceFocus) => void;
};

const GRID = "grid grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)] gap-x-1";

export function SettingsGlanceStrip({
  hasChannels,
  rows,
  ctrlValues,
  ctrlDirty,
  alarmSummary,
  alarmDirty,
  focus,
  disabled = false,
  onFocus,
}: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <p className="text-xs font-semibold">현장 명령</p>
        <p className="text-[0.65rem] text-muted-foreground">
          {hasChannels ? "채널" : "컨트롤러"}
        </p>
      </div>
      {hasChannels ? (
        <>
          <div className={cn(GRID, "px-1")}>
            <span />
            <ColHead>설정</ColHead>
            <ColHead>편차</ColHead>
            <ColHead>환기</ColHead>
          </div>
          {rows.map((row) => (
            <ChannelRow
              key={row.slot}
              row={row}
              selected={focus === row.slot}
              disabled={disabled}
              onSelect={() => onFocus(row.slot)}
            />
          ))}
        </>
      ) : (
        <CtrlRow
          values={ctrlValues}
          dirty={ctrlDirty}
          selected={focus === "ctrl"}
          disabled={disabled}
          onSelect={() => onFocus("ctrl")}
        />
      )}
      <button
        type="button"
        disabled={disabled}
        aria-pressed={focus === "alarm"}
        onClick={() => onFocus("alarm")}
        className={cn(
        "flex w-full flex-col gap-0.5 rounded-lg border px-2.5 py-2 text-left outline-none",
          motionClass.microHover,
          focus === "alarm"
            ? "border-primary bg-muted/40"
            : "border-border bg-background hover:bg-muted/30",
          disabled && "opacity-60",
        )}
      >
        <span className="flex items-center gap-1.5">
          <span className="text-[0.65rem] font-semibold text-muted-foreground">
            알림 기준
          </span>
          {alarmDirty ? <DirtyDot label="알림 변경됨" /> : null}
        </span>
        <span className="min-w-0 text-[11px] leading-snug tabular-nums text-foreground">
          {alarmSummary}
        </span>
      </button>
    </div>
  );
}

function ColHead({ children }: { children: string }) {
  return (
    <span className="text-[0.65rem] text-muted-foreground">{children}</span>
  );
}

function ChannelRow({
  row,
  selected,
  disabled,
  onSelect,
}: {
  row: ChannelGlanceRow;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const cells = row.values ? formatChannelGlanceCells(row.values) : null;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      aria-label={
        row.present
          ? `${row.slot}채널 ${cells ? `${cells.setpoint}℃ ${cells.deviation}℃ 환기 ${cells.vent}` : ""}`
          : `${row.slot}채널 없음`
      }
      onClick={onSelect}
      className={cn(
        GRID,
        "w-full items-center rounded-lg border px-1 py-1.5 text-left outline-none",
        motionClass.microHover,
        selected
          ? "border-primary bg-muted/40"
          : "border-border bg-background hover:bg-muted/30",
        disabled && "opacity-60",
      )}
    >
      <span className="flex items-center gap-0.5">
        <span
          className={cn(
            "text-[11px] font-semibold",
            selected ? "text-primary" : "text-muted-foreground",
          )}
        >
          {row.slot}
        </span>
        {row.dirty ? <DirtyDot label={`${row.slot} 변경됨`} /> : null}
      </span>
      {row.present && cells ? (
        <>
          <NumCell>{cells.setpoint}</NumCell>
          <NumCell>{cells.deviation}</NumCell>
          <NumCell>{cells.vent}</NumCell>
        </>
      ) : (
        <>
          <NumCell muted>—</NumCell>
          <NumCell muted>—</NumCell>
          <NumCell muted>없음</NumCell>
        </>
      )}
    </button>
  );
}

function CtrlRow({
  values,
  dirty,
  selected,
  disabled,
  onSelect,
}: {
  values: PanelDraft | null;
  dirty: boolean;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const cells = values ? formatChannelGlanceCells(values) : null;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left",
        motionClass.microHover,
        selected
          ? "border-primary bg-muted/40"
          : "border-border bg-background hover:bg-muted/30",
        disabled && "opacity-60",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="text-[0.65rem] font-semibold text-muted-foreground">
          설정
        </span>
        {dirty ? <DirtyDot label="명령 변경됨" /> : null}
      </span>
      <span
        className={cn(
          "min-w-0 truncate tabular-nums",
          dashboardReadout.label,
          "text-foreground",
        )}
      >
        {cells ? `${cells.setpoint}±${values!.tempDeviation.toFixed(1)}℃ · ${cells.vent}` : "—"}
      </span>
    </button>
  );
}

function NumCell({
  children,
  muted = false,
}: {
  children: string;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "truncate tabular-nums text-[11px] leading-none",
        muted ? "text-muted-foreground" : "text-foreground",
      )}
    >
      {children}
    </span>
  );
}

function DirtyDot({ label }: { label: string }) {
  return (
    <span
      className="size-1.5 shrink-0 rounded-full bg-primary"
      aria-label={label}
    />
  );
}
