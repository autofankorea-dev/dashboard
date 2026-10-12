"use client";

import type { PanelDraft } from "@/lib/controllers/controller-panel-draft";
import { panelDraftFromCommandDefaults } from "@/lib/farm/command-defaults";
import { createClient } from "@/lib/supabase/browser";

/**
 * 브라우저(anon key + RLS)에서 운영 공용 명령 기본값을 읽는다.
 * 실패·미존재 시 `panelDraftFromCommandDefaults(null)` 폴백.
 * 서버 버전은 `@/lib/data/command-defaults`.
 */
export async function fetchCommandDefaultsBrowser(): Promise<PanelDraft> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("command_defaults")
      .select("setpoint_temp, temp_deviation, min_vent_pct, max_vent_pct")
      .eq("id", 1)
      .maybeSingle();
    return panelDraftFromCommandDefaults(data);
  } catch {
    return panelDraftFromCommandDefaults(null);
  }
}
