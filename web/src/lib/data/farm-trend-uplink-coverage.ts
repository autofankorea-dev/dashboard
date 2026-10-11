import "server-only";

import { cachedLiveQuery } from "@/lib/data/live-cache";
import { farmKeyId, type FarmKey } from "@/lib/domain/farm-key";
import { TREND_PERIODS } from "@/lib/domain/farm-trend-types";
import { coerceTrendRpcJson } from "@/lib/domain/farm-trend-rpc-json";
import {
  createRlsClient,
  getAccessTokenOrNull,
} from "@/lib/supabase/rls-client";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
  buildUplinkCoverageIndex,
  coverageIndexToWire,
  type UplinkCoverageWire,
  type UplinkCoverageRpcRow,
} from "@/lib/farm/trend-uplink-coverage";

const CACHE_SLOT_MS = 5 * 60 * 1000;
const WINDOW_CHUNK_MS = TREND_PERIODS["24h"].durationMs;

function alignedToMs(now: number): number {
  return Math.floor(now / CACHE_SLOT_MS) * CACHE_SLOT_MS;
}

function isMissingRpc(message: string): boolean {
  return (
    /could not find the function/i.test(message) ||
    /PGRST202/i.test(message) ||
    /does not exist/i.test(message)
  );
}

async function fetchCoverageChunk(
  accessToken: string,
  farmKey: FarmKey,
  fromIso: string,
  toIso: string,
  bucket: string,
): Promise<UplinkCoverageRpcRow[]> {
  const supabase = createRlsClient(accessToken);
  const { data, error } = await supabase.rpc("farm_trend_uplink_coverage_json", {
    p_lsind: farmKey.lsindRegistNo,
    p_item: farmKey.itemCode,
    p_from: fromIso,
    p_to: toIso,
    p_bucket: bucket,
  });
  if (error) {
    const message = error.message || "farm_trend_uplink_coverage_json failed";
    if (isMissingRpc(message) || /statement timeout/i.test(message)) {
      console.warn("[trend-coverage]", message, fromIso, toIso);
      return [];
    }
    throw new Error(message);
  }
  if (data == null) return [];
  return coerceTrendRpcJson<UplinkCoverageRpcRow>(data);
}

async function fetchCoverageRowsChunked(
  accessToken: string,
  farmKey: FarmKey,
  fromMs: number,
  toMs: number,
  bucket: string,
): Promise<UplinkCoverageRpcRow[]> {
  if (toMs - fromMs <= WINDOW_CHUNK_MS + 1000) {
    return fetchCoverageChunk(
      accessToken,
      farmKey,
      new Date(fromMs).toISOString(),
      new Date(toMs).toISOString(),
      bucket,
    );
  }
  const rows: UplinkCoverageRpcRow[] = [];
  for (let chunkTo = toMs; chunkTo > fromMs; chunkTo -= WINDOW_CHUNK_MS) {
    const chunkFrom = Math.max(fromMs, chunkTo - WINDOW_CHUNK_MS);
    const part = await fetchCoverageChunk(
      accessToken,
      farmKey,
      new Date(chunkFrom).toISOString(),
      new Date(chunkTo).toISOString(),
      bucket,
    );
    rows.push(...part);
  }
  return rows;
}

export async function getFarmTrendUplinkCoverage(params: {
  farmKey: FarmKey;
  fromMs: number;
  toMs: number;
  bucket: string;
  bucketCount: number;
  strideMs: number;
  now?: number;
}): Promise<UplinkCoverageWire> {
  const empty = coverageIndexToWire(
    buildUplinkCoverageIndex(
      [],
      params.fromMs,
      params.bucketCount,
      params.strideMs,
    ),
  );
  if (
    !Number.isFinite(params.fromMs) ||
    !Number.isFinite(params.toMs) ||
    params.toMs <= params.fromMs ||
    params.bucketCount < 1
  ) {
    return empty;
  }

  const accessToken = await getAccessTokenOrNull();
  if (!accessToken) return empty;

  const user = await getCurrentUser();
  const userId = user?.id ?? "anon";
  const scopeKey = farmKeyId(params.farmKey);
  const toAligned = alignedToMs(params.now ?? Date.now());

  const rows = await cachedLiveQuery(
    [
      "farm-trend-uplink-coverage",
      userId,
      scopeKey,
      String(params.fromMs),
      String(params.toMs),
      params.bucket.replace(/\s+/g, ""),
      String(params.bucketCount),
      String(toAligned),
    ],
    ["live", `controller-trend:${scopeKey}`],
    () =>
      fetchCoverageRowsChunked(
        accessToken,
        params.farmKey,
        params.fromMs,
        params.toMs,
        params.bucket,
      ),
  );

  return coverageIndexToWire(
    buildUplinkCoverageIndex(
      rows,
      params.fromMs,
      params.bucketCount,
      params.strideMs,
    ),
  );
}
