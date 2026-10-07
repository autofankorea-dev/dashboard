"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { dashboardAffordance } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { snapToStep } from "@/lib/controllers/controller-panel-map";
import {
  PRESET_STEPPER_HOLD_DELAY_MS,
  PRESET_STEPPER_HOLD_INTERVAL_MS,
} from "@/lib/farm/command-presets";
import { cn } from "@/lib/utils";

export const STEPPER_HOLD_DELAY_MS = PRESET_STEPPER_HOLD_DELAY_MS;
export const STEPPER_HOLD_INTERVAL_MS = PRESET_STEPPER_HOLD_INTERVAL_MS;

type Props = {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  decimals: number;
  disabled?: boolean;
  onChange: (next: number) => void;
  large?: boolean;
};

function clampStepped(
  raw: number,
  step: number,
  min: number,
  max: number,
): number {
  const snapped = snapToStep(raw, step, min);
  return Math.min(max, Math.max(min, snapped));
}

function formatStepped(n: number, decimals: number): string {
  return n.toFixed(decimals);
}

function useHoldRepeat(onStep: () => void, enabled: boolean) {
  const onStepRef = useRef(onStep);
  const enabledRef = useRef(enabled);
  const timers = useRef<{ delay?: number; interval?: number }>({});

  const stop = useCallback(() => {
    if (timers.current.delay != null) window.clearTimeout(timers.current.delay);
    if (timers.current.interval != null) {
      window.clearInterval(timers.current.interval);
    }
    timers.current = {};
  }, []);

  useEffect(() => {
    onStepRef.current = onStep;
  }, [onStep]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) stop();
  }, [enabled, stop]);

  const tick = useCallback(() => {
    if (!enabledRef.current) {
      stop();
      return;
    }
    onStepRef.current();
  }, [stop]);

  const start = useCallback(() => {
    if (!enabledRef.current) return;
    stop();
    tick();
    timers.current.delay = window.setTimeout(() => {
      timers.current.interval = window.setInterval(
        tick,
        STEPPER_HOLD_INTERVAL_MS,
      );
    }, STEPPER_HOLD_DELAY_MS);
  }, [stop, tick]);

  useEffect(() => stop, [stop]);

  return { start, stop };
}

function HoldStepButton({
  label,
  disabled,
  onStep,
  children,
  large = false,
  order,
}: {
  label: string;
  disabled: boolean;
  onStep: () => void;
  children: string;
  large?: boolean;
  order?: number;
}) {
  const { start, stop } = useHoldRepeat(onStep, !disabled);

  return (
    <button
      type="button"
      data-stepper=""
      aria-label={label}
      disabled={disabled}
      style={order ? {order} : undefined}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-medium leading-none outline-none",
        motionClass.microHover,
        dashboardAffordance.tool,
        "touch-manipulation select-none",
        large && "size-11 text-xl",
      )}
      onPointerDown={(e) => {
        if (e.button !== 0 || disabled) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key !== " " && e.key !== "Enter") return;
        e.preventDefault();
        if (e.repeat) return;
        start();
      }}
      onKeyUp={stop}
      onBlur={stop}
    >
      {children}
    </button>
  );
}

export function SettingsStepperField({
  label,
  value,
  step,
  min,
  max,
  decimals,
  disabled = false,
  onChange,
  large = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(() => formatStepped(value, decimals));
  const valueRef = useRef(value);
  const atMin = value <= min + 1e-9;
  const atMax = value >= max - 1e-9;

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const commit = (raw: string) => {
    if (!raw.trim()) return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const next = clampStepped(n, step, min, max);
    valueRef.current = next;
    onChange(next);
  };

  const nudge = (dir: 1 | -1) => {
    const next = clampStepped(valueRef.current + dir * step, step, min, max);
    valueRef.current = next;
    onChange(next);
  };

  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className={large ? "sr-only" : "text-[11px] leading-none text-muted-foreground"}>
        {label}
      </span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          inputMode={decimals > 0 ? "decimal" : "numeric"}
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          aria-label={label}
          value={editing ? text : formatStepped(value, decimals)}
          onFocus={() => {
            setText(formatStepped(value, decimals));
            setEditing(true);
          }}
          onBlur={() => {
            commit(text);
            setEditing(false);
          }}
          onChange={(e) => { setText(e.target.value); if (large && e.target.value.trim()) commit(e.target.value); }}
          className="h-7 w-14 shrink-0 rounded-md border border-border bg-card px-1 text-center text-[11px] tabular-nums outline-none [appearance:textfield] disabled:opacity-60 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          style={large ? { height: 44, width: "100%", flex: 1, fontSize: 20, order: 2 } : undefined}
        />
        <HoldStepButton
          large={large}
          order={large ? 1 : undefined}
          label={`${label} 내리기`}
          disabled={disabled || atMin}
          onStep={() => nudge(-1)}
        >
          −
        </HoldStepButton>
        <HoldStepButton
          large={large}
          order={large ? 3 : undefined}
          label={`${label} 올리기`}
          disabled={disabled || atMax}
          onStep={() => nudge(1)}
        >
          +
        </HoldStepButton>
      </span>
    </label>
  );
}
