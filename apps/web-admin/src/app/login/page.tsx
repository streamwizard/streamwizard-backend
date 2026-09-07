import { signInWithTwitch } from "@/actions/auth";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">StreamWizard Admin</h1>
          <p className="text-sm text-muted-foreground">Admin access only</p>
        </div>

        {error === "signin_required" && (
          <p className="rounded-md bg-muted px-4 py-3 text-center text-sm text-muted-foreground">
            Please sign in to continue.
          </p>
        )}

        {error === "session_failed" && (
          <p className="rounded-md bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
            We couldn&apos;t start your session. Please try signing in again.
          </p>
        )}

        {error === "oauth_failed" && (
          <p className="rounded-md bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
            Authentication failed. Please try again.
          </p>
        )}

        <form action={signInWithTwitch}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#9146FF] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
            </svg>
            Login with Twitch
          </button>
        </form>
      </div>
    </div>
  );
}
