"""Publish the guide posts, with their screenshots attached.

`[screenshot: name.png]` placeholders in posts.py are stripped from the text and the file is
attached to that message instead. Files that were never captured just lose the placeholder.
"""
import json, os, re, subprocess, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from posts import POSTS, TAGS

TOKEN = os.environ["DISCORD_BOT_TOKEN"]
FORUM = "1532562101741293569"
API = "https://discord.com/api/v10"
SHOTS = "/mnt/c/streamwizard-docs/screenshots"
HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, "created.json")
PLACEHOLDER = re.compile(r"^\[screenshot: ([^\]]+)\]\s*$", re.M)

missing = set()


def split(text):
    """-> (text without placeholders, [existing screenshot paths])"""
    shots = []
    for name in PLACEHOLDER.findall(text):
        path = os.path.join(SHOTS, name)
        if os.path.exists(path):
            shots.append((name, path))
        else:
            missing.add(name)
    clean = re.sub(r"\n{3,}", "\n\n", PLACEHOLDER.sub("", text)).strip()
    return clean, shots


def call(method, path, payload, shots=()):
    for _ in range(6):
        cmd = ["curl", "-s", "-w", "\n%{http_code}", "-X", method,
               "-H", "Authorization: Bot " + TOKEN]
        if shots:
            cmd += ["-F", "payload_json=" + json.dumps(payload)]
            for i, (_name, p) in enumerate(shots):
                cmd += ["-F", f"files[{i}]=@{p}"]
        else:
            cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(payload)]
        cmd.append(API + path)
        out = subprocess.run(cmd, capture_output=True, text=True).stdout
        body, _, code = out.rpartition("\n")
        if int(code) == 429:
            time.sleep(json.loads(body).get("retry_after", 5) + 0.5)
            continue
        if int(code) >= 300:
            raise SystemExit(f"{method} {path} -> {code} {body}")
        return json.loads(body or "{}")
    raise SystemExit("rate limited repeatedly")


created = json.load(open(STATE)) if os.path.exists(STATE) else {}

for key, (title, tag, messages) in POSTS.items():
    if key in created:
        print("skip", key)
        continue
    body, shots = split(messages[0])
    thread = call("POST", f"/channels/{FORUM}/threads", {
        "name": title,
        "applied_tags": [TAGS[tag]],
        "message": {"content": body},
    }, shots)
    tid = thread["id"]
    created[key] = {"id": tid, "title": title}
    json.dump(created, open(STATE, "w"), indent=1)
    print(f"created {key} {tid} (+{len(shots)} img) {title}")
    time.sleep(1.5)
    for m in messages[1:]:
        body, shots = split(m)
        call("POST", f"/channels/{tid}/messages", {"content": body}, shots)
        print(f"  message +{len(shots)} img")
        time.sleep(1.5)

if missing:
    print("\nno file for:", ", ".join(sorted(missing)))
print(json.dumps({k: v["id"] for k, v in created.items()}, indent=1))
