"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DeckTab } from "@/components/deck/deck-tab-bar";
import type { SaveBarActions, SaveBarState } from "@/components/deck/switcher-settings-panel";

/**
 * Deck tab navigation, including the unsaved-changes contract.
 *
 * Opening any tab other than the deck pushes a history entry so the system back
 * gesture (Android predictive back, iOS swipe) returns to the deck instead of
 * leaving it. Leaving an edited tab — by tab or by gesture — has to ask first,
 * and popstate can't be cancelled, so the consumed entry is re-armed before the
 * prompt goes up.
 *
 * Only one tab is mounted at a time, so `saveBar` always describes whichever
 * one is on screen. Tabs with nothing to save (deck, chat) simply never report
 * any, which is what makes the guard below tab-agnostic.
 */
export function useDeckTabs() {
  const [tab, setTab] = useState<DeckTab>("deck");
  const [saveBar, setSaveBar] = useState<SaveBarState | null>(null);
  const saveBarActionsRef = useRef<SaveBarActions | null>(null);
  const [discardPrompt, setDiscardPrompt] = useState<DeckTab | null>(null);

  // The panel unmounts with the tab, so its save-bar state leaves with it.
  const clearSaveBar = useCallback(() => {
    setSaveBar(null);
    saveBarActionsRef.current = null;
  }, []);

  const goToTab = useCallback(
    (next: DeckTab) => {
      if (tab === next) return;
      clearSaveBar();

      const armed: DeckTab | undefined = window.history.state?.deckTab;
      if (next === "deck") {
        // Back out of the entry the tab pushed rather than stacking a second
        // one, so a single back gesture from the deck still exits.
        if (armed && armed !== "deck") window.history.back();
      } else if (armed && armed !== "deck") {
        // Already one entry deep — swap which tab it points at instead of
        // making the user press back once per tab they visited.
        window.history.replaceState({ deckTab: next }, "");
      } else {
        window.history.pushState({ deckTab: next }, "");
      }
      setTab(next);
    },
    [tab, clearSaveBar],
  );

  const handleTabChange = (next: DeckTab) => {
    // Leaving an edited tab would silently drop the changes.
    if (next !== tab && saveBar?.dirty) {
      setDiscardPrompt(next);
      return;
    }
    goToTab(next);
  };

  const isDirty = saveBar?.dirty ?? false;

  useEffect(() => {
    const onPopState = () => {
      if (isDirty) {
        // popstate can't be cancelled, so re-arm the entry we just consumed and
        // ask before throwing the edits away.
        window.history.pushState({ deckTab: tab }, "");
        setDiscardPrompt("deck");
        return;
      }
      clearSaveBar();
      setTab(window.history.state?.deckTab ?? "deck");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isDirty, clearSaveBar, tab]);

  return {
    tab,
    handleTabChange,
    goToTab,
    saveBar,
    setSaveBar,
    saveBarActionsRef,
    discardPrompt,
    setDiscardPrompt,
    isDirty,
  };
}
