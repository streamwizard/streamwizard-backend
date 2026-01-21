import * as TwitchSchema from "@repo/schemas";
import type { HandlerRegistry } from "./eventHandler";
import { handleChatMessage } from "./eventsub/handleChatMessage";

export const registerTwitchHandlers = (handlers: HandlerRegistry) => {
  // chat message
  handlers.registerTwitchHandler(
    "channel.chat.message",
    async (event, context) => {
      await handleChatMessage(event, context.twitchApi);
    },
    TwitchSchema.ChannelChatMessageEventSchema,
  );
};
