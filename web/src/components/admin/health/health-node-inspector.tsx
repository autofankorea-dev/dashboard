"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { BarnPanelBottomSheet } from "@/components/farm/barn-panel-bottom-sheet";
import { HealthErrorActionLines } from "@/components/admin/health/health-error-action";
import { HealthNodeDetailView } from "@/components/admin/health/health-node-detail-view";
import { HealthPipelineIcon } from "@/lib/admin/health/health-pipeline-icons";
import {
  healthNodeActionPath,
  healthNodeShort,
  healthNodeStatus,
} from "@/lib/admin/health/health-node-inspector-meta";
import { healthNodeDisplay, healthStatusLabel } from "@/lib/admin/health/health-locale";
import { healthNodeTitle } from "@/lib/admin/health/health-ui-labels";
import type { HealthNodeId, HealthSnapshot, HealthStatus } from "@/lib/admin/health/types";
import { useProfileSheetPrefs, useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

type Props = {
  nodeId: HealthNodeId | null;
  snapshot: HealthSnapshot;
  placement: "side" | "page" | "sheet";
  onClose: () => void;
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

function InspectorBody({
  nodeId,
  snapshot,
}: {
  nodeId: HealthNodeId;
  snapshot: HealthSnapshot;
}) {
  const action = healthNodeActionPath(nodeId, snapshot);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {action ? (
        <HealthErrorActionLines
          error={action}
          className="shrink-0 border-b px-3 py-1.5"
        />
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-2">
        <HealthNodeDetailView
          key={nodeId}
          nodeId={nodeId}
          snapshot={snapshot}
          variant="drawer"
        />
      </div>
    </div>
  );
}

function InspectorHeader({
  nodeId,
  snapshot,
  onClose,
}: {
  nodeId: HealthNodeId;
  snapshot: HealthSnapshot;
  onClose: () => void;
}) {
  const t = useSheetCopy();
  const locale = useProfileSheetPrefs().locale;
  const status = healthNodeStatus(nodeId, snapshot);
  const display = healthNodeDisplay(
    nodeId,
    healthNodeTitle(nodeId),
    healthNodeShort(nodeId),
    locale,
  );
  return (
    <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
      <span className="relative inline-flex">
        <HealthPipelineIcon id={nodeId} className="size-4" />
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 size-1.5 rounded-full",
            statusDotClass(status),
          )}
          aria-hidden
        />
      </span>
      <p
        className={cn(dashboardTypography.cardTitle, "min-w-0 flex-1 truncate leading-tight")}
        title={`${display.label} · ${nodeId}`}
      >
        {display.short}
        <span className={cn(dashboardTypography.meta, "ml-1.5 font-normal")}>
          {healthStatusLabel(status, locale)}
        </span>
      </p>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        aria-label={t("settings.close")}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function HealthNodeInspector({
  nodeId,
  snapshot,
  placement,
  onClose,
}: Props) {
  const t = useSheetCopy();
  const locale = useProfileSheetPrefs().locale;
  useEffect(() => {
    if (!nodeId || placement === "sheet") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [nodeId, placement, onClose]);

  if (placement === "sheet") {
    return (
      <BarnPanelBottomSheet
        open={nodeId != null}
        onClose={onClose}
        title={
          nodeId ? (
            <span className="inline-flex items-center gap-2">
              <HealthPipelineIcon id={nodeId} className="size-4" />
              {healthNodeDisplay(nodeId, healthNodeTitle(nodeId), healthNodeShort(nodeId), locale).short}
            </span>
          ) : (
            t("health.node")
          )
        }
        contentClassName="min-h-0"
        auditRegion="ops-node-inspector"
      >
        {nodeId ? (
          <InspectorBody nodeId={nodeId} snapshot={snapshot} />
        ) : null}
      </BarnPanelBottomSheet>
    );
  }

  if (!nodeId) return null;

  const page = placement === "page";

  return (
    <aside
      role="dialog"
      aria-label={t("ui.detailNamed", {
        name: healthNodeDisplay(nodeId, healthNodeTitle(nodeId), healthNodeShort(nodeId), locale).label,
      })}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden bg-card",
        "animate-in slide-in-from-right-4 fade-in-0",
        motionClass.durationModerate,
        motionClass.easeEnter,
        page
          ? "h-full w-full rounded-none border-l"
          : "sticky top-3 h-[min(72vh,44rem)] w-[min(24rem,100%)] shrink-0 rounded-xl border",
      )}
    >
      <InspectorHeader
        nodeId={nodeId}
        snapshot={snapshot}
        onClose={onClose}
      />
      <InspectorBody nodeId={nodeId} snapshot={snapshot} />
    </aside>
  );
}
