"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui";
import { toast } from "sonner";
import { listAssets, type AssetKind, type AssetListing, type UserAsset } from "@/actions/assets";
import { MediaLibrary } from "./media-library";

interface AssetPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: UserAsset) => void;
  kindFilter?: AssetKind[];
  title?: string;
}

// Media-library picker: browse (or upload) an asset and hand its CDN URL back.
// Used by the widget editor and overlay inspector for image/audio/video fields.
export function AssetPickerDialog({ open, onOpenChange, onSelect, kindFilter, title }: AssetPickerDialogProps) {
  const [listing, setListing] = useState<AssetListing | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Lazy-load the listing the first time the dialog opens.
  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    void listAssets().then(({ data, error }) => {
      if (cancelled) return;
      if (error) toast.error(error);
      setListing(data);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title ?? "Pick a file"}</DialogTitle>
        </DialogHeader>
        {loaded ? (
          <MediaLibrary
            initialListing={listing}
            kindFilter={kindFilter}
            onSelect={(asset) => {
              onSelect(asset);
              onOpenChange(false);
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading your files…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
