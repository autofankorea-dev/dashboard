"use client";

import type { MouseEvent } from "react";
import type {
  HealthSnapshot,
  HealthStatus,
  HealthNodeId,
} from "@/lib/admin/health/types";
import { healthNodeDisplay, healthStatusLabel } from "@/lib/admin/health/health-locale";
import { useProfileSheetPrefs } from "@/components/account/profile-sheet-prefs";
import {
  domRectToPeekAnchor,
  type HealthDagNodeSelectPayload,
} from "@/lib/admin/health/health-node-peek-content";
import { healthStatusBorderClass } from "@/components/admin/health/health-status-badge";
import { HealthPipelineIcon } from "@/lib/admin/health/health-pipeline-icons";
import { opsControl, opsTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  snapshot: HealthSnapshot;
  onNodeSelect?: (payload: HealthDagNodeSelectPayload) => void;
  activeDrillId?: string | null;
  /** true면 수집기 서브칩은 이상만 표시(전부 정상이면 숨김). */
  compactCollectors?: boolean;
};

function needsAttention(status: HealthStatus): boolean {
  return status === "warn" || status === "critical" || status === "unknown";
}

function statusDot(status: HealthStatus): string {
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

/** 데이터 경로 — A안: 모바일 균등 분배, PC 한 줄·확대. */
export function HealthDataPathStrip({
  snapshot,
  onNodeSelect,
  activeDrillId,
  compactCollectors = false,
}: Props) {
  const locale = useProfileSheetPrefs().locale;
  const select = (nodeId: HealthNodeId, e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onNodeSelect?.({
      drillId: nodeId,
      dagNodeId: nodeId,
      anchor: domRectToPeekAnchor(rect),
    });
  };

  const collectors = compactCollectors
    ? snapshot.collectorSub.filter((n) => needsAttention(n.status))
    : snapshot.collectorSub;

  return (
    <div className="flex flex-col gap-2">
      <div className={opsControl.pathStrip} role="list">
        {snapshot.pipeline.map((node, i) => {
          const active = activeDrillId === node.id;
          const shown = healthNodeDisplay(node.id, node.label, node.short || node.label, locale);
          const label = shown.short;
          const statusText = healthStatusLabel(node.status, locale);
          return (
            <div key={node.id} className={opsControl.pathStep} role="listitem">
              {i > 0 ? (
                <span className={opsControl.pathArrow} aria-hidden>
                  →
                </span>
              ) : null}
              <button
                type="button"
                onClick={(e) => select(node.id, e)}
                aria-pressed={active}
                aria-label={`${shown.label} · ${statusText}`}
                title={`${shown.label} · ${statusText}`}
                className={cn(
                  opsControl.chip,
                  healthStatusBorderClass(node.status),
                  active && "ring-2 ring-primary/40",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full md:size-2.5",
                    statusDot(node.status),
                  )}
                  aria-hidden
                />
                <HealthPipelineIcon
                  id={node.id}
                  className="size-3.5 shrink-0 text-foreground"
                />
                <span className="min-w-0 md:flex-1">
                  <span className={opsTypography.chipLabel}>{label}</span>
                  <span
                    className={cn(
                      opsTypography.chipMeta,
                      !active && "max-md:hidden",
                    )}
                  >
                    {statusText}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
      {collectors.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t pt-2">
          {collectors.map((node) => {
            const active = activeDrillId === node.id;
            return (
              <button
                key={node.id}
                type="button"
                onClick={(e) => select(node.id, e)}
                aria-pressed={active}
                className={cn(
                  opsControl.chipSub,
                  "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  healthStatusBorderClass(node.status),
                  active && "ring-2 ring-primary/40",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    statusDot(node.status),
                  )}
                  aria-hidden
                />
                <HealthPipelineIcon
                  id={node.id}
                  className="size-3 shrink-0"
                />
                {healthNodeDisplay(node.id, node.label, node.short || node.label, locale).short}
              </button>
            );
          })}
        </div>
      ) : compactCollectors && snapshot.collectorSub.length > 0 ? (
        <p className={cn("border-t pt-2", opsTypography.meta)}>
          {locale === "en" ? "All collectors normal" : "수집기 전부 정상"}
        </p>
      ) : null}
    </div>
  );
}
