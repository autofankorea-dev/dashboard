import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type OpsDbClient = SupabaseClient<Database>;

/** Vercel production uses SUPABASE_SERVICE_ROLE_KEY. New projects may set SUPABASE_SECRET_KEY. */
export function readServiceRoleKey(): string | undefined {
  const raw =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    "";
  const key = raw.trim();
  return key ? key : undefined;
}

// service_role 클라이언트: RLS 우회. 서버 코드(관리자 액션/로더)에서만 사용.
export function createAdminClient(): OpsDbClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = readServiceRoleKey();

  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY (또는 URL)가 설정되지 않았습니다.");
  }

  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
