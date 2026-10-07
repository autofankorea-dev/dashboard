"use client";

import type { CSSProperties } from "react";

import {
  buildGaugeFillSegments,
  setpointBandPct,
} from "@/lib/farm/controller-summary-display";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";
import { Droplets, Thermometer } from "lucide-react";

type GaugeMetricProps = {
  label: "온도" | "습도";
  value: number | null;
  displayValue: string;
  unit: string;
  low: number;
  high: number;
  offline: boolean;
  breached: boolean;
  setpoint?: number;
  setDev?: number;
  className?: string;
};

const TEXT_ACCENT = {
  온도: "text-channel-temp",
  습도: "text-channel-hum",
} as const;

const FILL_ACCENT = {
  온도: "bg-channel-temp",
  습도: "bg-channel-hum",
} as const;

/** 설정온도±편차 밴드 — 온도 채널과 같은 색상각, 명도만 올림(primary 금지) */
const TEMP_SETPOINT_BAND =
  "bg-[color-mix(in_oklch,var(--channel-temp)_34%,var(--mix-lift))] ring-1 ring-inset ring-[color-mix(in_oklch,var(--channel-temp)_58%,transparent)]";

/** 임계 값 pill — 숫자만 (워터마크 아이콘 없음) */
function ValuePillBadge({
  label,
  accentClass,
  ariaLabel,
  compact,
}: {
  label: string;
  accentClass: string;
  ariaLabel: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-md border border-border bg-muted/60",
        compact ? "h-5 min-w-8 px-0.5" : "h-[22px] min-w-8 px-1"
      )}
      aria-label={ariaLabel}
    >
      <span
        className={cn(
          "font-bold tabular-nums leading-none",
          compact ? "text-[10px]" : "text-[11px]",
          accentClass
        )}
      >
        {label}
      </span>
    </div>
  );
}

function BellBadge({
  value,
  unit,
  accentClass,
  ariaLabel,
  compact,
}: {
  value: string;
  unit: string;
  accentClass: string;
  ariaLabel: string;
  compact?: boolean;
}) {
  return (
    <ValuePillBadge
      label={`${value}${unit}`}
      accentClass={accentClass}
      ariaLabel={ariaLabel}
      compact={compact}
    />
  );
}

function PercentEdgeBadge({
  value,
  unit,
  ariaLabel,
  compact,
}: {
  value: string;
  unit: string;
  ariaLabel: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border border-border bg-muted/60 font-bold tabular-nums leading-none text-channel-hum",
        compact ? "h-5 min-w-8 px-0.5 text-[10px]" : "h-[22px] min-w-8 px-1 text-[11px]",
      )}
      aria-label={ariaLabel}
    >
      {value}
      {unit}
    </div>
  );
}

/** 환기 — 최저·최고 % pill + range bar */
export function VentGaugeV1({
  min,
  max,
  compact,
  className,
}: {
  min: number;
  max: number;
  compact?: boolean;
  className?: string;
}) {
  const span = Math.max(max - min, 0);
  return (
    <div className={cn("flex min-w-0 items-center gap-1 sm:gap-1.5", className)}>
      <PercentEdgeBadge
        value={String(min)}
        unit="%"
        ariaLabel={`최저환기 ${min}%`}
        compact={compact}
      />
      <div
        className={cn(
          "relative min-w-0 flex-1 overflow-hidden rounded-full bg-muted/50",
          compact ? "h-1" : "h-1.5"
        )}
        role="img"
        aria-label={`환기 ${min}–${max}%`}
      >
        <div
          className="absolute inset-y-0 rounded-full bg-channel-hum/45"
          style={{ left: `${min}%`, width: `${span}%` }}
          aria-hidden
        />
      </div>
      <PercentEdgeBadge
        value={String(max)}
        unit="%"
        ariaLabel={`최고환기 ${max}%`}
        compact={compact}
      />
    </div>
  );
}

function buildGaugeAriaLabel({
  label,
  displayValue,
  unit,
  low,
  high,
  setpoint,
  setDev,
}: {
  label: "온도" | "습도";
  displayValue: string;
  unit: string;
  low: number;
  high: number;
  setpoint?: number;
  setDev?: number;
}): string {
  const parts = [displayValue === "—" ? `${label}값 미수신` : `${label} ${displayValue}${unit}`, `알람 ${low}–${high}${unit}`];
  if (label === "온도" && setpoint != null && setDev != null) {
    parts.push(`설정 ${setpoint}±${setDev}${unit}`);
  }
  return parts.join(" · ");
}

