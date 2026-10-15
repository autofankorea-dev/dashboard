"use client";

import {
  type ComponentType,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Droplets,
  Fan,
  Thermometer,
  X,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type ChannelSlot } from "@/lib/domain/iot-channel";
import { useProfileSheetPrefs } from "@/components/account/profile-sheet-prefs";
import { channelSlotCopyKey, sheetCopy } from "@/lib/ui/sheet-copy";
import type { SheetLocale } from "@/lib/ui/profile-sheet-prefs";
import {
  COMMAND_HOLD_CHANNELS,
  type CommandChannelFlags,
} from "@/lib/farm/command-hold-bands";
import type {
  UnifiedLayerFlags,
  UnifiedLayerId,
} from "@/lib/farm/unified-barn-trend-series";
import { AlarmDomainIcon } from "@/components/settings/alarm-domain-icon";
import { ControllerNoMark } from "@/components/farm/controller-no-marks";
import { formatControllerNoLabel } from "@/lib/farm/controller-summary-display";
import {
  dashboardAffordance,
  dashboardElevation,
  dashboardUi,
} from "@/lib/ui/dashboard-page-ui";
import { farmChartUi } from "@/lib/ui/farm-chart-ui-scale";
import { motionClass } from "@/lib/ui/motion-classes";
import { usePresenceValue } from "@/lib/ui/use-clip-presence";
import { cn } from "@/lib/utils";

type Tone = "temp" | "hum" | "motor" | "command" | "neutral";

export type LayerGroupId = "temp" | "hum" | "motor";

const LAYER_TOOLBAR_GROUPS: readonly LayerGroupId[] = ["temp", "hum", "motor"];

function groupName(group: LayerGroupId, locale: SheetLocale): string {
  const key = group === "temp" ? "chart.temp" : group === "hum" ? "chart.humidity" : "chart.motor";
  return sheetCopy(locale, key);
}

function modeTooltip(group: LayerGroupId, mode: LayerGroupCycleMode, locale: SheetLocale): string {
  const name = groupName(group, locale);
  return sheetCopy(locale, mode === "base" ? "chart.baseView" : "chart.graphOff", { name });
}

function nextModeHint(group: LayerGroupId, mode: LayerGroupCycleMode, locale: SheetLocale): string {
  return sheetCopy(locale, "chart.nextPrefix", {
    hint: modeTooltip(group, nextLayerGroupMode(mode), locale),
  });
}

function alarmRangeTooltip(kind: "temp" | "hum", on: boolean, locale: SheetLocale): string {
  const name = sheetCopy(locale, kind === "temp" ? "chart.tempAlarm" : "chart.humAlarm");
  return sheetCopy(locale, on ? "chart.rangeOn" : "chart.rangeOff", { name });
}

function controllerToggleTooltip(eqpmnNo: string, on: boolean, locale: SheetLocale): string {
  const no = formatControllerNoLabel(eqpmnNo);
  const name = locale === "en"
    ? sheetCopy("en", "slot.controllerNo", { eq: no.replace(/번$/, "") })
    : `컨트롤러 ${no}`;
  return sheetCopy(locale, on ? "chart.toggleOn" : "chart.toggleOff", { name });
}

/** 그룹 토글 사이클: 기본보기(본선+산포) ↔ 끔 */
export type LayerGroupCycleMode = "base" | "off";

export type UnifiedTrendLayerAvailable = Record<UnifiedLayerId, boolean>;

/** 페이지 공유 툴바 — 온도·습도·모터 그룹을 항상 노출 */
export const UNIFIED_LAYER_TOOLBAR_AVAILABLE: UnifiedTrendLayerAvailable = {
  motors: true,
  motorCh: true,
  temp: true,
  hum: true,
  band: true,
  dev: true,
  ema: true,
  humBand: true,
  humDev: true,
  humEma: true,
  thermo: true,
  thermoMotor: true,
};

