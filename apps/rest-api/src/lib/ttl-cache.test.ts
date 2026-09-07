import { describe, expect, it } from "bun:test";
import { TtlCache } from "./ttl-cache";

/** Injectable clock so the TTL assertions don't need real sleeps. */
function fakeClock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("TtlCache", () => {
  it("returns undefined for an unknown key and the value while warm", () => {
    const cache = new TtlCache<string>({ ttlMs: 1000 });
    expect(cache.get("a")).toBeUndefined();
    cache.set("a", "node-1");
    expect(cache.get("a")).toBe("node-1");
  });

  it("expires entries once the TTL has elapsed", () => {
    const clock = fakeClock();
    const cache = new TtlCache<string>({ ttlMs: 1000, now: clock.now });
    cache.set("a", "node-1");

    clock.advance(999);
    expect(cache.get("a")).toBe("node-1");

    clock.advance(2);
    expect(cache.get("a")).toBeUndefined();
  });

  it("caches a negative result distinguishably, on its own shorter TTL", () => {
    const clock = fakeClock();
    const cache = new TtlCache<string>({ ttlMs: 1000, negativeTtlMs: 100, now: clock.now });
    cache.set("bad", null);

    // null is a cached miss; undefined is "not cached at all". The difference
    // is the whole point — it's what stops a bad key hammering Supabase.
    expect(cache.get("bad")).toBeNull();

    clock.advance(101);
    expect(cache.get("bad")).toBeUndefined();
  });

  it("evicts oldest-first once maxEntries is reached", () => {
    const cache = new TtlCache<string>({ ttlMs: 10_000, maxEntries: 2 });
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("2");
    expect(cache.get("c")).toBe("3");
  });

  it("overwriting an existing key does not evict another entry", () => {
    const cache = new TtlCache<string>({ ttlMs: 10_000, maxEntries: 2 });
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("a", "1-updated");

    expect(cache.get("a")).toBe("1-updated");
    expect(cache.get("b")).toBe("2");
  });

  describe("fetch", () => {
    it("calls the loader once and serves the rest from cache", async () => {
      const cache = new TtlCache<string>({ ttlMs: 1000 });
      let calls = 0;
      const loader = async () => {
        calls++;
        return "node-1";
      };

      for (let i = 0; i < 100; i++) {
        expect(await cache.fetch("k", loader)).toBe("node-1");
      }
      expect(calls).toBe(1);
    });

    it("re-loads after the TTL expires", async () => {
      const clock = fakeClock();
      const cache = new TtlCache<string>({ ttlMs: 1000, now: clock.now });
      let calls = 0;
      const loader = async () => {
        calls++;
        return "node-1";
      };

      await cache.fetch("k", loader);
      clock.advance(1001);
      await cache.fetch("k", loader);

      expect(calls).toBe(2);
    });

    it("collapses concurrent misses into a single loader call", async () => {
      const cache = new TtlCache<string>({ ttlMs: 1000 });
      let calls = 0;
      const loader = async () => {
        calls++;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return "node-1";
      };

      const results = await Promise.all(Array.from({ length: 20 }, () => cache.fetch("k", loader)));

      expect(calls).toBe(1);
      expect(results.every((r) => r === "node-1")).toBe(true);
    });

    it("caches a null result so a bad key can't amplify", async () => {
      const cache = new TtlCache<string>({ ttlMs: 1000 });
      let calls = 0;
      const loader = async () => {
        calls++;
        return null;
      };

      expect(await cache.fetch("bad", loader)).toBeNull();
      expect(await cache.fetch("bad", loader)).toBeNull();
      expect(calls).toBe(1);
    });

    it("does not cache a thrown error — a Supabase blip must not become an outage", async () => {
      const cache = new TtlCache<string>({ ttlMs: 1000 });
      let calls = 0;
      const failing = async (): Promise<string | null> => {
        calls++;
        throw new Error("supabase unreachable");
      };

      await expect(cache.fetch("k", failing)).rejects.toThrow("supabase unreachable");
      await expect(cache.fetch("k", failing)).rejects.toThrow("supabase unreachable");
      expect(calls).toBe(2);

      // And a later success still lands.
      expect(await cache.fetch("k", async () => "node-1")).toBe("node-1");
    });
  });

  it("reports hit rate", async () => {
    const cache = new TtlCache<string>({ ttlMs: 1000 });
    await cache.fetch("k", async () => "v");
    await cache.fetch("k", async () => "v");
    await cache.fetch("k", async () => "v");

    const stats = cache.stats();
    expect(stats.size).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(2);
    expect(stats.hitRate).toBeCloseTo(2 / 3);
  });
});
