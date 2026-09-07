# StreamWizard widget — AI context prompt

Paste everything below into an AI chat, then describe the widget you want under it.

---

You are generating a **StreamWizard custom widget**. Output exactly four code blocks — HTML, JS, Fields (JSON), Extra CSS — and nothing else that has to be pasted. The user copies each block into the matching tab of the StreamWizard widget editor.

## Runtime

The widget runs in a `<iframe sandbox="allow-scripts">` built from the four tabs. Already loaded, in this order:

- Tailwind CSS (`cdn.tailwindcss.com`) — all utility classes, no config
- GSAP 3.12.5 + TextPlugin, **already registered** (`gsap.registerPlugin(TextPlugin)` runs for you)
- A reset: `*,html,body{box-sizing:border-box;margin:0;padding:0}` and `html,body{width:100%;height:100%;overflow:hidden}`
- Transparent background, forced on `html` and `body`

The document is: `<style id="sw-extra-css">` (your CSS) in `<head>`, your HTML in `<body>`, then your JS in one inline `<script>` at the end of `<body>`.

Hard constraints:

- No `import`/`require`, no npm, no extra `<script src>`. Plain ES2020 only.
- `fetch()` is restricted by CSP `connect-src` to: the overlay origin (widget state API and `StreamWizard.twitch`), the StreamWizard media CDN, `https://api.open-meteo.com`, `https://nominatim.openstreetmap.org`. Everything else is blocked.
- `<img>`, `<audio>`, `<video>` tags load any URL (CSP above only limits `connect-src`).
- You cannot call `api.twitch.tv`, 7TV, BTTV or FrankerFaceZ directly — blocked origin, and there's no token in the page anyway. Use `StreamWizard.twitch` (below) for every Twitch lookup.
- Never set a background on `html` or `body`.
- Widget size comes from the overlay canvas. Lay out with `%`, `vw`/`vh`, flex/grid, or absolute offsets from edges — never a fixed px canvas.
- `console.log/info/warn/error` and uncaught errors are mirrored to the editor console panel. Use them for debug output.

## Globals

| Global | What it is |
|---|---|
| `gsap`, `TextPlugin` | GSAP 3.12.5, plugin pre-registered |
| `StreamWizard.state` | `get()` / `set(obj)` persistence for this placed widget — see below |
| `StreamWizard.userState` | `get(key)` / `getAll()` / `set(key, value)` channel-wide state, server-written too — see below |
| `StreamWizard.session` | `{ subscriberToken, overlayItemId }` once placed on an overlay; `null` in the editor preview |
| `StreamWizard.stateUrl` | Raw state endpoint. Prefer `StreamWizard.state`. |
| `StreamWizard.userStateUrl` | Raw channel-state endpoint. Prefer `StreamWizard.userState`. |
| `StreamWizard.twitch` | Twitch lookups: badges, cheermotes, avatars, box art, follower/sub totals — see below |

There is **no `fieldData` global at runtime**. Read field values from `onWidgetLoad`:

```js
let cfg = {};
addEventListener('onWidgetLoad', (e) => {
  cfg = e.detail.fieldData;
});
```

## Lifecycle events

All are `CustomEvent`s dispatched on `window`.

### `onWidgetLoad` — fires once

```js
addEventListener('onWidgetLoad', (e) => {
  const { fieldData, channel, session } = e.detail;
  // fieldData: field defaults merged with the streamer's overrides
  // channel:   { user_id }  — broadcaster's Twitch user ID
  // session:   { subscriberToken, overlayItemId } — undefined-ish in the editor preview
});
```

### `onFieldsUpdate` — settings changed while running

Fires when the streamer edits a setting in the overlay editor. Re-apply your
values here instead of assuming a reload: a widget that handles this updates
live without losing its animation or runtime state. Widgets that ignore it are
reloaded instead, which restarts the script.

```js
addEventListener('onFieldsUpdate', (e) => {
  cfg = e.detail.fieldData;
  apply(); // same code your onWidgetLoad handler runs
});
```

The latest values are also on `StreamWizard.fieldData`.

### `onEventReceived` — every live event

```js
addEventListener('onEventReceived', (e) => {
  const { listener, event } = e.detail;
  if (listener !== 'channel.follow') return;
  // event is the EventSub payload
});
```

### `onSessionUpdate`

Declared but nothing emits it. Do not build on it.

## Fields (the Fields tab)

JSON object, key → definition. Keys become `{{key}}` placeholders in HTML and Extra CSS (substituted once at load), and entries in `fieldData` in JS.

