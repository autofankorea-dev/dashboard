"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { HEALTH_REVALIDATE_SEC } from "@/lib/admin/health/constants";
import { formatHealthTime } from "@/lib/admin/health/format-health-time";
import {
  dashboardControl,
  dashboardTypography,
  opsControl,
} from "@/lib/ui/dashboard-page-ui";
import { useProfileSheetPrefs } from "@/components/account/profile-sheet-prefs";
import { cn } from "@/lib/utils";

type HealthRefreshBarProps = {
  fetchedAt: string;
  className?: string;
  /** 운영 스캔 바 — 갱신 버튼만 (타이머는 title). */
  compact?: boolean;
  /** 스냅샷 부분 패치 — 없으면 no-op */
  onRefresh?: () => void | Promise<void>;
};

const STATIC_REFRESH_LABEL = "스캔·사용자·명령 스냅샷 갱신";

const emptySubscribe = () => () => {};

export function HealthRefreshBar({
  fetchedAt,
  className,
  compact = false,
  onRefresh,
}: HealthRefreshBarProps) {
  const [secondsLeft, setSecondsLeft] = useState(HEALTH_REVALIDATE_SEC);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  /** SSR·hydration과 맞추기 — 시계/카운트다운은 마운트 후에만 DOM·ARIA에 노출 */
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const locale = useProfileSheetPrefs().locale;
  const refreshLabel = locale === "en" ? "Refresh scan, users, and commands" : STATIC_REFRESH_LABEL;
  const refreshWord = locale === "en" ? "Refresh" : "갱신";
  const refreshing = locale === "en" ? "Refreshing…" : "갱신 중…";
  const refreshNow = locale === "en" ? "Refresh now" : "지금 갱신";

  const refresh = useCallback(() => {
    if (!onRefresh || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    void Promise.resolve(onRefresh())
      .catch(() => {
        /* 호출측 처리 */
      })
      .finally(() => {
        pendingRef.current = false;
        setPending(false);
        setSecondsLeft(HEALTH_REVALIDATE_SEC);
      });
  }, [onRefresh]);

  useEffect(() => {
    if (!onRefresh || !mounted) return;
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      setSecondsLeft((s) => {
        if (s <= 1) {
          // pendingRef 가드가 있는 refresh()로 — 주기 갱신 중첩 방지
          queueMicrotask(() => refresh());
          return HEALTH_REVALIDATE_SEC;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [onRefresh, refresh, mounted]);

  const detailTitle = (() => {
    if (!mounted) return refreshLabel;
    const fetchedLabel = formatHealthTime(fetchedAt);
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const countdown = `${mins}:${secs.toString().padStart(2, "0")}`;
    return locale === "en"
      ? `${refreshLabel} · updated ${fetchedLabel} · in ${countdown}`
      : `${STATIC_REFRESH_LABEL} · 갱신 ${fetchedLabel} · ${countdown} 후`;
  })();

  if (compact) {
    return (
      <button
        type="button"
        onClick={refresh}
        disabled={pending || !onRefresh}
        title={detailTitle}
        aria-label={refreshLabel}
        className={cn(opsControl.buttonOutline, "border", className)}
      >
        {pending ? refreshing : refreshWord}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3",
        className,
      )}
    >
      <p className={cn(dashboardTypography.meta, "min-w-0")}>{detailTitle}</p>
      <Button
        type="button"
        variant="outline"
        disabled={pending || !onRefresh}
        className={cn(
          "h-9 min-h-9 w-full text-sm sm:h-auto sm:min-h-0 sm:w-auto",
          dashboardControl.buttonOutline,
        )}
        onClick={refresh}
        aria-label={refreshLabel}
      >
        {pending ? refreshing : refreshNow}
      </Button>
    </div>
  );
}
