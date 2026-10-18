-- Fourth temperature word is now an opaque uint16 error code, not a sensor.
-- Keep it in decoded_json for full reads and expose one scalar in the thin list.
BEGIN;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.iot_decoded_last_value
  ADD COLUMN IF NOT EXISTS error_code_raw integer;
COMMENT ON COLUMN public.iot_decoded_last_value.error_code_raw IS
  'Last raw fourth-sensor uint16; any change bypasses sparse gating.';

-- Only backfill from actual retained bytes; never reverse temperature scaling.
UPDATE public.iot_room_state_decoded d
SET decoded_json = jsonb_set(
      coalesce(d.decoded_json, '{}'::jsonb) || jsonb_build_object(
        'errorCodeRaw', get_byte(r.payload_bytea,16) + 256 * get_byte(r.payload_bytea,17)
      ), '{tempsC,3}', 'null'::jsonb, false),
    temp_c = coalesce((d.decoded_json #>> '{tempsC,0}')::numeric,
                      (d.decoded_json #>> '{tempsC,1}')::numeric,
                      (d.decoded_json #>> '{tempsC,2}')::numeric)
FROM public.iot_room_state_raw r
WHERE d.raw_id = r.id AND d.wire_ver = 12
  AND octet_length(r.payload_bytea) IN (79,83)
  AND get_byte(r.payload_bytea,0) = 12
  AND NOT (coalesce(d.decoded_json, '{}'::jsonb) ? 'errorCodeRaw');

-- Preserve the deployed view's columns and order, appending the raw error scalar.
CREATE OR REPLACE VIEW public.v_iot_dashboard_list WITH (security_invoker = true) AS
SELECT d.id, d.raw_id, d.lsind_regist_no, d.item_code, d.module_uid,
  d.controller_key, d.eqpmn_no, d.stall_ty_code, d.stall_no,
  d.wire_ver, d.packet_mode, d.run_mode, d.temp_c, d.humidity_pct,
  d.fan_supply_pct, d.fan_exhaust_pct, d.fan_intake_pct,
  d.mesure_dt, d.mesure_at, d.received_at,
  d.setpoint_temp, d.temp_deviation, d.min_vent_pct, d.max_vent_pct,
  CASE WHEN (d.decoded_json->>'alarmLowTempC') ~ '^-?[0-9]+([.][0-9]+)?$'
    THEN (d.decoded_json->>'alarmLowTempC')::numeric ELSE NULL::numeric END AS alarm_low_temp_c,
  CASE WHEN (d.decoded_json->>'alarmHighTempC') ~ '^-?[0-9]+([.][0-9]+)?$'
    THEN (d.decoded_json->>'alarmHighTempC')::numeric ELSE NULL::numeric END AS alarm_high_temp_c,
  (d.decoded_json->>'errorCodeRaw')::integer AS error_code_raw
FROM (
  SELECT DISTINCT lsind_regist_no, item_code, module_uid, controller_key
  FROM public.iot_room_state_decoded
  WHERE packet_mode = 'live' AND decode_status = 'ok' AND wire_ver = 12
    AND received_at > now() - interval '2 hours'
) k
CROSS JOIN LATERAL (
  SELECT d1.* FROM public.iot_room_state_decoded d1
  WHERE d1.lsind_regist_no = k.lsind_regist_no AND d1.item_code = k.item_code
    AND d1.module_uid = k.module_uid AND d1.controller_key = k.controller_key
    AND d1.packet_mode = 'live' AND d1.decode_status = 'ok' AND d1.wire_ver = 12
  ORDER BY d1.received_at DESC LIMIT 1
) d;

COMMIT;
