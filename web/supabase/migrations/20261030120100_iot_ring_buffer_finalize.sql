-- Finalize ring-buffer migration (20261030120000).
--
-- Apply after the ring has been checked (rotation events, LIVE list, trend chart).
-- 1) Copies rows that writers blocked on the old tables inserted after the lock.
--    Their ids are below the new identity range (+100000 gap), so no collision.
--    decode-batch's cursor is already past them, so straggler raw rows stay undecoded.
-- 2) Drops *_pre_ring. After this, rollback means restoring the pg_dump backup.
-- Apply to the operating database only after approval.

insert into public.iot_room_state_raw (
  id, topic, payload_format, payload_bytea, module_uid, received_at, saved_at,
  chunk_seq, mode, lsind_regist_no, item_code, slot
)
overriding system value
select
  o.id, o.topic, o.payload_format, o.payload_bytea, o.module_uid, o.received_at, o.saved_at,
  o.chunk_seq, o.mode, o.lsind_regist_no, o.item_code, public.iot_ring_current_slot()
from public.iot_room_state_raw_pre_ring o
where not exists (select 1 from public.iot_room_state_raw n where n.id = o.id);

insert into public.iot_room_state_decoded (
  id, raw_id, lsind_regist_no, item_code, module_uid, topic, wire_ver, packet_mode,
  history, controller_key, eqpmn_no, stall_ty_code, stall_no, mesure_dt, mesure_at,
  run_mode, temp_c, humidity_pct, decoded_json, decode_status, decode_error,
  decode_source, received_at, fan_supply_pct, fan_exhaust_pct, fan_intake_pct,
  setpoint_temp, temp_deviation, min_vent_pct, max_vent_pct, fan_a_pct, fan_b_pct,
  fan_c_pct, slot
)
select
  o.id, o.raw_id, o.lsind_regist_no, o.item_code, o.module_uid, o.topic, o.wire_ver, o.packet_mode,
  o.history, o.controller_key, o.eqpmn_no, o.stall_ty_code, o.stall_no, o.mesure_dt, o.mesure_at,
  o.run_mode, o.temp_c, o.humidity_pct, o.decoded_json, o.decode_status, o.decode_error,
  o.decode_source, o.received_at, o.fan_supply_pct, o.fan_exhaust_pct, o.fan_intake_pct,
  o.setpoint_temp, o.temp_deviation, o.min_vent_pct, o.max_vent_pct, o.fan_a_pct, o.fan_b_pct,
  o.fan_c_pct, public.iot_ring_current_slot()
from public.iot_room_state_decoded_pre_ring o
where not exists (select 1 from public.iot_room_state_decoded n where n.id = o.id);

-- Partitions (p_2026_07 .. p_default) go with the parent.
drop table public.iot_room_state_decoded_pre_ring;
drop table public.iot_room_state_raw_pre_ring;
