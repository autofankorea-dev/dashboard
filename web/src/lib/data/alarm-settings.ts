import "server-only";
import { DEFAULT_ALARM_SETTINGS, type AlarmSettings } from "@/lib/domain/alarms";
export type { AlarmSettings, AlarmThresholds } from "@/lib/domain/alarms";
export { DEFAULT_ALARM_SETTINGS, DEFAULT_ALARM_THRESHOLDS, resolveThresholds } from "@/lib/domain/alarms";
/** Compatibility envelope; user profile thresholds are retired. */
export async function getAlarmSettings(): Promise<AlarmSettings> { return DEFAULT_ALARM_SETTINGS; }
export async function saveAlarmSettings(_settings: AlarmSettings): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: "장비의 저온·고온 경보값을 명령으로 변경하세요." };
}
