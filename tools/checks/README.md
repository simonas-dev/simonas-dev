Playwright checks used while building simonas.dev (copied from the throwaway
/private/tmp/pw harness). See worklog/2026-10-27-nextra-to-zola-ocean-rewrite/workflow.md §5 for what each one checks.

    npm i && npx playwright install chromium webkit
    node links.mjs https://simonas.dev

Defaults to the local preview at http://127.0.0.1:1112. Screenshots go to
/private/tmp/...; adjust paths if needed.
