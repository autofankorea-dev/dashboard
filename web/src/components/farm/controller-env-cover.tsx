"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AlarmSettings } from "@/lib/domain/alarms";
import type { BarnReading } from "@/lib/data/iot";
import {
  formatControllerHeaderStallType,
  formatControllerHeaderStallUnit,
  formatControllerNoLabel,
} from "@/lib/farm/controller-summary-display";
import {
  controllerEnvCoverInkClass,
  controllerEnvCoverStatus,
  controllerEnvCoverReceivedLabel,
  controllerEnvCoverReason,
  type ControllerEnvCoverLevel,
} from "@/lib/farm/controller-env-cover";
import { ChevronRight } from "lucide-react";
import {
  dashboardAffordance,
  dashboardChroma,
  dashboardTypography,
} from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";
import { useApplyQueueOptional } from "@/components/farm/apply-queue-context";
import { CoverChannelApplyStrip } from "@/components/farm/cover-channel-apply-strip";
import {
  applyQueueChannelStripAria,
  applyQueueChannelStripForReading,
} from "@/lib/farm/apply-queue";

const COVER_FILL: Record<ControllerEnvCoverLevel, string> = {
  ok: "bg-[var(--status-ok)]",
  warn: "bg-[var(--status-warn)]",
  danger: "bg-[var(--status-danger)]",
  offline: "bg-[var(--status-offline)]",
};

type Props = {
  reading: BarnReading;
  level: ControllerEnvCoverLevel;
  alarmSettings?: AlarmSettings;
  /** 상세를 닫고 다시 덮일 때만 enterFade. 첫 격자 등장은 카드 stagger. */
  animateEnter?: boolean;
  /** true면 걷힘 FLIP을 위해 즉시 연다 (exitFade 없음). */
  morphReveal?: boolean;
  onOpen: () => void;
};

function prefersCoverReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function coverExitDurationMs(): number {
  if (typeof window === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--motion-duration-exit")
    .trim();
  const ms = Number.parseFloat(raw);
  return Number.isFinite(ms) ? ms : 0;
}

/** 닫힌 덮개 — 이름, 온도, 판정 한 줄. 게이지·채널은 연 뒤에만. */
export function ControllerEnvCover({
  reading,
  level,
  alarmSettings,
  animateEnter = false,
  morphReveal = false,
  onOpen,
}: Props) {
  const [exiting, setExiting] = useState(false);
  const typeLabel = formatControllerHeaderStallType(reading);
  const stallLabel = formatControllerHeaderStallUnit(reading);
  const ctrlNo = formatControllerNoLabel(reading.eqpmnNo);
  const ctrlLabel = `컨트롤러 ${ctrlNo}`;
  const status = controllerEnvCoverStatus(reading, alarmSettings);
  const displayLevel = status.stale ? reading.status === "offline" ? "offline" : "warn" : level;
  const statusLabel = `${status.environment}, ${status.communication}`;
  const receivedLabel = controllerEnvCoverReceivedLabel(reading.receivedAt);
  const reason = controllerEnvCoverReason(reading, alarmSettings);
  const onFill = displayLevel !== "offline";
  const reasonAria = [reason.valueLabel, reason.bandLabel]
    .filter(Boolean)
    .join(" ");
  const applyQueue = useApplyQueueOptional();
  const applyStrip = useMemo(
    () =>
      applyQueueChannelStripForReading(applyQueue?.rows ?? [], {
        key: reading.key,
        farmKey: reading.farmKey,
        moduleUid: reading.moduleUid,
        controllerKey: reading.controllerKey,
      }),
    [
      applyQueue?.rows,
      reading.key,
      reading.farmKey,
      reading.moduleUid,
      reading.controllerKey,
    ],
  );
  const applyAria = applyQueueChannelStripAria(applyStrip);

  const finishOpen = useCallback(() => {
    onOpen();
  }, [onOpen]);

  useEffect(() => {
    if (!exiting) return;
    const id = window.setTimeout(finishOpen, coverExitDurationMs());
    return () => window.clearTimeout(id);
  }, [exiting, finishOpen]);

  const requestOpen = useCallback(() => {
    if (exiting) return;
    if (morphReveal || prefersCoverReducedMotion() || coverExitDurationMs() === 0) {
      finishOpen();
      return;
    }
    setExiting(true);
  }, [exiting, finishOpen, morphReveal]);

  return (
    <button
      type="button"
      data-farm-env-cover="on"
      data-cover-status-level={displayLevel}
      aria-label={`${typeLabel} ${stallLabel} ${ctrlLabel}, ${statusLabel}${status.stale ? `, ${receivedLabel}` : ""}${reasonAria ? `, ${status.stale ? "마지막 측정 " : ""}${reasonAria}` : ""}${applyAria ? `, 적용 ${applyAria}` : ""}. 상세 보기`}
      onClick={(e) => {
        e.stopPropagation();
        requestOpen();
      }}
      data-cover-layout="row"
      className={cn(
        "relative z-10 flex min-h-11 w-full min-w-0 items-center gap-2 px-2.5 py-1.5 text-left sm:px-3",
        dashboardAffordance.hitSurface,
        COVER_FILL[displayLevel],
        dashboardChroma.statusFilmGlassRim,
        controllerEnvCoverInkClass(displayLevel),
        exiting && "pointer-events-none",
        exiting ? motionClass.exitFade : animateEnter ? motionClass.enterFade : null,
      )}
    >
      <span className="flex min-w-0 flex-1 items-baseline gap-1 overflow-hidden">
        <span
          data-cover-morph="identity"
          className={cn(
            "shrink-0 break-keep",
            dashboardTypography.envCoverIdentity,
            onFill && "text-current",
          )}
        >
          {typeLabel}
        </span>
        <span
          data-cover-morph="marks"
          className={cn(
            "shrink-0 break-keep",
            dashboardTypography.envCoverMeta,
            onFill && "text-current",
          )}
        >
          {stallLabel} · {ctrlNo}
        </span>
        {status.stale ? (
          <span
            className={cn(
              "min-w-0 truncate",
              dashboardTypography.envCoverMeta,
              onFill && "text-current",
            )}
          >
            {receivedLabel}
          </span>
        ) : null}
      </span>
      <span
        data-cover-morph="value"
        className={cn(
          "shrink-0",
          dashboardTypography.envCoverValue,
          onFill && "text-current",
        )}
      >
        {reason.valueLabel ?? "—"}
      </span>
      <span
        className={cn(
          "flex shrink-0 items-center gap-1.5 text-right opacity-80",
          onFill && "text-current",
        )}
      >
        <span
          className={cn(
            "flex flex-col items-end break-keep",
            dashboardTypography.envCoverStatus,
          )}
        >
          <span data-cover-environment-status="">{status.environment}</span>
          <span data-cover-communication-status="">{status.communication}</span>
        </span>
      </span>
      {applyStrip.length > 0 ? (
        <CoverChannelApplyStrip items={applyStrip} layout="inline" />
      ) : null}
      <ChevronRight
        className={cn(dashboardAffordance.hitHint, onFill && "text-current")}
        aria-hidden
      />
    </button>
  );
}