function MetricValue({
  label,
  displayValue,
  unit,
  offline,
  breached,
  compact,
}: Pick<GaugeMetricProps, "label" | "displayValue" | "unit" | "offline" | "breached"> & {
  compact?: boolean;
}) {
  const accent = TEXT_ACCENT[label];
  const Icon = label === "온도" ? Thermometer : Droplets;

  return (
    <div className="flex min-w-0 items-center gap-1.5" title={displayValue === "—" ? `${label}값 미수신` : undefined}>
      <Icon className={cn("size-4 shrink-0", accent)} aria-hidden />
      <span
        className={cn(
          "font-bold tabular-nums",
          compact ? "text-base" : dashboardUi.valueLg,
          offline
            ? "text-muted-foreground"
            : breached
              ? "text-amber-700 dark:text-amber-400"
              : accent
        )}
      >
        {displayValue}
        {displayValue !== "—" ? unit : null}
      </span>
    </div>
  );
}

/** 카드 게이지 — metric 아이콘 + BellBadge flanking + 설정 밴드(온도) */
export function CardMetricGauge({
  label,
  value,
  displayValue,
  unit,
  low,
  high,
  offline,
  breached,
  setpoint,
  setDev,
  className,
  compact,
  showValue = true,
  barClassName,
  morphTarget,
  bandGlow = false,
  bandGlowIn = false,
  bandGlowOut = false,
  glowVar,
}: GaugeMetricProps & {
  compact?: boolean;
  /** false — 게이지 트랙만 (EnvMetricPanel 등) */
  showValue?: boolean;
  barClassName?: string;
  morphTarget?: "temp-band" | "humidity-band";
  bandGlow?: boolean;
  bandGlowIn?: boolean;
  bandGlowOut?: boolean;
  glowVar?: string;
}) {
  // Retired or missing alarm limits are not measurements and must never render as NaN%.
  if (!Number.isFinite(low) || !Number.isFinite(high) || low >= high) {
    return showValue ? <div className={className}><MetricValue label={label} displayValue={displayValue} unit={unit} offline={offline} breached={false} compact={compact} /></div> : null;
  }
  const { span, cur, rest, pct } = buildGaugeFillSegments(value, low, high, offline);
  const band =
    label === "온도" && setpoint != null && setDev != null
      ? setpointBandPct(setpoint, setDev, low, high)
      : null;
  const curPct = span > 0 ? (cur / span) * 100 : 0;
  const accent = TEXT_ACCENT[label];
  const lowStr = String(low);
  const highStr = String(high);
  const ariaLabel = buildGaugeAriaLabel({
    label,
    displayValue,
    unit,
    low,
    high,
    setpoint,
    setDev,
  });

  return (
    <div className={cn("min-w-0", className)}>
      {showValue ? (
        <div className="mb-1.5 flex min-w-0 items-center gap-1.5">
          <MetricValue
            label={label}
            displayValue={displayValue}
            unit={unit}
            offline={offline}
            breached={breached}
            compact={compact}
          />
        </div>
      ) : null}

      <div
        data-cover-morph-target={morphTarget}
        className={cn(
          "flex min-w-0 items-center gap-1 rounded-md sm:gap-1.5",
          bandGlow && motionClass.coverRevealBandGlow,
          bandGlow && bandGlowIn && motionClass.coverRevealBandGlowIn,
          bandGlow && bandGlowOut && motionClass.coverRevealBandGlowOut,
        )}
        style={
          glowVar
            ? ({ ["--cover-reveal-glow" as string]: glowVar } as CSSProperties)
            : undefined
        }
      >
        <BellBadge
          value={lowStr}
          unit={unit}
          accentClass={accent}
          ariaLabel={`임계 하한 ${low}${unit}`}
          compact={compact}
        />
        <div
          className={cn(
            "relative min-w-0 flex-1 overflow-hidden rounded-md border bg-muted/40",
            compact ? "h-2.5" : "h-3",
            barClassName
          )}
          role="img"
          aria-label={ariaLabel}
        >
          {band ? (
            <div
              className={cn(
                "pointer-events-none absolute inset-y-0 z-[1] rounded-sm",
                TEMP_SETPOINT_BAND,
              )}
              style={{ left: `${band.left}%`, width: `${band.width}%` }}
              aria-hidden
            />
          ) : null}
          {!offline && cur > 0 ? (
            <div
              className={cn(
                "absolute inset-y-0 left-0 z-[0] rounded-md",
                breached ? "bg-amber-500" : FILL_ACCENT[label]
              )}
              style={{ width: `${curPct}%` }}
            />
          ) : null}
          {!offline && rest > 0 ? (
            <div className="absolute inset-y-0 right-0 bg-muted/20" style={{ width: `${100 - curPct}%` }} />
          ) : null}
          {offline ? <div className="absolute inset-0 bg-muted/40" aria-hidden /> : null}
          {pct != null && !offline ? (
            <div
              className="absolute top-[-1px] z-[2] h-3.5 w-2.5 rounded-full bg-foreground"
              style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
              aria-hidden
            />
          ) : null}
        </div>
        <BellBadge
          value={highStr}
          unit={unit}
          accentClass={accent}
          ariaLabel={`임계 상한 ${high}${unit}`}
          compact={compact}
        />
      </div>
    </div>
  );
}

