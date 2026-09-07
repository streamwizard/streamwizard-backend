-- Drop the Minecraft SMP integration tables.
--
-- smp_actions, smp_channelpoints_templates, smp_players and smp_triggers came
-- in with the initial schema and backed the Minecraft SMP feature. Nothing in
-- this monorepo reads or writes them any more.
--
-- Dropped child-first so the FKs go without CASCADE:
--   smp_channelpoints_templates.action -> smp_actions.id
--   smp_triggers.action_id             -> smp_actions.id
-- smp_players only points outward (integrations_twitch, users), so it is free
-- standing. Policies and indexes go with their tables.

DROP TABLE IF EXISTS "public"."smp_channelpoints_templates";
DROP TABLE IF EXISTS "public"."smp_triggers";
DROP TABLE IF EXISTS "public"."smp_actions";
DROP TABLE IF EXISTS "public"."smp_players";

-- delete_user_data deleted from smp_players, so account deletion would fail
-- with "relation public.smp_players does not exist" the moment the table went.
-- Recreated here identical to 20260813120000_user_state_ops.sql minus that line.
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
