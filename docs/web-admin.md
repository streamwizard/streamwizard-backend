# web-admin — internal admin dashboard

`apps/web-admin` (port 3003, `dev:admin`, Doppler config `dev_web_admin`) is the internal ops app. Since the admin-page migration it carries **all** product-admin tooling; `apps/web-streamwizard` has no admin routes left.

## Access model

- Sign-in: Twitch OAuth via Supabase (own cookie/domain — separate session from the main app).
- Gate: `src/app/(monitor)/layout.tsx` requires a `user_roles` row with `role = 'admin'` (service-role lookup). Non-admins land on `/no-access`.
- Every server action re-checks via `src/lib/assert-admin.ts` (`assertAdmin()`, returns the acting admin's user id) — actions are their own POST endpoints, the layout guard doesn't cover them.
- `/vnc` sits outside the `(monitor)` group (bare full-screen popup) and runs the same check in its own `src/app/vnc/layout.tsx`.
- The old `app_metadata.is_admin` JWT claim is no longer read anywhere; `user_roles` is the single source of admin truth.

## Pages

| Route | What it does |
|---|---|
| `/overview`, `/http`, `/eventsub`, `/database`, `/supabase`, `/ws/*`, `/alerts/*` | Monitoring (InfluxDB via `@repo/metrics`, alerting config) — pre-existing |
| `/obs` | OBS fleet monitoring **+ "Manage Nodes"** (register/edit/delete GPU nodes, claim-token install command, live health) |
| `/obs/[nodeId]` | Node detail: hardware card, live metrics stream, instance table (start/stop/remove/VNC), 24h history charts |
| `/obs/[nodeId]/instances/[instanceId]` | Instance detail, tabbed: **Overview** (details incl. RAM limit, CPU quota, shm, config template, storage used/quota + live metrics), **Metrics history** (per-instance InfluxDB series), **Auto Switcher** (edit the owner's switcher config, hold/release scene override) |
| `/ingest` | Ingest fleet monitoring **+ "Manage Nodes"** (SRT/SRTLA boxes, claim-token install) |
| `/subscriptions` | Grant/revoke/edit product subscriptions per user (independent of Stripe) |
| `/widget-library` | Moderation queue for community widget submissions (sandboxed iframe previews) |
| `/vnc?nodeId&instanceId&name` | noVNC popup onto an instance's OBS desktop (opened from node/instance pages) |

## How it talks to obs-instance-manager

Base URL is always the node's `api_url`, resolved server-side (never from the query string — the URL gets tokens/tickets attached).

REST (Supabase JWT in `Authorization: Bearer`, verified against Supabase JWKS on the node; admin routes additionally check the role via rest-api `GET /api/nodes/users/:userId/is-admin`):

- `GET /health` — node health badges / fleet table / alert probes
- `POST /instances` — create instance (from node detail)
- `POST /admin/instances/:id/start|stop`, `DELETE /admin/instances/:id`
- `POST /admin/ws-ticket`, `POST /admin/instances/:id/ws-ticket` — mint single-use ~30s WS tickets

WebSocket (ticket in query string, minted immediately before every connect):

- `/admin/metrics/stream` — host + per-container metrics (Twitch-EventSub-style envelope)
- `/admin/instances/:id/novnc` — VNC (RFB password comes from the ticket response)
- `/admin/instances/:id/obsws` — obs-websocket proxy; powers the Auto Switcher tab's scene pickers. Password is the instance's OBS WS password, decrypted server-side (`getInstanceObsWsPasswordAdminAction`).

**CORS**: start/stop/remove and ticket mints are browser-side fetches from the web-admin origin. If the manager enforces an Origin allowlist, the admin origin must be on it.

## Auto Switcher editing

Config is **per user** (`obs_auto_switcher_configs`, one row per user), not per instance — the instance page edits its *owner's* row. Admin actions (`src/actions/auto-switcher.ts`) use the service-role client after `assertAdmin()`, then push the row through ws-server `POST /internal/broadcast` so the engine reacts in ~1s. Without `WS_SERVER_URL`/`CONSUMER_SECRET` the push is skipped and the engine's 60s DB reconcile picks the change up instead.

Scene pickers populate only while the instance's OBS is running (obsws session); the form saves fine without it — scenes are stored by uuid, names are display-only.

## Environment (Doppler, per config)

| Var | Required | Purpose |
|---|---|---|
| `INFLUXDB_URL/TOKEN/ORG/BUCKET` | yes | metrics source |
| `SUPABASE_URL`, `SUPABASE_PUBLIC_KEY`, `SUPABASE_SECRET_KEY` | yes | auth + service-role |
| `STREAMWIZARD_API_URL` | yes | embedded in node install commands (`/obs`, `/ingest`) |
| `TOKEN_ENCRYPTION_KEY` | yes | encrypt/decrypt OBS WS passwords — **must be byte-identical to web-streamwizard's** |
| `WS_SERVER_URL`, `CONSUMER_SECRET` | no | ~1s auto-switcher config pushes (fallback: 60s reconcile) |
| `SENTRY_DSN`, `ALERT_*`, `DISCORD_BOT_TOKEN`, `TELEGRAM_*`, `MONITOR_SECRET` | no | observability + alert routing |

## Known gaps / roadmap

- **Files tab**: obs-instance-manager only has user-scoped file routes (`/instances/:id/files*`, ownership-checked). Admin file management needs `/admin/instances/:id/files*` mirrors (incl. `/download`, plus the upload body-size exemption in the manager's `index.ts`).
- **No container logs**: a `GET /admin/instances/:id/logs` (or WS tail) on the manager would enable a log viewer.
- **Create-for-user**: `POST /instances` creates under the caller; provisioning an instance *for* a user needs an admin variant with a target `user_id`.
- **Live switcher status card**: the engine publishes status into the user's ws-server room; admin subscription to another user's channel needs a ws-server change.
- **Widget approval cache**: approving a widget no longer revalidates the user-facing `/dashboard/widget-library` cache (cross-app revalidation impossible); entries appear on next request.
