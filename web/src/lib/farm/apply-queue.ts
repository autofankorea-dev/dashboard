import { commandChannelViews, type CommandChannelValues } from "@/lib/controllers/combined-channel-command";
import type { ThermoCommandStatus } from "@/lib/data/commands";
import { formatOrdinalNo } from "@/lib/farm/command-confirm";
import { formatStallTypeLabel } from "@/lib/data/stall-type";
import type { ChannelSlot } from "@/lib/data/iot-channel";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";

/** 적용 큐가 보여주는 최근 창. 통합 추이는 최근 ~1시간을 점으로 읽기 어렵다. */
export const APPLY_QUEUE_WINDOW_MS = 60 * 60 * 1000;
/** 방금 보낸 명령이 이력에 안 잡혀도 큐에 잠시 남김 */
export const APPLY_QUEUE_START_GRACE_MS = 8_000;

export const APPLY_QUEUE_STAGES = ["접수", "전송", "확인"] as const;
export type ApplyQueueStage = (typeof APPLY_QUEUE_STAGES)[number] | "실패";
export const APPLY_QUEUE_STAGE_COUNT = APPLY_QUEUE_STAGES.length;

export type ApplyQueueTicket = {
  status: ThermoCommandStatus;
  liveConfirmed: boolean;
};

export type ApplyQueueGauge = {
  filled: number;
  current: number;
  rest: number;
  fail: boolean;
};

export type ApplyQueueTargetParts = {
  stall: string;
  unit: string;
  channel: string | null;
};

export function applyQueueStage(ticket: ApplyQueueTicket): ApplyQueueStage {
  if (ticket.status === "failed" || ticket.status === "cancelled") return "실패";
  if (ticket.status === "applied") return "확인";
  if (ticket.status === "sent") return "전송";
  return "접수";
}

/** 막대 확인단은 DB `applied`. LIVE가 맞아도 sent면 상태 폴링을 이어 간다. */
export function applyQueueNeedsStatusPoll(ticket: ApplyQueueTicket): boolean {
  return ticket.status === "pending" || ticket.status === "sent";
}

/** 도크 LIVE 확인용. 이미 맞으면 farm LIVE refresh는 생략. */
export function applyQueueNeedsLiveRefresh(ticket: ApplyQueueTicket): boolean {
  if (ticket.liveConfirmed) return false;
  return ticket.status === "sent" || ticket.status === "applied";
}

export function applyQueueGauge(ticket: ApplyQueueTicket): ApplyQueueGauge {
  const stage = applyQueueStage(ticket);
  if (stage === "실패") {
    return { filled: 0, current: 1, rest: APPLY_QUEUE_STAGE_COUNT - 1, fail: true };
  }
  if (stage === "확인") {
    return { filled: APPLY_QUEUE_STAGE_COUNT, current: 0, rest: 0, fail: false };
  }
  const currentIndex = stage === "접수" ? 1 : 2;
  return {
    filled: currentIndex - 1,
    current: 1,
    rest: APPLY_QUEUE_STAGE_COUNT - currentIndex,
    fail: false,
  };
}

export function applyQueueShouldAutoCollapse(
  tickets: ApplyQueueTicket[],
  timedOut: boolean,
): boolean {
  if (timedOut || tickets.length === 0) return false;
  return tickets.every((ticket) => applyQueueStage(ticket) === "확인");
}

export function applyQueueHandleLabel(tickets: ApplyQueueTicket[]): string {
  const n = tickets.length;
  if (n === 0) return "적용 큐 · 최근 1시간";
  const failed = tickets.filter((t) => applyQueueStage(t) === "실패").length;
  if (failed > 0) return `적용 ${n} · 실패 ${failed}`;
  const stuck = tickets.find((t) => applyQueueStage(t) !== "확인");
  if (stuck) return `적용 ${n} · ${applyQueueStage(stuck)}`;
  return `적용 ${n} · 확인`;
}

