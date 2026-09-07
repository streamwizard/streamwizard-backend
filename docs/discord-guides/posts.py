TAGS = {
    "start": "1532970581157351594",
    "onboarding": "1532970581194965113",
    "sources": "1532970581194965114",
    "performance": "1532970581194965115",
    "tabs": "1532970581194965116",
    "switcher": "1532970581194965117",
    "container": "1532970581194965118",
    "deck": "1532970581194965119",
    "downloads": "1532970581194965120",
}

# key -> (thread title, tag, [messages]).
# One step per message, and at most one screenshot per message: Discord groups multiple
# attachments into a grid, which detaches them from the text that explains them.
POSTS = {}

POSTS["ingest"] = ("The ingest server: where your stream lands", "downloads", [
"""## The ingest server

Your phone does not talk to Twitch. It talks to our ingest server, and your cloud OBS picks the feed up from there.

The server does three things. It checks your ingest key when your encoder connects, so only your streams get through. It measures your connection once a second: how much video is arriving, the round trip time, and how many packets went missing. Then it hands the feed to your OBS over our own network, so nothing has to travel back out over the public internet.

Those measurements are also what the auto switcher runs on. That is why a bad connection can change your scene before you have even noticed it yourself.""",

"""## Where to point your encoder

Your address and key are on the Ingest keys page in the dashboard. Copy them from there.

```
SRT     srt://<your ingest host>:8888?streamid=<your ingest key>
SRTLA   host <your ingest host>, port 5000, streamid <your ingest key>
```

Streaming from one connection, like a phone on 5G, use SRT on port 8888. Bonding two or more connections with Belabox, IRLToolkit or Moblin, use SRTLA on port 5000. Both carry your key in the `streamid` field.

RTMP works too, but it only reports throughput. No ping, no packet loss, so the auto switcher has less to go on.

[screenshot: onboarding-08-ingest-keys-page.png]""",

"""## Your key

You make one during setup and label it so you know what it is later. That key is a password. Anyone who has it can stream to your channel as you.

Rotate it if you have shared your screen with it visible, if you pasted it somewhere public, or if you handed your phone to someone for a setup and never got round to changing it. Rotating gives you a new key immediately and kills the old one, so update your encoder straight after, not the next morning. The page says as much when you do it: "Key rotated. The old one stops working now."

Delete it and the create form comes back, so you can make a fresh one from scratch.

The list shows when the key was last used, or "Never used" if it has not been yet.

The Send to Discord button DMs you the key and both URLs, spoilered, so you can copy them on your phone instead of typing forty characters by hand.""",

"""## Two different keys

Do not mix these up.

Your ingest key is ours. Your phone streams to us with it. We store it, because the ingest server has to check it on every connect. You can rotate it whenever you like.

Your Twitch stream key is Twitch's. OBS uses it to send your broadcast to Twitch. We never store that one, and you never enter it here. More on that in step 7.""",

"""## Getting the feed into a scene

Your key gets wired into a scene called `IRL` as a source named `StreamWizard Ingest`, automatically, as soon as OBS connects. Nothing to click.

If you want that feed in another scene as well, the incoming signal panel on the Cloud OBS page has an Add source button. The row there is your OBS output feed, labelled `OBS output`, and the dialog prefills a source name for you.

[screenshot: sources-01-add-source-dialog.png]""",
])

POSTS["onboarding"] = ("Setting it up the first time", "onboarding", [
"""## Setting it up the first time

The first time you open Cloud OBS you get a guided setup with five steps. It walks itself. This post is about what each step is doing, so nothing feels like magic.

[screenshot: onboarding-01-stepper-empty.png]""",

"""## 1. Create an ingest key

The key gets made here, so you do not need to visit the Ingest keys page first. Give it a label you will recognise ("phone", "belabox") and hit Create key.

Your SRT and SRTLA addresses appear on the Ingest keys page afterwards, and everything else about keys is in step 2 of these guides.

[screenshot: onboarding-02-key-created.png]""",

"""## 2. Launch your cloud container

One click. We find a node with room on it and start your OBS.

[screenshot: onboarding-03-launching.png]""",

"""## 3. OBS boots inside it

Nothing to click. Usually 10 to 30 seconds. The badge at the top goes from "Starting up" to "OBS booting" to "OBS Connected". That last one means the dashboard is talking to your OBS.

[screenshot: onboarding-04-obs-connected.png]""",

"""## 4. Add alert sources

Skip this one. The step offers to add your alert widgets now, and you can, but step 3 of these guides covers alerts properly: where they live, how to get one widget into several scenes, and the mistake that makes every alert play twice. Hit Skip and deal with it there.""",

"""## 5. Open OBS

Opens a live view of your cloud OBS in its own window.

[screenshot: onboarding-06-open-obs.png]""",

"""Same OBS you already know, running somewhere else. Check your camera, arrange your scenes, then go live.

[screenshot: onboarding-07-obs-viewer.png]""",

"""## If the stepper stalls on OBS booting

"OBS isn't responding" means your container is up but OBS inside it never answered. Hit Retry connection. If it still refuses, stop the container and start it again.

## After setup

Finish the last step and the guided flow disappears for good. You get the normal dashboard: scene buttons, your incoming signal, and four tabs. It only comes back if you end up with no key or no container again.""",
])

