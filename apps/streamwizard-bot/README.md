# @repo/streamwizard-bot

The dedicated event processing engine for StreamWizard. This service manages WebSocket connections to Twitch EventSub and handles real-time stream state transitions.

## 🚀 Overview

The StreamWizard Bot is responsible for:

- **WebSocket Event Consumption**: Maintaining a persistent connection to Twitch via AWS/Twitch EventSub WebSockets.
- **Event Dispatching**: Processing incoming events (follows, subs, bits, stream state changes) and triggering appropriate handlers.
- **Database Logging**: Recording all incoming Twitch events into Supabase for history and analytics.
- **Context Management**: Providing shared API instances and context to event handlers.

## 🛠 Features

- **Robust Handling**: Designed to handle bursts of events during high-traffic streams.
- **Pluggable Handlers**: Easy-to-extend registry system for adding new event types.
- **Type Safety**: Uses shared schemas to validate event payloads at the boundary.

## 🚀 Running Locally

From the root directory:

```bash
bun dev --filter=@repo/streamwizard-bot
```

Or from this directory:

```bash
bun dev
```

## 📂 Internal Structure

- `src/handlers/`: Contains the registration and dispatch logic for different event providers.
- `src/functions/`: Business logic for individual event types (e.g., what happens when someone follows).
