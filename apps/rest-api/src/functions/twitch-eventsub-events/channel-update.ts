import { supabase } from "@repo/supabase";
import { TwitchApi } from "@repo/twitch-api";
import { ChannelUpdateEvent } from "@repo/schemas";

export async function handleChannelUpdate(event: ChannelUpdateEvent, twitchApi: TwitchApi) {
  console.log(
    `[Twitch EventSub] Channel update for ${event.broadcaster_user_name}: ${event.title}`,
  );

  const { error } = await supabase.from("broadcaster_live_status").upsert(
    {
      broadcaster_id: event.broadcaster_user_id,
      broadcaster_name: event.broadcaster_user_name,
      title: event.title,
      category_id: event.category_id,
      category_name: event.category_name,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "broadcaster_id" },
  );

  if (error) {
    console.error(`[Twitch EventSub] Error updating channel status:`, error);
  }
}
