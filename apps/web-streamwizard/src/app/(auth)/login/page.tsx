import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { Metadata } from "next";
import { BarChart3, Cloud, Scissors } from "lucide-react";

import TwitchLogin from "@/components/buttons/twitch-login";
import { discordInviteLink } from "@/lib/constant";
import { absoluteUrl } from "@/lib/seo";

// Indexable on purpose: "streamwizard login" is a real query and this page
// answers it. The canonical folds every /login?next=... variant the auth
// redirects produce into the one URL.
export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to StreamWizard with your Twitch account to reach your dashboard, cloud OBS, overlays, clips and analytics.",
  alternates: { canonical: absoluteUrl("/login") },
};

const perks = [
  {
    icon: Scissors,
    title: "Clips",
    copy: "Every clip from your channel, in folders. Including the ones you would rather not rewatch.",
  },
  {
    icon: Cloud,
    title: "Cloud OBS",
    copy: "OBS and the deck, run from your phone. IRL streaming without a PC.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    copy: "Viewer graphs, chat activity, and the numbers behind that one very quiet Tuesday.",
  },
];

/*
 * Rotates per request. The index comes from the per-request CSP nonce rather
 * than Math.random because the react-hooks/purity rule (React Compiler) bans
 * impure calls in render. Server-only, so the client has nothing to mismatch.
 */
const quotes = [
  {
    quote:
      "Yesterday is history, tomorrow is a mystery, but today is a gift. That is why it is called the present.",
    author: "Master Oogway",
  },
  {
    quote: "It is in there somewhere. I think it was a Tuesday. Or a Thursday.",
    author: "You, looking for one clip",
  },
  {
    quote: "Just one more hour and then I go to bed.",
    author: "A streamer, four hours ago",
  },
  {
    quote: "Chat, be honest. Was that clippable?",
    author: "The eternal question",
  },
  {
    quote: "It worked in the preview.",
    author: "The scene that did not work live",
  },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nonce = (await headers()).get("x-nonce") ?? "";
  let seed = 0;
  for (const char of nonce) seed += char.codePointAt(0) ?? 0;
  const { quote, author } = quotes[seed % quotes.length]!;

  return (
    <div className="relative grid min-h-screen flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
        <div className="absolute inset-0 bg-zinc-900" />
        {/* Same purple wash the landing hero sits in, so the two pages match. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_50%_35%,color-mix(in_srgb,var(--color-three),transparent_65%),transparent_60%)]"
          aria-hidden="true"
        />
        <div className="z-50 h-full flex justify-center items-center flex-col relative">
          <Image
            src="/logo.png"
            width={450}
            height={500}
            alt="StreamWizard"
            style={{
              maxWidth: "100%",
              height: "auto",
            }}
            priority
          />
          <blockquote className="space-y-2 absolute bottom-0">
            <p className="text-lg">&ldquo;{quote}&rdquo;</p>
            <footer className="text-sm text-zinc-400">{author}</footer>
          </blockquote>
        </div>
      </div>

      <div className="px-4 py-10 sm:px-8">
        <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards mx-auto flex w-full max-w-sm flex-col justify-center duration-700 motion-reduce:animate-none">
          <Link href="/" className="mx-auto mb-8 lg:hidden">
            <Image src="/logo.png" width={160} height={178} alt="StreamWizard" className="h-auto w-32" priority />
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight">Log in with Twitch</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Twitch handles the password, so there is one less for you to forget. First time here?
            Logging in makes your account.
          </p>

          <TwitchLogin redirect={next ?? null} text="Continue with Twitch" size="lg" source="login_form" className="mt-6 w-full" />

          <div className="mt-8 space-y-4 rounded-lg border border-border bg-card/50 p-4">
            {perks.map(({ icon: Icon, title, copy }) => (
              <div key={title} className="flex gap-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium leading-none">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            By clicking continue, you agree to our{" "}
            <Link href="/terms-of-service" className="underline underline-offset-4 hover:text-foreground">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy-policy" className="underline underline-offset-4 hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Button not working? Blame us in{" "}
            <a
              href={discordInviteLink}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              the Discord
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
