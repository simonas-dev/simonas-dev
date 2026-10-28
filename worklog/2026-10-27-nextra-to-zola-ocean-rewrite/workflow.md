# Workflow: council-driven agentic rewrite

How simonas.dev was rebuilt (Nextra → Zola, WebGL ocean) in one evening by a
supervisor pi session driving subagents milestone by milestone, followed by a
direct owner ↔ agent polish loop. Session evals and logs live in `worklog/<date>-<title>/`.

## 1. Artifacts

| File | Role |
|---|---|
| `PLAN.md` | Source of truth: goals, milestones M0–M8, acceptance boxes. Owner requests become plan edits first. |
| `AGENTS.md` | Standing rules for every agent (branch, no push/prod deploy, binding design rules). |
| `.council/decisions.md` | Append-only decision log: date, who (owner / autopilot / council), what, why. Owner rows are binding; agents must not re-decide them. |
| `.council/M<n>-scout.md` | Scout's read of the codebase and plan before a milestone. |
| `.council/M<n>.md` | Milestone memo: council positions, chosen option, worker passes, review findings, outcome. |
| `.pi/agents/council-*.md` | Advisor personas: architect, designer, perf, skeptic. |
| `.pi/prompts/milestone.md` | The `/milestone M<n> [--autopilot]` prompt that drives one milestone. |
| `tools/queue.sh.example` | Headless queue: runs milestones in order, each in a fresh `pi -a --mode json` session. |
| `tools/session-log.py` | Pulls owner prompts and commits for a date range from pi session logs + git. |
| `tools/checks/` | Playwright scripts used to verify behaviour (see 5). |

## 2. Milestone loop (`/milestone M<n>`)

The parent session is the supervisor and sole decision maker; it never edits
code itself during a milestone.

1. **Scout** reads PLAN.md, the memos and the code; writes `M<n>-scout.md`.
2. **Council** of ≤3 advisors (default set per milestone in `milestone.md`)
   argues options; the supervisor cross-examines and picks one.
3. **Gate**: owner approves (skipped under `--autopilot`; autopilot picks the
   council's recommendation and logs it with "autopilot" in decisions.md).
4. **Worker → reviewer loop**: one writer per worktree; reviewers check
   against the acceptance boxes; at most `--max-passes` worker passes and
   `--max-rounds` review rounds; P0 findings must be fixed.
5. **Close**: memo outcome written, acceptance boxes ticked in PLAN.md,
   one commit `M<n>: …` on `rewrite`.

Autopilot stops and asks only when a P0 survives the round cap, a step needs
credentials/push/prod, or a decision would contradict an owner row.

## 3. Parallel lanes

When milestones are independent they run side by side, one writer per tree:

- **Lane A** main tree: milestone queue (`queue.sh` waits for the running
  autopilot pid, checks the previous `M<n>:` commit exists and its memo has
  no `## Blocked`, then starts the next milestone headless).
- **Lane B** separate repo dir (`../simonas-dev-video`): video encoding
  (lossless master → AV1/HEVC/H.264 tiers, VMAF-checked), copied into
  `static/video/` when done.
- **Lane C** git worktree (`../simonas-dev-sea`, branch `rewrite-sea`): shader
  tuning (M6a) with its own preview port; merged back with a merge commit.

Monitoring: `tail -f .pi/runs/queue.log`, `.pi/runs/M<n>.jsonl` (+ `follow.py`
/ `watch.py` to pretty-print), git log, and preview servers on :1112 / :1120.
Restart after a crash or out-of-credit: check the last `M<n>:` commit and the
memo, then relaunch the queue from the next milestone.

## 4. Polish loop (after go-live)

Owner feedback ("there's a black halo around the sun") is handled directly in
the main session:

1. Reproduce and measure before changing (pixel probes with ffmpeg + python,
   Playwright screenshots, computed styles).
2. Smallest change; record the cause in a code comment.
3. Verify in headless Chromium and WebKit (phone emulation for mobile), and
   for anything visual show a crop.
4. Owner decisions → a row in `decisions.md`; standing rules → `AGENTS.md`.
5. Commit and push only on "commit" / "commit and push".

## 5. Verification harness (`tools/checks/`)

Playwright (Chromium with SwiftShader for WebGL, WebKit for Safari-ish
behaviour). Install once: `cd tools/checks && npm i && npx playwright install chromium webkit`.
Scripts default to the local preview `http://127.0.0.1:1112`; most take a base
URL argument for checking a preview or production. Some write screenshots to
`/private/tmp/...`.

| Script | Checks |
|---|---|
| `links.mjs [url]` | every link on every page is underlined |
| `dark.mjs [url]` | dark-only theme, no toggle |
| `xfade.mjs [url]`, `xboth.mjs`, `xframes.mjs` | home ↔ Digital Sun View Transition crossfade (link, back, forward, logo, 404) |
| `sky.mjs`, `orbpos.mjs`, `hz.mjs` | faint sky video, orb position/mask, horizon brightness profile |
| `back.mjs`, `back2.mjs [url]` | mobile back-navigation keeps the sun playing (incl. simulated stalled `play()`) |
| `warm.mjs`, `seam.mjs` | video cache warming; poster vs first video frame |
| `hov3.mjs`, `pos.mjs`, `menu.mjs` | link hover wash, no layout shift |
| `lifecycle.mjs`, `race.mjs` | htmx nav lifecycle, nav race guard |
| `m2…m8*.mjs <base>` | per-milestone acceptance checks |

Caveats learned: headless WebKit does not apply iOS media policies; `zola
serve` ignores `Range` (Safari won't play video locally; use `zola build &&
npx http-server public -p 8080`); the image reader may fail on freshly written
screenshots, so copy to a new filename first.

## 6. Ship

- Branch `rewrite` → `git push origin rewrite:main` (fast-forward only), then
  `git branch -f main rewrite`. Vercel builds production from `main`.
- Phone/real-device test first: preview deploy from a clean worktree
  (`git worktree add --detach /private/tmp/deploy-rewrite HEAD`, apply the
  diff, copy `.vercel`, `vercel deploy --yes`, remove the worktree).
- Verify production with `curl` + `links.mjs`/`xfade.mjs <url>`; keep the
  previous production deployment id as the rollback target
  (`vercel rollback <deployment-url>`).
