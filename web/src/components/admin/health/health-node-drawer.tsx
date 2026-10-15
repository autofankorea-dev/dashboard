"use client";

import {
  Clock,
  Cpu,
  Database,
  FileCode,
  Radio,
  Warehouse,
  Ban,
} from "lucide-react";
import type { ComponentType } from "react";
import { HealthCommandFailurePanel } from "@/components/admin/health/health-command-failure-panel";
import { HealthInsertRateChart } from "@/components/admin/health/health-insert-rate-chart";
import { formatHealthAgeMin } from "@/lib/admin/health/format-health-time";
import {
  compactDrawerPoints,
  healthNodeTechRows,
  type HealthNodeTechKind,
} from "@/lib/admin/health/health-node-inspector-meta";
import type {
  ControllerHealthRow,
  HealthPoint,
  HealthSnapshot,
  HealthStatus,
} from "@/lib/admin/health/types";
import { HEALTH_STATUS_LABEL } from "@/lib/admin/health/types";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { dashboardReadout, dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  nodeId: string;
  snapshot: HealthSnapshot;
};

const TECH_ICON: Record<
  HealthNodeTechKind,
  ComponentType<{ className?: string }>
> = {
  proc: FileCode,
  db: Database,
  probe: Radio,
  off: Ban,
  src: Warehouse,
};

function statusDotClass(status: HealthStatus): string {
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

function PointRows({ points }: { points: HealthPoint[] }) {
  const rows = compactDrawerPoints(points);
  if (rows.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {rows.map((p) => (
        <li
          key={p.id}
          className="flex items-center gap-2"
          title={p.title}
        >
          <span
            className={cn("size-1.5 shrink-0 rounded-full", statusDotClass(p.status))}
            aria-label={HEALTH_STATUS_LABEL[p.status]}
          />
          <span className={cn(dashboardTypography.meta, "min-w-0 flex-1 truncate")}>
            {p.label}
          </span>
          <span className={cn(dashboardReadout.value, "shrink-0")}>{p.value}</span>
        </li>
      ))}
    </ul>
  );
}

function TechRows({ nodeId, liveRowLimit }: { nodeId: string; liveRowLimit?: number }) {
  const t = useSheetCopy();
  const rows = healthNodeTechRows(nodeId, liveRowLimit);
  if (rows.length === 0) return null;
  return (
    <details className="group">
      <summary
        className={cn(
          dashboardTypography.meta,
          "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
        )}
      >
        {t("health.techCount", { count: rows.length })}
      </summary>
      <ul className="mt-1 space-y-0.5">
        {rows.map((row) => {
          const Icon = TECH_ICON[row.kind];
          return (
            <li key={`${row.label}-${row.value}`} className="flex items-center gap-2">
              <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className={cn(dashboardTypography.meta, "shrink-0")}>{row.label}</span>
              <span className={cn(dashboardReadout.value, "min-w-0 truncate")}>
                {row.value}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function ControllerRows({ rows }: { rows: ControllerHealthRow[] }) {
  if (rows.length === 0) return null;
  return (
    <ul className="space-y-1">
      {rows.map((row) => {
        const ago = formatHealthAgeMin(row.ageMin);
        return (
          <li key={row.id} className="flex items-center gap-1.5">
            <span
              className={cn("size-1.5 shrink-0 rounded-full", statusDotClass(row.status))}
              aria-label={HEALTH_STATUS_LABEL[row.status]}
            />
            <span className={cn(dashboardTypography.meta, "min-w-0 flex-1 truncate")}>
              {row.farmLabel}
            </span>
            <span className="inline-flex min-w-0 max-w-[40%] items-center gap-0.5 truncate text-muted-foreground">
              <Cpu className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{row.controllerKey}</span>
            </span>
            {ago ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-muted-foreground">
                <Clock className="size-3" aria-hidden />
                {ago}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function DrawerOverview({
  nodeId,
  snapshot,
}: {
  nodeId: string;
  snapshot: HealthSnapshot;
}) {
  if (nodeId === "collector-rs") {
    return (
      <HealthInsertRateChart
        buckets={snapshot.insertBuckets}
        hideTitle
        compact
        height={64}
      />
    );
  }
  if (nodeId === "field-controller") {
    return <ControllerRows rows={snapshot.controllers.slice(0, 8)} />;
  }
  if (nodeId === "collector-c") {
    return (
      <HealthCommandFailurePanel
        failures={snapshot.commandFailures}
        checkpointCount={snapshot.commandCheckpointCount}
        compact
      />
    );
  }
  return null;
}

export function HealthNodeDrawer({ nodeId, snapshot }: Props) {
  const points =
    snapshot.pointsByNode[nodeId as keyof typeof snapshot.pointsByNode] ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden pb-2">
      <PointRows points={points} />
      <DrawerOverview nodeId={nodeId} snapshot={snapshot} />
      <TechRows nodeId={nodeId} liveRowLimit={snapshot.liveRowLimit} />
    </div>
  );
}
