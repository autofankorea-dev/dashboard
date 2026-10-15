import "server-only";

import { UPLINK_ROUND_SEC } from "@/lib/admin/health/constants";
import {
  activeRowsForMetrics,
  classifyCommandFailure,
  listActiveCommandFailures,
  type CommandRowForHealth,
} from "@/lib/admin/health/command-failures";
import type {
  CommandFailureItem,
  CommandTimelineItem,
  HealthPoint,
  HealthStatus,
} from "@/lib/admin/health/types";
import { ageSecFromIso, worstStatus } from "@/lib/admin/health/staleness";
import { createAdminClient } from "@/lib/supabase/admin";

import { type FarmKey } from "@/lib/domain/farm-key";
import { farmShortLabel } from "@/lib/domain/farm-summaries";

export type CommandHealthSummary = {
  status: HealthStatus;
  points: HealthPoint[];
  activeFailures: CommandFailureItem[];
  checkpointCount: number;
  timeline: CommandTimelineItem[];
};

function farmFromRow(row: CommandRowForHealth): FarmKey {
  return { lsindRegistNo: row.lsind_regist_no, itemCode: row.item_code };
}

function targetLabel(row: CommandRowForHealth): string {
  const channelKey = row.channel_key?.trim();
  if (channelKey) {
    return `MOD-${row.module_uid} · ${channelKey}`;
  }
  const controllerKey = row.controller_key?.trim();
  if (controllerKey) {
    return `MOD-${row.module_uid} · ${controllerKey}`;
  }
  const stall =
    row.stall_ty_code && row.stall_no
      ? `${row.stall_ty_code}:${row.stall_no}`
      : "—";
  const eq = row.eqpmn_no?.trim() || "—";
  return `MOD-${row.module_uid} · ${stall}:${eq}`;
}

