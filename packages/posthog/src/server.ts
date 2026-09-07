import { PostHog } from "posthog-node";
import type { AppEvent } from "./events";

let client: PostHog | null | undefined;

// Server-side events skip the /ingest reverse proxy (that exists to dodge
// ad blockers, which don't apply here) and talk to PostHog directly.
// flushAt 1 / flushInterval 0 because route handlers and gateway callbacks
// are too short-lived for batching — an unflushed batch is a lost event.
function getClient(): PostHog | null {
  if (client !== undefined) return client;
  const key = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    client = null;
    return client;
  }
  client = new PostHog(key, {
    host: process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

export function captureServerEvent(
  distinctId: string,
  event: AppEvent,
  properties?: Record<string, unknown>,
) {
  getClient()?.capture({ distinctId, event, properties });
}

export async function shutdownPostHog(): Promise<void> {
  await client?.shutdown();
}
