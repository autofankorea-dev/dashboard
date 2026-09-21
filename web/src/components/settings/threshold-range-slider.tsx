"use client";

import { useCallback, useId, useRef } from "react";
import {
  SliderThumbLabel,
  sliderTrackRailBgClass,
  sliderTrackRailClass,
  sliderTrackShellClass,
} from "@/components/ui/slider-thumb-label";
import { useDualThumbLabelPositions } from "@/lib/ui/use-dual-thumb-label-positions";
import {
  SliderBoundFields,
  type SliderValueInputSize,
} from "@/components/ui/slider-value-input";
import {
  alarmBaselineFromRange,
  alarmRangeFromBaseline,
} from "@/lib/data/alarm-baseline";
import { dashboardTypography, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
import { useSliderDragThumb } from "@/lib/ui/use-slider-drag-thumb";
import { cn } from "@/lib/utils";

type ThresholdRangeSliderProps = {
  title: string;
  icon: React.ReactNode;
  min: number;
  max: number;
  step: number;
  low: number;
  high: number;
  unit: string;
  lowLabel?: string;
  highLabel?: string;
  disabled?: boolean;
  compact?: boolean;
  accentClass?: string;
  /** 트랙 양끝 축 — domain=정적 min/max, editable=트랙 위 숫자 필드 */
  axisMode?: "hidden" | "domain" | "editable";
  /**
   * range=하한·상한(환기).
   * baseline-dev=기준±편차(온·습 알람). 저장은 여전히 lo/hi.
   */
  valueMode?: "range" | "baseline-dev";
  /** @deprecated axisMode="domain" 사용 */
  showAxis?: boolean;
  /** axisMode editable 시 Input 크기 */
  axisInputSize?: SliderValueInputSize;
  /** thumb 라벨 typography 오버라이드 (예: 다른 slider와 크기 동기화) */
  thumbLabelClassName?: string;
  /** 헤더 제목 typography 오버라이드 */
  titleClassName?: string;
  /** showAxis 축 라벨 typography 오버라이드 */
  axisClassName?: string;
  /** 카드/보더 래퍼 없이 트랙만 (섹션 내부 embed) */
  bare?: boolean;
  /** 트랙 shell padding 오버라이드 */
  trackShellClassName?: string;
  onChange: (low: number, high: number) => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function snap(n: number, step: number) {
  const s = 1 / step;
  return Math.round(n * s) / s;
}

function pct(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return ((value - min) / (max - min)) * 100;
}

function fmtValue(value: number, step: number) {
  if (step >= 1) return String(Math.round(value));
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** 상·하한 — dual-thumb range (허용 구간) */
export function ThresholdRangeSlider({
  title,
  icon,
  min,
  max,
  step,
  low,
  high,
  unit,
  lowLabel,
  highLabel,
  disabled = false,
  compact = false,
  accentClass = "bg-emerald-500/35",
  axisMode,
  valueMode = "range",
  showAxis = false,
  axisInputSize,
  thumbLabelClassName,
  titleClassName,
  axisClassName,
  bare = false,
  trackShellClassName,
  onChange,
}: ThresholdRangeSliderProps) {
  const id = useId();
  const mobile = useMobileLayout();
  const { dragThumb, dragging, onLowPointerDown, onHighPointerDown } =
    useSliderDragThumb();
  const lowPct = pct(low, min, max);
  const highPct = pct(high, min, max);
  const lowText = `${fmtValue(low, step)}${unit}`;
  const highText = `${fmtValue(high, step)}${unit}`;
  const mobileDrag = mobile && dragging;

  const resolvedAxisMode = axisMode ?? (showAxis ? "domain" : "hidden");
  const baselineMode = valueMode === "baseline-dev";
  const resolvedLowLabel =
    lowLabel ?? (baselineMode ? "기준" : "하한");
  const resolvedHighLabel =
    highLabel ?? (baselineMode ? "편차" : "상한");
  const { baseline, deviation } = alarmBaselineFromRange(low, high);
  const maxDeviation = Math.max(
    step,
    snap(Math.min(baseline - min, max - baseline), step),
  );
  const inputSize = axisInputSize ?? (compact ? "compact" : "dashboard");
  const showBoundFields = resolvedAxisMode === "editable";
  const hideTrack = showBoundFields;
  const showThumbLabels = !hideTrack && (!showBoundFields || mobileDrag);

  const railRef = useRef<HTMLDivElement>(null);
  const lowLabelRef = useRef<HTMLSpanElement>(null);
  const highLabelRef = useRef<HTMLSpanElement>(null);
  // 모바일 drag 중에는 한쪽 라벨만 확대 표시 → 겹침 회피 비활성
  const labelPos = useDualThumbLabelPositions({
    railRef,
    lowRef: lowLabelRef,
    highRef: highLabelRef,
    lowPct,
    highPct,
    deps: [lowText, highText, mobileDrag],
    enabled: showThumbLabels && !mobileDrag,
  });

  const setLow = useCallback(
    (raw: number) => {
      if (baselineMode) {
        const { baseline } = alarmBaselineFromRange(low, high);
        const next = snap(clamp(raw, min, max), step);
        const range = alarmRangeFromBaseline(baseline, Math.abs(next - baseline), {
          min,
          max,
          step,
        });
        onChange(range.lo, range.hi);
        return;
      }
      const next = snap(clamp(raw, min, max), step);
      if (next > high) onChange(high, next);
      else onChange(next, high);
    },
    [baselineMode, high, low, max, min, onChange, step],
  );

  const setHigh = useCallback(
    (raw: number) => {
      if (baselineMode) {
        const { baseline } = alarmBaselineFromRange(low, high);
        const next = snap(clamp(raw, min, max), step);
        const range = alarmRangeFromBaseline(baseline, Math.abs(next - baseline), {
          min,
          max,
          step,
        });
        onChange(range.lo, range.hi);
        return;
      }
      const next = snap(clamp(raw, min, max), step);
      if (next < low) onChange(next, low);
      else onChange(low, next);
    },
    [baselineMode, high, low, max, min, onChange, step],
  );

  const setBaseline = useCallback(
    (raw: number) => {
      const { deviation } = alarmBaselineFromRange(low, high);
      const range = alarmRangeFromBaseline(raw, deviation, { min, max, step });
      onChange(range.lo, range.hi);
    },
    [high, low, max, min, onChange, step],
  );

  const setDeviation = useCallback(
    (raw: number) => {
      const { baseline } = alarmBaselineFromRange(low, high);
      const range = alarmRangeFromBaseline(baseline, raw, { min, max, step });
      onChange(range.lo, range.hi);
    },
    [high, low, max, min, onChange, step],
  );

  const rangeClass = cn(
    "threshold-dual-range absolute inset-0 h-full w-full appearance-none bg-transparent",
    disabled && "pointer-events-none opacity-40"
  );

  return (
    <div
      className={cn(
        bare
          ? undefined
          : compact
            ? dashboardUi.opsSideInnerCard
            : cn(dashboardUi.innerCard, "bg-background"),
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <div className={cn("flex items-center gap-2", compact ? "mb-2" : "mb-3")}>
        {icon}
        <p
          className={cn(
            titleClassName ??
              (compact ? "text-sm font-medium" : dashboardTypography.sectionTitle),
            "text-foreground"
          )}
        >
          {title}
        </p>
      </div>

      {showBoundFields ? (
        <SliderBoundFields
          low={baselineMode ? baseline : low}
          high={baselineMode ? deviation : high}
          lowMin={baselineMode ? min + step : min}
          lowMax={baselineMode ? max - step : high}
          highMin={baselineMode ? step : low}
          highMax={baselineMode ? maxDeviation : max}
          step={step}
          unit={unit}
          lowCaption={resolvedLowLabel}
          highCaption={resolvedHighLabel}
          lowAria={`${title} ${resolvedLowLabel}`}
          highAria={`${title} ${resolvedHighLabel}`}
          highPrefix={baselineMode ? "±" : undefined}
          disabled={disabled}
          size={inputSize}
          domainText={`${min}–${max}${unit}`}
          domainClassName={axisClassName}
          onLowCommit={baselineMode ? setBaseline : setLow}
          onHighCommit={baselineMode ? setDeviation : setHigh}
        />
      ) : null}

      {hideTrack ? null : (
      <div
        className={cn(
          sliderTrackShellClass(compact, "dual", false, showThumbLabels),
          mobileDrag && "max-md:pt-11",
          trackShellClassName
        )}
      >
        <div className={sliderTrackRailClass()} ref={railRef}>
          {showThumbLabels ? (
            <>
          <SliderThumbLabel
            leftPct={lowPct}
            leftPx={labelPos?.lowPx}
            labelRef={lowLabelRef}
            compact={compact}
            className={thumbLabelClassName}
            visible={!mobileDrag || dragThumb !== "high"}
            magnified={mobileDrag && dragThumb === "low"}
          >
            {lowText}
          </SliderThumbLabel>
          <SliderThumbLabel
            leftPct={highPct}
            leftPx={labelPos?.highPx}
            labelRef={highLabelRef}
            compact={compact}
            className={thumbLabelClassName}
            visible={!mobileDrag || dragThumb !== "low"}
            magnified={mobileDrag && dragThumb === "high"}
          >
            {highText}
          </SliderThumbLabel>
            </>
          ) : null}
          <div className={sliderTrackRailBgClass()} aria-hidden />
          <div
            className={cn(
              "pointer-events-none absolute top-0 h-full rounded-full",
              accentClass
            )}
            aria-hidden
            style={{
              left: `${lowPct}%`,
              width: `${Math.max(0, highPct - lowPct)}%`,
            }}
          />
          <input
            id={`${id}-low`}
            type="range"
            min={min}
            max={max}
            step={step}
            value={low}
            disabled={disabled}
            aria-label={`${title} ${baselineMode ? "구간 하한" : resolvedLowLabel}`}
            aria-valuetext={lowText}
            className={cn(rangeClass, "z-[3]")}
            onPointerDown={onLowPointerDown}
            onChange={(e) => setLow(Number(e.target.value))}
          />
          <input
            id={`${id}-high`}
            type="range"
            min={min}
            max={max}
            step={step}
            value={high}
            disabled={disabled}
            aria-label={`${title} ${baselineMode ? "구간 상한" : resolvedHighLabel}`}
            aria-valuetext={highText}
            className={cn(rangeClass, "z-[4]")}
            onPointerDown={onHighPointerDown}
            onChange={(e) => setHigh(Number(e.target.value))}
          />
        </div>
      </div>
      )}

      {resolvedAxisMode === "domain" ? (
        <div
          className={cn(
            "relative mt-1 flex items-end justify-between gap-2 px-3 sm:px-4 tabular-nums",
            axisClassName ??
              (compact
                ? "text-xs leading-snug text-muted-foreground"
                : dashboardTypography.meta)
          )}
        >
          <span aria-hidden>
            {min}
            {unit}
          </span>
          <span aria-hidden>
            {max}
            {unit}
          </span>
        </div>
      ) : null}
    </div>
  );
}
