"use client";

import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { BarnReading } from "@/lib/data/iot";
import type { AlarmSettings } from "@/lib/domain/alarms";
import { channelBySlot, type ChannelSlot } from "@/lib/domain/iot-channel";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/domain/farm-trend-types";
import {
  CHANNELS,
  channelPercentsFromReading,
  formatChannelPercent,
  formatHumidityAlarmRange,
  formatSetpointDisplay,
  formatTempAlarmRange,
  humidityAlarmBreached,
  resolveReadingAlarmThresholds,
  resolveReadingChannelThermo,
  resolveReadingThermo,
  tempAlarmBreached,
} from "@/lib/farm/controller-summary-display";
import { formatSensorNumberForDisplay } from "@/lib/domain/reading-display";
import { BarnChannelTrendPanel } from "@/components/farm/barn-channel-trend-panel";
import { BarnListPanelShell } from "@/components/farm/barn-list-panel-shell";
import { VentGaugeV1 } from "@/components/farm/controller-summary-gauge-parts";
import { dashboardAffordance, dashboardControlFill, dashboardUi, dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";
import { Check, ChevronUp, Droplets, LineChart, Settings, Thermometer, Wifi } from "lucide-react";
import { useProfileSheetPrefs, useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { formatStallTypeLabelLocalized } from "@/lib/domain/stall-type";
import { ControllerDeviceIcon } from "@/components/icons/controller-device-icon";
import {
  ControllerAffiliationMarks,
  ControllerNoMark,
  StallUnitNoMark,
} from "@/components/farm/controller-no-marks";
import {
  controllerEnvCoverFillClass,
  controllerEnvCoverLevel,
  controllerEnvCoverNotices,
  coverNoticeLevel,
} from "@/lib/farm/controller-env-cover";

const cardActionBtnClass = cn(
  "inline-flex size-7 shrink-0 items-center justify-center p-0 font-medium",
  dashboardTypography.badge,
  motionClass.microHover,
);

const cardActionWellClass =
  "inline-flex overflow-hidden rounded-md border border-control-border bg-[color:var(--surface-well)]";
const cardActionSelectedClass = dashboardControlFill.active;
const cardActionIdleClass = `cursor-pointer ${dashboardControlFill.idle}`;

export { ControllerAffiliationMarks, ControllerNoMark, StallUnitNoMark };

/**
 * 카드 헤더 액션: «차트에서 보기»(차트 탭 이동) + 설정 순환(컨트롤러 ↔ 설정).
 * 그래프 모드는 은퇴 — 이력은 차트 탭에서 확인.
 */
function CardPanelModeToggle({
  hideActions,
  settingsActive,
  onToggleSettings,
  onOpenChart,
}: {
  hideActions?: boolean;
  settingsActive?: boolean;
  onToggleSettings?: () => void;
  onOpenChart?: () => void;
}) {
  const t = useSheetCopy();
  if (hideActions) return null;
  const canSettings = onToggleSettings != null;
  const canChart = onOpenChart != null;
  if (!canSettings && !canChart) return null;

  const settingsAria = settingsActive ? t("panel.toController") : t("panel.toSettings");
  const SettingsIcon = settingsActive ? ControllerDeviceIcon : Settings;

  return (
    <div className="flex shrink-0 flex-nowrap items-center gap-1">
      {canChart ? (
        <div
          className={cardActionWellClass}
          data-tour-id="panel-chart"
        >
          <button
            type="button"
            aria-label={t("panel.chart")}
            title={t("panel.chart")}
            onClick={(e) => {
              e.stopPropagation();
              onOpenChart?.();
            }}
            className={cn(cardActionBtnClass, cardActionIdleClass)}
          >
            <LineChart
              className="size-3.5"
              strokeWidth={dashboardUi.iconStroke}
              aria-hidden
            />
          </button>
        </div>
      ) : null}
      {canSettings ? (
        <div
          className={cardActionWellClass}
          data-tour-id="panel-pills"
        >
          <button
            type="button"
            aria-label={settingsAria}
            title={settingsActive ? t("list.controller") : t("list.settings")}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSettings?.();
            }}
            className={cn(
              cardActionBtnClass,
              settingsActive ? cardActionSelectedClass : cardActionIdleClass,
            )}
          >
            <SettingsIcon
              className="size-3.5"
              strokeWidth={dashboardUi.iconStroke}
              aria-hidden
            />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ControllerSummaryHeader({
  reading,
  alarmSettings,
  settingsActive,
  hideActions = false,
  showAffiliation = false,
  onToggleSettings,
  onOpenChart,
  onConcealDetail,
  bare = false,
  className,
}: {
  reading: BarnReading;
  alarmSettings?: AlarmSettings;
  settingsActive?: boolean;
  /** 그리드 상세 등 — 카드 헤더 액션(차트/설정) 숨김 */
  hideActions?: boolean;
  /**
   * true(일반 보기): 축사유형·축사번호·컨트롤러.
   * false(그룹별 보기): 구역 헤더와 중복되므로 컨트롤러만.
   */
  showAffiliation?: boolean;
  onToggleSettings?: () => void;
  /** «차트에서 보기» — 해당 컨트롤러 스코프로 차트 탭 이동 */
  onOpenChart?: () => void;
  /** 덮개 연 뒤 — 명칭·번호를 눌러 다시 덮음 */
  onConcealDetail?: () => void;
  bare?: boolean;
  className?: string;
}) {
  const t = useSheetCopy();
  const locale = useProfileSheetPrefs().locale;
  const stallTypeLabel = formatStallTypeLabelLocalized(reading.stallTyCode, locale);
  const notices = controllerEnvCoverNotices(reading, alarmSettings);
  const topNotice = notices[0];
  const bareLevel = coverNoticeLevel(topNotice);
  const BareIcon = !topNotice
    ? Check
    : topNotice.kind === "comm"
      ? Wifi
      : topNotice.kind === "temp"
        ? Thermometer
        : Droplets;
  const barePhrase = topNotice
    ? `${t(topNotice.kind === "comm" ? "cover.comm" : topNotice.kind === "temp" ? "cover.temp" : "cover.humidity")} ${t(topNotice.grade === "caution" ? "cover.caution" : topNotice.grade === "warning" ? "cover.warning" : "cover.down")}`
    : t("cover.ok");
  const envCoverLevel = controllerEnvCoverLevel(reading, alarmSettings);
  const titleBlock = showAffiliation ? (
    <>
      <span
        className={cn(
          "break-keep text-foreground",
          dashboardTypography.cardTitle,
        )}
        data-cover-morph-target="identity"
      >
        {stallTypeLabel}
      </span>
      <span
        className={cn(
          "mt-0.5 flex min-w-0 items-center gap-2",
          bare && "justify-center",
        )}
        data-cover-morph-target="marks"
      >
        <StallUnitNoMark
          stallNo={reading.stallNo}
          fitText
          className={cn(
            "text-muted-foreground",
            dashboardTypography.cardTitle,
          )}
        />
        <ControllerNoMark
          eqpmnNo={reading.eqpmnNo}
          fitText
          className={cn(
            "text-muted-foreground",
            dashboardTypography.cardTitle,
          )}
        />
      </span>
    </>
  ) : (
    <span data-cover-morph-target="identity" className="min-w-0">
      <ControllerNoMark
        eqpmnNo={reading.eqpmnNo}
        fitText
        className={cn(
          "text-foreground",
          dashboardTypography.cardTitle,
        )}
      />
    </span>
  );

  const identity = onConcealDetail ? (
    <button
      type="button"
      className={cn(
        "flex min-w-0 flex-1 items-start gap-1 text-left",
        bare && "w-full justify-center text-center",
        dashboardAffordance.hitSurface,
      )}
      aria-label={t("panel.hideDetail")}
      onClick={(e) => {
        e.stopPropagation();
        onConcealDetail();
      }}
    >
      <span
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-0.5",
          bare && "items-center",
        )}
      >
        {titleBlock}
      </span>
      <ChevronUp
        className={cn(dashboardAffordance.hitHint, "mt-1 text-muted-foreground")}
        aria-hidden
      />
    </button>
  ) : (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-0.5",
        bare && "w-full items-center text-center",
      )}
    >
      {titleBlock}
    </div>
  );

  const actions = (
    <CardPanelModeToggle
      hideActions={hideActions}
      settingsActive={settingsActive}
      onToggleSettings={onToggleSettings}
      onOpenChart={onOpenChart}
    />
  );

  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      {bare ? (
        <>
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "inline-flex min-w-0 flex-1 items-center gap-1 text-xs font-medium",
                controllerEnvCoverFillClass(bareLevel).replace("bg-", "text-"),
              )}
            >
              <BareIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{barePhrase}</span>
            </span>
            {actions}
          </div>
          <div className="flex w-full min-w-0 items-start justify-center">{identity}</div>
        </>
      ) : (
        <div className="flex min-w-0 flex-nowrap items-start gap-2">
          <span
            className={cn(
              "mt-1.5 size-2.5 shrink-0 rounded-sm",
              controllerEnvCoverFillClass(envCoverLevel),
            )}
            aria-hidden
          />
          <div className="flex min-w-0 flex-1 flex-nowrap items-start gap-2">
            {identity}
            {actions}
          </div>
        </div>
      )}
    </div>
  );
}

