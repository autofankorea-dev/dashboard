import "server-only";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { cachedLiveQuery } from "@/lib/data/live-cache";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import {
  createRlsClient,
  getAccessTokenOrNull,
} from "@/lib/supabase/rls-client";
import type { TrendRpcArgs, TrendRpcName } from "@/lib/supabase/database.types";
import {
  getStallTypeName,
  normalizeStallTyCode,
  stallTyCodeSortKey,
} from "@/lib/data/stall-type";
import {
  TREND_OVERVIEW_30D,
  TREND_PERIODS,
  TREND_ZOOM_15M_MAX_DAYS,
  type TrendControllerPeriodData,
  type TrendPeriodConfig,
  type TrendPeriodData,
  type TrendPeriodId,
  type TrendSpSeries,
  type TrendStallSeries,
} from "@/lib/data/farm-trend-types";
import {
  expandCompactControllerPeriod,
  emptyCompactControllerPeriod,
  type CompactControllerPeriod,
  type CompactControllerSeries,
  type CompactThermoPoint,
} from "@/lib/data/farm-trend-compact";
import { normalizeEqpmnNo } from "@/lib/data/controller-key";
import {
  sliceControllerTrendFromLonger,
  stallTrendBundleFromController,
} from "@/lib/data/trend-period-slice";
import { coerceTrendRpcJson } from "@/lib/data/farm-trend-rpc-json";

export type {
  TrendPeriodId,
  TrendPeriodData,
  TrendSpSeries,
  TrendStallSeries,
  TrendControllerPeriodData,
  TrendControllerSeries,
} from "@/lib/data/farm-trend-types";
export { TREND_PERIODS, DEFAULT_TREND_PERIOD } from "@/lib/data/farm-trend-types";

/** Cache/query alignment slot — keeps `now` stable for 5 minutes. */
const CACHE_SLOT_MS = 5 * 60 * 1000;

/** RPC buckets by mesure_at (sensor time). Decode corrects KST-as-UTC clocks. */

type RpcRow = {
  bucket_at: string;
  stall_ty_code: string | null;
  stall_no: string | null;
  avg_temp_c: number | string | null;
  avg_humidity_pct: number | string | null;
  avg_fan_supply: number | string | null;
  avg_fan_exhaust: number | string | null;
  avg_fan_intake: number | string | null;
  avg_fan_a: number | string | null;
  avg_fan_b: number | string | null;
  avg_fan_c: number | string | null;
  sample_count: number | string | null;
};

type ControllerRpcRow = RpcRow & {
  controller_key: string | null;
  eqpmn_no: string | null;
  a_setpoint_temp?: number | string | null;
  a_temp_deviation?: number | string | null;
  a_min_vent_pct?: number | string | null;
  a_max_vent_pct?: number | string | null;
  b_setpoint_temp?: number | string | null;
  b_temp_deviation?: number | string | null;
  b_min_vent_pct?: number | string | null;
  b_max_vent_pct?: number | string | null;
  c_setpoint_temp?: number | string | null;
  c_temp_deviation?: number | string | null;
  c_min_vent_pct?: number | string | null;
  c_max_vent_pct?: number | string | null;
};

function stallNoSortKey(stallNo: string): number {
  const n = Number(stallNo);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

function toNum(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function compactThermoFromRow(
  row: ControllerRpcRow,
  slot: number,
): CompactThermoPoint | null {
  const vals: CompactThermoPoint = [
    slot,
    toNum(row.a_setpoint_temp),
    toNum(row.a_temp_deviation),
    toNum(row.a_min_vent_pct),
    toNum(row.a_max_vent_pct),
    toNum(row.b_setpoint_temp),
    toNum(row.b_temp_deviation),
    toNum(row.b_min_vent_pct),
    toNum(row.b_max_vent_pct),
    toNum(row.c_setpoint_temp),
    toNum(row.c_temp_deviation),
    toNum(row.c_min_vent_pct),
    toNum(row.c_max_vent_pct),
  ];
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] != null) return vals;
  }
  return null;
}

function alignedToMs(now: number): number {
  return Math.floor(now / CACHE_SLOT_MS) * CACHE_SLOT_MS;
}

