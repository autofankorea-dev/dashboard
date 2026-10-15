"use client";

import type { ModuleHealthRow } from "@/lib/admin/health/types";
import { useProfileSheetPrefs } from "@/components/account/profile-sheet-prefs";
import { HealthFarmModuleRow } from "@/components/admin/health/health-farm-module-row";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthFarmModuleTableProps = {
  modules: ModuleHealthRow[];
  stickyHeader?: boolean;
  maxHeight?: string;
  compact?: boolean;
  highlightFarmId?: string | null;
};

export function HealthFarmModuleTable({
  modules,
  stickyHeader = false,
  maxHeight,
  compact = false,
  highlightFarmId = null,
}: HealthFarmModuleTableProps) {
  const locale = useProfileSheetPrefs().locale;
  if (modules.length === 0) {
    return (
      <p
        className={cn(
          compact
            ? "py-4 text-center text-sm text-muted-foreground"
            : dashboardTypography.meta,
          !compact && "py-8 text-center",
        )}
      >
        {locale === "en" ? "No module data to show." : "표시할 모듈 데이터가 없습니다."}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border",
        compact ? "h-full min-h-0 overflow-y-auto" : maxHeight,
        !compact && stickyHeader && maxHeight ? "overflow-y-auto" : "",
      )}
    >
      <ul>
        {modules.map((row) => (
          <HealthFarmModuleRow
            key={row.id}
            row={row}
            highlightFarmId={highlightFarmId}
          />
        ))}
      </ul>
    </div>
  );
}
