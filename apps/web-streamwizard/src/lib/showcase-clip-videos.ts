import { unstable_cache } from "next/cache";
import { TwitchApi } from "@repo/twitch-api";
import { reportError } from "@repo/sentry";

/*
 * Playable MP4s for the showcase clips on the public overlays page, so the
 * clips rotator demo shows the widget actually rotating video instead of
 * stills.
 *
 * The clip download endpoint runs on the app token (client credentials), not
 * on any streamer's user token: TwitchClipsClient.getClipDownloadUrl goes
 * through appApi(), so nothing here spends a broadcaster's credentials. That
 * is what makes it usable on a logged-out page at all.
 *
 * Twitch still answers 401 "the editor must have authorized the app" for a
 * channel that never connected StreamWizard, so this can only ever sign clips
 * from channels that opted in. Showcase clips come out of our own clips
 * table, which is populated by exactly those channels; the static fallback
 * snapshot is the part that partially fails, and those clips keep their
 * thumbnail instead.
 *
 * Resolved on the server and handed to the page as props rather than through
 * a public route: a route taking a clip id would be a "sign me any Twitch
 * clip" endpoint for the whole internet, and this needs no such thing.
 *
 * Twitch signs the URLs for 20 hours, so the hourly refresh here always hands
 * out a URL with most of its life left.
 */

/** Twitch takes up to 100 ids per /clips call; the showcase is far smaller. */
const MAX_LOOKUP = 100;

export interface ShowcaseClipVideo {
  clipId: string;
  videoUrl: string;
}

async function fetchShowcaseClipVideos(clipIds: string[]): Promise<Record<string, string>> {
  if (clipIds.length === 0) return {};

  try {
    const api = new TwitchApi();
    // One call resolves every broadcaster id; /clips/downloads needs it per clip.
    const { data: clips } = await api.clips.getClips({ id: clipIds.slice(0, MAX_LOOKUP) });

    const resolved = await Promise.all(
      (clips ?? []).map(async (clip) => {
        try {
          const result = await api.clips.getClipDownloadUrl({
            broadcaster_id: clip.broadcaster_id,
            editor_id: clip.broadcaster_id,
            clip_id: clip.id,
          });
          const url = result.data?.[0]?.landscape_download_url;
          return url ? ({ clipId: clip.id, videoUrl: url } satisfies ShowcaseClipVideo) : null;
        } catch {
          // One clip Twitch will not sign (deleted, restricted) must not cost
          // the rest of the rotation; that clip falls back to its thumbnail.
          return null;
        }
      }),
    );

    return Object.fromEntries(
      resolved.filter((row): row is ShowcaseClipVideo => row !== null).map((row) => [row.clipId, row.videoUrl]),
    );
  } catch (error) {
    reportError(error, "lib/showcase-clip-videos");
    return {};
  }
}

/**
 * Clip id to playable MP4 URL, for the ids given. Refreshed hourly, well
 * inside Twitch's 20 hour signature. Clips Twitch would not sign are absent
 * from the map, so callers fall back to the thumbnail.
 */
export const getShowcaseClipVideos = unstable_cache(fetchShowcaseClipVideos, ["showcase-clip-videos", "v2"], {
  revalidate: 3600,
});
