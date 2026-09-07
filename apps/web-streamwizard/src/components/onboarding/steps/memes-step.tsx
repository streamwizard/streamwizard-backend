"use client";

import { Sparkles } from "lucide-react";
import { Switch } from "@repo/ui";
import { Label } from "@repo/ui";

interface MemesStepProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function MemesStep({ value, onChange }: MemesStepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">We use some memes.</h2>
        <p className="text-sm text-muted-foreground">
          StreamWizard throws in memes here and there. They&apos;re stupid. They&apos;re great. Turn them off if you&apos;re at work.
        </p>
      </div>
      <div className="relative rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Sparkles className="h-4 w-4 text-purple-400" />
            </span>
            <Label className="text-sm font-medium">Memes</Label>
          </div>
          <Switch checked={value} onCheckedChange={onChange} />
        </div>
      </div>
    </div>
  );
}
