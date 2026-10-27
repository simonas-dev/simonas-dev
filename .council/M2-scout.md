# M2 scout — Typography & chrome

## Files
- `PLAN.md` L96-102 — M2 checklist (fonts preload+swap; tokens clamp() scale, `--frame-inline/--frame-block` ≈75px desktop/≈20px mobile, `#353431` on `#faf9f6`, night `#1a1a1a`/`#2e2d2b`; header logo top-centre + mono nav top-right; footer name/© left + theme toggle right; hero aligned to `--scene-horizon-from-bottom` from JS; mobile menu panel paper texture + gradient mask).
- `.council/decisions.md` — Serif font row still `_open_ (M2)` (Newsreader/Fraunces/Plantin). M1: WebGL fallback flat #faf9f6 until paper.png in M4.
- `.council/M1.md` L62-80 Outcome — horizon = 0.5+0.5·1.5·tan(0.12) ≈ **0.5905** of viewport height, aspect-independent. Notes: default blue links ≈4.0–4.6:1 over troughs → M2 must set links `#353431`; mobile logo overlaps nav → M2; ocean.js has only **~15 B headroom under 10 KB** budget.
- `templates/base.html` (whole, ~35 lines): head has styles.css, 2 GLSL preloads, `ocean.js` defer. Body: skip-link, `canvas#ocean`, `a.logo` (text = config.title), `div.page > main#main`, `header.chrome > nav` (About/Posts/Photos), `footer.chrome` (© year Simonas Sankauskas + RSS link). No font preloads, no theme toggle, no mobile menu.
- `templates/index.html` — just `{{ section.content | safe }}`; no hero wrapper.
- `content/_index.md` — `# Simonas Sankauskas` / "Senior Software Engineer, Android." / list of About/Posts/Photos links.
- `static/styles.css` (~110 lines) — z-index vars (canvas 0, logo 10, page 100, chrome 200), body bg/colour, canvas fade 1000ms bezier, `.shader-ready #ocean{opacity:1}`, fixed logo top:1rem centred, `.page` padding 4rem 1.25rem pointer-events none, `.chrome` fixed flex, header right-aligned, skip-link, focus-visible. No tokens, fonts, type scale, night colours, link colour.
- `static/ocean.js` L7 guard `window.__ocean`; L35 `var state = window.__ocean = { speed: 1, night: 0, tier: null };` L161 speed, L165 u_night; L216/228 adds `shader-ready` on `<html>`; L291-294 ResizeObserver/resize. No horizon export. Camera consts live only in `static/shader/ocean.frag.glsl` L20-26 (formula comment at L20).

## Horizon hook
Since horizon is aspect-independent constant (ignoring 0.03 swell), the cheapest option is a CSS default `--scene-horizon-from-bottom: 59.05svh` (or calc) in styles.css, plus a tiny JS set in ocean.js (`root.style.setProperty('--scene-horizon-from-bottom', (0.5+0.75*Math.tan(0.12))*100+'%')`) — but byte budget is ~15 B, so either minify/raise budget or set in CSS only (checklist says "updated from JS"; flag to supervisor). Use innerHeight vs svh/dvh carefully on mobile (canvas is `position:fixed; inset:0`, i.e. layout viewport).

## Fonts (checked, nothing downloaded into repo; scratch in /tmp/m2fonts)
| Font | License | Source | Variable | latin woff2 regular+italic |
|---|---|---|---|---|
| Departure Mono v1.500 | OFL-1.1 (Helena Zhang) | https://github.com/rektdeckard/departure-mono/releases/download/v1.500/DepartureMono-1.500.zip (has .woff2) | no, Regular only, no italic | 22,496 B (full, not subset; subsetting could shrink) |
| Newsreader | OFL-1.1 | npm @fontsource/newsreader 5.3.0, @fontsource-variable/newsreader | yes (wght, opsz) | static 400: 22.5K+24.3K=46.8K; var wght: 58.1K+64.5K=122.6K; standard(opsz) 132K+147K |
| Fraunces | OFL-1.1 | @fontsource/fraunces 5.3.0 / -variable | yes (wght, opsz, SOFT, WONK) | static: 18.0K+22.9K=40.8K; var wght: 36.6K+45.7K=82.3K |
| EB Garamond | OFL-1.1 | @fontsource/eb-garamond 5.3.0 / -variable | yes (wght) | static: 23.8K+25.4K=49.2K; var: 44.3K+47.9K=92.3K |
| Source Serif 4 | OFL-1.1 | @fontsource/source-serif-4 5.3.1 / -variable | yes (wght, opsz) | static: 20.1K+20.1K=40.2K; var wght: 50.9K+51.6K=102.5K |
Files at `package/files/<name>-latin-400-{normal,italic}.woff2` (static) or `<name>-latin-wght-{normal,italic}.woff2` (variable). Tarballs: `https://registry.npmjs.org/@fontsource/<name>/-/<name>-<ver>.tgz`. Plantin is commercial (Monotype) — not freely licensable.

## Tooling
- No `pyftsubset`/fontTools/brotli installed, no `woff2_compress`. Available: `uvx` (`uvx --from 'fonttools[woff]' pyftsubset ...` would work without polluting repo), pip3, brew. Fontsource latin files are already latin-subset, so subsetting is optional (mostly for Departure Mono).
- `/tmp/pw` (outside repo): `shot.mjs` (screenshots gl_*.png, waits shader-ready, env NOGL/W/H/WAIT/TAG/SLOW), `lifecycle.mjs`, `stats.mjs`. Requires `zola serve --interface 127.0.0.1 --port 1111`. Use W=390 H=844 for mobile overlap check.

## Gaps vs M2
All unchecked: no fonts/preloads/@font-face; no tokens/clamp scale/frame vars/night vars; logo not wordmark-styled & overlaps nav on mobile; nav not mono; footer has RSS instead of theme toggle (toggle logic is M3 — M2 just places a button); no hero markup/horizon var; no mobile menu panel (paper.png doesn't exist until M4 — needs placeholder/CSS noise); links colour unset. Decision needed: serif choice (record in decisions.md).
