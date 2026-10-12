import Link from "next/link";
import { Clock, Cpu } from "lucide-react";
import { HealthErrorActionLines } from "@/components/admin/health/health-error-action";
import type { ModuleHealthRow } from "@/lib/admin/health/types";
import { HEALTH_STATUS_LABEL } from "@/lib/admin/health/types";
import { adminOpsHealthHref } from "@/lib/admin/health/health-routes";
import { classifyHealthError } from "@/lib/admin/health/d11-map";
import { formatHealthAgeMin } from "@/lib/admin/health/format-health-time";
import { farmKeyUrlSlug } from "@/lib/domain/farm-key";
import { dashboardReadout, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  row: ModuleHealthRow;
  highlightFarmId?: string | null;
};

function statusDotClass(status: ModuleHealthRow["status"]): string {
  switch (status) {
    case "ok":
      return "bg-emerald-500";
    case "warn":
      return "bg-amber-500";
    case "critical":
      return "bg-red-500";
    case "not_implemented":
      return "bg-channel-info";
    default:
      return "bg-muted-foreground/40";
  }
}

export function HealthFarmModuleRow({ row, highlightFarmId = null }: Props) {
  const farmSlug = farmKeyUrlSlug(row.farmId);
  const highlighted =
    highlightFarmId != null &&
    (row.farmId === highlightFarmId || farmSlug === highlightFarmId);
  const ago = formatHealthAgeMin(row.ageMin);
  const action = classifyHealthError(row.d11Hint, row.scope);
  const statusLabel = HEALTH_STATUS_LABEL[row.status];

  return (
    <li
      data-health-farm-id={farmSlug}
      className={cn(
        "border-b px-3 py-2 last:border-b-0",
        highlighted && "bg-emerald-50/80 ring-1 ring-inset ring-emerald-400/60",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={cn("size-2.5 shrink-0 rounded-full", statusDotClass(row.status))}
          title={statusLabel}
          aria-label={statusLabel}
        />
        <Link
          href={adminOpsHealthHref({ farm: row.farmId, modules: true })}
          title={row.farmId}
          className={cn(dashboardUi.cardTitle, "min-w-0 truncate hover:underline")}
        >
          {row.farmLabel}
        </Link>
        <span className="text-muted-foreground">{row.moduleLabel}</span>
        <span className="inline-flex items-center gap-0.5" title="제어기">
          <Cpu className="size-3.5" aria-hidden />
          <span className={dashboardReadout.value}>{row.controllerCount}</span>
        </span>
        <span className="inline-flex items-center gap-1" title="수신율">
          <span className="h-1 w-10 overflow-hidden rounded-full bg-muted">
            <span
              className={cn(
                "block h-full rounded-full",
                (row.coveragePct ?? 0) < 80 ? "bg-status-danger" : "bg-emerald-500",
              )}
              style={{ width: `${Math.min(100, row.coveragePct ?? 0)}%` }}
            />
          </span>
          <span className={dashboardReadout.value}>
            {row.coveragePct != null ? `${row.coveragePct}%` : "—"}
          </span>
        </span>
        {ago ? (
          <span
            className="inline-flex items-center gap-0.5 text-muted-foreground"
            title={row.ageMin != null ? `${Math.round(row.ageMin)}분 전` : undefined}
          >
            <Clock className="size-3.5" aria-hidden />
            <span>{ago}</span>
          </span>
        ) : null}
      </div>
      {action ? (
        <HealthErrorActionLines error={action} className="mt-1.5" />
      ) : null}
    </li>
  );
}
