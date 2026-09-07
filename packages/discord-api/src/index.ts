import { DiscordMembersClient, type DiscordApiConfig } from "./members";

export { DiscordMemberNotFoundError } from "./errors";
export type { DiscordApiConfig } from "./members";
export {
  sendDiscordDirectMessage,
  type DiscordMessagePayload,
  type DiscordEmbed,
  type DiscordLinkButton,
} from "./dm";
export { sendDiscordChannelMessage, DiscordRateLimitError } from "./channel";

export class DiscordApi {
  public members: DiscordMembersClient;

  constructor(config: DiscordApiConfig) {
    this.members = new DiscordMembersClient(config);
  }
}
