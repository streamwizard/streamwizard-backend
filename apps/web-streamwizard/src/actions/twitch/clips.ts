"use server";
import { TwitchApi } from "@repo/twitch-api";
import { createClient } from "@repo/supabase/next/server";
import { getClipBroadcasterId } from "@repo/supabase/queries/clips";
import { getBroadcasterId } from "@repo/supabase/queries/user";
import axios from "axios";
import { env } from "@/lib/env";
import { revalidatePath } from "next/cache";
import { reportError } from "@repo/sentry";

interface returnObject<T = unknown> {
  message: string;
  success: boolean;
  data?: T;
}

export async function createTwitchClip(
  broadcasterId: string
): Promise<{ editUrl: string }> {
  const api = new TwitchApi(broadcasterId);
  const result = await api.clips.createClip();
  const clip = result.data?.[0];
  if (!clip) throw new Error("Failed to create clip");
  return { editUrl: clip.edit_url };
}

export async function SyncBroadcasterClips(): Promise<{ message: string; success: boolean; skipped?: boolean; lastSync?: string }> {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  try {
    await axios.post(`${env.STREAMWIZARD_API_URL}/api/clips/sync`, null, {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    });

    revalidatePath("/dashboard/clips", "page");
    return {
      message: "Clips synced successfully",
      success: true,
    };
  } catch (error: unknown) {
    if (axios.isAxiosError<{ skipped: boolean; message: string; success: boolean; lastSync?: string }>(error)) {
      const data = error.response?.data;
      if (data?.skipped) {
        return {
          message: data.message || "Already synced recently",
          success: false,
          skipped: true,
          lastSync: data.lastSync,
        };
      }
      console.error("[SyncBroadcasterClips] API error:", error.response?.status, JSON.stringify(error.response?.data ?? {}));
    } else {
      console.error("[SyncBroadcasterClips] Unexpected error:", error instanceof Error ? error.message : error);
    }
    return {
      message: "Error syncing clips",
      success: false,
    };
  }
}

interface ClipDownloadURLData {
  data: {
    clip_id: string;
    landscape_download_url: string | null;
    portrait_download_url: string | null;
  }[];
}

export async function GetClipDownloadURL(clipId: string, user_id: string): Promise<returnObject<ClipDownloadURLData>> {
  const supabase = await createClient();

  try {
    const broadcasterId = await getClipBroadcasterId(supabase, clipId, user_id);

    if (!broadcasterId) {
      return {
        message: `Clip not found for clipId=${clipId}`,
        success: false,
      };
    }

    const api = new TwitchApi(broadcasterId);
    const result = await api.clips.getClipDownloadUrl({
      broadcaster_id: broadcasterId,
      editor_id: broadcasterId,
      clip_id: clipId,
    });

    return {
      message: "Clip downloaded successfully",
      success: true,
      data: result as ClipDownloadURLData,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      reportError(error, "actions/twitch/clips.GetClipDownloadURL");
      return {
        message: `Twitch API error: ${error.response?.status ?? "unknown"}`,
        success: false,
      };
    }

    reportError(error, "actions/twitch/clips.GetClipDownloadURL");
    return {
      message: "Error downloading clip",
      success: false,
    };
  }
}
