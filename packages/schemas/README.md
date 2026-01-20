# @repo/schemas

Type-safe runtime validation using [Zod](https://zod.dev/).

## 🚀 Overview

This package defines shared Zod schemas used for validating data at operational boundaries—such as incoming Twitch webhooks, database responses, and API requests. It bridges the gap between raw data and our strictly typed system.

## 🛠 Features

- **EventSub Validation**: Validates incoming Twitch EventSub payloads before processing.
- **Contract Enforcement**: Ensures data flowing through the system meets required constraints.
- **Automatic Inference**: Synchronizes TypeScript types with runtime validation schemas.

## 📁 Key Components

- `twitch-eventsub-subscription-events.ts`: Schemas for validating various EventSub event types (online, offline, channel updates).

## 🏁 Usage

```typescript
import { StreamOnlineEventSchema } from "@repo/schemas";

const result = StreamOnlineEventSchema.safeParse(rawPayload);
if (result.success) {
  // result.data is now fully typed and validated
}
```
