-- Overlay items gain an intrinsic "design box" so resizing a widget scales its
-- content instead of only moving the clipping frame.
--
-- x/y/w/h stay the rendered rect in scene pixels. design_w/design_h are the size
-- the widget's content is authored at; the renderer draws at the design size and
-- applies `transform: scale(w / design_w)`.
--
-- Backfill design_w/design_h from the current w/h so every existing item starts
-- at scale 1 and renders exactly as it did before this migration.

ALTER TABLE "public"."overlay_items"
    ADD COLUMN IF NOT EXISTS "design_w" real,
    ADD COLUMN IF NOT EXISTS "design_h" real;

UPDATE "public"."overlay_items"
SET "design_w" = "w", "design_h" = "h"
WHERE "design_w" IS NULL OR "design_h" IS NULL;

ALTER TABLE "public"."overlay_items"
    ALTER COLUMN "design_w" SET DEFAULT 400,
    ALTER COLUMN "design_h" SET DEFAULT 300,
    ALTER COLUMN "design_w" SET NOT NULL,
    ALTER COLUMN "design_h" SET NOT NULL;

-- A zero design size would make the derived scale infinite.
ALTER TABLE "public"."overlay_items"
    ADD CONSTRAINT "overlay_items_design_size_positive"
    CHECK ("design_w" > 0 AND "design_h" > 0);
