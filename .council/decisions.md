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
| | | Domain (vercel.app / simonas.dev) | _open_ | |
| | | Featured projects on home | _open_ | |
