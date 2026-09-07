/**
 * Starter source for a brand-new custom widget: a commented HTML skeleton and
 * a JS file that shows how to subscribe to overlay events. Kept out of the
 * modal component so the two are edited for different reasons.
 */

export const DEFAULT_WIDGET_HTML = `<!--
  StreamWizard Widget — HTML
  ─────────────────────────────────────────────────────────────
  Styling  → Tailwind CSS classes work everywhere (e.g. text-white, flex, rounded-xl)
  Animation → gsap and TextPlugin are available in the JS tab
  Fields   → add custom fields in the Fields tab, then reference them
             in the JS tab via fieldData.yourFieldName
  ─────────────────────────────────────────────────────────────
-->

<!-- Wrapper — targeted by gsap.from('#widget', ...) in the JS tab -->
<div id="widget" class="flex flex-col items-center justify-center w-full h-full gap-2 p-6 opacity-0">

  <!-- Event label, e.g. "New Follower!" -->
  <p id="label" class="text-white/60 text-sm font-medium uppercase tracking-widest">
    New Follower!
  </p>

  <!-- Username populated by JS: usernameEl.textContent = event.name -->
  <p id="username" class="text-white text-4xl font-bold drop-shadow-lg">
    StreamWizard
  </p>

  <!-- Supporting message, e.g. "just followed!" or "cheered 100 bits!" -->
  <p id="message" class="text-white/70 text-xl">
    just followed!
  </p>

</div>`;

export const DEFAULT_WIDGET_JS = `/*
 * StreamWizard Widget — JavaScript
 *
 * Available globals:
 *   gsap               — GSAP animation library
 *   TextPlugin         — GSAP text animation (gsap.registerPlugin(TextPlugin))
 *   fieldData          — values from your Fields tab
 *   StreamWizard.state — persist data between streams (get/set); only works
 *                        on a live overlay, not in the editor preview
 *
 * Events arrive as Twitch EventSub payloads. The listener name is the
 * EventSub type: 'channel.follow', 'channel.subscribe', 'channel.cheer',
 * 'channel.raid', 'channel.chat.message', and so on. Autocomplete knows
 * every payload — type e.detail. and let the editor guide you.
 */

// ─── Widget load ────────────────────────────────────────────────────────────
// Fires once when the widget is mounted. Use this to set initial state
// and run your intro animation.
//
window.addEventListener('onWidgetLoad', function(obj) {
  const fieldData = obj.detail.fieldData;

  // Access your custom fields:
  // document.getElementById('username').style.color = fieldData.primaryColor;

  // Intro animation — fade + slide up (widget starts at opacity-0 in HTML)
  gsap.to('#widget', {
    opacity: 1,
    y: 0,
    duration: 0.5,
    ease: 'power2.out'
  });
});


// ─── Stream events ──────────────────────────────────────────────────────────
// Fires on every stream event. Use a timeline to sequence
// your animate-in, hold, and animate-out.
//
window.addEventListener('onEventReceived', function(obj) {
  const listener = obj.detail.listener;
  const event = obj.detail.event;

  if (listener === 'channel.follow') {
    showAlert(event.user_name, 'just followed!', 'New Follower!');
  }

  if (listener === 'channel.subscribe') {
    showAlert(event.user_name, event.is_gift ? 'got a gifted sub!' : 'just subscribed!', 'New Subscriber!');
  }

  if (listener === 'channel.cheer') {
    const name = event.is_anonymous ? 'Anonymous' : event.user_name;
    showAlert(name, \`cheered \${event.bits} bits!\`, 'Cheer!');
  }

  if (listener === 'channel.raid') {
    showAlert(event.from_broadcaster_user_name, \`raided with \${event.viewers} viewers!\`, 'Incoming Raid!');
  }
});


// ─── Helper: show alert with GSAP timeline ──────────────────────────────────
// Animate in → hold → animate out.
//
function showAlert(username, message, label = 'Alert') {
  const labelEl    = document.getElementById('label');
  const usernameEl = document.getElementById('username');
  const messageEl  = document.getElementById('message');
  if (labelEl)    labelEl.textContent    = label;
  if (usernameEl) usernameEl.textContent = username;
  if (messageEl)  messageEl.textContent  = message;

  const tl = gsap.timeline();

  // Animate in
  tl.fromTo('#widget',
    { opacity: 0, scale: 0.9, y: 10 },
    { opacity: 1, scale: 1,   y: 0,  duration: 0.4, ease: 'back.out(1.5)' }
  );

  // Hold
  tl.to('#widget', { duration: 3 });

  // Animate out
  tl.to('#widget',
    { opacity: 0, scale: 0.9, y: -10, duration: 0.3, ease: 'power2.in' }
  );
}`;
