-- Per-item anchor: which scene edge (or the centre) an item's x/y are
-- measured from.
--
-- "Align right" used to write a top-left x and forget about it, so the item
-- drifted off the edge the moment the scene's resolution changed. An anchor
-- makes the offset a relationship: an item anchored bottom-right sits in that
-- corner at any scene size, and the same row renders in the same place in the
-- editor, in OBS and in the portrait GPS view.
--
-- Defaults are top-left, so every existing row keeps its exact position.
-- Offsets can go negative for a centre anchor (left of / above the centre),
-- so x and y stay unconstrained.

ALTER TABLE "public"."overlay_items"
    ADD COLUMN IF NOT EXISTS "anchor_x" text DEFAULT 'left' NOT NULL,
    ADD COLUMN IF NOT EXISTS "anchor_y" text DEFAULT 'top' NOT NULL;

ALTER TABLE "public"."overlay_items"
    ADD CONSTRAINT "overlay_items_anchor_x_valid"
    CHECK ("anchor_x" IN ('left', 'center', 'right'));

ALTER TABLE "public"."overlay_items"
    ADD CONSTRAINT "overlay_items_anchor_y_valid"
    CHECK ("anchor_y" IN ('top', 'center', 'bottom'));
