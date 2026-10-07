import { commandChannelViews, type CommandChannelValues } from "@/lib/controllers/combined-channel-command";
import {
  resolveThermoSettings,
  thermoFromDecoded,
  thermoValuesMatch,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";
import type { ThermoCommandStatus } from "@/lib/data/commands";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import { CHANNEL_SLOT_LABELS, type ChannelSlot } from "@/lib/data/iot-channel";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import {
  applyQueueStage,
  formatApplyQueueTargetLine,
  type ApplyQueueStage,
} from "@/lib/farm/apply-queue";
import { formatKst } from "@/lib/datetime/kst";
import { formatTempDisplay, formatVentDisplay } from "@/lib/farm/command-confirm";
import type { FarmChartScope } from "@/lib/farm/farm-chart-scope";
import { parseCategoryTimelineMs } from "@/lib/farm/trend-display-buckets";
import type { TrendEventLane, TrendEventMark } from "@/lib/data/trend-chart-types";
import { commandHoldRowIndex } from "@/lib/farm/command-hold-bands";

/** 차트 레인에 남기는 단계. 적용(`applied`=확인)만 그린다. */
export const COMMAND_HIT_STAGES = ["확인", "전송", "접수"] as const;

export type CommandHitStage = (typeof COMMAND_HIT_STAGES)[number];

export type CommandHitSource = {
  id: string;
  createdAt: string;
  status: ThermoCommandStatus;
  farmKey: FarmKey;
  moduleUid: number;
  controllerKey: string;
  stallTyCode: string;
  stallNo: string;
  eqpmnNo: string;
  channel?: ChannelSlot | null;
  channels?: CommandChannelValues[];
  action?: string;
  setpointTemp: number;
  tempDeviation: number;
  minVentPct: number;
  maxVentPct: number;
};

type DecodedThermo = {
  setpointTemp?: string | number;
  tempDeviation?: string | number;
  minVentPct?: number;
  maxVentPct?: number;
};

export type CommandHitReading = {
  farmKey: FarmKey;
  moduleUid: number;
  controllerKey: string;
  channels?: Array<{
    channel: ChannelSlot;
    thermo?: DecodedThermo | null;
  }>;
  thermo?: DecodedThermo | null;
};

export type CommandHitMark = {
  id: string;
  at: string;
  x: number;
  stage: CommandHitStage;
  target: string;
  targetRef?: {
    stallTyCode: string;
    stallNo: string;
    eqpmnNo: string;
    channel: ChannelSlot | null;
  };
  setpoint: string;
  deviation: string;
  vent: string;
  channel: ChannelSlot | null;
  tempLoC: number | null;
  tempHiC: number | null;
  minVentPct: number;
  maxVentPct: number;
};

export type CommandHitStats = {
  total: number;
  confirmed: number;
  hitPctLabel: string;
  hiddenCount: number;
};

export type CommandHitResult = {
  marks: CommandHitMark[];
  hiddenCount: number;
};

export type CommandHitAxis = {
  start: string;
  end: string;
};

/** 시간 구간에 나눠 남기고, 빈 칸은 최신으로 채운다.
 * 최신만 자르면 같은 날 대량 전송이 이전 날짜 유지띠를 밀어낸다.
 */
export const COMMAND_HIT_MAX_MARKS = 400;
const LIVE_END_MS = 2 * 60 * 60 * 1000;
const STAGE_KEEP_RANK: Record<CommandHitStage, number> = {
  확인: 3,
  전송: 2,
  접수: 1,
};
/** 추이 플롯 하단 명령 레인 높이(1×, A/B/C 3행). 차트 탭은 farm-chart-ui 배율을 곱한다. */
export const COMMAND_HIT_LANE_PX = 96;

export function isCommandHitStage(
  stage: ApplyQueueStage,
): stage is CommandHitStage {
  return (
    stage === "확인" ||
    stage === "전송" ||
    stage === "접수"
  );
}

/** 통합 추이 카테고리 첫·끝 시각. 파싱 실패 시 fallback(브러시). */
export function commandHitTimeSpan(
  categories: string[],
  fallback?: { fromMs: number; toMs: number } | null,
): { fromMs: number; toMs: number } | null {
  const parsed = parseCategoryTimelineMs(categories);
  if (parsed && parsed.length >= 2) {
    const fromMs = parsed[0]!;
    const toMs = parsed[parsed.length - 1]!;
    if (Number.isFinite(fromMs) && Number.isFinite(toMs) && toMs > fromMs) {
      return { fromMs, toMs };
    }
  }
  const fromMs = fallback?.fromMs;
  const toMs = fallback?.toMs;
  if (
    fromMs != null &&
    toMs != null &&
    Number.isFinite(fromMs) &&
    Number.isFinite(toMs) &&
    toMs > fromMs
  ) {
    return { fromMs, toMs };
  }
  return null;
}

/** 데이터 시각 비율 0–1. 플롯 패딩은 TrendChart `xFor`와 같은 매퍼가 적용. */
export function commandHitX(
  createdAt: string,
  fromMs: number,
  toMs: number,
): number | null {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t) || !(toMs > fromMs)) return null;
  if (t < fromMs) return null;
  if (t > toMs) {
    /** 마지막 버킷 시각 직후 전송분 — 오른쪽 끝에 붙인다. */
    if (t - toMs <= LIVE_END_MS) return 1;
    return null;
  }
  return (t - fromMs) / (toMs - fromMs);
}

