# StreamWizard

[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/29Eq659egv)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Cloud OBS for IRL, overlays, clips, VOD clipping and analytics. One Twitch login and one dashboard, instead of seven browser tabs and a Notion doc you stopped updating in March.

## What is StreamWizard?

Open source Twitch tools built by one streamer in the Netherlands since 2024: cloud OBS for IRL, overlays, clip folders, VOD clipping and analytics.

- **Cloud OBS.** A dedicated OBS for your channel, running in the cloud. Your phone streams in over SRT or SRTLA, you run the show from the deck on your phone, and an auto switcher covers connection drops with a fallback scene so chat never sees the frozen frame.
- **Overlays.** Alerts, chat, a clips rotator, countdowns and IRL widgets in one OBS browser source. Build your own widgets in the editor when the library doesn't have it.
- **Clips.** Every clip from your channel synced automatically and filed into folders you name. Filter by category, streamer or clipper instead of scrolling through years of untagged clips.
- **VOD clipping.** Follows, subs, cheers, raids and ad breaks marked on the VOD timeline. Drag a 5 to 60 second selection and it becomes a real Twitch clip.
- **Analytics.** Your last broadcast minute by minute, with follows, subs and clips plotted on the viewer graph, and the hour your stream did best.

Cloud OBS is the paid tier. Everything else is free. Details on [streamwizard.org/pricing](https://streamwizard.org/pricing).

This repo is the whole thing, open source under the MIT license: the dashboard streamers log into, the cloud OBS auto switcher, the overlay player, the Twitch chat bot, the Discord bot, the REST API, the WebSocket event bus that ties them together, and the docs.

## Quick Links

- **Open the app**: [streamwizard.org](https://streamwizard.org)
- **Docs**: [docs.streamwizard.org](https://docs.streamwizard.org)
- **Discord**: [join the community](https://discord.gg/29Eq659egv)
- **Report a bug**: [open an issue](https://github.com/streamwizard/streamwizard/issues)
- **Contributing**: [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)

## Built with

[Bun](https://bun.sh/), [Turborepo](https://turbo.build/), [Next.js](https://nextjs.org/), [Hono](https://hono.dev/), [Supabase](https://supabase.com/), and [TypeScript](https://www.typescriptlang.org/) top to bottom.

## Contributing

Want to fix a bug, add a feature, or just poke around the code? Everything you need is in [CONTRIBUTING.md](./CONTRIBUTING.md): how the monorepo is laid out, how to run it locally, and how to open a PR. Never opened a PR before? That guide starts from zero.

Not a coder but found something broken? [Open an issue](https://github.com/streamwizard/streamwizard/issues), or use the StreamWizard bot in [Discord](https://discord.gg/29Eq659egv). `/bug`, `/feature`, `/docs` and `/perf` file it for you without leaving chat.

## License

MIT. See [`LICENSE`](./LICENSE).
