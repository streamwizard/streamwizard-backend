"""Append a 'next step' footer to each guide post, so the set reads as one path.

Posted as an extra message rather than an edit: Discord caps edits on messages older than
an hour, and a short footer message reads fine at the end of a forum thread.
"""
import json, os, subprocess, time

TOKEN = os.environ["DISCORD_BOT_TOKEN"]
API = "https://discord.com/api/v10"
HERE = os.path.dirname(os.path.abspath(__file__))
ids = {k: v["id"] for k, v in json.load(open(os.path.join(HERE, "created.json"))).items()}
HUB = json.load(open(os.path.join(HERE, "hub-id.json")))["hub"]
L = {k: f"<#{v}>" for k, v in ids.items()}
L["hub"] = f"<#{HUB}>"

# post key -> footer text. Order matches the path in the index post.
FOOTERS = {
    "onboarding": f"""### Step 1 of 9 done

Your container is running and OBS is connected. Now get your phone streaming into it.

**Next up, step 2:** {L['ingest']}
All the steps: {L['hub']}""",

    "ingest": f"""### Step 2 of 9 done

Your feed is arriving and it is in your `IRL` scene. Next, put your alerts on screen.

**Next up, step 3:** {L['browser-sources']}
All the steps: {L['hub']}""",

    "browser-sources": f"""### Step 3 of 9 done

Alerts are in. Next, upload the media your scenes need, like the BRB video your connection lost scene will be showing.

**Next up, step 4:** {L['tab-files']}
All the steps: {L['hub']}""",

    "tab-files": f"""### Step 4 of 9 done

You have scenes, sources and media. Now make them switch themselves when your signal dies. This is the big one.

**Next up, step 5:** {L['tab-switcher']}
All the steps: {L['hub']}""",

    "tab-switcher": f"""### Step 5 of 9 done

That is your setup finished at the desk. Now take it with you.

**Next up, step 6:** {L['deck']}
All the steps: {L['hub']}""",

    "deck": f"""### Step 6 of 9 done

One thing left before you go live: knowing when to start and stop the container, and what happens to your stream key.

**Next up, step 7:** {L['container']}
All the steps: {L['hub']}""",

    "container": f"""### Setup done

That is everything you need to stream. Go and do it.

The last two posts are reference for when something feels slow, so read them when you need them rather than now.

**Step 8:** {L['tab-sources']} find what is eating your container
**Step 9:** {L['tab-performance']} what the numbers mean
All the steps: {L['hub']}""",

    "tab-sources": f"""**Next up, step 9:** {L['tab-performance']} what CPU, FPS and frame time are telling you
All the steps: {L['hub']}""",

    "tab-performance": f"""Found a heavy source? Turning it off lives in step 8: {L['tab-sources']}
All the steps: {L['hub']}""",
}


def post(tid, content):
    for _ in range(6):
        out = subprocess.run([
            "curl", "-s", "-w", "\n%{http_code}", "-X", "POST",
            "-H", "Authorization: Bot " + TOKEN, "-H", "Content-Type: application/json",
            "-d", json.dumps({"content": content}),
            f"{API}/channels/{tid}/messages",
        ], capture_output=True, text=True).stdout
        body, _, code = out.rpartition("\n")
        if int(code) == 429:
            time.sleep(json.loads(body).get("retry_after", 5) + 0.5)
            continue
        if int(code) >= 300:
            raise SystemExit(f"{code} {body}")
        return json.loads(body)
    raise SystemExit("rate limited repeatedly")


for key, text in FOOTERS.items():
    post(ids[key], text)
    print("footer ->", key)
    time.sleep(1.5)
