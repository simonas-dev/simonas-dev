# Nextra → Zola ocean rewrite (Tue 2026-10-27, 20:00 → Wed 02:17 EET)

One evening of vibe coding: the personal site simonas.dev was rebuilt from a
Nextra (Next.js 12) blog into a static Zola site with a live WebGL ocean,
shipped to production, then polished live with the owner.

- **Agent:** pi + pi-subagents, model `claude-opus-5-5` everywhere (subagents at `:high` thinking).
- **Method:** council-driven milestone autopilot, then a direct owner ↔ agent polish loop.
  See [`workflow.md`](workflow.md).
- **Result:** live on https://simonas.dev at `e11ead9` (Vercel `simonas-pkl1ep4pi`).

| File | Contents |
|---|---|
| [`timeline.md`](timeline.md) | What happened when, phase by phase, with commits |
| [`prompts.md`](prompts.md) | All 106 owner prompts, timestamped and tagged by kind of steering |
| [`workflow.md`](workflow.md) | The workflow as run: artifacts, milestone loop, lanes, polish loop, checks, ship |
| `stats.json` | Raw numbers per session, subagent run, agent role and milestone |
| `sessions/` | All 9 session logs + 82 subagent transcripts (`.jsonl.xz`, images stripped; 129 MB raw → 4 MB) |

Regenerate: `tools/worklog-export.py worklog/2026-10-27-nextra-to-zola-ocean-rewrite 2026-10-27 2026-10-28`.
Read a log: `xz -dc sessions/1027-2000_dev-interactive.jsonl.xz | jq -c 'select(.message.role=="user")'`.

## Summary

| | |
|---|---|
| Outcome | 10 milestones (M0–M8, M6a) done, site live, then 15 post-launch polish commits |
| Commits | 31 (`617b157` … `e11ead9`) |
| Wall-clock | **6 h 17 min** (owner at the keyboard throughout) |
| Autopilot span | 4 h 17 min (20:20 → 00:37), up to 3 lanes in parallel |
| Cost | **≈ $88.8** |
| Model work | 1,869 assistant turns, 2,405 tool calls, 132 M input tokens (mostly cache reads), 1.7 M output tokens |
| Sessions | 9 (1 main, 5 headless milestone supervisors, 3 short side sessions) + 82 subagent runs |
| Owner prompts | 106, about one every 3.6 min |

## Time

| Phase | Clock | Duration | What |
|---|---|---|---|
| Setup | 20:00 → 20:20 | 20 min | install pi-subagents, write council agents, `/milestone` prompt, decisions log; owner picks Zola, `rewrite` branch, autopilot |
| Autopilot | 20:20 → 00:37 | 4 h 17 min | M0–M8 via council → worker → reviewer; video encodes and sea tuning in parallel lanes |
| Go-live | 00:39 → 00:42 | 3 min | fast-forward `main`, Vercel fixes, metadata cleanup |
| Polish | 00:43 → 02:17 | 1 h 34 min | sky sun, crossfade, dark only, glimmer, link rules, iOS video fixes |

Milestone durations (time to the commit; council + worker + review):

| Milestone | Done | Took | Subagent cost | Subagent runs | Notes |
|---|---|---|---|---|---|
| M0 scaffold | 20:34 | 14 min | $2.94 | 7 | |
| M1 ocean shader | 20:55 | 21 min | $4.23 | 8 | 2 worker passes |
| M2 typography | 21:16 | 21 min* | $4.71 | 11 | out of credit at 20:57; 3 council runs failed, relaunched |
| M3 day/night | 21:37 | 21 min | $3.32 | 7 | later superseded (dark only) |
| M4 content pages | 22:04 | 28 min | $6.23 | 7 | |
| M5 htmx navigation | 23:04 | 60 min | $8.55 | 9 | hardest: nav races, scroll memory; 2 worker passes, 3 reviews |
| M6a calm sea (lane C) | 23:05 | 45 min | $5.16 | 9 | separate worktree, merged 23:09 |
| M6 polish | 23:59 | 55 min | $7.90 | 8 | owner's PC hiccup at 23:52; 1 worker run failed |
| M8 content edits | 00:14 | 15 min | $3.65 | 8 | headless queue |
| M7 video page | 00:37 | 23 min | $5.95 | 8 | headless queue |

\* excluding the 4-minute outage.

Subagent work summed to 320 agent-minutes (workers 174 min, longest single worker run 29 min).

## Cost

| Bucket | Cost | Share |
|---|---|---|
| Milestone subagents (scout, council, workers, reviewers) | $52.64 | 59% |
| Milestone supervisors (5 headless sessions) | $10.77 | 12% |
| Main session: setup, lane orchestration, video encoding, monitoring | $12.40 | 14% |
| Main session: go-live | $0.45 | 1% |
| Main session: polish loop | $11.91 | 13% |
| Side sessions (video tab, logo, Safari) | $0.60 | 1% |
| **Total** | **$88.77** | |

By subagent role:

