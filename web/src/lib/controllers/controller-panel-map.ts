export type PanelMenuId = "setpoint" | "deviation" | "minVent" | "maxVent";

export type PanelMenuStep = {
  step: number;
  min: number;
  max: number;
  unit: string;
  decimals: number;
};

export const PANEL_MENU_ITEMS: { id: PanelMenuId; label: string }[] = [
  { id: "setpoint", label: "설정 온도" },
  { id: "deviation", label: "온도 편차" },
  { id: "minVent", label: "최저 환기" },
  { id: "maxVent", label: "최고 환기" },
];

export const MENU_STEPS: Record<PanelMenuId, PanelMenuStep> = {
  setpoint: { step: 0.1, min: 0, max: 30, unit: "℃", decimals: 1 },
  deviation: { step: 0.1, min: 0.5, max: 10, unit: "℃", decimals: 1 },
  minVent: { step: 1, min: 0, max: 100, unit: "%", decimals: 0 },
  maxVent: { step: 1, min: 0, max: 100, unit: "%", decimals: 0 },
};

/** 명령·설정 이력 없을 때 편집 시작값 */
export const EDIT_START_DRAFT = {
  setpointTemp: 25,
  tempDeviation: 2,
  minVentPct: 10,
  maxVentPct: 100,
};

export function clampMenuValue(menu: PanelMenuId, raw: number): number {
  const cfg = MENU_STEPS[menu];
  const snapped = snapToStep(raw, cfg.step, cfg.min);
  return Math.min(cfg.max, Math.max(cfg.min, snapped));
}

/**
 * step 격자 스냅 후 소수 자릿수로 재반올림 (0.1×정수 FP 꼬리 제거).
 * `origin`이 있으면 (raw - origin)을 step 배수로 맞춤 (메뉴 min 기준).
 */
export function snapToStep(raw: number, step: number, origin = 0): number {
  if (!Number.isFinite(raw) || !Number.isFinite(step) || step <= 0) return raw;
  const steps = Math.round((raw - origin) / step);
  let snapped = origin + steps * step;
  const decimals = Math.max(0, Math.min(6, Math.round(-Math.log10(step))));
  const factor = 10 ** decimals;
  snapped = Math.round(snapped * factor) / factor;
  return snapped;
}

export function formatMenuValue(menu: PanelMenuId, value: number): string {
  const cfg = MENU_STEPS[menu];
  const n =
    cfg.decimals === 0 ? String(Math.round(value)) : value.toFixed(cfg.decimals);
  return cfg.unit === "℃" ? `${n}℃` : `${n}%`;
}
