import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { omitRetiredProfileUiConfigKeys } from "@/lib/domain/profile-ui-retired";
import type { ControllerMetaEntry } from "@/lib/domain/controller-meta-shared";

export type {
  ControllerMetaConfig,
  ControllerMetaEntry,
} from "@/lib/domain/controller-meta-shared";

export { controllerDisplayName } from "@/lib/domain/controller-meta-shared";

/** profiles.ui_config — getCurrentUser와 동일 요청 내 캐시 공유 */
export async function getControllerMetas(): Promise<ControllerMetaEntry[]> {
  const user = await getCurrentUser();
  return user?.controllerMetas ?? [];
}

export async function upsertControllerDisplayName(
  controllerKey: string,
  eqpmnNo: string,
  displayName: string
): Promise<{ ok: boolean; error?: string }> {
  const metas = await getControllerMetas();
  const trimmed = displayName.trim();
  const next = metas.filter((m) => m.controllerKey !== controllerKey);
  if (trimmed) {
    next.push({ controllerKey, eqpmnNo, displayName: trimmed });
  }
  next.sort((a, b) => a.controllerKey.localeCompare(b.controllerKey));
  return saveControllerMetas(next);
}

export async function saveControllerMetas(
  controllers: ControllerMetaEntry[]
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

  const ui_config = {
    ...omitRetiredProfileUiConfigKeys(prev),
    controllers: controllers.filter((c) => c.displayName.trim().length > 0),
  };

  const { error } = await supabase
    .from("profiles")
    .update({ ui_config })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
