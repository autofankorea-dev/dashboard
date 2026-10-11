import "server-only";

import { cache } from "react";
import { farmKeysFromAccess } from "@/lib/auth/farm-access";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
  adminHubOverviewCacheKey,
  devSimFarmKeys,
  discoverAdminHubFarmKeys,
  loadAdminHubOverviewRows,
  overviewRowsToFarmKeys,
  resolveAdminHubFarmSummaries,
} from "@/lib/data/admin-hub-live";
import type { FarmOverviewDbRow } from "@/lib/data/iot-live-fetch";
import type { FarmKey } from "@/lib/domain/farm-key";
import { getFarmLocations } from "@/lib/data/farm-location";
import type { FarmLocationRow } from "@/lib/domain/farm-location-shared";
import type { FarmSummaryRow } from "@/lib/domain/farm-summaries";
import type { FarmOverview } from "@/lib/data/iot";

export type AdminHubOverviewContext = {
  overview: FarmOverview;
  farmOptions: FarmKey[];
  farmSummaries: FarmSummaryRow[];
  locations: FarmLocationRow[];
};

function overviewFromRows(overviewRows: FarmOverviewDbRow[]): FarmOverview {
  const totalControllers = overviewRows.reduce(
    (s, r) => s + r.controller_count,
    0,
  );
  const totalOffline = overviewRows.reduce(
    (s, r) => s + r.offline_count,
    0,
  );
  const temps = overviewRows
    .map((r) => (r.avg_temp_c != null ? Number(r.avg_temp_c) : null))
    .filter((n): n is number => n != null);
  const humidities = overviewRows
    .map((r) =>
      r.avg_humidity_pct != null ? Number(r.avg_humidity_pct) : null,
    )
    .filter((n): n is number => n != null);

  const avg = (nums: number[]) =>
    nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;

  return {
    farmCount: overviewRows.length,
    moduleCount: 0,
    controllerCount: totalControllers,
    connectedCount: totalControllers - totalOffline,
    expectedControllerCount: totalControllers,
    offlineCount: totalOffline,
    avgTempC: avg(temps),
    avgHumidityPct: avg(humidities),
    avgFanSupply: null,
    avgFanExhaust: null,
    avgFanIntake: null,
    receipts: [],
  };
}

function emptyHubOverview(farmCount: number): FarmOverview {
  return {
    farmCount,
    moduleCount: 0,
    controllerCount: 0,
    connectedCount: 0,
    expectedControllerCount: 0,
    offlineCount: 0,
    avgTempC: null,
    avgHumidityPct: null,
    avgFanSupply: null,
    avgFanExhaust: null,
    avgFanIntake: null,
    receipts: [],
  };
}

/**
 * Admin 전국 허브 — overview·summaries.
 * overview는 farm-overview-batch 캐시(60s) + 1회 OR 조회로 TTFB 단축.
 */
export const getAdminHubOverviewContext = cache(
  async (): Promise<AdminHubOverviewContext> => {
    const user = await getCurrentUser();
    const assignedKeys = user ? farmKeysFromAccess(user) : [];
    const seedKeys = discoverAdminHubFarmKeys(
      [],
      [
        ...assignedKeys,
        ...(process.env.NODE_ENV === "development" ? devSimFarmKeys() : []),
      ],
    );
    const [locations, overviewRows] = await Promise.all([
      getFarmLocations(),
      loadAdminHubOverviewRows(adminHubOverviewCacheKey(seedKeys)),
    ]);
    const hubFarmKeys = discoverAdminHubFarmKeys(locations, [
      ...assignedKeys,
      ...overviewRowsToFarmKeys(overviewRows),
      ...(process.env.NODE_ENV === "development" ? seedKeys : []),
    ]);
    const farmOptions = hubFarmKeys;
    const farmSummaries = resolveAdminHubFarmSummaries(
      [],
      [],
      overviewRows,
      [],
      hubFarmKeys,
    );
    const overview =
      overviewRows.length > 0
        ? overviewFromRows(overviewRows)
        : emptyHubOverview(hubFarmKeys.length);

    return { overview, farmOptions, farmSummaries, locations };
  },
);
