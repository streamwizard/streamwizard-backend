"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Input, cn } from "@repo/ui";
import { Check, Loader2, Search, X } from "lucide-react";
import { searchTwitchCategories } from "@/actions/twitch/twitch-api";
import type { TwitchCategory } from "@/types/twitch";

/**
 * Category search for the deck.
 *
 * The dashboard has its own picker (`components/search-bars/twitch-category-search`),
 * but it is built around a fixed-height desktop dropdown with small controls;
 * this one is full-width rows at deck touch size, and shows the current pick as
 * a card rather than a line of text.
 */

const DEBOUNCE_MS = 300;
const BOX_ART_WIDTH = 52;
const BOX_ART_HEIGHT = 69;

function boxArt(url: string) {
  return url.replace("{width}", String(BOX_ART_WIDTH * 2)).replace("{height}", String(BOX_ART_HEIGHT * 2));
}

interface CategoryPickerProps {
  broadcasterId: string;
  value: { id: string; name: string; boxArtUrl?: string } | null;
  onChange: (category: { id: string; name: string; boxArtUrl?: string }) => void;
  disabled?: boolean;
}

export function CategoryPicker({ broadcasterId, value, onChange, disabled }: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Results carry the term they belong to, so a stale set is simply not shown
  // rather than needing to be cleared on every keystroke.
  const [results, setResults] = useState<{ term: string; items: TwitchCategory[] }>({
    term: "",
    items: [],
  });
  // Bumped per keystroke so a slow earlier response can't overwrite a newer one.
  const requestRef = useRef(0);

  const term = query.trim();

  useEffect(() => {
    if (!open || term.length < 2) return;

    const requestId = ++requestRef.current;
    const timer = setTimeout(async () => {
      try {
        const found = await searchTwitchCategories(broadcasterId, term, 12);
        if (requestRef.current !== requestId) return;
        // Twitch ranks loosely; an exact name match belongs first.
        const lowered = term.toLowerCase();
        const items = [...(found ?? [])].sort((a, b) => {
          const aExact = a.name.toLowerCase() === lowered ? 0 : 1;
          const bExact = b.name.toLowerCase() === lowered ? 0 : 1;
          return aExact - bExact;
        });
        setResults({ term, items });
      } catch {
        if (requestRef.current === requestId) setResults({ term, items: [] });
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term, open, broadcasterId]);

  const searching = term.length >= 2 && results.term !== term;

  // Art always arrives with the value: search results carry their own, and the
  // loaded category gets its box art resolved alongside the channel info in
  // `getMyChannelInfo`, so the picker never fetches an image itself.
  const currentArt = value?.boxArtUrl;

  const pick = (category: TwitchCategory) => {
    onChange({ id: category.id, name: category.name, boxArtUrl: category.box_art_url });
    setOpen(false);
    setQuery("");
  };

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors active:bg-accent",
          disabled && "opacity-60",
        )}
      >
        {currentArt ? (
          <img
            src={boxArt(currentArt)}
            alt=""
            width={BOX_ART_WIDTH}
            height={BOX_ART_HEIGHT}
            className="shrink-0 rounded-md object-cover"
          />
        ) : (
          <span
            className="flex shrink-0 items-center justify-center rounded-md bg-muted"
            style={{ width: BOX_ART_WIDTH, height: BOX_ART_HEIGHT }}
          >
            <Search className="h-5 w-5 text-muted-foreground" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Category
          </span>
          <span className="block truncate text-base font-semibold">
            {value?.name ?? "Pick a category"}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border bg-card">
      <div className="flex items-center gap-2 border-b p-2">
        <Search className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search categories"
          className="h-11 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={() => {
            setOpen(false);
            setQuery("");
          }}
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="max-h-[45dvh] overflow-y-auto overscroll-contain">
        {searching ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching…
          </div>
        ) : term.length < 2 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Type at least two characters.
          </p>
        ) : results.items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Nothing matched &ldquo;{term}&rdquo;.
          </p>
        ) : (
          results.items.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => pick(category)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors active:bg-accent"
            >
              <img
                src={boxArt(category.box_art_url)}
                alt=""
                width={BOX_ART_WIDTH}
                height={BOX_ART_HEIGHT}
                loading="lazy"
                className="shrink-0 rounded-md object-cover"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{category.name}</span>
              {value?.id === category.id ? (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
