# M5 scout — htmx navigation

## Plan / decisions
- `PLAN.md:116-120`: boost + `hx-select/target="div.page"`, `outerHTML swap:220ms`, leave/enter anims, scroll memory, error fallback. No htmx entry in `.council/decisions.md`.
- `.council/M4.md:21,34,78`: `oceanMode()` is named so M5 can re-call it after swap; M4 deferred "re-run oceanMode on swap, speed tween between modes, scroll memory". `.council/M3.md:17`: theme toggle click is delegated (survives swaps).

## templates/base.html: what's in and out of the swap
- **Outside `div.page`** (persists, never swapped): `<head>` (title, description meta, theme inline script, CSS, `ocean.js`/`site.js` defer), skip link, `canvas#ocean`, `.logo`, `header.chrome` (inline nav + `<details class="menu">`), `footer.chrome` (year, RSS, `.theme-toggle`).
- **Inside**: `div.page > main#main > {% block content %}`. `.content-surface` sits in the content, so the `body:has(.content-surface)` scrims (`styles.css:277,289,298`) follow the swap on their own.
- Hook: put `hx-boost="true" hx-select="div.page" hx-target="div.page" hx-swap="outerHTML swap:220ms"` on `<body>` (inherited). Add `<script src="/htmx.min.js" defer>` before `site.js`. Mark the RSS link (`/feed.xml`) and any non-HTML links `hx-boost="false"`. Boost only touches same-origin links.
- **Gaps:** `<meta name="description">` is not updated on boost (htmx only updates `<title>`, and it's fine for SEO). There is no `aria-current` anywhere in templates. If M5 adds it, it has to be set in JS after swap, because the header is outside the swap.

## static/site.js (3,738 B, one IIFE)
- `:66-73`: delegated click handler for the theme toggle. `:82-87`: `pageshow` (persisted) re-reads the theme. `:91-99`: `oceanMode()` sets speed/res/fps and calls `resize()`. `:101-102`: init.
- **Hooks to add:**
  - On `htmx:afterSettle`, call `oceanMode()`. The plan also wants a speed tween (reuse the `tweenNight` pattern at `:40-57`).
  - On `htmx:beforeRequest` or after swap, close the menu: `document.querySelector('.menu').open=false`.
  - Handle focus.
  - Add error fallback: on `htmx:responseError`, `htmx:sendError`, `htmx:swapError`, `htmx:targetError`, `htmx:historyCacheMissLoadError`, set `location.href = evt.detail.pathInfo?.requestPath || xhr.responseURL`.
  - Optionally `htmx.config.refreshOnHistoryMiss=true` (full reload on a cache miss).
- `pageshow` still fires for bfcache restores of the full document. No change is needed, but test back across a full-load boundary.

## static/ocean.js
10,238 B against a 10,240 B budget. It already exposes `speed/res/fps/resize/redraw/night` on `window.__ocean`. **M5 shouldn't touch it.** Any speed tween belongs in `site.js`.

## static/styles.css (10,824 B)
- `.page` at `:174-184` is `position:relative; z-index; pointer-events:none`. It has no animation yet.
- The only reduced-motion block is `:367-371` (menu, 220ms `var(--ease)`). Copy it for the page animations:
  - `.page.htmx-swapping { animation: page-out 220ms }` (the swap delay matches 220ms)
  - `.page.htmx-added`/`htmx-settling` for enter, wrapped in `@media (prefers-reduced-motion: no-preference)`
- With `outerHTML`, the new `div.page` gets `htmx-added` and then settles (default settle is 20ms). The enter animation is safest via `@keyframes` on `.htmx-added`, or as a plain `.page` load animation (that also runs on first load, so decide which you want).
- Risk: the `.hero` `min-height` (`:192`) relies on layout. Check that a transform/opacity animation doesn't make the `body:has()` scrims flicker.

## htmx 2 facts (checked against dist 2.0.11)
- `npm view htmx.org version` → **2.0.11**. `dist/htmx.min.js` is **52,182 B raw, 16,885 B gzip -9**. Downloaded to `/tmp/htmx.min.js` (not in repo). Vendor it as `static/htmx.min.js`. The JS budget (<150 KB) is OK.
- Defaults: `historyEnabled:true`, `historyCacheSize:10`, `refreshOnHistoryMiss:false`, `defaultSwapDelay:0` (the `swap:220ms` modifier overrides it), `scrollIntoViewOnBoost:true`, `ignoreTitle:false`, `historyRestoreAsHxRequest:true`.
- **History:** boost pushes the URL and snapshots the body HTML into localStorage before swapping, and saves/restores `window.scrollY`. Back/forward restores the snapshot and scroll position, so scroll memory is mostly built in.
  - On a cache miss, htmx re-fetches with an `HX-Request` header. That's fine on a static Zola site because the full page comes back and is selected.
- **Scroll to top on forward nav:** with `scrollIntoViewOnBoost`, the boosted target is scrolled into view (`show:top`-ish). Since the target is `div.page` and not body, add `show:window:top` (or `scroll:top`) to `hx-swap` to be deterministic.
- **Snapshot caveat:** the snapshot is the current body. Transient classes (`htmx-swapping`), the open menu, and the canvas element are stored too.
  - The canvas is outside `.page`, but the history restore replaces the **whole body**. That would destroy `canvas#ocean`'s WebGL context. **Biggest risk.**
  - Mitigation: set `htmx.config.historyEnabled` with a custom approach, or keep the canvas stable via `hx-history-elt` on `div.page`. htmx 2 snapshots and restores the `[hx-history-elt]` element instead of body. Put `hx-history-elt` on `div.page`, or a wrapper that excludes the canvas.
  - Then re-run `oceanMode()` on `htmx:historyRestore`.
- **Title:** `ignoreTitle:false`. htmx parses `<title>` from the full response before `hx-select`, so `document.title` updates. Verify this in Playwright.
- **Errors:** `htmx:responseError` (4xx/5xx; by default the swap is not done), `htmx:sendError` (network), `htmx:swapError`, `htmx:targetError`, `htmx:historyCacheMissLoadError`, `htmx:oobError`. The task's `htmx:historyCacheMissError` doesn't exist in 2.x; the event is `historyCacheMissLoadError`.
  - A 404 under Zola: `responseError` → do a full navigation so the 404 page renders.

## a11y
- After a swap, focus stays on the clicked link (in the header, which persists) or drops to body. Move focus to `main#main` (`tabindex="-1"`, `preventScroll`) or announce the new title via a live region.
- `html{scroll-padding-block}` from M4 helps.
- Update `aria-current="page"` on the nav links (in both the inline and menu nav) after swap.
- Reduced motion: skip the swap delay too (set `swap:0` via `htmx:beforeSwap` `evt.detail.swapOverride`, or accept 220ms of no visual change).

## /tmp/pw harness
- Playwright is in `/tmp/pw/node_modules`. Scripts:
  - `m4check.mjs`, `m4scroll.mjs`, `m3check.mjs`, `lifecycle.mjs` (canvas/GL lifecycle; reuse it to assert the canvas survives nav and back)
  - `race.mjs`, `stats.mjs` (fps), `shot.mjs`
- Zola logs are in `zola-m*.log`.
- Write `m5check.mjs`. It should check:
  - title changes
  - `#ocean` is the same node after click, back and forward
  - `scrollY` is restored on back and is 0 on forward
  - the 404 fallback loads fully
  - the menu closes
  - fps throttle toggles via `stats.mjs`

## Residual risks
- Body-level history restore killing the GL canvas (use `hx-history-elt`).
- localStorage snapshot of the large photos page (cache size 10).
- `show:window:top` vs the default scroll behaviour.
- Title/description staleness.
