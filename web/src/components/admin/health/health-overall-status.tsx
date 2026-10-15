"use client";

import type { HealthStatus } from "@/lib/admin/health/types";
import { HealthStatusBadge } from "@/components/admin/health/health-status-badge";
import { healthUiText } from "@/lib/admin/health/health-locale";
import { useProfileSheetPrefs } from "@/components/account/profile-sheet-prefs";
import { dashboardTypography, opsTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  overallStatus: HealthStatus;
  impactScope?: string | null;
  compact?: boolean;
  /** 모바일 정상 바 — 제목 없이 배지·용량만 */
  barOnly?: boolean;
  liveUsed?: number;
  liveTotal?: number;
  liveWarn?: boolean;
};

export function HealthOverallStatus({
  overallStatus,
  impactScope,
  compact = false,
  barOnly = false,
  liveUsed,
  liveTotal,
  liveWarn = false,
}: Props) {
  const locale = useProfileSheetPrefs().locale;
  const liveCap = healthUiText("liveCap", locale);
  if (barOnly) {
    return (
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        <HealthStatusBadge status={overallStatus} />
        {liveTotal != null && liveUsed != null ? (
          <span
            className={cn(
              "rounded-md border px-1.5 py-0.5 tabular-nums",
              opsTypography.meta,
              liveWarn
                ? "border-amber-300/50 bg-amber-50 text-amber-800"
                : "border-border bg-muted/40 text-muted-foreground",
            )}
            title={liveCap}
          >
            {liveUsed}/{liveTotal}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            className={cn(
              compact
                ? opsTypography.sectionTitle
                : dashboardTypography.sectionTitle,
            )}
          >
            {healthUiText("systemTitle", locale)}
          </h2>
          <HealthStatusBadge status={overallStatus} />
          {liveTotal != null && liveUsed != null ? (
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 tabular-nums",
                compact ? opsTypography.meta : "text-sm",
                liveWarn
                  ? "border-amber-300/50 bg-amber-50 text-amber-800"
                  : "border-border bg-muted/40 text-muted-foreground",
              )}
              title={liveCap}
            >
              {liveUsed}/{liveTotal}
            </span>
          ) : null}
        </div>
        {compact ? null : (
          <p className={cn(dashboardTypography.meta, "mt-1")}>
            {healthUiText("systemDesc", locale)}
          </p>
        )}
        {compact || !impactScope ? null : (
          <p
            className={cn(
              compact ? opsTypography.meta : dashboardTypography.body,
              compact ? "mt-0.5" : "mt-1",
            )}
          >
            {locale === "en" ? "Impact" : "영향"}: <strong>{impactScope}</strong>
          </p>
        )}
      </div>
    </div>
  );
}
