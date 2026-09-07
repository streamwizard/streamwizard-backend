"use server";

import { TwitchApi } from "@repo/twitch-api";
import { createClient } from "@repo/supabase/next/server";
import { getTwitchUserId } from "@repo/supabase/queries/user";
import { reportError } from "@repo/sentry";

/**
 * Sending chat from the deck, always as the broadcaster — the deck is the
 * streamer's own phone, so a message typed there reads as them. Speaking as
 * the bot is the bot's own job and not something this surface offers.
 *
 * Helix caps a message at 500 characters and rejects the whole request past
 * that, so it's checked here rather than surfacing as an opaque 400 on a phone.
 */
const MAX_MESSAGE_LENGTH = 500;

export interface SendDeckChatResult {
  ok: boolean;
  /** Helix's id for the sent message; the socket echo arrives under the same id. */
  messageId?: string;
  error?: string;
}

export async function sendDeckChatMessage(
  message: string,
  opts: { replyToMessageId?: string | null } = {},
): Promise<SendDeckChatResult> {
  const text = message.trim();
  if (!text) return { ok: false, error: "Nothing to send" };
  if (text.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `Messages are capped at ${MAX_MESSAGE_LENGTH} characters` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const twitchUserId = await getTwitchUserId(supabase);
  if (!twitchUserId) return { ok: false, error: "Connect your Twitch account first" };

  try {
    const api = new TwitchApi(twitchUserId);
    const response = await api.chat.sendMessage({
      message: text,
      sender: "broadcaster",
      replyToMessageId: opts.replyToMessageId ?? null,
    });

    // Twitch answers 200 with is_sent:false when AutoMod holds a message, so a
    // successful HTTP call is not on its own proof that chat saw anything.
    const sent = response?.data?.[0];
    if (sent && sent.is_sent === false) {
      return {
        ok: false,
        error: sent.drop_reason?.message ?? "Twitch held that message back",
      };
    }

    return { ok: true, messageId: sent?.message_id };
  } catch (error) {
    reportError(error, "sendDeckChatMessage");
    return { ok: false, error: "Couldn't send that message" };
  }
}
