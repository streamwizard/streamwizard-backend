# Repo cleanup — running log

Goal: make the monorepo dev-friendly again without changing behaviour. No logic
changes, no feature work. Split oversized files, kill duplicated code, move
Supabase queries back into `@repo/supabase`, and give every shared concern one
home.

Verification per step: `bunx tsc --noEmit` inside each touched app (the web apps
have no `check-types` script), plus `bun run build` for the Next apps.

## New shared packages

| Package | Why it exists |
| --- | --- |
| `@repo/obs-web` | Browser-side OBS pieces that web-streamwizard and web-admin both had verbatim copies of: the obs-websocket v5 hook, ws-ticket minting, the noVNC viewer, and the auto-switcher form + override controls (the two apps now pass their own server actions in as props). |
| `@repo/ws-client` | The `POST /internal/broadcast` fan-out into ws-server. Five hand-rolled copies of the same fetch (URL rewrite, bearer secret, 3s timeout) collapsed into one typed helper; callers still decide what a failure means. |

## Done

- **web-admin: deleted its private copy of shadcn/ui** (16 files, ~2.7k lines).
  Every `@/components/ui/*` import now resolves to `@repo/ui`, which already had
  all of them. The only drift was `cursor-pointer` on the package's button.
- **web-admin + web-streamwizard: shared the OBS browser layer.**
  `use-obs-websocket.ts` (499 lines) and `ws-ticket.ts` were byte-identical in
  both apps; `CloudOBSViewer` too. All three now live in `@repo/obs-web`.
- **Auto-switcher UI de-duplicated.** `auto-switcher-form.tsx` (~512 lines) and
  `auto-switcher-override-controls.tsx` existed twice, differing only in which
  server action they called. Both moved to `@repo/obs-web` and take the action
  as a prop (`onSave`, `onHold`, `onRelease`).
- **Auto-switcher schema + form defaults moved to `@repo/schemas`**
  (`src/auto-switcher-form.ts`): `autoSwitcherFormSchema`, `PRESET_COPY` and
  `defaultsFrom` were duplicated per app.
- **Auto-switcher Supabase queries moved into `@repo/supabase`**
  (`queries/auto-switcher.ts`, metrics-wrapped like the other query modules).
  The apps keep thin `"use server"` actions that own auth and the engine push.
- **ws-server broadcast unified** on `@repo/ws-client` in rest-api, web-overlay,
  web-streamwizard (test alerts + auto-switcher) and web-admin.
- **Duplicate `use-mobile` hooks deleted** in both web apps (web-admin's copy
  had no importers at all); `@repo/ui` already exported it.
- **web-admin monitor charts share a kit** (`components/charts/chart-kit.tsx`):
  palette, tooltip chrome, axis ticks, the card/empty-state/responsive-container
  shell, the SWR-poll-on-range hook, and the time-bucketing transform each chart
  had its own copy of. Applied to the ws, http, platform and node charts.

- **Supabase queries pulled back into `@repo/supabase`.** New query modules:
  `auto-switcher`, `overlay-widgets`, `assets`, `data-export`, `platform-stats`,
  plus additions to `ingest`, `obs-nodes`, `overlays` and `subscriptions`.
  `apps/web-streamwizard` and `apps/web-admin` no longer contain a single raw
  `.from("table")` call outside two page components' one-liners.
- **`actions/overlays.ts` (802 lines) split** into `actions/overlays/{scenes,
  templates,items,shared}.ts`. The five copies of the "map a validated item to
  its DB columns" block collapsed into `overlayItemColumns`, and the template
  rollback path into one `abort()` helper.
- **`actions/widgets.ts`** now delegates every query; the three copies of
  "duplicate a widget's source rows" share `overlayWidgetColumns`.
- **`actions/auth/request-data.ts`: 155 → 24 lines.** The GDPR export walked 18
  tables via a hand-written 18-way `Promise.all`, destructure and `if` chain;
  it's now a table spec list in `@repo/supabase/queries/data-export`.
