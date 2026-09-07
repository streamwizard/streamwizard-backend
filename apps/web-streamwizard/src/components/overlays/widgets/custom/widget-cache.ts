"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getWidget } from "@/actions/widgets";
import type { Widget } from "@/actions/widgets";

/**
 * The canvas item and the inspector both need the same widget row, and a scene
 * can hold several items pointing at one widget. Without a cache that's one
 * request per component mount -- which is why settings only appeared once the
 * widget was clicked.
 *
 * Module scope on purpose: the editor is a single page, and a widget row only
 * changes when its author saves it in the widget editor (a different tab, which
 * reloads this one's data on navigation anyway).
 */
const widgets = new Map<string, Widget>();
const inFlight = new Map<string, Promise<Widget | null>>();
const subscribers = new Set<() => void>();

function notify() {
  for (const fn of subscribers) fn();
}

/** Seeds rows already fetched elsewhere (server prefetch, widget picker list). */
export function primeWidgetCache(rows: Widget[]) {
  let added = false;
  for (const row of rows) {
    if (widgets.has(row.id)) continue;
    widgets.set(row.id, row);
    added = true;
  }
  if (added) notify();
}

export function getCachedWidget(id: string): Widget | undefined {
  return widgets.get(id);
}

/** Fetches once per id, even when several components ask at the same moment. */
export function fetchWidget(id: string): Promise<Widget | null> {
  const cached = widgets.get(id);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(id);
  if (pending) return pending;

  const request = getWidget(id)
    .then(({ data }) => {
      if (data) {
        widgets.set(id, data);
        notify();
      }
      return data;
    })
    .finally(() => {
      inFlight.delete(id);
    });

  inFlight.set(id, request);
  return request;
}

/** Warms the cache for every widget a scene references. */
export function prefetchWidgets(ids: string[]) {
  for (const id of ids) {
    if (id) void fetchWidget(id);
  }
}

function subscribe(onChange: () => void) {
  subscribers.add(onChange);
  return () => {
    subscribers.delete(onChange);
  };
}

/**
 * Returns the widget row, from cache when it's already there -- so a prefetched
 * widget renders on the first paint instead of after a round trip.
 */
export function useWidget(id: string | undefined): Widget | null {
  // Map entries are replaced, never mutated, so the snapshot is referentially
  // stable between cache writes.
  const read = () => (id ? (widgets.get(id) ?? null) : null);
  const widget = useSyncExternalStore(subscribe, read, read);

  useEffect(() => {
    if (id) void fetchWidget(id);
  }, [id]);

  return widget;
}
