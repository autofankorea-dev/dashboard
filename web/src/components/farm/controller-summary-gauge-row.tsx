"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import {
  DEFAULT_TREND_PERIOD,
  type TrendControllerPeriodData,
  type TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import type { BarnListViewMode } from "@/lib/farm/farm-view-url";
import { BarnListPanelShell } from "@/components/farm/barn-list-panel-shell";
import { BarnControllerMobileSheet } from "@/components/farm/barn-controller-mobile-sheet";
import { ControllerMobileSettingsPage } from "@/components/farm/controller-mobile-settings-page";
import { BarnChannelTrendPanel } from "@/components/farm/barn-channel-trend-panel";
import { BarnEnvTrendPanel } from "@/components/farm/barn-env-trend-panel";
import { BarnListAccordionPanel } from "@/components/farm/barn-list-accordion-panel";
import {
  ChannelStrip,
  ControllerSummaryHeader,
  useControllerSummaryData,
} from "@/components/farm/controller-summary-parts";
import { EnvMetricPanel } from "@/components/farm/controller-summary-gauge-parts";
import { cn } from "@/lib/utils";
import { ControllerEnvCover } from "@/components/farm/controller-env-cover";
import {
  CoverRevealOverlay,
  COVER_REVEAL_STATUS_VAR,
  type CoverRevealDirection,
} from "@/components/farm/cover-reveal-overlay";
import {
  controllerEnvCoverLevel,
  controllerEnvCoverRingClass,
  isControllerPanelInteractiveTarget,
} from "@/lib/farm/controller-env-cover";
import {
  captureCoverMorphSnapshot,
  coverMorphDurationMs,
  prefersCoverMorphReducedMotion,
  type CoverMorphSnapshot,
} from "@/lib/farm/cover-reveal-morph";

/** 그리드 상세 — PC 2단(grid) vs 모바일 stack(+ carousel sheet). */
export type ControllerPanelLayoutVariant = "grid" | "stack";

type Props = {
  reading: BarnReading;
  readings: BarnReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  commands?: import("@/lib/data/commands").ThermoCommand[];
  alarmSettings?: AlarmSettings;
  canCommand?: boolean;
  listMode?: BarnListViewMode;
  settingsExpanded?: boolean;
  /** 모바일 — panelSets 기반 sheet만 열림 (미전달 시 settingsExpanded로 판단) */
  mobileSheetOpen?: boolean;
  onToggleSettings?: () => void;
  /** «차트에서 보기» — 해당 컨트롤러 스코프로 차트 탭 이동 */
  onOpenChart?: () => void;
  /** 그리드 상세 등 — 카드 헤더 액션(차트/설정) 숨김 */
  hideGraphToggle?: boolean;
  panelPlacement?: "bottom" | "right";
  gridCols?: number;
  panelLayoutVariant?: ControllerPanelLayoutVariant;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  trendLoading?: boolean;
  trendStale?: boolean;
  bulkPeriod?: TrendPeriodId;
  panelPeriodOverrides?: Record<string, TrendPeriodId>;
  onPanelPeriodChange?: (key: string, period: TrendPeriodId) => void;
  showAffiliation?: boolean;
  /** 필드 카드 — 상태색 덮개 (클릭하면 걷힘) */
  envCoverEnabled?: boolean;
  envCoverOpen?: boolean;
  onEnvCoverOpen?: () => void;
  onEnvCoverClose?: () => void;
  /** 명령 접수 후 설정을 닫는다 (토글 아님) */
  /** 명령 접수 후 설정을 닫을 때. 한눈 행 채움 이후에는 호출하지 않음. */
  onCloseSettings?: () => void;
  className?: string;
  /** 모바일 목록 Graph/Set toolbar — 인라인 패널 숨김 */
  suppressMobileInlinePanels?: boolean;
  /** 모바일 목록 Graph/Set toolbar — per-card sheet 숨김 */
  suppressPerCardMobileSheet?: boolean;
  /** toolbar sheet에서 선택된 카드 */
  toolbarSheetSelected?: boolean;
  /** toolbar sheet — 카드 탭 시 컨트롤러 선택 */
  onCardActivate?: () => void;
  /** bottom sheet 상단 swipe picker (그리드·목록 Graph/Set) */
  sheetPickerReadings?: BarnReading[];
  onSheetPickerSelect?: (key: string) => void;
  showSheetPickerAffiliation?: boolean;
};

