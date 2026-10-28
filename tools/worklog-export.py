#!/usr/bin/env python3
"""Export pi session logs for this repo into worklog/<dir>/ and compute stats.

Usage:
  tools/worklog-export.py worklog/2026-10-27-some-title 2026-10-27 [2026-10-28]

Takes every pi session (main + sibling worktrees like simonas-dev-sea) that
started within the local date range, plus all its subagent child sessions.
Writes:
  sessions/<start>_<label>.jsonl.xz              parent sessions
  sessions/<start>_<label>/<time>_<agent>_<id>.jsonl.xz   subagent children
  stats.json                                     per-session / per-agent / per-milestone numbers
Image attachments and other base64 blobs are replaced by placeholders
(screenshots are ~90% of the raw size). Re-run to refresh; files are overwritten.
"""
import collections
import datetime as dt
import glob
import json
import lzma
import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SESSIONS = os.path.expanduser("~/.pi/agent/sessions")
out_dir = os.path.join(REPO, sys.argv[1])
start = dt.date.fromisoformat(sys.argv[2])
end = dt.date.fromisoformat(sys.argv[3]) if len(sys.argv) > 3 else start + dt.timedelta(days=1)
lo = dt.datetime.combine(start, dt.time.min).astimezone()
hi = dt.datetime.combine(end, dt.time.max).astimezone()
B64 = re.compile(r"[A-Za-z0-9+/=\s]+")


def ts(s):
    return dt.datetime.fromisoformat(str(s).replace("Z", "+00:00")).astimezone()


def strip(o):
    if isinstance(o, dict):
        if o.get("type") == "image" and isinstance(o.get("data"), str):
            o["data"] = f"<image removed: {len(o['data'])} base64 chars>"
        for k, v in o.items():
            if isinstance(v, str) and len(v) > 2000 and B64.fullmatch(v[:2000]):
                o[k] = f"<base64 removed: {len(v)} chars>"
            else:
                strip(v)
    elif isinstance(o, list):
        for v in o:
            strip(v)


