# StreamWizard documentation flow check

Environment: https://staging.streamwizard.org — account `jochemwhite`, staging, reset to first-run state.
Checked: 2026-08-01. Browser: Chrome (existing signed-in profile), driven via the Claude in Chrome extension.

**No live feed was available for the whole session** ("Live ingest status — No active stream right now."), so every
`[needs feed]` item is marked UNVERIFIED rather than guessed.

Legend: **OK** = works as described · **WRONG** = differs, actual behaviour given · **UNVERIFIED** = could not be checked.

---

## Onboarding post

**1. Five steps, in the stated order — OK**
The first-run stepper has exactly five steps, in this order and with this wording:
1. "Create an ingest key" 2. "Launch your cloud container" 3. "OBS boots up inside it"
4. "Add alert sources (optional)" 5. "Open OBS". Card heading: "Set up your IRL stream".

**2. Steps stay locked until the one before is done — OK**
Verified in the DOM, not just visually: while step 1 was incomplete the "Launch Cloud OBS" button carried a real
`disabled` attribute. Steps tick off with a strikethrough heading plus a completion line ("Done. Key created.",
"Done. Container running.", "Done. OBS connected.", "Done.").

**3. Step 1 creates the key, no need to visit the Ingest keys page first — OK**
Typed `phone` into "Label (e.g. Belabox, phone, backup)", clicked "Create key". Key created in place; toast:
"Ingest key created — We'll wire it into your IRL scene once OBS connects."

**4. Badge order Starting up → OBS booting → OBS Connected — OK**
Exact strings, sampled every 200 ms: `Offline` → `Starting up…` → `OBS booting…` → `OBS Connected`.

**5. Booting takes 10 to 30 seconds — OK (real number below)**
Measured from a 200 ms poll of the badge:
- `Starting up…` at t+0.0 s
- `OBS booting…` at t+3.4 s
- `OBS Connected` at t+10.2 s

**Real number: 10.2 seconds** from launch to "OBS Connected" — the very fast end of the published 10–30 s range.
A later cold start (after a stop) reached "OBS Connected" within ~20 s, so 10–30 s holds, but if you want a single
number to quote, "usually 10–20 seconds" matches what this environment actually did.

**6. Finishing step 5 ends the guided flow and shows the normal dashboard — OK**
After "Open OBS" the stepper is gone and the normal dashboard renders (Scenes row, Live ingest status, incoming
signal panel, tab strip).

**7. Step 4 can be skipped — OK**
Step 4 offers both "Skip" and "Done adding alerts". (I used "Done adding alerts" after adding a test alert source
for check 27; the "Skip" button is present and enabled.)

---

## Ingest server post

**8. SRT on 8888 and SRTLA on 5000, both carrying the key in streamid — OK, with a wording caveat**
- SRT row is a real URL: `srt://ingest-01.streamwizard.org:8888?streamid=<key>`
- SRTLA row is **not** a URL. It is a field reading: `host ingest-01.streamwizard.org · port 5000 · streamid <key>`

So "an SRTLA line on port 5000" is accurate, but if the docs show it as a `srtla://…` URL that is wrong — it is a
host/port/streamid triple. Helper text under the two rows:
> "SRT and SRTLA carry the key in the `streamid` field. Using bonded connections (Belabox, IRLToolkit, Moblin)? Point them at the SRTLA host above."

**9. Key list shows label, truncated key, and a last-used time — OK, with a wording caveat**
The row shows the label ("phone"), a truncated key, and a last-used field. For a key that has never been used the
field reads **"Never used"**, not a time. If the docs promise "a last-used time", note the never-used wording.

**10. Buttons to copy, rotate, delete and send to Discord — OK**
Four icon buttons per key row, in this order: copy, Discord, rotate, delete.
Minor accessibility note: only the Discord button exposes a name (`title="Send to Discord"`). Copy, rotate and
delete have no accessible name or tooltip, so they are icon-only guesses for screen-reader and keyboard users.

**11. Rotating replaces the key immediately — OK**
The truncated key changed immediately on click. The UI tells the user, verbatim:
> "Key rotated. The old one stops working now — update your encoder."

**12. Multiple keys can exist at once — WRONG (no way to do it in the UI)**
There is **no "Add key" / "Create key" control anywhere on the Ingest keys page** — the card ends after the single
key row. The only key-creation UI in the product is onboarding step 1, and that stepper disappears permanently once
setup is finished. So after onboarding a user cannot create a second key at all.

The page copy assumes plural keys — heading "Your keys", and "Rotate a key if it leaks. Delete one you're done
with." — which makes the missing control look like a gap rather than an intentional single-key design.
Whether the backend supports multiple keys is UNVERIFIED; only the UI path is missing.

