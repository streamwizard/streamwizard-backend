import { Zap } from "lucide-react";
import { Card, CardContent } from "@repo/ui";

export default function EventSubDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">EventSub</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Twitch EventSub metrics</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Zap className="h-10 w-10 opacity-30" />
          <p className="text-sm">Coming soon — EventSub metrics panel</p>
        </CardContent>
      </Card>
    </div>
  );
}
