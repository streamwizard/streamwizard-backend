export type TimelineStatus = "shipped" | "beta" | "later";

export interface TimelineEntryData {
  area: string;
  items: string[];
  /** VOD clipping points at the amber pillar; everything else stays purple. */
  accent?: "amber";
}

/*
 * Shipped: every line here is something a product page already claims, so the
 * two can't drift into disagreeing about what exists.
 */
export const SHIPPED: TimelineEntryData[] = [
  {
    area: "Overlays",
    items: [
      "Alerts, chat, labels and IRL widgets in one browser source",
      "An editor that changes the scene without reopening OBS",
      "Live GPS stats: speed, distance and where you are",
    ],
  },
  {
    area: "Clips",
    items: [
      "Your channel's clips sync themselves",
      "Folders you name, filters that stack",
      "Search by title, category, or who clipped it",
      "Landscape and portrait downloads",
    ],
  },
  {
    area: "VOD clipping",
    accent: "amber",
    items: [
      "A VOD timeline marking follows, subs, raids and ad breaks",
      "Drag a 5 to 60 second selection and save it as a clip",
    ],
  },
  {
    area: "Analytics",
    items: [
      "Viewers minute by minute for your last broadcast",
      "Follows, subs, raids and clips plotted on the graph",
      "Your best hour called out, and a switch to hide the lot",
    ],
  },
];

/*
 * Beta: the cloud OBS page says beta, so this page says beta. The whole group
 * graduates into SHIPPED when that label comes off.
 */
export const BETA: TimelineEntryData = {
  area: "Cloud OBS",
  items: [
    "A dedicated OBS for your channel, running in a data centre",
    "The deck on your phone to drive scenes and sources",
    "SRT and SRTLA ingest for going live from the road",
    "Auto switcher for when the connection drops",
  ],
};

export interface PlannedItem {
  text: string;
  /**
   * Sub-tasks. A plan with these renders as a full card, same as shipped and
   * beta; one without stays a single line.
   */
  items?: string[];
}

/*
 * Planned: not started, and the order is not decided. Kept vague on purpose;
 * anything more specific belongs in the issue tracker first.
 */
export const PLANNED: PlannedItem[] = [
  {
    text: "Chat commands",
    items: [
      "Your own commands, answered by the StreamWizard bot or under your name",
      "IRL commands that switch scenes from chat",
      "Permissions you set per command",
      "A commands page your viewers can read",
    ],
  },
  {
    text: "A workflow builder",
    items: [
      "When this happens on stream, do that",
      "Integrations to pull into a workflow, not just Twitch",
      "Multiple workflows running side by side",
      "A public library to share workflows and copy someone else's",
    ],
  },
  {
    text: "An auto poster for shorts",
    items: [
      "Post to TikTok, Instagram and YouTube Shorts",
      "Straight from clips you already have",
      "Queue up several posts and schedule them ahead",
    ],
  },
];