**13. An IRL scene holding a StreamWizard Ingest source, created automatically — OK**
Confirmed inside OBS itself. Scene `IRL` contains `StreamWizard Ingest` (Media) and `Ingest - OBS output` (Media).
Neither required any user action.

**14. The incoming signal panel has an Add source button per key — WRONG as worded**
The panel exists, headed "Your incoming signal. Drop it into any scene as a media source.", and it does have an
"Add source" button. But the single row is labelled **"OBS output"**, not by the key label ("phone"). The dialog it
opens is titled `Add "OBS output" to a scene`, with the source name prefilled as `Ingest - OBS output`.

With one key and no live feed, no per-key row ever appeared, so "per key" is not what is rendered here. Whether
extra rows appear per key once a feed is arriving is UNVERIFIED (needs a live feed).

---

## Container post

**15. One button that starts or stops, label changes with state — OK**
Same row, same position. Running: subtitle "Your OBS container is running", button "Stop container" (red).
Stopped: subtitle "Container is stopped", button "Start container".

**16. Stopping ends OBS; scenes, sources and files survive a restart — OK**
Verified by a full stop → start cycle. After the restart:
- All six scenes present: Welcome (Delete me), Starting Soon, IRL, Connection Lost, Ending, BRB (plus `_alerts`).
- All sources present: `StreamWizard Ingest`, `Ingest - OBS output`, `Docs Alert clone`, `Docs Alert clone 2`.
- The uploaded file survived: `docs-test-image.png`, storage bar still "4.9 KB / 500.0 MB".

**17. Starting from one device updates another device's open page without a refresh — OK**
Deck open in a second tab, dashboard in the first. Started the container from the dashboard. The deck page, which
was **never reloaded** (verified: my in-page marker survived and `performance.getEntriesByType('navigation').length`
stayed at 1), changed on its own to:
> "Cloud OBS is back — Reconnecting your controls." then "Connecting…"

**18. With Twitch connected, OBS does not show an "Enter Stream Key" screen after boot — OK**
OBS booted straight into its normal UI. The Controls dock shows Start Streaming / Start Recording / Studio Mode /
Settings, with no stream-key prompt at any point.

**19. Crash banner and "Not responding" state — UNVERIFIED**
Not tested; forcing a crash was explicitly out of scope.

---

## Tabs

**20. Tab strip is exactly Sources, Performance, Files, Auto Switcher — OK**
Exactly those four, in that order.
Worth documenting: while the container is stopped **the entire tab strip is removed**, replaced by an "OBS is
offline" card ("Start your container and your scenes, sources, and controls show up right here." + "Start it up").

**21. Sources tree with CPU/GPU percentages and a toggle that takes effect live in OBS — OK (toggle verified)**
The tree shows scenes with their sources nested, a type label (Media / Browser / Source Clone), CPU and GPU columns,
a "Total %" selector, an All / Sources / Filters switcher and a "Filter sources…" search.

Toggle verified end to end: switching `StreamWizard Ingest` off in the dashboard, then opening the OBS viewer,
showed that source in OBS greyed out with a **crossed-out eye**, while `Ingest - OBS output` kept a normal eye.
Toggling it back restored it. So the toggle really does drive OBS.

Caveat for the docs: **a fresh container has no filters at all** — the "Filters" view of the tree is empty. If the
docs show a filter in the tree, that screenshot cannot be reproduced on a new instance without adding one by hand.

**22. Performance cards, skipped/dropped counts, and four graphs — OK**
Cards: CPU Usage (0.7%, "OBS process"), Memory (0.5 GB, "OBS process"), FPS (30.0, "0 skipped"),
Frame Time (3.0 ms, "0 dropped"). So skipped and dropped are present, as sub-labels of the FPS and Frame Time cards
rather than as separate cards. Four graphs: CPU %, Memory (MB), FPS, Frame Time (ms) — all build history over time
(confirmed over ~90 s).

**23. Files tab: drag and drop, storage bar, rename and delete per file, 500MB quota — PARTLY WRONG**
- Drag and drop upload: **OK** (dropped a PNG onto the zone, it uploaded).
- Storage bar: **OK**, and the **quota really does read 500MB** — "0 B / 500.0 MB" empty, "4.9 KB / 500.0 MB" after upload.
- Delete per file: present (trash icon).
- **Rename per file: WRONG — the rename control does nothing.** The pencil icon on the file row produces no dialog,
  no inline editor and no console error. Tried a coordinate click, a click by element reference, and a double-click
  on the filename itself. The file row stays inert.

Drop zone copy: "Drop files here or click to browse" / "Uploads go to your OBS media folder" / "No files yet."

**24. Renaming a file that a scene uses — warning text — UNVERIFIED**
Cannot be checked: rename never opens any UI at all (see 23), so no warning can be triggered or quoted. This item
should stay unpublished until rename works.

