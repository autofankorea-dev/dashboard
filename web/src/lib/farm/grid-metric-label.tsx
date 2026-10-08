import { Droplets, Thermometer } from "lucide-react";
import { CHANNEL_SLOT_LABELS } from "@/lib/data/iot-channel";
import { cn } from "@/lib/utils";

const METRIC_ARIA: Record<string, string> = {
  T: "온도",
  H: "습도",
  A: CHANNEL_SLOT_LABELS.A,
  B: CHANNEL_SLOT_LABELS.B,
  C: CHANNEL_SLOT_LABELS.C,
};

export function gridMetricAriaLabel(id: string, fallback?: string): string {
  return METRIC_ARIA[id] ?? fallback ?? id;
}

type Props = {
  id: string;
  label: string;
  mode?: "text" | "icon";
  className?: string;
  iconClassName?: string;
};

/** 그리드 히트맵·지표 탭 — 온도/습도/팬 행 라벨 */
export function GridMetricLabel({
  id,
  label,
  mode = "text",
  className,
  iconClassName = "size-3.5",
}: Props) {
  if (mode === "text") {
    return <span className={className}>{label}</span>;
  }

  if (id === "T") {
    return (
      <Thermometer
        className={cn(iconClassName, "text-channel-temp", className)}
        aria-hidden
      />
    );
  }
  if (id === "H") {
    return (
      <Droplets
        className={cn(iconClassName, "text-channel-info", className)}
        aria-hidden
      />
    );
  }
  if (id === "A" || id === "B" || id === "C") {
    return (
      <span
        className={cn(
          "inline-flex h-3.5 min-w-3.5 shrink-0 items-center justify-center rounded-full border border-channel-info/40 bg-channel-info/10 px-0.5 font-bold leading-none text-channel-info",
          "text-[7px] sm:h-4 sm:min-w-4 sm:text-[8px]",
          iconClassName,
          className,
        )}
        aria-hidden
      >
        {CHANNEL_SLOT_LABELS[id]}
      </span>
    );
  }

  return <span className={className}>{label}</span>;
}
