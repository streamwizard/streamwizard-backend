import { CreateEventSubSubscriptionRequest, EventSubSubscriptionType } from "@/types/twitch";
import { env } from "@/lib/env";

// Type for subscription configuration
type SubscriptionConfig = {
  type: EventSubSubscriptionType;
  version: string;
  condition: (userId: string) => Record<string, unknown>;
};

// Configure all conduit subscriptions with their conditions
const conduitSubscriptions: SubscriptionConfig[] = [
  {
    type: "channel.chat.message",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId, user_id: userId }),
  },
  {
    type: "channel.chat.notification",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId, user_id: userId }),
  },
  {
    type: "channel.chat.message_delete",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId, user_id: userId }),
  },
  {
    type: "channel.chat.clear",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId, user_id: userId }),
  },
  {
    type: "channel.chat.clear_user_messages",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId, user_id: userId }),
  },
  {
    type: "channel.shoutout.create",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId, moderator_user_id: userId }),
  },
  {
    type: "channel.shoutout.receive",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId, moderator_user_id: userId }),
  },
  {
    type: "channel.follow",
    version: "2",
    condition: (userId) => ({ broadcaster_user_id: userId, moderator_user_id: userId }),
  },
  {
    type: "channel.raid",
    version: "1",
    condition: (userId) => ({ to_broadcaster_user_id: userId }),
  },
  {
    type: "channel.cheer",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.subscribe",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.subscription.gift",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.subscription.message",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.update",
    version: "2",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.channel_points_custom_reward_redemption.add",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.channel_points_custom_reward_redemption.update",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.channel_points_custom_reward.add",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.channel_points_custom_reward.remove",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.channel_points_custom_reward.update",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.poll.begin",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.poll.progress",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.poll.end",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.hype_train.begin",
    version: "2",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.hype_train.progress",
    version: "2",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.hype_train.end",
    version: "2",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.ad_break.begin",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
];

// Configure all webhook subscriptions with their conditions
const webhookSubscriptions: SubscriptionConfig[] = [
  {
    type: "stream.offline",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "stream.online",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.update",
    version: "2",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
];

export default async function NeededEventSubscriptions(twitchUserId: string): Promise<CreateEventSubSubscriptionRequest[]> {
  const conduitId = env.TWITCH_CONDUIT_ID;
  const apiUrl = env.STREAMWIZARD_API_URL;

  if (!conduitId || !apiUrl) {
    throw new Error(
      "TWITCH_CONDUIT_ID and STREAMWIZARD_API_URL must be set in the environment for EventSub subscription setup.",
    );
  }

  const conduitTransport = {
    method: "conduit" as const,
    conduit_id: conduitId,
  };

  // Generate conduit subscriptions with conditions
  const conduitRequests = conduitSubscriptions.map(({ type, version, condition }) => ({
    type,
    version,
    condition: condition(twitchUserId),
    transport: conduitTransport,
  }));

  // Webhook subscriptions require HTTPS — skip in development
  if (env.NODE_ENV === "development") {
    return conduitRequests;
  }

  const createWebhookTransport = () => ({
    method: "webhook" as const,
    callback: `${apiUrl}/webhooks/twitch/eventsub`,
    secret: env.TWITCH_WEBHOOK_SECRET,
  });

  const webhookRequests = webhookSubscriptions.map(({ type, version, condition }) => ({
    type,
    version,
    condition: condition(twitchUserId),
    transport: createWebhookTransport(),
  }));

  return [...webhookRequests, ...conduitRequests];
}
