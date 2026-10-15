import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { listAllAuthUsers } from "@/lib/admin/auth-users";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createAdminClient, readServiceRoleKey } from "@/lib/supabase/admin";
import { createOpsReadClient } from "@/lib/supabase/ops-client";

export type FarmAccess = {
  id: number;
  lsindRegistNo: string;
  itemCode: string;
  can_read: boolean;
  can_command: boolean;
};

export type ManagedUser = {
  id: string;
  email: string | null;
  createdAt: string;
  role: string | null;
  displayName: string | null;
  farmAccess: FarmAccess[];
};

export const MANAGED_USERS_CACHE_TAG = "managed-users";

type AccessRow = {
  id: number;
  user_id: string;
  lsind_regist_no: string;
  item_code: string;
  can_read: boolean;
  can_command: boolean;
};

function farmAccessMap(accesses: AccessRow[] | null): Map<string, FarmAccess[]> {
  const accessMap = new Map<string, FarmAccess[]>();
  for (const a of accesses ?? []) {
    const list = accessMap.get(a.user_id) ?? [];
    list.push({
      id: a.id,
      lsindRegistNo: a.lsind_regist_no,
      itemCode: a.item_code,
      can_read: a.can_read,
      can_command: a.can_command,
    });
    accessMap.set(a.user_id, list);
  }
  return accessMap;
}

/** Admin API(이메일) + profiles(role) + user_access(farm 권한) 병합 */
async function computeManagedUsers(): Promise<ManagedUser[]> {
  const admin = createAdminClient();
  const users = await listAllAuthUsers();

  const ids = users.map((u) => u.id);
  if (ids.length === 0) return [];

  const [{ data: profiles }, { data: accesses }] = await Promise.all([
    admin.from("profiles").select("user_id, role, display_name").in("user_id", ids),
    admin
      .from("user_access")
      .select("id, user_id, lsind_regist_no, item_code, can_read, can_command")
      .eq("scope_type", "farm")
      .in("user_id", ids),
  ]);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p]),
  );
  const accessMap = farmAccessMap(accesses as AccessRow[] | null);

  return users
    .map((u) => {
      const p = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        createdAt: u.created_at,
        role: (p?.role as string | undefined) ?? null,
        displayName: (p?.display_name as string | null) ?? null,
        farmAccess: accessMap.get(u.id) ?? [],
      };
    })
    .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
}

/**
 * service_role이 없을 때. auth.admin 이메일 목록은 막혀 있으므로
 * 관리자 RLS로 profiles·user_access를 읽고, 현재 세션의 이메일만 붙인다.
 */
async function computeManagedUsersFromSession(): Promise<ManagedUser[]> {
  const admin = await createOpsReadClient();
  const me = await getCurrentUser();
  const [{ data: profiles }, { data: accesses }] = await Promise.all([
    admin.from("profiles").select("user_id, role, display_name, created_at"),
    admin
      .from("user_access")
      .select("id, user_id, lsind_regist_no, item_code, can_read, can_command")
      .eq("scope_type", "farm"),
  ]);

  const accessMap = farmAccessMap(accesses as AccessRow[] | null);
  return (profiles ?? [])
    .map((p) => {
      const id = p.user_id as string;
      return {
        id,
        email: me?.id === id ? (me.email ?? null) : null,
        createdAt: (p.created_at as string) ?? "",
        role: (p.role as string | undefined) ?? null,
        displayName: (p.display_name as string | null) ?? null,
        farmAccess: accessMap.get(id) ?? [],
      };
    })
    .sort((a, b) =>
      (a.displayName ?? a.email ?? a.id).localeCompare(
        b.displayName ?? b.email ?? b.id,
        "ko",
      ),
    );
}

/** 배포는 service_role. 로컬에 키가 없으면 관리자 세션으로 같은 프로젝트를 읽는다. */
export function opsDirectoryNeedsServiceRole(): boolean {
  return !readServiceRoleKey();
}

export const listManagedUsers = cache(async (): Promise<ManagedUser[]> => {
  if (!readServiceRoleKey()) return computeManagedUsersFromSession();
  return unstable_cache(
    computeManagedUsers,
    ["managed-users-v1"],
    { revalidate: 60, tags: [MANAGED_USERS_CACHE_TAG] },
  )();
});
