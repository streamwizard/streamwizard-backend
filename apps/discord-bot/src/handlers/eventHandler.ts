import path from "node:path";
import type { Client } from "discord.js";
import type { BotEvent } from "../types/discord";

const eventsDir = path.join(import.meta.dir, "..", "events");

export async function loadEvents(client: Client) {
  const glob = new Bun.Glob("**/*.ts");
  let count = 0;

  for await (const file of glob.scan({ cwd: eventsDir, absolute: true })) {
    const event = (await import(file)).default as BotEvent | undefined;

    if (!event?.name || !event?.execute) {
      console.warn(`[events] Skipping ${file}: missing "name" or "execute"`);
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
    count++;
  }

  console.log(`[events] Loaded ${count} event(s)`);
}
