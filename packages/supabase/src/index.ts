import type { RefreshTwitchTokenResponse } from "./types/twitch-api";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types/supabase";
import { env } from "@repo/env";

export const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);

type TwitchIntegration = Database["public"]["Tables"]["integrations_twitch"]["Row"];

// get twitch integration by channel id
export async function getChannelAccessToken(channelId: string): Promise<string> {
    const { data, error } = await supabase
        .from("integrations_twitch")
        .select("access_token")
        .eq("twitch_user_id", channelId)
        .single();

    if (error || !data.access_token) {
        if (error) {
            throw error;
        }
        if (!data.access_token) {
            throw new Error("No access token found for channel");
        }
    }

    return data.access_token;
}

export async function getChannelRefreshToken(channelId: string): Promise<string> {
    const { data, error } = await supabase
        .from("integrations_twitch")
        .select("refresh_token")
        .eq("twitch_user_id", channelId)
        .single();
    if (error || !data.refresh_token) {
        if (error) {
            throw error;
        }
        if (!data.refresh_token) {
            throw new Error("No refresh token found for channel");
        }
    }

    return data.refresh_token;
}

export async function updateChannelAccessToken(
    newToken: RefreshTwitchTokenResponse,
    channelId: string
): Promise<TwitchIntegration> {
    const { data, error } = await supabase
        .from("integrations_twitch")
        .update({
            access_token: newToken.access_token,
            refresh_token: newToken.refresh_token,
            token_expires_at: new Date(Date.now() + newToken.expires_in * 1000).toISOString(),
        })
        .eq("twitch_user_id", channelId)
        .single();

    if (error) {
        throw error;
    }

    return data;
}

// fetch the twitch app token from supabase
export async function getTwitchAppToken(): Promise<{ access_token: string, expires_in: number, updated_at: string }> {
    const { data, error } = await supabase.from("twitch_app_token").select("access_token, expires_in, updated_at").single();

    if (error || !data.access_token || !data.expires_in || !data.updated_at) {
        throw error;
    }
    return { access_token: data.access_token, expires_in: data.expires_in, updated_at: data.updated_at };
}

// update twitch app token in supabase
export async function updateTwitchAppToken(accessToken: string, expiresIn: number): Promise<void> {
    const { data, error } = await supabase
        .from("twitch_app_token")
        .update({ access_token: accessToken, expires_in: expiresIn })
        .eq("id", "d8a84af6-eb48-4569-ba8c-ae8835e5a3b2")
        .single();

    if (error) {
        throw error;
    }
}

// Re-export types
export type { RefreshTwitchTokenResponse } from "./types/twitch-api";
export type { Database } from "./types/supabase";
