# Dokploy deployment settings

All app Dockerfiles in this monorepo expect the **Docker build context to be the
repository root** (`.`), because they install the whole Bun workspace and copy
shared `packages/`. If an app's context is scoped to its own folder, `bun install`
fails to resolve the `@repo/*` workspace packages:

```
error: Workspace dependency "@repo/supabase" not found
Searched in "./*"
```

## Required settings per app

Two different Dokploy fields, on two different tabs, control the build root.
Both must point at the repository root, **not** the app folder:

| Tab            | Field               | Value                          |
| -------------- | ------------------- | ------------------------------ |
| Git / Provider | **Build Path**      | `/`                            |
| Build          | **Docker Context Path** | `.`                        |
| Build          | **Docker File**     | `apps/<app-name>/Dockerfile`   |

> ⚠️ The most common mistake: **Build Path** (Git/Provider tab) is left pointing
> at `/apps/<app-name>`. When that happens, Dokploy resolves the build context
> *and* the Dockerfile path inside the app folder, so `packages/` is never sent
> to the build and `bun install` fails with "Workspace dependency not found".
> Setting Docker Context Path alone does not fix it — check Build Path too.

Examples:

| App              | Docker File                          |
| ---------------- | ------------------------------------ |
| discord-bot      | `apps/discord-bot/Dockerfile`        |
| rest-api         | `apps/rest-api/Dockerfile`           |
| streamwizard-bot | `apps/streamwizard-bot/Dockerfile`   |
| ws-server        | `apps/ws-server/Dockerfile`          |
| web-overlay      | `apps/web-overlay/Dockerfile`        |
| web-streamwizard | `apps/web-streamwizard/Dockerfile`   |

The Dockerfile path is relative to the context root, so it keeps the
`apps/<app-name>/` prefix even though the context is `.`.

## How to confirm the context is correct

In the build log, check the context transfer near the top:

- ✅ Correct (repo root): `transferring context: <several> MB` and the
  `.dockerignore` load shows a few hundred bytes (the repo-root `.dockerignore`).
- ❌ Wrong (app folder): `transferring context: ~68 kB` and `.dockerignore`
  shows `2B` — the context is the app directory and `packages/` is missing.
