-- Match the clips-showcase template to the widget's own defaults: whole library,
-- shuffled. "Last 30 days, most viewed" shows the same handful of clips on
-- repeat for a streamer whose library is older than a month — often nothing.
--
-- Only the template is changed: widgets already placed on an overlay keep
-- whatever the streamer configured.

update public.overlay_template_items
   set config = config
              || '{"timeWindow":"all","sort":"random"}'::jsonb
 where type = 'clips_widget';
