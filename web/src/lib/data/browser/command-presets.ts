"use client";

import { normalizeStallTyCode } from "@/lib/domain/stall-type";
import type { CommandPreset } from "@/lib/farm/command-presets";
import { sharedPresetFromRow } from "@/lib/farm/shared-command-presets";
import { createClient } from "@/lib/supabase/browser";

/**
 * 브라우저(anon key + RLS)에서 축사유형별 공용 프리셋을 읽는다.
 * 서버 버전은 `@/lib/data/command-presets`.
 */
export async function fetchSharedCommandPresetsBrowser(
  stallTyCode: string,
): Promise<CommandPreset[]> {
  const code = normalizeStallTyCode(stallTyCode);
  if (code === "UNK") return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("command_presets")
      .select("id, stall_ty_code, name, channels, sort_order")
      .eq("stall_ty_code", code)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error || !data) return [];
    return data
      .map((row) => sharedPresetFromRow(row))
      .filter((row): row is NonNullable<typeof row> => row != null)
      .map(({ id, name, channels }) => ({ id, name, channels }));
  } catch {
    return [];
  }
}
