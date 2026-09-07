import "./src/lib/env";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

// A CDN var that isn't a parseable URL (unset in CI, typo'd in an env file)
// would otherwise throw here and fail the whole config load, taking the build
// down with an "Invalid URL" that names neither the variable nor the value.
function remotePatternFor(url: string | undefined) {
  if (!url) return [];
  try {
    return [{ protocol: "https" as const, hostname: new URL(url).hostname }];
  } catch {
    console.warn(`[next.config] ignoring unparseable CDN URL: ${url}`);
    return [];
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Allows accessing the dev server (and its HMR websocket) from the LAN IP
  // in addition to localhost/127.0.0.1, e.g. when testing from another device.
  allowedDevOrigins: ["127.0.0.1", "10.10.10.73"],
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  output: "standalone",
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Content-Security-Policy is set per-request in src/proxy.ts so
          // script-src can carry a nonce instead of 'unsafe-inline'.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // cdn.streamwizard.org 403s any request whose Referer is not a
          // streamwizard.org origin, so on localhost every CDN asset (landing
          // page demo clips, the theme-transition WebMs) fails to load. Sending
          // no referrer at all passes that check, so dev drops the header.
          // Staging/production keep the stricter cross-origin policy.
          {
            key: "Referrer-Policy",
            value: process.env.NODE_ENV === "development" ? "no-referrer" : "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://eu-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  transpilePackages: ["@t3-oss/env-nextjs", "@t3-oss/env-core"],
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_PUBLIC_KEY ?? "",
    NEXT_PUBLIC_WS_SERVER_URL: process.env.WS_SERVER_URL ?? "",
    NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN_WEB_STREAMWIZARD ?? process.env.SENTRY_DSN ?? "",
    // Inlined into the client bundle so browser-side Sentry events carry the
    // real deploy environment (staging vs production) — NODE_ENV is
    // "production" for both. getSentryOptions falls back through ALERT_ENV
    // and NODE_ENV when this is empty.
    SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT ?? process.env.ALERT_ENV ?? "",
    // Same reason as SENTRY_ENVIRONMENT: without inlining, the client bundle
    // reads process.env.SENTRY_RELEASE as undefined and browser events carry
    // no release, so they never line up with the uploaded source maps.
    SENTRY_RELEASE: process.env.SENTRY_RELEASE ?? "",
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? process.env.POSTHOG_KEY ?? "",
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com",
    NEXT_PUBLIC_ASSET_CDN_URL:
      process.env.NEXT_PUBLIC_ASSET_CDN_URL ?? process.env.ASSET_CDN_URL ?? process.env.NEXT_PUBLIC_CDN_URL ?? "",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static-cdn.jtvnw.net",
      },
      {
        protocol: "https",
        hostname: "vod-secure.twitch.tv",
      },
      {
        protocol: "https",
        hostname: "clips-media-assets2.twitch.tv",
      },
      ...remotePatternFor(process.env.NEXT_PUBLIC_CDN_URL),
      ...remotePatternFor(process.env.NEXT_PUBLIC_ASSET_CDN_URL),
    ],
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
      project: "web-streamwizard",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
    });
