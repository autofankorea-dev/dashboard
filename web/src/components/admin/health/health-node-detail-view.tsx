"use client";

import { HealthCommandEventGraph } from "@/components/admin/health/health-command-event-graph";
import { HealthCommandFailurePanel } from "@/components/admin/health/health-command-failure-panel";
import { HealthControllerTable } from "@/components/admin/health/health-controller-table";
import { HealthFarmModuleTable } from "@/components/admin/health/health-farm-module-table";
import { HealthInsertRateChart } from "@/components/admin/health/health-insert-rate-chart";
import { HealthNodeDrawer } from "@/components/admin/health/health-node-drawer";
import { HealthD11Panel, HealthPointTable } from "@/components/admin/health/health-point-table";
import { HealthSectionCard } from "@/components/admin/health/health-section-card";
import { HealthUsageBar } from "@/components/admin/health/health-usage-bar";
import { hintsFromPoints } from "@/lib/admin/health/d11-map";
import { adminOpsHealthHref } from "@/lib/admin/health/health-routes";
import type { HealthSnapshot } from "@/lib/admin/health/types";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthNodeDetailViewProps = {
  nodeId: string;
  snapshot: HealthSnapshot;
  variant?: "page" | "drawer";
};

type NodeDetailSectionsProps = {
  nodeId: string;
  snapshot: HealthSnapshot;
  points: NonNullable<HealthSnapshot["pointsByNode"][keyof HealthSnapshot["pointsByNode"]]>;
};

function NodeDetailPoints({ points }: { points: NodeDetailSectionsProps["points"] }) {
  const t = useSheetCopy();
  const displayPoints =
    points.length > 0
      ? points
      : [{ id: "—", label: t("health.point"), value: t("health.notBuilt"), status: "unknown" as const }];

  return <HealthPointTable points={displayPoints} />;
}

function NodeDetailOverview({
  nodeId,
  snapshot,
  compactTables = false,
}: NodeDetailSectionsProps & { compactTables?: boolean }) {
  const t = useSheetCopy();
  return (
    <>
      {nodeId === "collector-rs" ? (
        <HealthSectionCard>
          <HealthInsertRateChart buckets={snapshot.insertBuckets} />
        </HealthSectionCard>
      ) : null}
      {nodeId === "dashboard" ? (
        <HealthSectionCard title="v_iot_decoded_latest">
          <HealthUsageBar
            label="v_iot_decoded_latest"
            used={snapshot.liveRowCount}
            total={snapshot.liveRowLimit}
            tone={snapshot.liveRowCount >= snapshot.liveRowLimit * 0.9 ? "warn" : "default"}
          />
        </HealthSectionCard>
      ) : null}
      {nodeId === "field-module" ? (
        <HealthSectionCard title={t("health.moduleList")}>
          <HealthFarmModuleTable modules={snapshot.modules} compact={compactTables} />
        </HealthSectionCard>
      ) : null}
      {nodeId === "field-controller" ? (
        <HealthSectionCard title={t("health.controllerList")}>
          <HealthControllerTable controllers={snapshot.controllers} limit={50} />
        </HealthSectionCard>
      ) : null}
      {nodeId === "collector-c" ? (
        <>
          <HealthSectionCard>
            <HealthCommandEventGraph
              items={snapshot.commandTimeline}
              fetchedAt={snapshot.fetchedAt}
            />
          </HealthSectionCard>
          <HealthSectionCard title={t("health.commandFailures")}>
            <HealthCommandFailurePanel
              failures={snapshot.commandFailures}
              checkpointCount={snapshot.commandCheckpointCount}
            />
          </HealthSectionCard>
        </>
      ) : null}
      {nodeId === "collector-mqtt" ? (
        <div className="rounded-xl border border-channel-info/40 bg-channel-info/10 px-5 py-4">
          <p className={dashboardTypography.body}>
            {t("health.mqttIndirect")}
          </p>
        </div>
      ) : null}
      {nodeId === "collector-ekape" ? (
        <div className="rounded-xl border border-channel-info/40 bg-channel-info/10 px-5 py-4">
          <p className={dashboardTypography.body}>
            {t("health.ekapeOff")}
          </p>
        </div>
      ) : null}
      {nodeId === "collector-ftp" ? (
        <div className="rounded-xl border border-channel-info/40 bg-channel-info/10 px-5 py-4">
          <p className={dashboardTypography.body}>
            {t("health.ftpOff")}
          </p>
        </div>
      ) : null}
      {nodeId === "external" ? (
        <div className="rounded-xl border border-channel-info/40 bg-channel-info/10 px-5 py-4">
          <p className={dashboardTypography.body}>
            {t("health.externalOff")}
          </p>
        </div>
      ) : null}
    </>
  );
}

