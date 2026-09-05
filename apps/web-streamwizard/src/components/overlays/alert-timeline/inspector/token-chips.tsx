"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { ALERT_EVENT_LABELS, ALERT_TEMPLATE_TOKENS, alertTokensForEvent } from "@repo/ui/overlay";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui";
import { useTimeline } from "../timeline-context";
import { insertToken } from "./token-insert";

export interface TokenChipsProps {
  text: string;
  /** The Text field these chips type into. */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** Same path as typing, so a chip coalesces into the typing undo step. */
  onChange: (next: string) => void;
}

/** Mouse-down on a chip must not steal focus from the textarea, or the caret is lost. */
const keepFocus = (e: React.MouseEvent) => e.preventDefault();

/**
 * One chip per template token. A click drops the token at the caret (or over
 * the selection) and leaves the caret after it, so chips and typing mix.
 * Tokens the event never fills are shown but off, with the reason.
 */
export function TokenChips({ text, textareaRef, onChange }: TokenChipsProps) {
  const event = useTimeline((s) => s.event);
  const available = alertTokensForEvent(event);
  const eventLabel = ALERT_EVENT_LABELS[event].toLowerCase();
  // The textarea is controlled: its value lands on the next commit, and only
  // then can the caret move behind the token.
  const pendingCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null) return;
    pendingCaret.current = null;
    const el = textareaRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(caret, caret);
  }, [text, textareaRef]);

  const insert = (token: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? start;
    const res = insertToken(text, token, start, end);
    if (res.text === text) return;
    pendingCaret.current = res.caret;
    onChange(res.text);
  };

  return (
    <div className="flex flex-wrap gap-1 pt-1" data-token-chips="">
      {ALERT_TEMPLATE_TOKENS.map((token) => {
        const on = available.has(token);
        const chip = (
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="font-mono"
            disabled={!on}
            aria-label={`Insert {${token}}`}
            onMouseDown={keepFocus}
            onClick={() => insert(token)}
          >
            {`{${token}}`}
          </Button>
        );
        if (on) return <span key={token}>{chip}</span>;
        return (
          <Tooltip key={token}>
            {/* A disabled button gets no pointer events, so the wrapper carries the tooltip. */}
            <TooltipTrigger asChild>
              <span tabIndex={-1} className="inline-flex">
                {chip}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{`{${token}} stays empty on a ${eventLabel} alert.`}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
