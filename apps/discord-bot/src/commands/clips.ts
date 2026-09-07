import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { supabase } from "@repo/supabase";
import type { Database } from "@repo/supabase";
import { getLatestClipByUserId, getMostViewedClipByUserId } from "@repo/supabase/queries/clips";
import type { Command } from "../types/discord";
import { requireLinkedAccount } from "../lib/account";

type Clip = Database["public"]["Tables"]["clips"]["Row"];

function formatViewCount(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return `${views}`;
}

// Discord always renders a link's native unfurl directly below the content
// it appeared in, so putting the bare clip.url first and the summary text
// after it (in the same content string) gives a single message: the playable
// Twitch clip on top, our text underneath it.
function buildClipMessage(clip: Clip, label: string): string {
  const stats = [
    `👤 **${clip.creator_name}**`,
    `👁️ **${formatViewCount(clip.view_count ?? 0)}** views`,
    clip.game_name ? `🎮 ${clip.game_name}` : null,
  ]
    .filter(Boolean)
    .join("  •  ");

  return [clip.url, `### 🟣 ${label} — ${clip.title}`, stats].join("\n");
}

export default {
  data: new SlashCommandBuilder()
    .setName("clips")
    .setDescription("Look up your StreamWizard clips")
    .addSubcommand((sub) => sub.setName("latest").setDescription("Show your most recently created clip"))
    .addSubcommand((sub) => sub.setName("top").setDescription("Show your most viewed clip")),
  async execute(interaction) {
    const userId = await requireLinkedAccount(interaction);
    if (!userId) return;

    const subcommand = interaction.options.getSubcommand();
    const { data: clip, error } =
      subcommand === "top" ? await getMostViewedClipByUserId(supabase, userId) : await getLatestClipByUserId(supabase, userId);

    if (error) {
      await interaction.reply({ content: "Something went wrong looking up your clips. Try again later.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (!clip) {
      await interaction.reply({ content: "No clips found for your account yet.", flags: MessageFlags.Ephemeral });
      return;
    }

    const content = buildClipMessage(clip, subcommand === "top" ? "Most viewed clip" : "Latest clip");
    await interaction.reply({ content });
  },
} satisfies Command;
