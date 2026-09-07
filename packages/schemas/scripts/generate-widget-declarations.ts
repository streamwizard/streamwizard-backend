/**
 * Generates `src/widget-editor-declarations.ts` from the actual Zod schemas.
 * Run with: bun run scripts/generate-widget-declarations.ts
 *
 * The output is committed so the editor always has correct types at zero runtime cost.
 * Re-run this script whenever a relevant schema changes.
 */

import { zodToTs, createTypeAlias, printNode, createAuxiliaryTypeStore } from "zod-to-ts";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// automod
import {
  AutomodMessageHoldEventSchema,
  AutomodMessageHoldV2EventSchema,
  AutomodMessageUpdateEventSchema,
  AutomodMessageUpdateV2EventSchema,
  AutomodSettingsUpdateEventSchema,
  AutomodTermsUpdateEventSchema,
} from "../src/automod";

// channel-points
import {
  ChannelPointsAutomaticRewardRedemptionAddEventSchema,
  ChannelPointsAutomaticRewardRedemptionAddV2EventSchema,
  ChannelPointsCustomRewardAddEventSchema,
  ChannelPointsCustomRewardUpdateEventSchema,
  ChannelPointsCustomRewardRemoveEventSchema,
  ChannelPointsCustomRewardRedemptionAddEventSchema,
  ChannelPointsCustomRewardRedemptionUpdateEventSchema,
  ChannelCustomPowerUpRedemptionAddEventSchema,
} from "../src/channel-points";

// channel
import {
  ChannelBitsUseEventSchema,
  ChannelUpdateEventSchema,
  ChannelFollowEventSchema,
  ChannelAdBreakBeginEventSchema,
  ChannelSubscribeEventSchema,
  ChannelSubscriptionEndEventSchema,
  ChannelSubscriptionGiftEventSchema,
  ChannelSubscriptionMessageEventSchema,
  ChannelCheerEventSchema,
  ChannelRaidEventSchema,
  ChannelBanEventSchema,
  ChannelUnbanEventSchema,
  ChannelUnbanRequestCreateEventSchema,
  ChannelUnbanRequestResolveEventSchema,
} from "../src/channel";

// chat
import {
  ChannelChatClearEventSchema,
  ChannelChatClearUserMessagesEventSchema,
  ChannelChatMessageEventSchema,
  ChannelChatMessageDeleteEventSchema,
  ChannelChatNotificationEventSchema,
  ChannelChatSettingsUpdateEventSchema,
  ChannelChatUserMessageHoldEventSchema,
  ChannelChatUserMessageUpdateEventSchema,
} from "../src/chat";

// conduit
import { ConduitShardDisabledEventSchema } from "../src/conduit";

// drops
import { DropEntitlementGrantEventSchema } from "../src/drops";

// extensions
import { ExtensionBitsTransactionCreateEventSchema } from "../src/extensions";

// guest-star
import {
  ChannelGuestStarSessionBeginEventSchema,
  ChannelGuestStarSessionEndEventSchema,
  ChannelGuestStarGuestUpdateEventSchema,
  ChannelGuestStarSettingsUpdateEventSchema,
} from "../src/guest-star";

// misc
import {
  ChannelHypeTrainBeginEventSchema,
  ChannelHypeTrainProgressEventSchema,
  ChannelHypeTrainEndEventSchema,
  ChannelShieldModeBeginEventSchema,
  ChannelShieldModeEndEventSchema,
  ChannelShoutoutCreateEventSchema,
  ChannelShoutoutReceiveEventSchema,
  ChannelCharityDonateEventSchema,
  ChannelCharityCampaignStartEventSchema,
  ChannelCharityCampaignProgressEventSchema,
  ChannelCharityCampaignStopEventSchema,
  ChannelSharedChatBeginEventSchema,
  ChannelSharedChatUpdateEventSchema,
  ChannelSharedChatEndEventSchema,
  ChannelGoalBeginEventSchema,
  ChannelGoalProgressEventSchema,
  ChannelGoalEndEventSchema,
} from "../src/misc";

// moderate
import {
  ChannelModerateEventSchema,
  ChannelModerateV2EventSchema,
  ChannelModeratorAddEventSchema,
  ChannelModeratorRemoveEventSchema,
  ChannelWarningSendEventSchema,
  ChannelWarningAcknowledgeEventSchema,
  ChannelSuspiciousUserMessageEventSchema,
  ChannelSuspiciousUserUpdateEventSchema,
  ChannelVipAddEventSchema,
  ChannelVipRemoveEventSchema,
} from "../src/moderate";

