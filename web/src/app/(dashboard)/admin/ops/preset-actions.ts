"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ADMIN_OPS_BASE_PATH } from "@/lib/admin/ops-tabs";
import {
  COMMAND_PRESET_MAX,
  clampCommandPresetDraft,
  hasPresetChannels,
  normalizePresetName,
  type CommandPresetChannels,
} from "@/lib/farm/command-presets";
import { channelsPayloadForDb } from "@/lib/farm/shared-command-presets";
import { panelDraftFromCommandDefaults } from "@/lib/farm/command-defaults";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export type PresetActionResult =
  | { ok: true }
  | { ok: false; error: string };

function revalidateOps() {
  revalidatePath(ADMIN_OPS_BASE_PATH);
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return null;
  return user;
}

export async function saveCommandDefaultsAction(input: {
  setpointTemp: number;
  tempDeviation: number;
  minVentPct: number;
  maxVentPct: number;
}): Promise<PresetActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: "관리자만 변경할 수 있습니다." };

  const draft = clampCommandPresetDraft({
    setpointTemp: input.setpointTemp,
    tempDeviation: input.tempDeviation,
    minVentPct: input.minVentPct,
    maxVentPct: input.maxVentPct,
  });

  const supabase = await createClient();
  const { error } = await supabase.from("command_defaults").upsert(
    {
      id: 1,
      setpoint_temp: draft.setpointTemp,
      temp_deviation: draft.tempDeviation,
      min_vent_pct: draft.minVentPct,
      max_vent_pct: draft.maxVentPct,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: "id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidateOps();
  return { ok: true };
}

export async function upsertSharedCommandPresetAction(input: {
  id?: string;
  stallTyCode: string;
  name: string;
  channels: CommandPresetChannels;
}): Promise<PresetActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: "관리자만 변경할 수 있습니다." };

  const stallTyCode = normalizeStallTyCode(input.stallTyCode);
  if (stallTyCode === "UNK") {
    return { ok: false, error: "축사유형 코드가 올바르지 않습니다." };
  }
  const name = normalizePresetName(input.name);
  if (!name) return { ok: false, error: "이름을 입력하세요." };
  if (!hasPresetChannels(input.channels)) {
    return { ok: false, error: "저장할 채널 값이 없습니다." };
  }
  const channels = channelsPayloadForDb(input.channels) as Json;

  const supabase = await createClient();
  if (!input.id) {
    const { count, error: countError } = await supabase
      .from("command_presets")
      .select("id", { count: "exact", head: true })
      .eq("stall_ty_code", stallTyCode);
    if (countError) return { ok: false, error: countError.message };
    if ((count ?? 0) >= COMMAND_PRESET_MAX) {
      return { ok: false, error: "축사유형당 8개까지입니다." };
    }
    const { error } = await supabase.from("command_presets").insert({
      stall_ty_code: stallTyCode,
      name,
      channels,
      sort_order: count ?? 0,
      created_by: user.id,
      updated_by: user.id,
    });
    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "같은 이름의 프리셋이 있습니다." };
      }
      return { ok: false, error: error.message };
    }
  } else {
    const { error } = await supabase
      .from("command_presets")
      .update({
        name,
        channels,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", input.id)
      .eq("stall_ty_code", stallTyCode);
    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "같은 이름의 프리셋이 있습니다." };
      }
      return { ok: false, error: error.message };
    }
  }
  revalidateOps();
  return { ok: true };
}

export async function deleteSharedCommandPresetAction(
  id: string,
): Promise<PresetActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: "관리자만 변경할 수 있습니다." };
  if (!id.trim()) return { ok: false, error: "대상이 없습니다." };

  const supabase = await createClient();
  const { error } = await supabase.from("command_presets").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateOps();
  return { ok: true };
}

/** 서버에서 읽은 기본값을 직렬화 가능한 형태로 */
export async function peekCommandDefaultsForAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("command_defaults")
    .select("setpoint_temp, temp_deviation, min_vent_pct, max_vent_pct")
    .eq("id", 1)
    .maybeSingle();
  return panelDraftFromCommandDefaults(data);
}