function stallNosEqual(a: string, b: string): boolean {
  const na = Number.parseInt(a.trim(), 10);
  const nb = Number.parseInt(b.trim(), 10);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return a.trim() === b.trim();
}

export function commandInChartScope(
  command: CommandHitSource,
  scope: FarmChartScope,
): boolean {
  if (scope.level === "farm") return true;
  if (normalizeStallTyCode(command.stallTyCode) !== normalizeStallTyCode(scope.stallTyCode)) {
    return false;
  }
  if (scope.level === "sp") return true;
  if (!stallNosEqual(command.stallNo, scope.stallNo)) return false;
  if (scope.level === "stall") return true;
  return command.controllerKey === scope.controllerKey;
}

function sameController(
  a: Pick<CommandHitSource, "farmKey" | "moduleUid" | "controllerKey">,
  b: Pick<CommandHitSource, "farmKey" | "moduleUid" | "controllerKey">,
): boolean {
  return (
    farmKeyId(a.farmKey) === farmKeyId(b.farmKey) &&
    a.moduleUid === b.moduleUid &&
    a.controllerKey === b.controllerKey
  );
}

function isChannelA(
  channel: ChannelSlot | null | undefined,
): boolean {
  return channel == null || channel === "A";
}

/**
 * B·C 명령의 설정온도는 A에 더하는 오프셋.
 * 같은 컨트롤러에서 이 시각 이전(포함) 최신 A 적용값, 없으면 LIVE A.
 */
export function latestChannelASetpoint(
  command: CommandHitSource,
  applied: readonly CommandHitSource[],
  readings: readonly CommandHitReading[] = [],
  thermoSettings: Record<string, ControllerThermoSettings> = {},
): number | null {
  if (isChannelA(command.channel)) return command.setpointTemp;
  let best: CommandHitSource | null = null;
  for (const row of applied) {
    if (!sameController(row, command)) continue;
    if (!isChannelA(row.channel)) continue;
    if (row.createdAt > command.createdAt) continue;
    if (!Number.isFinite(row.setpointTemp)) continue;
    if (!best || row.createdAt >= best.createdAt) best = row;
  }
  if (best && Number.isFinite(best.setpointTemp)) return best.setpointTemp;
  const reading = readings.find(
    (row) =>
      farmKeyId(row.farmKey) === farmKeyId(command.farmKey) &&
      row.moduleUid === command.moduleUid &&
      row.controllerKey === command.controllerKey,
  );
  if (reading) {
    const liveA = liveThermoForCommand(reading, "A");
    if (liveA && Number.isFinite(liveA.setpointTemp)) return liveA.setpointTemp;
  }
  const fromMap = resolveThermoSettings(
    thermoSettings,
    command.farmKey,
    command.moduleUid,
    command.controllerKey,
    "A",
  );
  return fromMap && Number.isFinite(fromMap.setpointTemp)
    ? fromMap.setpointTemp
    : null;
}

