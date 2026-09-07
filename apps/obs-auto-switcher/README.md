# obs-auto-switcher

NOALBS-style auto scene-switcher for IRL streamers on Cloud OBS. Watches the
1 Hz SRT/RTMP ingest stats, and switches the user's OBS to their "low
bitrate" / "connection lost" scene when the link degrades or dies — then
switches back once it's stable. Configured per user from the Cloud OBS page
("Auto Switcher" tab).

## How it fits together

```
ingest-control ──(role=bot)──► ws-server ──(role=consumer)──► this engine
web server actions ──POST /internal/broadcast──► ws-server ──► this engine   (config/override pushes)
this engine ──POST /obs/instances/:id/command──► obs-instance-manager ──► obs-websocket (container)
this engine ──(role=bot)──► ws-server ──► user room                          (auto_switcher_status for the UI)
```

- **Config source of truth**: `public.obs_auto_switcher_configs` (one row per
  user). Loaded at boot, re-fetched every 60s; web writes are additionally
  pushed live through ws-server so changes/overrides land within ~1s. No
  Supabase realtime on purpose.
- **State machine**: port of xpudu monitoring's per-path switcher — per-metric
  (bitrate / RTT / loss) bad/good streaks with trigger/recover/startup poll
  counts, a startup gate, stats-silence offline detection (plus the instant
  `ingest_session_ended` push), manual override with expiry, warning-source
  toggle, and optional auto stop-stream. See `src/engine/user-monitor.ts`.
- **Scene identity**: scenes are targeted by obs-websocket v5 `sceneUuid`, so
  renames in OBS don't break switching. Names are display-only.
- **Feature toggles per user**: stream_events logging (`obs.scene_switch`,
  provider `streamwizard`; skipped while not live on Twitch), Twitch chat
  notices (app token + StreamWizard bot sender), warning overlay source,
  auto stop-stream.

## Run exactly ONE replica

Streaks, session selection, and override bookkeeping are in-memory. Two
replicas would double-switch and fight each other. If this ever needs to
scale, shard users across replicas — don't duplicate them.

## Env

| Var | Purpose |
| --- | --- |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | config reads, obs_instances/obs_nodes lookups, stream_events inserts, bot auth to ws-server |
| `WS_SERVER_URL` | ws-server base URL (ws(s)://) |
| `CONSUMER_SECRET` | ws-server `role=consumer` + `/internal/broadcast` (must match ws-server's env) |
| `TOKEN_ENCRYPTION_KEY` | decrypts each node's per-node `obs_command` key (from `obs_node_api_keys`) before calling the node's `/obs` route |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | chat notices via `@repo/twitch-api` |
| `PORT` (default 8010) | `/health` liveness endpoint |
| `SENTRY_DSN` / `SENTRY_RELEASE` | optional |

## Dev

```
bun run dev        # doppler config dev_obs_auto_switcher
bun test           # state machine tests (src/engine/user-monitor.test.ts)
```
