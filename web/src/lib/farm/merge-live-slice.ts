import { farmKeyId } from "@/lib/data/farm-key";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import type { ChannelReading } from "@/lib/data/iot-channel";

function sameNum(
  a: number | null | undefined,
  b: number | null | undefined,
): boolean {
  return a === b || (a == null && b == null);
}

function sameSeries(a: number[] | undefined, b: number[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function sameNullableSeries(
  a: (number | null)[] | undefined,
  b: (number | null)[] | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!sameNum(a[i], b[i])) return false;
  }
  return true;
}

function sameChannel(a: ChannelReading, b: ChannelReading): boolean {
  return (
    a.channel === b.channel &&
    a.eqpmnCode === b.eqpmnCode &&
    sameNum(a.tempC, b.tempC) &&
    sameNum(a.humidityPct, b.humidityPct) &&
    sameNum(a.fanPct, b.fanPct) &&
    sameSeries(a.fanSeries, b.fanSeries)
  );
}

function sameChannels(
  a: ChannelReading[] | undefined,
  b: ChannelReading[] | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (!left || !right || !sameChannel(left, right)) return false;
  }
  return true;
}

/**
 * 조회 실패·토큰 공백은 예외 없이 빈 배열로 온다.
 * 카드가 이미 있으면 그 응답으로 목록을 비우지 않는다.
 */
export function retainLiveList<T>(prev: T[], next: T[]): T[] {
  if (next.length === 0 && prev.length > 0) return prev;
  return next;
}

/** LIVE soft refresh — 측정값이 같으면 이전 객체 참조 유지 (카드 remount/레이아웃 흔들림 완화). */
export function liveReadingUnchanged(
  prev: BarnReading,
  next: BarnReading,
): boolean {
  return (
    prev.key === next.key &&
    prev.status === next.status &&
    prev.receivedAt === next.receivedAt &&
    prev.mesureDt === next.mesureDt &&
    sameNum(prev.alarmLowTempC, next.alarmLowTempC) &&
    sameNum(prev.alarmHighTempC, next.alarmHighTempC) &&
    sameNum(prev.tempC, next.tempC) &&
    sameNum(prev.humidityPct, next.humidityPct) &&
    sameNum(prev.fanSupply, next.fanSupply) &&
    sameNum(prev.fanExhaust, next.fanExhaust) &&
    sameNum(prev.fanIntake, next.fanIntake) &&
    sameSeries(prev.fanSupplySeries, next.fanSupplySeries) &&
    sameSeries(prev.fanExhaustSeries, next.fanExhaustSeries) &&
    sameSeries(prev.fanIntakeSeries, next.fanIntakeSeries) &&
    sameNullableSeries(prev.tempsC, next.tempsC) &&
    sameChannels(prev.channels, next.channels) &&
    sameNum(prev.runMode, next.runMode)
  );
}

export function mergeLiveReadings(
  prev: BarnReading[],
  next: BarnReading[],
): BarnReading[] {
  if (prev === next) return prev;
  if (prev.length === 0) return next;
  if (next.length === 0) return prev;

  const prevByKey = new Map(prev.map((r) => [r.key, r]));
  let reusedAll = prev.length === next.length;
  const merged = next.map((n, i) => {
    const p = prevByKey.get(n.key);
    // soft slim list-tier — channels 생략 시 이전 channels 유지 (bulk thermo)
    const candidate =
      p?.channels?.length && !n.channels?.length
        ? { ...n, channels: p.channels }
        : n;
    if (p && liveReadingUnchanged(p, candidate)) {
      if (prev[i] !== p) reusedAll = false;
      return p;
    }
    reusedAll = false;
    return candidate;
  });

  if (reusedAll && merged.every((r, i) => r === prev[i])) return prev;
  return merged;
}

function barnSnapshotKey(s: BarnMapSnapshot): string {
  return `${farmKeyId(s.meta.farmKey)}|${s.meta.stallNo}|${s.meta.id}`;
}

function liveSnapshotUnchanged(
  prev: BarnMapSnapshot,
  next: BarnMapSnapshot,
): boolean {
  return (
    barnSnapshotKey(prev) === barnSnapshotKey(next) &&
    prev.status === next.status &&
    prev.receivedAt === next.receivedAt &&
    prev.controllerCount === next.controllerCount &&
    prev.stallCount === next.stallCount &&
    sameNum(prev.tempC, next.tempC) &&
    sameNum(prev.humidityPct, next.humidityPct) &&
    sameNum(prev.fanSupply, next.fanSupply) &&
    sameNum(prev.fanExhaust, next.fanExhaust) &&
    sameNum(prev.fanIntake, next.fanIntake)
  );
}

export function mergeLiveBarnSnapshots(
  prev: BarnMapSnapshot[],
  next: BarnMapSnapshot[],
): BarnMapSnapshot[] {
  if (prev === next) return prev;
  if (prev.length === 0) return next;
  if (next.length === 0) return prev;

  const prevByKey = new Map(prev.map((s) => [barnSnapshotKey(s), s]));
  let reusedAll = prev.length === next.length;
  const merged = next.map((n, i) => {
    const key = barnSnapshotKey(n);
    const p = prevByKey.get(key);
    if (p && liveSnapshotUnchanged(p, n)) {
      if (prev[i] !== p) reusedAll = false;
      return p;
    }
    reusedAll = false;
    return n;
  });

  if (reusedAll && merged.every((s, i) => s === prev[i])) return prev;
  return merged;
}
