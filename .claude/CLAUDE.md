# StreamWizard

## Pull Requests
Always open PRs against the `staging` branch. Never target `main` or `production` (prod) as the base.

## Copy & Tone of Voice
When writing any user-facing copy — marketing pages, landing pages, onboarding, buttons, empty states, errors — follow the guidelines in `docs/tone_of_voice.md`.

## Alert timeline editor
The keyframed alert scene format, its renderer and the modal editor's conventions are documented in
`packages/alert-scene/CLAUDE.md`. Read it before touching `packages/alert-scene`, the alert widget's timeline
branch, or `apps/web-streamwizard/src/components/overlays/alert-timeline/`.
