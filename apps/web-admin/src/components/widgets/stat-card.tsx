import type { LucideIcon } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { cn } from "@/lib/utils";

type StatTone = "default" | "positive" | "warning" | "danger";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: "up" | "down" | "neutral";
  /** Colors the value to signal health at a glance. */
  tone?: StatTone;
  /** Optional leading glyph shown top-right, muted. */
  icon?: LucideIcon;
  className?: string;
}

const TONE_VALUE_CLASS: Record<StatTone, string> = {
  default: "",
  positive: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
};

export function StatCard({ title, value, description, trend, tone = "default", icon: Icon, className }: StatCardProps) {
  return (
    <Card className={cn("transition-colors hover:border-foreground/20", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <span className={cn("text-3xl font-bold tabular-nums", TONE_VALUE_CLASS[tone])}>{value}</span>
          {trend && trend !== "neutral" && (
            <Badge
              variant="secondary"
              className={cn(
                "mb-1 text-xs",
                trend === "up" && "text-green-600 dark:text-green-400",
                trend === "down" && "text-red-600 dark:text-red-400"
              )}
            >
              {trend === "up" ? "↑" : "↓"}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
