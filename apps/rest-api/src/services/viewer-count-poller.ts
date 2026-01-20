import { supabase } from "@repo/supabase";
import { TwitchApi } from "@repo/twitch-api";

/**
 * Polling interval in milliseconds (5 minutes)
 */
const POLLING_INTERVAL_MS = 5 * 60 * 1000;

/**
 * ViewerCountPoller manages periodic polling of viewer counts for active streams.
 * It starts polling when a stream goes online and stops when it goes offline.
 */
class ViewerCountPoller {
  private activePollers = new Map<string, NodeJS.Timeout>();

  /**
   * Start polling viewer counts for a broadcaster's stream
   * @param broadcasterId - The broadcaster's Twitch user ID
   * @param streamId - The current stream ID
   */
  startPolling(broadcasterId: string, streamId: string): void {
    // Don't start if already polling
    if (this.activePollers.has(broadcasterId)) {
      console.log(`[ViewerCountPoller] Already polling for broadcaster ${broadcasterId}`);
      return;
    }

    console.log(
      `[ViewerCountPoller] Starting polling for broadcaster ${broadcasterId}, stream ${streamId}`,
    );

    // Record initial viewer count immediately
    this.recordViewerCount(broadcasterId, streamId).catch(console.error);

    // Set up interval for periodic polling
    const intervalId = setInterval(() => {
      this.recordViewerCount(broadcasterId, streamId).catch(console.error);
    }, POLLING_INTERVAL_MS);

    this.activePollers.set(broadcasterId, intervalId);
  }

  /**
   * Stop polling for a broadcaster
   * @param broadcasterId - The broadcaster's Twitch user ID
   */
  stopPolling(broadcasterId: string): void {
    const intervalId = this.activePollers.get(broadcasterId);

    if (intervalId) {
      console.log(`[ViewerCountPoller] Stopping polling for broadcaster ${broadcasterId}`);
      clearInterval(intervalId);
      this.activePollers.delete(broadcasterId);
    } else {
      console.log(`[ViewerCountPoller] No active polling found for broadcaster ${broadcasterId}`);
    }
  }

  /**
   * Check if a broadcaster is currently being polled
   * @param broadcasterId - The broadcaster's Twitch user ID
   */
  isPolling(broadcasterId: string): boolean {
    return this.activePollers.has(broadcasterId);
  }

  /**
   * Get count of active pollers (for monitoring)
   */
  getActivePollerCount(): number {
    return this.activePollers.size;
  }

  /**
   * Fetch current stream data and record viewer count to database
   */
  private async recordViewerCount(broadcasterId: string, streamId: string): Promise<void> {
    try {
      const twitchApi = new TwitchApi(broadcasterId);
      const stream = await twitchApi.streams.getStream({ type: "live" });

      if (!stream) {
        console.log(`[ViewerCountPoller] Stream not found for ${broadcasterId}, stopping polling`);
        this.stopPolling(broadcasterId);
        return;
      }

      // Calculate offset from stream start
      const streamStartedAt = new Date(stream.started_at);
      const now = new Date();
      const offsetSeconds = Math.floor((now.getTime() - streamStartedAt.getTime()) / 1000);

      // Insert viewer count record
      const { error } = await supabase.from("stream_viewer_counts").insert({
        stream_id: streamId,
        broadcaster_id: broadcasterId,
        viewer_count: stream.viewer_count,
        game_id: stream.game_id || null,
        game_name: stream.game_name || null,
        title: stream.title || null,
        offset_seconds: offsetSeconds,
        recorded_at: now.toISOString(),
      });

      if (error) {
        console.error(`[ViewerCountPoller] Error inserting viewer count:`, error);
        return;
      }

      console.log(
        `[ViewerCountPoller] Recorded ${stream.viewer_count} viewers for ${broadcasterId} ` +
          `at offset ${Math.floor(offsetSeconds / 60)}m ${offsetSeconds % 60}s`,
      );
    } catch (error) {
      console.error(
        `[ViewerCountPoller] Error recording viewer count for ${broadcasterId}:`,
        error,
      );
    }
  }
}

// Export singleton instance
export const viewerCountPoller = new ViewerCountPoller();
