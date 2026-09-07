# Importing overlays from StreamElements

Research notes and a build plan for "Import from StreamElements" in the overlay
editor. Commands are deliberately out of scope here — this is overlays only.

Status: research only, nothing implemented.
Date: 2026-09-02.

---

## 1. What StreamElements actually exposes

Base URL: `https://api.streamelements.com/kappa/v2` (a few endpoints also answer
on `/kappa/v3`). The official docs at dev.streamelements.com are incomplete; the
unofficial spec at <https://github.com/c4ldas/streamelements-api> (`api.yaml`) is
accurate and is what the shapes below come from.

### Authentication — three kinds, and only one is self-serve today

| Kind | Header | Where the user gets it | Notes |
|---|---|---|---|
| JWT | `Authorization: bearer <token>` | streamelements.com/dashboard/account/channels | Full account access. Most endpoints. |
| Overlay token | `Authorization: apikey <token>` | same page (also `channel.apiToken` inside a custom widget) | Scoped to overlay/widget endpoints. Enough for us. |
| OAuth2 | `Authorization: oauth2 <token>` | requires an approved app via the form at <https://strms.net/oauth2_request> | Scopes we would need: `overlays:read`. Manual approval, unknown lead time. |

**Consequence for phasing:** we can ship a working import on day one with a
pasted overlay token. OAuth is a polish step, and the application should be
submitted early because approval is out of our hands.

### Endpoints we need

| Endpoint | Purpose |
|---|---|
| `GET /channels/me` | Resolve the channel id from a token (so the user pastes one thing, not two). |
| `GET /overlays/{channel}?type=regular&search=` | List the user's overlays: id, name, preview image, `settings.width/height`, `updatedAt`. |
| `GET /overlays/{channel}/{overlayId}` | The whole overlay: every widget, its geometry, its alertbox settings, and the full source of every custom widget. This is the one that matters. |
| `GET /uploads/{channel}?type=image\|audio\|video&limit&offset` | The user's media library: `url`, `name`, `size`, `type`. Also reports `totalStorage` (2 GB on SE). |
| `GET /sessions/{channel}` | Session counters (`follower-session`, `subscriber-goal`, `cheer-month`, `tip-session`, …). Only needed if we emulate SE session data — see §4D. |

Everything is a plain GET. One overlay = one request. No pagination on the
overlay itself.

### The overlay JSON

```jsonc
{
  "_id": "673e6909f4862cd5edac5583",
  "channel": "5f2de5dd9a474a2c2dc4d0ab",
  "type": "regular",
  "name": "Chat Doorbell by LX",
  "game": "Door Kickers: Action Squad",
  "preview": "https://…",
  "settings": { "width": 1920, "height": 1080, "name": "1080p" },
  "widgets": [
    {
      "id": 1,                                  // int, unique within the overlay
      "group": "8fa1faf4-d928e742-85cad6f5",    // uid of a se-widget-group, or null
      "version": 1,
      "type": "se-widget-custom-event-list",
      "name": "…",
      "visible": true,
      "locked": false,
      "listeners": { "follower-latest": true, "cheer-latest": true, … },
      "css": { "top": 0, "left": 0, "width": "290px", "height": "180px", "z-index": 3, "opacity": 1 },
      "text":  { "type": "text", "value": null, "enableShadow": true, "scrolling": {…}, "css": { "font-family": "Nunito", "font-size": 24, "color": "#fff", … } },
      "image": { "type": "image", "css": { "max-width": "100%" } },
      "video": { "type": "video", "volume": 0.5, "css": { "width": 320, "height": 240 } },
      "audio": { "type": "audio", "volume": 1 },
      "animation": { "in": "fadeIn", "inDuration": 1, "out": "fadeOut", "outDuration": 1, "timeout": 6 },
      "variables": {
        "html": "…", "css": "…", "js": "…",
        "fields": "{ \"cooldown\": { \"type\": \"number\", … } }",  // JSON *string*
        "fieldData": { "cooldown": 0, "soundFile": "https://cdn.streamelements.com/uploads/….mp3", … },
        // on an alertbox widget, per-event settings live here instead:
        "follower": { … }, "subscriber": { … }, "tip": { … }, "host": { … }, "raid": { … }, "cheer": { … }
      },
      "provider": "twitch"
    }
  ],
  "mobile": false, "campaign": false, "favorite": false,
  "createdAt": "…", "updatedAt": "…"
}
```

Things worth calling out:

- **Geometry is absolute px** inside the `settings.width × settings.height`
  canvas, measured from the top-left. That maps straight onto our `x/y/w/h` with
  `anchor_x: "left"`, `anchor_y: "top"`.
