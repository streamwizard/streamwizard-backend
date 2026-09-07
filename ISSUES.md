# Issues spotted during the cleanup pass

The cleanup pass itself was behaviour-preserving; these were the things it found
but deliberately left alone. Everything except the two "unfinished, not dead"
modules and the remaining lint debt has since been fixed — see the sections below
for what the fix was, so the reasoning survives the commit.

## Fixed

### PostgREST filter built by string interpolation (widget library search)

`packages/supabase/src/queries/overlay-widgets.ts` → `selectApprovedLibraryEntries`
used to build its filter by interpolation:

```ts
query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
```

A comma, parenthesis or dot in `search` was parsed as PostgREST filter syntax, not
as text, so a crafted value re-wrote the filter — including the `is_approved=true`
scoping the query relied on for row access.

The parameter turned out to be unused: the widget-library modal calls
`getApprovedLibraryEntries()` with no arguments and filters client-side. It was
only reachable by calling the server action directly, which is still a public HTTP
endpoint, so it was a live hole.

**Fix:** dropped the `search` parameter from both the query helper and the
`getApprovedLibraryEntries` action. If server-side search comes back it must use
bound `.ilike()` calls or `.textSearch()`, never a string-built `.or()`.

### Rotating a leaked overlay subscriber token was unreachable

`resetSceneSubscriberToken` (`apps/web-streamwizard/src/actions/overlays/scenes.ts`)
had no callers — no button, no route. The subscriber token is the key the overlay
page hands its client code to read and write widget state, so a streamer whose
token leaked had no way to invalidate it.

**Fix:** wired into the scene card dropdown in `overlay-scenes-list.tsx` as
"Reset overlay key", behind an `AlertDialog` confirm. Note the browser-source URL
is keyed by slug, not by the token — rotating the token does not change the URL,
it invalidates the key any already-open overlay page is using, so the copy tells
the streamer to refresh the browser source in OBS.

### Dead overlay-item server actions

`saveOverlayItem` and `deleteOverlayItem` in `actions/overlays/items.ts` had no
callers — the editor saves through `saveAllOverlayItems` — but were still exported
server actions, i.e. a live HTTP surface nothing used.

**Fix:** deleted, along with the query helpers that only they used
(`insertOverlayItemReturning`, `updateOverlayItemReturning`, `deleteOverlayItem`
in `packages/supabase/src/queries/overlays.ts`).

### Consistency

- Added a root `.prettierrc` (`printWidth: 120`). The repo had none, but
  `package.json` exposes a `format` script, and Prettier's 80-column default would
  have reformatted nearly every file. Note the config is not a no-op: Prettier
  still collapses hand-wrapped query chains that fit in 120 columns, so
  `bun run format` repo-wide would still produce a large diff. If that reformat is
  wanted it should be its own isolated commit.
- `apps/web-overlay` now has a `check-types` script like every other workspace, so
  it stops silently skipping the `turbo check-types` task.

### Two real lint bugs

- `src/providers/clips-provider.tsx` — `folders` state was a copy of the
  `ClipFolders` prop kept in sync by an effect, costing an extra render per prop
  change. Now aliases the prop directly.
- `src/components/vods/timeline/video-timeline.tsx` — three genuine bugs, all
  errors under the React Compiler lint rules:
  - `activeClipSelection` was read by the wheel-zoom effect but declared ~170
    lines below it, so Shift+scroll centred on a stale selection. Hoisted above
    its first use and narrowed to `(dragging && localClipSelection) || clipSelection`.
  - four `xRef.current = x` writes during render; moved into a commit-phase
    effect, since a render-phase write can be discarded and leave the pan/pinch
    handlers reading a value that never shipped.
  - the effect mirroring `clipSelection` into `localClipSelection` on drag
    start/end is gone; the drag-end handlers clear it directly and drag start no
    longer needs to seed it (`handleDrag` already falls back to the prop).

## Still open

### Unfinished, not dead

Both are unreferenced but kept on purpose, each with a header saying so:

- `apps/rest-api/src/middleware/rateLimit.ts` — per-API-key rate limiting that is
  **never mounted**, so no route is limited today. Wiring it is one
  `app.use("*", rateLimit())` after the auth middleware, but the store is
  per-process and in-memory, so a multi-instance deployment gets N x the limit.
- `apps/streamwizard-bot/src/lib/user-state-service.ts` — ready for the bot-side
  chat-command dispatcher ("!death add 1") that doesn't exist yet.

### Lint debt (pre-existing)

`bun run lint` in `apps/web-streamwizard` reports 76 errors / 86 warnings, down
from 83 / 86 before the fixes above. (An earlier count of 101 / 62 in this file was
taken with an older ESLint; the rules were reclassified since.) The bulk is
`react-hooks/set-state-in-effect` and exhaustive-deps.

The four warnings left in `video-timeline.tsx` are exhaustive-deps on the drag and
zoom effects. Their dependency arrays are deliberately narrow — adding the missing
deps re-subscribes the document listeners mid-drag — so they need a real refactor,
not a dependency-array edit.
