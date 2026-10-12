/**
 * 추이 차트 — 통신두절 / 희소 / 없음(폐기) 구분.
 * 샘플(decoded)은 측정 시각, 업링크 유무는 수신 시각 버킷.
 */

import type { TrendControllerSeries } from "@/lib/domain/farm-trend-types";

export type UplinkSlotKind = "sample" | "sparse" | "offline" | "void";

export type UplinkCoverageBandKind = Exclude<UplinkSlotKind, "sample">;

export type UplinkCoverageBand = {
  kind: UplinkCoverageBandKind;
  i0: number;
  i1: number;
  label: string;
};

export type UplinkCoverageFlags = {
  validLive: boolean;
  anyRaw: boolean;
};

export type UplinkCoverageRpcRow = {
  bucket_at: string;
  controller_key: string;
  valid_live: boolean | number | string;
  any_raw: boolean | number | string;
};

export type UplinkCoverageIndex = {
  fromMs: number;
  toMs: number;
  strideMs: number;
  bucketCount: number;
  byController: Map<string, UplinkCoverageFlags[]>;
};

/** Server action JSON — Map은 직렬화되지 않음. */
export type UplinkCoverageWire = {
  fromMs: number;
  toMs: number;
  strideMs: number;
  bucketCount: number;
  controllers: Array<[string, UplinkCoverageFlags[]]>;
};

export function coverageIndexToWire(
  index: UplinkCoverageIndex,
): UplinkCoverageWire {
  return {
    fromMs: index.fromMs,
    toMs: index.toMs,
    strideMs: index.strideMs,
    bucketCount: index.bucketCount,
    controllers: [...index.byController.entries()],
  };
}

export function coverageIndexFromWire(
  wire: UplinkCoverageWire | null | undefined,
): UplinkCoverageIndex | null {
  if (!wire || !Number.isFinite(wire.fromMs) || wire.bucketCount < 1) {
    return null;
  }
  return {
    fromMs: wire.fromMs,
    toMs: wire.toMs,
    strideMs: wire.strideMs,
    bucketCount: wire.bucketCount,
    byController: new Map(wire.controllers ?? []),
  };
}

const HOLD_BREAK: ReadonlySet<UplinkSlotKind> = new Set(["offline", "void"]);

export function asBool(v: boolean | number | string | null | undefined): boolean {
  if (v === true || v === 1 || v === "1" || v === "t" || v === "true") return true;
  return false;
}

export function classifyUplinkSlot(args: {
  hasSample: boolean;
  validLive: boolean;
  anyRaw: boolean;
}): UplinkSlotKind {
  if (args.hasSample) return "sample";
  if (args.validLive) return "sparse";
  if (args.anyRaw) return "void";
  return "offline";
}

/** 농장·범위 집계 — 샘플 > 희소 > 없음 > 통신두절 */
export function mergeUplinkKinds(kinds: UplinkSlotKind[]): UplinkSlotKind {
  let sawSparse = false;
  let sawVoid = false;
  for (const k of kinds) {
    if (k === "sample") return "sample";
    if (k === "sparse") sawSparse = true;
    else if (k === "void") sawVoid = true;
  }
  if (sawSparse) return "sparse";
  if (sawVoid) return "void";
  return "offline";
}

/**
 * 희소 구간에만 직전 절대값을 유지.
 * 통신두절·없음에서 체인을 끊는다. 한 번도 값이 없으면 채우지 않는다.
 */
export function holdValuesAcrossSparse(
  values: (number | null)[],
  kinds: UplinkSlotKind[],
): (number | null)[] {
  const n = Math.min(values.length, kinds.length);
  const out = values.slice();
  let last: number | null = null;
  let armed = false;
  for (let i = 0; i < n; i++) {
    const kind = kinds[i] ?? "offline";
    const v = out[i];
    if (v != null && Number.isFinite(v)) {
      last = v;
      armed = true;
      continue;
    }
    if (kind === "sparse" && armed && last != null) {
      out[i] = last;
      continue;
    }
    if (HOLD_BREAK.has(kind)) {
      last = null;
      armed = false;
    }
  }
  return out;
}

export function slotFromBucketAt(
  bucketAtIso: string,
  fromMs: number,
  strideMs: number,
  bucketCount: number,
): number | null {
  const ms = Date.parse(bucketAtIso);
  if (!Number.isFinite(ms) || strideMs <= 0) return null;
  const slot = Math.round((ms - fromMs) / strideMs);
  if (slot < 0 || slot >= bucketCount) return null;
  return slot;
}

export function buildUplinkCoverageIndex(
  rows: UplinkCoverageRpcRow[],
  fromMs: number,
  bucketCount: number,
  strideMs: number,
): UplinkCoverageIndex {
  const byController = new Map<string, UplinkCoverageFlags[]>();
  const emptyFlags = (): UplinkCoverageFlags[] =>
    Array.from({ length: bucketCount }, () => ({
      validLive: false,
      anyRaw: false,
    }));

  for (const row of rows) {
    const key = (row.controller_key ?? "").trim();
    if (!key) continue;
    const slot = slotFromBucketAt(row.bucket_at, fromMs, strideMs, bucketCount);
    if (slot == null) continue;
    let flags = byController.get(key);
    if (!flags) {
      flags = emptyFlags();
      byController.set(key, flags);
    }
    const cur = flags[slot]!;
    cur.anyRaw = cur.anyRaw || asBool(row.any_raw);
    cur.validLive = cur.validLive || asBool(row.valid_live);
  }

  return {
    fromMs,
    toMs: fromMs + bucketCount * strideMs,
    strideMs,
    bucketCount,
    byController,
  };
}

