"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Eye, Loader2, Thermometer } from "lucide-react";
import {
  AlarmThresholdForm,
  type AlarmThresholdHeaderState,
} from "@/components/settings/alarm-threshold-form";
import { ControllerTempDualSlider } from "@/components/controllers/controller-temp-dual-slider";
import { ThresholdRangeSlider } from "@/components/settings/threshold-range-slider";
import { useControllerDetail } from "@/components/controllers/use-controller-detail";
import { useControllerPanel } from "@/components/controllers/use-controller-panel";
import type {
  DirtyChannelSave,
  PanelChannelContext,
} from "@/lib/controllers/controller-panel-draft";
import type { BulkSentCommandItem } from "@/app/(dashboard)/controllers/actions";
import { useCommandPipelineTracker } from "@/components/controllers/use-command-pipeline-tracker";
import { CommandPipelineOverlay } from "@/components/farm/command-pipeline-overlay";
import { CommandConfirmOverlay } from "@/components/farm/command-confirm-overlay";
import { useSettingsApplyOverlay } from "@/components/farm/use-settings-apply-overlay";
import { useApplyQueueOptional } from "@/components/farm/apply-queue-context";
import {
  buildCommandConfirmModel,
  buildMultiChannelCommandConfirmModel,
  formatCommandConfirmTarget,
  type CommandConfirmModel,
  type CommandThermoValues,
} from "@/lib/farm/command-confirm";
import { SettingsCollapsibleSection } from "@/components/farm/settings-collapsible-section";
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
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { stallKeyFromReading } from "@/lib/data/reading-hierarchy";
import { isReadingOnline } from "@/lib/data/reading-display";
import { cn } from "@/lib/utils";
import {
  dashboardAffordance,
  dashboardChroma,
} from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";

/** 목록 카드 설정 패널 — 그래프 패널 차트 라벨과 동일 스케일 */
const LIST_PANEL_META = "text-xs tabular-nums text-muted-foreground";
const LIST_SLIDER_TITLE = "text-xs font-semibold";
const LIST_SLIDER_AXIS = "text-[11px] leading-snug text-muted-foreground";

type SettingsSectionId = "alarm" | "control";

type Props = {
  reading: BarnReading;
  readings: BarnReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  commands?: ThermoCommand[];
  alarmSettings?: AlarmSettings;
  canCommand: boolean;
  /** 섹션 접이식 — 모바일 sheet·PC 목록 설정 공통 */
  collapsibleSections?: boolean;
  /** 명령이 접수되면 덮개로 돌아가 채널 진행을 본다 */
  onCommandQueued?: () => void;
};

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-background p-3">{children}</section>
  );
}

function formatControlCollapsedSummary(values: {
  setpoint: number;
  deviation: number;
  minVent: number;
  maxVent: number;
}): string {
  return `${values.setpoint}±${values.deviation}℃ · 환기 ${values.minVent}–${values.maxVent}%`;
}

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

