# @repo/supabase

Shared database client and utility functions for the StreamWizard platform, built on top of [Supabase](https://supabase.com/).

## 🚀 Overview

This package centralizes all database interactions, ensuring consistent schema access and helper logic across all applications in the monorepo.

## 🛠 Features

- **Centralized Client**: Single source of truth for the Supabase client initialization.
- **Type Safety**: Includes generated types for the entire database schema.
- **Token Cryptography**: Secure helpers for encrypting and decrypting Twitch tokens before storage.
- **Migrations**: Tracks the evolution of the database schema (see `migrations/`).

## 📁 Key Components

- `src/index.ts`: The main client export and high-level auth helpers.
- `src/crypto.ts`: AES-256-GCM encryption for sensitive data (tokens).
- `src/types/`: Generated TypeScript definitions from the Supabase CLI.

## 🏁 Usage

```typescript
import { supabase } from "@repo/supabase";

const { data, error } = await supabase
  .from("broadcaster_live_status")
  .select("*")
  .eq("is_live", true);
```

## 🛠 Database Schema

Key tables managed by this package:

- `integrations_twitch`: Stores user tokens and profile data.
- `broadcaster_live_status`: Real-time tracking of who is live.
- `stream_events`: Historical log of all processed EventSub events.
- `stream_viewer_counts`: Snapshots of viewer counts for analytics.
