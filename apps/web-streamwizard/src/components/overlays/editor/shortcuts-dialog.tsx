"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Kbd,
} from "@repo/ui";
import {
  EDITOR_SHORTCUT_GROUPS,
  MOD_KEY_TOKEN,
  SHORTCUTS_DIALOG_KEY,
} from "./editor-shortcuts";
import { useModKeyLabel } from "./use-mod-key";

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const modKey = useModKeyLabel();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Keyboard shortcuts
            <Kbd>{SHORTCUTS_DIALOG_KEY}</Kbd>
          </DialogTitle>
          <DialogDescription>
            Everything the editor listens for, in one place.
          </DialogDescription>
        </DialogHeader>

        <div className="-mr-2 max-h-[65vh] space-y-6 overflow-y-auto pr-2">
          {EDITOR_SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} className="space-y-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold">{group.title}</h3>
                <p className="text-xs text-muted-foreground">{group.description}</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.action}
                    className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3"
                  >
                    <span className="text-sm leading-snug">{shortcut.action}</span>
                    <div className="mt-auto flex flex-col gap-1">
                      {shortcut.combos.map((combo) => (
                        <div key={combo.join("+")} className="flex flex-wrap gap-1">
                          {combo.map((key) => (
                            <Kbd key={key} className="uppercase">
                              {key === MOD_KEY_TOKEN ? modKey : key}
                            </Kbd>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
