-- Reconcile the operating DB with the existing 0x0D/0x0E server and dashboard.
-- Safe after the original migrations; preserves rows, legacy actions, and grants.
-- Existing RLS and legacy 0x0C commands are preserved.
CREATE OR REPLACE FUNCTION public.valid_command_channels(payload jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  channels jsonb := payload->'command_channels';
  ch jsonb;
  seen text[] := ARRAY[]::text[];
  slot text;
  setpoint numeric;
  deviation numeric;
  min_vent numeric;
  max_vent numeric;
BEGIN
  IF channels IS NULL OR jsonb_typeof(channels) <> 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(channels) NOT BETWEEN 1 AND 3 THEN RETURN false; END IF;
  FOR ch IN SELECT value FROM jsonb_array_elements(channels) LOOP
    IF jsonb_typeof(ch) <> 'object' THEN RETURN false; END IF;
    slot := ch->>'channel';
    IF slot IS NULL OR slot NOT IN ('A','B','C') OR slot = ANY(seen) THEN RETURN false; END IF;
    seen := array_append(seen, slot);
    IF ch->>'eqpmnCode' IS NULL OR ch->>'eqpmnCode' !~ '^EC(0[1-9]|[1-9][0-9])$' THEN RETURN false; END IF;
    IF jsonb_typeof(ch->'setpointTemp') IS DISTINCT FROM 'number'
      OR jsonb_typeof(ch->'tempDeviation') IS DISTINCT FROM 'number'
      OR jsonb_typeof(ch->'minVentPct') IS DISTINCT FROM 'number'
      OR jsonb_typeof(ch->'maxVentPct') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    setpoint := (ch->>'setpointTemp')::numeric;
    deviation := (ch->>'tempDeviation')::numeric;
    min_vent := (ch->>'minVentPct')::numeric;
    max_vent := (ch->>'maxVentPct')::numeric;
    IF setpoint NOT BETWEEN 0 AND 30 OR deviation NOT BETWEEN 0.5 AND 10
      OR min_vent NOT BETWEEN 0 AND 100 OR max_vent NOT BETWEEN 0 AND 100 OR min_vent > max_vent
      OR setpoint*10 <> trunc(setpoint*10) OR deviation*10 <> trunc(deviation*10)
      OR min_vent <> trunc(min_vent) OR max_vent <> trunc(max_vent) THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;


ALTER TABLE public.ctrl_thermo_command DROP CONSTRAINT IF EXISTS ctrl_thermo_command_channels_payload_check;
ALTER TABLE public.ctrl_thermo_command ADD CONSTRAINT ctrl_thermo_command_channels_payload_check
  CHECK (action <> 'SET_CHANNELS_THERMO' OR
    (channel IS NULL AND eqpmn_code IS NULL AND public.valid_command_channels(payload_json)));

COMMENT ON FUNCTION public.valid_command_channels(jsonb) IS
  'Validates selected A/B/C settings for one 0x0D 29-byte command; no privileged operations.';

-- New controller settings command. Existing 0x0C/0x0D commands remain valid.
create or replace function public.valid_device_settings(payload jsonb)
returns boolean language plpgsql immutable security invoker set search_path = public as $$
declare a jsonb; lo numeric; hi numeric; ch jsonb;
begin
 if payload is null or jsonb_typeof(payload) <> 'object' then return false; end if;
 a := payload->'alarm_settings';
 if jsonb_typeof(a) is distinct from 'object' or jsonb_typeof(a->'lowTempC') is distinct from 'number' or jsonb_typeof(a->'highTempC') is distinct from 'number' then return false; end if;
 lo := (a->>'lowTempC')::numeric; hi := (a->>'highTempC')::numeric;
 if lo < 0 or hi > 100 or lo >= hi or lo*10 <> trunc(lo*10) or hi*10 <> trunc(hi*10) then return false; end if;
 ch := payload->'command_channels';
 if ch is null then return true; end if;
 if jsonb_typeof(ch) <> 'array' then return false; end if;
 return jsonb_array_length(ch)=0 or public.valid_command_channels(payload);
exception when others then return false;
end $$;
alter table public.ctrl_thermo_command drop constraint if exists ctrl_thermo_command_action_check;
alter table public.ctrl_thermo_command add constraint ctrl_thermo_command_action_check
 check (action in ('SET_CTRL_THERMO','SET_CHANNEL_THERMO','SET_CHANNELS_THERMO','SET_CONTROLLER_SETTINGS'));
alter table public.ctrl_thermo_command drop constraint if exists ctrl_thermo_command_device_settings_check;
alter table public.ctrl_thermo_command add constraint ctrl_thermo_command_device_settings_check
 check (action <> 'SET_CONTROLLER_SETTINGS' or (channel is null and eqpmn_code is null and public.valid_device_settings(payload_json)));

-- Keep list reads scalar and append columns without rewriting the decoded table.
create or replace view public.v_iot_dashboard_list with (security_invoker=true) as
select d.id,d.raw_id,d.lsind_regist_no,d.item_code,d.module_uid,d.controller_key,
 d.eqpmn_no,d.stall_ty_code,d.stall_no,d.wire_ver,d.packet_mode,d.run_mode,d.temp_c,d.humidity_pct,
 d.fan_supply_pct,d.fan_exhaust_pct,d.fan_intake_pct,d.mesure_dt,d.mesure_at,d.received_at,
 d.setpoint_temp,d.temp_deviation,d.min_vent_pct,d.max_vent_pct,
 case when d.decoded_json->>'alarmLowTempC' ~ '^-?[0-9]+([.][0-9]+)?$' then (d.decoded_json->>'alarmLowTempC')::numeric else null end as alarm_low_temp_c,
 case when d.decoded_json->>'alarmHighTempC' ~ '^-?[0-9]+([.][0-9]+)?$' then (d.decoded_json->>'alarmHighTempC')::numeric else null end as alarm_high_temp_c
from (select distinct lsind_regist_no,item_code,module_uid,controller_key from public.iot_room_state_decoded
 where packet_mode='live' and decode_status='ok' and wire_ver=12 and received_at>now()-interval '2 hours') k
cross join lateral (select d1.* from public.iot_room_state_decoded d1
 where d1.lsind_regist_no=k.lsind_regist_no and d1.item_code=k.item_code and d1.module_uid=k.module_uid and d1.controller_key=k.controller_key
 and d1.packet_mode='live' and d1.decode_status='ok' and d1.wire_ver=12
 order by d1.received_at desc limit 1) d;
notify pgrst, 'reload schema';

