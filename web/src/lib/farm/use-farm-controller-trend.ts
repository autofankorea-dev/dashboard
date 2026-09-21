"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  fetchFarmControllerTrend30dDayAction,
  fetchFarmControllerTrendPeriodAction,
  fetchFarmControllerTrendWindowAction,
} from "@/app/(dashboard)/farm/actions";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import {
  expandCompactControllerPeriod,
  overlayCompactControllerPeriod,
  seedCompact30dFrom24h,
  type CompactControllerPeriod,
} from "@/lib/data/farm-trend-compact";
import {
  emptyTrendControllerPeriodData,
  isCompleteControllerTrendBundle,
  isFarmTrendLoadComplete,
  TREND_30D_DAY_CHUNKS,
  TREND_30D_DAY_CONCURRENCY,
  TREND_PERIODS,
  controllerTrendPeriodHasSeries,
  type TrendControllerPeriodData,
  type TrendPeriodId,
  type TrendWindow15m,
} from "@/lib/data/farm-trend-types";
import {
  sliceControllerTrendByTime,
  sliceControllerTrendFromLonger,
} from "@/lib/data/trend-period-slice";
import {
  alignTrendWindow15m,
  window15mCovers,
} from "@/lib/farm/trend-brush-coverage";
import {
  invalidateTimedCache,
  readTimedCache,
  writeTimedCache,
  type TimedCacheEntry,
} from "@/lib/farm/client-trend-cache";
import { startSharedInflight } from "@/lib/farm/shared-inflight";
import { runOrderedPool } from "@/lib/farm/trend-day-pool";
import { useDeferredLoading } from "@/lib/ui/use-deferred-loading";

type TrendBundle = Record<TrendPeriodId, TrendControllerPeriodData>;

type TrendSnapshot = {
  bundle: TrendBundle;
  window15m: TrendWindow15m | null;
  /** 30일 1시간 축에서 최신부터 스캔한 하루 수. 시드만이면 0. */
  d30DaysScanned: number;
  compact30d: CompactControllerPeriod | null;
};

const emptySubscribe = () => () => {};

/** map/list 훅 인스턴스 간 공유 — 탭 전환 시 이중 fetch 방지 · TTL 90s */
const trendCache = new Map<string, TimedCacheEntry<TrendSnapshot>>();
const trendInflight = new Map<string, Promise<TrendSnapshot>>();
const trendRefreshInflight = new Map<string, Promise<TrendSnapshot>>();
const trend30Inflight = new Map<string, Promise<TrendSnapshot>>();
const trendWindowInflight = new Map<string, Promise<TrendSnapshot>>();
const trendListeners = new Map<string, Set<(snap: TrendSnapshot) => void>>();

export function peekFarmControllerTrendCache(
  farmKey: FarmKey,
): TrendBundle | null {
  return readTimedCache(trendCache, farmKeyId(farmKey))?.bundle ?? null;
}

export function invalidateFarmControllerTrendCache(farmKey: FarmKey): void {
  invalidateTimedCache(trendCache, farmKeyId(farmKey));
}

function readTrendCache(scopeId: string): TrendSnapshot | null {
  return readTimedCache(trendCache, scopeId);
}

function emptyBundle(): TrendBundle {
  return {
    "24h": emptyTrendControllerPeriodData("24h"),
    "7d": emptyTrendControllerPeriodData("7d"),
    "30d": emptyTrendControllerPeriodData("30d"),
  };
}

function emptySnapshot(): TrendSnapshot {
  return {
    bundle: emptyBundle(),
    window15m: null,
    d30DaysScanned: 0,
    compact30d: null,
  };
}

function scannedDays(snap: TrendSnapshot): number {
  if (typeof snap.d30DaysScanned === "number") return snap.d30DaysScanned;
  return isCompleteControllerTrendBundle(snap.bundle) ? TREND_30D_DAY_CHUNKS : 0;
}

function notifyTrend(scopeId: string, snap: TrendSnapshot): void {
  writeTimedCache(trendCache, scopeId, snap);
  const listeners = trendListeners.get(scopeId);
  if (!listeners) return;
  for (const cb of listeners) cb(snap);
}

