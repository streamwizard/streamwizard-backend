import { TwitchApiBaseClient } from "./base-client";

/**
 * A cheermote tier's images, keyed the way Helix returns them:
 * images[theme][format][scale] — e.g. images.dark.animated["4"].
 */
export interface TwitchCheermoteTier {
  min_bits: number;
  id: string;
  color: string;
  images: Record<string, Record<string, Record<string, string>>>;
  can_cheer: boolean;
  show_in_bits_card: boolean;
}

export interface TwitchCheermote {
  prefix: string;
  tiers: TwitchCheermoteTier[];
  type: string;
  order: number;
  last_updated: string;
  is_charitable: boolean;
}

export class TwitchBitsClient extends TwitchApiBaseClient {
  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }

  /**
   * Global cheermotes plus this channel's custom ones. EventSub message
   * fragments carry only `{prefix, bits, tier}`, so this is the only source for
   * the animated bit graphics those fragments stand for.
   */
  async getCheermotes(): Promise<TwitchCheermote[]> {
    const response = await this.appApi().get("/bits/cheermotes", {
      params: this.broadcaster_id ? { broadcaster_id: this.broadcaster_id } : {},
    });
    return response.data.data ?? [];
  }
}
