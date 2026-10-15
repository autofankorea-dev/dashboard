"use client";

import Link from "next/link";
import { useProfileSheetPrefs, useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { localizeFarmSpeciesLabel } from "@/lib/domain/farm-summaries";
import type { ControllerHealthRow } from "@/lib/admin/health/types";
import { adminOpsHealthHref } from "@/lib/admin/health/health-routes";
import { HealthControllerMobileList } from "@/components/admin/health/health-controller-mobile-list";
import { HealthStatusBadge } from "@/components/admin/health/health-status-badge";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthControllerTableProps = {
  controllers: ControllerHealthRow[];
  limit?: number;
};

function formatLastSeen(
  ageMin: number | null,
  t: ReturnType<typeof useSheetCopy>,
): string {
  if (ageMin === null) return "—";
  if (ageMin < 1) return t("health.underMinute");
  return t("health.minutesAgo", { count: Math.round(ageMin) });
}

export function HealthControllerTable({
  controllers,
  limit,
}: HealthControllerTableProps) {
  const t = useSheetCopy();
  const locale = useProfileSheetPrefs().locale;
  const rows = limit ? controllers.slice(0, limit) : controllers;
  const headers = [
    t("health.farm"),
    t("health.module"),
    t("settings.device"),
    t("cmd.status"),
    "last seen",
    "D11",
  ];

  if (rows.length === 0) {
    return (
      <p className={cn(dashboardTypography.meta, "py-8 text-center")}>
        {t("health.noControllers")}
      </p>
    );
  }

  return (
    <>
      <HealthControllerMobileList controllers={controllers} limit={limit} />
      <div className="hidden overflow-x-auto rounded-xl border lg:block">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b bg-muted/40 text-left">
            {headers.map((h) => (
              <th key={h} className={cn("px-4 py-3", dashboardTypography.tableHead)}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-b-0">
              <td className={cn("px-4 py-3", dashboardTypography.tableCell)}>
                <Link
                  href={adminOpsHealthHref({ farm: row.farmId, modules: true })}
                  className="hover:text-foreground hover:underline"
                >
                  {localizeFarmSpeciesLabel(row.farmLabel, locale)}
                </Link>
                <div className="text-muted-foreground">{row.farmId}</div>
              </td>
              <td className={cn("px-4 py-3", dashboardTypography.tableCell)}>
                {row.moduleLabel}
              </td>
              <td className={cn("px-4 py-3 font-mono text-xs", dashboardTypography.tableCell)}>
                {row.controllerKey}
              </td>
              <td className="px-4 py-3">
                <HealthStatusBadge status={row.status} />
              </td>
              <td className={cn("px-4 py-3 tabular-nums", dashboardTypography.tableCell)}>
                {formatLastSeen(row.ageMin, t)}
              </td>
              <td className={cn("px-4 py-3", dashboardTypography.tableCell)}>
                {row.d11Hint}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
