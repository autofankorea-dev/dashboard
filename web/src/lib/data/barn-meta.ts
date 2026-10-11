import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createRlsClient, getAccessTokenOrNull } from "@/lib/supabase/rls-client";
import { cachedLiveQuery } from "@/lib/data/live-cache";
import {
  PROFILE_UI_META_REVALIDATE_SECONDS,
  PROFILE_UI_META_TAG,
  revalidateProfileUiMetaCache,
} from "@/lib/data/profile-ui-meta-cache";
import { omitRetiredProfileUiConfigKeys } from "@/lib/domain/profile-ui-retired";

import type {
  BarnLayoutPrefs,
  BarnMeta,
  BarnMetaType,
} from "@/lib/domain/barn-meta-types";

/** 타입 정본은 `@/lib/domain/barn-meta-types` — 기존 import 경로 호환용 재export */
export type { BarnLayoutPrefs, BarnMeta, BarnMetaType };

type UiConfig = {
  barnLayouts?: Record<string, { col: number; row: number }>;
  barnAliases?: Record<string, string>;
};

const EMPTY_CONFIG: UiConfig = {};

function parseUiConfig(raw: unknown): UiConfig {
  if (!raw || typeof raw !== "object") return EMPTY_CONFIG;
  const obj = raw as Record<string, unknown>;
  return {
    barnLayouts: parseLayoutRecord(obj.barnLayouts),
    barnAliases: parseAliasRecord(obj.barnAliases),
  };
}

function parseLayoutRecord(
  raw: unknown
): Record<string, { col: number; row: number }> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, { col: number; row: number }> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== "object") continue;
    const g = val as Record<string, unknown>;
    const col = Number(g.col);
    const row = Number(g.row);
    if (Number.isFinite(col) && Number.isFinite(row)) {
      out[key] = {
        col: Math.max(1, Math.min(8, col)),
        row: Math.max(1, Math.min(8, row)),
      };
    }
  }
  return out;
}

function parseAliasRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const s = String(val ?? "").trim();
    if (s) out[key] = s;
  }
  return out;
}

function asUiConfigObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}

/** 지도 레이아웃·별칭 (자동 축사 카드용) — cross-request 60s cache */
export async function getBarnLayoutPrefs(): Promise<BarnLayoutPrefs> {
  const empty: BarnLayoutPrefs = { layouts: {}, aliases: {} };
  const accessToken = await getAccessTokenOrNull();
  if (!accessToken) return empty;

  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) return empty;

  return cachedLiveQuery(
    ["barn-layout-prefs", user.id],
    [PROFILE_UI_META_TAG, `${PROFILE_UI_META_TAG}:${user.id}`],
    async () => {
      const supabase = createRlsClient(accessToken);
      const { data, error } = await supabase
        .from("profiles")
        .select("ui_config")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data) return empty;

      const cfg = parseUiConfig(data.ui_config);
      return {
        layouts: cfg.barnLayouts ?? {},
        aliases: cfg.barnAliases ?? {},
      };
    },
    { revalidate: PROFILE_UI_META_REVALIDATE_SECONDS },
  );
}

/** catalogKey 기준 그리드 위치 저장 */
export async function saveBarnLayouts(
  layouts: Record<string, { col: number; row: number }>
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: existing, error: loadErr } = await supabase
    .from("profiles")
    .select("ui_config")
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };

  const prev = omitRetiredProfileUiConfigKeys(asUiConfigObject(existing?.ui_config));

  const normalized: Record<string, { col: number; row: number }> = {};
  for (const [key, g] of Object.entries(layouts)) {
    normalized[key] = {
      col: Math.max(1, Math.min(8, g.col)),
      row: Math.max(1, Math.min(8, g.row)),
    };
  }

  const ui_config = { ...prev, barnLayouts: normalized };

  const { error } = await supabase
    .from("profiles")
    .update({ ui_config })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidateProfileUiMetaCache(user.id);
  return { ok: true };
}

/** 신규 SP 자동 배치 좌표를 기존 layouts에 병합 저장 */
export async function mergeBarnLayouts(
  partial: Record<string, { col: number; row: number }>
): Promise<{ ok: boolean; error?: string }> {
  if (Object.keys(partial).length === 0) return { ok: true };
  const prefs = await getBarnLayoutPrefs();
  return saveBarnLayouts({ ...prefs.layouts, ...partial });
}

/** 변경된 카드만 1회 read·write (드래그 저장용) */
export async function patchBarnLayouts(
  partial: Record<string, { col: number; row: number }>
): Promise<{ ok: boolean; error?: string }> {
  if (Object.keys(partial).length === 0) return { ok: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: existing, error: loadErr } = await supabase
    .from("profiles")
    .select("ui_config")
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };

  const prev = omitRetiredProfileUiConfigKeys(asUiConfigObject(existing?.ui_config));

  const prevLayouts =
    prev.barnLayouts && typeof prev.barnLayouts === "object"
      ? (prev.barnLayouts as Record<string, { col: number; row: number }>)
      : {};

  const nextLayouts = { ...prevLayouts };
  for (const [key, g] of Object.entries(partial)) {
    nextLayouts[key] = {
      col: Math.max(1, Math.min(8, g.col)),
      row: Math.max(1, Math.min(8, g.row)),
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ ui_config: { ...prev, barnLayouts: nextLayouts } })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidateProfileUiMetaCache(user.id);
  return { ok: true };
}

/** 농장 지도 SP 카드 위치 초기화 (이후 자동 SP 순 배치) */
export async function clearBarnLayouts(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: existing, error: loadErr } = await supabase
    .from("profiles")
    .select("ui_config")
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };

  const prev = omitRetiredProfileUiConfigKeys(asUiConfigObject(existing?.ui_config));
  const ui_config = {
    ...prev,
    barnLayouts: {},
  };

  const { error } = await supabase
    .from("profiles")
    .update({ ui_config })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidateProfileUiMetaCache(user.id);
  return { ok: true };
}
