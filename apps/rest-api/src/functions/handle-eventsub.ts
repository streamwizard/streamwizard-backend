import { handlers } from "../handlers/eventHandler";
import type { EventSubNotificationPayload, EventSubSubscriptionType } from "@repo/types";

const handleEventsub = async (payload: EventSubNotificationPayload) => {
    const { subscription, event } = payload;

    await handlers.processTwitchEvent(subscription.type as EventSubSubscriptionType, event);
};

export default handleEventsub;
