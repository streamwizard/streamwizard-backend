import type {
  AutoSwitcherStatus,
  AutoSwitcherSwitchEntry,
  AutoSwitcherSwitchReason,
  AutoSwitcherThresholds,
} from "@repo/schemas";
import type { IngestStatsPayload } from "@repo/types";
import { trackAutoSwitcherEvent } from "@repo/metrics";
import type { EffectiveConfig } from "../config-store";
import type { ChatNoticeKind } from "../actions/chat";
import { SessionTracker, type TrackedSession } from "./session-tracker";
import { METRICS, MetricStreaks, pollLimits, type MetricKey } from "./metric-streaks";
import { recordSwitch, getSwitchLog } from "./switch-log";

// Port of xpudu monitoring's per-path state machine (handlePathMetrics /
// PathSwitchState) onto the 1 Hz ingest_stats feed: per-metric bad/good
// streaks with independent trigger/recover/startup poll counts, a startup
// gate before first going live, timeout-based offline detection, manual
// override with expiry, and typed switch reasons with human detail strings.

type Phase = "idle" | "startup" | "live" | "degraded" | "offline";

interface SceneTarget {
  uuid: string;
  name: string | null;
}

// Warning-band constants (feature d): show the "unstable connection" source
// once any metric has been bad this many consecutive polls while still LIVE,
// hide once everything has been good this many. Fixed in v1.
const WARNING_SHOW_BAD_POLLS = 2;
const WARNING_HIDE_GOOD_POLLS = 5;

// Failed scene switches retry at most this often (the tick would otherwise
// hammer an unreachable node once per second).
const SWITCH_RETRY_MS = 5_000;

const STATUS_HEARTBEAT_TICKS = 5;

// How long a pending all-clear stays owed. Chat is owed "back live" only while
// the outage it belongs to is still the same broadcast: ending a stream also
// ends the ingest session, which posts "signal lost" and leaves the debt
// standing, so the next stream's startup gate would greet fresh chat with a
// recovery notice for a connection that was never broken. Long enough to cover
// any dropout still worth announcing to the viewers who waited it out, short
// enough to fall inside a between-stream gap or a break.
const ALL_CLEAR_TTL_MS = 10 * 60_000;

export interface MonitorDeps {
  setScene(userId: string, sceneUuid: string): Promise<{ ok: boolean; error?: string }>;
  stopStream(userId: string): Promise<{ ok: boolean; error?: string }>;
  resolveSceneItemId(userId: string, sceneUuid: string, sourceUuid: string | null, sourceName: string | null): Promise<number | null>;
  setSceneItemEnabled(userId: string, sceneUuid: string, sceneItemId: number, enabled: boolean): Promise<{ ok: boolean; error?: string }>;
  sendChat(userId: string, kind: ChatNoticeKind, template: string, vars: { bitrate?: number; rtt?: number; loss?: number; scene?: string }): Promise<void>;
  logEvent(userId: string, entry: AutoSwitcherSwitchEntry, metrics: IngestStatsPayload | null): Promise<void>;
  clearOverride(userId: string): Promise<void>;
  publishStatus(userId: string, status: AutoSwitcherStatus): void;
}

export class UserMonitor {
  private cfg: EffectiveConfig;
  private tracker = new SessionTracker();

  private phase: Phase = "idle";
  private selectedSessionId: string | null = null;
  private readonly streaks = new MetricStreaks();
  private latestStats: IngestStatsPayload | null = null;

  private overrideEngagedUuid: string | null = null;

  private offlineSince: number | null = null;
  private autoStopDone = false;

