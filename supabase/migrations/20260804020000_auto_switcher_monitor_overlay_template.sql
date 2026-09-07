-- Second overlay template: the auto-switcher monitor built on staging.
--
-- Captured from staging overlay 140100dd-7fbb-4242-82e1-4d33b968c727 ("IRL"),
-- a gps overlay whose single custom widget is a much-evolved version of the
-- auto-switcher-status widget template seeded in 20260804000000 (that one came
-- from the old TypeScript file: no CSS, half the JS, no compact chip mode, no
-- recovery countdown). Refresh the widget template in place rather than adding
-- a near-duplicate slug, then add the overlay template that places it.
--
-- Instantiation is unchanged: selecting this template copies the widget source
-- into an overlay_widgets row owned by the user, so later edits here never
-- reach overlays somebody already made.

-- 1. Refresh the auto-switcher-status widget template from the staging version.
UPDATE public.overlay_widget_templates SET
  name        = 'Auto switcher status',
  description = 'Which scene you are on, and how close the auto switcher is to changing it. Metric bars only appear while something is wrong, so a healthy stream shows just the scene name.',
  tags        = ARRAY['irl', 'auto switcher']::text[],
  html        = '<!-- Paste into the widget editor''s HTML tab. -->
<div class="flex justify-center">
  <div id="card" class="inline-flex flex-col gap-2 rounded-2xl border px-4 py-3 backdrop-blur-sm mx-auto">
    <!-- Scene row -->
    <div class="flex items-center justify-center gap-2.5">
      <span class="relative flex h-2.5 w-2.5 shrink-0">
      <span id="dot-ping" class="absolute inline-flex h-full w-full rounded-full opacity-75"></span>
      <span id="dot" class="relative inline-flex h-2.5 w-2.5 rounded-full"></span>
      </span>

      <span id="scene" class="font-semibold leading-tight">Waiting…</span>

      <span id="pill"
          class="hidden shrink-0 rounded-md border px-1.5 py-0.5 text-[0.6em] font-bold uppercase tracking-widest">
    </span>
    </div>

    <!-- Metric rows, injected by JS -->
    <div id="bars" class="hidden flex-col gap-1.5"></div>

    <!-- Direction / countdown line -->
    <p id="note" class="hidden text-[0.72em] leading-tight opacity-80"></p>
  </div>
</div>',
  js          = '/* Auto switcher status — phone monitor edition.
 *
 * Invisible (or a small chip) while everything is healthy. Appears the moment
 * a metric starts counting bad polls, names the screen viewers are on, and
 * gives the countdown in BOTH directions:
 *
 *   going down:   "Fallback in 4 bad polls"
 *   coming back:  "Back to “IRL Cam” in 7 good polls"
 *
 * Events consumed (already on the overlay''s socket, nothing to subscribe to):
 *   streamwizard.auto_switcher_status — state, streaks, thresholds, latest
 *   streamwizard.obs_scene_changed    — the scene OBS is actually on
 *
 * Test with Demo mode → "Auto switcher degrade + recover".
 */

var F = {};

function bool(v, fb) { return v === undefined || v === null ? fb : v !== false; }
function color(key, fb) { return F[key] || fb; }

var METRICS = [
  { key: ''bitrate'', label: ''bitrate'' },
  { key: ''rtt'', label: ''ping'' },
  { key: ''loss'', label: ''loss'' }
];

/* Heartbeat is 5s while a stream is watched; three missed beats = the feed is
 * gone. The engine deliberately goes quiet when unarmed, so silence after an
 * unarmed frame means "no stream", never "broken". */
var STALE_MS = 15000;

var swStatus = null;
var swStatusAt = 0;
var sceneName = null;    // what OBS is actually on (observed, not commanded)
var liveScene = null;    // last scene seen while state was "live" → the switch-back target
var attentionUntil = 0;  // keeps the card up briefly after recovery
var shownMode = null;    // last applied visibility, so we only tween on change
var ticker = null;

/* ── lifecycle ─────────────────────────────────────────────────────────── */
window.addEventListener(''onWidgetLoad'', function (e) {
  F = (e.detail && e.detail.fieldData) || {};
  buildRows();
  render();
  /* Countdowns, the stale guard and the recovery hold all move without an
   * event to prompt them. */
  if (!ticker) ticker = setInterval(render, 500);
});

window.addEventListener(''onFieldsUpdate'', function (e) {
  F = (e.detail && e.detail.fieldData) || {};
  render();
});

