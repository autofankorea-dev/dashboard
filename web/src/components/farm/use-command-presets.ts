"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  parseCommandPresetList,
  removeCommandPreset,
  snapshotCommandPresetStorage,
  subscribeCommandPresets,
  upsertCommandPreset,
  writeCommandPresets,
  type CommandPreset,
  type CommandPresetChannels,
  type CommandPresetScope,
  type UpsertPresetResult,
} from "@/lib/farm/command-presets";

export function useCommandPresets(scope: CommandPresetScope | null) {
  const json = useSyncExternalStore(
    subscribeCommandPresets,
    () => snapshotCommandPresetStorage(scope),
    () => "[]",
  );
  const items = useMemo(() => {
    try {
      return parseCommandPresetList(JSON.parse(json) as unknown);
    } catch {
      return [] as CommandPreset[];
    }
  }, [json]);

  const save = useCallback(
    (input: {
      name: string;
      channels: CommandPresetChannels;
    }): UpsertPresetResult => {
      const result = upsertCommandPreset(items, input);
      if (result.ok) writeCommandPresets(scope, result.items);
      return result;
    },
    [items, scope],
  );

  const remove = useCallback(
    (id: string) => {
      writeCommandPresets(scope, removeCommandPreset(items, id));
    },
    [items, scope],
  );

  return useMemo(
    () => ({ items, save, remove, canStore: scope != null }),
    [items, save, remove, scope],
  );
}
