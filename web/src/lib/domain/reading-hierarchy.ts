import { compareCatalogEntries, entryFromParts } from "@/lib/domain/barn-catalog";
import {
  formatStallTypeLabel,
  normalizeStallTyCode,
  stallTyCodeSortKey,
} from "@/lib/domain/stall-type";
import { farmKeyId } from "@/lib/domain/farm-key";
import type { BarnReading } from "@/lib/domain/iot-types";

export function stallKeyFromReading(r: {
  stallNo: string | null;
  controllerKey?: string;
  idx?: number;
}): string {
  const s = r.stallNo?.trim();
  if (s) return s;
  if (r.controllerKey) return `__ck_${r.controllerKey}`;
  if (r.idx != null) return `__idx_${r.idx}`;
  return "__unknown";
}

export function stallLabelFromKey(stallKey: string): string {
  if (stallKey.startsWith("__idx_")) {
    return `미지정 (idx ${stallKey.slice(6)})`;
  }
  return `축사 ${stallKey}`;
}

export function compareStallNo(a: string | null, b: string | null): number {
  const sa = a?.trim() ?? "";
  const sb = b?.trim() ?? "";
  if (!sa && !sb) return 0;
  if (!sa) return 1;
  if (!sb) return -1;
  return sa.localeCompare(sb, "ko", { numeric: true });
}

export function compareReadings(a: BarnReading, b: BarnReading): number {
  const catalogCmp = compareCatalogEntries(
    entryFromParts(a.farmKey, a.moduleUid, a.stallTyCode),
    entryFromParts(b.farmKey, b.moduleUid, b.stallTyCode)
  );
  if (catalogCmp !== 0) return catalogCmp;
  const stallCmp = compareStallNo(a.stallNo, b.stallNo);
  if (stallCmp !== 0) return stallCmp;
  const eqpmnCmp = a.eqpmnNo.localeCompare(b.eqpmnNo, "ko", { numeric: true });
  if (eqpmnCmp !== 0) return eqpmnCmp;
  const ak = a.controllerKey ?? "";
  const bk = b.controllerKey ?? "";
  return ak.localeCompare(bk, "ko", { numeric: true });
}

export function sortReadings<T extends BarnReading>(readings: T[]): T[] {
  return [...readings].sort(compareReadings);
}

export type ReadingHierarchyStall = {
  stallKey: string;
  label: string;
  readings: BarnReading[];
};

export type ReadingHierarchySp = {
  stallTyCode: string;
  label: string;
  stalls: ReadingHierarchyStall[];
};

/** SP → 축사 → 컨트롤러 계층 그룹 */
export function groupReadingsByHierarchy(
  readings: BarnReading[]
): ReadingHierarchySp[] {
  const sorted = sortReadings(readings);
  const spOrder: string[] = [];
  const stallOrder = new Map<string, string[]>();
  const spMap = new Map<string, Map<string, BarnReading[]>>();

  for (const r of sorted) {
    const sp = normalizeStallTyCode(r.stallTyCode);
    const stallKey = stallKeyFromReading(r);

    if (!spMap.has(sp)) spMap.set(sp, new Map());
    const stallMap = spMap.get(sp)!;
    if (!stallMap.has(stallKey)) stallMap.set(stallKey, []);
    stallMap.get(stallKey)!.push(r);

    if (!spOrder.includes(sp)) spOrder.push(sp);
    const stalls = stallOrder.get(sp) ?? [];
    if (!stalls.includes(stallKey)) {
      stalls.push(stallKey);
      stallOrder.set(sp, stalls);
    }
  }

  return spOrder.map((sp) => ({
    stallTyCode: sp,
    label: formatStallTypeLabel(sp),
    stalls: (stallOrder.get(sp) ?? []).map((stallKey) => ({
      stallKey,
      label: stallLabelFromKey(stallKey),
      readings: spMap.get(sp)?.get(stallKey) ?? [],
    })),
  }));
}

export function uniqueSpCodes(
  readings: BarnReading[],
  farmId?: string
): string[] {
  const codes = new Set<string>();
  for (const r of readings) {
    if (farmId && farmKeyId(r.farmKey) !== farmId) {
      continue;
    }
    codes.add(normalizeStallTyCode(r.stallTyCode));
  }
  return [...codes].sort(
    (a, b) => stallTyCodeSortKey(a) - stallTyCodeSortKey(b)
  );
}

export function uniqueStallKeys(
  readings: BarnReading[],
  farmId: string,
  spCode: string
): string[] {
  const keys: string[] = [];
  for (const r of readings) {
    if (farmKeyId(r.farmKey) !== farmId) continue;
    if (normalizeStallTyCode(r.stallTyCode) !== spCode) continue;
    const key = stallKeyFromReading(r);
    if (!keys.includes(key)) keys.push(key);
  }
  return sortStallKeys(keys);
}

function sortStallKeys(keys: string[]): string[] {
  return keys.sort((a, b) => {
    if (a.startsWith("__idx_") && !b.startsWith("__idx_")) return 1;
    if (!a.startsWith("__idx_") && b.startsWith("__idx_")) return -1;
    return a.localeCompare(b, "ko", { numeric: true });
  });
}

/** 농장 내 모든 SP의 축사번호 (전체유형 선택 시) */
export function uniqueStallKeysForFarm(
  readings: BarnReading[],
  farmId: string
): string[] {
  const keys: string[] = [];
  for (const sp of uniqueSpCodes(readings, farmId)) {
    for (const key of uniqueStallKeys(readings, farmId, sp)) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return sortStallKeys(keys);
}

/** 농장 단위 필터 (전체유형) */
export function filterReadingsByFarm(
  readings: BarnReading[],
  farmId: string
): BarnReading[] {
  return sortReadings(
    readings.filter((r) => farmKeyId(r.farmKey) === farmId)
  );
}

export function filterReadingsByHierarchy(
  readings: BarnReading[],
  farmId: string,
  spCode: string,
  stallKey: string
): BarnReading[] {
  return sortReadings(
    readings.filter((r) => {
      if (farmKeyId(r.farmKey) !== farmId) {
        return false;
      }
      if (normalizeStallTyCode(r.stallTyCode) !== spCode) return false;
      return stallKeyFromReading(r) === stallKey;
    })
  );
}

/** 농장 + 축사유형(SP) 단위 필터 */
export function filterReadingsByFarmAndSp(
  readings: BarnReading[],
  farmId: string,
  spCode: string
): BarnReading[] {
  return sortReadings(
    readings.filter(
      (r) =>
        farmKeyId(r.farmKey) === farmId &&
        normalizeStallTyCode(r.stallTyCode) === spCode
    )
  );
}