export function applyQueueStageCounts(tickets: ApplyQueueTicket[]) {
  const counts = { 접수: 0, 전송: 0, 확인: 0, 실패: 0 };
  for (const ticket of tickets) {
    counts[applyQueueStage(ticket)] += 1;
  }
  return counts;
}

export function formatApplyQueueTargetParts(opts: {
  stallTyCode?: string | null;
  stallNo?: string | null;
  eqpmnNo?: string | null;
  channel?: ChannelSlot | null;
}): ApplyQueueTargetParts {
  const typeLabel = formatStallTypeLabel(opts.stallTyCode);
  const stallNo = formatOrdinalNo(opts.stallNo);
  const ctrlNo = formatOrdinalNo(opts.eqpmnNo);
  return {
    stall: stallNo ? `${typeLabel} ${stallNo}번 축사` : typeLabel,
    unit: ctrlNo ? `${ctrlNo}번 컨트롤러` : "컨트롤러",
    channel: opts.channel ? `채널 ${opts.channel}` : null,
  };
}

export function formatApplyQueueTargetLine(opts: {
  stallTyCode?: string | null;
  stallNo?: string | null;
  eqpmnNo?: string | null;
  channel?: ChannelSlot | null;
}): string {
  const parts = formatApplyQueueTargetParts(opts);
  return [parts.stall, parts.unit, parts.channel].filter(Boolean).join(" · ");
}

export function applyQueueStep(ticket: ApplyQueueTicket): number {
  const stage = applyQueueStage(ticket);
  if (stage === "확인") return APPLY_QUEUE_STAGE_COUNT;
  if (stage === "전송") return 2;
  return 1;
}

export function applyQueueCaption(ticket: ApplyQueueTicket): string {
  return `${applyQueueStage(ticket)} · ${applyQueueStep(ticket)}/${APPLY_QUEUE_STAGE_COUNT}`;
}

const CHANNEL_STRIP_ORDER: ChannelSlot[] = ["A", "B", "C"];

/** 덮개 잉크 게이지 — 실패는 1칸, 확인(applied)은 3칸. */
export function applyQueueInkFilled(ticket: ApplyQueueTicket): number {
  const gauge = applyQueueGauge(ticket);
  if (gauge.fail) return 1;
  return gauge.filled + gauge.current;
}

/** 행·덮개 막대 — 0~1. 실패 1칸, 확인 전체. */
export function applyQueueFillRatio(filled: number): number {
  return Math.max(0, Math.min(1, filled / APPLY_QUEUE_STAGE_COUNT));
}

export type ApplyQueueChannelStripItem = {
  id: string;
  slot: ChannelSlot | null;
  stage: ApplyQueueStage;
  filled: number;
};

export function applyQueueChannelStripForReading<
  T extends {
    id: string;
    key: string;
    liveConfirmed: boolean;
    command: {
      farmKey: FarmKey;
      moduleUid: number;
      controllerKey: string;
      channel?: ChannelSlot | null;
      channels?: CommandChannelValues[];
      status: ThermoCommandStatus;
    };
  },
>(rows: readonly T[], reading: {
  key: string;
  farmKey: FarmKey;
  moduleUid: number;
  controllerKey: string;
}): ApplyQueueChannelStripItem[] {
  const farmId = farmKeyId(reading.farmKey);
  const matched = rows.filter(
    (row) =>
      row.key === reading.key ||
      (farmKeyId(row.command.farmKey) === farmId &&
        row.command.moduleUid === reading.moduleUid &&
        row.command.controllerKey === reading.controllerKey),
  );
  const seen = new Set<string>();
  const items: ApplyQueueChannelStripItem[] = [];
  for (const row of matched.flatMap((r) => (commandChannelViews(r.command).length ? commandChannelViews(r.command) : [r.command]).map((command) => ({ ...r, command, id: r.command.channels?.length ? `${r.id}:${command.channel}` : r.id })))) {
    const slot = row.command.channel ?? null;
    const dedupe = slot ?? "_";
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const ticket = {
      status: row.command.status,
      liveConfirmed: row.liveConfirmed,
    };
    items.push({
      id: row.id,
      slot,
      stage: applyQueueStage(ticket),
      filled: applyQueueInkFilled(ticket),
    });
  }
  items.sort((a, b) => {
    const ia = a.slot ? CHANNEL_STRIP_ORDER.indexOf(a.slot) : CHANNEL_STRIP_ORDER.length;
    const ib = b.slot ? CHANNEL_STRIP_ORDER.indexOf(b.slot) : CHANNEL_STRIP_ORDER.length;
    return ia - ib;
  });
  return items;
}

