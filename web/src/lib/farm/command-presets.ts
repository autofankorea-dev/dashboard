import {
  clampMenuValue,
} from "@/lib/controllers/controller-panel-map";
import type {
  ChannelGlanceRow,
  PanelDraft,
} from "@/lib/controllers/controller-panel-draft";
import type { ChannelSlot } from "@/lib/data/iot-channel";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";

export const COMMAND_PRESET_STORAGE_PREFIX = "dashboard.command-presets.v1";
export const COMMAND_PRESET_MAX = 8;
export const COMMAND_PRESET_NAME_MAX = 12;

export type CommandPresetChannels = Partial<Record<ChannelSlot, PanelDraft>>;

export type CommandPreset = {
  id: string;
  name: string;
  channels: CommandPresetChannels;
};

export type CommandPresetScope = {
  farmKey: FarmKey;
  moduleUid: number;
  controllerKey: string;
};

export type UpsertPresetResult =
  | { ok: true; items: CommandPreset[]; id: string }
  | { ok: false; reason: "empty-name" | "empty-channels" | "full" };

const SLOTS: ChannelSlot[] = ["A", "B", "C"];

export function commandPresetStorageKey(scope: CommandPresetScope): string {
  return `${COMMAND_PRESET_STORAGE_PREFIX}:${farmKeyId(scope.farmKey)}:${scope.moduleUid}:${scope.controllerKey}`;
}

export function clampCommandPresetDraft(raw: PanelDraft): PanelDraft {
  let min = clampMenuValue("minVent", raw.minVentPct);
  let max = clampMenuValue("maxVent", raw.maxVentPct);
  if (min > max) [min, max] = [max, min];
  return {
    setpointTemp: clampMenuValue("setpoint", raw.setpointTemp),
    tempDeviation: clampMenuValue("deviation", raw.tempDeviation),
    minVentPct: min,
    maxVentPct: max,
  };
}

function isDraft(value: unknown): value is PanelDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as PanelDraft;
  return (
    Number.isFinite(d.setpointTemp) &&
    Number.isFinite(d.tempDeviation) &&
    Number.isFinite(d.minVentPct) &&
    Number.isFinite(d.maxVentPct)
  );
}

function sanitizeChannels(raw: unknown): CommandPresetChannels {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: CommandPresetChannels = {};
  for (const slot of SLOTS) {
    const item = src[slot];
    if (!isDraft(item)) continue;
    out[slot] = clampCommandPresetDraft(item);
  }
  return out;
}

export function normalizePresetName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, COMMAND_PRESET_NAME_MAX);
}

export function hasPresetChannels(channels: CommandPresetChannels): boolean {
  return SLOTS.some((slot) => channels[slot] != null);
}

export function parseCommandPresetList(raw: unknown): CommandPreset[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : [];
  const seen = new Set<string>();
  const items: CommandPreset[] = [];
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { id?: unknown; name?: unknown; channels?: unknown };
    const name = typeof rec.name === "string" ? normalizePresetName(rec.name) : "";
    const channels = sanitizeChannels(rec.channels);
    if (!name || !hasPresetChannels(channels)) continue;
    const id =
      typeof rec.id === "string" && rec.id.trim()
        ? rec.id.trim()
        : `p-${items.length}`;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ id, name, channels });
    if (items.length >= COMMAND_PRESET_MAX) break;
  }
  return items;
}

export function snapshotCommandPresetChannels(
  rows: readonly ChannelGlanceRow[],
  fallback?: PanelDraft | null,
): CommandPresetChannels {
  const out: CommandPresetChannels = {};
  for (const row of rows) {
    if (!row.present || !row.values) continue;
    out[row.slot] = clampCommandPresetDraft(row.values);
  }
  if (!hasPresetChannels(out) && fallback) {
    out.A = clampCommandPresetDraft(fallback);
  }
  return out;
}

export function upsertCommandPreset(
  items: readonly CommandPreset[],
  input: { name: string; channels: CommandPresetChannels },
): UpsertPresetResult {
  const name = normalizePresetName(input.name);
  const channels = sanitizeChannels(input.channels);
  if (!name) return { ok: false, reason: "empty-name" };
  if (!hasPresetChannels(channels)) return { ok: false, reason: "empty-channels" };

  const existing = items.findIndex((item) => item.name === name);
  if (existing >= 0) {
    const next = items.map((item, i) =>
      i === existing ? { ...item, channels } : item,
    );
    return { ok: true, items: next, id: items[existing].id };
  }
  if (items.length >= COMMAND_PRESET_MAX) {
    return { ok: false, reason: "full" };
  }
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `p-${crypto.randomUUID()}`
      : `p-${Date.now().toString(36)}`;
  return { ok: true, items: [...items, { id, name, channels }], id };
}

export function removeCommandPreset(
  items: readonly CommandPreset[],
  id: string,
): CommandPreset[] {
  return items.filter((item) => item.id !== id);
}

const presetListeners = new Set<() => void>()

function notifyCommandPresetListeners() {
  for (const listener of presetListeners) listener()
}

export function subscribeCommandPresets(onStoreChange: () => void): () => void {
  presetListeners.add(onStoreChange)
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStoreChange)
  }
  return () => {
    presetListeners.delete(onStoreChange)
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStoreChange)
    }
  };
}

export function readCommandPresets(scope: CommandPresetScope | null): CommandPreset[] {
  if (!scope || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(commandPresetStorageKey(scope));
    if (!raw) return [];
    return parseCommandPresetList(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function snapshotCommandPresetStorage(scope: CommandPresetScope | null): string {
  if (!scope || typeof window === "undefined") return "[]";
  try {
    return window.localStorage.getItem(commandPresetStorageKey(scope)) ?? "[]";
  } catch {
    return "[]";
  }
}

export function writeCommandPresets(
  scope: CommandPresetScope | null,
  items: readonly CommandPreset[],
): void {
  if (!scope || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      commandPresetStorageKey(scope),
      JSON.stringify({ v: 1, items: parseCommandPresetList(items) }),
    );
    notifyCommandPresetListeners();
  } catch {
    /* quota · private mode */
  }
}
