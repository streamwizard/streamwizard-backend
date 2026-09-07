-- Cache for Twitch presentation assets that EventSub payloads only reference by
-- id: badge artwork, cheermote tiers, profile images, game box art, third-party
-- emote maps. Overlay widgets can't call Helix (no credentials, and the iframe
-- CSP blocks the origin), so they go through /api/twitch/* which reads here.
--
-- ONLY assets live here. Live counters -- follower total, subscriber total,
-- concurrent viewers -- are deliberately absent: a stale badge image is an old
-- picture, a stale follower count is a wrong number on a goal bar. Those are
-- fetched fresh every time and protected from stampede by in-process
-- single-flight instead of by storage. Do not add them to this table.
--
-- Generic key/value on purpose: the TTL policy lives in one constant map in
-- @repo/twitch-assets rather than in the schema, so adding a resource is not a
-- migration. Expired rows are ignored on read and overwritten on refresh; the
-- row count is bounded by (channels + seen chatters + games), so no sweep job
-- until that stops being true.

CREATE TABLE public.twitch_asset_cache (
  -- 'badges:global' | 'badges:{broadcaster}' | 'cheermotes:{broadcaster}'
  -- | 'user:{twitch_user_id}' | 'game:{game_id}' | 'tpemotes:{provider}:{broadcaster}'
  cache_key  text PRIMARY KEY,
  payload    jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX twitch_asset_cache_expires_at_idx ON public.twitch_asset_cache (expires_at);

-- Service role only: this is server-side infrastructure, never read by a
-- browser session. No policies, so RLS denies everything else by default.
ALTER TABLE public.twitch_asset_cache ENABLE ROW LEVEL SECURITY;