```json
{
  "accentColor": { "type": "colorpicker", "label": "Accent color", "value": "#9e7aff" },
  "fontSize":    { "type": "slider", "label": "Font size", "value": 24, "min": 10, "max": 64, "step": 1 },
  "position":    { "type": "dropdown", "label": "Position", "value": "bottom",
                   "options": [{ "value": "top", "label": "Top" }, { "value": "bottom", "label": "Bottom" }] },
  "alertImage":  { "type": "image", "label": "Image", "value": "" },
  "alertSound":  { "type": "audio", "label": "Sound", "value": "" }
}
```

Types: `text` (string), `number`, `checkbox` (boolean), `colorpicker` (`#rrggbb`), `slider` (`min`/`max`/`step`), `dropdown` (`options`), `googleFont` (family name string), `image` / `audio` / `video` (media-library picker, value is a CDN URL string), `hidden`, `group` (`fields`).

`group` collects fields into a collapsible section: `{ "type": "group", "label": "Follow", "fields": { ...same shape... } }`. Grouping is presentation only — nested keys stay flat, so a field inside a group is still `{{key}}` and `fieldData.key`, and keys must be unique across the whole schema. Max five levels of nesting.

Allowed keys per field: `type` (required), `label`, `value`, `options`, `min`, `max`, `step`, `fields` (groups only). Nothing else — the editor's JSON schema rejects extra keys.

`{{key}}` substitution happens **once**, before the document renders. Anything that must change while running must be set from JS on the DOM.

## Persistent state

`StreamWizard.state` stores one JSON blob per placed widget instance — survives OBS restarts and stream ends. Two copies of the same widget on different overlays have separate state.

```js
const saved = await StreamWizard.state.get().catch(() => null); // null when nothing saved
await StreamWizard.state.set({ deaths: 4 });                    // replaces the whole blob — spread to merge
```

`get()`/`set()` **throw in the editor preview** (no session there). Always wrap in `try/catch` or `.catch()`. Don't save inside an animation loop — debounce or batch.

## Channel state — `StreamWizard.userState`

Key/value state shared across the whole channel, and written by StreamWizard's servers as well as by widgets. Keys are 1–64 chars of `a-z0-9_`, values any JSON ≤8KB, 200 keys per channel.

```js
const deaths = await StreamWizard.userState.get('deaths');   // null when unset
await StreamWizard.userState.set('current_game', 'Elden Ring');
const all = await StreamWizard.userState.getAll();

// Counters: ALWAYS increment, never get-then-set (racing writers lose updates).
// Atomic on the server; resolves to the new value; missing key starts at 0.
const n = await StreamWizard.userState.increment('deaths');       // +1
await StreamWizard.userState.increment('deaths', -1);             // signed
await StreamWizard.userState.delete('old_key');

// Live updates, pushed on every change (any widget, the server, chat commands).
// Both return an unsubscribe fn. Safe in the editor preview — never fires there.
StreamWizard.userState.subscribe('deaths', (value) => render(value ?? 0));
StreamWizard.userState.onChange((key, value, updatedAt) => { /* all keys */ });
```

Keys beginning `sys.` are **read-only** — the server owns them:

| Key | Value |
|---|---|
| `sys.stream_id` | Current Twitch stream id, `null` when offline |
| `sys.stream_started_at` | ISO timestamp the stream started |
| `sys.is_live` | boolean |

Use this for anything that must be right after the overlay was closed. A widget only receives events while it is open, so "reset on `stream.online`" silently does nothing when the streamer goes live before starting OBS. Record which stream a total belongs to and compare on load instead:

```js
const [saved, savedStream, currentStream] = await Promise.all([
  StreamWizard.userState.get('total'),
  StreamWizard.userState.get('total_stream_id'),
  StreamWizard.userState.get('sys.stream_id'),
]);
// Unknown stream id means keep what you had — never zero on "I don't know".
total = currentStream && savedStream !== currentStream ? 0 : (saved ?? 0);
```

## Twitch lookups — `StreamWizard.twitch`

EventSub gives you ids, not pictures: `badges[].set_id`, a cheermote `prefix`, a `user_id`. This turns them into URLs. Everything goes through StreamWizard's own API, so no Twitch token is ever in the page.

Two kinds of call, and mixing them up is the mistake to avoid:

**Assets** — cached server-side, memoised in the page. Call them freely.

```js
await StreamWizard.twitch.ready();  // fetches badges + cheermotes once, at load

// then, per message, no network and no await:
const url  = StreamWizard.twitch.badgeUrl(badge);                 // badge from event.badges[]
const cheer = StreamWizard.twitch.cheermoteUrl(frag.cheermote);   // fragment.cheermote

await StreamWizard.twitch.user('71092938');        // { id, login, display_name, profile_image_url }
await StreamWizard.twitch.users(ids);              // batched, max 100, memoised per id
await StreamWizard.twitch.game('509658');          // { id, name, box_art_url } — replace {width}/{height}
await StreamWizard.twitch.thirdPartyEmotes('7tv'); // '7tv' | 'bttv' | 'ffz' → code → emote
```

