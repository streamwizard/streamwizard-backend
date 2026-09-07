"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/actions/auth/delete-account";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui";

export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteAccount();
      if (result?.error) {
        setError(result.error);
        setOpen(false);
      }
    });
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">Delete account</CardTitle>
        <CardDescription>
          The nuclear option. Wipes your account, tokens, overlays, clips, commands — everything.
          Yes, even the clips you were definitely going to organize someday. No coming back from this one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isPending}>
              Delete my account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>This is permanent. Like, really permanent.</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Everything goes — clips, overlays, stream history, integrations. Yes, even the
                    847 clips you were definitely going to sort through one day. No recovery, no undo,
                    no &quot;wait actually—&quot;.
                  </p>
                  <p>
                    We{"'"}ll scrub your data immediately. Encrypted backups may hang around for up
                    to 3 months (lawyers, you know how it is), then they{"'"}re gone on a rolling
                    schedule. We{"'"}re not being clingy — it{"'"}s just how backups work.
                  </p>
                  <p>
                    We{"'"}ll auto-revoke our Twitch access. To fully kick us out of your authorized
                    apps — like banning a mod who went rogue — visit{" "}
                    <strong>Twitch Settings → Connections</strong> after deletion.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending} onClick={() => toast("We lied. We would've missed you.")}>Actually, I{"'"}m staying</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isPending ? "Deleting…" : "Fine. We didn't want you anyway."}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
