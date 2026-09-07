-- Favourites for the overlay library. A favourited overlay is pinned to the
-- top of the list so the one being worked on stops hiding among the rest.
--
-- Scenes belong to exactly one user, so a flag on the scene row already is the
-- per-user flag; a join table would only earn its keep if scenes were shared.
ALTER TABLE public.overlay_scenes
  ADD COLUMN IF NOT EXISTS is_favourite boolean NOT NULL DEFAULT false;

-- Pinning is not editing. The generic trigger stamps updated_at on any UPDATE,
-- which would make a favourite jump to the top of "last edited" and change the
-- date on its card. Keep the old stamp when the favourite flag is the only
-- thing that changed.
CREATE OR REPLACE FUNCTION public.overlay_scenes_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (to_jsonb(NEW) - 'is_favourite' - 'updated_at') = (to_jsonb(OLD) - 'is_favourite' - 'updated_at') THEN
    NEW.updated_at = OLD.updated_at;
  ELSE
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.overlay_scenes_set_updated_at() OWNER TO postgres;

DROP TRIGGER IF EXISTS set_overlay_scenes_updated_at ON public.overlay_scenes;
CREATE TRIGGER set_overlay_scenes_updated_at
  BEFORE UPDATE ON public.overlay_scenes
  FOR EACH ROW EXECUTE FUNCTION public.overlay_scenes_set_updated_at();
