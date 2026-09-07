-- Per-item crop, stored as insets into the widget's design box (OBS-style).
--
-- The visible source region is design_w/design_h minus these insets, and that
-- region is what gets scaled into the item's rendered rect. Cropping in and
-- then stretching the box back out is how you zoom into a widget without ever
-- moving it outside the scene.
--
-- Insets rather than a rect: "no crop" is always four zeros, so resizing the
-- design box never has to keep a crop rectangle in sync.

ALTER TABLE "public"."overlay_items"
    ADD COLUMN IF NOT EXISTS "crop_top" real DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS "crop_right" real DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS "crop_bottom" real DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS "crop_left" real DEFAULT 0 NOT NULL;

ALTER TABLE "public"."overlay_items"
    ADD CONSTRAINT "overlay_items_crop_non_negative"
    CHECK (
        "crop_top" >= 0 AND "crop_right" >= 0
        AND "crop_bottom" >= 0 AND "crop_left" >= 0
    );

-- The crop must leave something to render.
ALTER TABLE "public"."overlay_items"
    ADD CONSTRAINT "overlay_items_crop_within_design"
    CHECK (
        "crop_left" + "crop_right" < "design_w"
        AND "crop_top" + "crop_bottom" < "design_h"
    );
