-- Container resource limits (memory/cpu/shm/vram) are driven entirely by the
-- user's subscription plan (see 20260630210000_obs_instance_resources.sql) and
-- stored per-instance on obs_instances. obs-instance-manager never reads
-- obs_nodes.memory_mb/cpu_quota/shm_size/vram_mb, so these node-level columns
-- are dead weight -- drop them.
ALTER TABLE public.obs_nodes
  DROP COLUMN memory_mb,
  DROP COLUMN cpu_quota,
  DROP COLUMN vram_mb,
  DROP COLUMN shm_size;

-- total_vram_mb is now self-reported by the node during /api/nodes/claim
-- (install.sh already runs nvidia-smi on the box), rather than guessed by an
-- admin at node-creation time, so it's unknown until the node links.
ALTER TABLE public.obs_nodes
  ALTER COLUMN total_vram_mb DROP NOT NULL;

-- Full hardware inventory + the hostname the panel assigned, all populated
-- from install.sh's self-reported facts at claim time.
ALTER TABLE public.obs_nodes
  ADD COLUMN ram_total_mb integer,
  ADD COLUMN cpu_cores integer,
  ADD COLUMN gpu_model text,
  ADD COLUMN storage_total_mb integer,
  ADD COLUMN hostname text;
