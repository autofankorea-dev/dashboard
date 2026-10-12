import { farmKeyId, type FarmKey } from "@/lib/domain/farm-key";
import type { FarmScopedPanelData } from "@/lib/farm/load-farm-scoped-panel-data";

export type FetchFarmScopedPanel = (
  farmKey: FarmKey,
) => Promise<FarmScopedPanelData>;

/** 농장당 1개 inflight — 연속 enrich/bootstrap이 동일 Promise를 공유 */
const enrichInflight = new Map<string, Promise<FarmScopedPanelData>>();

/**
 * Scoped panel fetch (settings·thermo 포함).
 * 동일 farm 연속 호출은 coalesce; 호출측에서 generation으로 stale 적용 방지.
 * 서버 액션은 호출측이 넘긴다.
 */
export function fetchFarmPanelEnrichShared(
  farmKey: FarmKey,
  fetchPanel: FetchFarmScopedPanel,
): Promise<FarmScopedPanelData> {
  const id = farmKeyId(farmKey);
  const pending = enrichInflight.get(id);
  if (pending) return pending;

  const req = fetchPanel(farmKey).finally(() => {
    if (enrichInflight.get(id) === req) enrichInflight.delete(id);
  });
  enrichInflight.set(id, req);
  return req;
}
