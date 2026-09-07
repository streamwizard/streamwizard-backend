-- Replace the plan_id foreign key on obs_instances with subscription_id.
-- Linking to user_subscriptions is more precise: it captures which specific
-- grant (admin or Stripe) was active at provisioning time, and lets you join
-- directly to billing status, period end, and granted_by in one hop.
-- ON DELETE SET NULL keeps the instance running if the subscription row is
-- ever removed; the resource values (memory_mb, cpu_quota, etc.) remain on
-- the instance row so the container can be restarted regardless.

ALTER TABLE public.obs_instances
  DROP COLUMN plan_id,
  ADD COLUMN subscription_id uuid REFERENCES public.user_subscriptions(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS "obs_instances_plan_id_idx";

CREATE INDEX IF NOT EXISTS "obs_instances_subscription_id_idx"
  ON public.obs_instances USING btree ("subscription_id");