export function subscribeFarmControllerTrend(
  scopeId: string,
  cb: (bundle: TrendBundle) => void,
): () => void {
  const wrapped = (snap: TrendSnapshot) => cb(snap.bundle);
  let set = trendListeners.get(scopeId);
  if (!set) {
    set = new Set();
    trendListeners.set(scopeId, set);
  }
  set.add(wrapped);
  return () => {
    set!.delete(wrapped);
    if (set!.size === 0) trendListeners.delete(scopeId);
  };
}

function subscribeTrendSnapshot(
  scopeId: string,
  cb: (snap: TrendSnapshot) => void,
): () => void {
  let set = trendListeners.get(scopeId);
  if (!set) {
    set = new Set();
    trendListeners.set(scopeId, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) trendListeners.delete(scopeId);
  };
}

function snapshotFrom30d(
  h24: TrendControllerPeriodData,
  compact30d: CompactControllerPeriod,
  window15m: TrendWindow15m | null,
  d30DaysScanned: number,
): TrendSnapshot {
  const d30 = expandCompactControllerPeriod(compact30d);
  const d7Slice = sliceControllerTrendFromLonger(d30, "7d");
  return {
    bundle: {
      "24h": h24,
      "7d":
        d7Slice && d7Slice.totalSamples > 0
          ? d7Slice
          : emptyTrendControllerPeriodData("7d"),
      "30d": d30,
    },
    window15m,
    d30DaysScanned,
    compact30d,
  };
}

async function loadProgressiveBundle(
  farmKey: FarmKey,
  refresh: boolean,
  extend30d: boolean,
): Promise<TrendSnapshot> {
  const scopeId = farmKeyId(farmKey);
  const prev = refresh ? emptySnapshot() : (readTrendCache(scopeId) ?? emptySnapshot());
  const d30Cfg = TREND_PERIODS["30d"];
  const dayMs = TREND_PERIODS["24h"].durationMs;

  let h24 = prev.bundle["24h"];
  let axisFromMs: number;
  let axisToMs: number;
  let compact30d: CompactControllerPeriod;
  let startDay = 0;

  const resumable =
    !refresh &&
    controllerTrendPeriodHasSeries(h24) &&
    prev.compact30d != null &&
    prev.compact30d.bucketCount === d30Cfg.bucketCount &&
    scannedDays(prev) < TREND_30D_DAY_CHUNKS;

  if (resumable && prev.compact30d) {
    compact30d = prev.compact30d;
    axisFromMs = compact30d.fromMs;
    axisToMs = axisFromMs + d30Cfg.durationMs;
    startDay = scannedDays(prev);
  } else {
    const compact24 = await fetchFarmControllerTrendPeriodAction(farmKey, "24h");
    h24 = expandCompactControllerPeriod(compact24);
    axisToMs = compact24.fromMs + TREND_PERIODS["24h"].durationMs;
    axisFromMs = axisToMs - d30Cfg.durationMs;
    compact30d = seedCompact30dFrom24h(compact24, axisFromMs);
    startDay = 0;
  }

  let snap = snapshotFrom30d(h24, compact30d, prev.window15m, startDay);
  notifyTrend(scopeId, snap);

  if (!extend30d || startDay >= TREND_30D_DAY_CHUNKS) {
    return snap;
  }

  try {
    await runOrderedPool({
      start: startDay,
      end: TREND_30D_DAY_CHUNKS,
      concurrency: TREND_30D_DAY_CONCURRENCY,
      fetchOne: (day) => {
        const scanToMs = axisToMs - day * dayMs;
        const scanFromMs = Math.max(axisFromMs, scanToMs - dayMs);
        return fetchFarmControllerTrend30dDayAction(
          farmKey,
          axisToMs,
          scanFromMs,
          scanToMs,
        );
      },
      onApply: (day, part) => {
        if (part) {
          compact30d = overlayCompactControllerPeriod(compact30d, part);
        }
        snap = snapshotFrom30d(h24, compact30d, snap.window15m, day + 1);
        notifyTrend(scopeId, snap);
      },
    });
  } catch {
    notifyTrend(scopeId, snap);
  }

  return snap;
}

function periodTimeRange(
  data: TrendControllerPeriodData | null | undefined,
): { fromMs: number; toMs: number } | null {
  if (!data || data.bucketAts.length < 1) return null;
  const first = Date.parse(data.bucketAts[0] ?? "");
  const last = Date.parse(data.bucketAts[data.bucketAts.length - 1] ?? "");
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
  const stride =
    data.bucketAts.length > 1
      ? Math.max(1, (last - first) / (data.bucketAts.length - 1))
      : 15 * 60 * 1000;
  return { fromMs: first, toMs: last + stride };
}

