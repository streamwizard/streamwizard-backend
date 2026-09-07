"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkDiscord, reassignDiscordRole, unlinkDiscord } from "@/actions/auth/link-discord";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { IntegrationIcon } from "@/components/settings/integration-icon";
import { discordInviteLink } from "@/lib/constant";

const ROLE_STATUS_COPY = {
  pending_membership: {
    title: "Hold up, you're not in the server",
    description:
      "Your account's linked and ready, but we can't hand out roles to ghosts. Pop into the StreamWizard Discord and your role shows up the second you do.",
  },
  failed: {
    title: "Your role tripped on the way over",
    description: "Your account's linked, we just fumbled the role grant. Hit Re-verify and we'll try again, no hard feelings.",
  },
  unlink_blocked: {
    title: "Discord's the only way in right now",
    description:
      "We can't disconnect this, it's the only login you've got. Add an email or password to your account first, then come back and we'll cut the cord.",
  },
} as const;

export function DiscordIntegrationSection({
  discordUsername,
  roleStatus = null,
}: {
  discordUsername: string | null;
  roleStatus?: "pending_membership" | "failed" | "unlink_blocked" | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(Boolean(roleStatus));
  const router = useRouter();
  const isConnected = Boolean(discordUsername);

  const closeDialog = () => {
    setDialogOpen(false);
    router.replace("/dashboard/settings/integrations");
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start gap-4 space-y-0">
        <IntegrationIcon provider="discord" />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold leading-none">Discord</h3>
            <Badge variant={isConnected ? "default" : "outline"} className={isConnected ? "bg-[#5865F2] text-white" : ""}>
              {isConnected ? "Connected" : "Not connected"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Unlocks the Linked Role in our server. No more &ldquo;are you actually one of us&rdquo; energy.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm">
                Connected as <strong>{discordUsername}</strong>
              </p>
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => startTransition(() => unlinkDiscord())}
              >
                {isPending ? "Disconnecting…" : "Disconnect"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Role not showing up?{" "}
              <button
                type="button"
                disabled={isPending}
                className="font-medium underline underline-offset-4 disabled:opacity-50"
                onClick={() => startTransition(() => reassignDiscordRole())}
              >
                Re-verify
              </button>{" "}
              to refresh it.
            </p>
          </div>
        ) : (
          <Button disabled={isPending} onClick={() => startTransition(() => linkDiscord())}>
            {isPending ? "Connecting…" : "Connect Discord"}
          </Button>
        )}
      </CardContent>

      {roleStatus ? (
        <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{ROLE_STATUS_COPY[roleStatus].title}</DialogTitle>
              <DialogDescription>{ROLE_STATUS_COPY[roleStatus].description}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              {roleStatus === "pending_membership" ? (
                <Button asChild>
                  <a href={discordInviteLink} target="_blank" rel="noopener noreferrer">
                    Join the server
                  </a>
                </Button>
              ) : roleStatus === "failed" ? (
                <Button disabled={isPending} onClick={() => startTransition(() => reassignDiscordRole())}>
                  Re-verify
                </Button>
              ) : null}
              <Button variant="outline" onClick={closeDialog}>
                Got it
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </Card>
  );
}
