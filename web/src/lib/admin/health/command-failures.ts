import { UPLINK_ROUND_SEC } from "@/lib/admin/health/constants";
import { ageSecFromIso } from "@/lib/admin/health/staleness";
import type { CommandFailureItem, HealthStatus } from "@/lib/admin/health/types";
import { farmKeyId, type FarmKey } from "@/lib/domain/farm-key";
import { farmShortLabel } from "@/lib/domain/farm-summaries";

export type CommandRowForHealth = {
  id: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  applied_at: string | null;
  lsind_regist_no: string;
  item_code: string;
  module_uid: number;
  stall_ty_code: string | null;
  stall_no: string | null;
  eqpmn_no: string | null;
  controller_key?: string | null;
  channel_key?: string | null;
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
  const stall = row.stall_ty_code && row.stall_no
    ? `${row.stall_ty_code}:${row.stall_no}`
    : "—";
  const eq = row.eqpmn_no?.trim() || "—";
  return `MOD-${row.module_uid} · ${stall}:${eq}`;
}

/** Failure candidate for S4 — matches fetch-command-health warn thresholds. */
export function classifyCommandFailure(
  row: CommandRowForHealth,
  nowMs: number,
): { isFailure: boolean; ageSec: number; reason: string; severity: HealthStatus } {
  if (row.status === "failed") {
    return {
      isFailure: true,
      ageSec: ageSecFromIso(row.created_at, nowMs) ?? 0,
      reason: "failed",
      severity: "warn",
    };
  }

  if (row.status === "pending") {
    const ageSec = ageSecFromIso(row.created_at, nowMs);
    if (ageSec === null) {
      return { isFailure: false, ageSec: 0, reason: "", severity: "ok" };
    }
    if (ageSec > UPLINK_ROUND_SEC * 1.5) {
      return {
        isFailure: true,
        ageSec,
        reason: "pending 장시간",
        severity: "critical",
      };
    }
    if (ageSec > UPLINK_ROUND_SEC) {
      return {
        isFailure: true,
        ageSec,
        reason: "pending 지연",
        severity: "warn",
      };
    }
    return { isFailure: false, ageSec, reason: "", severity: "ok" };
  }

  if (row.status === "sent") {
    const t = row.sent_at ?? row.created_at;
    const ageSec = ageSecFromIso(t, nowMs);
    if (ageSec === null) {
      return { isFailure: false, ageSec: 0, reason: "", severity: "ok" };
    }
    if (ageSec > UPLINK_ROUND_SEC * 2) {
      return {
        isFailure: true,
        ageSec,
        reason: "sent 미 applied",
        severity: "critical",
      };
    }
    if (ageSec > UPLINK_ROUND_SEC) {
      return {
        isFailure: true,
        ageSec,
        reason: "sent 미 applied",
        severity: "warn",
      };
    }
    return { isFailure: false, ageSec, reason: "", severity: "ok" };
  }

  return { isFailure: false, ageSec: 0, reason: "", severity: "ok" };
}

export function listActiveCommandFailures(
  rows: CommandRowForHealth[],
  checkpointIds: Set<string>,
  nowMs: number,
): CommandFailureItem[] {
  const out: CommandFailureItem[] = [];

  for (const row of rows) {
    if (checkpointIds.has(row.id)) continue;
    const c = classifyCommandFailure(row, nowMs);
    if (!c.isFailure) continue;
    const farm = farmFromRow(row);
    out.push({
      commandId: row.id,
      status: row.status,
      farmId: farmKeyId(farm),
      farmLabel: farmShortLabel(farm),
      moduleUid: row.module_uid,
      targetLabel: targetLabel(row),
      ageSec: c.ageSec,
      reason: c.reason,
    });
  }

  return out.sort((a, b) => b.ageSec - a.ageSec);
}

export function activeRowsForMetrics(
  rows: CommandRowForHealth[],
  checkpointIds: Set<string>,
  nowMs: number,
): CommandRowForHealth[] {
  return rows.filter((row) => {
    if (!checkpointIds.has(row.id)) return true;
    return !classifyCommandFailure(row, nowMs).isFailure;
  });
}
