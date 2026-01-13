import { TwitchApiBaseClient } from "./base-client";

export interface Clip {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_id: string;
  broadcaster_name: string;
  creator_id: string;
  creator_name: string;
  video_id: string;
  game_id: string;
  language: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
}

export interface GetClipsOptions {
  broadcasterId?: string;
  gameId?: string;
  id?: string[];
  first?: number;
  after?: string;
  before?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface CreateClipOptions {
  hasDelay?: boolean;
}

export class TwitchClipsClient extends TwitchApiBaseClient {
  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }

  async getClips(options: GetClipsOptions): Promise<{ data: Clip[]; pagination: { cursor?: string } }> {
    const response = await this.clientApi().get("/clips", { params: options });
    return response.data;
  }

  async getClipById(clipId: string): Promise<Clip> {
    const response = await this.clientApi().get("/clips", { params: { id: clipId } });
    return response.data.data[0];
  }

  async createClip(): Promise<{ id: string; edit_url: string }> {
    const response = await this.clientApi().post("/clips", null, {
      params: {
        broadcaster_id: this.broadcaster_id,
      },
    });
    return response.data.data[0];
  }
}
