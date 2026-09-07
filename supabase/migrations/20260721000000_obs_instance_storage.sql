-- Per-instance media storage quota + usage accounting for the OBS file manager.
--
-- Users upload media (images/video/audio) into their instance's /home/app/media
-- mount via the obs-instance-manager /instances/:id/files API. storage_quota_mb
-- caps how much they can store (default 500MB); used_storage_bytes is the live
-- usage the node reports back after each upload/delete so the dashboard can show
-- a storage bar without re-summing anything.

ALTER TABLE public.obs_instances
  ADD COLUMN storage_quota_mb   integer NOT NULL DEFAULT 500,
  ADD COLUMN used_storage_bytes bigint  NOT NULL DEFAULT 0;
