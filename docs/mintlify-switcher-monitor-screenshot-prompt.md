# Claude Chrome prompt: auto switcher monitor overlay screenshots

Paste everything below into Claude Chrome on the Windows box.

---

You are capturing documentation screenshots for StreamWizard's docs site.

**Environment**

- Site: `https://staging.streamwizard.org` (staging, not production)
- Account: already signed in as **jochemwhite**. If not, sign in with Twitch.
- Save every capture as PNG into `C:\streamwizard-docs\mintlify\` using the
  exact filenames below.
- Browser window: **1440x900** viewport, light theme is fine as long as it's
  consistent across all shots. Maximize the window first.
- Crop to the relevant panel or dialog where it says so; otherwise a full
  viewport shot is fine.

**What we're documenting**

A streamer creates an overlay from the **Auto switcher monitor** template, then
adds its URL to the IRL Pro Android app as a *preview only* web overlay, so the
switcher's status is visible on the phone screen while filming but never goes
out on stream.

**Redaction rules (important)**

- The overlay's browser source URL contains a slug. Capture it visible in
  `monitor-02`, since we will blur it afterwards, but **do not** capture any
  Twitch stream key, ingest key, or the account email anywhere.
- If a page shows the account email in the top-right menu, don't open that menu.

**Steps**

1. Go to **Dashboard → Overlay Editor** (`/dashboard/overlays`).
2. Click **New Overlay**. In the dialog:
   - Name: `Auto switcher monitor`
   - Type: leave on **OBS**
   - Under **Start from**, select the **Auto switcher monitor** template.
   - **Capture (crop to the dialog): `monitor-01-new-overlay-dialog.png`**
3. Create it. The dialog turns into **Your overlay is ready** with the browser
   source URL and the OBS steps.
   - **Capture (crop to the dialog): `monitor-02-overlay-ready.png`**
   - Copy the URL with the copy button, and **paste the full URL back in chat**
     when you report results. We need it to configure the phone.
4. Click **Open editor**. Wait for the canvas to render the widget.
   - **Capture (full viewport): `monitor-03-editor-canvas.png`**
5. In the editor toolbar, open **Demo** (the demo events panel) and run the
   **Auto switcher degrade + recover** scenario. Wait until the widget is
   showing metric bars and a countdown line, then capture mid-scenario.
   - **Capture (full viewport): `monitor-04-editor-demo-degraded.png`**
   - If the scenario finishes before you can capture, run it again.
6. Click the widget on the canvas so the right-hand fields panel shows its
   settings (text size, "When everything is fine", poll bars, countdowns).
   - **Capture (crop to the right-hand panel): `monitor-05-widget-fields.png`**
7. Go back to `/dashboard/overlays`. Turn the new overlay's **active** switch on.
   - **Capture (crop to the overlay card): `monitor-06-overlay-card-active.png`**

**When you're done, report**

- Which files you saved, and any you couldn't.
- The full browser source URL of the new overlay.
- Whether the overlay is left **active**, and anything you changed besides the
  steps above.
- Leave the overlay in place; do not delete it.
