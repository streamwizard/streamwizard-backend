import { TwitchChatClient } from "./chat";
import { TwitchEventSubClient } from "./eventsub";
import { TwitchFollowersClient } from "./followers";
import { TwitchSubscriptionsClient } from "./subscriptions";
import { TwitchMarkersClient } from "./markers";
import { TwitchClipsClient } from "./clips";

export class TwitchApi {
    public chat: TwitchChatClient;
    public eventsub: TwitchEventSubClient;
    public followers: TwitchFollowersClient;
    public subscriptions: TwitchSubscriptionsClient;
    public markers: TwitchMarkersClient;
    public clips: TwitchClipsClient;


    constructor(broadcaster_id: string | null = null) {
        this.chat = new TwitchChatClient(broadcaster_id);
        this.eventsub = new TwitchEventSubClient(broadcaster_id);
        this.followers = new TwitchFollowersClient(broadcaster_id);
        this.subscriptions = new TwitchSubscriptionsClient(broadcaster_id);
        this.markers = new TwitchMarkersClient(broadcaster_id);
        this.clips = new TwitchClipsClient(broadcaster_id);
    }
}
