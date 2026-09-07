-- Third overlay template: Walking stats, the GPS module bar.
--
-- Captured from staging overlay 18445516-dff6-47cf-92db-5a53038e279a
-- ("Walking Stats"): one full-canvas custom widget driven by the phone's GPS.
--
-- This one IS render_mode 'gps', unlike auto-switcher-monitor. The widget
-- listens to streamwizard.geo and reads latitude, longitude, speed, heading
-- and altitude, so it needs GpsOverlayCanvas to start geolocation and publish
-- fixes. It is the first gps template, which is what the render-mode filter in
-- the create dialog was built for.
--
-- Written to be re-runnable: this content was also inserted straight into
-- staging, so the migration must be a no-op when it meets rows that are
-- already there rather than duplicating them.

-- 1. The widget source, as a widget template.
INSERT INTO public.overlay_widget_templates
  (slug, name, description, tags, html, js, extra_css, fields, sort_order)
VALUES (
  'walking-stats',
  'Walking Stats',
  'Speed, distance, location and weather along the bottom of your IRL stream, read straight from your phone''s GPS. Each module can be turned off on its own.',
  ARRAY['irl', 'gps']::text[],
  '<div id="root">
  <div id="wrap">
    <div id="bar">

      <div class="sw-mod" id="mod-speed">
        <span class="sw-label" id="speedLabel">SPEED</span>
        <span class="sw-value"><span id="speedValue">--</span><span class="sw-unit" id="speedUnit">km/h</span></span>
      </div>

      <div class="sw-mod" id="mod-distance">
        <span class="sw-label" id="distanceLabel">DISTANCE</span>
        <span class="sw-value"><span id="distanceValue">--</span><span class="sw-unit" id="distanceUnit">km</span></span>
      </div>

      <div class="sw-mod" id="mod-location">
        <span class="sw-label" id="locationLabel">LOCATION</span>
        <span class="sw-value" id="locationValue">--</span>
      </div>

      <div class="sw-mod" id="mod-weather">
        <span class="sw-label" id="weatherLabel">WEATHER</span>
        <span class="sw-value"><span id="weatherTemp">--</span><span class="sw-unit" id="weatherDesc"></span></span>
      </div>

    </div>
  </div>
</div>',
  '/* IRL bottom bar — speed / distance / location / weather */
(() => {
  ''use strict'';

  /* ---------- helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
  const bool = (v, d) => (typeof v === ''boolean'' ? v : v === ''true'' ? true : v === ''false'' ? false : d);
  const txt = (v, d) => (typeof v === ''string'' && v.trim() !== '''' ? v.trim() : d);

  function hexToRgba(hex, a) {
    const h = String(hex || '''').replace(''#'', '''');
    const full = h.length === 3 ? h.split('''').map((c) => c + c).join('''') : h;
    const n = parseInt(full, 16);
    if (full.length !== 6 || !Number.isFinite(n)) return ''rgba(0,0,0,'' + a + '')'';
    return ''rgba('' + ((n >> 16) & 255) + '','' + ((n >> 8) & 255) + '','' + (n & 255) + '','' + a + '')'';
  }

  /* Great-circle distance between two lat/lon points, in metres.
     You can''t just Pythagoras lat/lon differences: a degree of longitude
     shrinks as you move away from the equator, and the Earth is a sphere.
     Haversine converts both points to radians and computes the arc length
     over a sphere of Earth''s mean radius. Accurate to well under 0.5% for
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
    0: ''Clear'', 1: ''Mainly clear'', 2: ''Partly cloudy'', 3: ''Overcast'',
    45: ''Fog'', 48: ''Rime fog'',
    51: ''Light drizzle'', 53: ''Drizzle'', 55: ''Heavy drizzle'',
    56: ''Freezing drizzle'', 57: ''Freezing drizzle'',
    61: ''Light rain'', 63: ''Rain'', 65: ''Heavy rain'',
    66: ''Freezing rain'', 67: ''Freezing rain'',
    71: ''Light snow'', 73: ''Snow'', 75: ''Heavy snow'', 77: ''Snow grains'',
    80: ''Showers'', 81: ''Showers'', 82: ''Heavy showers'',
    85: ''Snow showers'', 86: ''Snow showers'',
    95: ''Thunderstorm'', 96: ''Thunderstorm'', 99: ''Thunderstorm''
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
    /* Self-calibration (see the essay above calibrate()):
       factor — multiplier applied to every Doppler increment
       dop    — raw (unscaled) Doppler metres in the current window
       pos    — position-path metres in the current window
       stride — last position sample point for the 5s strides */
    cal: { factor: 1, dop: 0, pos: 0, stride: null },
    geoAt: 0, online: null,
    place: '''', placeAt: 0, placePos: null, placeBusy: false,
    weatherAt: 0, weatherPos: null, weatherBusy: false
  };

  /* Each module owns its own text styling, read from fields prefixed with the
     module key (speedLabelColor, weatherValueFontSize, ...). Only the bar
     itself — background, size, spacing, typeface — is still global. */
  const MODULES = [
    { key: ''speed'', show: ''showSpeed'', label: ''SPEED'' },
    { key: ''distance'', show: ''showDistance'', label: ''DISTANCE'' },
    { key: ''location'', show: ''showLocation'', label: ''LOCATION'' },
    { key: ''weather'', show: ''showWeather'', label: ''WEATHER'' }
  ];

  function applyModuleStyle(m) {
    const el = $(''mod-'' + m.key);
    if (!el) return;
    const s = el.style;

    s.setProperty(''--m-text'', txt(cfg[m.key + ''TextColor''], ''#ffffff''));
    s.setProperty(''--m-label'', txt(cfg[m.key + ''LabelColor''], ''#b9b9c6''));
    s.setProperty(''--m-value'', clamp(num(cfg[m.key + ''ValueFontSize''], 24), 8, 120) + ''px'');
    s.setProperty(''--m-labelsize'', clamp(num(cfg[m.key + ''LabelFontSize''], 12), 6, 60) + ''px'');
    s.setProperty(''--m-labelgap'', clamp(num(cfg[m.key + ''LabelGap''], 8), 0, 60) + ''px'');
    s.setProperty(''--m-shadow'',
      bool(cfg[m.key + ''TextShadow''], true) ? ''0 2px 6px rgba(0,0,0,.7)'' : ''none'');

    el.classList.toggle(''sw-inline'', txt(cfg[m.key + ''LabelPosition''], ''above'') === ''left'');

    const labelEl = $(m.key + ''Label'');
    if (labelEl) {
      labelEl.textContent = txt(cfg[m.key + ''LabelText''], m.label);
      labelEl.classList.toggle(''sw-hidden'', !bool(cfg[m.key + ''ShowLabel''], true));
    }
  }

  /* ---------- config -> DOM ---------- */
  function applyConfig() {
    metric = txt(cfg.units, ''metric'') !== ''imperial'';

    const r = document.documentElement.style;
    const opacity = clamp(num(cfg.barOpacity, 45), 0, 100) / 100;

    r.setProperty(''--sw-bg'', hexToRgba(txt(cfg.barBgColor, ''#000000''), opacity));
    r.setProperty(''--sw-h'', clamp(num(cfg.barHeight, 64), 24, 400) + ''px'');
    r.setProperty(''--sw-w'', clamp(num(cfg.barWidth, 100), 10, 100) + ''%'');
    r.setProperty(''--sw-bottom'', clamp(num(cfg.barBottomOffset, 0), 0, 600) + ''px'');
    r.setProperty(''--sw-radius'', clamp(num(cfg.barRadius, 0), 0, 200) + ''px'');
    r.setProperty(''--sw-padx'', clamp(num(cfg.barPaddingX, 26), 0, 200) + ''px'');
    r.setProperty(''--sw-gap'', clamp(num(cfg.moduleGap, 34), 0, 200) + ''px'');

    const family = txt(cfg.fontFamily, ''Inter'');
    r.setProperty(''--sw-font'', ''"'' + family + ''", system-ui, -apple-system, "Segoe UI", sans-serif'');
    const link = document.createElement(''link'');
    link.rel = ''stylesheet'';
    link.href = ''https://fonts.googleapis.com/css2?family='' +
      encodeURIComponent(family).replace(/%20/g, ''+'') + '':wght@400;600;700&display=swap'';
    document.head.appendChild(link);

    const bar = $(''bar'');
    bar.classList.toggle(''sw-spread'', txt(cfg.moduleAlign, ''left'') === ''spread'');
    bar.classList.toggle(''sw-center'', txt(cfg.moduleAlign, ''left'') === ''center'');
    bar.classList.toggle(''sw-right'', txt(cfg.moduleAlign, ''left'') === ''right'');

    $(''speedUnit'').textContent = metric ? ''km/h'' : ''mph'';
    $(''distanceUnit'').textContent = metric ? ''km'' : ''mi'';

    if (!bool(cfg.showWeatherText, true)) $(''weatherDesc'').classList.add(''sw-hidden'');

    MODULES.forEach((m) => {
      const el = $(''mod-'' + m.key);
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
    const mode = txt(cfg.updateMode, ''fix'');
    if (st.renderAt) {
      if (mode === ''time'') {
        const iv = clamp(num(cfg.updateEverySec, 5), 1, 60) * 1000;
        if (Date.now() - st.renderAt < iv) return;
      } else if (mode === ''distance'') {
        const step = clamp(num(cfg.updateEveryM, 5), 1, 500);
        if (st.total - st.renderTotal < step) return;
      }
    }
    renderSpeed();
    renderDistance();
    stampRender();
  }

  function renderSpeed() {
    const el = $(''speedValue'');
    if (!el) return;
    const dec = clamp(num(cfg.speedDecimals, 0), 0, 2);
    /* st.speed is kept in m/s (the GPS native unit); convert only here,
       at display time. 3.6 = km/h per m/s, 2.236936 = mph per m/s. */
    const v = metric ? st.speed * 3.6 : st.speed * 2.236936;
    el.textContent = v.toFixed(dec);
  }

  function renderDistance() {
    const el = $(''distanceValue'');
    if (!el) return;
    const dec = clamp(num(cfg.distanceDecimals, 2), 0, 3);
    const unitEl = $(''distanceUnit'');
    if (metric) {
      if (st.total < 1000) { el.textContent = String(Math.round(st.total)); unitEl.textContent = ''m''; }
      else { el.textContent = (st.total / 1000).toFixed(dec); unitEl.textContent = ''km''; }
    } else {
      const mi = st.total / 1609.344;
      if (mi < 0.1) { el.textContent = String(Math.round(st.total * 3.28084)); unitEl.textContent = ''ft''; }
      else { el.textContent = mi.toFixed(dec); unitEl.textContent = ''mi''; }
    }
  }

  function pop(el) {
    if (!el || !bool(cfg.updateAnim, true)) return;
    gsap.fromTo(el, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: ''power2.out'' });
  }

  function renderPlace(name) {
    const el = $(''locationValue'');
    if (!el || !name || name === st.place) return;
    st.place = name;
    el.textContent = name;
    pop(el);
  }

  function renderWeather(temp, code) {
    const t = $(''weatherTemp''), d = $(''weatherDesc'');
    if (!t) return;
    t.textContent = Math.round(temp) + ''°'' + (metric ? ''C'' : ''F'');
    if (d) d.textContent = WMO[code] || '''';
    pop(t.parentElement);
  }

  /* ---------- online / offline ---------- */
  function setOnline(on) {
    if (st.online === on) return;
    st.online = on;
    const mode = txt(cfg.offlineBehavior, ''dim'');
    if (mode === ''keep'') return;
    const target = mode === ''hide'' ? $(''wrap'') : $(''bar'');
    gsap.to(target, {
      opacity: on ? 1 : (mode === ''hide'' ? 0 : 0.35),
      y: mode === ''hide'' && !on ? 24 : 0,
      duration: 0.5, ease: ''power2.out''
    });
  }

  /* ---------- distance ---------- */
  /* WHY TWO STRATEGIES?
     A GPS fix gives you two independent ways to measure travel:

     (a) g.speed — Doppler speed. The receiver measures the frequency shift
         of each satellite''s carrier wave; that gives velocity directly,
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
  function addDistance(g, dt, accOk) {
    const sp = (typeof g.speed === ''number'' && Number.isFinite(g.speed) && g.speed >= 0) ? g.speed : null;

    if (sp !== null) {
      /* Hysteresis: two thresholds instead of one. Start counting at
         0.5 m/s, but once moving keep counting down to 0.3 m/s. With a
         single cutoff, a slow walk whose readings straddle it (0.45, 0.55,
         0.48...) gets chopped into dropped segments — each dip under the
         line throws that second of travel away. Two thresholds mean a
         reading has to fall clearly before we stop counting. Same idea a
         thermostat uses to avoid rapid on/off flapping. */
      if (st.moving ? sp >= 0.3 : sp >= 0.5) {
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
      } else {
        st.moving = false;
      }
      st.prevSp = sp;
      st.anchor = null;
      return;
    }

    /* -------- fallback: no Doppler speed on this device -------- */
    st.prevSp = null;
    st.moving = false;
    if (!accOk) return;
    const acc = (typeof g.accuracy === ''number'') ? g.accuracy : 10;
    if (!st.anchor) { st.anchor = { lat: g.latitude, lon: g.longitude, acc: acc }; return; }

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
  }

  /* ---------- self-calibration ---------- */
  /* Runs two odometers side by side and steers a correction factor toward
     the midpoint between them.

     While moving with a good fix, a position sample is taken every >= 5 s
     ("stride"). Summed stride hops follow the real path but carry far less
     jitter than 1 s hops (jitter is a constant few metres per hop; a 5 s
     stride packs ~7 m of real travel behind it instead of ~1.3 m).

     Every 30 raw Doppler metres, compare the two windows:
       ratio  = position-path metres / Doppler metres   (typically ~1.1)
       target = (1 + ratio) / 2  — the MIDPOINT, because Doppler reads low
                and position paths read high; truth sits between them.
     The factor eases toward the target a quarter-step at a time and is
     clamped to [0.9, 1.15], so one garbage window (GPS glitch, tunnel)
     cannot yank the display. Windows with a nonsense ratio are discarded.

     On the reference walk this converges to ~1.08 within a few minutes:
     raw Doppler said 1278 m, the true route was ~1400 m, corrected ~1385 m. */
  function calibrate(g, accOk) {
    const c = st.cal;
    const movingNow = typeof g.speed === ''number'' && Number.isFinite(g.speed) && g.speed >= 0.5;
    if (!accOk || !movingNow) { c.stride = null; return; }

    const t = Number(g.timestamp) || Date.now();
    if (!c.stride) { c.stride = { lat: g.latitude, lon: g.longitude, t: t }; return; }

    const dtS = (t - c.stride.t) / 1000;
    if (dtS < 5) return;
    if (dtS > 30) { c.stride = { lat: g.latitude, lon: g.longitude, t: t }; return; }

    const hop = haversine(c.stride.lat, c.stride.lon, g.latitude, g.longitude);
    if (hop <= 100) c.pos += hop;
    c.stride = { lat: g.latitude, lon: g.longitude, t: t };

    if (c.dop >= 30 && c.pos > 0) {
      const ratio = c.pos / c.dop;
      if (ratio > 0.7 && ratio < 1.6) {
        const target = clamp((1 + ratio) / 2, 0.9, 1.15);
        c.factor += (target - c.factor) * 0.25;
      }
      c.dop = 0;
      c.pos = 0;
    }
  }

  /* ---------- geo ---------- */
  function handleGeo(raw) {
    if (raw && raw.status === ''offline'') { setOnline(false); return; }
    const g = raw && raw.payload ? raw.payload : raw;
    if (!g || typeof g.latitude !== ''number'' || typeof g.longitude !== ''number'') return;

    const now = Number(g.timestamp) || Date.now();
    st.geoAt = Date.now();
    setOnline(true);

    /* g.accuracy is the GPS error radius in metres. Fixes worse than the
       configured ceiling are used for presence (online) but not for math. */
    const accMax = clamp(num(cfg.gpsAccuracyMax, 60), 0, 500);
    const accOk = !(accMax > 0 && typeof g.accuracy === ''number'' && g.accuracy > accMax);

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
           Noise gate: a hop shorter than the fix''s own error radius is
           indistinguishable from jitter around a standstill. Without this
           gate an 8 m wobble over 1 s reads as 29 km/h on a phone lying
           on a table. Read it as 0, not as a phantom speed. */
        const noise = Math.max(typeof g.accuracy === ''number'' ? g.accuracy : 10, 3);
        if (accOk && d <= 150) derived = d >= noise ? d / dt : 0;
        else if (d < 3) derived = 0;
        addDistance(g, dt, accOk);
        calibrate(g, accOk);
      }
    }
    st.lastFix = { lat: g.latitude, lon: g.longitude, t: now };

    const reported = (typeof g.speed === ''number'' && Number.isFinite(g.speed) && g.speed >= 0) ? g.speed : null;
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
    st.speed += (sp - st.speed) * alpha;
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

    const url = ''https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=12'' +
      ''&lat='' + g.latitude.toFixed(5) + ''&lon='' + g.longitude.toFixed(5) +
      ''&accept-language='' + encodeURIComponent((navigator.language || ''en'').slice(0, 5));

    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        const a = (j && j.address) || {};
        const city = a.city || a.town || a.village || a.municipality || a.suburb || a.county || a.state_district || '''';
        const region = a.state || a.region || '''';
        const country = a.country || '''';
        const fmt = txt(cfg.locationFormat, ''cityRegion'');
        let parts = [city];
        if (fmt === ''cityRegion'') parts = [city, region];
        else if (fmt === ''cityCountry'') parts = [city, country];
        else if (fmt === ''cityRegionCountry'') parts = [city, region, country];
        const name = parts.filter(Boolean).join('', '');
        if (name) renderPlace(name);
      })
      .catch((err) => console.warn(''[irl-bar] reverse geocode failed'', err && err.message))
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

    const url = ''https://api.open-meteo.com/v1/forecast?latitude='' + g.latitude.toFixed(4) +
      ''&longitude='' + g.longitude.toFixed(4) +
      ''&current=temperature_2m,weather_code'' +
      (metric ? '''' : ''&temperature_unit=fahrenheit'');

    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        const c = j && j.current;
        if (!c || typeof c.temperature_2m !== ''number'') return;
        renderWeather(c.temperature_2m, c.weather_code);
      })
      .catch((err) => console.warn(''[irl-bar] weather failed'', err && err.message))
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
        st.cal.factor = clamp(saved.calFactor, 0.9, 1.15);
      }
      if (txt(cfg.distanceReset, ''stream'') !== ''load'' &&
          saved && Number.isFinite(saved.totalMeters)) {
        st.total = saved.totalMeters;
      }
    } catch (err) {
      console.info(''[irl-bar] no saved distance (editor preview?)'');
    }
  }
  function startAutoSave() {
    setInterval(() => {
      if (!st.dirty || !hasState()) return;
      st.dirty = false;
      Promise.resolve()
        .then(() => StreamWizard.state.set({
          totalMeters: Math.round(st.total),
          calFactor: Math.round(st.cal.factor * 1000) / 1000,
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
    console.info(''[irl-bar] distance reset'');
  }

  /* ---------- demo motion (editor preview only) ---------- */
  function startDemo() {
    let lat = 52.3676, lon = 4.9041, hdg = 45;
    console.info(''[irl-bar] demo motion on — turn "Preview demo motion" off before going live'');
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
      gsap.from($(''bar''), { yPercent: 130, opacity: 0, duration: 0.8, ease: ''power3.out'' });
    }

    const offlineAfter = clamp(num(cfg.offlineAfterSec, 20), 0, 600);
    setInterval(() => {
      if (offlineAfter > 0 && st.online && Date.now() - st.geoAt > offlineAfter * 1000) setOnline(false);
    }, 1000);

    if (bool(cfg.demoMode, false)) startDemo();
    console.info(''[irl-bar] ready'');
  }

  addEventListener(''onWidgetLoad'', (e) => {
    init((e && e.detail && e.detail.fieldData) || {});
  });

  addEventListener(''onEventReceived'', (e) => {
    const d = e.detail || {};
    if (d.listener === ''streamwizard.geo'') handleGeo(d.event);
    else if (d.listener === ''stream.online'' && txt(cfg.distanceReset, ''stream'') === ''stream'') resetDistance();
  });

  /* safety net if onWidgetLoad never lands (defaults are baked into every getter) */
  setTimeout(() => init({}), 2000);
})();
',
  ':root{
  --sw-bg: rgba(0,0,0,.45);
  --sw-font: system-ui, sans-serif;
  --sw-h:64px;
  --sw-w:100%;
  --sw-bottom:0px;
  --sw-radius:0px;
  --sw-padx:26px;
  --sw-gap:34px;
}

#root{ position:absolute; inset:0; }

#wrap{
  position:absolute;
  left:50%;
  bottom:var(--sw-bottom);
  width:var(--sw-w);
  transform:translateX(-50%);
}

