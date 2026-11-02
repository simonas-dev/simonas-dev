Playwright checks used while building simonas.dev (copied from the throwaway
/private/tmp/pw harness). See worklog/2026-10-27-nextra-to-zola-ocean-rewrite/workflow.md §5 for what each one checks.

    npm i && npx playwright install chromium webkit
    node links.mjs https://simonas.dev

Defaults to the local preview at http://127.0.0.1:1112. Screenshots go to
/private/tmp/...; adjust paths if needed.

## ui.mjs — UI requirements (UI-1, UI-2, UI-3)

Checks `UI-REQUIREMENTS.md` on `/`, `/digital-sun/`, `/posts/` and `/404.html`
at touch-320, touch-390 (touch + mobile emulation, `pointer: coarse`) and
desktop-1280:

- UI-1: standalone targets (links, buttons, `<summary>`, form controls) are
  ≥ 44×44 on coarse pointers, ≥ 24×24 on fine; inline links in `p`/`li` prose
  inside `.content-surface` are exempt; the skip link is measured while
  focused; overlapping hit areas fail.
- UI-2: every visible `a[href]` is underlined at 1px at rest, on hover
  (desktop, also no offset/colour change) and with `aria-current`; also scans
  `static/**/*.css` for `text-decoration: none` on selectors that could match
  `a`.
- UI-3: `header.chrome` has links, exactly one `aria-current="page"` link to
  the current path, one parent link (an ancestor; none on `/`) left of it, only
  direct children right of it, no `<details>`/`<summary>`/Menu button, no
  "Back"/"←" link, and every header link visible, inside the viewport and
  unclipped. Region texts are printed per page for comparison with the
  worked example.

    zola build && zola serve -p 1115 &
    node ui.mjs http://127.0.0.1:1115

Prints a PASS/FAIL table per rule/page/viewport plus failure details; exits 1
on any FAIL.
