"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { BarChart2, Clock, Eye, Star, Tv, UserPlus, Users } from "lucide-react";
import { Label, Switch } from "@repo/ui";
import { StatCard } from "@/components/stream/StatsRow/StatCard";
import { demoStats } from "./demo-data";
import { useDemoTracking } from "../analytics/use-demo-tracking";

/*
 * The dashboard's stat row plus the switch that puts the whole analytics page
 * away.
 *
 * "Show stream stats" is a real preference (user_preferences.show_stream_stats):
 * onboarding asks for it and Settings keeps it. The switch here is the same
 * control with the same label, wired to the demo instead of the database, so a
 * visitor can see what turning it off does before they ever sign in.
 *
 * Note for whoever reads this next: the full behaviour this demo shows (page
 * hidden, Clips as the home page) is SW-196 and is not in the product yet —
 * today the preference only drops the stat row. Keep the two in step.
 */
export function AnalyticsStatsRow({ children }: { children: ReactNode }) {
  const [showStats, setShowStats] = useState(true);
  const track = useDemoTracking("analytics");

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-purple-500/20 bg-purple-500/10">
            <BarChart2 className="size-4 text-purple-400" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <Label htmlFor="demo-show-stats" className="cursor-pointer text-sm font-medium">
              Show stream stats
            </Label>
            <p className="text-xs text-muted-foreground">
              {showStats ? "Try turning it off." : "Analytics off. Clips are your home page now."}
            </p>
          </div>
        </div>
        <Switch
          id="demo-show-stats"
          checked={showStats}
          onCheckedChange={(next) => {
            track(`stats_${next ? "on" : "off"}`);
            setShowStats(next);
          }}
        />
      </div>

      <AnimatePresence initial={false}>
        {showStats ? (
          <motion.div
            key="stats"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-3 pt-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard icon={Tv} label="Time in ads" value={demoStats.timeInAds} />
              <StatCard
                icon={Eye}
                label="Peak viewers"
                value={demoStats.peakViewers}
                trend={{ direction: "up", label: "+31 from last stream" }}
              />
              <StatCard
                icon={Users}
                label="Avg. viewers"
                value={demoStats.avgViewers}
                trend={{ direction: "up", label: "+12 from last stream" }}
              />
              <StatCard icon={Clock} label="On air" value={demoStats.onAir} />
              <StatCard
                icon={UserPlus}
                label="New follows"
                value={demoStats.newFollows}
                trend={{ direction: "up", label: "+6 from last stream" }}
              />
              <StatCard
                icon={Star}
                label="New subs"
                value={demoStats.newSubs}
                trend={{ direction: "up", label: "+2 from last stream" }}
              />
            </div>

            <div className="mt-4">{children}</div>
          </motion.div>
        ) : (
          <motion.div
            key="stats-off"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-3 py-12 text-center"
          >
            <p className="text-sm font-medium">No numbers today.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Analytics is off, so your clips are the first thing you land on. Flip it back whenever
              you want the graph again.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
