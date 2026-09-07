"use client";

import { useMemo, useRef, useState } from "react";
import { Button, Input } from "@repo/ui";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui";
import type { RootOverlayItemType } from "@/types/overlays";
import { BookOpen, LayoutGrid, Plus, Search } from "lucide-react";
import {
  getLibraryWidgetDefinitions,
  groupLibraryWidgetsByCategory,
} from "../registry/overlay-widget-registry";
import type {
  OverlayRootWidgetDefinition,
  WidgetCategory,
} from "../registry/overlay-widget-registry.types";
import { filterLibraryWidgets } from "./widget-search";

const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  media: "Media",
  alerts: "Alerts",
  layout: "Layout",
  other: "Other",
};

interface OverlayWidgetSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddWidget: (type: RootOverlayItemType) => void;
  onOpenLibrary: () => void;
}

export function OverlayWidgetSheet({
  open,
  onOpenChange,
  onAddWidget,
  onOpenLibrary,
}: OverlayWidgetSheetProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-md flex flex-col"
        // Radix would focus the first tabbable thing, which is the Open Library
        // button. Searching is the reason this panel exists, so focus goes there.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchRef.current?.focus();
        }}
      >
        <SheetHeader className="text-left shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Widget library
          </SheetTitle>
          <SheetDescription>
            Add root widgets to the scene. Nested items can be managed from the
            layers panel.
          </SheetDescription>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-1"
            onClick={() => {
              onOpenChange(false);
              onOpenLibrary();
            }}
          >
            <BookOpen className="mr-2 h-3.5 w-3.5" />
            Open Library
          </Button>
        </SheetHeader>

        {/*
          Its own component so closing the sheet unmounts it: reopening starts
          from an empty search rather than whatever was typed last time.
        */}
        <WidgetPicker searchRef={searchRef} onAddWidget={onAddWidget} />
      </SheetContent>
    </Sheet>
  );
}

function WidgetPicker({
  searchRef,
  onAddWidget,
}: {
  searchRef: React.RefObject<HTMLInputElement | null>;
  onAddWidget: (type: RootOverlayItemType) => void;
}) {
  const [query, setQuery] = useState("");
  const searching = query.trim() !== "";

  const byCategory = useMemo(() => groupLibraryWidgetsByCategory(), []);
  const matches = useMemo(
    () => (searching ? filterLibraryWidgets(getLibraryWidgetDefinitions(), query) : []),
    [searching, query]
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
      <div className="relative sticky top-0 z-10 -mx-1 bg-background pt-1 pb-2">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search widgets…"
          className="h-9 pl-9"
        />
      </div>

      {searching ? (
        matches.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No widgets match your search.
          </p>
        ) : (
          // Categories are noise once a query narrows things down; one ranked
          // list is easier to scan than four headed ones.
          <div className="space-y-2">
            {matches.map((def) => (
              <WidgetButton key={def.type} def={def} onAddWidget={onAddWidget} />
            ))}
          </div>
        )
      ) : (
        <>
          {(Object.keys(CATEGORY_LABELS) as WidgetCategory[]).map((category) => {
            const defs = byCategory[category];
            if (defs.length === 0) return null;
            return (
              <section key={category}>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  {CATEGORY_LABELS[category]}
                </h4>
                <div className="space-y-2">
                  {defs.map((def) => (
                    <WidgetButton key={def.type} def={def} onAddWidget={onAddWidget} />
                  ))}
                </div>
              </section>
            );
          })}

          <section>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Coming soon
            </h4>
            <p className="text-xs text-muted-foreground">
              More categories and widgets will appear here as they are added to
              the registry.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function WidgetButton({
  def,
  onAddWidget,
}: {
  def: OverlayRootWidgetDefinition;
  onAddWidget: (type: RootOverlayItemType) => void;
}) {
  const title = def.library?.title ?? def.type;

  return (
    <Button
      variant="outline"
      className="w-full h-auto justify-start gap-2 py-3 flex-col items-stretch text-left whitespace-normal"
      type="button"
      onClick={() => onAddWidget(def.type as RootOverlayItemType)}
    >
      <span className="flex items-center w-full min-w-0">
        <Plus className="h-4 w-4 mr-2 shrink-0" />
        <span className="font-medium text-left min-w-0 wrap-break-word">{title}</span>
      </span>
      {def.library?.description ? (
        <span className="block w-full min-w-0 pl-6 text-xs font-normal text-muted-foreground text-left wrap-break-word leading-snug">
          {def.library.description}
        </span>
      ) : null}
    </Button>
  );
}
