import { TwitchApi } from "@repo/twitch-api";
import MinecraftActionBase from "./handle-minecraft-action-base";
import { MinecraftDisasters } from "./handle-minecraft-disasters";
import { MinecraftEvents } from "./handle-minecraft-events";
import { MinecraftJumpscares } from "./handle-minecraft-jumpscares";

export class MinecraftActions {
  protected minecraftActionBase: MinecraftActionBase;
  public Events: MinecraftEvents;
  public Jumpscares: MinecraftJumpscares;
  public Disasters: MinecraftDisasters;

  constructor(broadcaster_id: string, twitchApi: TwitchApi) {
    this.minecraftActionBase = new MinecraftActionBase(broadcaster_id, twitchApi);
    this.Events = new MinecraftEvents(broadcaster_id, twitchApi);
    this.Jumpscares = new MinecraftJumpscares(broadcaster_id, twitchApi);
    this.Disasters = new MinecraftDisasters(broadcaster_id, twitchApi);
  }
}
