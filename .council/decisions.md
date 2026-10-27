# Decisions log

Settled answers to PLAN.md "Open decisions" and anything the council escalates.
Advisors treat entries here as the contract. Newest last.

| Date | Milestone | Decision | Choice | Why |
|------|-----------|----------|--------|-----|
| 2026-10-27 | setup | Site generator (Zola / Eleventy) | **Zola** (0.23.6 installed locally) | Owner |
| 2026-10-27 | setup | Branching | All rewrite work on `rewrite` branch; `main` and the live deploy untouched until owner merges. Overrides PLAN.md "do it on main". | Owner |
| 2026-10-27 | setup | Execution mode | Milestone by milestone on autopilot: commit per milestone on `rewrite`, never push, never `--prod` deploy | Owner |
| 2026-10-27 | setup | What gets committed | Follow `.gitignore`: build output (`public/`), `.vercel/`, env files, `.pi/*` runtime state are ignored; `.pi/agents`, `.pi/prompts`, `.council/`, `AGENTS.md`, `PLAN.md` are tracked | Owner |
| | | Serif font (Newsreader / Fraunces / Plantin) | _open_ (M2) | |
| 2026-10-27 | M0 | Domain / `base_url` | **https://simonas-dev.vercel.app** for now; revisit if simonas.dev is bought | autopilot (no domain owned; keeps feed URL stable) |
| | | Featured projects on home | _open_ | |
| 2026-10-27 | M0 | Vercel deploy in M0 | Write `vercel.json` only; preview deploy deferred (CLI logged out, project not linked); prod/main untouched | autopilot (credentials needed) |
| 2026-10-27 | M0 | Photo originals | Resize in place to 2400px; originals kept only in git history | autopilot (council unanimous) |
| 2026-10-27 | M0 | Home vs About | `/` = minimal home stub; About content at `/about/` | autopilot (council rec, PLAN layout) |
| 2026-10-27 | M0 | Old URLs / feed | `/posts/wizard` alias + vercel 301; `/tags/*` 301 → `/posts/`; `/feed.xml` stays RSS 2.0 | autopilot (council rec) |
| 2026-10-27 | M1 | Shader architecture | Single-pass WebGL1, GLSL fetched from `static/shader/` (+ preload), quality via `#define` tiers 0.4/0.375/0.35 | autopilot (council unanimous) |
| 2026-10-27 | M1 | Shader day endpoints | Day `light` = #faf9f6 (0.980,0.976,0.965), warm-tinted `dark`; night per PLAN | autopilot (perf+designer; avoids seam vs body bg) |
| 2026-10-27 | M1 | WebGL fallback | Flat `#faf9f6` body until paper.png lands in M4 | autopilot (council unanimous) |