#bar{
  display:flex;
  align-items:center;
  justify-content:flex-start;
  gap:var(--sw-gap);
  height:var(--sw-h);
  padding:0 var(--sw-padx);
  background:var(--sw-bg);
  border-radius:var(--sw-radius);
  font-family:var(--sw-font);
  overflow:hidden;
}
#bar.sw-center{ justify-content:center; }
#bar.sw-right{ justify-content:flex-end; }
#bar.sw-spread{ justify-content:space-between; }

/* Text styling lives on the module, not the bar: every --m-* var below is
   overwritten per module by applyConfig() from that module''s own fields.
   The values here are the fallbacks if a field is missing. */
.sw-mod{
  --m-text:#ffffff;
  --m-label:#b9b9c6;
  --m-value:24px;
  --m-labelsize:12px;
  --m-labelgap:8px;
  --m-shadow:0 2px 6px rgba(0,0,0,.7);

  display:flex;
  flex-direction:column;
  justify-content:center;
  gap:var(--m-labelgap);
  min-width:0;
  color:var(--m-text);
  text-shadow:var(--m-shadow);
}

.sw-mod.sw-inline{
  flex-direction:row;
  align-items:baseline;
}

.sw-label{
  font-size:var(--m-labelsize);
  letter-spacing:.14em;
  text-transform:uppercase;
  color:var(--m-label);
  font-weight:600;
  line-height:1;
  white-space:nowrap;
  flex:0 0 auto;
}

