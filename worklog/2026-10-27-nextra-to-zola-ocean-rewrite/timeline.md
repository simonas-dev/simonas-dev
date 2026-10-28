# Progress log: Tue 2026-10-27 evening → Wed 02:17 (EET)

Rebuilt with `tools/session-log.py 2026-10-27 2026-10-28` (owner prompts from
9 pi sessions + git). Workflow: `workflow.md`. Eval: `README.md`.

## Phase 1: setup (20:00–20:20)

- 20:00 Read PLAN.md; owner asked for a council-based agentic workflow.
- 20:02–20:08 Installed pi-subagents; wrote council agents
  (`.pi/agents/council-*`), `/milestone` prompt, `decisions.md`.
- 20:11 Owner installed zola + vercel. 20:12 Owner: Zola, standard .gitignore,
  `rewrite` branch, milestone by milestone, **autopilot**.
- 20:13 `617b157` plan, council agents, gitignore.

## Phase 2: autopilot milestones (20:20–00:37)

| Time | Commit | Milestone |
|---|---|---|
| 20:34 | `4a7bd7b` | M0 scaffold Zola, migrate content |
| 20:55 | `516f495` | M1 WebGL ocean shader, quality tiers, fallback |
| 20:57 | | autopilot died (out of credit); 21:01 owner refilled, restarted |
| 21:16 | `238d94b` | M2 typography & chrome (Newsreader + Departure Mono) |
| 21:37 | `f4e0459` | M3 day/night theme (later superseded: dark only) |
| 22:04 | `6ab3b0b` | M4 content pages |
| 23:04 | `7656b2c` | M5 htmx navigation (slowest: nav race / scroll memory) |
| 23:05 | `4524c23` → `589e2cb` | M6a calm sea + golden-ratio horizon (Lane C worktree, merged 23:09) |
| 23:52 | | owner's PC hiccup; queue restarted |
| 23:59 | `d226cef`, `cae21af` | M6 polish; owner Vercel config |
| 00:14 | `32a6e33` | M8 content edits (queue, headless) |
| 00:37 | `6b03133` | M7 Digital Sun video page (queue, headless) |

Owner input that reshaped the plan while lanes ran:
- 21:57–22:00 Video `Timeline 1.mov`: not a homepage hero ("tacky") → own page (M7).
- 22:05–22:07 Remove hero text, the Ballistic Wizard post and About page (M8).
- 22:10 Nav name in the same mono font.
- 22:12 Sea too stormy/spiky; sky takes the larger golden-ratio part (M6a).
- 22:18 Parallelise: Lane A queue, Lane B video encodes, Lane C sea worktree.
- 22:26 Serve the original HEVC 4K? → quality tiers from a lossless master
  instead (AV1/HEVC 4K, 1080 AV1/H.264, portrait), VMAF ≈ 96.5.
- 22:48 Sea tuning on :1120 approved ("1120 good").
- 00:25–00:37 (side session) Video tab → "Digital Sun", Photos removed, video
  shift 3% desktop / -1.5% mobile.

## Phase 3: go-live (00:39–00:42)

- 00:39 "go live": `main` fast-forwarded to `6b03133`; Vercel fixes (Node 24,
  musl zola). `10b8aaf` bookkeeping. Rollback target: old Nextra deploy.
- 00:41 No job title anywhere → `bcb4ae0` drop site-wide description.

## Phase 4: polish loop (00:43–02:17)

| Time | Commit | Change |
|---|---|---|
| 00:51 | `0460ee7` | Digital Sun faint in the home sky (5%, above the sea line); shader sun/moon removed |
| 00:52 | `0e3d027` | warm the Digital Sun video cache from home |
| 00:57 | `e0b97d2` | video fades in from black (Mac BT.709 video vs image colour shift; not HDR) |
| 01:01–01:11 | `702a93f` `58148a8` `8f0989c` `329c1b5` | slow 1.4 s View Transition crossfade home ↔ Digital Sun; real fix: keep sky layer opacity during the fade |
| 01:14 | `cc7ba24` | logo `~/` (side session) |
| 01:17 | `7db12da` | dark theme only |
| 01:43 | `c0995df` | red sunset glimmer on the sea; sky sun 10% + round mask hiding the square frame |
| 01:54 | `7d04c59` | links always underlined (AGENTS.md rule), 1px fixed; square hover wash; RSS link removed; orb mask fixes black halo |
| 01:58 | `eb41891` | sun carried through the horizon haze (no gap above the sea) |
| 02:08 | | (side session) Safari not autoplaying locally: `zola serve` lacks Range/206; production fine |
| 02:17 | `e11ead9` | iOS: video at opacity 0.001 (iOS won't start an invisible muted video), poster kept until playing, play() retries; confirmed on iPhone |

Production at the end: `simonas-pkl1ep4pi` (e11ead9). Previous: `simonas-du6tu9dxg`.

## Open / offered

- Regenerate `og.jpg` and `apple-touch-icon.png` for the dark theme.
- Optional: grayscale sky layer; `mix-blend-mode: screen` (needs layer restructure).
- M5 test script still clicks removed Posts/About links.
- Clean up `../simonas-dev-sea` worktree + `rewrite-sea` branch; delete 507 MB master.
- Repo history still carries the deleted 17 MB `.apk`.
- Working copy is on `main` (switched by a side session); `rewrite` = `main`.
