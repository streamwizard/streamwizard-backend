# @repo/logger

Centralized logging system for StreamWizard, specializing in tracking Twitch events and system-wide audit logs.

## 🚀 Overview

The logger package provides a consistent interface for recording events across all services. It directly integrates with Supabase to store logs for historical analysis and real-time monitoring.

## 🛠 Features

- **Twitch Event Logging**: Standardized methods for recording online/offline events, follows, subs, and more.
- **Auto-Calculated Offsets**: Automatically calculates `offset_seconds` from the start of a stream for accurate event placement.
- **Provider Agnostic**: Designed to support multiple providers (though currently focused on Twitch).
- **Type Safe**: Integrated with database types to ensure log consistency.

## 🏁 Usage

```typescript
import { streamEventsLogger } from '@repo/logger';

await streamEventsLogger.logTwitchEvent({
  broadcaster_id: '123456',
  event_type: 'stream.online',
  event_data: { ... },
  metadata: { ... }
});
```

## 📂 Key Components

- `src/eventLogger.ts`: The core `StreameventsLogger` class managing inserts into the `stream_events` and `stream_viewer_counts` tables.
- `src/index.ts`: Unified export for all logging utilities.
