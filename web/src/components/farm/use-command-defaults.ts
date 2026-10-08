"use client";

import { useEffect, useState } from "react";
import type { PanelDraft } from "@/lib/controllers/controller-panel-draft";
import { EDIT_START_DRAFT } from "@/lib/controllers/controller-panel-map";
import { panelDraftFromCommandDefaults } from "@/lib/farm/command-defaults";
import { createClient } from "@/lib/supabase/browser";

export function useCommandDefaults(): PanelDraft {
  const [draft, setDraft] = useState<PanelDraft>({ ...EDIT_START_DRAFT });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("command_defaults")
          .select("setpoint_temp, temp_deviation, min_vent_pct, max_vent_pct")
          .eq("id", 1)
          .maybeSingle();
        if (!cancelled) setDraft(panelDraftFromCommandDefaults(data));
      } catch {
        if (!cancelled) setDraft({ ...EDIT_START_DRAFT });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return draft;
}
