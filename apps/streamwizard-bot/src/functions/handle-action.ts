import { TwitchApi } from "@/classes/twitchApi";
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
  twitch: TwitchActionHandlers,
};

export async function handleAction(action: ActionEvent, twitchApi: TwitchApi, broadcaster_id: string) {
  const moduleHandlers = ActionRegistry[action.module];
  if (!moduleHandlers) {
    console.error(`No module registered for '${action.module}'`);
    return;
  }
  const handler = moduleHandlers[action.action];
  if (!handler) {
    console.error(`No action handler for '${action.module} + ${action.action}'`);
    return;
  }


  const result = await handler(action, twitchApi);
  return result;
}
