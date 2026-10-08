import type { ChannelSlot } from "@/lib/data/iot-channel";

export const COMMAND_HOLD_CHANNELS: readonly ChannelSlot[] = ["A", "B", "C"];

/** 명령 이력 채널 표시. 기본은 전부 켬. */
export type CommandChannelFlags = Record<ChannelSlot, boolean>;

export const DEFAULT_COMMAND_CHANNEL_FLAGS: CommandChannelFlags = {
  A: true,
  B: true,
  C: true,
};

export function toggleCommandChannelFlag(
  prev: CommandChannelFlags,
  channel: ChannelSlot,
): CommandChannelFlags {
  return { ...prev, [channel]: !prev[channel] };
}

/** 명령 레인 온도구간 축 (설정온도 0~30℃와 동일). 본선 측정 Y와 분리. */
export const COMMAND_HOLD_TEMP_DOMAIN: readonly [number, number] = [0, 30];
/** 명령 레인 환기구간 축 */
export const COMMAND_HOLD_VENT_DOMAIN: readonly [number, number] = [0, 100];

/** 1차(A) 진함 → 3차(C) 옅음 */
export const COMMAND_HOLD_FILL_OPACITY: Record<ChannelSlot, number> = {
  A: 0.34,
  B: 0.2,
  C: 0.12,
};

export const COMMAND_HOLD_LINE_OPACITY: Record<ChannelSlot, number> = {
  A: 0.88,
  B: 0.55,
  C: 0.32,
};

/**
 * 명령 이력 선·창 — 팬 배기 토큰(보라). A/B/C는 색이 아니라 선 종류로만 구분.
 * 하드코딩 violet 금지.
 */
export const COMMAND_SETTING_COLOR = "var(--channel-fan-exhaust)";

export const COMMAND_SETTING_STROKE: Record<ChannelSlot, string> = {
  A: COMMAND_SETTING_COLOR,
  B: COMMAND_SETTING_COLOR,
  C: COMMAND_SETTING_COLOR,
};

/** A 실선 · B 점선 · C 이중점선(이점쇄선) */
export const COMMAND_SETTING_DASH: Record<ChannelSlot, string | undefined> = {
  A: undefined,
  B: "1.6 2.2",
  C: "6 2.2 1.3 2.2 1.3 2.2",
};

/** A·B·C 같은 투명 창. 겹친 구간은 합성으로 진해진다. 구분은 선 종류만. */
export const COMMAND_SETTING_FILL_OPACITY: Record<ChannelSlot, number> = {
  A: 0.16,
  B: 0.16,
  C: 0.16,
};

export const COMMAND_SETTING_LINE_OPACITY = 0.5;

export function commandSettingHasWindow(channel: ChannelSlot): boolean {
  return COMMAND_SETTING_FILL_OPACITY[channel] > 0;
}

export function commandHoldRowIndex(
  channel: ChannelSlot | null | undefined,
): number | null {
  if (channel === "A") return 0;
  if (channel === "B") return 1;
  if (channel === "C") return 2;
  return null;
}

export type CommandHoldValues = {
  channel: ChannelSlot;
  tempLo: number | null;
  tempHi: number | null;
  ventLo: number | null;
  ventHi: number | null;
};

export type CommandHoldSegment = CommandHoldValues & {
  markId: string;
  x0: number;
  x1: number;
};

function isFiniteNum(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v);
}

export function commandHoldBandRect(
  lo: number | null | undefined,
  hi: number | null | undefined,
  domain: readonly [number, number],
  bandTop: number,
  bandH: number,
): { y: number; h: number } | null {
  if (!isFiniteNum(lo) || !isFiniteNum(hi) || !(bandH > 0)) return null;
  const dLo = Math.min(domain[0], domain[1]);
  const dHi = Math.max(domain[0], domain[1]);
  if (!(dHi > dLo)) return null;
  if (hi < dLo || lo > dHi) return null;
  const cLo = Math.max(lo, dLo);
  const cHi = Math.min(hi, dHi);
  const yHi = bandTop + ((dHi - cHi) / (dHi - dLo)) * bandH;
  const yLo = bandTop + ((dHi - cLo) / (dHi - dLo)) * bandH;
  const y = Math.min(yHi, yLo);
  const h = Math.max(2, Math.abs(yLo - yHi));
  return { y, h };
}

export function buildCommandHoldSegments(
  marks: ReadonlyArray<{
    id: string;
    x: number;
    hold?: CommandHoldValues | null;
  }>,
  xEnd: number,
): CommandHoldSegment[] {
  type HoldMark = (typeof marks)[number];
  const byChannel: Record<ChannelSlot, HoldMark[]> = { A: [], B: [], C: [] };
  for (const mark of marks) {
    const ch = mark.hold?.channel;
    if (!ch || !byChannel[ch]) continue;
    if (!Number.isFinite(mark.x)) continue;
    byChannel[ch].push(mark);
  }
  const out: CommandHoldSegment[] = [];
  for (const ch of COMMAND_HOLD_CHANNELS) {
    const rows = [...byChannel[ch]].sort((a, b) => a.x - b.x);
    for (let i = 0; i < rows.length; i++) {
      const cur = rows[i]!;
      const hold = cur.hold;
      if (!hold) continue;
      const x0 = cur.x;
      const x1 = i + 1 < rows.length ? rows[i + 1]!.x : xEnd;
      if (!(x1 > x0)) continue;
      out.push({
        markId: cur.id,
        x0,
        x1,
        channel: hold.channel,
        tempLo: hold.tempLo,
        tempHi: hold.tempHi,
        ventLo: hold.ventLo,
        ventHi: hold.ventHi,
      });
    }
  }
  return out;
}
