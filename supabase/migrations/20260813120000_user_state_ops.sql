-- Atomic mutations and reset policies for user_states.
--
-- Why a database function: state is written by three separate processes (the
-- bot, rest-api, and the web-overlay widget route). An increment done as
-- get-then-set from any of them races with the others — two mods running
-- "!death add 1" in the same second and one death disappears. Moving the
-- read-modify-write inside Postgres makes it a single serialized row
-- operation, and every caller shares it through one RPC.
--
-- Why reset policies live here and not in widgets: walking-stats currently
-- hand-rolls "zero the total when the stream id changes" in its own JS, which
-- every future counter would have to re-implement, and which a chat command
-- (no widget open) would never run at all. A definition row beside the state
-- gives the server one place to answer "when does this value go back to
-- zero", regardless of who reads or writes it.

-- ---------------------------------------------------------------------------
-- Definitions: per-key reset configuration. Absence of a row means "never
-- reset", so existing keys (and every key a widget mints ad hoc) behave
-- exactly as before this migration.
-- ---------------------------------------------------------------------------

CREATE TABLE public.user_state_definitions (
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key                 text NOT NULL,
  reset_policy        text NOT NULL DEFAULT 'never'
                      CHECK (reset_policy IN ('never', 'stream', 'daily')),
  reset_value         jsonb NOT NULL DEFAULT '0',
  -- Crash guard for the 'stream' policy: a dropped connection gets a new
  -- Twitch stream id minutes later, and blindly resetting on it would wipe an
  -- IRL distance or a death count mid-challenge. If the offline gap is
  -- shorter than this, the "new" stream is treated as a continuation and the
  -- reset is skipped. 0 means always reset.
  reset_grace_seconds integer NOT NULL DEFAULT 900 CHECK (reset_grace_seconds >= 0),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key),
  -- No sys. prefix here on purpose: system keys are managed by code, not by
  -- per-streamer policy, and a policy on one would let a reset clobber values
  -- the server depends on (sys.stream_ended_at drives the crash guard).
  CONSTRAINT user_state_definitions_key_format CHECK (key ~ '^[a-z0-9_]{1,64}$')
);

COMMENT ON TABLE public.user_state_definitions IS
  'Per-key reset configuration for user_states. No row = never reset.';

ALTER TABLE public.user_state_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own state definitions"
  ON public.user_state_definitions FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users write own state definitions"
  ON public.user_state_definitions FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- apply_user_state_op: the single mutation path.