- **`css.width`/`css.height` are `number | string`** ("290px" and `291` both
  appear in real data). Normalise on parse.
- **No rotation, flip or crop** in SE. Our defaults cover it.
- **Groups**: a widget of `type: "se-widget-group"` carries
  `variables.uid`; its children carry that uid in their `group` field. Flat, one
  level of indirection, not a tree of nodes.
- **The alertbox settings are inside the overlay**, not on a separate
  channel-level endpoint. Per event:
  `{ enabled, duration, layout, text: { animation, enableShadow, message, css: { font-family, font-size, color, font-weight, text-shadow, text-align, highlights.color, message: {…} } }, graphics: { src, type }, audio: { src, volume }, animation: { in, out }, variations: [] }`.
- **Custom widget source ships in the same payload** — `variables.html/css/js`,
  the field schema as a JSON *string* in `variables.fields`, and the saved values
  in `variables.fieldData`.

---

## 2. What we already have (this is a smaller job than it looks)

| We have | Why it matters here |
|---|---|
| `apps/web-streamwizard/src/schemas/overlay-export.ts` | Already an import document: `ref`-based items, embedded widget copies, per-item validation via `overlayItemSchema`, `schemaVersion`. **The SE converter should compile to `OverlayExportDocument` and reuse the existing importer** — no second write path, no new validation surface. |
| Custom widget contract (`docs/widgets/*`, `widget-srcdoc.ts`, `widget-fields.ts`) | Deliberately SE-shaped already: `onWidgetLoad` / `onEventReceived` with `detail.listener` + `detail.event`, a `fieldData` global, `{{field}}` templating, and a fields JSON of `{ type, label, value, min, max, step, options }`. |
| `AlertVariantConfig` (`packages/ui/.../alert/alert-widget-config.ts`) | Near 1:1 with SE's per-event alertbox settings: enabled, media URL + kind, sound URL, volume, title/message template, duration, minAmount, layout, animation in/out, font family/size/weight, align, colours, text shadow. |
| Media library (`actions/assets.ts`, R2, presign → PUT → confirm, quota accounting) | The place SE assets land. Already has quota reservation and size limits. |
| `user_states` (channel-wide, server-written, live-pushed) | The right home for emulated SE session data. |

---

## 3. What is missing on our side

### A. Widget types we simply don't have

Ours today: `clips_widget`, `text_widget`, `timer_widget`, `clock_widget`,
`custom_widget`, `alert_widget`, `irl_*_widget`.

A typical SE overlay contains, in rough order of frequency:

| SE widget | Us | Suggested handling |
|---|---|---|
| Static image | **missing** | Build a native `image_widget`. Non-negotiable — nearly every real overlay has several. |
| Static video | **missing** | Build a native `video_widget` (loop, muted, volume). |
| Static text | `text_widget` | Direct map. Font/size/colour/align/shadow/line-height convert; scrolling text does not (drop, note it). |
| Alertbox | `alert_widget` | Map per-event, see §4E. |
| Custom widget | `custom_widget` | Map, with the compat layer in §4C. |
| Chat box | missing | Needs chat relayed to the overlay. Separate feature, out of scope for import v1 — skip with a note. |
| Event list | missing | Buildable as a first-party custom widget from our EventSub feed. Phase 6. |
| Labels / session data (latest follower, top donator…) | missing | Depends on session counters (§4D). Phase 6. |
| Goals (follow/sub/cheer/custom) | missing | Same dependency. Phase 6. |
| Countdown / stopwatch | `timer_widget` (partial) | Map countdown; stopwatch needs a mode. |
| Static audio / sound | missing | Low value on its own; skip. |
| Media/song request, tip jar, leaderboard, loyalty, stream boss, wheel | missing | These sit on StreamElements' own economy (tips, loyalty points, song queue). **We cannot import these meaningfully** — skip with an explicit note rather than half-importing. |

Decision needed per type: native widget, bundled first-party custom widget, or
"skipped with a report line". Recommendation is in the table above.

### B. No grouping in our editor

We have no group concept at all — `overlay_items` has no parent. Options:

1. **Flatten on import** (recommended for v1): drop the `se-widget-group` rows,
   keep the children where they are, note it in the report.
2. Build groups first. Bigger, and a good editor feature independently — its own
   ticket, not a prerequisite.

Before flattening, verify on a real overlay whether a grouped child's
`css.top/left` is canvas-absolute or group-relative. The sample data suggests
absolute (group at 0,0 with a child at 0,0), but one sample is not proof.

### C. Custom widget compatibility layer

This is the interesting engineering. Our sandbox and SE's differ:

