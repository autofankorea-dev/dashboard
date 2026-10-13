import {
  clampMenuValue,
  snapToStep,
} from "@/lib/controllers/controller-panel-map";
import type {
  ChannelGlanceRow,
  PanelDraft,
} from "@/lib/controllers/controller-panel-draft";
import type { ChannelSlot } from "@/lib/domain/iot-channel";
import { farmKeyId, type FarmKey } from "@/lib/domain/farm-key";
import { motionDuration } from "@/lib/ui/motion-tokens";

export const COMMAND_PRESET_STORAGE_PREFIX = "dashboard.command-presets.v1";
export const COMMAND_PRESET_MAX = 8;
export const COMMAND_PRESET_NAME_MAX = 12;
/** 생성 카드 환기 스테퍼만. 패널 명령 단위(`MENU_STEPS` 1%)는 유지. */
export const PRESET_VENT_STEP = 5;
/** 클릭과 홀드를 가르는 첫 대기 */
export const PRESET_STEPPER_HOLD_DELAY_MS = motionDuration.emphasis;
/** 홀드 이후 연속 동작 간격 */
export const PRESET_STEPPER_HOLD_INTERVAL_MS = motionDuration.fast;

export type PresetCreateField = keyof PanelDraft;

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

export function clampPresetVent(raw: number): number {
  return Math.min(100, Math.max(0, snapToStep(raw, PRESET_VENT_STEP, 0)));
}

export function applyPresetCreateField(
  draft: PanelDraft,
  field: PresetCreateField,
  value: number,
): PanelDraft {
  const next: PanelDraft = { ...draft, [field]: value };
  next.setpointTemp = clampMenuValue("setpoint", next.setpointTemp);
  next.tempDeviation = clampMenuValue("deviation", next.tempDeviation);
  let min = clampPresetVent(next.minVentPct);
  let max = clampPresetVent(next.maxVentPct);
  if (field === "minVentPct" && min > max) max = min;
  if (field === "maxVentPct" && max < min) min = max;
  if (min > max) [min, max] = [max, min];
  next.minVentPct = min;
  next.maxVentPct = max;
  return next;
}

export function clampPresetCreateDraft(raw: PanelDraft): PanelDraft {
  let min = clampPresetVent(raw.minVentPct);
  let max = clampPresetVent(raw.maxVentPct);
  if (min > max) [min, max] = [max, min];
  return {
    setpointTemp: clampMenuValue("setpoint", raw.setpointTemp),
    tempDeviation: clampMenuValue("deviation", raw.tempDeviation),
    minVentPct: min,
    maxVentPct: max,
  };
}

export function seedPresetCreateChannels(
  channels: CommandPresetChannels,
): CommandPresetChannels {
  const out: CommandPresetChannels = {};
  for (const slot of SLOTS) {
    const raw = channels[slot];
    if (!raw) continue;
    out[slot] = clampPresetCreateDraft(raw);
  }
  return out;
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

export function commandPresetChannelSignature(
  channels: CommandPresetChannels,
): string {
  return SLOTS.map((slot) => {
    const draft = channels[slot];
    if (!draft) return `${slot}:`;
    return `${slot}:${draft.setpointTemp},${draft.tempDeviation},${draft.minVentPct},${draft.maxVentPct}`;
  }).join("|");
}

export type BulkPresetButton = CommandPreset & {
  sourceId: string;
  scope: CommandPresetScope;
  title: string;
};

export type ControllerPresetGroup = {
  scope: CommandPresetScope;
  mark: string;
  items: readonly CommandPreset[];
};

/** 선택한 컨트롤러의 개인 프리셋. 같은 이름·같은 값은 하나, 값이 다르면 기기 표시를 붙인다. */
export function bulkPresetButtons(
  groups: readonly ControllerPresetGroup[],
): BulkPresetButton[] {
  const entries: {
    scope: CommandPresetScope;
    mark: string;
    item: CommandPreset;
    signature: string;
  }[] = [];
  const signaturesByName = new Map<string, Set<string>>();
  for (const group of groups) {
    for (const item of group.items) {
      const signature = commandPresetChannelSignature(item.channels);
      entries.push({
        scope: group.scope,
        mark: group.mark,
        item,
        signature,
      });
      const signatures = signaturesByName.get(item.name) ?? new Set<string>();
      signatures.add(signature);
      signaturesByName.set(item.name, signatures);
    }
  }

  const seen = new Set<string>();
  const usedLabels = new Set<string>();
  const out: BulkPresetButton[] = [];
  for (const entry of entries) {
    const dedupeKey = `${entry.item.name}|${entry.signature}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const ambiguous = (signaturesByName.get(entry.item.name)?.size ?? 0) > 1;
    let name = ambiguous ? `${entry.item.name} · ${entry.mark}` : entry.item.name;
    if (usedLabels.has(name)) {
      name = `${name} · ${entry.scope.controllerKey}`;
    }
    usedLabels.add(name);
    out.push({
      id: `${commandPresetStorageKey(entry.scope)}:${entry.item.id}`,
      sourceId: entry.item.id,
      scope: entry.scope,
      name,
      channels: entry.item.channels,
      title: `${entry.mark}에 저장한 설정값`,
    });
  }
  return out;
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
