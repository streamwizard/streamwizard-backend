import { cheermoteUrl, twitchEmoteUrl } from "./asset-urls";
import type { ChatAssets, ChatFragment, ChatRenderOptions, ChatToken } from "./types";

/**
 * EventSub → renderable tokens.
 *
 * Twitch has already split out its own emotes, cheermotes and mentions, so the
 * only real parsing left is inside `text` fragments: third-party emote codes
 * (7TV/BTTV/FFZ) and URLs, neither of which Twitch knows about.
 */

// Deliberately conservative. A false positive turns a word into a link the
// streamer might tap by accident, which is worse than a missed bare domain.
const EXPLICIT_URL = /^https?:\/\/[^\s]+$/i;
const BARE_DOMAIN =
  /^(?:www\.[^\s]+|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|tv|gg|co|dev|app|me|xyz)(?:\/[^\s]*)?)$/i;

function linkHref(word: string): string | null {
  const trimmed = word.replace(/[),.!?]+$/, "");
  if (!trimmed) return null;
  if (EXPLICIT_URL.test(trimmed)) return trimmed;
  if (BARE_DOMAIN.test(trimmed)) return `https://${trimmed}`;
  return null;
}

/** Appends to the tail token when it's also text, so runs don't fragment. */
function pushText(tokens: ChatToken[], text: string) {
  if (!text) return;
  const last = tokens[tokens.length - 1];
  if (last?.kind === "text") {
    last.text += text;
    return;
  }
  tokens.push({ kind: "text", text });
}

function tokenizeText(
  text: string,
  assets: ChatAssets,
  tokens: ChatToken[],
  opts: ChatRenderOptions,
) {
  // Split keeping the separators, so the original spacing survives a round trip.
  for (const chunk of text.split(/(\s+)/)) {
    if (!chunk) continue;
    if (/^\s+$/.test(chunk)) {
      pushText(tokens, chunk);
      continue;
    }

    const emote = assets.thirdPartyEmotes[chunk];
    if (emote) {
      tokens.push({
        kind: "emote",
        name: emote.name,
        url: opts.gigantified ? emote.url_4x : emote.url_2x,
        provider: emote.provider,
        big: opts.gigantified,
      });
      continue;
    }

    const href = linkHref(chunk);
    if (href) {
      tokens.push({ kind: "link", text: chunk, href });
      continue;
    }

    pushText(tokens, chunk);
  }
}

export function tokenizeChatMessage(
  fragments: ChatFragment[],
  assets: ChatAssets,
  opts: ChatRenderOptions = {},
): ChatToken[] {
  const tokens: ChatToken[] = [];

  for (const fragment of fragments) {
    switch (fragment.type) {
      case "emote":
        if (!fragment.emote) {
          pushText(tokens, fragment.text);
          break;
        }
        tokens.push({
          kind: "emote",
          name: fragment.text,
          url: twitchEmoteUrl(fragment.emote.id, { big: opts.gigantified }),
          provider: "twitch",
          big: opts.gigantified,
        });
        break;

      case "cheermote": {
        if (!fragment.cheermote) {
          pushText(tokens, fragment.text);
          break;
        }
        const resolved = cheermoteUrl(fragment.cheermote, assets.cheermotes);
        tokens.push({
          kind: "cheermote",
          prefix: fragment.cheermote.prefix,
          bits: fragment.cheermote.bits,
          url: resolved?.url,
          color: resolved?.color,
        });
        break;
      }

      case "mention":
        tokens.push({
          kind: "mention",
          text: fragment.text,
          userId: fragment.mention?.user_id,
          isBroadcaster:
            opts.broadcasterUserId != null && fragment.mention?.user_id === opts.broadcasterUserId,
        });
        break;

      default:
        tokenizeText(fragment.text, assets, tokens, opts);
    }
  }

  return tokens;
}

/** True when the message mentions the channel owner — used to highlight the row. */
export function mentionsBroadcaster(tokens: ChatToken[]): boolean {
  return tokens.some((token) => token.kind === "mention" && token.isBroadcaster);
}
