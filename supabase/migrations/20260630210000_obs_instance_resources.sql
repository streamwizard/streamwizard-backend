-- Move per-instance resource allocation out of obs_nodes and onto obs_instances,
-- so each instance can be provisioned with the resources defined by its plan.
-- obs_nodes.memory_mb / cpu_quota / shm_size remain as node-level defaults
-- (used as a fallback by the backend and to represent typical per-instance cost
-- when planning node capacity), but the authoritative values are now stored on
-- the instance row itself.

ALTER TABLE public.obs_instances
  ADD COLUMN memory_mb integer,
  ADD COLUMN cpu_quota  numeric,
  ADD COLUMN shm_size   text,
  ADD COLUMN plan_id    text REFERENCES public.plans(id) ON DELETE SET NULL;

-- Backfill from the node's current defaults for any existing rows.
UPDATE public.obs_instances i
SET memory_mb = n.memory_mb,
    cpu_quota  = n.cpu_quota,
    shm_size   = n.shm_size
FROM public.obs_nodes n
WHERE i.node_id = n.id;

ALTER TABLE public.obs_instances
  ALTER COLUMN memory_mb SET NOT NULL,
  ALTER COLUMN cpu_quota  SET NOT NULL,
  ALTER COLUMN shm_size   SET NOT NULL;

CREATE INDEX IF NOT EXISTS "obs_instances_plan_id_idx"
  ON public.obs_instances USING btree ("plan_id");

-- Update cloud_obs plan limits to include per-instance resource allocations.
-- Resolution is stored in WIDTHxHEIGHT format to match the RESOLUTION env var
-- consumed by the obs-cloud-container image.
UPDATE public.plans SET limits =
  '{"resolution":"1280x720","fps":30,"max_instances":1,"memory_mb":2048,"cpu_quota":1,"shm_size":"1g","vram_mb":1024}'::jsonb
WHERE id = 'cloud_obs_720p_30';

UPDATE public.plans SET limits =
  '{"resolution":"1920x1080","fps":30,"max_instances":1,"memory_mb":4096,"cpu_quota":2,"shm_size":"2g","vram_mb":2048}'::jsonb
WHERE id = 'cloud_obs_1080p_30';

UPDATE public.plans SET limits =
  '{"resolution":"1920x1080","fps":60,"max_instances":1,"memory_mb":6144,"cpu_quota":4,"shm_size":"2g","vram_mb":4096}'::jsonb
WHERE id = 'cloud_obs_1080p_60';
