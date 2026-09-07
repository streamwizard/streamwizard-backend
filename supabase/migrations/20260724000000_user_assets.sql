-- User-uploaded overlay assets (alert images/sounds/videos) stored in Cloudflare R2.
--
-- Rows are created status='pending' when an upload is presigned, and flipped to
-- 'ready' after the server confirms the object exists (HeadObject) and records
-- its exact size. Only 'ready' rows count toward usage; pending rows older than
-- an hour are treated as abandoned and cleaned up by the reconcile action.
--
-- user_storage_usage mirrors the obs_instances used_storage_bytes pattern: a
-- live counter maintained by trigger so the dashboard storage bar never has to
-- re-sum user_assets.

CREATE TABLE public.user_assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- R2 object key: assets/{user_id}/{asset_id}/{file_name}
  key         text NOT NULL UNIQUE,
  file_name   text NOT NULL,
  mime_type   text NOT NULL,
  size_bytes  bigint NOT NULL DEFAULT 0,
  kind        text NOT NULL CHECK (kind IN ('image', 'audio', 'video', 'lottie')),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_assets_user_id_idx ON public.user_assets (user_id);

CREATE TABLE public.user_storage_usage (
  user_id    uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  used_bytes bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Usage counter: only 'ready' rows count. SECURITY DEFINER so the trigger can
-- write user_storage_usage regardless of the caller's RLS.
CREATE OR REPLACE FUNCTION public.apply_user_asset_usage_delta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta bigint := 0;
  uid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    uid := NEW.user_id;
    IF NEW.status = 'ready' THEN delta := NEW.size_bytes; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    uid := NEW.user_id;
    delta := (CASE WHEN NEW.status = 'ready' THEN NEW.size_bytes ELSE 0 END)
           - (CASE WHEN OLD.status = 'ready' THEN OLD.size_bytes ELSE 0 END);
  ELSE
    uid := OLD.user_id;
    IF OLD.status = 'ready' THEN delta := -OLD.size_bytes; END IF;
  END IF;

  IF delta <> 0 THEN
    INSERT INTO public.user_storage_usage (user_id, used_bytes, updated_at)
    VALUES (uid, GREATEST(delta, 0), now())
    ON CONFLICT (user_id) DO UPDATE
      SET used_bytes = GREATEST(public.user_storage_usage.used_bytes + delta, 0),
          updated_at = now();
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER user_assets_usage_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.user_assets
FOR EACH ROW EXECUTE FUNCTION public.apply_user_asset_usage_delta();

ALTER TABLE public.user_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_storage_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own assets"
  ON public.user_assets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Read-only for owners; writes happen only through the trigger.
CREATE POLICY "Users read own storage usage"
  ON public.user_storage_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Paid plans get more asset storage than the code-level free default (100MB).
-- Read via limits->'storage'->>'asset_quota_mb'; max across active subs wins.
UPDATE public.plans
SET limits = limits || '{"storage": {"asset_quota_mb": 1024}}'::jsonb
WHERE product_id = 'cloud_obs';
