import type { IngestStatsPayload } from "@repo/types";

export interface TrackedSession {
  sessionId: string;
  label: string | null;
  firstSeenMs: number;
  lastSeenMs: number;
  latest: IngestStatsPayload;
}

// Sessions we haven't heard from in this long are dropped entirely (well past
// any configurable offline timeout — this is garbage collection, not offline
// detection).
const PRUNE_AFTER_MS = 120_000;

/**
 * Tracks every ingest session per user (a streamer can push multiple stream
 * keys at once — phone + backup encoder) and picks the one the monitor
 * watches: a pinned stream-key label wins; otherwise the most recently
 * started session that is still fresh.
 */
export class SessionTracker {
  private sessions = new Map<string, TrackedSession>();

  record(payload: IngestStatsPayload, now: number): TrackedSession {
    const existing = this.sessions.get(payload.session_id);
    if (existing) {
      existing.lastSeenMs = now;
      existing.latest = payload;
      if (payload.label) existing.label = payload.label;
      return existing;
    }
    const session: TrackedSession = {
      sessionId: payload.session_id,
      label: payload.label ?? null,
      firstSeenMs: now,
      lastSeenMs: now,
      latest: payload,
    };
    this.sessions.set(payload.session_id, session);
    return session;
  }

  /** Immediately forget a session (ingest_session_ended push). */
  drop(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * The session the monitor should watch right now, or null when none
   * qualifies. `freshWithinMs` is the config's offline timeout: sessions
   * silent longer than that don't count as candidates.
   */
  select(pinnedLabel: string | null, freshWithinMs: number, now: number): TrackedSession | null {
    this.prune(now);

    let best: TrackedSession | null = null;
    for (const session of this.sessions.values()) {
      if (pinnedLabel && session.label !== pinnedLabel) continue;
      if (now - session.lastSeenMs > freshWithinMs) continue;
      if (!best || session.firstSeenMs > best.firstSeenMs) best = session;
    }
    return best;
  }

  get(sessionId: string): TrackedSession | undefined {
    return this.sessions.get(sessionId);
  }

  private prune(now: number): void {
    for (const [id, session] of this.sessions) {
      if (now - session.lastSeenMs > PRUNE_AFTER_MS) this.sessions.delete(id);
    }
  }
}
