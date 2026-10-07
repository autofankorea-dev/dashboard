/**
 * LIVE read SELECT 계약 — list(HOT slim) vs decoded_latest(full).
 * View migration / SELECT 확장 시 이 모듈과 unit test를 함께 갱신한다.
 */

export const LIVE_LIST_SOURCE = "v_iot_dashboard_list" as const;
export const LIVE_LEGACY_SOURCE = "v_iot_decoded_latest" as const;

/** list tier — channels[] / decoded_json 금지 (카드·soft refresh) */
export const LIVE_LIST_COLS_CORE =
  "raw_id, lsind_regist_no, item_code, module_uid, controller_key, eqpmn_no, stall_ty_code, stall_no, wire_ver, packet_mode, run_mode, temp_c, humidity_pct, alarm_low_temp_c, alarm_high_temp_c, fan_supply_pct, fan_exhaust_pct, fan_intake_pct, mesure_dt, received_at";

export const LIVE_LIST_COLS_THERMO =
  "setpoint_temp, temp_deviation, min_vent_pct, max_vent_pct";

export const LIVE_LIST_COLS = `${LIVE_LIST_COLS_CORE}, ${LIVE_LIST_COLS_THERMO}`;

/** full / bulk — decoded_json으로 channels 복원 */
export const LIVE_LEGACY_COLS =
  "raw_id, lsind_regist_no, item_code, module_uid, controller_key, wire_ver, packet_mode, run_mode, temp_c, humidity_pct, mesure_dt, decoded_json, received_at";

/** list SELECT에 넣으면 soft payload·Micro CPU를 망가뜨리는 토큰 */
export const LIVE_LIST_FORBIDDEN_TOKENS = [
  "decoded_json",
  "channels",
] as const;

export function liveListSelectViolations(cols: string): string[] {
  const lower = cols.toLowerCase().replace(/\s+/g, "");
  return LIVE_LIST_FORBIDDEN_TOKENS.filter((token) =>
    lower.includes(token.toLowerCase()),
  );
}

export function assertLiveListSelectIsThin(cols: string): void {
  const bad = liveListSelectViolations(cols);
  if (bad.length > 0) {
    throw new Error(
      `LIVE list SELECT must stay thin — forbidden: ${bad.join(", ")}`,
    );
  }
}
