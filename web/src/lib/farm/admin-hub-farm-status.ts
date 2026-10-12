import { compareFarmKey, farmKeyId, type FarmKey } from "@/lib/domain/farm-key";
import type { FarmLocationRow } from "@/lib/domain/farm-location-shared";
import type { FarmSummaryRow } from "@/lib/domain/farm-summaries";
import { isValidMapCoord } from "@/lib/geo/map-coords";

export type AdminHubFarmTone = "alert" | "offline" | "live" | "location";

export type AdminHubFarmRow = {
  farmKey: FarmKey;
  summary: FarmSummaryRow | null;
  location: FarmLocationRow | null;
  tone: AdminHubFarmTone;
};

export function resolveAdminHubFarmTone(
  summary: FarmSummaryRow | null,
): AdminHubFarmTone {
  if (summary && (summary.criticalCount > 0 || summary.alarmCount > 0)) {
    return "alert";
  }
  if (summary && summary.controllerCount > 0) {
    if (summary.offlineCount >= summary.controllerCount) return "offline";
    return "live";
  }
  return "location";
}

export function collectAdminHubFarmRows(
  farmOptions: FarmKey[],
  summaries: FarmSummaryRow[],
  locations: FarmLocationRow[],
): AdminHubFarmRow[] {
  const summaryById = new Map(
    summaries.map((row) => [farmKeyId(row.farmKey), row] as const),
  );
  const locationById = new Map(
    locations.map((row) => [farmKeyId(row.farmKey), row] as const),
  );
  const keys = new Map<string, FarmKey>();
  for (const fk of farmOptions) keys.set(farmKeyId(fk), fk);
  for (const row of summaries) keys.set(farmKeyId(row.farmKey), row.farmKey);
  for (const row of locations) keys.set(farmKeyId(row.farmKey), row.farmKey);

  return [...keys.values()]
    .sort(compareFarmKey)
    .map((farmKey) => {
      const summary = summaryById.get(farmKeyId(farmKey)) ?? null;
      const location = locationById.get(farmKeyId(farmKey)) ?? null;
      return {
        farmKey,
        summary,
        location,
        tone: resolveAdminHubFarmTone(summary),
      };
    });
}

export function hubFarmHasMapPin(row: AdminHubFarmRow): boolean {
  const loc = row.location;
  return loc != null && isValidMapCoord(loc.lat, loc.lng);
}

export function summarizeAdminHubTones(rows: AdminHubFarmRow[]) {
  const counts = { live: 0, alert: 0, offline: 0, location: 0, total: rows.length };
  for (const row of rows) counts[row.tone] += 1;
  return counts;
}

export function filterAdminHubFarmRowsByTone(
  rows: AdminHubFarmRow[],
  tone: AdminHubFarmTone | null,
): AdminHubFarmRow[] {
  if (tone == null) return rows;
  return rows.filter((row) => row.tone === tone);
}

export function hubFarmMonitorMetrics(row: AdminHubFarmRow) {
  const tempC = sanitizeHubTempC(row.summary?.avgTempC);
  const humidityPct = sanitizeHubHumidityPct(row.summary?.avgHumidityPct);
  const controllerCount = row.summary?.controllerCount ?? 0;
  const online =
    row.summary && controllerCount > 0
      ? controllerCount - row.summary.offlineCount
      : null;
  return { tempC, humidityPct, online, controllerCount };
}

/** 축사 관제 표시용. 통신 오류·스케일 오류 값은 숨긴다. */
export const HUB_TEMP_C_MIN = -10;
export const HUB_TEMP_C_MAX = 60;
export const HUB_HUMIDITY_PCT_MIN = 0;
export const HUB_HUMIDITY_PCT_MAX = 100;

export function sanitizeHubSensorValue(
  value: number | null | undefined,
  min: number,
  max: number,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

export function sanitizeHubTempC(value: number | null | undefined): number | null {
  return sanitizeHubSensorValue(value, HUB_TEMP_C_MIN, HUB_TEMP_C_MAX);
}

export function sanitizeHubHumidityPct(
  value: number | null | undefined,
): number | null {
  return sanitizeHubSensorValue(value, HUB_HUMIDITY_PCT_MIN, HUB_HUMIDITY_PCT_MAX);
}
