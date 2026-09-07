import { TwitchApiBaseClient } from "./base-client";

export interface ChannelSearchResult {
  broadcaster_language: string;
  broadcaster_login: string;
  display_name: string;
  game_id: string;
  game_name: string;
  id: string;
  is_live: boolean;
  tags: string[];
  thumbnail_url: string;
  title: string;
}

export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  type: string;
  broadcaster_type: string;
  description: string;
  profile_image_url: string;
  offline_image_url: string;
  view_count: number | null;
  created_at: string;
}

export interface TwitchGame {
  id: string;
  name: string;
  box_art_url: string;
  igdb_id: string;
}

export interface TwitchCategory {
  id: string;
  name: string;
  box_art_url: string;
}

export class TwitchSearchClient extends TwitchApiBaseClient {
  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }

  /** Search Twitch channels by name or display name. */
  async searchChannels(query: string, first: number = 10): Promise<ChannelSearchResult[]> {
    const response = await this.appApi().get("/search/channels", { params: { query, first } });
    return response.data.data ?? [];
  }

  /** Search Twitch categories (games) by name. */
  async searchCategories(query: string, first: number = 10): Promise<TwitchCategory[]> {
    const response = await this.appApi().get("/search/categories", { params: { query, first } });
    return response.data.data ?? [];
  }

  /** Look up a Twitch user by their numeric user ID. */
  async lookupUser(userId: string): Promise<TwitchUser | undefined> {
    const response = await this.appApi().get("/users", { params: { id: userId } });
    return response.data.data?.[0];
  }

  /**
   * Look up up to 100 Twitch users in one call — Helix's own per-request cap.
   * Callers with more ids should chunk; this throws rather than silently
   * truncating, because a partial user map renders as missing avatars.
   */
  async lookupUsers(userIds: string[]): Promise<TwitchUser[]> {
    if (userIds.length === 0) return [];
    if (userIds.length > 100) {
      throw new Error(`lookupUsers accepts at most 100 ids, got ${userIds.length}`);
    }
    const response = await this.appApi().get("/users", {
      params: { id: userIds },
      // Helix wants `id=a&id=b`; axios would otherwise emit `id[]=a&id[]=b`.
      paramsSerializer: { indexes: null },
    });
    return response.data.data ?? [];
  }

  /** Look up a Twitch game/category by its numeric game ID. */
  async lookupGame(gameId: string): Promise<TwitchGame | undefined> {
    const response = await this.appApi().get("/games", { params: { id: gameId } });
    return response.data.data?.[0];
  }

  /** Look up up to 100 Twitch games/categories in one call. */
  async lookupGames(gameIds: string[]): Promise<TwitchGame[]> {
    if (gameIds.length === 0) return [];
    if (gameIds.length > 100) {
      throw new Error(`lookupGames accepts at most 100 ids, got ${gameIds.length}`);
    }
    const response = await this.appApi().get("/games", {
      params: { id: gameIds },
      paramsSerializer: { indexes: null },
    });
    return response.data.data ?? [];
  }
}
