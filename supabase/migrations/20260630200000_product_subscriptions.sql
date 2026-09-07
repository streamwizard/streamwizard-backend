-- Products: defines purchasable features (Cloud OBS, Ingest Server, etc.)
CREATE TABLE public.products (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products are publicly readable"
  ON public.products FOR SELECT TO authenticated
  USING (true);

-- Plans: per-product plans with flexible JSONB limits
-- limits examples: {"resolution": "1080p", "fps": 60, "max_instances": 1}
--                  {"max_stream_keys": 2, "max_output_keys": 2}
CREATE TABLE public.plans (
  id              text PRIMARY KEY,
  product_id      text NOT NULL REFERENCES public.products (id),
  name            text NOT NULL,
  limits          jsonb NOT NULL DEFAULT '{}',
  stripe_price_id text,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans are publicly readable"
  ON public.plans FOR SELECT TO authenticated
  USING (true);

-- User subscriptions: one row per user per plan
-- granted_by being non-null marks admin grants; Stripe webhooks skip those rows
CREATE TABLE public.user_subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  plan_id                text NOT NULL REFERENCES public.plans (id),
  status                 text NOT NULL DEFAULT 'inactive'
                           CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'inactive')),
  stripe_customer_id     text,
  stripe_subscription_id text UNIQUE,
  current_period_end     timestamptz,
  granted_by             uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  grant_note             text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_id)
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own subscriptions"
  ON public.user_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins can manage all subscriptions"
  ON public.user_subscriptions FOR ALL TO authenticated
  USING (public.check_user_role('admin'))
  WITH CHECK (public.check_user_role('admin'));

-- RPC: lightweight boolean check, usable in future RLS policies
CREATE OR REPLACE FUNCTION public.check_product_access (p_product_id text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE s.user_id = auth.uid()
      AND p.product_id = p_product_id
      AND s.status IN ('active', 'trialing', 'past_due')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
$$;

-- RPC: returns full access details for a product; used by server components
CREATE OR REPLACE FUNCTION public.get_product_access (p_product_id text)
RETURNS TABLE (
  can_access   boolean,
  can_interact boolean,
  status       text,
  plan_id      text,
  plan_name    text,
  limits       jsonb
)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT
    s.status IN ('active', 'trialing', 'past_due') AS can_access,
    s.status IN ('active', 'trialing')             AS can_interact,
    s.status,
    pl.id   AS plan_id,
    pl.name AS plan_name,
    pl.limits
  FROM public.user_subscriptions s
  JOIN public.plans pl ON s.plan_id = pl.id
  WHERE s.user_id = auth.uid()
    AND pl.product_id = p_product_id
    AND s.status NOT IN ('canceled', 'inactive')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ORDER BY
    CASE s.status
      WHEN 'active'   THEN 1
      WHEN 'trialing' THEN 2
      WHEN 'past_due' THEN 3
      ELSE 4
    END
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.check_product_access (text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_access (text) TO authenticated;

-- Seed initial products
INSERT INTO public.products (id, name, description) VALUES
  ('cloud_obs',     'Cloud OBS',     'Browser-based OBS streaming from the cloud'),
  ('ingest_server', 'Ingest Server', 'RTMP/SRT stream ingest with output routing');

-- Seed initial plans
INSERT INTO public.plans (id, product_id, name, limits, sort_order) VALUES
  ('cloud_obs_720p_30',   'cloud_obs',     '720p 30fps',  '{"resolution": "720p",  "fps": 30, "max_instances": 1}', 1),
  ('cloud_obs_1080p_30',  'cloud_obs',     '1080p 30fps', '{"resolution": "1080p", "fps": 30, "max_instances": 1}', 2),
  ('cloud_obs_1080p_60',  'cloud_obs',     '1080p 60fps', '{"resolution": "1080p", "fps": 60, "max_instances": 1}', 3),
  ('ingest_server_basic', 'ingest_server', 'Basic',       '{"max_stream_keys": 1, "max_output_keys": 1}',           1),
  ('ingest_server_pro',   'ingest_server', 'Pro',         '{"max_stream_keys": 2, "max_output_keys": 2}',           2);
