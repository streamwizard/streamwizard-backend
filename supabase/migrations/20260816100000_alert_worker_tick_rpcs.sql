-- Two RPCs that collapse the alert-worker's per-tick Supabase traffic.
--
-- Before this, every evaluation pass cost 10 REST round trips: the lock
-- INSERT, four registry reads (obs_nodes, ingest_nodes, ingest_sessions,
-- broadcaster_live_status), the rule/notification config reads, the
-- alert_state read, the alert_state upsert, and the lock DELETE. At a 15s
-- tick that was ~50,000 requests/day against rows that barely change —
-- Supabase meters ~1.3KB of gateway overhead per request, so request COUNT,
-- not payload, is what blew the staging egress cap.
--
-- alert_worker_tick_snapshot folds the lock acquire and all six reads into
-- one call; alert_worker_tick_persist folds the state upsert, event insert,
-- and lock release into another. 10 requests/tick -> 2.
--
-- SECURITY INVOKER: the worker connects as service_role, which already owns
-- full access to these tables; the functions add no privilege. EXECUTE is
-- revoked from everyone else — the snapshot exposes the node registry and
-- alert state, which RLS reserves for admins.

-- ---------------------------------------------------------------------------
-- Snapshot: everything the engine needs at the top of a tick, in one trip.
--
-- p_lock_name NULL skips the overlap lock entirely (ALERT_LOCK_ENABLED=false
-- escape hatch). When the lock is contested, returns just
-- {"locked": false} — the caller skips the pass without paying for the
-- registry payload.
--
-- The function is one transaction: if it errors, the lock insert rolls back
-- with it, so a failed snapshot never leaves a stray lease behind.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.alert_worker_tick_snapshot(
  p_env               text,
  p_lock_name         text,
  p_lock_ttl_seconds  integer,
  p_owner             text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF p_lock_name IS NOT NULL THEN
    -- Insert-or-steal in one statement: a fresh row wins, an expired lease
    -- (a pass that crashed without releasing) is taken over, a live lease
    -- updates nothing and FOUND stays false. Mirrors the semantics the
    -- worker previously implemented client-side in tryAcquireAlertLock.
    INSERT INTO public.alert_locks (name, locked_at, expires_at, locked_by)
    VALUES (p_lock_name, now(), now() + make_interval(secs => p_lock_ttl_seconds), p_owner)
    ON CONFLICT (name) DO UPDATE
      SET locked_at  = EXCLUDED.locked_at,
          expires_at = EXCLUDED.expires_at,
          locked_by  = EXCLUDED.locked_by
      WHERE public.alert_locks.expires_at < now();

    IF NOT FOUND THEN
      RETURN jsonb_build_object('locked', false);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'locked', true,
    'obs_nodes', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'id', n.id, 'name', n.name, 'status', n.status,
         'maintenance', n.maintenance, 'created_at', n.created_at,
         'api_url', n.api_url))
       FROM public.obs_nodes n),
      '[]'::jsonb),
    'ingest_nodes', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'id', n.id, 'name', n.name, 'status', n.status,
         'maintenance', n.maintenance, 'created_at', n.created_at,
         'tailscale_ip', n.tailscale_ip))
       FROM public.ingest_nodes n),
      '[]'::jsonb),
    'live_ingest_sessions', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', s.id, 'started_at', s.started_at))
       FROM public.ingest_sessions s
       WHERE s.ended_at IS NULL),
      '[]'::jsonb),
    -- EXISTS, not count: the only consumer short-circuits on "nobody live"
    -- and never reads the number.
    'any_channel_live',
      EXISTS (SELECT 1 FROM public.broadcaster_live_status WHERE is_live),
    'rule_configs', COALESCE(
      (SELECT jsonb_agg(to_jsonb(rc)) FROM public.alert_rule_config rc),
      '[]'::jsonb),
    -- Filtered server-side; the worker previously downloaded every env's row
    -- and picked its own client-side.
    'notification_config',
      (SELECT to_jsonb(nc) FROM public.alert_notification_config nc
       WHERE nc.env = p_env),
    'alert_states', COALESCE(
      (SELECT jsonb_agg(to_jsonb(st)) FROM public.alert_state st
       WHERE st.env = p_env),
      '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.alert_worker_tick_snapshot(text, text, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alert_worker_tick_snapshot(text, text, integer, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Persist: the tick's writes — state upsert, history events, lock release —
-- in one trip. Runs AFTER notification dispatch so notify_failed flags land
-- in the same call (the old flow wrote state before dispatch and then wrote
-- again for failures; the accepted tradeoff is that a crash between dispatch
-- and persist can double-notify once on the next tick).
--
-- p_lock_name NULL means there is no lease to release.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.alert_worker_tick_persist(
  p_states     jsonb,
  p_events     jsonb,
  p_lock_name  text,
  p_owner      text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF p_states IS NOT NULL AND jsonb_array_length(p_states) > 0 THEN
    INSERT INTO public.alert_state
      (rule_id, env, entity_id, status, severity, consecutive_breaches,
       first_fired_at, last_notified_at, silenced_until, notify_failed,
       last_value, message)
    SELECT
      r.rule_id, r.env, COALESCE(r.entity_id, ''), COALESCE(r.status, 'ok'),
      r.severity, COALESCE(r.consecutive_breaches, 0),
      r.first_fired_at, r.last_notified_at, r.silenced_until,
      COALESCE(r.notify_failed, false), r.last_value, r.message
    FROM jsonb_to_recordset(p_states) AS r(
      rule_id text, env text, entity_id text, status text, severity text,
      consecutive_breaches integer, first_fired_at timestamptz,
      last_notified_at timestamptz, silenced_until timestamptz,
      notify_failed boolean, last_value double precision, message text)
    ON CONFLICT (rule_id, env, entity_id) DO UPDATE SET
      status               = EXCLUDED.status,
      severity             = EXCLUDED.severity,
      consecutive_breaches = EXCLUDED.consecutive_breaches,
      first_fired_at       = EXCLUDED.first_fired_at,
      last_notified_at     = EXCLUDED.last_notified_at,
      silenced_until       = EXCLUDED.silenced_until,
      notify_failed        = EXCLUDED.notify_failed,
      last_value           = EXCLUDED.last_value,
      message              = EXCLUDED.message;
  END IF;

  IF p_events IS NOT NULL AND jsonb_array_length(p_events) > 0 THEN
    INSERT INTO public.alert_events
      (rule_id, env, entity_id, event_type, severity, value, message)
    SELECT
      e.rule_id, e.env, COALESCE(e.entity_id, ''), e.event_type,
      e.severity, e.value, e.message
    FROM jsonb_to_recordset(p_events) AS e(
      rule_id text, env text, entity_id text, event_type text,
      severity text, value double precision, message text);
  END IF;

  IF p_lock_name IS NOT NULL THEN
    DELETE FROM public.alert_locks
    WHERE name = p_lock_name AND locked_by = p_owner;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.alert_worker_tick_persist(jsonb, jsonb, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alert_worker_tick_persist(jsonb, jsonb, text, text)
  TO service_role;
