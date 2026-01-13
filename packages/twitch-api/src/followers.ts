import { TwitchApiBaseClient } from "./base-client";

export class TwitchFollowersClient extends TwitchApiBaseClient {
  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }

  async getFollowerCount(): Promise<number> {
    const response = await this.clientApi().get(`/channels/followers`, {
      params: {
        broadcaster_id: this.broadcaster_id,
      },
    });
    return response.data.total;
  }

  async isFollower(userId: string): Promise<boolean> {
    try {
      const response = await this.appApi().get(`/channels/followers`, {
        params: {
          broadcaster_id: this.broadcaster_id,
          user_id: userId,
        },
      });
      const data = response.data?.data ?? [];
      return Array.isArray(data) && data.length > 0;
    } catch (error) {
      console.error("Error checking follower status:", error);
      return false;
    }
  }

  async getFollowInfo(userId: string): Promise<{ followed_at: string } | null> {
    try {
      const response = await this.appApi().get(`/channels/followers`, {
        params: {
          broadcaster_id: this.broadcaster_id,
          user_id: userId,
        },
      });
      const data = response.data?.data ?? [];
      if (Array.isArray(data) && data.length > 0) {
        const entry = data[0];
        // entry.followed_at is expected per Helix API
        if (entry && typeof entry.followed_at === "string") {
          return { followed_at: entry.followed_at };
        }
      }
      return null;
    } catch (error) {
      console.error("Error fetching follow info:", error);
      return null;
    }
  }
}
