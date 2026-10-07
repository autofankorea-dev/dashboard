-- Existing RLS and legacy 0x0C commands are preserved.
CREATE OR REPLACE FUNCTION public.valid_command_channels(payload jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
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

ALTER TABLE public.ctrl_thermo_command DROP CONSTRAINT ctrl_thermo_command_action_check;
ALTER TABLE public.ctrl_thermo_command ADD CONSTRAINT ctrl_thermo_command_action_check
  CHECK (action IN ('SET_CTRL_THERMO', 'SET_CHANNEL_THERMO', 'SET_CHANNELS_THERMO'));
ALTER TABLE public.ctrl_thermo_command ADD CONSTRAINT ctrl_thermo_command_channels_payload_check
  CHECK (action <> 'SET_CHANNELS_THERMO' OR
    (channel IS NULL AND eqpmn_code IS NULL AND public.valid_command_channels(payload_json)));

COMMENT ON FUNCTION public.valid_command_channels(jsonb) IS
  'Validates selected A/B/C settings for one 0x0D 29-byte command; no privileged operations.';