- **Auth boilerplate**: `tryAuthContext()` replaces the
  `let supabase, user; try { … } catch { return … }` prologue that opened every
  server action in web-streamwizard.
- **Admin dashboards**: the database page's 15 inline count queries and the
  overview page's snapshot moved to `queries/platform-stats`; admin subscription
  grants moved to `queries/subscriptions`.
- **Dead prop removed**: charts no longer take `rangeHours` (the range comes
  from context; the prop was passed as `24` at every call site and never read).

- **Overlay editor split.** `use-overlay-store.ts` 746 → 588 (pure item/geometry
  helpers now in `overlay-item-helpers.ts`); `editor-canvas.tsx` 767 → 317 (all
  pointer handling in `use-canvas-gestures.ts`, the resize/crop maths in
  `canvas-resize-math.ts` where it can be read without a mouse, clip-preview
  plumbing in `use-editor-clip-playback.ts`); `editor-inspector.tsx` 704 → 560
  (scale/crop/fit/align in `use-inspector-commands.ts`, with the six
  copy-pasted `alignX()` functions collapsed to `align(edge)`).
- **Widget editor**: Monaco options + Emmet provider and the field-coercion
  helper moved out of `widget-editor-client.tsx` (766 → 656).
- **rest-api `routes/nodes.ts` 556 → 396.** The Twitch stream-key flow moved to
  `lib/twitch-stream-key.ts`, and its hand-rolled AES-256-GCM encrypt/decrypt
  pair (byte-identical to `@repo/supabase/crypto`, which the same file already
  imported) is gone.
- **`@repo/alerting` rules split.** `rules.ts` 1027 → 66: constants in
  `rules/thresholds.ts`, the rule constructors in `rules/builders.ts`, and the
  33 rules themselves in one module per domain (`obs-nodes`, `ingest`, `api`,
  `websocket`, `database`, `probes`). Verified the emitted rule id set is
  byte-identical to before, and `bun test` (26 tests) passes.
- **discord-bot**: `TWITCH_PURPLE` de-duplicated into `lib/branding.ts`.

- **`@repo/ui` overlay types split.** `components/overlay/types.ts` 808 → a
  4-module `types/` directory (`base`, `clips`, `widgets`, `item`) behind a
  barrel, so every existing `./types` import still resolves. The clip type
  guards moved next to the clip config they narrow to, which leaves the runtime
  import graph acyclic (`widgets → item → clips`, everything else type-only).
- **Cloud OBS page**: the container lifecycle (which instance, is it running,
  the obs-websocket connection, launch/start/stop, and the lifecycle feed from
  other devices) moved to `use-cloud-obs-instance.ts`; the page component is now
  onboarding state + render.
- **Clip preview**: display-field drag/resize moved to `use-clip-field-drag.ts`
  (736 → 651).
- **obs-auto-switcher**: per-metric bad/good streak bookkeeping became a
  `MetricStreaks` class (`engine/metric-streaks.ts`), replacing six hand-rolled
  `for (const key of METRICS)` loops in the monitor (682 → 614). 13 engine tests
  still pass.
- **`@repo/twitch-eventsub`**: consumer-facing interfaces to `types.ts` and the
  status/close-code explanations to `reasons.ts` (673 → 563).
- **web-admin node sections**: `copy`, `statusVariant` and the health
  variant/label helpers deduplicated into `lib/node-ui.ts`.

