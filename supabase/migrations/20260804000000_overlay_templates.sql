-- Overlay templates and widget templates move from code into the database.
--
-- Both used to live in TypeScript (components/overlays/templates/definitions.ts
-- and components/overlays/widgets/custom/starter-widgets.ts) and shipped with a
-- deploy. They are catalog content, not code, so they now live here: admins can
-- add or retune a template without a release, and the app reads them at runtime.
--
-- These are GLOBAL rows (no user_id). Creating an overlay from a template still
-- COPIES into the user's own overlay_scenes / overlay_items / overlay_widgets
-- rows, so a template edit never reaches back into overlays somebody already made.

-- ---------------------------------------------------------------------------
-- overlay_widget_templates: ready-made custom-widget sources (HTML/JS/CSS + field schema)
-- ---------------------------------------------------------------------------
CREATE TABLE public.overlay_widget_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable, human-readable key ("alert-box"), used instead of the uuid in code.
  slug         text NOT NULL UNIQUE,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  tags         text[] NOT NULL DEFAULT '{}'::text[],
  html         text NOT NULL DEFAULT '',
  js           text NOT NULL DEFAULT '',
  extra_css    text NOT NULL DEFAULT '',
  -- WidgetFieldSchema, same shape as public.overlay_widgets.fields.
  fields       jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_published boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX overlay_widget_templates_published_idx
  ON public.overlay_widget_templates (is_published, sort_order);

-- ---------------------------------------------------------------------------
-- overlay_templates: the canvas a new overlay can start from
-- ---------------------------------------------------------------------------
CREATE TABLE public.overlay_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  render_mode  text NOT NULL DEFAULT 'obs' CHECK (render_mode IN ('obs', 'gps')),
  width        integer NOT NULL DEFAULT 1920,
  height       integer NOT NULL DEFAULT 1080,
  is_published boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX overlay_templates_published_idx
  ON public.overlay_templates (is_published, sort_order);

-- ---------------------------------------------------------------------------
-- overlay_template_items: mirrors overlay_items, minus the per-user columns
-- ---------------------------------------------------------------------------
CREATE TABLE public.overlay_template_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id       uuid NOT NULL REFERENCES public.overlay_templates (id) ON DELETE CASCADE,
  type              text NOT NULL,
  x                 integer NOT NULL DEFAULT 0,
  y                 integer NOT NULL DEFAULT 0,
  w                 integer NOT NULL DEFAULT 100,
  h                 integer NOT NULL DEFAULT 100,
  z_index           integer NOT NULL DEFAULT 0,
  label             text NOT NULL DEFAULT '',
  -- OverlayItemConfig for this item type, authored at the template's canvas size.
  config            jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- custom_widget items only: instantiation copies this widget template into an
  -- overlay_widgets row owned by the user and wires the item's widget_id/instance_id.
  widget_template_id uuid REFERENCES public.overlay_widget_templates (id) ON DELETE SET NULL,
  -- Insertion order, kept separate from z_index so stacking can change freely.
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX overlay_template_items_template_id_idx
  ON public.overlay_template_items (template_id, sort_order);

CREATE INDEX overlay_template_items_widget_template_id_idx
  ON public.overlay_template_items (widget_template_id);

-- updated_at maintenance (same trigger function the overlay tables use).
CREATE TRIGGER set_overlay_widget_templates_updated_at
  BEFORE UPDATE ON public.overlay_widget_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_overlay_updated_at();

CREATE TRIGGER set_overlay_templates_updated_at
  BEFORE UPDATE ON public.overlay_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_overlay_updated_at();

CREATE TRIGGER set_overlay_template_items_updated_at
  BEFORE UPDATE ON public.overlay_template_items
  FOR EACH ROW EXECUTE FUNCTION public.update_overlay_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: any signed-in user reads published catalog rows; only smp_admin writes.
-- ---------------------------------------------------------------------------
ALTER TABLE public.overlay_widget_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overlay_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overlay_template_items   ENABLE ROW LEVEL SECURITY;

CREATE POLICY overlay_widget_templates_select_published ON public.overlay_widget_templates
  FOR SELECT TO authenticated
  USING (is_published);

