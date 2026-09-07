export async function register() {
  if (process.env.NODE_ENV === "development") return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    // Tell IndexNow the public pages may have changed. Fire-and-forget: a
    // slow or failing Bing endpoint must never hold up server start.
    void import("./lib/indexnow").then((m) => m.pingIndexNow());
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export async function onRequestError(...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>) {
  if (process.env.NODE_ENV === "development") return;
  const { captureRequestError } = await import("@sentry/nextjs");
  return captureRequestError(...args);
}
