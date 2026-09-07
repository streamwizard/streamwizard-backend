import { cn } from "@repo/ui";
import { FaDiscord, FaTwitch } from "react-icons/fa";

const BRAND = {
  discord: { Icon: FaDiscord, bg: "bg-[#5865F2]/10", fg: "text-[#5865F2]" },
  twitch: { Icon: FaTwitch, bg: "bg-[#9146FF]/10", fg: "text-[#9146FF]" },
} as const;

export function IntegrationIcon({ provider, className }: { provider: keyof typeof BRAND; className?: string }) {
  const { Icon, bg, fg } = BRAND[provider];

  return (
    <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", bg, className)}>
      <Icon className={cn("size-5", fg)} aria-hidden="true" />
    </div>
  );
}
