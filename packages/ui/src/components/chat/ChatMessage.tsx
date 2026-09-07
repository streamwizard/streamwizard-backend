"use client";

import { memo, useMemo } from "react";
import { cn } from "../../lib/utils";
import { badgeTitle, badgeUrl, type ChatBadge } from "./asset-urls";
import { mentionsBroadcaster, tokenizeChatMessage } from "./tokenize";
import { resolveUserColor } from "./user-color";
import type { ChatAssets, ChatFragment, ChatToken } from "./types";

/**
 * One chat line. Everything it needs is passed in resolved, so rendering is
 * pure lookups — no fetches, no effects, nothing that can reflow mid-scroll and
 * fight the list's bottom pinning.
 */

export interface ChatMessageProps {
  fragments: ChatFragment[];
  chatterName: string;
  chatterLogin: string;
  color: string;
  badges: ChatBadge[];
  assets: ChatAssets;
  /**
   * Bumped once when the prefetched asset maps land, so memoized rows re-render
   * exactly once rather than on every incoming message.
   */
  assetsVersion?: number;
  broadcasterUserId?: string;
  messageType?: string;
  cheerBits?: number;
  reply?: { parent_user_name: string; parent_message_body: string; parent_message_id: string } | null;
  deleted?: boolean;
  pending?: boolean;
  failed?: boolean;
  /** Reveals a deleted message's original text. */
  revealed?: boolean;
  onReveal?: () => void;
  onReplyClick?: (parentMessageId: string) => void;
  className?: string;
}

export function ChatTokens({ tokens }: { tokens: ChatToken[] }) {
  return (
    <>
      {tokens.map((token, index) => {
        switch (token.kind) {
          case "emote":
            return (
              <img
                key={index}
                src={token.url}
                alt={token.name}
                title={token.name}
                loading="lazy"
                decoding="async"
                width={token.big ? 56 : 28}
                height={token.big ? 56 : 28}
                className={cn(
                  "inline-block object-contain align-middle",
                  token.big ? "h-14 max-w-14" : "h-7 max-w-[7rem]",
                )}
              />
            );

          case "cheermote":
            return (
              <span key={index} className="inline-flex items-center align-middle">
                {token.url ? (
                  <img
                    src={token.url}
                    alt={token.prefix}
                    loading="lazy"
                    decoding="async"
                    width={28}
                    height={28}
                    className="inline-block h-7 w-7 object-contain align-middle"
                  />
                ) : null}
                <span className="font-semibold" style={token.color ? { color: token.color } : undefined}>
                  {token.bits}
                </span>
              </span>
            );

          case "mention":
            return (
              <span
                key={index}
                className={cn(
                  "rounded px-0.5 font-semibold",
                  token.isBroadcaster ? "bg-primary/25 text-primary" : "text-foreground",
                )}
              >
                {token.text}
              </span>
            );

          case "link":
            return (
              <a
                key={index}
                href={token.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-primary underline underline-offset-2 break-all"
              >
                {token.text}
              </a>
            );

          default:
            return <span key={index}>{token.text}</span>;
        }
      })}
    </>
  );
}

function ChatMessageInner({
  fragments,
  chatterName,
  chatterLogin,
  color,
  badges,
  assets,
  broadcasterUserId,
  messageType,
  reply,
  deleted,
  pending,
  failed,
  revealed,
  onReveal,
  onReplyClick,
  className,
}: ChatMessageProps) {
  const gigantified = messageType === "power_ups_gigantified_emote";

  const tokens = useMemo(
    () => tokenizeChatMessage(fragments, assets, { broadcasterUserId, gigantified }),
    [fragments, assets, broadcasterUserId, gigantified],
  );

  const highlighted = mentionsBroadcaster(tokens);
  const nameColor = useMemo(() => resolveUserColor(color, chatterLogin), [color, chatterLogin]);

  const accent =
    messageType === "channel_points_highlighted"
      ? "border-l-2 border-primary bg-primary/10"
      : messageType === "user_intro"
        ? "border-l-2 border-sky-400 bg-sky-400/10"
        : messageType === "channel_points_sub_only" || messageType === "power_ups_message_effect"
          ? "border-l-2 border-muted-foreground/40 bg-muted/40"
          : highlighted
            ? "border-l-2 border-primary/70 bg-primary/5"
            : null;

  const hidden = deleted && !revealed;

  return (
    <div
      className={cn(
        "px-3 py-1 text-sm leading-relaxed [content-visibility:auto] [contain-intrinsic-size:auto_2.5rem]",
        accent,
        pending && "opacity-60",
        className,
      )}
    >
      {reply ? (
        <button
          type="button"
          onClick={() => onReplyClick?.(reply.parent_message_id)}
          className="flex w-full items-center gap-1 truncate text-left text-xs text-muted-foreground"
        >
          <span aria-hidden>↩</span>
          <span className="truncate">
            @{reply.parent_user_name}: {reply.parent_message_body}
          </span>
        </button>
      ) : null}

      {messageType === "user_intro" ? (
        <span className="mr-1 rounded bg-sky-400/20 px-1 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
          First message
        </span>
      ) : null}

      {badges.map((badge, index) => {
        const url = badgeUrl(badge, assets.badges);
        if (!url) return null;
        return (
          <img
            key={`${badge.set_id}:${badge.id}:${index}`}
            src={url}
            alt={badgeTitle(badge, assets.badges)}
            title={badgeTitle(badge, assets.badges)}
            loading="lazy"
            decoding="async"
            width={18}
            height={18}
            className="mr-1 inline-block h-[18px] w-[18px] align-middle"
          />
        );
      })}

      <span className="font-semibold" style={{ color: nameColor }}>
        {chatterName}
      </span>
      <span className="text-muted-foreground">: </span>

      {hidden ? (
        // Hidden by default rather than gone: a moderator needs to be able to
        // see what they removed, but not on a screen someone might be sharing.
        <button type="button" className="italic text-muted-foreground" onClick={onReveal}>
          &lt;message deleted — tap to show&gt;
        </button>
      ) : (
        <span className={cn("break-words", deleted && "text-muted-foreground line-through")}>
          <ChatTokens tokens={tokens} />
        </span>
      )}

      {failed ? <span className="ml-1 text-xs text-destructive">· not sent</span> : null}
    </div>
  );
}

/**
 * Message objects are frozen once buffered, so identity comparison is enough —
 * only deletion, reveal and a late asset prefetch can change a rendered row.
 */
export const ChatMessage = memo(ChatMessageInner, (prev, next) => {
  return (
    prev.fragments === next.fragments &&
    prev.deleted === next.deleted &&
    prev.revealed === next.revealed &&
    prev.pending === next.pending &&
    prev.failed === next.failed &&
    prev.assetsVersion === next.assetsVersion &&
    prev.broadcasterUserId === next.broadcasterUserId
  );
});
