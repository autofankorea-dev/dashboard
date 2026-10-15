"use client";

import type { D11Hint, HealthPoint } from "@/lib/admin/health/types";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { HealthStatusBadge } from "@/components/admin/health/health-status-badge";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthPointTableProps = {
  points: HealthPoint[];
};

export function HealthPointTable({ points }: HealthPointTableProps) {
  const t = useSheetCopy();
  const headers = [t("health.point"), t("chart.value"), t("cmd.status")];
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full border-collapse">
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
          {points.map((p) => (
            <tr key={p.id} className="border-b last:border-b-0">
              <td className={cn("px-4 py-3", dashboardTypography.tableCell)}>{p.label}</td>
              <td className={cn("px-4 py-3 font-mono", dashboardTypography.tableCell)}>
                {p.value}
              </td>
              <td className="px-4 py-3">
                <HealthStatusBadge status={p.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type HealthD11PanelProps = {
  hints: D11Hint[];
};

export function HealthD11Panel({ hints }: HealthD11PanelProps) {
  const t = useSheetCopy();
  if (hints.length === 0) {
    return (
      <p className={dashboardTypography.meta}>{t("health.d11None")}</p>
    );
  }

  return (
    <div className="space-y-4">
      {hints.map((h) => (
        <div key={h.id} className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-muted px-2 py-0.5 text-xl font-semibold">
              {h.id}
            </span>
            <span className={dashboardTypography.sectionTitle}>{h.title}</span>
          </div>
          <p className={dashboardTypography.meta}>{h.summary}</p>
        </div>
      ))}
      <p className={dashboardTypography.meta}>
        {t("health.d11Docs")}
      </p>
    </div>
  );
}
