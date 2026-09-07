-- The clips widget no longer loads a playlist: it fetches one clip at a time and
-- keeps the next one buffered, so `maxClips` (rotation cap) and
-- `refreshIntervalSeconds` (playlist reload timer) have nothing left to control.
-- Strip them from stored configs so the inspector and the schema agree with the DB.

update public.overlay_items
   set config = config - 'maxClips' - 'refreshIntervalSeconds'
 where type = 'clips_widget'
   and (config ? 'maxClips' or config ? 'refreshIntervalSeconds');

update public.overlay_template_items
   set config = config - 'maxClips' - 'refreshIntervalSeconds'
 where type = 'clips_widget'
   and (config ? 'maxClips' or config ? 'refreshIntervalSeconds');
