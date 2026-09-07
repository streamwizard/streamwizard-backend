-- Per-user key/value state that outlives any browser connection.
--
-- The problem it solves: overlay widgets only learn about events they are
-- connected for. The walking-stats widget resets its distance on stream.online,
-- so a streamer who goes live before opening OBS never gets the reset and the
-- overlay restores yesterday's total. Anything derived from a live event has
-- this shape. A durable row the server writes regardless of who is listening
-- turns "did you catch the event?" into "what does the state say?", which every
-- reader can answer correctly at any time.
--
-- Row per key rather than one jsonb blob per user: the point is several
-- independent writers (the bot, widgets, later the dashboard and chat
-- commands). A shared blob means read-modify-write, and one writer's update
-- silently erases another's. A row makes every write a single atomic upsert.
--
-- Keyed on user_id (not the Twitch channel id) to match overlay_scenes, to get
-- the auth.users cascade for free, and to stay usable if a second platform ever
-- shows up.

CREATE TABLE public.user_states (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key        text NOT NULL,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key),
  -- The dot is legal only behind the reserved prefix, so a user-chosen key can
  -- never collide with a server-owned one no matter what it is called.
  CONSTRAINT user_states_key_format CHECK (key ~ '^(sys\.)?[a-z0-9_]{1,64}$'),
  -- A widget with a loop in it should hit a wall, not fill the table.
  CONSTRAINT user_states_value_size CHECK (pg_column_size(value) <= 8192)
);

COMMENT ON TABLE public.user_states IS
  'Durable per-user key/value state. Keys prefixed sys. are written by the server only.';

-- Cap on distinct keys, enforced BEFORE INSERT only: updating an existing key
-- is the common path (a walking overlay rewrites `distance` every few seconds)
-- and must not pay for a count. Only minting a new key can grow the set, so
-- that is the only case worth checking.
CREATE OR REPLACE FUNCTION public.enforce_user_state_key_cap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.user_states WHERE user_id = NEW.user_id;

  IF v_count >= 200 THEN
    RAISE EXCEPTION 'user_states key limit reached (200)'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER user_states_key_cap
BEFORE INSERT ON public.user_states
FOR EACH ROW EXECUTE FUNCTION public.enforce_user_state_key_cap();

ALTER TABLE public.user_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own state"
  ON public.user_states FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- sys.* is excluded from user writes in both directions: USING stops an update
-- or delete of an existing system row, WITH CHECK stops one being created or
-- renamed into the namespace. The service role bypasses RLS and owns those
-- keys. Without this a widget could forge the current stream id and trigger a
-- distance reset whenever it liked.
CREATE POLICY "Users write own non-system state"
  ON public.user_states FOR ALL
  USING ((SELECT auth.uid()) = user_id AND key !~ '^sys\.')
  WITH CHECK ((SELECT auth.uid()) = user_id AND key !~ '^sys\.');

-- The FK cascade covers account deletion, but the Twitch authorization-revoke
-- path calls this function directly and enumerates its tables by hand.
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
  DELETE FROM public.user_states WHERE user_id = v_user_id;
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  DELETE FROM public.user_preferences WHERE user_id = v_user_id;
  DELETE FROM public.integrations_twitch WHERE user_id = v_user_id;
  DELETE FROM public.integrations WHERE user_id = v_user_id;
  DELETE FROM public.users WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;
