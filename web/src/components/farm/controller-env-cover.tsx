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
  ControllerNoMark,
  StallUnitNoMark,
} from "@/components/farm/controller-no-marks";
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
  /** 일반 보기 — 축사 이름을 카드에 둔다. 그룹 보기는 묶음 헤더가 이름을 가진다. */
  showAffiliation?: boolean;
  /** 걷힌 헤더의 차트·설정 버튼 자리. 명칭이 열릴 때와 같은 줄에 남는다. */
  headerActionSlots?: number;
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

/** 닫힌 덮개. 위는 이름과 한 단계 작은 번호, 가운데는 온도, 아래는 경보와 판정. 높이는 카드 본문. */
export function ControllerEnvCover({
  reading,
  level,
  alarmSettings,
  animateEnter = false,
  morphReveal = false,
  showAffiliation = false,
  headerActionSlots = 0,
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
      data-cover-layout="stack"
      className={cn(
        "absolute inset-0 z-10 flex flex-col justify-between gap-1 p-2.5 text-left sm:p-3",
        dashboardAffordance.hitSurface,
        COVER_FILL[displayLevel],
        dashboardChroma.statusFilmGlassRim,
        controllerEnvCoverInkClass(displayLevel),
        exiting && "pointer-events-none",
        exiting ? motionClass.exitFade : animateEnter ? motionClass.enterFade : null,
      )}
    >
      <span className="flex min-w-0 flex-nowrap items-start gap-2">
        <span className="mt-1.5 size-2.5 shrink-0" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-nowrap items-start gap-2">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            {showAffiliation ? (
              <>
                <span
                  data-cover-morph="identity"
                  className={cn(
                    "break-keep",
                    dashboardTypography.envCoverIdentity,
                    onFill && "text-current",
                  )}
                >
                  {typeLabel}
                </span>
                <span
                  data-cover-morph="marks"
                  className="mt-0.5 flex min-w-0 items-center gap-2 leading-none"
                >
                  <StallUnitNoMark
                    stallNo={reading.stallNo}
                    onFill={onFill}
                    fitText
                    className={cn(
                      dashboardTypography.envCoverMark,
                      "leading-none",
                      onFill && "text-current",
                    )}
                  />
                  <ControllerNoMark
                    eqpmnNo={reading.eqpmnNo}
                    onFill={onFill}
                    fitText
                    className={cn(
                      dashboardTypography.envCoverMark,
                      "leading-none",
                      onFill && "text-current",
                    )}
                  />
                </span>
              </>
            ) : (
              <span data-cover-morph="identity" className="min-w-0">
                <ControllerNoMark
                  eqpmnNo={reading.eqpmnNo}
                  onFill={onFill}
                  fitText
                  className={cn(
                    dashboardTypography.envCoverIdentity,
                    onFill && "text-current",
                  )}
                />
              </span>
            )}
          </span>
          {headerActionSlots > 0 ? (
            <span
              className="flex shrink-0 flex-nowrap items-center gap-1"
              aria-hidden
            >
              {Array.from({ length: headerActionSlots }, (_, i) => (
                <span key={i} className="size-7" />
              ))}
            </span>
          ) : null}
        </span>
      </span>
      <span className="flex min-h-0 flex-1 flex-col justify-center gap-1">
        <span
          data-cover-morph="value"
          className={cn(
            dashboardTypography.envCoverValue,
            onFill && "text-current",
          )}
        >
          {reason.valueLabel ?? "—"}
        </span>
        {applyStrip.length > 0 ? (
          <CoverChannelApplyStrip items={applyStrip} />
        ) : null}
      </span>
      <span
        data-cover-footer=""
        className={cn(
          "flex items-end justify-between gap-2",
          dashboardTypography.envCoverStatus,
          "leading-snug opacity-80",
          onFill && "text-current",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 break-keep">
          {status.stale ? (
            <span>
              {reason.valueLabel ? "마지막 측정 · " : ""}
              {receivedLabel}
            </span>
          ) : null}
          {reason.bandLabel ? (
            <span data-cover-morph="band">{reason.bandLabel}</span>
          ) : null}
          <span className="flex min-w-0 flex-wrap items-baseline">
            <span data-cover-environment-status="">{status.environment}</span>
            <span className="px-1" aria-hidden>
              ·
            </span>
            <span data-cover-communication-status="">
              {status.communication}
            </span>
          </span>
        </span>
        <ChevronRight
          className="size-[1em] shrink-0"
          strokeWidth={1.75}
          aria-hidden
        />
      </span>
    </button>
  );
}