/** 차트 ℃ 구간. A는 절대값, B·C는 A+오프셋. */
export function commandAbsTempWindow(
  command: Pick<
    CommandHitSource,
    "channel" | "setpointTemp" | "tempDeviation"
  >,
  channelASetpoint: number | null,
): { loC: number; hiC: number } | null {
  const sp = command.setpointTemp;
  const dev = command.tempDeviation;
  if (!Number.isFinite(sp) || !Number.isFinite(dev)) return null;
  if (isChannelA(command.channel)) {
    return { loC: sp, hiC: sp + dev };
  }
  if (channelASetpoint == null || !Number.isFinite(channelASetpoint)) return null;
  const loC = channelASetpoint + sp;
  return { loC, hiC: loC + dev };
}

export function commandChannelLabel(
  channel: ChannelSlot | null | undefined,
): string | undefined {
  if (!channel) return undefined;
  return CHANNEL_SLOT_LABELS[channel];
}

function liveThermoForCommand(
  reading: CommandHitReading,
  channel?: ChannelSlot | null,
) {
  if (reading.channels?.length) {
    if (channel) {
      const slot = reading.channels.find((row) => row.channel === channel);
      return thermoFromDecoded(slot?.thermo ?? null);
    }
    const fromA = thermoFromDecoded(
      reading.channels.find((row) => row.channel === "A")?.thermo ?? null,
    );
    if (fromA) return fromA;
    for (const ch of reading.channels) {
      const parsed = thermoFromDecoded(ch.thermo ?? null);
      if (parsed) return parsed;
    }
  }
  return thermoFromDecoded(reading.thermo ?? null);
}

export function commandLiveConfirmed(
  command: CommandHitSource,
  readings: CommandHitReading[],
  thermoSettings: Record<string, ControllerThermoSettings> = {},
  confirmedIds?: ReadonlySet<string>,
): boolean {
  if (command.action === "SET_CONTROLLER_SETTINGS") return command.status === "applied";
  if (command.channels?.length) return commandChannelViews(command).every((view) => commandLiveConfirmed(view, readings, thermoSettings));
  if (confirmedIds?.has(command.id)) return true;
  if (command.status !== "sent" && command.status !== "applied") return false;
  const farmId = farmKeyId(command.farmKey);
  const reading = readings.find(
    (row) =>
      farmKeyId(row.farmKey) === farmId &&
      row.moduleUid === command.moduleUid &&
      row.controllerKey === command.controllerKey,
  );
  if (!reading) return false;
  const live = liveThermoForCommand(reading, command.channel);
  if (live && thermoValuesMatch(live, command)) return true;
  const fromMap = resolveThermoSettings(
    thermoSettings,
    command.farmKey,
    command.moduleUid,
    command.controllerKey,
    command.channel ?? undefined,
  );
  return Boolean(
    fromMap?.source === "live" && thermoValuesMatch(fromMap, command),
  );
}

export function commandHitStats(
  marks: readonly Pick<CommandHitMark, "stage">[],
  hiddenCount = 0,
): CommandHitStats {
  const confirmed = marks.filter((mark) => mark.stage === "확인").length;
  const total = marks.length;
  return {
    total,
    confirmed,
    hiddenCount,
    hitPctLabel:
      total === 0 ? "—" : `${Math.round((confirmed / total) * 100)}%`,
  };
}

export function commandHitStatsLine(
  windowLabel: string,
  stats: CommandHitStats,
): string {
  const count =
    stats.hiddenCount > 0
      ? `최근 ${stats.total}건`
      : `${stats.total}건`;
  return `${windowLabel} · 적용 ${count}`;
}

export function commandHitAxis(fromMs: number, toMs: number, nowMs: number): CommandHitAxis {
  return {
    start: formatKst(new Date(fromMs).toISOString(), "short"),
    end:
      Math.abs(toMs - nowMs) <= LIVE_END_MS
        ? "지금"
        : formatKst(new Date(toMs).toISOString(), "short"),
  };
}

