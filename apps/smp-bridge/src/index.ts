// src/index.ts
import { minecraftWebSocketServer } from "./services/minecraftWebsocketServer";
import { handlers } from "./handlers/eventHandler";
import { TwitchEventSubReceiver } from "@repo/twitch-eventsub";
import customLogger from "@/lib/logger";

const localhost = "ws://127.0.0.1:8080/ws";
const production = "wss://eventsub.wss.twitch.tv/ws";

async function main() {
    try {
        const EventSubReceiver = new TwitchEventSubReceiver(handlers, {
            wsUrl: production,
            conduitId: "b4044568-68e1-4667-b7e1-d3bac6076117",
        });

        // Handle graceful shutdown
        process.on("SIGINT", async () => {
            await EventSubReceiver.disconnect();
            await minecraftWebSocketServer.stop();
            process.exit(0);
        });

        // Handle graceful shutdown
        process.on("SIGTERM", async () => {
            await EventSubReceiver.disconnect();
            await minecraftWebSocketServer.stop();
            process.exit(0);
        });

        minecraftWebSocketServer.start();
        await EventSubReceiver.connect();
    } catch (error) {
        customLogger.error("❌ Failed to start receiver:", error);
        process.exit(1);
    }
}

main();
