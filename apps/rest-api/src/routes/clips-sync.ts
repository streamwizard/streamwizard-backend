import { type Context } from "hono";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getTwitchIntegrationWithTokenByUserId } from "@repo/supabase/queries/user";
import { getClipSync } from "@repo/supabase/queries/sync";
import { TwitchApi } from "@repo/twitch-api";
import { syncTwitch } from "../functions/sync-twitch";

/**
 * POST /api/clips/sync
 *
 * Triggers a Twitch clips sync for the authenticated user.
 * Requires Supabase authentication via JWT token.
 *
 * Request:
 * - Headers: Authorization: Bearer <token> OR Cookie with Supabase auth token
 * - Body (optional): { skipRecentCheck?: boolean }
 *
 * Response:
 * - 200: { success: true, clipsCount: number, message: string }
 * - 204: { success: true, skipped: true, message: string } (if sync was skipped due to recent sync)
 * - 400: { error: string }
 * - 401: { error: string } (if not authenticated)
 * - 404: { error: string } (if Twitch integration not found)
 * - 500: { error: string }
 */
export async function syncClipsHandler(c: Context) {
  try {
    // Get authenticated user from context (set by supabaseAuth middleware)
    const user = c.get("user");

    if (!user || !user.id) {
      return c.json({ error: "User not authenticated" }, 401);
    }

    const userId = user.id;

    // Get optional parameters from request body
    let skipRecentCheck = false;
    try {
      const body = await c.req.json();
      skipRecentCheck = body?.skipRecentCheck === true;
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Look up the user's Twitch integration to get their broadcaster_id
    const { data: integration, error: integrationError } = await getTwitchIntegrationWithTokenByUserId(supabase, userId);

    if (integrationError || !integration) {
      return c.json(
        {
          error: "Twitch integration not found",
          message: "Please connect your Twitch account first",
        },
        404,
      );
    }

    if (!integration.access_token_ciphertext) {
      return c.json(
        {
          error: "Twitch authentication required",
          message:
            "Your Twitch access token is missing or expired. Please reconnect your Twitch account.",
        },
        400,
      );
    }

    // Initialize TwitchApi
    const TwitchAPI = new TwitchApi(integration.twitch_user_id);

    // Trigger the sync
    const totalClips = await syncTwitch(integration.twitch_user_id, TwitchAPI, { skipRecentCheck });

    // Check if sync was skipped
    if (totalClips === null || (typeof totalClips === "object" && "skipped" in totalClips)) {
      const lastSync = totalClips && "lastSync" in totalClips ? totalClips.lastSync : null;
      return c.json(
        {
          success: false,
          skipped: true,
          lastSync,
          message: "Sync skipped. Last sync was less than an hour ago.",
        },
        429,
      );
    }

    return c.json(
      {
        success: true,
        clipsCount: totalClips.clipsCount,
        message: `Successfully synced ${totalClips.clipsCount} clips`,
      },
      200,
    );
  } catch (error) {
    // Answered as a 500 instead of rethrown, so safeErrorHandler never sees it.
    reportError(error, "clips-sync.run");
    return c.json(
      {
        error: "Sync failed",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      500,
    );
  }
}

/**
 * GET /api/clips/sync-status
 *
 * Get the current sync status for the authenticated user.
 *
 * Response:
 * - 200: { status: string, lastSync: string, clipCount: number }
 * - 404: { error: string } (if no sync record found)
 */
export async function syncStatusHandler(c: Context) {
  try {
    const user = c.get("user");

    if (!user || !user.id) {
      return c.json({ error: "User not authenticated" }, 401);
    }

    const userId = user.id;

    // Get sync status from database
    const syncStatus = await getClipSync(supabase, userId);

    if (!syncStatus) {
      return c.json(
        {
          message: "No sync history found",
          status: "never_synced",
        },
        200,
      );
    }

    return c.json(
      {
        status: syncStatus.sync_status,
        lastSync: syncStatus.last_sync,
        clipCount: syncStatus.clip_count,
      },
      200,
    );
  } catch (error) {
    reportError(error, "clips-sync.status");
    return c.json(
      {
        error: "Failed to get sync status",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      500,
    );
  }
}
