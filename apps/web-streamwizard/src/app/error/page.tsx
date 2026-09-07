import Link from "next/link";
import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { Button } from "@repo/ui";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@repo/ui";
import { StreamWizardLogo } from "@/components/brand/streamwizard-logo";
import { discordInviteLink } from "@/lib/constant";

// A dead-end redirect target, not content: keep it out of search results.
export const metadata: Metadata = {
  title: "Something went wrong",
  robots: { index: false, follow: false },
};

// Generic, safe error page. Several server actions and route handlers bounce
// here (`redirect("/error")`) when something fails before we can show a nicer,
// context-specific screen. It never renders raw error details, stack traces,
// or anything that could leak internals — just an honest "this didn't work"
// with a way forward. Pass ?code=<key> for slightly more specific copy.
type Copy = {
  title: string;
  body: string;
  retryHref: string;
  retryLabel: string;
};

const CODE_COPY: Record<string, Copy> = {
  discord_link: {
    title: "Discord connection didn't start",
    body: "We couldn't kick off the Discord handshake. Nothing's wrong with your account, the connection just didn't go through.",
    retryHref: "/auth/link/discord",
    retryLabel: "Try connecting again",
  },
  auth: {
    title: "Couldn't sign you in",
    body: "The login handshake didn't finish. Not your Wi-Fi, and probably not your fault. Give it another shot.",
    retryHref: "/login",
    retryLabel: "Back to login",
  },
};

const FALLBACK_COPY: Copy = {
  title: "Something broke on our end",
  body: "Your last action didn't go through. Not your Wi-Fi, not your fault. Try again, and if it keeps happening we want to know.",
  retryHref: "/dashboard",
  retryLabel: "Back to StreamWizard",
};

export default async function ErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const copy = (code && CODE_COPY[code]) || FALLBACK_COPY;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center gap-4 text-center">
          <StreamWizardLogo width={56} height={56} />
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center justify-center rounded-full bg-destructive/10 p-2.5">
              <TriangleAlert className="size-5 text-destructive" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl font-bold">{copy.title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <p className="text-muted-foreground">{copy.body}</p>
          <p className="text-sm text-muted-foreground">
            Still stuck after a couple of tries? Open a ticket in our Discord and we&apos;ll dig in.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Link href={copy.retryHref} className="w-full">
            <Button className="w-full">{copy.retryLabel}</Button>
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
