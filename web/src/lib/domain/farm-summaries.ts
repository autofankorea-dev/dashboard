import type { AlarmRow } from "@/lib/domain/alarms";
import {
  compareFarmKey,
  farmKeyEq,
  farmKeyId,
  parseFarmKeyId,
  type FarmKey,
} from "@/lib/domain/farm-key";
import type { BarnReading } from "@/lib/domain/iot-types";
import { getItemCodeNameLocalized } from "@/lib/domain/item-code";
import type { SheetLocale } from "@/lib/ui/profile-sheet-prefs";
import { sensorValueForDisplay } from "@/lib/domain/reading-display";

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

export function formatReceivedAgo(
  iso: string | null,
  locale: SheetLocale = "ko",
): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (locale === "en") {
    if (diffMs < 60_000) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} h ago`;
    return `${days} d ago`;
  }
  if (diffMs < 60_000) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  return `${days}일 전`;
}

export function farmLabel(farmKey: FarmKey, locale: SheetLocale = "ko"): string {
  const itemName = getItemCodeNameLocalized(farmKey.itemCode, locale);
  return `${farmKey.lsindRegistNo} · ${itemName}`;
}

/** Pill·드롭다운·트리용 짧은 라벨 */
export function farmShortLabel(farmKey: FarmKey, locale: SheetLocale = "ko"): string {
  return farmLabel(farmKey, locale);
}

/** 프로필 농장명 우선, 없으면 등록번호·축종 라벨 */
export function farmDisplayLabel(
  farmKey: FarmKey,
  farmName?: string | null,
  locale: SheetLocale = "ko",
): string {
  const n = farmName?.trim();
  return n || farmShortLabel(farmKey, locale);
}

/** 내부 farmKeyId(lsind/itemCode) → 사용자 표시 라벨 */
export function farmShortLabelFromId(farmId: string, locale: SheetLocale = "ko"): string {
  const fk = parseFarmKeyId(farmId);
  return fk ? farmShortLabel(fk, locale) : farmId;
}

const SPECIES_EN: Record<string, string> = {
  한우: "Hanwoo",
  낙농: "Dairy",
  양돈: "Swine",
  양계: "Poultry",
  오리: "Duck",
  사슴: "Deer",
  곤충: "Insect",
  양봉: "Apiary",
  말: "Horse",
  "염소·양": "Goat and sheep",
};

/** 서버에서 만든 `등록번호 · 축종` 문자열의 축종만 영어로 바꾼다. */
export function localizeFarmSpeciesLabel(label: string, locale: SheetLocale): string {
  if (locale !== "en") return label;
  const mark = " · ";
  const idx = label.lastIndexOf(mark);
  if (idx < 0) return label;
  const species = label.slice(idx + mark.length);
  const en = SPECIES_EN[species];
  return en ? `${label.slice(0, idx)}${mark}${en}` : label;
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
