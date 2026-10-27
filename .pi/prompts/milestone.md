---
description: Take one PLAN.md milestone through council → approval → worker/review loop → close
argument-hint: "<M0..M6> [--autopilot] [--advisors name,name,name] [--max-passes 2|3] [--max-rounds N]"
---

Drive exactly one milestone of PLAN.md to done. You, the parent session, are the
supervisor and only decision maker. Use the `subagent` tool and the packaged
pi-subagents protocols; do not invent a different orchestration.

Parse the invocation yourself. The first token is the milestone id (M0..M6).
Defaults: `--max-passes 2`, `--max-rounds 3`, advisors from the table below.

| Milestone | Default advisors |
|-----------|------------------|
| M0 Scaffold | council-architect, council-skeptic, council-perf |
| M1 Ocean shader | council-architect, council-perf, council-designer |
| M2 Typography & chrome | council-designer, council-perf, council-skeptic |
| M3 Day / night | council-designer, council-perf, council-skeptic |
| M4 Content pages | council-designer, council-perf, council-architect |
| M5 htmx navigation | council-architect, council-perf, council-skeptic |
| M6 Polish | council-designer, council-perf, council-skeptic |

Never use more than 3 advisors (the council protocol caps at 4).

## Autopilot (`--autopilot`)

All work happens on the `rewrite` branch. Never push, never touch `main`,
never deploy to production.

With `--autopilot`, the owner has pre-approved unattended execution:
- Skip the Gate (step 3) and the commit confirmation (step 5): commit each
  milestone on `rewrite` once its review loop stops clean.
- Owner decisions: pick the council's recommended option, record it in
  `.council/decisions.md` with "autopilot" in the Why column, and continue.
- After closing a milestone, immediately start the next one (M0 → M6) in the
  same session, re-reading PLAN.md and the memos. Keep the main context lean:
  rely on memo files, not chat history.
- STOP and ask me only when: a P0 blocker survives the round cap; a step would
  be destructive beyond the approved plan (deleting content/assets not listed
  in PLAN.md, rewriting git history); credentials/login are needed (e.g.
  `vercel login`); or validation (`zola build`) cannot be made to pass.
- Vercel: use only preview deploys (`vercel deploy`, never `--prod`), and only
  if the CLI is already logged in and linked; otherwise leave that checkbox
  unticked and note it under Deferred.

Without `--autopilot`, run exactly one milestone with both approval stops.

## 0. Preflight

- Read PLAN.md, `.council/decisions.md`, and every existing `.council/M*.md`.
- Refuse to start if an earlier milestone is not closed in PLAN.md, unless I say so.
- Ensure the current branch is `rewrite` (create it from `main` if missing).
- Check `git status`; stop if the tree is dirty with unrelated changes.
- List any PLAN.md "Open decisions" this milestone forces. Ask me to settle them
  now and record answers in `.council/decisions.md` before the council runs.

## 1. Scout

Run one `scout` (fresh context) to map current repo state relevant to the
milestone: existing files, what earlier milestones produced, tooling versions
available locally (zola, node), and gaps vs the milestone checklist.

## 2. Council (plan)

Load `subagent({ action: "guide", options: { topic: "council" } })` and follow
it exactly. Council question:

  "What is the best implementation plan for <milestone> of PLAN.md, given the
  scout context? Produce ordered steps, files to create/change, acceptance
  checks per checklist item, and items to defer."

Scope: only this milestone's checklist. Non-goals: later milestones, PLAN.md
non-goals. Include the scout context as evidence.

Write the final memo to `.council/<milestone>.md` with sections:
Plan (ordered steps), Acceptance checks, Deferred, Owner decisions, Council
record (roster, passes, run ids, accepted/rejected feedback).

## 3. Gate

Show me the plan summary and owner decisions. Wait for my explicit approval.
Record any decisions in `.council/decisions.md`. Do not proceed without approval.
(Autopilot: print the summary, record decisions, and continue.)

## 4. Build + review

Follow the packaged `/review-loop` protocol (load
`subagent({ action: "guide", options: { topic: "workflows" } })` if needed) with
the approved plan as the implementation request:

- one async `worker` implements `.council/<milestone>.md` Plan, nothing more
- fresh-context `reviewer`s in parallel; pick angles from the milestone
  (always include "acceptance checks from the memo"; add visual/a11y/perf
  angles for M1–M6)
- cap at `--max-rounds`; pause and ask me on any unapproved scope or
  architecture decision

Validation the worker and reviewers should use where applicable: `zola build`,
`zola check`, `zola serve` + curl of key URLs (`/`, `/about/`, `/photos/`,
`/posts/ballistic-wizard/`, `/feed.xml`, old URLs), JS size of `static/*.js`.

## 5. Close

- Inspect the final diff yourself and run the acceptance checks.
- Tick the completed checkboxes for this milestone in PLAN.md; leave unfinished
  ones unticked and list them under Deferred in `.council/<milestone>.md`.
- Append an Outcome section to `.council/<milestone>.md`: what shipped,
  validation evidence, deferred items, surprises.
- Propose a single commit `<milestone>: <summary>` and wait for my OK before
  committing (autopilot: commit directly on `rewrite`). Never push.

Invocation:

$@
