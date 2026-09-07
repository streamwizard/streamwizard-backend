import json, os, subprocess, time

TOKEN = os.environ["DISCORD_BOT_TOKEN"]
FORUM = "1532562101741293569"
API = "https://discord.com/api/v10"
HERE = os.path.dirname(os.path.abspath(__file__))
ids = {k: v["id"] for k, v in json.load(open(os.path.join(HERE, "created.json"))).items()}
L = {k: f"<#{v}>" for k, v in ids.items()}
TAG_START = "1532970581157351594"


def call(method, path, body=None):
    cmd = ["curl", "-s", "-w", "\n%{http_code}", "-X", method,
           "-H", "Authorization: Bot " + TOKEN, "-H", "Content-Type: application/json"]
    if body is not None:
        cmd += ["-d", json.dumps(body)]
    cmd.append(API + path)
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    payload, _, code = out.rpartition("\n")
    if int(code) >= 300:
        raise SystemExit(f"{method} {path} -> {code} {payload}")
    return json.loads(payload or "{}")


M1 = f"""## Start here

Cloud OBS is OBS, running on our machines instead of yours. Your phone streams to our ingest server, your OBS picks that feed up, adds your overlays and alerts, and sends the broadcast to Twitch. Your own PC can be off the whole time.

You run it from the dashboard when you are at a desk, and from the deck on your phone when you are out.

These guides are in order. Start at step 1 and each post hands you to the next one at the bottom, so you can follow the whole thing start to finish without coming back here.

Two things worth knowing before you begin. Your Twitch stream key is never stored: it goes into OBS when your container starts and disappears when it stops, and the reasoning is in step 7. And your ingest key, the one your phone streams with, is a password. Treat it like one."""

M2 = f"""## The path

Setting up, in order:

**1.** {L['onboarding']} get a key, a container, and OBS running
**2.** {L['ingest']} point your phone or encoder at us
**3.** {L['browser-sources']} alerts and widgets in your scenes
**4.** {L['tab-files']} upload the media your scenes need
**5.** {L['tab-switcher']} scene switching when your signal drops
**6.** {L['deck']} your phone as a stream remote
**7.** {L['container']} starting and stopping, day to day

When something feels slow:

**8.** {L['tab-sources']} find what is eating your container
**9.** {L['tab-performance']} CPU, FPS, frame time, and what they mean

Something not covered? Open a ticket and we will add it."""

M3 = f"""## What is already in your container

Your OBS does not start empty.

There is an `IRL` scene holding `StreamWizard Ingest`, which is your incoming feed, plus a handful of scenes to start from: Starting Soon, Connection Lost, Ending and BRB. There is an `_alerts` scene, the shelf your alert widgets live on, and an `_incoming-sources` scene, both of which stay out of your scene buttons on purpose. There is a `Welcome (Delete me)` scene, named as a hint. And the Source Clone plugin is installed, which is what mirrors one alert widget into several scenes without running several browsers.

Scenes whose names start with `_` or `-` stay hidden from your scene buttons and from the deck, so name your utility scenes that way if you want them out of the way.

You also get 500MB of storage for your own images, video and audio, which is step 4.

Ready? Step 1 is {L['onboarding']}."""

thread = call("POST", f"/channels/{FORUM}/threads", {
    "name": "Start here: StreamWizard cloud OBS",
    "applied_tags": [TAG_START],
    "message": {"content": M1},
})
tid = thread["id"]
print("hub", tid)
for m in (M2, M3):
    time.sleep(1.5)
    call("POST", f"/channels/{tid}/messages", {"content": m})

time.sleep(1.5)
# Forum posts pin via the thread's PINNED flag (1 << 1), not the message pin API.
call("PATCH", f"/channels/{tid}", {"flags": 2})
json.dump({"hub": tid}, open(os.path.join(HERE, "hub-id.json"), "w"))
print("pinned")
