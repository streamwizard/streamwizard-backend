-- Name every widget table after the product surface it belongs to, so the
-- overlay tables read as one group:
--
--   widgets                 -> overlay_widgets
--   widget_library_entries  -> overlay_widget_library_entries
--   overlay_widget_instances   (already prefixed, untouched)
--   overlay_widget_templates   (created in 20260804000000, already prefixed)
--
-- Renames are metadata-only: no data moves, no rewrite, no downtime on the
-- table itself. The app build that queries the new names must ship together
-- with this migration -- a deployed build still asking for `widgets` gets a
-- "relation does not exist" error the moment this lands.

ALTER TABLE public.widgets                RENAME TO overlay_widgets;
ALTER TABLE public.widget_library_entries RENAME TO overlay_widget_library_entries;

-- Carry the names through to the constraints, indexes, and policies so nothing
-- still says "widgets_*" after the fact.
ALTER TABLE public.overlay_widgets RENAME CONSTRAINT widgets_pkey         TO overlay_widgets_pkey;
ALTER TABLE public.overlay_widgets RENAME CONSTRAINT widgets_user_id_fkey TO overlay_widgets_user_id_fkey;

ALTER TABLE public.overlay_widget_library_entries
  RENAME CONSTRAINT widget_library_entries_pkey TO overlay_widget_library_entries_pkey;
ALTER TABLE public.overlay_widget_library_entries
  RENAME CONSTRAINT widget_library_entries_user_id_fkey TO overlay_widget_library_entries_user_id_fkey;
ALTER TABLE public.overlay_widget_library_entries
  RENAME CONSTRAINT widget_library_entries_widget_id_fkey TO overlay_widget_library_entries_widget_id_fkey;

ALTER INDEX public.idx_widgets_user_id                 RENAME TO idx_overlay_widgets_user_id;
ALTER INDEX public.idx_widget_library_entries_user_id RENAME TO idx_overlay_widget_library_entries_user_id;
ALTER INDEX public.idx_widget_library_entries_widget_id
  RENAME TO idx_overlay_widget_library_entries_widget_id;

ALTER POLICY "Users manage own widgets" ON public.overlay_widgets
  RENAME TO "Users manage own overlay widgets";

ALTER POLICY widget_library_entries_select ON public.overlay_widget_library_entries
  RENAME TO overlay_widget_library_entries_select;
ALTER POLICY widget_library_entries_insert ON public.overlay_widget_library_entries
  RENAME TO overlay_widget_library_entries_insert;
ALTER POLICY widget_library_entries_update ON public.overlay_widget_library_entries
  RENAME TO overlay_widget_library_entries_update;
ALTER POLICY widget_library_entries_delete ON public.overlay_widget_library_entries
  RENAME TO overlay_widget_library_entries_delete;

-- Functions store their bodies as text, so they keep pointing at the old names
-- until rewritten.
CREATE OR REPLACE FUNCTION public.increment_widget_installs(entry_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE overlay_widget_library_entries SET installs = installs + 1 WHERE id = entry_id;
$$;

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
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  DELETE FROM public.user_preferences WHERE user_id = v_user_id;
  DELETE FROM public.integrations_twitch WHERE user_id = v_user_id;
  DELETE FROM public.integrations WHERE user_id = v_user_id;
  DELETE FROM public.users WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;
