import "server-only";

import type { FarmKey } from "@/lib/domain/farm-key";
import { compareFarmKey } from "@/lib/domain/farm-key";
import type { FarmSummaryRow } from "@/lib/domain/farm-summaries";
import {
  fetchFarmOverviewRows,
  type FarmOverviewDbRow,
} from "@/lib/data/iot-live-fetch";

export function farmOverviewRowToFarmKey(row: FarmOverviewDbRow): FarmKey {
  return {
    lsindRegistNo: row.lsind_regist_no,
    itemCode: row.item_code,
  };
}

export function buildFarmSummariesFromOverview(
  rows: FarmOverviewDbRow[],
): FarmSummaryRow[] {
  return rows
    .map((row) => {
      const farmKey = farmOverviewRowToFarmKey(row);
      const avgTempC =
        row.avg_temp_c != null ? Number(row.avg_temp_c) : null;
      const avgHumidityPct =
        row.avg_humidity_pct != null ? Number(row.avg_humidity_pct) : null;

      return {
        farmKey,
        controllerCount: row.controller_count,
        offlineCount: row.offline_count,
        alarmCount: 0,
        criticalCount: 0,
        avgTempC: Number.isFinite(avgTempC!) ? avgTempC : null,
        avgHumidityPct: Number.isFinite(avgHumidityPct!)
          ? avgHumidityPct
          : null,
        latestReceivedAt: row.latest_received_at,
      };
    })
    .sort((a, b) => compareFarmKey(a.farmKey, b.farmKey));
}

export async function getFarmOverviewSummaries(): Promise<FarmSummaryRow[]> {
  const rows = await fetchFarmOverviewRows();
  return buildFarmSummariesFromOverview(rows);
}
