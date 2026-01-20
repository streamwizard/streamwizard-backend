import type { AxiosError } from "axios";
import { TwitchApiBaseClient } from "./base-client";

export interface Subscription {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  gifter_id: string;
  gifter_login: string;
  gifter_name: string;
  is_gift: boolean;
  tier: string;
  plan_name: string;
  user_id: string;
  user_login: string;
  user_name: string;
}

export interface GetSubscriptionsOptions {
  broadcasterId: string;
  userId?: string[];
  first?: number;
  after?: string;
}

export class TwitchSubscriptionsClient extends TwitchApiBaseClient {

  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }


  async getSubscriptions(options: GetSubscriptionsOptions, channelId: string): Promise<{ data: Subscription[]; pagination: { cursor?: string } }> {
    const response = await this.clientApi().get("/subscriptions", { params: options });
    return response.data;
  }

  async getSubscriptionByUserId(broadcasterId: string, userId: string): Promise<Subscription> {
    const response = await this.clientApi().get("/subscriptions/user", {
      params: { broadcaster_id: broadcasterId, user_id: userId },
    });
    const subscription = response.data.data[0];
    if (!subscription) {
      throw new Error(`Subscription for user ID ${userId} not found`);
    }
    return subscription;
  }

  // TODO: make it work with tier 1, 2, 3 so for example if there are 100 subscribers, 50 of them are tier 1, 30 of them are tier 2, and 20 of them are tier 3,
  async getSubscriberCount(): Promise<number> {
    const response = await this.clientApi().get("/subscriptions", {
      params: { broadcaster_id: this.broadcaster_id, first: 1 },
    });
    return response.data.total;
  }

  async isSubscriber(userId: string): Promise<boolean> {
    if (!this.broadcaster_id) {
      throw new Error("Broadcaster ID is required");
    }
    try {
      await this.getSubscriptionByUserId(this.broadcaster_id, userId);
      return true;
    } catch (error) {
      if ((error as AxiosError)?.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }
}
