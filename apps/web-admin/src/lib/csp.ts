// Built per-request in src/proxy.ts so script-src can carry a fresh nonce —
// Next.js reads the nonce from the request's Content-Security-Policy header
// and stamps it on its inline (hydration/RSC) scripts, which is what lets us
// drop 'unsafe-inline' from script-src.
export function buildCsp(nonce: string): string {
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  // Supabase realtime uses WebSocket — derive wss:// from the https:// URL
  const supabaseWs = supabaseUrl.replace(/^https:\/\//, "wss://");
  const wsServerUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? process.env.WS_SERVER_URL ?? "";

  const directives: string[] = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    // Next.js inlines critical styles
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    // Emote CDNs + asset CDN are for the widget-moderation preview iframes:
    // srcdoc iframes inherit this policy, and widgets render Twitch/7TV/BTTV/FFZ
    // emotes and media-library images.
    [
      "img-src 'self' data: https://static-cdn.jtvnw.net",
      "https://cdn.7tv.app https://cdn.betterttv.net https://cdn.frankerfacez.com",
      process.env.NEXT_PUBLIC_CDN_URL,
      process.env.NEXT_PUBLIC_ASSET_CDN_URL,
    ]
      .filter(Boolean)
      .join(" "),
    ["media-src 'self'", process.env.NEXT_PUBLIC_CDN_URL, process.env.NEXT_PUBLIC_ASSET_CDN_URL]
      .filter(Boolean)
      .join(" "),
    // Sentry is tunneled through /monitoring so 'self' covers it; the ws
    // topology/live pages open a WebSocket straight to ws-server.
    [
      "connect-src 'self'",
      supabaseUrl,
      supabaseWs,
      wsServerUrl,
      // Cloud OBS / ingest nodes are provisioned dynamically as
      // *.streamwizard.org subdomains: the node/instance pages fetch
      // obs-instance-manager REST (start/stop/remove, ws-tickets) and open
      // WebSockets (metrics stream, noVNC, obsws) straight from the browser.
      // Single-label names only — Cloudflare Universal SSL covers one level.
      "wss://*.streamwizard.org",
      "https://*.streamwizard.org",
      // Widget-moderation previews render in srcdoc iframes, which inherit
      // this policy: widgets fetch overlay state plus the weather and
      // geocoding APIs (see buildWidgetSrcdoc in @repo/ui).
      process.env.NEXT_PUBLIC_OVERLAY_URL,
      "https://api.open-meteo.com",
      "https://nominatim.openstreetmap.org",
      process.env.NEXT_PUBLIC_ASSET_CDN_URL,
    ]
      .filter(Boolean)
      .join(" "),
    // Sentry's replay integration builds its compression worker from a blob
    // URL, and without worker-src the browser falls back to script-src and
    // blocks it. blob: only permits workers from blobs the page itself made,
    // and the script inside one still has to come from 'self'.
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Internal tool — nothing should ever embed it.
    "frame-ancestors 'none'",
  ];

  // Local dev sends this policy as report-only (see src/proxy.ts), so plain
  // http/ws targets like local Supabase and ws-server still work there.
  directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}
