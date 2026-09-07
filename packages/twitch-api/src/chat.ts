import type { GetChattersResponse } from "@repo/types";
import { TwitchApiBaseClient } from "./base-client";

/**
 * StreamWizard's own Twitch account — the `sender_id` when a message speaks as
 * the bot rather than as the channel owner. A public Twitch user id, not a
 * secret, so it lives here rather than in every consumer app's env.
 */
export const STREAMWIZARD_BOT_USER_ID = "956066753";

/**
 * One version of one badge. `id` is the version string EventSub sends as
 * `badges[].id`; the image URLs are the only place the artwork can come from,
 * since the uuid in them is opaque and not derivable from set_id + version.
 */
export interface TwitchBadgeVersion {
  id: string;
  image_url_1x: string;
  image_url_2x: string;
  image_url_4x: string;
  title: string;
  description: string;
  click_action: string | null;
  click_url: string | null;
}

export interface TwitchBadgeSet {
  set_id: string;
  versions: TwitchBadgeVersion[];
}

/**
 * Helix answers 200 even when AutoMod holds a message, so `is_sent` — not the
 * status code — is what says whether chat actually saw it.
 */
export interface SendChatMessageResponse {
  data: {
    message_id: string;
    is_sent: boolean;
    drop_reason?: { code: string; message: string } | null;
  }[];
}

export class TwitchChatClient extends TwitchApiBaseClient {
  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }
  async sendMessage({ message, replyToMessageId, sender = "bot" }: { message: string; replyToMessageId?: string | null, sender?: "bot" | "broadcaster" }): Promise<SendChatMessageResponse> {
    const response = await this.appApi().post<SendChatMessageResponse>(`/chat/messages`, {
      message,
      broadcaster_id: this.broadcaster_id,
      sender_id: sender === "bot" ? STREAMWIZARD_BOT_USER_ID : this.broadcaster_id,
      reply_parent_message_id: replyToMessageId ? replyToMessageId : null,
      // for_source_only: true,
    });
    return response.data;
  }

  async getViewers() {
    try {
      const response = await this.clientApi().get<GetChattersResponse>(`/chat/chatters`, {
        params: {
          broadcaster_id: this.broadcaster_id,
          moderator_id: this.broadcaster_id,
          first: 500,
        },
      });
      return response.data.data;
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Badge sets Twitch ships to every channel (moderator, vip, staff, ...).
   * App token: no channel context, no scopes.
   */
  async getGlobalBadges(): Promise<TwitchBadgeSet[]> {
    const response = await this.appApi().get("/chat/badges/global");
    return response.data.data ?? [];
  }

  /**
   * This channel's own badge sets — custom subscriber tiers and bits badges.
   * These are what a hand-drawn approximation can never match, so they take
   * precedence over the global set of the same name.
   */
  async getChannelBadges(): Promise<TwitchBadgeSet[]> {
    const response = await this.appApi().get("/chat/badges", {
      params: { broadcaster_id: this.broadcaster_id },
    });
    return response.data.data ?? [];
  }

  async sendShoutout(to_broadcaster_id: string) {
    const response = await this.clientApi().post(`/chat/shoutouts`, {
      from_broadcaster_id: this.broadcaster_id,
      to_broadcaster_id: to_broadcaster_id,
      moderator_id: this.broadcaster_id,
    });
    return response.data;
  }

  async sendAnnouncement(message: string) {
    const response = await this.clientApi().post(`/chat/announcements`, {
      broadcaster_id: this.broadcaster_id,
      moderator_id: this.broadcaster_id,
      message: message,
    });
    return response.data;
  }
}
