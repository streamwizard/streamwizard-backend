import { createHash } from "crypto";
import type { MiddlewareHandler } from "hono";
import { supabase } from "@repo/supabase";
import { lookupNodeByApiKeyHash } from "@repo/supabase/queries/obs-nodes";
import { TtlCache } from "../lib/ttl-cache";

declare module "hono" {
  interface ContextVariableMap {
    nodeId: string;
  }
}

/**
 * Key hash -> node id, so the agent's poll loop stops costing a Supabase
 * request per request.
 *
 * TTL-only, with no invalidation hook, and that is deliberate. These keys are
 * insert-only — written once at `POST /claim`, with no rotate or revoke route —
 * so the *entire* invalidation surface is node deletion, which cascades the row
 * away. That happens in `deleteNodeAction` inside the **web-admin Next.js
 * process**, which cannot reliably signal this one: an HTTP invalidate reaches
 * a single rest-api replica and the replica count lives in the Dokploy UI, not
 * in this repo (see the same warning in `middleware/rateLimit.ts`).
 *
 * So a deleted node's key keeps authenticating for up to TTL. That window leaks
 * reads only — every write path has an FK to `obs_nodes` and fails at the
 * database the moment the node row is gone, and the one sensitive read
 * (`/users/:userId/stream-key`) re-checks `userHasInstanceOnNode` against the
 * live database, whose rows cascade away with the node. An hour is therefore
 * bounded by comfort, not correctness: it trades a longer read-only window for
 * 1/12th the auth traffic of the previous 5 minutes. If you ever add a revoke
 * route, this comment is the reason it will not take effect immediately.
 */
const KEY_TTL_MS = 60 * 60 * 1000;
/** Shorter, so a wrong key retried in a loop can't amplify, but a node that
 *  just finished /claim isn't locked out for five minutes. */
const NEGATIVE_TTL_MS = 5 * 1000;

const nodeIdByKeyHash = new TtlCache<string>({
  ttlMs: KEY_TTL_MS,
  negativeTtlMs: NEGATIVE_TTL_MS,
});

export const nodeAuthCacheStats = () => nodeIdByKeyHash.stats();

// Authenticates requests from OBS nodes using per-node API keys. The key is
// generated at /claim time; only its SHA-256 hash is stored in obs_node_api_keys.
// Sets c.var.nodeId on success so route handlers know which node is calling.
export const nodeAuth = (): MiddlewareHandler => {
  return async (c, next) => {
    const auth = c.req.header("Authorization");

    if (!auth) {
      return c.json({ error: "Authorization header is required" }, 401);
    }

    if (!auth.startsWith("Bearer ")) {
      return c.json({ error: "Authorization header must use Bearer scheme" }, 401);
    }

    const token = auth.slice(7).trim();

    if (!token) {
      return c.json({ error: "Bearer token is empty" }, 401);
    }

    // Keyed on the hash, never the plaintext token — the hash is already what
    // the table stores, so the cache holds nothing the database doesn't.
    const keyHash = createHash("sha256").update(token).digest("hex");
    const nodeId = await nodeIdByKeyHash.fetch(keyHash, () => lookupNodeByApiKeyHash(supabase, keyHash));

    if (!nodeId) {
      return c.json({ error: "Node API key not recognised — re-run the claim step or contact an admin" }, 401);
    }

    c.set("nodeId", nodeId);
    await next();
  };
};
