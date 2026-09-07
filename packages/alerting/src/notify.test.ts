import { describe, expect, test } from "bun:test";
import { dispatchNotifications, resolveRoute, type EnvRoute } from "./notify";
import type { AlertNotification } from "./types";

const notification: AlertNotification = {
  kind: "fired",
  ruleId: "probe.node_unreachable",
  ruleTitle: "Node unreachable",
  entityId: "obs-node:obs-node-1",
  env: "staging",
  severity: "warn",
  message: "Probe obs-node:obs-node-1 failed: 502",
  firedAt: new Date().toISOString(),
};

describe("dispatchNotifications", () => {
  test("open gate with no configured channel is reported as failed, not skipped", async () => {
    // The staging default route when ALERT_DISCORD_CHANNEL_ID is unset:
    // Discord gate open at warn, but no address to deliver to.
    const route: EnvRoute = {
      discordId: undefined,
      discordTarget: "channel",
      discordSeverity: "warn",
      telegramChatId: undefined,
      telegramSeverity: "off",
    };
    const { failed } = await dispatchNotifications([notification], route);
    expect(failed).toEqual([
      { ruleId: "probe.node_unreachable", entityId: "obs-node:obs-node-1" },
    ]);
  });

  test("deliberately closed gates (dev default) still skip silently", async () => {
    const route = resolveRoute("dev");
    const { failed } = await dispatchNotifications([notification], route);
    expect(failed).toEqual([]);
  });
});
