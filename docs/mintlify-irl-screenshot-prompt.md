# Capture prompt — Mintlify IRL docs screenshots

Paste everything below the line into Claude running on the Windows box with Chrome
access. These screenshots are for the new IRL pages in the Mintlify docs
(`apps/docs/irl/*.mdx`).

---

You are capturing screenshots for StreamWizard's documentation site. StreamWizard is a
cloud service: a user gets their own OBS instance running in a container, controlled
from a web dashboard. This is the **staging** environment.

**Site:** https://staging.streamwizard.org
**Account:** `jochemwhite`, signed in with Twitch. The account was reset to a
first-time state on purpose: no ingest key, no container, no auto switcher config.
If you hit a login page, stop and ask me to sign in. Do not attempt to log in
yourself.

**Where to save**

```
Windows   C:\streamwizard-docs\mintlify\
WSL       /mnt/c/streamwizard-docs/mintlify/
```

Create the folder if it does not exist. The WSL side has to be able to read it, so
if that path fails, ask me before picking a different one.

**Browser:** drive Chrome with the automation you have (chrome-devtools MCP or
Playwright against the existing profile). Use the already signed-in profile, not
incognito.

**Pages**

- Cloud OBS dashboard: `/dashboard/irl/obs`
- Ingest keys: `/dashboard/irl/ingest`
- Phone deck: `/deck`
- OBS viewer: opens as a popup from the dashboard, no direct link

## Rules for every capture

- PNG, exactly the filenames below. They are referenced from the docs pages, a typo
  means a broken image.
- Desktop captures at 1440x900. Deck captures (`deck-*`) at 390x844.
- Same colour theme across all of them.
- Let spinners and skeletons finish, unless the capture is about a loading state.
- No bookmarks bar, no unrelated tabs.

## Blur or avoid, check before saving

- **Ingest stream keys and output keys**: the long random strings, including inside
  `srt://...?streamid=...`, the SRTLA line, and truncated previews in the key list.
  Blur the key, leave host and port readable.
- **The Twitch stream key**: should never be on screen. If it appears, do not save,
  tell me instead.
- **Email addresses**: the username `jochemwhite` is fine, the email is not.
- **Instance UUIDs and VNC passwords** in the address bar: blur the URL bar on the
  OBS viewer capture.

## Order matters

Capture 1 must happen before anything else. Creating a key destroys the empty state
and there is no way back without another database reset. Do not click Create key
until capture 1 is saved.

### Onboarding, at `/dashboard/irl/obs`

1. `onboarding-01-stepper-empty.png` — the guided setup card as it first loads.
   Step 1 "Create an ingest key" active, steps 2 to 5 greyed out. Include the
   "Cloud OBS" heading and status badge.
2. `onboarding-02-key-created.png` — type `phone` as the label, click Create key,
   capture straight after: step 1 ticked, step 2 unlocked.
3. `onboarding-03-launching.png` — click Launch Cloud OBS and capture the boot
   progress panel while it runs, elapsed seconds visible. Transient, be ready.
4. `onboarding-04-obs-connected.png` — once the badge says "OBS Connected", the
   stepper with steps 1 to 3 ticked and step 4 unlocked.
5. `onboarding-05-alert-sources-step.png` — the alert sources panel inside step 4:
   Label field, Widget URL field, and the scene chips.
6. `onboarding-07-obs-viewer.png` — finish or skip step 4, click Open OBS on step 5.
   Capture the popup's content: the OBS interface with its scene list. Blur the
   address bar.
7. `onboarding-08-ingest-keys-page.png` — go to `/dashboard/irl/ingest`. Full page:
   the Stream ingest card with both URLs and the Your keys card. Blur the keys.

### Container, at `/dashboard/irl/obs`

8. `container-01-running.png` — the top section: VNC preview left, and on the right
   the "OBS Connected" badge, the stream row, and the Container row with Stop
   container. Leave the container running.

### Auto switcher (setup for the deck shots, no captures needed here)

Open the Auto Switcher tab, turn it on, pick the 3-scene model with real scenes,
preset Balanced, and save. The deck captures below depend on this config existing.

### Deck, at `/deck`, 390x844

9. `deck-01-main.png` — container running, OBS connected: the big Go live button,
   Current scene card, scene tiles.
10. `deck-03-hold-card.png` — tap a scene tile with the switcher enabled, capture
    the hold card with the held scene and its release control. Release afterwards.
11. `deck-04-sensitivity-tab.png` — the Sensitivity tab from the bottom bar: the
    preset cards and the status strip.

## When you are done

Leave the container **running** and the ingest key in place — phone-side captures
happen next and need a live ingest to point at. Give me:

1. The list of files you saved.
2. Anything you skipped, with the reason.
3. The exact ingest key label you created (should be `phone`).