- **OBS instance session shared.** The dashboard and the phone deck each owned
  the same ~120 lines: find my instance, load its node URL + obs-websocket
  password, connect, and follow starts/stops from other devices. Both now use
  `components/irl/use-obs-instance-session.ts`; what actually differs (launching
  a first container, the deck's reconnect-on-wake) stayed with the callers.
  `_deck-content.tsx` 663 → 566.
- **Cloud OBS page 585 → 429**: launch-flow booleans to a pure
  `deriveObsFlowState()`, the status pill to `_obs-status-badge.tsx`, the
  container/stream strips to `_obs-container-control.tsx`, and the whole
  first-run stepper screen to `_cloud-obs-setup-screen.tsx`.
- **Clip preview 651 → 273**: the playlist engine (clip pool, play order, URL
  resolution/prefetch, dual-player crossfade) is now `use-clip-playlist.ts`.

- **Route folders hold routes only.** 26 files that lived next to their
  `page.tsx` moved out: components to `src/components/<feature>/`, server
  actions to `src/actions/`. The `_`-prefix (a Next private-file convention that
  only means anything inside `app/`) is gone with them.

  | Was | Now |
  | --- | --- |
  | `app/(protected)/dashboard/irl/obs/_*` | `components/irl/cloud-obs/` |
  | `app/(protected)/dashboard/widgets/[id]/widget-*` | `components/widgets/editor/` |
  | `app/(protected)/deck/_*` | `components/deck/` |
  | `app/(monitor)/subscriptions/_subscriptions-client` | `components/subscriptions/` |
  | `app/(monitor)/widget-library/admin-widget-library-client` | `components/widget-library/` |
  | `app/(monitor)/alerts/**/actions.ts`, `app/login/actions.ts` | `actions/{alerts,alert-notifications,alert-rules,auth}.ts` |
  | `app/[overlayId]/GpsOverlayCanvas` | `components/gps-overlay-canvas` (web-overlay) |

- **VOD dialog store 658 → 431**: event↔clip↔marker adapters, the state/action
  interfaces and the initial state moved to `stores/video-dialog/`.
- **Widget library modal 542 → 349**: the ~120-line starter widget source is now
  `new-widget-template.ts`, and the entry card `library-card.tsx`.
- **Alert widget settings 546 → 459**: `SectionTitle`, `GroupLabel` and the
  media-library picker moved into `components/overlays/inspector-fields/`, where
  the other inspector controls already live, so other widgets can use them.
- **`@repo/ui` widget template layer**: `resolve-widget-template.ts` (482) split
  into `widget-fields.ts` (schema helpers) and `widget-srcdoc.ts` (the sandboxed
  iframe document), with the old path kept as a barrel.
- **ClipsWidgetRenderer 460 → 438**: `<video>` error introspection to
  `media-error.ts`.

- **Every hook lives under `src/hooks/`.** 16 hooks that sat next to their
  components moved into `hooks/{obs,overlays,widgets,topology}/`; the three
  app-wide ones stay at the root of `hooks/`. The OBS/IRL group is named `obs`.
  `use-overlay-store.ts` went to `stores/overlay-editor-store.ts` instead — it's
  a zustand store, and `stores/` already holds the other three.

  | Group | Hooks |
  | --- | --- |
  | `hooks/obs/` | instance session, lifecycle, lifecycle notifications, cloud-OBS controls, auto-switcher status |
  | `hooks/overlays/` | canvas gestures, inspector commands, editor clip playback, clip field drag, clip playlist |
  | `hooks/widgets/` | widget draft, preview, console, live room |
  | `hooks/topology/` (web-admin) | edge animation, topology layout |

- **`@repo/supabase` `queries/obs-nodes.ts` 580 → a 4-module directory** behind a
  barrel: the node registry + claim flow, the node API keys, the instances
  placed on a node, and the odds and ends the node-authenticated API needs.
- **Deck 564 → 486**: tab navigation with its unsaved-changes/back-gesture
  contract to `hooks/deck/use-deck-tabs.ts`, and the two
  verify-then-reconnect effects to `hooks/obs/use-obs-reconnect-on-wake.ts` —
  which also collapses their duplicated "is the container really still up?"
  round-trip into one `confirmStillRunning()`.
- **web-admin subscriptions 494 → 244**: the grant/edit dialogs to
  `subscription-dialogs.tsx`, the row shapes to `types.ts`.

- **obs-auto-switcher**: its last three raw Supabase calls moved into
  `@repo/supabase` (`selectEnabledAutoSwitcherConfigs`, `clearSceneOverride`,
  `getRunningInstanceWithNodeUrl`). 13 engine tests still pass.
- **ws-server `handlers/auth.ts` 313 → 202.** The plain-HTTP surface (health +
  the two secret-gated injection points) moved to `internal-http.ts`, and the
  five upgrade paths stopped repeating themselves: one `resolveUserIdFromToken`
  (the JWT-then-subscriber-token dance was written twice), one
  `parseSourceLabel`, one `parseCsvSet`, and one `upgradeOrFail` replacing six
  copies of upgrade-then-report-failure.
- **Duplicate formatters folded into each app's `lib/format.ts`**: `formatBytes`
  (2 identical copies in web-streamwizard) and the ms-elapsed formatter
  (3 identical copies across web-admin's topology nodes).

- **Packages stopped reaching past `@repo/supabase` too.** Four of them held
  raw `.from()`/`.rpc()` calls: `@repo/alerting`'s registry load,
  `@repo/logger`'s stream-event writes, `@repo/twitch-assets`'s cache, and
  `@repo/user-state`'s definitions table and atomic RPCs. Those are now
  `queries/{alert-registry,stream-events,asset-cache}.ts` plus additions to
  `queries/user-states.ts`. `@repo/twitch-assets` also stopped building its own
  Supabase client — the package's own lazy client now falls back to
  `NEXT_PUBLIC_SUPABASE_URL`, which is the only reason it had one.

  What still imports `@supabase/supabase-js` outside the package is fine:
  `alerting` and `user-state` for the injected `SupabaseClient` *type*, and
  `@repo/sentry` because its integration takes the client class itself.

- **Dead code removed.** 25 files, 3776 lines, none of them reachable: the
  vendored `map.tsx` kit (and the `maplibre-gl` dependency it alone pulled in),
  four shadcn dashboard-starter leftovers, the clip-folder modals, an unwired
  rest-api rate limiter, and a dozen smaller orphans. Verified by resolving
  every import specifier in the repo — relative, `@/` alias and workspace
  package, including `exports` maps and `new URL(...)` worker references — to a
  file, then taking what nothing pointed at.

  Deliberately kept: discord-bot's `commands/` and `events/` (loaded by
  `Bun.Glob` at runtime), the monaco workers, and every framework entry point.

  Also kept, on your call, with a header explaining what they're for and that
  they still need wiring: `apps/rest-api/src/middleware/rateLimit.ts` (per-API-key
  limiting, never mounted) and `apps/streamwizard-bot/src/lib/user-state-service.ts`
  (groundwork for the bot-side chat-command dispatcher).

## Next

Nothing structural is outstanding — every app and package has had a pass. What's
left is decisions, not refactors:

1. **Commit this.** It's one large uncommitted working tree; splitting it into
   reviewable commits (shared packages / per-app / route+hook moves) is the
   sensible next move.
2. **`ISSUES.md`** — the PostgREST filter injection and the unreachable
   subscriber-token rotation are behaviour changes, so they want their own PR.
   The lint debt (109 errors, mostly `react-hooks/set-state-in-effect`) is the
   same story.
3. **Dead code** — the five unimported files listed above (2932 lines total).
4. **Naming** — `components/irl` could become `components/obs` to match
   `hooks/obs`, if the IRL wording isn't load-bearing.
5. **Guard rails** — nothing stops the next AI-written file from re-creating a
   local `formatBytes` or a raw `.from("table")` in an app. A lint rule banning
   `@supabase/supabase-js` imports outside `packages/supabase`, and one banning
   deep relative imports across feature folders, would hold this shape.

Bugs and security findings spotted along the way go in `ISSUES.md` — not fixed
here, since this pass is behaviour-preserving by design.