**Live values** — never cached, anywhere. Every call is a fresh read.

```js
await StreamWizard.twitch.followerTotal();  // number
await StreamWizard.twitch.subTotal();       // number
await StreamWizard.twitch.stream();         // { is_live, viewer_count, game_id, game_name, title, started_at, thumbnail_url }
```

### Goal widgets — the pattern to copy

```js
let total = await StreamWizard.twitch.followerTotal();  // truth, on every load
render(total);

addEventListener('onEventReceived', (e) => {
  if (e.detail.listener === 'channel.follow') render(++total);
});

// Re-anchor. Events can drop or replay across a reconnect, so a counter that
// only ever increments drifts over a long stream.
setInterval(async () => { total = await StreamWizard.twitch.followerTotal(); render(total); }, 60000);
```

Do **not** persist a follower or sub count with `StreamWizard.state` — it's stale the moment the widget closes. Read it fresh instead.

All `StreamWizard.twitch` methods **throw in the editor preview** (no session). Wrap in `try/catch`.

Badges and avatars also arrive pre-resolved on most events (`badges[].url`, `user_profile_image_url`) — those fields are optional, so guard them and fall back to a lookup.

## Event listener strings

`automod.message.hold`, `automod.message.hold/2`, `automod.message.update`, `automod.message.update/2`, `automod.settings.update`, `automod.terms.update`,
`channel.channel_points_automatic_reward_redemption.add`, `channel.channel_points_automatic_reward_redemption.add/2`, `channel.channel_points_custom_reward.add`, `channel.channel_points_custom_reward.update`, `channel.channel_points_custom_reward.remove`, `channel.channel_points_custom_reward_redemption.add`, `channel.channel_points_custom_reward_redemption.update`, `channel.channel_points_custom_reward_power_up.redemption.add`,
`channel.bits.use`, `channel.update`, `channel.follow`, `channel.ad_break.begin`, `channel.subscribe`, `channel.subscription.end`, `channel.subscription.gift`, `channel.subscription.message`, `channel.cheer`, `channel.raid`, `channel.ban`, `channel.unban`, `channel.unban_request.create`, `channel.unban_request.resolve`,
`channel.chat.clear`, `channel.chat.clear_user_messages`, `channel.chat.message`, `channel.chat.message_delete`, `channel.chat.notification`, `channel.chat_settings.update`, `channel.chat.user_message_hold`, `channel.chat.user_message_update`,
`channel.guest_star_session.begin`, `channel.guest_star_session.end`, `channel.guest_star_guest.update`, `channel.guest_star_settings.update`,
`channel.hype_train.begin`, `channel.hype_train.progress`, `channel.hype_train.end`, `channel.shield_mode.begin`, `channel.shield_mode.end`, `channel.shoutout.create`, `channel.shoutout.receive`, `channel.charity_campaign.donate`, `channel.charity_campaign.start`, `channel.charity_campaign.progress`, `channel.charity_campaign.stop`, `channel.shared_chat.begin`, `channel.shared_chat.update`, `channel.shared_chat.end`, `channel.goal.begin`, `channel.goal.progress`, `channel.goal.end`,
`channel.moderate`, `channel.moderate/2`, `channel.moderator.add`, `channel.moderator.remove`, `channel.warning.send`, `channel.warning.acknowledge`, `channel.suspicious_user.message`, `channel.suspicious_user.update`, `channel.vip.add`, `channel.vip.remove`,
`channel.poll.begin`, `channel.poll.progress`, `channel.poll.end`, `channel.prediction.begin`, `channel.prediction.progress`, `channel.prediction.lock`, `channel.prediction.end`,
`stream.online`, `stream.offline`,
`conduit.shard.disabled`, `drop.entitlement.grant`, `extension.bits_transaction.create`, `user.authorization.grant`, `user.authorization.revoke`, `user.update`, `user.whisper.message`,
`streamwizard.geo` (IRL GPS — shape below).

Payloads are stock Twitch EventSub payloads (the `event` object, unwrapped). Every listed event also carries `broadcaster_user_id` / `_login` / `_name` unless noted.

## Common payloads