export function MetricValue({
  label,
  value,
  unit,
  accentClass,
  muted,
  alarmRange,
  alarmBreached,
}: {
  label: string;
  value: string;
  unit?: string;
  accentClass?: string;
  muted?: boolean;
  /** 해당 측정값(온도/습도)의 임계 가이드 상·하한 */
  alarmRange?: string;
  alarmBreached?: boolean;
}) {
  const t = useSheetCopy();
  return (
    <div className="min-w-0">
      <div className={cn("text-muted-foreground", dashboardTypography.formLabel)}>{label}</div>
      <div className="mt-0.5 flex items-end gap-0.5 tabular-nums">
        <span
          className={cn(
            dashboardUi.valueLg,
            muted ? "text-muted-foreground" : accentClass ?? "text-foreground"
          )}
        >
          {value}
        </span>
        {unit ? (
          <span className={cn("pb-0.5 text-muted-foreground", dashboardUi.value)}>
            {unit}
          </span>
        ) : null}
      </div>
      {alarmRange ? (
        <div
          className={cn(
            "mt-0.5 tabular-nums",
            dashboardTypography.meta,
            alarmBreached
              ? "font-semibold text-amber-700 dark:text-amber-400"
              : "text-muted-foreground"
          )}
        >
          {t("settings.threshold", { range: alarmRange })}
        </div>
      ) : null}
    </div>
  );
}