export function lookupCoverageFlags(
  index: UplinkCoverageIndex | null | undefined,
  controllerKey: string,
  bucketAtIso: string,
): UplinkCoverageFlags {
  const empty = { validLive: false, anyRaw: false };
  if (!index) return empty;
  const slot = slotFromBucketAt(
    bucketAtIso,
    index.fromMs,
    index.strideMs,
    index.bucketCount,
  );
  if (slot == null) return empty;
  return index.byController.get(controllerKey)?.[slot] ?? empty;
}

export function pickUplinkCoverageIndex(
  indexes: UplinkCoverageIndex[],
  fromMs: number,
  strideMs: number,
): UplinkCoverageIndex | null {
  if (!indexes.length) return null;
  const strideHit = indexes.filter(
    (idx) => Math.abs(idx.strideMs - strideMs) < 1000,
  );
  if (!strideHit.length) return null;
  let best: UplinkCoverageIndex | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const idx of strideHit) {
    if (fromMs < idx.fromMs - 1000 || fromMs >= idx.toMs + 1000) continue;
    const dist = Math.abs(idx.fromMs - fromMs);
    if (dist < bestDist) {
      best = idx;
      bestDist = dist;
    }
  }
  return best ?? strideHit[0] ?? null;
}

export function kindsForControllerSeries(args: {
  sampleCount: number[];
  temp: (number | null)[];
  controllerKey: string;
  bucketAts: string[];
  coverage: UplinkCoverageIndex | null;
}): UplinkSlotKind[] {
  const { sampleCount, temp, controllerKey, bucketAts, coverage } = args;
  const n = bucketAts.length;
  const kinds: UplinkSlotKind[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const hasSample =
      (sampleCount[i] ?? 0) > 0 ||
      (temp[i] != null && Number.isFinite(temp[i]));
    const flags = lookupCoverageFlags(
      coverage,
      controllerKey,
      bucketAts[i] ?? "",
    );
    kinds[i] = classifyUplinkSlot({
      hasSample,
      validLive: flags.validLive,
      anyRaw: flags.anyRaw,
    });
  }
  return kinds;
}

export function mergeKindsFromSeries(
  kindsList: UplinkSlotKind[][],
  len: number,
): UplinkSlotKind[] {
  const out: UplinkSlotKind[] = new Array(len);
  for (let i = 0; i < len; i++) {
    const slot: UplinkSlotKind[] = [];
    for (const kinds of kindsList) {
      const k = kinds[i];
      if (k) slot.push(k);
    }
    out[i] = mergeUplinkKinds(slot);
  }
  return out;
}

const BAND_LABEL: Record<UplinkCoverageBandKind, string> = {
  sparse: "희소",
  offline: "통신두절",
  void: "없음",
};

export function formatCoverageRangeLabel(
  kind: UplinkCoverageBandKind,
  startLabel: string,
  endLabel: string,
): string {
  const name = BAND_LABEL[kind];
  const a = startLabel.trim();
  const b = endLabel.trim();
  if (!a) return name;
  if (!b || a === b) return `${name} ${a}`;
  return `${name} ${a}–${b}`;
}

export function applyUplinkCoverageToSeries(
  series: TrendControllerSeries,
  coverage: UplinkCoverageIndex | null,
  bucketAts: string[],
): TrendControllerSeries {
  if (!coverage || coverage.byController.size === 0 || bucketAts.length < 1) {
    return series;
  }
  const kinds = kindsForControllerSeries({
    sampleCount: series.sampleCount,
    temp: series.temp,
    controllerKey: series.controllerKey,
    bucketAts,
    coverage,
  });
  return {
    ...series,
    uplinkKind: kinds,
    temp: holdValuesAcrossSparse(series.temp, kinds),
    humidity: holdValuesAcrossSparse(series.humidity, kinds),
    fanSupply: holdValuesAcrossSparse(series.fanSupply, kinds),
    fanExhaust: holdValuesAcrossSparse(series.fanExhaust, kinds),
    fanIntake: holdValuesAcrossSparse(series.fanIntake, kinds),
  };
}

export function collapseUplinkBands(
  kinds: UplinkSlotKind[],
  labels: string[],
): UplinkCoverageBand[] {
  const bands: UplinkCoverageBand[] = [];
  let start: number | null = null;
  let startKind: UplinkCoverageBandKind | null = null;
  const flush = (end: number) => {
    if (start == null || startKind == null) return;
    bands.push({
      kind: startKind,
      i0: start,
      i1: end,
      label: formatCoverageRangeLabel(
        startKind,
        labels[start] ?? "",
        labels[end] ?? "",
      ),
    });
    start = null;
    startKind = null;
  };
  for (let i = 0; i < kinds.length; i++) {
    const k = kinds[i] ?? "offline";
    if (k === "sample") {
      flush(i - 1);
      continue;
    }
    if (start != null && startKind === k) continue;
    flush(i - 1);
    start = i;
    startKind = k;
  }
  flush(kinds.length - 1);
  return bands;
}
