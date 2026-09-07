-- Walking Stats v3: adversarial-review fixes for the stationary-pin patch.
--
-- 1. Pin departure loss: after a confirmed standstill, integration stayed
--    off until the position escaped the pin radius, silently dropping the
--    first 6-15 m of every departure (~10% on a stop-heavy city walk). The
--    escape now credits the pin-to-escape displacement directly.
-- 2. Pin radius freeze: one bad-accuracy fix pinned a radius of up to 90 m
--    until escaped. Better fixes now shrink the pin accuracy back down.
-- 3. pinStill leak: the position-fallback path (device reports no Doppler
--    speed) never cleared pinStill, freezing the speed readout at 0 while
--    the fallback odometer kept counting. The fallback now clears the pin.
-- 4. Backwards clock step (NTP sync) made every future fix look stale and
--    froze the widget while the bar stayed lit. A fix >60 s behind the
--    marker now restarts the fix chain instead of being dropped.
-- 5. Calibration window asymmetry: Doppler metres and position metres could
--    cover different stretches of travel (hysteresis band, discarded
--    strides), biasing the learned factor low. The windows now only grow on
--    fixes that counted, and a discarded stride rolls back its Doppler
--    metres. Target is now the full ratio (the position odometer is the
--    reference), with a multipath guardrail, and the factor is only
--    persisted after three agreeing windows.
--
-- Also updates user snapshot copies in overlay_widgets that still carry a
-- previous version of this exact JS (matched by md5) -- snapshots have no
-- template linkage, so template-only updates leave every existing user on
-- the buggy code.
--
-- Verified in a DOM-stubbed harness: 168 m walk shows 165; 90 s phantom
-- standstill adds 5 m at 0 km/h; 20 stale echoes add 0; a -5 min clock step
-- recovers (v2 froze); 10x stop-and-go gains 873 m of a real 840 m (v2: 616).

DO $$
DECLARE
  snapshot_count integer;
BEGIN
  UPDATE public.overlay_widget_templates
  SET js = $widgetjs$/* IRL bottom bar — speed / distance / location / weather */