type EnvMetricPanelProps = {
  temp: Pick<GaugeMetricProps, "value" | "displayValue" | "low" | "high" | "breached">;
  humidity: Pick<GaugeMetricProps, "value" | "displayValue" | "low" | "high" | "breached">;
  offline: boolean;
  setpoint?: number;
  setDev?: number;
  className?: string;
  glowBand?: "temp" | "humidity" | null;
  bandGlowIn?: boolean;
  bandGlowOut?: boolean;
  glowVar?: string;
  siblingEnter?: boolean;
  siblingExit?: boolean;
};

/** 안 A — 온·습도 통합 패널: 값 1줄 + full-width 게이지 2단 */
export function EnvMetricPanel({
  temp,
  humidity,
  offline,
  setpoint,
  setDev,
  className,
  glowBand = null,
  bandGlowIn = false,
  bandGlowOut = false,
  glowVar,
  siblingEnter = false,
  siblingExit = false,
}: EnvMetricPanelProps) {
  return (
    <div className={cn("rounded-lg border bg-muted/20 p-2 sm:p-2.5", className)}>
      <div
        data-cover-reveal-values=""
        className="mb-2 flex min-w-0 items-center justify-between gap-3"
      >
        <MetricValue
          label="온도"
          displayValue={temp.displayValue}
          unit="℃"
          offline={offline}
          breached={temp.breached}
          compact
        />
        <MetricValue
          label="습도"
          displayValue={humidity.displayValue}
          unit="%"
          offline={offline}
          breached={humidity.breached}
          compact
        />
      </div>
      <div className="space-y-2">
        <CardMetricGauge
          compact
          showValue={false}
          barClassName="h-3"
          morphTarget="temp-band"
          bandGlow={glowBand === "temp"}
          bandGlowIn={glowBand === "temp" && bandGlowIn}
          bandGlowOut={glowBand === "temp" && bandGlowOut}
          glowVar={glowBand === "temp" ? glowVar : undefined}
          className={
            glowBand === "humidity" && siblingEnter
              ? motionClass.coverRevealHumidityIn
              : glowBand === "humidity" && siblingExit
                ? motionClass.coverRevealHumidityOut
                : undefined
          }
          label="온도"
          value={temp.value}
          displayValue={temp.displayValue}
          unit="℃"
          low={temp.low}
          high={temp.high}
          offline={offline}
          breached={temp.breached}
          setpoint={setpoint}
          setDev={setDev}
        />
        <CardMetricGauge
          compact
          showValue={false}
          morphTarget="humidity-band"
          bandGlow={glowBand === "humidity"}
          bandGlowIn={glowBand === "humidity" && bandGlowIn}
          bandGlowOut={glowBand === "humidity" && bandGlowOut}
          glowVar={glowBand === "humidity" ? glowVar : undefined}
          className={
            glowBand === "temp" && siblingEnter
              ? motionClass.coverRevealHumidityIn
              : glowBand === "temp" && siblingExit
                ? motionClass.coverRevealHumidityOut
                : undefined
          }
          label="습도"
          value={humidity.value}
          displayValue={humidity.displayValue}
          unit="%"
          low={humidity.low}
          high={humidity.high}
          offline={offline}
          breached={humidity.breached}
        />
      </div>
    </div>
  );
}
