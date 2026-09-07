-- The clips overlay widget fetches one clip at a time so playback never stalls
-- on a playlist load. Sequential sorts are a keyset query through PostgREST,
-- but `order by random()` cannot be expressed there — hence this function.
--
-- Clips the widget played recently are ranked last rather than filtered out, so
-- a streamer with three clips still rotates instead of freezing once every clip
-- counts as recently played.

create or replace function public.pick_random_overlay_clip(
  p_user_id uuid,
  p_broadcaster_id text,
  p_clip_twitch_ids text[],
  p_game_ids text[],
  p_creator_ids text[],
  p_is_featured_only boolean,
  p_min_view_count integer,
  p_start timestamptz,
  p_end timestamptz,
  p_exclude_twitch_ids text[]
)
returns setof public.clips
language sql
stable
set search_path = public
as $$
  select c.*
    from public.clips c
   where (p_user_id is null or c.user_id = p_user_id)
     and (p_broadcaster_id is null or c.broadcaster_id = p_broadcaster_id)
     and (p_clip_twitch_ids is null or c.twitch_clip_id = any (p_clip_twitch_ids))
     and (array_length(p_game_ids, 1) is null or c.game_id = any (p_game_ids))
     and (array_length(p_creator_ids, 1) is null or c.creator_id = any (p_creator_ids))
     and (not coalesce(p_is_featured_only, false) or c.is_featured)
     and (coalesce(p_min_view_count, 0) = 0 or coalesce(c.view_count, 0) >= p_min_view_count)
     and (p_start is null or c.created_at_twitch >= p_start)
     and (p_end is null or c.created_at_twitch <= p_end)
   order by
     case
       when p_exclude_twitch_ids is null then 0
       when c.twitch_clip_id = any (p_exclude_twitch_ids) then 1
       else 0
     end,
     random()
   limit 1;
$$;

-- Only the overlay app calls this, and it calls it with the service role.
revoke all on function public.pick_random_overlay_clip(
  uuid, text, text[], text[], text[], boolean, integer, timestamptz, timestamptz, text[]
) from public, anon, authenticated;

grant execute on function public.pick_random_overlay_clip(
  uuid, text, text[], text[], text[], boolean, integer, timestamptz, timestamptz, text[]
) to service_role;