window.addEventListener(''onEventReceived'', function (e) {
  var listener = e.detail.listener;
  var event = e.detail.event;

  if (listener === ''streamwizard.auto_switcher_status'') {
    swStatus = event;
    swStatusAt = Date.now();
    /* Remember the live scene ONLY while live — last_switch.from_scene can be
     * the fallback itself (degraded → offline), so it is not trustworthy. */
    if (event.state === ''live'' && sceneName) liveScene = sceneName;
  }

  if (listener === ''streamwizard.obs_scene_changed'') {
    sceneName = event.sceneName;
    if (swStatus && swStatus.state === ''live'') liveScene = sceneName;
  }

  render();
});

/* ── build ─────────────────────────────────────────────────────────────── */
function buildRows() {
  var host = document.getElementById(''bars'');
  var rows = '''';
  for (var i = 0; i < METRICS.length; i++) {
    var m = METRICS[i];
    rows +=
      ''<div id="row-'' + m.key + ''" class="hidden items-center gap-2">'' +
        ''<span class="w-12 shrink-0 text-[0.7em] uppercase tracking-wide opacity-50">'' + m.label + ''</span>'' +
        ''<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">'' +
          ''<div id="fill-'' + m.key + ''" class="h-full rounded-full transition-all duration-300" style="width:0%"></div>'' +
        ''</div>'' +
        ''<span id="meas-'' + m.key + ''" class="shrink-0 text-[0.65em] tabular-nums opacity-45"></span>'' +
        ''<span id="polls-'' + m.key + ''" class="w-10 shrink-0 text-right text-[0.7em] font-semibold tabular-nums"></span>'' +
      ''</div>'';
  }
  host.innerHTML = rows;
}

/* ── visibility ────────────────────────────────────────────────────────── */
function isStale() {
  if (!swStatus.armed) return false; // resting frame is the last word, never rots
  return Date.now() - swStatusAt > STALE_MS;
}

/* Anything that should pull the card onto the screen. */
function needsAttention(state, stale) {
  if (stale) return true;
  if (!swStatus.armed || state === ''idle'') return false; // not streaming ≠ problem
  if (state !== ''live'') return true; // startup, degraded, offline, override
  if (swStatus.warning_shown) return true;
  for (var i = 0; i < METRICS.length; i++) {
    if (swStatus.streaks[METRICS[i].key].bad > 0) return true; // trouble brewing
  }
  return false;
}

function setMode(mode) {
  if (mode === shownMode) return;
  shownMode = mode;
  var card = document.getElementById(''card'');
  card.classList.toggle(''compact'', mode === ''compact'');
  gsap.to(card, {
    autoAlpha: mode === ''hidden'' ? 0 : mode === ''compact'' ? 0.85 : 1,
    scale: mode === ''hidden'' ? 0.92 : 1,
    duration: 0.35,
    ease: ''power2.out'',
    overwrite: ''auto''
  });
}

/* ── render ────────────────────────────────────────────────────────────── */
function render() {
  var now = Date.now();
  var waiting = !swStatus; // never heard from the switcher at all
  var stale = !waiting && isStale();
  var state = waiting ? ''waiting'' : swStatus.state;
  var attention = !waiting && needsAttention(state, stale);

  /* While something is wrong, keep pushing the hold window forward; when it
   * resolves, the card lingers holdSeconds showing the all-clear. */
  if (attention) attentionUntil = now + (Number(F.holdSeconds) || 6) * 1000;
  var allClear = !attention && now < attentionUntil;

  var mode = attention || allClear
    ? ''full''
    : (F.idleDisplay === ''compact'' ? ''compact'' : ''hidden'');

  var recovering = !waiting && !stale && (state === ''degraded'' || state === ''offline'');
  var accent = accentFor(state, stale, waiting);

  setMode(mode);
  paintCard(accent, state, stale, waiting, mode);
  paintScene(state, stale, waiting, accent, mode);
  paintRows(state, stale, waiting, recovering, mode);
  paintNote(state, stale, waiting, recovering, allClear, mode);
}

function paintCard(accent, state, stale, waiting, mode) {
  var card = document.getElementById(''card'');
  card.style.background = F.background || ''rgba(0,0,0,0.72)'';
  card.style.color = F.textColor || ''#ffffff'';
  card.style.fontSize = (Number(F.fontSize) || 20) + ''px'';
  var calm = waiting || stale || state === ''live'' || state === ''idle'';
  card.style.borderColor = calm ? ''rgba(255,255,255,0.12)'' : accent + ''66'';
  card.style.minWidth = mode === ''full'' && bool(F.showBars, true) ? ''280px'' : ''0px'';
}

function paintScene(state, stale, waiting, accent, mode) {
  var dot = document.getElementById(''dot'');
  var ping = document.getElementById(''dot-ping'');
  dot.style.background = accent;
  ping.style.background = accent;
  ping.style.display =
    mode === ''full'' && !waiting && !stale &&
    (state === ''degraded'' || state === ''offline'' || swStatus.warning_shown)
      ? '''' : ''none'';

  document.getElementById(''scene'').textContent = headline(state, stale, waiting);

  var pill = document.getElementById(''pill'');
  var text = mode === ''full'' ? pillFor(state, stale, waiting) : '''';
  pill.textContent = text;
  pill.style.display = text ? '''' : ''none'';
  pill.style.color = accent;
  pill.style.borderColor = accent + ''66'';
  pill.style.background = accent + ''2b'';
}

