# M7 scout — Video page (branch `rewrite`, tree clean, `zola build` passes: 1 page, 1 section, 12 ms)

## Files
- PLAN.md 164-202 (M7 checklist); .council/decisions.md 35-36 (video lane/quality), 45, 47 (menu keeps one item until M7 adds one)
- templates/base.html (whole file), page.html, components/photo.html, feed.xml, sitemap.xml
- static/site.js 100-125 (oceanMode), 215-295 (htmx hooks); static/ocean.js 34, 326-333
- ~/Projects/simonas-dev-video/preview.html 7-34, out/

## 1. Templates
- base.html layers, in order: `<canvas id="ocean">` → `a.logo` → `header.chrome` → `div.page[hx-history-elt] > main#main > {% block content %}` → `footer.chrome`. body has `hx-boost hx-select="div.page" hx-target="div.page" hx-swap="outerHTML swap:220ms show:window:top"`. Scripts are deferred: ocean.js, htmx.min.js, site.js.
- page.html extends base and wraps content in `<article class="content-surface{% if wide %} wide{% endif %}">`. A lot keys off `.content-surface`: CSS `body:has(.content-surface)` (styles.css 268/280/289) and site.js oceanMode/ripples. A video template should NOT use `.content-surface`, otherwise the ocean only throttles instead of pausing.
- Nav: `nav.nav-inline` link plus `<details class="menu"><summary>Menu</summary><nav class="menu-panel">`. Each has one link, Photos, with `aria-current` set when `current_path == "/photos/"`. Add the video link in both places.
- **There are no photo captions.** photo.html is `figure.bleed > picture` with no figcaption, and styles.css has no caption class. The mono style to reuse is `font-family: var(--font-mono); font-size: var(--mono-size)` (0.6875rem; styles.css 56, 63, 164, 222). The caption class has to be created new.

## 2. JS
- Sizes: ocean.js 10,919 B (budget 11,264, so 345 B left), site.js 12,319 B, htmx.min.js 52,182 B.
- API: `window.__ocean = {speed, res, fps, resize, night, tier, ripples, redraw...}` (ocean.js 34). site.js `oceanMode(animate)` sets speed 0.15/1 (×0.3 when reduced), res 0.5, fps 15 for content pages. **There is no pause/resume knob.** ocean.js has a local `stopLoop()`/rAF restart, used only by visibilitychange (326-333) and context loss. M7 needs a `state.paused` flag (or `state.pause()`/`resume()`) in ocean.js, which must fit the 345 B headroom. It also needs a check in the visibilitychange restart and in frame().
- htmx hooks in site.js: beforeSwap (237, bails to a full nav if the response lacks `hx-history-elt`), afterSwap (276, forces a computed opacity for the fade), afterSettle (281 → `afterPageChange()` + focus main), historyRestore (292 → afterPageChange). The video-mode switch and the `.play()` call belong in afterPageChange/oceanMode. Popstate is guarded at 223.
- Reduced motion: `reduceQuery` matchMedia with a change listener → oceanMode. There is no Save-Data/connection check anywhere yet.

