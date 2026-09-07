import { TwitchApi } from "@repo/twitch-api";
import { reportError } from "@repo/sentry";
import { TwitchActionHandlers } from "./twitch-actions";

export interface ActionEvent {
  action: string;
  module: string;
  context: Record<string, any>;
  currentActionContext: any;
  results: Record<string, any>;
}

export type ActionHandler = (event: ActionEvent, twitchApi: TwitchApi) => Promise<void>;

// Namespaced registry similar to variable resolvers
const ActionRegistry: Record<string, Record<string, ActionHandler>> = {
  twitch: TwitchActionHandlers as any,
};

export async function handleAction(
  action: ActionEvent,
  twitchApi: TwitchApi,
  broadcaster_id: string,
) {
  const moduleHandlers = ActionRegistry[action.module];
  if (!moduleHandlers) {
    // A miswired action silently does nothing at all — the streamer sees a
    // command that "works" and changes nothing. Report, don't just log.
    reportError(new Error(`No module registered for '${action.module}'`), "handle-action.unknown-module", {
      module: action.module,
      broadcaster_id,
    });
    return;
  }
  const handler = moduleHandlers[action.action];
  if (!handler) {
    reportError(
      new Error(`No action handler for '${action.module} + ${action.action}'`),
      "handle-action.unknown-action",
      { module: action.module, action: action.action, broadcaster_id },
    );
    return;
  }

  const result = await handler(action, twitchApi);
  return result;
}