CREATE POLICY overlay_widget_templates_admin_all ON public.overlay_widget_templates
  FOR ALL TO authenticated
  USING      ( ( SELECT public.check_user_role('smp_admin') ) )
  WITH CHECK ( ( SELECT public.check_user_role('smp_admin') ) );

CREATE POLICY overlay_templates_select_published ON public.overlay_templates
  FOR SELECT TO authenticated
  USING (is_published);

CREATE POLICY overlay_templates_admin_all ON public.overlay_templates
  FOR ALL TO authenticated
  USING      ( ( SELECT public.check_user_role('smp_admin') ) )
  WITH CHECK ( ( SELECT public.check_user_role('smp_admin') ) );

-- Items are readable when their template is.
CREATE POLICY overlay_template_items_select_published ON public.overlay_template_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.overlay_templates t
      WHERE t.id = overlay_template_items.template_id
        AND t.is_published
    )
  );

CREATE POLICY overlay_template_items_admin_all ON public.overlay_template_items
  FOR ALL TO authenticated
  USING      ( ( SELECT public.check_user_role('smp_admin') ) )
  WITH CHECK ( ( SELECT public.check_user_role('smp_admin') ) );

-- ---------------------------------------------------------------------------
-- Seed: the overlay and widget templates that used to ship in TypeScript.
-- ---------------------------------------------------------------------------

