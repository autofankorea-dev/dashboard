/**
 * Trend RPC baseline — current app policy (24h@15m, 30d@1h, coverage).
 * Uses `*_json` RPCs (one PostgREST row; no max_rows paging).
 *
 * Usage (from dashboard/web):
 *   npm run measure:trend
 *   # or: npx tsx scripts/measure-trend-rpc.ts
 *
 * Requires .env.local with Supabase credentials.
 */
import dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"),
});

const SAMPLES = Number(process.env.TREND_MEASURE_SAMPLES ?? 3);
const FARM_LSIND = "FARM01";
const FARM_ITEM = "P00";
const BUCKET_15M = "15 minutes";
const BUCKET_1H = "1 hour";
const HOURS_24_MS = 24 * 60 * 60_000;
const DAYS_30_MS = 30 * 24 * 60 * 60_000;

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[idx]!;
}

function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key in env");
  }
  return createClient(url, key);
}

function periodRange(
  nowMs: number,
  durationMs: number,
): { fromIso: string; toIso: string } {
  const toMs = nowMs;
  const fromMs = toMs - durationMs;
  return {
    fromIso: new Date(fromMs).toISOString(),
    toIso: new Date(toMs).toISOString(),
  };
}

async function chunkedRpc(
  supabase: SupabaseClient,
  rpc: "farm_trend_history_by_controller_json" | "farm_trend_uplink_coverage_json",
  range: { fromIso: string; toIso: string },
  bucket: string,
): Promise<unknown[]> {
  const fromMs = Date.parse(range.fromIso);
  const toMs = Date.parse(range.toIso);
  const chunkMs = HOURS_24_MS;
  const rows: unknown[] = [];
  for (let chunkTo = toMs; chunkTo > fromMs; chunkTo -= chunkMs) {
    const chunkFrom = Math.max(fromMs, chunkTo - chunkMs);
    const { data, error } = await supabase.rpc(rpc, {
      p_lsind: FARM_LSIND,
      p_item: FARM_ITEM,
      p_from: new Date(chunkFrom).toISOString(),
      p_to: new Date(chunkTo).toISOString(),
      p_bucket: bucket,
    });
    if (error) throw new Error(error.message);
    if (Array.isArray(data)) rows.push(...data);
  }
  return rows;
}

async function timedRpc(
  label: string,
  run: (supabase: SupabaseClient) => Promise<unknown>,
): Promise<{ p50: number; p95: number; bytes: number }> {
  const supabase = client();
  const times: number[] = [];
  let lastBytes = 0;

  for (let i = 0; i < SAMPLES; i++) {
    const t0 = performance.now();
    const data = await run(supabase);
    times.push(performance.now() - t0);
    lastBytes = Buffer.byteLength(JSON.stringify(data ?? null), "utf8");
  }

  const p50 = percentile(times, 50);
  const p95 = percentile(times, 95);
  console.log(`${label}:`);
  console.log(`  JSON: ${(lastBytes / 1024 / 1024).toFixed(2)} MiB`);
  console.log(`  p50: ${p50.toFixed(1)} ms`);
  console.log(`  p95: ${p95.toFixed(1)} ms`);
  console.log(
    `  min/max: ${Math.min(...times).toFixed(1)} / ${Math.max(...times).toFixed(1)} ms`,
  );
  console.log("");
  return {
    p50: Number(p50.toFixed(1)),
    p95: Number(p95.toFixed(1)),
    bytes: lastBytes,
  };
}

async function main() {
  const nowMs = Date.now();
  const h24 = periodRange(nowMs, HOURS_24_MS);
  const d30 = periodRange(nowMs, DAYS_30_MS);

  console.log(`Samples per RPC: ${SAMPLES}\n`);
  console.log(`Measured at: ${new Date().toISOString()}`);
  console.log(`Farm scope: ${FARM_LSIND}/${FARM_ITEM}\n`);

  const summary: Record<string, unknown> = {};

  async function controller(
    label: string,
    range: { fromIso: string; toIso: string },
    bucket: string,
  ) {
    return timedRpc(
      label,
      async (supabase) => {
        if (Date.parse(range.toIso) - Date.parse(range.fromIso) > HOURS_24_MS) {
          return chunkedRpc(
            supabase,
            "farm_trend_history_by_controller_json",
            range,
            bucket,
          );
        }
        const { data, error } = await supabase.rpc(
          "farm_trend_history_by_controller_json",
          {
            p_lsind: FARM_LSIND,
            p_item: FARM_ITEM,
            p_from: range.fromIso,
            p_to: range.toIso,
            p_bucket: bucket,
          },
        );
        if (error) throw new Error(error.message);
        return data;
      },
    );
  }

  async function coverage(
    label: string,
    range: { fromIso: string; toIso: string },
    bucket: string,
  ) {
    return timedRpc(
      label,
      async (supabase) => {
        if (Date.parse(range.toIso) - Date.parse(range.fromIso) > HOURS_24_MS) {
          return chunkedRpc(
            supabase,
            "farm_trend_uplink_coverage_json",
            range,
            bucket,
          );
        }
        const { data, error } = await supabase.rpc(
          "farm_trend_uplink_coverage_json",
          {
            p_lsind: FARM_LSIND,
            p_item: FARM_ITEM,
            p_from: range.fromIso,
            p_to: range.toIso,
            p_bucket: bucket,
          },
        );
        if (error) throw new Error(error.message);
        return data;
      },
    );
  }

  summary.controller24h = await controller(
    "controller 24h @ 15m",
    h24,
    BUCKET_15M,
  );
  summary.controller30d = await controller(
    "controller 30d @ 1h",
    d30,
    BUCKET_1H,
  );
  summary.coverage24h = await coverage(
    "coverage 24h @ 15m",
    h24,
    BUCKET_15M,
  );
  summary.coverage30d = await coverage(
    "coverage 30d @ 1h",
    d30,
    BUCKET_1H,
  );

  console.log("JSON summary:");
  console.log(
    JSON.stringify(
      {
        at: new Date().toISOString(),
        farm: `${FARM_LSIND}/${FARM_ITEM}`,
        policy: {
          controller24h: BUCKET_15M,
          controller30d: BUCKET_1H,
          coverage24h: BUCKET_15M,
          coverage30d: BUCKET_1H,
        },
        summary,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