POSTS["tab-sources"] = ("The Sources tab", "tabs", [
"""## The Sources tab

Your container has a fixed slice of CPU. This tab tells you where it is going.

You get a tree: your scenes, the sources inside them, and the filters on those sources. Every row shows what it costs, with a colour to save you reading numbers. Green under 5%, amber between 5% and 15%, red above that. A red row is your problem.

[screenshot: sources-03-sources-tab.png]""",

"""Every row also has a switch. Flip it and the source or filter turns off in OBS immediately, while you are live. That is the quickest way to prove where the load is: turn something off, watch the Performance tab, turn it back on.

The usual suspects, in the order I find them: browser sources somebody added months ago and forgot, filters stacked on a camera, and video files still playing in a scene nobody is watching.

[screenshot: sources-04-source-toggle.png]""",

"""At the top you can search, sort by CPU or GPU, or narrow the tree to sources only or filters only. On a setup with twenty sources that beats scrolling.

A fresh container has no filters at all, so the Filters view starts out empty. That is normal, not a bug.""",
])

POSTS["tab-performance"] = ("The Performance tab", "tabs", [
"""## The Performance tab

Four numbers, four graphs, live from your container.

CPU usage is what OBS itself is burning. Memory is how much RAM it holds. FPS is your real output frame rate, and it should sit on your target and stay there. Frame time is how many milliseconds one frame takes to render, so lower is better. If it climbs toward your frame budget, 33ms at 30fps or 16ms at 60fps, OBS is running out of room.

Under FPS and frame time you also get skipped and dropped frames. Skipped means rendering could not keep up. Dropped means the upload to Twitch could not.

[screenshot: performance-01-stat-cards.png]""",

"""The graphs hold the last few minutes, so you can switch a scene or enable a source and watch what it costs instead of guessing.

[screenshot: performance-02-graphs.png]""",

"""When something looks wrong:

CPU high and frame time climbing means your scenes are too heavy. Go to the Sources tab and find the red row.

FPS under target with skipped frames is the same problem wearing a different hat.

Dropped frames while CPU and frame time look calm is the upload to Twitch, not your container.

Memory creeping up over a long stream is usually a browser source. Toggle it off and on.

Nothing here at all means OBS is not connected, so start your container first.""",
])

POSTS["tab-files"] = ("The Files tab", "tabs", [
"""## The Files tab

Your container has its own storage. Anything a scene needs, a BRB video, a logo, a sound effect, goes here first. Then you point an OBS source at it.

Drag files onto the drop zone or click it and pick them. Your quota is 500MB.

[screenshot: tabs-02-files-empty.png]""",

"""You get a progress bar per file, and the bar at the top tracks how much of the quota you have used.

[screenshot: tabs-03-files-uploaded.png]""",

"""Rename and delete live on the file row.

One warning worth taking seriously: if a scene already uses a file and you rename it, the source keeps pointing at the old name and goes black. Rename before you wire it up, or fix the source afterwards.

Uploads need the container running, because the files live inside it. Your files survive a stop and a restart. Nothing gets wiped between streams.""",
])

POSTS["browser-sources"] = ("Browser sources: alerts and widgets", "sources", [
"""## Browser sources: alerts and widgets

You skipped this during setup, so here it is properly. Same panel, from the Cloud OBS page.

Every container ships with a scene called `_alerts`. You do not switch to it. Think of it as a shelf: your alert widgets live there once, and get mirrored into the scenes that need them.

Give it a label, paste the widget URL from StreamElements, Streamlabs, SoundAlerts or whatever you use, tick the scenes that should show it, and add it.

[screenshot: onboarding-05-alert-sources-step.png]""",

"""## Why mirroring instead of copying

Adding the same browser source to five scenes runs five browsers inside your container, and your container is not a gaming PC. We add a clone instead. One browser, mirrored into every scene you picked, so five scenes cost what one costs.

## The double audio trap

Alerts added here play through OBS. If your phone app already plays your alerts locally, viewers hear each one twice, about half a second apart. Pick one place. If your phone does it, leave the IRL scene unticked here.

## Or skip the third party

StreamWizard has its own alerts in the Overlay Editor. Same job, one less account to manage.""",
])

