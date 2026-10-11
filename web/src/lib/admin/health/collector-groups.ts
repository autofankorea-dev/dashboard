import "server-only";

import type { ModuleHealthRow } from "@/lib/admin/health/types";
import { parseFarmKeyId } from "@/lib/domain/farm-key";

export type CollectorGroupDef = {
  id: string;
  label: string;
  farmIds: string[];
};

/** HEALTH_COLLECTOR_GROUPS JSON: `{ "col-a": ["FARM01/P00", ...] }` */
export function resolveCollectorGroups(
  modules: ModuleHealthRow[]
): CollectorGroupDef[] {
  const fromEnv = parseEnvGroups();
  if (fromEnv.length > 0) return fromEnv;

  const farmIds = [...new Set(modules.map((m) => m.farmId))].sort();
  if (farmIds.length <= 1) {
    return [
      {
        id: "default",
        label: "수집 그룹 (전역)",
        farmIds,
      },
    ];
  }

  const mid = Math.ceil(farmIds.length / 2);
  return [
    {
      id: "col-a",
      label: "수집 그룹 A",
      farmIds: farmIds.slice(0, mid),
    },
    {
      id: "col-b",
      label: "수집 그룹 B",
      farmIds: farmIds.slice(mid),
    },
  ];
}

function parseEnvGroups(): CollectorGroupDef[] {
  const raw = process.env.HEALTH_COLLECTOR_GROUPS?.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    return Object.entries(parsed)
      .filter(([, farms]) => Array.isArray(farms) && farms.length > 0)
      .map(([id, farmIds]) => ({
        id,
        label: id,
        farmIds: farmIds.filter((f) => parseFarmKeyId(f)),
      }));
  } catch {
    return [];
  }
}