  // When chat was last told something is wrong, while it is still owed the
  // all-clear. This, not the phase we recovered *from*, is what decides whether
  // a go-live posts "back live":
  //
  //   - Cold start, chat heard nothing: nothing to reassure it about, stay quiet.
  //   - Recovered from a degrade: post.
  //   - Signal came back after a total loss: post. This is the case the old
  //     detail-string check got wrong — a resumed session re-passes the startup
  //     gate (see onStats), so the go-live carried the startup detail string and
  //     was suppressed as if chat had never heard "signal lost". Users with
  //     nothing but hard dropouts therefore only ever saw one of their three
  //     messages.
  //   - The debt went stale (ALL_CLEAR_TTL_MS) or the switcher stopped the
  //     stream: that outage belongs to a broadcast that is over. Stay quiet.
  private chatAllClearOwedAt: number | null = null;

  private warningShown = false;
  private warningItemId: number | null = null;
  private warningBusy = false;

  private appliedScene: SceneTarget | null = null;
  private intendedScene: SceneTarget | null = null;
  private pendingReason: AutoSwitcherSwitchReason | null = null;
  private pendingDetail = "";
  private switchBusy = false;
  private lastSwitchAttemptAt = 0;
  private lastError: string | null = null;

  private tickCount = 0;

  // Fingerprint of the last status we published, so onStats can publish the
  // streak build-up without publishing every second of a healthy stream.
  // See statusKey().
  private lastPublishedKey: string | null = null;

  constructor(
    private userId: string,
    config: EffectiveConfig,
    private deps: MonitorDeps,
  ) {
    this.cfg = config;
    // Without this a monitor created mid-session says nothing until the first
    // heartbeat, so an overlay opened at that moment renders blank for 5s.
    this.publish(Date.now());
  }

  // ── config / override ──────────────────────────────────────────────────

  applyConfig(config: EffectiveConfig, now: number): void {
    const prevOverrideUuid = this.activeOverrideUuid(now);
    this.cfg = config;
    const nextOverrideUuid = this.activeOverrideUuid(now);

    if (nextOverrideUuid && nextOverrideUuid !== this.overrideEngagedUuid) {
      this.overrideEngagedUuid = nextOverrideUuid;
      this.requestSwitch(
        { uuid: nextOverrideUuid, name: this.cfg.row.override_scene_name },
        "override",
        "manual override engaged",
        now,
      );
    } else if (!nextOverrideUuid && (prevOverrideUuid || this.overrideEngagedUuid)) {
      this.resumeFromOverride(now);
    }

    this.publish(now);
  }

  private activeOverrideUuid(now: number): string | null {
    const { override_scene_uuid, override_expires_at } = this.cfg.row;
    if (!override_scene_uuid) return null;
    if (override_expires_at && new Date(override_expires_at).getTime() <= now) return null;
    return override_scene_uuid;
  }

  // xpudu clearOverride: re-enter fallback with zeroed good streaks so the
  // full recovery gate must pass before going back to the live scene — or,
  // if the feed is dead, let the tick take it to offline.
  private resumeFromOverride(now: number): void {
    this.overrideEngagedUuid = null;
    this.streaks.resetGood();
    if (this.phase !== "idle") {
      this.phase = "degraded";
      this.offlineSince = null;
    }
    this.evaluate(now);
  }

  // ── inputs ─────────────────────────────────────────────────────────────

  onStats(payload: IngestStatsPayload, now: number): void {
    this.tracker.record(payload, now);

    const selected = this.tracker.select(
      this.cfg.row.pinned_stream_key_label,
      this.offlineTimeoutMs(),
      now,
    );
    if (!selected) return;

    if (selected.sessionId !== this.selectedSessionId) {
      this.startWatching(selected, now);
    }
    if (payload.session_id !== this.selectedSessionId) return;

    this.latestStats = payload;

    // A silent-then-resumed session must re-pass the startup gate, exactly
    // like a brand new one.
    if (this.phase === "offline") {
      this.phase = "startup";
      this.streaks.reset();
      this.offlineSince = null;
      this.autoStopDone = false;
    }

    this.streaks.update(payload, this.cfg.thresholds);
    this.evaluate(now);
    // evaluate() only publishes on a phase change, so without this the whole
    // pre-switch build-up ("bitrate bad 1/3, 2/3…") is invisible until the 5s
    // heartbeat — and on the `fast` preset the entire warning window is 2s, so
    // it would usually never be seen at all.
    this.publishIfChanged(now);
  }

