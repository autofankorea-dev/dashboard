import {
  farmKeyId,
  parseFarmKeyFromQuery,
  type FarmKey,
} from "@/lib/domain/farm-key";
import {
  formatStallTypeLabel,
  normalizeStallTyCode,
  stallTyCodeSortKey,
} from "@/lib/domain/stall-type";

/** 지도 카드 식별: farm + module + stallTyCode (SP 단위) */
export type BarnCatalogEntry = {
  catalogKey: string;
  farmKey: FarmKey;
  moduleUid: number;
  stallTyCode: string;
};

const SP_CATALOG_KEY_RE = /^(.+)\/([^-]+)-(\d+)-([^-]+)$/;
const LEGACY_CATALOG_KEY_RE = /^(.+)\/([^-]+)-(\d+)-([^-]+)-(.+)$/;

export function isValidFarmKey(fk: FarmKey): boolean {
  const lsind = fk.lsindRegistNo.trim();
  const item = fk.itemCode.trim();
  return lsind.length >= 4 && item.length >= 2;
}

export function barnCatalogKey(
  farmKey: FarmKey,
  moduleUid: number,
  stallTyCode: string | null
): string {
  const ty = normalizeStallTyCode(stallTyCode);
  return `${farmKeyId(farmKey)}-${moduleUid}-${ty}`;
}

/** 개별 축사 카드 id는 `${catalogKey}#${stallNo}` — SP 파싱 시 접미사 무시 */
export function stallNoFromCardId(cardId: string): string | null {
  const idx = cardId.indexOf("#");
  if (idx < 0) return null;
  const no = cardId.slice(idx + 1).trim();
  return no || null;
}

export function parseBarnCatalogKey(key: string): BarnCatalogEntry | null {
  const base = key.split("#")[0];
  const legacy = base.match(LEGACY_CATALOG_KEY_RE);
  if (legacy) {
    const farmKey = parseFarmKeyFromQuery(legacy[1], legacy[2]);
    if (!farmKey) return null;
    const moduleUid = Number(legacy[3]);
    if (!Number.isInteger(moduleUid)) return null;
    return {
      catalogKey: barnCatalogKey(farmKey, moduleUid, legacy[4]),
      farmKey,
      moduleUid,
      stallTyCode: normalizeStallTyCode(legacy[4]),
    };
  }

  const m = base.match(SP_CATALOG_KEY_RE);
  if (!m) return null;
  const farmKey = parseFarmKeyFromQuery(m[1], m[2]);
  if (!farmKey) return null;
  const moduleUid = Number(m[3]);
  if (!Number.isInteger(moduleUid)) return null;
  return {
    catalogKey: base,
    farmKey,
    moduleUid,
    stallTyCode: normalizeStallTyCode(m[4]),
  };
}

export function defaultBarnLabel(entry: BarnCatalogEntry): string {
  return formatStallTypeLabel(entry.stallTyCode);
}

export function compareCatalogEntries(
  a: BarnCatalogEntry,
  b: BarnCatalogEntry
): number {
  const farmCmp = farmKeyId(a.farmKey).localeCompare(farmKeyId(b.farmKey));
  if (farmCmp !== 0) return farmCmp;
  if (a.moduleUid !== b.moduleUid) return a.moduleUid - b.moduleUid;
  const tyCmp = stallTyCodeSortKey(a.stallTyCode) - stallTyCodeSortKey(b.stallTyCode);
  if (tyCmp !== 0) return tyCmp;
  return a.stallTyCode.localeCompare(b.stallTyCode);
}

export function sortCatalogEntries(entries: BarnCatalogEntry[]): BarnCatalogEntry[] {
  return [...entries].sort(compareCatalogEntries);
}

export function entryFromParts(
  farmKey: FarmKey,
  moduleUid: number,
  stallTyCode: string | null
): BarnCatalogEntry {
  const stallTy = normalizeStallTyCode(stallTyCode);
  return {
    catalogKey: barnCatalogKey(farmKey, moduleUid, stallTy),
    farmKey,
    moduleUid,
    stallTyCode: stallTy,
  };
}
