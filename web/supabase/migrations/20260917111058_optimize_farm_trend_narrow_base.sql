-- FARM trend P2c: keep the materialized aggregate input narrow.
-- decoded_json is fetched only for the latest row selected per bucket.

create or replace function public.farm_trend_history_by_controller(
  p_lsind text, p_item text, p_from timestamptz, p_to timestamptz,
  p_bucket interval
)
returns table(
  bucket_at timestamptz, stall_ty_code text, stall_no text,
  controller_key text, eqpmn_no text,
  avg_temp_c numeric, avg_humidity_pct numeric,
  avg_fan_supply numeric, avg_fan_exhaust numeric, avg_fan_intake numeric,
  avg_fan_a numeric, avg_fan_b numeric, avg_fan_c numeric,
  sample_count bigint,
  a_setpoint_temp numeric, a_temp_deviation numeric,
  a_min_vent_pct numeric, a_max_vent_pct numeric,
  b_setpoint_temp numeric, b_temp_deviation numeric,
  b_min_vent_pct numeric, b_max_vent_pct numeric,
  c_setpoint_temp numeric, c_temp_deviation numeric,
  c_min_vent_pct numeric, c_max_vent_pct numeric
)
language sql
stable
set search_path to 'public'
as $function$
  with base as materialized (
    select
      d.id,
      date_bin(p_bucket, d.mesure_at, p_from) as bucket_at,
      d.mesure_at, d.stall_ty_code, d.stall_no, d.controller_key, d.eqpmn_no,
      d.temp_c, d.humidity_pct,
      d.fan_supply_pct, d.fan_exhaust_pct, d.fan_intake_pct,
      d.fan_a_pct, d.fan_b_pct, d.fan_c_pct,
      d.setpoint_temp, d.temp_deviation, d.min_vent_pct, d.max_vent_pct
    from public.iot_room_state_decoded d
    where d.lsind_regist_no = p_lsind
      and d.item_code = p_item
      and d.packet_mode in ('live', 'history', 'replay')
      and d.decode_status = 'ok'
      and d.mesure_at >= p_from
      and d.mesure_at < p_to
  ),
  stats as (
    select
      b.bucket_at, b.stall_ty_code, b.stall_no, b.controller_key, b.eqpmn_no,
      round(avg(b.temp_c)::numeric, 1) as avg_temp_c,
      round(avg(b.humidity_pct)::numeric, 1) as avg_humidity_pct,
      round(avg(b.fan_supply_pct)::numeric, 1) as avg_fan_supply,
      round(avg(b.fan_exhaust_pct)::numeric, 1) as avg_fan_exhaust,
      round(avg(b.fan_intake_pct)::numeric, 1) as avg_fan_intake,
      round(avg(b.fan_a_pct)::numeric, 1) as avg_fan_a,
      round(avg(b.fan_b_pct)::numeric, 1) as avg_fan_b,
      round(avg(b.fan_c_pct)::numeric, 1) as avg_fan_c,
      count(*) as sample_count
    from base b
    group by b.bucket_at, b.stall_ty_code, b.stall_no, b.controller_key, b.eqpmn_no
  ),
  latest as (
    select distinct on (
      b.bucket_at, b.stall_ty_code, b.stall_no, b.controller_key, b.eqpmn_no
    )
      b.id, b.bucket_at, b.mesure_at,
      b.stall_ty_code, b.stall_no, b.controller_key, b.eqpmn_no,
      b.setpoint_temp, b.temp_deviation, b.min_vent_pct, b.max_vent_pct
    from base b
    order by
      b.bucket_at, b.stall_ty_code, b.stall_no, b.controller_key, b.eqpmn_no,
      b.mesure_at desc
  ),
  latest_thermo as (
    select
      l.*,
      public.extract_channel_thermo(d.decoded_json -> 'channels', 'B') as b_th,
      public.extract_channel_thermo(d.decoded_json -> 'channels', 'C') as c_th
    from latest l
    join public.iot_room_state_decoded d
      on d.id = l.id and d.mesure_at = l.mesure_at
  )
  select
    s.bucket_at, s.stall_ty_code, s.stall_no, s.controller_key, s.eqpmn_no,
    s.avg_temp_c, s.avg_humidity_pct,
    s.avg_fan_supply, s.avg_fan_exhaust, s.avg_fan_intake,
    s.avg_fan_a, s.avg_fan_b, s.avg_fan_c, s.sample_count,
    l.setpoint_temp, l.temp_deviation, l.min_vent_pct, l.max_vent_pct,
    nullif(l.b_th ->> 'setpointTemp', '')::numeric,
    nullif(l.b_th ->> 'tempDeviation', '')::numeric,
    nullif(l.b_th ->> 'minVentPct', '')::numeric,
    nullif(l.b_th ->> 'maxVentPct', '')::numeric,
    nullif(l.c_th ->> 'setpointTemp', '')::numeric,
    nullif(l.c_th ->> 'tempDeviation', '')::numeric,
    nullif(l.c_th ->> 'minVentPct', '')::numeric,
    nullif(l.c_th ->> 'maxVentPct', '')::numeric
  from stats s
  join latest_thermo l
    on l.bucket_at = s.bucket_at
   and l.stall_ty_code is not distinct from s.stall_ty_code
   and l.stall_no is not distinct from s.stall_no
   and l.controller_key is not distinct from s.controller_key
   and l.eqpmn_no is not distinct from s.eqpmn_no
  order by s.bucket_at, s.stall_ty_code, s.stall_no, s.eqpmn_no;
$function$;

comment on function public.farm_trend_history_by_controller(
  text, text, timestamptz, timestamptz, interval
) is
  'Controller trend averages from narrow rows; A/B/C thermo is decoded only for each bucket latest row.';

grant execute on function public.farm_trend_history_by_controller(
  text, text, timestamptz, timestamptz, interval
) to authenticated;
