import { TwitchApiBaseClient } from "./base-client";

export interface Marker {
  id: string;
  created_at: string;
  description: string;
  position: number;
}

export interface MarkerOptions {
  user_id?: string;
  video_id?: string;
  first?: number;
  before?: string;
  after?: string;
}

export class TwitchMarkersClient extends TwitchApiBaseClient {
  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }

  async getMarkers(options: MarkerOptions): Promise<{ data: Marker[]; pagination: { cursor?: string } }> {
    const response = await this.clientApi().get("/streams/markers", { params: options });
    return response.data;
  }

  async createMarker(description?: string): Promise<{ data: Marker }> {
    const response = await this.clientApi().post("/streams/markers", {
      user_id: this.broadcaster_id,
      description,
    });
    return response.data.data[0];
  }
}