export function SetpointBlock({
  thermo,
}: {
  thermo: ControllerThermoSettings | null;
}) {
  const t = useSheetCopy();
  const { main, sub } = formatSetpointDisplay(thermo);
  return (
    <div className="min-w-0">
      <div className={cn("text-muted-foreground", dashboardTypography.formLabel)}>{t("settings.glanceSet")}</div>
      <div className={cn("mt-0.5 font-bold tabular-nums", dashboardUi.sectionTitle)}>
        {main}
        {main !== "—" ? "℃" : null}
      </div>
      {sub ? (
        <div className={cn("mt-0.5 text-muted-foreground", dashboardTypography.meta)}>{sub}</div>
      ) : null}
    </div>
  );
}

function setpointParts(
  raw:
    | { setpointTemp?: string | number | null; tempDeviation?: string | number | null }
    | null
    | undefined,
): { set: string; dev: string } | null {
  if (!raw || raw.setpointTemp == null || raw.tempDeviation == null) return null;
  const set = Number(raw.setpointTemp);
  const dev = Number(raw.tempDeviation);
  if (!Number.isFinite(set) || !Number.isFinite(dev)) return null;
  return { set: set.toFixed(1), dev: dev.toFixed(1) };
}

export function ChannelStrip({
  reading,
  thermo,
  compact,
  expandedChannel,
  onToggleChannel,
  controllerTrendByPeriod = null,
  period = "24h",
  thermoSettings = {},
  hideChannelTrendExpand = false,
}: {
  reading: BarnReading;
  thermo?: ControllerThermoSettings | null;
  compact?: boolean;
  expandedChannel?: ChannelSlot | null;
  onToggleChannel?: (slot: ChannelSlot) => void;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period?: TrendPeriodId;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  /** 표시 전용. 탭 시 채널 그래프는 차트 탭. */
  hideChannelTrendExpand?: boolean;
}) {
  const channels = channelPercentsFromReading(reading);
  const offline = reading.status === "offline";
  const interactive = onToggleChannel != null && !offline;

  return (
    <div className="min-w-0">
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {CHANNELS.map((slot) => {
          const ownSetpoint =
            setpointParts(resolveReadingChannelThermo(reading, thermoSettings, slot)) ??
            setpointParts(channelBySlot(reading.channels ?? [], slot)?.thermo);
          const setParts = ownSetpoint ?? setpointParts(thermo);
          return (
            <ChannelCell
              key={slot}
              slot={slot}
              value={formatChannelPercent(channels[slot])}
              setParts={setParts}
              compact={compact}
              expanded={expandedChannel === slot}
              interactive={interactive}
              onToggle={onToggleChannel}
            />
          );
        })}
      </div>
      {!hideChannelTrendExpand ? (
      <BarnListPanelShell
        open={Boolean(expandedChannel && interactive)}
        panelKind="channelTrend"
        className="mt-2"
      >
        {expandedChannel && interactive ? (
          <BarnChannelTrendPanel
            reading={reading}
            controllerTrendByPeriod={controllerTrendByPeriod}
            period={period}
            thermoSettings={thermoSettings}
            layout="single"
            slot={expandedChannel}
            compact
          />
        ) : null}
      </BarnListPanelShell>
      ) : null}
      {thermo ? (
        <VentGaugeV1
          min={thermo.minVentPct}
          max={thermo.maxVentPct}
          compact={compact}
          className="mt-2"
        />
      ) : null}
    </div>
  );
}

