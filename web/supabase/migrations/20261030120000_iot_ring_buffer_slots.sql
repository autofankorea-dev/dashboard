-- Ring-buffer retention for raw/decoded (test period).
--
-- Size-based ring instead of the 30-day month partitions:
--   raw and decoded are LIST-partitioned by `slot` (1..7).
--   New rows take iot_ring_current_slot(); decode-batch copies raw.slot to decoded.
--   iot_ring_rotate() runs every 10 seconds:
--     1) Active slot (raw + decoded, with indexes) >= 50 MB:
--        move to the next slot and TRUNCATE the slot after it,
--        so the slot ahead of the writer is always empty.
--        Ring peak = 5 full slots + 1 filling = 300 MB.
--     2) Brake: pg_database_size > 450 MB:
--        TRUNCATE the oldest non-empty slot (never the active one), one per tick.
--   Free plan limit is 500 MB; non-ring usage was ~74 MB on 2026-10-30.
--
-- Old tables are kept as *_pre_ring for rollback and straggler copy.
-- Rows inserted while this migration held the lock land in *_pre_ring;
-- 20261030120100_iot_ring_buffer_finalize.sql copies them and drops the old tables.
-- New identities start 100000 above the old max so stragglers cannot collide.
--
-- Views are recreated from the operating database definitions (2-hour key window),
-- not from 20261013035322, which is not applied there.
--
-- Deploy decode-batch with ring slot support before applying this migration.
-- Backup: git tag backup/pre-ring-20261030 and dashboard-backup/20261030.
-- Apply to the operating database only after approval.

-- ---------------------------------------------------------------------
-- 0. Ring state
-- ---------------------------------------------------------------------
create table public.iot_ring_state (
  id smallint primary key default 1 check (id = 1),
  active_slot smallint not null default 1 check (active_slot between 1 and 7),
  slot_count smallint not null default 7 check (slot_count = 7),
  slot_max_bytes bigint not null default 52428800,   -- 50 MB
  db_brake_bytes bigint not null default 471859200,  -- 450 MB
  rotated_at timestamptz not null default now()
);
insert into public.iot_ring_state default values;
alter table public.iot_ring_state enable row level security;

create table public.iot_ring_event (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null check (kind in ('rotate', 'brake')),
  from_slot smallint,
  to_slot smallint,
  cleared_slot smallint,
  active_bytes bigint,
  db_bytes bigint
);
alter table public.iot_ring_event enable row level security;

create or replace function public.iot_ring_current_slot()
returns smallint
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select active_slot from public.iot_ring_state where id = 1
$$;

-- ---------------------------------------------------------------------
-- 1. Freeze writers, move old objects aside
-- ---------------------------------------------------------------------
-- ACCESS EXCLUSIVE up front: rename/drop below need it, and upgrading a weaker
-- lock mid-transaction can deadlock with readers.
lock table public.iot_room_state_raw, public.iot_room_state_decoded in access exclusive mode;

drop view public.v_iot_farm_overview;
drop view public.v_iot_dashboard_list;
drop view public.v_iot_decoded_latest;

alter table public.iot_room_state_decode_failed drop constraint iot_room_state_decode_failed_raw_id_fkey;
alter table public.farm_module_alarm drop constraint farm_module_alarm_raw_id_fkey;
alter table public.iot_room_state_decoded drop constraint iot_room_state_decoded_raw_id_fkey;

alter table public.iot_room_state_raw rename to iot_room_state_raw_pre_ring;
alter table public.iot_room_state_decoded rename to iot_room_state_decoded_pre_ring;

do $$
declare
  r record;
begin
  -- Parent-level index names are reused by the new tables.
  for r in
    select i.relname
    from pg_index x
    join pg_class i on i.oid = x.indexrelid
    where x.indrelid in (
      'public.iot_room_state_raw_pre_ring'::regclass,
      'public.iot_room_state_decoded_pre_ring'::regclass
    )
  loop
    execute format('alter index public.%I rename to %I', r.relname, left(r.relname, 54) || '_pre_ring');
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- 2. raw: LIST(slot) 1..7
-- ---------------------------------------------------------------------
create table public.iot_room_state_raw (
  id bigint generated always as identity (sequence name public.iot_room_state_raw_ring_id_seq),
  topic text not null,
  payload_format text not null default 'binary'
    check (payload_format = any (array['json'::text, 'binary'::text])),
  payload_bytea bytea,
  module_uid smallint default 1,
  received_at timestamptz not null,
  saved_at timestamptz not null default now(),
  chunk_seq smallint not null default 0,
  mode text not null default 'live'
    check (mode = any (array['live'::text, 'replay'::text])),
  lsind_regist_no text not null default ''::text,
  item_code text not null default ''::text,
  slot smallint not null default public.iot_ring_current_slot(),
  constraint iot_room_state_raw_pkey primary key (id, slot)
) partition by list (slot);

