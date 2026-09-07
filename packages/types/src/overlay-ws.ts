import type { EventSubSubscriptionType } from "./eventsub";
import type {
  OverlayGeoPayload,
  OverlayGeoEvent,
  OverlayStatusPayload,
  ObsInstanceLifecyclePayload,
  ObsSceneChangedPayload,
  IngestStatsPayload,
  UserStateUpdatePayload,
  // channel
  ChannelUpdateEvent,
  ChannelFollowEvent,
  ChannelAdBreakBeginEvent,
  ChannelSubscribeEvent,
  ChannelSubscriptionEndEvent,
  ChannelSubscriptionGiftEvent,
  ChannelSubscriptionMessageEvent,
  ChannelCheerEvent,
  ChannelRaidEvent,
  ChannelBanEvent,
  ChannelUnbanEvent,
  ChannelUnbanRequestCreateEvent,
  ChannelUnbanRequestResolveEvent,
  ChannelSharedChatBeginEvent,
  ChannelSharedChatUpdateEvent,
  ChannelSharedChatEndEvent,
  // chat
  ChannelChatClearEvent,
  ChannelChatClearUserMessagesEvent,
  ChannelChatMessageEvent,
  ChannelChatMessageDeleteEvent,
  ChannelChatNotificationEvent,
  ChannelChatSettingsUpdateEvent,
  ChannelChatUserMessageHoldEvent,
  ChannelChatUserMessageUpdateEvent,
  // channel points
  ChannelPointsAutomaticRewardRedemptionAddEvent,
  ChannelPointsAutomaticRewardRedemptionAddV2Event,
  ChannelPointsCustomRewardAddEvent,
  ChannelPointsCustomRewardUpdateEvent,
  ChannelPointsCustomRewardRemoveEvent,
  ChannelPointsCustomRewardRedemptionAddEvent,
  ChannelPointsCustomRewardRedemptionUpdateEvent,
  ChannelCustomPowerUpRedemptionAddEvent,
  // guest star
  ChannelGuestStarSessionBeginEvent,
  ChannelGuestStarSessionEndEvent,
  ChannelGuestStarGuestUpdateEvent,
  ChannelGuestStarSettingsUpdateEvent,
  // polls & predictions
  ChannelPollBeginEvent,
  ChannelPollProgressEvent,
  ChannelPollEndEvent,
  ChannelPredictionBeginEvent,
  ChannelPredictionProgressEvent,
  ChannelPredictionLockEvent,
  ChannelPredictionEndEvent,
  // moderation
  ChannelModerateEvent,
  ChannelModerateV2Event,
  ChannelModeratorAddEvent,
  ChannelModeratorRemoveEvent,
  ChannelWarningSendEvent,
  ChannelWarningAcknowledgeEvent,
  ChannelSuspiciousUserMessageEvent,
  ChannelSuspiciousUserUpdateEvent,
  ChannelVipAddEvent,
  ChannelVipRemoveEvent,
  // misc
  ChannelHypeTrainBeginEvent,
  ChannelHypeTrainProgressEvent,
  ChannelHypeTrainEndEvent,
  ChannelShieldModeBeginEvent,
  ChannelShieldModeEndEvent,
  ChannelShoutoutCreateEvent,
  ChannelShoutoutReceiveEvent,
  ChannelCharityDonateEvent,
  ChannelCharityCampaignStartEvent,
  ChannelCharityCampaignProgressEvent,
  ChannelCharityCampaignStopEvent,
  ChannelGoalBeginEvent,
  ChannelGoalProgressEvent,
  ChannelGoalEndEvent,
  // conduit
  ConduitShardDisabledEvent,
  // drops & extensions
  DropEntitlementGrantEvent,
  ExtensionBitsTransactionCreateEvent,
  // stream
  StreamOnlineEvent,
  StreamOfflineEvent,
  // user
  UserAuthorizationGrantEvent,
  UserAuthorizationRevokeEvent,
  UserUpdateEvent,
  UserWhisperMessageEvent,
  // obs-auto-switcher
  AutoSwitcherStatus,
  AutoSwitcherConfig,
} from "@repo/schemas";

