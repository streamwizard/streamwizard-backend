import "./src/lib/env";
import fs from "fs";
import path from "path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/** Monorepo root (primary lockfile) — clears Turbopack multi-lockfile root warning */
const turbopackRoot = path.resolve(__dirname, "../..");

function loadDotenvFilesIntoProcessEnv(fromDir: string) {
  const parseEnvContent = (envContent: string) => {
    envContent.split("\n").forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) return;
      const normalizedLine = trimmedLine.startsWith("export ") ? trimmedLine.slice(7) : trimmedLine;
      const [key, ...valueParts] = normalizedLine.split("=");
      if (key && valueParts.length > 0) {
        const rawValue = valueParts.join("=").trim();
        const value = rawValue.replace(/^["']|["']$/g, "");
        const envKey = key.trim();
        if (!process.env[envKey]) {
          process.env[envKey] = value;
        }
      }
    });
  };

  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(fromDir, fileName);
    if (!fs.existsSync(filePath)) continue;
    parseEnvContent(fs.readFileSync(filePath, "utf8"));
  }
}

loadDotenvFilesIntoProcessEnv(turbopackRoot);

const wsServerUrl = process.env.WS_SERVER_URL ?? "";

/**
 * This app's own public origin, needed in connect-src *by name*.
 *
 * `'self'` is not enough. Widget iframes are `srcdoc`, so they inherit this
 * policy, but a srcdoc document resolves `'self'` against its own URL
 * (`about:srcdoc`) rather than the embedder's origin — so `'self'` matches
 * nothing inside the iframe, and a widget calling same-origin /api/twitch or
 * /api/widgets/state is blocked. Naming the origin makes it match from both
 * the page and the iframe.
 */
const overlayUrl = process.env.NEXT_PUBLIC_OVERLAY_URL ?? "";

const assetCdnUrl =
  process.env.NEXT_PUBLIC_ASSET_CDN_URL ??
  process.env.ASSET_CDN_URL ??
  process.env.NEXT_PUBLIC_CDN_URL ??
  "";

/**
 * Artwork widgets render but don't host: Twitch badges, emotes, avatars and box
 * art, plus the three third-party emote CDNs. Widgets resolve these through
 * /api/twitch, which hands back a URL — and a URL this policy has to allow, or
 * every badge renders as a broken image.
 *
 * Note this header also governs the widget iframes: they're `srcdoc`, so they
 * inherit the embedding document's CSP. The per-widget <meta> policy can only
 * set connect-src, so it cannot loosen img-src/media-src on its own.
 */
const widgetImageHosts = [
  "https://static-cdn.jtvnw.net",
  "https://cdn.7tv.app",
  "https://cdn.betterttv.net",
  "https://cdn.frankerfacez.com",
].join(" ");

// Media-library uploads. Hardcoded host kept as a fallback for deployments that
// don't set the env var; without the CDN here, alert sounds and videos fail to
// play with no error a streamer would ever see.
const mediaHosts = ["https://cdn.streamwizard.org", assetCdnUrl].filter(Boolean).join(" ");

/** OBS-friendly fonts CSP for the overlay scene viewer (optional hardening). */
const overlaySceneFontsCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${mediaHosts} ${widgetImageHosts}`,
  `media-src 'self' blob: data: ${mediaHosts}`,
  // mediaHosts is here as well as in media-src: the per-widget <meta> policy
  // allows the asset CDN in connect-src, so a widget may fetch() an upload
  // rather than only pointing a tag at it. Same srcdoc reasoning as overlayUrl.
  `connect-src 'self'${overlayUrl ? ` ${overlayUrl}` : ""} ${mediaHosts} https://api.open-meteo.com https://nominatim.openstreetmap.org${wsServerUrl ? ` ${wsServerUrl}` : ""}`,
].join("; ");

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_PUBLIC_KEY ?? "",
    NEXT_PUBLIC_WS_SERVER_URL: wsServerUrl,
    NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN_WEB_OVERLAY ?? process.env.SENTRY_DSN ?? "",
    // Inlined into the client bundle so browser-side Sentry events carry the
    // real deploy environment (staging vs production) — NODE_ENV is
    // "production" for both. getSentryOptions falls back through ALERT_ENV
    // and NODE_ENV when this is empty.
    SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT ?? process.env.ALERT_ENV ?? "",
    // Same reason as SENTRY_ENVIRONMENT: without inlining, the client bundle
    // reads process.env.SENTRY_RELEASE as undefined and browser events carry
    // no release, so they never line up with the uploaded source maps.
    SENTRY_RELEASE: process.env.SENTRY_RELEASE ?? "",
    NEXT_PUBLIC_ASSET_CDN_URL:
      process.env.NEXT_PUBLIC_ASSET_CDN_URL ?? process.env.ASSET_CDN_URL ?? process.env.NEXT_PUBLIC_CDN_URL ?? "",
  },
  transpilePackages: ["@t3-oss/env-nextjs", "@t3-oss/env-core"],
  allowedDevOrigins: ["10.10.10.73"],
  turbopack: {
    root: turbopackRoot,
  },
  reactCompiler: true,
  output: "standalone",
  async headers() {
    return [
      {
        // Overlay URLs are for OBS, never for search results. The layout already
        // sets robots metadata, but that only covers pages Next renders as HTML;
        // this header also covers API routes and any non-HTML response.
        //
        // Deliberately no robots.txt Disallow to pair with this: a disallowed
        // crawler never fetches the URL, so it never sees this header, and the
        // URL can still be indexed bare. noindex has to be readable to work.
        source: "/(.*)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/:overlayId",
        headers: [
          {
            key: "Content-Security-Policy",
            value: overlaySceneFontsCsp,
          },
        ],
      },
    ];
  },
};

export default process.env.NODE_ENV === "development"
  ? nextConfig
  : withSentryConfig(nextConfig, {
      silent: !process.env.CI,
      widenClientFileUpload: true,
      tunnelRoute: "/monitoring",
      // Source map upload. Without these three the build still succeeds but
      // every staging/production stack trace stays minified and unreadable.
      // SENTRY_AUTH_TOKEN is a *build-time* secret — it must reach the Docker
      // build (Dokploy build arg), not just the runtime env.
      org: "streamwizard",
      project: "web-overlay",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
    });
