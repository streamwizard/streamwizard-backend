import { resolveWidgetTemplate, type WidgetFieldSchema } from "./widget-fields";

/**
 * Builds the sandboxed `srcdoc` a custom widget runs inside: the resolved
 * template, the CSP that scopes its network access, the CDN libraries it can
 * count on, and (editor-only) the console/error forwarder.
 */

// srcdoc iframes inherit the embedding page's CSP. The dashboard serves a
// nonce-based script-src without 'unsafe-inline', so every script tag below
// (inline and CDN) must carry the page's nonce to execute there. The nonce
// content attribute is hidden from the DOM, but the IDL property on any of
// Next's own nonce'd scripts still exposes it. Under the overlay app's
// 'unsafe-inline' policy the attribute is inert, so stamping is always safe.
function documentNonce(): string {
  if (typeof document === "undefined") return "";
  return document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce ?? "";
}

export function buildWidgetSrcdoc(
  html: string,
  js: string,
  extraCss: string,
  fields: WidgetFieldSchema,
  fieldValues: Record<string, unknown>,
  overlayOrigin?: string,
  // Media-library CDN origin: lets widget JS fetch() uploaded assets. Plain
  // <img>/<audio>/<video> tags don't need it — this CSP only sets connect-src.
  assetCdnOrigin?: string,
  opts?: {
    /**
     * Mirror console output and uncaught errors to the parent as `swLog`
     * messages. Editor-only: a chatty widget on a live overlay would postMessage
     * on every log for nobody's benefit.
     */
    forwardLogs?: boolean;
  }
): string {
  const { resolvedHtml, resolvedCss } = resolveWidgetTemplate(html, extraCss, fields, fieldValues);
  const stateUrl = overlayOrigin ? JSON.stringify(`${overlayOrigin}/api/widgets/state`) : "null";
  const userStateUrl = overlayOrigin
    ? JSON.stringify(`${overlayOrigin}/api/widgets/user-state`)
    : "null";
  const twitchUrl = overlayOrigin ? JSON.stringify(`${overlayOrigin}/api/twitch`) : "null";
  const nonce = documentNonce();
  const connectSrc = [
    overlayOrigin,
    assetCdnOrigin,
    "https://api.open-meteo.com",
    "https://nominatim.openstreetmap.org",
  ].filter(Boolean).join(" ");
  // Installed before anything else so it also catches library load failures and
  // errors thrown while the widget's own script is still evaluating.
  const logForwarder = opts?.forwardLogs
    ? `  <script nonce="${nonce}">
    (function () {
      function send(level, args) {
        try {
          parent.postMessage({
            type: 'swLog',
            level: level,
            text: Array.prototype.map.call(args, function (a) {
              if (typeof a === 'string') return a;
              try { return JSON.stringify(a); } catch (e) { return String(a); }
            }).join(' ')
          }, '*');
        } catch (e) { /* parent gone or payload not cloneable */ }
      }
      ['log', 'info', 'warn', 'error'].forEach(function (level) {
        var orig = console[level];
        console[level] = function () { send(level, arguments); orig.apply(console, arguments); };
      });
      window.addEventListener('error', function (e) {
        send('error', [e.message + '  (' + (e.filename || 'widget') + ':' + e.lineno + ')']);
      });
      window.addEventListener('unhandledrejection', function (e) {
        var r = e.reason;
        send('error', ['Unhandled promise rejection: ' + ((r && r.message) || String(r))]);
      });
    })();
  <\/script>
`
    : "";

  return `<!DOCTYPE html>
<html style="background:transparent!important;background-color:transparent!important;color-scheme:normal">
<head>
  <meta name="color-scheme" content="normal">
  <meta http-equiv="Content-Security-Policy" content="connect-src ${connectSrc}">
${logForwarder}  <script nonce="${nonce}" src="https://cdn.tailwindcss.com"><\/script>
  <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"><\/script>
  <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/TextPlugin.min.js"><\/script>
  <script nonce="${nonce}">
    console.log('[widget] gsap:', typeof gsap, '| TextPlugin:', typeof TextPlugin);
    gsap.registerPlugin(TextPlugin);
  <\/script>
  <style>
    *,html,body{box-sizing:border-box;margin:0;padding:0}
    html,body{background:transparent!important;background-color:transparent!important;color-scheme:normal;width:100%;height:100%;overflow:hidden}
  <\/style>
  <!-- Author CSS is isolated in its own tag so the editor can swap it via
       postMessage without reloading the document and losing widget state. -->
  <style id="sw-extra-css">${resolvedCss}<\/style>
</head>
<body style="background:transparent!important;background-color:transparent!important">
  ${resolvedHtml}
  <script nonce="${nonce}">
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    // Authors that re-apply settings on 'onFieldsUpdate' can be updated in
    // place; the editor reloads the document for the ones that don't, so it
    // needs to know which kind this is before it decides.
    var swHandlesFieldUpdates = false;
    var swOriginalAddEventListener = window.addEventListener.bind(window);
    window.addEventListener = function(type) {
      if (type === 'onFieldsUpdate') swHandlesFieldUpdates = true;
      return swOriginalAddEventListener.apply(null, arguments);
    };
    window.StreamWizard = {
      stateUrl: ${stateUrl},
      userStateUrl: ${userStateUrl},
      session: null,
      /** Latest field values. Replaced before each 'onFieldsUpdate'. */
      fieldData: {},
      // Typed wrapper around the raw state API; see the editor's autocomplete
      // (StreamWizardStateApi). Throws outside a placed overlay widget, where
      // there is no session to authenticate with.
      state: {
        _require: function() {
          var sw = window.StreamWizard;
          if (!sw.stateUrl || !sw.session || !sw.session.subscriberToken || !sw.session.overlayItemId) {
            throw new Error('StreamWizard.state is only available when the widget runs on an overlay (not in the editor preview).');
          }
          return sw;
        },
        get: async function() {
          var sw = this._require();
          // Token travels in the Authorization header, never the URL
          var res = await fetch(sw.stateUrl + '?itemId=' + encodeURIComponent(sw.session.overlayItemId), {
            headers: { 'Authorization': 'Bearer ' + sw.session.subscriberToken }
          });
          if (!res.ok) throw new Error('Failed to load widget state (' + res.status + ')');
          var body = await res.json();
          return body.state != null ? body.state : null;
        },
        set: async function(state) {
          var sw = this._require();
          var res = await fetch(sw.stateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sw.session.subscriberToken },
            body: JSON.stringify({ itemId: sw.session.overlayItemId, state: state })
          });
          if (!res.ok) throw new Error('Failed to save widget state (' + res.status + ')');
        }
      },
      // Channel-wide state. Where .state above is this one placed widget's
      // private blob, this store is shared across the channel AND written by
      // the server -- stream lifecycle lands in 'sys.' keys. That is what lets
      // a widget find out about something that happened while it was closed,
      // instead of only learning it from an event it had to be connected for.
      userState: {
        _require: function() {
          var sw = window.StreamWizard;
          if (!sw.userStateUrl || !sw.session || !sw.session.subscriberToken) {
            throw new Error('StreamWizard.userState is only available when the widget runs on an overlay (not in the editor preview).');
          }
          return sw;
        },
        get: async function(key) {
          var sw = this._require();
          var res = await fetch(sw.userStateUrl + '?key=' + encodeURIComponent(key), {
            headers: { 'Authorization': 'Bearer ' + sw.session.subscriberToken }
          });
          if (!res.ok) throw new Error('Failed to load channel state (' + res.status + ')');
          var body = await res.json();
          return body.value != null ? body.value : null;
        },
        getAll: async function() {
          var sw = this._require();
          var res = await fetch(sw.userStateUrl, {
            headers: { 'Authorization': 'Bearer ' + sw.session.subscriberToken }
          });
          if (!res.ok) throw new Error('Failed to load channel state (' + res.status + ')');
          var body = await res.json();
          return body.state != null ? body.state : {};
        },
        set: async function(key, value) {
          var sw = this._require();
          var res = await fetch(sw.userStateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sw.session.subscriberToken },
            body: JSON.stringify({ key: key, value: value })
          });
          if (!res.ok) throw new Error('Failed to save channel state (' + res.status + ')');
        },
        // Server-side atomic add: two widgets (or a mod command and a widget)
        // incrementing at once both count, unlike get-then-set. Numbers only.
        increment: async function(key, amount) {
          var sw = this._require();
          var res = await fetch(sw.userStateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sw.session.subscriberToken },
            body: JSON.stringify({ key: key, op: 'increment', value: amount == null ? 1 : amount })
          });
          if (!res.ok) throw new Error('Failed to increment channel state (' + res.status + ')');
          var body = await res.json();
          return body.value;
        },
        delete: async function(key) {
          var sw = this._require();
          var res = await fetch(sw.userStateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sw.session.subscriberToken },
            body: JSON.stringify({ key: key, op: 'delete' })
          });
          if (!res.ok) throw new Error('Failed to delete channel state (' + res.status + ')');
        },
        // Live updates: every state mutation (this widget, another widget, the
        // server, later chat commands) is pushed into the overlay's room and
        // relayed here as an onEventReceived with listener
        // 'streamwizard.user_state'. Registering is safe anywhere; in the
        // editor preview there is no socket, so the callback simply never
        // fires. Returns an unsubscribe function.
        onChange: function(callback) {
          var handler = function(e) {
            var d = e.detail;
            if (d && d.listener === 'streamwizard.user_state' && d.event) {
              callback(d.event.key, d.event.value, d.event.updatedAt);
            }
          };
          window.addEventListener('onEventReceived', handler);
          return function() { window.removeEventListener('onEventReceived', handler); };
        },
        subscribe: function(key, callback) {
          return this.onChange(function(changedKey, value, updatedAt) {
            if (changedKey === key) callback(value, updatedAt);
          });
        }
      },
      // Twitch lookups. EventSub hands the widget ids, not pictures; this
      // resolves them via the overlay origin so no Twitch credential ever
      // reaches the iframe. See the widget guide for the full contract.
      twitch: {
        twitchUrl: ${twitchUrl},
        // Assets only. Live counters are deliberately absent from this map --
        // memoising them would reintroduce exactly the staleness the server
        // refuses to introduce.
        _assets: {},
        _require: function() {
          var sw = window.StreamWizard;
          if (!sw.twitch.twitchUrl || !sw.session || !sw.session.subscriberToken) {
            throw new Error('StreamWizard.twitch is only available when the widget runs on an overlay (not in the editor preview).');
          }
          return sw;
        },
        _get: async function(path) {
          var sw = this._require();
          var res = await fetch(sw.twitch.twitchUrl + path, {
            headers: { 'Authorization': 'Bearer ' + sw.session.subscriberToken }
          });
          if (!res.ok) throw new Error('Twitch lookup failed (' + res.status + ') for ' + path);
          return await res.json();
        },
        // One in-flight promise per asset key, kept forever: badge and emote
        // maps change on the order of hours, and the document is reloaded when
        // the overlay is.
        _asset: function(key, path, pick) {
          var self = this;
          if (!self._assets[key]) {
            self._assets[key] = self._get(path).then(pick).catch(function(err) {
              // Don't cache the failure -- a widget that loads during a blip
              // should recover on its next call.
              delete self._assets[key];
              throw err;
            });
          }
          return self._assets[key];
        },
        /** set_id -> version -> {url_1x,url_2x,url_4x,title,description}. */
        badges: function() {
          return this._asset('badges', '/badges', function(b) { return b.badges; });
        },
        /** lowercased prefix -> {prefix, tiers[]}, tiers sorted high to low. */
        cheermotes: function() {
          return this._asset('cheermotes', '/cheermotes', function(b) { return b.cheermotes; });
        },
        /** provider is '7tv', 'bttv' or 'ffz'. Returns code -> emote. */
        thirdPartyEmotes: function(provider) {
          return this._asset('emotes:' + provider, '/emotes?provider=' + encodeURIComponent(provider), function(b) { return b.emotes; });
        },
        /** Batched and memoised per id, so repeat chatters cost nothing. */
        users: async function(ids) {
          var self = this;
          var wanted = [];
          var out = {};
          for (var i = 0; i < ids.length; i++) {
            var key = 'user:' + ids[i];
            if (self._assets[key]) out[ids[i]] = await self._assets[key];
            else if (wanted.indexOf(ids[i]) === -1) wanted.push(ids[i]);
          }
          if (wanted.length) {
            var pending = self._get('/users?ids=' + wanted.map(encodeURIComponent).join(','));
            wanted.forEach(function(id) {
              self._assets['user:' + id] = pending.then(function(b) { return b.users[id]; });
            });
            var body = await pending;
            wanted.forEach(function(id) { out[id] = body.users[id]; });
          }
          return out;
        },
        user: async function(id) {
          var users = await this.users([id]);
          return users[id];
        },
        game: function(id) {
          return this._asset('game:' + id, '/game?id=' + encodeURIComponent(id), function(b) { return b.game; });
        },
        // --- live values: never memoised, never cached ---
        // Fetch at load for the true starting value, adjust locally from
        // events, and re-anchor every minute or so -- events can drop or
        // replay across a reconnect, so a counter that is only incremented
        // drifts over a long stream.
        followerTotal: async function() {
          var body = await this._get('/followers');
          return body.total;
        },
        subTotal: async function() {
          var body = await this._get('/subscribers');
          return body.total;
        },
        stream: async function() {
          var body = await this._get('/stream');
          return body.stream;
        },
        // --- local resolvers: no network, need the map fetched first ---
        /** badge is an EventSub badges[] entry: {set_id, id, info}. */
        badgeUrl: function(badge, scale) {
          var map = this._badgeMap;
          if (!map || !badge) return undefined;
          var versions = map[badge.set_id];
          var version = versions && versions[badge.id];
          if (!version) return undefined;
          return version['url_' + (scale || '2x')] || version.url_2x;
        },
        /** fragment is a message fragment's .cheermote: {prefix, bits, tier}. */
        cheermoteUrl: function(fragment, options) {
          var map = this._cheermoteMap;
          if (!map || !fragment) return undefined;
          var entry = map[String(fragment.prefix).toLowerCase()];
          if (!entry) return undefined;
          var opts = options || {};
          // Tiers are sorted descending, so the first one the cheer covers wins.
          var tier = null;
          for (var i = 0; i < entry.tiers.length; i++) {
            if (fragment.bits >= entry.tiers[i].min_bits) { tier = entry.tiers[i]; break; }
          }
          if (!tier) tier = entry.tiers[entry.tiers.length - 1];
          if (!tier) return undefined;
          var theme = tier.images[opts.theme || 'dark'] || tier.images.dark || {};
          var format = theme[opts.format || 'animated'] || theme.animated || theme.static || {};
          return format[opts.scale || '4'] || format['2'] || format['1'];
        },
        /**
         * Fetches badges and cheermotes and keeps them for the synchronous
         * badgeUrl/cheermoteUrl resolvers. Call once at load; after it settles,
         * per-message rendering is a plain object lookup with no awaits.
         */
        ready: async function() {
          var self = this;
          var maps = await Promise.all([self.badges(), self.cheermotes()]);
          self._badgeMap = maps[0];
          self._cheermoteMap = maps[1];
          return { badges: maps[0], cheermotes: maps[1] };
        }
      }
    };
    window.addEventListener('message', function(e) {
      if (e.data.type === 'onWidgetLoad') {
        if (e.data.payload && e.data.payload.session) window.StreamWizard.session = e.data.payload.session;
        if (e.data.payload && e.data.payload.fieldData) window.StreamWizard.fieldData = e.data.payload.fieldData;
        window.dispatchEvent(new CustomEvent('onWidgetLoad', { detail: e.data.payload }));
      }
      // A setting changed while the document stayed loaded. Widgets that act on
      // this keep their runtime state; the reply tells the editor whether this
      // one did, so it can fall back to a reload for widgets that read
      // fieldData once at load.
      if (e.data.type === 'swFieldData') {
        window.StreamWizard.fieldData = e.data.fieldData || {};
        window.dispatchEvent(new CustomEvent('onFieldsUpdate', { detail: { fieldData: window.StreamWizard.fieldData } }));
        try {
          parent.postMessage({ type: 'swFieldDataApplied', handled: swHandlesFieldUpdates }, '*');
        } catch (err) { /* parent gone */ }
      }
      if (e.data.type === 'onEventReceived') window.dispatchEvent(new CustomEvent('onEventReceived', { detail: e.data.payload }));
      if (e.data.type === 'onSessionUpdate') window.dispatchEvent(new CustomEvent('onSessionUpdate', { detail: e.data.payload }));
      // Editor-only: hot-swap author CSS in place. HTML and JS still need a
      // document reload, but CSS is the tab people iterate on most.
      if (e.data.type === 'swPatchCss') {
        var styleEl = document.getElementById('sw-extra-css');
        if (styleEl) styleEl.textContent = e.data.css || '';
      }
    });
    ${js}
  <\/script>
</body>
</html>`;
}
