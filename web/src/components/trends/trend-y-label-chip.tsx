"use client";

import { TREND_Y_LABEL_CHIP_SAMPLE } from "@/lib/farm/trend-chart-format";
import { cn } from "@/lib/utils";

/** Y축·스케일 엣지 숫자 칩. 샘플 문자열로 최소 폭을 고정한다. */
export function TrendYLabelChip({
  text,
  className,
  mark,
}: {
  text: string;
  className?: string;
  mark?: "overline" | "underline";
}) {
  const sizer =
    text.length > TREND_Y_LABEL_CHIP_SAMPLE.length
      ? text
      : TREND_Y_LABEL_CHIP_SAMPLE;
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-sm bg-background/85 px-0.5 leading-none tabular-nums",
        "border-y border-transparent pt-px pb-px",
        mark === "overline" && "border-t-current",
        mark === "underline" && "border-b-current",
        className,
      )}
    >
      <span className="invisible whitespace-nowrap" aria-hidden>
        {sizer}
      </span>
      <span className="absolute inset-0 flex items-center justify-center whitespace-nowrap">
        {text}
      </span>
    </span>
  );
}
