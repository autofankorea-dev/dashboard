export type ControllerMetaEntry = {
  controllerKey: string;
  eqpmnNo: string;
  displayName: string;
  /** @deprecated legacy ui_config */
  idx?: number;
};

export type ControllerMetaConfig = {
  controllers: ControllerMetaEntry[];
};

export const EMPTY_CONTROLLER_META: ControllerMetaConfig = { controllers: [] };

export function parseControllerMeta(raw: unknown): ControllerMetaConfig {
  if (!raw || typeof raw !== "object") return EMPTY_CONTROLLER_META;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.controllers)) return EMPTY_CONTROLLER_META;
  const controllers = obj.controllers
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => {
      const controllerKey =
        String(c.controllerKey ?? c.controller_key ?? "").trim() ||
        (Number.isInteger(Number(c.idx))
          ? `legacy:idx:${Number(c.idx)}`
          : "");
      return {
        controllerKey,
        eqpmnNo: String(c.eqpmnNo ?? c.eqpmn_no ?? "").padStart(2, "0"),
        displayName: String(c.displayName ?? c.display_name ?? "").trim(),
        idx: Number.isInteger(Number(c.idx)) ? Number(c.idx) : undefined,
      };
    })
    .filter((c) => c.controllerKey.length > 0 && c.displayName.length > 0);
  return { controllers };
}

export function controllerDisplayName(
  controllerKey: string,
  eqpmnNo: string,
  metas: ControllerMetaEntry[]
): string | null {
  const hit = metas.find(
    (m) => m.controllerKey === controllerKey || m.eqpmnNo === eqpmnNo
  );
  return hit?.displayName ?? null;
}
