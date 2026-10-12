/**
 * 축종코드(itemCode) — 축평원 「스마트축산 정보연계 인터페이스」 §3.2 (v4.0)
 * @see STM_Ethernet/2. 「스마트축산 정보연계 인터페이스」 개정(안) 전문.pdf
 *
 * UI 축종명: 코드 접두 W·D·P·H·T·R·I·B (WDPHTRIB) → 한우·낙농·양돈·양계·오리·사슴·곤충·양봉
 * MQTT·DB·URL 키는 itemCode 원문 유지.
 */

/** WDPHTRIB 접두 → 축종명 (현장·대시보드 표기) */
export const ITEM_CODE_CATEGORY_NAMES: Record<string, string> = {
  W: "한우",
  D: "한우",
  P: "양돈",
  H: "양계",
  T: "오리",
  R: "사슴",
  I: "곤충",
  B: "양봉",
};

/** §3.2 세부 코드 — 접두 축종명과 다른 경우만 명시 (예: W01 낙농) */
export const ITEM_CODE_NAMES: Record<string, string> = {
  W00: "한우",
  W01: "낙농",
  D00: "한우",
  P00: "양돈",
  H01: "양계",
  H02: "양계",
  H03: "양계",
  T01: "오리",
  T02: "오리",
  E00: "말",
  G00: "염소·양",
  R00: "사슴",
  I00: "곤충",
  B00: "양봉",
};

/** v4.0 세분화 전 레거시 — 읽기 시 표시명만 매핑 (DB·연계 키는 그대로) */
const DEPRECATED_ITEM_CODE_NAMES: Record<string, string> = {
  H00: "양계",
  T00: "오리",
};

export function normalizeItemCode(code: string | null | undefined): string {
  const c = (code ?? "").trim().toUpperCase();
  return c || "UNK";
}

export function getItemCodeCategoryName(code: string | null | undefined): string | null {
  const key = normalizeItemCode(code);
  if (key === "UNK") return null;
  const prefix = key.charAt(0);
  return ITEM_CODE_CATEGORY_NAMES[prefix] ?? null;
}

export function getItemCodeName(code: string | null | undefined): string {
  const key = normalizeItemCode(code);
  return (
    ITEM_CODE_NAMES[key] ??
    DEPRECATED_ITEM_CODE_NAMES[key] ??
    getItemCodeCategoryName(key) ??
    key
  );
}

/** UI 표시용 — 축종명만 (예: 양돈) */
export function formatItemCodeLabel(code: string | null | undefined): string {
  return getItemCodeName(code);
}
