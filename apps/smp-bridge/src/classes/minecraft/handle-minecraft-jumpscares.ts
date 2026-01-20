import type { TwitchApi } from "@repo/twitch-api";
import MinecraftAction from "./handle-minecraft-action-base";

export class MinecraftJumpscares extends MinecraftAction {
  constructor(broadcaster_id: string, twitchApi: TwitchApi) {
    super(broadcaster_id, twitchApi);
  }

  public async fakeDamage() {
    await this.execute("jumpscare.fake_damage");
  }

  public async fireworks() {
    await this.execute("jumpscare.fireworks");
  }

  public async doorScare() {
    await this.execute("jumpscare.door_scare");
  }

  public async endermanScare() {
    await this.execute("jumpscare.EndermanJumpscare");
  }

  public async spinningPlayer() {
    await this.execute("jumpscare.SpinningPlayer");
  }

  public async welcome_home(viewer_name: string) {
    await this.execute("jumpscare.welcome_home", {
      viewer_name: viewer_name,
    });
  }
}
