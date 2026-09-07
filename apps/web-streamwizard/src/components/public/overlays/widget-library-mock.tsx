"use client";

import { useState } from "react";
import { cn } from "@repo/ui";
import { Check, Code2, Download, Plus, Search, Sparkles, X } from "lucide-react";
import { useDemoTracking } from "../analytics/use-demo-tracking";

/*
 * The widget library modal, drawn the way it opens in the editor: the same
 * three tabs (My Widgets, Starters, Public Library), landing on Public
 * Library because that is the tab this section is about. The community
 * widgets are fiction with the demo cast as authors; the starters are the
 * real first-party templates. Install flips locally to make the point the
 * copy makes: what you install is yours.
 */

type Tab = "public" | "starters" | "mine";

const TABS: { id: Tab; label: string }[] = [
  { id: "mine", label: "My Widgets" },
  { id: "starters", label: "Starters" },
  { id: "public", label: "Public Library" },
];

interface LibraryEntry {
  slug: string;
  title: string;
  author: string;
  description: string;
  tags: string[];
  installs: number;
  tint: string;
}

const PUBLIC_ENTRIES: LibraryEntry[] = [
  {
    slug: "death_counter",
    title: "Death counter",
    author: "pixelgremlin",
    description: "Counts your deaths. Chat clips the milestones.",
    tags: ["counter", "gaming"],
    installs: 312,
    tint: "from-red-500/25 via-purple-500/10 to-transparent",
  },
  {
    slug: "sub_goal_bar",
    title: "Sub goal bar",
    author: "sandwichlord",
    description: "Fills toward the goal on every sub and gift.",
    tags: ["goals", "subs"],
    installs: 244,
    tint: "from-purple-500/25 via-indigo-500/10 to-transparent",
  },
  {
    slug: "now_playing",
    title: "Now playing",
    author: "toastcrumb",
    description: "The track you have on, in a corner, without a dashboard tab open.",
    tags: ["music"],
    installs: 187,
    tint: "from-teal-500/25 via-sky-500/10 to-transparent",
  },
  {
    slug: "chat_votes",
    title: "Chat votes",
    author: "ninetoad",
    description: "Chat types 1 or 2, the bars move.",
    tags: ["chat", "polls"],
    installs: 156,
    tint: "from-amber-500/25 via-rose-500/10 to-transparent",
  },
];

const STARTERS = [
  {
    title: "Walking stats",
    description: "Speed, distance, location and weather in one bar. Metric or imperial, modules toggle off.",
  },
  {
    title: "Auto switcher monitor",
    description: "A bitrate health bar that watches your connection along with the switcher.",
  },
];

const MY_WIDGETS = ["death counter (mine now)", "geo bar"];

function LibraryCard({ entry, installed, onInstall }: { entry: LibraryEntry; installed: boolean; onInstall: () => void }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] transition-colors hover:border-white/[0.14]">
      <div className={cn("flex h-16 shrink-0 items-center justify-center bg-gradient-to-br sm:h-20", entry.tint)}>
        <span className="rounded-lg bg-black/40 p-2 ring-1 ring-white/10">
          <Code2 className="h-4 w-4 text-purple-300" aria-hidden="true" />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="truncate text-sm font-semibold">{entry.title}</h4>
          <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-muted-foreground">
            <Download className="h-3 w-3" aria-hidden="true" />
            {entry.installs}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{entry.description}</p>
        <p className="font-mono text-[10px] text-muted-foreground/70">by {entry.author}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
          <div className="flex flex-wrap gap-1">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={onInstall}
            aria-pressed={installed}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              installed
                ? "border-purple-500/50 bg-purple-500/15 text-purple-300"
                : "border-white/[0.12] bg-white/[0.05] text-foreground hover:border-purple-400/40 hover:bg-purple-500/10",
            )}
          >
            {installed ? (
              <>
                <Check className="h-3 w-3" aria-hidden="true" />
                Installed
              </>
            ) : (
              "Install"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WidgetLibraryMock() {
  const track = useDemoTracking("widget_library");
  const [tab, setTab] = useState<Tab>("public");
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const anyInstalled = Object.values(installed).some(Boolean);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-[0_16px_48px_-16px_rgba(158,122,255,0.25)] sm:p-5">
        {/* Modal chrome: title, close, the real three tabs */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Widget Library</p>
          <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div
            role="group"
            aria-label="Library tabs"
            className="flex rounded-md border border-white/[0.08] bg-white/[0.03] p-0.5 text-xs"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tab === t.id}
                onClick={() => {
                  track(`tab_${t.id}`);
                  setTab(t.id);
                }}
                className={cn(
                  "rounded px-2.5 py-1 transition-colors",
                  tab === t.id ? "bg-purple-500/15 text-purple-300" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div
            aria-hidden="true"
            className="flex w-40 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs text-muted-foreground/70"
          >
            <Search className="h-3 w-3" />
            Search the library
          </div>
        </div>

        <div className="mt-4">
          {tab === "public" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {PUBLIC_ENTRIES.map((entry) => (
                <LibraryCard
                  key={entry.slug}
                  entry={entry}
                  installed={!!installed[entry.slug]}
                  onInstall={() => {
                    track(`install_${entry.slug}`);
                    setInstalled((prev) => ({ ...prev, [entry.slug]: !prev[entry.slug] }));
                  }}
                />
              ))}
            </div>
          ) : null}

          {tab === "starters" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {STARTERS.map((starter) => (
                <div key={starter.title} className="flex flex-col gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-purple-300" aria-hidden="true" />
                    <h4 className="text-sm font-semibold">{starter.title}</h4>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{starter.description}</p>
                  <p className="mt-auto pt-1 font-mono text-[10px] text-muted-foreground/70">
                    First party. Use it as is, or open the code and make it yours.
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {tab === "mine" ? (
            <div>
              <div className="flex justify-end">
                <span className="flex items-center gap-1 rounded-md border border-white/[0.12] bg-white/[0.05] px-2.5 py-1 text-xs font-medium">
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  New Widget
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {MY_WIDGETS.map((name) => (
                  <div key={name} className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                    <Code2 className="h-4 w-4 shrink-0 text-purple-300" aria-hidden="true" />
                    <span className="truncate text-sm">{name}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Everything you install or write lands here, code and settings included.
              </p>
            </div>
          ) : null}
        </div>

        <p
          className={cn(
            "mt-3 text-center text-xs text-purple-300/90 transition-opacity",
            anyInstalled ? "opacity-100" : "opacity-0",
          )}
          aria-hidden={!anyInstalled}
        >
          It is a copy, and it is yours to edit. The author updating theirs never touches yours.
        </p>
      </div>
    </div>
  );
}
