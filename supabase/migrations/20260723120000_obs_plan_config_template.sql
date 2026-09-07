-- Plan-owned OBS profile templates.
--
-- The OBS profile (basic/profiles/: resolution, fps, encoder/output) is now
-- sourced from a per-plan folder in the streamwizard-obs bucket under
-- obs-templates/<config_template>/ and re-applied on every instance start, rather
-- than being baked into the user's saved config. Each cloud_obs plan names its
-- folder via a new `config_template` key in its limits jsonb, and every instance
-- snapshots that name so the manager's resume path knows which folder to pull.

-- 1. Snapshot column on obs_instances. Nullable: rows created before this migration
--    fall back to the manager's DEFAULT_TEMPLATE. Set at create from plan limits and
--    re-applied when a user's plan changes.
ALTER TABLE public.obs_instances
  ADD COLUMN config_template text;

-- 2. Point each cloud_obs plan at its template folder. `||` merges the key in while
--    preserving the existing limits (resolution/fps/memory_mb/...).
UPDATE public.plans
SET limits = limits || jsonb_build_object('config_template', '720p30')
WHERE id = 'cloud_obs_720p_30';

UPDATE public.plans
SET limits = limits || jsonb_build_object('config_template', '1080p30')
WHERE id = 'cloud_obs_1080p_30';

UPDATE public.plans
SET limits = limits || jsonb_build_object('config_template', '1080p60')
WHERE id = 'cloud_obs_1080p_60';
