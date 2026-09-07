import { TwitchApi } from "@repo/twitch-api";
import { reportError } from "@repo/sentry";
import type { CreateEventSubSubscriptionRequest } from "@/types/twitch";
import axios from "axios";

export default async function CreateEventSubSubscription(subscription: CreateEventSubSubscriptionRequest) {
  try {
    const api = new TwitchApi(null);
    const res = await api.eventsub.createSubscription(subscription, "");
    return res.data;
  } catch (error) {
    // A missing EventSub subscription means Twitch events silently stop
    // flowing for this broadcaster — that must reach Sentry, not just logs.
    reportError(error, `eventsub.createSubscription: ${subscription.type}`);
    if (axios.isAxiosError(error) && error.response) {
      console.error("Response data:", error.response.data, "status:", error.response.status);
    }
  }
}