  onSessionEnded(sessionId: string, now: number): void {
    this.tracker.drop(sessionId);
    if (sessionId === this.selectedSessionId) {
      // Another fresh session may take over immediately; otherwise offline.
      const next = this.tracker.select(this.cfg.row.pinned_stream_key_label, this.offlineTimeoutMs(), now);
      if (next) {
        this.startWatching(next, now);
        this.evaluate(now);
      } else {
        this.enterOffline(now, "ingest session ended");
      }
    }
    // enterOffline's own publish only lands once the scene switch resolves, so
    // without this the drop to Standby waits on a network round trip -- or on
    // the heartbeat, if no scenes are configured.
    this.publishIfChanged(now);
  }

  onTick(now: number): void {
    this.tickCount++;

    // Override expiry sweeps here (config pushes only arrive on writes).
    if (this.overrideEngagedUuid && !this.activeOverrideUuid(now)) {
      this.deps
        .clearOverride(this.userId)
        .catch((err) => console.warn(`[monitor] override clear failed user=${this.userId}:`, (err as Error).message));
      this.resumeFromOverride(now);
    }

    // Offline detection: the selected session went silent past the timeout.
    if (this.selectedSessionId && this.phase !== "offline" && this.phase !== "idle" && !this.overrideEngagedUuid) {
      const selected = this.tracker.select(this.cfg.row.pinned_stream_key_label, this.offlineTimeoutMs(), now);
      if (!selected) {
        this.enterOffline(now, `no stats for ${this.cfg.thresholds.offline_timeout_seconds}s`);
      } else if (selected.sessionId !== this.selectedSessionId) {
        this.startWatching(selected, now);
      }
    }

    // Auto stop-stream after N continuous offline minutes (feature e).
    if (
      this.phase === "offline" &&
      this.cfg.row.auto_stop_enabled &&
      !this.autoStopDone &&
      this.offlineSince !== null &&
      now - this.offlineSince >= this.cfg.row.auto_stop_minutes * 60_000
    ) {
      this.autoStopDone = true;
      trackAutoSwitcherEvent("auto_stop");
      this.fireAutoStop(now);
    }

    // Retry a switch that failed (node briefly unreachable, OBS restarting).
    if (
      this.intendedScene &&
      this.intendedScene.uuid !== this.appliedScene?.uuid &&
      !this.switchBusy &&
      now - this.lastSwitchAttemptAt >= SWITCH_RETRY_MS
    ) {
      this.executeSwitch(now, true);
    }

    // The heartbeat exists so a consumer can tell "the engine is alive and this
    // stream is fine" from "the engine died". With nothing being watched there
    // is nothing to be alive about, and a monitor exists for every *enabled*
    // config rather than every live stream -- so beating while idle meant every
    // enabled user cost 0.2 msg/s around the clock, streaming or not, fanned out
    // to every monitor and consumer. At rest we publish the transition and then
    // shut up; changes still report immediately below.
    if (this.tickCount % STATUS_HEARTBEAT_TICKS === 0 && this.currentSession(now)) {
      this.publish(now);
    } else {
      this.publishIfChanged(now);
    }
  }

  // ── state machine ──────────────────────────────────────────────────────

  private startWatching(session: TrackedSession, now: number): void {
    console.log(`[monitor] user=${this.userId} watching session=${session.sessionId} label=${session.label ?? "-"}`);
    this.selectedSessionId = session.sessionId;
    this.latestStats = session.latest;
    this.streaks.reset();
    this.phase = "startup";
    this.offlineSince = null;
    this.autoStopDone = false;
  }

