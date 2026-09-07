import { beforeAll, describe, expect, it, mock } from "bun:test";
import { createHash } from "crypto";
import { Hono } from "hono";

/**
 * Counts how many times the middleware actually reaches Supabase. The whole
 * point of the cache is that this stays at 1 no matter how hard the node agent
 * polls, so the assertion is on `lookups`, not on the response body.
 */
let lookups = 0;
let known = new Set<string>();

mock.module("@repo/supabase", () => ({ supabase: {} }));
mock.module("@repo/supabase/queries/obs-nodes", () => ({
  lookupNodeByApiKeyHash: async (_client: unknown, keyHash: string) => {
    lookups++;
    return known.has(keyHash) ? `node-for-${keyHash.slice(0, 8)}` : null;
  },
}));

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

let app: Hono;

beforeAll(async () => {
  const { nodeAuth } = await import("./node-auth");
  app = new Hono();
  app.get("/me", nodeAuth(), (c) => c.json({ nodeId: c.get("nodeId") }));
});

const call = (token?: string) =>
  app.request("/me", token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);

describe("nodeAuth", () => {
  it("rejects a missing, malformed, or empty Authorization header without touching Supabase", async () => {
    lookups = 0;

    expect((await call()).status).toBe(401);
    expect((await app.request("/me", { headers: { Authorization: "Basic abc" } })).status).toBe(401);
    expect((await app.request("/me", { headers: { Authorization: "Bearer   " } })).status).toBe(401);

    expect(lookups).toBe(0);
  });

  it("authenticates a valid key and sets nodeId", async () => {
    const token = "valid-token-1";
    known = new Set([hash(token)]);
    lookups = 0;

    const res = await call(token);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nodeId: `node-for-${hash(token).slice(0, 8)}` });
  });

  it("hits Supabase once for a repeated key, not once per request", async () => {
    const token = "valid-token-2";
    known = new Set([hash(token)]);
    lookups = 0;

    for (let i = 0; i < 100; i++) {
      expect((await call(token)).status).toBe(200);
    }

    expect(lookups).toBe(1);
  });

  it("collapses a concurrent cold-start burst into one lookup", async () => {
    const token = "valid-token-3";
    known = new Set([hash(token)]);
    lookups = 0;

    const results = await Promise.all(Array.from({ length: 25 }, () => call(token)));

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(lookups).toBe(1);
  });

  it("caches a rejected key so a retry loop can't amplify into Supabase", async () => {
    const token = "unrecognised-token";
    known = new Set();
    lookups = 0;

    for (let i = 0; i < 50; i++) {
      expect((await call(token)).status).toBe(401);
    }

    expect(lookups).toBe(1);
  });

  it("keeps distinct keys in distinct cache entries", async () => {
    const a = "distinct-a";
    const b = "distinct-b";
    known = new Set([hash(a), hash(b)]);
    lookups = 0;

    const resA = await call(a);
    const resB = await call(b);

    expect(await resA.json()).toEqual({ nodeId: `node-for-${hash(a).slice(0, 8)}` });
    expect(await resB.json()).toEqual({ nodeId: `node-for-${hash(b).slice(0, 8)}` });
    expect(lookups).toBe(2);
  });
});