(() => {
  'use strict';

  /* ---------- helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
  const bool = (v, d) => (typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : d);
  const txt = (v, d) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : d);

  function hexToRgba(hex, a) {
    const h = String(hex || '').replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(full, 16);
    if (full.length !== 6 || !Number.isFinite(n)) return 'rgba(0,0,0,' + a + ')';
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* Great-circle distance between two lat/lon points, in metres.
     You can't just Pythagoras lat/lon differences: a degree of longitude
     shrinks as you move away from the equator, and the Earth is a sphere.
     Haversine converts both points to radians and computes the arc length
     over a sphere of Earth's mean radius. Accurate to well under 0.5% for
     the short hops (metres to hundreds of metres) this widget cares about. */
  const EARTH = 6371000;
  function haversine(la1, lo1, la2, lo2) {
    const r = Math.PI / 180;
    const dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
    const s = Math.sin(dLa / 2) * Math.sin(dLa / 2) +
      Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * EARTH * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  /* WMO weather codes -> description */
  const WMO = {
    0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Rime fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
    56: 'Freezing drizzle', 57: 'Freezing drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    66: 'Freezing rain', 67: 'Freezing rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
    85: 'Snow showers', 86: 'Snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm'
  };

  /* ---------- runtime state ---------- */
  let cfg = {};
  let inited = false;
  let metric = true;

  const st = {
    total: 0, dirty: false, anchor: null,
    renderAt: 0, renderTotal: 0,
    /* prevSp: last Doppler speed, for trapezoidal integration.
       moving:  hysteresis flag — are we currently counting distance? */
    lastFix: null, speed: 0, prevSp: null, moving: false,
    /* Stationary pin (see addDistance): position anchor that speed-based
       distance must keep escaping, and the "confirmed standing still" flag. */
    pin: null, pinStill: false,
    /* Self-calibration (see the essay above calibrate()):
       factor  — multiplier applied to every Doppler increment
       dop     — raw (unscaled) Doppler metres in the current window
       pos     — position-path metres in the current window
       stride  — last position sample point for the 5s strides; carries a
                 checkpoint of dop so a discarded stride can roll back the
                 Doppler metres that have no position counterpart
       hist    — last few accepted ratios; when three agree the factor is
                 trusted enough to persist
       savedFactor — factor restored from storage, kept as the value to
                 persist until this session earns trust of its own */
    cal: { factor: 1, dop: 0, pos: 0, stride: null, hist: [], trusted: false, savedFactor: null },
    geoAt: 0, online: null,
    place: '', placeAt: 0, placePos: null, placeBusy: false,
    weatherAt: 0, weatherPos: null, weatherBusy: false
  };

  /* Each module owns its own text styling, read from fields prefixed with the
     module key (speedLabelColor, weatherValueFontSize, ...). Only the bar
     itself — background, size, spacing, typeface — is still global. */
  const MODULES = [
    { key: 'speed', show: 'showSpeed', label: 'SPEED' },
    { key: 'distance', show: 'showDistance', label: 'DISTANCE' },
    { key: 'location', show: 'showLocation', label: 'LOCATION' },
    { key: 'weather', show: 'showWeather', label: 'WEATHER' }
  ];

  function applyModuleStyle(m) {
    const el = $('mod-' + m.key);
    if (!el) return;
    const s = el.style;

    s.setProperty('--m-text', txt(cfg[m.key + 'TextColor'], '#ffffff'));
    s.setProperty('--m-label', txt(cfg[m.key + 'LabelColor'], '#b9b9c6'));
    s.setProperty('--m-value', clamp(num(cfg[m.key + 'ValueFontSize'], 24), 8, 120) + 'px');
    s.setProperty('--m-labelsize', clamp(num(cfg[m.key + 'LabelFontSize'], 12), 6, 60) + 'px');
    s.setProperty('--m-labelgap', clamp(num(cfg[m.key + 'LabelGap'], 8), 0, 60) + 'px');
    s.setProperty('--m-shadow',
      bool(cfg[m.key + 'TextShadow'], true) ? '0 2px 6px rgba(0,0,0,.7)' : 'none');

    el.classList.toggle('sw-inline', txt(cfg[m.key + 'LabelPosition'], 'above') === 'left');

    const labelEl = $(m.key + 'Label');
    if (labelEl) {
      labelEl.textContent = txt(cfg[m.key + 'LabelText'], m.label);
      labelEl.classList.toggle('sw-hidden', !bool(cfg[m.key + 'ShowLabel'], true));
    }
  }

  /* ---------- config -> DOM ---------- */
  function applyConfig() {
    metric = txt(cfg.units, 'metric') !== 'imperial';

    const r = document.documentElement.style;
    const opacity = clamp(num(cfg.barOpacity, 45), 0, 100) / 100;

    r.setProperty('--sw-bg', hexToRgba(txt(cfg.barBgColor, '#000000'), opacity));
    r.setProperty('--sw-h', clamp(num(cfg.barHeight, 64), 24, 400) + 'px');
    r.setProperty('--sw-w', clamp(num(cfg.barWidth, 100), 10, 100) + '%');
    r.setProperty('--sw-bottom', clamp(num(cfg.barBottomOffset, 0), 0, 600) + 'px');
    r.setProperty('--sw-radius', clamp(num(cfg.barRadius, 0), 0, 200) + 'px');
    r.setProperty('--sw-padx', clamp(num(cfg.barPaddingX, 26), 0, 200) + 'px');
    r.setProperty('--sw-gap', clamp(num(cfg.moduleGap, 34), 0, 200) + 'px');

    const family = txt(cfg.fontFamily, 'Inter');
    r.setProperty('--sw-font', '"' + family + '", system-ui, -apple-system, "Segoe UI", sans-serif');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' +
      encodeURIComponent(family).replace(/%20/g, '+') + ':wght@400;600;700&display=swap';
    document.head.appendChild(link);

    const bar = $('bar');
    bar.classList.toggle('sw-spread', txt(cfg.moduleAlign, 'left') === 'spread');
    bar.classList.toggle('sw-center', txt(cfg.moduleAlign, 'left') === 'center');
    bar.classList.toggle('sw-right', txt(cfg.moduleAlign, 'left') === 'right');

    $('speedUnit').textContent = metric ? 'km/h' : 'mph';
    $('distanceUnit').textContent = metric ? 'km' : 'mi';

    if (!bool(cfg.showWeatherText, true)) $('weatherDesc').classList.add('sw-hidden');

    MODULES.forEach((m) => {
      const el = $('mod-' + m.key);
      if (el && !bool(cfg[m.show], true)) { el.remove(); return; }
      applyModuleStyle(m);
    });
  }

  /* ---------- rendering ---------- */
  /* Fixes land about once a second, which is faster than a changing number can
     be read. These modes trade freshness for legibility: repaint on every fix,
     on a time step, or once a set distance has been covered. Location and
     weather keep their own refresh settings -- this governs speed and distance
     only. */
  function stampRender() {
    st.renderAt = Date.now();
    st.renderTotal = st.total;
  }

  function maybeRender() {
    const mode = txt(cfg.updateMode, 'fix');
    if (st.renderAt) {
      if (mode === 'time') {
        const iv = clamp(num(cfg.updateEverySec, 5), 1, 60) * 1000;
        if (Date.now() - st.renderAt < iv) return;
      } else if (mode === 'distance') {
        const step = clamp(num(cfg.updateEveryM, 5), 1, 500);
        if (st.total - st.renderTotal < step) return;
      }
    }
    renderSpeed();
    renderDistance();
    stampRender();
  }

  function renderSpeed() {
    const el = $('speedValue');
    if (!el) return;
    const dec = clamp(num(cfg.speedDecimals, 0), 0, 2);
    /* st.speed is kept in m/s (the GPS native unit); convert only here,
       at display time. 3.6 = km/h per m/s, 2.236936 = mph per m/s. */
    const v = metric ? st.speed * 3.6 : st.speed * 2.236936;
    el.textContent = v.toFixed(dec);
  }

  function renderDistance() {
    const el = $('distanceValue');
    if (!el) return;
    const dec = clamp(num(cfg.distanceDecimals, 2), 0, 3);
    const unitEl = $('distanceUnit');
    if (metric) {
      if (st.total < 1000) { el.textContent = String(Math.round(st.total)); unitEl.textContent = 'm'; }
      else { el.textContent = (st.total / 1000).toFixed(dec); unitEl.textContent = 'km'; }
    } else {
      const mi = st.total / 1609.344;
      if (mi < 0.1) { el.textContent = String(Math.round(st.total * 3.28084)); unitEl.textContent = 'ft'; }
      else { el.textContent = mi.toFixed(dec); unitEl.textContent = 'mi'; }
    }
  }

  function pop(el) {
    if (!el || !bool(cfg.updateAnim, true)) return;
    gsap.fromTo(el, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
  }

  function renderPlace(name) {
    const el = $('locationValue');
    if (!el || !name || name === st.place) return;
    st.place = name;
    el.textContent = name;
    pop(el);
  }

  function renderWeather(temp, code) {
    const t = $('weatherTemp'), d = $('weatherDesc');
    if (!t) return;
    t.textContent = Math.round(temp) + '°' + (metric ? 'C' : 'F');
    if (d) d.textContent = WMO[code] || '';
    pop(t.parentElement);
  }

  /* ---------- online / offline ---------- */
  function setOnline(on) {
    if (st.online === on) return;
    st.online = on;
    const mode = txt(cfg.offlineBehavior, 'dim');
    if (mode === 'keep') return;
    const target = mode === 'hide' ? $('wrap') : $('bar');
    gsap.to(target, {
      opacity: on ? 1 : (mode === 'hide' ? 0 : 0.35),
      y: mode === 'hide' && !on ? 24 : 0,
      duration: 0.5, ease: 'power2.out'
    });
  }

  /* ---------- distance ---------- */
  /* WHY TWO STRATEGIES?
     A GPS fix gives you two independent ways to measure travel:

     (a) g.speed — Doppler speed. The receiver measures the frequency shift
         of each satellite's carrier wave; that gives velocity directly,
         WITHOUT differencing positions. It is smooth and immune to position
         jitter — but real-world testing (1.4 km walk vs a known route)
         showed it reads 7-10% LOW at walking pace on phones: hand swing and
         multipath make the chip underestimate slow speeds.

     (b) Position deltas — haversine between fixes. Measures ground actually
         covered, but every hop carries jitter and jitter only ever ADDS
         length: the same walk measured +5-7% HIGH on 1-second hops.

     Opposite biases, same walk. So: integrate Doppler for the live number
     (smooth, no standstill drift), and let position data CALIBRATE it —
     see calibrate() below. Position deltas remain the outright fallback
     for devices that report no speed at all. */
  /* Returns true when this fix added Doppler metres to the total — the
     calibration window may only grow on exactly those fixes, or its two
     odometers drift apart and the ratio goes quietly wrong. */
  function addDistance(g, dt, accOk) {
    const sp = (typeof g.speed === 'number' && Number.isFinite(g.speed) && g.speed >= 0) ? g.speed : null;

    if (sp !== null) {
      /* The accuracy gate applies to Doppler too: a fix bad enough to be
         excluded from position math should not vouch for speed either. */
      if (!accOk) { st.prevSp = sp; st.anchor = null; return false; }

      /* Stationary pin. Indoors the chip reports phantom Doppler speed
         (0.3-0.8 m/s, above the hysteresis thresholds) while the position
         never leaves a small circle, so integrating speed alone drifts
         ~30 m/min at a standstill. Distance may only accumulate while the
         position keeps escaping a circle sized by the fix accuracy: walking
         escapes in a few seconds, a phone on a desk never does. The pin
         resets on every escape, so continuous walking never sits inside one
         circle long enough (10 s) to be declared still. */
      const now = Number(g.timestamp) || Date.now();
      const pinAcc = (typeof g.accuracy === 'number') ? g.accuracy : 10;
      if (!st.pin) {
        st.pin = { lat: g.latitude, lon: g.longitude, acc: pinAcc, t: now };
      } else if (pinAcc < st.pin.acc) {
        /* One bad fix must not freeze the radius: a single accuracy-60
           outlier would otherwise pin a 90 m circle that a walker needs a
           minute to escape. Better fixes shrink it back. */
        st.pin.acc = pinAcc;
      }
      const pinD = haversine(st.pin.lat, st.pin.lon, g.latitude, g.longitude);
      const pinR = Math.max(1.5 * Math.max(pinAcc, st.pin.acc), 6);
      if (pinD > pinR) {
        const wasStill = st.pinStill;
        st.pin = { lat: g.latitude, lon: g.longitude, acc: pinAcc, t: now };
        st.pinStill = false;
        if (wasStill) {
          /* Integration was off the whole time we sat inside the circle, so
             the walk out of it — up to pinR metres — was never counted.
             The pin-to-here displacement IS that travel, measured by
             position, so credit it directly (no Doppler factor) and skip
             integrating this fix: the displacement already covers it. */
          st.total += pinD;
          st.dirty = true;
          st.moving = true;
          st.prevSp = sp;
          st.anchor = null;
          return false;
        }
      } else if (now - st.pin.t >= 10000) {
        st.pinStill = true;
      }

      /* Hysteresis: two thresholds instead of one. Start counting at
         0.5 m/s, but once moving keep counting down to 0.3 m/s. With a
         single cutoff, a slow walk whose readings straddle it (0.45, 0.55,
         0.48...) gets chopped into dropped segments — each dip under the
         line throws that second of travel away. Two thresholds mean a
         reading has to fall clearly before we stop counting. Same idea a
         thermostat uses to avoid rapid on/off flapping. */
      let counted = false;
      if (!st.pinStill && (st.moving ? sp >= 0.3 : sp >= 0.5)) {
        /* Trapezoidal integration: distance over the gap is the AVERAGE of
           the previous and current speed times the gap, not the current
           speed alone. If you accelerated 0 -> 2 m/s over one second you
           travelled ~1 m, not 2 m.

           Math.min(dt, 10): if fixes stalled for 25 s we do NOT know the
           stall was spent moving — one fix vouches for at most 10 s.

           The raw increment feeds the calibration window; the on-screen
           total gets the increment scaled by the learned factor. */
        const prev = st.prevSp !== null ? st.prevSp : sp;
        const raw = ((prev + sp) / 2) * Math.min(dt, 10);
        st.cal.dop += raw;
        st.total += raw * st.cal.factor;
        st.dirty = true;
        st.moving = true;
        counted = true;
      } else {
        st.moving = false;
      }
      st.prevSp = sp;
      st.anchor = null;
      return counted;
    }

    /* -------- fallback: no Doppler speed on this device -------- */
    st.prevSp = null;
    st.moving = false;
    /* The pin belongs to the Doppler branch. A device that stops reporting
       speed mid-walk must not stay "confirmed still" forever — that would
       freeze the speed readout at 0 while the fallback odometer keeps
       counting. */
    st.pin = null;
    st.pinStill = false;
    if (!accOk) return false;
    const acc = (typeof g.accuracy === 'number') ? g.accuracy : 10;
    if (!st.anchor) { st.anchor = { lat: g.latitude, lon: g.longitude, acc: acc }; return false; }

    const d = haversine(st.anchor.lat, st.anchor.lon, g.latitude, g.longitude);
    /* The move must clear the error radius of BOTH endpoints (each fix has
       its own accuracy), with 1.5x margin, never less than 5 m. accuracy
       is the radius the true position is ~68% likely to be inside — two
       points closer than that may be the same spot seen twice.
       d <= 400 discards teleports (cell-tower fallback fixes, tunnels). */
    const floor = Math.max(Math.max(acc, st.anchor.acc) * 1.5, 5);
    if (d >= floor && d <= 400) {
      st.total += d;
      st.dirty = true;
      st.anchor = { lat: g.latitude, lon: g.longitude, acc: acc };
    }
    /* Position metres, not Doppler metres — never feeds the calibration. */
    return false;
  }

  /* ---------- self-calibration ---------- */
  /* Runs two odometers side by side and steers a correction factor toward
     their ratio.

     While Doppler metres are being counted with a good fix, a position
     sample is taken every >= 5 s ("stride"). Summed stride hops follow the
     real path but carry far less jitter than 1 s hops (jitter is a constant
     few metres per hop; a 5 s stride packs ~7 m of real travel behind it
     instead of ~1.3 m).

     Every 30 raw Doppler metres, compare the two windows:
       ratio  = position-path metres / Doppler metres   (typically ~1.15)
       target = ratio. Map-matching real walks showed 5s stride hops track
                true distance within ~2%, while Doppler reads 15-20% low —
                the position odometer IS the reference, so the target is the
                full ratio, not a midpoint that leaves part of the bias
                uncorrected by construction.
     The factor eases toward the target a quarter-step at a time and is
     clamped to [0.9, 1.25], so one garbage window (GPS glitch, tunnel)
     cannot yank the display. Windows with a nonsense ratio are discarded.

     THE TWO WINDOWS MUST COVER THE SAME TRAVEL. A fix that added no Doppler
     metres (below hysteresis, pinned still, bad accuracy) must not let the
     position window keep growing — and Doppler metres accrued since the
     current stride began have no position counterpart, so a discarded
     stride rolls c.dop back to the checkpoint taken when the stride was
     set. Without both rules the ratio drifts and quietly mis-teaches the
     factor.

     Multipath guardrail: a stride hop far beyond what the accrued Doppler
     metres could explain (reflections in an urban canyon inflating the
     position path) discards the window instead of feeding it — Doppler
     reads at most ~20% low, never 60%. */
  function calibrate(g, accOk, counted) {
    const c = st.cal;
    if (!accOk || !counted) {
      if (c.stride) { c.dop = c.stride.dop; c.stride = null; }
      return;
    }

    const t = Number(g.timestamp) || Date.now();
    if (!c.stride) { c.stride = { lat: g.latitude, lon: g.longitude, t: t, dop: c.dop }; return; }

    const dtS = (t - c.stride.t) / 1000;
    if (dtS < 5) return;
    if (dtS > 30) { c.dop = c.stride.dop; c.stride = { lat: g.latitude, lon: g.longitude, t: t, dop: c.dop }; return; }

    const hop = haversine(c.stride.lat, c.stride.lon, g.latitude, g.longitude);
    const dopHop = c.dop - c.stride.dop;
    if (hop > 100 || hop > 1.6 * dopHop + 10) {
      c.dop = c.stride.dop;
      c.stride = { lat: g.latitude, lon: g.longitude, t: t, dop: c.dop };
      return;
    }
    c.pos += hop;
    c.stride = { lat: g.latitude, lon: g.longitude, t: t, dop: c.dop };

    if (c.dop >= 30 && c.pos > 0) {
      const ratio = c.pos / c.dop;
      if (ratio > 0.7 && ratio < 1.6) {
        const target = clamp(ratio, 0.9, 1.25);
        c.factor += (target - c.factor) * 0.25;
        /* Trust for persistence: three accepted windows agreeing within
           0.08 of each other. One noisy stream must not bank a bad factor
           for every future stream (see startAutoSave). */
        c.hist.push(ratio);
        if (c.hist.length > 3) c.hist.shift();
        if (c.hist.length === 3 && Math.max.apply(null, c.hist) - Math.min.apply(null, c.hist) <= 0.08) {
          c.trusted = true;
        }
      }
      c.dop = 0;
      c.pos = 0;
      c.stride.dop = 0;
    }
  }

  /* ---------- geo ---------- */
  function handleGeo(raw) {
    if (raw && raw.status === 'offline') { setOnline(false); return; }
    const g = raw && raw.payload ? raw.payload : raw;
    if (!g || typeof g.latitude !== 'number' || typeof g.longitude !== 'number') return;

    const now = Number(g.timestamp) || Date.now();
    st.geoAt = Date.now();
    setOnline(true);

    /* Duplicate / stale guard: the same fix can arrive twice (local context +
       the ws-server echo of our own publish), and a reconnect can flush old
       fixes late. A frame at or before the last processed timestamp keeps the
       presence update above but must not reach the math - it would rewind
       lastFix and re-count the interval on the next fix.

       Exception: a fix more than 60 s BEHIND the marker is not a late echo,
       it is the device clock stepping backwards (NTP sync, manual change).
       Without this escape every future fix looks stale and the widget
       freezes while the bar stays lit. Restart the fix chain from here. */
    if (st.lastFix && now <= st.lastFix.t) {
      if (now >= st.lastFix.t - 60000) return;
      st.lastFix = null;
      st.prevSp = null;
      st.anchor = null;
      st.pin = null;
      st.pinStill = false;
      if (st.cal.stride) { st.cal.dop = st.cal.stride.dop; st.cal.stride = null; }
    }

    /* g.accuracy is the GPS error radius in metres. Fixes worse than the
       configured ceiling are used for presence (online) but not for math. */
    const accMax = clamp(num(cfg.gpsAccuracyMax, 60), 0, 500);
    const accOk = !(accMax > 0 && typeof g.accuracy === 'number' && g.accuracy > accMax);

    let derived = null;
    let dtFix = 1;
    if (st.lastFix) {
      const d = haversine(st.lastFix.lat, st.lastFix.lon, g.latitude, g.longitude);
      const dt = (now - st.lastFix.t) / 1000;
      /* dt <= 30: after a longer outage the two fixes no longer describe
         one continuous movement, so derive nothing from the pair. */
      if (dt > 0 && dt <= 30) {
        dtFix = dt;
        /* Derived speed is the FALLBACK when the device sends no Doppler
           speed — distance itself is accumulated in addDistance.
           Noise gate: a hop shorter than the fix's own error radius is
           indistinguishable from jitter around a standstill. Without this
           gate an 8 m wobble over 1 s reads as 29 km/h on a phone lying
           on a table. Read it as 0, not as a phantom speed. */
        const noise = Math.max(typeof g.accuracy === 'number' ? g.accuracy : 10, 3);
        if (accOk && d <= 150) derived = d >= noise ? d / dt : 0;
        else if (d < 3) derived = 0;
        const counted = addDistance(g, dt, accOk);
        calibrate(g, accOk, counted);
      }
    }
    st.lastFix = { lat: g.latitude, lon: g.longitude, t: now };

    const reported = (typeof g.speed === 'number' && Number.isFinite(g.speed) && g.speed >= 0) ? g.speed : null;
    const sp = reported !== null ? reported : (derived === null ? st.speed : derived);
    /* Exponential smoothing with a TIME CONSTANT, not a per-fix blend.
       Classic EMA (speed += (new - old) * alpha) smooths per SAMPLE: at
       1 fix/s it lags ~1 s, but if fixes arrive every 5 s the same alpha
       suddenly smooths 5x harder in wall-clock terms. The fix: the slider
       chooses tau (0..2.5 s), and alpha is recomputed each fix from the
       actual gap: alpha = 1 - e^(-dt/tau). This is the exact solution of
       "decay toward the new value with time constant tau" — same lag no
       matter how irregular the fix rate. tau = 0 means no smoothing. */
    const tau = clamp(num(cfg.speedSmoothing, 40), 0, 100) / 100 * 2.5;
    const alpha = tau > 0 ? 1 - Math.exp(-clamp(dtFix, 0.05, 10) / tau) : 1;
    st.speed += ((st.pinStill ? 0 : sp) - st.speed) * alpha;
    /* Snap tiny residuals to 0 so the display reads a clean standstill
       instead of hovering at 0.4 km/h forever (EMA never fully reaches 0). */
    if (st.speed < 0.35) st.speed = 0;

    maybeRender();
    maybeGeocode(g);
    maybeWeather(g);
  }

  function maybeGeocode(g) {
    if (!bool(cfg.showLocation, true) || st.placeBusy) return;
    const now = Date.now();
    const iv = clamp(num(cfg.locationRefreshSec, 60), 15, 3600) * 1000;
    const minMove = clamp(num(cfg.locationMinMoveM, 250), 0, 20000);
    if (st.placeAt) {
      if (now - st.placeAt < iv) return;
      const moved = st.placePos ? haversine(st.placePos.lat, st.placePos.lon, g.latitude, g.longitude) : Infinity;
      if (moved < minMove) return;
    }
    st.placeBusy = true;
    st.placeAt = now;
    st.placePos = { lat: g.latitude, lon: g.longitude };

    const url = 'https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=12' +
      '&lat=' + g.latitude.toFixed(5) + '&lon=' + g.longitude.toFixed(5) +
      '&accept-language=' + encodeURIComponent((navigator.language || 'en').slice(0, 5));

    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        const a = (j && j.address) || {};
        const city = a.city || a.town || a.village || a.municipality || a.suburb || a.county || a.state_district || '';
        const region = a.state || a.region || '';
        const country = a.country || '';
        const fmt = txt(cfg.locationFormat, 'cityRegion');
        let parts = [city];
        if (fmt === 'cityRegion') parts = [city, region];
        else if (fmt === 'cityCountry') parts = [city, country];
        else if (fmt === 'cityRegionCountry') parts = [city, region, country];
        const name = parts.filter(Boolean).join(', ');
        if (name) renderPlace(name);
      })
      .catch((err) => console.warn('[irl-bar] reverse geocode failed', err && err.message))
      .finally(() => { st.placeBusy = false; });
  }

  function maybeWeather(g) {
    if (!bool(cfg.showWeather, true) || st.weatherBusy) return;
    const now = Date.now();
    const iv = clamp(num(cfg.weatherRefreshMin, 10), 1, 180) * 60000;
    const moved = st.weatherPos ? haversine(st.weatherPos.lat, st.weatherPos.lon, g.latitude, g.longitude) : Infinity;
    if (st.weatherAt && now - st.weatherAt < iv && moved < 10000) return;

    st.weatherBusy = true;
    st.weatherAt = now;
    st.weatherPos = { lat: g.latitude, lon: g.longitude };

    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + g.latitude.toFixed(4) +
      '&longitude=' + g.longitude.toFixed(4) +
      '&current=temperature_2m,weather_code' +
      (metric ? '' : '&temperature_unit=fahrenheit');

    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        const c = j && j.current;
        if (!c || typeof c.temperature_2m !== 'number') return;
        renderWeather(c.temperature_2m, c.weather_code);
      })
      .catch((err) => console.warn('[irl-bar] weather failed', err && err.message))
      .finally(() => { st.weatherBusy = false; });
  }

  /* ---------- persistence ---------- */
  function hasState() {
    return !!(window.StreamWizard && StreamWizard.state);
  }
  async function loadState() {
    if (!hasState()) return;
    try {
      const saved = await StreamWizard.state.get();
      /* The calibration factor is a property of the DEVICE, not the walk —
         restore it even when the distance itself resets, so a fresh stream
         starts already corrected instead of re-learning for minutes. */
      if (saved && Number.isFinite(saved.calFactor)) {
        st.cal.factor = clamp(saved.calFactor, 0.9, 1.25);
        st.cal.savedFactor = st.cal.factor;
      }
      if (txt(cfg.distanceReset, 'stream') !== 'load' &&
          saved && Number.isFinite(saved.totalMeters)) {
        st.total = saved.totalMeters;
      }
    } catch (err) {
      console.info('[irl-bar] no saved distance (editor preview?)');
    }
  }
  function startAutoSave() {
    setInterval(() => {
      /* Demo motion is synthetic travel; persisting it banks phantom km that
         a later real stream starts from. */
      if (bool(cfg.demoMode, false)) return;
      if (!st.dirty || !hasState()) return;
      st.dirty = false;
      /* The factor is only banked once THIS session has proven it (three
         agreeing windows — see calibrate). Until then keep persisting the
         previously trusted value, or a neutral 1: a factor half-learned
         from one noisy window must not become every future stream's
         starting point. */
      const factorToSave = st.cal.trusted
        ? st.cal.factor
        : (st.cal.savedFactor !== null ? st.cal.savedFactor : 1);
      Promise.resolve()
        .then(() => StreamWizard.state.set({
          totalMeters: Math.round(st.total),
          calFactor: Math.round(factorToSave * 1000) / 1000,
          savedAt: Date.now()
        }))
        .catch(() => {});
    }, 10000);
  }
  function resetDistance() {
    /* Distance resets; the learned calibration factor survives on purpose. */
    st.total = 0;
    st.dirty = true;
    renderDistance();
    console.info('[irl-bar] distance reset');
  }

  /* ---------- demo motion (editor preview only) ---------- */
  function startDemo() {
    let lat = 52.3676, lon = 4.9041, hdg = 45;
    console.info('[irl-bar] demo motion on — turn "Preview demo motion" off before going live');
    setInterval(() => {
      const spd = 9 + Math.sin(Date.now() / 9000) * 6;
      hdg = (hdg + (Math.random() - 0.5) * 8 + 360) % 360;
      const br = hdg * Math.PI / 180;
      lat += (spd * Math.cos(br)) / EARTH * 180 / Math.PI;
      lon += (spd * Math.sin(br)) / (EARTH * Math.cos(lat * Math.PI / 180)) * 180 / Math.PI;
      handleGeo({
        latitude: lat, longitude: lon, altitude: 6, speed: spd,
        heading: hdg, accuracy: 8, timestamp: Date.now()
      });
    }, 1000);
  }

  /* ---------- init ---------- */
  async function init(fieldData) {
    if (inited) return;
    inited = true;
    cfg = fieldData || {};

    applyConfig();
    await loadState();
    renderSpeed();
    renderDistance();
    stampRender();
    startAutoSave();

    if (bool(cfg.entranceAnim, true)) {
      gsap.from($('bar'), { yPercent: 130, opacity: 0, duration: 0.8, ease: 'power3.out' });
    }

    const offlineAfter = clamp(num(cfg.offlineAfterSec, 20), 0, 600);
    setInterval(() => {
      if (offlineAfter > 0 && st.online && Date.now() - st.geoAt > offlineAfter * 1000) setOnline(false);
    }, 1000);

    if (bool(cfg.demoMode, false)) startDemo();
    console.info('[irl-bar] ready');
  }

  addEventListener('onWidgetLoad', (e) => {
    init((e && e.detail && e.detail.fieldData) || {});
  });

  addEventListener('onEventReceived', (e) => {
    const d = e.detail || {};
    if (d.listener === 'streamwizard.geo') handleGeo(d.event);
    else if (d.listener === 'stream.online' && txt(cfg.distanceReset, 'stream') === 'stream') resetDistance();
  });

  /* safety net if onWidgetLoad never lands (defaults are baked into every getter) */
  setTimeout(() => init({}), 2000);
})();
$widgetjs$,
      updated_at = now()
  WHERE slug = 'walking-stats';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'walking-stats template row missing -- run 20260804030000 first';
  END IF;

  -- User snapshot copies on any known previous version of this JS.
  --   3867b6b3... = original template (20260804030000)
  --   1f47f3c0... = distance fixes    (20260805100000)
  --   9c699d7f... = pin scope fix     (20260805120000)
  UPDATE public.overlay_widgets
  SET js = (SELECT js FROM public.overlay_widget_templates WHERE slug = 'walking-stats'),
      updated_at = now()
  WHERE md5(js) IN (
    '3867b6b33e94da0d2b4b3d86d01c997d',
    '1f47f3c05d29153296a25c00e10a3acd',
    '9c699d7f050c4db8775d0d8b86315426'
  );

  GET DIAGNOSTICS snapshot_count = ROW_COUNT;
  RAISE NOTICE 'walking-stats: updated % user snapshot(s)', snapshot_count;
END $$;
