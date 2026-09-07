# StreamWizard Architecture

## Routing

### Dashboard app (`apps/web-streamwizard`)

The app uses Next.js App Router with two main route groups:

- `app/(auth)/` — Public auth flows (login, OAuth callback). No session required.
- `app/(protected)/dashboard/` — Authenticated dashboard. The layout at `app/(protected)/dashboard/layout.tsx` checks `auth.getUser()` and redirects to `/login` on failure.
- `app/api/` — REST API routes consumed by the OBS overlay app (`apps/web-overlay`). These use the admin Supabase client (`@repo/supabase/next/admin`) since they are unauthenticated public endpoints.

### Overlay playback app (`apps/web-overlay`)

- `app/[overlayId]/page.tsx` — Server-rendered canvas for OBS (browser source). `overlayId` is either an **active** overlay **slug** or a scene **UUID** (UUID skips `is_active`, for embed tooling).
- **Environment** — `import { env } from "@repo/env/next"` (same schema as **`packages/env/src/next.ts`** as the dashboard). **`next.config.js`** reads **`.env.local`** then **`.env`** from the monorepo root into **`process.env`** using the same parsing rules as **`packages/env`**, so setups where **`@next/env` cannot be resolved** (e.g. some Bun workspaces) still work. In production, inject the same variables on the host.
- `app/actions/*.ts` (Server Actions `"use server"`) — Trusted server reads via **`supabaseAdmin` from `@repo/supabase/next/admin`** and **`@repo/supabase/queries/*`**: load scene + merged clip widgets, Twitch clip playlists, signed download URLs.
- **`app/api/video/route.ts`** — Same-origin proxy for clip video URLs used by widgets.

Overlay data access follows the shared rule below: mutations are not surfaced here; all Supabase `.from()` usage goes through `@repo/supabase/queries/*`.

## Environment variables (`@repo/env`)

**All environment-backed configuration must go through the shared ENV package.** Import the typed `env` object from `@repo/env` or `@repo/env/next`; do **not** read `process.env` (or duplicate schemas with ad-hoc `createEnv`) in app features, routes, or shared packages.

There are two entry points in `packages/env/`:

### `import { env } from "@repo/env"` (root)

Use this anywhere that is **not** tied to Next’s bundling rules—shared packages (`@repo/supabase`, `@repo/twitch-api`, bots, scripts) and server-only dashboard code when it must match the **same canonical variable names** those packages validate.

How it behaves at startup:

1. **Optional `.env` file load:** If neither `SUPABASE_URL` nor `NEXT_PUBLIC_SUPABASE_URL` is set (typical outside Next—e.g. a worker starting from the shell), it walks upward from `process.cwd()` and loads `.env.local` then `.env` into `process.env`, without overwriting keys that are already set.
2. **Cross-platform aliases** so deploys can use Next-style or server-style names: for example `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` fill `SUPABASE_URL`/`SUPABASE_ANON_KEY`; `NEXT_PUBLIC_TWITCH_CLIENT_ID` fills `TWITCH_CLIENT_ID`; `SUPABASE_SERVICE_ROLE_KEY` fills `SUPABASE_SECRET_KEY`.
3. **Zod validation** of `process.env` runs once when the module loads. Missing or invalid keys throw with a formatted error listing failures.
4. The exported **`env`** object is the **typed, validated snapshot** (`Env`). Every consumer shares one schema (`packages/env/src/index.ts`).

### `import { env } from "@repo/env/next"` (Next.js)

Use this inside **Next.js apps** whenever you want an explicit **`server`** vs **`client`** split and correct inlining of public keys.

Implemented with **`@t3-oss/env-nextjs`** **`createEnv`** (`packages/env/src/next.ts`):

- **`server`:** secrets available only on the server (never exposed to the client bundle).
- **`client`:** `NEXT_PUBLIC_*` keys that may be referenced from client components.
- **`experimental__runtimeEnv`:** maps each client variable to `process.env.…` so only those names are inlined at build time—this is required for Turbopack/Webpack validation of client-side env access.

Prefer **`@repo/env/next`** for dashboard and overlay **application code**; keep **`@repo/env`** root for libraries that initialize before Next or validate the full canonical list.

When you introduce a **new** variable used by multiple apps or packages, add it to `packages/env` (extend the appropriate Zod schema) instead of defining a parallel schema in an app folder.

## Twitch Helix API rule

**All calls to Twitch Helix** (`https://api.twitch.tv/helix/*`) must go through **`@repo/twitch-api`**: construct **`new TwitchApi(broadcaster_id | null)`** and use the subdomain clients (`clips`, `streams`, etc.). App-token routes (e.g. `getClipDownloadUrl` → **`/clips/downloads`**) and user-token routes share the same facade; tokens and refresh are handled inside the package via **`@repo/supabase`** + **`@repo/env`**.

