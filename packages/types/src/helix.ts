/**
 * Twitch Helix API Types
 * Reference: https://dev.twitch.tv/docs/api/reference/
 */

// ==============================================================================
// 1. Common Structures
// ==============================================================================

export interface Pagination {
    cursor?: string;
}

export interface Response<T> {
    data: T[];
    pagination?: Pagination;
}

// ==============================================================================
// 2. Clips
// ==============================================================================

/**
 * Parameters for the Get Clips request.
 * The broadcaster_id, game_id, and id parameters are mutually exclusive.
 */
export type GetClipsParams = (
    | { broadcaster_id: string; game_id?: never; id?: never }
    | { game_id: string; broadcaster_id?: never; id?: never }
    | { id: string | string[]; broadcaster_id?: never; game_id?: never }
) & {
    started_at?: string;
    ended_at?: string;
    first?: number;
    before?: string;
    after?: string;
    is_featured?: boolean;
};



export type GetClipsResponse = Response<{
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
    vod_offset: number | null;
    is_featured: boolean;
}>;


export type CreateClipParams = {
    broadcaster_id: string;
    title?: string;
    duration?: number;
};

export type CreateClipResponse = Response<{ id: string; edit_url: string; }>;


/**
 * Parameters for the Create Clip from VOD request.
 * URL: POST https://api.twitch.tv/helix/videos/clips
 */
export type CreateClipFromVodParams = {
    editor_id: string;
    broadcaster_id: string;
    vod_id: string;
    vod_offset: number;
    duration?: number;
    title: string;
};

export type CreateClipFromVodResponse = Response<{
    id: string;
    edit_url: string;
}>;


// ==============================================================================
// 3. Streams
// ==============================================================================

/**
 * Parameters for the Get Streams request.
 * Reference: https://dev.twitch.tv/docs/api/reference/#get-streams
 */
export interface GetStreamsParams {
    /** User IDs to filter streams (max 100) */
    user_id?: string | string[];
    /** User login names to filter streams (max 100) */
    user_login?: string | string[];
    /** Game/category IDs to filter streams (max 100) */
    game_id?: string | string[];
    /** Type of stream: 'all' or 'live' (default: 'all') */
    type?: 'all' | 'live';
    /** Language codes to filter streams (max 100, ISO 639-1) */
    language?: string | string[];
    /** Maximum items per page (1-100, default: 20) */
    first?: number;
    /** Cursor for previous page */
    before?: string;
    /** Cursor for next page */
    after?: string;
}

/**
 * Stream object returned by the Get Streams endpoint
 */
export interface Stream {
    /** Stream ID (can be used to look up VOD later) */
    id: string;
    /** Broadcaster's user ID */
    user_id: string;
    /** Broadcaster's login name */
    user_login: string;
    /** Broadcaster's display name */
    user_name: string;
    /** Game/category ID being played */
    game_id: string;
    /** Game/category name being played */
    game_name: string;
    /** Stream type: 'live' or empty string on error */
    type: string;
    /** Stream title (empty string if not set) */
    title: string;
    /** Tags applied to the stream */
    tags: string[];
    /** Number of viewers watching */
    viewer_count: number;
    /** UTC timestamp when broadcast began (RFC3339 format) */
    started_at: string;
    /** Language code (ISO 639-1 or 'other') */
    language: string;
    /** URL to thumbnail image ({width}x{height} placeholders) */
    thumbnail_url: string;
    /** @deprecated As of Feb 28, 2023 - returns empty array */
    tag_ids: string[];
    /** Whether stream is for mature audiences */
    is_mature: boolean;
}

export type GetStreamsResponse = Response<Stream>;
