import { PUBLIC_ROUTES, absoluteUrl, isIndexableEnvironment } from "@/lib/seo";

/**
 * IndexNow key. Public by design: the protocol proves ownership by serving the
 * key at `/{key}.txt`, so the same value lives in `public/<key>.txt`. Keep the
 * two in sync when rotating.
 */
export const INDEXNOW_KEY = "07ab6f0bae864d5455522be38d967138";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/**
 * Tell Bing, Yandex and friends the public pages may have changed. Called once
 * per server boot from instrumentation.ts, which is the moment a new build
 * actually starts serving. Only the production host pings: staging and local
 * fail `isIndexableEnvironment()` and return before any request.
 *
 * Never throws. A failed ping costs nothing but a log line; the crawlers
 * still find the sitemap on their own schedule.
 */
export async function pingIndexNow(): Promise<void> {
  if (!isIndexableEnvironment()) return;

  const body = {
    host: new URL(absoluteUrl("/")).hostname,
    key: INDEXNOW_KEY,
    keyLocation: absoluteUrl(`/${INDEXNOW_KEY}.txt`),
    urlList: PUBLIC_ROUTES.map((route) => absoluteUrl(route.path)),
  };

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`[indexnow] ping rejected: ${res.status} ${res.statusText}`);
    }
  } catch (error) {
    console.warn("[indexnow] ping failed:", error instanceof Error ? error.message : error);
  }
}