export function BarnListAccordionPanel({
  reading,
  readings,
  thermoSettings,
  commands = [],
  alarmSettings,
  canCommand,
  collapsibleSections = false,
  onCommandQueued,
}: Props) {
  const [thresholdHeader, setThresholdHeader] =
    useState<AlarmThresholdHeaderState | null>(null);
  const [openSection, setOpenSection] = useState<SettingsSectionId | null>(
    null,
  );
  const [activeChannel, setActiveChannel] = useState<ChannelSlot>("A");
  const channelTablistRef = useRef<HTMLDivElement>(null);
  const [channelPill, setChannelPill] = useState({ left: 0, width: 0 });
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

  useLayoutEffect(() => {
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
  }, [activeChannel, channelSlots]);

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

  const panel = useControllerPanel(
    panelTarget,
    knownSettings,
    canCommand,
    hasChannels ? activeChannel : undefined,
    hasChannels ? channelEqpmnCode : undefined,
    registerCommand,
    liveThermo,
    channelContexts,
    registerBulkCommands,
  );

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

  const isSaving = panel.pending || Boolean(thresholdHeader?.pending);
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
  const saveDisabled = isSaving || (!canSaveControl && !canSaveAlarm);
  const saveDisabledReason = (() => {
    if (isSaving) return "저장 중…";
    if (!canCommand) return "조회 전용 계정입니다. 설정 변경 권한이 없습니다.";
    if (!online) return "오프라인이라 적용할 수 없습니다.";
    if (!panel.settingsKnown && !panel.hasEdited && !canSaveAlarm) {
      return "설정값을 불러오는 중…";
    }
    if (!canSaveControl && !canSaveAlarm) return "변경된 설정이 없습니다.";
    return null;
  })();
  const defaultsDisabled =
    !canCommand ||
    isSaving ||
    Boolean(thresholdHeader && (!thresholdHeader.scopeReady || thresholdHeader.pending));

  const handleSaveAll = () => {
    if (isSaving) return;
    if (canSaveControl) {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement) focused.blur();
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
      return;
    }
    if (canSaveAlarm) thresholdHeader!.onSave();
  };

  const dismissConfirm = useCallback(() => {
    if (panel.pending) return;
    confirmControlSavesRef.current = null;
    setConfirmModel(null);
  }, [panel.pending]);

  const commitConfirmedApply = useCallback(() => {
    if (confirmSentRef.current || panel.pending) return;
    confirmSentRef.current = true;
    const saveAlarm = canSaveAlarm;
    const queued = confirmControlSavesRef.current ?? undefined;
    confirmControlSavesRef.current = null;
    setConfirmModel(null);
    if (saveAlarm) thresholdHeader?.onSave();
    panel.save(queued);
  }, [canSaveAlarm, panel, thresholdHeader]);

  const handleApplyDefaults = () => {
    panel.applyDefaults();
    thresholdHeader?.onApplyDefaults();
  };

  const panelError =
    panel.message?.tone === "error" ? panel.message.text : null;

  const { overlay, dismiss: dismissOverlay } = useSettingsApplyOverlay({
    isSaving,
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

  const toggleSection = (id: SettingsSectionId) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  const alarmSummary =
    thresholdHeader?.collapsedSummary ?? "온도 · 습도 알람";
  const controlSummary = formatControlCollapsedSummary(panel.sliderValues);
  const controlTitle = "설정온도 · 편차";

  const channelPicker =
    hasChannels && channelSlots.length > 1 ? (
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
        {channelSlots.map((slot) => {
          const selected = slot === activeChannel;
          const dirty = panel.dirtyChannelSlots.includes(slot);
          return (
            <button
              key={slot}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={dirty ? `${slot} 변경됨` : slot}
              disabled={isSaving}
              className={cn(
                "relative z-[1] inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium",
                motionClass.microHover,
                selected
                  ? dashboardChroma.chromeActiveText
                  : dashboardAffordance.choiceIdle,
                isSaving && "opacity-50",
              )}
              onClick={() => {
                const active = document.activeElement;
                if (active instanceof HTMLElement) active.blur();
                setActiveChannel(slot);
              }}
            >
              <span className="inline-flex items-center gap-1">
                {slot}
                {dirty ? (
                  <span
                    className="size-1.5 rounded-full bg-primary"
                    aria-hidden
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    ) : null;

  const alarmForm = (
    <AlarmThresholdForm
      key={reading.key}
      initialSettings={effectiveAlarmSettings}
      readings={readings}
      fixedScope={thresholdScope}
      embedded
      density="mobileSplit"
      disabled={!canCommand}
      sliderTitleClassName={LIST_SLIDER_TITLE}
      sliderAxisClassName={LIST_SLIDER_AXIS}
      onHeaderState={setThresholdHeader}
    />
  );

  const controlBody = (
    <div className="space-y-3">
      {channelPicker}
      <div>
        <div className="mb-2 flex items-start gap-2">
          <Thermometer
            className="mt-0.5 size-4 shrink-0 text-channel-temp"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className={LIST_SLIDER_TITLE}>설정온도 · 편차</p>
            {panel.currentValues ? (
              <p className={cn("tabular-nums", LIST_PANEL_META)}>
                현재 {panel.currentValues.setpoint}℃ +
                {panel.currentValues.deviation}℃
              </p>
            ) : null}
          </div>
        </div>
        <ControllerTempDualSlider
          key={`temp-${activeChannel}`}
          setpoint={panel.sliderValues.setpoint}
          deviation={panel.sliderValues.deviation}
          disabled={controlsDisabled}
          compact
          dense
          axisMode="editable"
          axisInputSize="compact"
          axisClassName={LIST_SLIDER_AXIS}
          onChange={panel.setTempControl}
        />
      </div>
      <ThresholdRangeSlider
        key={`vent-${activeChannel}`}
        title="환기"
        icon={
          <span
            className="inline-flex size-4 items-center justify-center text-sm font-bold text-channel-info"
            aria-hidden
          >
            %
          </span>
        }
        min={0}
        max={100}
        step={1}
        low={panel.sliderValues.minVent}
        high={panel.sliderValues.maxVent}
        unit="%"
        lowLabel="최저환기"
        highLabel="최고환기"
        accentClass="bg-channel-info/35"
        axisMode="editable"
        axisInputSize="compact"
        compact
        bare
        titleClassName={LIST_SLIDER_TITLE}
        axisClassName={LIST_SLIDER_AXIS}
        disabled={controlsDisabled}
        onChange={panel.setVentRange}
      />
    </div>
  );

  const settingsSections = collapsibleSections ? (
    <div className="flex flex-col gap-2">
      <SettingsCollapsibleSection
        id="alarm"
        title="알람"
        summary={alarmSummary}
        changed={Boolean(thresholdHeader?.hasChanges)}
        open={openSection === "alarm"}
        onToggle={() => toggleSection("alarm")}
      >
        {alarmForm}
      </SettingsCollapsibleSection>
      <SettingsCollapsibleSection
        id="control"
        title={controlTitle}
        summary={controlSummary}
        changed={panel.hasChanges}
        open={openSection === "control"}
        onToggle={() => toggleSection("control")}
      >
        {controlBody}
      </SettingsCollapsibleSection>
    </div>
  ) : (
    <div className="barn-list-panel-stagger--settings flex flex-col gap-3">
      <SectionShell>{alarmForm}</SectionShell>
      <SectionShell>
        {hasChannels ? (
          <p className={cn("mb-2 font-medium", LIST_SLIDER_TITLE)}>
            {controlTitle}
          </p>
        ) : null}
        {controlBody}
      </SectionShell>
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
              onClick={handleSaveAll}
              aria-busy={isSaving || undefined}
              className={cn(
                "inline-flex min-h-11 min-w-0 items-center justify-center rounded-md px-4 py-2 text-xs font-medium sm:text-sm",
                dashboardAffordance.action,
              )}
            >
              <BusyButtonLabel
                busy={isSaving}
                idleLabel="적용"
                busyLabel="적용 중…"
              />
            </button>
          </div>
          {saveDisabled && saveDisabledReason ? (
            <p className="text-right text-xs text-muted-foreground">
              {saveDisabledReason}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );

  const overlayNode = (
    <>
      <CommandConfirmOverlay
        model={confirmModel}
        busy={panel.pending}
        onCancel={dismissConfirm}
        onConfirm={commitConfirmedApply}
      />
      <CommandPipelineOverlay
        {...overlay}
        visible={overlay.visible && confirmModel == null}
        onDismiss={handleOverlayDismiss}
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
        data-settings-layout="collapsible"
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
