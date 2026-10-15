"use client";

import { useMemo } from "react";
import type { HealthSnapshot } from "@/lib/admin/health/types";
import {
  buildHealthDag,
  buildHealthDagRankOverrides,
  DAG_ZONE_LABELS,
  type HealthDagNode,
} from "@/lib/admin/health/build-health-dag";
import type { HealthDagNodeSelectPayload } from "@/lib/admin/health/health-node-peek-content";
import {
  healthStatusBorderClass,
  HealthStatusBadge,
} from "@/components/admin/health/health-status-badge";
import { HealthPipelineIcon } from "@/lib/admin/health/health-pipeline-icons";
import { useProfileSheetPrefs, useSheetCopy } from "@/components/account/profile-sheet-prefs";
import {
  DAG_ZONE_LABELS_EN,
  healthNodeDisplay,
} from "@/lib/admin/health/health-locale";
import { cn } from "@/lib/utils";

type Props = {
  snapshot: HealthSnapshot;
  fieldExpanded: boolean;
  onToggleField?: () => void;
  onNodeSelect?: (payload: HealthDagNodeSelectPayload) => void;
  activeDrillId?: string | null;
};

function statusDotClass(status: HealthDagNode["status"]): string {
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

export function HealthDagMobileList({
  snapshot,
  fieldExpanded,
  onToggleField,
  onNodeSelect,
  activeDrillId,
}: Props) {
  const locale = useProfileSheetPrefs().locale;
  const t = useSheetCopy();
  const graph = useMemo(
    () => buildHealthDag(snapshot, { fieldExpanded }),
    [snapshot, fieldExpanded]
  );

  const rankById = useMemo(
    () => buildHealthDagRankOverrides(graph, fieldExpanded),
    [graph, fieldExpanded]
  );

  const sections = useMemo(() => {
    const byRank = new Map<number, HealthDagNode[]>();
    for (const node of graph.nodes) {
      const rank = rankById[node.id] ?? 0;
      const list = byRank.get(rank) ?? [];
      list.push(node);
      byRank.set(rank, list);
    }
    return [...byRank.entries()]
      .sort(([a], [b]) => a - b)
      .map(([rank, nodes]) => ({
        rank,
        label:
          (locale === "en" ? DAG_ZONE_LABELS_EN[rank] : DAG_ZONE_LABELS[rank]) ??
          t("health.zone", { n: rank + 1 }),
        nodes: [...nodes].sort((a, b) => a.label.localeCompare(b.label, "ko")),
      }));
  }, [graph.nodes, locale, rankById, t]);

  return (
    <ul className="space-y-2">
      {sections.map((section) => (
        <li key={section.rank}>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {section.label}
          </p>
          <ul className="space-y-1">
            {section.nodes.map((node) => {
              const isActive = activeDrillId === node.drillId;
              const display = healthNodeDisplay(node.id, node.label, node.short, locale);
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (node.togglesField) {
                        onToggleField?.();
                        return;
                      }
                      onNodeSelect?.({
                        drillId: node.drillId,
                        dagNodeId: node.id,
                        anchor: { top: 0, left: 0, width: 0, height: 0 },
                      });
                    }}
                    className={cn(
                      "flex w-full min-h-9 max-h-10 items-center gap-2 rounded-lg border bg-card px-2 py-1 text-left text-xs transition-colors hover:bg-muted/30",
                      healthStatusBorderClass(node.status),
                      !node.inUplink && "border-dashed",
                      node.togglesField && "bg-emerald-500/5",
                      isActive && "border-primary bg-primary/5"
                    )}
                    aria-label={
                      node.togglesField
                        ? t("ui.expandNamed", { name: display.label })
                        : t("ui.detailNamed", { name: display.label })
                    }
                  >
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        statusDotClass(node.status)
                      )}
                      aria-hidden
                    />
                    <HealthPipelineIcon
                      id={node.id}
                      className="size-3.5 shrink-0 text-foreground"
                    />
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="truncate font-semibold">{display.short}</p>
                      {node.metric ? (
                        <p className="truncate text-[10px] text-muted-foreground tabular-nums">
                          {node.metric}
                        </p>
                      ) : null}
                    </div>
                    <HealthStatusBadge status={node.status} compact className="shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