create index idx_iot_raw_farm_module on public.iot_room_state_raw
  using btree (lsind_regist_no, item_code, module_uid, received_at desc);
create index idx_iot_raw_farm_received on public.iot_room_state_raw
  using btree (lsind_regist_no, item_code, received_at);
create index idx_iot_raw_binary_recent on public.iot_room_state_raw
  using btree (received_at desc) where (payload_format = 'binary'::text);
create index idx_iot_raw_received_at on public.iot_room_state_raw
  using btree (received_at desc);
create index idx_iot_raw_topic on public.iot_room_state_raw
  using btree (topic);
-- decode-batch reads `id > cursor order by id`; the PK leads with id.

create trigger trg_iot_raw_fill_from_topic
  before insert on public.iot_room_state_raw
  for each row execute function public.iot_raw_fill_from_topic();

alter table public.iot_room_state_raw enable row level security;
create policy deny_anon_raw on public.iot_room_state_raw
  as permissive for all to anon, authenticated
  using (false) with check (false);

-- ---------------------------------------------------------------------
-- 3. decoded: LIST(slot) 1..7
-- ---------------------------------------------------------------------
create table public.iot_room_state_decoded (
  id bigint generated by default as identity (sequence name public.iot_room_state_decoded_ring_id_seq),
  raw_id bigint not null,
  lsind_regist_no text not null default ''::text,
  item_code text not null default ''::text,
  module_uid smallint not null,
  topic text,
  wire_ver smallint not null,
  packet_mode text not null default 'live'::text
    check (packet_mode = any (array['live'::text, 'history'::text, 'replay'::text])),
  history boolean not null default false,
  controller_key text not null,
  eqpmn_no text not null default ''::text,
  stall_ty_code text not null default ''::text,
  stall_no text not null default ''::text,
  mesure_dt text not null,
  mesure_at timestamptz not null,
  run_mode smallint,
  temp_c numeric,
  humidity_pct numeric,
  decoded_json jsonb not null,
  decode_status text not null default 'ok'::text
    check (decode_status = any (array['ok'::text, 'skipped'::text, 'failed'::text])),
  decode_error text,
  decode_source text not null default 'edge'::text
    check (decode_source = any (array['edge'::text, 'backfill'::text, 'manual'::text])),
  received_at timestamptz not null,
  fan_supply_pct numeric,
  fan_exhaust_pct numeric,
  fan_intake_pct numeric,
  setpoint_temp numeric,
  temp_deviation numeric,
  min_vent_pct numeric,
  max_vent_pct numeric,
  fan_a_pct numeric,
  fan_b_pct numeric,
  fan_c_pct numeric,
  slot smallint not null default public.iot_ring_current_slot(),
  constraint iot_room_state_decoded_pkey primary key (id, slot),
  constraint uq_iot_decoded_raw_id_mesure unique (raw_id, mesure_at, slot)
) partition by list (slot);

create index idx_iot_decoded_farm_mesure_trend on public.iot_room_state_decoded
  using btree (lsind_regist_no, item_code, mesure_at, controller_key)
  where ((decode_status = 'ok'::text) and (packet_mode = any (array['live'::text, 'history'::text, 'replay'::text])));
create index idx_iot_decoded_farm_received on public.iot_room_state_decoded
  using btree (lsind_regist_no, item_code, module_uid, received_at desc);
create index idx_iot_decoded_farm_received_ok on public.iot_room_state_decoded
  using btree (lsind_regist_no, item_code, received_at desc)
  where (decode_status = 'ok'::text);
create index idx_iot_decoded_live_latest on public.iot_room_state_decoded
  using btree (lsind_regist_no, item_code, module_uid, controller_key, received_at desc)
  where ((packet_mode = 'live'::text) and (decode_status = 'ok'::text));
create index idx_iot_decoded_mesure_at on public.iot_room_state_decoded
  using btree (lsind_regist_no, item_code, module_uid, mesure_at desc);

