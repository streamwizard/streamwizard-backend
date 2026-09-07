-- Custom widget settings moved from overlay_widget_instances.field_values into
-- the overlay item's own config, so they save with the scene and can be
-- previewed in the editor without a round trip. The instance row stays as the
-- home of widget_state.
--
-- Readers still fall back to the instance row when config.field_values is
-- absent, so this backfill is not load-bearing -- it just means existing items
-- carry their settings from the first render.

UPDATE public.overlay_items AS oi
SET config = oi.config || jsonb_build_object('field_values', owi.field_values)
FROM public.overlay_widget_instances AS owi
WHERE owi.overlay_item_id = oi.id
  AND oi.type = 'custom_widget'
  AND NOT (oi.config ? 'field_values');
