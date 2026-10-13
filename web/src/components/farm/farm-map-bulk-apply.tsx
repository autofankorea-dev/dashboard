"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import {
  sendBulkThermoCommandAction,
  sendDeviceSettingsCommandsAction,
  type SendBulkThermoCommandResult,
} from "@/app/(dashboard)/controllers/actions";
import { parseDeviceAlarms } from "@/lib/controllers/device-alarm-command";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import {
  DEFAULT_ALARM_THRESHOLDS,
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/domain/alarms";
import { normalizeStallTyCode } from "@/lib/domain/stall-type";
import { isReadingOnline } from "@/lib/domain/reading-display";
import type { InlineStatusTone } from "@/components/common/inline-status-toast";
import { applyQueueStageCounts } from "@/lib/farm/apply-queue";
import {
  EMPTY_APPLY_PROGRESS,
  useApplyQueueOptional,
} from "@/components/farm/apply-queue-context";
import { SettingsCommandPresetStrip } from "@/components/farm/settings-command-preset-strip";
import { SettingsEditOverlay } from "@/components/farm/settings-edit-overlay";
import { useSelectedControllerPresets } from "@/components/farm/use-command-presets";
import {
  SharedSettingsStepper,
  UnifiedSettingsTable,
  type SettingsCell,
} from "@/components/farm/unified-settings-table";
import { dashboardAffordance, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import {
  BULK_CHANNEL_OPTIONS,
  buildBulkThermoCommands,
  bulkAlarmDraftSeed,
  bulkDraftsFromPreset,
  bulkSendSlots,
  bulkThermoDraftSeedByChannel,
  emptyBulkChannelDrafts,
  bulkModalBtn,
  readingNeedsChannelsHydration,
} from "@/components/farm/farm-map-bulk-apply-parts";
import { type ChannelSlot } from "@/lib/domain/iot-channel";
import type { PanelThermoValues } from "@/lib/controllers/controller-panel-draft";
import {
  readCommandPresets,
  removeCommandPreset,
  writeCommandPresets,
} from "@/lib/farm/command-presets";
import { useFarmLiveRefreshOptional } from "@/components/farm/farm-live-refresh";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

type Props = {
  controller: ControllerGridData;
  /** 일괄적용 모드 on/off */
  bulkMode: boolean;
  /** 선택된 축사유형(SP) 코드 목록 */
  selectedSps: string[];
  /** 모드 진입(토글 on) */
  onEnter: () => void;
  onClearSelection: () => void;
  onExit: () => void;
  /** 적용 완료 후 — toast·soft refresh 등 부모 처리 */
  onAfterApply?: (result: ApplyResult, feedback: BulkApplyFeedback) => void;
  /** ACK/LIVE 폴링 중 LIVE·commands 갱신 */
  onRefreshLive?: () => void;
  /** 일괄적용 off — 툴바 우측 (기간 선택 등) */
  trailing?: ReactNode;
  /** 모바일 목록 — bulk bar 한 줄 배치 (일괄적용 ↔ trailing) */
  trailingCompact?: boolean;
};

export type ApplyResult = {
  control: SendBulkThermoCommandResult | null;
  alarm: {
    ok: boolean;
    spCount: number;
    clearedOverrides?: number;
    error?: string;
    settings?: AlarmSettings;
  } | null;
};

export type BulkApplyOutcome = "success" | "partial" | "error";

export type BulkApplyFeedback = {
  message: string;
  tone: InlineStatusTone;
  title: string;
  outcome: BulkApplyOutcome;
};

type ApplyPhase = "idle" | "control" | "alarm";

function controlHadWork(result: ApplyResult): boolean {
  return result.control != null;
}

function alarmFailed(result: ApplyResult): boolean {
  return Boolean(result.alarm && !result.alarm.ok);
}

function controlHardFailed(result: ApplyResult): boolean {
  const c = result.control;
  if (!c) return false;
  if (c.error && c.sent === 0) return true;
  return !c.ok && c.sent === 0 && c.failed.length > 0;
}

function controlPartial(result: ApplyResult): boolean {
  const c = result.control;
  if (!c) return false;
  return c.failed.length > 0 && c.sent > 0;
}

/** 일괄 적용 결과 — 성공 / 부분 / 실패 분류 */
export function classifyBulkApplyResult(
  result: ApplyResult,
  opts?: {
    wantedControl?: boolean;
    offlineSkipped?: number;
    channelSkipped?: number;
  },
): BulkApplyOutcome {
  const wantedControl = opts?.wantedControl ?? controlHadWork(result);
  const offlineSkipped = opts?.offlineSkipped ?? 0;
  const channelSkipped = opts?.channelSkipped ?? 0;

  if (controlHardFailed(result) && alarmFailed(result)) return "error";
  if (controlHardFailed(result) && !result.alarm) return "error";
  if (alarmFailed(result) && !controlHadWork(result)) return "error";
  if (controlPartial(result) || alarmFailed(result)) return "partial";
  if (wantedControl && !controlHadWork(result) && offlineSkipped > 0) {
    return result.alarm?.ok ? "partial" : "error";
  }
  if (
    wantedControl &&
    channelSkipped > 0 &&
    (result.control?.sent ?? 0) > 0
  ) {
    return "partial";
  }
  if (
    wantedControl &&
    channelSkipped > 0 &&
    !controlHadWork(result) &&
    result.alarm?.ok
  ) {
    return "partial";
  }
  if (result.control && !result.control.ok && result.control.failed.length > 0) {
    return "partial";
  }
  return "success";
}

export function formatBulkApplyFeedback(
  result: ApplyResult,
  opts?: {
    wantedControl?: boolean;
    offlineSkipped?: number;
    channelSkipped?: number;
  },
): BulkApplyFeedback {
  const outcome = classifyBulkApplyResult(result, opts);
  const parts: string[] = [];
  const channelSkipped = opts?.channelSkipped ?? 0;

  if (result.control) {
    if (result.control.error && result.control.sent === 0) {
      parts.push(
        result.control.error === "forbidden" ||
          result.control.error === "unauthorized"
          ? "제어 권한 없음"
          : `제어 전송 실패 (${result.control.error})`,
      );
    } else {
      parts.push(`제어 ${result.control.sent}건 전송`);
      if (result.control.failed.length > 0) {
        parts.push(`실패 ${result.control.failed.length}건`);
      }
    }
  } else if (opts?.wantedControl && (opts.offlineSkipped ?? 0) > 0) {
    parts.push("온라인 컨트롤러 없음 · 제어 미전송");
  }

  if (opts?.wantedControl && channelSkipped > 0) {
    parts.push(
      `채널 미매칭 ${channelSkipped}대 제어 제외 (적용 채널 확인)`,
    );
  }

  if (result.alarm) {
    if (result.alarm.ok) {
      parts.push(`경보 명령 ${result.alarm.spCount}건 접수`);
      if ((result.alarm.clearedOverrides ?? 0) > 0) {
        parts.push(`개별 설정 ${result.alarm.clearedOverrides}건 제거`);
      }
    } else {
      parts.push(
        result.alarm.error
          ? `경보 명령 접수 실패 (${result.alarm.error})`
          : "경보 명령 접수 실패",
      );
    }
  }

  const message =
    parts.join(" · ") ||
    (outcome === "error" ? "일괄 적용 실패" : "일괄 적용 완료");

  const title =
    outcome === "success"
      ? "일괄 적용 완료"
      : outcome === "partial"
        ? "일부만 적용됨"
        : "일괄 적용 실패";

  const tone: InlineStatusTone =
    outcome === "success" ? "ok" : outcome === "partial" ? "warn" : "error";

  return { message, tone, title, outcome };
}

/** @deprecated — formatBulkApplyFeedback 사용 권장 */
export function formatBulkApplyToast(result: ApplyResult): string {
  return formatBulkApplyFeedback(result).message;
}

export function FarmMapBulkApply({
  controller,
  bulkMode,
  selectedSps,
  onEnter,
  onClearSelection,
  onExit,
  onAfterApply,
  onRefreshLive: _onRefreshLive,
  trailing,
  trailingCompact: _trailingCompact = false,
}: Props) {
  const liveRefresh = useFarmLiveRefreshOptional();
  const applyQueue = useApplyQueueOptional();
  const queueProgress = applyQueue?.progress ?? EMPTY_APPLY_PROGRESS;
  const queueRows = applyQueue?.rows ?? [];
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [applyPhase, setApplyPhase] = useState<ApplyPhase>("idle");
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastApplyOpts, setLastApplyOpts] = useState<{
    wantedControl: boolean;
    offlineSkipped: number;
    channelSkipped: number;
  } | null>(null);

  const [channelDrafts, setChannelDrafts] = useState(emptyBulkChannelDrafts);
  const [channelSeeds, setChannelSeeds] = useState(emptyBulkChannelDrafts);
  const [alarm, setAlarm] = useState<AlarmThresholds>(DEFAULT_ALARM_THRESHOLDS);
  const [alarmSeed, setAlarmSeed] = useState<AlarmThresholds>(DEFAULT_ALARM_THRESHOLDS);
  const [selectedCell, setSelectedCell] = useState<SettingsCell>({
    slot: "A",
    field: "setpoint",
  });
  const [pinnedSlots, setPinnedSlots] = useState<ChannelSlot[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  useEffect(() => {
    if (open) applyQueue?.setDockOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 시트 열릴 때만 숨김
  }, [open]);

  const spSet = useMemo(() => new Set(selectedSps), [selectedSps]);
  const targets = useMemo(
    () =>
      controller.readings.filter((r) =>
        spSet.has(normalizeStallTyCode(r.stallTyCode))
      ),
    [controller.readings, spSet]
  );
  const presetButtons = useSelectedControllerPresets(targets);
  const onlineTargets = useMemo(
    () => targets.filter((r) => isReadingOnline(r.status)),
    [targets]
  );
  const offlineCount = targets.length - onlineTargets.length;
  const awaitingChannelHydration = useMemo(
    () => onlineTargets.some(readingNeedsChannelsHydration),
    [onlineTargets],
  );

  /* enrich 완료 후 채널 hydration 안내 문구 해제 */
  if (
    open &&
    !awaitingChannelHydration &&
    error?.includes("채널 정보")
  ) {
    setError(null);
  }

  const openSettingsWithCurrent = useCallback(() => {
    const needsHydration = targets.some(
      (r) => isReadingOnline(r.status) && readingNeedsChannelsHydration(r),
    );
    if (needsHydration) {
      void liveRefresh?.revalidateFarmLive({ mode: "full" });
    }
    const thermo = bulkThermoDraftSeedByChannel(
      targets,
      controller.thermoSettings,
    );
    const seededAlarm = bulkAlarmDraftSeed(
      targets,
      selectedSps,
      controller.alarmSettings,
    );
    setChannelSeeds(thermo);
    setChannelDrafts(thermo);
    setAlarm(seededAlarm);
    setAlarmSeed(seededAlarm);
    setSelectedCell({ slot: "A", field: "setpoint" });
    setPinnedSlots([]);
    setActivePresetId(null);
    setError(
      needsHydration
        ? "채널 정보를 불러오는 중입니다. 잠시 후 다시 적용하세요."
        : null,
    );
    setResult(null);
    setOpen(true);
  }, [
    targets,
    controller.thermoSettings,
    controller.alarmSettings,
    selectedSps,
    liveRefresh,
  ]);

  const handlePickPreset = (id: string) => {
    const button = presetButtons.find((item) => item.id === id);
    if (!button) return;
    const applied = bulkDraftsFromPreset(channelDrafts, button.channels);
    if (applied.slots.length === 0) return;
    setChannelDrafts(applied.drafts);
    setPinnedSlots(applied.slots);
    setActivePresetId(id);
    setError(null);
  };

  const handleDeletePreset = (id: string) => {
    const button = presetButtons.find((item) => item.id === id);
    if (!button) return;
    writeCommandPresets(
      button.scope,
      removeCommandPreset(readCommandPresets(button.scope), button.sourceId),
    );
    if (activePresetId === id) setActivePresetId(null);
  };

  const valueChanged = (left: number, right: number) =>
    Math.abs(left - right) > 0.05;
  const draftTempChanged = BULK_CHANNEL_OPTIONS.some(
    (slot) =>
      valueChanged(channelDrafts[slot].setpoint, channelSeeds[slot].setpoint) ||
      valueChanged(channelDrafts[slot].deviation, channelSeeds[slot].deviation),
  );
  const draftVentChanged = BULK_CHANNEL_OPTIONS.some(
    (slot) =>
      channelDrafts[slot].minVent !== channelSeeds[slot].minVent ||
      channelDrafts[slot].maxVent !== channelSeeds[slot].maxVent,
  );
  const presetPinned = pinnedSlots.length > 0;
  const applyTemp = draftTempChanged || presetPinned;
  const applyVent = draftVentChanged || presetPinned;
  const applyAlarm =
    valueChanged(alarm.tempLow, alarmSeed.tempLow) ||
    valueChanged(alarm.tempHigh, alarmSeed.tempHigh);
  const nothingSelected = !applyTemp && !applyVent && !applyAlarm;
  const wantedControl = applyTemp || applyVent;
  const selectedChannels = useMemo(
    () =>
      bulkSendSlots(
        channelDrafts,
        channelSeeds,
        applyTemp,
        applyVent,
        pinnedSlots,
      ),
    [channelDrafts, channelSeeds, applyTemp, applyVent, pinnedSlots],
  );
  /** 온라인 대상이 전부 채널형일 때만 채널 선택이 필수 */
  const allChannelTargets = useMemo(
    () =>
      onlineTargets.length > 0 &&
      onlineTargets.every((r) => (r.channels?.length ?? 0) > 0),
    [onlineTargets],
  );
  const previewCommands = useMemo(
    () =>
      wantedControl
        ? buildBulkThermoCommands(onlineTargets, controller.thermoSettings, {
            applyTemp,
            applyVent,
            channelDrafts,
            selectedChannels,
          })
        : [],
    [
      wantedControl,
      onlineTargets,
      controller.thermoSettings,
      applyTemp,
      applyVent,
      channelDrafts,
      selectedChannels,
    ],
  );

  const dismissModal = useCallback(() => {
    if (running) return;
    setOpen(false);
    setResult(null);
    setLastApplyOpts(null);
    setError(null);
    setApplyPhase("idle");
  }, [running]);

  const runApply = async () => {
    if (running) return;
    setError(null);
    if (nothingSelected) {
      setError("적용할 항목을 1개 이상 선택하세요.");
      return;
    }
    const needsHydration = onlineTargets.some(readingNeedsChannelsHydration);
    if (wantedControl && needsHydration) {
      void liveRefresh?.revalidateFarmLive({ mode: "full" });
      setError(
        "채널 정보가 아직 없습니다. 불러온 뒤 다시 적용하세요.",
      );
      return;
    }
    if (
      wantedControl &&
      selectedChannels.length === 0 &&
      allChannelTargets &&
      !applyAlarm
    ) {
      setError("적용할 채널(1차/2차/3차)을 1개 이상 선택하세요.");
      return;
    }
    if (applyAlarm) {
      const err = parseDeviceAlarms({ lowTempC: alarm.tempLow, highTempC: alarm.tempHigh }) ? null : "저온 < 고온, 0~100℃, 0.1℃ 단위로 입력하세요.";
      if (err) {
        setError(err);
        return;
      }
    }

    setRunning(true);
    setApplyPhase("idle");
    let control: SendBulkThermoCommandResult | null = null;
    let alarmResult: ApplyResult["alarm"] = null;
    let channelSkipped = 0;
    let combinedChannels: Parameters<typeof sendBulkThermoCommandAction>[0] = [];

    try {
      // 1) 제어값(온도/환기) — 온라인 컨트롤러·활성 채널별 명령
      if (wantedControl && onlineTargets.length > 0) {
        setApplyPhase("control");
        const commands = buildBulkThermoCommands(
          onlineTargets,
          controller.thermoSettings,
          {
            applyTemp,
            applyVent,
            channelDrafts,
            selectedChannels,
          },
        );
        const commandedKeys = new Set(commands.map((c) => c.key));
        channelSkipped = onlineTargets.filter(
          (r) => (r.channels?.length ?? 0) > 0 && !commandedKeys.has(r.key),
        ).length;
        if (commands.length === 0) {
          if (!applyAlarm) {
            setError(
              "선택한 채널에 해당하는 제어 대상이 없습니다. 채널 선택을 확인하세요.",
            );
            return;
          }
          // 제어 0건이어도 알람만 이어서 적용
        } else {
          if (applyAlarm) { combinedChannels = commands; channelSkipped += commands.filter(c => !c.channel).length; }
          else control = await sendBulkThermoCommandAction(commands);
        }
      }

      // 2) 컨트롤러별 저온·고온 경보 — 선택 채널과 같은 패킷으로 전송
      if (applyAlarm) {
        setApplyPhase("alarm");
        const res = await sendDeviceSettingsCommandsAction(onlineTargets.map(r => ({ key: r.key, ...r.farmKey, moduleUid: r.moduleUid,
          stallTyCode: r.stallTyCode ?? "", stallNo: r.stallNo ?? "", eqpmnNo: r.eqpmnNo,
          channels: combinedChannels.filter(c => c.key === r.key && c.channel).map(c => ({ channel: c.channel!, eqpmnCode: c.eqpmnCode!, setpointTemp: c.setpointTemp, tempDeviation: c.tempDeviation, minVentPct: c.minVentPct, maxVentPct: c.maxVentPct })),
          alarmSettings: { lowTempC: alarm.tempLow, highTempC: alarm.tempHigh } })));
        alarmResult = { ok: res.ok, spCount: res.sent, error: res.error ?? res.failed[0]?.error };
        control = control ? { ok: control.ok && res.ok, sent: control.sent + res.sent, failed: [...control.failed, ...res.failed], sentItems: [...control.sentItems, ...res.sentItems] } : res;
      }

      const applied: ApplyResult = { control, alarm: alarmResult };
      const applyOpts = {
        wantedControl,
        offlineSkipped: offlineCount,
        channelSkipped,
      };
      const feedback = formatBulkApplyFeedback(applied, applyOpts);
      if (control?.sentItems?.length) {
        for (const item of control.sentItems) {
          liveRefresh?.patchThermoFromCommand(item.command);
        }
        applyQueue?.startSession(control.sentItems);
        onAfterApply?.(applied, feedback);
        setOpen(false);
        setResult(null);
        setLastApplyOpts(null);
        setError(null);
        onExit();
        return;
      }
      setLastApplyOpts(applyOpts);
      setResult(applied);
      onAfterApply?.(applied, feedback);
    } catch (e) {
      setError(
        e instanceof Error
          ? `적용 중 오류: ${e.message}`
          : "적용 중 오류가 발생했습니다. 네트워크를 확인한 뒤 다시 시도하세요.",
      );
    } finally {
      setApplyPhase("idle");
      setRunning(false);
    }
  };

  const closeAll = () => {
    dismissModal();
    onExit();
  };

  const resultFeedback = result
    ? formatBulkApplyFeedback(
        result,
        lastApplyOpts ?? {
          wantedControl: applyTemp || applyVent,
          offlineSkipped: offlineCount,
          channelSkipped: 0,
        },
      )
    : null;

  const alarmValidationError =
    applyAlarm &&
    !parseDeviceAlarms({
      lowTempC: alarm.tempLow,
      highTempC: alarm.tempHigh,
    })
      ? "저온 < 고온, 0~100℃, 0.1℃ 단위로 입력하세요."
      : null;
  const applyBlockedReason = nothingSelected
    ? "바꾼 값이 없습니다."
    : awaitingChannelHydration && wantedControl
      ? "채널 정보를 불러온 뒤 다시 적용하세요."
      : wantedControl && previewCommands.length === 0 && !applyAlarm
        ? "선택한 채널에 해당하는 온라인 컨트롤러가 없습니다."
        : alarmValidationError;

  const tableRows = BULK_CHANNEL_OPTIONS.map((slot) => ({
    slot,
    present: true,
    values: {
      setpointTemp: channelDrafts[slot].setpoint,
      tempDeviation: channelDrafts[slot].deviation,
      minVentPct: channelDrafts[slot].minVent,
      maxVentPct: channelDrafts[slot].maxVent,
    },
  }));
  const currentBySlot: Partial<
    Record<ChannelSlot | "ctrl", PanelThermoValues | null>
  > = Object.fromEntries(
    BULK_CHANNEL_OPTIONS.map((slot) => [
      slot,
      {
        setpointTemp: channelSeeds[slot].setpoint,
        tempDeviation: channelSeeds[slot].deviation,
        minVentPct: channelSeeds[slot].minVent,
        maxVentPct: channelSeeds[slot].maxVent,
      },
    ]),
  );
  const draftKey = {
    setpoint: "setpoint",
    deviation: "deviation",
    minVent: "minVent",
    maxVent: "maxVent",
  } as const;
  const selectedValue =
    selectedCell.slot === "alarm"
      ? selectedCell.field === "lowTempC"
        ? alarm.tempLow
        : alarm.tempHigh
      : selectedCell.slot === "ctrl"
        ? null
        : channelDrafts[selectedCell.slot][draftKey[selectedCell.field]];
  const selectedRaw =
    selectedCell.slot === "alarm"
      ? selectedCell.field === "lowTempC"
        ? alarmSeed.tempLow
        : alarmSeed.tempHigh
      : selectedCell.slot === "ctrl"
        ? null
        : channelSeeds[selectedCell.slot][draftKey[selectedCell.field]];
  const onStepperChange = (value: number) => {
    if (selectedCell.slot === "alarm") {
      setAlarm((current) =>
        selectedCell.field === "lowTempC"
          ? { ...current, tempLow: value }
          : { ...current, tempHigh: value },
      );
      return;
    }
    if (selectedCell.slot === "ctrl") return;
    const key = draftKey[selectedCell.field];
    const slot = selectedCell.slot;
    setChannelDrafts((prev) => ({
      ...prev,
      [slot]: { ...prev[slot], [key]: value },
    }));
  };

  const queueCounts = applyQueueStageCounts(
    queueRows.map((row) => ({
      status: row.command.status,
      liveConfirmed: row.liveConfirmed,
    })),
  );
  const queueCountLine = [
    queueCounts.접수 ? `접수 ${queueCounts.접수}` : null,
    queueCounts.전송 ? `전송 ${queueCounts.전송}` : null,
    queueCounts.확인 ? `확인 ${queueCounts.확인}` : null,
    queueCounts.실패 ? `실패 ${queueCounts.실패}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const overlayBody =
    result && resultFeedback ? (
      <div className="space-y-3 text-sm">
        <div
          className={cn(
            "flex items-center gap-2.5",
            resultFeedback.outcome === "success" && "text-[var(--status-ok)]",
            resultFeedback.outcome === "partial" &&
              "text-amber-800 dark:text-amber-300",
            resultFeedback.outcome === "error" && "text-red-700 dark:text-red-400",
          )}
        >
          {resultFeedback.outcome === "success" ? (
            <CheckCircle2 className="size-4" aria-hidden />
          ) : resultFeedback.outcome === "partial" ? (
            <AlertTriangle className="size-4" aria-hidden />
          ) : (
            <AlertCircle className="size-4" aria-hidden />
          )}
          <p className="font-semibold leading-snug">{resultFeedback.title}</p>
        </div>
        <ul className="space-y-1.5 leading-snug">
          {result.control ? (
            <li>
              제어 명령: 전송 {result.control.sent}건
              {result.control.failed.length > 0
                ? ` · 실패 ${result.control.failed.length}건`
                : ""}
              {result.control.error && result.control.sent === 0
                ? ` · ${result.control.error}`
                : ""}
              {offlineCount > 0 ? ` · 오프라인 ${offlineCount}대 제외` : ""}
            </li>
          ) : applyTemp || applyVent ? (
            <li className="text-amber-700 dark:text-amber-300">
              제어 명령: 온라인 컨트롤러가 없어 전송하지 않았습니다.
            </li>
          ) : null}
          {result.alarm ? (
            <li>
              임계 가이드:{" "}
              {result.alarm.ok
                ? `유형 ${result.alarm.spCount}개 갱신${
                    (result.alarm.clearedOverrides ?? 0) > 0
                      ? ` · 개별 설정 ${result.alarm.clearedOverrides}건 제거`
                      : ""
                  }`
                : `저장 실패 (${result.alarm.error ?? "오류"})`}
            </li>
          ) : null}
        </ul>
        {queueProgress.total > 0 ? (
          <div className="rounded-lg border px-3 py-2.5">
            <p className="font-semibold leading-snug">
              {queueProgress.failed > 0
                ? "일부 실패"
                : queueProgress.allOk
                  ? "확인 완료"
                  : queueProgress.timedOut
                    ? "일부 미확인"
                    : "적용 진행 중"}
            </p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              {queueCountLine}
            </p>
          </div>
        ) : null}
      </div>
    ) : running ? (
      <div className="flex flex-col items-center gap-2 py-6 text-center text-sm">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
        <p className="font-semibold">일괄 적용 중…</p>
        <p className="text-xs text-muted-foreground">
          {applyPhase === "alarm"
            ? "임계 가이드를 저장하고 있습니다."
            : applyPhase === "control"
              ? `제어 명령을 전송하고 있습니다. (${previewCommands.length || onlineTargets.length}건)`
              : "적용을 준비하고 있습니다."}
        </p>
      </div>
    ) : (
      <div className="space-y-3" data-unified-controller-settings>
        <div data-bulk-preset-strip>
          <p className="px-0.5 text-xs font-semibold">현장 명령</p>
          {presetButtons.length > 0 ? (
            <SettingsCommandPresetStrip
              items={presetButtons.map((button) => ({
                id: button.id,
                name: button.name,
                channels: button.channels,
                source: "personal" as const,
                removable: true,
                title: button.title,
              }))}
              activeId={activePresetId}
              disabled={running}
              canStore
              showCreate={false}
              seedChannels={{}}
              onPick={handlePickPreset}
              onDelete={handleDeletePreset}
              onCreate={() => "empty-channels"}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              선택한 컨트롤러에 저장된 설정값이 없습니다.
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          유형 {selectedSps.length} · 컨트롤러 {targets.length}
          {offlineCount > 0 ? ` · 온라인 ${onlineTargets.length}` : ""}
        </p>
        <UnifiedSettingsTable
          rows={tableRows}
          current={currentBySlot}
          selected={selectedCell}
          onSelect={setSelectedCell}
          alarm={{
            lowTempC: alarm.tempLow.toFixed(1),
            highTempC: alarm.tempHigh.toFixed(1),
            currentLow: alarmSeed.tempLow,
            currentHigh: alarmSeed.tempHigh,
          }}
          disabled={running}
        />
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          채널 {(applyTemp || applyVent) ? selectedChannels.length : 0}개 변경 · 알람{" "}
          {applyAlarm ? "변경됨" : "변경 없음"}
        </p>
      </div>
    );


  return (
    <>
      {/* 그리드 상단 커맨드 바 — FarmMapCard·지도 카드와 동일 타이포 스케일 */}
      <div
        className="flex min-w-0 shrink-0 flex-nowrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2 lg:gap-3 lg:px-4 lg:py-2.5"
        data-tour-id="farm-command-bar"
      >
        <div
          className="flex min-w-0 items-center gap-2 lg:gap-2.5"
          data-tour-id="bulk-apply"
        >
          <SlidersHorizontal
            className={cn(
              dashboardUi.iconSm,
              bulkMode ? "text-primary" : "text-muted-foreground"
            )}
            aria-hidden
          />
          <span className="truncate text-sm font-semibold leading-snug lg:text-lg">
            일괄적용
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={bulkMode}
            aria-label={bulkMode ? "일괄적용 종료" : "일괄적용 시작"}
            onClick={() => (bulkMode ? onExit() : onEnter())}
            className={cn(
              "relative h-5 w-9 shrink-0 rounded-full md:h-6 md:w-11",
              motionClass.microHover,
              bulkMode ? "bg-primary" : "bg-muted-foreground/30"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-4 rounded-full bg-white md:top-0.5 md:size-5",
                "transition-[left] duration-motion-normal ease-[var(--motion-ease-standard)]",
                bulkMode ? "left-[1.125rem] md:left-[1.375rem]" : "left-0.5"
              )}
            />
          </button>
        </div>

        <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2">
          {bulkMode ? (
            <>
              <button
                type="button"
                onClick={onClearSelection}
                disabled={selectedSps.length === 0}
                className={cn(
                  bulkModalBtn,
                  "shrink-0 border hover:bg-muted disabled:opacity-50"
                )}
              >
                선택해제
              </button>
              <button
                type="button"
                onClick={openSettingsWithCurrent}
                disabled={selectedSps.length === 0}
                className={cn(
                  bulkModalBtn,
                  dashboardAffordance.action,
                )}
              >
                설정입력
              </button>
            </>
          ) : trailing ? (
            trailing
          ) : null}
        </div>
      </div>

      <SettingsEditOverlay
        open={open}
        spacious
        title="컨트롤러 일괄 설정"
        primaryLabel={result ? "확인" : "변경값 적용"}
        primaryBusyLabel="적용 중…"
        primaryDisabled={!result && Boolean(applyBlockedReason)}
        busy={running}
        hint={
          result
            ? undefined
            : (applyBlockedReason ??
              "변경된 채널과 알람을 선택한 컨트롤러에 전송합니다.")
        }
        onClose={dismissModal}
        onPrimary={result ? closeAll : () => void runApply()}
        footerContent={
          open && !running && !result ? (
            <SharedSettingsStepper
              selected={selectedCell}
              value={selectedValue}
              raw={selectedRaw}
              disabled={running}
              onChange={onStepperChange}
            />
          ) : null
        }
      >
        {overlayBody}
      </SettingsEditOverlay>
    </>
  );
}
