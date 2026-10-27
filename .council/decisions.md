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
