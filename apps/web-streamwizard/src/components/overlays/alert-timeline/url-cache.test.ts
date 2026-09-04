import { describe, expect, it } from "bun:test";
import { createUrlCache } from "./url-cache";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createUrlCache", () => {
  it("probes once per url, answers undefined while pending and notifies when settled", async () => {
    const d = deferred<{ n: number } | null>();
    let probes = 0;
    const cache = createUrlCache<{ n: number }, string>(() => {
      probes += 1;
      return d.promise;
    });
    let notified = 0;
    cache.subscribe(() => {
      notified += 1;
    });
    expect(cache.read("a")).toBeUndefined();
    const p1 = cache.load("a", "hint");
    const p2 = cache.load("a", "hint");
    expect(probes).toBe(1);
    expect(cache.read("a")).toBeUndefined();
    d.resolve({ n: 1 });
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual({ n: 1 });
    expect(r2).toBe(r1);
    expect(cache.read("a")).toBe(r1);
    expect(notified).toBe(1);
    expect(await cache.load("a", "hint")).toBe(r1);
    expect(probes).toBe(1);
  });

  it("turns a failed probe into null and ignores empty urls", async () => {
    const cache = createUrlCache<number, undefined>(() => Promise.reject(new Error("no")));
    expect(await cache.load("x", undefined)).toBeNull();
    expect(cache.read("x")).toBeNull();
    expect(cache.read("")).toBeNull();
    expect(await cache.load("", undefined)).toBeNull();
  });

  it("drops the oldest settled entries past the limit but keeps probes in flight", async () => {
    const pending = deferred<number | null>();
    const cache = createUrlCache<number, undefined>((url) => (url === "slow" ? pending.promise : Promise.resolve(url.length)), 2);
    void cache.load("slow", undefined);
    await cache.load("aa", undefined);
    await cache.load("bbb", undefined);
    expect(cache.read("slow")).toBeUndefined();
    expect(cache.read("aa")).toBeUndefined();
    expect(cache.read("bbb")).toBe(3);
    pending.resolve(9);
    expect(await cache.load("slow", undefined)).toBe(9);
  });
});
