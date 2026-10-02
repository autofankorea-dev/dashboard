/** v0x0A controller business identity: stallTyCode + stallNo + eqpmnNo */

export type ControllerAddress = {
  stallTyCode: string;
  stallNo: string;
  eqpmnNo: string;
};

/** 컨트롤러 번호. 1~99는 두 자리 그대로 둔다. */
export function normalizeEqpmnNo(raw: unknown): string {
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1 && n <= 99) {
    return String(n).padStart(2, "0");
  }
  const s = String(raw ?? "").trim();
  if (/^(0[1-9]|[1-9][0-9])$/.test(s)) return s;
  return "01";
}

export function controllerKey(addr: ControllerAddress): string {
  return `${addr.stallTyCode}:${addr.stallNo}:${normalizeEqpmnNo(addr.eqpmnNo)}`;
}

export function controllerKeyFromParts(
  stallTyCode: string | null | undefined,
  stallNo: string | null | undefined,
  eqpmnNo: string | null | undefined
): string | null {
  const ty = stallTyCode?.trim();
  const sn = stallNo?.trim();
  const eq = eqpmnNo?.trim();
  if (!ty || !sn || !eq) return null;
  return controllerKey({
    stallTyCode: ty,
    stallNo: sn,
    eqpmnNo: normalizeEqpmnNo(eq),
  });
}

/** Legacy v0x09 decoded row fallback */
export function legacyControllerKey(idx: number): string {
  return `legacy:idx:${idx}`;
}

export function resolveControllerKey(c: {
  controllerKey?: unknown;
  stallTyCode?: unknown;
  stallNo?: unknown;
  eqpmnNo?: unknown;
  idx?: unknown;
}): string {
  if (typeof c.controllerKey === "string" && c.controllerKey.trim()) {
    return c.controllerKey.trim();
  }
  const built = controllerKeyFromParts(
    pickStr(c.stallTyCode),
    pickStr(c.stallNo),
    pickStr(c.eqpmnNo)
  );
  if (built) return built;
  const idx = Number(c.idx);
  if (Number.isInteger(idx) && idx >= 0) return legacyControllerKey(idx);
  return "legacy:unknown";
}

function pickStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

export function compareControllerKeys(a: string, b: string): number {
  return a.localeCompare(b, "ko", { numeric: true });
}