export function applyQueueChannelStripAria(
  items: readonly ApplyQueueChannelStripItem[],
): string {
  if (items.length === 0) return "";
  return items
    .map((item) =>
      item.slot ? `채널 ${item.slot} ${item.stage}` : item.stage,
    )
    .join(", ");
}

export function isApplyQueueWatchStatus(
  status: ThermoCommandStatus,
): boolean {
  return status === "pending" || status === "sent" || status === "applied";
}

export function isApplyQueueInWindow(
  createdAt: string,
  nowMs = Date.now(),
): boolean {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return false;
  const age = nowMs - created;
  return age <= APPLY_QUEUE_WINDOW_MS && age >= -APPLY_QUEUE_START_GRACE_MS;
}

export function applyQueueTargetKey(command: {
  moduleUid: number;
  controllerKey: string;
  channel?: ChannelSlot | null;
}): string {
  return `${command.moduleUid}:${command.controllerKey}:${command.channel ?? "_"}`;
}

export function selectApplyQueueCommands<
  T extends {
    id: string;
    status: ThermoCommandStatus;
    createdAt: string;
    farmKey: FarmKey;
    moduleUid: number;
    controllerKey: string;
    channel?: ChannelSlot | null;
  },
>(
  commands: T[],
  farmKey: FarmKey | null,
  limit = 16,
  nowMs = Date.now(),
): T[] {
  if (!farmKey) return [];
  const farmId = farmKeyId(farmKey);
  const newestFirst = commands
    .filter((command) => farmKeyId(command.farmKey) === farmId)
    .filter((command) => isApplyQueueWatchStatus(command.status))
    .filter((command) => isApplyQueueInWindow(command.createdAt, nowMs))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const seen = new Set<string>();
  const selected: T[] = [];
  for (const command of newestFirst) {
    const target = applyQueueTargetKey(command);
    if (seen.has(target)) continue;
    seen.add(target);
    selected.push(command);
    if (selected.length >= limit) break;
  }
  return selected;
}

export function applyQueueReadingKey(
  readings: Array<{
    key: string;
    farmKey: FarmKey;
    moduleUid: number;
    controllerKey: string;
  }>,
  command: {
    farmKey: FarmKey;
    moduleUid: number;
    controllerKey: string;
  },
): string | null {
  const farmId = farmKeyId(command.farmKey);
  return (
    readings.find(
      (reading) =>
        farmKeyId(reading.farmKey) === farmId &&
        reading.moduleUid === command.moduleUid &&
        reading.controllerKey === command.controllerKey,
    )?.key ?? null
  );
}

/** LIVE 키가 없어도 최근 1시간 목록에 남긴다. */
export function applyQueueRowKey(
  readings: Array<{
    key: string;
    farmKey: FarmKey;
    moduleUid: number;
    controllerKey: string;
  }>,
  command: {
    farmKey: FarmKey;
    moduleUid: number;
    controllerKey: string;
  },
): string {
  return (
    applyQueueReadingKey(readings, command) ??
    `queue:${farmKeyId(command.farmKey)}:${command.moduleUid}:${command.controllerKey}`
  );
}
