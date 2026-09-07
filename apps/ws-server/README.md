# ws-server

The real-time overlay event bus. One Bun WebSocket server that fans Twitch events and IRL GPS out to every overlay that's listening — not just an IRL relay, the single pipe all live overlay data flows through.

## How it works

Three connection roles share one server, each authenticated differently:

| Role | Auth | Who it is |
|------|------|-----------|
| `publisher` | Supabase JWT *or* `overlay_scenes.subscriber_token` | The GPS overlay page sending on-device GPS. One per user room. |
| `subscriber` | `overlay_scenes.subscriber_token` | An OBS overlay. Many per user room. |
| `bot` | `Bearer <SUPABASE_SERVICE_ROLE_KEY>` | `streamwizard-bot` — one persistent connection, fans Twitch events out to subscribers. |

### Connection URL

```
ws://<host>/ws?role=<publisher|subscriber|bot>&token=<token>&channels=<comma-separated-event-types>
```

`channels` is optional for subscribers — leave it off to receive every event type.

Event types are Twitch EventSub strings (`channel.follow`, `channel.subscribe`, `channel.raid`, …) plus internal ones (`streamwizard.geo`, `streamwizard.status`). The full wire format, role auth, and bot integration are documented in the root [`ARCHITECTURE.md`](../../ARCHITECTURE.md).

## Internal structure

- `src/index.ts` — the `Bun.serve` entry point.
- `src/handlers/auth.ts` — the upgrade handshake and role auth.
- `src/handlers/ws.ts` — message handling.
- `src/rooms.ts` — per-user room membership and fan-out.

## Running locally

From the repo root:

```bash
bun dev --filter=@repo/ws-server
```

Listens on port `8000` (override with `PORT`).
