# @repo/twitch-eventsub

A robust abstraction layer for managing and responding to Twitch EventSub subscriptions.

## 🚀 Overview

This package simplifies the complex orchestration of Twitch EventSub, supporting both Webhook and WebSocket delivery methods. It provides a clean API for subscribing to events and handling notifications with full type safety.

## 🛠 Features

- **Unified Interface**: Same API for managing events regardless of the delivery mechanism.
- **Subscription Management**: Helpers for creating, deleting, and listing subscriptions.
- **Payload Processing**: Standardized logic for parsing and cleaning incoming notification data.
- **Resilient**: Designed to handle reconnection logic and missed events for WebSocket consumers.

## 🏁 Usage

```typescript
import { TwitchEventSubReceiver } from '@repo/twitch-eventsub';

const receiver = new TwitchEventSubReceiver({ ... });
await receiver.subscribe('channel.follow', { broadcaster_user_id: '123' });
```
