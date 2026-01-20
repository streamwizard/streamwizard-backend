# @repo/smp-bridge

The bidirectional bridge between Twitch and Survival MultiPlayer (SMP) servers (like Minecraft).

## 🚀 Overview

The SMP Bridge enables interactive streaming experiences by connecting Twitch chat events and redemptions directly to in-game actions. It allows streamers to create a more engaging environment where viewers can influence the game in real-time.

## 🛠 Features

- **Event Mapping**: Link Twitch Channel Point redemptions to specific in-game commands or events.
- **WebSocket Gateway**: Maintains communication with Minecraft server plugins/mods.
- **Dynamic Context**: Passes Twitch user information and metadata to the game bridge.

## 🚀 Running Locally

From the root directory:

```bash
bun dev --filter=@repo/smp-bridge
```

Or from this directory:

```bash
bun dev
```

## 🏗 Key Components

- `src/handlers/`: Logic for mapping Twitch events to SMP actions.
- `src/services/`: Services for managing connections to game servers.
