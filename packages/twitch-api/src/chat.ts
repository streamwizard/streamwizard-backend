import type { GetChattersResponse } from "@/types/twitch-api";
import { TwitchApiBaseClient } from "./base-client";

export class TwitchChatClient extends TwitchApiBaseClient {
  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }
  async sendMessage({ message, replyToMessageId }: { message: string; replyToMessageId?: string | null }) {
    const response = await this.appApi().post(`/chat/messages`, {
      message,
      broadcaster_id: this.broadcaster_id,
      sender_id: "956066753",
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
