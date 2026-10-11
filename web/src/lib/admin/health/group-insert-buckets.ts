import "server-only";

import {
  INSERT_BUCKET_COUNT,
  INSERT_BUCKET_MINUTES,
} from "@/lib/admin/health/constants";
import { formatHealthTime } from "@/lib/admin/health/format-health-time";
import type { InsertBucket, HealthStatus } from "@/lib/admin/health/types";
import type { CollectorGroupDef } from "@/lib/admin/health/collector-groups";
import { parseFarmKeyId } from "@/lib/domain/farm-key";
import { createAdminClient } from "@/lib/supabase/admin";

function formatBucketLabel(iso: string): string {
  return formatHealthTime(iso);
}

async function countRawForFarms(
  admin: ReturnType<typeof createAdminClient>,
  startIso: string,
  endIso: string,
  farmIds: string[]
): Promise<number> {
  if (farmIds.length === 0) return 0;

  const filters = farmIds
    .map((id) => {
      const fk = parseFarmKeyId(id);
      if (!fk) return null;
      return `and(lsind_regist_no.eq.${fk.lsindRegistNo},item_code.eq.${fk.itemCode})`;
    })
    .filter((f): f is string => Boolean(f));

  if (filters.length === 0) return 0;

  let query = admin
    .from("iot_room_state_raw")
    .select("id", { count: "exact", head: true })
    .gte("received_at", startIso)
    .lt("received_at", endIso);

  query = filters.length === 1 ? query.or(filters[0]) : query.or(filters.join(","));

  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

export async function fetchGroupInsertBuckets(
  groups: CollectorGroupDef[],
  nowMs: number
): Promise<Map<string, InsertBucket[]>> {
  const admin = createAdminClient();
  const result = new Map<string, InsertBucket[]>();

  await Promise.all(
    groups.map(async (group) => {
      const bucketDefs = Array.from({ length: INSERT_BUCKET_COUNT }, (_, idx) => {
        const i = INSERT_BUCKET_COUNT - 1 - idx;
        const endMs = nowMs - i * INSERT_BUCKET_MINUTES * 60 * 1000;
        const startMs = endMs - INSERT_BUCKET_MINUTES * 60 * 1000;
        return {
          startIso: new Date(startMs).toISOString(),
          endIso: new Date(endMs).toISOString(),
          label: formatBucketLabel(new Date(startMs).toISOString()),
        };
      });

      const counts = await Promise.all(
        bucketDefs.map((def) =>
          countRawForFarms(
            admin,
            def.startIso,
            def.endIso,
            group.farmIds
          )
        )
      );

      const buckets = bucketDefs.map((def, idx) => ({
        label: def.label,
        count: counts[idx] ?? 0,
      }));

      result.set(group.id, buckets);
    })
  );

  return result;
}

export function insertRateStatus(buckets: InsertBucket[]): HealthStatus {
  const recent = buckets.slice(-2);
  if (recent.length === 0) return "unknown";
  if (recent.every((b) => b.count === 0)) return "critical";
  if (recent.some((b) => b.count === 0)) return "warn";
  return "ok";
}
