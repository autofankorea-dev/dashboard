"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchFarmTrendUplinkCoverageAction } from "@/app/(dashboard)/farm/actions";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import type {
  TrendControllerPeriodData,
  TrendWindow15m,
} from "@/lib/data/farm-trend-types";
import { TREND_PERIODS } from "@/lib/data/farm-trend-types";
import {
  readTimedCache,
  writeTimedCache,
  type TimedCacheEntry,
} from "@/lib/farm/client-trend-cache";
import { startSharedInflight } from "@/lib/farm/shared-inflight";
import {
  coverageIndexFromWire,
  type UplinkCoverageIndex,
} from "@/lib/farm/trend-uplink-coverage";

type CoverageSnap = {
  h24: UplinkCoverageIndex | null;
  d30: UplinkCoverageIndex | null;
  window: UplinkCoverageIndex | null;
};

const coverageCache = new Map<string, TimedCacheEntry<CoverageSnap>>();
const coverageInflight = new Map<string, Promise<UplinkCoverageIndex | null>>();

function emptySnap(): CoverageSnap {
  return { h24: null, d30: null, window: null };
}

function rangeOf(
  data: TrendControllerPeriodData | null | undefined,
  bucket: string,
): {
  fromMs: number;
  toMs: number;
  strideMs: number;
  bucketCount: number;
  bucket: string;
} | null {
  if (!data || data.bucketAts.length < 1) return null;
  const fromMs = Date.parse(data.bucketAts[0] ?? "");
  const last = Date.parse(data.bucketAts[data.bucketAts.length - 1] ?? "");
  if (!Number.isFinite(fromMs) || !Number.isFinite(last)) return null;
  const strideMs =
    data.bucketAts.length > 1
      ? Math.max(1, (last - fromMs) / (data.bucketAts.length - 1))
      : TREND_PERIODS["24h"].strideMs;
  return {
    fromMs,
    toMs: last + strideMs,
    strideMs,
    bucketCount: data.bucketAts.length,
    bucket,
  };
}

function windowRange(window15m: TrendWindow15m | null | undefined) {
  if (!window15m?.data) return null;
  return rangeOf(window15m.data, "15 minutes");
}

async function loadIndex(
  farmKey: FarmKey,
  range: {
    fromMs: number;
    toMs: number;
    strideMs: number;
    bucketCount: number;
    bucket: string;
  },
): Promise<UplinkCoverageIndex | null> {
  const key = `${farmKeyId(farmKey)}:${range.fromMs}:${range.toMs}:${range.bucket}:${range.bucketCount}`;
  return startSharedInflight(coverageInflight, key, async () => {
    try {
      return coverageIndexFromWire(
        await fetchFarmTrendUplinkCoverageAction(farmKey, range),
      );
    } catch {
      return null;
    }
  });
}

export function useFarmTrendUplinkCoverage(params: {
  farmKey: FarmKey | null;
  enabled: boolean;
  h24?: TrendControllerPeriodData | null;
  d30?: TrendControllerPeriodData | null;
  window15m?: TrendWindow15m | null;
}): CoverageSnap {
  const scopeId = params.farmKey ? farmKeyId(params.farmKey) : "";
  const active = params.enabled && Boolean(params.farmKey);
  const [snap, setSnap] = useState<{ scopeId: string; data: CoverageSnap }>(
    () => ({
      scopeId,
      data: scopeId
        ? (readTimedCache(coverageCache, scopeId) ?? emptySnap())
        : emptySnap(),
    }),
  );
  const tokenRef = useRef(0);

  if (active && scopeId && snap.scopeId !== scopeId) {
    setSnap({
      scopeId,
      data: readTimedCache(coverageCache, scopeId) ?? emptySnap(),
    });
  }

  const h24Range = useMemo(
    () => rangeOf(params.h24, TREND_PERIODS["24h"].bucket),
    [params.h24],
  );
  const d30Range = useMemo(
    () => rangeOf(params.d30, TREND_PERIODS["30d"].bucket),
    [params.d30],
  );
  const winRange = useMemo(
    () => windowRange(params.window15m),
    [params.window15m],
  );
  const h24From = h24Range?.fromMs ?? 0;
  const h24To = h24Range?.toMs ?? 0;
  const d30From = d30Range?.fromMs ?? 0;
  const d30To = d30Range?.toMs ?? 0;
  const winFrom = winRange?.fromMs ?? 0;
  const winTo = winRange?.toMs ?? 0;

  useEffect(() => {
    if (!active || !params.farmKey || !scopeId) return;
    const farmKey = params.farmKey;
    const token = ++tokenRef.current;
    let cancelled = false;
    const cached = readTimedCache(coverageCache, scopeId);

    void (async () => {
      const next: CoverageSnap = {
        ...(cached ?? emptySnap()),
      };
      if (h24Range) {
        next.h24 = (await loadIndex(farmKey, h24Range)) ?? next.h24;
      }
      if (cancelled || token !== tokenRef.current) return;
      setSnap({ scopeId, data: { ...next } });
      writeTimedCache(coverageCache, scopeId, next);

      if (d30Range) {
        next.d30 = (await loadIndex(farmKey, d30Range)) ?? next.d30;
      }
      if (cancelled || token !== tokenRef.current) return;
      setSnap({ scopeId, data: { ...next } });
      writeTimedCache(coverageCache, scopeId, next);

      if (winRange) {
        next.window = (await loadIndex(farmKey, winRange)) ?? next.window;
      }
      if (cancelled || token !== tokenRef.current) return;
      setSnap({ scopeId, data: { ...next } });
      writeTimedCache(coverageCache, scopeId, next);
    })();

    return () => {
      cancelled = true;
    };
    // 구간 객체 identity 대신 from/to만. 부모 추이 재렌더로 무한 refetch 방지.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- h24Range/d30Range/winRange keyed by from/to
  }, [
    active,
    params.farmKey,
    scopeId,
    h24From,
    h24To,
    d30From,
    d30To,
    winFrom,
    winTo,
  ]);

  return snap.scopeId === scopeId ? snap.data : emptySnap();
}
