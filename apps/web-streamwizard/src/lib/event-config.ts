import {
  UserPlus,
  Star,
  Gem,
  Gift,
  Megaphone,
  Swords,
  Circle,
  Pencil,
  Radio,
  WifiOff,
  Tv,
  BarChart3,
  TrainFront,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FilterGroup =
  | "follows"
  | "subs"
  | "bits"
  | "raids"
  | "rewards"
  | "updates"
  | "shoutouts"
  | "polls"
  | "hype";

export interface EventConfig {
  icon: LucideIcon;
  color: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  label: (d: any) => string;
  filterGroup: FilterGroup;
  isDivider?: boolean;
}

export const EVENT_CONFIG: Record<string, EventConfig> = {
  "channel.follow": {
    icon: UserPlus,
    color: "text-green-400",
    label: (d) => `${d?.user_name ?? "Someone"} followed`,
    filterGroup: "follows",
  },
  "channel.subscribe": {
    icon: Star,
    color: "text-yellow-400",
    label: (d) =>
      `${d?.user_name ?? "Someone"} subscribed · Tier ${(d?.tier ?? "1000")[0]}${d?.is_gift ? " (gifted)" : ""}`,
    filterGroup: "subs",
  },
  "channel.subscription.message": {
    icon: Star,
    color: "text-yellow-400",
    label: (d) =>
      `${d?.user_name ?? "Someone"} resubscribed · ${d?.message?.text ?? ""}`,
    filterGroup: "subs",
  },
  "channel.subscription.gift": {
    icon: Gift,
    color: "text-yellow-400",
    label: (d) =>
      `${d?.is_anonymous ? "An anonymous gifter" : (d?.user_name ?? "Someone")} gifted ${d?.total ?? 1} sub${
        (d?.total ?? 1) === 1 ? "" : "s"
      } · Tier ${(d?.tier ?? "1000")[0]}`,
    filterGroup: "subs",
  },
  "channel.chat.notification": {
    icon: Megaphone,
    color: "text-muted-foreground",
    // Twitch writes the human-readable line for us, so there is nothing to compose.
    label: (d) => d?.system_message ?? "Chat notice",
    filterGroup: "subs",
  },
  "channel.shoutout.create": {
    icon: Megaphone,
    color: "text-sky-400",
    label: (d) => `You shouted out ${d?.to_broadcaster_user_name ?? "someone"}`,
    filterGroup: "shoutouts",
  },
  "channel.shoutout.receive": {
    icon: Megaphone,
    color: "text-sky-400",
    label: (d) =>
      `${d?.from_broadcaster_user_name ?? "Someone"} shouted you out to ${d?.viewer_count ?? 0} viewers`,
    filterGroup: "shoutouts",
  },
  "channel.cheer": {
    icon: Gem,
    color: "text-purple-400",
    label: (d) => `${d?.user_name ?? "Someone"} cheered ${d?.bits ?? 0} bits`,
    filterGroup: "bits",
  },
  "channel.raid": {
    icon: Swords,
    color: "text-orange-400",
    label: (d) =>
      `${d?.from_broadcaster_user_name ?? "Someone"} raided with ${d?.viewers ?? 0} viewers`,
    filterGroup: "raids",
  },
  "channel.channel_points_custom_reward_redemption.add": {
    icon: Circle,
    color: "text-[#6441a5]",
    label: (d) =>
      `${d?.user_name ?? "Someone"} redeemed ${d?.reward?.title ?? "reward"} (${d?.reward?.cost ?? 0} pts)`,
    filterGroup: "rewards",
  },
  "channel.update": {
    icon: Pencil,
    color: "text-muted-foreground",
    label: (d) => `Updated to ${d?.category_name ?? "unknown"} · "${d?.title ?? ""}"`,
    filterGroup: "updates",
  },
  "stream.online": {
    icon: Radio,
    color: "text-green-400",
    label: () => "Stream started",
    filterGroup: "updates",
    isDivider: true,
  },
  "stream.offline": {
    icon: WifiOff,
    color: "text-red-400",
    label: () => "Stream ended",
    filterGroup: "updates",
    isDivider: true,
  },
  "channel.poll.begin": {
    icon: BarChart3,
    color: "text-cyan-400",
    label: (d) => `Poll started · "${d?.title ?? ""}"`,
    filterGroup: "polls",
  },
  "channel.poll.end": {
    icon: BarChart3,
    color: "text-cyan-400",
    label: (d) => {
      if (d?.status === "terminated") return `Poll cancelled · "${d?.title ?? ""}"`;
      if (d?.status === "archived") return `Poll archived · "${d?.title ?? ""}"`;
      // Choices come back with vote totals; the streamer only wants the winner.
      const choices: { title: string; votes: number }[] = d?.choices ?? [];
      const winner = choices.reduce<{ title: string; votes: number } | null>(
        (best, choice) => (best == null || choice.votes > best.votes ? choice : best),
        null,
      );
      return winner
        ? `Poll ended · "${winner.title}" won with ${winner.votes} votes`
        : `Poll ended · "${d?.title ?? ""}"`;
    },
    filterGroup: "polls",
  },
  "channel.hype_train.begin": {
    icon: TrainFront,
    color: "text-pink-400",
    label: (d) => `Hype train started · level ${d?.level ?? 1}`,
    filterGroup: "hype",
  },
  "channel.hype_train.end": {
    icon: TrainFront,
    color: "text-pink-400",
    label: (d) => `Hype train ended · reached level ${d?.level ?? 1}`,
    filterGroup: "hype",
  },
  "channel.ad_break.begin": {
    icon: Tv,
    color: "text-muted-foreground",
    // Twitch sends both of these as strings, so the plain truthiness check this
    // used to do read the string "false" as automatic.
    label: (d) =>
      `Ad break · ${d?.duration_seconds ?? 0}s (${
        String(d?.is_automatic) === "true" ? "automatic" : "manual"
      })`,
    filterGroup: "updates",
  },
};
