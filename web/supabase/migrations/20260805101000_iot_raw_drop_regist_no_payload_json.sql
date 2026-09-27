-- Phase 2-B: remove duplicate raw columns
-- Wire source of truth = payload_bytea + topic
-- Applied on iot-cloud 2026-08-05 (see web/docs/RAW_STORAGE_CHANGE.md)
-- No live views depended on these columns at apply time.

ALTER TABLE public.iot_room_state_raw DROP COLUMN IF EXISTS regist_no;
ALTER TABLE public.iot_room_state_raw DROP COLUMN IF EXISTS payload_json;
