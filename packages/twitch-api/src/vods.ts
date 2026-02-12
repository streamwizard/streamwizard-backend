import { GetVodsResponse } from "@repo/types";
import { TwitchApiBaseClient } from "./base-client";

export interface Vod {
  id: string;
  stream_id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  title: string;
  description: string;
  created_at: string;
  published_at: string;
  url: string;
  thumbnail_url: string;
  viewable: string;
  view_count: number;
  language: string;
  type: string;
  duration: string;
}

export interface GetVodsOptions {
  userId?: string;
  gameId?: string;
  first?: number;
  after?: string;
  before?: string;
  language?: string;
  period?: "all" | "day" | "week" | "month";
  sort?: "time" | "trending" | "views";
  type?: "all" | "upload" | "archive" | "highlight";
}

export class TwitchVodsClient extends TwitchApiBaseClient {
  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }

  async getVods(options: GetVodsOptions): Promise<{ data: Vod[]; pagination: { cursor?: string } }> {
    const response = await this.clientApi().get("/videos", { params: options });
    return response.data.data;
  }

  async getVodById(vodId: string): Promise<Vod> {
    const response = await this.clientApi().get("/videos", { params: { id: vodId } });
    return response.data.data[0];
  }

  async getVodByBroadcasterId(broadcasterId: string): Promise<GetVodsResponse> {
    const response = await this.clientApi().get<GetVodsResponse>("/videos", { params: { user_id: broadcasterId } });
    return response.data;
  }
}
