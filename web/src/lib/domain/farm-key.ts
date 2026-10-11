export type FarmKey = { lsindRegistNo: string; itemCode: string };

export const DEFAULT_FARM: FarmKey = {
  lsindRegistNo: "FARM01",
  itemCode: "P00",
};

export function farmKeyId(fk: FarmKey): string {
  return `${fk.lsindRegistNo}/${fk.itemCode}`;
}

/** `{lsind}/{itemCode}` 내부 ID → FarmKey (표시용 변환 등) */
export function parseFarmKeyId(id: string): FarmKey | null {
  const slash = id.indexOf("/");
  if (slash <= 0) return null;
  const lsindRegistNo = id.slice(0, slash).trim();
  const itemCode = id.slice(slash + 1).trim();
  if (!lsindRegistNo || !itemCode) return null;
  return { lsindRegistNo, itemCode };
}

/** Health farm drill-down URL segment (`FARM01/P00` → `FARM01--P00`) */
export function farmKeyUrlSlug(id: string): string {
  return id.replace("/", "--");
}

export function parseFarmKeyUrlSlug(slug: string): FarmKey | null {
  const dash = slug.indexOf("--");
  if (dash > 0) {
    return parseFarmKeyId(`${slug.slice(0, dash)}/${slug.slice(dash + 2)}`);
  }
  return parseFarmKeyId(slug);
}

export function farmKeyEq(a: FarmKey, b: FarmKey): boolean {
  return a.lsindRegistNo === b.lsindRegistNo && a.itemCode === b.itemCode;
}

export function parseFarmKeyFromQuery(
  lsind?: string | null,
  item?: string | null
): FarmKey | null {
  const lsindRegistNo = lsind?.trim();
  const itemCode = item?.trim();
  if (!lsindRegistNo || !itemCode) return null;
  return { lsindRegistNo, itemCode };
}

export function compareFarmKey(a: FarmKey, b: FarmKey): number {
  const byLsind = a.lsindRegistNo.localeCompare(b.lsindRegistNo);
  return byLsind !== 0 ? byLsind : a.itemCode.localeCompare(b.itemCode);
}

/** Reading composite key: `{lsind}/{item}-{module}-{controllerKey}` */
export function readingKey(
  fk: FarmKey,
  moduleUid: number,
  controllerKey: string
): string {
  return `${farmKeyId(fk)}-${moduleUid}-${controllerKey}`;
}

export function moduleKey(fk: FarmKey, moduleUid: number): string {
  return `${farmKeyId(fk)}-${moduleUid}`;
}

export function stallCatalogKey(
  fk: FarmKey,
  moduleUid: number,
  stallNo: string
): string {
  return `${farmKeyId(fk)}-${moduleUid}-${stallNo}`;
}

export function appendFarmKeyParams(
  params: URLSearchParams,
  fk: FarmKey
): URLSearchParams {
  params.set("lsind", fk.lsindRegistNo);
  params.set("item", fk.itemCode);
  return params;
}

/** Legacy ui_config / farm_uid rows → v0x07 identity */
export function legacyFarmUidToKey(farmUid: number): FarmKey {
  return {
    lsindRegistNo: `FARM${String(farmUid).padStart(2, "0")}`,
    itemCode: DEFAULT_FARM.itemCode,
  };
}

export function parseFarmKeyFields(raw: Record<string, unknown>): FarmKey | null {
  const lsindRegistNo = String(
    raw.lsindRegistNo ?? raw.lsind_regist_no ?? ""
  ).trim();
  const itemCode = String(raw.itemCode ?? raw.item_code ?? "").trim();
  if (lsindRegistNo && itemCode) {
    return { lsindRegistNo, itemCode };
  }
  const farmUid = Number(raw.farmUid ?? raw.farm_uid);
  if (Number.isInteger(farmUid) && farmUid >= 0) {
    return legacyFarmUidToKey(farmUid);
  }
  return null;
}