export type { OverlayGeoPayload, OverlayGeoEvent, OverlayStatusPayload };

/**
 * Widget-facing name for the geo frame's payload. Kept as an alias rather than
 * used directly below because the widget editor's generated declarations call
 * it this, and the docs generator matches the two by name.
 */
export type StreamWizardGeoEvent = OverlayGeoEvent;

export type StreamWizardEventType =
  | "streamwizard.geo"
  | "streamwizard.ingest_stats"
  // obs-auto-switcher: engine → user room (state/heartbeat for the status card)
  | "streamwizard.auto_switcher_status"
  // obs-auto-switcher: web server actions → /internal/broadcast → consumer
  // feed (config/override changes; payload is the obs_auto_switcher_configs row)
  | "streamwizard.auto_switcher_config"
  // obs-instance-manager: container start/stop/delete/crash → /internal/broadcast
  // → the owning user's room, so decks/dashboards update live and cross-device
  | "streamwizard.obs_instance_lifecycle"
  // obs-instance-manager: the container's program scene actually changed,
  // observed on a node-side obs-websocket connection → /internal/broadcast
  | "streamwizard.obs_scene_changed"
  // user_states mutation: whichever process applied the write (bot via its
  // socket, rest-api/web-overlay via /internal/broadcast) → user room, one
  // message per changed key, so overlays track counters without polling
  | "streamwizard.user_state";

export type OverlayEventType = EventSubSubscriptionType | StreamWizardEventType;

// Both of these are zod-derived in @repo/schemas -- re-exported rather than
// redeclared so the wire type and the validator can't drift apart. Their docs
// live on the schemas.
export type { ObsInstanceLifecyclePayload, IngestStatsPayload, ObsSceneChangedPayload, UserStateUpdatePayload };

// Host NIC totals only — cpu/ram/disk deliberately stay on the InfluxDB
// polling path; the WS carries just the network signal.
export interface IngestNodeBandwidthPayload {
  node_id: string;
  /** Epoch ms at sample time on the node. */
  ts: number;
  rx_bytes_per_sec: number;
  tx_bytes_per_sec: number;
  tailscale_rx_bytes_per_sec: number;
  tailscale_tx_bytes_per_sec: number;
}

// Node-scoped bot message: never delivered to user rooms (so it's not an
// OverlayEventType) — ws-server folds it into monitor state instead.
export interface NodeMetricsMessage {
  kind: "node_metrics";
  payload: IngestNodeBandwidthPayload;
}

// App-level heartbeat: bot sockets are otherwise send-only, so without a
// reply the client can't tell a healthy link from a half-open TCP connection.
export interface BotPingMessage {
  kind: "ping";
  /** Epoch ms at send time; echoed back in the pong. */
  ts: number;
}

// ws-server's reply to BotPingMessage — the only message a bot ever receives.
export interface BotPongMessage {
  kind: "pong";
  ts: number;
}