async function fetchRpcJsonRows<T>(
  accessToken: string,
  rpcName: TrendRpcName,
  args: TrendRpcArgs,
): Promise<T[]> {
  const supabase = createRlsClient(accessToken);
  const { data, error } = await supabase.rpc(rpcName, args);
  if (error) {
    const message = error.message || `${rpcName} failed`;
    if (/statement timeout/i.test(message)) {
      console.warn(`[trend] ${rpcName} statement timeout`, args.p_from, args.p_to);
      return [];
    }
    throw new Error(message);
  }
  if (data == null) return [];
  return coerceTrendRpcJson<T>(data);
}

async function fetchTrendRows(
  accessToken: string,
  farmKey: FarmKey,
  fromIso: string,
  toIso: string,
  bucket: string,
): Promise<RpcRow[]> {
  return fetchRpcJsonRows<RpcRow>(accessToken, "farm_trend_history_json", {
    p_lsind: farmKey.lsindRegistNo,
    p_item: farmKey.itemCode,
    p_from: fromIso,
    p_to: toIso,
    p_bucket: bucket,
  });
}

async function fetchControllerTrendRows(
  accessToken: string,
  farmKey: FarmKey,
  fromIso: string,
  toIso: string,
  bucket: string,
): Promise<ControllerRpcRow[]> {
  return fetchRpcJsonRows<ControllerRpcRow>(
    accessToken,
    "farm_trend_history_by_controller_json",
    {
      p_lsind: farmKey.lsindRegistNo,
      p_item: farmKey.itemCode,
      p_from: fromIso,
      p_to: toIso,
      p_bucket: bucket,
    },
  );
}

