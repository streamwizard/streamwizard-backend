-- Per-item mirroring: flip a widget across its own horizontal or vertical
-- axis without touching its rotation.
--
-- Flip is stored separately from rotation so the renderer can compose them as
-- rotate() then scale(): a flipped and rotated item mirrors its content, not
-- its rotation, which is what a designer expects.
--
-- Defaults are false, so every existing row renders exactly as before.

ALTER TABLE "public"."overlay_items"
    ADD COLUMN IF NOT EXISTS "flip_h" boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS "flip_v" boolean DEFAULT false NOT NULL;