/** 차트 탭 공유 — 모든 칸 그래프에 같은 레이어·알람 띠 */
export type SharedChartLayerDisplay = {
  layers: UnifiedLayerFlags;
  alarmRangeOn: { temp: boolean; hum: boolean };
};

const GROUP_MAIN: Record<LayerGroupId, UnifiedLayerId> = {
  temp: "temp",
  hum: "hum",
  motor: "motors",
};

/** 끌 때 함께 끄는 상세 레이어(범위·추세·채널 등) */
const GROUP_SUBS: Record<LayerGroupId, readonly UnifiedLayerId[]> = {
  temp: ["ema", "dev", "band"],
  hum: ["humEma", "humDev", "humBand"],
  motor: ["motorCh"],
};

/** 기본보기 — 본선 + 산포. 모터는 본선만. 설정 변경은 별도 토글 */
const GROUP_BASE_SUBS: Record<LayerGroupId, readonly UnifiedLayerId[]> = {
  temp: ["band"],
  hum: ["humBand"],
  motor: [],
};

const GROUP_META: Record<
  LayerGroupId,
  {
    tone: Tone;
    Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    baseLabel: string;
  }
> = {
  temp: { tone: "temp", Icon: Thermometer, baseLabel: "온도" },
  hum: { tone: "hum", Icon: Droplets, baseLabel: "습도" },
  motor: { tone: "motor", Icon: Fan, baseLabel: "모터" },
};

function availableSubs(
  group: LayerGroupId,
  available: UnifiedTrendLayerAvailable,
): UnifiedLayerId[] {
  return GROUP_SUBS[group].filter((id) => available[id]);
}

function availableBaseSubs(
  group: LayerGroupId,
  available: UnifiedTrendLayerAvailable,
): UnifiedLayerId[] {
  return GROUP_BASE_SUBS[group].filter((id) => available[id]);
}

export function detectLayerGroupMode(
  layers: UnifiedLayerFlags,
  available: UnifiedTrendLayerAvailable,
  group: LayerGroupId,
): LayerGroupCycleMode {
  const main = GROUP_MAIN[group];
  const subs = availableSubs(group, available);
  const mainOn = layers[main];
  const anySubOn = subs.some((id) => layers[id]);

  if (!mainOn && !anySubOn) return "off";
  return "base";
}

export function nextLayerGroupMode(
  mode: LayerGroupCycleMode,
): LayerGroupCycleMode {
  return mode === "base" ? "off" : "base";
}

export function applyLayerGroupMode(
  prev: UnifiedLayerFlags,
  group: LayerGroupId,
  mode: LayerGroupCycleMode,
  available: UnifiedTrendLayerAvailable,
): UnifiedLayerFlags {
  const next = { ...prev };
  const main = GROUP_MAIN[group];
  const baseSubs = availableBaseSubs(group, available);

  if (mode === "base") {
    next[main] = true;
    for (const id of GROUP_SUBS[group]) next[id] = false;
    for (const id of baseSubs) next[id] = true;
    return next;
  }

  next[main] = false;
  for (const id of GROUP_SUBS[group]) next[id] = false;
  return next;
}


export type LayerControllerToggle = {
  key: string;
  eqpmnNo: string;
  on: boolean;
};

type Props = {
  layers: UnifiedLayerFlags;
  available: UnifiedTrendLayerAvailable;
  onCycleGroup: (group: LayerGroupId) => void;
  className?: string;
  compact?: boolean;
  /** 시계열 응답 전 — 빈 지표 회색 카드를 아직 띄우지 않음 */
  metricsPending?: boolean;
  /** @deprecated 헤더 인라인만 사용. hub 무시 */
  placement?: "hub" | "inline";
  /** 온도·습도 알람 범위 띠 (헤더 ON/OFF) */
  tempAlarmOn?: boolean;
  humAlarmOn?: boolean;
  tempAlarmAvailable?: boolean;
  humAlarmAvailable?: boolean;
  onToggleTempAlarm?: () => void;
  onToggleHumAlarm?: () => void;
  /** 펼친 축사 오버레이 — 컨트롤러 번호별 본선 켜기/끄기 */
  controllerToggles?: LayerControllerToggle[];
  onToggleController?: (key: string) => void;
};