create trigger trg_iot_decoded_fill_keys
  before insert or update on public.iot_room_state_decoded
  for each row execute function public.iot_decoded_fill_keys();

alter table public.iot_room_state_decoded enable row level security;
create policy decoded_select_scoped on public.iot_room_state_decoded
  as permissive for select to authenticated
  using (public.user_can_read_farm(auth.uid(), lsind_regist_no, item_code));

-- ---------------------------------------------------------------------
-- 4. Slot partitions. RLS on with no policy: direct partition access is
--    closed to anon/authenticated; reads go through the parents.
-- ---------------------------------------------------------------------
do $$
declare
  s int;
begin
  for s in 1..7 loop
    execute format('create table public.iot_room_state_raw_s%s partition of public.iot_room_state_raw for values in (%s)', s, s);
    execute format('create table public.iot_room_state_decoded_s%s partition of public.iot_room_state_decoded for values in (%s)', s, s);
    execute format('alter table public.iot_room_state_raw_s%s enable row level security', s);
    execute format('alter table public.iot_room_state_decoded_s%s enable row level security', s);
  end loop;
end
$$;

grant all on table public.iot_room_state_raw, public.iot_room_state_decoded
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. Copy current data into slot 1, move identities past the old max
-- ---------------------------------------------------------------------
insert into public.iot_room_state_raw (
  id, topic, payload_format, payload_bytea, module_uid, received_at, saved_at,
  chunk_seq, mode, lsind_regist_no, item_code, slot
)
overriding system value
select
  id, topic, payload_format, payload_bytea, module_uid, received_at, saved_at,
  chunk_seq, mode, lsind_regist_no, item_code, 1
from public.iot_room_state_raw_pre_ring;

-- fill_keys only fills blanks; copied rows already carry their keys.
insert into public.iot_room_state_decoded (
  id, raw_id, lsind_regist_no, item_code, module_uid, topic, wire_ver, packet_mode,
  history, controller_key, eqpmn_no, stall_ty_code, stall_no, mesure_dt, mesure_at,
  run_mode, temp_c, humidity_pct, decoded_json, decode_status, decode_error,
  decode_source, received_at, fan_supply_pct, fan_exhaust_pct, fan_intake_pct,
  setpoint_temp, temp_deviation, min_vent_pct, max_vent_pct, fan_a_pct, fan_b_pct,
  fan_c_pct, slot
)
select
  id, raw_id, lsind_regist_no, item_code, module_uid, topic, wire_ver, packet_mode,
  history, controller_key, eqpmn_no, stall_ty_code, stall_no, mesure_dt, mesure_at,
  run_mode, temp_c, humidity_pct, decoded_json, decode_status, decode_error,
  decode_source, received_at, fan_supply_pct, fan_exhaust_pct, fan_intake_pct,
  setpoint_temp, temp_deviation, min_vent_pct, max_vent_pct, fan_a_pct, fan_b_pct,
  fan_c_pct, 1
from public.iot_room_state_decoded_pre_ring;

select setval(
  'public.iot_room_state_raw_ring_id_seq',
  greatest(
    (select coalesce(max(id), 0) from public.iot_room_state_raw_pre_ring),
    (select last_value from public.iot_room_state_raw_id_seq1)
  ) + 100000
);
select setval(
  'public.iot_room_state_decoded_ring_id_seq',
  greatest(
    (select coalesce(max(id), 0) from public.iot_room_state_decoded_pre_ring),
    (select last_value from public.iot_room_state_decoded_id_seq1)
  ) + 100000
);

-- ---------------------------------------------------------------------
-- 6. Views (operating database definitions as of 2026-10-30)
-- ---------------------------------------------------------------------
create view public.v_iot_decoded_latest as
select d.id, d.raw_id, d.lsind_regist_no, d.item_code, d.module_uid, d.controller_key,
  d.eqpmn_no, d.stall_ty_code, d.stall_no, d.wire_ver, d.packet_mode, d.run_mode,
  d.temp_c, d.humidity_pct, d.mesure_dt, d.mesure_at, d.decoded_json, d.received_at
