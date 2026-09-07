import path from "node:path";
import { REST, Routes } from "discord.js";
import { env } from "../lib/env";
import type { Command } from "../types/discord";

const commandsDir = path.join(import.meta.dir, "..", "commands");

async function collectCommandData() {
  const glob = new Bun.Glob("**/*.ts");
  const data: ReturnType<Command["data"]["toJSON"]>[] = [];

  for await (const file of glob.scan({ cwd: commandsDir, absolute: true })) {
    const command = (await import(file)).default as Command | undefined;
    if (command?.data) data.push(command.data.toJSON());
  }

  return data;
}

async function main() {
  const commands = await collectCommandData();
  const rest = new REST().setToken(env.DISCORD_BOT_TOKEN);

  const route = env.DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID)
    : Routes.applicationCommands(env.DISCORD_CLIENT_ID);

  console.log(
    `[deploy] Registering ${commands.length} command(s) ${env.DISCORD_GUILD_ID ? `to guild ${env.DISCORD_GUILD_ID}` : "globally"}...`
  );
  await rest.put(route, { body: commands });
  console.log("[deploy] Done.");
}

main().catch((error) => {
  console.error("❌ Failed to deploy commands:", error);
  process.exit(1);
});
