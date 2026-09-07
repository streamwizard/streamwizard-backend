import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Activity, Clapperboard, Radio, Users } from "lucide-react";
import { Skeleton } from "@repo/ui";
import { createClient } from "@repo/supabase/next/server";
import {
  getLatestStreamForBroadcaster,
  getBroadcasterProfile,
  getVodByStreamId,
} from "@repo/supabase/queries/stream-analytics";
import { getUserPreferences } from "@repo/supabase/queries/user";
import { ClipDialogProvider } from "@/providers/clip-dialog-provider";
import { BroadcasterProfileStrip } from "@/components/stream-analytics/broadcaster-profile-strip";
import { StatsRow } from "@/components/stream/StatsRow";
import { RecentClipsSection } from "@/components/stream/RecentClipsSection";
import { ViewerChartSection } from "@/components/stream/ViewerChartSection";
import { HourlyStatsSection } from "@/components/stream/HourlyStatsSection";
import { CategoryStatsSection } from "@/components/stream/CategoryStatsSection";
import { ActivityFeedSection } from "@/components/stream/ActivityFeed";
import { RecentStreams } from "@/components/stream/RecentStreams";
import { StreamInfoPanel } from "@/components/stream/StreamInfoPanel";
import type { BroadcasterProfile } from "@/actions/supabase/analytics/stream-analytics";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard — Stream Analytics",
  description: "Your stream, broken down. Viewers, clips, activity — all of it.",
};

function StatsRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return <Skeleton className="h-72 w-full rounded-xl" />;
}

function HourlyStatsSkeleton() {
  return <Skeleton className="h-72 w-full rounded-xl" />;
}

function CategoryStatsSkeleton() {
  return <Skeleton className="h-64 w-full rounded-xl" />;
}

function FeedSkeleton() {
  return <Skeleton className="h-96 w-full rounded-xl" />;
}

function ListSkeleton() {
  return <Skeleton className="h-56 w-full rounded-xl" />;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) redirect("/login");

  const broadcasterId = data.user.user_metadata.sub as string;

  const [stream, prefs] = await Promise.all([
    getLatestStreamForBroadcaster(supabase, broadcasterId),
    getUserPreferences(supabase),
  ]);

  if (!stream?.stream_id) {
    return (
      <div className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
            <Radio className="h-7 w-7 text-purple-400" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold tracking-tight">Nothing here yet.</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Go stream something. Viewers, clips, chat activity — we&apos;ll track it all while you&apos;re live.
            </p>
          </div>
        </div>

        <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              icon: Users,
              label: "Viewer stats",
              description: "Peak and average viewers, plus a minute-by-minute chart. Find out exactly when your audience peaked — and when they left.",
            },
            {
              icon: Clapperboard,
              label: "Clips",
              description: "Every clip from your stream, pulled in automatically. Sort them, tag them — no more hunting through Twitch.",
            },
            {
              icon: Activity,
              label: "Activity feed",
              description: "Follows, subs, raids, channel points — everything that happened, in the order it happened. One feed, not five Twitch tabs.",
            },
          ].map(({ icon: Icon, label, description }) => (
            <div
              key={label}
              className="relative rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-left"
            >
              <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-purple-500/20 bg-purple-500/10">
                <Icon className="h-4 w-4 text-purple-400" />
              </div>
              <p className="text-sm font-medium">{label}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const [profile, vod] = await Promise.all([
    getBroadcasterProfile(supabase),
    getVodByStreamId(supabase, stream.stream_id),
  ]);

  const broadcasterProfile: BroadcasterProfile | null = profile
    ? {
        username: profile.twitch_username,
        profileImageUrl: profile.profile_image_url,
        broadcasterType: profile.broadcaster_type as BroadcasterProfile["broadcasterType"],
      }
    : null;

  const hasVod = !!vod?.video_id;
  const isLive = stream.is_live;
  const showStats = prefs?.show_stream_stats ?? true;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Stream Analytics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Everything from your last broadcast.
          </p>
        </div>
        {broadcasterProfile && (
          <div className="flex items-center gap-2 sm:shrink-0">
            <BroadcasterProfileStrip profile={broadcasterProfile} />
            {isLive && (
              <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                LIVE
              </span>
            )}
          </div>
        )}
      </div>

      {showStats && (
        <Suspense fallback={<StatsRowSkeleton />}>
          <StatsRow
            streamId={stream.stream_id}
            broadcasterId={broadcasterId}
            startedAt={stream.stream_started_at}
            endedAt={stream.stream_ended_at}
          />
        </Suspense>
      )}

      <div className="grid gap-4 lg:grid-cols-[65%_35%]">
        <div className="flex min-w-0 flex-col gap-4">
          <Suspense fallback={<ChartSkeleton />}>
            <ViewerChartSection streamId={stream.stream_id} broadcasterId={broadcasterId} />
          </Suspense>

          {stream.stream_started_at && (
            <Suspense fallback={<HourlyStatsSkeleton />}>
              <HourlyStatsSection
                streamId={stream.stream_id}
                broadcasterId={broadcasterId}
                streamStartedAt={stream.stream_started_at}
              />
            </Suspense>
          )}

          <Suspense fallback={<CategoryStatsSkeleton />}>
            <CategoryStatsSection streamId={stream.stream_id} broadcasterId={broadcasterId} />
          </Suspense>

          <Suspense fallback={<FeedSkeleton />}>
            <ActivityFeedSection
              streamId={stream.stream_id}
              broadcasterId={broadcasterId}
              isLive={isLive}
            />
          </Suspense>

          <Suspense fallback={<ListSkeleton />}>
            <RecentStreams
              broadcasterId={broadcasterId}
              excludeStreamId={stream.stream_id}
            />
          </Suspense>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <StreamInfoPanel
            broadcasterId={broadcasterId}
            currentTitle={stream.title}
            currentCategory={stream.category_name}
            currentGameId={stream.category_id}
          />
        </div>
      </div>

      <ClipDialogProvider>
        <Suspense fallback={<ListSkeleton />}>
          <RecentClipsSection broadcasterId={broadcasterId} compact />
        </Suspense>
      </ClipDialogProvider>
    </div>
  );
}
