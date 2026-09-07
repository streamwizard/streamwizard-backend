"use client";

import { useState } from "react";
import { Button, Label } from "@repo/ui";
import { AssetPickerDialog } from "@/components/media/asset-picker-dialog";
import type { AssetKind } from "@/actions/assets";

/** Media-library picker button showing the chosen file, with clear action. */
export function MediaField({
  label,
  kinds,
  value,
  helper,
  onChange,
}: {
  label: string;
  kinds: AssetKind[];
  value: string;
  helper?: string;
  onChange: (url: string, kind: AssetKind | null) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileName = value ? decodeURIComponent(value.split("/").pop() ?? value) : null;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        {kinds.includes("image") && value && !value.endsWith(".webm") && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-8 w-8 rounded object-cover bg-muted shrink-0" />
        )}
        <Button
          size="sm"
          variant="outline"
          className="flex-1 min-w-0 justify-start text-xs font-normal"
          onClick={() => setPickerOpen(true)}
        >
          <span className="truncate">{fileName ?? "Choose from media library…"}</span>
        </Button>
        {value && (
          <Button
            size="sm"
            variant="ghost"
            className="text-xs shrink-0"
            onClick={() => onChange("", null)}
          >
            Clear
          </Button>
        )}
      </div>
      {helper && (
        <p className="text-[11px] text-muted-foreground leading-snug">{helper}</p>
      )}
      <AssetPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        kindFilter={kinds}
        title={`Pick ${label.toLowerCase()}`}
        onSelect={(asset) => onChange(asset.url, asset.kind)}
      />
    </div>
  );
}
