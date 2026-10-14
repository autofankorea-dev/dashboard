"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AlarmSettings } from "@/lib/domain/alarms";
import type { BarnReading } from "@/lib/data/iot";
import {
  formatControllerHeaderStallUnit,
  formatControllerNoLabel,
} from "@/lib/farm/controller-summary-display";
import {
  controllerEnvCoverFillClass,
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
import { useProfileSheetPrefs, useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { formatStallTypeLabelLocalized } from "@/lib/domain/stall-type";
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

/** 닫힌 덮개. 축사유형·번호는 열린 패널 헤더와 같은 크기·왼쪽. 온도는 축사유형 크기. 경보·판정 문구는 두지 않는다. */
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
  const t = useSheetCopy();
  const locale = useProfileSheetPrefs().locale;
  const typeLabel = formatStallTypeLabelLocalized(reading.stallTyCode, locale);
  const stallLabel = formatControllerHeaderStallUnit(reading);
  const ctrlNo = formatControllerNoLabel(reading.eqpmnNo);
  const ctrlLabel = `${t("list.controller")} ${ctrlNo}`;
  const status = controllerEnvCoverStatus(reading, alarmSettings);
  const displayLevel = status.stale ? reading.status === "offline" ? "offline" : "warn" : level;
  const receivedLabel = controllerEnvCoverReceivedLabel(reading.receivedAt, locale);
  const reason = controllerEnvCoverReason(reading, alarmSettings);
  const onFill = displayLevel !== "offline";
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
      aria-label={`${typeLabel} ${stallLabel} ${ctrlLabel}${reason.valueLabel ? `, ${reason.valueLabel}` : ""}${status.stale ? `, ${receivedLabel}` : ""}${applyAria ? `, ${applyAria}` : ""}. ${t("cover.detail")}`}
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
        <span
          className={cn(
            "mt-1.5 size-2.5 shrink-0 rounded-sm",
            controllerEnvCoverFillClass(displayLevel),
          )}
          aria-hidden
        />
        <span className="flex min-w-0 flex-1 flex-nowrap items-start gap-2">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            {showAffiliation ? (
              <>
                <span
                  data-cover-morph="identity"
                  className={cn(
                    "break-keep text-current",
                    dashboardTypography.cardTitle,
                  )}
                >
                  {typeLabel}
                </span>
                <span
                  data-cover-morph="marks"
                  className="mt-0.5 flex min-w-0 items-center gap-2"
                >
                  <StallUnitNoMark
                    stallNo={reading.stallNo}
                    onFill={onFill}
                    fitText
                    className={cn(dashboardTypography.cardTitle, "text-current")}
                  />
                  <ControllerNoMark
                    eqpmnNo={reading.eqpmnNo}
                    onFill={onFill}
                    fitText
                    className={cn(dashboardTypography.cardTitle, "text-current")}
                  />
                </span>
              </>
            ) : (
              <span data-cover-morph="identity" className="min-w-0">
                <ControllerNoMark
                  eqpmnNo={reading.eqpmnNo}
                  onFill={onFill}
                  fitText
                  className={cn(dashboardTypography.cardTitle, "text-current")}
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
      <span className="flex min-h-0 flex-1 items-center gap-2">
        <span className="size-2.5 shrink-0" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          {status.stale ? (
            <span
              className={cn(
                dashboardTypography.envCoverMeta,
                "font-medium text-current",
              )}
            >
              {reason.valueLabel ? `${t("cover.lastReading")} · ` : ""}
              {receivedLabel}
            </span>
          ) : null}
          <span
            data-cover-morph="value"
            className={cn(dashboardTypography.envCoverValue, "text-current")}
          >
            {reason.valueLabel ?? "—"}
          </span>
          {applyStrip.length > 0 ? (
            <CoverChannelApplyStrip items={applyStrip} />
          ) : null}
        </span>
      </span>
      <ChevronRight
        className={cn(
          "absolute right-3 bottom-3 size-[length:var(--density-section)] md:size-[length:var(--density-section-md)]",
          onFill && "text-current",
        )}
        strokeWidth={1.75}
        aria-hidden
      />
    </button>
  );
}
