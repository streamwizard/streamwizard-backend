import "./src/lib/env";
import path from "path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const turbopackRoot = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@t3-oss/env-nextjs", "@t3-oss/env-core", "@repo/metrics", "@repo/alerting"],
  turbopack: {
    root: turbopackRoot,
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_PUBLIC_KEY ?? "",
    NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN_WEB_ADMIN ?? process.env.SENTRY_DSN ?? "",
    // Inlined into the client bundle so browser-side Sentry events carry the
    // real deploy environment (staging vs production) — NODE_ENV is
    // "production" for both. getSentryOptions falls back through ALERT_ENV
    // and NODE_ENV when this is empty.
    SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT ?? process.env.ALERT_ENV ?? "",
    // Same reason as SENTRY_ENVIRONMENT: without inlining, the client bundle
    // reads process.env.SENTRY_RELEASE as undefined and browser events carry
    // no release, so they never line up with the uploaded source maps.
    SENTRY_RELEASE: process.env.SENTRY_RELEASE ?? "",
    NEXT_PUBLIC_WS_SERVER_URL: process.env.WS_SERVER_URL ?? "",
  },
  async headers() {
    return [
      {
        // Internal tool: nothing here belongs in an index. The root layout sets
        // robots metadata too, but that only covers HTML Next renders; this also
        // covers API routes and non-HTML responses.
        //
        // Deliberately no robots.txt Disallow to pair with this: a disallowed
        // crawler never fetches the URL, so it never sees this header, and the
        // URL can still be indexed bare. noindex has to be readable to work.
        source: "/(.*)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
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
      project: "web-admin",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
    });
