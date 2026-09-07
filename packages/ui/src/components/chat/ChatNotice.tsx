"use client";

import { memo, useMemo } from "react";
import { cn } from "../../lib/utils";
import { badgeTitle, badgeUrl, type ChatBadge } from "./asset-urls";
import { ChatTokens } from "./ChatMessage";
import { tokenizeChatMessage } from "./tokenize";
import { resolveUserColor } from "./user-color";
import type { ChatAssets, ChatFragment } from "./types";

/**
 * A `channel.chat.notification` — sub, resub, gift, raid, announcement.
 *
 * Twitch composes `system_message` itself, so the headline is taken verbatim
 * rather than rebuilt per notice_type. The chatter's own attached message (a
 * resub note, an announcement body) renders below it as normal chat.
 */

export interface ChatNoticeProps {
  systemMessage: string;
  fragments: ChatFragment[];
  chatterName: string;
  chatterLogin: string;
  color: string;
  badges: ChatBadge[];
  assets: ChatAssets;
  assetsVersion?: number;
  noticeType?: string;
  /** Announcements carry their own accent color from Twitch. */
  announcementColor?: string | null;
  broadcasterUserId?: string;
  className?: string;
}

function ChatNoticeInner({
  systemMessage,
  fragments,
  chatterName,
  chatterLogin,
  color,
  badges,
  assets,
  noticeType,
  announcementColor,
  broadcasterUserId,
  className,
}: ChatNoticeProps) {
  const tokens = useMemo(
    () => tokenizeChatMessage(fragments, assets, { broadcasterUserId }),
    [fragments, assets, broadcasterUserId],
  );

  const nameColor = useMemo(() => resolveUserColor(color, chatterLogin), [color, chatterLogin]);
  const isRaid = noticeType === "raid" || noticeType === "shared_chat_raid";
  const hasBody = tokens.length > 0;

  return (
    <div
      className={cn(
        "border-l-2 px-3 py-1.5 text-sm leading-relaxed [content-visibility:auto] [contain-intrinsic-size:auto_3rem]",
        isRaid ? "border-orange-400 bg-orange-400/10" : "border-yellow-400 bg-yellow-400/10",
        className,
      )}
      style={
        announcementColor && announcementColor !== "PRIMARY"
          ? { borderLeftColor: announcementColor }
          : undefined
      }
    >
      <p className="text-xs font-medium text-foreground/90">{systemMessage}</p>

      {hasBody ? (
        <p className="mt-0.5 break-words">
          {badges.map((badge, index) => {
            const url = badgeUrl(badge, assets.badges);
            if (!url) return null;
            return (
              <img
                key={`${badge.set_id}:${badge.id}:${index}`}
                src={url}
                alt={badgeTitle(badge, assets.badges)}
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
          <ChatTokens tokens={tokens} />
        </p>
      ) : null}
    </div>
  );
}

export const ChatNotice = memo(
  ChatNoticeInner,
  (prev, next) =>
    prev.fragments === next.fragments &&
    prev.systemMessage === next.systemMessage &&
    prev.assetsVersion === next.assetsVersion,
);
