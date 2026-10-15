import "server-only";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
  createAdminClient,
  readServiceRoleKey,
  type OpsDbClient,
} from "@/lib/supabase/admin";
import { createRlsClient, getAccessTokenOrNull } from "@/lib/supabase/rls-client";

const MISSING_KEY = "SUPABASE_SERVICE_ROLE_KEY (또는 URL)가 설정되지 않았습니다.";

/**
 * 배포본과 같은 Supabase 프로젝트로 ops를 읽는다.
 * Vercel의 service_role(또는 SUPABASE_SECRET_KEY)이 있으면 그 클라이언트를 쓴다.
 * 로컬에 키가 없으면 로그인한 관리자 세션으로, RLS가 관리자에게 허용한 같은 행을 읽는다.
 */
export async function createOpsReadClient(): Promise<OpsDbClient> {
  if (readServiceRoleKey()) return createAdminClient();

  const token = await getAccessTokenOrNull();
  const me = await getCurrentUser();
  if (!token || !me?.isAdmin) {
    throw new Error(MISSING_KEY);
  }

  return createRlsClient(token);
}
