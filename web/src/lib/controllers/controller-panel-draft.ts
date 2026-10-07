import { commandChannelViews } from "@/lib/controllers/combined-channel-command";
import type { ChannelSlot } from "@/lib/data/iot-channel";
import type { ThermoCommand } from "@/lib/data/commands";
import {
  thermoValuesMatch,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";

export type PanelDraft = {
  setpointTemp: number;
  tempDeviation: number;
  minVentPct: number;
  maxVentPct: number;
};

export type PanelThermoValues = Pick<
  ControllerThermoSettings,
  "setpointTemp" | "tempDeviation" | "minVentPct" | "maxVentPct"
>;

export type PanelChannelContext = {
  slot: ChannelSlot;
  eqpmnCode: string;
  knownSettings: ControllerThermoSettings | null;
  liveBaseline: PanelThermoValues | null;
  command?: ThermoCommand | null;
};

export function latestPanelCommand(commands: readonly ThermoCommand[], slot?: ChannelSlot): ThermoCommand | null {
  const rank = { pending: 1, sent: 2, applied: 3, failed: 4, cancelled: 4 };
  return commands.flatMap(commandChannelViews).filter((cmd) => (cmd.channel ?? undefined) === slot)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || rank[b.status] - rank[a.status])[0] ?? null;
}

export function panelCommandFailed(command?: ThermoCommand | null): boolean {
  return command?.status === "failed" || command?.status === "cancelled";
}

/** Display a submitted command throughout ACK/LIVE latency, including on remount. */
export function displayThermoForChannel(
  known: ControllerThermoSettings | null,
  live: PanelThermoValues | null,
  submitted?: PanelDraft | null,
  command?: ThermoCommand | null,
): PanelThermoValues | null {
  if (command) return {
    setpointTemp: command.setpointTemp, tempDeviation: command.tempDeviation,
    minVentPct: command.minVentPct, maxVentPct: command.maxVentPct,
  };
  if (submitted) return submitted;
  if (known && known.source !== "live") return known;
  return currentThermoForChannel(known, live);
}

export function syncPanelChannelDrafts(
  channels: PanelChannelContext[],
  drafts: Record<string, PanelDraft | null>,
  edited: Record<string, boolean>,
  submitted: Record<string, PanelDraft | null>,
): Record<string, PanelDraft | null> {
  let next = drafts;
  for (const ctx of channels) {
    if (edited[ctx.slot]) continue;
    const source = displayThermoForChannel(ctx.knownSettings, ctx.liveBaseline, submitted[ctx.slot], ctx.command);
    const current = next[ctx.slot] ?? null;
    if (current === source || (current && source && thermoValuesMatch(current, source))) continue;
    next = { ...next, [ctx.slot]: source };
  }
  return next;
}

export function panelChannelKey(channel?: ChannelSlot | null): string {
  return channel ?? "";
}

/** 채널 비교 기준 — LIVE를 우선. 컨트롤러 공통 설정으로 B·C를 덮지 않는다. */
export function currentThermoForChannel(
  known: ControllerThermoSettings | null,
  live: PanelThermoValues | null,
): PanelThermoValues | null {
  if (live) return live;
  return known;
}

export function dirtyBaselineForChannel(
  saveBaseline: PanelDraft | null | undefined,
  known: ControllerThermoSettings | null,
  live: PanelThermoValues | null,
  command?: ThermoCommand | null,
): PanelThermoValues | null {
  if (panelCommandFailed(command)) return currentThermoForChannel(null, live);
  if (command) return displayThermoForChannel(known, live, null, command);
  if (saveBaseline) return saveBaseline;
  return displayThermoForChannel(known, live, null, command);
}

export function isChannelDraftDirty(
  draft: PanelDraft | null | undefined,
  baseline: PanelThermoValues | null,
): boolean {
  if (!draft) return false;
  if (!baseline) return true;
  return !thermoValuesMatch(draft, baseline);
}

export type DirtyChannelSave = {
  slot: ChannelSlot;
  eqpmnCode: string;
  values: PanelDraft;
  current: PanelThermoValues | null;
};

