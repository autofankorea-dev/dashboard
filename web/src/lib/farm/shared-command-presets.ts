import type { PanelDraft } from "@/lib/controllers/controller-panel-draft";
import {
  COMMAND_PRESET_MAX,
  clampCommandPresetDraft,
  hasPresetChannels,
  normalizePresetName,
  parseCommandPresetList,
  type CommandPreset,
  type CommandPresetChannels,
} from "@/lib/farm/command-presets";
import { normalizeStallTyCode } from "@/lib/data/stall-type";

export type SharedCommandPreset = CommandPreset & {
  stallTyCode: string;
  sortOrder: number;
};

export type SharedPresetListItem = CommandPreset & {
  source: "shared" | "personal";
  removable: boolean;
};

export function sanitizeSharedPresetChannels(
  raw: unknown,
): CommandPresetChannels {
  const parsed = parseCommandPresetList([
    { id: "tmp", name: "tmp", channels: raw },
  ]);
  return parsed[0]?.channels ?? {};
}

export function sharedPresetFromRow(row: {
  id: string;
  stall_ty_code: string;
  name: string;
  channels: unknown;
  sort_order: number | null;
}): SharedCommandPreset | null {
  const stallTyCode = normalizeStallTyCode(row.stall_ty_code);
  if (stallTyCode === "UNK") return null;
  const name = normalizePresetName(row.name);
  const channels = sanitizeSharedPresetChannels(row.channels);
  if (!name || !hasPresetChannels(channels)) return null;
  return {
    id: row.id,
    stallTyCode,
    name,
    channels,
    sortOrder: row.sort_order ?? 0,
  };
}

export function mergePresetStripItems(opts: {
  shared: readonly CommandPreset[];
  personal: readonly CommandPreset[];
}): SharedPresetListItem[] {
  const shared = opts.shared.map((item) => ({
    ...item,
    source: "shared" as const,
    removable: false,
  }));
  const personal = opts.personal.map((item) => ({
    ...item,
    source: "personal" as const,
    removable: true,
  }));
  return [...shared, ...personal];
}

export function channelsPayloadForDb(
  channels: CommandPresetChannels,
): Record<string, PanelDraft> {
  const out: Record<string, PanelDraft> = {};
  for (const slot of ["A", "B", "C"] as const) {
    const raw = channels[slot];
    if (!raw) continue;
    out[slot] = clampCommandPresetDraft(raw);
  }
  return out;
}

export function canAddSharedPreset(
  existingCount: number,
): boolean {
  return existingCount < COMMAND_PRESET_MAX;
}
