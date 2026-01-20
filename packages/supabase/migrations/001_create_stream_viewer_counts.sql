-- Migration: Create stream_viewer_counts table
-- Purpose: Store periodic viewer count snapshots during live streams
-- Created: 2026-01-20

CREATE TABLE IF NOT EXISTS stream_viewer_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id TEXT NOT NULL,
    broadcaster_id TEXT NOT NULL,
    viewer_count INTEGER NOT NULL,
    game_id TEXT,
    game_name TEXT,
    title TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    offset_seconds INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT fk_broadcaster
        FOREIGN KEY (broadcaster_id) 
        REFERENCES integrations_twitch(twitch_user_id)
        ON DELETE CASCADE
);

-- Index for efficient queries by stream
CREATE INDEX IF NOT EXISTS idx_stream_viewer_counts_stream_id 
    ON stream_viewer_counts(stream_id);

-- Index for broadcaster queries
CREATE INDEX IF NOT EXISTS idx_stream_viewer_counts_broadcaster_id 
    ON stream_viewer_counts(broadcaster_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_stream_viewer_counts_recorded_at 
    ON stream_viewer_counts(recorded_at);

-- Composite index for common query pattern: get viewer counts for a stream ordered by time
CREATE INDEX IF NOT EXISTS idx_stream_viewer_counts_stream_offset 
    ON stream_viewer_counts(stream_id, offset_seconds);

COMMENT ON TABLE stream_viewer_counts IS 'Stores periodic viewer count snapshots during live streams for analytics';
COMMENT ON COLUMN stream_viewer_counts.stream_id IS 'Twitch stream ID from broadcaster_live_status';
COMMENT ON COLUMN stream_viewer_counts.offset_seconds IS 'Seconds since stream started, useful for graph X-axis';
COMMENT ON COLUMN stream_viewer_counts.recorded_at IS 'UTC timestamp when this snapshot was taken';
