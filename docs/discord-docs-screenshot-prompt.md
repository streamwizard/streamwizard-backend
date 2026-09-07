# Capture + flow-check prompt — StreamWizard Cloud OBS docs

Paste everything below the line into Claude Code running in PowerShell on the Windows box
(the one with Chrome and access to the shared folder).

Two jobs in one run: capture 30 screenshots, and check that the documentation we wrote
actually matches what the app does.

---

You are working on the StreamWizard documentation. StreamWizard is a cloud service: a user
gets their own OBS instance running in a container, controlled from a web dashboard. This
is the **staging** environment.

**Site:** https://staging.streamwizard.org
**Account:** `jochemwhite`, signed in with Twitch. It was reset to a first-time state on
purpose: no ingest key, no container, no auto switcher config. If you hit a login page,
stop and ask me to sign in. Do not attempt to log in yourself.

**Where to save**

```
Windows   C:\streamwizard-docs\screenshots\
WSL       /mnt/c/streamwizard-docs/screenshots/
```

Create the folder if it does not exist. If that path does not work on this machine, ask me
before picking a different one, because the WSL side has to be able to read it.

**Browser:** drive Chrome with whatever automation you have available (chrome-devtools MCP
or Playwright against the existing profile). Use the already signed-in profile. Do not open
an incognito window, the session will not be there.

**Pages you need**

- Cloud OBS dashboard: `/dashboard/irl/obs`
- Ingest keys: `/dashboard/irl/ingest`
- Phone deck: `/deck`
- OBS viewer: opens as a popup from the dashboard, there is no direct link

---

# Part 1: screenshots

## Rules for every capture

- PNG, exactly the filenames below. They are referenced from the Discord posts, so a typo
  means a broken image.
- Desktop captures at 1440x900. Deck captures (`deck-*`) at 390x844.
- Keep the same colour theme across all of them.
- Capture the region described. "Full page" means the whole content column.
- Let spinners and skeletons finish, unless the capture is about a loading state.

## Blur or avoid, check before saving

- **Ingest stream keys and output keys.** The long random strings, including inside the
  `srt://...?streamid=...` URL, the SRTLA line, and the truncated preview in the key list.
  Blur the key, leave host and port readable.
- **The Twitch stream key.** It should never be on screen. If it appears, do not save the
  file, tell me instead.
- **Email addresses.** The username `jochemwhite` is fine, the email is not.
- **Instance UUIDs and VNC passwords** in the address bar. Blur the URL bar on the OBS
  viewer capture.
- No bookmarks bar, no unrelated tabs.

## Order matters

Task 1 must happen before anything else. Creating a key destroys the empty state and there
is no way back without another database reset. Do not click Create key until task 1 is
saved.

Some captures need a live feed streaming into the ingest server, marked **[needs feed]**.
No feed available, skip them and say which ones you skipped. Do not fake a state.

### Onboarding, at `/dashboard/irl/obs`

1. `onboarding-01-stepper-empty.png` — the guided setup card as it first loads. Step 1
   "Create an ingest key" active, steps 2 to 5 greyed out. Include the "Cloud OBS" heading
   and status badge above it.
2. `onboarding-02-key-created.png` — type `phone` as the label, click Create key, capture
   the card straight after: step 1 ticked, step 2 unlocked.
3. `onboarding-03-launching.png` — click Launch Cloud OBS and capture the boot progress
   panel while it runs, with the elapsed seconds visible. Transient, be ready.
4. `onboarding-04-obs-connected.png` — once the badge says "OBS Connected", capture the
   stepper: steps 1 to 3 ticked, step 4 unlocked.
5. `onboarding-05-alert-sources-step.png` — the alert sources panel inside step 4: Label
   field, Widget URL field, and the scene chips under "Also show it in".
6. `onboarding-06-open-obs.png` — click Done adding alerts (or Skip), capture step 5 with
   the Open OBS button visible.
7. `onboarding-07-obs-viewer.png` — click Open OBS. Capture the popup window's content:
   the OBS interface with its scene list. Blur the address bar.