.sw-value{
  font-size:var(--m-value);
  font-weight:700;
  line-height:1.05;
  white-space:nowrap;
  display:flex;
  align-items:baseline;
  min-width:0;
}

.sw-unit{ font-size:.6em; font-weight:600; opacity:.75; margin-left:.3em; }

#locationValue{ display:block; overflow:hidden; text-overflow:ellipsis; }
#mod-location{ min-width:0; flex:0 1 auto; }

.sw-hidden{ display:none !important; }
',
  '{"units": {"type": "dropdown", "label": "Unit system", "value": "metric", "options": [{"label": "Metric (km/h, km, °C)", "value": "metric"}, {"label": "Imperial (mph, mi, °F)", "value": "imperial"}]}, "barWidth": {"max": 100, "min": 20, "step": 1, "type": "slider", "label": "Bar width (%)", "value": 100}, "demoMode": {"type": "checkbox", "label": "Preview demo motion (turn off when live)", "value": false}, "barHeight": {"max": 200, "min": 30, "step": 1, "type": "slider", "label": "Bar height (px)", "value": 64}, "barRadius": {"max": 80, "min": 0, "step": 1, "type": "slider", "label": "Corner radius (px)", "value": 0}, "moduleGap": {"max": 160, "min": 4, "step": 1, "type": "slider", "label": "Gap between modules (px)", "value": 34}, "barBgColor": {"type": "colorpicker", "label": "Bar background colour", "value": "#000000"}, "barOpacity": {"max": 100, "min": 0, "step": 1, "type": "slider", "label": "Bar opacity (%)", "value": 45}, "fontFamily": {"type": "googleFont", "label": "Font", "value": "Inter"}, "updateAnim": {"type": "checkbox", "label": "Animate value updates", "value": true}, "updateMode": {"type": "dropdown", "label": "Update speed and distance", "value": "fix", "options": [{"label": "On every GPS fix", "value": "fix"}, {"label": "On a time step", "value": "time"}, {"label": "After a set distance", "value": "distance"}]}, "barPaddingX": {"max": 120, "min": 0, "step": 1, "type": "slider", "label": "Inner side padding (px)", "value": 26}, "moduleAlign": {"type": "dropdown", "label": "Module alignment", "value": "left", "options": [{"label": "Left", "value": "left"}, {"label": "Centre", "value": "center"}, {"label": "Right", "value": "right"}, {"label": "Spread across bar", "value": "spread"}]}, "entranceAnim": {"type": "checkbox", "label": "Slide bar in on start", "value": true}, "updateEveryM": {"max": 500, "min": 1, "step": 1, "type": "slider", "label": "Distance step (m) - used by \"After a set distance\"", "value": 5}, "gpsAccuracyMax": {"max": 200, "min": 0, "step": 5, "type": "slider", "label": "Ignore fixes worse than (m, 0 = off)", "value": 60}, "updateEverySec": {"max": 60, "min": 1, "step": 1, "type": "slider", "label": "Time step (s) - used by \"On a time step\"", "value": 5}, "barBottomOffset": {"max": 300, "min": 0, "step": 1, "type": "slider", "label": "Distance from bottom (px)", "value": 0}, "offlineAfterSec": {"max": 300, "min": 0, "step": 5, "type": "slider", "label": "Treat as offline after (s, 0 = off)", "value": 20}, "offlineBehavior": {"type": "dropdown", "label": "When GPS drops", "value": "dim", "options": [{"label": "Dim the bar", "value": "dim"}, {"label": "Hide the bar", "value": "hide"}, {"label": "Change nothing", "value": "keep"}]}, "speedModuleSettings": {"type": "group", "label": "Speed", "fields": {"showSpeed": {"type": "checkbox", "label": "Show speed", "value": true}, "speedDecimals": {"max": 2, "min": 0, "step": 1, "type": "slider", "label": "Speed decimals", "value": 0}, "speedLabelGap": {"max": 60, "min": 0, "step": 1, "type": "slider", "label": "Gap between label and value (px)", "value": 8}, "speedLabelText": {"type": "text", "label": "Speed label", "value": "SPEED"}, "speedShowLabel": {"type": "checkbox", "label": "Show label", "value": true}, "speedSmoothing": {"max": 95, "min": 0, "step": 5, "type": "slider", "label": "Speed smoothing", "value": 40}, "speedTextColor": {"type": "colorpicker", "label": "Value colour", "value": "#ffffff"}, "speedLabelColor": {"type": "colorpicker", "label": "Label colour", "value": "#b9b9c6"}, "speedTextShadow": {"type": "checkbox", "label": "Text shadow", "value": true}, "speedLabelFontSize": {"max": 60, "min": 6, "step": 1, "type": "slider", "label": "Label font size (px)", "value": 12}, "speedLabelPosition": {"type": "dropdown", "label": "Label position", "value": "above", "options": [{"label": "Above the value", "value": "above"}, {"label": "Left of the value", "value": "left"}]}, "speedValueFontSize": {"max": 120, "min": 8, "step": 1, "type": "slider", "label": "Value font size (px)", "value": 24}}}, "weatherModuleSettings": {"type": "group", "label": "Weather", "fields": {"showWeather": {"type": "checkbox", "label": "Show weather", "value": true}, "showWeatherText": {"type": "checkbox", "label": "Show weather description", "value": true}, "weatherLabelGap": {"max": 60, "min": 0, "step": 1, "type": "slider", "label": "Gap between label and value (px)", "value": 8}, "weatherLabelText": {"type": "text", "label": "Weather label", "value": "WEATHER"}, "weatherShowLabel": {"type": "checkbox", "label": "Show label", "value": true}, "weatherTextColor": {"type": "colorpicker", "label": "Value colour", "value": "#ffffff"}, "weatherLabelColor": {"type": "colorpicker", "label": "Label colour", "value": "#b9b9c6"}, "weatherRefreshMin": {"max": 60, "min": 1, "step": 1, "type": "slider", "label": "Weather refresh (minutes)", "value": 10}, "weatherTextShadow": {"type": "checkbox", "label": "Text shadow", "value": true}, "weatherLabelFontSize": {"max": 60, "min": 6, "step": 1, "type": "slider", "label": "Label font size (px)", "value": 12}, "weatherLabelPosition": {"type": "dropdown", "label": "Label position", "value": "above", "options": [{"label": "Above the value", "value": "above"}, {"label": "Left of the value", "value": "left"}]}, "weatherValueFontSize": {"max": 120, "min": 8, "step": 1, "type": "slider", "label": "Value font size (px)", "value": 24}}}, "distanceModuleSettings": {"type": "group", "label": "Distance", "fields": {"showDistance": {"type": "checkbox", "label": "Show distance", "value": true}, "distanceReset": {"type": "dropdown", "label": "Reset distance", "value": "stream", "options": [{"label": "Never (keep counting)", "value": "keep"}, {"label": "When stream goes live", "value": "stream"}, {"label": "Every time the widget loads", "value": "load"}]}, "distanceDecimals": {"max": 3, "min": 0, "step": 1, "type": "slider", "label": "Distance decimals", "value": 2}, "distanceLabelGap": {"max": 60, "min": 0, "step": 1, "type": "slider", "label": "Gap between label and value (px)", "value": 8}, "distanceLabelText": {"type": "text", "label": "Distance label", "value": "DISTANCE"}, "distanceShowLabel": {"type": "checkbox", "label": "Show label", "value": true}, "distanceTextColor": {"type": "colorpicker", "label": "Value colour", "value": "#ffffff"}, "distanceLabelColor": {"type": "colorpicker", "label": "Label colour", "value": "#b9b9c6"}, "distanceTextShadow": {"type": "checkbox", "label": "Text shadow", "value": true}, "distanceLabelFontSize": {"max": 60, "min": 6, "step": 1, "type": "slider", "label": "Label font size (px)", "value": 12}, "distanceLabelPosition": {"type": "dropdown", "label": "Label position", "value": "above", "options": [{"label": "Above the value", "value": "above"}, {"label": "Left of the value", "value": "left"}]}, "distanceValueFontSize": {"max": 120, "min": 8, "step": 1, "type": "slider", "label": "Value font size (px)", "value": 24}}}, "locationModuleSettings": {"type": "group", "label": "Location", "fields": {"showLocation": {"type": "checkbox", "label": "Show location", "value": true}, "locationFormat": {"type": "dropdown", "label": "Location format", "value": "cityRegion", "options": [{"label": "City", "value": "city"}, {"label": "City, region", "value": "cityRegion"}, {"label": "City, country", "value": "cityCountry"}, {"label": "City, region, country", "value": "cityRegionCountry"}]}, "locationLabelGap": {"max": 60, "min": 0, "step": 1, "type": "slider", "label": "Gap between label and value (px)", "value": 8}, "locationMinMoveM": {"max": 5000, "min": 0, "step": 50, "type": "slider", "label": "Location refresh after moving (m)", "value": 250}, "locationLabelText": {"type": "text", "label": "Location label", "value": "LOCATION"}, "locationShowLabel": {"type": "checkbox", "label": "Show label", "value": true}, "locationTextColor": {"type": "colorpicker", "label": "Value colour", "value": "#ffffff"}, "locationLabelColor": {"type": "colorpicker", "label": "Label colour", "value": "#b9b9c6"}, "locationRefreshSec": {"max": 600, "min": 15, "step": 5, "type": "slider", "label": "Location refresh (seconds)", "value": 60}, "locationTextShadow": {"type": "checkbox", "label": "Text shadow", "value": true}, "locationLabelFontSize": {"max": 60, "min": 6, "step": 1, "type": "slider", "label": "Label font size (px)", "value": 12}, "locationLabelPosition": {"type": "dropdown", "label": "Label position", "value": "above", "options": [{"label": "Above the value", "value": "above"}, {"label": "Left of the value", "value": "left"}]}, "locationValueFontSize": {"max": 120, "min": 8, "step": 1, "type": "slider", "label": "Value font size (px)", "value": 24}}}}'::jsonb,
  2
)
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  tags        = EXCLUDED.tags,
  html        = EXCLUDED.html,
  js          = EXCLUDED.js,
  extra_css   = EXCLUDED.extra_css,
  fields      = EXCLUDED.fields,
  sort_order  = EXCLUDED.sort_order;

