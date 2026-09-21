import { Bell, Droplets, Thermometer } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type AlarmDomain = "temp" | "humidity";

/** 종 본체 · 도메인 아이콘은 우하단 ½. 겹치는 칸은 종을 그리지 않음. */
const METRIC_FRAC = "50%";
const BELL_CLIP: CSSProperties = {
  clipPath:
    "polygon(0 0, 100% 0, 100% calc(100% - 50% - 1px), calc(100% - 50% - 1px) calc(100% - 50% - 1px), calc(100% - 50% - 1px) 100%, 0 100%)",
};

export function AlarmDomainIcon({
  domain,
  className,
  sizeClass = "size-4",
  tone = "channel",
}: {
  domain: AlarmDomain;
  className?: string;
  sizeClass?: string;
  /** inherit = 부모 버튼 색. channel = 온도/습도 토큰 */
  tone?: "channel" | "inherit";
}) {
  const Metric = domain === "temp" ? Thermometer : Droplets;
  const inherit = tone === "inherit";
  const metricColor = inherit
    ? undefined
    : domain === "temp"
      ? "text-channel-temp"
      : "text-channel-hum";

  return (
    <span
      className={cn("relative inline-block shrink-0", sizeClass, className)}
      aria-hidden
    >
      <Bell
        className={cn("block size-full", inherit ? undefined : "text-foreground")}
        style={BELL_CLIP}
      />
      <Metric
        className={cn("absolute bottom-0 right-0", metricColor)}
        style={{ width: METRIC_FRAC, height: METRIC_FRAC }}
        strokeWidth={2.5}
      />
    </span>
  );
}
