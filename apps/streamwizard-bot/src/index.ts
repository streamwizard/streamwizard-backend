// src/index.ts
import { handlers } from "./handlers/eventHandler";
import { TwitchEventSubReceiver } from "@repo/twitch-eventsub";

const localhost = "ws://127.0.0.1:8080/ws";
const production = "wss://eventsub.wss.twitch.tv/ws";

async function main() {
    try {
        const EventSubReceiver = new TwitchEventSubReceiver(handlers, {
            wsUrl: production,
            conduitId: "4e265eca-6fc7-492b-bc59-ad1b6ad29444",
        });

        // Handle graceful shutdown
        process.on("SIGINT", async () => {
            await EventSubReceiver.disconnect();
            process.exit(0);
        });

        // Handle graceful shutdown
        process.on("SIGTERM", async () => {
            await EventSubReceiver.disconnect();
            process.exit(0);
        });

        await EventSubReceiver.connect();
    } catch (error) {
        console.error("❌ Failed to start receiver:", error);
        process.exit(1);
    }
}

main();
