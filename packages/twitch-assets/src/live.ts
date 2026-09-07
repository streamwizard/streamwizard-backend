import { TwitchApi } from "@repo/twitch-api";
import { singleFlight } from "./cache";
import type { PublicStream } from "./types";

/**
 * Class B: live counters.
 *
 * NOTHING IN THIS FILE IS CACHED. Not for a minute, not for five seconds.
 *
 * A goal widget's contract is: read the true value at load, adjust it from
 * events, and come back correct when the streamer refreshes mid-stream. A TTL
 * of any length breaks the last part — the refresh would restore a number that
 * was right whenever the cache happened to fill, which is exactly the bug the
 * widget was refreshing to escape.
 *
 * Stampede protection is `singleFlight` instead: concurrent callers share one
 * in-flight request and the promise is dropped as soon as it settles. 500
 * viewers reloading an overlay produce one Helix call, and all 500 get a value
 * that was fetched just now. Correctness and one upstream call, not a trade
 * between them.
 *
 * If you are tempted to add a "tiny" TTL here because of rate limits: raise the
 * per-token rate limit in the route instead. Wrong numbers are not a rate-limit
 * solution.
 */

export async function liveFollowerTotal(broadcasterId: string): Promise<number> {
  return singleFlight(`live:followers:${broadcasterId}`, () =>
    new TwitchApi(broadcasterId).followers.getFollowerCount()
  );
}

/**
 * The one call here that needs the broadcaster's own token rather than the app
 * token — /subscriptions requires channel:read:subscriptions.
 */
export async function liveSubscriberTotal(broadcasterId: string): Promise<number> {
  return singleFlight(`live:subs:${broadcasterId}`, () =>
    new TwitchApi(broadcasterId).subscriptions.getSubscriberCount()
  );
}

export async function liveStream(broadcasterId: string): Promise<PublicStream> {
  return singleFlight(`live:stream:${broadcasterId}`, async () => {
    const stream = await new TwitchApi(broadcasterId).streams.getStreamWithAppToken(broadcasterId);

    if (!stream) {
      return {
        is_live: false,
        viewer_count: 0,
        game_id: null,
        game_name: null,
        title: null,
        started_at: null,
        thumbnail_url: null,
      };
    }

    return {
      is_live: true,
      viewer_count: stream.viewer_count,
      game_id: stream.game_id ?? null,
      game_name: stream.game_name ?? null,
      title: stream.title ?? null,
      started_at: stream.started_at ?? null,
      thumbnail_url: stream.thumbnail_url ?? null,
    };
  });
}
