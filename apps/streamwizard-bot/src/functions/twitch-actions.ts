import type { ActionEvent } from "./handle-action";
import { TwitchApi } from "@/classes/twitchApi";
import { resolveVariables } from "./resolveVariables";

export const TwitchActionHandlers: Record<string, (event: ActionEvent, twitchApi: TwitchApi) => Promise<any>> = {
  create_marker: async (event, twitchApi) => {
    const description: string = event.currentActionContext.description;

    const resolvedDescription = await resolveVariables(description, { twitchApi }, event.results);

    const marker = await twitchApi.markers.createMarker(resolvedDescription);
    return marker;
  },

  send_chat_message: async (event, twitchApi) => {
    const message = event.currentActionContext.message;

    const resolvedMessage = await resolveVariables(message, { twitchApi }, event.results);

    const messageResponse = await twitchApi.chat.sendMessage({
      message: resolvedMessage,
    });

    return messageResponse;
  },

  send_shoutout: async (event, twitchApi) => {
    const to_broadcaster_id = await resolveVariables(event.currentActionContext.to_broadcaster_id, { twitchApi }, event.results);
    const shoutout = await twitchApi.chat.sendShoutout(to_broadcaster_id);
    return shoutout;
  },

  send_announcement: async (event, twitchApi) => {
    const message = await resolveVariables(event.currentActionContext.message, { twitchApi }, event.results);
    const announcement = await twitchApi.chat.sendAnnouncement(message);
    return announcement;
  },

  create_clip: async (event, twitchApi) => {
    const clip = await twitchApi.clips.createClip();
    const clipId = clip.edit_url.split("/")[3];

    const broadcaster_name = await resolveVariables(event.currentActionContext.broadcaster_login, { twitchApi }, event.results);

    const clipUrl = `https://www.twitch.tv/${broadcaster_name}/clip/${clipId}`;

    return {
      ...clip,
      clip_url: clipUrl,
    };
  },
};
