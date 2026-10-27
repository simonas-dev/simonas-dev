# M6 scout (rewrite branch, non-M6a items)

## State
- Branch `rewrite`; dirty owner files (.gitignore, config.toml, vercel.json, .pi/prompts/milestone.md, ?? .vercelignore) — do not touch.
- Sizes: `static/ocean.js` 10,238 B (budget 10,240 → **2 B headroom**; M4.md:101 already flags that ripples, logo texture and stars **cannot fit**, so this needs an owner budget decision first). `site.js` 9,652 B, `ocean.frag.glsl` 5,347 B, `htmx.min.js` 52,182 B. Total JS is about 72 KB raw, well under the 150 KB target.

## static/ocean.js hooks
- TIERS L11-15 (M6a edits the `normal` values), UNIFORM_NAMES L30 (add `u_ripples`, `u_logo` and so on here), HORIZON L32 (M6a: **do not touch**), `state = window.__ocean` L35 {speed,res,fps,resize,night,tier}.
- The tier probe (`stepProbe` ~301, `settleStatic` ~289) and `buildProgram` ~169 (uniform lookup at 212-219) both appear in a `tr`-split listing with shifted line numbers. Real line numbers are approximate; grep before editing.
- `draw(now)` ~256-275 sets iTime/u_waveTime/u_grainTime/u_night. `frame` ~345-367 is the rAF loop, `stopLoop` ~115, `drawStatic` ~371, `state.redraw` ~382, `start` ~388, `init` ~450, `onResize` ~476, `webglcontextlost` ~495.
- **No** `visibilitychange` or `prefers-reduced-motion` handling exists in any static/*.js. Speed is driven from site.js through `state.speed`, so reduced-motion can scale `state.speed` while grain keeps running (grain uses its own 24 Hz `u_grainTime`).

## static/shader/ocean.frag.glsl
- Uniforms L7-12: iResolution, iTime, u_waveTime, u_grainTime, u_night, u_noiseScale.
- Camera consts L22-27 and SUN_DIR L29. M6a changes the camera/wave consts, `wavedx`/`getwaves`, WATER_DEPTH and adds PEAK. **Off-limits.**
- `sky(dir)` L79-85: grey gradient plus sun lobe, with no night term. Stars (hashed grid on dir) and the moon/sun glow can go here, mixed by `u_night`. `sky()` is also used for reflections (main, `sky(R)`).
- `post(color, uv)` L99-110 handles grayscale, NIGHT_DIM, gaussian grain and the ink mix. The logo texture should probably be composited just before `post` (or inside it on uv) so it gets grain.
- `main` L111+: the water branch computes `hit.xz`. Ripples can perturb `N` (around M6a's new `eps` line, so expect a conflict there) or the height in `getwaves`, which M6a also edits. Prefer adding a separate ripple term to N after the `waterNormal` call.
- Pointer→water projection in JS needs the camera consts (HEIGHT 1.25 and PITCH −0.1561 after M6a, FOCAL 1.5). Do it on M6a's values after the merge, or project in the shader by passing screen-space ripple points (`u_ripples[10]` as vec3 xy+time) and intersecting in GLSL. The shader-side approach avoids duplicating constants and saves JS bytes.

## templates / config
- `templates/base.html` L11: only `<link rel="icon" href="/favicon.ico">`. **No OG/twitter meta, no SVG/dark favicon, no apple-touch-icon.** L6 `color-scheme light`, L9 description block, L25 `.logo` is a text wordmark (the shader logo would duplicate or replace it; it's the mono wordmark per decisions).
- `static/favicon.ico` has 16 and 32 px icons, 32-bit.
- **`templates/404.html` is missing.** Zola renders it to /404.html; check how vercel.json serves it (owner edit, read only).
- config.toml has base_url, title, description, feeds and link_checker. There is no `[extra]` og image key (config.toml is owner-dirty, so put the OG path in the template instead).
- M5 deferred items in site.js: speed tween, `aria-current`, live-region title, meta description on swap. M4 deferred: 1800w WebP for R1. M3 deferred: stars/glow, reduced-motion, visibilitychange.

## rewrite-sea (M6a) diff vs base
4 files, +24/−18: `.council/decisions.md` (+2), `ocean.js` (TIERS normals, HORIZON→0.382 plus comment), `ocean.frag.glsl` (WATER_DEPTH, PEAK, camera consts, wavedx/getwaves, the eps normal line in main), `styles.css` (`--scene-horizon-from-bottom` 38.2vh/dvh at ~L75). M6a.md summary says the look is approved.
**Conflict risks:** UNIFORM_NAMES L30 is adjacent to the HORIZON hunk (L31-32), so put additions elsewhere or keep the hunks separated. The `waterNormal` line in main and the frag header around L13-20 will also conflict, so add new uniforms after L12 without touching the `#define` block. decisions.md: append rows only.

## Tooling
- lighthouse: not on PATH and not in the npx cache. Running `npx -y lighthouse` into /tmp needs network.
- /tmp/pw has playwright, playwright-core and pngjs. `~/Library/Caches/ms-playwright` has chromium-1248 and the headless shell, usable as CHROME_PATH for lighthouse.
- ImageMagick and rsvg-convert are absent. `sips` and `ffmpeg` (/opt/homebrew) are available. Playwright screenshots can rasterise SVG to the OG PNG and favicon PNGs. ffmpeg can write .ico.

## Gaps / risks
- The JS byte budget is the blocker and needs an owner decision. Options: raise the budget, minify, or move logic into GLSL.
- The logo texture needs canvas-2D text using the DepartureMono font. It has to wait for fonts to load (`document.fonts.ready`) and costs bytes.
- Do not edit owner-dirty files.
