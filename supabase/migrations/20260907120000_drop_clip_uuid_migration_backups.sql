-- Drop the clip uuid migration safety-net snapshots.
--
-- 20260614000000_clip_ids_to_uuid.sql snapshotted clip_folder_junction and
-- clip_folders with their original integer ids before remapping them to uuid,
-- and said to drop the snapshots once prod was verified. That has happened, so
-- the tables are now dead weight: no code reads them, nothing references them,
-- and they are the only two tables in public without RLS enabled.

DROP TABLE IF EXISTS "public"."_clip_uuid_migration_backup_junction";
DROP TABLE IF EXISTS "public"."_clip_uuid_migration_backup_folders";
