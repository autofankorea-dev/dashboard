"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { formatControllerNoLabel } from "@/lib/farm/controller-summary-display";
import {
  bulkPresetButtons,
  commandPresetStorageKey,
  parseCommandPresetList,
  removeCommandPreset,
  snapshotCommandPresetStorage,
  subscribeCommandPresets,
  upsertCommandPreset,
  writeCommandPresets,
  type BulkPresetButton,
  type CommandPreset,
  type CommandPresetChannels,
  type CommandPresetScope,
  type UpsertPresetResult,
} from "@/lib/farm/command-presets";
import type { FarmKey } from "@/lib/domain/farm-key";

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

type SelectedController = {
  farmKey: FarmKey;
  moduleUid: number;
  controllerKey?: string | null;
  eqpmnNo?: string;
};

function selectedPresetGroups(readings: readonly SelectedController[]) {
  const seen = new Set<string>();
  const groups: { scope: CommandPresetScope; mark: string }[] = [];
  for (const reading of readings) {
    if (!reading.controllerKey) continue;
    const scope: CommandPresetScope = {
      farmKey: reading.farmKey,
      moduleUid: reading.moduleUid,
      controllerKey: reading.controllerKey,
    };
    const key = commandPresetStorageKey(scope);
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push({
      scope,
      mark: formatControllerNoLabel(reading.eqpmnNo),
    });
  }
  return groups;
}

export function snapshotSelectedControllerPresets(
  groups: readonly { scope: CommandPresetScope; mark: string }[],
): string {
  if (typeof window === "undefined") return "[]";
  return JSON.stringify(
    groups.map((group) => ({
      mark: group.mark,
      scope: group.scope,
      raw: snapshotCommandPresetStorage(group.scope),
    })),
  );
}

export function useSelectedControllerPresets(
  readings: readonly SelectedController[],
): BulkPresetButton[] {
  const groups = useMemo(() => selectedPresetGroups(readings), [readings]);
  const json = useSyncExternalStore(
    subscribeCommandPresets,
    () => snapshotSelectedControllerPresets(groups),
    () => "[]",
  );
  return useMemo(() => {
    try {
      const rows = JSON.parse(json) as {
        mark?: string;
        scope?: CommandPresetScope;
        raw?: string;
      }[];
      if (!Array.isArray(rows)) return [];
      return bulkPresetButtons(
        rows.flatMap((row) => {
          if (!row.scope?.controllerKey || !row.scope.farmKey) return [];
          let items: CommandPreset[] = [];
          try {
            items = parseCommandPresetList(JSON.parse(row.raw ?? "[]") as unknown);
          } catch {
            items = [];
          }
          return [
            {
              scope: row.scope,
              mark: row.mark || formatControllerNoLabel(undefined),
              items,
            },
          ];
        }),
      );
    } catch {
      return [];
    }
  }, [json]);
}
