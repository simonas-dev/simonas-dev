# M4 scout — Content pages

## State vs checklist (PLAN.md:109-114, all unchecked)
- **Templates** (`templates/`): base.html, index.html, page.html, section.html, post.html, feed.xml (custom RSS 2.0 copy), internal/alias.html. All three PLAN layouts already exist, but they're bare:
  - page.html: just `{{ page.content }}`.
  - post.html: `<article><header><h1>` plus a `<time>` date. **No reading time** (use `page.reading_time`).
  - section.html: h1, content, `<ul>` of title + date.
  - None of them use a `.content-surface` wrapper. Wrap it inside `{% block content %}` (base.html:39-41 `<div class="page">`, which M5 uses as the htmx target, so don't rename it).
- **Content:** `_index.md` (home/hero), about.md, photos.md (no template, so they get page.html). posts/_index.md has `sort_by="date"` and `page_template="post.html"`. posts/ballistic-wizard.md has `date = 2024-06-27` and alias /posts/wizard. Its body has no `# h1` (post.html supplies one), but about/photos do have a markdown `# h1`.
- **config.toml:** `generate_feeds=true` and `feed_filenames=["feed.xml"]` are set, so the feed is done at the root (decision M0: RSS 2.0 at /feed.xml). No taxonomies. `[markdown]` is empty, so there's **no syntax highlighting**. If code needs styling, add `highlight_code`/theme or `highlighting` (0.23 uses a newer `[markdown.highlighting]` schema, so check the docs). Plain `pre/code` mono CSS may be enough.
- **styles.css** (7342 B):
  - Tokens are at 45-91: `--paper #faf9f6`, `--surface`, `--ink`, `--font-serif` Newsreader, `--font-mono` Departure Mono, `--lh: 1.6`, `--measure: 68ch`, plus night overrides at 89-91.
  - `.page` rules are at 161-171 (pointer-events none on padding, auto on children).
  - The menu panel at 317-318 uses `background: var(--paper) var(--paper-texture, none)`. That's the hook: define `--paper-texture: url(/paper.png)` in `:root`.
  - There are no prose, `.content-surface` or `img` rules yet. M2 noted that text scrolls under the header and footer until the surfaces land.
- **Paper texture:** `static/paper.png` **does not exist**.
  - PIL is **not** installed.
  - Available tools: ffmpeg (`/opt/homebrew/bin`), e.g. `ffmpeg -f lavfi -i "color=c=#faf9f6:s=256x256,noise=alls=12:allf=u" -frames:v 1 paper.png`; it isn't tileable by default, but grain noise looks seamless enough. sips, cwebp, and pure-Python zlib PNG writing are also options.
  - No ImageMagick.
  - Decision M1 says the WebGL fallback becomes paper.png in M4, so body/no-webgl should also get the texture.
  - For "97% tint", one option is `background: linear-gradient(color-mix(in srgb, var(--surface) 97%, transparent) 0 0), var(--paper-texture); backdrop-filter: blur(…)`.

## Photos
| file | px | bytes |
|---|---|---|
| static/images/DSCF2021.JPG | 2400×1600 | 506 KB |
| static/images/R1-09309-017A.JPG | 2400×1617 | 952 KB |
| static/images/baller-wizard.jpg | 1024×1024 | 158 KB (post image) |

- photos.md uses raw `<img>` tags with width/height and alt, but **no `loading="lazy"`** and no WebP.
- Images live in `static/`, so Zola `resize_image` won't see them (it needs paths under content/ or static/? `resize_image(path=...)` accepts static-relative paths in 0.23, so verify). zola is 0.23.6, and `resize_image(..., format="webp")` is supported. Options:
  - (a) A shortcode `photo(src, alt)` that emits `<picture><source type=image/webp srcset=resize_image(...webp)><img loading=lazy decoding=async ...>`.
  - (b) Precompute .webp files with `cwebp` (installed) and commit them.
- Full-bleed means breaking out of the 68ch surface (`width:100vw; margin-inline:calc(50% - 50vw)` or a grid).
- Decision M0: originals are resized in place to 2400px.

## Shader content-mode (static/ocean.js: **10,190 B / 10,240 → 50 B headroom**)
- `state = window.__ocean = {speed:1, night, tier}` (ocean.js:35). `waveTime += dt*state.speed` (ocean.js:161). site.js:40 already reads `window.__ocean`, so **speed ×0.15 can be done from site.js** (`__ocean.speed = .15` when `.content-surface` exists / is intersecting) at zero cost to ocean.js.
- Resolution: in `applySize()`, `scale = TIERS[tierIndex].scale` (ocean.js:140-142). Use something like `* (state.res||1)` (~15 B), and set `sizeDirty=true` on change. sizeDirty isn't exposed, so site.js could dispatch `resize` if there's a resize listener; check that.
- 15 fps cap: in `frame(now)` (ocean.js:209-222), skip draw when `now - lastFrameTime < state.minDt`. That costs about 40 B and must not corrupt probe deltas, since stepProbe uses `delta` from lastFrameTime. Skip only when `!probe`.
- All three together likely exceed 50 B. Plan to trim comments/identifiers in ocean.js first (the M2/M3 precedent), or move fps logic out. Note M3 deferred static-tier tween wave advance for the same budget reason.
- Static tier (`drawStatic`, ocean.js:224+) has no loop, so it's unaffected.

## Harness
/tmp/pw: crop.mjs, lifecycle.mjs, m2check.mjs, m3check.mjs, m3contrast.mjs, race.mjs, shot.mjs, stats.mjs (Playwright screenshots/stats). Copy m3check as the base for an m4check (surface present, `__ocean.speed===.15`, canvas width ≈ half, rAF draw rate).

## Start here
Start with static/styles.css (tokens + the 317 hook), then templates/page.html, post.html and section.html, then ocean.js:140 and :209 for content-mode.

## Risks
- ocean.js byte budget.
- backdrop-filter cost on top of WebGL.
- resize_image path rules for static/ images.
- Night mode needs a dark paper variant (`--surface #2e2d2b` tint should cover it).
- The about/photos markdown h1 vs a template h1 (avoid a duplicate).
