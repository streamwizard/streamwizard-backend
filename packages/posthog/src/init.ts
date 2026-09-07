import posthog, { type CaptureResult } from "posthog-js";

export interface PostHogConfig {
  key: string;
  host?: string;
}

// Query params that must never reach PostHog, wherever they show up: OAuth
// codes on the auth callbacks, and anything credential-shaped a future page
// might put in a URL. Everything else (utm_*, ?code-less filters) passes.
const SENSITIVE_PARAMS = [
  "code",
  "state",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "api_key",
  "apikey",
  "secret",
  "email",
];

function scrubUrl(value: unknown): unknown {
  if (typeof value !== "string" || !value.includes("?")) return value;
  try {
    const url = new URL(value, window.location.origin);
    let changed = false;
    for (const param of SENSITIVE_PARAMS) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    }
    if (!changed) return value;
    return /^https?:\/\//.test(value) ? url.toString() : url.pathname + url.search + url.hash;
  } catch {
    return value;
  }
}

function scrubEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event?.properties) return event;
  for (const key of ["$current_url", "$referrer", "href"]) {
    if (key in event.properties) {
      event.properties[key] = scrubUrl(event.properties[key]);
    }
  }
  return event;
}

export function initPostHog({ key, host = "https://eu.i.posthog.com" }: PostHogConfig) {
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: host.replace("i.posthog.com", "posthog.com"),
    defaults: "2026-05-30",
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "identified_only",
    cookieless_mode: "on_reject",
    disable_session_recording: true,
    disable_surveys: true,
    disable_web_experiments: true,
    disable_conversations: true,
    capture_performance: { web_vitals: true },
    advanced_disable_feature_flags: true,
    advanced_disable_flags: true,
    request_batching: false,
    before_send: scrubEvent,
  });
}
