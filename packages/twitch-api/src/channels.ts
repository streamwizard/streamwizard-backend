import { TwitchApiBaseClient } from "./base-client";

export interface UpdateChannelParams {
  title?: string;
  game_id?: string;
}

/** The subset of `GET /channels` we use. Helix returns a good deal more. */
export interface ChannelInformation {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  broadcaster_language: string;
  game_id: string;
  game_name: string;
  title: string;
  tags: string[];
}

export class TwitchChannelsClient extends TwitchApiBaseClient {
  /** Update the broadcaster's channel title and/or game. Requires `channel:manage:broadcast` scope. */
  async updateChannelInfo(broadcasterId: string, params: UpdateChannelParams): Promise<void> {
    await this.clientApi().patch("/channels", params, {
      params: { broadcaster_id: broadcasterId },
    });
  }

  /**
   * The channel's current title and category, straight from Twitch.
   *
   * Read live rather than from our own tables because the streamer may have
   * changed it from the Twitch app or a mod tool since we last saw a
   * `channel.update`, and an editor that opens on a stale title will happily
   * write that stale title back.
   *
   * App token: no scope required.
   */
  async getChannelInformation(broadcasterId: string): Promise<ChannelInformation | undefined> {
    const response = await this.appApi().get<{ data: ChannelInformation[] }>("/channels", {
      params: { broadcaster_id: broadcasterId },
    });
    return response.data.data?.[0];
  }
}
