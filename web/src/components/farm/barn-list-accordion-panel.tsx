"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import {
  AlarmThresholdForm,
  type AlarmThresholdHeaderState,
} from "@/components/settings/alarm-threshold-form";
import { useControllerDetail } from "@/components/controllers/use-controller-detail";
import {
  SettingsChannelStepperGrid,
  SettingsChannelWell,
} from "@/components/farm/settings-channel-stepper-grid";
import { MENU_STEPS } from "@/lib/controllers/controller-panel-map";
import type { PresetCreateField } from "@/lib/farm/command-presets";
import { useControllerPanel } from "@/components/controllers/use-controller-panel";
import {
  latestPanelCommand,
  type DirtyChannelSave,
  type PanelChannelContext,
} from "@/lib/controllers/controller-panel-draft";
import type { BulkSentCommandItem } from "@/app/(dashboard)/controllers/actions";
import { useCommandPipelineTracker } from "@/components/controllers/use-command-pipeline-tracker";
import { ControllerPanelFeedback } from "@/components/farm/controller-panel-feedback";
import { CommandConfirmOverlay } from "@/components/farm/command-confirm-overlay";
import { SettingsEditOverlay } from "@/components/farm/settings-edit-overlay";
import { SettingsCommandPresetStrip } from "@/components/farm/settings-command-preset-strip";
import { useCommandPresets } from "@/components/farm/use-command-presets";
import { SettingsAllChannelGrid } from "@/components/farm/settings-all-channel-grid";
import { useSettingsApplyOverlay } from "@/components/farm/use-settings-apply-overlay";
import { useApplyQueueOptional } from "@/components/farm/apply-queue-context";
import { useApplyQueueStripPresence } from "@/components/farm/use-apply-queue-strip-presence";
import {
  buildCommandConfirmModel,
  buildMultiChannelCommandConfirmModel,
  formatCommandConfirmTarget,
  type CommandConfirmModel,
  type CommandThermoValues,
} from "@/lib/farm/command-confirm";
import {
  SettingsGlanceStrip,
  type SettingsGlanceFocus,
} from "@/components/farm/settings-glance-strip";
import { type PanelDraft } from "@/lib/controllers/controller-panel-draft";
import { BusyButtonLabel } from "@/components/common/busy-button-label";
import { useFarmLiveRefreshOptional } from "@/lib/navigation/farm-live-refresh";
import type { BarnReading } from "@/lib/data/iot";
import type { ThermoCommand } from "@/lib/data/commands";
import {
  type ControllerThermoSettings,
  resolveThermoSettings,
  thermoFromDecoded,
  thermoSettingsKey,
} from "@/lib/controllers/controller-settings";
import { resolveReadingThermo } from "@/lib/farm/controller-summary-display";
import { DEFAULT_ALARM_SETTINGS, type AlarmSettings } from "@/lib/data/alarms";
import { channelBySlot, type ChannelSlot } from "@/lib/data/iot-channel";
import { farmKeyId } from "@/lib/data/farm-key";
import { applyQueueChannelStripForReading } from "@/lib/farm/apply-queue";
import {
  snapshotCommandPresetChannels,
  type CommandPresetChannels,
  type CommandPresetScope,
} from "@/lib/farm/command-presets";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { stallKeyFromReading } from "@/lib/data/reading-hierarchy";
import { isReadingOnline } from "@/lib/data/reading-display";
import { cn } from "@/lib/utils";
import { dashboardAffordance } from "@/lib/ui/dashboard-page-ui";

/** 목록 카드 설정 패널 — 그래프 패널 차트 라벨과 동일 스케일 */
const LIST_PANEL_META = "text-xs tabular-nums text-muted-foreground";
const LIST_SLIDER_TITLE = "text-xs font-semibold";
const LIST_SLIDER_AXIS = "text-[11px] leading-snug text-muted-foreground";
const EMPTY_COMMANDS: ThermoCommand[] = [];

