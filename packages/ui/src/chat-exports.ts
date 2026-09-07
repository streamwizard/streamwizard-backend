/**
 * Twitch chat rendering: tokenizer, asset URL helpers, and the message and
 * notice components.
 *
 * Its own entry point rather than part of `./overlay` because the consumers
 * aren't overlays — the deck's chat tab is a plain app surface, and pulling in
 * the widget runtime graph to render a chat line would be a poor trade.
 */

export { tokenizeChatMessage, mentionsBroadcaster } from "./components/chat/tokenize";
export {
  badgeUrl,
  badgeTitle,
  cheermoteUrl,
  twitchEmoteUrl,
  type BadgeScale,
  type ChatBadge,
  type CheermoteUrlOptions,
} from "./components/chat/asset-urls";
export { resolveUserColor } from "./components/chat/user-color";
export { ChatMessage, ChatTokens, type ChatMessageProps } from "./components/chat/ChatMessage";
export { ChatNotice, type ChatNoticeProps } from "./components/chat/ChatNotice";
export {
  EMPTY_CHAT_ASSETS,
  type BadgeImage,
  type BadgeMap,
  type CheermoteTier,
  type CheermoteMap,
  type ChatAssets,
  type ChatFragment,
  type ChatRenderOptions,
  type ChatToken,
  type ThirdPartyEmote,
  type ThirdPartyEmoteMap,
  type ThirdPartyProvider,
} from "./components/chat/types";
