import type { BarnMeta } from "@/lib/data/barn-meta";
import type { BarnLayoutPrefs } from "@/lib/data/barn-meta";
import {
  compareCatalogEntries,
  defaultBarnLabel,
  entryFromParts,
  isValidFarmKey,
  parseBarnCatalogKey,
  type BarnCatalogEntry,
} from "@/lib/domain/barn-catalog";
import {
  buildGridSlots,
  gridKey,
  pickNextGridSlot,
  resolveGridDimensionsWithLayouts,
  type GridPos,
} from "@/lib/domain/barn-grid";
import { farmKeyEq, type FarmKey } from "@/lib/domain/farm-key";
import { normalizeStallTyCode } from "@/lib/domain/stall-type";
import type { BarnMapSnapshot, BarnReading, ControllerStatus } from "@/lib/data/iot";

function avg(nums: (number | null)[]): number | null {
  const v = nums.filter((n): n is number => n !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

const STATUS_RANK: Record<ControllerStatus, number> = {
  normal: 0,
  caution: 1,
  offline: 2,
};

function worstStatus(statuses: ControllerStatus[]): ControllerStatus {
  if (statuses.length === 0) return "offline";
  return statuses.reduce((w, s) =>
    STATUS_RANK[s] > STATUS_RANK[w] ? s : w
  );
}

/** 개별 축사 단위 카드 (동일 축사유형의 여러 stallNo를 각각 표시) */
type StallUnit = {
  entry: BarnCatalogEntry;
  /** 실제 축사번호. 데이터에 없으면 "" (유형 단위 단일 카드로 폴백) */
  stallNo: string;
  /** 카드/레이아웃 식별자 = `${catalogKey}#${stallNo}` (번호 없으면 catalogKey) */
  cardId: string;
};

function cardIdForStall(entry: BarnCatalogEntry, stallNo: string): string {
  return stallNo ? `${entry.catalogKey}#${stallNo}` : entry.catalogKey;
}

function stallNoRank(no: string): number {
  const n = Number(no);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function compareStallUnits(a: StallUnit, b: StallUnit): number {
  const ec = compareCatalogEntries(a.entry, b.entry);
  if (ec !== 0) return ec;
  const rc = stallNoRank(a.stallNo) - stallNoRank(b.stallNo);
  if (rc !== 0) return rc;
  return a.stallNo.localeCompare(b.stallNo);
}

function stallUnitsFromReadings(readings: BarnReading[]): StallUnit[] {
  const map = new Map<string, StallUnit>();
  for (const r of readings) {
    if (!r.stallTyCode || !isValidFarmKey(r.farmKey)) continue;
    const entry = entryFromParts(r.farmKey, r.moduleUid, r.stallTyCode);
    const stallNo = (r.stallNo ?? "").trim();
    const cardId = cardIdForStall(entry, stallNo);
    if (!map.has(cardId)) map.set(cardId, { entry, stallNo, cardId });
  }
  return [...map.values()].sort(compareStallUnits);
}

function metaForStall(
  unit: StallUnit,
  grid: GridPos,
  alias: string | undefined
): BarnMeta {
  return {
    id: unit.cardId,
    farmKey: unit.entry.farmKey,
    moduleUid: unit.entry.moduleUid,
    stallNo: unit.stallNo,
    name: alias?.trim() || defaultBarnLabel(unit.entry),
    grid,
    type: "barn",
  };
}

function readingsForStallUnit(
  readings: BarnReading[],
  unit: StallUnit
): BarnReading[] {
  const ty = normalizeStallTyCode(unit.entry.stallTyCode);
  return readings.filter(
    (r) =>
      farmKeyEq(r.farmKey, unit.entry.farmKey) &&
      r.moduleUid === unit.entry.moduleUid &&
      normalizeStallTyCode(r.stallTyCode) === ty &&
      (unit.stallNo ? (r.stallNo ?? "").trim() === unit.stallNo : true)
  );
}

function isValidSavedGrid(
  grid: GridPos,
  cols: number,
  rows: number
): boolean {
  return (
    grid.col >= 1 &&
    grid.row >= 1 &&
    grid.col <= cols &&
    grid.row <= rows
  );
}

export type BarnMapBuildResult = {
  snapshots: BarnMapSnapshot[];
  /** 최초 자동 배치·신규 SP — DB에 저장할 좌표 */
  layoutsToPersist: Record<string, { col: number; row: number }>;
};

/** Admin multi-farm — 선택 farm catalog/layout만 buildAutoBarnMap에 전달 */
export function filterBarnLayoutPrefsForFarm(
  prefs: BarnLayoutPrefs,
  farmKey: FarmKey
): BarnLayoutPrefs {
  const layouts: BarnLayoutPrefs["layouts"] = {};
  for (const [key, grid] of Object.entries(prefs.layouts)) {
    const parsed = parseBarnCatalogKey(key);
    if (parsed && farmKeyEq(parsed.farmKey, farmKey)) {
      layouts[key] = grid;
    }
  }
  const aliases: BarnLayoutPrefs["aliases"] = {};
  for (const [key, alias] of Object.entries(prefs.aliases)) {
    const parsed = parseBarnCatalogKey(key);
    if (parsed && farmKeyEq(parsed.farmKey, farmKey)) {
      aliases[key] = alias;
    }
  }
  return { layouts, aliases };
}

/** LIVE readings + layout prefs — SP(축사유형) 단위 지도 스냅샷 */
export function buildAutoBarnMap(
  readings: BarnReading[],
  layoutPrefs: BarnLayoutPrefs
): BarnMapBuildResult {
  const validReadings = readings.filter((r) => isValidFarmKey(r.farmKey));
  // 기본: LIVE 데이터가 있는 개별 축사(stallNo)만 표시. layout prefs는 좌표/별칭만 사용.
  const units = stallUnitsFromReadings(validReadings);

  if (units.length === 0) {
    return { snapshots: [], layoutsToPersist: {} };
  }

  const { cols, rows } = resolveGridDimensionsWithLayouts(
    units.length,
    layoutPrefs.layouts
  );
  const orderedSlots = buildGridSlots(cols, rows);
  const usedSlots = new Set<string>();
  const layoutsToPersist: Record<string, { col: number; row: number }> = {};
  const placed: BarnMeta[] = [];
  let autoSlotIndex = 0;

  const snapshots: BarnMapSnapshot[] = units.map((unit) => {
    const saved = layoutPrefs.layouts[unit.cardId];
    let grid: GridPos;

    if (saved && isValidSavedGrid(saved, cols, rows)) {
      grid = { col: saved.col, row: saved.row };
    } else {
      while (
        autoSlotIndex < orderedSlots.length &&
        usedSlots.has(
          gridKey(orderedSlots[autoSlotIndex].col, orderedSlots[autoSlotIndex].row)
        )
      ) {
        autoSlotIndex++;
      }
      grid =
        orderedSlots[autoSlotIndex] ??
        pickNextGridSlot(placed, cols, rows);
      if (autoSlotIndex < orderedSlots.length) autoSlotIndex++;
      layoutsToPersist[unit.cardId] = grid;
    }

    usedSlots.add(gridKey(grid.col, grid.row));

    const meta = metaForStall(unit, grid, layoutPrefs.aliases[unit.cardId]);
    placed.push(meta);

    const matched = readingsForStallUnit(validReadings, unit);
    const onlineMatched = matched.filter((r) => r.status !== "offline");

    const latestReceived = matched.reduce<string | null>((latest, r) => {
      if (!latest) return r.receivedAt;
      return new Date(r.receivedAt) > new Date(latest) ? r.receivedAt : latest;
    }, null);

    return {
      meta,
      controllerCount: matched.length,
      stallCount: 1,
      tempC: avg(onlineMatched.map((r) => r.tempC)),
      humidityPct: avg(onlineMatched.map((r) => r.humidityPct)),
      fanSupply: avg(onlineMatched.map((r) => r.fanSupply)),
      fanExhaust: avg(onlineMatched.map((r) => r.fanExhaust)),
      fanIntake: avg(onlineMatched.map((r) => r.fanIntake)),
      status:
        matched.length > 0
          ? worstStatus(matched.map((r) => r.status))
          : "offline",
      receivedAt: latestReceived,
    };
  });

  return { snapshots, layoutsToPersist };
}

export function gridDimensionsForBarnMap(
  snapshots: BarnMapSnapshot[],
  layouts: Record<string, { col: number; row: number }> = {}
): { cols: number; rows: number } {
  return resolveGridDimensionsWithLayouts(
    snapshots.length || 1,
    layouts
  );
}

/** 그리드 카드에 LIVE readings가 있는지 — trend empty 문구 구분용 */
export function barnSnapshotHasLiveForSp(
  snapshots: BarnMapSnapshot[],
  stallTyCode: string
): boolean {
  const code = normalizeStallTyCode(stallTyCode);
  return snapshots.some((b) => {
    const entry = parseBarnCatalogKey(b.meta.id);
    if (!entry || normalizeStallTyCode(entry.stallTyCode) !== code) return false;
    return (
      b.controllerCount > 0 || b.tempC != null || b.humidityPct != null
    );
  });
}
