import {
  ALERT_AMOUNT_LABELS,
  ALERT_EVENT_LABELS,
  type AlertEventType,
  type AlertSkipReason,
  type AlertVariantConfig,
} from "@repo/ui/overlay";

/**
 * What to tell someone whose test alert went nowhere. A dropped test is
 * indistinguishable from one that never fired, so both the inspector's Test
 * button and the demo bar say why rather than leaving a streamer clicking.
 */
export function alertSkipMessage(
  event: AlertEventType,
  variant: AlertVariantConfig,
  reason: AlertSkipReason
): string {
  const name = ALERT_EVENT_LABELS[event];

  if (reason === "disabled") {
    return `${name} alerts are off. Turn them on to see this one.`;
  }

  // Most events that carry a minimum have a unit worth naming (bits, viewers,
  // months). The few that don't read fine without it.
  const unit = ALERT_AMOUNT_LABELS[event];
  return `Under your ${name} minimum of ${variant.minAmount}${unit ? ` ${unit}` : ""}. Test alerts use a fixed amount, so lower the minimum to see it.`;
}
