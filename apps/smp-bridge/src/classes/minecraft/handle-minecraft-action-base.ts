import { TwitchApi } from "@repo/twitch-api";
import { minecraftWebSocketServer } from "@/services/minecraftWebsocketServer";
import { MinecraftActionsType } from "@/types/minecraft-outgoing-websocket-messages";

class MinecraftActionBase {
  protected broadcaster_user_id: string;
  protected twitchApi: TwitchApi;

  constructor(broadcaster_id: string, twitchApi: TwitchApi) {
    this.broadcaster_user_id = broadcaster_id;
    this.twitchApi = twitchApi;
  }

  async execute(action: MinecraftActionsType, metadata?: Record<string, any>) {
    const minecraft_uuid = await this.getPlayerUUID();

    await minecraftWebSocketServer.broadcast({
      action: action,
      player_uuid: minecraft_uuid,
      streamer_id: this.broadcaster_user_id,
      metadata: metadata,
    });
  }

  private async getPlayerUUID(): Promise<string> {
    return "82e95e4f-1bb4-4d84-93be-c94d73151661";
  }
}

export default MinecraftActionBase;
