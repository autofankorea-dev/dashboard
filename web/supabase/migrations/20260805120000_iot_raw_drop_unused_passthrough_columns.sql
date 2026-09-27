-- Phase 4: drop unused iot_room_state_raw columns (RS passthrough never writes them).
-- See web/docs/RAW_STORAGE_CHANGE.md §8.
-- Applied on iot-cloud 2026-08-05.
-- idx_iot_raw_session (session_id) is removed with the column.

ALTER TABLE public.iot_room_state_raw DROP COLUMN IF EXISTS wire_ver;
ALTER TABLE public.iot_room_state_raw DROP COLUMN IF EXISTS lut_ver;
ALTER TABLE public.iot_room_state_raw DROP COLUMN IF EXISTS row_count;
ALTER TABLE public.iot_room_state_raw DROP COLUMN IF EXISTS batch_seq;
ALTER TABLE public.iot_room_state_raw DROP COLUMN IF EXISTS crc_ok;
ALTER TABLE public.iot_room_state_raw DROP COLUMN IF EXISTS farm_uid;
ALTER TABLE public.iot_room_state_raw DROP COLUMN IF EXISTS session_id;