from (
  select distinct iot_room_state_decoded.lsind_regist_no, iot_room_state_decoded.item_code,
    iot_room_state_decoded.module_uid, iot_room_state_decoded.controller_key
  from public.iot_room_state_decoded
  where iot_room_state_decoded.packet_mode = 'live'::text
    and iot_room_state_decoded.decode_status = 'ok'::text
    and iot_room_state_decoded.wire_ver = 12
    and iot_room_state_decoded.received_at > (now() - '02:00:00'::interval)
) k
cross join lateral (
  select d_1.id, d_1.raw_id, d_1.lsind_regist_no, d_1.item_code, d_1.module_uid,
    d_1.controller_key, d_1.eqpmn_no, d_1.stall_ty_code, d_1.stall_no, d_1.wire_ver,
    d_1.packet_mode, d_1.run_mode, d_1.temp_c, d_1.humidity_pct, d_1.mesure_dt,
    d_1.mesure_at, d_1.decoded_json, d_1.received_at
  from public.iot_room_state_decoded d_1
  where d_1.lsind_regist_no = k.lsind_regist_no and d_1.item_code = k.item_code
    and d_1.module_uid = k.module_uid and d_1.controller_key = k.controller_key
    and d_1.packet_mode = 'live'::text and d_1.decode_status = 'ok'::text
    and d_1.wire_ver = 12
  order by d_1.received_at desc
  limit 1
) d;

create view public.v_iot_dashboard_list with (security_invoker=true) as
select d.id, d.raw_id, d.lsind_regist_no, d.item_code, d.module_uid, d.controller_key,
  d.eqpmn_no, d.stall_ty_code, d.stall_no, d.wire_ver, d.packet_mode, d.run_mode,
  d.temp_c, d.humidity_pct, d.fan_supply_pct, d.fan_exhaust_pct, d.fan_intake_pct,
  d.mesure_dt, d.mesure_at, d.received_at, d.setpoint_temp, d.temp_deviation,
  d.min_vent_pct, d.max_vent_pct,
  case
    when (d.decoded_json ->> 'alarmLowTempC'::text) ~ '^-?[0-9]+([.][0-9]+)?$'::text
      then (d.decoded_json ->> 'alarmLowTempC'::text)::numeric
    else null::numeric
  end as alarm_low_temp_c,
  case
    when (d.decoded_json ->> 'alarmHighTempC'::text) ~ '^-?[0-9]+([.][0-9]+)?$'::text
      then (d.decoded_json ->> 'alarmHighTempC'::text)::numeric
    else null::numeric
  end as alarm_high_temp_c,
  (d.decoded_json ->> 'errorCodeRaw'::text)::integer as error_code_raw
from (
  select distinct iot_room_state_decoded.lsind_regist_no, iot_room_state_decoded.item_code,
    iot_room_state_decoded.module_uid, iot_room_state_decoded.controller_key
  from public.iot_room_state_decoded
  where iot_room_state_decoded.packet_mode = 'live'::text
    and iot_room_state_decoded.decode_status = 'ok'::text
    and iot_room_state_decoded.wire_ver = 12
    and iot_room_state_decoded.received_at > (now() - '02:00:00'::interval)
) k
cross join lateral (
  select d1.id, d1.raw_id, d1.lsind_regist_no, d1.item_code, d1.module_uid, d1.topic,
    d1.wire_ver, d1.packet_mode, d1.history, d1.controller_key, d1.eqpmn_no,
    d1.stall_ty_code, d1.stall_no, d1.mesure_dt, d1.mesure_at, d1.run_mode, d1.temp_c,
    d1.humidity_pct, d1.decoded_json, d1.decode_status, d1.decode_error, d1.decode_source,
    d1.received_at, d1.fan_supply_pct, d1.fan_exhaust_pct, d1.fan_intake_pct,
    d1.setpoint_temp, d1.temp_deviation, d1.min_vent_pct, d1.max_vent_pct, d1.fan_a_pct,
    d1.fan_b_pct, d1.fan_c_pct
  from public.iot_room_state_decoded d1
  where d1.lsind_regist_no = k.lsind_regist_no and d1.item_code = k.item_code
    and d1.module_uid = k.module_uid and d1.controller_key = k.controller_key
    and d1.packet_mode = 'live'::text and d1.decode_status = 'ok'::text
    and d1.wire_ver = 12
  order by d1.received_at desc
  limit 1
) d;

create view public.v_iot_farm_overview as
select l.lsind_regist_no, l.item_code,
  count(*)::integer as controller_count,
  (count(*) filter (where l.received_at < (now() - '01:00:00'::interval)))::integer as offline_count,
  avg(l.temp_c) filter (where l.temp_c is not null) as avg_temp_c,
  avg(l.humidity_pct) filter (where l.humidity_pct is not null) as avg_humidity_pct,
  max(l.received_at) as latest_received_at