8. `onboarding-08-ingest-keys-page.png` — go to `/dashboard/irl/ingest`. Full page: the
   Stream ingest card with both URLs, and the Your keys card. Blur the keys.

### Container, at `/dashboard/irl/obs`

9. `container-01-running.png` — the top section: VNC preview on the left, and on the right
   the "OBS Connected" badge, the stream row, and the Container row with Stop container.
10. `container-02-stopped.png` — click Stop container, wait for it to settle, capture the
    same area: "Offline" badge, Start container button, and the offline card below.

Start the container again before continuing.

### Sources

11. `sources-01-add-source-dialog.png` — in the incoming signal section click Add source on
    your key. Capture the dialog: source name field and scene picker.
12. `sources-03-sources-tab.png` — the Sources tab with the tree expanded, at least a
    couple of sources and one filter visible, percentage bars showing.
13. `sources-04-source-toggle.png` — tight crop of one source row: its visibility switch
    and the CPU/GPU cells.

### Performance

14. `performance-01-stat-cards.png` — the Performance tab, top row: CPU Usage, Memory, FPS,
    Frame Time.
15. `performance-02-graphs.png` — same tab after roughly 60 seconds, so the four line charts
    have real history.

### Files

16. `tabs-02-files-empty.png` — the Files tab with nothing uploaded: drop zone and storage bar.
17. `tabs-03-files-uploaded.png` — upload a small image, capture the file list with the
    storage bar showing usage.

### Auto switcher

18. `switcher-02-scene-model.png` — turn the switcher on, capture the "How many scenes
    should it manage?" choice with both cards.
19. `switcher-03-scene-pickers.png` — the three scene dropdowns with the 3-scene option
    selected and real scenes chosen.
20. `switcher-04-presets.png` — the sensitivity row with all three preset cards, Balanced
    selected.
21. `switcher-05-advanced-matrix.png` — turn Advanced mode on, capture the threshold table
    plus the "Offline after" field. Turn advanced back off afterwards.
22. `switcher-06-extras.png` — the feature toggles. Turn chat notices on first so the three
    message template boxes are in the shot.
23. `switcher-07-hold-controls.png` — the Hold a scene card with the scene and duration
    dropdowns filled in.
24. `switcher-08-holding.png` — set the hold, capture the card in its holding state with the
    Release button. Release it afterwards.
25. `switcher-09-status-live.png` — **[needs feed]** the status card while a stream is
    arriving: state badge, "watching <label>", and the three metric bars.

Save the switcher config before leaving, and leave it enabled with scenes picked. The deck
captures depend on it.

### Deck, at `/deck`, 390x844

26. `deck-01-main.png` — container running, OBS connected: the big Go live button, Current
    scene card, and the scene tiles.
27. `deck-02-install-prompt.png` — the install prompt at the bottom. If it does not appear,
    skip it and say so.
28. `deck-03-hold-card.png` — tap a scene tile with the switcher enabled, capture the hold
    card showing the held scene and its release control.
29. `deck-04-sensitivity-tab.png` — the Sensitivity tab from the bottom bar: preset cards
    and the status strip.
30. `deck-05-offline.png` — with the container stopped, the deck's offline card with its
    start button.

---

# Part 2: does the documentation match the app?

While you are in there, check the claims we published. Write your findings to
`C:\streamwizard-docs\flow-check.md`.

For every item below, record one of:

- **OK** — works as described
- **WRONG** — with the actual behaviour, and the exact UI text where wording differs
- **UNVERIFIED** — with the reason (needs a live feed, needs a crash, could not reach it)

Quote real UI strings when they differ from ours. Do not fix anything in the app, and do not
change any setting beyond what these tasks ask for.

## Onboarding post

1. The first-run stepper has exactly five steps, in this order: create an ingest key, launch
   your cloud container, OBS boots inside it, add alert sources (optional), open OBS.
