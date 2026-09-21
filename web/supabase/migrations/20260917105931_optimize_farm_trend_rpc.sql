-- FARM trend P2: range-first partial index and constant-memory latest thermo.
-- The parent index propagates to current and future decoded partitions.

create index if not exists idx_iot_decoded_farm_mesure_trend
  on public.iot_room_state_decoded
    (lsind_regist_no, item_code, mesure_at, controller_key)
  where decode_status = 'ok'
    and packet_mode in ('live', 'history', 'replay');

create or replace function public.farm_trend_history_by_controller(
  p_lsind text,
  p_item text,
  p_from timestamptz,
  p_to timestamptz,
  p_bucket interval
)
returns table(
  bucket_at timestamptz,
  stall_ty_code text,
  stall_no text,
  controller_key text,
  eqpmn_no text,
  avg_temp_c numeric,
  avg_humidity_pct numeric,
  avg_fan_supply numeric,
  avg_fan_exhaust numeric,
  avg_fan_intake numeric,
  avg_fan_a numeric,
  avg_fan_b numeric,
  avg_fan_c numeric,
  sample_count bigint,
  a_setpoint_temp numeric,
  a_temp_deviation numeric,
  a_min_vent_pct numeric,
  a_max_vent_pct numeric,
  b_setpoint_temp numeric,
  b_temp_deviation numeric,
  b_min_vent_pct numeric,
  b_max_vent_pct numeric,
  c_setpoint_temp numeric,
  c_temp_deviation numeric,
  c_min_vent_pct numeric,
  c_max_vent_pct numeric
)
language sql
stable
set search_path to 'public'
as $function$
  select
    date_bin(p_bucket, d.mesure_at, p_from) as bucket_at,
    d.stall_ty_code,
    d.stall_no,
    d.controller_key,
    d.eqpmn_no,
    round(avg(d.temp_c)::numeric, 1) as avg_temp_c,
    round(avg(d.humidity_pct)::numeric, 1) as avg_humidity_pct,
    round(avg(d.fan_supply_pct)::numeric, 1) as avg_fan_supply,
    round(avg(d.fan_exhaust_pct)::numeric, 1) as avg_fan_exhaust,
    round(avg(d.fan_intake_pct)::numeric, 1) as avg_fan_intake,
    round(avg(d.fan_a_pct)::numeric, 1) as avg_fan_a,
    round(avg(d.fan_b_pct)::numeric, 1) as avg_fan_b,
    round(avg(d.fan_c_pct)::numeric, 1) as avg_fan_c,
    count(*) as sample_count,
    (max(array[extract(epoch from d.mesure_at)::numeric, d.setpoint_temp])
      filter (where d.setpoint_temp is not null))[2] as a_setpoint_temp,
    (max(array[extract(epoch from d.mesure_at)::numeric, d.temp_deviation])
      filter (where d.temp_deviation is not null))[2] as a_temp_deviation,
    (max(array[extract(epoch from d.mesure_at)::numeric, d.min_vent_pct])
      filter (where d.min_vent_pct is not null))[2] as a_min_vent_pct,
    (max(array[extract(epoch from d.mesure_at)::numeric, d.max_vent_pct])
      filter (where d.max_vent_pct is not null))[2] as a_max_vent_pct,
    (max(array[extract(epoch from d.mesure_at)::numeric, th.b_sp])
      filter (where th.b_sp is not null))[2] as b_setpoint_temp,
    (max(array[extract(epoch from d.mesure_at)::numeric, th.b_dev])
      filter (where th.b_dev is not null))[2] as b_temp_deviation,
    (max(array[extract(epoch from d.mesure_at)::numeric, th.b_min])
      filter (where th.b_min is not null))[2] as b_min_vent_pct,
    (max(array[extract(epoch from d.mesure_at)::numeric, th.b_max])
      filter (where th.b_max is not null))[2] as b_max_vent_pct,
    (max(array[extract(epoch from d.mesure_at)::numeric, th.c_sp])
      filter (where th.c_sp is not null))[2] as c_setpoint_temp,
    (max(array[extract(epoch from d.mesure_at)::numeric, th.c_dev])
      filter (where th.c_dev is not null))[2] as c_temp_deviation,
    (max(array[extract(epoch from d.mesure_at)::numeric, th.c_min])
      filter (where th.c_min is not null))[2] as c_min_vent_pct,
    (max(array[extract(epoch from d.mesure_at)::numeric, th.c_max])
      filter (where th.c_max is not null))[2] as c_max_vent_pct
  from public.iot_room_state_decoded d
  left join lateral (
    select
      public.extract_channel_thermo(d.decoded_json -> 'channels', 'B') as b_th,
      public.extract_channel_thermo(d.decoded_json -> 'channels', 'C') as c_th
  ) raw_th on true
  left join lateral (
    select
      nullif(raw_th.b_th ->> 'setpointTemp', '')::numeric as b_sp,
      nullif(raw_th.b_th ->> 'tempDeviation', '')::numeric as b_dev,
      nullif(raw_th.b_th ->> 'minVentPct', '')::numeric as b_min,
      nullif(raw_th.b_th ->> 'maxVentPct', '')::numeric as b_max,
      nullif(raw_th.c_th ->> 'setpointTemp', '')::numeric as c_sp,
      nullif(raw_th.c_th ->> 'tempDeviation', '')::numeric as c_dev,
      nullif(raw_th.c_th ->> 'minVentPct', '')::numeric as c_min,
      nullif(raw_th.c_th ->> 'maxVentPct', '')::numeric as c_max
  ) th on true
  where d.lsind_regist_no = p_lsind
    and d.item_code = p_item
    and d.packet_mode in ('live', 'history', 'replay')
    and d.decode_status = 'ok'
    and d.mesure_at >= p_from
    and d.mesure_at < p_to
  group by
    date_bin(p_bucket, d.mesure_at, p_from),
    d.stall_ty_code,
    d.stall_no,
    d.controller_key,
    d.eqpmn_no
  order by
    date_bin(p_bucket, d.mesure_at, p_from),
    d.stall_ty_code,
    d.stall_no,
    d.eqpmn_no;
$function$;

comment on function public.farm_trend_history_by_controller(
  text, text, timestamptz, timestamptz, interval
) is
  'Controller trend buckets plus latest non-null A/B/C thermo per field using constant-memory arg-max.';

grant execute on function public.farm_trend_history_by_controller(
  text, text, timestamptz, timestamptz, interval
) to authenticated;
