# @repo/twitch-api

Highly optimized, type-safe wrapper around the Twitch Helix API. Designed for use across the StreamWizard ecosystem.

## 🚀 Overview

This package provides a standardized way to interact with Twitch services, handling authentication, rate limiting, and response parsing automatically.

## 🛠 Features

- **Granular Clients**: Specialized classes for different Helix domains (Streams, Clips, VODs, Chat, etc.).
- **Automatic Token Management**: Handles app tokens and user-specific access tokens.
- **Strictly Typed**: Full TypeScript support for all request parameters and response data.
- **Base Client**: Reusable base logic for consistent API interaction and error handling.

## 📦 Clients Available

- `TwitchStreamsClient`: Fetch live stream data and viewer counts.
- `TwitchClipsClient`: Create and retrieve clips.
- `TwitchVodsClient`: Manage and sync VODs.
- `TwitchChatClient`: Interaction with Twitch chat.
- `TwitchEventsubClient`: Manage webhook and WebSocket subscriptions.

## 🏁 Usage

```typescript
import { TwitchApi } from "@repo/twitch-api";

const api = new TwitchApi(broadcasterId);
const stream = await api.streams.getStream();

console.log(`Current viewers: ${stream.viewer_count}`);
```

## 🛠 Development

- `src/base-client.ts`: Core axios configuration and token injection.
- `src/index.ts`: Main entry point that aggregates all sub-clients.