-- Widget templates (ported from starter-widgets.ts)
INSERT INTO public.overlay_widget_templates (slug, name, description, tags, html, js, extra_css, fields, sort_order) VALUES (
  'alert-box',
  'Alert box',
  'Follows, subs, cheers, and raids with your own image and sound. Alerts queue up so none get lost.',
  ARRAY['alerts']::text[],
  '<div id="alert" class="flex flex-col items-center justify-center w-full h-full gap-3 p-6 opacity-0">
  <img id="alert-image" src="{{alertImage}}" alt="" class="max-h-[45%] object-contain drop-shadow-xl" />
  <p id="alert-title" class="text-white text-4xl font-bold drop-shadow-lg text-center"></p>
  <p id="alert-message" class="text-white/80 text-xl text-center"></p>
</div>',
  '/* Alert box: follows, subs, cheers, and raids with your own image and sound.
 * Swap the image/sound in the widget settings - no code needed. */

var duration = Number(fieldData.alertDuration) || 5;
var accent = fieldData.accentColor || ''#9e7aff'';
var busy = false;
var queue = [];

window.addEventListener(''onWidgetLoad'', function () {
  var img = document.getElementById(''alert-image'');
  if (!fieldData.alertImage) img.style.display = ''none'';
  document.getElementById(''alert-title'').style.color = accent;
});

window.addEventListener(''onEventReceived'', function (e) {
  var listener = e.detail.listener;
  var event = e.detail.event;

  if (listener === ''channel.follow'' && fieldData.showFollows !== false) {
    enqueue(event.user_name, ''just followed!'');
  }
  if (listener === ''channel.subscribe'' && fieldData.showSubs !== false) {
    enqueue(event.user_name, event.is_gift ? ''got a gifted sub!'' : ''just subscribed!'');
  }
  if (listener === ''channel.cheer'' && fieldData.showCheers !== false) {
    var name = event.is_anonymous ? ''Anonymous'' : event.user_name;
    enqueue(name, ''cheered '' + event.bits + '' bits!'');
  }
  if (listener === ''channel.raid'' && fieldData.showRaids !== false) {
    enqueue(event.from_broadcaster_user_name, ''raided with '' + event.viewers + '' viewers!'');
  }
});

function enqueue(title, message) {
  queue.push({ title: title, message: message });
  if (!busy) next();
}

function next() {
  var alert = queue.shift();
  if (!alert) { busy = false; return; }
  busy = true;

  document.getElementById(''alert-title'').textContent = alert.title;
  document.getElementById(''alert-message'').textContent = alert.message;

  if (fieldData.alertSound) {
    var audio = new Audio(fieldData.alertSound);
    audio.volume = Number(fieldData.soundVolume);
    if (isNaN(audio.volume)) audio.volume = 0.7;
    audio.play().catch(function () {});
  }

  var tl = gsap.timeline({ onComplete: next });
  tl.fromTo(''#alert'',
    { opacity: 0, scale: 0.85, y: 24 },
    { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: ''back.out(1.6)'' }
  );
  tl.to(''#alert'', { duration: duration });
  tl.to(''#alert'', { opacity: 0, scale: 0.9, y: -16, duration: 0.35, ease: ''power2.in'' });
}',
  '',
  '{"alertImage":{"type":"image","label":"Alert image","value":""},"alertSound":{"type":"audio","label":"Alert sound","value":""},"soundVolume":{"type":"slider","label":"Sound volume","value":0.7,"min":0,"max":1,"step":0.05},"accentColor":{"type":"colorpicker","label":"Accent color","value":"#9e7aff"},"alertDuration":{"type":"slider","label":"Seconds on screen","value":5,"min":2,"max":15,"step":1},"alertTypes":{"type":"group","label":"Alert types","fields":{"showFollows":{"type":"checkbox","label":"Show follows","value":true},"showSubs":{"type":"checkbox","label":"Show subs","value":true},"showCheers":{"type":"checkbox","label":"Show cheers","value":true},"showRaids":{"type":"checkbox","label":"Show raids","value":true}}}}'::jsonb,
  0
);
INSERT INTO public.overlay_widget_templates (slug, name, description, tags, html, js, extra_css, fields, sort_order) VALUES (
  'auto-switcher-status',
  'Auto switcher status',
  'Which scene you are on, and how close the auto switcher is to changing it. Metric bars only appear while something is wrong, so a healthy stream shows just the scene name.',
  ARRAY['irl', 'auto switcher']::text[],
  '<div id="card" class="flex flex-col gap-3 w-full rounded-2xl border px-5 py-4 backdrop-blur-sm transition-all duration-500">
  <div class="flex items-center justify-center gap-3">
    <span id="dot-wrap" class="relative flex h-2.5 w-2.5 shrink-0">
      <span id="dot-ping" class="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"></span>
      <span id="dot" class="relative inline-flex h-2.5 w-2.5 rounded-full"></span>
    </span>
    <span id="scene" class="font-semibold leading-tight text-center">Waiting…</span>
    <span id="pill" class="shrink-0 hidden text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-md border"></span>
  </div>
  <div id="bars" class="hidden flex-col gap-2"></div>
  <p id="note" class="hidden text-xs text-center opacity-60"></p>
</div>',
  '/* Auto switcher status: which scene you are on, and how close the
 * switcher is to changing it. Put it in OBS as a browser source, or on a
 * phone-mode overlay to watch it while you walk.
 *
 * To try it without a live stream, open Demo mode and run the
 * "Auto switcher degrade + recover" simulator. */

var METRICS = [
  { key: ''bitrate'', label: ''bitrate'' },
  { key: ''rtt'', label: ''rtt'' },
  { key: ''loss'', label: ''dropped'' }
];

/* No status for this long means the engine went away. It heartbeats every 5s
 * while it is watching a stream, so 15s of silence is three missed beats.
 *
 * It deliberately goes quiet when nothing is streaming, so silence only counts
 * as "gone" if the last thing it told us was that a stream was live -- see
 * isStale(). */
var STALE_MS = 15000;

var status = null;
var statusAt = 0;
var sceneName = null;

window.addEventListener(''onWidgetLoad'', function () {
  buildBars();
  render();
  setInterval(render, 1000);
});

window.addEventListener(''onEventReceived'', function (e) {
  var listener = e.detail.listener;
  var event = e.detail.event;

  if (listener === ''streamwizard.auto_switcher_status'') {
    status = event;
    statusAt = Date.now();
  }

  /* The scene OBS is actually on, whoever changed it -- the switcher, the
   * panel, or you tapping around in OBS yourself. */
  if (listener === ''streamwizard.obs_scene_changed'') {
    sceneName = event.sceneName;
  }

  render();
});

function buildBars() {
  var host = document.getElementById(''bars'');
  host.innerHTML = METRICS.map(function (m) {
    return ''<div id="row-'' + m.key + ''" class="hidden items-center gap-3">'' +
      ''<span class="font-mono opacity-50 w-16 shrink-0">'' + m.label + ''</span>'' +
      ''<div class="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">'' +
        ''<div id="fill-'' + m.key + ''" class="h-full rounded-full transition-all duration-300" style="width:0%"></div>'' +
      ''</div>'' +
      ''<span id="count-'' + m.key + ''" class="font-mono tabular-nums shrink-0 text-right opacity-80"></span>'' +
    ''</div>'';
  }).join('''');
}

/* A resting frame (nothing being watched) is the engine''s final word until
 * something changes, so it must never rot into "No signal" -- that would turn
 * "you are not streaming" into "your switcher is broken" after 15 seconds. */
function isStale() {
  if (!status) return true;
  if (!status.armed) return false;
  return Date.now() - statusAt > STALE_MS;
}

function render() {
  var card = document.getElementById(''card'');
  var stale = isStale();
  var state = stale ? ''unknown'' : status.state;

  /* Override freezes the state machine, so the streaks underneath it are
   * stale by definition -- render it as its own thing, never with bars. */
  var inFallback = state === ''degraded'' || state === ''offline'';
  var showBars = fieldData.showBars !== false && !stale &&
    (state === ''live'' || state === ''startup'' || state === ''degraded'');

  var accent = colorFor(state, stale);
  card.style.background = fieldData.background || ''rgba(0,0,0,0.75)'';
  card.style.borderColor = state === ''live'' || stale ? ''rgba(255,255,255,0.12)'' : accent + ''66'';
  card.style.color = fieldData.textColor || ''#ffffff'';
  card.style.fontSize = (Number(fieldData.fontSize) || 16) + ''px'';

  var dot = document.getElementById(''dot'');
  var ping = document.getElementById(''dot-ping'');
  dot.style.background = accent;
  ping.style.background = accent;
  /* Pulse only when something needs attention, so a healthy overlay is still. */
  ping.style.display = (!stale && (inFallback || status.warning_shown)) ? '''' : ''none'';

  document.getElementById(''scene'').textContent = sceneLabel(stale);

  var pill = document.getElementById(''pill'');
  var pillText = pillFor(state, stale);
  pill.textContent = pillText;
  pill.style.display = pillText ? '''' : ''none'';
  pill.style.color = accent;
  pill.style.borderColor = accent + ''66'';
  pill.style.background = accent + ''33'';

  document.getElementById(''bars'').style.display = showBars ? ''flex'' : ''none'';
  if (showBars) {
    var anyVisible = false;
    for (var i = 0; i < METRICS.length; i++) {
      if (renderRow(METRICS[i], inFallback)) anyVisible = true;
    }
    document.getElementById(''bars'').style.display = anyVisible ? ''flex'' : ''none'';
  }

  var note = document.getElementById(''note'');
  var noteText = noteFor(state, stale);
  note.textContent = noteText;
  note.style.display = noteText ? '''' : ''none'';
}

/* Returns whether the row is showing, so an all-healthy set can collapse the
 * whole bar block instead of leaving an empty gap. */
function renderRow(metric, inFallback) {
  var row = document.getElementById(''row-'' + metric.key);
  var streak = status.streaks[metric.key];
  var thr = status.thresholds;

  var value = inFallback ? streak.good : streak.bad;
  var limit = inFallback
    ? thr[metric.key + ''_recover_polls'']
    : thr[metric.key + ''_trigger_polls''];

  if (value <= 0) { row.style.display = ''none''; return false; }
  row.style.display = ''flex'';

  var pct = Math.min((value / limit) * 100, 100);
  var color = inFallback ? ''#34d399'' : pct >= 90 ? ''#f87171'' : pct >= 60 ? ''#fbbf24'' : ''#facc15'';

  var fill = document.getElementById(''fill-'' + metric.key);
  fill.style.width = pct + ''%'';
  fill.style.background = color;

  var count = document.getElementById(''count-'' + metric.key);
  count.style.color = color;
  count.style.fontSize = ''0.75em'';
  count.textContent = fieldData.showMetricValues !== false && status.latest
    ? measured(metric.key)
    : Math.min(value, limit) + ''/'' + limit + (inFallback ? '' good'' : '' bad'');
  return true;
}

function measured(key) {
  var s = status.latest;
  var thr = status.thresholds;
  if (key === ''bitrate'') {
    return s.kbps === null ? ''-'' : Math.round(s.kbps) + ''/'' + thr.bitrate_min_kbps + '' kbps'';
  }
  if (key === ''rtt'') {
    return s.rtt_ms === null ? ''-'' : Math.round(s.rtt_ms) + ''/'' + thr.rtt_max_ms + '' ms'';
  }
  return s.loss_pct === null ? ''-'' : s.loss_pct.toFixed(1) + ''/'' + thr.loss_max_pct + ''%'';
}

function sceneLabel(stale) {
  if (sceneName) return sceneName;
  /* Before the first scene event, fall back to whatever the switcher last
   * asked for. Close enough to be useful, and it self-corrects. */
  if (!stale && status.last_switch) return status.last_switch.to_scene;
  return stale ? ''No signal'' : ''Unknown scene'';
}

function pillFor(state, stale) {
  if (stale) return '''';
  if (state === ''override'') return ''HOLD'';
  if (state === ''degraded'') return ''FALLBACK'';
  if (state === ''offline'') return ''OFFLINE'';
  if (state === ''startup'') return ''STARTING'';
  return '''';
}

function noteFor(state, stale) {
  if (stale) return ''No status from the switcher'';
  if (state === ''override'') return ''Scene held manually'';
  if (state === ''idle'' || !status.armed) return ''No stream'';
  return '''';
}

function colorFor(state, stale) {
  if (stale) return fieldData.offlineColor || ''#94a3b8'';
  if (state === ''offline'') return fieldData.offlineColor || ''#94a3b8'';
  if (state === ''degraded'') return fieldData.fallbackColor || ''#fb923c'';
  if (state === ''override'') return fieldData.overrideColor || ''#a78bfa'';
  if (state === ''startup'') return fieldData.warningColor || ''#facc15'';
  if (status.warning_shown) return fieldData.warningColor || ''#facc15'';
  return fieldData.healthyColor || ''#34d399'';
}',
  '',
  '{"showBars":{"type":"checkbox","label":"Show poll bars","value":true},"showMetricValues":{"type":"checkbox","label":"Show measured values on the bars","value":true},"fontSize":{"type":"slider","label":"Text size (px)","value":16,"min":10,"max":32,"step":1},"colors":{"type":"group","label":"Colors","fields":{"healthyColor":{"type":"colorpicker","label":"Healthy","value":"#34d399"},"warningColor":{"type":"colorpicker","label":"Warning","value":"#facc15"},"fallbackColor":{"type":"colorpicker","label":"Fallback","value":"#fb923c"},"offlineColor":{"type":"colorpicker","label":"Offline","value":"#94a3b8"},"overrideColor":{"type":"colorpicker","label":"Manual hold","value":"#a78bfa"},"textColor":{"type":"colorpicker","label":"Text","value":"#ffffff"},"background":{"type":"text","label":"Card background (CSS color)","value":"rgba(0,0,0,0.75)"}}}}'::jsonb,
  1
);

-- Overlay templates (ported from templates/definitions.ts)
INSERT INTO public.overlay_templates (slug, name, description, render_mode, width, height, sort_order) VALUES (
  'blank',
  'Blank',
  'Empty canvas. Build it your way.',
  'obs',
  1920,
  1080,
  0
);
INSERT INTO public.overlay_templates (slug, name, description, render_mode, width, height, sort_order) VALUES (
  'starting-soon',
  'Starting soon',
  'Big title, countdown, and a clock. Point OBS at it and go get your coffee.',
  'obs',
  1920,
  1080,
  1
);
INSERT INTO public.overlay_template_items (template_id, type, x, y, w, h, z_index, label, config, widget_template_id, sort_order) VALUES (
  (SELECT id FROM public.overlay_templates WHERE slug = 'starting-soon'),
  'text_widget', 460, 330, 1000, 140, 1,
  'Title',
  '{"text":"Starting soon","fontSize":96,"color":"#ffffff","align":"center","fontWeight":700,"fontFamily":"Inter"}'::jsonb,
  NULL,
  0
);
INSERT INTO public.overlay_template_items (template_id, type, x, y, w, h, z_index, label, config, widget_template_id, sort_order) VALUES (
  (SELECT id FROM public.overlay_templates WHERE slug = 'starting-soon'),
  'timer_widget', 710, 500, 500, 90, 2,
  'Countdown',
  '{"countdownMode":"duration","durationSeconds":300,"targetAtIso":"2026-08-04T12:52:06.317Z","finishedText":"We''re live!","fontSize":64,"color":"#ffffff","align":"center","fontWeight":600,"fontFamily":"Inter"}'::jsonb,
  NULL,
  1
);
INSERT INTO public.overlay_template_items (template_id, type, x, y, w, h, z_index, label, config, widget_template_id, sort_order) VALUES (
  (SELECT id FROM public.overlay_templates WHERE slug = 'starting-soon'),
  'clock_widget', 810, 950, 300, 60, 3,
  'Clock',
  '{"fontSize":28,"color":"#ffffff","align":"center","fontWeight":600,"fontFamily":"Inter","timeZone":"","showDate":false,"showTime":true,"dateStyle":"medium","timeStyle":"short","hour12":false,"showSeconds":false,"layout":"inline"}'::jsonb,
  NULL,
  2
);
INSERT INTO public.overlay_templates (slug, name, description, render_mode, width, height, sort_order) VALUES (
  'just-chatting',
  'Just chatting',
  'A clean label and clock. Room for your camera and chat.',
  'obs',
  1920,
  1080,
  2
);
INSERT INTO public.overlay_template_items (template_id, type, x, y, w, h, z_index, label, config, widget_template_id, sort_order) VALUES (
  (SELECT id FROM public.overlay_templates WHERE slug = 'just-chatting'),
  'text_widget', 60, 960, 600, 70, 1,
  'Stream label',
  '{"text":"Just chatting","fontSize":40,"color":"#ffffff","align":"left","fontWeight":600,"fontFamily":"Inter"}'::jsonb,
  NULL,
  0
);
INSERT INTO public.overlay_template_items (template_id, type, x, y, w, h, z_index, label, config, widget_template_id, sort_order) VALUES (
  (SELECT id FROM public.overlay_templates WHERE slug = 'just-chatting'),
  'clock_widget', 1560, 40, 300, 50, 2,
  'Clock',
  '{"fontSize":26,"color":"#ffffff","align":"right","fontWeight":600,"fontFamily":"Inter","timeZone":"","showDate":false,"showTime":true,"dateStyle":"medium","timeStyle":"short","hour12":false,"showSeconds":false,"layout":"inline"}'::jsonb,
  NULL,
  1
);
INSERT INTO public.overlay_templates (slug, name, description, render_mode, width, height, sort_order) VALUES (
  'clips-showcase',
  'Clips showcase',
  'Plays your recent clips on a loop. Great for BRB screens and stream intros.',
  'obs',
  1920,
  1080,
  3
);
INSERT INTO public.overlay_template_items (template_id, type, x, y, w, h, z_index, label, config, widget_template_id, sort_order) VALUES (
  (SELECT id FROM public.overlay_templates WHERE slug = 'clips-showcase'),
  'clips_widget', 0, 0, 1920, 1080, 1,
  'Clips',
  '{"sourceMode":"all","folderIds":[],"gameIds":[],"creatorIds":[],"timeWindow":"all","sort":"random","minViewCount":0,"isFeaturedOnly":false,"clipMuted":false,"clipVolume":1,"clipTransition":"cut","clipTransitionMs":600}'::jsonb,
  NULL,
  0
);
INSERT INTO public.overlay_template_items (template_id, type, x, y, w, h, z_index, label, config, widget_template_id, sort_order) VALUES (
  (SELECT id FROM public.overlay_templates WHERE slug = 'clips-showcase'),
  'text_widget', 60, 60, 500, 70, 2,
  'BRB label',
  '{"text":"Be right back","fontSize":44,"color":"#ffffff","align":"left","fontWeight":700,"fontFamily":"Inter"}'::jsonb,
  NULL,
  1
);
INSERT INTO public.overlay_templates (slug, name, description, render_mode, width, height, sort_order) VALUES (
  'alert-box',
  'Alert box',
  'Follow, sub, cheer, and raid alerts. Add your own media and sounds — no code needed.',
  'obs',
  1920,
  1080,
  4
);
INSERT INTO public.overlay_template_items (template_id, type, x, y, w, h, z_index, label, config, widget_template_id, sort_order) VALUES (
  (SELECT id FROM public.overlay_templates WHERE slug = 'alert-box'),
  'alert_widget', 660, 80, 600, 400, 1,
  'Alert box',
  '{"gapSeconds":1,"masterVolume":0.8,"variants":{"follow":{"enabled":true,"mediaUrl":"","mediaKind":"","soundUrl":"","volume":0.8,"titleTemplate":"{name} just followed!","messageTemplate":"","durationSeconds":6,"minAmount":0,"layout":"stacked","animationIn":"zoom","animationOut":"fade","fontFamily":"Inter","fontSize":32,"fontWeight":700,"align":"center","titleColor":"#ffffff","messageColor":"#d4d4d8","accentColor":"#9e7aff","textShadow":true},"sub":{"enabled":true,"mediaUrl":"","mediaKind":"","soundUrl":"","volume":0.8,"titleTemplate":"{name} just subscribed!","messageTemplate":"","durationSeconds":6,"minAmount":0,"layout":"stacked","animationIn":"zoom","animationOut":"fade","fontFamily":"Inter","fontSize":32,"fontWeight":700,"align":"center","titleColor":"#ffffff","messageColor":"#d4d4d8","accentColor":"#9e7aff","textShadow":true},"resub":{"enabled":true,"mediaUrl":"","mediaKind":"","soundUrl":"","volume":0.8,"titleTemplate":"{name} resubscribed for {amount} months!","messageTemplate":"{message}","durationSeconds":6,"minAmount":0,"layout":"stacked","animationIn":"zoom","animationOut":"fade","fontFamily":"Inter","fontSize":32,"fontWeight":700,"align":"center","titleColor":"#ffffff","messageColor":"#d4d4d8","accentColor":"#9e7aff","textShadow":true},"gift_sub":{"enabled":true,"mediaUrl":"","mediaKind":"","soundUrl":"","volume":0.8,"titleTemplate":"{name} gifted {amount} subs!","messageTemplate":"","durationSeconds":6,"minAmount":0,"layout":"stacked","animationIn":"zoom","animationOut":"fade","fontFamily":"Inter","fontSize":32,"fontWeight":700,"align":"center","titleColor":"#ffffff","messageColor":"#d4d4d8","accentColor":"#9e7aff","textShadow":true},"cheer":{"enabled":true,"mediaUrl":"","mediaKind":"","soundUrl":"","volume":0.8,"titleTemplate":"{name} cheered {amount} bits!","messageTemplate":"{message}","durationSeconds":6,"minAmount":0,"layout":"stacked","animationIn":"zoom","animationOut":"fade","fontFamily":"Inter","fontSize":32,"fontWeight":700,"align":"center","titleColor":"#ffffff","messageColor":"#d4d4d8","accentColor":"#9e7aff","textShadow":true},"raid":{"enabled":true,"mediaUrl":"","mediaKind":"","soundUrl":"","volume":0.8,"titleTemplate":"{name} is raiding with {amount} viewers!","messageTemplate":"","durationSeconds":6,"minAmount":0,"layout":"stacked","animationIn":"zoom","animationOut":"fade","fontFamily":"Inter","fontSize":32,"fontWeight":700,"align":"center","titleColor":"#ffffff","messageColor":"#d4d4d8","accentColor":"#9e7aff","textShadow":true}}}'::jsonb,
  NULL,
  0
);
