# web-admin

The internal ops dashboard. Service graphs, live metrics, and a view into what every StreamWizard service is doing — for the team, not for streamers. If you're a contributor, you probably don't need to touch this one.

## What it does

Pulls metrics from across the stack (`@repo/metrics`) and draws them as interactive service graphs, so we can see at a glance what's healthy and what's on fire.

Sections, one per subsystem:

- **Overview** — the top-level health view.
- **Database** — Supabase / Postgres activity.
- **EventSub** — Twitch subscription and event flow.
- **HTTP** — the REST API.
- **WS** — the overlay WebSocket server.

Graphs are laid out with [`@xyflow/react`](https://reactflow.dev/) and [`dagre`](https://github.com/dagrejs/dagre); the data layer is `@repo/metrics`.

## Running locally

From the repo root:

```bash
bun dev --filter=@repo/web-admin
```

Or with the convenience script:

```bash
bun dev:monitor
```

Runs on [http://localhost:3003](http://localhost:3003).