/** PC·Mobile 공통 — 게이지·채널 고정 + 카드별 pill로 패널 드롭다운 / 모바일 sheet */
export function ControllerSummaryGaugeRow({
  reading,
  readings,
  thermoSettings,
  commands,
  alarmSettings,
  canCommand = false,
  listMode = "controller",
  settingsExpanded = false,
  mobileSheetOpen: mobileSheetOpenProp,
  onToggleSettings,
  onOpenChart,
  hideGraphToggle = false,
  panelPlacement = "bottom",
  gridCols,
  panelLayoutVariant,
  controllerTrendByPeriod = null,
  trendLoading = false,
  bulkPeriod = DEFAULT_TREND_PERIOD,
  panelPeriodOverrides = {},
  showAffiliation = false,
  envCoverEnabled = false,
  envCoverOpen = false,
  onEnvCoverOpen,
  onEnvCoverClose,
  onCloseSettings: _onCloseSettings,
  className,
  suppressMobileInlinePanels = false,
  suppressPerCardMobileSheet = false,
  toolbarSheetSelected = false,
  onCardActivate,
  sheetPickerReadings,
  onSheetPickerSelect,
  showSheetPickerAffiliation = false,
}: Props) {
  const {
    offline,
    thermo,
    thresholds,
    temp,
    humidity,
    tempAlarmBreached,
    humidityAlarmBreached,
  } = useControllerSummaryData(reading, thermoSettings, alarmSettings);

  const panelPeriod = panelPeriodOverrides[reading.key] ?? bulkPeriod;

  const resolvedPanelLayout: ControllerPanelLayoutVariant =
    panelLayoutVariant ??
    (typeof gridCols === "number" && gridCols >= 2 ? "grid" : "stack");

  const useMobileSheet = resolvedPanelLayout === "stack";
  const mobileSheetOpen =
    useMobileSheet &&
    (mobileSheetOpenProp !== undefined ? mobileSheetOpenProp : settingsExpanded);

  const showInlineSettingsOnMobile =
    useMobileSheet &&
    settingsExpanded &&
    !mobileSheetOpen &&
    !suppressMobileInlinePanels;

  /** 그리드 PC 상세(hideGraphToggle) — 설정 없이도 환경·모터 추이를 카드에 고정. */
  const channelTrendVisible =
    panelPlacement === "right" && (settingsExpanded || hideGraphToggle);

  const channelTrendCompact =
    panelPlacement === "right" && resolvedPanelLayout === "stack";

  /** 카드 인라인 추이 — 하단 BarnListGraphPanel과 기간·차트 중복 방지. */
  const inlineEnvWithChannels = hideGraphToggle;

  const setpoint = thermo?.setpointTemp;
  const setDev = thermo?.tempDeviation;
  const envCoverLevel = controllerEnvCoverLevel(reading, alarmSettings);
  const concealOnIdleClick = Boolean(
    envCoverEnabled && envCoverOpen && onEnvCoverClose,
  );

  const cardRef = useRef<HTMLDivElement>(null);
  const [coverOpenedOnce, setCoverOpenedOnce] = useState(false);
  const [coverEnterFromFade, setCoverEnterFromFade] = useState(false);
  const [coverReveal, setCoverReveal] = useState<{
    snapshot: CoverMorphSnapshot;
    overlay: boolean;
    direction: CoverRevealDirection;
  } | null>(null);
  const coverRevealRef = useRef(coverReveal);
  const pendingCoverCloseRef = useRef(false);
  const closeSettingsOnCoverFinishRef = useRef(true);
  useEffect(() => {
    coverRevealRef.current = coverReveal;
  }, [coverReveal]);

  const finishCoverClose = useCallback(() => {
    pendingCoverCloseRef.current = false;
    setCoverReveal(null);
    onEnvCoverClose?.();
    if (closeSettingsOnCoverFinishRef.current && settingsExpanded) {
      onToggleSettings?.();
    }
  }, [onEnvCoverClose, onToggleSettings, settingsExpanded]);

  const closeEnvCover = useCallback(
    (opts?: { closeSettings?: boolean }) => {
      closeSettingsOnCoverFinishRef.current = opts?.closeSettings !== false;
      const current = coverRevealRef.current;
      if (current?.overlay && current.direction === "close") return;
      if (current?.overlay && current.direction === "open") {
        pendingCoverCloseRef.current = true;
        return;
      }
      const reduced =
        prefersCoverMorphReducedMotion() || coverMorphDurationMs() === 0;
      if (current?.snapshot && !reduced) {
        setCoverReveal({
          snapshot: current.snapshot,
          overlay: true,
          direction: "close",
        });
        return;
      }
      setCoverEnterFromFade(true);
      finishCoverClose();
    },
    [finishCoverClose],
  );

  const handleMorphDone = useCallback(() => {
    const current = coverRevealRef.current;
    if (current?.direction === "close") {
      setCoverEnterFromFade(false);
      finishCoverClose();
      return;
    }
    if (pendingCoverCloseRef.current && current?.snapshot) {
      pendingCoverCloseRef.current = false;
      setCoverReveal({
        snapshot: current.snapshot,
        overlay: true,
        direction: "close",
      });
      return;
    }
    setCoverReveal((prev) => (prev ? { ...prev, overlay: false } : null));
  }, [finishCoverClose]);

  const handleCoverOpen = useCallback(() => {
    pendingCoverCloseRef.current = false;
    setCoverOpenedOnce(true);
    const snap = captureCoverMorphSnapshot(cardRef.current);
    const reduced =
      prefersCoverMorphReducedMotion() || coverMorphDurationMs() === 0;
    setCoverReveal(
      snap && !reduced
        ? { snapshot: snap, overlay: true, direction: "open" }
        : null,
    );
    onEnvCoverOpen?.();
  }, [onEnvCoverOpen]);

  const handleCardSurfaceClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (
        concealOnIdleClick &&
        !isControllerPanelInteractiveTarget(e.target)
      ) {
        e.stopPropagation();
        closeEnvCover();
        return;
      }
      onCardActivate?.();
    },
    [closeEnvCover, concealOnIdleClick, onCardActivate],
  );

  const cardClass = cn(
    "relative flex h-full min-w-0 flex-col rounded-xl border bg-card overflow-hidden",
    !toolbarSheetSelected && controllerEnvCoverRingClass(envCoverLevel),
    toolbarSheetSelected && "ring-2 ring-primary/70",
    !toolbarSheetSelected && settingsExpanded && "ring-2 ring-primary/40",
    (onCardActivate || concealOnIdleClick) && "cursor-pointer",
    className,
  );

  const cardSurfaceClick =
    concealOnIdleClick || onCardActivate ? handleCardSurfaceClick : undefined;

  const showEnvCover =
    envCoverEnabled && !envCoverOpen && !settingsExpanded;
  const envCover = showEnvCover ? (
    <ControllerEnvCover
      reading={reading}
      level={envCoverLevel}
      alarmSettings={alarmSettings}
      animateEnter={coverOpenedOnce && coverEnterFromFade}
      morphReveal
      headerActionSlots={
        hideGraphToggle
          ? 0
          : Number(Boolean(onOpenChart)) + Number(Boolean(onToggleSettings))
      }
      onOpen={handleCoverOpen}
    />
  ) : null;
  const coverRevealLayer = coverReveal?.overlay ? (
    <CoverRevealOverlay
      snapshot={coverReveal.snapshot}
      level={envCoverLevel}
      reading={reading}
      direction={coverReveal.direction}
      onDone={handleMorphDone}
    />
  ) : null;
  const cardRevealProps = {
    "data-cover-revealing": coverReveal?.overlay
      ? coverReveal.direction
      : undefined,
    "data-cover-morph-band": coverReveal?.overlay
      ? coverReveal.snapshot.band
      : undefined,
  };

  const metricsBlock = (
    <>
      <div data-tour-id="controller-gauge-metrics">
        <EnvMetricPanel
          className="mb-2"
          offline={offline}
          setpoint={setpoint}
          setDev={setDev}
          glowBand={
            coverReveal && envCoverOpen ? coverReveal.snapshot.band : null
          }
          bandGlowIn={
            coverReveal?.direction === "open" && coverReveal.overlay
          }
          bandGlowOut={
            coverReveal?.direction === "close" && coverReveal.overlay
          }
          glowVar={COVER_REVEAL_STATUS_VAR[envCoverLevel]}
          siblingEnter={Boolean(
            coverReveal &&
              !coverReveal.overlay &&
              envCoverOpen &&
              coverReveal.direction !== "close",
          )}
          siblingExit={Boolean(
            coverReveal?.direction === "close" && coverReveal.overlay,
          )}
          temp={{
            value: reading.tempC,
            displayValue: temp ?? "—",
            low: thresholds.tempLow,
            high: thresholds.tempHigh,
            breached: tempAlarmBreached,
          }}
          humidity={{
            value: reading.humidityPct,
            displayValue: humidity ?? "—",
            low: thresholds.humidityLow,
            high: thresholds.humidityHigh,
            breached: humidityAlarmBreached,
          }}
        />
      </div>
      <ChannelStrip
        reading={reading}
        thermo={thermo}
        compact
        hideChannelTrendExpand
      />
    </>
  );

  const hideMetricsForSettings =
    settingsExpanded && panelPlacement !== "right";

  const cardBody = (
    <>
      <div
        className={cn(
          "px-2.5 pt-2.5 sm:px-3 sm:pt-3",
          hideMetricsForSettings ? "pb-0" : undefined,
        )}
      >
        <ControllerSummaryHeader
          reading={reading}
          alarmSettings={alarmSettings}
          settingsActive={settingsExpanded}
          hideActions={hideGraphToggle}
          showAffiliation={showAffiliation}
          onToggleSettings={onToggleSettings}
          onOpenChart={onOpenChart}
          onConcealDetail={
            envCoverEnabled && envCoverOpen ? closeEnvCover : undefined
          }
          className={cn("w-full", !hideMetricsForSettings && "mb-2")}
        />
      </div>
      {hideMetricsForSettings ? null : (
        <div className="shrink-0 px-2.5 pb-2.5 sm:px-3 sm:pb-3">
          {metricsBlock}
        </div>
      )}
    </>
  );

  const handleSheetClose = useCallback(() => {
    if (settingsExpanded) onToggleSettings?.();
  }, [settingsExpanded, onToggleSettings]);

  const mobileSheet = useMobileSheet && !suppressPerCardMobileSheet ? (
    <BarnControllerMobileSheet
      open={mobileSheetOpen}
      onClose={handleSheetClose}
      reading={reading}
      pickerReadings={sheetPickerReadings}
      selectedReadingKey={reading.key}
      onSelectReading={onSheetPickerSelect}
      showPickerAffiliation={showSheetPickerAffiliation}
      settingsPage={
        <ControllerMobileSettingsPage
          key={reading.key}
          reading={reading}
          readings={readings}
          thermoSettings={thermoSettings}
          commands={commands}
          alarmSettings={alarmSettings}
          canCommand={canCommand}
          onOpenChart={
            onOpenChart
              ? () => {
                  onOpenChart();
                  handleSheetClose();
                }
              : undefined
          }
        />
      }
    />
  ) : null;

  const settingsPanel = (
    <BarnListPanelShell
      open={settingsExpanded}
      panelKind="settings"
      keepMounted
    >
      {settingsExpanded ? (
        <BarnListAccordionPanel
          reading={reading}
          readings={readings}
          thermoSettings={thermoSettings}
          commands={commands}
          alarmSettings={alarmSettings}
          canCommand={canCommand}
          collapsibleSections
        />
      ) : null}
    </BarnListPanelShell>
  );

  const channelTrendPanel = channelTrendVisible ? (
    <div
      className="barn-list-panel-stagger--channel-trend border-t bg-muted/15 px-2.5 pb-2.5 pt-2 sm:px-3"
      data-audit-region="controller-channel-trend"
    >
      <div className="space-y-2">
        {inlineEnvWithChannels ? (
          <BarnEnvTrendPanel
            reading={reading}
            controllerTrendByPeriod={controllerTrendByPeriod}
            period={panelPeriod}
            alarmSettings={alarmSettings}
            compact={panelPlacement === "right"}
            dense={channelTrendCompact}
            loading={trendLoading}
          />
        ) : null}
        <BarnChannelTrendPanel
          reading={reading}
          controllerTrendByPeriod={controllerTrendByPeriod}
          period={panelPeriod}
          thermoSettings={thermoSettings}
          layout="overlay"
          compact={panelPlacement === "right"}
          dense={channelTrendCompact}
        />
      </div>
    </div>
  ) : null;

  if (panelPlacement === "right") {
    const channelTrendBottom = channelTrendVisible ? channelTrendPanel : null;

    if (resolvedPanelLayout === "grid" && typeof gridCols === "number" && gridCols >= 2) {
      const cardSpan = Math.min(2, gridCols);
      const panelSpan = Math.max(1, gridCols - cardSpan);
      return (
        <div
          className="grid min-w-0 items-stretch"
          style={{
            gridTemplateColumns: `repeat(${gridCols}, minmax(4.75rem, 1fr))`,
            gap: "0.375rem",
          }}
        >
          <div
            ref={cardRef}
            className={cardClass}
            style={{ gridColumn: `span ${cardSpan}` }}
            {...cardRevealProps}
            data-tour-id="controller-card"
            data-controller-card-key={reading.key}
            data-controller-key={reading.controllerKey}
            data-list-mode={listMode}
            data-card-body="expanded"
            data-panel-layout="grid"
            onClick={cardSurfaceClick}
          >
            {envCover}
            {coverRevealLayer}
            {cardBody}
            {channelTrendBottom ? (
              <div className="mt-auto flex min-h-0 flex-1 flex-col">{channelTrendBottom}</div>
            ) : null}
          </div>
          {settingsExpanded ? (
            <div
              className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card"
              style={{ gridColumn: `span ${panelSpan}` }}
            >
              {settingsPanel}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <>
        <div
          ref={cardRef}
          className={cn(cardClass, "w-full")}
          {...cardRevealProps}
          data-tour-id="controller-card"
          data-controller-card-key={reading.key}
          data-controller-key={reading.controllerKey}
          data-list-mode={listMode}
          data-card-body="expanded"
          data-panel-layout="stack"
          onClick={cardSurfaceClick}
        >
          {envCover}
          {coverRevealLayer}
          {cardBody}
          {channelTrendBottom}
        </div>
        {settingsExpanded && suppressPerCardMobileSheet ? (
          <div className="mt-2 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
            {settingsPanel}
          </div>
        ) : null}
        {mobileSheet}
      </>
    );
  }

  if (useMobileSheet) {
    return (
      <>
        <div
          ref={cardRef}
          className={cardClass}
          {...cardRevealProps}
          data-tour-id="controller-card"
          data-controller-card-key={reading.key}
          data-controller-key={reading.controllerKey}
          data-list-mode={listMode}
          data-card-body="expanded"
          data-panel-layout="stack"
          onClick={cardSurfaceClick}
          onKeyDown={
            onCardActivate
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onCardActivate();
                  }
                }
              : undefined
          }
          role={onCardActivate ? "button" : undefined}
          tabIndex={onCardActivate ? 0 : undefined}
        >
          {envCover}
          {coverRevealLayer}
          {cardBody}
          {showInlineSettingsOnMobile ? settingsPanel : null}
        </div>
        {mobileSheet}
      </>
    );
  }

  return (
    <div
      ref={cardRef}
      className={cardClass}
      {...cardRevealProps}
      data-tour-id="controller-card"
      data-controller-card-key={reading.key}
      data-controller-key={reading.controllerKey}
      data-list-mode={listMode}
      data-card-body="expanded"
      onClick={cardSurfaceClick}
    >
      {envCover}
      {coverRevealLayer}
      {cardBody}
      {settingsPanel}
    </div>
  );
}