function buildCommandTimeline(
  rows: CommandRowForHealth[],
  checkpointIds: Set<string>,
  nowMs: number,
): CommandTimelineItem[] {
  const items: CommandTimelineItem[] = [];

  for (const row of rows) {
    const checkpoint = checkpointIds.has(row.id);
    const failure = classifyCommandFailure(row, nowMs);
    let timelineStatus: HealthStatus = "ok";
    if (checkpoint && failure.isFailure) {
      timelineStatus = "warn";
    } else if (failure.isFailure) {
      timelineStatus = failure.severity;
    } else if (row.status === "failed") {
      timelineStatus = "warn";
    }

    const farm = farmFromRow(row);
    const farmLabel = farmShortLabel(farm);
    items.push({
      commandId: row.id,
      lane: `${farmLabel} · MOD-${row.module_uid}`,
      farmLabel,
      targetLabel: targetLabel(row),
      createdAt: row.created_at,
      sentAt: row.sent_at,
      appliedAt: row.applied_at,
      status: row.status,
      checkpoint,
      timelineStatus,
      reason: failure.isFailure ? failure.reason : undefined,
    });
  }

  return items.sort((a, b) => {
    const pri = (x: CommandTimelineItem) => {
      if (x.timelineStatus === "critical") return 3;
      if (x.timelineStatus === "warn") return 2;
      if (x.checkpoint) return 1;
      return 0;
    };
    const pd = pri(b) - pri(a);
    if (pd !== 0) return pd;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export async function fetchCommandHealth(
  nowMs = Date.now(),
  adminClient?: ReturnType<typeof createAdminClient>,
): Promise<CommandHealthSummary> {
  const admin = adminClient ?? createAdminClient();
  const since24h = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();

  const [cmdRes, cpRes] = await Promise.all([
    admin
      .from("ctrl_thermo_command")
      .select(
        "id, status, created_at, sent_at, applied_at, lsind_regist_no, item_code, module_uid, stall_ty_code, stall_no, eqpmn_no, controller_key, channel_key"
      )
      .gte("created_at", since24h)
      .order("created_at", { ascending: false })
      .limit(500),
    admin.from("health_command_checkpoint").select("command_id"),
  ]);

  if (cmdRes.error || !cmdRes.data) {
    return {
      status: "unknown",
      checkpointCount: 0,
      activeFailures: [],
      timeline: [],
      points: [
        {
          id: "c.cmd.pending_age",
          label: "pending 최고 age",
          value: "조회 실패",
          status: "unknown",
          d11Hint: "S4",
        },
      ],
    };
  }

  const rows = cmdRes.data as CommandRowForHealth[];
  const checkpointIds = new Set(
    (cpRes.data ?? []).map((r) => r.command_id as string)
  );
  const checkpointCount = checkpointIds.size;

  const activeFailures = listActiveCommandFailures(rows, checkpointIds, nowMs);
  const metricRows = activeRowsForMetrics(rows, checkpointIds, nowMs);
  const timeline = buildCommandTimeline(rows, checkpointIds, nowMs);

  const pending = metricRows.filter((r) => r.status === "pending");
  const sent = metricRows.filter((r) => r.status === "sent");
  const applied = metricRows.filter((r) => r.status === "applied");
  const failed = metricRows.filter((r) => r.status === "failed");

  const oldestPending = pending.reduce<string | null>((oldest, row) => {
    if (!oldest || row.created_at < oldest) return row.created_at;
    return oldest;
  }, null);

  const pendingAgeSec = oldestPending
    ? ageSecFromIso(oldestPending, nowMs)
    : null;

  let pendingStatus: HealthStatus = "ok";
  if (pendingAgeSec !== null) {
    if (pendingAgeSec > UPLINK_ROUND_SEC * 1.5) pendingStatus = "critical";
    else if (pendingAgeSec > UPLINK_ROUND_SEC) pendingStatus = "warn";
  }

  const oldestSent = sent.reduce<string | null>((oldest, row) => {
    const t = row.sent_at ?? row.created_at;
    if (!oldest || t < oldest) return t;
    return oldest;
  }, null);

  const sentAgeSec = oldestSent ? ageSecFromIso(oldestSent, nowMs) : null;
  let sentStatus: HealthStatus = "ok";
  if (sentAgeSec !== null && sent.length > 0) {
    if (sentAgeSec > UPLINK_ROUND_SEC * 2) sentStatus = "critical";
    else if (sentAgeSec > UPLINK_ROUND_SEC) sentStatus = "warn";
  }

  const total = metricRows.length;
  const appliedRatio =
    total > 0 ? Math.round((applied.length / total) * 100) : 0;
  let throughputStatus: HealthStatus = "ok";
  if (total === 0) throughputStatus = "unknown";
  else if (appliedRatio < 30 && pending.length > 3) throughputStatus = "warn";
  else if (appliedRatio === 0 && pending.length > 0) throughputStatus = "warn";

  const failureSeverities = activeFailures.map((f) => {
    const row = rows.find((r) => r.id === f.commandId);
    if (!row) return "warn" as HealthStatus;
    return classifyCommandFailure(row, nowMs).severity;
  });

  /** DAG 명령 서버: 실패(미체크) 없으면 정상 — pending/sent 지연은 포인트·상세에서만 */
  const rollup: HealthStatus =
    activeFailures.length > 0
      ? worstStatus(failureSeverities.length > 0 ? failureSeverities : ["warn"])
      : "ok";

  const ignoredNote =
    checkpointCount > 0 ? ` · 체크포인트 무시 ${checkpointCount}건` : "";

  const points: HealthPoint[] = [
    {
      id: "c.cmd.pending_age",
      label: "pending 최고 age",
      value:
        pendingAgeSec === null
          ? pending.length
            ? "—"
            : `0건${ignoredNote}`
          : `${Math.round(pendingAgeSec)}s (${pending.length}건)${ignoredNote}`,
      status: pendingStatus,
      d11Hint: pendingStatus !== "ok" ? "S4" : undefined,
    },
    {
      id: "c.cmd.sent_stuck",
      label: "sent 미 applied",
      value:
        sentAgeSec === null
          ? `${sent.length}건${ignoredNote}`
          : `${sent.length}건 · max ${Math.round(sentAgeSec)}s${ignoredNote}`,
      status: sentStatus,
      d11Hint: sentStatus !== "ok" ? "S4" : undefined,
    },
    {
      id: "c.cmd.throughput",
      label: "24h applied 비율",
      value: `${appliedRatio}% (${applied.length}/${total}, failed ${failed.length})${ignoredNote}`,
      status: throughputStatus,
      d11Hint: throughputStatus === "warn" ? "S4" : undefined,
    },
    {
      id: "c.cmd.checkpoint",
      label: "활성 실패 (미체크)",
      value: `${activeFailures.length}건${checkpointCount > 0 ? ` · 무시됨 ${checkpointCount}건` : ""}`,
      status:
        activeFailures.length === 0
          ? "ok"
          : worstStatus(failureSeverities.length ? failureSeverities : ["warn"]),
      d11Hint: activeFailures.length > 0 ? "S4" : undefined,
    },
  ];

  return {
    status: rollup,
    points,
    activeFailures,
    checkpointCount,
    timeline,
  };
}
