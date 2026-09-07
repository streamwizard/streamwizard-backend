"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button, Input } from "@repo/ui";
import { Loader2, Send } from "lucide-react";
import { sendDeckChatMessage } from "@/actions/twitch/chat";

/**
 * Always sends as the broadcaster — the deck is the streamer's own phone, so a
 * message typed here reads as them.
 */

interface ChatComposerProps {
  disabled?: boolean;
  /** Called with Helix's message id so the pane can show the line immediately. */
  onSent: (messageId: string, text: string) => void;
}

export function ChatComposer({ disabled, onSent }: ChatComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || sending) return;

    // Cleared up front: on a phone, a field that stays full while the request
    // is in flight invites a second tap and a duplicate message.
    setText("");
    setSending(true);
    try {
      const result = await sendDeckChatMessage(message);
      if (!result.ok) {
        setText(message);
        toast.error("Message not sent", { description: result.error });
        return;
      }
      if (result.messageId) onSent(result.messageId, message);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t bg-card/80 px-3 py-2">
      <Input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Send a message"
        disabled={disabled}
        maxLength={500}
        enterKeyHint="send"
        autoCapitalize="sentences"
        autoCorrect="on"
        className="h-11 flex-1 rounded-xl"
      />

      <Button
        type="submit"
        size="icon"
        className="h-11 w-11 shrink-0 rounded-xl"
        disabled={disabled || sending || text.trim().length === 0}
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </form>
  );
}
