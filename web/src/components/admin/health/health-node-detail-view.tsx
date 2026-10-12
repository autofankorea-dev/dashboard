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
  const displayPoints =
    points.length > 0
      ? points
      : [{ id: "—", label: "포인트", value: "P0 미구현", status: "unknown" as const }];

  return <HealthPointTable points={displayPoints} />;
}

function NodeDetailOverview({
  nodeId,
  snapshot,
  compactTables = false,
}: NodeDetailSectionsProps & { compactTables?: boolean }) {
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
        <HealthSectionCard title="모듈 목록 (전역)">
          <HealthFarmModuleTable modules={snapshot.modules} compact={compactTables} />
        </HealthSectionCard>
      ) : null}
      {nodeId === "field-controller" ? (
        <HealthSectionCard title="장비 목록 (전역)">
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
          <HealthSectionCard title="C 실패 이력 · 체크포인트">
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
            Mosquitto active probe 없음 — RS raw 수신으로 간접 추론 (spec §3a).
          </p>
        </div>
      ) : null}
      {nodeId === "collector-ekape" ? (
        <div className="rounded-xl border border-channel-info/40 bg-channel-info/10 px-5 py-4">
          <p className={dashboardTypography.body}>
            Ekape export 비활성화 — snapshot·View·config 테이블 제거됨 (migration
            20260619000000).
          </p>
        </div>
      ) : null}
      {nodeId === "collector-ftp" ? (
        <div className="rounded-xl border border-channel-info/40 bg-channel-info/10 px-5 py-4">
          <p className={dashboardTypography.body}>
            FTP Worker 비활성화 (Ekape 미구현). 수집 서버 rollup에서 제외됩니다.
          </p>
        </div>
      ) : null}
      {nodeId === "external" ? (
        <div className="rounded-xl border border-channel-info/40 bg-channel-info/10 px-5 py-4">
          <p className={dashboardTypography.body}>
            외부 연계(축평원) 비활성화 — 재개 시 D10·migration 이력 참고.
          </p>
        </div>
      ) : null}
    </>
  );
}

function NodeDetailTechList({ nodeId, snapshot }: NodeDetailSectionsProps) {
  return (
    <ul className={cn("space-y-2", dashboardTypography.meta)}>
      {nodeId === "collector-rs" && (
        <>
          <li>Process: RS.py</li>
          <li>Table: iot_room_state_raw</li>
          <li>Mosquitto: RS 간접 추론 — active probe 없음</li>
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
          <li>COL rollup: uplink only — C는 별도 downlink 노드</li>
        </>
      )}
      {nodeId === "collector-mqtt" && (
        <>
          <li>Broker: Mosquitto</li>
          <li>Probe: 없음 — RS raw 간접 추론</li>
        </>
      )}
      {nodeId === "collector-ekape" && (
        <>
          <li>상태: 비활성화 (Ekape 미구현)</li>
          <li>연계 설계 문서는 이 저장소에 없음</li>
        </>
      )}
      {nodeId === "collector-ftp" && (
        <>
          <li>상태: 비활성화 (Ekape 미구현)</li>
        </>
      )}
      {nodeId === "external" && (
        <>
          <li>상태: 비활성화 (Ekape 미구현)</li>
          <li>연계 설계 문서는 이 저장소에 없음</li>
        </>
      )}
      {nodeId === "field-module" && (
        <>
          <li>Source: v_iot_decoded_latest (module rollup)</li>
          <li>Staleness: 동일 컨트롤러 10분 초과 warn · 30분 초과 critical (목표 주기 5분)</li>
        </>
      )}
      {nodeId === "field-controller" && (
        <>
          <li>Source: v_iot_decoded_latest (controller_key)</li>
          <li>단일 장비 이상 → S5</li>
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
  if (collapsible) {
    return (
      <HealthSectionCard title="기술 상세 (admin 2층)">
        <details>
          <summary className={cn(dashboardTypography.sectionTitle, "cursor-pointer")}>
            펼치기
          </summary>
          <div className="mt-4">
            <NodeDetailTechList nodeId={nodeId} snapshot={snapshot} points={[]} />
          </div>
        </details>
      </HealthSectionCard>
    );
  }

  return (
    <HealthSectionCard title="기술 상세 (admin 2층)">
      <NodeDetailTechList nodeId={nodeId} snapshot={snapshot} points={[]} />
    </HealthSectionCard>
  );
}

export function HealthNodeDetailView({
  nodeId,
  snapshot,
  variant = "page",
}: HealthNodeDetailViewProps) {
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
          {adminOpsHealthHref({ node: nodeId })} · 2층 상세
        </p>
        <NodeDetailPoints points={points} />
        <NodeDetailOverview {...sectionProps} />
        <NodeDetailTech {...sectionProps} collapsible />
      </div>
      <HealthSectionCard title="D11 추천">
        <HealthD11Panel hints={hints} />
      </HealthSectionCard>
    </div>
  );
}
