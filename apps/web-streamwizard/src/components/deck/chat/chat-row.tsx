"use client";

import { useState } from "react";
import { cn } from "@repo/ui";
import { ChatMessage, ChatNotice, type ChatAssets, type ChatFragment } from "@repo/ui/chat";
import { Inbox } from "lucide-react";
import { EVENT_CONFIG } from "@/lib/event-config";
import type { ChatEntry } from "@/hooks/deck/use-deck-chat-room";

/**
 * Maps one feed entry onto the right renderer from `@repo/ui/chat`, and owns
 * the only per-row local state there is: whether a deleted message has been
 * revealed.
 */

interface ChatRowProps {
  entry: ChatEntry;
  assets: ChatAssets;
  assetsVersion: number;
  broadcasterUserId?: string;
  onReplyClick?: (parentMessageId: string) => void;
}

export function ChatRow({
  entry,
  assets,
  assetsVersion,
  broadcasterUserId,
  onReplyClick,
}: ChatRowProps) {
  const [revealed, setRevealed] = useState(false);

  if (entry.kind === "system") {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{entry.text}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    );
  }

  if (entry.kind === "event") {
    const config = EVENT_CONFIG[entry.type];
    const Icon = config?.icon ?? Inbox;
    let label = entry.type;
    try {
      label = config?.label(entry.payload) ?? entry.type;
    } catch {
      // A payload shape change should cost one label, not the whole row.
    }

    return (
      <div className="flex items-start gap-2 border-l-2 border-muted-foreground/40 bg-muted/40 px-3 py-1.5 text-sm [content-visibility:auto] [contain-intrinsic-size:auto_2rem]">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config?.color)} />
        <p className="min-w-0 flex-1 text-xs font-medium leading-relaxed text-foreground/90">{label}</p>
      </div>
    );
  }

  if (entry.kind === "notice") {
    const notification = entry.notification;
    return (
      <ChatNotice
        systemMessage={notification.system_message}
        fragments={notification.message.fragments as ChatFragment[]}
        chatterName={notification.chatter_user_name}
        chatterLogin={notification.chatter_user_login}
        color={notification.color}
        badges={notification.badges}
        assets={assets}
        assetsVersion={assetsVersion}
        noticeType={notification.notice_type}
        announcementColor={notification.announcement?.color ?? null}
        broadcasterUserId={broadcasterUserId}
      />
    );
  }

  const message = entry.message;
  return (
    <ChatMessage
      fragments={message.message.fragments as ChatFragment[]}
      chatterName={message.chatter_user_name}
      chatterLogin={message.chatter_user_login}
      color={message.color}
      badges={message.badges}
      assets={assets}
      assetsVersion={assetsVersion}
      broadcasterUserId={broadcasterUserId}
      messageType={message.message_type}
      cheerBits={message.cheer?.bits}
      reply={message.reply ?? null}
      deleted={entry.deleted}
      pending={entry.pending}
      failed={entry.failed}
      revealed={revealed}
      onReveal={() => setRevealed(true)}
      onReplyClick={onReplyClick}
    />
  );
}
