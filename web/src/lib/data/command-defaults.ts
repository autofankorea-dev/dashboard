import { createClient } from "@/lib/supabase/server";
import {
  commandDefaultsFallback,
  panelDraftFromCommandDefaults,
} from "@/lib/farm/command-defaults";
import type { PanelDraft } from "@/lib/controllers/controller-panel-draft";

export async function getCommandDefaults(): Promise<PanelDraft> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("command_defaults")
      .select("setpoint_temp, temp_deviation, min_vent_pct, max_vent_pct")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return commandDefaultsFallback();
    return panelDraftFromCommandDefaults(data);
  } catch {
    return commandDefaultsFallback();
  }
}
