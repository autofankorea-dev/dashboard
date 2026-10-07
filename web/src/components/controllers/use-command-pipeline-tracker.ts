"use client";

import { commandChannelViews } from "@/lib/controllers/combined-channel-command";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchThermoCommandAction } from "@/app/(dashboard)/controllers/actions";
import {
  commandStatusLabel,
  thermoValuesMatch,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";
import type { ThermoCommand, ThermoCommandStatus } from "@/lib/data/commands";
import type { ChannelSlot } from "@/lib/data/iot-channel";
import { farmKeyId } from "@/lib/data/farm-key";
import { pipelineDetailMessage } from "@/lib/ui/controller-labels";
import {
  addTimedId,
  hasTimedId,
} from "@/lib/controllers/command-pipeline-id-ttl";

/** C.py COMMAND_SLEEP_IDLE(2s)에 맞춘 pending 폴링 */
const PENDING_POLL_MS = 2000;
/** sent → applied uplink ACK 대기 */
const SENT_POLL_MS = 4000;
/** applied 후 LIVE 설정값 일치 확인 */
const LIVE_POLL_MS = 5000;
const MAX_POLL_MS = 150_000;

const STATUS_RANK: Record<ThermoCommandStatus, number> = {
  pending: 1,
  sent: 2,
  applied: 3,
  failed: 3,
  cancelled: 3,
};

/** 사용자가 닫은 「현장 반영 확인」 — remount·알람 저장 후에도 재표시 방지 (TTL) */
const dismissedLiveOverlayCommandIds = new Map<string, number>();
/** 적용 버튼(registerCommand)으로 시작된 명령만 현장 반영 확인 대상 (TTL) */
const userInitiatedCommandIds = new Map<string, number>();

function pollIntervalMs(
  status: ThermoCommandStatus,
  awaitingLive: boolean
): number | null {
  if (status === "pending") return PENDING_POLL_MS;
  if (status === "sent") return SENT_POLL_MS;
  if (status === "applied" && awaitingLive) return LIVE_POLL_MS;
  return null;
}

function pickFresherCommand(
  a: ThermoCommand | null,
  b: ThermoCommand | null
): ThermoCommand | null {
  if (!a) return b;
  if (!b) return a;
  if (a.id === b.id) {
    return STATUS_RANK[b.status] >= STATUS_RANK[a.status] ? b : a;
  }
  return a.createdAt >= b.createdAt ? a : b;
}

function findLatestForTarget(
  commands: ThermoCommand[],
  farmKey: { lsindRegistNo: string; itemCode: string } | undefined,
  moduleUid: number | undefined,
  controllerKey: string | undefined,
  hasChannels: boolean,
  activeChannel: ChannelSlot | undefined
): ThermoCommand | null {
  if (!farmKey || moduleUid == null || !controllerKey) return null;
  return (
    commands.find(
      (c) =>
        farmKeyId(c.farmKey) === farmKeyId(farmKey) &&
        c.moduleUid === moduleUid &&
        c.controllerKey === controllerKey &&
        (c.action === "SET_CONTROLLER_SETTINGS" || (hasChannels ? commandChannelViews(c).some((v) => v.channel === activeChannel) : !c.channel))
    ) ?? null
  );
}

export type CommandPipelineFlash = {
  tone: "ok" | "info" | "error";
  text: string;
};

type TrackerOpts = {
  commands: ThermoCommand[];
  farmKey?: { lsindRegistNo: string; itemCode: string };
  moduleUid?: number;
  controllerKey?: string;
  hasChannels: boolean;
  activeChannel?: ChannelSlot;
  /** 병합 설정값 — source===live일 때만 현장 반영 확인에 사용 */
  knownSettings: ControllerThermoSettings | null;
  /** LIVE 디코드 설정 (상세 API) — 현장 반영 확인 1순위 */
  liveThermo?: Pick<
    ControllerThermoSettings,
    "setpointTemp" | "tempDeviation" | "minVentPct" | "maxVentPct"
  > | null;
  /** 상세 LIVE 재조회 */
  onRefreshLive?: () => void;
};

/**
 * 1) 적용 API 응답으로 즉시 배너 표시
 * 2) pending→sent→applied 폴링 + 상태 전환 토스트
 * 3) LIVE 설정값 일치 시 「현장 반영 확인」
 */
export function useCommandPipelineTracker(opts: TrackerOpts) {
  const {
    commands,
    farmKey,
    moduleUid,
    controllerKey,
    hasChannels,
    activeChannel,
    knownSettings,
    liveThermo,
    onRefreshLive,
  } = opts;

  const [tracked, setTracked] = useState<ThermoCommand | null>(null);
  const [flash, setFlash] = useState<CommandPipelineFlash | null>(null);
  const [liveConfirmed, setLiveConfirmed] = useState(false);
  const prevStatusRef = useRef<ThermoCommandStatus | null>(null);
  const confirmedForIdRef = useRef<string | null>(null);
  const onRefreshLiveRef = useRef(onRefreshLive);
  useEffect(() => {
    onRefreshLiveRef.current = onRefreshLive;
  });

  const fromServer = useMemo(
    () =>
      findLatestForTarget(
        commands,
        farmKey,
        moduleUid,
        controllerKey,
        hasChannels,
        activeChannel
      ),
    [
      commands,
      farmKey,
      moduleUid,
      controllerKey,
      hasChannels,
      activeChannel,
    ]
  );

  const command = useMemo(
    () => pickFresherCommand(tracked, fromServer),
    [tracked, fromServer]
  );

  const registerCommand = useCallback((cmd: ThermoCommand) => {
    addTimedId(userInitiatedCommandIds, cmd.id);
    setTracked(cmd);
    setLiveConfirmed(false);
    confirmedForIdRef.current = null;
    prevStatusRef.current = cmd.status;
    setFlash({
      tone: "info",
      text: pipelineDetailMessage(cmd.status, cmd.errorMsg),
    });
  }, []);

  const clearFlash = useCallback(() => setFlash(null), []);

  const isCommandOverlayDismissed = useCallback(
    (commandId: string | undefined) =>
      commandId != null && hasTimedId(dismissedLiveOverlayCommandIds, commandId),
    []
  );

  const acknowledgeCommandOverlay = useCallback(
    (commandId: string) => {
      addTimedId(dismissedLiveOverlayCommandIds, commandId);
      setFlash(null);
    },
    []
  );

  const isUserInitiatedCommand = useCallback(
    (commandId: string | undefined) =>
      commandId != null && hasTimedId(userInitiatedCommandIds, commandId),
    []
  );

  // 컨트롤러·채널 전환 시 추적 초기화 (render-time prop sync)
  const trackScopeKey = `${controllerKey ?? ""}|${activeChannel ?? ""}|${moduleUid ?? ""}|${farmKey?.lsindRegistNo ?? ""}`;
  const [prevTrackScopeKey, setPrevTrackScopeKey] = useState(trackScopeKey);
  if (trackScopeKey !== prevTrackScopeKey) {
    setPrevTrackScopeKey(trackScopeKey);
    setTracked(null);
    setFlash(null);
    setLiveConfirmed(false);
  }

  useEffect(() => {
    prevStatusRef.current = null;
    confirmedForIdRef.current = null;
  }, [trackScopeKey]);

  // 서버 props가 추적 명령을 따라잡으면 병합 (render-time)
  if (tracked && fromServer) {
    if (fromServer.id !== tracked.id) {
      if (fromServer.createdAt >= tracked.createdAt) {
        setTracked(fromServer);
      }
    } else if (STATUS_RANK[fromServer.status] > STATUS_RANK[tracked.status]) {
      setTracked(fromServer);
    }
  }

  const commandId = command?.id;
  const commandStatus = command?.status;
  const channelView = command ? commandChannelViews(command).find((c) => c.channel === activeChannel) ?? command : null;
  const isCombined = Boolean(command?.channels?.length) || command?.action === "SET_CONTROLLER_SETTINGS";
  const commandSetpoint = channelView?.setpointTemp;
  const commandDeviation = channelView?.tempDeviation;
  const commandMinVent = channelView?.minVentPct;
  const commandMaxVent = channelView?.maxVentPct;
  const commandError = command?.errorMsg;
  useEffect(() => {
    if (commandId && (commandStatus === "failed" || commandStatus === "cancelled")) {
      onRefreshLiveRef.current?.();
    }
  }, [commandId, commandStatus]);
  const liveSource = knownSettings?.source;
  const liveSp =
    liveThermo?.setpointTemp ??
    (liveSource === "live" ? knownSettings?.setpointTemp : undefined);
  const liveDev =
    liveThermo?.tempDeviation ??
    (liveSource === "live" ? knownSettings?.tempDeviation : undefined);
  const liveMin =
    liveThermo?.minVentPct ??
    (liveSource === "live" ? knownSettings?.minVentPct : undefined);
  const liveMax =
    liveThermo?.maxVentPct ??
    (liveSource === "live" ? knownSettings?.maxVentPct : undefined);

  // 상태 전환 토스트
  useEffect(() => {
    if (commandId == null || commandStatus == null) return;
    const prev = prevStatusRef.current;
    if (prev != null && prev !== commandStatus) {
      const label = commandStatusLabel(commandStatus);
      const detail = pipelineDetailMessage(commandStatus, commandError);
      setFlash({
        tone:
          commandStatus === "failed"
            ? "error"
            : commandStatus === "applied"
              ? "ok"
              : "info",
        text: detail ? `${label} — ${detail}` : label,
      });
    }
    prevStatusRef.current = commandStatus;
  }, [commandId, commandStatus, commandError]);

  // 명령 없음·실패·취소 시 LIVE 확인 해제 (render-time)
  if (
    liveConfirmed &&
    (commandId == null ||
      commandStatus == null ||
      commandStatus === "failed" ||
      commandStatus === "cancelled")
  ) {
    setLiveConfirmed(false);
  }

  // LIVE 현장 반영 확인
  useEffect(() => {
    if (commandId == null || commandStatus == null) return;
    if (commandStatus === "failed" || commandStatus === "cancelled") return;
    if (confirmedForIdRef.current === commandId) return;
    if (hasTimedId(dismissedLiveOverlayCommandIds, commandId)) {
      confirmedForIdRef.current = commandId;
      return;
    }
    if (!hasTimedId(userInitiatedCommandIds, commandId)) return;
    if (commandStatus === "pending" || (isCombined && commandStatus !== "applied")) return;
    if (command?.action === "SET_CONTROLLER_SETTINGS") { confirmedForIdRef.current = commandId; queueMicrotask(() => setLiveConfirmed(true)); return; }
    if (
      commandSetpoint == null ||
      commandDeviation == null ||
      commandMinVent == null ||
      commandMaxVent == null ||
      liveSp == null ||
      liveDev == null ||
      liveMin == null ||
      liveMax == null
    ) {
      return;
    }
    if (
      !thermoValuesMatch(
        {
          setpointTemp: liveSp,
          tempDeviation: liveDev,
          minVentPct: liveMin,
          maxVentPct: liveMax,
        },
        {
          setpointTemp: commandSetpoint,
          tempDeviation: commandDeviation,
          minVentPct: commandMinVent,
          maxVentPct: commandMaxVent,
        },
      )
    ) {
      return;
    }

    confirmedForIdRef.current = commandId;
    queueMicrotask(() => {
      setLiveConfirmed(true);
      setFlash({
        tone: "ok",
        text: `LIVE 설정온도 ${commandSetpoint}℃가 명령과 일치합니다. 패널의 현재값을 확인하세요.`,
      });
    });
  }, [
    commandId,
    commandStatus,
    isCombined,
    command?.action,
    commandSetpoint,
    commandDeviation,
    commandMinVent,
    commandMaxVent,
    liveSp,
    liveDev,
    liveMin,
    liveMax,
  ]);

  const awaitingLive =
    Boolean(command) &&
    !liveConfirmed &&
    (command?.status === "sent" || command?.status === "applied");

  // 단건 폴링 + RSC/LIVE 갱신 (백그라운드 탭에서는 중단)
  useEffect(() => {
    if (!command?.id) return;
    const intervalMs = pollIntervalMs(command.status, awaitingLive);
    if (!intervalMs) return;

    const commandId = command.id;
    const deadline = Date.now() + MAX_POLL_MS;
    let cancelled = false;

    const tick = async () => {
      if (cancelled || Date.now() >= deadline) return;
      // 숨겨진 탭에서는 네트워크/리프레시 생략 → 복귀 시 재개
      if (typeof document !== "undefined" && document.hidden) return;
      const next = await fetchThermoCommandAction(commandId);
      if (cancelled) return;
      if (next) {
        setTracked((prev) => pickFresherCommand(prev, next));
      }
      // pending은 명령 status만 폴링. LIVE 일치 확인 단계에서만 detail/readings 갱신
      if (awaitingLive) {
        onRefreshLiveRef.current?.();
      }
    };

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, intervalMs);

    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [command?.id, command?.status, awaitingLive]);

  return {
    command,
    registerCommand,
    flash,
    clearFlash,
    liveConfirmed,
    isCommandOverlayDismissed,
    acknowledgeCommandOverlay,
    isUserInitiatedCommand,
  };
}
