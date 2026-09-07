# Claude Chrome prompt: walking stats overlay screenshots

Paste everything below into Claude Chrome on the Windows box.

---

You are capturing documentation screenshots for StreamWizard's docs site.

**Environment**

- Site: `https://staging.streamwizard.org` (staging, not production)
- Account: already signed in as **jochemwhite**. If not, sign in with Twitch.
- Save every capture as PNG into `C:\streamwizard-docs\mintlify\` with the
  exact filenames below.
- **Dark theme**, 1440x900 viewport, window maximized. Match the existing
  `monitor-*.png` shots in that folder.
- Full-viewport shots where it says so, otherwise crop to the panel or dialog
  named.
- Collapse the left sidebar before the editor shots. At 1440px the editor
  overflows and the right-hand fields panel gets cut off.

**What we're documenting**

The **Walking stats** overlay: a GPS module bar (speed, distance, location,
weather) that reads the phone's GPS. The streamer creates it, then opens its
URL in IRL Pro as a web overlay, so it renders on the phone and goes out on
stream.

**Redaction rules**

- Do not capture any Twitch stream key, ingest key, or the account email.
- Do not open the top-right account menu.
- The widget shows real location data when GPS is available. On a desktop
  browser this normally reads as unavailable, which is fine. If a real city
  name or coordinates appear anywhere, tell me rather than trying to hide it.

**Steps**

1. Go to **Dashboard → Overlay Editor** (`/dashboard/overlays`).
2. Click **New Overlay**. In the dialog:
   - Name: `Walking stats`
   - Type: select **GPS** (not OBS). The template list changes when you do.
   - Under **Start from**, select the **Walking stats** template.
   - **Capture (crop to the dialog): `walking-01-new-overlay-dialog.png`**
3. Create it. The dialog becomes **Your overlay is ready**. For a GPS overlay
   the instructions differ from the OBS ones, which is the point of this shot.
   - **Capture (crop to the dialog): `walking-02-overlay-ready.png`**
   - Copy the URL and **paste the full URL back in chat** when you report.
4. Click **Open editor** and wait for the canvas to render the bar.
   - **Capture (full viewport): `walking-03-editor-canvas.png`**
5. Click the bar on the canvas to select the widget. In the right-hand fields
   panel, turn **Preview demo motion (turn off when live)** ON so the modules
   show moving values instead of dashes. Wait for values to appear.
   - **Capture (full viewport): `walking-04-editor-demo-motion.png`**
6. Stay on the fields panel, scrolled to the top so the general settings are
   visible (unit system, bar width, height, opacity, font, module alignment).
   - **Capture (crop to the right-hand panel): `walking-05-widget-fields.png`**
7. Scroll the fields panel down to the collapsible module groups (**Speed**,
   **Distance**, **Location**, **Weather**). Expand **Speed** so one group's
   settings are visible while the others stay collapsed.
   - **Capture (crop to the right-hand panel): `walking-06-module-groups.png`**
8. Turn **Preview demo motion** back OFF, save the overlay (Ctrl+S), and go
   back to `/dashboard/overlays`. Make sure the new overlay is **active**.
   - **Capture (crop to the overlay card): `walking-07-overlay-card.png`**

**When you're done, report**

- Which files you saved, and any you couldn't.
- The full overlay URL.
- Whether demo motion is left OFF and the overlay is left active and saved.
- Anything you changed beyond these steps, and anything on screen that looked
  like real location data.
- Leave both overlays (`Walking stats` and `Auto switcher monitor`) in place.
