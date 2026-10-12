/**
 * 필드 덮개 → 상세 FLIP. 실행: npx vitest run src/lib/farm/cover-reveal-morph.test.ts
 */
export type CoverMorphRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type CoverMorphBand = "temp" | "humidity";

export type CoverMorphSnapshot = {
  identity: CoverMorphRect | null;
  marks: CoverMorphRect | null;
  value: CoverMorphRect | null;
  bandLabel: CoverMorphRect | null;
  identityText: string;
  marksText: string;
  valueText: string;
  bandText: string;
  band: CoverMorphBand;
};

export type CoverMorphTargets = {
  identity: CoverMorphRect | null;
  marks: CoverMorphRect | null;
  band: CoverMorphRect | null;
};

export type CoverMorphFlip = {
  x: number;
  y: number;
  sx: number;
  sy: number;
};

export function relativeRect(
  el: Element,
  root: Element,
): CoverMorphRect {
  const a = el.getBoundingClientRect();
  const b = root.getBoundingClientRect();
  return {
    left: a.left - b.left,
    top: a.top - b.top,
    width: a.width,
    height: a.height,
  };
}

export function unionRect(
  a: CoverMorphRect,
  b: CoverMorphRect,
): CoverMorphRect {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  const right = Math.max(a.left + a.width, b.left + b.width);
  const bottom = Math.max(a.top + a.height, b.top + b.height);
  return { left, top, width: right - left, height: bottom - top };
}

export function flipInvert(
  first: CoverMorphRect,
  last: CoverMorphRect,
): CoverMorphFlip {
  const sx = last.width === 0 ? 1 : first.width / last.width;
  const sy = last.height === 0 ? 1 : first.height / last.height;
  return {
    x: first.left - last.left,
    y: first.top - last.top,
    sx,
    sy,
  };
}

function queryRect(
  root: HTMLElement,
  selector: string,
): CoverMorphRect | null {
  const el = root.querySelector(selector);
  return el ? relativeRect(el, root) : null;
}

export function captureCoverMorphSnapshot(
  root: HTMLElement | null,
): CoverMorphSnapshot | null {
  if (!root) return null;
  const identityEl = root.querySelector("[data-cover-morph='identity']");
  const marksEl = root.querySelector("[data-cover-morph='marks']");
  const valueEl = root.querySelector("[data-cover-morph='value']");
  const bandEl = root.querySelector("[data-cover-morph='band']");
  const valueText = valueEl?.textContent?.trim() ?? "";
  const bandText = bandEl?.textContent?.trim() ?? "";
  return {
    identity: identityEl ? relativeRect(identityEl, root) : null,
    marks: marksEl ? relativeRect(marksEl, root) : null,
    value: valueEl ? relativeRect(valueEl, root) : null,
    bandLabel: bandEl ? relativeRect(bandEl, root) : null,
    identityText: identityEl?.textContent?.trim() ?? "",
    marksText: marksEl?.textContent?.trim() ?? "",
    valueText,
    bandText,
    band: valueText.includes("%") ? "humidity" : "temp",
  };
}

export function captureCoverMorphTargets(
  root: HTMLElement | null,
  band: CoverMorphBand,
): CoverMorphTargets | null {
  if (!root) return null;
  const bandSel =
    band === "humidity"
      ? "[data-cover-morph-target='humidity-band']"
      : "[data-cover-morph-target='temp-band']";
  return {
    identity: queryRect(root, "[data-cover-morph-target='identity']"),
    marks: queryRect(root, "[data-cover-morph-target='marks']"),
    band: queryRect(root, bandSel),
  };
}

export function coverMorphDurationMs(): number {
  if (typeof window === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--motion-duration-emphasis")
    .trim();
  const ms = Number.parseFloat(raw);
  return Number.isFinite(ms) ? ms : 0;
}

export function prefersCoverMorphReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