/** 장기 창은 24h RPC로 나눠 스캔 — 오래된 고밀도 파티션의 timeout을 제한. */
async function fetchControllerTrendRowsChunked(
  accessToken: string,
  farmKey: FarmKey,
  fromMs: number,
  toMs: number,
  bucket: string,
): Promise<ControllerRpcRow[]> {
  const chunkMs = TREND_PERIODS["24h"].durationMs;
  if (toMs - fromMs <= chunkMs + 1000) {
    return fetchControllerTrendRows(
      accessToken,
      farmKey,
      new Date(fromMs).toISOString(),
      new Date(toMs).toISOString(),
      bucket,
    );
  }
  const rows: ControllerRpcRow[] = [];
  for (let chunkTo = toMs; chunkTo > fromMs; chunkTo -= chunkMs) {
    const chunkFrom = Math.max(fromMs, chunkTo - chunkMs);
    const part = await fetchControllerTrendRows(
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

function formatBucketLabel(date: Date, period: TrendPeriodId): string {
  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  if (period === "24h") return `${hh}:${min}`;
  // 7d/30d — 1h hub·PDF · M/D HH:mm (tick은 abbreviateTrendAxisLabel)
  return `${mm}/${dd} ${hh}:${min}`;
}

/** Build a continuous, gap-aware time axis grouped by SP. */
function buildPeriodData(
  rows: RpcRow[],
  period: TrendPeriodId,
  fromMs: number,
): TrendPeriodData {
  const cfg = TREND_PERIODS[period];

  const bucketAts: string[] = [];
  const categories: string[] = [];
  const indexByIso = new Map<string, number>();
  for (let i = 0; i < cfg.bucketCount; i++) {
    const ms = fromMs + i * cfg.strideMs;
    const d = new Date(ms);
    const iso = d.toISOString();
    bucketAts.push(iso);
    categories.push(formatBucketLabel(d, period));
    indexByIso.set(iso, i);
  }

  const emptyCol = () => new Array<number | null>(cfg.bucketCount).fill(null);
  type SpBucket = { stallTyCode: string; label: string; stalls: Map<string, TrendStallSeries> };
  const spMap = new Map<string, SpBucket>();
  let totalSamples = 0;

  for (const row of rows) {
    const code = normalizeStallTyCode(row.stall_ty_code);
    let sp = spMap.get(code);
    if (!sp) {
      sp = { stallTyCode: code, label: getStallTypeName(code), stalls: new Map() };
      spMap.set(code, sp);
    }
    const stallNo = (row.stall_no ?? "").trim() || "—";
    let stall = sp.stalls.get(stallNo);
    if (!stall) {
      stall = {
        stallNo,
        temp: emptyCol(),
        humidity: emptyCol(),
        fanA: emptyCol(),
        fanB: emptyCol(),
        fanC: emptyCol(),
        fanSupply: emptyCol(),
        fanExhaust: emptyCol(),
        fanIntake: emptyCol(),
        sampleCount: new Array<number>(cfg.bucketCount).fill(0),
      };
      sp.stalls.set(stallNo, stall);
    }
    // Align RPC bucket to the nearest axis slot.
    const bucketMs = Date.parse(row.bucket_at);
    const slot = Math.round((bucketMs - fromMs) / cfg.strideMs);
    if (slot < 0 || slot >= cfg.bucketCount) continue;
    stall.temp[slot] = toNum(row.avg_temp_c);
    stall.humidity[slot] = toNum(row.avg_humidity_pct);
    stall.fanA[slot] = toNum(row.avg_fan_a);
    stall.fanB[slot] = toNum(row.avg_fan_b);
    stall.fanC[slot] = toNum(row.avg_fan_c);
    stall.fanSupply[slot] = toNum(row.avg_fan_supply);
    stall.fanExhaust[slot] = toNum(row.avg_fan_exhaust);
    stall.fanIntake[slot] = toNum(row.avg_fan_intake);
    const n = toNum(row.sample_count) ?? 0;
    stall.sampleCount[slot] = n;
    totalSamples += n;
  }

  const sp: TrendSpSeries[] = [...spMap.values()]
    .sort((a, b) => stallTyCodeSortKey(a.stallTyCode) - stallTyCodeSortKey(b.stallTyCode))
    .map((s) => ({
      stallTyCode: s.stallTyCode,
      label: s.label,
      stalls: [...s.stalls.values()].sort(
        (a, b) => stallNoSortKey(a.stallNo) - stallNoSortKey(b.stallNo),
      ),
    }));

  return { period, categories, bucketAts, sp, totalSamples };
}

/** RPC 희소 행 → 와이어 compact. 빈 칸 배열을 만들지 않는다. */
function compactFromControllerRows(
  rows: ControllerRpcRow[],
  period: TrendPeriodId,
  fromMs: number,
  bucketCount: number,
  strideMs: number,
): CompactControllerPeriod {
  const byKey = new Map<string, CompactControllerSeries>();
  let totalSamples = 0;
  const stride = strideMs > 0 ? strideMs : 1;

  for (const row of rows) {
    const controllerKey = (row.controller_key ?? "").trim();
    if (!controllerKey) continue;
    const bucketMs = Date.parse(row.bucket_at);
    const slot = Math.round((bucketMs - fromMs) / stride);
    if (slot < 0 || slot >= bucketCount) continue;
    const code = normalizeStallTyCode(row.stall_ty_code);
    let series = byKey.get(controllerKey);
    if (!series) {
      series = {
        ty: code,
        lb: getStallTypeName(code),
        sn: (row.stall_no ?? "").trim() || "—",
        k: controllerKey,
        e: normalizeEqpmnNo(row.eqpmn_no ?? "01"),
        p: [],
      };
      byKey.set(controllerKey, series);
    }
    const n = toNum(row.sample_count) ?? 0;
    totalSamples += n;
    series.p.push([
      slot,
      toNum(row.avg_temp_c),
      toNum(row.avg_humidity_pct),
      toNum(row.avg_fan_supply),
      toNum(row.avg_fan_exhaust),
      toNum(row.avg_fan_intake),
      toNum(row.avg_fan_a),
      toNum(row.avg_fan_b),
      toNum(row.avg_fan_c),
      n,
    ]);
    const th = compactThermoFromRow(row, slot);
    if (th) {
      series.th ??= [];
      series.th.push(th);
    }
  }

  return {
    v: 1,
    period,
    fromMs,
    bucketCount,
    strideMs,
    totalSamples,
    series: [...byKey.values()],
  };
}

export async function getFarmTrendHistory(params: {
  farmKey: FarmKey;
  period: TrendPeriodId;
  now?: number;
}): Promise<TrendPeriodData> {
  const cfg = TREND_PERIODS[params.period];
  const toMs = alignedToMs(params.now ?? Date.now());
  const fromMs = toMs - cfg.durationMs;
  const emptyResult: TrendPeriodData = {
    period: params.period,
    categories: [],
    bucketAts: [],
    sp: [],
    totalSamples: 0,
  };

  const accessToken = await getAccessTokenOrNull();
  if (!accessToken) return emptyResult;

  const user = await getCurrentUser();
  const userId = user?.id ?? "anon";
  const scopeKey = farmKeyId(params.farmKey);

  const rows = await cachedLiveQuery(
    ["farm-trend", userId, scopeKey, params.period, String(toMs), "rpc-json"],
    ["live", `trend:${scopeKey}`],
    () =>
      fetchTrendRows(
        accessToken,
        params.farmKey,
        new Date(fromMs).toISOString(),
        new Date(toMs).toISOString(),
        cfg.bucket,
      ),
  );

  return buildPeriodData(rows, params.period, fromMs);
}

/** SSR / PDF — 허브와 같은 30d 1h → 축사 평균. stall RPC 없음. */
export async function getFarmTrendAllPeriods(params: {
  farmKey: FarmKey;
  now?: number;
}): Promise<Record<TrendPeriodId, TrendPeriodData>> {
  const ctrl = await getFarmControllerTrendAllPeriods(params);
  return stallTrendBundleFromController(ctrl);
}

function trendCacheKind(cfg: TrendPeriodConfig, overview?: boolean): string {
  if (overview) return "rpc-json-overview-1d-chunk24h-mst-th1";
  const bucket = cfg.bucket.replace(/\s+/g, "");
  return `rpc-json-chunk24h-${bucket}-${cfg.bucketCount}-mst-th1`;
}

export async function getFarmControllerTrendHistoryCompact(params: {
  farmKey: FarmKey;
  period: TrendPeriodId;
  now?: number;
  overview?: boolean;
  /** 테스트·특수 축. 허브·PDF 기본은 TREND_PERIODS. */
  cfg?: TrendPeriodConfig;
  /** 허브 클라 30일 하루 조각 — 24h compact 와 같은 축. */
  axisToMs?: number;
  scanFromMs?: number;
  scanToMs?: number;
}): Promise<CompactControllerPeriod> {
  const cfg =
    params.cfg ??
    (params.overview && params.period === "30d"
      ? TREND_OVERVIEW_30D
      : TREND_PERIODS[params.period]);
  const toMs =
    params.axisToMs != null && Number.isFinite(params.axisToMs)
      ? params.axisToMs
      : alignedToMs(params.now ?? Date.now());
  const fromMs = toMs - cfg.durationMs;
  const empty = emptyCompactControllerPeriod(
    params.period,
    fromMs,
    cfg.bucketCount,
    cfg.strideMs,
  );

  const scanFromMs = params.scanFromMs ?? fromMs;
  const scanToMs = params.scanToMs ?? toMs;
  const dayMs = TREND_PERIODS["24h"].durationMs;
  if (
    !Number.isFinite(scanFromMs) ||
    !Number.isFinite(scanToMs) ||
    scanToMs <= scanFromMs ||
    scanFromMs < fromMs - 1000 ||
    scanToMs > toMs + 1000
  ) {
    return empty;
  }
  if (
    (params.scanFromMs != null || params.scanToMs != null) &&
    scanToMs - scanFromMs > dayMs + 2000
  ) {
    return empty;
  }

  const accessToken = await getAccessTokenOrNull();
  if (!accessToken) return empty;

  const user = await getCurrentUser();
  const userId = user?.id ?? "anon";
  const scopeKey = farmKeyId(params.farmKey);
  const cacheKind =
    params.scanFromMs != null
      ? `${trendCacheKind(cfg, params.overview)}-scan-${scanFromMs}-${scanToMs}`
      : trendCacheKind(cfg, params.overview);

  return cachedLiveQuery(
    [
      "farm-controller-trend-compact",
      userId,
      scopeKey,
      params.period,
      String(toMs),
      cacheKind,
    ],
    ["live", `controller-trend:${scopeKey}`],
    async () => {
      const rows = await fetchControllerTrendRowsChunked(
        accessToken,
        params.farmKey,
        scanFromMs,
        scanToMs,
        cfg.bucket,
      );
      return compactFromControllerRows(
        rows,
        params.period,
        fromMs,
        cfg.bucketCount,
        cfg.strideMs,
      );
    },
  );
}

/** 허브 30일 1시간 축의 하루 RPC. compact 슬롯은 전체 720칸 기준. */
export async function getFarmControllerTrend30dDayCompact(params: {
  farmKey: FarmKey;
  axisToMs: number;
  scanFromMs: number;
  scanToMs: number;
}): Promise<CompactControllerPeriod> {
  return getFarmControllerTrendHistoryCompact({
    farmKey: params.farmKey,
    period: "30d",
    axisToMs: params.axisToMs,
    scanFromMs: params.scanFromMs,
    scanToMs: params.scanToMs,
  });
}

export async function getFarmControllerTrendHistory(params: {
  farmKey: FarmKey;
  period: TrendPeriodId;
  now?: number;
}): Promise<TrendControllerPeriodData> {
  return expandCompactControllerPeriod(
    await getFarmControllerTrendHistoryCompact(params),
  );
}

/** PDF·목록 — 허브와 동일. 30d 1h → 7d 슬라이스, 24h는 15분(1시간 축에서 슬라이스 불가). */
export async function getFarmControllerTrendAllPeriods(params: {
  farmKey: FarmKey;
  now?: number;
}): Promise<Record<TrendPeriodId, TrendControllerPeriodData>> {
  const now = params.now ?? Date.now();
  const d30 = await getFarmControllerTrendHistory({
    farmKey: params.farmKey,
    period: "30d",
    now,
  });
  const d7Slice = sliceControllerTrendFromLonger(d30, "7d");
  const d7 =
    d7Slice && d7Slice.totalSamples > 0
      ? d7Slice
      : await getFarmControllerTrendHistory({
          farmKey: params.farmKey,
          period: "7d",
          now,
        });
  const h24 = await getFarmControllerTrendHistory({
    farmKey: params.farmKey,
    period: "24h",
    now,
  });
  return { "24h": h24, "7d": d7, "30d": d30 };
}

const WINDOW_15M_STRIDE_MS = 15 * 60 * 1000;
const WINDOW_15M_MAX_MS =
  TREND_ZOOM_15M_MAX_DAYS * 24 * 60 * 60 * 1000 + WINDOW_15M_STRIDE_MS;

function alignTrendWindowBounds(fromMs: number, toMs: number): {
  fromMs: number;
  toMs: number;
} | null {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    return null;
  }
  const alignedFrom =
    Math.floor(fromMs / WINDOW_15M_STRIDE_MS) * WINDOW_15M_STRIDE_MS;
  let alignedTo = Math.ceil(toMs / WINDOW_15M_STRIDE_MS) * WINDOW_15M_STRIDE_MS;
  if (alignedTo <= alignedFrom) {
    alignedTo = alignedFrom + WINDOW_15M_STRIDE_MS * 2;
  }
  if (alignedTo - alignedFrom > WINDOW_15M_MAX_MS) {
    return {
      fromMs: alignedTo - TREND_ZOOM_15M_MAX_DAYS * 24 * 60 * 60 * 1000,
      toMs: alignedTo,
    };
  }
  return { fromMs: alignedFrom, toMs: alignedTo };
}

/** 브러시 창 ≤ 48h — 그 구간만 15분 스캔. */
export async function getFarmControllerTrendWindowCompact(params: {
  farmKey: FarmKey;
  fromMs: number;
  toMs: number;
}): Promise<CompactControllerPeriod> {
  const aligned = alignTrendWindowBounds(params.fromMs, params.toMs);
  const strideMs = WINDOW_15M_STRIDE_MS;
  if (!aligned) {
    return emptyCompactControllerPeriod("24h", params.fromMs, 0, strideMs);
  }
  const bucketCount = Math.max(
    2,
    Math.round((aligned.toMs - aligned.fromMs) / strideMs),
  );
  const period: TrendPeriodId =
    aligned.toMs - aligned.fromMs > 24 * 60 * 60 * 1000 + 1000 ? "7d" : "24h";
  const empty = emptyCompactControllerPeriod(
    period,
    aligned.fromMs,
    bucketCount,
    strideMs,
  );

  const accessToken = await getAccessTokenOrNull();
  if (!accessToken) return empty;

  const user = await getCurrentUser();
  const userId = user?.id ?? "anon";
  const scopeKey = farmKeyId(params.farmKey);

  const rows = await cachedLiveQuery(
    [
      "farm-controller-trend-window",
      userId,
      scopeKey,
      String(aligned.fromMs),
      String(aligned.toMs),
      "rpc-json-window15m-chunk24h-mst-th1",
    ],
    ["live", `controller-trend:${scopeKey}`],
    () =>
      fetchControllerTrendRowsChunked(
        accessToken,
        params.farmKey,
        aligned.fromMs,
        aligned.toMs,
        "15 minutes",
      ),
  );

  return compactFromControllerRows(
    rows,
    period,
    aligned.fromMs,
    bucketCount,
    strideMs,
  );
}
