/** Absolute sparse gate for decode-batch (no delta chains). */

export type SparseMetrics = {
  temp_c: number | null;
  fan_exhaust_pct: number | null;
  fan_intake_pct: number | null;
  error_code_raw?: number | null;
};

export type SparseLast = SparseMetrics & { updated_at: string };

function changed(
  a: number | null,
  b: number | null,
  eps: number,
): boolean {
  if (a == null && b == null) return false;
  if (a == null || b == null) return true;
  return Math.abs(a - b) > eps;
}

/** true = write decoded row; false = skip (raw already stored). */
export function shouldWriteSparse(args: {
  last: SparseLast | null;
  next: SparseMetrics;
  nowMs: number;
  epsTemp: number;
  epsFan: number;
  heartbeatSec: number;
}): boolean {
  if (!args.last) return true;
  if (args.next.error_code_raw !== args.last.error_code_raw) return true;
  const lastMs = Date.parse(String(args.last.updated_at));
  const ageSec = (args.nowMs - lastMs) / 1000;
  if (!Number.isFinite(ageSec) || ageSec >= args.heartbeatSec) return true;
  if (changed(args.next.temp_c, args.last.temp_c, args.epsTemp)) return true;
  if (
    changed(args.next.fan_exhaust_pct, args.last.fan_exhaust_pct, args.epsFan)
  ) {
    return true;
  }
  if (
    changed(args.next.fan_intake_pct, args.last.fan_intake_pct, args.epsFan)
  ) {
    return true;
  }
  return false;
}

export function farmKey(lsind: string, item: string): string {
  return `${lsind}/${item}`;
}

export function sparseAppliesToFarm(
  farmKeys: string[] | null | undefined,
  lsind: string,
  item: string,
): boolean {
  if (!farmKeys || farmKeys.length === 0) return true;
  return farmKeys.includes(farmKey(lsind, item));
}
