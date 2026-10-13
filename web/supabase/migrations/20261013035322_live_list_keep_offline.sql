-- Keep silent controllers on the LIVE list and latest views.
-- Status policy is unchanged: received_at older than 1 hour is offline
-- (RECV_CAUTION_MIN). Membership is 14 days (LIVE_LIST_MEMBERSHIP_MIN /
-- LIVE_LIST_MEMBERSHIP_INTERVAL in src/lib/domain/live-status.ts).
-- A controller with any live ok v12 row inside 14 days stays listed.
-- Between 1 hour and 14 days it stays on the list as offline.
-- Past 14 days it leaves the list. Full-history DISTINCT ON stays forbidden.
-- The LATERAL lookup uses the same bound. The newest qualifying row of a
-- key discovered inside the window is itself inside the window, and the
-- bound lets the planner skip older month partitions.
-- Key scan still matches idx_iot_decoded_live_list_scope
-- (farm, item, received_at DESC) WHERE live/ok/v12. That index is not
-- limited to the old key window.
--
-- Column lists are unchanged:
--   v_iot_dashboard_list — 20261007054030 (security_invoker, alarm scalars)
--   v_iot_decoded_latest — 20260821061828 (options unchanged)
-- v_iot_farm_overview reads the list, so its membership follows this window.
-- Its offline_count predicate stays received_at < now() - 1 hour.
-- Apply to the operating database only after approval.

create or replace view public.v_iot_dashboard_list with (security_invoker=true) as
select d.id,d.raw_id,d.lsind_regist_no,d.item_code,d.module_uid,d.controller_key,
 d.eqpmn_no,d.stall_ty_code,d.stall_no,d.wire_ver,d.packet_mode,d.run_mode,d.temp_c,d.humidity_pct,
 d.fan_supply_pct,d.fan_exhaust_pct,d.fan_intake_pct,d.mesure_dt,d.mesure_at,d.received_at,
 d.setpoint_temp,d.temp_deviation,d.min_vent_pct,d.max_vent_pct,
 case when d.decoded_json->>'alarmLowTempC' ~ '^-?[0-9]+([.][0-9]+)?$' then (d.decoded_json->>'alarmLowTempC')::numeric else null end as alarm_low_temp_c,
 case when d.decoded_json->>'alarmHighTempC' ~ '^-?[0-9]+([.][0-9]+)?$' then (d.decoded_json->>'alarmHighTempC')::numeric else null end as alarm_high_temp_c
from (select distinct lsind_regist_no,item_code,module_uid,controller_key from public.iot_room_state_decoded
 where packet_mode='live' and decode_status='ok' and wire_ver=12 and received_at > (now() - interval '14 days')) k
cross join lateral (select d1.* from public.iot_room_state_decoded d1
 where d1.lsind_regist_no=k.lsind_regist_no and d1.item_code=k.item_code and d1.module_uid=k.module_uid and d1.controller_key=k.controller_key
 and d1.packet_mode='live' and d1.decode_status='ok' and d1.wire_ver=12
 and d1.received_at > (now() - interval '14 days')
 order by d1.received_at desc limit 1) d;

create or replace view public.v_iot_decoded_latest as
select
  d.id,
  d.raw_id,
  d.lsind_regist_no,
  d.item_code,
  d.module_uid,
  d.controller_key,
  d.eqpmn_no,
  d.stall_ty_code,
  d.stall_no,
  d.wire_ver,
  d.packet_mode,
  d.run_mode,
  d.temp_c,
  d.humidity_pct,
  d.mesure_dt,
  d.mesure_at,
  d.decoded_json,
  d.received_at
from (
  select distinct lsind_regist_no, item_code, module_uid, controller_key
  from public.iot_room_state_decoded
  where packet_mode = 'live'
    and decode_status = 'ok'
    and wire_ver = 12
    and received_at > (now() - interval '14 days')
) k
cross join lateral (
  select
    id,
    raw_id,
    lsind_regist_no,
    item_code,
    module_uid,
    controller_key,
    eqpmn_no,
    stall_ty_code,
    stall_no,
    wire_ver,
    packet_mode,
    run_mode,
    temp_c,
    humidity_pct,
    mesure_dt,
    mesure_at,
    decoded_json,
    received_at
  from public.iot_room_state_decoded d
  where d.lsind_regist_no = k.lsind_regist_no
    and d.item_code = k.item_code
    and d.module_uid = k.module_uid
    and d.controller_key = k.controller_key
    and d.packet_mode = 'live'
    and d.decode_status = 'ok'
    and d.wire_ver = 12
    and d.received_at > (now() - interval '14 days')
  order by d.received_at desc
  limit 1
) d;

comment on view public.v_iot_dashboard_list is
  'LIVE list tier. Keys from last 14 days, then LATERAL latest row. Flat columns only. Silent controllers stay listed as offline until the window ends.';
comment on view public.v_iot_decoded_latest is
  'LIVE latest per controller. Keys from last 14 days, then LATERAL latest row.';
