const TELEGRAM_API_BASE = "https://api.telegram.org";

export class TelegramRateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super(`Telegram rate limited, retry after ${retryAfterSeconds}s`);
    this.name = "TelegramRateLimitError";
  }
}

export interface SendTelegramMessageOptions {
  /** Overrides the TELEGRAM_CHAT_ID env var. */
  chatId?: string;
}

/**
 * Sends a message via the Telegram Bot API in HTML parse mode. Reads
 * TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from the environment. Throws on
 * failure; a 429 throws TelegramRateLimitError so callers can honor
 * retry_after. Callers that want this to be best-effort should catch.
 */
export async function sendTelegramMessage(text: string, opts?: SendTelegramMessageOptions): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const chatId = opts?.chatId ?? process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error("TELEGRAM_CHAT_ID is not set");

  const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as { parameters?: { retry_after?: number } };
    throw new TelegramRateLimitError(body.parameters?.retry_after ?? 1);
  }
  if (!res.ok) {
    throw new Error(`Couldn't send Telegram message: ${res.status} ${await res.text()}`);
  }
}

/** Escapes <, >, & for Telegram HTML parse mode message bodies. */
export function escapeTelegramHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
