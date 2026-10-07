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
alter table public.ctrl_thermo_command drop constraint ctrl_thermo_command_action_check;
alter table public.ctrl_thermo_command add constraint ctrl_thermo_command_action_check
 check (action in ('SET_CTRL_THERMO','SET_CHANNEL_THERMO','SET_CHANNELS_THERMO','SET_CONTROLLER_SETTINGS'));
alter table public.ctrl_thermo_command add constraint ctrl_thermo_command_device_settings_check
 check (action <> 'SET_CONTROLLER_SETTINGS' or (channel is null and eqpmn_code is null and public.valid_device_settings(payload_json)));

-- Keep list reads scalar and append columns without rewriting the decoded table.
create or replace view public.v_iot_dashboard_list with (security_invoker=true) as
select d.id,d.raw_id,d.lsind_regist_no,d.item_code,d.module_uid,d.controller_key,
 d.eqpmn_no,d.stall_ty_code,d.stall_no,d.wire_ver,d.packet_mode,d.run_mode,d.temp_c,d.humidity_pct,
 d.fan_supply_pct,d.fan_exhaust_pct,d.fan_intake_pct,d.mesure_dt,d.mesure_at,d.received_at,
 d.setpoint_temp,d.temp_deviation,d.min_vent_pct,d.max_vent_pct,
 case when d.decoded_json->>'alarmLowTempC' ~ '^-?[0-9]+(\.[0-9]+)?$' then (d.decoded_json->>'alarmLowTempC')::numeric else null end as alarm_low_temp_c,
 case when d.decoded_json->>'alarmHighTempC' ~ '^-?[0-9]+(\.[0-9]+)?$' then (d.decoded_json->>'alarmHighTempC')::numeric else null end as alarm_high_temp_c
from (select distinct lsind_regist_no,item_code,module_uid,controller_key from public.iot_room_state_decoded
 where packet_mode='live' and decode_status='ok' and wire_ver=12 and received_at>now()-interval '2 hours') k
cross join lateral (select d1.* from public.iot_room_state_decoded d1
 where d1.lsind_regist_no=k.lsind_regist_no and d1.item_code=k.item_code and d1.module_uid=k.module_uid and d1.controller_key=k.controller_key
 and d1.packet_mode='live' and d1.decode_status='ok' and d1.wire_ver=12
 order by d1.received_at desc limit 1) d;
notify pgrst, 'reload schema';
