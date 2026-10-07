import { moduleKey, type FarmKey } from "@/lib/data/farm-key";
import type { DecodedControllerPayload } from "@/lib/data/wire-decode-v0b";

/** One decoded controller from a single raw row (row-stream). */
export type RawLiveControllerRow = {
  rawId: number;
  lsind_regist_no: string;
  item_code: string;
  module_uid: number;
  received_at: string;
  wire_ver: number;
  packet_mode: string;
  controller_key: string;
  mesure_dt: string;
  run_mode?: number;
  temps_c?: (string | null)[];
  humidity_pct?: string | null;
  alarm_low_temp_c?: string | null;
  alarm_high_temp_c?: string | null;
  channels: DecodedControllerPayload["channels"];
};

export function isLivePacketMode(mode: string | null | undefined): boolean {
  return !mode || mode === "live";
}

function rowFarmKey(row: RawLiveControllerRow): FarmKey {
  return { lsindRegistNo: row.lsind_regist_no, itemCode: row.item_code };
}

/**
 * Row-stream fallback: keep newest row per (module, controllerKey).
 * Prefer v_iot_decoded_latest (Edge decode). Legacy raw+TS pick removed.
 */
export function pickLatestLiveControllerRows(
  rows: RawLiveControllerRow[]
): RawLiveControllerRow[] {
  const byKey = new Map<string, RawLiveControllerRow>();

  for (const row of rows) {
    if (!isLivePacketMode(row.packet_mode)) continue;
    const mk = moduleKey(rowFarmKey(row), row.module_uid);
    const key = `${mk}|${row.controller_key}`;
    const existing = byKey.get(key);
    if (!existing || row.received_at > existing.received_at) {
      byKey.set(key, row);
    }
  }

  return [...byKey.values()].sort((a, b) => {
    return a.controller_key.localeCompare(b.controller_key, "ko", {
      numeric: true,
    });
  });
}