export function commandHitNeighborId(
  marks: Array<{ id: string; at: string }>,
  selectedId: string | null,
  delta: number,
): string | null {
  if (marks.length === 0) return null;
  const ordered = [...marks].sort((a, b) => (a.at < b.at ? -1 : 1));
  if (delta === 0) return selectedId ?? ordered[ordered.length - 1]!.id;
  if (!Number.isFinite(delta)) {
    return delta > 0
      ? ordered[ordered.length - 1]!.id
      : ordered[0]!.id;
  }
  const index = ordered.findIndex((mark) => mark.id === selectedId);
  const from =
    index < 0 ? (delta > 0 ? -1 : ordered.length) : index;
  const next = Math.min(ordered.length - 1, Math.max(0, from + delta));
  return ordered[next]!.id;
}

function commandHitPayload(command: CommandHitSource): Pick<
  CommandHitMark,
  "setpoint" | "deviation" | "vent" | "target" | "targetRef"
> {
  return {
    target: formatApplyQueueTargetLine({
      stallTyCode: command.stallTyCode,
      stallNo: command.stallNo,
      eqpmnNo: command.eqpmnNo,
      channel: command.channel,
    }),
    targetRef: {
      stallTyCode: command.stallTyCode,
      stallNo: command.stallNo,
      eqpmnNo: command.eqpmnNo,
      channel: command.channel ?? null,
    },
    setpoint: formatTempDisplay(command.setpointTemp),
    deviation: `±${formatTempDisplay(command.tempDeviation)}`,
    vent: `${formatVentDisplay(command.minVentPct).replace("%", "")}–${formatVentDisplay(command.maxVentPct)}`,
  };
}

function pickMarkInBucket(bucket: CommandHitMark[]): CommandHitMark {
  let best = bucket[0]!;
  for (const mark of bucket) {
    const bestRank = STAGE_KEEP_RANK[best.stage];
    const rank = STAGE_KEEP_RANK[mark.stage];
    if (rank > bestRank || (rank === bestRank && mark.at >= best.at)) {
      best = mark;
    }
  }
  return best;
}

/**
 * 상한을 넘으면 시간 구간에 나눠 남기고, 빈 칸은 최신으로 채운다.
 * 최신만 자르면 같은 날 대량 전송이 이전 날짜 유지띠를 밀어낸다.
 */
