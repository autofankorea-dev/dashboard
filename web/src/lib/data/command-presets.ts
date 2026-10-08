import { createClient } from "@/lib/supabase/server";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import {
  sharedPresetFromRow,
  type SharedCommandPreset,
} from "@/lib/farm/shared-command-presets";

export async function listSharedCommandPresets(
  stallTyCode: string,
): Promise<SharedCommandPreset[]> {
  const code = normalizeStallTyCode(stallTyCode);
  if (code === "UNK") return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("command_presets")
      .select("id, stall_ty_code, name, channels, sort_order")
      .eq("stall_ty_code", code)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error || !data) return [];
    return data
      .map((row) => sharedPresetFromRow(row))
      .filter((row): row is SharedCommandPreset => row != null);
  } catch {
    return [];
  }
}

export async function listAllSharedCommandPresets(): Promise<
  SharedCommandPreset[]
> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("command_presets")
      .select("id, stall_ty_code, name, channels, sort_order")
      .order("stall_ty_code", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error || !data) return [];
    return data
      .map((row) => sharedPresetFromRow(row))
      .filter((row): row is SharedCommandPreset => row != null);
  } catch {
    return [];
  }
}
