"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { HealthSnapshot } from "@/lib/admin/health/types";
import {
  buildHealthDag,
  buildHealthDagNodeWidths,
  buildHealthDagRankColumns,
  buildHealthDagRankOverrides,
  DAG_S4_LAYOUT,
  DAG_ZONE_COUNT,
  DAG_ZONE_LABELS,
  MQTT_BROKER_MOD_CAPACITY,
} from "@/lib/admin/health/build-health-dag";
import { HealthPipelineIcon } from "@/lib/admin/health/health-pipeline-icons";
import { computeDAGLayout } from "@/lib/admin/health/dag-layout";
import { layoutBottomY, routeDagEdge } from "@/lib/admin/health/dag-edge-routes";
import {
  domRectToPeekAnchor,
  type HealthDagNodeSelectPayload,
} from "@/lib/admin/health/health-node-peek-content";
import {
  DAG_ZONE_LABELS_EN,
  healthNodeDisplay,
  healthStatusLabel,
} from "@/lib/admin/health/health-locale";
import { useProfileSheetPrefs } from "@/components/account/profile-sheet-prefs";
import { HealthDagMobileList } from "@/components/admin/health/health-dag-mobile-list";
import { healthStatusBorderClass } from "@/components/admin/health/health-status-badge";
import { dashboardControl } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

/** foreignObject 테두리 여유 (2×) */
const NODE_CHROME = 8;

type Props = {
  snapshot: HealthSnapshot;
  onNodeSelect?: (payload: HealthDagNodeSelectPayload) => void;
  /** peek pin · ring highlight */
  activeDrillId?: string | null;
};

