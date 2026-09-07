"use client";

import { Button, cn } from "@repo/ui";
import { LayoutGrid, Loader2, MessageSquare, PencilLine, SlidersHorizontal } from "lucide-react";
import type { SaveBarState } from "@/components/deck/switcher-settings-panel";

export type DeckTab = "deck" | "chat" | "stream" | "switcher";

// Single fixed stack at the bottom of the deck: the save bar sits directly on
// top of the tab bar, so neither needs to know the other's height. The whole
// stack carries the bottom safe-area inset (iOS gesture bar, Android nav bar).

const TABS: { value: DeckTab; label: string; Icon: typeof LayoutGrid }[] = [
  { value: "deck", label: "Deck", Icon: LayoutGrid },
  { value: "chat", label: "Chat", Icon: MessageSquare },
  { value: "stream", label: "Stream info", Icon: PencilLine },
  { value: "switcher", label: "Sensitivity", Icon: SlidersHorizontal },
];

// Derived rather than written out, so adding a tab above is the only edit.
const TAB_GRID_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

interface DeckFooterProps {
  tab: DeckTab;
  onTabChange: (next: DeckTab) => void;
  /** Null on the deck tab, or when the switcher form has nothing to save. */
  saveBar: SaveBarState | null;
  onSave: () => void;
  onDiscard: () => void;
  /** Dot on the chat tab while unseen chat activity is waiting. */
  chatUnread?: boolean;
}

export function DeckFooter({ tab, onTabChange, saveBar, onSave, onDiscard, chatUnread }: DeckFooterProps) {
  const showSaveBar = saveBar != null && (saveBar.dirty || saveBar.submitting);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
      {showSaveBar ? (
        <div className="border-t bg-card/95 px-4 py-3 backdrop-blur motion-safe:animate-in motion-safe:slide-in-from-bottom-2">
          <div className="mx-auto flex w-full max-w-md items-center gap-3">
            <p className={cn("min-w-0 flex-1 text-xs", saveBar.hasErrors ? "text-destructive" : "text-muted-foreground")}>
              {saveBar.hasErrors ? "Fix the highlighted settings." : "Unsaved changes."}
            </p>
            <Button
              type="button"
              variant="ghost"
              className="h-11 rounded-xl"
              onClick={onDiscard}
              disabled={saveBar.submitting}
            >
              Discard
            </Button>
            <Button type="button" className="h-11 rounded-xl px-6" onClick={onSave} disabled={saveBar.submitting}>
              {saveBar.submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      ) : null}

      <nav aria-label="Deck sections" className="border-t bg-card/95 backdrop-blur">
        <div className={cn("mx-auto grid w-full max-w-md", TAB_GRID_COLS[TABS.length])}>
          {TABS.map(({ value, label, Icon }) => {
            const active = value === tab;
            const showDot = value === "chat" && chatUnread && !active;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onTabChange(value)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 transition-colors active:bg-accent",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {active ? <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary" /> : null}
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {showDot ? (
                    <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full border border-card bg-primary" />
                  ) : null}
                </span>
                {/* Four tabs on a narrow phone: the longer labels have to be
                    allowed to truncate rather than wrap the row taller. */}
                <span className="w-full truncate px-1 text-center text-[11px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/**
 * Exact footer height for the chat tab. The scrolling-content tabs pad
 * generously so the last card isn't flush against the nav, but the chat
 * composer is meant to sit right on top of it — extra padding would read as a
 * gap in the middle of the keyboard stack.
 */
export const deckChatPadding = "pb-[calc(4rem_+_env(safe-area-inset-bottom))]";

/** Bottom padding for <main> so nothing hides behind the fixed footer. */
export function deckMainPadding(showSaveBar: boolean) {
  // Underscores are Tailwind's escape for the spaces calc() requires around `+`.
  return showSaveBar
    ? "pb-[calc(9.5rem_+_env(safe-area-inset-bottom))]"
    : "pb-[calc(5.5rem_+_env(safe-area-inset-bottom))]";
}
