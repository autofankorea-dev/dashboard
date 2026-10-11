"use client";

import { useEffect, useState } from "react";
import type { CommandPreset } from "@/lib/farm/command-presets";
import { sharedPresetFromRow } from "@/lib/farm/shared-command-presets";
import { normalizeStallTyCode } from "@/lib/domain/stall-type";
import { createClient } from "@/lib/supabase/browser";

/** 참조 안정 빈 배열 — 소비자 useMemo/useEffect deps가 매 렌더 변하지 않도록 */
const EMPTY_PRESETS: CommandPreset[] = [];

export function useSharedCommandPresets(
  stallTyCode: string | null | undefined,
): CommandPreset[] {
  const code = normalizeStallTyCode(stallTyCode);
  // 조회한 축사유형 코드를 함께 보관해, 코드가 바뀐 직후 이전 유형의 목록이 노출되지 않게 한다.
  const [loaded, setLoaded] = useState<{ code: string; items: CommandPreset[] }>({
    code: "UNK",
    items: [],
  });

  useEffect(() => {
    if (code === "UNK") return;
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
          setLoaded({ code, items: [] });
          return;
        }
        setLoaded({
          code,
          items: data
            .map((row) => sharedPresetFromRow(row))
            .filter((row): row is NonNullable<typeof row> => row != null)
            .map(({ id, name, channels }) => ({ id, name, channels })),
        });
      } catch {
        if (!cancelled) setLoaded({ code, items: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return loaded.code === code ? loaded.items : EMPTY_PRESETS;
}
