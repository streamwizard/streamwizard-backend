import { MAX_TEXT_LENGTH } from "@repo/alert-scene";

export interface TokenInsertion {
  text: string;
  /** Where the caret lands: right after the token, or unchanged when nothing fit. */
  caret: number;
}

/**
 * Puts `{token}` where the caret is, replacing any selection. Refuses rather
 * than truncates when the result would pass the text limit, so a chip never
 * eats the end of what someone typed.
 */
export function insertToken(text: string, token: string, selectionStart: number, selectionEnd: number): TokenInsertion {
  const start = Math.max(0, Math.min(text.length, Math.min(selectionStart, selectionEnd)));
  const end = Math.max(start, Math.min(text.length, Math.max(selectionStart, selectionEnd)));
  const chip = `{${token}}`;
  const next = text.slice(0, start) + chip + text.slice(end);
  if (next.length > MAX_TEXT_LENGTH) return { text, caret: start };
  return { text: next, caret: start + chip.length };
}
