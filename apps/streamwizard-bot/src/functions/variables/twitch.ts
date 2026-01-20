// ./variables/twitch.ts
import type { TwitchApi } from "@/classes/twitchApi";
import type { BaseContext, VariableResolver, FlexibleResolver } from "../resolveVariables";

// Twitch context requires TwitchApi
export type TwitchContext = BaseContext & {
  twitchApi: TwitchApi;
};

// Twitch variable resolvers - requires twitchApi (mix of string and flexible resolvers)
export const TwitchVariableResolvers: Record<string, VariableResolver<TwitchContext> | FlexibleResolver<TwitchContext>> = {
  // Follower related
  follower_count: async ({ twitchApi }) => {
    try {
      const count = await twitchApi.followers.getFollowerCount();
      return String(count ?? 0);
    } catch (error) {
      console.error("Error fetching follower count:", error);
      return "0";
    }
  },

  follow_age: async ({ twitchApi, event }) => {
    try {
      if (!event?.chatter_user_id) return "";

      const info = await twitchApi.followers.getFollowInfo(event.chatter_user_id);
      if (!info) return "";

      const followedAt = new Date(info.followed_at).getTime();
      const now = Date.now();
      const deltaMs = Math.max(0, now - followedAt);

      // Simple humanizer: days
      const days = Math.floor(deltaMs / (1000 * 60 * 60 * 24));
      if (days <= 0) return "today";
      if (days === 1) return "1 day";
      return `${days} days`;
    } catch (error) {
      console.error("Error fetching follow age:", error);
      return "";
    }
  },

  // User/Event related
  username: async ({ event }) => {
    return event?.chatter_user_name ?? "";
  },

  user_id: async ({ event }) => {
    return event?.chatter_user_id ?? "";
  },

  display_name: async ({ event }) => {
    return event?.chatter_user_name ?? ""; // You might want to get display name from API
  },

  // Broadcaster related
  broadcaster_name: async ({ event }) => {
    return event?.broadcaster_user_name ?? "";
  },

  broadcaster_id: async ({ event }) => {
    return event?.broadcaster_user_id ?? "";
  },

  // Channel/Stream related
  subscriber_count: async ({ twitchApi }) => {
    try {
      const count = await twitchApi.subscriptions.getSubscriberCount();
      console.log("🔑 Subscriber count:", count);
      return String(count ?? 0);
    } catch (error) {
      console.error("Error fetching subscriber count:");
      return "0";
    }
  },

  viewer_list: async ({ event, twitchApi }) => {
    const viewers = await twitchApi.chat.getViewers();

    if (!viewers) return [];
    return viewers.map((viewer) => viewer.user_name);
  },
};

export default TwitchVariableResolvers;