function headline(state, stale, waiting) {
  if (waiting) return ''Waiting for switcher'';
  if (stale) return ''Switcher not reporting'';
  if (!swStatus.armed || state === ''idle'') return ''No stream'';
  if (sceneName) return sceneName;
  /* Before the first scene event, the switcher''s last command is close enough
   * and self-corrects on the next change. */
  if (swStatus.last_switch) return swStatus.last_switch.to_scene;
  return ''Unknown scene'';
}

/* The pill names the KIND of screen viewers are looking at, so "degraded" and
 * "offline" stop being interchangeable orange mysteries. */
function pillFor(state, stale, waiting) {
  if (waiting || stale) return '''';
  if (state === ''override'') return ''hold'';
  if (state === ''degraded'') return ''low bitrate'';
  if (state === ''offline'') return ''connection lost'';
  if (state === ''startup'') return ''starting'';
  return '''';
}

function paintRows(state, stale, waiting, recovering, mode) {
  var host = document.getElementById(''bars'');
  /* Override freezes the state machine, so its streaks are stale by
   * definition — never draw them. */
  var eligible = mode === ''full'' && !waiting && !stale && bool(F.showBars, true) &&
    (state === ''live'' || state === ''startup'' || state === ''degraded'' || state === ''offline'');
  if (!eligible) { host.style.display = ''none''; return; }

  var anyVisible = false;
  for (var i = 0; i < METRICS.length; i++) {
    if (paintRow(METRICS[i], recovering)) anyVisible = true;
  }
  host.style.display = anyVisible ? ''flex'' : ''none'';
}

