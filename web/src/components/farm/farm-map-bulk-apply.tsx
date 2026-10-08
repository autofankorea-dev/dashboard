"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Layers,
  Loader2,
  Send,
  SlidersHorizontal,
  Thermometer,
  X,
} from "lucide-react";
import { ControllerDeviceIcon } from "@/components/icons/controller-device-icon";
import { ControllerTempDualSlider } from "@/components/controllers/controller-temp-dual-slider";
import { AlarmDomainIcon } from "@/components/settings/alarm-domain-icon";
import { ThresholdRangeSlider } from "@/components/settings/threshold-range-slider";
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
} from "@/lib/data/alarms";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { isReadingOnline } from "@/lib/data/reading-display";
import type { InlineStatusTone } from "@/components/common/inline-status-toast";
import { applyQueueStageCounts } from "@/lib/farm/apply-queue";
import {
  EMPTY_APPLY_PROGRESS,
  useApplyQueueOptional,
} from "@/components/farm/apply-queue-context";
import { SettingsCollapsibleSection } from "@/components/farm/settings-collapsible-section";
import { dashboardAffordance, dashboardChroma, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import {
  BULK_CHANNEL_OPTIONS,
  SectionToggle,
  buildBulkThermoCommands,
  bulkAlarmDraftSeed,
  bulkDirtyChannelSlots,
  bulkThermoDraftSeedByChannel,
  emptyBulkChannelDrafts,
  resolveBulkSendChannels,
  bulkModalShell,
  bulkModalSectionTitle,
  bulkModalMeta,
  bulkModalBtn,
  bulkModalSection,
  readingNeedsChannelsHydration,
} from "@/components/farm/farm-map-bulk-apply-parts";
import {
  CHANNEL_SLOT_LABELS,
  type ChannelSlot,
} from "@/lib/data/iot-channel";
import { useFarmLiveRefreshOptional } from "@/lib/navigation/farm-live-refresh";
import { motionClass } from "@/lib/ui/motion-classes";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

type BulkSettingsSectionId = "temp" | "alarm";

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
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const isMobile = useMobileLayout();
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

  const [applyTemp, setApplyTemp] = useState(true);
  const [applyVent, setApplyVent] = useState(true);
  const [applyAlarm, setApplyAlarm] = useState(true);
  const [openSection, setOpenSection] = useState<BulkSettingsSectionId | null>(
    null,
  );
  const [activeChannel, setActiveChannel] = useState<ChannelSlot>("A");
  const channelTablistRef = useRef<HTMLDivElement>(null);
  const [channelPill, setChannelPill] = useState({ left: 0, width: 0 });
  const [channelDrafts, setChannelDrafts] = useState(emptyBulkChannelDrafts);
  const [channelSeeds, setChannelSeeds] = useState(emptyBulkChannelDrafts);
  const [alarm, setAlarm] = useState<AlarmThresholds>(DEFAULT_ALARM_THRESHOLDS);

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
    setChannelSeeds(thermo);
    setChannelDrafts(thermo);
    setActiveChannel("A");
    setAlarm(
      bulkAlarmDraftSeed(
        targets,
        selectedSps,
        controller.alarmSettings,
      ),
    );
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

  const nothingSelected = !applyTemp && !applyVent && !applyAlarm;
  const wantedControl = applyTemp || applyVent;
  const activeDraft = channelDrafts[activeChannel];
  const dirtyChannelSlots = useMemo(
    () =>
      bulkDirtyChannelSlots(
        channelDrafts,
        channelSeeds,
        applyTemp,
        applyVent,
      ),
    [channelDrafts, channelSeeds, applyTemp, applyVent],
  );
  const selectedChannels = useMemo(
    () =>
      resolveBulkSendChannels(
        channelDrafts,
        channelSeeds,
        applyTemp,
        applyVent,
      ),
    [channelDrafts, channelSeeds, applyTemp, applyVent],
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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissModal();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, dismissModal]);

  /* 모달 닫힘 시 접기 상태 초기화 — effect setState 회피 */
  if (!open && openSection !== null) {
    setOpenSection(null);
  }

  useLayoutEffect(() => {
    if (!open || !wantedControl) return;
    const root = channelTablistRef.current;
    if (!root) return;
    const selected = root.querySelector<HTMLElement>(
      '[role="tab"][aria-selected="true"]',
    );
    if (!selected) return;
    const next = { left: selected.offsetLeft, width: selected.offsetWidth };
    setChannelPill((prev) =>
      prev.left === next.left && prev.width === next.width ? prev : next,
    );
  }, [activeChannel, open, wantedControl]);

  const toggleSection = (id: BulkSettingsSectionId) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  const patchActiveDraft = useCallback(
    (patch: Partial<(typeof channelDrafts)[ChannelSlot]>) => {
      setChannelDrafts((prev) => ({
        ...prev,
        [activeChannel]: { ...prev[activeChannel], ...patch },
      }));
    },
    [activeChannel],
  );

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

  const tempSummary = applyTemp
    ? `${activeDraft.setpoint}±${activeDraft.deviation}℃`
    : "온도 미적용";
  const ventSummary = applyVent
    ? `환기 ${activeDraft.minVent}–${activeDraft.maxVent}%`
    : "환기 미적용";
  const controlSummary =
    !applyTemp && !applyVent
      ? "적용 안 함"
      : [applyTemp ? tempSummary : null, applyVent ? ventSummary : null]
          .filter(Boolean)
          .join(" · ");
  const alarmSummary = applyAlarm
    ? `저온 ${alarm.tempLow}℃ · 고온 ${alarm.tempHigh}℃`
    : "적용 안 함";

  const tempSectionBody = (collapsible: boolean) => (
    <>
      <SectionToggle
        checked={applyTemp}
        onChange={setApplyTemp}
        applyOnly={collapsible}
        icon={
          <Thermometer
            className={cn(dashboardUi.iconSm, "text-channel-temp")}
            aria-hidden
          />
        }
        label="설정온도 · 편차"
      />
      <div className={cn("min-w-0", collapsible ? "pt-2" : "pt-3 md:pt-4")}>
        <ControllerTempDualSlider
          key={`temp-${activeChannel}`}
          setpoint={activeDraft.setpoint}
          deviation={activeDraft.deviation}
          disabled={!applyTemp}
          compact={false}
          axisMode="editable"
          axisInputSize="dashboard"
          onChange={(sp, dev) => {
            patchActiveDraft({ setpoint: sp, deviation: dev });
          }}
        />
      </div>
    </>
  );

  const ventSectionBody = (collapsible: boolean) => (
    <>
      <SectionToggle
        checked={applyVent}
        onChange={setApplyVent}
        applyOnly={collapsible}
        icon={
          <span
            className={cn(
              dashboardUi.iconSm,
              "inline-flex items-center justify-center font-bold text-channel-info",
            )}
            aria-hidden
          >
            %
          </span>
        }
        label="환기 (최저·최고)"
      />
      <div className={cn("min-w-0", collapsible ? "pt-2" : "pt-3 md:pt-4")}>
        <ThresholdRangeSlider
          key={`vent-${activeChannel}`}
          title="환기"
          icon={
            <span
              className={cn(
                dashboardUi.iconSm,
                "inline-flex items-center justify-center font-bold text-channel-info",
              )}
              aria-hidden
            >
              %
            </span>
          }
          min={0}
          max={100}
          step={1}
          low={activeDraft.minVent}
          high={activeDraft.maxVent}
          unit="%"
          lowLabel="최저환기"
          highLabel="최고환기"
          accentClass="bg-channel-info/35"
          axisMode="editable"
          axisInputSize="dashboard"
          bare
          compact={false}
          titleClassName={bulkModalSectionTitle}
          axisClassName={bulkModalMeta}
          disabled={!applyVent}
          onChange={(low, high) => {
            patchActiveDraft({ minVent: low, maxVent: high });
          }}
        />
      </div>
    </>
  );

  const alarmSectionBody = (collapsible: boolean) => (
    <>
      <SectionToggle
        checked={applyAlarm}
        onChange={setApplyAlarm}
        applyOnly={collapsible}
        icon={
          <Bell
            className={cn(dashboardUi.iconSm, "text-red-600")}
            aria-hidden
          />
        }
        label="장비 저온·고온 경보"
      />
      <div
        className={cn(
          "min-w-0 space-y-4",
          collapsible ? "pt-2" : "pt-3 md:space-y-5 md:pt-4",
        )}
      >
        <ThresholdRangeSlider
          title="저온 · 고온 경보"
          icon={
            <AlarmDomainIcon domain="temp" sizeClass={dashboardUi.iconSm} />
          }
          min={0}
          max={100}
          step={0.1}
          low={alarm.tempLow}
          high={alarm.tempHigh}
          unit="℃"
          accentClass="bg-channel-temp/35"
          axisMode="editable"
          axisInputSize="dashboard"
          bare
          compact={false}
          titleClassName={bulkModalSectionTitle}
          disabled={!applyAlarm}
          onChange={(low, high) =>
            setAlarm((a) => ({ ...a, tempLow: low, tempHigh: high }))
          }
        />

      </div>
    </>
  );

  const settingsSections = isMobile ? (
    <div className="flex flex-col gap-2" data-settings-layout="collapsible">
      <SettingsCollapsibleSection
        id="temp"
        title="설정온도 · 편차"
        summary={controlSummary}
        changed={applyTemp || applyVent}
        open={openSection === "temp"}
        onToggle={() => toggleSection("temp")}
      >
        <div className="space-y-4">
          {tempSectionBody(false)}
          {ventSectionBody(false)}
        </div>
      </SettingsCollapsibleSection>
      <SettingsCollapsibleSection
        id="alarm"
        title="알람"
        summary={alarmSummary}
        changed={applyAlarm}
        open={openSection === "alarm"}
        onToggle={() => toggleSection("alarm")}
      >
        {alarmSectionBody(true)}
      </SettingsCollapsibleSection>
    </div>
  ) : (
    <>
      <section className={bulkModalSection}>{tempSectionBody(false)}</section>
      <section className={bulkModalSection}>{ventSectionBody(false)}</section>
      <section className={bulkModalSection}>{alarmSectionBody(false)}</section>
    </>
  );

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

  const modalContent =
    open && mounted ? (
      <div
        data-open=""
        className={cn(
          "fixed inset-0 z-50 flex bg-black/40",
          isMobile
            ? cn(
                "items-end justify-center overflow-hidden p-0",
                motionClass.durationNormal,
                motionClass.portalOverlayEnter,
              )
            : "items-center justify-center overflow-y-auto p-3 sm:p-4 ui-motion-modal-backdrop",
        )}
        /* fullscreen만 — sheet를 같이 두면 preview CSS가 오버레이 높이를 85%로 줄여 하단 네비가 비침 */
        data-mobile-viewport-fullscreen
        onClick={(e) => {
          if (!isMobile || running || e.target !== e.currentTarget) return;
          dismissModal();
        }}
      >
        <div
          data-open=""
          className={cn(
            bulkModalShell,
            isMobile
              ? cn(
                  motionClass.durationModerate,
                  motionClass.portalEnter,
                  motionClass.sheetEnter,
                  "max-h-[min(85%,var(--mobile-preview-sheet-h,85dvh))] min-h-0 w-full max-w-none rounded-b-none rounded-t-2xl border-x-0 border-b-0 pb-[env(safe-area-inset-bottom,0px)]",
                )
              : "ui-motion-modal-panel",
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-apply-title"
          onClick={(e) => e.stopPropagation()}
        >
          {isMobile ? (
            <div className="flex shrink-0 justify-center pt-2.5 pb-0.5" aria-hidden>
              <div className="h-1 w-10 rounded-full bg-muted-foreground/35" />
            </div>
          ) : null}
          <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 md:px-6 md:py-4">
            <div className="min-w-0 flex-1">
              <p id="bulk-apply-title" className={cn("font-semibold leading-snug", bulkModalSectionTitle)}>
                컨트롤러 일괄 설정
              </p>
              <div
                className={cn(
                  "mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5",
                  bulkModalMeta,
                )}
              >
                <span
                  className="inline-flex items-center gap-1.5"
                  title="대상 유형"
                >
                  <Layers className={dashboardUi.iconSm} aria-hidden />
                  <span className="sr-only">대상 유형</span>
                  <span aria-label={`대상 유형 ${selectedSps.length}개`}>
                    {selectedSps.length}
                  </span>
                </span>
                <span
                  className="inline-flex items-center gap-1.5"
                  title={
                    offlineCount > 0
                      ? `컨트롤러 ${targets.length}대 (온라인 ${onlineTargets.length})`
                      : "컨트롤러"
                  }
                >
                  <ControllerDeviceIcon className={dashboardUi.iconSm} aria-hidden />
                  <span className="sr-only">컨트롤러</span>
                  <span aria-label={`컨트롤러 ${targets.length}대`}>
                    {targets.length}
                  </span>
                </span>
                {wantedControl && previewCommands.length > 0 ? (
                  <span
                    className="inline-flex items-center gap-1.5"
                    title="제어 명령"
                  >
                    <Send className={dashboardUi.iconSm} aria-hidden />
                    <span className="sr-only">제어 명령</span>
                    <span aria-label={`제어 명령 약 ${previewCommands.length}건`}>
                      {previewCommands.length}
                    </span>
                  </span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismissModal()}
              disabled={running}
              className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50 md:p-2"
              aria-label="닫기"
            >
              <X className={dashboardUi.iconSm} />
            </button>
          </div>

          {result && resultFeedback ? (
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 md:px-6 md:py-5">
              <div
                className={cn(
                  "flex items-center gap-2.5",
                  resultFeedback.outcome === "success" && "text-[var(--status-ok)]",
                  resultFeedback.outcome === "partial" && "text-amber-800 dark:text-amber-300",
                  resultFeedback.outcome === "error" && "text-red-700 dark:text-red-400",
                )}
              >
                {resultFeedback.outcome === "success" ? (
                  <CheckCircle2 className={dashboardUi.iconSm} aria-hidden />
                ) : resultFeedback.outcome === "partial" ? (
                  <AlertTriangle className={dashboardUi.iconSm} aria-hidden />
                ) : (
                  <AlertCircle className={dashboardUi.iconSm} aria-hidden />
                )}
                <p className={cn("font-semibold leading-snug", bulkModalSectionTitle)}>
                  {resultFeedback.title}
                </p>
              </div>
              <ul className="mt-3 space-y-1.5 leading-snug">
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
              {resultFeedback.outcome === "partial" ? (
                <p className={cn("mt-2 text-amber-800 dark:text-amber-300", bulkModalMeta)}>
                  일부만 반영되었습니다. 실패 항목은 개별 패널에서 재시도하세요.
                </p>
              ) : null}
              {resultFeedback.outcome === "error" ? (
                <p className={cn("mt-2 text-red-600 dark:text-red-400", bulkModalMeta)}>
                  적용에 실패했습니다. 권한·네트워크·대상 상태를 확인한 뒤 다시 시도하세요.
                </p>
              ) : null}
              {queueProgress.total > 0 ? (
                <div
                  className={cn(
                    "mt-4 rounded-lg border px-3 py-2.5",
                    queueProgress.allOk
                      ? "border-[color-mix(in_oklch,var(--status-ok)_40%,var(--border))] bg-[color-mix(in_oklch,var(--status-ok)_10%,transparent)]"
                      : "border-border bg-muted/40",
                  )}
                >
                  <p className={cn("font-semibold leading-snug", bulkModalSectionTitle)}>
                    {queueProgress.failed > 0
                      ? "일부 실패"
                      : queueProgress.allOk
                        ? "확인 완료"
                        : queueProgress.timedOut
                          ? "일부 미확인"
                          : "적용 진행 중"}
                  </p>
                  <p className={cn("mt-1 leading-snug", bulkModalMeta)}>
                    {queueCountLine}
                  </p>
                  {!queueProgress.allOk ? (
                    <p className={cn("mt-1 text-xs leading-snug", bulkModalMeta)}>
                      시트를 닫아도 왼쪽 아래 적용 큐에서 단계를 볼 수 있습니다.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={closeAll}
                  className={cn(
                    bulkModalBtn,
                    resultFeedback.outcome === "error"
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : resultFeedback.outcome === "partial"
                        ? "bg-amber-600 text-white hover:bg-amber-700"
                        : dashboardAffordance.action,
                  )}
                >
                  확인
                </button>
              </div>
            </div>
          ) : running ? (
            <div className="flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center md:px-6">
              <Loader2
                className="size-8 animate-spin text-primary md:size-10"
                aria-hidden
              />
              <p className={cn("font-semibold", bulkModalSectionTitle)}>
                일괄 적용 중…
              </p>
              <p className={cn("leading-snug", bulkModalMeta)}>
                {applyPhase === "alarm"
                  ? "임계 가이드를 저장하고 있습니다."
                  : applyPhase === "control"
                    ? `제어 명령을 전송하고 있습니다. (${previewCommands.length || onlineTargets.length}건)`
                    : "적용을 준비하고 있습니다."}
              </p>
              <p className={cn("text-xs leading-snug", bulkModalMeta)}>
                창을 닫지 마세요.
              </p>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  "min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 md:px-6 md:py-5",
                  isMobile ? "space-y-2" : "space-y-4 md:space-y-5",
                )}
              >
                {wantedControl ? (
                  <section className={bulkModalSection}>
                    <p className={cn("border-b pb-2.5 font-semibold md:pb-3", bulkModalSectionTitle)}>
                      제어 채널
                    </p>
                    <div className="mt-3">
                      <div
                        ref={channelTablistRef}
                        role="tablist"
                        aria-label="제어 채널"
                        className="relative inline-flex rounded-xl border bg-muted/40 p-1"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "pointer-events-none absolute top-1 bottom-1 z-0 rounded-lg",
                            dashboardChroma.viewTabPill,
                            motionClass.viewTabPill,
                            channelPill.width <= 0 && "opacity-0",
                          )}
                          style={{
                            left: channelPill.left,
                            width: channelPill.width,
                          }}
                        />
                        {BULK_CHANNEL_OPTIONS.map((slot) => {
                          const selected = slot === activeChannel;
                          const dirty = dirtyChannelSlots.includes(slot);
                          const slotLabel = CHANNEL_SLOT_LABELS[slot];
                          return (
                            <button
                              key={slot}
                              type="button"
                              role="tab"
                              aria-selected={selected}
                              aria-label={dirty ? `${slotLabel} 변경됨` : slotLabel}
                              className={cn(
                                "relative z-[1] inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium md:min-h-10 md:min-w-10 md:px-4 md:text-sm lg:min-h-12 lg:text-[1.75rem]",
                                motionClass.microHover,
                                selected
                                  ? dashboardChroma.chromeActiveText
                                  : dashboardAffordance.choiceIdle,
                              )}
                              onClick={() => {
                                const active = document.activeElement;
                                if (active instanceof HTMLElement) active.blur();
                                setActiveChannel(slot);
                              }}
                            >
                              <span className="inline-flex items-center gap-1">
                                {slotLabel}
                                {dirty ? (
                                  <span
                                    className="size-1.5 rounded-full bg-primary md:size-2"
                                    aria-hidden
                                  />
                                ) : null}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {dirtyChannelSlots.length > 0 ? (
                      <p className={cn("mt-2 text-xs leading-snug", bulkModalMeta)}>
                        {dirtyChannelSlots
                          .map((slot) => CHANNEL_SLOT_LABELS[slot])
                          .join("·")}{" "}
                        변경 — 바꾼 채널만 나갑니다.
                      </p>
                    ) : previewCommands.length === 0 && onlineTargets.length > 0 ? (
                      <p className={cn("mt-2 text-xs leading-snug", bulkModalMeta)}>
                        선택한 채널에 맞는 온라인 컨트롤러가 없습니다. 채널 선택을 확인하세요.
                      </p>
                    ) : (
                      <p className={cn("mt-2 text-xs leading-snug", bulkModalMeta)}>
                        채널별로 값을 맞춥니다. 바꾸지 않으면 1차·2차·3차 모두 현재 값으로
                        나갑니다.
                      </p>
                    )}
                  </section>
                ) : null}

                {settingsSections}

                {error ? (
                  <p className="leading-snug text-red-600">{error}</p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-6 md:py-4">
                {nothingSelected ? (
                  <p className={cn("min-w-0 leading-snug", bulkModalMeta)}>
                    적용할 항목을 선택하세요.
                  </p>
                ) : (
                  <span className="min-w-0" aria-hidden />
                )}
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 md:gap-3">
                  <button
                    type="button"
                    onClick={() => dismissModal()}
                    disabled={running}
                    className={cn(bulkModalBtn, "border hover:bg-muted disabled:opacity-50")}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={runApply}
                    disabled={
                      running ||
                      nothingSelected ||
                      (wantedControl &&
                        previewCommands.length === 0 &&
                        !applyAlarm) ||
                      (wantedControl &&
                        selectedChannels.length === 0 &&
                        allChannelTargets &&
                        !applyAlarm)
                    }
                    className={cn(
                      bulkModalBtn,
                      "gap-1.5",
                      dashboardAffordance.action,
                    )}
                  >
                    {running ? (
                      <>
                        <Loader2 className="size-4 animate-spin lg:size-5" />
                        적용 중…
                      </>
                    ) : wantedControl ? (
                      `${targets.length}대 · 명령 ${previewCommands.length}건 적용`
                    ) : (
                      `${targets.length}대에 적용`
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    ) : null;

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

      {mounted && modalContent ? createPortal(modalContent, document.body) : null}
    </>
  );
}