POSTS["tab-switcher"] = ("The Auto Switcher tab", "switcher", [
"""## The Auto Switcher tab

You are walking, you go under a bridge, your bitrate falls off a cliff. Chat stares at a frozen frame for forty seconds. This is the tab that stops that.

It watches your incoming signal and switches your OBS scene when the connection goes bad, then switches back once it is properly stable again.""",

"""## What it watches

The ingest server measures your connection once a second and hands the switcher three numbers: bitrate in kbps, ping in milliseconds, and packet loss as a percentage. Each has a limit, and each second is scored good or bad against it.

On plain RTMP only bitrate arrives, so only bitrate is judged.""",

"""## How it decides

It never reacts to one bad second. Everything runs on streaks.

If any one of the three has been bad for its trigger count in a row, it switches away from your live scene. To come back, all three have to be good for their recover count in a row. Recovery is deliberately slower than falling back, because a stream that flaps between scenes every ten seconds is worse than one that waits.

New streams get checked before they go live. If your connection is bad from the very first second, it opens on your fallback scene instead of showing chat a mess.

And if the signal stops arriving entirely, past the offline timeout, that counts as gone rather than bad.""",

"""## The scenes it uses

Two or three, your choice.

Your live scene is the normal one with your feed in it. Your connection lost scene is your BRB screen. On a three scene setup you also get a low bitrate scene for rough but alive, maybe a smaller camera or a banner. On a two scene setup, rough and gone both land on the connection lost scene.

If you are unsure, start with two.

[screenshot: switcher-02-scene-model.png]""",

"""## Setting it up

Start your container first. While it is stopped the whole tab strip is replaced by an offline card, so there is no Auto Switcher tab to open. The scene pickers also read the real scene list out of your OBS, so they need it connected.

Turn the switch on, pick two or three scenes, then point it at the scenes themselves. Rename a scene in OBS later and the switcher follows it, because it tracks scenes by their internal id and not by name. Delete one and the picker tells you it is gone so you can pick again.

[screenshot: switcher-03-scene-pickers.png]""",

"""## How trigger-happy it should be

Three presets. Balanced is the default and right for most people.

[screenshot: switcher-04-presets.png]""",

"""The numbers behind them:

```
              Relaxed    Balanced    Fast
Bitrate min   800 kbps   1000 kbps   1200 kbps
Ping max      400 ms     300 ms      250 ms
Loss max      8%         5%          3%
Switch after  6s bad     3s bad      2s bad
Back after    30s good   20s good    10s good
Offline after 8s quiet   5s quiet    3s quiet
```

Relaxed rides out short dips, which is what you want on mobile in a city. Fast reacts almost immediately, which suits a stable connection where a drop actually means something broke.

Hit Save switcher settings. The engine picks up the change within a second, mid stream, no restart.""",

"""## Advanced thresholds

If none of the presets fit, turn on Advanced mode and you get the raw table. It starts from whichever preset you had, so flipping the switch changes nothing by itself.

One sample arrives per second, so every count in the table is really "this many seconds in a row".

[screenshot: switcher-05-advanced-matrix.png]""",

"""Limit is what counts as bad. Bitrate is a floor, ping and loss are ceilings. Trigger is how long a metric must be bad before the switcher leaves your live scene. Recover is how long every metric must be good before it comes back. Startup is the check a new stream has to pass before it is allowed on your live scene at all. Under the table, offline after is how many seconds of complete silence count as gone.

Change one row at a time. Change all three and you learn nothing. If it switches too often, raise the trigger seconds before you loosen the limits. If it comes back too eagerly and drops again, raise recover. And keep your bitrate floor well under what you normally stream at, or every small dip becomes a scene change.""",

"""## The extras

Four options under the settings, all optional. Logging is the only one on by default.

Logging puts every switch in your activity feed and VOD timeline with the reason it happened. Useful the morning after when you want to know whether it was you or the connection.

Chat notices let the StreamWizard bot tell chat what is going on so you do not have to. You write the three messages: quality dropped, signal lost, back live. Four placeholders work in any of them: `{bitrate}` in kbps, `{rtt}` in ms, `{loss}` as a percentage, and `{scene}` for where it switched to. The messages you start with only use `{bitrate}` and `{rtt}`, so add the others if you want them. Chat gets told once per switch, not once per second.

A warning source is a source in your live scene, an "unstable connection" banner for example, that appears after two bad seconds and disappears after five good ones without any scene switch. The polite warning before the real fallback.

Auto stop ends your OBS stream output after a set number of minutes offline, anywhere from 1 to 120. Nobody needs three hours of BRB loop. It leaves your container and your scenes alone.

There is also a field to pin one stream key label, so the switcher judges that stream only and ignores anything else arriving.

[screenshot: switcher-06-extras.png]""",

"""## When it does not behave

Nothing switching? Work down this list. Is the switch on and did you actually save. Are your scenes picked, because without a live scene and a connection lost scene it has nothing to switch to. Does the badge say OBS Connected. Is a stream arriving, or does the status card say "Waiting for stream". And are you holding a scene from the deck, because "Held by you" means it is standing down on purpose.

Switching too often, go to Relaxed or raise your trigger seconds. Taking too long to come back, lower recover and accept the odd bounce.

"This scene no longer exists" means you deleted it in OBS. Pick a new one and save. Renames sort themselves out.

A red Problem line on the status card is the last error from the engine, usually a scene switch that could not reach your OBS. It retries by itself every few seconds. If it sticks, restart the container.

The status card shows the state, which stream it is watching, and three progress bars. While you are live the bars fill toward a switch. While recovering they fill toward going back. You can put the same status on stream as an overlay widget from the Overlay Editor.""",
])