function paintRow(metric, recovering) {
  var row = document.getElementById(''row-'' + metric.key);
  var streak = swStatus.streaks[metric.key];

  /* Recovery needs ALL metrics good, so show every row while recovering;
   * while live, only rows that are actually counting bad polls. */
  if (!recovering && streak.bad <= 0) {
    row.style.display = ''none'';
    return false;
  }
  row.style.display = ''flex'';

  var limit = pollLimit(metric.key, recovering);
  var polls = Math.min(recovering ? streak.good : streak.bad, limit); // good climbs unbounded — clamp
  var pct = Math.min((polls / limit) * 100, 100);

  var barColor =
    recovering ? color(''recoverColor'', ''#34d399'')
    : pct >= 90 ? color(''criticalColor'', ''#f87171'')
    : pct >= 55 ? color(''warningColor'', ''#fbbf24'')
    : color(''cautionColor'', ''#facc15'');

  var fill = document.getElementById(''fill-'' + metric.key);
  fill.style.width = pct + ''%'';
  fill.style.background = barColor;

  /* Poll count = countdown to the switch; measured value = the reason. */
  document.getElementById(''meas-'' + metric.key).textContent =
    bool(F.showMeasured, true) ? measured(metric.key) : '''';

  var pollsEl = document.getElementById(''polls-'' + metric.key);
  pollsEl.style.color = barColor;
  pollsEl.textContent = polls + ''/'' + limit;
  return true;
}

function pollLimit(key, recovering) {
  var thr = swStatus.thresholds;
  return recovering ? thr[key + ''_recover_polls''] : thr[key + ''_trigger_polls''];
}

/* Reading vs the threshold it is judged by. `latest` fields are null for RTMP,
 * which only reports throughput. */
function measured(key) {
  var s = swStatus.latest;
  var thr = swStatus.thresholds;
  if (!s) return '''';
  if (key === ''bitrate'') return s.kbps === null ? ''—'' : Math.round(s.kbps) + ''/'' + thr.bitrate_min_kbps;
  if (key === ''rtt'') return s.rtt_ms === null ? ''—'' : Math.round(s.rtt_ms) + ''/'' + thr.rtt_max_ms + ''ms'';
  return s.loss_pct === null ? ''—'' : s.loss_pct.toFixed(1) + ''/'' + thr.loss_max_pct + ''%'';
}

function paintNote(state, stale, waiting, recovering, allClear, mode) {
  var note = document.getElementById(''note'');
  var text = mode === ''full'' ? noteFor(state, stale, waiting, recovering, allClear) : '''';
  note.textContent = text;
  note.style.display = text ? '''' : ''none'';
}

function noteFor(state, stale, waiting, recovering, allClear) {
  if (waiting) return ''No status received yet'';
  if (stale) return ''No status from the switcher for 15s'';
  if (allClear) return ''✓ Stable again — on '' + (sceneName || liveScene || ''the live scene'');
  if (state === ''override'') {
    return swStatus.override && swStatus.override.scene_name
      ? ''Held on '' + swStatus.override.scene_name + '' — auto switching paused''
      : ''Scene held manually — auto switching paused'';
  }
  if (state === ''idle'' || !swStatus.armed) return ''No stream'';

  if (recovering) {
    var target = liveScene ? ''\u201C'' + liveScene + ''\u201D'' : ''the live scene'';
    /* Offline with no fresh samples: the good streaks cannot climb, so a poll
     * countdown would be a lie. */
    if (state === ''offline'' && !swStatus.latest) return ''Waiting for the connection to come back'';
    if (!bool(F.showCountdown, true)) return ''Switches back to '' + target + '' once stable'';
    var left = pollsToRecover();
    return left === null
      ? ''Stable — switching back to '' + target
      : ''Back to '' + target + '' in '' + left + '' good polls'';
  }

  /* Live but something is already counting: distance to the fallback. */
  if (bool(F.showCountdown, true)) {
    var until = pollsToSwitch();
    if (until !== null) return until <= 1 ? ''Switching to fallback now'' : ''Fallback in '' + until + '' bad polls'';
  }
  return '''';
}

/* Fallback fires when ANY metric hits its trigger → closest metric. */
function pollsToSwitch() {
  var best = null;
  for (var i = 0; i < METRICS.length; i++) {
    var key = METRICS[i].key;
    var bad = swStatus.streaks[key].bad;
    if (bad <= 0) continue;
    var left = Math.max(pollLimit(key, false) - bad, 0);
    if (best === null || left < best) best = left;
  }
  return best;
}

/* Recovery needs ALL metrics good → furthest-behind metric. */
function pollsToRecover() {
  var worst = null;
  for (var i = 0; i < METRICS.length; i++) {
    var key = METRICS[i].key;
    var left = Math.max(pollLimit(key, true) - swStatus.streaks[key].good, 0);
    if (worst === null || left > worst) worst = left;
  }
  return worst === 0 ? null : worst;
}

function accentFor(state, stale, waiting) {
  if (waiting || stale) return color(''offlineColor'', ''#94a3b8'');
  if (!swStatus.armed || state === ''idle'') return color(''offlineColor'', ''#94a3b8'');
  /* Connection lost is an emergency, not the same gray as "not streaming". */
  if (state === ''offline'') return color(''criticalColor'', ''#f87171'');
  if (state === ''degraded'') return color(''fallbackColor'', ''#fb923c'');
  if (state === ''override'') return color(''overrideColor'', ''#a78bfa'');
  if (state === ''startup'') return color(''cautionColor'', ''#facc15'');
  if (swStatus.warning_shown) return color(''cautionColor'', ''#facc15'');
  return color(''healthyColor'', ''#34d399'');
}',
  extra_css   = '/* Start invisible so the card fades IN on its first render instead of
   flashing a "Waiting…" frame — GSAP''s autoAlpha takes over from here. */
#card {
  opacity: 0;
  visibility: hidden;
  align-items: stretch;
  transition: border-color 0.4s, background 0.4s;
}

/* Compact chip mode — just the dot and scene name, tucked away. */
#card.compact {
  padding: 0.35em 0.7em;
  border-radius: 9999px;
  min-width: 0;
}
#card.compact #scene {
  font-size: 0.8em;
  font-weight: 500;
}
#card.compact #bars,
#card.compact #note,
#card.compact #pill {
  display: none !important;
}

/* Soften the attention pulse — Tailwind''s animate-ping is a hard 1s strobe,
   which is brutal on a screen you glance at for hours. */
#dot-ping {
  animation: sw-pulse 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
}
@keyframes sw-pulse {
  0%   { transform: scale(1);   opacity: 0.7; }
  70%  { transform: scale(2.4); opacity: 0; }
  100% { transform: scale(2.4); opacity: 0; }
}

/* Bars grow from the left so a filling bar reads as progress, not a blink. */
#bars > div > div > div {
  transform-origin: left center;
}',
  fields      = '{"card": {"type": "group", "label": "Card", "fields": {"textColor": {"type": "colorpicker", "label": "Text", "value": "#ffffff"}, "background": {"type": "text", "label": "Background (any CSS color)", "value": "rgba(0,0,0,0.72)"}}}, "colors": {"type": "group", "label": "Colors", "fields": {"cautionColor": {"type": "colorpicker", "label": "Caution (first bad polls)", "value": "#facc15"}, "healthyColor": {"type": "colorpicker", "label": "Healthy", "value": "#34d399"}, "offlineColor": {"type": "colorpicker", "label": "Not streaming / no signal", "value": "#94a3b8"}, "recoverColor": {"type": "colorpicker", "label": "Recovering", "value": "#34d399"}, "warningColor": {"type": "colorpicker", "label": "Warning (over halfway)", "value": "#fbbf24"}, "criticalColor": {"type": "colorpicker", "label": "Critical / connection lost", "value": "#f87171"}, "fallbackColor": {"type": "colorpicker", "label": "Low-bitrate fallback", "value": "#fb923c"}, "overrideColor": {"type": "colorpicker", "label": "Manual hold", "value": "#a78bfa"}}}, "fontSize": {"max": 48, "min": 10, "step": 1, "type": "slider", "label": "Text size (px)", "value": 20}, "showBars": {"type": "checkbox", "label": "Show poll bars", "value": true}, "holdSeconds": {"max": 30, "min": 1, "step": 1, "type": "slider", "label": "Keep showing after recovery (seconds)", "value": 6}, "idleDisplay": {"type": "dropdown", "label": "When everything is fine", "value": "hidden", "options": [{"label": "Hide the widget completely", "value": "hidden"}, {"label": "Small scene chip", "value": "compact"}]}, "showMeasured": {"type": "checkbox", "label": "Show the measured value on each bar", "value": true}, "showCountdown": {"type": "checkbox", "label": "Show switch countdowns", "value": true}}'::jsonb
WHERE slug = 'auto-switcher-status';

-- 2. The overlay template itself.
--
--    render_mode is 'obs' even though the staging overlay it came from is 'gps'.
--    Nothing in this layout uses GPS: the widget only listens to
--    streamwizard.auto_switcher_status and streamwizard.obs_scene_changed.
--    'gps' would route it to GpsOverlayCanvas, which unconditionally starts
--    navigator.geolocation.watchPosition({enableHighAccuracy:true}) and
--    publishes every fix into irl_geo_track -- a location prompt and a battery
--    drain for data this template never reads. As 'obs' it is a normal browser
--    source, and still works opened in a phone browser; it just won't ask.
INSERT INTO public.overlay_templates
  (slug, name, description, render_mode, width, height, sort_order)
VALUES (
  'auto-switcher-monitor',
  'Auto switcher monitor',
  'Shows which scene you are on and how close the auto switcher is to changing it. Stays out of the way until your bitrate starts sliding.',
  'obs',
  1920,
  1080,
  5
);

INSERT INTO public.overlay_template_items
  (template_id, type, x, y, w, h, z_index, label, config, widget_template_id, sort_order)
VALUES (
  (SELECT id FROM public.overlay_templates WHERE slug = 'auto-switcher-monitor'),
  'custom_widget',
  667, 64, 587, 229,
  1,
  'Auto switcher status',
  -- widget_id / instance_id are stripped: instantiation writes the user's own.
  '{"field_values": {"fontSize": 22, "showBars": true, "idleDisplay": "compact", "showMeasured": false, "showCountdown": true}}'::jsonb,
  (SELECT id FROM public.overlay_widget_templates WHERE slug = 'auto-switcher-status'),
  0
);