function windowFrom24h(
  h24: TrendControllerPeriodData,
  fromMs: number,
  toMs: number,
): TrendWindow15m | null {
  const cover = periodTimeRange(h24);
  if (!cover || !window15mCovers(cover, fromMs, toMs)) return null;
  const data = sliceControllerTrendByTime(h24, fromMs, toMs);
  if (!data || data.categories.length < 2) return null;
  return { fromMs, toMs, data };
}

async function loadWindow15m(
  farmKey: FarmKey,
  fromMs: number,
  toMs: number,
): Promise<TrendSnapshot> {
  const scopeId = farmKeyId(farmKey);
  const prev = readTrendCache(scopeId) ?? emptySnapshot();
  if (window15mCovers(prev.window15m, fromMs, toMs)) return prev;

  const local = windowFrom24h(prev.bundle["24h"], fromMs, toMs);
  if (local) {
    const snap = { ...prev, window15m: local };
    notifyTrend(scopeId, snap);
    return snap;
  }

  try {
    const compact = await fetchFarmControllerTrendWindowAction(
      farmKey,
      fromMs,
      toMs,
    );
    const data = expandCompactControllerPeriod(compact);
    const snap: TrendSnapshot = {
      ...prev,
      window15m: { fromMs, toMs, data },
    };
    notifyTrend(scopeId, snap);
    return snap;
  } catch {
    return prev;
  }
}

function fetchTrendShared(
  farmKey: FarmKey,
  scopeId: string,
  refresh: boolean,
  extend30d = false,
): Promise<TrendSnapshot> {
  if (!refresh) {
    const cached = readTrendCache(scopeId);
    if (extend30d) {
      if (cached && isFarmTrendLoadComplete(cached.bundle, scannedDays(cached))) {
        return Promise.resolve(cached);
      }
    } else if (
      cached &&
      controllerTrendPeriodHasSeries(cached.bundle["24h"])
    ) {
      return Promise.resolve(cached);
    }
  }

  if (refresh) {
    return startSharedInflight(trendRefreshInflight, scopeId, () =>
      loadProgressiveBundle(farmKey, true, extend30d),
    );
  }

  const p24 = startSharedInflight(trendInflight, scopeId, () =>
    loadProgressiveBundle(farmKey, false, false),
  );
  if (!extend30d) return p24;

  return startSharedInflight(trend30Inflight, scopeId, async () => {
    await p24;
    const cached = readTrendCache(scopeId);
    if (cached && isFarmTrendLoadComplete(cached.bundle, scannedDays(cached))) {
      return cached;
    }
    return loadProgressiveBundle(farmKey, false, true);
  });
}

function fetchWindow15mShared(
  farmKey: FarmKey,
  fromMs: number,
  toMs: number,
): Promise<TrendSnapshot> {
  const scopeId = farmKeyId(farmKey);
  const cached = readTrendCache(scopeId);
  if (window15mCovers(cached?.window15m, fromMs, toMs)) {
    return Promise.resolve(cached!);
  }
  const local = cached ? windowFrom24h(cached.bundle["24h"], fromMs, toMs) : null;
  if (local && cached) {
    const snap = { ...cached, window15m: local };
    notifyTrend(scopeId, snap);
    return Promise.resolve(snap);
  }
  const key = `${scopeId}:${fromMs}:${toMs}`;
  return startSharedInflight(trendWindowInflight, key, () =>
    loadWindow15m(farmKey, fromMs, toMs),
  );
}

/** 로그인·필드 — 24시간만. 30일은 차트 탭 또는 idle `extend30d`. */
export function prefetchFarmControllerTrend(
  farmKey: FarmKey,
  opts?: { extend30d?: boolean },
): Promise<TrendBundle> {
  return fetchTrendShared(
    farmKey,
    farmKeyId(farmKey),
    false,
    opts?.extend30d ?? false,
  ).then((snap) => snap.bundle);
}

