# @repo/rest-api

The central API gateway for the StreamWizard backend. This service manages public-facing endpoints, internal analytics, and Twitch EventSub webhooks using [Hono](https://hono.dev/) on the [Bun](https://bun.sh/) runtime.

## 🚀 Overview

This service handles:

- **Twitch Webhooks**: High-performance endpoint for receiving EventSub notifications.
- **Data Synchronization**: Orchestrates syncing of clips, VODs, and broadcaster status.
- **Analytics API**: Serves historical viewer count data.
- **Authentication**: Secure middleware for user-facing endpoints using Supabase.

## 🛠 Features

- **Blazing Fast**: Uses Bun's HTTP server and Hono's lightweight routing.
- **Type Safe**: End-to-end type safety using shared internal packages and Zod.
- **EventSub Verification**: Built-in HMAC verification for Twitch webhook payloads.
- **CORS Enabled**: Configured for communication with StreamWizard frontends.

## 📁 Key Routes

- `POST /webhooks/twitch/eventsub`: Entry point for all Twitch events.
- `GET /api/clips/sync-status`: Real-time status of clip synchronization.
- `POST /api/clips/sync`: Manual trigger for clip synchronization.
- `GET /api/viewer-counts/:streamId`: (Planned) Fetch viewer history for a specific stream.

## 🚀 Running Locally

From the root directory:

```bash
bun dev --filter=@repo/rest-api
```

Or from this directory:

```bash
bun dev
```

## 🏗 Build

```bash
bun build
```