Do **not** call Helix with raw `fetch` / one-off HTTP from apps. Prefer mirroring the dashboard pattern in **`apps/web-streamwizard/src/actions/twitch/clips.ts`** (e.g. `const api = new TwitchApi(broadcasterId); await api.clips.getClipDownloadUrl(...)`).

Non-Helix OAuth (`https://id.twitch.tv/oauth2/token`) may stay in shared packages or app helpers until wrapped consistently.

**`apps/web-overlay`** uses the same **`TwitchApi`** approach for clip downloads; that pulls **`@repo/env`** root into the process, so `process.env` must satisfy the **canonical** `@repo/env` schema (aliases such as **`SUPABASE_SERVICE_ROLE_KEY`** → **`SUPABASE_SECRET_KEY`** still apply).

## Server Actions (`apps/web-streamwizard`)

All mutations go through Next.js Server Actions in `src/actions/`. The pattern is:

1. Call `getAuthContext()` from `src/lib/auth.ts` to get `{ supabase, user, broadcasterId }`.
2. Validate input (Zod schemas from `src/schemas/`).
3. Call a query function from `@repo/supabase/queries/*` — never query Supabase directly.
4. Return a plain `{ data, error }` or `{ success, error }` object.

## Database Access Rule

**Every Supabase `.from()` call must live in `packages/supabase/src/queries/*.ts`.**

No raw Supabase queries in app routes, action files, or components. Query functions accept a typed `DBClient = SupabaseClient<Database>` as the first parameter.

Existing query files:
| File | Tables covered |
|------|---------------|
| `queries/clips.ts` | `clips`, `clip_folders`, `clip_folder_junction` |
| `queries/commands.ts` | `commands`, `default_chat_commands`, `custom_commands` |
| `queries/live-status.ts` | `broadcaster_live_status` — upsert + `getLiveStreamIdByBroadcasterId` |
| `queries/overlays.ts` | `overlay_scenes`, `overlay_items` |
| `queries/public.ts` | `testimonials` |
| `queries/stream-analytics.ts` | `streams`, `stream_events`, `viewer_counts` |
| `queries/smp.ts` | `smp_players`, `smp_actions` |
| `queries/sync.ts` | `twitch_clip_syncs` |
| `queries/user.ts` | `integrations_twitch`, `user_preferences` |
| `queries/viewer-counts.ts` | `stream_viewer_counts` |
| `queries/vods.ts` | `vods`, `pending_clips` |

**Overlay-specific helpers:** `queries/overlays.ts` includes slug/UUID/embed loaders (`getActiveOverlaySceneBySlugMaybe`, `getOverlaySceneByIdForEmbed`) and ordered item lists (`getAllOverlayItemsByScene` sorts by `z_index`). `queries/clips.ts` exposes `createOverlayPlaylistClipQuery` for OBS clip playlists.

## Server vs Client Components (`apps/web-streamwizard`)

- Pages and layouts are **Server Components** by default.
- Interactive UI (editors, modals, forms) uses `"use client"` components.
- Server Actions bridge the gap: client components call them to mutate data without an explicit API layer.

## Backend Apps

### REST API (`apps/rest-api`)

Hono-based REST API that handles Twitch EventSub webhooks and clip sync operations.

- **Supabase**: Uses `supabase` singleton from `@repo/supabase` (service-role client). All DB access goes through `@repo/supabase/queries/*`.
- **Twitch API**: Constructs `new TwitchApi(broadcasterId)` per-request, same as dashboard.
- **EventSub handlers**: `src/handlers/eventHandler.ts` dispatches to typed handlers in `src/functions/twitch-eventsub-events/`. Each handler receives the event payload and a `TwitchApi` instance.
- **Clip sync**: `src/functions/sync-twitch.ts` is the canonical sync function used by both the HTTP route (`src/routes/clips-sync.ts`) and the stream-offline event handler.
- **Dev environment**: The `POST /webhooks/twitch/eventsub` route is **not registered** when `NODE_ENV=development`. Twitch requires HTTPS for webhook delivery; the route would never be reachable locally. EventSub WebSocket transport (`packages/twitch-eventsub`) is unaffected.

### EventSub Subscription Registration (`apps/web-streamwizard`)

On login, `checkEventSubscriptions` (`src/server/twitch/eventsub/check-event-subscriptions.ts`) compares the user's active Twitch subscriptions against the needed set defined in `src/server/twitch/eventsub/needed-event-subscriptions.ts` and creates any that are missing.

There are two transport types:
- **Conduit** — WebSocket-based, always registered.
- **Webhook** — HTTP callback to `rest-api`, skipped when `NODE_ENV=development` because Twitch requires HTTPS. Covers `stream.online`, `stream.offline`, and `channel.update`.

