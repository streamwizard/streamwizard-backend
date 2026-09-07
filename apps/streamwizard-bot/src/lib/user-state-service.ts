import { supabase } from "@repo/supabase";
import { createUserStateService } from "@repo/user-state";
import { overlayWsClient } from "../overlay-ws-client";

/**
 * The bot's user-state service.
 *
 * NOT WIRED UP YET — nothing in the bot imports this. It's deliberate
 * groundwork, kept so the wiring is a one-line import when the work lands.
 *
 * It is not wired to any EventSub handler on purpose: stream lifecycle
 * (stream.online/offline) only reaches the rest-api webhook, which owns the
 * sys.* keys and the stream resets. What this instance is for is the mutation
 * paths that DO live in the bot — the chat-command dispatcher
 * ("!death add 1" → increment) and anything else bot-side that touches state.
 * Import `userStateService` from that dispatcher when it exists.
 *
 * Pushes ride the bot's persistent role=bot socket. Send is fire-and-forget
 * and drops when the socket is down; the DB row is the durable truth and a
 * widget catches up on its next read.
 */
export const userStateService = createUserStateService({
  client: supabase,
  broadcast: (userId, payload) => {
    overlayWsClient.send({ userId, type: "streamwizard.user_state", payload });
  },
});
