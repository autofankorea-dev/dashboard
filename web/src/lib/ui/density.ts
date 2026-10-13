/**
 * UI density — comfortable(기본) / compact(모든 너비에서 조밀).
 * comfortable은 너비 스케일: 768–1279px PC는 조밀 토큰, 1280px 이상은 md 2×.
 * CSS: globals.css `--density-*` · html[data-density]
 * @see docs/UI_DENSITY.md
 */

export const DENSITY_STORAGE_KEY = "dashboard-density";

export type UiDensity = "comfortable" | "compact";

const listeners = new Set<() => void>();

let density: UiDensity = "comfortable";

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function isUiDensity(v: unknown): v is UiDensity {
  return v === "comfortable" || v === "compact";
}

export function readDensityFromDom(): UiDensity {
  if (typeof document === "undefined") return "comfortable";
  const raw = document.documentElement.dataset.density;
  return isUiDensity(raw) ? raw : "comfortable";
}

export function getDashboardDensity(): UiDensity {
  return density;
}

export function subscribeDashboardDensity(listener: () => void): () => void {
  if (typeof document !== "undefined" && listeners.size === 0) {
    density = readDensityFromDom();
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 클라이언트 마운트 시 DOM·localStorage 초기 스크립트와 동기화 */
export function syncDashboardDensityFromDom(): void {
  const next = readDensityFromDom();
  if (next === density) return;
  density = next;
  notify();
}

export function applyDensity(mode: UiDensity) {
  density = mode;
  document.documentElement.dataset.density = mode;
  localStorage.setItem(DENSITY_STORAGE_KEY, mode);
  notify();
}

export function toggleDashboardDensity(): UiDensity {
  const next = nextDensity(density);
  applyDensity(next);
  return next;
}

export function nextDensity(mode: UiDensity): UiDensity {
  return mode === "comfortable" ? "compact" : "comfortable";
}

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
