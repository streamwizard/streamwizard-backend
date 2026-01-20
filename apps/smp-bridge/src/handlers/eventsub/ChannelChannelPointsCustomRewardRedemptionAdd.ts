import type { MinecraftActions } from "@/classes/minecraft/handle-minecraft-actions";
import type { TwitchApi } from "@/classes/twitchApi";
import type { ChannelPointsCustomRewardRedemptionAddEvent } from "@/schema/twitch-schema";

export async function handleChannelChannelPointsCustomRewardRedemptionAdd(event: ChannelPointsCustomRewardRedemptionAddEvent, twitchApi: TwitchApi, minecraftActions: MinecraftActions) {
  console.log(`[${event.broadcaster_user_name}] ${event.user_name} redeemed ${event.reward.title} `);

  // await minecraftActions.Events.TwitchSubscriptionAlert({
  //   title: `${event.user_name} has subscribed!`,
  //   subtitle: `Thank you for your support!`,
  //   duration: 3,
  //   fireworks: 3,
  //   intensity: "high",
  //   show_chat: true,
  //   show_title: true,
  //   broadcast: false,
  //   message: `Thank you for your support!`,
  //   volume: 1.0,
  // });

  await minecraftActions.Disasters.superNova({
    level: 10,
    viewer_name: event.user_name,
  });
}