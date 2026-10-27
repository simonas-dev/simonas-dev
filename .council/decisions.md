# Decisions log

Settled answers to PLAN.md "Open decisions" and anything the council escalates.
Advisors treat entries here as the contract. Newest last.

| Date | Milestone | Decision | Choice | Why |
|------|-----------|----------|--------|-----|
| 2026-10-27 | setup | Site generator (Zola / Eleventy) | **Zola** (0.23.6 installed locally) | Owner |
| 2026-10-27 | setup | Branching | All rewrite work on `rewrite` branch; `main` and the live deploy untouched until owner merges. Overrides PLAN.md "do it on main". | Owner |
| 2026-10-27 | setup | Execution mode | Milestone by milestone on autopilot: commit per milestone on `rewrite`, never push, never `--prod` deploy | Owner |
| 2026-10-27 | setup | What gets committed | Follow `.gitignore`: build output (`public/`), `.vercel/`, env files, `.pi/*` runtime state are ignored; `.pi/agents`, `.pi/prompts`, `.council/`, `AGENTS.md`, `PLAN.md` are tracked | Owner |
| 2026-10-27 | M2 | Serif font (Newsreader / Fraunces / Plantin) | **Newsreader** static 400 + italic, self-hosted woff2 (OFL); headings 400, no bold | autopilot (council unanimous) |
| 2026-10-27 | M0 | Domain / `base_url` | **https://simonas-dev.vercel.app** for now; revisit if simonas.dev is bought | autopilot (no domain owned; keeps feed URL stable) |
| | | Featured projects on home | _open_ | |
| 2026-10-27 | M0 | Vercel deploy in M0 | Write `vercel.json` only; preview deploy deferred (CLI logged out, project not linked); prod/main untouched | autopilot (credentials needed) |
| 2026-10-27 | M0 | Photo originals | Resize in place to 2400px; originals kept only in git history | autopilot (council unanimous) |
| 2026-10-27 | M0 | Home vs About | `/` = minimal home stub; About content at `/about/` | autopilot (council rec, PLAN layout) |
| 2026-10-27 | M0 | Old URLs / feed | `/posts/wizard` alias + vercel 301; `/tags/*` 301 → `/posts/`; `/feed.xml` stays RSS 2.0 | autopilot (council rec) |
| 2026-10-27 | M1 | Shader architecture | Single-pass WebGL1, GLSL fetched from `static/shader/` (+ preload), quality via `#define` tiers 0.4/0.375/0.35 | autopilot (council unanimous) |
| 2026-10-27 | M1 | Shader day endpoints | Day `light` = #faf9f6 (0.980,0.976,0.965), warm-tinted `dark`; night per PLAN | autopilot (perf+designer; avoids seam vs body bg) |
| 2026-10-27 | M1 | WebGL fallback | Flat `#faf9f6` body until paper.png lands in M4 | autopilot (council unanimous) |
| 2026-10-27 | M2 | Night colours | `#1a1a1a` bg / `#2e2d2b` surface, light ink `#e8e6e1`; `.theme-night` only, no prefers-color-scheme until M3 | autopilot (council) |
| 2026-10-27 | M2 | Mobile menu / toggle | `<details>` menu (no JS); theme toggle visible but `disabled` until M3; menu paper texture via CSS var hook until M4 | autopilot (council majority) |
| 2026-10-27 | M2 | ocean.js budget | Stays < 10,240 B; horizon setter paid for by trimming comments | autopilot (perf+skeptic) |
| 2026-10-27 | M3 | Night shader look | Darken night sky/scene in shader so `#e8e6e1` ink is readable (deviates from PLAN night formula) | autopilot (council rec) |
| 2026-10-27 | M3 | Theme mechanics | Key `theme` in localStorage (absent = auto = OS); inline head script + `site.js` (tween) + ocean.js; meta color-scheme stays `light` | autopilot (council) |
| 2026-10-27 | M4 | Content surfaces & throttle | Alpha-grain paper PNGs under 97% tint; photos on `.wide` surface bleeding to panel edges; throttle policy in site.js, generic res/fps knobs in ocean.js (probe exempt), budget unchanged; first photo eager | autopilot (council) |
| 2026-10-27 | owner | Home hero text | Will be removed in M8 ("Simonas Sankauskas / Senior Software Engineer, Android." — owner: "lame"). M5–M6 should not invest in hero text. | Owner |
| 2026-10-27 | owner | Ballistic Wizard post | Will be removed in M8 (post, assets, alias/redirect). M5–M6 should not depend on it as test content. | Owner |
| 2026-10-27 | owner | About page | Will be removed in M8 (page, nav links; `/about/` 301 → `/`; social links dropped by default). M5–M6 should not invest in it. | Owner |
| 2026-10-27 | M5 | htmx wiring | htmx 2.0.11 vendored; boost attrs on `<body>` (PLAN said div.page), `hx-history-elt` on `div.page`; animate `#main > *` via transitions; reduced motion keeps opacity fade; full-nav fallback on errors/non-HTML | autopilot (council) |
| 2026-10-27 | owner | Header wordmark font | "Simonas Sankauskas" logo uses the nav face: `var(--font-mono)` at `var(--mono-size)` (Departure Mono), underline on hover like nav links. Applied in styles.css during M5; do not revert to serif. | Owner |
| 2026-10-27 | owner | Sea character | Calm, slow, glassy swell with soft crests; current M1 sea is "stormy, too aggressive, too many spiky edges". Fix first in M6. | Owner |
| 2026-10-27 | owner | Horizon / composition | Golden ratio: sky = top 61.8%, sea = bottom 38.2% (horizon 38.2% from bottom). Applies to shader camera, `HORIZON` in ocean.js, and CSS `--scene-horizon-from-bottom`. | Owner |
| 2026-10-27 | owner | Parallel lanes | M6a (calm sea + golden-ratio horizon) runs on branch `rewrite-sea` in worktree `../simonas-dev-sea`; M6 on `rewrite` skips those items. M7 video encodes are produced outside the repo in `~/Projects/simonas-dev-video/` and copied in by M7. | Owner |
| 2026-10-27 | owner | Video quality | Preserve original quality: 4K tier (AV1 10-bit + HEVC Main10 at ~original bitrate) for large/hi-DPI screens, 1080 AV1 + H.264 otherwise; seamless 12.25 s loop from a lossless cut. Overrides the ≤ 2 MB/file target for the 4K tier. Raw original file is not served (browser support, 34 MB, moov-at-end, loop jump). | Owner |
| 2026-10-27 | owner | M6a sea look approved | Owner approved the calm sea + 38.2% horizon as previewed from `rewrite-sea` (PEAK 0.6, tw 0.9, WATER_DEPTH 0.75, CAMERA_HEIGHT 1.25, PITCH -0.1561, drift 0.08, swell 0.015). Treat as the baseline; later work must not make the sea busier. | Owner |
| 2026-10-27 | owner | Domain | **https://simonas.dev** (already the Vercel production domain). `base_url` switched from simonas-dev.vercel.app. Resolves PLAN "Domain" open decision. | Owner (Vercel) |
| 2026-10-27 | owner | Vercel build | Zola **musl** build (gnu needs GLIBC_2.35, Vercel image lacks it). Project Node.js setting 18.x → 24.x (18 is discontinued; was blocking all builds; Zola doesn't use Node). `.vercelignore` keeps `.pi/`, `.council/`, notes out of uploads. `/tags/*` redirect needs both slash variants (trailingSlash runs first). Preview deploys only via `vercel deploy` from a clean worktree of a commit; never `--prod`. | Owner session |
