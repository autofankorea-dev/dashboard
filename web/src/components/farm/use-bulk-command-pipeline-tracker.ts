"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchThermoCommandsBatchAction,
  type BulkSentCommandItem,
} from "@/app/(dashboard)/controllers/actions";
import {
  resolveThermoSettings,
  thermoFromDecoded,
  thermoValuesMatch,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";
import type { ThermoCommand, ThermoCommandStatus } from "@/lib/data/commands";
import type { BarnReading } from "@/lib/data/iot";
import {
  channelBySlot,
  type ChannelSlot,
} from "@/lib/data/iot-channel";
import {
  APPLY_QUEUE_START_GRACE_MS,
  applyQueueNeedsLiveRefresh,
  applyQueueNeedsStatusPoll,
  applyQueueReadingKey,
  applyQueueRowKey,
  isApplyQueueInWindow,
  isApplyQueueWatchStatus,
  selectApplyQueueCommands,
} from "@/lib/farm/apply-queue";
import type { FarmKey } from "@/lib/data/farm-key";

const PENDING_POLL_MS = 2000;
const SENT_POLL_MS = 4000;
const LIVE_POLL_MS = 5000;
const MAX_POLL_MS = 90_000;
const COMPLETE_AUTO_DISMISS_MS = 6500;
const QUEUE_AGE_TICK_MS = 30_000;

const STATUS_RANK: Record<ThermoCommandStatus, number> = {
  pending: 1,
  sent: 2,
  applied: 3,
  failed: 3,
  cancelled: 3,
};

export type BulkLiveTrackRow = {
  key: string;
  id: string;
  command: ThermoCommand;
  liveConfirmed: boolean;
};

export type BulkLiveProgress = {
  total: number;
  ackDone: number;
  liveDone: number;
  failed: number;
  pending: number;
  timedOut: boolean;
  /** 실측 확인 또는 실패·시간 초과로 티켓이 끝남 */
  complete: boolean;
  allLive: boolean;
  /** 실패 없이 전부 실측 확인 — 도크 자동 접힘 */
  allOk: boolean;
  ackSettled: boolean;
};

type Args = {
  thermoSettings: Record<string, ControllerThermoSettings>;
  readings: BarnReading[];
  /** 이 농장 명령 이력 — 최근 1시간 접수·전송·확인(취소·실패 제외)을 큐에 반영 */
  watchCommands?: ThermoCommand[];
  farmKey?: FarmKey | null;
  /** farm soft refresh / RSC refresh */
  onRefreshLive?: () => void;
  /** ACK(sent/applied) 시 UI 설정값을 명령값으로 유지 */
  onCommandAck?: (cmd: ThermoCommand) => void;
};

type ThermoValues = Pick<
  ControllerThermoSettings,
  "setpointTemp" | "tempDeviation" | "minVentPct" | "maxVentPct"
>;

function mergeCommand(
  prev: ThermoCommand,
  next: ThermoCommand | null | undefined,
): ThermoCommand {
  if (!next || next.id !== prev.id) return prev;
  if (STATUS_RANK[next.status] >= STATUS_RANK[prev.status]) return next;
  return prev;
}

function isAckDone(status: ThermoCommandStatus): boolean {
  return status === "sent" || status === "applied";
}

function isTerminalFail(status: ThermoCommandStatus): boolean {
  return status === "failed" || status === "cancelled";
}

/**
 * LIVE uplink 실측값.
 * - 채널 명령: 해당 슬롯만 (A 폴백 금지 — B 조기 완료 오탐 방지)
 * - 레거시(CTRL): A 우선 후 다른 채널·루트 thermo
 */
function liveThermoFromReading(
  r: BarnReading,
  channel?: ChannelSlot | null,
): ThermoValues | null {
  if (r.channels?.length) {
    if (channel) {
      return thermoFromDecoded(
        channelBySlot(r.channels, channel)?.thermo ?? null,
      );
    }
    const chA = channelBySlot(r.channels, "A")?.thermo;
    const fromA = thermoFromDecoded(chA ?? null);
    if (fromA) return fromA;
    for (const ch of r.channels) {
      const parsed = thermoFromDecoded(ch.thermo);
      if (parsed) return parsed;
    }
  }
  return thermoFromDecoded(r.thermo ?? null);
}

function liveCandidatesForReading(
  reading: BarnReading,
  thermoSettings: Record<string, ControllerThermoSettings>,
  channel?: ChannelSlot | null,
): ThermoValues[] {
  const candidates: ThermoValues[] = [];
  const fromReading = liveThermoFromReading(reading, channel);
  if (fromReading) candidates.push(fromReading);

  if (channel) {
    const fromMap = resolveThermoSettings(
      thermoSettings,
      reading.farmKey,
      reading.moduleUid,
      reading.controllerKey,
      channel,
    );
    if (fromMap?.source === "live") candidates.push(fromMap);
  } else {
    const fromMap =
      resolveThermoSettings(
        thermoSettings,
        reading.farmKey,
        reading.moduleUid,
        reading.controllerKey,
        "A",
      ) ??
      resolveThermoSettings(
        thermoSettings,
        reading.farmKey,
        reading.moduleUid,
        reading.controllerKey,
      );
    if (fromMap?.source === "live") candidates.push(fromMap);
  }

  return candidates;
}

function commandAlreadyLive(
  command: ThermoCommand,
  key: string,
  readingByKey: Map<string, BarnReading>,
  thermoSettings: Record<string, ControllerThermoSettings>,
): boolean {
  if (!isAckDone(command.status)) return false;
  const reading = readingByKey.get(key);
  if (!reading) return false;
  return liveCandidatesForReading(
    reading,
    thermoSettings,
    command.channel,
  ).some((values) => thermoValuesMatch(values, command));
}

export function useBulkCommandPipelineTracker({
  thermoSettings,
  readings,
  watchCommands,
  farmKey,
  onRefreshLive,
  onCommandAck,
}: Args) {
  const [rows, setRows] = useState<BulkLiveTrackRow[]>([]);
  const [active, setActive] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const awaitingFoldRef = useRef(false);
  const rowsRef = useRef(rows);
  const onRefreshLiveRef = useRef(onRefreshLive);
  const onCommandAckRef = useRef(onCommandAck);
  useEffect(() => {
    onRefreshLiveRef.current = onRefreshLive;
  });
  useEffect(() => {
    onCommandAckRef.current = onCommandAck;
  });

  const readingByKey = useMemo(() => {
    const map = new Map<string, BarnReading>();
    for (const r of readings) map.set(r.key, r);
    return map;
  }, [readings]);

  const startSession = useCallback((items: BulkSentCommandItem[]) => {
    if (items.length === 0) {
      return;
    }
    const incoming: BulkLiveTrackRow[] = items.map((item) => ({
      key: item.key,
      id: item.id,
      command: item.command,
      liveConfirmed: false,
    }));
    setRows((prev) => {
      const rest = prev.filter(
        (row) => !incoming.some((item) => item.id === row.id),
      );
      return [...incoming, ...rest].slice(0, 16);
    });
    setActive(true);
    setTimedOut(false);
    setBannerVisible(true);
    startedAtRef.current = Date.now();
    awaitingFoldRef.current = true;
  }, []);

  const watchKey = useMemo(() => {
    if (!farmKey || !watchCommands) return "";
    return selectApplyQueueCommands(watchCommands, farmKey)
      .map((command) => `${command.id}:${command.status}`)
      .join("|");
  }, [farmKey, watchCommands]);

  useEffect(() => {
    if (!farmKey || !watchCommands) return;
    const selected = selectApplyQueueCommands(watchCommands, farmKey);
    setRows((prev) => {
      const prevMap = new Map(prev.map((row) => [row.id, row]));
      const next: BulkLiveTrackRow[] = [];
      let addedOpen = 0;
      for (const command of selected) {
        const existing = prevMap.get(command.id);
        if (existing) {
          next.push({
            ...existing,
            command: mergeCommand(existing.command, command),
          });
          continue;
        }
        const readingKey = applyQueueReadingKey(readings, command);
        const key = applyQueueRowKey(readings, command);
        const liveConfirmed = readingKey
          ? commandAlreadyLive(
              command,
              readingKey,
              readingByKey,
              thermoSettings,
            )
          : false;
        next.push({
          key,
          id: command.id,
          command,
          liveConfirmed,
        });
        if (!liveConfirmed) addedOpen += 1;
      }
      const nextIds = new Set(next.map((row) => row.id));
      const nowMs = Date.now();
      for (const row of prev) {
        if (nextIds.has(row.id)) continue;
        if (row.liveConfirmed) {
          if (isApplyQueueInWindow(row.command.createdAt, nowMs)) {
            next.push(row);
          }
          continue;
        }
        if (!isApplyQueueWatchStatus(row.command.status)) continue;
        const created = Date.parse(row.command.createdAt);
        if (
          Number.isFinite(created) &&
          nowMs - created < APPLY_QUEUE_START_GRACE_MS
        ) {
          next.push(row);
        }
      }
      const limited = next.slice(0, 16);
      if (addedOpen > 0) {
        queueMicrotask(() => {
          awaitingFoldRef.current = true;
          setActive(true);
          setTimedOut(false);
          setBannerVisible(true);
          if (startedAtRef.current == null) startedAtRef.current = Date.now();
        });
      } else if (limited.length > 0) {
        queueMicrotask(() => setActive(true));
      }
      return limited;
    });
  }, [watchKey, farmKey, watchCommands, readings, readingByKey, thermoSettings]);

  const dismissBanner = useCallback(() => {
    setBannerVisible((open) => !open);
  }, []);

  const setDockOpen = useCallback((open: boolean) => {
    setBannerVisible(open);
  }, []);

  const clearSession = useCallback(() => {
    setRows([]);
    setActive(false);
    setTimedOut(false);
    setBannerVisible(false);
    startedAtRef.current = null;
    awaitingFoldRef.current = false;
  }, []);

  // LIVE 일치 확인 — reading 디코드 실측 우선 (명령 merge map은 source≠live라 오탐/미탐 방지)
  // effect setState 대신 render-time derive — cascading render 경고 회피
  const trackedRows = useMemo(() => {
    if (!active || rows.length === 0) return rows;
    let changed = false;
    const next = rows.map((row) => {
      if (row.liveConfirmed || isTerminalFail(row.command.status)) return row;
      // pending만 있고 LIVE 이전 설정과 우연히 같으면 오탐 — sent/applied 이후만
      if (row.command.status === "pending") return row;
      const reading = readingByKey.get(row.key);
      if (!reading) return row;
      const matched = liveCandidatesForReading(
        reading,
        thermoSettings,
        row.command.channel,
      ).some((values) => thermoValuesMatch(values, row.command));
      if (!matched) return row;
      changed = true;
      return { ...row, liveConfirmed: true };
    });
    return changed ? next : rows;
  }, [active, readingByKey, thermoSettings, rows]);

  useEffect(() => {
    rowsRef.current = trackedRows;
  });

  const progress = useMemo((): BulkLiveProgress => {
    const total = trackedRows.length;
    let ackDone = 0;
    let liveDone = 0;
    let failed = 0;
    let pending = 0;
    for (const row of trackedRows) {
      if (row.liveConfirmed) liveDone += 1;
      if (isTerminalFail(row.command.status)) failed += 1;
      else if (isAckDone(row.command.status)) ackDone += 1;
      else pending += 1;
    }
    const allAcked =
      total > 0 &&
      trackedRows.every(
        (r) => isAckDone(r.command.status) || isTerminalFail(r.command.status),
      );
    const allOk =
      total > 0 &&
      trackedRows.every(
        (r) => r.liveConfirmed && !isTerminalFail(r.command.status),
      );
    const allSettled =
      total > 0 &&
      trackedRows.every(
        (r) => r.liveConfirmed || isTerminalFail(r.command.status),
      );
    const allLive = total > 0 && liveDone === total;
    return {
      total,
      ackDone,
      liveDone,
      failed,
      pending,
      timedOut,
      complete: allSettled || timedOut,
      allLive,
      allOk,
      ackSettled: allAcked,
    };
  }, [trackedRows, timedOut]);

  const pollSignature = useMemo(
    () =>
      trackedRows
        .map((r) => `${r.id}:${r.command.status}:${r.liveConfirmed ? 1 : 0}`)
        .join("|"),
    [trackedRows],
  );

  // 폴링 — 명령 status + LIVE refresh
  useEffect(() => {
    if (!active || trackedRows.length === 0) return;

    const openRows = trackedRows.filter((r) => {
      const ticket = {
        status: r.command.status,
        liveConfirmed: r.liveConfirmed,
      };
      return (
        applyQueueNeedsStatusPoll(ticket) || applyQueueNeedsLiveRefresh(ticket)
      );
    });
    if (openRows.length === 0) return;

    const anyPending = openRows.some((r) => r.command.status === "pending");
    const anySent = openRows.some((r) =>
      applyQueueNeedsStatusPoll({
        status: r.command.status,
        liveConfirmed: r.liveConfirmed,
      }),
    );
    const awaitingLive = openRows.some((r) =>
      applyQueueNeedsLiveRefresh({
        status: r.command.status,
        liveConfirmed: r.liveConfirmed,
      }),
    );
    const intervalMs = anyPending
      ? PENDING_POLL_MS
      : anySent
        ? SENT_POLL_MS
        : awaitingLive
          ? LIVE_POLL_MS
          : null;
    if (!intervalMs) return;

    let cancelled = false;
    let inFlight = false;
    const ids = openRows.map((r) => r.id);

    const tick = async () => {
      if (cancelled || inFlight) return;
      if (typeof document !== "undefined" && document.hidden) return;
      const started = startedAtRef.current;
      if (started != null && Date.now() - started >= MAX_POLL_MS) {
        setTimedOut(true);
        return;
      }
      inFlight = true;
      try {
        const updates = await fetchThermoCommandsBatchAction(ids);
        if (cancelled) return;
        const acked: ThermoCommand[] = [];
        setRows((prev) =>
          prev.map((row) => {
            const fetched = updates.find((u) => u?.id === row.id) ?? null;
            const command = mergeCommand(row.command, fetched);
            if (command !== row.command) {
              // ACK 직후 UI는 LIVE 옛값보다 명령값 유지
              if (
                isAckDone(command.status) &&
                !isAckDone(row.command.status)
              ) {
                acked.push(command);
              }
              return { ...row, command };
            }
            return row;
          }),
        );
        if (acked.length > 0) {
          // setState updater 안에서 부모 patch 금지 — render 경합 방지
          queueMicrotask(() => {
            if (cancelled) return;
            for (const cmd of acked) {
              onCommandAckRef.current?.(cmd);
            }
          });
        }
        // pending-only 구간은 명령 status만. LIVE n/N 확인 중일 때만 farm LIVE 갱신
        if (awaitingLive) {
          queueMicrotask(() => {
            if (!cancelled) onRefreshLiveRef.current?.();
          });
        }
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, intervalMs);
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // pollSignature drives restart only when status/live set changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rows captured via signature
  }, [active, pollSignature]);

  // 진행 중이던 건이 전부 확인되면 카드만 접힘. 최근 1시간 티켓은 유지.
  useEffect(() => {
    if (!bannerVisible || !progress.allOk || progress.timedOut) return;
    if (!awaitingFoldRef.current) return;
    const id = window.setTimeout(() => {
      awaitingFoldRef.current = false;
      setBannerVisible(false);
    }, COMPLETE_AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [bannerVisible, progress.allOk, progress.timedOut]);

  useEffect(() => {
    if (rows.length === 0) return;
    const tick = () => {
      const nowMs = Date.now();
      setRows((prev) => {
        const next = prev.filter((row) =>
          isApplyQueueInWindow(row.command.createdAt, nowMs),
        );
        return next.length === prev.length ? prev : next;
      });
    };
    const id = window.setInterval(tick, QUEUE_AGE_TICK_MS);
    return () => window.clearInterval(id);
  }, [rows.length]);

  return {
    active,
    bannerVisible,
    rows: trackedRows,
    progress,
    startSession,
    dismissBanner,
    setDockOpen,
    clearSession,
  };
}
