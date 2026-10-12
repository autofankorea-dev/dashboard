import "server-only";

import { omitRetiredProfileUiConfigKeys } from "@/lib/domain/profile-ui-retired";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

/** profiles.ui_config 병합 저장 — row 없으면 viewer 로 insert */
export async function mergeProfileUiConfig(
  patch: (prev: Record<string, unknown>) => Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data, error: loadErr } = await supabase
    .from("profiles")
    .select("ui_config")
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };

  const prev =
    data?.ui_config && typeof data.ui_config === "object"
      ? (data.ui_config as Record<string, unknown>)
      : {};
  const ui_config = omitRetiredProfileUiConfigKeys(patch(prev)) as unknown as Json;

  if (data) {
    const { error } = await supabase
      .from("profiles")
      .update({ ui_config })
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { error } = await supabase.from("profiles").insert({
    user_id: user.id,
    role: "viewer",
    ui_config,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