| Concern | StreamElements | StreamWizard | What to build |
|---|---|---|---|
| Templating | `{{field}}` **and** `{field}`, in HTML, CSS and JS (real widgets do `parseInt("{cooldown}")`) | `{{field}}` in HTML and extra CSS only | Add a single-brace pass and extend substitution to JS on imported widgets. Needs a careful tokenizer — single braces are everywhere in CSS blocks and JS object literals. Safest rule: only substitute `{name}` when `name` is a declared field key. |
| Field types | text, checkbox, colorpicker, number, slider, dropdown, image-input, video-input, sound-input, googleFont, button, hidden | text, number, checkbox, colorpicker, slider, dropdown, googleFont, image, audio, video, hidden, group | Rename map: `image-input→image`, `sound-input→audio`, `video-input→video`. **Build a `button` field type** (SE emits a `widget-button` event). |
| Dropdown options | key/value object | array of `{ label, value }` | Convert. |
| Grouping fields | flat field with a `"group": "Name"` string property | nested `type: "group"` container | Convert flat group labels into our nested containers, preserving key uniqueness (ours are flat in the value namespace anyway, so this is lossless). |
| Reserved fields | `widgetName`, `widgetAuthor`, `widgetDuration` | none | `widgetName`/`widgetAuthor` → our widget name/description. `widgetDuration` → queue hold time; keep as a plain hidden field otherwise. |
| `SE_API` | `store.get/set`, `counters.get`, `sanitize`, `cheerFilter`, `getOverlayStatus`, `setField`, `resumeQueue` | none | Build an `SE_API` shim in `widget-srcdoc.ts` over what we already have: `store` → `StreamWizard.state`, `counters` → `StreamWizard.userState`, `getOverlayStatus` → `{ isEditorMode, muted }`, `setField` → postMessage to the editor, `resumeQueue`/`cheerFilter`/`sanitize` → pass-through or a small server route. |
| `onWidgetLoad` detail | `fieldData`, `channel` (**including `apiToken`**), `session.data`, `recents` (last 25), `currency` | `fieldData`, `channel.user_id`, `session` | Add `session.data` (§4D), `recents` from our event history, `currency` as a static placeholder. **Never expose an API token** — that field stays absent, and widgets that read it get a clear console warning rather than silence. |
| Listener names | `follower-latest`, `subscriber-latest`, `cheer-latest`, `raid-latest`, `tip-latest`, `host-latest`, `message`, `delete-message(s)`, `event:skip`, `alertService:toggleSound`, `bot:counter`, `kvstore:update`, `widget-button` | Twitch EventSub names (`channel.follow`, `channel.cheer`, …) | Dual-emit: keep our names, additionally dispatch the SE name with an SE-shaped payload (`{ name, amount, message, gifted, sender, tier, isCommunityGift }`). One alias table, used by both the runtime and the editor's autocomplete. |
| `onSessionUpdate` | real, fires on session data change | documented as reserved/unused | Implement once session counters exist. |
| External resources | jQuery, Google Fonts `<link>`, `@import` all allowed | only Tailwind + GSAP from cdnjs; `connect-src` allowlisted | Decide policy. The iframe is `allow-scripts` without `allow-same-origin`, so a widened `script-src` is a supply-chain question, not an origin-access one. Recommendation: allowlist `cdnjs.cloudflare.com`, `code.jquery.com`, `fonts.googleapis.com`, `fonts.gstatic.com`; strip anything else on import and list it in the report. |
| animate.css | bundled (alert animation names are animate.css names) | not bundled | Either bundle it or map the common names onto our three in/out animations. |
| console / cookies / IndexedDB | blocked by SE | console allowed (forwarded in the editor) | Nothing to do; we are the more permissive one. |

### D. Session data emulation

SE widgets read `session.data['follower-session'].count`,
`subscriber-goal.amount`, `cheer-month.amount`, and so on. We have no equivalent
today. `user_states` is the right home: server-written, channel-wide, pushed
live to open overlays.

Build a session aggregator producing SE-shaped keys for what Twitch gives us —
follow / sub / resub / gift / cheer / raid, in session / week / month / total
buckets, plus `*-latest` objects. Tips, loyalty points and song requests have no
StreamWizard equivalent: return zeros and say so in the import report, rather
than pretending.

### E. Assets

SE assets are public and hotlinkable:
`https://cdn.streamelements.com/uploads/<uuid>.<ext>`, plus stock defaults at
`https://cdn.streamelements.com/static/alertbox/default.{gif,ogg}`.

Two modes:

1. **Link** — keep the SE URLs. Zero quota, instant. But it breaks the day the
   user closes their SE account, and our widget CSP `connect-src` does not
   include the SE CDN, so `<img>`/`<audio>`/`<video>` tags work while `fetch()`
   does not — a subtle, confusing half-failure.