--
-- SECURITY INVOKER on purpose: the function writes through the table, so RLS
-- (sys.* stays server-only for authenticated callers) and the table's own
-- constraints (key format, 8KB value, 200-key cap trigger) keep enforcing
-- themselves. The service role bypasses RLS as it does today.
--
-- The 'daily' reset is applied lazily at the top of every op — including
-- 'get' — because there is no scheduler: a widget loading at 01:00 must see
-- the reset value even if nothing wrote overnight. Days are UTC (server
-- time); an untouched key costs nothing.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_user_state_op(
  p_user_id uuid,
  p_key     text,
  p_op      text,
  p_value   jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  v_row public.user_states%ROWTYPE;
  v_def public.user_state_definitions%ROWTYPE;
BEGIN
  SELECT * INTO v_def FROM public.user_state_definitions
  WHERE user_id = p_user_id AND key = p_key;

  IF v_def.reset_policy = 'daily' THEN
    UPDATE public.user_states
    SET value = v_def.reset_value, updated_at = now()
    WHERE user_id = p_user_id AND key = p_key
      AND updated_at::date < current_date;
  END IF;

  IF p_op = 'get' THEN
    SELECT * INTO v_row FROM public.user_states
    WHERE user_id = p_user_id AND key = p_key;
    IF v_row.user_id IS NULL THEN
      RETURN jsonb_build_object('key', p_key, 'value', NULL, 'updated_at', NULL);
    END IF;

  ELSIF p_op = 'set' THEN
    IF p_value IS NULL THEN
      RAISE EXCEPTION 'set requires a value'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    INSERT INTO public.user_states (user_id, key, value)
    VALUES (p_user_id, p_key, p_value)
    ON CONFLICT (user_id, key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    RETURNING * INTO v_row;

  ELSIF p_op = 'increment' THEN
    IF p_value IS NULL OR jsonb_typeof(p_value) <> 'number' THEN
      RAISE EXCEPTION 'increment requires a numeric operand'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    -- A key that does not exist yet starts from its definition's reset_value
    -- when that is a number, otherwise from 0 — so the very first
    -- "!death add 1" lands on 1 without anyone creating the counter first.
    INSERT INTO public.user_states (user_id, key, value)
    VALUES (p_user_id, p_key,
            CASE WHEN v_def.user_id IS NOT NULL
                      AND jsonb_typeof(v_def.reset_value) = 'number'
                 THEN to_jsonb((v_def.reset_value #>> '{}')::numeric
                               + (p_value #>> '{}')::numeric)
                 ELSE p_value END)
    ON CONFLICT (user_id, key) DO NOTHING
    RETURNING * INTO v_row;
    IF v_row.user_id IS NULL THEN
      -- Row already existed: lock it so concurrent increments serialize
      -- instead of both reading the same old value.
      SELECT * INTO v_row FROM public.user_states
      WHERE user_id = p_user_id AND key = p_key
      FOR UPDATE;
      IF jsonb_typeof(v_row.value) <> 'number' THEN
        RAISE EXCEPTION 'cannot increment non-numeric value at key %', p_key
          USING ERRCODE = 'invalid_parameter_value';
      END IF;
      UPDATE public.user_states
      SET value = to_jsonb((value #>> '{}')::numeric + (p_value #>> '{}')::numeric),
          updated_at = now()
      WHERE user_id = p_user_id AND key = p_key
      RETURNING * INTO v_row;
    END IF;

  ELSIF p_op = 'delete' THEN
    DELETE FROM public.user_states
    WHERE user_id = p_user_id AND key = p_key;
    RETURN jsonb_build_object('key', p_key, 'value', NULL, 'updated_at', now());

  ELSE
    RAISE EXCEPTION 'unknown op %', p_op
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN jsonb_build_object(
    'key', v_row.key, 'value', v_row.value, 'updated_at', v_row.updated_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_user_state_op(uuid, text, text, jsonb)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- reset_stream_states: called by the stream.online handlers (bot and
-- rest-api, over independent transports — the duplicate call is idempotent:
-- the second caller finds the values already reset and changes nothing).
--
-- Must run BEFORE the handlers write the new sys.* keys, because the crash
-- guard needs the previous stream's sys.stream_ended_at. Only rows that
-- exist are reset — a defined-but-never-written key has nothing to zero and
-- creating it here would burn the 200-key cap for no reader.
--
-- Returns the changed rows so the caller can broadcast each one to open
-- overlays.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reset_stream_states(p_user_id uuid)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  v_ended_at timestamptz;
BEGIN
  -- sys.stream_ended_at is written by the stream.offline handlers as a jsonb
  -- string. NULL (never went offline, or key absent) means we cannot prove a
  -- crash, so every stream-policy key resets — the safe default for a
  -- genuinely new stream.
  SELECT (value #>> '{}')::timestamptz INTO v_ended_at
  FROM public.user_states
  WHERE user_id = p_user_id AND key = 'sys.stream_ended_at';

  RETURN QUERY
  UPDATE public.user_states s
  SET value = d.reset_value, updated_at = now()
  FROM public.user_state_definitions d
  WHERE d.user_id = s.user_id AND d.key = s.key
    AND s.user_id = p_user_id
    AND d.reset_policy = 'stream'
    -- Crash guard: an offline gap shorter than the key's grace window is a
    -- reconnect, not a new stream — keep the value.
    AND (v_ended_at IS NULL
         OR d.reset_grace_seconds = 0
         OR now() - v_ended_at >= make_interval(secs => d.reset_grace_seconds))
    -- Skip rows already at their reset value so the caller does not
    -- broadcast no-op updates (and the duplicate bot/rest-api call returns
    -- empty the second time).
    AND s.value IS DISTINCT FROM d.reset_value
  RETURNING jsonb_build_object(
    'key', s.key, 'value', s.value, 'updated_at', s.updated_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_stream_states(uuid)
  TO authenticated, service_role;

-- The FK cascade covers account deletion, but the Twitch authorization-revoke
-- path enumerates tables by hand — keep it complete.
CREATE OR REPLACE FUNCTION public.delete_user_data(p_twitch_user_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.integrations_twitch
  WHERE twitch_user_id = p_twitch_user_id;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  DELETE FROM public.clip_folder_junction WHERE user_id = v_user_id;
  DELETE FROM public.pending_clips WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.twitch_clip_syncs WHERE user_id = v_user_id;
  DELETE FROM public.stream_events WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.stream_viewer_counts WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.broadcaster_live_status WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.overlay_widget_instances WHERE user_id = v_user_id;
  DELETE FROM public.overlay_items WHERE scene_id IN (
    SELECT id FROM public.overlay_scenes WHERE user_id = v_user_id
  );
  DELETE FROM public.overlay_scenes WHERE user_id = v_user_id;
  DELETE FROM public.overlay_widget_library_entries WHERE user_id = v_user_id;
  DELETE FROM public.overlay_widgets WHERE user_id = v_user_id;
  DELETE FROM public.commands WHERE channel_id = p_twitch_user_id;
  DELETE FROM public.smp_players WHERE user_id = v_user_id;
  -- clips must be deleted before vods: clips_video_id_fkey references vods.video_id.
  DELETE FROM public.clips WHERE user_id = v_user_id;
  DELETE FROM public.vods WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.clip_folders WHERE user_id = v_user_id;
  DELETE FROM public.testimonials WHERE user_id = v_user_id;
  DELETE FROM public.feedback WHERE user_id = v_user_id;
  DELETE FROM public.system_events WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.irl_geo_track WHERE user_id = v_user_id;
  DELETE FROM public.user_state_definitions WHERE user_id = v_user_id;
  DELETE FROM public.user_states WHERE user_id = v_user_id;
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  DELETE FROM public.user_preferences WHERE user_id = v_user_id;
  DELETE FROM public.integrations_twitch WHERE user_id = v_user_id;
  DELETE FROM public.integrations WHERE user_id = v_user_id;
  DELETE FROM public.users WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;
