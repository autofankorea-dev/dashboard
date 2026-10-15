"use client";

import { useMemo, useState, type ComponentType } from "react";
import { AlertTriangle, Clock, List, WifiOff } from "lucide-react";
import type { ModuleHealthRow } from "@/lib/admin/health/types";
import { HealthFarmModuleTable } from "@/components/admin/health/health-farm-module-table";
import { SEVERITY_ORDER } from "@/lib/admin/health/health-ui-labels";
import { useProfileSheetPrefs } from "@/components/account/profile-sheet-prefs";
import { localizeFarmSpeciesLabel } from "@/lib/domain/farm-summaries";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "issues" | "critical" | "warn";

const FILTER_OPTIONS: {
  id: StatusFilter;
  ko: string;
  en: string;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "all", ko: "전체", en: "All", Icon: List },
  { id: "issues", ko: "이상만", en: "Issues", Icon: AlertTriangle },
  { id: "critical", ko: "장애", en: "Fault", Icon: WifiOff },
  { id: "warn", ko: "주의", en: "Caution", Icon: Clock },
];

type Props = {
  modules: ModuleHealthRow[];
  scrollable?: boolean;
  embedded?: boolean;
  highlightFarmId?: string | null;
};

export function HealthFarmModulePanel({
  modules,
  scrollable = false,
  embedded = false,
  highlightFarmId = null,
}: Props) {
  const locale = useProfileSheetPrefs().locale;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("issues");
  const [search, setSearch] = useState("");

  const filterCounts = useMemo(() => {
    const issues = modules.filter(
      (r) => r.status === "critical" || r.status === "warn",
    ).length;
    return {
      all: modules.length,
      issues,
      critical: modules.filter((r) => r.status === "critical").length,
      warn: modules.filter((r) => r.status === "warn").length,
    };
  }, [modules]);

  const filtered = useMemo(() => {
    let rows = [...modules];
    if (statusFilter === "issues") {
      rows = rows.filter((r) => r.status === "critical" || r.status === "warn");
    } else if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          localizeFarmSpeciesLabel(r.farmLabel, locale).toLowerCase().includes(q) ||
          r.farmId.toLowerCase().includes(q) ||
          r.moduleLabel.toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      const sd = SEVERITY_ORDER[a.status] - SEVERITY_ORDER[b.status];
      if (sd !== 0) return sd;
      return (b.ageMin ?? 0) - (a.ageMin ?? 0);
    });
    return rows;
  }, [modules, statusFilter, search, locale]);

  return (
    <div className={cn("flex min-h-0 flex-col", embedded ? "h-full gap-2" : "space-y-3 md:space-y-4")}>
      <div className={cn("flex flex-col gap-3", embedded ? "shrink-0 sm:flex-row sm:flex-wrap sm:items-center" : "sm:flex-row sm:flex-wrap sm:items-center")}>
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((opt) => {
            const { Icon } = opt;
            const label = locale === "en" ? opt.en : opt.ko;
            const pressed = statusFilter === opt.id;
            const count = filterCounts[opt.id];
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-1",
                  dashboardTypography.badge,
                  pressed
                    ? "bg-muted ring-1 ring-foreground/20"
                    : "hover:bg-muted/60",
                )}
                title={label}
                aria-label={`${label} ${count}`}
                aria-pressed={pressed}
              >
                <Icon className="size-3.5" aria-hidden />
                <span className="tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={locale === "en" ? "Search farms and modules" : "농장·모듈 검색"}
          className={cn(
            "min-w-0 w-full flex-1 rounded-lg border bg-background px-3 py-2 sm:min-w-[12rem]",
            dashboardTypography.meta
          )}
          aria-label={locale === "en" ? "Search farms and modules" : "농장·모듈 검색"}
        />
        <p className={cn(dashboardTypography.meta, "tabular-nums")}>
          {filtered.length} / {modules.length}{locale === "en" ? "" : "건"}
        </p>
      </div>
      <div className={embedded ? "min-h-0 flex-1 overflow-hidden" : undefined}>
        <HealthFarmModuleTable
          modules={filtered}
          highlightFarmId={highlightFarmId}
          stickyHeader={scrollable || embedded}
          maxHeight={scrollable && !embedded ? "max-h-[min(60vh,640px)]" : undefined}
          compact={embedded}
        />
      </div>
    </div>
  );
}
