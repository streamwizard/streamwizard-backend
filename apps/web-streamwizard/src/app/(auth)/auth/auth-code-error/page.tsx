import Link from "next/link";
import Image from "next/image";
import { TriangleAlert } from "lucide-react";
import { Button } from "@repo/ui";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@repo/ui";
import { StreamWizardLogo } from "@/components/brand/streamwizard-logo";
import { IntegrationIcon } from "@/components/settings/integration-icon";
import { discordInviteLink } from "@/lib/constant";
import { env } from "@/lib/env";

type Provider = "discord" | "twitch";

const PROVIDER_LABEL: Record<Provider, string> = {
  discord: "Discord",
  twitch: "Twitch",
};

const CANCEL_TITLE = "YOU BLOCKED US";

const PROVIDER_RETRY_HREF: Record<Provider, string> = {
  // Hits the OAuth-initiating route directly so "try again" re-triggers the
  // Discord flow instead of dropping the user back on the integrations page.
  discord: "/auth/link/discord",
  twitch: "/login",
};

const REASON_COPY: Record<Provider, Record<string, string>> = {
  discord: {
    missing_code: "Discord didn't send back a login code. The link probably expired before you clicked it.",
    exchange_failed: "That Discord code didn't check out on our end. Try connecting again.",
    missing_identity: "Discord didn't hand over enough profile info for us to link your account.",
    link_failed: "We had your Discord info but couldn't save the connection. That's on us.",
    already_linked: "That Discord account is already connected to a different StreamWizard account. Disconnect it there first, or use a different Discord account.",
    access_denied: "You hit Cancel instead of Authorize. Respect the commitment, but the bot still can't find you in the server.",
  },
  twitch: {
    missing_code: "Twitch login didn't finish. No code came back, so nothing to connect.",
    exchange_failed: "That Twitch code didn't check out on our end. Try connecting again.",
    missing_tokens: "Twitch didn't hand back the access keys we needed. Happens sometimes, just retry.",
    token_save_failed: "We got your Twitch tokens but couldn't save them. That's on us.",
    access_denied: "You said no to the Twitch permissions. Bold, for a tool that lives in your chat. We kind of need that yes.",
    provider_error: "Twitch sent back an error instead of a login. Try again in a minute.",
  },
};

const FALLBACK_COPY = "Something broke during sign-in. No idea what, but it wasn't your Wi-Fi.";

function isProvider(value: string | undefined): value is Provider {
  return value === "discord" || value === "twitch";
}

export default async function AuthCodeErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; reason?: string }>;
}) {
  const { provider: rawProvider, reason } = await searchParams;
  const provider = isProvider(rawProvider) ? rawProvider : undefined;

  const message = provider && reason ? REASON_COPY[provider][reason] : undefined;
  const retryHref = provider ? PROVIDER_RETRY_HREF[provider] : "/login";
  const isCancel = reason === "access_denied";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center gap-4 text-center">
          <StreamWizardLogo width={56} height={56} />
          <div className="flex flex-col items-center gap-3">
            {!isCancel && (
              <div className="flex items-center justify-center rounded-full bg-destructive/10 p-2.5">
                <TriangleAlert className="size-5 text-destructive" aria-hidden="true" />
              </div>
            )}
            <CardTitle className="text-2xl font-bold">
              {isCancel
                ? CANCEL_TITLE
                : provider
                  ? `${PROVIDER_LABEL[provider]} connection didn't go through`
                  : "Login didn't go through"}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          {isCancel && (
            <Image
              src={`${env.NEXT_PUBLIC_CDN_URL}/public/animations/emotional-damage.gif`}
              alt="Emotional damage"
              width={220}
              height={220}
              unoptimized
              className="rounded-lg"
            />
          )}
          {provider && !isCancel && (
            <IntegrationIcon provider={provider} />
          )}
          <p className="text-muted-foreground">{message ?? FALLBACK_COPY}</p>
          <p className="text-sm text-muted-foreground">
            Still happening after a couple of tries? Open a ticket in our Discord and we&apos;ll dig in.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Link href={retryHref} className="w-full">
            <Button className="w-full">Try connecting again</Button>
          </Link>
          <Link href={discordInviteLink} target="_blank" rel="noopener noreferrer" className="w-full">
            <Button variant="outline" className="w-full">
              Open a ticket in Discord
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
