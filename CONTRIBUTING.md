# Contributing to StreamWizard

Never opened a PR before? Never forked a repo? That's fine — this guide covers everything from zero. Read it top to bottom once, then use it as a reference.

Got stuck? [Join the Discord](https://discord.gg/29Eq659egv) and ask. No question is too basic.

---

## Table of Contents

1. [What you need installed](#1-what-you-need-installed)
2. [How the project is structured](#2-how-the-project-is-structured)
3. [Fork and clone the repo](#3-fork-and-clone-the-repo)
4. [Set up your local database](#4-set-up-your-local-database)
5. [Known development differences](#5-known-development-differences)
6. [Make your changes](#6-make-your-changes)  
7. [Open a Pull Request](#7-open-a-pull-request)
8. [The review process](#8-the-review-process)
9. [Branch rules](#9-branch-rules)
10. [Code style](#10-code-style)
11. [Get help](#11-get-help)

---

## 1. What you need installed

| Tool | What it does | Install |
|------|-------------|---------|
| [Git](https://git-scm.com/) | Tracks code changes | [git-scm.com/downloads](https://git-scm.com/downloads) |
| [Bun](https://bun.sh/) | Runs the project | [bun.sh/docs/installation](https://bun.sh/docs/installation) |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | Manages the local database | [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli) |
| [Docker](https://www.docker.com/) | Required by Supabase CLI | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) |
| A [GitHub account](https://github.com/signup) | To submit changes | [github.com/signup](https://github.com/signup) |

Check what's already installed by running these in your terminal:

```bash
git --version
bun --version
supabase --version
docker --version
```

Version number = good. Error = install it.

---

## 2. How the project is structured

StreamWizard is a **monorepo** — one repo, multiple apps and shared packages, managed with [Turborepo](https://turbo.build/) on [Bun](https://bun.sh/). Two folders matter: `apps/` (things that run) and `packages/` (things the apps share). You probably only need to touch one of these.

### Apps

| App | What it does |
|-----|--------------|
| `web-streamwizard` | The dashboard streamers actually log into. Clips, folders, overlays, analytics. Next.js App Router. |
| `web-overlay` | The OBS browser source. Renders overlay scenes server-side so your stream doesn't drop frames. |
| `web-admin` | Internal ops dashboard. Service graphs and metrics — for us, not your viewers. |
| `rest-api` | Hono API. Handles Twitch EventSub webhooks and clip sync. |
| `streamwizard-bot` | The chat bot. Connects to Twitch chat over EventSub and answers commands. |
| `ws-server` | The real-time event bus. Fans out Twitch events and IRL GPS to overlays over WebSockets. |

### Packages

| Package | What it does |
|---------|--------------|
| `ui` | Shared React components and the canonical overlay widget renderers. |
| `supabase` | The database client and every query function. All `.from()` calls live here. |
| `twitch-api` | Typed Twitch Helix client. Tokens and refresh handled for you. |
| `twitch-eventsub` | EventSub orchestration over both Webhook and WebSocket transports. |
| `types` | Shared TypeScript types — Helix shapes, EventSub payloads, overlay events. |
| `schemas` | Zod validation schemas. |
| `logger` | Centralized logging. |
| `metrics` | Metrics collection for `web-admin`. |
| `posthog` | Product analytics wiring. |
| `sentry` | Error tracking config shared across apps. |
| `eslint-config` / `typescript-config` | Shared lint and TS config so every package agrees on the rules. |

Want the deeper map — routing, the database access rule, the overlay widget split, the WebSocket protocol? That's all in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## 3. Fork and clone the repo

**Forking** creates your own copy of the repo on GitHub. You make changes there, then propose them back here.

### Step 1 — Fork

1. Go to [github.com/streamwizard/streamwizard](https://github.com/streamwizard/streamwizard)
2. Click **Fork** in the top-right
3. Click **Create fork**

### Step 2 — Clone your fork

```bash
git clone https://github.com/YOUR-USERNAME/streamwizard.git
cd streamwizard
```

### Step 3 — Add the original repo as upstream

This lets you pull in updates from the main project later:

```bash
git remote add upstream https://github.com/streamwizard/streamwizard.git
```

Verify it worked:

```bash
git remote -v
```

You should see `origin` (your fork) and `upstream` (the original).

### Step 4 — Install dependencies

```bash
bun install
```

### Step 5 — Environment variables

The project uses [Doppler](https://www.doppler.com/) for secrets in production. Locally, you use a `.env` file.

```bash
cp .env.example .env
```

You don't need every variable — only the ones relevant to what you're working on. Not sure which ones? Ask in [Discord](https://discord.gg/29Eq659egv).

---

## 4. Set up your local database

StreamWizard uses [Supabase](https://supabase.com/) for its database. For local development you run a **local Supabase instance** — you never touch staging or production.

### Step 1 — Start the local stack

Make sure Docker is running, then:

```bash
supabase start
```

First run takes a few minutes. When it's ready you'll see:

```
API URL:    http://127.0.0.1:54321
DB URL:     postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
```

### Step 2 — Apply existing migrations

```bash
supabase db push --local
```

### Step 3 — Open Supabase Studio

Go to [http://127.0.0.1:54323](http://127.0.0.1:54323) — it's a visual interface for your local database. Use it to explore tables, run queries, and test changes.

### Step 4 — Making database changes

If your change needs a new table, column, or function:

1. Make the change in Supabase Studio locally and verify it works
2. Generate a migration file:

```bash
supabase db diff -f your_migration_name
```

This creates a file in `supabase/migrations/`. **Commit it** — that's how the change gets applied to staging and production automatically through the CI pipeline.

### Step 5 — Stop when done

```bash
supabase stop
```

### Step 6 — Run the dev servers

With dependencies installed, your `.env` filled in, and Supabase running:

```bash
bun dev          # everything
bun dev:main     # dashboard, overlay, bot, ws-server, rest-api
bun dev:monitor  # just the monitoring dashboard
```

Other scripts you'll reach for:

- `bun build` — build everything for production
- `bun lint` — lint the whole workspace
- `bun format` — Prettier across the repo
- `bun check-types` — typecheck every package
- `bun gen-types` — regenerate Supabase types from the database schema

> Config goes through the shared `@repo/env` package — don't reach for `process.env` directly.

---

## 5. Known development differences

Some features behave differently in `NODE_ENV=development` to avoid errors that only make sense in production.

### EventSub webhooks disabled

Twitch requires HTTPS for webhook delivery. In a local dev environment (HTTP), the webhook subscription registration and the webhook endpoint are both disabled:

- **`apps/web-streamwizard`** — on login, only conduit (WebSocket) subscriptions are registered. Webhook subscriptions (`stream.online`, `stream.offline`, `channel.update`) are skipped.
- **`apps/rest-api`** — the `POST /webhooks/twitch/eventsub` route is not registered.

EventSub WebSocket transport works normally in dev — Twitch events delivered via conduit are unaffected.

---

## 7. Make your changes

### Step 1 — Sync with staging

Before touching any code, pull in the latest changes:

```bash
git fetch upstream
git checkout staging
git merge upstream/staging
```

### Step 2 — Create a branch

Never work directly on `staging` or `main`. Create a branch:

```bash
git checkout -b feature/your-feature-name
```

Good branch names:
- `feature/add-clip-sorting`
- `fix/ws-server-reconnect`
- `docs/update-readme`

### Step 3 — Commit your changes

```bash
git add .
git commit -m "feat: add clip sorting by view count"
```

Commit message prefixes:
- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `chore:` — maintenance, dependencies

### Step 4 — Push to your fork

```bash
git push origin feature/your-feature-name
```

---

## 8. Open a Pull Request

1. Go to your fork on GitHub: `github.com/YOUR-USERNAME/streamwizard`
2. Click **Compare & pull request**
3. **Set the base branch to `staging` — not `main`**

   > PRs against `main` won't be accepted. Always target `staging`.

4. Fill in the PR description:
   - What does this change do?
   - Why is it needed?
   - How did you test it? Include screenshots for UI changes.

5. Click **Create pull request**

---

## 9. The review process

1. A maintainer reviews your code and may leave comments
2. Make changes on your branch and push — the PR updates automatically
3. Once approved, it gets merged into `staging`
4. The staging database migration pipeline runs automatically
5. After verification on staging, changes go to `main` and hit production

Reviews can take a few days. If you haven't heard back in a week, leave a comment on the PR.

---

## 10. Branch rules

| Branch | Purpose | Who can PR here |
|--------|---------|-----------------|
| `staging` | Pre-production — tested before going live | Anyone via a fork |
| `main` | Verified — triggers database migrations | Maintainers only |
| `production` | Production — what real users see | Automated only |

The `production` branch is never touched manually. When migrations on `main` succeed, it gets updated automatically and Dokploy deploys from there.

---

## 11. Code style

Run these before opening a PR:

```bash
bun format       # auto-formats your code
bun lint         # checks for issues
bun check-types  # validates TypeScript types
```

PRs with failing checks won't be merged.

---

## 12. Get help

- **Stuck on setup or have a question?** [Join the Discord](https://discord.gg/29Eq659egv) — fastest way to get help
- **General discussion or ideas?** [Discord](https://discord.gg/29Eq659egv)
- **Not sure what to work on?** Ask in Discord or look for issues tagged `good first issue`
- **Found a bug or have a feature request?** Open an issue on [GitHub](https://github.com/streamwizard/streamwizard/issues) — or use the StreamWizard Discord bot directly. `/bug`, `/feature`, `/docs`, and `/perf` all create a GitHub issue without leaving Discord.