type Props = {
  reading: BarnReading;
  readings: BarnReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  commands?: ThermoCommand[];
  alarmSettings?: AlarmSettings;
  canCommand: boolean;
  /** 패딩 변형 — 모바일 sheet·PC 목록 설정 공통 */
  collapsibleSections?: boolean;
  /** 명령이 접수되면 덮개로 돌아가 채널 진행을 본다. 설정 한눈 행 채움이면 쓰지 않음. */
  onCommandQueued?: () => void;
};

function sliderFieldsToThermo(values: {
  setpoint: number;
  deviation: number;
  minVent: number;
  maxVent: number;
}): CommandThermoValues {
  return {
    setpointTemp: values.setpoint,
    tempDeviation: values.deviation,
    minVentPct: values.minVent,
    maxVentPct: values.maxVent,
  };
}

function fieldsToDraft(values: {
  setpoint: number;
  deviation: number;
  minVent: number;
  maxVent: number;
}): PanelDraft {
  return {
    setpointTemp: values.setpoint,
    tempDeviation: values.deviation,
    minVentPct: values.minVent,
    maxVentPct: values.maxVent,
  };
}

export function BarnListAccordionPanel({
  reading,
  readings,
  thermoSettings,
  commands = EMPTY_COMMANDS,
  alarmSettings,
  canCommand,
  collapsibleSections = false,
  onCommandQueued,
}: Props) {
  const [thresholdHeader, setThresholdHeader] =
    useState<AlarmThresholdHeaderState | null>(null);
  const [focus, setFocus] = useState<SettingsGlanceFocus | null>(null);
  const [activeChannel, setActiveChannel] = useState<ChannelSlot>("A");
  const [confirmModel, setConfirmModel] = useState<CommandConfirmModel | null>(
    null,
  );
  const confirmSentRef = useRef(false);
  const confirmControlSavesRef = useRef<DirtyChannelSave[] | null>(null);

  const { reading: detail, showLoading, refresh: refreshDetail } =
    useControllerDetail(reading);
  const channels = useMemo(
    () => detail?.channels ?? reading.channels ?? [],
    [detail?.channels, reading.channels],
  );
  const hasChannels = channels.length > 0;
  const channelSlots = useMemo(
    () => channels.map((c) => c.channel),
    [channels],
  );

  /** detail 로드·채널 구성 변경 시 가용 슬롯으로 맞춤 */
  if (hasChannels && !channelSlots.includes(activeChannel)) {
    setActiveChannel(channelSlots[0] ?? "A");
  }

  const channelEqpmnCode =
    channelBySlot(channels, activeChannel)?.eqpmnCode ?? "";

  const knownSettings = useMemo(() => {
    const fromMap = resolveThermoSettings(
      thermoSettings,
      detail?.farmKey,
      detail?.moduleUid,
      detail?.controllerKey,
      hasChannels ? activeChannel : undefined,
    );
    if (fromMap) return fromMap;
    return resolveReadingThermo(detail ?? reading, thermoSettings);
  }, [
    thermoSettings,
    detail,
    reading,
    hasChannels,
    activeChannel,
  ]);

  const liveThermo = useMemo(() => {
    const raw = hasChannels
      ? channelBySlot(channels, activeChannel)?.thermo
      : (detail?.thermo ?? reading.thermo);
    return thermoFromDecoded(raw);
  }, [hasChannels, channels, activeChannel, detail?.thermo, reading.thermo]);

  const channelContexts = useMemo((): PanelChannelContext[] | undefined => {
    if (!hasChannels) return undefined;
    const farmKey = detail?.farmKey ?? reading.farmKey;
    const moduleUid = detail?.moduleUid ?? reading.moduleUid;
    const controllerKey = detail?.controllerKey ?? reading.controllerKey;
    return channelSlots.map((slot) => {
      const fromMap =
        farmKey && moduleUid != null && controllerKey
          ? (thermoSettings[
              thermoSettingsKey(farmKey, moduleUid, controllerKey, slot)
            ] ?? null)
          : null;
      return {
        slot,
        eqpmnCode: channelBySlot(channels, slot)?.eqpmnCode ?? "",
        knownSettings: fromMap,
        liveBaseline: thermoFromDecoded(
          channelBySlot(channels, slot)?.thermo,
        ),
      };
    });
  }, [
    hasChannels,
    channelSlots,
    channels,
    thermoSettings,
    detail?.farmKey,
    detail?.moduleUid,
    detail?.controllerKey,
    reading.farmKey,
    reading.moduleUid,
    reading.controllerKey,
  ]);

  const onRefreshLive = useCallback(() => {
    refreshDetail();
  }, [refreshDetail]);

  const liveRefresh = useFarmLiveRefreshOptional();
  const applyQueue = useApplyQueueOptional();

  const applyItems = useMemo(
    () =>
      applyQueueChannelStripForReading(applyQueue?.rows ?? [], {
        key: reading.key,
        farmKey: reading.farmKey,
        moduleUid: reading.moduleUid,
        controllerKey: reading.controllerKey,
      }),
    [
      applyQueue?.rows,
      reading.key,
      reading.farmKey,
      reading.moduleUid,
      reading.controllerKey,
    ],
  );
  const applyPresence = useApplyQueueStripPresence(applyItems);
  const applyBusy = applyPresence.visible.some((item) => item.stage !== "실패");

  const pipeline = useCommandPipelineTracker({
    commands,
    farmKey: detail?.farmKey ?? reading.farmKey,
    moduleUid: detail?.moduleUid ?? reading.moduleUid,
    controllerKey: detail?.controllerKey ?? reading.controllerKey,
    hasChannels,
    activeChannel: hasChannels ? activeChannel : undefined,
    knownSettings,
    liveThermo,
    onRefreshLive,
  });

  const registerCommand = useCallback(
    (cmd: ThermoCommand) => {
      liveRefresh?.patchThermoFromCommand(cmd);
      pipeline.registerCommand(cmd);
      applyQueue?.startFromCommand(reading.key, cmd);
      onCommandQueued?.();
    },
    // pipeline 전체 포함 시 tracker 재생성 루프 — 메서드만 의존
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 의도적 생략
    [
      liveRefresh,
      pipeline.registerCommand,
      applyQueue?.startFromCommand,
      reading.key,
      onCommandQueued,
    ],
  );

  const registerBulkCommands = useCallback(
    (items: BulkSentCommandItem[]) => {
      for (const item of items) {
        liveRefresh?.patchThermoFromCommand(item.command);
        pipeline.registerCommand(item.command);
      }
      applyQueue?.startSession(items);
      if (items.length) onCommandQueued?.();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 의도적 생략
    [
      liveRefresh,
      pipeline.registerCommand,
      applyQueue?.startSession,
      onCommandQueued,
    ],
  );

  const panelTarget = detail ?? reading;

  const panelCommands = useMemo(() => [
    ...(applyQueue?.rows.map((row) => row.command) ?? []),
    ...(pipeline.command ? [pipeline.command] : []),
    ...commands,
  ].filter((cmd) => farmKeyId(cmd.farmKey) === farmKeyId(reading.farmKey) &&
    cmd.moduleUid === reading.moduleUid && cmd.controllerKey === reading.controllerKey),
  [applyQueue?.rows, pipeline.command, commands, reading.farmKey, reading.moduleUid, reading.controllerKey]);
  const panelChannelContexts = useMemo(() => channelContexts?.map((ctx) => ({
    ...ctx, command: latestPanelCommand(panelCommands, ctx.slot),
  })), [channelContexts, panelCommands]);

  const panel = useControllerPanel(
    panelTarget,
    knownSettings,
    canCommand,
    hasChannels ? activeChannel : undefined,
    hasChannels ? channelEqpmnCode : undefined,
    registerCommand,
    liveThermo,
    panelChannelContexts,
    registerBulkCommands,
    latestPanelCommand(panelCommands, hasChannels ? activeChannel : undefined),
  );

  const presetScope = useMemo((): CommandPresetScope | null => {
    if (!reading.controllerKey) return null;
    return {
      farmKey: reading.farmKey,
      moduleUid: reading.moduleUid,
      controllerKey: reading.controllerKey,
    };
  }, [reading.farmKey, reading.moduleUid, reading.controllerKey]);
  const presets = useCommandPresets(presetScope);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  /** 카드 LIVE 상태 우선 — detail API가 늦거나 offline이면 적용이 잠기지 않게 */
  const online =
    isReadingOnline(reading.status) || isReadingOnline(detail?.status);
  /** settings 미확인이어도 편집은 허용(기본 draft). 저장은 hasChanges 필요 */
  const controlsDisabled = !canCommand || panel.pending;

  const farmId = farmKeyId(reading.farmKey);
  const spCode = normalizeStallTyCode(reading.stallTyCode);
  const stallKey = stallKeyFromReading(reading);
  const effectiveAlarmSettings = alarmSettings ?? DEFAULT_ALARM_SETTINGS;
  const thresholdScope = useMemo(
    () => ({
      farmId,
      spCode,
      stallKey,
      readingKey: reading.key,
    }),
    [farmId, spCode, stallKey, reading.key],
  );

  const isSaving =
    panel.pending || applyBusy || Boolean(thresholdHeader?.pending);
  const editorOpen = focus != null && confirmModel == null;
  const canSaveControl =
    online && canCommand && !panel.pending && panel.hasChanges;
  const canSaveAlarm =
    Boolean(thresholdHeader) &&
    canCommand &&
    online &&
    !thresholdHeader!.pending &&
    !thresholdHeader!.validationError &&
    thresholdHeader!.scopeReady &&
    thresholdHeader!.hasChanges;
  const saveDisabled = isSaving || !canSaveControl;
  const saveDisabledReason = (() => {
    if (panel.pending || applyBusy) return "적용 중…";
    if (thresholdHeader?.pending) return "저장 중…";
    if (!canCommand) return "조회 전용 계정입니다. 설정 변경 권한이 없습니다.";
    if (!online) return "오프라인이라 적용할 수 없습니다.";
    if (!panel.settingsKnown && !panel.hasEdited) {
      return "설정값을 불러오는 중…";
    }
    if (!canSaveControl) return "변경된 명령이 없습니다.";
    return null;
  })();
  const defaultsDisabled = !canCommand || isSaving;

  const closeEditor = useCallback(() => {
    setFocus(null);
  }, []);

  const handleSaveControl = () => {
    if (isSaving || !canSaveControl) return;
    const focusedEl = document.activeElement;
    if (focusedEl instanceof HTMLElement) focusedEl.blur();
    window.setTimeout(() => {
      const dirty = panel.peekDirtySaves();
      if (dirty.length > 0) {
        const model = buildMultiChannelCommandConfirmModel({
          target: formatCommandConfirmTarget({
            stallTyCode: reading.stallTyCode,
            stallNo: reading.stallNo,
            eqpmnNo: reading.eqpmnNo,
            channels: dirty.map((row) => row.slot),
            onlineCount: 1,
          }),
          channels: dirty.map((row) => ({
            channel: row.slot,
            current: row.current,
            command: row.values,
          })),
        });
        confirmSentRef.current = false;
        confirmControlSavesRef.current = dirty;
        setConfirmModel(model);
        return;
      }
      const current = panel.currentValues
        ? sliderFieldsToThermo(panel.currentValues)
        : liveThermo
          ? {
              setpointTemp: liveThermo.setpointTemp,
              tempDeviation: liveThermo.tempDeviation,
              minVentPct: liveThermo.minVentPct,
              maxVentPct: liveThermo.maxVentPct,
            }
          : null;
      const model = buildCommandConfirmModel({
        target: formatCommandConfirmTarget({
          stallTyCode: reading.stallTyCode,
          stallNo: reading.stallNo,
          eqpmnNo: reading.eqpmnNo,
          channel: hasChannels ? activeChannel : null,
          onlineCount: 1,
        }),
        current,
        command: sliderFieldsToThermo(panel.sliderValues),
      });
      confirmSentRef.current = false;
      confirmControlSavesRef.current = null;
      setConfirmModel(model);
    }, 0);
  };

  const handleSaveAlarm = () => {
    if (isSaving || !canSaveAlarm) return;
    thresholdHeader!.onSave();
    closeEditor();
  };

  const dismissConfirm = useCallback(() => {
    if (panel.pending) return;
    confirmControlSavesRef.current = null;
    setConfirmModel(null);
  }, [panel.pending]);

  const commitConfirmedApply = useCallback(() => {
    if (confirmSentRef.current || panel.pending) return;
    confirmSentRef.current = true;
    const queued = confirmControlSavesRef.current ?? undefined;
    confirmControlSavesRef.current = null;
    setConfirmModel(null);
    panel.save(queued);
  }, [panel]);

  const handleApplyDefaults = () => {
    panel.applyDefaults();
    setActivePresetId(null);
  };

  const handlePickPreset = (id: string) => {
    const preset = presets.items.find((item) => item.id === id);
    if (!preset) return;
    panel.applyChannelDrafts(preset.channels);
    setActivePresetId(id);
  };

  const handleDeletePreset = (id: string) => {
    presets.remove(id);
    if (activePresetId === id) setActivePresetId(null);
  };

  const handleCreatePreset = (
    name: string,
    channels: CommandPresetChannels,
  ) => {
    const result = presets.save({ name, channels });
    if (!result.ok) return result.reason;
    panel.applyChannelDrafts(channels);
    setActivePresetId(result.id);
    return "ok" as const;
  };

  const panelError =
    panel.message?.tone === "error" ? panel.message.text : null;

  const { overlay, dismiss: dismissOverlay } = useSettingsApplyOverlay({
    isSaving: panel.pending || applyBusy,
    commandBusy: panel.pending || applyBusy,
    alarmBusy: false,
    suppressCommandStatus: true,
    command: pipeline.command,
    liveConfirmed: pipeline.liveConfirmed,
    flash: pipeline.flash,
    panelError,
    isCommandOverlayDismissed: pipeline.isCommandOverlayDismissed,
    onAcknowledgeCommandOverlay: pipeline.acknowledgeCommandOverlay,
    isUserInitiatedCommand: pipeline.isUserInitiatedCommand,
  });

  const handleOverlayDismiss = useCallback(() => {
    dismissOverlay();
    pipeline.clearFlash();
  // pipeline 전체 포함 시 tracker 재생성 루프 — clearFlash만 의존
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 의도적 생략
  }, [dismissOverlay, pipeline.clearFlash]);

  const handleFocus = (next: SettingsGlanceFocus) => {
    if (confirmModel) return;
    if (overlay.visible && overlay.phase !== "loading") {
      handleOverlayDismiss();
    }
    setFocus(next);
    if (next === "A" || next === "B" || next === "C") {
      if (channelSlots.includes(next)) setActiveChannel(next);
    }
  };

  const alarmSummary =
    thresholdHeader?.collapsedSummary ?? "장비 저온 · 고온 경보";
  const alarmCells =
    thresholdHeader?.glanceCells ??
    { temp: String(reading.alarmLowTempC ?? "—"), tempDev: String(reading.alarmHighTempC ?? "—"), humidity: "—" };
  const showControlEditor =
    editorOpen && (!hasChannels || channelSlots.length > 0);

  const alarmForm = (
    <AlarmThresholdForm
      key={reading.key}
      initialSettings={effectiveAlarmSettings}
      readings={readings.map(r => r.key === reading.key ? (detail ?? reading) : r)}
      commands={panelCommands}
      onCommandQueued={registerCommand}
      fixedScope={thresholdScope}
      embedded
      density="mobileSplit"
      disabled={!canCommand}
      sliderTitleClassName={LIST_SLIDER_TITLE}
      sliderAxisClassName={LIST_SLIDER_AXIS}
      onHeaderState={setThresholdHeader}
    />
  );

  const handleControlField = (field: PresetCreateField, value: number) => {
    if (field === "setpointTemp") {
      panel.setField("setpoint", value);
      return;
    }
    if (field === "tempDeviation") {
      panel.setField("deviation", value);
      return;
    }
    if (field === "minVentPct") {
      const max = panel.sliderValues.maxVent;
      panel.setVentRange(value, value > max ? value : max);
      return;
    }
    const min = panel.sliderValues.minVent;
    panel.setVentRange(value < min ? value : min, value);
  };

  const controlBody = (
    <div className="flex flex-col gap-3">
      {panel.currentValues ? (
        <p className="text-[11px] tabular-nums text-muted-foreground">
          현재 {panel.currentValues.setpoint.toFixed(1)}℃ +
          {panel.currentValues.deviation.toFixed(1)}℃
        </p>
      ) : null}
      {hasChannels ? <SettingsAllChannelGrid rows={panel.channelGlanceRows} currentBySlot={Object.fromEntries((panelChannelContexts ?? []).map((ctx) => [ctx.slot, ctx.liveBaseline]))} disabled={controlsDisabled} onChange={panel.setChannelField} /> : <SettingsChannelWell><SettingsChannelStepperGrid
        draft={fieldsToDraft(panel.sliderValues)} disabled={controlsDisabled}
        ventStep={MENU_STEPS.minVent.step} onChange={handleControlField}
      /></SettingsChannelWell>}
      <p className="text-[11px] text-muted-foreground">
        설정·편차 0.1℃, 환기 1%. −/+를 꾹 누르면 연속입니다.
      </p>
    </div>
  );

  const settingsSections = (
    <div className="flex flex-col gap-2">
      <SettingsGlanceStrip
        hasChannels={hasChannels}
        rows={panel.channelGlanceRows}
        ctrlValues={fieldsToDraft(panel.sliderValues)}
        ctrlDirty={panel.hasChanges}
        alarmCells={alarmCells}
        alarmSummary={alarmSummary}
        alarmDirty={Boolean(thresholdHeader?.hasChanges)}
        focus={focus}
        disabled={isSaving}
        applyItems={applyItems}
        onFocus={handleFocus}
        presetStrip={
          canCommand ? (
            <SettingsCommandPresetStrip
              items={presets.items}
              activeId={activePresetId}
              disabled={isSaving}
              canStore={presets.canStore}
              seedChannels={snapshotCommandPresetChannels(
                panel.channelGlanceRows,
                fieldsToDraft(panel.sliderValues),
              )}
              onPick={handlePickPreset}
              onDelete={handleDeletePreset}
              onCreate={handleCreatePreset}
            />
          ) : null
        }
      />
      {panelError ? <p role="alert" className="text-xs text-destructive">{panelError}</p> : null}
      <ControllerPanelFeedback
        {...overlay}
        visible={overlay.visible && confirmModel == null && !editorOpen && !panelError}
      />
    </div>
  );

  const editorBody = (
    <div className="space-y-5" data-unified-controller-settings>
      {showControlEditor ? (
        <section aria-label="채널 설정" className="space-y-3">
          <h3 className="text-sm font-semibold">{hasChannels ? "A/B/C 채널 설정" : "컨트롤러 설정"}</h3>
          {controlBody}
          {canCommand ? <button type="button" disabled={saveDisabled} title={saveDisabledReason ?? undefined}
            onClick={handleSaveControl} className={cn("min-h-11 w-full rounded-md px-3 py-2 text-sm", dashboardAffordance.action)}>
            채널 명령 적용
          </button> : null}
        </section>
      ) : null}
      <section aria-label="알람 설정" className={cn("space-y-3 border-t pt-4", !editorOpen && "hidden")}>
        <h3 className="text-sm font-semibold">저온 · 고온 알람</h3>
        {alarmForm}
        {canCommand ? <button type="button" disabled={isSaving || !canSaveAlarm} onClick={handleSaveAlarm}
          className={cn("min-h-11 w-full rounded-md px-3 py-2 text-sm", dashboardAffordance.action)}>
          알람 명령 적용
        </button> : null}
      </section>
    </div>
  );

  const readOnlyBanner = !canCommand ? (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <Eye className="mt-0.5 size-3.5 shrink-0 opacity-80" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold leading-snug">조회 전용</p>
        <p className="leading-snug text-amber-800/90 dark:text-amber-100/80">
          설정값·알람 임계값은 확인할 수 있지만 변경·적용할 수 없습니다.
          조정이 필요하면 운영자 권한이 있는 계정으로 요청하세요.
        </p>
      </div>
    </div>
  ) : null;

  const footer = (
    <div className="space-y-2">
      {canCommand ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={defaultsDisabled}
              onClick={handleApplyDefaults}
              className={cn(
                "inline-flex min-h-11 items-center justify-center rounded-md px-3 py-2 text-xs sm:text-sm",
                dashboardAffordance.tool,
              )}
            >
              기본값
            </button>
            <button
              type="button"
              disabled={saveDisabled}
              title={saveDisabledReason ?? undefined}
              onClick={handleSaveControl}
              aria-busy={isSaving || undefined}
              className={cn(
                "inline-flex min-h-11 min-w-0 items-center justify-center rounded-md px-4 py-2 text-xs font-medium sm:text-sm",
                dashboardAffordance.action,
              )}
            >
              <BusyButtonLabel
                busy={panel.pending || applyBusy}
                idleLabel="명령 적용"
                busyLabel="적용 중…"
              />
            </button>
          </div>
          {saveDisabled && saveDisabledReason ? (
            <p className="text-right text-xs text-muted-foreground">
              {saveDisabledReason}
            </p>
          ) : (
            <p className="text-right text-xs text-muted-foreground">
              바뀐 채널만 현장으로 전송합니다.
            </p>
          )}
        </>
      ) : null}
    </div>
  );

  const overlayNode = (
    <>
      <SettingsEditOverlay
        open={editorOpen}
        wide={showControlEditor}
        title="채널 · 알람 설정"
        primaryLabel={null}
        hint="변경한 항목의 명령 적용을 누르면 장비로 전송합니다."
        onClose={closeEditor}
      >
        {editorBody}
      </SettingsEditOverlay>
      <CommandConfirmOverlay
        model={confirmModel}
        busy={panel.pending}
        onCancel={dismissConfirm}
        onConfirm={commitConfirmedApply}
      />
    </>
  );

  if (collapsibleSections) {
    return (
      <>
        {overlayNode}
        <div
        className="border-t bg-muted/20"
        data-audit-region="barn-list-accordion-panel"
        data-tour-id="list-settings-panel"
        data-settings-layout="glance"
        aria-busy={isSaving || undefined}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {showLoading ? (
          <p
            className={cn(
              "flex shrink-0 items-center gap-1.5 px-3 py-2",
              LIST_PANEL_META,
            )}
          >
            <Loader2 className="size-3.5 animate-spin" />
            상세 데이터 불러오는 중…
          </p>
        ) : null}
        <div
          className="space-y-2 px-3 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
          data-tour-id="list-settings-tour-target"
        >
          {readOnlyBanner}
          {settingsSections}
          {canCommand ? (
            <div className="space-y-2 border-t pt-3">{footer}</div>
          ) : null}
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      {overlayNode}
      <div
      className="border-t bg-muted/20 px-3 py-3 sm:px-4"
      data-audit-region="barn-list-accordion-panel"
      data-tour-id="list-settings-panel"
      data-settings-layout="glance"
      aria-busy={isSaving || undefined}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {showLoading ? (
        <p className={cn("mb-2 flex items-center gap-1.5", LIST_PANEL_META)}>
          <Loader2 className="size-3.5 animate-spin" />
          상세 데이터 불러오는 중…
        </p>
      ) : null}
      {readOnlyBanner ? <div className="mb-3">{readOnlyBanner}</div> : null}
      <div data-tour-id="list-settings-tour-target">
        {settingsSections}
        {canCommand ? (
          <div className="mt-3 space-y-2 border-t pt-3">{footer}</div>
        ) : null}
      </div>
    </div>
    </>
  );
}
