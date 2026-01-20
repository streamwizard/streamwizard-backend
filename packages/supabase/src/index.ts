import type { RefreshTwitchTokenResponse } from "./types/twitch-api";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types/supabase";
import { env } from "@repo/env";
import { encryptToken, decryptToken } from "./crypto";

export const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);

type TwitchIntegration = Database["public"]["Tables"]["integrations_twitch"]["Row"];

// get twitch integration by channel id
export async function getChannelAccessToken(channelId: string): Promise<string> {
    const { data, error } = await supabase
        .from("integrations_twitch")
        .select("access_token_ciphertext, access_token_iv, access_token_tag")
        .eq("twitch_user_id", channelId)
        .single();

    if (error) {
        throw error;
    }

    if (!data.access_token_ciphertext || !data.access_token_iv || !data.access_token_tag) {
        throw new Error("No access token found for channel");
    }

    // Decrypt the token before returning
    return decryptToken(data.access_token_ciphertext, data.access_token_iv, data.access_token_tag);
}

export async function getChannelRefreshToken(channelId: string): Promise<string> {
    const { data, error } = await supabase
        .from("integrations_twitch")
        .select("refresh_token_ciphertext, refresh_token_iv, refresh_token_tag")
        .eq("twitch_user_id", channelId)
        .single();

    if (error) {
        throw error;
    }

    if (!data.refresh_token_ciphertext || !data.refresh_token_iv || !data.refresh_token_tag) {
        throw new Error("No refresh token found for channel");
    }

    // Decrypt the token before returning
    return decryptToken(data.refresh_token_ciphertext, data.refresh_token_iv, data.refresh_token_tag);
}

export async function updateChannelAccessToken(
    newToken: RefreshTwitchTokenResponse,
    channelId: string
): Promise<TwitchIntegration> {
    // Encrypt both access and refresh tokens
    const encryptedAccessToken = encryptToken(newToken.access_token);
    const encryptedRefreshToken = encryptToken(newToken.refresh_token);

    const { data, error } = await supabase
        .from("integrations_twitch")
        .update({
            access_token_ciphertext: encryptedAccessToken.ciphertext,
            access_token_iv: encryptedAccessToken.iv,
            access_token_tag: encryptedAccessToken.authTag,
            refresh_token_ciphertext: encryptedRefreshToken.ciphertext,
            refresh_token_iv: encryptedRefreshToken.iv,
            refresh_token_tag: encryptedRefreshToken.authTag,
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
    const { data, error } = await supabase
        .from("twitch_app_token")
        .select("access_token_ciphertext, access_token_iv, access_token_tag, expires_in, updated_at")
        .single();

    if (error) {
        throw error;
    }

    if (!data.access_token_ciphertext || !data.access_token_iv || !data.access_token_tag || !data.expires_in || !data.updated_at) {
        throw new Error("No app token found or missing encrypted data");
    }

    // Decrypt the token before returning
    const decryptedToken = decryptToken(data.access_token_ciphertext, data.access_token_iv, data.access_token_tag);

    return {
        access_token: decryptedToken,
        expires_in: data.expires_in,
        updated_at: data.updated_at
    };
}

// update twitch app token in supabase
export async function updateTwitchAppToken(accessToken: string, expiresIn: number): Promise<void> {
    // Encrypt the access token
    const encryptedToken = encryptToken(accessToken);

    const { data, error } = await supabase
        .from("twitch_app_token")
        .update({
            access_token_ciphertext: encryptedToken.ciphertext,
            access_token_iv: encryptedToken.iv,
            access_token_tag: encryptedToken.authTag,
            expires_in: expiresIn
        })
        .eq("id", "d8a84af6-eb48-4569-ba8c-ae8835e5a3b2")
        .single();

    if (error) {
        throw error;
    }
}
// Re-export types
export type { RefreshTwitchTokenResponse } from "./types/twitch-api";
export type { Database } from "./types/supabase";