def export(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    lines = []
    for line in open(src, encoding="utf-8", errors="ignore"):
        try:
            e = json.loads(line)
        except ValueError:
            lines.append(line.rstrip("\n"))
            continue
        strip(e)
        lines.append(json.dumps(e, ensure_ascii=False))
    with lzma.open(dst, "wt", encoding="utf-8", preset=6) as f:
        f.write("\n".join(lines) + "\n")


def scan(path):
    r = dict(first=None, last=None, prompts=[], turns=0, tool_calls=0, cost=0.0,
             tokens_in=0, tokens_out=0, models=collections.Counter(), tools=collections.Counter())
    for line in open(path, encoding="utf-8", errors="ignore"):
        try:
            e = json.loads(line)
        except ValueError:
            continue
        m = e.get("message") if isinstance(e, dict) else None
        if not isinstance(m, dict) or "timestamp" not in e:
            continue
        t = ts(e["timestamp"])
        r["first"] = r["first"] or t
        r["last"] = t
        if m.get("role") == "user":
            c = m.get("content")
            text = c if isinstance(c, str) else " ".join(x.get("text", "") for x in c or [] if isinstance(x, dict))
            r["prompts"].append((t, text.strip()))
        elif m.get("role") == "assistant":
            r["turns"] += 1
            u = m.get("usage") or {}
            r["cost"] += (u.get("cost") or {}).get("total", 0)
            r["tokens_in"] += u.get("input", 0) + u.get("cacheRead", 0) + u.get("cacheWrite", 0)
            r["tokens_out"] += u.get("output", 0)
            r["models"][m.get("model")] += 1
            for c in m.get("content") or []:
                if isinstance(c, dict) and c.get("type") == "toolCall":
                    r["tool_calls"] += 1
                    r["tools"][c.get("name")] += 1
    return r


slug = "--" + REPO.strip("/").replace("/", "-")
roots = sorted(glob.glob(os.path.join(SESSIONS, slug + "*")))
meta = {}
for root in roots:
    for mf in glob.glob(os.path.join(root, "subagent-artifacts", "*_meta.json")):
        m = json.load(open(mf))
        meta[m["runId"]] = m

stats = dict(range=[str(start), str(end)], sessions=[], children=[])
for root in roots:
    label_root = os.path.basename(root).strip("-").split("-")[-1]  # dev / sea
    for f in sorted(glob.glob(os.path.join(root, "*.jsonl"))):
        r = scan(f)
        if not r["first"] or not lo <= r["first"] <= hi:
            continue
        sid = os.path.basename(f)[:-6]
        first_prompt = r["prompts"][0][1] if r["prompts"] else ""
        kind = "autopilot" if first_prompt.startswith("Drive exactly one milestone") and len(r["prompts"]) == 1 else "interactive"
        label = f"{r['first']:%m%d-%H%M}_{label_root}-{kind}"
        export(f, os.path.join(out_dir, "sessions", label + ".jsonl.xz"))
        kids = []
        for k in sorted(glob.glob(os.path.join(root, sid, "**", "*.jsonl"), recursive=True)):
            run_id = os.path.relpath(k, os.path.join(root, sid)).split(os.sep)[0]
            m = meta.get(run_id, {})
            kr = scan(k)
            agent = m.get("agent", "child")
            when = kr["first"] or r["first"]
            export(k, os.path.join(out_dir, "sessions", label, f"{when:%H%M%S}_{agent}_{run_id[:8]}.jsonl.xz"))
            child = dict(parent=label, agent=agent, run=run_id, start=str(kr["first"]), end=str(kr["last"]),
                         minutes=round((kr["last"] - kr["first"]).total_seconds() / 60, 1) if kr["first"] else 0,
                         exit=m.get("exitCode"), model=m.get("model"), turns=kr["turns"], tool_calls=kr["tool_calls"],
                         cost=round(kr["cost"], 4), tokens_in=kr["tokens_in"], tokens_out=kr["tokens_out"])
            kids.append(child)
            stats["children"].append(child)
        stats["sessions"].append(dict(
            label=label, kind=kind, start=str(r["first"]), end=str(r["last"]),
            minutes=round((r["last"] - r["first"]).total_seconds() / 60), owner_prompts=len(r["prompts"]),
            turns=r["turns"], tool_calls=r["tool_calls"], cost=round(r["cost"], 2),
            tokens_in=r["tokens_in"], tokens_out=r["tokens_out"], models=dict(r["models"]),
            top_tools=dict(r["tools"].most_common(8)), children=len(kids),
            children_cost=round(sum(c["cost"] for c in kids), 2),
            children_turns=sum(c["turns"] for c in kids), children_tool_calls=sum(c["tool_calls"] for c in kids)))

# Per agent role, and per milestone (children grouped by the next "M<n>:" commit).
by_agent = collections.defaultdict(lambda: dict(runs=0, failed=0, turns=0, tool_calls=0, cost=0.0))
for c in stats["children"]:
    a = by_agent[c["agent"]]
    a["runs"] += 1
    a["failed"] += c["exit"] not in (0, None)
    a["turns"] += c["turns"]
    a["tool_calls"] += c["tool_calls"]
    a["cost"] = round(a["cost"] + c["cost"], 2)
stats["by_agent"] = by_agent

log = subprocess.run(["git", "-C", REPO, "log", "--all", "--reverse", "--format=%at %s"], capture_output=True, text=True).stdout
milestones = []
for line in log.splitlines():
    t, subject = line.split(" ", 1)
    mm = re.match(r"(M\d+a?):", subject)
    if mm:
        milestones.append((dt.datetime.fromtimestamp(int(t)).astimezone(), mm.group(1)))
by_ms = collections.defaultdict(lambda: dict(cost=0.0, agents=collections.Counter(), failed=0))
for c in stats["children"]:
    t = ts(c["start"]) if c["start"] != "None" else None
    if "_sea-" in c["parent"]:
        key = "M6a"
    else:
        key = next((n for when, n in milestones if n != "M6a" and t and t <= when), "other")
    b = by_ms[key]
    b["cost"] = round(b["cost"] + c["cost"], 2)
    b["agents"][c["agent"]] += 1
    b["failed"] += c["exit"] not in (0, None)
stats["by_milestone"] = {k: dict(v, agents=dict(v["agents"]), commit_time=str(next((w for w, n in milestones if n == k), "")))
                         for k, v in by_ms.items()}
stats["totals"] = dict(
    parent_cost=round(sum(s["cost"] for s in stats["sessions"]), 2),
    children_cost=round(sum(c["cost"] for c in stats["children"]), 2),
    cost=round(sum(s["cost"] for s in stats["sessions"]) + sum(c["cost"] for c in stats["children"]), 2),
    sessions=len(stats["sessions"]), children=len(stats["children"]),
    turns=sum(s["turns"] + s["children_turns"] for s in stats["sessions"]),
    tool_calls=sum(s["tool_calls"] + s["children_tool_calls"] for s in stats["sessions"]),
    owner_prompts=sum(s["owner_prompts"] for s in stats["sessions"]))
os.makedirs(out_dir, exist_ok=True)
json.dump(stats, open(os.path.join(out_dir, "stats.json"), "w"), indent=1, default=str)
print(json.dumps(stats["totals"], indent=1))
