-- Run against the intended operating project. Always rolls back; no command is published.
begin;
do $$
declare
  ch jsonb := '{"command_channels":[{"channel":"A","eqpmnCode":"EC01","setpointTemp":25,"tempDeviation":2,"minVentPct":10,"maxVentPct":100}]}';
  alarm jsonb := '{"alarm_settings":{"lowTempC":10,"highTempC":43.6},"command_channels":[]}';
  cmd public.ctrl_thermo_command%rowtype;
  test_id uuid;
begin
  assert public.valid_command_channels(ch), 'valid channel rejected';
  assert not public.valid_command_channels('{"command_channels":[]}'), 'empty 0x0D accepted';
  assert not public.valid_command_channels(jsonb_set(ch,'{command_channels,0,setpointTemp}','30.1')), 'out-of-range channel accepted';
  assert not public.valid_command_channels(jsonb_set(ch,'{command_channels,0,minVentPct}','100.1')), 'fractional ventilation accepted';
  assert not public.valid_command_channels(jsonb_set(ch,'{command_channels,1}',ch->'command_channels'->0)), 'duplicate channel accepted';
  assert public.valid_device_settings(alarm), 'alarm-only rejected';
  assert public.valid_device_settings(alarm || ch), 'combined alarm/channel rejected';
  assert not public.valid_device_settings(null), 'missing payload accepted';
  assert not public.valid_device_settings(jsonb_set(alarm,'{alarm_settings,lowTempC}','43.6')), 'equal alarm limits accepted';
  assert not public.valid_device_settings(jsonb_set(alarm,'{alarm_settings,highTempC}','100.1')), 'out-of-range alarm accepted';
  assert not public.valid_device_settings(jsonb_set(alarm,'{alarm_settings,lowTempC}','10.01')), 'excess precision accepted';
  assert not public.valid_device_settings(jsonb_set(alarm,'{alarm_settings,lowTempC}','"10"')), 'string alarm accepted';

  -- Exercise actual table constraints using a prior command's foreign keys.
  select * into strict cmd from public.ctrl_thermo_command order by created_at desc limit 1;
  cmd.id := gen_random_uuid(); test_id := cmd.id;
  cmd.status := 'cancelled'; cmd.channel := null; cmd.eqpmn_code := null;
  cmd.setpoint_temp := 25; cmd.temp_deviation := 2; cmd.min_vent_pct := 0; cmd.max_vent_pct := 100;
  cmd.action := 'SET_CHANNELS_THERMO'; cmd.payload_json := ch;
  insert into public.ctrl_thermo_command
    (id,created_by,module_uid,ctrl_idx,setpoint_temp,temp_deviation,min_vent_pct,max_vent_pct,
     action,status,lsind_regist_no,item_code,stall_ty_code,stall_no,eqpmn_no,payload_json)
  values (cmd.id,cmd.created_by,cmd.module_uid,cmd.ctrl_idx,cmd.setpoint_temp,cmd.temp_deviation,
    cmd.min_vent_pct,cmd.max_vent_pct,cmd.action,cmd.status,cmd.lsind_regist_no,cmd.item_code,
    cmd.stall_ty_code,cmd.stall_no,cmd.eqpmn_no,cmd.payload_json);
  update public.ctrl_thermo_command set action='SET_CONTROLLER_SETTINGS',payload_json=alarm where id=test_id;
  update public.ctrl_thermo_command set payload_json=alarm || ch where id=test_id;
  begin
    update public.ctrl_thermo_command set payload_json='{}' where id=test_id;
    raise exception 'invalid device settings passed table constraint';
  exception when check_violation then null;
  end;
  begin
    update public.ctrl_thermo_command set action='SET_CHANNELS_THERMO',payload_json='{}' where id=test_id;
    raise exception 'invalid channels passed table constraint';
  exception when check_violation then null;
  end;
  assert '43.6' ~ '^-?[0-9]+([.][0-9]+)?$', 'decimal regex failed';
  assert not 'bad' ~ '^-?[0-9]+([.][0-9]+)?$', 'invalid numeric accepted';
end $$;
rollback;
