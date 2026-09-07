import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import type { IngestStatsPayload } from "@repo/types";
import type { EffectiveConfig } from "../config-store";
import type { StatusPublisher } from "../status-publisher";
import { UserMonitor, type MonitorDeps } from "./user-monitor";
import { clearSwitchLog } from "./switch-log";
import { resolveSceneItemId, setScene, setSceneItemEnabledById, stopStream, invalidateInstanceCache } from "../actions/obs-client";
import { sendChatNotice, clearChatCaches } from "../actions/chat";
import { logSwitchEvent } from "../actions/event-log";
import { clearSceneOverride } from "@repo/supabase/queries/auto-switcher";

const TICK_MS = 1_000;

export class Engine {
  private monitors = new Map<string, UserMonitor>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private deps: MonitorDeps;

  constructor(statusPublisher: StatusPublisher) {
    this.deps = {
      setScene: async (userId, sceneUuid) => {
        const result = await setScene(userId, sceneUuid);
        if (!result.ok) invalidateInstanceCache(userId);
        return { ok: result.ok, error: result.error };
      },
      stopStream: async (userId) => {
        const result = await stopStream(userId);
        return { ok: result.ok, error: result.error };
      },
      resolveSceneItemId,
      setSceneItemEnabled: async (userId, sceneUuid, sceneItemId, enabled) => {
        const result = await setSceneItemEnabledById(userId, sceneUuid, sceneItemId, enabled);
        return { ok: result.ok, error: result.error };
      },
      sendChat: sendChatNotice,
      logEvent: logSwitchEvent,
      clearOverride: async (userId) => {
        const { error } = await clearSceneOverride(supabase, userId);
        if (error) throw error;
      },
      publishStatus: (userId, status) => statusPublisher.publish(userId, status),
    };
  }

  start(): void {
    this.tickTimer = setInterval(() => {
      const now = Date.now();
      for (const monitor of this.monitors.values()) {
        try {
          monitor.onTick(now);
        } catch (err) {
          reportError(err, "engine.tick");
        }
      }
    }, TICK_MS);
  }

  stop(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
  }

  get monitorCount(): number {
    return this.monitors.size;
  }

  onConfigChanged(userId: string, config: EffectiveConfig | null): void {
    if (!config) {
      if (this.monitors.delete(userId)) {
        clearSwitchLog(userId);
        // Chat's caches are module-level and keyed by user, so without this they
        // keep an entry per user who ever had the feature on, for the life of
        // the process.
        clearChatCaches(userId);
        console.log(`[engine] monitor removed user=${userId}`);
      }
      return;
    }
    const existing = this.monitors.get(userId);
    if (existing) {
      existing.applyConfig(config, Date.now());
    } else {
      const monitor = new UserMonitor(userId, config, this.deps);
      this.monitors.set(userId, monitor);
      console.log(`[engine] monitor created user=${userId}`);
    }
  }

  onStats(userId: string, payload: IngestStatsPayload): void {
    if (!payload || typeof payload.session_id !== "string") return;
    this.monitors.get(userId)?.onStats(payload, Date.now());
  }

  onSessionEnded(userId: string, payload: unknown): void {
    const sessionId = (payload as { session_id?: string })?.session_id;
    if (typeof sessionId !== "string") return;
    this.monitors.get(userId)?.onSessionEnded(sessionId, Date.now());
  }
}