// polls-predictions
import {
  ChannelPollBeginEventSchema,
  ChannelPollProgressEventSchema,
  ChannelPollEndEventSchema,
  ChannelPredictionBeginEventSchema,
  ChannelPredictionProgressEventSchema,
  ChannelPredictionLockEventSchema,
  ChannelPredictionEndEventSchema,
} from "../src/polls-predictions";

// stream
import { StreamOnlineEventSchema, StreamOfflineEventSchema } from "../src/stream";

// streamwizard
import {
  IngestStatsPayloadSchema,
  ObsInstanceLifecyclePayloadSchema,
  ObsSceneChangedPayloadSchema,
  OverlayGeoEventSchema,
} from "../src/streamwizard";
import { autoSwitcherStatusSchema } from "../src/auto-switcher";

// user
import {
  UserAuthorizationGrantEventSchema,
  UserAuthorizationRevokeEventSchema,
  UserUpdateEventSchema,
  UserWhisperMessageEventSchema,
} from "../src/user";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCHEMAS = [
  // automod
  { name: "AutomodMessageHoldEvent",                                    schema: AutomodMessageHoldEventSchema },
  { name: "AutomodMessageHoldV2Event",                                  schema: AutomodMessageHoldV2EventSchema },
  { name: "AutomodMessageUpdateEvent",                                  schema: AutomodMessageUpdateEventSchema },
  { name: "AutomodMessageUpdateV2Event",                                schema: AutomodMessageUpdateV2EventSchema },
  { name: "AutomodSettingsUpdateEvent",                                 schema: AutomodSettingsUpdateEventSchema },
  { name: "AutomodTermsUpdateEvent",                                    schema: AutomodTermsUpdateEventSchema },
  // channel-points
  { name: "ChannelPointsAutomaticRewardRedemptionAddEvent",             schema: ChannelPointsAutomaticRewardRedemptionAddEventSchema },
  { name: "ChannelPointsAutomaticRewardRedemptionAddV2Event",           schema: ChannelPointsAutomaticRewardRedemptionAddV2EventSchema },
  { name: "ChannelPointsCustomRewardAddEvent",                          schema: ChannelPointsCustomRewardAddEventSchema },
  { name: "ChannelPointsCustomRewardUpdateEvent",                       schema: ChannelPointsCustomRewardUpdateEventSchema },
  { name: "ChannelPointsCustomRewardRemoveEvent",                       schema: ChannelPointsCustomRewardRemoveEventSchema },
  { name: "ChannelPointsCustomRewardRedemptionAddEvent",                schema: ChannelPointsCustomRewardRedemptionAddEventSchema },
  { name: "ChannelPointsCustomRewardRedemptionUpdateEvent",             schema: ChannelPointsCustomRewardRedemptionUpdateEventSchema },
  { name: "ChannelCustomPowerUpRedemptionAddEvent",                     schema: ChannelCustomPowerUpRedemptionAddEventSchema },
  // channel
  { name: "ChannelBitsUseEvent",                                        schema: ChannelBitsUseEventSchema },
  { name: "ChannelUpdateEvent",                                         schema: ChannelUpdateEventSchema },
  { name: "ChannelFollowEvent",                                         schema: ChannelFollowEventSchema },
  { name: "ChannelAdBreakBeginEvent",                                   schema: ChannelAdBreakBeginEventSchema },
  { name: "ChannelSubscribeEvent",                                      schema: ChannelSubscribeEventSchema },
  { name: "ChannelSubscriptionEndEvent",                                schema: ChannelSubscriptionEndEventSchema },
  { name: "ChannelSubscriptionGiftEvent",                               schema: ChannelSubscriptionGiftEventSchema },
  { name: "ChannelSubscriptionMessageEvent",                            schema: ChannelSubscriptionMessageEventSchema },
  { name: "ChannelCheerEvent",                                          schema: ChannelCheerEventSchema },
  { name: "ChannelRaidEvent",                                           schema: ChannelRaidEventSchema },
  { name: "ChannelBanEvent",                                            schema: ChannelBanEventSchema },
  { name: "ChannelUnbanEvent",                                          schema: ChannelUnbanEventSchema },
  { name: "ChannelUnbanRequestCreateEvent",                             schema: ChannelUnbanRequestCreateEventSchema },
  { name: "ChannelUnbanRequestResolveEvent",                            schema: ChannelUnbanRequestResolveEventSchema },
  // chat
  { name: "ChannelChatClearEvent",                                      schema: ChannelChatClearEventSchema },
  { name: "ChannelChatClearUserMessagesEvent",                          schema: ChannelChatClearUserMessagesEventSchema },
  { name: "ChannelChatMessageEvent",                                    schema: ChannelChatMessageEventSchema },
  { name: "ChannelChatMessageDeleteEvent",                              schema: ChannelChatMessageDeleteEventSchema },
  { name: "ChannelChatNotificationEvent",                               schema: ChannelChatNotificationEventSchema },
  { name: "ChannelChatSettingsUpdateEvent",                             schema: ChannelChatSettingsUpdateEventSchema },
  { name: "ChannelChatUserMessageHoldEvent",                            schema: ChannelChatUserMessageHoldEventSchema },
  { name: "ChannelChatUserMessageUpdateEvent",                          schema: ChannelChatUserMessageUpdateEventSchema },
  // conduit
  { name: "ConduitShardDisabledEvent",                                  schema: ConduitShardDisabledEventSchema },
  // drops
  { name: "DropEntitlementGrantEvent",                                  schema: DropEntitlementGrantEventSchema },
  // extensions
  { name: "ExtensionBitsTransactionCreateEvent",                        schema: ExtensionBitsTransactionCreateEventSchema },
  // guest-star
  { name: "ChannelGuestStarSessionBeginEvent",                          schema: ChannelGuestStarSessionBeginEventSchema },
  { name: "ChannelGuestStarSessionEndEvent",                            schema: ChannelGuestStarSessionEndEventSchema },
  { name: "ChannelGuestStarGuestUpdateEvent",                           schema: ChannelGuestStarGuestUpdateEventSchema },
  { name: "ChannelGuestStarSettingsUpdateEvent",                        schema: ChannelGuestStarSettingsUpdateEventSchema },
  // misc
  { name: "ChannelHypeTrainBeginEvent",                                 schema: ChannelHypeTrainBeginEventSchema },
  { name: "ChannelHypeTrainProgressEvent",                              schema: ChannelHypeTrainProgressEventSchema },
  { name: "ChannelHypeTrainEndEvent",                                   schema: ChannelHypeTrainEndEventSchema },
  { name: "ChannelShieldModeBeginEvent",                                schema: ChannelShieldModeBeginEventSchema },
  { name: "ChannelShieldModeEndEvent",                                  schema: ChannelShieldModeEndEventSchema },
  { name: "ChannelShoutoutCreateEvent",                                 schema: ChannelShoutoutCreateEventSchema },
  { name: "ChannelShoutoutReceiveEvent",                                schema: ChannelShoutoutReceiveEventSchema },
  { name: "ChannelCharityDonateEvent",                                  schema: ChannelCharityDonateEventSchema },
  { name: "ChannelCharityCampaignStartEvent",                           schema: ChannelCharityCampaignStartEventSchema },
  { name: "ChannelCharityCampaignProgressEvent",                        schema: ChannelCharityCampaignProgressEventSchema },
  { name: "ChannelCharityCampaignStopEvent",                            schema: ChannelCharityCampaignStopEventSchema },
  { name: "ChannelSharedChatBeginEvent",                                schema: ChannelSharedChatBeginEventSchema },
  { name: "ChannelSharedChatUpdateEvent",                               schema: ChannelSharedChatUpdateEventSchema },
  { name: "ChannelSharedChatEndEvent",                                  schema: ChannelSharedChatEndEventSchema },
  { name: "ChannelGoalBeginEvent",                                      schema: ChannelGoalBeginEventSchema },
  { name: "ChannelGoalProgressEvent",                                   schema: ChannelGoalProgressEventSchema },
  { name: "ChannelGoalEndEvent",                                        schema: ChannelGoalEndEventSchema },
  // moderate
  { name: "ChannelModerateEvent",                                       schema: ChannelModerateEventSchema },
  { name: "ChannelModerateV2Event",                                     schema: ChannelModerateV2EventSchema },
  { name: "ChannelModeratorAddEvent",                                   schema: ChannelModeratorAddEventSchema },
  { name: "ChannelModeratorRemoveEvent",                                schema: ChannelModeratorRemoveEventSchema },
  { name: "ChannelWarningSendEvent",                                    schema: ChannelWarningSendEventSchema },
  { name: "ChannelWarningAcknowledgeEvent",                             schema: ChannelWarningAcknowledgeEventSchema },
  { name: "ChannelSuspiciousUserMessageEvent",                          schema: ChannelSuspiciousUserMessageEventSchema },
  { name: "ChannelSuspiciousUserUpdateEvent",                           schema: ChannelSuspiciousUserUpdateEventSchema },
  { name: "ChannelVipAddEvent",                                         schema: ChannelVipAddEventSchema },
  { name: "ChannelVipRemoveEvent",                                      schema: ChannelVipRemoveEventSchema },
  // polls-predictions
  { name: "ChannelPollBeginEvent",                                      schema: ChannelPollBeginEventSchema },
  { name: "ChannelPollProgressEvent",                                   schema: ChannelPollProgressEventSchema },
  { name: "ChannelPollEndEvent",                                        schema: ChannelPollEndEventSchema },
  { name: "ChannelPredictionBeginEvent",                                schema: ChannelPredictionBeginEventSchema },
  { name: "ChannelPredictionProgressEvent",                             schema: ChannelPredictionProgressEventSchema },
  { name: "ChannelPredictionLockEvent",                                 schema: ChannelPredictionLockEventSchema },
  { name: "ChannelPredictionEndEvent",                                  schema: ChannelPredictionEndEventSchema },
  // stream
  { name: "StreamOnlineEvent",                                          schema: StreamOnlineEventSchema },
  { name: "StreamOfflineEvent",                                         schema: StreamOfflineEventSchema },
  // streamwizard
  { name: "StreamWizardGeoEvent",                                       schema: OverlayGeoEventSchema },
  { name: "IngestStatsPayload",                                         schema: IngestStatsPayloadSchema },
  { name: "AutoSwitcherStatus",                                         schema: autoSwitcherStatusSchema },
  { name: "ObsInstanceLifecyclePayload",                                schema: ObsInstanceLifecyclePayloadSchema },
  { name: "ObsSceneChangedPayload",                                     schema: ObsSceneChangedPayloadSchema },
  // user
  { name: "UserAuthorizationGrantEvent",                                schema: UserAuthorizationGrantEventSchema },
  { name: "UserAuthorizationRevokeEvent",                               schema: UserAuthorizationRevokeEventSchema },
  { name: "UserUpdateEvent",                                            schema: UserUpdateEventSchema },
  { name: "UserWhisperMessageEvent",                                    schema: UserWhisperMessageEventSchema },
] as const;

