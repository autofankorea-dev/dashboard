-- All new channel/alarm settings use a fixed 33-byte 0x0E packet.
-- An omitted alarm_settings means flag 0 and FF-filled alarm bytes.
create or replace function public.valid_device_settings(payload jsonb)
returns boolean language plpgsql immutable security invoker set search_path = public as $$
declare a jsonb; lo numeric; hi numeric; ch jsonb; has_alarm boolean;
begin
 if payload is null or jsonb_typeof(payload) <> 'object' then return false; end if;
 has_alarm := payload ? 'alarm_settings';
 if has_alarm then
  a := payload->'alarm_settings';
  if jsonb_typeof(a) is distinct from 'object'
   or jsonb_typeof(a->'lowTempC') is distinct from 'number'
   or jsonb_typeof(a->'highTempC') is distinct from 'number' then return false; end if;
  lo := (a->>'lowTempC')::numeric; hi := (a->>'highTempC')::numeric;
  if lo < 0 or hi > 100 or lo >= hi or lo*10 <> trunc(lo*10) or hi*10 <> trunc(hi*10) then return false; end if;
 end if;
 ch := payload->'command_channels';
 if ch is null then return has_alarm; end if;
 if jsonb_typeof(ch) <> 'array' then return false; end if;
 if jsonb_array_length(ch)=0 then return has_alarm; end if;
 return public.valid_command_channels(payload);
exception when others then return false;
end $$;
comment on function public.valid_device_settings(jsonb) is
 '0x0E fixed 33-byte settings: selected channels and/or alarm pair; no-op rejected.';
notify pgrst, 'reload schema';
