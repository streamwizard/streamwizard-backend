import { TwitchApiBaseClient } from "./base-client";
import type { Stream, GetStreamsParams, GetStreamsResponse } from "@repo/types";


export class TwitchStreamsClient extends TwitchApiBaseClient {
    constructor(broadcaster_id: string | null = null) {
        super(broadcaster_id);
    }

    /**
     * Get a single stream for the broadcaster
     * @param options - Options for filtering the stream
     * @returns The stream object or undefined if not live
     */
    async getStream(params: GetStreamsParams = {}): Promise<Stream | undefined> {
        const response = await this.clientApi().get<GetStreamsResponse>(`/streams`, {
            params: {
                user_id: this.broadcaster_id,
                type: params.type || "live",
                first: params.first || 1,
                ...params,
            } as GetStreamsParams,
        });
        return response.data.data[0];
    }

    /**
     * Get a list of streams with full filtering and pagination support
     * @param params - Parameters for filtering and pagination
     * @returns Response containing array of streams and pagination info
     */
    async getStreams(params?: GetStreamsParams): Promise<GetStreamsResponse> {
        const response = await this.clientApi().get<GetStreamsResponse>(`/streams`, {
            params: params,
        });
        return response.data;
    }
}
