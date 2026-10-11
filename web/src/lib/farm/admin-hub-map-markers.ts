import { farmKeyId, type FarmKey } from "@/lib/domain/farm-key";
import {
  farmDisplayLabel,
  formatHumidityPct,
  formatTempC,
} from "@/lib/domain/farm-summaries";
import {
  hubFarmMonitorMetrics,
  type AdminHubFarmRow,
} from "@/lib/farm/admin-hub-farm-status";
import { farmNoFromLsind } from "@/lib/geo/korea-regions";

/** 첫 화면: 본토+제주가 잘리지 않게. 독도까지 맞추면 가로로 찌그러진다. */
export const HUB_MAP_VIEW_SW = { lat: 32.95, lng: 124.55 };
export const HUB_MAP_VIEW_NE = { lat: 38.72, lng: 129.85 };
/** 팬 한계: 울릉·독도까지 이동 가능, 북한·중국·일본 본토는 막음 */
export const HUB_MAP_PAN_SW = { lat: 32.7, lng: 124.15 };
export const HUB_MAP_PAN_NE = { lat: 38.95, lng: 132.05 };

export const HUB_MAP_TONE_LABEL = {
  live: "정상",
  alert: "경보",
  offline: "오프라인",
  location: "위치만",
} as const;

export function hubMapInPan(lat: number, lng: number): boolean {
  return (
    lat >= HUB_MAP_PAN_SW.lat &&
    lat <= HUB_MAP_PAN_NE.lat &&
    lng >= HUB_MAP_PAN_SW.lng &&
    lng <= HUB_MAP_PAN_NE.lng
  );
}

export function hubMapPinLabel(farmKey: FarmKey): string {
  const n = farmNoFromLsind(farmKey.lsindRegistNo);
  if (n != null) return String(n);
  return farmKey.lsindRegistNo.slice(-2);
}

export function escapeHubMapHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TIP_ICON = {
  temp: '<svg class="hub-map-tip-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>',
  hum: '<svg class="hub-map-tip-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z"/></svg>',
  cpu: '<svg class="hub-map-tip-icon" viewBox="0 0 24 24" aria-hidden="true"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>',
} as const;

export function hubMapPinTooltipHtml(row: AdminHubFarmRow): string {
  const title = escapeHubMapHtml(
    farmDisplayLabel(row.farmKey, row.location?.farmName),
  );
  const status = escapeHubMapHtml(HUB_MAP_TONE_LABEL[row.tone]);
  const { tempC, humidityPct, online, controllerCount } =
    hubFarmMonitorMetrics(row);
  const controllers = online == null ? "—" : `${online}/${controllerCount}`;
  return `<div class="hub-map-tip-card"><div class="hub-map-tip-name">${title}</div><div class="hub-map-tip-status">${status}</div><div class="hub-map-tip-metrics"><span class="hub-map-tip-metric hub-map-tip-metric--temp">${TIP_ICON.temp}<span>${escapeHubMapHtml(formatTempC(tempC))}</span></span><span class="hub-map-tip-metric hub-map-tip-metric--hum">${TIP_ICON.hum}<span>${escapeHubMapHtml(formatHumidityPct(humidityPct))}</span></span><span class="hub-map-tip-metric">${TIP_ICON.cpu}<span>${escapeHubMapHtml(controllers)}</span></span></div></div>`;
}

export function hubMapPinClass(row: AdminHubFarmRow, active: boolean): string {
  return `hub-map-pin hub-map-pin--${row.tone}${active ? " is-active" : ""}`;
}

export function hubMapFarmId(row: AdminHubFarmRow): string {
  return farmKeyId(row.farmKey);
}
