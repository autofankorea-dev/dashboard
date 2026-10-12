import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AlarmRow } from "@/lib/domain/alarms";
import type { FarmKey } from "@/lib/domain/farm-key";
import {
  moduleAlarmToAlarmRow,
  type ModuleAlarmDbRow,
} from "@/lib/domain/module-alarms-map";

export {
  moduleAlarmToAlarmRow,
  severityForModuleErrCode,
  type ModuleAlarmDbRow,
} from "@/lib/domain/module-alarms-map";

const VIEW_COLS =
  "id, created_at, raw_id, lsind_regist_no, item_code, farm_name, module_uid, topic, wire_ver, err_code, err_label, stall_ty_code, stall_no, eqpmn_no, controller_key, channel, status, received_at";

/**
 * Mark an active module alarm as acknowledged (leaves active View).
 * RLS: user_can_read_farm on the row.
 */
export async function ackModuleAlarm(
  alarmId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = alarmId?.trim();
  if (!id) return { ok: false, error: "경보를 찾을 수 없습니다." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("farm_module_alarm")
    .update({
      status: "acked",
      status_changed_at: now,
      status_changed_by: user.id,
    })
    .eq("id", id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[module-alarms] ack failed:", error.message);
    }
    return { ok: false, error: "확인 처리에 실패했습니다." };
  }
  if (!data) {
    return { ok: false, error: "이미 확인됐거나 권한이 없습니다." };
  }
  return { ok: true };
}

/**
 * Mark multiple active module alarms as acknowledged.
 */
export async function ackModuleAlarmsBulk(
  alarmIds: string[],
): Promise<
  { ok: true; acked: number } | { ok: false; error: string }
> {
  const ids = [...new Set(alarmIds.map((id) => id?.trim()).filter(Boolean))];
  if (ids.length === 0) {
    return { ok: false, error: "확인할 경보가 없습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("farm_module_alarm")
    .update({
      status: "acked",
      status_changed_at: now,
      status_changed_by: user.id,
    })
    .in("id", ids)
    .eq("status", "active")
    .select("id");

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[module-alarms] bulk ack failed:", error.message);
    }
    return { ok: false, error: "일괄 확인 처리에 실패했습니다." };
  }

  return { ok: true, acked: data?.length ?? 0 };
}

/**
 * Active module wire alarms for shell bell (RLS via user session).
 * When `farmKey` is set, scopes to that farm; otherwise returns all readable rows.
 */
export async function fetchActiveModuleAlarms(
  farmKey?: FarmKey | null,
  opts?: { limit?: number },
): Promise<AlarmRow[]> {
  const limit = opts?.limit ?? 100;
  const supabase = await createClient();

  let query = supabase
    .from("v_farm_module_alarm_active")
    .select(VIEW_COLS)
    .order("received_at", { ascending: false })
    .limit(limit);

  if (farmKey) {
    query = query
      .eq("lsind_regist_no", farmKey.lsindRegistNo)
      .eq("item_code", farmKey.itemCode);
  }

  const { data, error } = await query;
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[module-alarms] fetch failed:", error.message);
    }
    return [];
  }

  return ((data ?? []) as ModuleAlarmDbRow[]).map(moduleAlarmToAlarmRow);
}