  private evaluate(now: number): void {
    if (this.overrideEngagedUuid) return;
    if (!this.selectedSessionId) return;

    const scenes = this.sceneTargets();
    if (!scenes) return; // not fully configured — nothing to switch to

    if (this.phase === "startup") {
      const bad = this.streaks.badMetrics("startup", this.cfg.thresholds);
      if (bad.length > 0) {
        // Bad from the start: go straight to the fallback scene (xpudu
        // startup gate) and require a full recovery to come back.
        this.phase = "degraded";
        this.requestSwitch(scenes.degraded, "auto_fallback", this.fallbackDetail(bad), now);
      } else if (this.streaks.allRecovered("startup", this.cfg.thresholds)) {
        this.phase = "live";
        this.requestSwitch(scenes.live, "auto_recover", "startup complete — link stable", now);
      }
      return;
    }

    if (this.phase === "live") {
      const bad = this.streaks.badMetrics("trigger", this.cfg.thresholds);
      if (bad.length > 0) {
        this.phase = "degraded";
        this.setWarningSource(false, scenes.live);
        this.requestSwitch(scenes.degraded, "auto_fallback", this.fallbackDetail(bad), now);
        return;
      }
      this.updateWarningSource(scenes.live);
      return;
    }

    if (this.phase === "degraded") {
      if (this.streaks.allRecovered("recover", this.cfg.thresholds)) {
        this.phase = "live";
        this.setWarningSource(false, scenes.live);
        this.requestSwitch(scenes.live, "auto_recover", this.recoverDetail(), now);
      }
    }
  }

  private enterOffline(now: number, why: string): void {
    if (this.phase === "offline" || this.phase === "idle") return;
    const scenes = this.sceneTargets();
    this.phase = "offline";
    this.offlineSince = now;
    this.streaks.reset();
    if (scenes && !this.overrideEngagedUuid) {
      this.requestSwitch(scenes.offline, "auto_offline", why, now);
    } else {
      this.publish(now);
    }
  }

  // ── scene switching ────────────────────────────────────────────────────

  private sceneTargets(): { live: SceneTarget; degraded: SceneTarget; offline: SceneTarget } | null {
    const { row } = this.cfg;
    if (!row.scene_live_uuid || !row.scene_offline_uuid) return null;
    const live = { uuid: row.scene_live_uuid, name: row.scene_live_name };
    const offline = { uuid: row.scene_offline_uuid, name: row.scene_offline_name };
    // 2-scene model (or an unset degraded scene): degraded quality drops
    // straight to the offline/"connection lost" scene.
    const degraded =
      row.scene_model === "three" && row.scene_degraded_uuid
        ? { uuid: row.scene_degraded_uuid, name: row.scene_degraded_name }
        : offline;
    return { live, degraded, offline };
  }

  private requestSwitch(target: SceneTarget, reason: AutoSwitcherSwitchReason, detail: string, now: number): void {
    if (this.appliedScene?.uuid === target.uuid && !this.lastError) {
      // No OBS call needed, but the state transition still happened and still has
      // to be announced. In the 2-scene model (and any 3-scene config with the
      // degraded scene unset) degraded and offline are the *same* scene, so the
      // drop from degraded to offline landed here — and returning early meant its
      // chat notice and event-log entry were never dispatched at all. Every
      // requestSwitch call corresponds to one phase transition, so this cannot
      // fire twice for the same event.
      this.onSwitched({
        at: Date.now(),
        from_scene: this.appliedScene?.name ?? null,
        to_scene: target.name ?? target.uuid,
        reason,
        detail,
        session_id: this.selectedSessionId,
        label: this.latestStats?.label ?? null,
      });
      this.publish(now);
      return;
    }
    this.intendedScene = target;
    this.pendingReason = reason;
    this.pendingDetail = detail;
    this.executeSwitch(now, false);
  }

