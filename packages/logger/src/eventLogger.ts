import type { Database } from "@repo/supabase";
import { supabase } from "@repo/supabase";
import type { EventSubSubscriptionType } from "@repo/types";

type StreamEvent = {
    broadcaster_id: string;
    event_type: EventSubSubscriptionType;
    event_data: any;
    metadata: any;
};

class StreameventsLogger {
    private readonly tableName = "stream_events";
    protected async logEvent(event: Database["public"]["Tables"]["stream_events"]["Insert"]) {
        const { data, error } = await supabase.from(this.tableName).insert(event);
        if (error) {
            throw error;
        }
        return data;
    }

    // check if the streamer is live
    protected async getStreamId(broadcasterId: string): Promise<string | null> {
        const { data, error } = await supabase
            .from("broadcaster_live_status")
            .select("stream_id")
            .eq("broadcaster_id", broadcasterId);
        return data?.[0]?.stream_id ?? null;
    }

    // get the offset from when the stream started
    protected async getOffset(broadcasterId: string): Promise<number> {
        const { data, error } = await supabase
            .from("broadcaster_live_status")
            .select("stream_started_at")
            .eq("broadcaster_id", broadcasterId);

        if (error) {
            throw error;
        }

        if (!data || data.length === 0 || !data[0]?.stream_started_at) {
            throw new Error("Stream start time not found");
        }


        const currentDate = new Date();

        console.log(`Current Date: ${currentDate}`);
        const streamStartedDate = new Date(data[0].stream_started_at);
        console.log(`Stream Started Date: ${data[0].stream_started_at}`);

        const offsetMs = currentDate.getTime() - streamStartedDate.getTime();
        const offsetSeconds = Math.floor(offsetMs / 1000);

        return offsetSeconds;
    }

    // build the database event object
    protected async buildStreamEvent(
        event: StreamEvent
    ): Promise<Database["public"]["Tables"]["stream_events"]["Insert"]> {
        const streamId = await this.getStreamId(event.broadcaster_id);
        if (!streamId) {
            throw new Error("Streamer is not live");
        }

        const offset = await this.getOffset(event.broadcaster_id);

        const streamEvent: Database["public"]["Tables"]["stream_events"]["Insert"] = {
            broadcaster_id: event.broadcaster_id,
            event_type: event.event_type,
            event_data: event.event_data,
            metadata: event.metadata,
            provider: "twitch",
            stream_id: streamId,
            offset_seconds: offset,
        };

        return streamEvent;
    }

    // log a twitch event
    public async logTwitchEvent(event: StreamEvent) {
        const streamEvent = await this.buildStreamEvent(event);

        return await this.logEvent(streamEvent);
    }
}

export const streamEventsLogger = new StreameventsLogger();