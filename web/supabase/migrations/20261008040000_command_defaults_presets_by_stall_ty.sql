-- Org-wide command edit defaults + shared presets keyed by stall type (축사유형).
-- UI labels may show 1차/2차/3차; channel JSON keys remain A/B/C.

CREATE TABLE IF NOT EXISTS public.command_defaults (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  setpoint_temp numeric(4, 1) NOT NULL,
  temp_deviation numeric(4, 1) NOT NULL,
  min_vent_pct integer NOT NULL,
  max_vent_pct integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id),
  CONSTRAINT command_defaults_setpoint_chk
    CHECK (setpoint_temp >= 0 AND setpoint_temp <= 30),
  CONSTRAINT command_defaults_deviation_chk
    CHECK (temp_deviation >= 0.5 AND temp_deviation <= 10),
  CONSTRAINT command_defaults_vent_chk
    CHECK (
      min_vent_pct >= 0
      AND max_vent_pct <= 100
      AND min_vent_pct <= max_vent_pct
    )
);

COMMENT ON TABLE public.command_defaults IS
  '명령 편집 기본값(전역 1행). 설정 패널 「기본값」·시드에 사용.';

INSERT INTO public.command_defaults (
  id, setpoint_temp, temp_deviation, min_vent_pct, max_vent_pct
)
VALUES (1, 25.0, 2.0, 10, 100)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.command_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stall_ty_code text NOT NULL,
  name text NOT NULL,
  channels jsonb NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id),
  updated_by uuid REFERENCES auth.users (id),
  CONSTRAINT command_presets_stall_ty_chk
    CHECK (stall_ty_code ~ '^[A-Z]{2}[0-9]{2}$'),
  CONSTRAINT command_presets_name_chk
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 12),
  CONSTRAINT command_presets_channels_obj_chk
    CHECK (jsonb_typeof(channels) = 'object'),
  CONSTRAINT command_presets_stall_name_uq UNIQUE (stall_ty_code, name)
);

CREATE INDEX IF NOT EXISTS idx_command_presets_stall_ty_sort
  ON public.command_presets (stall_ty_code, sort_order, name);

COMMENT ON TABLE public.command_presets IS
  '축사유형별 공용 명령 프리셋. channels JSON keys = A/B/C PanelDraft.';
COMMENT ON COLUMN public.command_presets.stall_ty_code IS
  '축사유형코드 (예: SP07). 농장 공통이 아니라 유형별.';

ALTER TABLE public.command_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.command_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS command_defaults_select ON public.command_defaults;
CREATE POLICY command_defaults_select ON public.command_defaults
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS command_defaults_insert ON public.command_defaults;
CREATE POLICY command_defaults_insert ON public.command_defaults
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS command_defaults_update ON public.command_defaults;
CREATE POLICY command_defaults_update ON public.command_defaults
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS command_defaults_delete ON public.command_defaults;
CREATE POLICY command_defaults_delete ON public.command_defaults
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS command_presets_select ON public.command_presets;
CREATE POLICY command_presets_select ON public.command_presets
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS command_presets_insert ON public.command_presets;
CREATE POLICY command_presets_insert ON public.command_presets
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS command_presets_update ON public.command_presets;
CREATE POLICY command_presets_update ON public.command_presets
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS command_presets_delete ON public.command_presets;
CREATE POLICY command_presets_delete ON public.command_presets
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.command_defaults TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.command_defaults TO authenticated;
GRANT SELECT ON public.command_presets TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.command_presets TO authenticated;
