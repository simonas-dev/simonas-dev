# AGENTS.md

This repo is being rewritten from a Nextra blog into a static Zola site.

- Source of truth: `PLAN.md` (milestones M0–M6).
- Settled decisions: `.council/decisions.md`. Do not re-decide these silently.
- Per-milestone memos and outcomes: `.council/M*.md`.
- How the work is run (council loop, lanes, polish loop, checks, ship): `worklog/2026-10-27-nextra-to-zola-ocean-rewrite/workflow.md`; one folder per vibe-coding session under `worklog/` (README eval, timeline, prompts, stats, compressed logs; export with `tools/worklog-export.py`).
- Work one milestone at a time via `/milestone M<n>` on the `rewrite` branch.
- Never push and never deploy with `--prod`. Commit only with explicit
  approval, or when running `/milestone --autopilot` (owner pre-approved
  per-milestone commits on `rewrite`).

## Design rules (owner, binding)

- **All hyperlinks are underlined at rest**, not only on hover or focus. This
  includes the logo, nav and menu links, footer links and links in content.
  The underline weight is fixed (1px): hover, focus and current-page states
  must not change or remove it (hover feedback is the faint background wash). Buttons and `<summary>` are not links. Never add
  `text-decoration: none` to an `<a>`; the base rule lives on `a` in
  `static/styles.css`.