## 3. Config / deploy
- config.toml: `generate_feeds=true`, `feed_filenames=["feed.xml"]`. The feed is root-level (all dated pages). Built public/feed.xml has 0 items; photos.md has no `date` and isn't listed. **Leaving `date` off the video page keeps it out of the feed.** sitemap.xml only filters /posts/, so the video page will appear in the sitemap (fine).
- vercel.json has no `headers` block, so nothing caches /video/* (4K files are 7-9 MB, so consider adding immutable/long cache). Vercel serves Range requests by default.
- .gitignore: **`*.mov` is NOT listed** (PLAN item). .vercelignore does have `*.mov`/`*.mkv`.

## 4. Assets (~/Projects/simonas-dev-video/out, 60 MB total)
poster-1080.avif 9,383 · poster-1080.webp 30,890 · poster-portrait.avif 6,825 · poster-portrait.webp 25,774 · video-1080.av1 842,196 · video-1080.h264 2,315,246 · video-2160.av1 7,477,435 · video-2160.hevc 8,943,139 · video-portrait-1080.av1 823,678 · video-portrait-1080.h264 2,166,669 · video-portrait-2160.av1 3,814,140 · video-portrait-2160.hevc 4,306,046.
preview.html verbatim:
```
video { position: fixed; inset: 0; width: 100%; height: 100%; object-fit: cover; }
video::-webkit-media-controls,
video::-webkit-media-controls-start-playback-button { display: none !important; -webkit-appearance: none; }
@media (prefers-reduced-motion: reduce) { video { display: none; } body { background: #000 url(out/poster-1080.webp) center/cover; } }
<video autoplay muted loop playsinline disablepictureinpicture disableremoteplayback aria-hidden="true"
       poster="out/poster-1080.avif">
  <source media="(orientation: portrait) and (min-width: 700px) and (min-resolution: 1.5dppx)" src="out/video-portrait-2160.av1.mp4"  type='video/mp4; codecs="av01.0.12M.10"'>
  <source media="(orientation: portrait) and (min-width: 700px) and (min-resolution: 1.5dppx)" src="out/video-portrait-2160.hevc.mp4" type='video/mp4; codecs="hvc1.2.4.L150.B0"'>
  <source media="(orientation: portrait)" src="out/video-portrait-1080.av1.mp4"  type='video/mp4; codecs="av01.0.08M.10"'>
  <source media="(orientation: portrait)" src="out/video-portrait-1080.h264.mp4" type='video/mp4; codecs="avc1.640033"'>
  <source media="(min-width: 1600px), (min-width: 1000px) and (min-resolution: 2dppx)" src="out/video-2160.av1.mp4"  type='video/mp4; codecs="av01.0.12M.10"'>
  <source media="(min-width: 1600px), (min-width: 1000px) and (min-resolution: 2dppx)" src="out/video-2160.hevc.mp4" type='video/mp4; codecs="hvc1.2.4.L150.B0"'>
  <source src="out/video-1080.av1.mp4"  type='video/mp4; codecs="av01.0.08M.10"'>
  <source src="out/video-1080.h264.mp4" type='video/mp4; codecs="avc1.640033"'>
</video>
```
Notes: the `poster` attribute is a single AVIF (Safari <16 can't decode AVIF, and the portrait poster isn't used). Better: no poster attr, and a `<picture>` (avif/webp × portrait media) behind the video as the fallback layer.

## 5. Tools
zola 0.23.6 (same as Vercel), ffmpeg/ffprobe 8.1.1, node v26.12.1.

## 6. Gaps per checklist item
- Encode / variants / poster: done outside the repo. Copy to static/video/, verify with ffprobe (faststart, no audio, durations), then tick. Make sure processed_images/gitignore stay correct. 60 MB of binaries go into git (the owner has accepted this).
- Page + video.html: neither exists. Needs content/<slug>.md (`template="video.html"`, no date) and the nav links.
- iOS LPM overlay: use the preview CSS pseudo-elements; the poster `<picture>` stays visible underneath.
- Chrome dim + caption: new CSS (scope with `body:has(.video-page)`), new mono caption class.
- Ocean pause: no API yet. Needs an ocean.js knob within 345 B, wired from oceanMode/afterPageChange, and resumed on swap-away and historyRestore.
- Reduced-motion / Save-Data: no `navigator.connection` code exists. Recommend omitting `autoplay`/`src` in markup and starting playback from JS (`load()` + `play()`), which avoids network use under reduced motion. Also handle reduceQuery change.
- visibilitychange pause: needs a new listener in site.js. Removal on swap happens naturally via the outerHTML swap of div.page, but call `pause()` + `removeAttribute('src')`/`load()` in beforeSwap to free the decoder promptly.
- Linking: owner decision, nav vs Photos (the M8 decision expected a second menu item). Feed exclusion is free if there's no date.

## Risks
- htmx history cache snapshots div.page innerHTML. A restored `<video>` won't autoplay and will have stale state, so call `.play()` from historyRestore/afterSettle. The `autoplay` attribute on swapped-in nodes is unreliable (Safari), so always call `play().catch(()=>{})`.
- `<source media>` is evaluated only at load. Rotating the device won't switch the source unless a JS reload runs on orientation change.
- The swap fade (`swap:220ms`, `.htmx-added` opacity) applies to the video too. A fixed-position video inside `div.page` with an ancestor transform/opacity breaks `position: fixed` (styles.css 189 comment).
- Throughput: the 4K HEVC is 8.9 MB with no cache headers.
- ocean.js budget is tight (345 B).