const auxiliaryTypeStore = createAuxiliaryTypeStore();

const typeDeclarations = SCHEMAS.map(({ name, schema }) => {
  const { node } = zodToTs(schema, { auxiliaryTypeStore });
  return printNode(createTypeAlias(node, name));
}).join("\n\n");

// Auxiliary types (inline schemas like Badge, Fragment etc.) that zod-to-ts extracted
const auxiliaryDeclarations = [...auxiliaryTypeStore.definitions.values()]
  .map(({ node }) => printNode(node))
  .join("\n\n");

const discriminatedUnion = `
type EventReceivedDetail =
  // automod
  | { listener: "automod.message.hold";                                          event: AutomodMessageHoldEvent }
  | { listener: "automod.message.hold/2";                                        event: AutomodMessageHoldV2Event }
  | { listener: "automod.message.update";                                        event: AutomodMessageUpdateEvent }
  | { listener: "automod.message.update/2";                                      event: AutomodMessageUpdateV2Event }
  | { listener: "automod.settings.update";                                       event: AutomodSettingsUpdateEvent }
  | { listener: "automod.terms.update";                                          event: AutomodTermsUpdateEvent }
  // channel-points
  | { listener: "channel.channel_points_automatic_reward_redemption.add";        event: ChannelPointsAutomaticRewardRedemptionAddEvent }
  | { listener: "channel.channel_points_automatic_reward_redemption.add/2";      event: ChannelPointsAutomaticRewardRedemptionAddV2Event }
  | { listener: "channel.channel_points_custom_reward.add";                      event: ChannelPointsCustomRewardAddEvent }
  | { listener: "channel.channel_points_custom_reward.update";                   event: ChannelPointsCustomRewardUpdateEvent }
  | { listener: "channel.channel_points_custom_reward.remove";                   event: ChannelPointsCustomRewardRemoveEvent }
  | { listener: "channel.channel_points_custom_reward_redemption.add";           event: ChannelPointsCustomRewardRedemptionAddEvent }
  | { listener: "channel.channel_points_custom_reward_redemption.update";        event: ChannelPointsCustomRewardRedemptionUpdateEvent }
  | { listener: "channel.channel_points_custom_reward_power_up.redemption.add";  event: ChannelCustomPowerUpRedemptionAddEvent }
  // channel
  | { listener: "channel.bits.use";                                              event: ChannelBitsUseEvent }
  | { listener: "channel.update";                                                event: ChannelUpdateEvent }
  | { listener: "channel.follow";                                                event: ChannelFollowEvent }
  | { listener: "channel.ad_break.begin";                                        event: ChannelAdBreakBeginEvent }
  | { listener: "channel.subscribe";                                             event: ChannelSubscribeEvent }
  | { listener: "channel.subscription.end";                                      event: ChannelSubscriptionEndEvent }
  | { listener: "channel.subscription.gift";                                     event: ChannelSubscriptionGiftEvent }
  | { listener: "channel.subscription.message";                                  event: ChannelSubscriptionMessageEvent }
  | { listener: "channel.cheer";                                                 event: ChannelCheerEvent }
  | { listener: "channel.raid";                                                  event: ChannelRaidEvent }
  | { listener: "channel.ban";                                                   event: ChannelBanEvent }
  | { listener: "channel.unban";                                                 event: ChannelUnbanEvent }
  | { listener: "channel.unban_request.create";                                  event: ChannelUnbanRequestCreateEvent }
  | { listener: "channel.unban_request.resolve";                                 event: ChannelUnbanRequestResolveEvent }
  // chat
  | { listener: "channel.chat.clear";                                            event: ChannelChatClearEvent }
  | { listener: "channel.chat.clear_user_messages";                              event: ChannelChatClearUserMessagesEvent }
  | { listener: "channel.chat.message";                                          event: ChannelChatMessageEvent }
  | { listener: "channel.chat.message_delete";                                   event: ChannelChatMessageDeleteEvent }
  | { listener: "channel.chat.notification";                                     event: ChannelChatNotificationEvent }
  | { listener: "channel.chat_settings.update";                                  event: ChannelChatSettingsUpdateEvent }
  | { listener: "channel.chat.user_message_hold";                                event: ChannelChatUserMessageHoldEvent }
  | { listener: "channel.chat.user_message_update";                              event: ChannelChatUserMessageUpdateEvent }
  // conduit
  | { listener: "conduit.shard.disabled";                                        event: ConduitShardDisabledEvent }
  // drops
  | { listener: "drop.entitlement.grant";                                        event: DropEntitlementGrantEvent }
  // extensions
  | { listener: "extension.bits_transaction.create";                             event: ExtensionBitsTransactionCreateEvent }
  // guest-star
  | { listener: "channel.guest_star_session.begin";                              event: ChannelGuestStarSessionBeginEvent }
  | { listener: "channel.guest_star_session.end";                                event: ChannelGuestStarSessionEndEvent }
  | { listener: "channel.guest_star_guest.update";                               event: ChannelGuestStarGuestUpdateEvent }
  | { listener: "channel.guest_star_settings.update";                            event: ChannelGuestStarSettingsUpdateEvent }
  // misc
  | { listener: "channel.hype_train.begin";                                      event: ChannelHypeTrainBeginEvent }
  | { listener: "channel.hype_train.progress";                                   event: ChannelHypeTrainProgressEvent }
  | { listener: "channel.hype_train.end";                                        event: ChannelHypeTrainEndEvent }
  | { listener: "channel.shield_mode.begin";                                     event: ChannelShieldModeBeginEvent }
  | { listener: "channel.shield_mode.end";                                       event: ChannelShieldModeEndEvent }
  | { listener: "channel.shoutout.create";                                       event: ChannelShoutoutCreateEvent }
  | { listener: "channel.shoutout.receive";                                      event: ChannelShoutoutReceiveEvent }
  | { listener: "channel.charity_campaign.donate";                               event: ChannelCharityDonateEvent }
  | { listener: "channel.charity_campaign.start";                                event: ChannelCharityCampaignStartEvent }
  | { listener: "channel.charity_campaign.progress";                             event: ChannelCharityCampaignProgressEvent }
  | { listener: "channel.charity_campaign.stop";                                 event: ChannelCharityCampaignStopEvent }
  | { listener: "channel.shared_chat.begin";                                     event: ChannelSharedChatBeginEvent }
  | { listener: "channel.shared_chat.update";                                    event: ChannelSharedChatUpdateEvent }
  | { listener: "channel.shared_chat.end";                                       event: ChannelSharedChatEndEvent }
  | { listener: "channel.goal.begin";                                            event: ChannelGoalBeginEvent }
  | { listener: "channel.goal.progress";                                         event: ChannelGoalProgressEvent }
  | { listener: "channel.goal.end";                                              event: ChannelGoalEndEvent }
  // moderate
  | { listener: "channel.moderate";                                              event: ChannelModerateEvent }
  | { listener: "channel.moderate/2";                                            event: ChannelModerateV2Event }
  | { listener: "channel.moderator.add";                                         event: ChannelModeratorAddEvent }
  | { listener: "channel.moderator.remove";                                      event: ChannelModeratorRemoveEvent }
  | { listener: "channel.warning.send";                                          event: ChannelWarningSendEvent }
  | { listener: "channel.warning.acknowledge";                                   event: ChannelWarningAcknowledgeEvent }
  | { listener: "channel.suspicious_user.message";                               event: ChannelSuspiciousUserMessageEvent }
  | { listener: "channel.suspicious_user.update";                                event: ChannelSuspiciousUserUpdateEvent }
  | { listener: "channel.vip.add";                                               event: ChannelVipAddEvent }
  | { listener: "channel.vip.remove";                                            event: ChannelVipRemoveEvent }
  // polls & predictions
  | { listener: "channel.poll.begin";                                            event: ChannelPollBeginEvent }
  | { listener: "channel.poll.progress";                                         event: ChannelPollProgressEvent }
  | { listener: "channel.poll.end";                                              event: ChannelPollEndEvent }
  | { listener: "channel.prediction.begin";                                      event: ChannelPredictionBeginEvent }
  | { listener: "channel.prediction.progress";                                   event: ChannelPredictionProgressEvent }
  | { listener: "channel.prediction.lock";                                       event: ChannelPredictionLockEvent }
  | { listener: "channel.prediction.end";                                        event: ChannelPredictionEndEvent }
  // stream
  | { listener: "stream.online";                                                 event: StreamOnlineEvent }
  | { listener: "stream.offline";                                                event: StreamOfflineEvent }
  // streamwizard
  | { listener: "streamwizard.geo"; event: StreamWizardGeoEvent }
  | { listener: "streamwizard.ingest_stats"; event: IngestStatsPayload }
  | { listener: "streamwizard.auto_switcher_status"; event: AutoSwitcherStatus }
  | { listener: "streamwizard.obs_instance_lifecycle"; event: ObsInstanceLifecyclePayload }
  | { listener: "streamwizard.obs_scene_changed"; event: ObsSceneChangedPayload }
  // user
  | { listener: "user.authorization.grant";                                      event: UserAuthorizationGrantEvent }
  | { listener: "user.authorization.revoke";                                     event: UserAuthorizationRevokeEvent }
  | { listener: "user.update";                                                   event: UserUpdateEvent }
  | { listener: "user.whisper.message";                                          event: UserWhisperMessageEvent };`.trim();

const globalDeclarations = `
declare const fieldData: Record<string, any>;

interface WidgetLoadDetail {
  fieldData: Record<string, any>;
  channel: { user_id: string };
  session: Record<string, any>;
}

declare function addEventListener(event: "onWidgetLoad", callback: (obj: { detail: WidgetLoadDetail }) => void): void;
declare function addEventListener(event: "onEventReceived", callback: (obj: { detail: EventReceivedDetail }) => void): void;
declare function addEventListener(event: "onSessionUpdate", callback: (obj: { detail: { session: Record<string, any> } }) => void): void;`.trim();

const declarations = [
  auxiliaryDeclarations,
  typeDeclarations,
  discriminatedUnion,
  globalDeclarations,
]
  .filter(Boolean)
  .join("\n\n");

const output = `// AUTO-GENERATED — do not edit by hand.
// Re-generate with: bun run scripts/generate-widget-declarations.ts

export const WIDGET_EDITOR_DECLARATIONS = ${JSON.stringify(declarations)};
`;

const outPath = join(__dirname, "../src/widget-editor-declarations.ts");
writeFileSync(outPath, output, "utf-8");
console.log(`✓ Written to ${outPath}`);
