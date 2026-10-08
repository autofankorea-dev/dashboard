"use client";

import { useEffect, useState } from "react";
import type { CommandPreset } from "@/lib/farm/command-presets";
import { sharedPresetFromRow } from "@/lib/farm/shared-command-presets";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { createClient } from "@/lib/supabase/browser";

export function useSharedCommandPresets(
  stallTyCode: string | null | undefined,
): CommandPreset[] {
  const code = normalizeStallTyCode(stallTyCode);
  const [items, setItems] = useState<CommandPreset[]>([]);

  useEffect(() => {
    if (code === "UNK") {
      setItems([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("command_presets")
          .select("id, stall_ty_code, name, channels, sort_order")
          .eq("stall_ty_code", code)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true });
        if (cancelled) return;
        if (error || !data) {
          setItems([]);
          return;
        }
        setItems(
          data
            .map((row) => sharedPresetFromRow(row))
            .filter((row): row is NonNullable<typeof row> => row != null)
            .map(({ id, name, channels }) => ({ id, name, channels })),
        );
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return items;
}
