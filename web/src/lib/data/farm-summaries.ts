import type { AlarmRow } from "@/lib/data/alarms";
import {
  compareFarmKey,
  farmKeyEq,
  farmKeyId,
  parseFarmKeyId,
  type FarmKey,
} from "@/lib/data/farm-key";
import type { BarnReading } from "@/lib/data/iot";
import { getItemCodeName } from "@/lib/data/item-code";
import { sensorValueForDisplay } from "@/lib/data/reading-display";

export type FarmSummaryRow = {
  farmKey: FarmKey;
  controllerCount: number;
  offlineCount: number;
  alarmCount: number;
  criticalCount: number;
  avgTempC: number | null;
  avgHumidityPct: number | null;
  latestReceivedAt: string | null;
};

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function uniqueFarmKeysFromReadings(readings: BarnReading[]): FarmKey[] {
  const map = new Map<string, FarmKey>();
  for (const reading of readings) {
    const id = farmKeyId(reading.farmKey);
    if (!map.has(id)) map.set(id, reading.farmKey);
  }
  return [...map.values()].sort(compareFarmKey);
}

export function buildFarmSummaries(
  readings: BarnReading[],
  alarms: AlarmRow[]
): FarmSummaryRow[] {
  const farmKeys = uniqueFarmKeysFromReadings(readings);

  return farmKeys.map((farmKey) => {
    const scoped = readings.filter((r) => farmKeyEq(r.farmKey, farmKey));
    const farmAlarms = alarms.filter((a) => farmKeyEq(a.farmKey, farmKey));
    const online = scoped.filter((r) => r.status !== "offline");

    const temps: number[] = [];
    const humidities: number[] = [];
    let latest: string | null = null;

    for (const reading of online) {
      const temp = sensorValueForDisplay(reading.status, reading.tempC);
      const humidity = sensorValueForDisplay(reading.status, reading.humidityPct);
      if (temp != null) temps.push(temp);
      if (humidity != null) humidities.push(humidity);
      if (!latest || new Date(reading.receivedAt) > new Date(latest)) {
        latest = reading.receivedAt;
      }
    }

    return {
      farmKey,
      controllerCount: scoped.length,
      offlineCount: scoped.filter((r) => r.status === "offline").length,
      alarmCount: farmAlarms.length,
      criticalCount: farmAlarms.filter((a) => a.severity === "critical").length,
      avgTempC: avg(temps),
      avgHumidityPct: avg(humidities),
      latestReceivedAt: latest,
    };
  });
}

export function formatReceivedAgo(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return "방금";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function farmLabel(farmKey: FarmKey): string {
  const itemName = getItemCodeName(farmKey.itemCode);
  return `${farmKey.lsindRegistNo} · ${itemName}`;
}

/** Pill·드롭다운·트리용 짧은 라벨 */
export function farmShortLabel(farmKey: FarmKey): string {
  const itemName = getItemCodeName(farmKey.itemCode);
  return `${farmKey.lsindRegistNo} · ${itemName}`;
}

/** 프로필 농장명 우선, 없으면 등록번호·축종 라벨 */
export function farmDisplayLabel(
  farmKey: FarmKey,
  farmName?: string | null,
): string {
  const n = farmName?.trim();
  return n || farmShortLabel(farmKey);
}

/** 내부 farmKeyId(lsind/itemCode) → 사용자 표시 라벨 */
export function farmShortLabelFromId(farmId: string): string {
  const fk = parseFarmKeyId(farmId);
  return fk ? farmShortLabel(fk) : farmId;
}

export function formatHumidityPct(v: number | null): string {
  return v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(1)}%`;
}

export function formatTempC(v: number | null): string {
  return v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(1)}℃`;
}

export function isFarmHealthy(farm: FarmSummaryRow): boolean {
  return farm.offlineCount === 0 && farm.alarmCount === 0;
}

export function summarizeFarmHealth(farms: FarmSummaryRow[]) {
  const healthy = farms.filter(isFarmHealthy).length;
  const issue = farms.length - healthy;
  return { healthy, issue, total: farms.length };
}