  private executeSwitch(now: number, isRetry: boolean): void {
    const target = this.intendedScene;
    if (!target || this.switchBusy) return;

    this.switchBusy = true;
    this.lastSwitchAttemptAt = now;
    const reason = this.pendingReason ?? "auto_fallback";
    const detail = isRetry ? `${this.pendingDetail} (retry)` : this.pendingDetail;

    this.deps
      .setScene(this.userId, target.uuid)
      .then((result) => {
        if (!result.ok) {
          this.lastError = result.error ?? "scene switch failed";
          trackAutoSwitcherEvent("switch_failed", reason);
          console.warn(`[monitor] switch failed user=${this.userId} scene=${target.name ?? target.uuid}: ${this.lastError}`);
          return;
        }
        this.lastError = null;
        const entry: AutoSwitcherSwitchEntry = {
          at: Date.now(),
          from_scene: this.appliedScene?.name ?? null,
          to_scene: target.name ?? target.uuid,
          reason,
          detail,
          session_id: this.selectedSessionId,
          label: this.latestStats?.label ?? null,
        };
        this.appliedScene = target;
        this.onSwitched(entry);
      })
      .catch((err) => {
        this.lastError = (err as Error).message;
        console.warn(`[monitor] switch errored user=${this.userId}: ${this.lastError}`);
      })
      .finally(() => {
        this.switchBusy = false;
        // A newer intent may have queued while this switch was in flight
        // (e.g. degraded right after go-live) — chain it immediately rather
        // than waiting for the tick retry. Failures stay on the tick-retry
        // path so an unreachable node can't busy-loop here.
        if (!this.lastError && this.intendedScene && this.intendedScene.uuid !== this.appliedScene?.uuid) {
          this.executeSwitch(Date.now(), false);
        }
        this.publish(Date.now());
      });
  }

  /** Every successful switch flows through here — the feature-toggle dispatcher. */
  private onSwitched(entry: AutoSwitcherSwitchEntry): void {
    console.log(`[monitor] user=${this.userId} switched to "${entry.to_scene}" (${entry.reason}: ${entry.detail})`);
    trackAutoSwitcherEvent("switch", entry.reason);
    recordSwitch(this.userId, entry);

    const { row } = this.cfg;

    if (row.log_events_enabled) {
      void this.deps.logEvent(this.userId, entry, this.latestStats);
    }

    if (row.chat_notices_enabled) {
      const vars = {
        bitrate: this.latestStats?.kbps,
        rtt: this.latestStats?.rtt_ms,
        // drop_pct, not loss_pct — {loss} has to be the number the engine
        // judged, or a switch caused by drops announces raw link loss instead.
        // Same reason buildStatus maps drop_pct onto its loss_pct field.
        loss: this.latestStats?.drop_pct,
        scene: entry.to_scene,
      };
      if (entry.reason === "auto_fallback") {
        this.chatAllClearOwedAt = entry.at;
        void this.deps.sendChat(this.userId, "degraded", row.chat_template_degraded, vars);
      } else if (entry.reason === "auto_offline") {
        this.chatAllClearOwedAt = entry.at;
        void this.deps.sendChat(this.userId, "offline", row.chat_template_offline, vars);
      } else if (entry.reason === "auto_recover" && this.allClearOwed(entry.at)) {
        this.chatAllClearOwedAt = null;
        void this.deps.sendChat(this.userId, "recovered", row.chat_template_recovered, vars);
      }
    }
  }

  /** Whether chat is still owed an all-clear for an outage recent enough to matter. */
  private allClearOwed(now: number): boolean {
    return this.chatAllClearOwedAt !== null && now - this.chatAllClearOwedAt <= ALL_CLEAR_TTL_MS;
  }

  // ── warning source (feature d) ─────────────────────────────────────────

  private updateWarningSource(liveScene: SceneTarget): void {
    if (!this.cfg.row.warning_source_enabled) return;
    const anyBad = this.streaks.anyBadFor(WARNING_SHOW_BAD_POLLS);
    const allGood = this.streaks.allGoodFor(WARNING_HIDE_GOOD_POLLS);
    if (anyBad && !this.warningShown) this.setWarningSource(true, liveScene);
    else if (allGood && this.warningShown) this.setWarningSource(false, liveScene);
  }

