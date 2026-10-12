"use client";

import type { RefObject } from "react";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

/**
 * 십자선 값 칩. 위치·텍스트는 useTrendCrosshair가 ref로 직접 쓴다.
 * trend-chart.tsx JSX를 동작 변경 없이 1:1 이동.
 */
export function TrendChartCrosshairChip({
  chipRef,
  timeRef,
  tempRef,
  humRef,
  motorRef,
  otherRef,
}: {
  chipRef: RefObject<HTMLDivElement | null>;
  timeRef: RefObject<HTMLSpanElement | null>;
  tempRef: RefObject<HTMLSpanElement | null>;
  humRef: RefObject<HTMLSpanElement | null>;
  motorRef: RefObject<HTMLSpanElement | null>;
  otherRef: RefObject<HTMLSpanElement | null>;
}) {
  return (
    <div
      ref={chipRef}
      className={cn(
        "pointer-events-none absolute z-[5] whitespace-nowrap rounded-sm border border-border/70 bg-background/90 px-1.5 py-0.5 farm-chart-fs-axis tabular-nums",
        motionClass.farmChartCrosshair,
      )}
      style={{
        opacity: 0,
        left: 0,
        top: 0,
        transform: "translate(calc(-100% - 8px), -50%)",
      }}
      aria-hidden
    >
      <span className="inline-flex items-center gap-1.5">
        <span ref={timeRef} className="text-foreground" />
        <span ref={tempRef} className="text-channel-temp" />
        <span ref={humRef} className="text-channel-hum" />
        <span ref={motorRef} className="text-channel-motor" />
        <span ref={otherRef} className="text-foreground" />
      </span>
    </div>
  );
}