POSTS["container"] = ("Starting and stopping your container", "container", [
"""## Starting and stopping your container

After setup, the Container row on the Cloud OBS page is where you start and stop.

Starting takes 10 to 30 seconds: the container comes up, OBS boots inside it, the badge goes green. Stopping shuts OBS down, and if you were live, your stream ends. Stop when you are done for the day, not between scenes.

[screenshot: container-01-running.png]""",

"""Everything you set up survives a stop. Scenes, sources, filters, uploaded files, switcher settings. Start it tomorrow and it is how you left it.

Start it from wherever you are. Do it on your laptop and the page open on your phone updates on its own, and the other way around.

[screenshot: container-02-stopped.png]""",

"""## Your Twitch stream key is never stored

Your Twitch stream key is the one credential that really matters. Anyone holding it can broadcast to your channel. So we made a deliberate choice: we do not keep it.

When your container starts, we ask Twitch for your key using the connection you already authorised, put it straight into OBS inside your container, and that is it. When the container stops, the key goes with it. There is no row in our database holding it, so there is nothing to leak in a database dump. Every launch fetches it fresh.

A few things follow from that. Reset your key on Twitch and there is nothing to update here, the next start picks up the new one. The key only ever goes to the machine running your container, and a node cannot ask for a key belonging to someone it is not hosting. And if you have not connected Twitch, OBS boots showing the "Enter Stream Key" screen, so connect it in settings and restart.""",

"""## When it goes wrong

A red "crashed" banner means the container stopped on its own and your stream dropped. The banner stays until you deal with it, so a phone in your pocket does not swallow the news. Hit Restart.

"Not responding" means the container is up but OBS is not answering. Try Retry connection first, then stop and start it.

"Cloud OBS removed" means the container is gone. Launch a new one from the dashboard.

"Lost the connection to OBS" on your phone is usually the phone, not the container. It reconnects on its own when the screen wakes or the network comes back.""",
])

POSTS["deck"] = ("The deck: your phone as a remote", "deck", [
"""## The deck

The dashboard is built for a desk. The deck is built for one thumb while you are walking. Open **/deck** on your phone.

Go live and End stream sit at the top as one big button. Under it, the scene you are on and when it last changed, then your scenes as big tiles, two per row, one tap to switch. Stream status at the bottom.

[screenshot: deck-01-main.png]""",

"""Install it when the prompt offers. You get an icon on your home screen, no browser bars, straight into the tiles.""",

"""## Holding a scene

Sometimes you want the switcher out of the way. Sit-down segment on solid WiFi, or you deliberately want the BRB screen up while you sort something out. This is where you do it, because it is a thing you need while you are out, not at a desk.

Tapping a scene tile while the auto switcher is on does two things: it switches the scene, and it holds it, so the switcher does not take it back two seconds later. The hold card shows what you are holding and lets you release it.

Release it and you do not get slammed back onto your live scene. The switcher re-runs its full recovery check first, so you only go live again once the connection has proven itself. If your feed is dead at that moment, you land on your connection lost scene instead.

[screenshot: deck-03-hold-card.png]""",

"""The Sensitivity tab in the bottom bar has the sensitivity settings only: the presets, and the thresholds if you run advanced. Scenes, chat notices and auto stop stay on the dashboard, because those are not decisions to make one-handed on a street corner. Changes need a save, and leaving the tab with unsaved edits asks first.

[screenshot: deck-04-sensitivity-tab.png]""",

"""If the container is off, the deck offers to start it and shows the boot progress.

[screenshot: deck-05-offline.png]""",

"""Phones drop connections. Lock the screen, change networks, walk into a dead spot, and the socket goes. The deck reconnects on its own when you wake it. If the container really did stop or crash while your phone was asleep, it says so instead of spinning forever.

Never set up a container? The deck sends you to the dashboard. Setup is a desk job, and you only do it once.""",
])
