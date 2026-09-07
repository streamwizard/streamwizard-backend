-- GPS overlays publish over the websocket with the scene's own subscriber_token,
-- so the manual collector-token flow (and its dashboard page) is retired:
--   1. render_mode value 'phone' becomes 'gps'
--   2. delete_user_data re-emitted without the collector-token delete
--   3. irl_collector_tokens dropped

-- 1. Rename render_mode value. Constraint must go first so the UPDATE cannot
--    violate the old CHECK, then come back allowing only the new pair.
ALTER TABLE public.overlay_scenes DROP CONSTRAINT overlay_scenes_render_mode_check;
UPDATE public.overlay_scenes SET render_mode = 'gps' WHERE render_mode = 'phone';
ALTER TABLE public.overlay_scenes
  ADD CONSTRAINT overlay_scenes_render_mode_check
  CHECK (render_mode = ANY (ARRAY['obs'::text, 'gps'::text]));

-- 2. delete_user_data without the irl_collector_tokens delete (must be
--    replaced before the table drop; body otherwise identical to
--    20260612000000_fix_delete_user_data_clip_order.sql).
CREATE OR REPLACE FUNCTION "public"."delete_user_data"("p_twitch_user_id" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
  DELETE FROM public.widget_library_entries WHERE user_id = v_user_id;
  DELETE FROM public.widgets WHERE user_id = v_user_id;
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
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  DELETE FROM public.user_preferences WHERE user_id = v_user_id;
  DELETE FROM public.integrations_twitch WHERE user_id = v_user_id;
  DELETE FROM public.integrations WHERE user_id = v_user_id;
  DELETE FROM public.users WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;

-- 3. Collector tokens are gone for good.
DROP TABLE public.irl_collector_tokens;