-- 2. The overlay template that places it full-canvas.
INSERT INTO public.overlay_templates
  (slug, name, description, render_mode, width, height, sort_order)
VALUES (
  'walking-stats',
  'Walking stats',
  'Speed, distance, location and weather along the bottom, straight from your phone''s GPS. Open it on the phone you''re streaming from and walk.',
  'gps',
  1920,
  1080,
  6
)
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  render_mode = EXCLUDED.render_mode,
  width       = EXCLUDED.width,
  height      = EXCLUDED.height,
  sort_order  = EXCLUDED.sort_order;

-- Items have no natural key, so replace them wholesale rather than risk a
-- second copy of the same widget on the canvas.
DELETE FROM public.overlay_template_items
WHERE template_id = (SELECT id FROM public.overlay_templates WHERE slug = 'walking-stats');

INSERT INTO public.overlay_template_items
  (template_id, type, x, y, w, h, z_index, label, config, widget_template_id, sort_order)
VALUES (
  (SELECT id FROM public.overlay_templates WHERE slug = 'walking-stats'),
  'custom_widget',
  0, 0, 1920, 1080,
  1,
  'Walking stats',
  -- widget_id / instance_id stripped: instantiation writes the user's own.
  '{"field_values": {"moduleAlign": "spread", "updateEveryM": 10, "distanceReset": "load", "gpsAccuracyMax": 0, "distanceShowLabel": true}}'::jsonb,
  (SELECT id FROM public.overlay_widget_templates WHERE slug = 'walking-stats'),
  0
);
