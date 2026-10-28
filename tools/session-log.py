#!/usr/bin/env python3
"""Pull what was done in this repo from pi session logs and git.

Usage:
  tools/session-log.py                       # today and yesterday
  tools/session-log.py 2026-10-27 2026-10-28 # from..to (local dates, inclusive)
  tools/session-log.py --replies ...         # also print the assistant's final text per turn

Reads ~/.pi/agent/sessions/<cwd-slug>/*.jsonl for this repo and its sibling
worktrees (e.g. simonas-dev-sea), prints every owner prompt with its local
time and session, then the git commits in the same window.
"""
import datetime as dt
import glob
import json
import os
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SESSIONS = os.path.expanduser("~/.pi/agent/sessions")
args = [a for a in sys.argv[1:] if not a.startswith("--")]
replies = "--replies" in sys.argv

today = dt.date.today()
start = dt.date.fromisoformat(args[0]) if args else today - dt.timedelta(days=1)
end = dt.date.fromisoformat(args[1]) if len(args) > 1 else today
lo = dt.datetime.combine(start, dt.time.min).astimezone()
hi = dt.datetime.combine(end, dt.time.max).astimezone()

slug = "--" + REPO.strip("/").replace("/", "-")
dirs = sorted(glob.glob(os.path.join(SESSIONS, slug + "*")))


def text_of(content):
    if isinstance(content, str):
        return content
    return " ".join(c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text")


rows = []
for d in dirs:
    for f in sorted(glob.glob(os.path.join(d, "*.jsonl"))):
        session = os.path.basename(d).strip("-").split("-")[-1] + ":" + os.path.basename(f)[11:16]
        last_reply = None
        for line in open(f, encoding="utf-8"):
            try:
                e = json.loads(line)
            except ValueError:
                continue
            m = e.get("message") or {}
            if e.get("type") != "message" or m.get("role") not in ("user", "assistant"):
                continue
            try:
                ts = dt.datetime.fromisoformat(e["timestamp"].replace("Z", "+00:00")).astimezone()
            except (KeyError, ValueError):
                continue
            if not lo <= ts <= hi:
                continue
            t = text_of(m.get("content")).strip().replace("\n", " ")
            if m["role"] == "user":
                if last_reply and replies:
                    rows.append((last_reply[0], session, "  -> " + last_reply[1][:300]))
                last_reply = None
                rows.append((ts, session, t[:200]))
            elif t:
                last_reply = (ts, t)
        if last_reply and replies:
            rows.append((last_reply[0], session, "  -> " + last_reply[1][:300]))

print(f"# Owner prompts {start} .. {end}\n")
for ts, session, t in sorted(rows, key=lambda r: r[0]):
    print(f"{ts:%a %H:%M}  [{session}]  {t}")

print(f"\n# Commits {start} .. {end}\n")
print(subprocess.run(
    ["git", "-C", REPO, "log", "--all", "--reverse", f"--since={lo.isoformat()}", f"--until={hi.isoformat()}",
     "--date=format:%a %H:%M", "--format=%ad  %h  %s"],
    capture_output=True, text=True).stdout)