const motorSecondaryClass =
  "text-xs font-semibold tabular-nums leading-none text-muted-foreground";

function FanReadout({
  value,
  percent,
  showBar,
  size,
  compact,
}: {
  value: string;
  percent: number | null;
  showBar: boolean;
  size: "lg" | "sm";
  compact?: boolean;
}) {
  if (showBar && percent != null) {
    const shown = String(Math.round(percent));
    return (
      <span className="flex w-full min-w-0 items-center gap-1">
        <span
          className={cn(
            "block min-w-0 flex-1 overflow-hidden rounded-full bg-muted",
            size === "lg" ? "h-2" : "h-1",
          )}
          aria-hidden
        >
          <span
            className="block h-full bg-channel-motor"
            style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
          />
        </span>
        <span className={cn(size === "lg" ? "text-sm font-bold tabular-nums" : motorSecondaryClass)}>
          {shown}
        </span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        size === "lg"
          ? compact
            ? dashboardUi.gridCellValueCompact
            : dashboardUi.gridCellValueDefault
          : motorSecondaryClass,
      )}
    >
      {value}
      {value !== "—" ? <span className="ml-0.5 text-[10px] font-medium">%</span> : null}
    </span>
  );
}

function SetpointReadout({
  set,
  dev,
  size,
  compact,
}: {
  set: string;
  dev: string;
  size: "lg" | "sm";
  compact?: boolean;
}) {
  if (size === "lg") {
    return (
      <span className="inline-flex max-w-full items-baseline justify-center gap-1 whitespace-nowrap">
        <span
          className={cn(
            compact ? dashboardUi.gridCellValueCompact : dashboardUi.gridCellValueDefault,
          )}
        >
          {set}
        </span>
        <span className={motorSecondaryClass}>+{dev}</span>
      </span>
    );
  }
  return <span className={cn(motorSecondaryClass, "whitespace-nowrap")}>{set} +{dev}</span>;
}

