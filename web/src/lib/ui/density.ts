/**
 * 대시보드 타이포 스케일. `--density-*` 는 `globals.css` `:root` 한 벌이다.
 * `md`(768px) 이상은 `--density-*-md`. 조밀/여유 전환은 없다.
 * @see docs/UI_DENSITY.md
 */

/**
 * Tailwind arbitrary — `--density-*` 직접 참조.
 * 인라인 comfortable 본문 rem 리터럴 금지 (verify:ui-density).
 */
export const densityClass = {
  body: "text-[length:var(--density-body)]",
  bodyMd: "text-[length:var(--density-body-md)]",
  meta: "text-[length:var(--density-meta)]",
  metaMd: "text-[length:var(--density-meta-md)]",
  metaToMd:
    "text-[length:var(--density-meta)] md:text-[length:var(--density-meta-md)]",
  bodyToMd:
    "text-[length:var(--density-body)] md:text-[length:var(--density-body-md)]",
  controlText: "text-[length:var(--density-control-text)]",
  controlTextMd: "text-[length:var(--density-control-text-md)]",
  controlTextToMd:
    "text-[length:var(--density-control-text)] md:text-[length:var(--density-control-text-md)]",
  controlHMd:
    "h-[length:var(--density-control-h-md)] min-h-[length:var(--density-control-h-md)]",
  /** bulk 모달 등 sm → lg 확대 */
  metaToLgBodyMd:
    "text-[length:var(--density-meta)] leading-snug md:text-[length:var(--density-body)] md:leading-snug lg:text-[length:var(--density-body-md)] lg:leading-snug",
  metaToLgOnly:
    "text-[length:var(--density-meta)] leading-snug lg:text-[length:var(--density-body-md)]",
} as const;
