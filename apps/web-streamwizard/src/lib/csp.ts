export type CspOptions = {
  // Monaco Editor (only the widget editor route loads it) needs 'unsafe-eval'
  // for its language services and spawns same-origin module workers. Monaco is
  // bundled from npm rather than fetched from a CDN, so no third-party origin is
  // involved. 'unsafe-eval' is the weakest directive in the policy, so we grant
  // it per-route instead of to every page. See src/proxy.ts.
  monaco?: boolean;
  // Staging sits behind Cloudflare Access. When the Access session cookie is
  // missing/expired, a same-origin fetch (e.g. the /deck manifest link) gets
  // redirected to Access's own login page on streamwizard.cloudflareaccess.com
  // instead of the resource. Without this, that redirect target isn't an
  // allowed source anywhere, so default-src blocks it outright and the user
  // never gets the chance to reauth. Production has no Access in front of it,
  // so this is staging-only. See src/proxy.ts.
  cloudflareAccess?: boolean;
};

/** Production R2 CDN. The landing page demo clips are served from here only. */
const LANDING_CDN_URL = "https://cdn.streamwizard.org";
/* Twitch serves signed clip downloads from CloudFront distributions it owns
 * and can rotate, so the host is matched by wildcard rather than pinned. */
const TWITCH_CLIP_CDN = "https://*.cloudfront.net";

// Built per-request in src/proxy.ts so script-src can carry a fresh nonce —
// Next.js reads the nonce from the request's Content-Security-Policy header
// and stamps it on its inline (hydration/RSC) scripts, which is what lets us
// drop 'unsafe-inline' from script-src.
export function buildCsp(nonce: string, options: CspOptions = {}): string {
  const { monaco = false, cloudflareAccess = false } = options;
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  // Supabase realtime uses WebSocket — derive wss:// from the https:// URL
  const supabaseWs = supabaseUrl.replace(/^https:\/\//, "wss://");
  const wsServerUrl = process.env.WS_SERVER_URL ?? "";

  const directives: string[] = [
    "default-src 'self'",
    // Inline scripts must carry the per-request nonce. player.twitch.tv is
    // needed for the Twitch embedded player script. Monaco's 'unsafe-eval' is
    // added only on the editor route (see monaco option).
    [
      "script-src 'self'",
      `'nonce-${nonce}'`,
      "https://player.twitch.tv",
      ...(monaco ? ["'unsafe-eval'"] : []),
    ].join(" "),
    // Next.js inlines critical styles; Google Fonts load external stylesheets.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Google Fonts actual font files
    "font-src 'self' https://fonts.gstatic.com",
    // Twitch CDN images + our own R2 CDN (e.g. error page gifs) + data URIs used
    // by the UI. The third-party emote CDNs are here for the widget editor
    // preview: widgets resolve 7TV/BTTV/FFZ emotes through /api/twitch and then
    // render them as <img>, and the preview iframe inherits this policy.
    [
      "img-src 'self' data: https://static-cdn.jtvnw.net https://vod-secure.twitch.tv https://clips-media-assets2.twitch.tv",
      "https://cdn.7tv.app https://cdn.betterttv.net https://cdn.frankerfacez.com",
      process.env.NEXT_PUBLIC_CDN_URL,
      process.env.NEXT_PUBLIC_ASSET_CDN_URL,
    ]
      .filter(Boolean)
      .join(" "),
    // R2 CDN for video assets (light mode transition WebM) + user-uploaded
    // media-library assets on their own R2 domain. The landing page demo clips
    // live on the production CDN in every environment.
    //
    // CloudFront is where Twitch's signed clip MP4s land: the overlays page's
    // clips rotator plays the landscape_download_url that /helix/clips/downloads
    // hands back (see lib/showcase-clip-videos), and that URL is on an opaque
    // per-distribution CloudFront host, not a twitch.tv one. Wildcarded because
    // the distribution is Twitch's to change and a pinned host would fail
    // silently — the rotator treats a blocked load as a dead clip and skips to
    // the next one, so nothing would surface but thumbnails.
    [
      "media-src 'self'",
      LANDING_CDN_URL,
      TWITCH_CLIP_CDN,
      process.env.NEXT_PUBLIC_CDN_URL,
      process.env.NEXT_PUBLIC_ASSET_CDN_URL,
    ]
      .filter(Boolean)
      .join(" "),
    // PostHog and Sentry are proxied through /ingest and /monitoring so 'self' covers them.
    [
      "connect-src 'self'",
      supabaseUrl,
      supabaseWs,
      wsServerUrl,
      // Cloud OBS nodes (noVNC viewer, obs-websocket controls, and the
      // obs-instance-manager metrics/REST endpoints) are provisioned
      // dynamically, so they're addressed as *.streamwizard.org subdomains
      // rather than fixed hosts. Single-label names only — Cloudflare
      // Universal SSL covers just one subdomain level.
      "wss://*.streamwizard.org",
      "https://*.streamwizard.org",
      // Custom-widget previews render in srcdoc iframes, which inherit this
      // policy: widgets fetch state from the overlay app and call the weather
      // and geocoding APIs (see buildWidgetSrcdoc in @repo/ui).
      process.env.NEXT_PUBLIC_OVERLAY_URL,
      "https://api.open-meteo.com",
      "https://nominatim.openstreetmap.org",
      // Media-library uploads PUT directly to presigned R2 URLs. The AWS SDK
      // signs these virtual-hosted-style (bucket name in the subdomain), so
      // the allowed host must carry the bucket, not just the account id.
      process.env.R2_ACCOUNT_ID && process.env.R2_ASSETS_BUCKET
        ? `https://${process.env.R2_ASSETS_BUCKET}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : "",
      process.env.NEXT_PUBLIC_ASSET_CDN_URL,
    ]
      .filter(Boolean)
      .join(" "),
    // Twitch embedded player and clips use iframes served from these origins
    "frame-src https://player.twitch.tv https://clips.twitch.tv",
    // Explicit manifest-src (rather than relying on the default-src fallback)
    // so we can carve out the Cloudflare Access reauth redirect on staging
    // without loosening default-src for everything else.
    [
      "manifest-src 'self'",
      ...(cloudflareAccess ? ["https://streamwizard.cloudflareaccess.com"] : []),
    ].join(" "),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Modern replacement for the X-Frame-Options: DENY set in next.config.ts;
    // both are kept so older browsers stay covered.
    "frame-ancestors 'none'",
  ];

  // Workers, on every route rather than just the editor: Sentry's replay
  // integration builds its compression worker from a blob URL on any page that
  // gets sampled, and without worker-src the browser falls back to script-src
  // and blocks it. Monaco's language workers (editor, html, css, json,
  // typescript, tailwindcss) are bundled by Next and served from our own
  // origin; blob: covers those too, since Monaco falls back to a blob shim
  // when a worker URL is cross-origin, e.g. once static assets move behind a
  // CDN. blob: here only permits workers from blobs the page itself made, and
  // the script inside one still has to come from 'self'.
  directives.push("worker-src 'self' blob:");

  // Local dev sends this policy as report-only (see src/proxy.ts), so plain
  // http/ws targets like local Supabase and test nodes still work there.
  directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}
