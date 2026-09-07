"use server";
import { reportError } from "@repo/sentry";
import CreateEventSubSubscription from "./create-event-subscription";
import getSubscriptionFromTwitch from "./get-subscriptions-from-twitch";
import NeededEventSubscriptions from "./needed-event-subscriptions";

export default async function checkEventSubscriptions(twitchUserId: string) {
  try {
    const currentSubscriptions = await getSubscriptionFromTwitch(twitchUserId);
    const neededSubscriptions = await NeededEventSubscriptions(twitchUserId);

    const missingSubscriptions = neededSubscriptions.filter((needed) => {
      const isMet = currentSubscriptions.some((current) => {
        const typeMatch = current.type === needed.type;
        const versionMatch = current.version === needed.version;
        const transportMethodMatch = current.transport.method === needed.transport.method;

        // Verify transport-specific details
        let transportDetailMatch = true;
        if (needed.transport.method === "webhook") {
          transportDetailMatch = current.transport.callback === needed.transport.callback;
        } else if (needed.transport.method === "conduit") {
          transportDetailMatch = current.transport.conduit_id === needed.transport.conduit_id;
        }

        // Status must be active
        const statusActive =
          current.status === "enabled" ||
          current.status === "webhook_callback_verification_pending";

        return (
          typeMatch && versionMatch && transportMethodMatch && transportDetailMatch && statusActive
        );
      });

      return !isMet;
    });

    if (missingSubscriptions.length > 0) {
      await Promise.all(
        missingSubscriptions.map(async (subscription) => {
          await CreateEventSubSubscription(subscription);
        }),
      );
    }
  } catch (error) {
    reportError(error, "eventsub.checkEventSubscriptions");
  }
}
