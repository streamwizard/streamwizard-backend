"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@repo/ui";
import { Loader2 } from "lucide-react";
import { searchTwitchChannels } from "@/actions/twitch/twitch-api";
import type { ChannelSearchResult } from "@repo/twitch-api";

/**
 * The stream title, with autocomplete for the @mentions Twitch renders as
 * channel links.
 *
 * A textarea rather than an input: titles run long, and on a phone a
 * single-line field that scrolls sideways hides the half you just typed.
 */

const DEBOUNCE_MS = 250;
const MAX_TITLE_LENGTH = 140;
/** Below this a mention query matches most of Twitch and helps nobody. */
const MIN_MENTION_QUERY = 2;

/** The @mention being typed at the caret, if any. */
function mentionAtCaret(value: string, caret: number): { query: string; start: number } | null {
  const before = value.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;

  // Must start a word, or it's an email-ish string rather than a mention.
  if (at > 0 && !/\s/.test(before[at - 1]!)) return null;

  const query = before.slice(at + 1);
  // A space closes the mention; Twitch logins can't contain one.
  if (/[^\w]/.test(query)) return null;

  return { query, start: at };
}

interface TitleFieldProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

export function TitleField({ value, onChange, disabled }: TitleFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  // Suggestions carry the query they belong to, so a stale set is simply not
  // shown rather than needing to be cleared on every keystroke.
  const [suggestions, setSuggestions] = useState<{ query: string; items: ChannelSearchResult[] }>({
    query: "",
    items: [],
  });
  const requestRef = useRef(0);

  const mentionQuery = mention?.query ?? "";
  const canSearch = mentionQuery.length >= MIN_MENTION_QUERY;

  useEffect(() => {
    if (!canSearch) return;

    const requestId = ++requestRef.current;
    const timer = setTimeout(async () => {
      try {
        const found = await searchTwitchChannels(mentionQuery, 6);
        if (requestRef.current !== requestId) return;
        setSuggestions({ query: mentionQuery, items: found ?? [] });
      } catch {
        if (requestRef.current === requestId) setSuggestions({ query: mentionQuery, items: [] });
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [mentionQuery, canSearch]);

  const searching = canSearch && suggestions.query !== mentionQuery;

  const syncMention = (next: string, caret: number) => {
    setMention(mentionAtCaret(next, caret));
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    onChange(next);
    syncMention(next, event.target.selectionStart ?? next.length);
  };

  const insert = (login: string) => {
    if (!mention) return;
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const next = `${value.slice(0, mention.start)}@${login} ${value.slice(caret)}`;
    onChange(next.slice(0, MAX_TITLE_LENGTH));
    setMention(null);

    // Put the caret after the inserted mention rather than at the end, so the
    // streamer can keep typing mid-sentence.
    const caretAfter = mention.start + login.length + 2;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caretAfter, caretAfter);
    });
  };

  const remaining = MAX_TITLE_LENGTH - value.length;
  const showSuggestions = mention != null && canSearch;

  return (
    <div className="relative">
      <label
        htmlFor="deck-stream-title"
        className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
      >
        Title
      </label>

      <textarea
        id="deck-stream-title"
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyUp={(event) =>
          syncMention(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)
        }
        onClick={(event) =>
          syncMention(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)
        }
        onBlur={() => {
          // Delayed so a tap on a suggestion lands before the list unmounts.
          setTimeout(() => setMention(null), 150);
        }}
        disabled={disabled}
        rows={3}
        maxLength={MAX_TITLE_LENGTH}
        placeholder="What are you streaming?"
        enterKeyHint="done"
        className={cn(
          "w-full resize-none rounded-2xl border bg-card p-3 text-base leading-relaxed",
          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "opacity-60",
        )}
      />

      <p
        className={cn(
          "mt-1 text-right text-[11px] tabular-nums",
          remaining <= 15 ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {remaining} left
      </p>

      {showSuggestions ? (
        <div className="absolute inset-x-0 top-full z-20 -mt-4 overflow-hidden rounded-2xl border bg-card shadow-lg">
          {searching ? (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          ) : suggestions.items.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">No channels found.</p>
          ) : (
            suggestions.items.map((channel) => (
              <button
                key={channel.id}
                type="button"
                // Mousedown, not click: blur fires first on a click and would
                // tear the list down before the handler ran.
                onMouseDown={(event) => {
                  event.preventDefault();
                  insert(channel.broadcaster_login);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors active:bg-accent"
              >
                {channel.thumbnail_url ? (
                  <img
                    src={channel.thumbnail_url}
                    alt=""
                    width={32}
                    height={32}
                    loading="lazy"
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{channel.display_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{channel.broadcaster_login}
                  </span>
                </span>
                {channel.is_live ? (
                  <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                    LIVE
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