function NodeDetailTechList({ nodeId, snapshot }: NodeDetailSectionsProps) {
  const t = useSheetCopy();
  return (
    <ul className={cn("space-y-2", dashboardTypography.meta)}>
      {nodeId === "collector-rs" && (
        <>
          <li>Process: RS.py</li>
          <li>Table: iot_room_state_raw</li>
          <li>{t("health.rsIndirect")}</li>
        </>
      )}
      {nodeId === "storage" && (
        <>
          <li>View: v_iot_decoded_latest · raw: iot_room_state_raw (insert rate)</li>
          <li>Decode lag: max(raw.id) − iot_decode_cursor.last_raw_id</li>
          <li>Supabase (service role)</li>
        </>
      )}
      {nodeId === "collector-c" && (
        <>
          <li>Table: ctrl_thermo_command</li>
          <li>Checkpoint: health_command_checkpoint (admin)</li>
          <li>{t("health.cDownlink")}</li>
        </>
      )}
      {nodeId === "collector-mqtt" && (
        <>
          <li>Broker: Mosquitto</li>
          <li>{t("health.probeNone")}</li>
        </>
      )}
      {nodeId === "collector-ekape" && (
        <>
          <li>{t("health.statusOff")}</li>
          <li>{t("health.designRef")}</li>
        </>
      )}
      {nodeId === "collector-ftp" && (
        <>
          <li>{t("health.statusOff")}</li>
        </>
      )}
      {nodeId === "external" && (
        <>
          <li>{t("health.statusOff")}</li>
          <li>{t("health.designRef")}</li>
        </>
      )}
      {nodeId === "field-module" && (
        <>
          <li>Source: v_iot_decoded_latest (module rollup)</li>
          <li>{t("health.staleness")}</li>
        </>
      )}
      {nodeId === "field-controller" && (
        <>
          <li>Source: v_iot_decoded_latest (controller_key)</li>
          <li>{t("health.singleFault")}</li>
        </>
      )}
      {nodeId === "dashboard" && (
        <>
          <li>GLOBAL_LIVE_ROW_LIMIT: {snapshot.liveRowLimit}</li>
          <li>Decode: Dashboard TS layer</li>
        </>
      )}
      <li>docs/architecture-firmware-ec2-db.md</li>
    </ul>
  );
}

function NodeDetailTech({
  nodeId,
  snapshot,
  collapsible,
}: NodeDetailSectionsProps & { collapsible: boolean }) {
  const t = useSheetCopy();
  if (collapsible) {
    return (
      <HealthSectionCard title={t("health.techDetail")}>
        <details>
          <summary className={cn(dashboardTypography.sectionTitle, "cursor-pointer")}>
            {t("ui.expand")}
          </summary>
          <div className="mt-4">
            <NodeDetailTechList nodeId={nodeId} snapshot={snapshot} points={[]} />
          </div>
        </details>
      </HealthSectionCard>
    );
  }

  return (
    <HealthSectionCard title={t("health.techDetail")}>
      <NodeDetailTechList nodeId={nodeId} snapshot={snapshot} points={[]} />
    </HealthSectionCard>
  );
}

export function HealthNodeDetailView({
  nodeId,
  snapshot,
  variant = "page",
}: HealthNodeDetailViewProps) {
  const t = useSheetCopy();
  const points =
    snapshot.pointsByNode[nodeId as keyof typeof snapshot.pointsByNode] ?? [];
  const hints = hintsFromPoints(points);
  const sectionProps = { nodeId, snapshot, points };

  if (variant === "drawer") {
    return <HealthNodeDrawer nodeId={nodeId} snapshot={snapshot} />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-6">
        <p className={dashboardTypography.meta}>
          {adminOpsHealthHref({ node: nodeId })} · {t("health.layerDetail")}
        </p>
        <NodeDetailPoints points={points} />
        <NodeDetailOverview {...sectionProps} />
        <NodeDetailTech {...sectionProps} collapsible />
      </div>
      <HealthSectionCard title={t("health.d11Title")}>
        <HealthD11Panel hints={hints} />
      </HealthSectionCard>
    </div>
  );
}