export function trimCommandHitMarks(
  marks: CommandHitMark[],
  limit: number,
): CommandHitMark[] {
  if (limit <= 0 || marks.length === 0) return [];
  const sorted = [...marks].sort((a, b) =>
    a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1,
  );
  if (sorted.length <= limit) return sorted;

  const t0 = Date.parse(sorted[0]!.at);
  const t1 = Date.parse(sorted[sorted.length - 1]!.at);
  const span = Math.max(1, t1 - t0);
  const buckets: CommandHitMark[][] = Array.from({ length: limit }, () => []);
  for (const mark of sorted) {
    const t = Date.parse(mark.at);
    const idx =
      !Number.isFinite(t) || span <= 1
        ? limit - 1
        : Math.min(limit - 1, Math.floor(((t - t0) / span) * limit));
    buckets[idx]!.push(mark);
  }

  const picked: CommandHitMark[] = [];
  const used = new Set<string>();
  for (const bucket of buckets) {
    if (bucket.length === 0) continue;
    const best = pickMarkInBucket(bucket);
    picked.push(best);
    used.add(best.id);
  }
  for (let i = sorted.length - 1; i >= 0 && picked.length < limit; i--) {
    const mark = sorted[i]!;
    if (used.has(mark.id)) continue;
    picked.push(mark);
    used.add(mark.id);
  }
  return picked.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

export function selectCommandHitResult(opts: {
  commands: CommandHitSource[];
  farmKey: FarmKey | null;
  scope: FarmChartScope;
  fromMs: number;
  toMs: number;
  readings?: CommandHitReading[];
  thermoSettings?: Record<string, ControllerThermoSettings>;
  confirmedIds?: ReadonlySet<string>;
  limit?: number;
}): CommandHitResult {
  const farmKey = opts.farmKey;
  if (!farmKey) return { marks: [], hiddenCount: 0 };
  const farmId = farmKeyId(farmKey);
  const limit = opts.limit ?? COMMAND_HIT_MAX_MARKS;

  const applied = opts.commands.flatMap(commandChannelViews)
    .filter((command) => farmKeyId(command.farmKey) === farmId)
    .filter((command) => command.status === "applied")
    .filter((command) => commandInChartScope(command, opts.scope));
  const readings = opts.readings ?? [];
  const thermoSettings = opts.thermoSettings ?? {};

  const eligible = applied
    .map((command) => {
      const x = commandHitX(command.createdAt, opts.fromMs, opts.toMs);
      if (x == null) return null;
      const stage = applyQueueStage({
        status: command.status,
        liveConfirmed: false,
      });
      if (!isCommandHitStage(stage) || stage !== "확인") return null;
      const aBase = latestChannelASetpoint(
        command,
        applied,
        readings,
        thermoSettings,
      );
      const abs = commandAbsTempWindow(command, aBase);
      const mark: CommandHitMark = {
        id: ["SET_CHANNELS_THERMO", "SET_CONTROLLER_SETTINGS"].includes(command.action ?? "") ? `${command.id}:${command.channel}` : command.id,
        at: command.createdAt,
        x,
        stage: "확인",
        channel: command.channel ?? null,
        tempLoC: abs?.loC ?? null,
        tempHiC: abs?.hiC ?? null,
        minVentPct: command.minVentPct,
        maxVentPct: command.maxVentPct,
        ...commandHitPayload(command),
      };
      return mark;
    })
    .filter((mark): mark is CommandHitMark => mark != null);

  const trimmed = trimCommandHitMarks(eligible, limit);
  return {
    marks: trimmed,
    hiddenCount: Math.max(0, eligible.length - trimmed.length),
  };
}

export function selectCommandHitMarks(
  opts: Parameters<typeof selectCommandHitResult>[0],
): CommandHitMark[] {
  return selectCommandHitResult(opts).marks;
}

function commandHitInfoStrength(
  stage: CommandHitStage,
): 1 | 2 | 3 | undefined {
  if (stage === "확인") return undefined;
  if (stage === "전송") return 2;
  return 1;
}

export function commandHitToEventMark(mark: CommandHitMark): TrendEventMark {
  const channelLabel = commandChannelLabel(mark.channel);
  const row = commandHoldRowIndex(mark.channel) ?? 0;
  const hold =
    mark.channel != null
      ? {
          channel: mark.channel,
          tempLo: mark.tempLoC,
          tempHi: mark.tempHiC,
          ventLo: mark.minVentPct,
          ventHi: mark.maxVentPct,
        }
      : undefined;
  return {
    id: mark.id,
    atMs: Date.parse(mark.at),
    row,
    tone: mark.stage === "확인" ? "ok" : "info",
    infoStrength: commandHitInfoStrength(mark.stage),
    ariaLabel: channelLabel
      ? `${formatKst(mark.at, "short")} ${mark.stage} ${channelLabel}`
      : `${formatKst(mark.at, "short")} ${mark.stage} ${mark.setpoint}`,
    markerLabel: mark.channel ?? undefined,
    hold,
    card: {
      badge: "명령",
      time: formatKst(mark.at, "short"),
      hero: channelLabel ?? mark.setpoint,
      heroTone: mark.stage === "확인" ? "ok" : undefined,
      target: mark.targetRef
        ? {
            stallTyCode: mark.targetRef.stallTyCode,
            stallNo: mark.targetRef.stallNo,
            eqpmnNo: mark.targetRef.eqpmnNo,
            channel: mark.targetRef.channel,
          }
        : undefined,
      rows: [
        { label: "설정온도", value: mark.setpoint },
        { label: "편차", value: mark.deviation },
        { label: "환기", value: mark.vent },
      ],
      footnote: mark.target,
    },
  };
}

export function commandHitEventLane(opts: {
  marks: CommandHitMark[];
  hiddenCount?: number;
  windowLabel: string;
}): TrendEventLane {
  const stats = commandHitStats(opts.marks, opts.hiddenCount ?? 0);
  return {
    label: "명령",
    rowLabels: ["A", "B", "C"],
    statsLine: commandHitStatsLine(opts.windowLabel, stats),
    emptyLabel: "이 구간에 적용된 명령이 없습니다.",
    marks: opts.marks.map((mark) => commandHitToEventMark(mark)),
  };
}
