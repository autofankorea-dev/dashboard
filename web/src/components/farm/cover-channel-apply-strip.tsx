"use client";

import { Check } from "lucide-react";
import {
  APPLY_QUEUE_STAGE_COUNT,
  applyQueueFillRatio,
  type ApplyQueueChannelStripItem,
} from "@/lib/farm/apply-queue";
import { useApplyQueueStripPresence } from "@/components/farm/use-apply-queue-strip-presence";
import { motionClass } from "@/lib/ui/motion-classes";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

function CoverApplyDonut({ spinning }: { spinning: boolean }) {
  return (
    <span
      className={cn(
        "size-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent opacity-90 motion-reduce:animate-none",
        spinning && "animate-spin",
      )}
      aria-hidden
    />
  );
}

function CoverApplyCheck() {
  return (
    <Check
      className={cn("size-3.5 shrink-0", motionClass.enterFade)}
      strokeWidth={2.5}
      aria-hidden
    />
  );
}

function CoverApplyGauge({ filled }: { filled: number }) {
  const t = applyQueueFillRatio(filled);
  return (
    <span className="relative flex h-1.5 min-w-0">
      <span className="flex h-full w-full gap-0.5">
        {Array.from({ length: APPLY_QUEUE_STAGE_COUNT }, (_, index) => (
          <span
            key={index}
            className="min-w-0 flex-1 rounded-sm bg-current opacity-20"
          />
        ))}
      </span>
      <span
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-full origin-left rounded-sm bg-current opacity-90",
          "transition-transform duration-motion-moderate ease-[var(--motion-ease-standard)]",
          "motion-reduce:transition-none",
        )}
        style={{ transform: `scaleX(${t})` }}
      />
    </span>
  );
}

export function CoverChannelApplyStrip({
  items,
}: {
  items: ApplyQueueChannelStripItem[];
}) {
  const { visible, leaving } = useApplyQueueStripPresence(items);
  if (visible.length === 0) return null;

  return (
    <span className="mt-2 flex w-full flex-col gap-1.5" aria-hidden>
      {visible.map((item) => {
        const confirmed = item.stage === "확인";
        return (
          <span
            key={item.id}
            className={cn(
              "grid grid-cols-[2rem_minmax(0,1fr)_1.25rem] items-center gap-1.5",
              leaving.has(item.id) && motionClass.exitFade,
            )}
          >
            <span
              className={cn(
                "font-semibold leading-none",
                dashboardTypography.envCoverMeta,
                "text-current",
              )}
            >
              {item.slot ?? "공통"}
            </span>
            <CoverApplyGauge filled={item.filled} />
            <span className="flex justify-end text-current">
              {confirmed ? (
                <CoverApplyCheck />
              ) : (
                <CoverApplyDonut spinning={item.stage !== "실패"} />
              )}
            </span>
          </span>
        );
      })}
    </span>
  );
}
