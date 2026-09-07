"""Patch selected messages of a post in place, from the current posts.py text.

Usage: python3 patch_one.py <post-key> <message-index> [<message-index> ...]
Message index is 0-based and matches the order in posts.py. Attachments already on the
message are kept unless the placeholder for them was removed.
"""
import json, os, re, subprocess, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from posts import POSTS

TOKEN = os.environ["DISCORD_BOT_TOKEN"]
API = "https://discord.com/api/v10"
SHOTS = "/mnt/c/streamwizard-docs/screenshots"
HERE = os.path.dirname(os.path.abspath(__file__))
ids = {k: v["id"] for k, v in json.load(open(os.path.join(HERE, "created.json"))).items()}
PLACEHOLDER = re.compile(r"^\[screenshot: ([^\]]+)\]\s*$", re.M)

key = sys.argv[1]
targets = [int(a) for a in sys.argv[2:]]
tid = ids[key]
_title, _tag, messages = POSTS[key]


def curl(cmd):
    for _ in range(8):
        out = subprocess.run(cmd + ["-w", "\n%{http_code}"], capture_output=True, text=True).stdout
        body, _, code = out.rpartition("\n")
        if int(code) == 429:
            wait = json.loads(body).get("retry_after", 5)
            print(f"  429 ({json.loads(body).get('code')}), waiting {wait:.1f}s")
            time.sleep(wait + 1)
            continue
        if int(code) >= 300:
            raise SystemExit(f"{code} {body}")
        return json.loads(body or "{}")
    raise SystemExit("rate limited repeatedly")


live = sorted(curl(["curl", "-s", "-H", "Authorization: Bot " + TOKEN,
                    f"{API}/channels/{tid}/messages?limit=50"]), key=lambda m: int(m["id"]))
# The footer message appended by next_links.py is not in posts.py, so ignore any tail.
live = live[:len(messages)]
if len(live) != len(messages):
    raise SystemExit(f"{key}: {len(live)} live vs {len(messages)} in source")

for i in targets:
    text = messages[i]
    shots = [n for n in PLACEHOLDER.findall(text) if os.path.exists(os.path.join(SHOTS, n))]
    clean = re.sub(r"\n{3,}", "\n\n", PLACEHOLDER.sub("", text)).strip()
    payload = {"content": clean, "attachments": [{"id": j, "filename": n} for j, n in enumerate(shots)]}
    cmd = ["curl", "-s", "-X", "PATCH", "-H", "Authorization: Bot " + TOKEN,
           "-F", "payload_json=" + json.dumps(payload)]
    for j, n in enumerate(shots):
        cmd += ["-F", f"files[{j}]=@{os.path.join(SHOTS, n)}"]
    cmd.append(f"{API}/channels/{tid}/messages/{live[i]['id']}")
    curl(cmd)
    print(f"patched {key}[{i}] ({len(shots)} img)")
    time.sleep(1.5)