function ChannelCell({
  slot,
  value,
  setParts,
  compact,
  expanded,
  interactive,
  onToggle,
}: {
  slot: ChannelSlot;
  value: string;
  setParts: { set: string; dev: string } | null;
  compact?: boolean;
  expanded?: boolean;
  interactive?: boolean;
  onToggle?: (slot: ChannelSlot) => void;
}) {
  const { motorDisplay, motorFocus } = useProfileSheetPrefs();
  const t = useSheetCopy();
  const slotLabel =
    slot === "A" ? t("cover.channel1") : slot === "B" ? t("cover.channel2") : t("cover.channel3");
  const percent = value === "—" ? null : Number(value);
  const showBar = motorDisplay === "bar" && percent != null && Number.isFinite(percent);
  const fanLarge = motorFocus !== "setpoint" || setParts == null;
  const label = setParts
    ? `${slotLabel} ${value}${value !== "—" ? "%" : ""} ${setParts.set} +${setParts.dev}`
    : `${slotLabel} ${value}${value !== "—" ? "%" : ""}`;
  const cellClass = cn(
    "relative min-h-[3rem] rounded-md border bg-background/80 sm:min-h-[3.25rem]",
    compact ? "p-1.5 sm:p-2" : "p-2 sm:p-2.5",
    expanded &&
      "border-channel-motor/60 bg-channel-motor/5 ring-1 ring-channel-motor/30",
    interactive &&
      cn(
        "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        motionClass.microHover,
      )
  );

  const inner = (
    <>
      <span
        className={cn(
          "absolute top-1 left-1/2 -translate-x-1/2 text-center font-semibold leading-none whitespace-nowrap sm:top-1.5",
          compact
            ? dashboardUi.gridCellMetaCompact
            : "text-[10px] sm:text-[11px]",
          "text-channel-motor",
        )}
      >
        {slotLabel}
      </span>
      <div className="flex h-full w-full min-h-[2.25rem] flex-col items-center justify-center gap-1 px-0.5 pt-2 sm:min-h-[2.5rem]">
        {fanLarge ? (
          <>
            <FanReadout value={value} percent={percent} showBar={showBar} size="lg" compact={compact} />
            {setParts ? <SetpointReadout set={setParts.set} dev={setParts.dev} size="sm" /> : null}
          </>
        ) : setParts ? (
          <>
            <SetpointReadout set={setParts.set} dev={setParts.dev} size="lg" compact={compact} />
            <FanReadout value={value} percent={percent} showBar={showBar} size="sm" />
          </>
        ) : null}
      </div>
      {expanded && interactive ? (
        <span
          className="absolute right-1.5 bottom-1 text-[10px] font-semibold text-channel-motor"
          aria-hidden
        >
          ▼
        </span>
      ) : null}
    </>
  );

  if (interactive && onToggle) {
    return (
      <button
        type="button"
        className={cellClass}
        aria-label={label}
        aria-expanded={expanded}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(slot);
        }}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={cellClass} aria-label={label}>
      {inner}
    </div>
  );
}

export function useControllerSummaryData(
  reading: BarnReading,
  thermoSettings: Record<string, ControllerThermoSettings>,
  alarmSettings?: AlarmSettings
) {
  const offline = reading.status === "offline";
  const thermo = resolveReadingThermo(reading, thermoSettings);
  const thresholds = resolveReadingAlarmThresholds(reading, alarmSettings);
  const temp = formatSensorNumberForDisplay(reading.status, reading.tempC);
  const humidity = formatSensorNumberForDisplay(reading.status, reading.humidityPct);
  const tempBreached = tempAlarmBreached(reading, thresholds);
  const humidityBreached = humidityAlarmBreached(reading, thresholds);
  return {
    offline,
    thermo,
    thresholds,
    temp,
    humidity,
    tempAlarmRange: formatTempAlarmRange(thresholds),
    humidityAlarmRange: formatHumidityAlarmRange(thresholds),
    tempAlarmBreached: tempBreached != null,
    humidityAlarmBreached: humidityBreached != null,
  };
}
