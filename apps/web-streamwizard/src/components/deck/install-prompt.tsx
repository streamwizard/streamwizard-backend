"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent } from "@repo/ui";
import { MonitorDown } from "lucide-react";

// Chromium-only event, not in lib.dom.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISSED_KEY = "deck-install-dismissed";

/**
 * Custom install banner for the deck. Chrome fires `beforeinstallprompt` on
 * pages that link an installable manifest (only /deck does), so this never
 * shows anywhere else. Nothing renders on iOS or in an already-installed app.
 */
export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!installEvent) return null;

  const install = async () => {
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "dismissed") localStorage.setItem(DISMISSED_KEY, "1");
    setInstallEvent(null);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setInstallEvent(null);
  };

  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <MonitorDown className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Put the deck on your home screen</p>
          <p className="text-xs text-muted-foreground">Opens full screen, no browser bar.</p>
        </div>
        <Button size="sm" onClick={install}>
          Install
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Not now
        </Button>
      </CardContent>
    </Card>
  );
}
