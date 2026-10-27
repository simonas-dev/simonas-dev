# simonas.dev — Plan

Personal website inspired by earendil.com: a live monochrome WebGL ocean behind
quiet serif/mono typography, with paper-textured content panels.

## Goals

- Feels calm, printed, and slightly analogue (greyscale + film grain + paper).
- Fast: static HTML, no framework, one shader, two fonts.
- Content-first: home hero, about, posts (Markdown), projects.
- Day/night theme, honours `prefers-reduced-motion`.

## Starting point

The repo currently holds a Nextra (Next.js 12) blog deployed on Vercel at
simonas-dev.vercel.app. It will be replaced entirely; nothing from the old
build stays except content and assets.

Content to migrate:
- `pages/index.mdx` → About (name, "Senior Software Engineer, Android", links to GitHub / Instagram / LinkedIn)
- `pages/posts/wizard.md` → `content/posts/ballistic-wizard.md` (keep `/images/baller-wizard.jpg`, `/ballistic-wizard-1.0.0.apk`)
- `pages/photos.mdx` → Photos page (`DSCF2021.JPG`, `R1-09309-017A.JPG`; resize/optimise, they are large)
- `/feed.xml` → keep the same URL so existing subscribers don't break (Zola: `feed_filenames = ["feed.xml"]`)
- Old URLs to redirect or preserve: `/posts/wizard`, `/photos`, `/tags/*` (tags can be dropped)

Teardown (M0):
- `git rm -r pages styles scripts public/fonts next.config.js theme.config.js package.json yarn.lock`
- Keep `public/images/*`, `public/ballistic-wizard-1.0.0.apk`, `public/favicon.ico` → move to `static/`
- Replace `README.md` and `.gitignore`
- Do it on `main` in one "rewrite" commit; history stays available in git.

## Non-goals (for v1)

- i18n, comments, search, analytics dashboards.
- CMS. Posts are Markdown files in the repo.

## Stack

| Concern        | Choice                                                     |
|----------------|------------------------------------------------------------|
| Site generator | Zola (single binary, Tera templates, Atom feed built in). Alternative: Eleventy if JS tooling is preferred. |
| Background     | Raw WebGL fragment shader, ported from afl_ext "Very fast procedural ocean" (MIT) |
| Navigation     | htmx `hx-boost` swapping `div.page` so the canvas never reloads |
| Fonts          | Departure Mono (free) for UI; a serif for reading. Plantin is commercial. Free options: Newsreader, Fraunces, EB Garamond, Source Serif 4. |
| Hosting        | Vercel (already connected). Zola runs as the build command (`vercel.json` with a Zola install step), output `public/`. Fall back to GitHub Pages if awkward. |

## Directory layout

```
simonas-dev/
  config.toml            # Zola config
  content/
    _index.md            # home
    about.md
    photos.md
    posts/
      _index.md
      ballistic-wizard.md
  templates/
    base.html            # <head>, canvas, header, footer, scripts
    index.html           # home hero
    page.html            # about / projects
    section.html         # posts list
    post.html            # single post
  static/
    fonts/
    shader/
      ocean.frag.glsl
      ocean.vert.glsl
    paper.png
    paper-dark.png
    ocean.js             # WebGL setup, quality, theme, ripples
    site.js              # nav, theme toggle, htmx hooks
    htmx.min.js
    styles.css
  PLAN.md
```

## Milestones

### M0 — Scaffold (½ day)
- [x] Teardown of the Nextra site (see "Starting point"), move kept assets to `static/`
- [x] `zola init`, `.gitignore`, `README.md`, `vercel.json`
- [x] `base.html` with the layer stack: canvas (z 0) → logo (z 10) → page (z 100) → chrome (z 200)
- [ ] Vercel builds from `main` with Zola; confirm `simonas-dev.vercel.app` serves the new site
- [x] Migrated content: home, about, photos, ballistic-wizard post, `/feed.xml`

### M1 — Ocean shader (1–2 days)
- [x] Full-screen quad + fragment shader, render at 0.35–0.4× resolution, upscale with `image-rendering: auto`
- [x] Port ocean raymarcher: `getwaves` (summed `exp(sin(x)-1)` octaves), normal from finite differences, simple sky
- [x] Post pass: luminance → add gaussian film grain → remap to `mix(dark, light, gray)`
- [x] Uniforms: `iResolution`, `iTime`, `u_waveTime`, `u_grainTime`, `u_night`, `u_noiseScale`
- [x] Quality levels (low/med/high) chosen by DPI + a quick frame-time probe; fallback to a static paper background when WebGL is unavailable (M1: flat `#faf9f6`; paper.png lands in M4)
- [x] Fade canvas in via `.shader-ready` class (opacity 0 → 1 over 1s)

### M2 — Typography & chrome (1 day)
- [x] Load fonts with `preload` + `font-display: swap`
- [x] CSS tokens: type scale with `clamp()`, `--frame-inline/--frame-block` (≈75px desktop, ≈20px mobile), colours `#353431` on `#faf9f6`, night `#1a1a1a` / `#2e2d2b`
- [x] Header: small logo/wordmark top-centre, mono nav top-right
- [x] Footer bar: name/© left, theme toggle right
- [x] Hero text aligned to the shader's horizon (`--scene-horizon-from-bottom`, updated from JS)
- [x] Mobile menu panel with paper texture and gradient mask (M2: `--paper-texture` hook on flat paper; paper.png lands in M4)

