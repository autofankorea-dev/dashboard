"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import {
  formatChannelGlanceCells,
  type ChannelGlanceRow,
  type PanelDraft,
} from "@/lib/controllers/controller-panel-draft";
import {
  applyQueueFillRatio,
  type ApplyQueueChannelStripItem,
  type ApplyQueueStage,
} from "@/lib/farm/apply-queue";
import { useApplyQueueStripPresence } from "@/components/farm/use-apply-queue-strip-presence";
import type { ChannelSlot } from "@/lib/data/iot-channel";
import { dashboardReadout } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

export type SettingsGlanceFocus = ChannelSlot | "alarm" | "ctrl";

export type AlarmGlanceCells = {
  temp: string;
  tempDev: string;
  humidity: string;
};

type Props = {
  hasChannels: boolean;
  rows: ChannelGlanceRow[];
  ctrlValues: PanelDraft | null;
  ctrlDirty: boolean;
  alarmCells: AlarmGlanceCells;
  alarmSummary: string;
  alarmDirty: boolean;
  focus: SettingsGlanceFocus | null;
  disabled?: boolean;
  applyItems?: readonly ApplyQueueChannelStripItem[];
  onFocus: (focus: SettingsGlanceFocus) => void;
  presetStrip?: ReactNode;
};

const GRID =
  "grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)] gap-x-1";

type GlanceApply = {
  stage: ApplyQueueStage;
  filled: number;
  leaving: boolean;
};

function applyStageLabel(apply: GlanceApply | null): string {
  if (!apply) return "";
  if (apply.stage === "확인") return "확인됨";
  if (apply.stage === "실패") return "실패";
  return apply.stage;
}

export function SettingsGlanceStrip({
  hasChannels,
  rows,
  ctrlValues,
  ctrlDirty,
  alarmCells,
  alarmSummary,
  alarmDirty,
  focus,
  disabled = false,
  applyItems = [],
  onFocus,
  presetStrip,
}: Props) {
  const { visible, leaving } = useApplyQueueStripPresence(applyItems);
  const applyBySlot = new Map<ChannelSlot, GlanceApply>();
  let ctrlApply: GlanceApply | null = null;
  for (const item of visible) {
    const next: GlanceApply = {
      stage: item.stage,
      filled: item.filled,
      leaving: leaving.has(item.id),
    };
    if (item.slot) applyBySlot.set(item.slot, next);
    else ctrlApply = next;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <p className="px-0.5 text-xs font-semibold">현장 명령</p>
      {presetStrip}
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
              apply={applyBySlot.get(row.slot) ?? null}
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
          apply={ctrlApply}
          onSelect={() => onFocus("ctrl")}
        />
      )}
      <div className={cn(GRID, "px-1")}>
        <span />
        <ColHead>저온 ℃</ColHead>
        <ColHead>고온 ℃</ColHead>
        <ColHead>상태</ColHead>
      </div>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={focus === "alarm"}
        aria-label={`장비 경보 ${alarmSummary}`}
        onClick={() => onFocus("alarm")}
        className={cn(
          GRID,
          "w-full items-center rounded-lg border px-1 py-1.5 text-left outline-none",
          motionClass.microHover,
          focus === "alarm"
            ? "border-primary bg-muted/40"
            : "border-border bg-background hover:bg-muted/30",
          disabled && "opacity-60",
        )}
      >
        <span className="flex items-center gap-0.5">
          <span
            className={cn(
              "text-[11px] font-semibold",
              focus === "alarm" ? "text-primary" : "text-muted-foreground",
            )}
          >
            경보
          </span>
          {alarmDirty ? <DirtyDot label="경보 변경됨" /> : null}
        </span>
        <NumCell>{alarmCells.temp}</NumCell>
        <NumCell>{alarmCells.tempDev}</NumCell>
        <NumCell>{ctrlApply ? `${applyStageLabel(ctrlApply)} ${ctrlApply.filled}/3` : "장비"}</NumCell>
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
  apply,
  onSelect,
}: {
  row: ChannelGlanceRow;
  selected: boolean;
  disabled: boolean;
  apply: GlanceApply | null;
  onSelect: () => void;
}) {
  const cells = row.values ? formatChannelGlanceCells(row.values) : null;
  const busy = apply != null && apply.stage !== "실패";
  const locked = disabled || Boolean(apply);
  const stageText = applyStageLabel(apply);
  const baseLabel = row.present
    ? `${row.slot}채널 ${cells ? `${cells.setpoint}℃ ${cells.deviation}℃ 환기 ${cells.vent}` : ""}`
    : `${row.slot}채널 없음`;
  return (
    <button
      type="button"
      disabled={locked}
      aria-pressed={selected}
      aria-busy={busy || undefined}
      aria-label={stageText ? `${baseLabel}, ${stageText}` : baseLabel}
      onClick={onSelect}
      className={cn(
        GRID,
        "relative overflow-hidden w-full items-center rounded-lg border px-1 py-1.5 text-left outline-none",
        motionClass.microHover,
        selected
          ? "border-primary bg-muted/40"
          : "border-border bg-background hover:bg-muted/30",
        disabled && "opacity-60",
      )}
    >
      <GlanceApplyFill apply={apply} />
      <span className="relative z-[1] flex items-center gap-0.5">
        <span
          className={cn(
            "text-[11px] font-semibold",
            selected || apply ? "text-primary" : "text-muted-foreground",
          )}
        >
          {row.slot}
        </span>
        {row.dirty && !apply ? <DirtyDot label={`${row.slot} 변경됨`} /> : null}
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
      <GlanceApplyCheck apply={apply} />
    </button>
  );
}

