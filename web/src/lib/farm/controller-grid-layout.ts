/**
 * 현장 컨트롤러 카드 열 수.
 * 뷰포트가 아니라 목록 패널(`@container/field-list`) 너비를 따른다.
 * 현황 레일이 열려 있어도 남은 폭이 좁으면 5열로 늘리지 않는다.
 */
export const FIELD_LIST_CONTAINER = "@container/field-list";

/** 패널 너비 → 2 / 3 / 4 / 5열 */
export const CONTROLLER_GRID_FLAT =
  "grid min-w-0 grid-cols-1 gap-2 @min-[520px]/field-list:grid-cols-2 @min-[960px]/field-list:grid-cols-3 @min-[1200px]/field-list:grid-cols-4 @min-[1500px]/field-list:grid-cols-5";

/** 스플릿 우패널을 더 조밀하게 두고 싶을 때 — 최대 2열 */
export const CONTROLLER_GRID_NARROW =
  "grid min-w-0 grid-cols-1 gap-2 @min-[520px]/field-list:grid-cols-2";

export function controllerGridClass(
  narrow: boolean,
  _inSpSection: boolean,
): string {
  return narrow ? CONTROLLER_GRID_NARROW : CONTROLLER_GRID_FLAT;
}
