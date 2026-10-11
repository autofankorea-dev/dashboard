import { UPLINK_ROUND_SEC } from "@/lib/admin/health/constants";
import {
  ageMinFromIso,
  ageSecFromIso,
  evaluateStaleness,
  worstStatus,
} from "@/lib/admin/health/staleness";
import type {
  ControllerHealthRow,
  HealthStatus,
  ModuleHealthRow,
} from "@/lib/admin/health/types";
import { farmKeyId, moduleKey, type FarmKey } from "@/lib/domain/farm-key";
import { farmShortLabel } from "@/lib/domain/farm-summaries";
import { isLivePacketMode } from "@/lib/domain/iot-raw-live";

export type LiveHealthRow = {
  lsind_regist_no: string;
  item_code: string;
  module_uid: number;
  received_at: string;
  controller_key?: string | null;
  packet_mode?: string | null;
};

export type DbDecodedLatestRow = {
  lsind_regist_no: string;
  item_code: string;
  module_uid: number;
  controller_key: string;
  packet_mode: string;
  received_at: string;
};

/** v_iot_decoded_latest — controller_key from Edge decode pipeline */
export function mapDecodedLatestDbRowsToLiveHealth(
  rows: DbDecodedLatestRow[],
): LiveHealthRow[] {
  return rows
    .filter((row) => isLivePacketMode(row.packet_mode))
    .map((row) => ({
      lsind_regist_no: row.lsind_regist_no,
      item_code: row.item_code,
      module_uid: row.module_uid,
      received_at: row.received_at,
      controller_key: row.controller_key,
      packet_mode: row.packet_mode,
    }));
}

function farmFromRow(row: LiveHealthRow): FarmKey {
  return { lsindRegistNo: row.lsind_regist_no, itemCode: row.item_code };
}

export function aggregateControllers(
  rows: LiveHealthRow[],
  nowMs: number
): ControllerHealthRow[] {
  const byController = new Map<
    string,
    {
      farm: FarmKey;
      moduleUid: number;
      controllerKey: string;
      lastAt: string;
    }
  >();

  for (const row of rows) {
    if (!isLivePacketMode(row.packet_mode)) continue;
    const controllerKey = row.controller_key?.trim();
    if (!controllerKey) continue;

    const farm = farmFromRow(row);
    const id = `${moduleKey(farm, row.module_uid)}|${controllerKey}`;
    const existing = byController.get(id);
    if (!existing || row.received_at > existing.lastAt) {
      byController.set(id, {
        farm,
        moduleUid: row.module_uid,
        controllerKey,
        lastAt: row.received_at,
      });
    }
  }

  const result: ControllerHealthRow[] = [];

  for (const [, agg] of byController) {
    const ageMin = ageMinFromIso(agg.lastAt, nowMs);
    const ageSec = ageSecFromIso(agg.lastAt, nowMs);
    const status = evaluateStaleness(ageSec);

    let d11Hint = "—";
    if (status === "critical") d11Hint = "S5";
    else if (status === "warn") d11Hint = "S3";

    result.push({
      id: `${moduleKey(agg.farm, agg.moduleUid)}|${agg.controllerKey}`,
      farmId: farmKeyId(agg.farm),
      farmLabel: farmShortLabel(agg.farm),
      moduleUid: agg.moduleUid,
      moduleLabel: `MOD-${agg.moduleUid}`,
      controllerKey: agg.controllerKey,
      lastReceivedAt: agg.lastAt,
      ageMin,
      status,
      d11Hint,
    });
  }

  return result.sort((a, b) => (b.ageMin ?? 0) - (a.ageMin ?? 0));
}

export function aggregateModulesFromLive(
  rows: LiveHealthRow[],
  nowMs: number
): ModuleHealthRow[] {
  const byModule = new Map<
    string,
    {
      farm: FarmKey;
      moduleUid: number;
      lastAt: string;
      controllerLastAt: Map<string, string>;
      recentControllers: Set<string>;
      rowCount: number;
    }
  >();

  for (const row of rows) {
    if (row.packet_mode && !isLivePacketMode(row.packet_mode)) continue;
    const farm = farmFromRow(row);
    const mk = moduleKey(farm, row.module_uid);
    const controllerKey = row.controller_key?.trim();
    const existing = byModule.get(mk);

    if (!existing) {
      const controllerLastAt = new Map<string, string>();
      if (controllerKey) controllerLastAt.set(controllerKey, row.received_at);
      byModule.set(mk, {
        farm,
        moduleUid: row.module_uid,
        lastAt: row.received_at,
        controllerLastAt,
        recentControllers: new Set(),
        rowCount: 1,
      });
    } else {
      if (row.received_at > existing.lastAt) existing.lastAt = row.received_at;
      if (controllerKey) {
        const prev = existing.controllerLastAt.get(controllerKey);
        if (!prev || row.received_at > prev) {
          existing.controllerLastAt.set(controllerKey, row.received_at);
        }
      }
      existing.rowCount += 1;
    }
  }

  const roundMs = UPLINK_ROUND_SEC * 1000;
  for (const row of rows) {
    if (row.packet_mode && !isLivePacketMode(row.packet_mode)) continue;
    const farm = farmFromRow(row);
    const mk = moduleKey(farm, row.module_uid);
    const agg = byModule.get(mk);
    if (!agg) continue;
    const ageMs = nowMs - Date.parse(row.received_at);
    const controllerKey = row.controller_key?.trim();
    if (ageMs <= roundMs * 1.5 && controllerKey) {
      agg.recentControllers.add(controllerKey);
    }
  }

  const result: ModuleHealthRow[] = [];

  for (const [, agg] of byModule) {
    const n = Math.max(agg.controllerLastAt.size, agg.rowCount, 1);
    const ageMin = ageMinFromIso(agg.lastAt, nowMs);

    const controllerStatuses: HealthStatus[] = [...agg.controllerLastAt.values()].map(
      (lastAt) => evaluateStaleness(ageSecFromIso(lastAt, nowMs))
    );
    const status =
      controllerStatuses.length > 0
        ? worstStatus(controllerStatuses)
        : evaluateStaleness(ageSecFromIso(agg.lastAt, nowMs));
    const coverage =
      n > 0 ? Math.round((agg.recentControllers.size / n) * 100) : 0;

    let d11Hint = "—";
    let scope = "—";
    if (status === "critical") {
      d11Hint = "S1";
      scope = "R2";
    } else if (status === "warn") {
      d11Hint = coverage < 80 ? "S5" : "S3";
      scope = coverage < 80 ? "R1" : "R1";
    } else if (coverage < 80) {
      d11Hint = "S5";
      scope = "R1";
    }

    result.push({
      id: moduleKey(agg.farm, agg.moduleUid),
      farmId: farmKeyId(agg.farm),
      farmLabel: farmShortLabel(agg.farm),
      moduleUid: agg.moduleUid,
      moduleLabel: `MOD-${agg.moduleUid}`,
      controllerCount: n,
      coveragePct: coverage,
      lastReceivedAt: agg.lastAt,
      ageMin,
      status,
      d11Hint,
      scope,
    });
  }

  return result.sort((a, b) => (b.ageMin ?? 0) - (a.ageMin ?? 0));
}

export function rollupFieldStatus(
  modules: ModuleHealthRow[],
  controllers: ControllerHealthRow[]
): HealthStatus {
  const statuses = [
    ...modules.map((m) => m.status),
    ...controllers.map((c) => c.status),
  ];
  return worstStatus(statuses.length ? statuses : ["unknown"]);
}
