"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  TREND_PERIODS,
  nextTrendPeriod,
  type TrendPeriodId,
} from "@/lib/domain/farm-trend-types";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

/** @deprecated import from `@/lib/domain/farm-trend-types` */
export { TREND_PERIOD_ORDER } from "@/lib/domain/farm-trend-types";

type Props = {
  value: TrendPeriodId;
  onChange: (period: TrendPeriodId) => void;
  className?: string;
  ariaLabel?: string;
  /** farm-map 투어 — period-select 타깃 */
  tourTarget?: boolean;
  /** map toolbar vs list panel — padding·typography */
  density?: "map" | "list";
};

/** 24시간 → 7일 → 30일 → 24시간 단일 순환 토글 */
export function TrendPeriodToggle({
  value,
  onChange,
  className,
  ariaLabel = "기간",
  tourTarget = false,
  density = "list",
}: Props) {
  const isMap = density === "map";
  const [pendingPeriod, setPendingPeriod] = useState<TrendPeriodId | null>(
    null,
  );

  if (pendingPeriod != null && value === pendingPeriod) {
    setPendingPeriod(null);
  }

  useEffect(() => {
    if (!pendingPeriod) return;
    const t = window.setTimeout(() => setPendingPeriod(null), 2500);
    return () => window.clearTimeout(t);
  }, [pendingPeriod]);

  const displayPeriod = pendingPeriod ?? value;
  const busy = pendingPeriod != null;
  const label = TREND_PERIODS[displayPeriod].label;
  const nextLabel = TREND_PERIODS[nextTrendPeriod(displayPeriod)].label;

  return (
    <div
      className={cn(
        "inline-flex rounded-md border bg-background",
        isMap ? "overflow-hidden text-xs" : "shrink-0",
        className,
      )}
      role="group"
      aria-label={ariaLabel}
      aria-busy={busy || undefined}
      {...(tourTarget ? { "data-tour-id": "period-select" } : {})}
    >
      <button
        type="button"
        aria-busy={busy || undefined}
        aria-label={`${ariaLabel} ${label} · 클릭 시 ${nextLabel}`}
        title={`${label} → ${nextLabel}`}
        disabled={busy}
        onClick={() => {
          if (busy) return;
          const next = nextTrendPeriod(value);
          setPendingPeriod(next);
          onChange(next);
        }}
        className={cn(
          "inline-flex items-center justify-center gap-1 font-medium",
          motionClass.microInteractive,
          isMap
            ? "px-2.5 py-1"
            : "shrink-0 px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm",
          "bg-channel-info/10 text-channel-info",
          busy && "cursor-wait",
        )}
      >
        {busy ? (
          <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
        ) : null}
        {busy ? `${label}…` : label}
      </button>
    </div>
  );
}