### Twitch Chat Bot (`apps/streamwizard-bot`)

Connects to Twitch chat via EventSub and responds to commands. Uses `supabase` from `@repo/supabase` for command lookups (via `@repo/supabase/queries/commands`) and `@repo/twitch-api` for chat messages.

### Discord Bot (`apps/discord-bot`)

A standalone Discord bot (Bun + discord.js v14). Commands (`src/commands/`) and gateway event listeners (`src/events/`) are auto-discovered by `src/handlers/` at startup — adding a file is enough, no manual registration. Slash commands still need to be pushed to Discord via `bun run deploy-commands` after they change. See the app's own `README.md` for the extension pattern.

Per-command role permissions are configured per-guild via `/permissions set command:<name> role:<@role>`, stored in the `discord_command_permissions` table, and cached in-memory for 5 minutes (`src/lib/permissions.ts`). A command with no rows is open to everyone. `/permissions` itself can only be run by the server owner (checked against `guild.ownerId` in code, since Discord has no "owner" permission flag to delegate to), so there's no bootstrap step.

## Package Dependencies

```
apps/web-streamwizard
  ├── @repo/supabase      — Supabase client + all DB query functions
  ├── @repo/twitch-api    — Typed Twitch Helix API client
  ├── @repo/ui            — Shared React components + overlay types
  ├── @repo/env           — Typed env (root schema); **`@repo/env/next`** for app server/client split
  └── @repo/types         — Shared TypeScript types (Twitch Helix response shapes)

apps/web-overlay
  ├── @repo/env/next       — **`env`** (`@repo/env/next`); replaces per-app `createEnv`
  ├── @repo/supabase      — **`@repo/supabase/next/admin`** (`supabaseAdmin`) + **`queries/*`** for overlay reads; `TwitchApi` also uses the root module for app tokens
  ├── @repo/twitch-api    — **`TwitchApi`** for Helix (same usage pattern as dashboard `actions/twitch/clips.ts`)
  ├── @repo/ui            — Overlay widget definitions + shared overlay types path

apps/rest-api
  ├── @repo/supabase      — `supabase` singleton (service role) + **`queries/*`** for all DB access
  ├── @repo/twitch-api    — **`TwitchApi`** per-request for EventSub handlers
  ├── @repo/env           — Root env schema for backend config
  └── @repo/schemas       — Zod schemas for EventSub payloads

apps/streamwizard-bot
  ├── @repo/supabase      — `supabase` singleton + **`queries/commands`**
  ├── @repo/twitch-api    — **`TwitchApi`** for chat messages
  └── @repo/schemas       — EventSub event types

apps/ws-server
  ├── @repo/env           — Root env schema (validates `SUPABASE_SECRET_KEY`, etc.)
  ├── @repo/supabase      — `supabase` singleton + **`queries/overlays`**, **`queries/user`**, **`queries/live-status`**, **`queries/irl`**
  └── @repo/types         — `BotBroadcastMessage`, `OverlayEventType`

apps/discord-bot
  ├── @repo/sentry        — `getSentryOptions` for error tracking
  └── @repo/supabase      — `supabase` singleton + **`queries/discord`** for the role-permission mapping
```

Next.js dashboard code imports **`env`** from **`@repo/env/next`** where the server/client distinction matters, and **`@repo/env`** when matching the canonical schema used by shared packages.

## Overlay System

Overlays are composed of **scenes** (`overlay_scenes`) containing **items** (`overlay_items`). The canonical type definitions live in `packages/ui/src/components/overlay/types.ts` and are re-exported from `apps/web-streamwizard/src/types/overlays.ts`.

**Consumption:**

- **REST** — `/api/overlays/[slug]/` returns JSON for external embeds; `/api/overlays/[slug]/clips` returns clip payloads for the same slug.
- **First-party OBS app** — `apps/web-overlay` renders the canvas server-side via Server Actions; it relies on query modules (above) plus `src/lib/overlay-*` helpers for route parsing and widget config normalization.

Both paths use an admin/service-role Supabase client; no end-user authentication is required for OBS playback endpoints.

### Widget Architecture — Container / Renderer split

```
packages/ui           → Pure Renderer + base definitions (visual output only, no data fetching)
apps/web-overlay      → Data Container (fetches via server action, passes to Renderer)
apps/web-streamwizard → Editor registration (CanvasContent, SettingsPanel, createRootItems)
```

**`packages/ui`** is the single source of truth for widget rendering:

| File | Purpose |
|------|---------|
| `src/components/overlay/types.ts` | All shared types (`OverlayItem`, `OverlayScene`, `ClipDataRow`, …) |
| `src/overlay-schemas.ts` | All Zod config schemas (`textWidgetItemConfigSchema`, etc.) |
| `src/components/overlay/OverlaySceneCanvas.tsx` | Shared canvas — renders any scene; text/timer/clock built-in |
| `src/components/overlay/widgets/<name>/` | `*WidgetRenderer.tsx` + `*-widget-definition.ts` per widget |
| `src/overlay-exports.ts` | Single barrel re-export (`@repo/ui/overlay`) |

**`OverlaySceneCanvas`** accepts an optional `widgets` prop for app-specific extensions (e.g. `ClipsWidgetContainer`). Core widgets (text, timer, clock) are registered internally — no app config needed.

**`apps/web-overlay`** has one file per data-fetching widget (`ClipsWidgetContainer`) and registers them in `app/[overlayId]/page.tsx`:

```ts
const OVERLAY_WIDGETS = [{ id: "clips_widget", Component: ClipsWidgetContainer }];
// ...
<OverlaySceneCanvas scene={result.scene} items={result.items.map(overlayItemFromDbRow)} widgets={OVERLAY_WIDGETS} />
```

**Canvas scaling:** The editor scales the entire scene with `transform: scale(zoom)` on the canvas wrapper. Individual renderers receive `zoom` only for internal hit-test / drag-handle calculations — they must NOT apply their own scale transform.

### Adding a new widget

1. **`packages/ui`** — create `*WidgetRenderer.tsx` (pure renderer) and `*-widget-definition.ts` (`defaultSize`, `createDefaultConfig`, `collectFontFamilies`). Export from `overlay-exports.ts`.
2. **`packages/ui/src/overlay-schemas.ts`** — add the Zod config schema and include it in `overlayItemSchema`.
3. **`apps/web-streamwizard`** — add the type to `OverlayItemType`, create a `*WidgetSettings.tsx` settings panel, and register an entry in `OVERLAY_WIDGET_REGISTRY` (`overlay-widget-registry.tsx`).
4. **`apps/web-overlay`** — only needed if the widget requires data fetching: create a `*WidgetContainer.tsx` and add `{ id: "…", Component: … }` to `OVERLAY_WIDGETS` in `page.tsx`.

Widgets that are purely static (text, timer, clock) require no changes in `web-overlay` — the canvas picks them up automatically.

---

## Overlay WebSocket Server (`apps/ws-server`)

The WS server is a **unified overlay event bus** — not just an IRL GPS relay. All real-time overlay data flows through a single Bun WebSocket server.

### Three roles

| Role | Auth | Description |
|------|------|-------------|
| `publisher` | Supabase JWT *or* `overlay_scenes.subscriber_token` | The GPS overlay page sending GPS payloads. One per user room. |
| `subscriber` | `overlay_scenes.subscriber_token` | OBS overlay WebSocket. Many per user room. |
| `bot` | `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` | `streamwizard-bot` — persistent connection, fans out Twitch events to subscribers. |

### Connection URL

```
ws://<host>/ws?role=<publisher|subscriber|bot>&token=<token>&channels=<comma-separated-event-types>
```

`channels` is optional for subscribers. Omitting it (or leaving it empty) means *receive all event types*.

### Event type strings

```ts
// Twitch EventSub types (pass-through, e.g.):
"channel.follow" | "channel.subscribe" | "channel.subscription.gift"
"channel.subscription.message" | "channel.raid" | "channel.cheer"

// Internal StreamWizard events:
"streamwizard.geo"    // GPS payload from the GPS overlay publisher
"streamwizard.status" // Publisher connection status: { status: "offline" }
```

All valid types are expressed as `OverlayEventType = EventSubSubscriptionType | StreamWizardEventType` in `packages/types/src/overlay-ws.ts`.

### Wire format

**Subscriber receives:**
```json
{ "type": "channel.follow", "payload": { "user_name": "...", "user_login": "...", "followed_at": "..." } }
{ "type": "streamwizard.geo", "payload": { "latitude": 0, "longitude": 0, ... } }
```

**Bot sends (inbound to server):**
```json
{ "userId": "<supabase-user-id>", "type": "channel.follow", "payload": { ... } }
```

### Bot integration

`streamwizard-bot` maintains a single persistent WebSocket to the overlay server (`overlay-ws-client.ts`). After every non-`channel.chat.message` event, `processTwitchEvent` in `handlers/eventHandler.ts` calls `broadcastOverlayEvent`, which resolves the Twitch broadcaster ID → Supabase user ID (via an in-memory cache backed by `getTwitchIntegrationByBroadcasterId`), then calls `overlayWsClient.send()`. Individual handlers no longer call `broadcastOverlayEvent` themselves.

The bot only connects if `OVERLAY_WS_URL` is set in the environment.