| Role | Runs | Failed | Turns | Cost |
|---|---|---|---|---|
| worker | 14 | 1 | 551 | $22.00 |
| reviewer | 25 | 0 | 336 | $15.57 |
| council-perf | 10 | 1 | 49 | $3.83 |
| council-designer | 9 | 1 | 56 | $3.68 |
| council-skeptic | 9 | 1 | 58 | $3.58 |
| scout | 10 | 0 | 59 | $2.05 |
| council-architect | 5 | 0 | 28 | $1.93 |

The full build (M0–M8, $63.41) cost about 5× the go-live plus polish ($12.36). Reviews ($15.57) were 30% of subagent spend.

## Iterations

- **Milestones:** each got 1 council round (2 for M2 after the outage), 1–2 worker passes and 2–3
  review rounds. No milestone hit the round cap or stopped as Blocked.
- **Plan changes mid-run:** 4 owner rewrites of the plan while lanes ran: video page (M7),
  content removal (M8), calm sea and golden-ratio horizon (M6a), and parallel lanes.
- **Polish:** 15 commits in 94 min. Most changes landed first try. The exceptions:
  - home → Digital Sun crossfade: 4 commits, 3 wrong diagnoses before the real cause (the
    no-double-fade rule forced the 5% sky layer to full opacity before the snapshot);
  - sky sun: three rounds (red frame → black halo → gap above the sea), each found by the owner
    from a screenshot;
  - iOS playback: 2 rounds (stalled `play()` fallback, then the real cause: opacity 0).
- **Owner-found bugs:** 9, all visual or on real devices: video start glitch, harsh crossfade,
  home → Digital Sun nav, black halo, sun–sea gap, sun vanishing on mobile, Safari and iOS
  autoplay. Headless Chromium/WebKit missed every one of these before the owner reported them.

## Human steering

106 owner prompts, tagged in [`prompts.md`](prompts.md):

| Kind | Count | Share | Examples |
|---|---|---|---|
| New scope / direction | 26 | 25% | video page instead of hero ("tacky"), remove About, dark only, glimmer, link rules |
| Taste tuning | 18 | 17% | "wider", video shift 3% / -1.5%, "larger footprint", "don't change the underline weight" |
| Status / monitoring | 18 | 17% | "status", "upd", "why M5 is struggling?", "can you track what agent is doing?" |
| Setup & process | 13 | 12% | install, workflow choice, Zola, branch, autopilot, parallelise, Vercel login |
| Approval / ship | 13 | 12% | "commit and push", "go live", "works" |
| Bug report (owner found) | 9 | 8% | black halo, gap, iOS video |
| Ops / recovery | 7 | 7% | process died, out of credit, PC hiccup, "the web is dead now", kill :1120 |
| Question | 2 | 2% | which video was used, what inspired the site |

- **Autopilot phase (20:20–00:37):** 53 prompts, of which **0 were milestone gates** (autopilot
  decided and logged). The owner still stayed busy: 18 status checks, 7 recoveries and
  plan-changing ideas while the agents worked.
- **Polish phase (00:39–02:17):** 44 prompts. The agent did nothing unprompted; every change
  started from an owner observation, mostly visual.
- **Longest stretches without input:** 56 min (21:01–21:57, autopilot M2–M4), 25 min
  (23:27–23:52), 19 min (01:16–01:35).
- **Decisions recorded:** 50 rows in `.council/decisions.md` (owner, autopilot and council),
  so later sessions could follow them without the chat.

## Eval

**Worked well**
- Council → worker → reviewer produced working milestones unattended at about 15–60 min each.
  Memos and the decisions log carried context between fresh sessions, so a crash or credit
  outage cost minutes, not the run.
- Parallel lanes (queue, video encodes, sea worktree) overlapped the slowest milestone (M5) with
  other work. One writer per tree avoided conflicts.
- Owner rules turned into binding text (decisions log, design rules in `AGENTS.md`) stuck:
  later agents followed them.
- Measuring before changing (pixel probes, computed styles, range-request checks) found the real
  causes of the halo, the gap and the Safari autoplay issue quickly.

**Didn't work well**
- **Monitoring was manual:** 18 status prompts. The owner had no dashboard and kept asking.
- **Visual and device bugs got past the agents:** all 9 owner-found bugs were visual or
  real-device (iOS). Headless WebKit doesn't apply iOS media rules; screenshots at 10% opacity
  hid problems the owner saw at a glance.
- **Diagnosis churn on the crossfade:** 3 plausible-but-wrong fixes shipped as commits before
  the real cause was found.
- **Fragile infrastructure:** the run stopped once for credit and once for a local crash.
  Recovery needed the owner.
- **Some decisions were reversed:** M3 (three-state day/night theme) was built, then removed for
  dark only. The video went hero → separate page → faint in the home sky. That's normal for vibe
  coding, but the autopilot built the first version in full.

**Lessons for the next session**
1. Start a progress feed the owner can glance at (queue log + milestone status file) before
   starting autopilot; it would save about 15% of prompts.
2. Test on a real phone (preview deploy) as part of the polish loop, not only headless.
3. For visual bugs, compare frames at real opacity and on the target device before committing a fix.
4. Settle the cheap taste decisions (theme modes, hero vs page) before autopilot builds them.
5. Keep a credit buffer and a one-command restart for the queue.
