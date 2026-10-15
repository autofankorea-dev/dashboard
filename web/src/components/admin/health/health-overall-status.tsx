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
  liveUsed?: number;
  liveTotal?: number;
  liveWarn?: boolean;
};

export function HealthOverallStatus({
  overallStatus,
  impactScope,
  compact = false,
  liveUsed,
  liveTotal,
  liveWarn = false,
}: Props) {
  const locale = useProfileSheetPrefs().locale;
  const liveCap = healthUiText("liveCap", locale);
  const liveShort = healthUiText("liveShort", locale);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2
        className={cn(
          "shrink-0",
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
            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5",
            compact ? opsTypography.meta : "text-sm",
            liveWarn
              ? "border-amber-300/50 bg-amber-50 text-amber-800"
              : "border-border bg-muted/40 text-muted-foreground",
          )}
          title={liveCap}
        >
          <span className="font-medium">{liveShort}</span>
          <span className="tabular-nums">
            {liveUsed}/{liveTotal}
          </span>
        </span>
      ) : null}
      {compact ? null : (
        <div className="min-w-0 basis-full">
          <p className={cn(dashboardTypography.meta, "mt-1")}>
            {healthUiText("systemDesc", locale)}
          </p>
          {impactScope ? (
            <p className={cn(dashboardTypography.body, "mt-1")}>
              {locale === "en" ? "Impact" : "영향"}: <strong>{impactScope}</strong>
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