const CHANNEL_SAVE_ORDER: ChannelSlot[] = ["A", "B", "C"];

export const CHANNEL_GLANCE_SLOTS: ChannelSlot[] = CHANNEL_SAVE_ORDER;

export type ChannelGlanceRow = {
  slot: ChannelSlot;
  present: boolean;
  values: PanelDraft | null;
  dirty: boolean;
};

export function formatChannelGlanceCells(values: PanelDraft): {
  setpoint: string;
  deviation: string;
  vent: string;
} {
  return {
    setpoint: values.setpointTemp.toFixed(1),
    deviation: `+${values.tempDeviation.toFixed(1)}`,
    vent: `${Math.round(values.minVentPct)}–${Math.round(values.maxVentPct)}`,
  };
}

/** A·B·C를 항상 깔아, 없는 채널은 없음으로 둔다. */
export function buildChannelGlanceRows(
  channels: PanelChannelContext[],
  draftByKey: Record<string, PanelDraft | null | undefined>,
  saveBaselineByKey: Record<string, PanelDraft | null | undefined>,
): ChannelGlanceRow[] {
  const ctxBySlot = new Map(channels.map((ctx) => [ctx.slot, ctx]));
  return CHANNEL_GLANCE_SLOTS.map((slot) => {
    const ctx = ctxBySlot.get(slot);
    if (!ctx) {
      return { slot, present: false, values: null, dirty: false };
    }
    const draft = draftByKey[slot] ?? null;
    const current = currentThermoForChannel(ctx.knownSettings, ctx.liveBaseline);
    const baseline = dirtyBaselineForChannel(
      saveBaselineByKey[slot],
      ctx.knownSettings,
      ctx.liveBaseline,
      ctx.command,
    );
    return {
      slot,
      present: true,
      values: draft ?? displayThermoForChannel(ctx.knownSettings, ctx.liveBaseline, saveBaselineByKey[slot], ctx.command) ?? current,
      dirty: isChannelDraftDirty(draft, baseline),
    };
  });
}

/** 탭을 바꿔도 유지된 채널 초안 중, LIVE/채널 설정과 다른 것만 모은다. */
export function collectDirtyChannelSaves(
  channels: PanelChannelContext[],
  draftByKey: Record<string, PanelDraft | null | undefined>,
  saveBaselineByKey: Record<string, PanelDraft | null | undefined>,
): DirtyChannelSave[] {
  const out: DirtyChannelSave[] = [];
  for (const ctx of channels) {
    const draft = draftByKey[ctx.slot];
    const baseline = dirtyBaselineForChannel(
      saveBaselineByKey[ctx.slot],
      ctx.knownSettings,
      ctx.liveBaseline,
      ctx.command,
    );
    if (!isChannelDraftDirty(draft, baseline) || !draft) continue;
    out.push({
      slot: ctx.slot,
      eqpmnCode: ctx.eqpmnCode,
      values: draft,
      current: currentThermoForChannel(ctx.knownSettings, ctx.liveBaseline),
    });
  }
  return out;
}

/**
 * 적용 클릭 스냅샷 + 보내기 직전 최신 초안을 합친다.
 * 마지막 채널 입력이 스냅샷보다 늦게 커밋돼도 빠지지 않게 한다.
 */
export function mergeDirtyChannelSaves(
  snapshot: DirtyChannelSave[],
  latest: DirtyChannelSave[],
): DirtyChannelSave[] {
  const latestBySlot = new Map(latest.map((row) => [row.slot, row]));
  const snapshotBySlot = new Map(snapshot.map((row) => [row.slot, row]));
  const slots = new Set<ChannelSlot>([
    ...snapshot.map((row) => row.slot),
    ...latest.map((row) => row.slot),
  ]);
  return CHANNEL_SAVE_ORDER.filter((slot) => slots.has(slot)).map(
    (slot) => latestBySlot.get(slot) ?? snapshotBySlot.get(slot)!,
  );
}
