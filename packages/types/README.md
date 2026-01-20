# @repo/types

The central source of truth for TypeScript definitions across the StreamWizard ecosystem.

## 🚀 Overview

This package aggregates and exports all essential types, interfaces, and enums used by both applications and other shared packages. It ensures consistency and prevents type-duplication across the monorepo.

## 🛠 Features

- **Helix API Types**: Comprehensive interfaces for Twitch Helix resources (Streams, VODs, Clips).
- **EventSub Types**: Definitions for all Twitch EventSub notification payloads.
- **WebSocket Types**: Structure for internal and external WebSocket messages.
- **Provider Interfaces**: Generic types for stream providers and event handlers.

## 📁 Key Components

- `src/helix.ts`: Typed definitions for Twitch API requests and responses.
- `src/eventsub.ts`: Typed definitions for Twitch subscription events.
- `src/index.ts`: Re-exports of all core types for easy consumption.

## 🏁 Usage

```typescript
import { Stream, EventSubSubscriptionType } from "@repo/types";

const handleEvent = (type: EventSubSubscriptionType, data: any) => {
  // ...
};
```
