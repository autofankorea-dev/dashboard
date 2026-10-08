import type { PanelDraft } from "@/lib/controllers/controller-panel-draft";
import { EDIT_START_DRAFT } from "@/lib/controllers/controller-panel-map";
import { clampCommandPresetDraft } from "@/lib/farm/command-presets";

export type CommandDefaultsRow = {
  setpoint_temp: number | string;
  temp_deviation: number | string;
  min_vent_pct: number | string;
  max_vent_pct: number | string;
};

export function commandDefaultsFallback(): PanelDraft {
  return { ...EDIT_START_DRAFT };
}

export function panelDraftFromCommandDefaults(
  row: CommandDefaultsRow | null | undefined,
): PanelDraft {
  if (!row) return commandDefaultsFallback();
  const setpointTemp = Number(row.setpoint_temp);
  const tempDeviation = Number(row.temp_deviation);
  const minVentPct = Number(row.min_vent_pct);
  const maxVentPct = Number(row.max_vent_pct);
  if (
    ![setpointTemp, tempDeviation, minVentPct, maxVentPct].every(Number.isFinite)
  ) {
    return commandDefaultsFallback();
  }
  return clampCommandPresetDraft({
    setpointTemp,
    tempDeviation,
    minVentPct,
    maxVentPct,
  });
}
