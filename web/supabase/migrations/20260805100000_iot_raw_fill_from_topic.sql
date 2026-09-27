-- Phase 2-A: derive lsind/item/module_uid from MQTT topic on raw INSERT
-- Applied on iot-cloud 2026-08-05 (see web/docs/RAW_STORAGE_CHANGE.md)

CREATE OR REPLACE FUNCTION public.iot_raw_fill_from_topic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parts text[];
BEGIN
  -- sungil/{lsind}/{item}/raw
  parts := string_to_array(NEW.topic, '/');
  IF array_length(parts, 1) >= 4
     AND parts[1] = 'sungil'
     AND parts[4] = 'raw' THEN
    IF NEW.lsind_regist_no IS NULL OR NEW.lsind_regist_no = '' THEN
      NEW.lsind_regist_no := parts[2];
    END IF;
    IF NEW.item_code IS NULL OR NEW.item_code = '' THEN
      NEW.item_code := parts[3];
    END IF;
  END IF;
  IF NEW.module_uid IS NULL THEN
    NEW.module_uid := 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_iot_raw_fill_from_topic ON public.iot_room_state_raw;
CREATE TRIGGER trg_iot_raw_fill_from_topic
  BEFORE INSERT ON public.iot_room_state_raw
  FOR EACH ROW
  EXECUTE FUNCTION public.iot_raw_fill_from_topic();

ALTER TABLE public.iot_room_state_raw
  ALTER COLUMN module_uid SET DEFAULT 1;

-- Allow Phase 3 RS to omit keys; trigger fills from topic before NOT NULL check path
ALTER TABLE public.iot_room_state_raw
  ALTER COLUMN lsind_regist_no SET DEFAULT '',
  ALTER COLUMN item_code SET DEFAULT '';