from public.v_iot_dashboard_list l
group by l.lsind_regist_no, l.item_code;

grant all on table public.v_iot_decoded_latest, public.v_iot_dashboard_list, public.v_iot_farm_overview
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7. Rotation
-- ---------------------------------------------------------------------
create or replace function public.iot_ring_slot_bytes(p_slot smallint)
returns bigint
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select pg_total_relation_size(format('public.iot_room_state_raw_s%s', p_slot)::regclass)
       + pg_total_relation_size(format('public.iot_room_state_decoded_s%s', p_slot)::regclass)
$$;

create or replace function public.iot_ring_truncate_slot(p_slot smallint)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  execute format(
    'truncate table public.iot_room_state_decoded_s%s, public.iot_room_state_raw_s%s',
    p_slot, p_slot
  );
end;
$$;

create or replace function public.iot_ring_rotate()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
-- TRUNCATE waits for running reads of that slot; give up and retry next tick.
set lock_timeout = '3s'
as $$
declare
  st public.iot_ring_state%rowtype;
  n smallint;
  active_bytes bigint;
  db_bytes bigint;
  next_slot smallint;
  clear_slot smallint;
  s smallint;
  i int;
  has_rows boolean;
  rotated boolean := false;
  braked smallint := null;
begin
  select * into st from public.iot_ring_state where id = 1 for update;
  n := st.slot_count;

  -- 1) Active slot full: advance, keep the slot ahead empty.
  active_bytes := public.iot_ring_slot_bytes(st.active_slot);
  if active_bytes >= st.slot_max_bytes then
    next_slot := st.active_slot % n + 1;
    clear_slot := next_slot % n + 1;
    perform public.iot_ring_truncate_slot(next_slot);
    perform public.iot_ring_truncate_slot(clear_slot);
    update public.iot_ring_state
      set active_slot = next_slot, rotated_at = now()
      where id = 1;
    insert into public.iot_ring_event (kind, from_slot, to_slot, cleared_slot, active_bytes, db_bytes)
      values ('rotate', st.active_slot, next_slot, clear_slot, active_bytes, pg_database_size(current_database()));
    st.active_slot := next_slot;
    rotated := true;
  end if;

  -- 2) Brake: whole database over the limit. Clear the oldest non-empty slot.
  db_bytes := pg_database_size(current_database());
  if db_bytes > st.db_brake_bytes then
    for i in 1..(n - 1) loop
      s := (st.active_slot + i - 1) % n + 1;  -- active+1 (oldest side) .. active-1
      execute format(
        'select exists (select 1 from public.iot_room_state_raw_s%s)
             or exists (select 1 from public.iot_room_state_decoded_s%s)',
        s, s
      ) into has_rows;
      if has_rows then
        perform public.iot_ring_truncate_slot(s);
        insert into public.iot_ring_event (kind, from_slot, to_slot, cleared_slot, active_bytes, db_bytes)
          values ('brake', st.active_slot, st.active_slot, s, active_bytes, db_bytes);
        braked := s;
        exit;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'active_slot', st.active_slot,
    'active_bytes', active_bytes,
    'db_bytes', db_bytes,
    'rotated', rotated,
    'brake_cleared', braked
  );
end;
$$;

revoke all on function public.iot_ring_rotate() from public, anon, authenticated;
revoke all on function public.iot_ring_truncate_slot(smallint) from public, anon, authenticated;
revoke all on function public.iot_ring_slot_bytes(smallint) from public, anon, authenticated;
grant execute on function public.iot_ring_current_slot() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 8. Cron: month-partition retention off, ring on, ops logs 7d -> 2d
-- ---------------------------------------------------------------------
select cron.unschedule('cleanup-iot-retention-30d-daily');
select cron.unschedule('ensure-iot-decoded-partitions-daily');
select cron.unschedule('cleanup-iot-archive-drop-daily');
select cron.unschedule('cleanup-ops-logs-7d-daily');

select cron.schedule('iot-ring-rotate-10s', '10 seconds', 'select public.iot_ring_rotate();');
select cron.schedule('cleanup-ops-logs-2d-daily', '50 18 * * *', 'select public.cleanup_ops_logs_7d(2, 10000);');

-- Month-partition helpers would fail against LIST(slot) tables.
drop function public.cleanup_iot_retention_30d(integer, integer);
drop function public.ensure_iot_decoded_month_partitions(integer);
drop function public.cleanup_iot_archive_drop(integer, integer);
