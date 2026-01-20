import * as TwitchSchema from "@repo/schemas";
import type { HandlerRegistry } from "./eventHandler";
import { handleChannelChannelPointsCustomRewardRedemptionAdd } from "./eventsub/ChannelChannelPointsCustomRewardRedemptionAdd";

export const registerTwitchHandlers = (handlers: HandlerRegistry) => {
  // channel points redemption add
  handlers.registerTwitchHandler(
    "channel.channel_points_custom_reward_redemption.add",
    async (event, context) => {
      await handleChannelChannelPointsCustomRewardRedemptionAdd(
        event,
        context.twitchApi,
        context.minecraftActions
      );
    },
    TwitchSchema.ChannelPointsCustomRewardRedemptionAddSchema
  );
};
