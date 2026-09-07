import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui";

export function FeatureDisabledBanner() {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Subscription payment overdue</AlertTitle>
      <AlertDescription>
        Update your payment method to restore full access. You can still view this page, but
        interactive controls are disabled until the balance is settled.
      </AlertDescription>
    </Alert>
  );
}
