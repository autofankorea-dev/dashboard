import {
  compareFarmKey,
  farmKeyId,
  type FarmKey,
} from "@/lib/domain/farm-key";
import { farmDisplayLabel } from "@/lib/domain/farm-summaries";
import type {
  EditableFarmOption,
  FarmLocationRow,
} from "@/lib/domain/farm-location-shared";

/** 이미 조회한 농장·위치 행으로 주소 편집 옵션을 만든다. 위치 없는 농장도 빈 초안으로 넣는다. */
export function editableFarmOptionsFromKnownFarms(
  farmOptions: FarmKey[],
  locations: FarmLocationRow[],
  extraFarmKey?: FarmKey | null,
): EditableFarmOption[] {
  const locMap = new Map(
    locations.map((row) => [farmKeyId(row.farmKey), row] as const),
  );
  const liveIds = new Set(farmOptions.map((fk) => farmKeyId(fk)));
  const seen = new Map<string, FarmKey>();
  for (const fk of farmOptions) seen.set(farmKeyId(fk), fk);
  for (const loc of locations) {
    const id = farmKeyId(loc.farmKey);
    if (!seen.has(id)) seen.set(id, loc.farmKey);
  }
  if (extraFarmKey) {
    const id = farmKeyId(extraFarmKey);
    if (!seen.has(id)) seen.set(id, extraFarmKey);
  }
  return [...seen.values()].sort(compareFarmKey).map((farmKey) => {
    const id = farmKeyId(farmKey);
    const location = locMap.get(id) ?? null;
    return {
      farmKey,
      label: farmDisplayLabel(farmKey, location?.farmName),
      location,
      hasLiveData: liveIds.has(id),
    };
  });
}