### M3 — Day / night (½ day)
- [x] Three-state toggle: auto → night → day, stored in `localStorage`
- [x] `.theme-night` class on `<html>`; CSS transition 900ms with `cubic-bezier(0.333333, 0, 0.666667, 1)` to match shader `smoothstep`
- [x] Animate `u_night` 0↔1 in the render loop over the same duration

### M4 — Content pages (1 day)
- [x] `.content-surface` panel: paper texture under a 97% tint, slight blur backdrop, max-width ~68ch
- [x] Prose styles: serif body, mono for code/metadata, generous line-height (1.6)
- [x] Post list + post template with date, reading time, feed at `/feed.xml`
- [x] Photos page: full-bleed images on the paper surface, lazy-loaded, WebP + fallback
- [x] When a content page is visible: shader drops to 15 fps, 0.5× resolution, wave speed ×0.15

### M5 — htmx navigation (½ day)
- [ ] `hx-boost="true" hx-select="div.page" hx-target="div.page" hx-swap="outerHTML swap:220ms"`
- [ ] Leave/enter CSS animations on `.page`
- [ ] Scroll memory for back/forward; scroll to top on forward nav
- [ ] Fallback to full navigation on any htmx error

### M6 — Polish (ongoing)
- [ ] Click ripples: project pointer onto the water plane, push to `u_ripples[10]`
- [ ] Logo drawn into the shader as a texture so waves pass "through" it
- [ ] Stars at night (hashed grid), sun/moon glow
- [ ] `prefers-reduced-motion`: slow waves, keep grain
- [ ] Pause rendering when tab is hidden (`visibilitychange`)
- [ ] OG image, favicons (light + dark), 404 page
- [ ] Lighthouse pass; target < 150 KB JS total

### M7 — Video page (½ day)

A dedicated full-screen page for the "Timeline 1" clip (glowing orb in a square
frame, dark, slow). Not on the home page. No user controls.

Source master: `/Users/simonas/Timeline 1.mov` (4K24 HEVC Main10, 45 s, 33 MB,
stereo AAC). The master never enters git; add `*.mov` to `.gitignore`.

- [ ] Encode with ffmpeg into `static/video/`: drop audio; pick a 10–20 s span and
      crossfade end→start into a seamless loop; light encode-time grain to mask
      banding in dark gradients; `+faststart`
- [ ] Variants: AV1 10-bit (primary) + H.264 (fallback); 1920×1080 landscape and a
      portrait crop centred on the orb (~1080×1350) via `<source media>`; target
      ≤ 2 MB per file
- [ ] Poster frame as AVIF + WebP (~30 KB), shown instantly and as the fallback
- [ ] Page `content/<slug>.md` (default slug `digital-sun`, title TBD) + `templates/video.html`:
      `<video autoplay muted loop playsinline disablepictureinpicture
      disableremoteplayback aria-hidden="true">`, no `controls`, `object-fit: cover`
      full viewport on black
- [ ] Hide the iOS Low Power Mode start-playback overlay; poster stays instead
- [ ] Chrome dims (low opacity, full on hover/focus); optional small mono caption
      (title / year / place) matching photo captions
- [ ] Ocean shader pauses while this page is shown; resumes on navigation away
      (works with htmx `div.page` swaps)
- [ ] `prefers-reduced-motion`, Save-Data / slow connection: poster only, no autoplay
- [ ] Pause on `visibilitychange`; video element is removed with the page on
      htmx navigation so it stops decoding
- [ ] Linked from Photos (and/or Projects/nav — owner decision); excluded from the feed

## Shader notes

Core wave function (per octave: rotate direction, accumulate height and drag):

```glsl
vec2 wavedx(vec2 p, vec2 d, float freq, float t) {
  float x = dot(d, p) * freq + t;
  float wave = exp(sin(x) - 1.0);
  return vec2(wave, -wave * cos(x));           // height, derivative
}

float getwaves(vec2 p, int iters) {
  float iter = 0.0, freq = 1.0, tw = 2.0, w = 1.0, sum = 0.0, sumw = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i >= iters) break;
    vec2 d = vec2(sin(iter), cos(iter));
    vec2 r = wavedx(p, d, freq, u_waveTime * tw);
    p += d * r.y * w * 0.38;                     // drag
    sum += r.x * w; sumw += w;
    w *= 0.82; freq *= 1.18; tw *= 1.07; iter += 1232.399963;
  }
  return sum / sumw;
}
```

Post pass:

```glsl
float gray = dot(color, vec3(0.299, 0.587, 0.114));
float n = fract(sin(dot(uv * u_noiseScale, vec2(12.9898, 78.233))) * 43758.5453 + u_grainTime * 1.5);
n = gaussian(n, 0.0, mix(0.75, 0.6, u_night));
gray = clamp(gray + n * (1.0 - gray) * mix(0.4, 0.065, u_night), 0.0, 1.0);
vec3 dark  = mix(vec3(0.62), vec3(0.05), u_night);
vec3 light = mix(vec3(0.97), vec3(1.00), u_night);
fragColor = vec4(mix(dark, light, gray), 1.0);
```

## Open decisions

- Serif font: Newsreader vs Fraunces vs licensing Plantin.
- Zola vs Eleventy.
- Domain: keep simonas-dev.vercel.app or buy simonas.dev.
- Which projects to feature on the home page (digital-sun, quies, strip-tester?).

## References

- https://earendil.com — reference design
- afl_ext ocean shader (MIT): https://www.shadertoy.com/view/MdXyzX
- Martin Upitis film grain shader
- Departure Mono: https://departuremono.com
- htmx boost docs: https://htmx.org/attributes/hx-boost/
- Zola: https://www.getzola.org