```
channel.chat.message
  chatter_user_id / _login / _name
  message_id
  message.text
  message.fragments[]  { type: "text"|"cheermote"|"emote"|"mention", text, cheermote?{prefix,bits,tier}, emote?{id,emote_set_id}, mention?{user_id,user_name,user_login} }
  color                 hex string, may be ""
  badges[]              { set_id, id, info, url?, url_1x?, url_2x?, url_4x? }   ← url* added by StreamWizard
  user_profile_image_url?   ← added by StreamWizard
  message_type          "text" | "channel_points_highlighted" | "channel_points_sub_only" | "user_intro" | "power_ups_message_effect" | "power_ups_gigantified_emote"
  cheer?.bits
  reply?                { parent_message_id, parent_message_body, parent_user_id, parent_user_name, parent_user_login, thread_* }
  channel_points_custom_reward_id?

channel.follow
  user_id / user_login / user_name, followed_at (ISO)
  user_profile_image_url?   ← added by StreamWizard

channel.subscribe
  user_id / user_login / user_name, tier "1000"|"2000"|"3000", is_gift
  user_profile_image_url?   ← added by StreamWizard

channel.subscription.gift
  user_id / user_login / user_name  (null when anonymous)
  total, tier, cumulative_total (null when anonymous), is_anonymous

channel.subscription.message   (resub)
  user_id / user_login / user_name, tier
  message.text, message.emotes[] { begin, end, id }
  cumulative_months, streak_months (nullable), duration_months

channel.cheer
  is_anonymous, user_id / user_login / user_name (null when anonymous), message, bits
  user_profile_image_url?   ← added by StreamWizard

channel.raid
  from_broadcaster_user_id / _login / _name
  to_broadcaster_user_id / _login / _name
  viewers
  user_profile_image_url?   ← the raider's avatar, added by StreamWizard

channel.channel_points_custom_reward_redemption.add
  id, user_id / user_login / user_name
  user_input      "" when the reward takes no input
  status          "unfulfilled" | "fulfilled" | "canceled"
  reward          { id, title, cost, prompt }
  redeemed_at     ISO

stream.online   id, broadcaster_*, type, started_at
stream.offline  broadcaster_*
```

## IRL GPS — `streamwizard.geo`

Two delivery paths, **two different shapes**. Always normalize:

```js
addEventListener('onEventReceived', (e) => {
  if (e.detail.listener !== 'streamwizard.geo') return;

  const raw = e.detail.event;
  if (raw && raw.status === 'offline') { /* phone disconnected */ return; }

  // OBS/WebSocket path: { status: "connected", payload: {...} }
  // Phone/browser path: the payload object itself
  const geo = raw && raw.payload ? raw.payload : raw;
  if (!geo) return; // phone mode sends null before the first fix

  // geo.latitude   number
  // geo.longitude  number
  // geo.altitude   number | null   metres
  // geo.speed      number | null   m/s   (×3.6 = km/h, ×2.237 = mph)
  // geo.heading    number | null   degrees 0–360
  // geo.accuracy   number          metres
  // geo.timestamp  number          Unix ms
});
```

Geo pings arrive roughly once per second while the IRL phone is publishing. For anything expensive (reverse geocoding, weather, state saves) throttle by time and/or distance moved. Distance totals: Haversine between consecutive fixes, discard deltas under ~3 m (GPS jitter) and over ~150 m (impossible jumps).

Allowed IRL APIs (already in the CSP): `https://api.open-meteo.com` (weather, e.g. `/v1/forecast?latitude=..&longitude=..&current=temperature_2m,weather_code`) and `https://nominatim.openstreetmap.org/reverse?lat=..&lon=..&format=json` (place name).

There is no `streamwizard.status` event reaching widgets — an IRL phone going away arrives as `streamwizard.geo` with `status: "offline"`.

## Editor behaviour worth knowing

- **Never build a demo mode into a widget.** No `demoMode` field, no `startDemo()`, no fake-data loop. StreamWizard's Demo mode feeds fake events to any widget from the editor toolbar — including a moving GPS track — so widget-side demo code is redundant and ships dead weight to viewers.
- Demo mode fires one-shot payloads for every event in the catalogue (follow, sub, gift sub, resub, sub ended, cheer, raid, channel update, ban, chat message, chat cleared, reward redeemed, stream online/offline, plus `streamwizard.geo` and the other `streamwizard.*` events), and runs looping simulators for a moving GPS track and a chat feed. Geo also has an **Offline** button for the `status: "offline"` case.
- The picker leads with the events your widget's source actually references, so keep listener strings as plain literals (`listener === 'channel.follow'`) rather than building them at runtime.
- **Connect** subscribes the preview to the author's real channel events.
- Live reload rebuilds the document on HTML/JS/Fields changes (widget state resets); CSS-only edits hot-swap without a reload.
- Field values changed in the editor's field panel rebuild the document too.

## Output format

```
### HTML
...

### JS
...

### Fields (JSON)
...

### Extra CSS
...
```

Rules for the code you write: no placeholder TODOs, no fake data left in, every field you declare must actually be used, and everything the user could plausibly want to restyle (colors, sizes, durations, toggles, text) should be a field rather than a hardcoded value.

---

**Describe your widget below this line.**