2. **Copy** (recommended default) — server-side fetch → R2 through the existing
   presign/confirm path, then rewrite every occurrence in `fieldData`, HTML, CSS,
   JS and alert configs.

Copy has a real problem: **SE gives 2 GB, our free tier gives 100 MB**. The
import flow must size the assets up front (the uploads endpoint reports each
file's size), show "this import needs 240 MB, you have 100 MB", and either gate
on a paid tier or offer link-mode as the fallback. Also needed: a fetch allowlist
(only `cdn.streamelements.com`), per-file size and MIME checks, timeouts, and
dedupe by SE uuid so a second import of the same overlay doesn't double-charge
quota.

### F. Import pipeline and UX

1. **Connect** — paste the overlay token (and resolve the channel id via
   `/channels/me`). Recommendation: do not persist the token; use it for the
   duration of the import job and drop it.
2. **List** — show the user's overlays with SE's own preview thumbnails, size and
   last-updated.
3. **Dry run** — before writing anything: what imports cleanly, what converts to a
   custom widget, what is skipped and why, how many MB of assets, quota impact.
   This is the screen that makes the feature trustworthy.
4. **Import** — convert to `OverlayExportDocument`, hand it to the existing
   importer, get a new scene.
5. **Report** — per-widget outcome with links to each imported item and a short
   list of manual fixes.

All fetching and conversion runs server-side; the token never reaches the
browser after the paste. Asset copying can take minutes, so this needs a job row
with progress rather than a single request.

### G. Data model additions

- `overlay_import_jobs` — `id, user_id, source ('streamelements'), source_overlay_id, status, report jsonb, created_at`.
- `user_assets.source_url` (+ unique per user) for asset dedupe on re-import.
- optional `overlay_scenes.imported_from` for provenance.

### H. Legal / ToS

Worth a read before this is marketed as "Import from StreamElements":

- Programmatic read of a user's own data with their own token is normally fine,
  but confirm against SE's ToS.
- A user's own custom widget code is theirs to move.
- Gallery/marketplace widgets by third parties may carry their own licence terms.
- SE's own built-in widget implementations are not ours to copy — we reimplement
  behaviour, we do not port their code.

---

## 4. Suggested phasing

| Phase | Work | Notes |
|---|---|---|
| 0 | Spike: token paste → `GET` an overlay → dump JSON. Collect 5–10 real overlays as fixtures. | Half the risk in this project is "what does real SE data actually look like". Fixtures first. |
| 1 | Converter core: SE JSON → `OverlayExportDocument`. Geometry, z-order, opacity, visible, locked, groups flattened. Text + custom widget. | Pure function, fully unit-testable against the fixtures. |
| 2 | Native `image_widget` and `video_widget`. | Blocking for realistic overlays; useful on their own. |
| 3 | Custom widget compat: `SE_API` shim, listener alias layer, single-brace templating, field-type mapping, `button` field, external-script policy. | The bulk of the engineering. |
| 4 | Asset copy to R2, quota sizing and the dry-run screen. | |
| 5 | Alertbox → `alert_widget`, including `variations[]`. | |
| 6 | Session data aggregator, then event list / labels / goals as first-party widgets. | Each is a product feature in its own right. |
| 7 | OAuth app, overlay list UI, job runner, import report. | **Submit the OAuth application at the start of phase 0** — approval lead time is outside our control. |

A useful cut line: phases 0–3 plus 5 give "import your overlay, alerts and custom
widgets" — which is most of the perceived value — without touching session data.

---

## 5. Open questions

- Do we persist the SE token, or is it one-shot? (Recommend one-shot.)
- Group geometry: are grouped children canvas-absolute or group-relative? Verify
  on real data before flattening.
- Do we build this behind a general importer interface, so Streamlabs / OWN3D /
  Lumia can follow? (Cheap now, expensive later.)
- Which unsupported widgets skip with a note, and is there any case that should
  block the import entirely?
- Is import free? It is a strong acquisition lever, but asset copying is the
  actual cost — the quota, not the conversion, is what needs a pricing answer.

---

## 6. Sources

- Unofficial (accurate) StreamElements API spec: <https://github.com/c4ldas/streamelements-api> — live at <https://c4ldas.github.io/streamelements-api/>
- Official developer site: <https://dev.streamelements.com>
- Custom widget & `SE_API`: <https://docs.streamelements.com/overlays/custom-widget>
- Widget structure & custom fields: <https://docs.streamelements.com/overlays/widget-structure>
- Custom widget events: <https://docs.streamelements.com/overlays/custom-widget-events>
