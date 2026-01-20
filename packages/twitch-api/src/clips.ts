import { TwitchApiBaseClient } from "./base-client";
import { Helix } from "@repo/types";

export class TwitchClipsClient extends TwitchApiBaseClient {
  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }

  async getClips(options: Helix.GetClipsParams): Promise<Helix.GetClipsResponse> {
    const response = await this.clientApi().get<Helix.GetClipsResponse>("/clips", { params: options });
    return response.data;
  }


  async createClip(params: Omit<Helix.CreateClipParams, "broadcaster_id">): Promise<Helix.CreateClipResponse> {
    const response = await this.clientApi().post<Helix.CreateClipResponse>("/clips", null, {
      params: {
        broadcaster_id: this.broadcaster_id,
        ...params,
      } as Helix.CreateClipParams,
    });
    return response.data;
  }


  async createClipFromVod(params: Omit<Helix.CreateClipParams, "broadcaster_id">): Promise<Helix.CreateClipResponse> {
    const response = await this.clientApi().post<Helix.CreateClipResponse>('/videos/clips', null, {
      params: {
        broadcaster_id: this.broadcaster_id,
        ...params,
      } as Helix.CreateClipParams,
    });
    return response.data;
  }
}