  private setWarningSource(visible: boolean, liveScene: SceneTarget): void {
    const { row } = this.cfg;
    if (!row.warning_source_enabled || (!row.warning_source_uuid && !row.warning_source_name)) return;
    if (this.warningBusy || this.warningShown === visible) return;

    this.warningBusy = true;
    void (async () => {
      try {
        if (this.warningItemId === null) {
          this.warningItemId = await this.deps.resolveSceneItemId(
            this.userId,
            liveScene.uuid,
            row.warning_source_uuid,
            row.warning_source_name,
          );
          if (this.warningItemId === null) return;
        }
        const result = await this.deps.setSceneItemEnabled(this.userId, liveScene.uuid, this.warningItemId, visible);
        if (result.ok) {
          this.warningShown = visible;
        } else {
          this.warningItemId = null; // stale id (source recreated) — re-resolve next time
        }
      } catch (err) {
        console.warn(`[monitor] warning source toggle failed user=${this.userId}:`, (err as Error).message);
      } finally {
        this.warningBusy = false;
      }
    })();
  }

  // ── auto stop (feature e) ──────────────────────────────────────────────

  private fireAutoStop(now: number): void {
    void this.deps
      .stopStream(this.userId)
      .then((result) => {
        const entry: AutoSwitcherSwitchEntry = {
          at: Date.now(),
          from_scene: this.appliedScene?.name ?? null,
          to_scene: this.appliedScene?.name ?? "-",
          reason: "auto_stop",
          detail: result.ok
            ? `stream output stopped after ${this.cfg.row.auto_stop_minutes}m offline`
            : `auto stop failed: ${result.error ?? "unknown error"}`,
          session_id: this.selectedSessionId,
          label: this.latestStats?.label ?? null,
        };
        recordSwitch(this.userId, entry);
        if (result.ok) {
          // The broadcast this outage belongs to is over — whatever chat was
          // owed died with it, and the next go-live is a new stream.
          this.chatAllClearOwedAt = null;
        }
        if (result.ok && this.cfg.row.log_events_enabled) {
          void this.deps.logEvent(this.userId, entry, this.latestStats);
        }
        this.publish(Date.now());
      })
      .catch((err) => console.warn(`[monitor] auto stop failed user=${this.userId}:`, (err as Error).message));
  }

  // ── detail strings (xpudu buildFallbackDetail/buildRecoverDetail) ──────

  private fallbackDetail(bad: MetricKey[]): string {
    const thr = this.cfg.thresholds;
    const s = this.latestStats;
    const parts = bad.map((key) => {
      if (key === "bitrate") return `bitrate ${s?.kbps !== undefined ? Math.round(s.kbps) : "?"} kbps < ${thr.bitrate_min_kbps} kbps`;
      if (key === "rtt") return `RTT ${s?.rtt_ms !== undefined ? Math.round(s.rtt_ms) : "?"} ms > ${thr.rtt_max_ms} ms`;
      return `dropped ${s?.drop_pct !== undefined ? s.drop_pct.toFixed(1) : "?"}% > ${thr.loss_max_pct}%`;
    });
    return parts.join(", ");
  }

  private recoverDetail(): string {
    const s = this.latestStats;
    const bits = [
      s?.kbps !== undefined ? `${Math.round(s.kbps)} kbps` : null,
      s?.rtt_ms !== undefined ? `${Math.round(s.rtt_ms)} ms RTT` : null,
      s?.drop_pct !== undefined ? `${s.drop_pct.toFixed(1)}% dropped` : null,
    ].filter(Boolean);
    return `link stable (${bits.join(", ") || "no metrics"})`;
  }

  // ── status ─────────────────────────────────────────────────────────────

  private offlineTimeoutMs(): number {
    return this.cfg.thresholds.offline_timeout_seconds * 1_000;
  }