---

## Browser sources post

**25. An `_alerts` scene exists in a fresh container — OK**
Present in OBS from first boot. The fresh container also ships `_incoming-sources` and a `---------------`
separator scene, which the docs do not mention.

**26. `_alerts` does not appear in the scene buttons on the dashboard, or on the deck — OK**
Absent from both the dashboard Scenes row and the deck scene tiles.
Note: it **is** listed in the Add-source dialog's Scene dropdown (along with `_incoming-sources` and the
`---------------` separator), so the exclusion is specific to the scene buttons, not global.

**27. Ticking other scenes puts the original in `_alerts` and a clone in each ticked scene — OK, clones are real clones**
Added an alert source labelled "Docs Alert" with "Starting Soon" and "BRB" ticked. Result in the Sources tree:
- `_alerts` → **Docs Alert**, type **Browser** (the original)
- `Starting Soon` → **Docs Alert clone**, type **Source Clone**
- `BRB` → **Docs Alert clone 2**, type **Source Clone**

The type column reads "Source Clone", not "Browser", so these are genuine clones and not second browser sources.

Bug worth flagging: the add **appeared to fail**. The button sat on "Adding…" for ~25 seconds, the console threw
`Error: Request "GetSceneList" timed out`, and the form then silently reset to empty with **no success and no error
message**. The sources were in fact created correctly. A user would reasonably conclude it had failed and try again.

**28. A `Welcome (Delete me)` scene exists and is kept out of the scene pickers — WRONG (second half)**
The scene exists. It is **not** kept out of the pickers — it appears in:
- the dashboard Scenes button row
- the deck scene tiles
- the Add-source dialog "Scene" dropdown
- all three auto-switcher scene pickers (Live / Low bitrate / Connection lost)
- the "Hold a scene" scene picker

The only place it is excluded is the alert-source "Also show it in (optional)" chips, which list just
Starting Soon, IRL, Connection Lost, Ending, BRB.

---

## Auto switcher post

**29. A card with an enable toggle, settings only once it is on — OK, one nit**
With the switcher off the tab shows only the "Auto switcher" card + toggle, described as
"Watches your incoming IRL signal and switches scenes when it drops — then switches back once it's stable again."
Nit: the **"Save switcher settings" button is visible even while the switcher is off**, below the collapsed card.

**30. Scene pickers are disabled or empty when OBS is not connected — WRONG (different behaviour)**
They are not disabled or empty — they are **not reachable at all**. With the container stopped the whole tab strip
(including Auto Switcher) is removed and replaced by the "OBS is offline" card. There are no pickers on screen to
disable.

On the deck the Sensitivity tab does stay reachable while offline, and shows the strip:
> "No live status right now. Your settings still save."

**31. A 2-scene and a 3-scene option, and choosing 2 hides the low bitrate picker — OK**
- "2 scenes — Live + Connection lost. Simple: signal is either good enough or it isn't."
- "3 scenes — Live + Low bitrate + Connection lost. Rough-but-alive gets its own scene."
Selecting "2 scenes" removes the "Low bitrate scene" picker, leaving Live scene and Connection lost scene. Verified.

**32. Three presets named Relaxed, Balanced, Fast — OK, names match exactly**
Under the heading "How trigger-happy should it be?":
- Relaxed — "Waits ~6s of bad signal before switching, ~30s stable before switching back. Fewest false alarms."
- Balanced — "Switches after ~3s bad, back after ~20s stable. The right pick for most IRL setups." (default)
- Fast — "Switches after ~2s bad, back after ~10s stable. For when a single frozen frame is one too many."

**33. Advanced mode table and offline timeout — OK, exact match**
Columns: Metric | Limit | Trigger (s bad) | Recover (s good) | Startup (s good).
Rows: Bitrate (min kbps) = 1000 · Ping (RTT) (max ms) = 300 · Packet loss (max %) = 5.
Trigger 3 / Recover 20 / Startup 5 on all three rows. Plus the field
"Offline after (seconds of silence)" = 5. Explanatory line:
> "One sample arrives per second. Trigger/recover/startup are how many seconds in a row a value must be bad (or good) before the switcher acts."

**34. The extras list — OK, all five present**
- "Log switches to your stream events" — "Every switch shows up in your activity feed and VOD timeline, with the reason it happened." (on by default)
- "Post in Twitch chat when it switches" — reveals three template boxes when enabled
- "Show a warning source before switching" — "Flashes a source in your live scene (like an 'unstable connection' banner) when quality dips, before a full switch."
- "Stop the stream after a long outage" — reveals a **"Minutes offline"** field, default **10**
- "Only watch one camera (optional)" — text field, placeholder "Stream key label, e.g. Camera 1", helper "Leave empty to always watch your most recent stream."