2. Steps stay locked until the one before them is done.
3. Step 1 creates the key, so a user does not have to visit the Ingest keys page first.
4. The status badge goes Starting up, then OBS booting, then OBS Connected.
5. Booting takes 10 to 30 seconds. Time it and tell me the real number.
6. Finishing step 5 ends the guided flow and shows the normal dashboard.
7. Step 4 can be skipped.

## Ingest server post

8. The Ingest keys page shows an SRT URL on port 8888 and an SRTLA line on port 5000, both
   carrying the key in `streamid`.
9. The key list shows the label, a truncated key, and a last-used time.
10. There are buttons to copy, rotate, delete, and send the key to Discord.
11. Rotating replaces the key immediately. Check what the UI tells the user afterwards.
12. Multiple keys can exist at once.
13. After OBS connects, a scene named `IRL` exists holding a source named
    `StreamWizard Ingest`, created without the user doing anything.
14. The incoming signal panel has an Add source button per key.

## Container post

15. The Container row has one button that starts or stops, and its label changes with state.
16. Stopping the container ends OBS. Scenes, sources and uploaded files survive a restart.
    Verify by stopping, starting, and checking your uploaded file and scenes are still there.
17. Starting from one device updates another device's open page without a refresh. Test with
    the dashboard on desktop and `/deck` in a second window.
18. With Twitch connected, OBS does not show an "Enter Stream Key" screen after boot.
19. **UNVERIFIED is fine here:** the crash banner and the "Not responding" state. Do not try
    to force a crash.

## Tabs

20. The tab strip is exactly: Sources, Performance, Files, Auto Switcher.
21. Sources tab: tree of scenes, sources and filters, each with CPU and GPU percentages and
    a toggle that takes effect live in OBS. Verify a toggle actually changes OBS.
22. Performance tab: CPU Usage, Memory, FPS, Frame Time cards, plus skipped and dropped
    frame counts, plus four graphs that build up over time.
23. Files tab: drag and drop upload, a storage bar, rename and delete per file. Confirm the
    quota really reads 500MB.
24. Renaming a file that a scene uses: check whether the app warns about it, and quote the
    warning.

## Browser sources post

25. An `_alerts` scene exists in a fresh container.
26. `_alerts` does not appear in the scene buttons on the dashboard, or on the deck.
27. Adding an alert source with other scenes ticked puts the original in `_alerts` and a
    clone in each ticked scene. Verify the clones are clones, not second browser sources.
28. A `Welcome (Delete me)` scene exists and is kept out of the scene pickers.

## Auto switcher post

29. The tab shows a card with an enable toggle, and the settings only appear once it is on.
30. Scene pickers are disabled or empty when OBS is not connected.
31. There is a 2-scene and a 3-scene option, and choosing 2 hides the low bitrate picker.
32. Three sensitivity presets exist. Check their names against ours: Relaxed, Balanced, Fast.
33. Advanced mode shows a table with rows Bitrate, Ping (RTT), Packet loss and columns for
    limit, trigger, recover and startup, plus an offline timeout field.
34. The extras are: log switches, chat notices with three templates, warning source, auto
    stop with a minutes field, and a field to pin one stream key label.
35. Chat notice templates mention the placeholders `{bitrate}`, `{rtt}`, `{loss}`, `{scene}`.
36. Hold durations offered are 15 minutes, 1 hour, and until released.
37. Saving reports success and the settings persist across a page reload.
38. **[needs feed]** the status card shows state, the watched stream label, and three
    progress bars that move.

## Deck post

39. `/deck` shows a Go live button, a current scene card, scene tiles, and a stream status
    row.
40. There is an install prompt for adding it to the home screen.
41. Tapping a scene tile with the switcher enabled both switches the scene and holds it, and
    the hold card offers a release.
42. The bottom bar has a Sensitivity tab, and that tab has sensitivity settings only. Confirm
    that scenes, chat notices and auto stop are not editable there.
43. Leaving the Sensitivity tab with unsaved changes asks before discarding.
44. With no container, the deck points the user back to the dashboard.

---

When you are done, give me three things:

1. The list of files you saved.
2. Anything you skipped, with the reason.
3. The path to `flow-check.md`, plus a short summary of anything marked WRONG.