export function useFarmControllerTrend(params: {
  farmKey: FarmKey | null;
  enabled: boolean;
  /** 30일 하루 조각. 차트 탭·idle. 필드는 24시간만. */
  extend30d?: boolean;
}) {
  const extend30d = Boolean(params.extend30d);
  const scopeId = params.farmKey ? farmKeyId(params.farmKey) : "";
  const active = params.enabled && Boolean(params.farmKey);
  const applyTokenRef = useRef(0);
  /** 모듈 캐시는 클라이언트 전용 — 첫 페인트에서 읽으면 SSR 빈 차트와 hydration 불일치 */
  const clientReady = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [snap, setSnap] = useState<{
    scopeId: string;
    data: TrendSnapshot;
  } | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [window15mLoading, setWindow15mLoading] = useState(false);

  if (clientReady && active && scopeId) {
    const cached = readTrendCache(scopeId);
    if (cached && snap?.scopeId !== scopeId) {
      setSnap({ scopeId, data: cached });
      if (error) setError(false);
    }
  }

  useEffect(() => {
    if (!active || !params.farmKey) return;
    const token = ++applyTokenRef.current;
    const unsub = subscribeTrendSnapshot(scopeId, (data) => {
      if (token !== applyTokenRef.current) return;
      setSnap({ scopeId, data });
      setError(false);
    });
    const cached = readTrendCache(scopeId);
    const needFetch = extend30d
      ? !isFarmTrendLoadComplete(
          cached?.bundle,
          cached ? scannedDays(cached) : 0,
        )
      : !controllerTrendPeriodHasSeries(cached?.bundle["24h"]);
    if (needFetch) {
      void fetchTrendShared(params.farmKey, scopeId, false, extend30d).catch(() => {
        if (token !== applyTokenRef.current) return;
        setError(true);
      });
    }
    return () => {
      unsub();
      applyTokenRef.current += 1;
    };
  }, [active, scopeId, params.farmKey, extend30d]);

  const ensureWindow15m = useCallback(
    (fromMs: number, toMs: number) => {
      if (!params.farmKey) return Promise.resolve();
      const aligned = alignTrendWindow15m(fromMs, toMs);
      const cached = readTrendCache(scopeId);
      if (window15mCovers(cached?.window15m, aligned.fromMs, aligned.toMs)) {
        return Promise.resolve();
      }
      const token = applyTokenRef.current;
      setWindow15mLoading(true);
      return fetchWindow15mShared(
        params.farmKey,
        aligned.fromMs,
        aligned.toMs,
      )
        .then((result) => {
          if (token !== applyTokenRef.current) return;
          setSnap({ scopeId, data: result });
        })
        .catch(() => {
          if (token !== applyTokenRef.current) return;
          setError(true);
        })
        .finally(() => {
          if (token === applyTokenRef.current) setWindow15mLoading(false);
        });
    },
    [params.farmKey, scopeId, setWindow15mLoading, setSnap, setError],
  );

  const refresh = useCallback(() => {
    if (!params.farmKey) return Promise.resolve();
    const token = ++applyTokenRef.current;
    setRefreshing(true);
    return fetchTrendShared(params.farmKey, scopeId, true, extend30d)
      .then((result) => {
        if (token !== applyTokenRef.current) return;
        setSnap({ scopeId, data: result });
        setError(false);
      })
      .catch(() => {
        if (token !== applyTokenRef.current) return;
        setError(true);
      })
      .finally(() => {
        if (token === applyTokenRef.current) setRefreshing(false);
      });
  }, [params.farmKey, scopeId, extend30d, setRefreshing, setSnap, setError]);

  const data = snap?.scopeId === scopeId ? snap.data.bundle : null;
  const window15m =
    snap?.scopeId === scopeId ? snap.data.window15m : null;
  const initialPending = active && data === null && !error;
  /** 초기 빈 화면은 지연 없이 '불러오는 중' — 지연하면 '데이터 없음'으로 오인됨 */
  const showRefreshing = useDeferredLoading(refreshing);
  const isStale = refreshing && data !== null;
  const extending =
    active &&
    Boolean(data) &&
    !isFarmTrendLoadComplete(
      data,
      snap?.scopeId === scopeId ? scannedDays(snap.data) : 0,
    ) &&
    !error;

  return {
    data,
    window15m,
    loading: initialPending,
    extending,
    window15mLoading,
    refreshing: showRefreshing,
    isStale,
    error: active && error,
    refresh,
    ensureWindow15m,
  };
}