**35. Chat notice templates mention {bitrate}, {rtt}, {loss}, {scene} — PARTLY WRONG**
The **helper line** lists all four:
> "The StreamWizard bot tells chat what's going on. {bitrate}, {rtt}, {loss} and {scene} get filled in."

But the **three default templates only use two of them**:
- Quality dropped: `Connection unstable — switching to backup scene ({bitrate} kbps, {rtt} ms RTT)`
- Signal lost: `Stream signal lost — hang tight!`
- Back live: `Signal restored — back live!`

No default template contains `{loss}` or `{scene}`. If the docs say "the templates mention" all four, reword to
"all four placeholders are supported; the defaults use {bitrate} and {rtt}".

**36. Hold durations 15 minutes, 1 hour, until released — OK, exact**
Dropdown offers exactly: "15 minutes", "1 hour", "Until I release it".

**37. Saving reports success and settings persist across a reload — PARTLY WRONG**
- Persistence: **OK**. After "Save switcher settings" and a full page reload, the switcher was still enabled with
  3 scenes / IRL / BRB / Connection Lost and the chat templates intact. Settings also survived a container restart.
- Reporting success: **not observed.** No toast, banner or inline confirmation appeared after clicking
  "Save switcher settings" (other actions in this app do toast — key created, key rotated, hold released — so the
  absence stands out).

Undocumented but useful: the **"Hold a scene" card and the switcher status card only appear after the config has
been saved once.** Before the first save the Auto Switcher tab has no hold controls at all. Worth adding to the docs,
since a reader following along will not see the hold card where the post implies it is.

**38. Status card with state, watched stream label, and three moving progress bars — UNVERIFIED (needs a live feed)**
The status card exists but with no feed it only reads:
> "Waiting for engine status — start a stream to your ingest and this comes alive."

The state badge, the "watching <label>" line and the three metric bars cannot be confirmed without a feed.

---

## Deck post

**39. Go live button, current scene card, scene tiles, stream status row — OK**
All four present: a large "Go live" button, a "CURRENT SCENE" card (scene name + "Updated hh:mm:ss"), a grid of
scene tiles, and a bottom "Stream — Offline" row. Header is "Stream Deck" with an "OBS Connected" badge.

**40. There is an install prompt for adding it to the home screen — UNVERIFIED**
No install prompt rendered at any point. The page does ship a web manifest and was not running in standalone mode,
but no install UI appeared in the DOM (searched for install / "home screen" / "Add to" — no matches). Most likely
it is gated on the browser's `beforeinstallprompt`, which desktop Chrome did not fire for this profile. Needs a
check on an actual phone before the claim is published.

**41. Tapping a scene tile switches the scene and holds it, with a release — OK**
Tapped the "IRL" tile. The current scene card changed to IRL and a hold card appeared:
> "Holding IRL — Auto switching is paused." with a "Resume auto switching" button.

**42. The Sensitivity tab has sensitivity settings only — OK**
The tab contains a status strip, an "Advanced mode" toggle and the three preset cards. Scenes, chat notices and
auto stop are **not** editable there. The page says so itself:
> "How quickly the auto switcher reacts when your IRL signal gets rough. Scenes and everything else stay on the dashboard."

**43. Leaving with unsaved changes asks before discarding — OK**
Changed the preset, then tapped the Deck tab. A modal appeared, verbatim:
> **"Drop your changes?"**
> "You changed some switcher settings but never saved them. Leaving now throws them away."
> Buttons: "Discard" / "Keep editing"

A footer bar also appears while dirty: "Unsaved changes." with "Discard" and "Save".

**44. With no container, the deck points the user back to the dashboard — WRONG**
It does not point back to the dashboard. It offers to start the container from the deck itself:
> "OBS is offline — Start your container and your scenes, sources, and controls show up right here."
> with a **"Start it up"** button.

No mention of, or link to, the dashboard.

---

## Extra observations (not in the checklist)

**Dashboard "Release" on a hold may not have taken.** After holding BRB from the dashboard and clicking "Release",
the dashboard card returned to its idle picker state — but the deck, on a **fresh load**, still reported
"Holding BRB — Auto switching is paused." Releasing from the deck ("Resume auto switching") worked and both
surfaces then agreed. I cannot fully rule out that my click landed next to the Release button rather than on it, so
treat this as "worth a second look" rather than a confirmed defect.

**Icon-only buttons without accessible names.** The copy / rotate / delete buttons on the ingest key row, and the
rename / delete buttons on file rows, expose no `aria-label` or `title` (only "Send to Discord" does).

**`GetSceneList` timeouts.** Logged twice during the session, once while adding the alert source. Both times the
underlying operation had actually succeeded.