function statusDotClass(status: HealthSnapshot["modules"][0]["status"]): string {
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

function mqttModUsed(metric?: string): number {
  if (!metric) return 0;
  const used = Number.parseInt(metric.split("/")[0] ?? "0", 10);
  return Number.isFinite(used) ? used : 0;
}

export function HealthDagGraph({ snapshot, onNodeSelect, activeDrillId }: Props) {
  const locale = useProfileSheetPrefs().locale;
  const [mounted, setMounted] = useState(false);
  const [fieldExpanded, setFieldExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(w);
    });
    ro.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [mounted]);

  const graph = useMemo(
    () => buildHealthDag(snapshot, { fieldExpanded }),
    [snapshot, fieldExpanded]
  );

  const metaById = useMemo(
    () => Object.fromEntries(graph.nodes.map((n) => [n.id, n])),
    [graph.nodes]
  );

  const laneByEdge = useMemo(
    () =>
      Object.fromEntries(
        graph.edges.map((e) => [`${e.from}->${e.to}`, e.lane])
      ),
    [graph.edges]
  );

  const spreadWidth =
    containerWidth > 0 ? containerWidth - NODE_CHROME * 2 : undefined;
  const farmZoneWidth =
    spreadWidth != null
      ? (spreadWidth - DAG_S4_LAYOUT.padding * 2) / DAG_ZONE_COUNT
      : undefined;

  const nodeWidthById = useMemo(
    () =>
      buildHealthDagNodeWidths(graph, {
        fieldExpanded,
        farmZoneWidth,
      }),
    [graph, fieldExpanded, farmZoneWidth]
  );

  const rankColumns = useMemo(
    () => buildHealthDagRankColumns(graph, fieldExpanded),
    [graph, fieldExpanded]
  );

  const layout = useMemo(() => {
    const rankOverrides = buildHealthDagRankOverrides(graph, fieldExpanded);
    return computeDAGLayout({
      nodes: graph.nodes.map((n) => ({ id: n.id })),
      edges: graph.edges.map((e) => ({ from: e.from, to: e.to })),
      direction: "horizontal",
      nodeWidth: DAG_S4_LAYOUT.nodeWidth,
      nodeHeight: DAG_S4_LAYOUT.nodeHeight,
      rankGap: DAG_S4_LAYOUT.rankGap,
      nodeGap: DAG_S4_LAYOUT.nodeGap,
      padding: DAG_S4_LAYOUT.padding,
      rankOverrides,
      nodeWidthById,
      spreadWidth,
      spreadZones: DAG_ZONE_COUNT,
      rankColumns,
    });
  }, [graph, fieldExpanded, nodeWidthById, rankColumns, spreadWidth]);

  if (!mounted) {
    return (
      <div
        className="h-[min(280px,40vh)] animate-pulse rounded-xl border bg-muted/20"
        aria-busy="true"
      />
    );
  }

  const layoutBottom = layoutBottomY(layout.nodes);
  const zoneLabelH = 18;
  const channelPad = Math.max(0, layoutBottom + 20 - layout.height) + zoneLabelH;
  const svgH = layout.height + NODE_CHROME * 2 + channelPad;
  const svgW = layout.width + NODE_CHROME * 2;
  const sortedRanks = [...layout.ranks].sort((a, b) => a.rank - b.rank);
  const zoneInnerW = layout.width - DAG_S4_LAYOUT.padding * 2;
  const zoneW = zoneInnerW / DAG_ZONE_COUNT;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setFieldExpanded((v) => !v)}
          className={cn(
            dashboardControl.buttonOutline,
            "h-8 min-h-8 w-full rounded-lg px-2.5 text-xs sm:w-auto sm:text-sm"
          )}
        >
          {fieldExpanded
            ? locale === "en" ? "Collapse farms" : "농장 접기"
            : locale === "en" ? "Expand farms" : "농장 펼치기"}
        </button>
      </div>

      <div className="lg:hidden">
        <HealthDagMobileList
          snapshot={snapshot}
          fieldExpanded={fieldExpanded}
          onToggleField={() => setFieldExpanded(true)}
          onNodeSelect={onNodeSelect}
          activeDrillId={activeDrillId}
        />
      </div>

      <div
        ref={containerRef}
        className="hidden w-full overflow-x-auto overscroll-x-contain rounded-xl border bg-muted/10 p-2 [-webkit-overflow-scrolling:touch] lg:block md:p-3"
      >
        <div className="mx-auto" style={{ width: svgW, minWidth: "100%" }}>
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="block overflow-visible"
          style={{ minHeight: svgH, height: svgH }}
          role="img"
          aria-label="시스템 데이터 경로 DAG"
        >
          {sortedRanks.map((rank, zoneIndex) => (
            <g key={rank.rank}>
              <rect
                x={DAG_S4_LAYOUT.padding + zoneIndex * zoneW - 12 + NODE_CHROME}
                y={rank.y - 8 + NODE_CHROME}
                width={zoneW + 24}
                height={rank.height + 16}
                rx={12}
                className="fill-muted/30"
              />
              <text
                x={
                  DAG_S4_LAYOUT.padding +
                  zoneIndex * zoneW +
                  zoneW / 2 +
                  NODE_CHROME
                }
                y={layoutBottom + 16 + NODE_CHROME}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={10}
              >
                {(locale === "en" ? DAG_ZONE_LABELS_EN[zoneIndex] : DAG_ZONE_LABELS[zoneIndex]) ?? ""}
              </text>
            </g>
          ))}

          <g transform={`translate(${NODE_CHROME}, ${NODE_CHROME})`}>
            {layout.edges.map((e) => {
              const lane = laneByEdge[`${e.from}->${e.to}`] ?? "uplink";
              const fromNode = layout.nodes.find((n) => n.id === e.from);
              const toNode = layout.nodes.find((n) => n.id === e.to);
              if (!fromNode || !toNode) return null;

              const routed = routeDagEdge(fromNode, toNode, {
                lane,
                isBackEdge: e.isBackEdge,
                layoutBottom: layoutBottomY(layout.nodes),
              });

              const fromMeta = metaById[e.from];
              const toMeta = metaById[e.to];
              const edgeCritical =
                fromMeta?.status === "critical" || toMeta?.status === "critical";
              const animateFlow =
                lane === "uplink" ||
                (lane === "downlink" && !edgeCritical && !e.isBackEdge);

              return (
                <path
                  key={`${e.from}-${e.to}`}
                  d={routed.pathD}
                  fill="none"
                  strokeLinecap="butt"
                  strokeLinejoin="round"
                  className={cn(
                    lane === "downlink"
                      ? "stroke-channel-info"
                      : "stroke-muted-foreground",
                    lane === "side" ? "opacity-45" : "opacity-90",
                    animateFlow && "health-dag-edge-flow",
                    edgeCritical && lane === "downlink" && "opacity-50"
                  )}
                  strokeWidth={lane === "downlink" ? 3 : 3.5}
                  strokeDasharray={
                    lane === "downlink" || e.isBackEdge ? "8 6" : "10 8"
                  }
                  pointerEvents="none"
                />
              );
            })}
          </g>

          {layout.nodes.map((pos) => {
            const meta = metaById[pos.id];
            if (!meta) return null;

            const nodeW = pos.width;
            const nodeH = pos.height;

            const isActive = activeDrillId === meta.drillId;

            const box = (
              <div
                className={cn(
                  "box-border flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-lg border-2 bg-card px-1 py-1 transition-colors hover:bg-muted/40",
                  healthStatusBorderClass(meta.status),
                  !meta.inUplink && "border-dashed",
                  meta.togglesField && "bg-emerald-500/5",
                  isActive && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
              >
                <span className="relative inline-flex">
                  <HealthPipelineIcon
                    id={meta.id}
                    className="size-5 text-foreground"
                  />
                  <span
                    className={cn(
                      "absolute -right-0.5 -top-0.5 size-1.5 rounded-full",
                      statusDotClass(meta.status)
                    )}
                    aria-hidden
                  />
                </span>
                <span className="line-clamp-1 text-center text-[11px] font-semibold leading-tight">
                  {healthNodeDisplay(meta.id, meta.label, meta.short, locale).short}
                </span>
                <span className="line-clamp-1 text-center text-[10px] leading-tight text-muted-foreground tabular-nums">
                  {meta.metric ?? healthStatusLabel(meta.status, locale)}
                </span>
                {meta.id === "mqtt" ? (
                  <div className="mt-0.5 h-1 w-[80%] overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-channel-info"
                      style={{
                        width: `${Math.min(
                          100,
                          (mqttModUsed(meta.metric) / MQTT_BROKER_MOD_CAPACITY) * 100
                        )}%`,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            );

            const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
              if (meta.togglesField) {
                setFieldExpanded(true);
                return;
              }
              const rect = e.currentTarget.getBoundingClientRect();
              onNodeSelect?.({
                drillId: meta.drillId,
                dagNodeId: meta.id,
                anchor: domRectToPeekAnchor(rect),
              });
            };

            return (
              <foreignObject
                key={pos.id}
                x={pos.x + NODE_CHROME}
                y={pos.y + NODE_CHROME}
                width={nodeW}
                height={nodeH}
                overflow="visible"
              >
                <button
                  type="button"
                  onClick={handleClick}
                  className="box-border h-full w-full overflow-hidden rounded-xl bg-card p-1"
                  title={
                    meta.metric
                      ? `${healthNodeDisplay(meta.id, meta.label, meta.short, locale).label} · ${meta.metric}`
                      : healthNodeDisplay(meta.id, meta.label, meta.short, locale).label
                  }
                  aria-label={
                    meta.togglesField
                      ? `${healthNodeDisplay(meta.id, meta.label, meta.short, locale).label} ${locale === "en" ? "expand" : "펼치기"}`
                      : `${healthNodeDisplay(meta.id, meta.label, meta.short, locale).label} ${locale === "en" ? "detail" : "상세"}`
                  }
                >
                  {box}
                </button>
              </foreignObject>
            );
          })}
        </svg>
        </div>
      </div>
    </div>
  );
}
