import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { resolveProfileAvatarUrl } from "@/lib/auth/profile-avatar";
import {
  parseControllerMeta,
  type ControllerMetaEntry,
} from "@/lib/domain/controller-meta-shared";

export type Role = "admin" | "operator" | "viewer";

export type UserAccess = {
  scope_type: "farm" | "module" | "ctrl";
  lsind_regist_no: string;
  item_code: string;
  module_uid: number | null;
  ctrl_idx: number | null;
  can_read: boolean;
  can_command: boolean;
};

export type CurrentUser = {
  id: string;
  email: string | null;
  role: Role | null;
  displayName: string | null;
  /** Google·카카오 프로필 사진. 없거나 허용 호스트가 아니면 null. */
  avatarUrl: string | null;
  accesses: UserAccess[];
  isAdmin: boolean;
  /** 데이터 조회 권한 보유 여부 (관리자이거나 can_read 스코프 1개 이상) */
  hasAccess: boolean;
  /** profiles.ui_config 컨트롤러 표시명 — layout/meta와 동일 요청 내 재조회 방지 */
  controllerMetas: ControllerMetaEntry[];
};

// React cache() 로 동일 요청 내 중복 조회 제거
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: accesses }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, display_name, ui_config")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_access")
      .select(
        "scope_type, lsind_regist_no, item_code, module_uid, ctrl_idx, can_read, can_command"
      )
      .eq("user_id", user.id),
  ]);

  const role = (profile?.role as Role | undefined) ?? null;
  const accessList = (accesses ?? []) as UserAccess[];
  const isAdmin = role === "admin";
  const hasAccess = isAdmin || accessList.some((a) => a.can_read);

  return {
    id: user.id,
    email: user.email ?? null,
    role,
    displayName: (profile?.display_name as string | null) ?? null,
    avatarUrl: resolveProfileAvatarUrl(user.user_metadata),
    accesses: accessList,
    isAdmin,
    hasAccess,
    controllerMetas: parseControllerMeta(profile?.ui_config).controllers,
  };
});

/** 명령 권한 보유 여부 (관리자이거나 can_command 스코프 1개 이상) */
export function canCommand(user: CurrentUser | null): boolean {
  if (!user) return false;
  return user.isAdmin || user.accesses.some((a) => a.can_command);
}