function CtrlRow({
  values,
  dirty,
  selected,
  disabled,
  apply,
  onSelect,
}: {
  values: PanelDraft | null;
  dirty: boolean;
  selected: boolean;
  disabled: boolean;
  apply: GlanceApply | null;
  onSelect: () => void;
}) {
  const cells = values ? formatChannelGlanceCells(values) : null;
  const busy = apply != null && apply.stage !== "실패";
  const locked = disabled || Boolean(apply);
  const stageText = applyStageLabel(apply);
  return (
    <button
      type="button"
      disabled={locked}
      aria-pressed={selected}
      aria-busy={busy || undefined}
      aria-label={stageText ? `설정, ${stageText}` : undefined}
      onClick={onSelect}
      className={cn(
        "relative overflow-hidden flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left",
        motionClass.microHover,
        selected
          ? "border-primary bg-muted/40"
          : "border-border bg-background hover:bg-muted/30",
        disabled && "opacity-60",
      )}
    >
      <GlanceApplyFill apply={apply} />
      <span className="relative z-[1] flex min-w-0 items-center gap-1.5">
        <span className="text-[0.65rem] font-semibold text-muted-foreground">
          설정
        </span>
        {dirty && !apply ? <DirtyDot label="명령 변경됨" /> : null}
      </span>
      <span
        className={cn(
          "relative z-[1] min-w-0 truncate tabular-nums",
          dashboardReadout.label,
          "text-foreground",
        )}
      >
        {cells ? `${cells.setpoint}±${values!.tempDeviation.toFixed(1)}℃ · ${cells.vent}` : "—"}
      </span>
      <GlanceApplyCheck apply={apply} />
    </button>
  );
}

function GlanceApplyFill({ apply }: { apply: GlanceApply | null }) {
  if (!apply) return null;
  const t = applyQueueFillRatio(apply.filled);
  const fail = apply.stage === "실패";
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 origin-left",
        "transition-transform duration-motion-moderate ease-[var(--motion-ease-standard)]",
        "motion-reduce:transition-none",
        fail
          ? "bg-[color-mix(in_oklch,var(--status-danger)_28%,transparent)]"
          : apply.stage === "확인"
            ? "bg-primary/30"
            : "bg-primary/20",
        apply.leaving && motionClass.exitFade,
      )}
      style={{ transform: `scaleX(${t})` }}
    />
  );
}

function GlanceApplyCheck({ apply }: { apply: GlanceApply | null }) {
  if (!apply || apply.stage !== "확인") return null;
  return (
    <Check
      className={cn(
        "pointer-events-none absolute right-1.5 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-primary",
        apply.leaving ? motionClass.exitFade : motionClass.enterFade,
      )}
      strokeWidth={2.5}
      aria-hidden
    />
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
        "truncate tabular-nums text-[11px] leading-none relative z-[1]",
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
