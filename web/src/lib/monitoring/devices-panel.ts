import type { FarmKey } from "@/lib/domain/farm-key";

import { appendFarmKeyParams } from "@/lib/domain/farm-key";

function buildDevicesPanelSearch(
  params?: URLSearchParams | Record<string, string | undefined | null>,
  farmKey?: FarmKey
): URLSearchParams {
  const search = new URLSearchParams();

  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => {
      if (key === "panel") return;
      if (value) search.set(key, value);
    });
  } else if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (key === "panel") continue;
      if (value) search.set(key, value);
    }
  }

  if (farmKey) appendFarmKeyParams(search, farmKey);
  search.delete("tab");
  return search;
}

export function devicesPanelHref(
  params?: URLSearchParams | Record<string, string | undefined | null>,
  farmKey?: FarmKey
): string {
  const search = buildDevicesPanelSearch(params, farmKey);
  const q = search.toString();
  return q ? `/farm?${q}` : "/farm";
}

export function devicesAlarmSettingsHref(
  params?: URLSearchParams | Record<string, string | undefined | null>,
  farmKey?: FarmKey
): string {
  return devicesPanelHref(params, farmKey);
}