  /**
   * The watched session, but only while it is actually delivering stats.
   *
   * `selectedSessionId` is intentionally never cleared -- the state machine uses
   * it to notice a session resuming -- so it stays set long after a stream ends,
   * and `tracker.get` keeps answering until the 2-minute GC prune. Reporting
   * either of those as "we are watching a stream" produced a status that
   * contradicted itself: `armed: true` next to `selected_session: null`, with a
   * four-minute-old `latest` presented as current. Freshness is judged by the
   * same offline timeout the offline detection uses, so "armed" and "the engine
   * would switch on the next bad sample" mean the same thing.
   */
  private currentSession(now: number): TrackedSession | undefined {
    if (!this.selectedSessionId) return undefined;
    const session = this.tracker.get(this.selectedSessionId);
    if (!session) return undefined;
    return now - session.lastSeenMs <= this.offlineTimeoutMs() ? session : undefined;
  }

  buildStatus(now: number): AutoSwitcherStatus {
    const { row } = this.cfg;
    const overrideUuid = this.activeOverrideUuid(now);
    const selected = this.currentSession(now);
    const log = getSwitchLog(this.userId);
    return {
      state: overrideUuid ? "override" : this.phase,
      armed: row.enabled && selected !== undefined,
      override: overrideUuid
        ? { scene_uuid: overrideUuid, scene_name: row.override_scene_name, expires_at: row.override_expires_at }
        : null,
      selected_session: selected ? { session_id: selected.sessionId, label: selected.label } : null,
      warning_shown: this.warningShown,
      // Read off the tracked session, not `this.latestStats` -- that is retained
      // for the detail strings and the event log long after a stream ends. `at`
      // is the sample's own arrival time; stamping it with `now` made a frozen
      // four-minute-old reading look live.
      latest: selected
        ? {
            kbps: selected.latest.kbps ?? null,
            rtt_ms: selected.latest.rtt_ms ?? null,
            // drop_pct, despite the field name — status consumers draw this
            // number against loss_max_pct, so it has to be the same metric the
            // engine judged. Raw loss_pct stays in the event log and InfluxDB
            // for diagnostics.
            loss_pct: selected.latest.drop_pct ?? null,
            at: selected.lastSeenMs,
          }
        : null,
      streaks: this.streaks.snapshot(),
      thresholds: this.cfg.thresholds,
      last_switch: log.length > 0 ? log[log.length - 1]! : null,
      last_error: this.lastError,
      offline_since: this.offlineSince,
      auto_stop_deadline:
        this.phase === "offline" && row.auto_stop_enabled && !this.autoStopDone && this.offlineSince !== null
          ? this.offlineSince + row.auto_stop_minutes * 60_000
          : null,
    };
  }

  // Fingerprint of everything a status consumer renders that can change from
  // one sample to the next. `good` is clamped at its recover threshold on
  // purpose: it climbs forever on a healthy stream (updateStreaks), so an
  // unclamped key would publish every single second and defeat the point.
  // Clamped, a stable stream produces an unchanged key and falls back to the
  // heartbeat, while every step of a bad streak — and every step of recovery
  // progress, which is what the recovery bar draws — publishes at 1 Hz.
  private statusKey(now: number): string {
    const recoverPolls = pollLimits("recover", this.cfg.thresholds);
    const parts: (string | number)[] = [
      this.activeOverrideUuid(now) ?? "",
      this.phase,
      // Must match buildStatus's `armed` exactly, or the transition to Standby
      // would only surface on the next heartbeat.
      this.cfg.row.enabled && this.currentSession(now) !== undefined ? 1 : 0,
      this.warningShown ? 1 : 0,
      this.lastError ?? "",
    ];
    for (const key of METRICS) {
      const streak = this.streaks.get(key);
      parts.push(streak.bad, Math.min(streak.good, recoverPolls[key]));
    }
    return parts.join("|");
  }

  private publishIfChanged(now: number): void {
    if (this.statusKey(now) === this.lastPublishedKey) return;
    this.publish(now);
  }

  private publish(now: number): void {
    // Stamped here rather than at the call sites so the heartbeat and
    // phase-change publishes also refresh it — otherwise one of those could be
    // followed immediately by an identical publishIfChanged.
    this.lastPublishedKey = this.statusKey(now);
    this.deps.publishStatus(this.userId, this.buildStatus(now));
  }
}

