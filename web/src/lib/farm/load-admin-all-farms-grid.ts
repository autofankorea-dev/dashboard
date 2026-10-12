import "server-only";

import { filterReadingsByFarmKey } from "@/lib/auth/farm-access";
import { ADMIN_HUB_MAX_FARMS } from "@/lib/data/admin-hub-live";
import { getBarnLayoutPrefs, type BarnLayoutPrefs } from "@/lib/data/barn-meta";
import {
  buildAutoBarnMap,
  filterBarnLayoutPrefsForFarm,
  gridDimensionsForBarnMap,
} from "@/lib/domain/barn-map";
import type { FarmKey } from "@/lib/domain/farm-key";
import { getLiveReadings } from "@/lib/data/iot";
import type { AdminFarmGridPanel } from "@/lib/farm/admin-all-farms-grid-shared";
import { ADMIN_HUB_GRID_BATCH_SIZE } from "@/lib/farm/admin-all-farms-grid-shared";

export type { AdminFarmGridPanel } from "@/lib/farm/admin-all-farms-grid-shared";
export { ADMIN_HUB_GRID_BATCH_SIZE } from "@/lib/farm/admin-all-farms-grid-shared";

/**
 * Admin hub overview cards only — list-tier slim (no channels[]).
 * Farm drill-in uses loadFarmScopedPanelData / panel enrich (full) before bulk.
 */
async function loadFarmGridPanel(
  farmKey: FarmKey,
  prefs: BarnLayoutPrefs,
): Promise<AdminFarmGridPanel> {
  const readings = await getLiveReadings({ farmKey, slim: true });
  const scopedReadings = filterReadingsByFarmKey(readings, farmKey);
  const scopedPrefs = filterBarnLayoutPrefsForFarm(prefs, farmKey);
  const { snapshots: barnSnapshots, layoutsToPersist } = buildAutoBarnMap(
    scopedReadings,
    scopedPrefs,
  );
  const mergedLayouts = {
    ...scopedPrefs.layouts,
    ...layoutsToPersist,
  };
  const gridSize = gridDimensionsForBarnMap(barnSnapshots, mergedLayouts);
  return {
    farmKey,
    readings: scopedReadings,
    barnSnapshots,
    gridCols: gridSize.cols,
    gridRows: gridSize.rows,
  };
}

/** 지정 키만 로드 (배치 hydrate용). LIVE 축사 없는 농장은 제외. */
export async function loadAdminFarmGridPanelsForKeys(
  farmKeys: FarmKey[],
  layoutPrefs?: BarnLayoutPrefs,
): Promise<AdminFarmGridPanel[]> {
  if (farmKeys.length === 0) return [];
  const prefs = layoutPrefs ?? (await getBarnLayoutPrefs());
  const batchPanels = await Promise.all(
    farmKeys.map((farmKey) => loadFarmGridPanel(farmKey, prefs)),
  );
  return batchPanels.filter((p) => p.barnSnapshots.length > 0);
}

/** Admin 전체 농장 — farm별 축사유형 그리드 (trend·명령 제외, overview용).
 * LIVE 축사 카드가 없는(위치만) 농장은 제외한다.
 */
export async function loadAdminAllFarmsGridPanels(
  farmKeys: FarmKey[],
  layoutPrefs?: BarnLayoutPrefs,
): Promise<AdminFarmGridPanel[]> {
  const keys = farmKeys.slice(0, ADMIN_HUB_MAX_FARMS);
  if (keys.length === 0) return [];

  const prefs = layoutPrefs ?? (await getBarnLayoutPrefs());
  const panels: AdminFarmGridPanel[] = [];

  for (let i = 0; i < keys.length; i += ADMIN_HUB_GRID_BATCH_SIZE) {
    const batch = keys.slice(i, i + ADMIN_HUB_GRID_BATCH_SIZE);
    const batchPanels = await loadAdminFarmGridPanelsForKeys(batch, prefs);
    panels.push(...batchPanels);
  }

  return panels;
}