function toneActiveClass(tone: Tone): string {
  switch (tone) {
    case "temp":
      return dashboardUi.chartLayerGroupTemp;
    case "hum":
      return dashboardUi.chartLayerGroupHum;
    case "motor":
      return dashboardUi.chartLayerGroupMotor;
    case "command":
      return dashboardUi.chartLayerGroupCommand;
    default:
      return "border-border bg-muted text-foreground";
  }
}

function iconBtnClass(
  active: boolean,
  muted: boolean,
  tone: Tone,
  empty = false,
) {
  return cn(
    "relative inline-flex shrink-0 items-center justify-center overflow-visible rounded-md border",
    farmChartUi.control,
    motionClass.microInteractive,
    empty
      ? "border-border bg-muted text-muted-foreground"
      : active
        ? toneActiveClass(tone)
        : muted
          ? cn(dashboardAffordance.chipToggleIdle, "text-muted-foreground/80")
          : dashboardUi.chartLayerActionBtnIdle,
  );
}

function IconTipButton({
  label,
  on,
  pressed,
  muted,
  empty = false,
  expanded,
  tone = "neutral",
  onClick,
  children,
  className,
  style,
}: {
  label: string;
  on?: boolean;
  pressed?: boolean;
  muted?: boolean;
  empty?: boolean;
  expanded?: boolean;
  tone?: Tone;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const active = Boolean(on ?? pressed);
  const classNameResolved = cn(
    iconBtnClass(active, Boolean(muted), tone, empty),
    className,
  );
  if (empty) {
    return (
      <button
        type="button"
        aria-label={label}
        aria-expanded={Boolean(expanded)}
        onClick={onClick}
        className={classNameResolved}
        style={style}
      >
        {children}
      </button>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        className={classNameResolved}
        style={style}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8} className="z-[80]">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function EmptyMetricNoticeCard({
  anchor,
  phase,
}: {
  anchor: HTMLElement | null;
  phase: "enter" | "exit";
}) {
  const locale = useProfileSheetPrefs().locale;
  const [box, setBox] = useState<{ top: number; left: number } | null>(() => {
    if (!anchor) return null;
    const r = anchor.getBoundingClientRect();
    return { top: r.bottom + 8, left: r.left };
  });
  useEffect(() => {
    if (!anchor) return;
    const update = () => {
      const r = anchor.getBoundingClientRect();
      setBox({ top: r.bottom + 8, left: r.left });
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [anchor]);
  if (!box || typeof document === "undefined") return null;
  return createPortal(
    <div
      role="status"
      className={cn(
        "fixed z-[80]",
        farmChartUi.root,
        phase === "exit"
          ? motionClass.farmChartTipOut
          : motionClass.farmChartTipIn,
      )}
      style={{ top: box.top, left: box.left }}
    >
      <div
        className={cn(
          dashboardElevation.overlay,
          "px-3 py-2 text-popover-foreground",
          farmChartUi.fsBody,
        )}
      >
        {sheetCopy(locale, "chart.emptyCard")}
      </div>
    </div>,
    document.body,
  );
}

function ModeOverlay({ mode }: { mode: LayerGroupCycleMode }) {
  const Icon = mode === "base" ? Check : X;
  return (
    <span
      key={mode}
      className={cn(
        "pointer-events-none absolute -right-0.5 -top-0.5 z-[2] flex items-center justify-center rounded-full border bg-background shadow-sm",
        farmChartUi.controlBadge,
        mode === "off"
          ? "border-muted-foreground/40 text-muted-foreground"
          : "border-current/30 text-current",
        motionClass.farmChartLayerBadgePop,
      )}
      aria-hidden
    >
      <Icon className={farmChartUi.controlBadgeIcon} strokeWidth={2.5} />
    </span>
  );
}

/**
 * 차트 레이어 툴바 — 온도·습도·모터 가로 버튼 (헤더용).
 * 각 버튼 클릭: 기본보기(본선+산포) ↔ 끔.
 */
export function UnifiedTrendLayerToolbar({
  layers,
  available,
  onCycleGroup,
  className,
  compact = false,
  metricsPending = false,
  tempAlarmOn = true,
  humAlarmOn = true,
  tempAlarmAvailable = false,
  humAlarmAvailable = false,
  onToggleTempAlarm,
  onToggleHumAlarm,
  controllerToggles,
  onToggleController,
}: Props) {
  const locale = useProfileSheetPrefs().locale;
  const [emptyNotice, setEmptyNotice] = useState<LayerGroupId | null>(null);
  const [emptyAnchor, setEmptyAnchor] = useState<HTMLElement | null>(null);
  const emptyPresence = usePresenceValue(emptyAnchor, {
    open: emptyNotice != null,
  });
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!emptyNotice) return;
    const onPointerDown = (event: PointerEvent) => {
      const node = toolbarRef.current;
      if (node && !node.contains(event.target as Node)) {
        setEmptyNotice(null);
        setEmptyAnchor(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEmptyNotice(null);
        setEmptyAnchor(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [emptyNotice]);

  const dismissEmptyNotice = () => {
    setEmptyNotice(null);
    setEmptyAnchor(null);
  };

  return (
    <TooltipProvider delay={200}>
      <div
        ref={toolbarRef}
        className={cn(
          "farm-chart-toolbar-responsive inline-flex max-w-full flex-wrap items-center gap-2 overflow-visible",
          compact && "farm-chart-toolbar-compact",
          className,
        )}
        data-tour-id="unified-trend-layer-toolbar"
        data-placement="inline"
        role="group"
        aria-label={sheetCopy(locale, "chart.layers")}
      >
        {LAYER_TOOLBAR_GROUPS.map((group) => {
          const meta = GROUP_META[group];
          const Icon = meta.Icon;
          const hasSeries = available[GROUP_MAIN[group]];
          const empty = !hasSeries && !metricsPending;
          const mode = detectLayerGroupMode(layers, available, group);
          const on = hasSeries && mode !== "off";
          const emptyOpen = emptyNotice === group;
          const tip = empty
            ? `${groupName(group, locale)} · ${sheetCopy(locale, "chart.emptyCard")}`
            : `${modeTooltip(group, mode, locale)} · ${nextModeHint(group, mode, locale)}`;

          return (
            <div
              key={group}
              className="relative overflow-visible"
            >
              <IconTipButton
                label={tip}
                pressed={on}
                on={on}
                muted={!on}
                empty={empty}
                expanded={emptyOpen}
                tone={meta.tone}
                onClick={(event) => {
                  if (metricsPending && !hasSeries) return;
                  if (empty) {
                    if (emptyNotice === group) {
                      dismissEmptyNotice();
                      return;
                    }
                    setEmptyNotice(group);
                    setEmptyAnchor(event.currentTarget);
                    return;
                  }
                  dismissEmptyNotice();
                  onCycleGroup(group);
                }}
              >
                <Icon
                  className={farmChartUi.controlIcon}
                  aria-hidden
                />
                {hasSeries ? <ModeOverlay mode={mode} /> : null}
              </IconTipButton>
            </div>
          );
        })}
        {(tempAlarmAvailable && onToggleTempAlarm) ||
        (humAlarmAvailable && onToggleHumAlarm) ? (
          <span
            className={cn(
              "mx-1 w-px shrink-0 bg-border",
              farmChartUi.controlRule,
            )}
            aria-hidden
          />
        ) : null}
        {tempAlarmAvailable && onToggleTempAlarm ? (
          <div className="relative overflow-visible">
            <IconTipButton
              label={alarmRangeTooltip("temp", tempAlarmOn, locale)}
              pressed={tempAlarmOn}
              on={tempAlarmOn}
              muted={!tempAlarmOn}
              tone="temp"
              onClick={() => {
                dismissEmptyNotice();
                onToggleTempAlarm();
              }}
            >
              <AlarmDomainIcon
                domain="temp"
                tone="inherit"
                sizeClass={farmChartUi.controlIcon}
              />
              <ModeOverlay mode={tempAlarmOn ? "base" : "off"} />
            </IconTipButton>
          </div>
        ) : null}
        {humAlarmAvailable && onToggleHumAlarm ? (
          <div className="relative overflow-visible">
            <IconTipButton
              label={alarmRangeTooltip("hum", humAlarmOn, locale)}
              pressed={humAlarmOn}
              on={humAlarmOn}
              muted={!humAlarmOn}
              tone="hum"
              onClick={() => {
                dismissEmptyNotice();
                onToggleHumAlarm();
              }}
            >
              <AlarmDomainIcon
                domain="humidity"
                tone="inherit"
                sizeClass={farmChartUi.controlIcon}
              />
              <ModeOverlay mode={humAlarmOn ? "base" : "off"} />
            </IconTipButton>
          </div>
        ) : null}
        {controllerToggles &&
        controllerToggles.length > 0 &&
        onToggleController ? (
          <>
            <span
              className={cn(
              "mx-1 w-px shrink-0 bg-border",
              farmChartUi.controlRule,
            )}
              aria-hidden
            />
            {controllerToggles.map((item) => (
              <div key={item.key} className="relative overflow-visible">
                <IconTipButton
                  label={controllerToggleTooltip(item.eqpmnNo, item.on, locale)}
                  pressed={item.on}
                  on={item.on}
                  muted={!item.on}
                  tone="neutral"
                  onClick={() => {
                    dismissEmptyNotice();
                    onToggleController(item.key);
                  }}
                >
                  <ControllerNoMark
                    eqpmnNo={item.eqpmnNo}
                    onFill
                    className={cn("text-current", farmChartUi.controlIcon)}
                  />
                  <ModeOverlay mode={item.on ? "base" : "off"} />
                </IconTipButton>
              </div>
            ))}
          </>
        ) : null}
      </div>
      {emptyPresence.mounted && emptyPresence.value ? (
        <EmptyMetricNoticeCard
          anchor={emptyPresence.value}
          phase={emptyPresence.phase}
        />
      ) : null}
    </TooltipProvider>
  );
}

/** 명령 이력 1차·2차·3차 켜기/끄기. 명령 토글이 켜진 뒤 그래프 아래에 둔다. */
export function CommandChannelLayerToolbar({
  channels,
  onToggle,
  className,
}: {
  channels: CommandChannelFlags;
  onToggle: (channel: ChannelSlot) => void;
  className?: string;
}) {
  const locale = useProfileSheetPrefs().locale;
  return (
    <TooltipProvider delay={200}>
      <div
        className={cn(
          "farm-chart-toolbar-fit inline-flex max-w-full items-center gap-2 overflow-visible",
          className,
        )}
        data-tour-id="chart-command-channel-toolbar"
        role="group"
        aria-label={sheetCopy(locale, "chart.commandLane")}
      >
        {COMMAND_HOLD_CHANNELS.map((channel) => {
          const on = channels[channel];
          const slot = sheetCopy(locale, channelSlotCopyKey(channel));
          const label = sheetCopy(locale, on ? "chart.commandOn" : "chart.commandOff", { slot });
          return (
            <div key={channel} className="relative overflow-visible">
              <IconTipButton
                label={label}
                pressed={on}
                on={on}
                muted={!on}
                tone="command"
                onClick={() => onToggle(channel)}
              >
                <span className={cn("font-semibold", farmChartUi.fsTitle)} aria-hidden>
                  {channel}
                </span>
                <ModeOverlay mode={on ? "base" : "off"} />
              </IconTipButton>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
