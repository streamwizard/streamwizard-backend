/**
 * Server-to-server fan-out into a user's ws-server room.
 *
 * ws-server exposes POST /internal/broadcast as the injection point for
 * processes that hold no bot socket (the Next apps and rest-api). Every caller
 * used to hand-roll the same fetch: ws:// → http:// rewrite, bearer secret,
 * 3s timeout. They differ only in what they do with a failure, so this returns
 * a typed result instead of deciding for them.
 */

export interface BroadcastConfig {
  /** ws-server base URL. `ws://`/`wss://` is rewritten to http(s) automatically. */
  wsServerUrl: string | null | undefined;
  /** Shared secret gating /internal/broadcast. Missing secret = no push. */
  consumerSecret: string | null | undefined;
  /** Defaults to 3s — a push must never outlive the request that triggered it. */
  timeoutMs?: number;
}

export type BroadcastResult =
  /** Delivered to ws-server (not necessarily to a connected client). */
  | { ok: true }
  /** No ws-server URL or secret configured — pushes are simply off here. */
  | { ok: false; reason: "unconfigured" }
  /** ws-server answered, but not with 2xx. */
  | { ok: false; reason: "status"; status: number }
  /** Never reached ws-server (DNS, connection refused, timeout). */
  | { ok: false; reason: "network"; error: unknown };

export function toHttpUrl(wsServerUrl: string): string {
  return wsServerUrl.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
}

/** POST to any of ws-server's secret-gated `/internal/*` endpoints. */
export async function postInternal(
  path: string,
  body: unknown,
  config: BroadcastConfig,
): Promise<BroadcastResult> {
  const { wsServerUrl, consumerSecret, timeoutMs = 3_000 } = config;
  if (!wsServerUrl || !consumerSecret) return { ok: false, reason: "unconfigured" };

  try {
    const res = await fetch(`${toHttpUrl(wsServerUrl)}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${consumerSecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok ? { ok: true } : { ok: false, reason: "status", status: res.status };
  } catch (error) {
    return { ok: false, reason: "network", error };
  }
}

export function broadcastToUser(
  userId: string,
  type: string,
  payload: unknown,
  config: BroadcastConfig,
): Promise<BroadcastResult> {
  return postInternal("/internal/broadcast", { userId, type, payload }, config);
}