export type OverlaySocketMessage =
  // StreamWizard internal
  // ws-server nests the status discriminant inside `payload` (it calls
  // broadcastToRoom with the whole {status, payload} envelope), so the
  // discriminant is one level down from where the other arms carry theirs.
  | { type: "streamwizard.geo"; payload: StreamWizardGeoEvent }
  | { type: "streamwizard.ingest_stats"; payload: IngestStatsPayload }
  | { type: "streamwizard.auto_switcher_status"; payload: AutoSwitcherStatus }
  | { type: "streamwizard.auto_switcher_config"; payload: AutoSwitcherConfig }
  | { type: "streamwizard.obs_instance_lifecycle"; payload: ObsInstanceLifecyclePayload }
  | { type: "streamwizard.obs_scene_changed"; payload: ObsSceneChangedPayload }
  | { type: "streamwizard.user_state"; payload: UserStateUpdatePayload }
  // Channel
  | { type: "channel.update";                                             payload: ChannelUpdateEvent }
  | { type: "channel.follow";                                             payload: ChannelFollowEvent }
  | { type: "channel.ad_break.begin";                                     payload: ChannelAdBreakBeginEvent }
  | { type: "channel.subscribe";                                          payload: ChannelSubscribeEvent }
  | { type: "channel.subscription.end";                                   payload: ChannelSubscriptionEndEvent }
  | { type: "channel.subscription.gift";                                  payload: ChannelSubscriptionGiftEvent }
  | { type: "channel.subscription.message";                               payload: ChannelSubscriptionMessageEvent }
  | { type: "channel.cheer";                                              payload: ChannelCheerEvent }
  | { type: "channel.raid";                                               payload: ChannelRaidEvent }
  | { type: "channel.ban";                                                payload: ChannelBanEvent }
  | { type: "channel.unban";                                              payload: ChannelUnbanEvent }
  | { type: "channel.unban_request.create";                               payload: ChannelUnbanRequestCreateEvent }
  | { type: "channel.unban_request.resolve";                              payload: ChannelUnbanRequestResolveEvent }
  | { type: "channel.shared_chat.begin";                                  payload: ChannelSharedChatBeginEvent }
  | { type: "channel.shared_chat.update";                                 payload: ChannelSharedChatUpdateEvent }
  | { type: "channel.shared_chat.end";                                    payload: ChannelSharedChatEndEvent }
  // Chat
  | { type: "channel.chat.clear";                                         payload: ChannelChatClearEvent }
  | { type: "channel.chat.clear_user_messages";                           payload: ChannelChatClearUserMessagesEvent }
  | { type: "channel.chat.message";                                       payload: ChannelChatMessageEvent }
  | { type: "channel.chat.message_delete";                                payload: ChannelChatMessageDeleteEvent }
  | { type: "channel.chat.notification";                                  payload: ChannelChatNotificationEvent }
  | { type: "channel.chat_settings.update";                               payload: ChannelChatSettingsUpdateEvent }
  | { type: "channel.chat.user_message_hold";                             payload: ChannelChatUserMessageHoldEvent }
  | { type: "channel.chat.user_message_update";                           payload: ChannelChatUserMessageUpdateEvent }
  // Channel Points
  | { type: "channel.channel_points_automatic_reward_redemption.add";     payload: ChannelPointsAutomaticRewardRedemptionAddEvent | ChannelPointsAutomaticRewardRedemptionAddV2Event }
  | { type: "channel.channel_points_custom_reward.add";                   payload: ChannelPointsCustomRewardAddEvent }
  | { type: "channel.channel_points_custom_reward.update";                payload: ChannelPointsCustomRewardUpdateEvent }
  | { type: "channel.channel_points_custom_reward.remove";                payload: ChannelPointsCustomRewardRemoveEvent }
  | { type: "channel.channel_points_custom_reward_redemption.add";        payload: ChannelPointsCustomRewardRedemptionAddEvent }
  | { type: "channel.channel_points_custom_reward_redemption.update";     payload: ChannelPointsCustomRewardRedemptionUpdateEvent }
  | { type: "channel.channel_points_custom_reward_redemption.add";        payload: ChannelCustomPowerUpRedemptionAddEvent }
  // Guest Star (BETA)
  | { type: "channel.guest_star_session.begin";                           payload: ChannelGuestStarSessionBeginEvent }
  | { type: "channel.guest_star_session.end";                             payload: ChannelGuestStarSessionEndEvent }
  | { type: "channel.guest_star_guest.update";                            payload: ChannelGuestStarGuestUpdateEvent }
  | { type: "channel.guest_star_settings.update";                         payload: ChannelGuestStarSettingsUpdateEvent }
  // Polls & Predictions
  | { type: "channel.poll.begin";                                         payload: ChannelPollBeginEvent }
  | { type: "channel.poll.progress";                                      payload: ChannelPollProgressEvent }
  | { type: "channel.poll.end";                                           payload: ChannelPollEndEvent }
  | { type: "channel.prediction.begin";                                   payload: ChannelPredictionBeginEvent }
  | { type: "channel.prediction.progress";                                payload: ChannelPredictionProgressEvent }
  | { type: "channel.prediction.lock";                                    payload: ChannelPredictionLockEvent }
  | { type: "channel.prediction.end";                                     payload: ChannelPredictionEndEvent }
  // Moderation
  | { type: "channel.moderate";                                           payload: ChannelModerateEvent | ChannelModerateV2Event }
  | { type: "channel.moderator.add";                                      payload: ChannelModeratorAddEvent }
  | { type: "channel.moderator.remove";                                   payload: ChannelModeratorRemoveEvent }
  | { type: "channel.warning.send";                                       payload: ChannelWarningSendEvent }
  | { type: "channel.warning.acknowledge";                                payload: ChannelWarningAcknowledgeEvent }
  | { type: "channel.suspicious_user.message";                            payload: ChannelSuspiciousUserMessageEvent }
  | { type: "channel.suspicious_user.update";                             payload: ChannelSuspiciousUserUpdateEvent }
  | { type: "channel.vip.add";                                            payload: ChannelVipAddEvent }
  | { type: "channel.vip.remove";                                         payload: ChannelVipRemoveEvent }
  // Hype Train
  | { type: "channel.hype_train.begin";                                   payload: ChannelHypeTrainBeginEvent }
  | { type: "channel.hype_train.progress";                                payload: ChannelHypeTrainProgressEvent }
  | { type: "channel.hype_train.end";                                     payload: ChannelHypeTrainEndEvent }
  // Shield Mode
  | { type: "channel.shield_mode.begin";                                  payload: ChannelShieldModeBeginEvent }
  | { type: "channel.shield_mode.end";                                    payload: ChannelShieldModeEndEvent }
  // Shoutout
  | { type: "channel.shoutout.create";                                    payload: ChannelShoutoutCreateEvent }
  | { type: "channel.shoutout.receive";                                   payload: ChannelShoutoutReceiveEvent }
  // Charity
  | { type: "channel.charity_campaign.donate";                            payload: ChannelCharityDonateEvent }
  | { type: "channel.charity_campaign.start";                             payload: ChannelCharityCampaignStartEvent }
  | { type: "channel.charity_campaign.progress";                          payload: ChannelCharityCampaignProgressEvent }
  | { type: "channel.charity_campaign.stop";                              payload: ChannelCharityCampaignStopEvent }
  // Goals
  | { type: "channel.goal.begin";                                         payload: ChannelGoalBeginEvent }
  | { type: "channel.goal.progress";                                      payload: ChannelGoalProgressEvent }
  | { type: "channel.goal.end";                                           payload: ChannelGoalEndEvent }
  // Conduit
  | { type: "conduit.shard.disabled";                                     payload: ConduitShardDisabledEvent }
  // Drops & Extensions
  | { type: "drop.entitlement.grant";                                     payload: DropEntitlementGrantEvent }
  | { type: "extension.bits_transaction.create";                          payload: ExtensionBitsTransactionCreateEvent }
  // Stream
  | { type: "stream.online";                                              payload: StreamOnlineEvent }
  | { type: "stream.offline";                                             payload: StreamOfflineEvent }
  // User
  | { type: "user.authorization.grant";                                   payload: UserAuthorizationGrantEvent }
  | { type: "user.authorization.revoke";                                  payload: UserAuthorizationRevokeEvent }
  | { type: "user.update";                                                payload: UserUpdateEvent }
  | { type: "user.whisper.message";                                       payload: UserWhisperMessageEvent }

export interface BotBroadcastMessage {
  userId: string;
  type: OverlayEventType;
  payload: unknown;
}

// Everything a bot socket may send: room-scoped fan-out messages plus
// node-scoped metrics and heartbeats. `"kind" in msg` splits fan-out from
// node-scoped; discriminate the rest on `msg.kind`.
export type BotOutboundMessage = BotBroadcastMessage | NodeMetricsMessage | BotPingMessage;
