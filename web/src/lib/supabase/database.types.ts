/**
 * Supabase 타입 계약 진입점.
 *
 * 전체 스키마 타입은 ./database.types.generated.ts (자동 생성물). 여기서는 이를
 * 재노출하고, 대시보드가 실제 호출하는 farm_trend_* JSON RPC용 편의 별칭만 파생한다.
 *
 * 재생성:
 *   npx supabase gen types typescript --project-id fkkrjljeqxpbmazfnync \
 *     > src/lib/supabase/database.types.generated.ts
 *   (또는 Supabase MCP generate_typescript_types)
 */
export type { Database, Json } from "./database.types.generated";

import type { Database } from "./database.types.generated";

/**
 * 대시보드가 호출하는 JSON 트렌드 RPC 이름.
 * (전체 함수 union이 아니라 이 3개로 제한 — 공통 인자 계약을 공유)
 */
export type TrendRpcName =
  | "farm_trend_history_json"
  | "farm_trend_history_by_controller_json"
  | "farm_trend_uplink_coverage_json";

/** farm_trend_* RPC 공통 인자 — 생성 스키마에서 파생 (lsind/item + 기간 + 버킷). */
export type TrendRpcArgs =
  Database["public"]["Functions"]["farm_trend_history_json"]["Args"];
