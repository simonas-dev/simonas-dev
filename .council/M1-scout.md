# M1 Scout — Ocean shader

## Files Retrieved
1. `PLAN.md` 88-94 (M1 checklist), 131-166 (Shader notes), 60-75 (target layout: `static/shader/ocean.{frag,vert}.glsl`, `static/ocean.js`, `static/paper.png`, `paper-dark.png`), 178 (afl_ext MdXyzX, MIT)
2. `.council/decisions.md` — Zola 0.23.6, `rewrite` branch, commit per milestone, no push/prod.
3. `.council/M0.md` — zero-JS baseline was M0-only ("Shader/JS → M1"); fonts/tokens → M2.
4. `templates/base.html` (full, ~35 lines)
5. `static/styles.css` (full)
6. `config.toml`

## Current state
- `base.html` body: skip-link → `<canvas id="ocean" aria-hidden="true"></canvas>` → `.logo` → `.page > main#main` → `header.chrome` nav → `footer.chrome`. **No `<script>`** anywhere. Head has color-scheme meta, `/styles.css`.
- `styles.css`: `--z-canvas:0 / logo 10 / page 100 / chrome 200`; `body{background:#faf9f6;color:#353431}`; `#ocean{position:fixed;inset:0;width:100%;height:100%;z-index:var(--z-canvas);pointer-events:none}`. No opacity, no `.shader-ready`, no `image-rendering`.
- `static/` contents: `favicon.ico`, `styles.css`, `images/{DSCF2021.JPG,R1-09309-017A.JPG,baller-wizard.jpg}`, `ballistic-wizard-1.0.0.apk`. **No JS, no `static/shader/`, no `paper.png`/`paper-dark.png`, no fonts.**
- Zola copies `static/` verbatim to `public/` root (`static/shader/ocean.frag.glsl` → `/shader/ocean.frag.glsl`). `compile_sass=false`, no minify. Fetching .glsl at runtime = extra requests; alternative is inlining GLSL as JS template strings in `ocean.js` (PLAN layout implies separate .glsl files; `fetch()` works under `zola serve` and Vercel).

## Constraints
- Zero-JS was M0 scope; M1 introduces `ocean.js` (use `<script src="/ocean.js" defer>` or `type=module`). Page must still work with no JS (body bg = paper colour already).
- No fonts until M2; no theme toggle until M3 (`u_night` = 0 constant for now, but wire uniform).
- Colours `#faf9f6` / `#353431`; night `#1a1a1a`/`#2e2d2b` (M2/M3). Shader post pass light = 0.97 grey ≈ #f7f7f7 — not exactly #faf9f6 (warm); minor mismatch to note/accept or tint.
- Content-page throttle (15fps, 0.5×, waves ×0.15) is M4; ripples, reduced-motion, visibilitychange are M6 (cheap to stub visibility pause now but out of scope).

## afl_ext "Very fast procedural ocean" (MdXyzX) structure (from memory — verify against source)
- Constants: `DRAG_MULT 0.38`, `WATER_DEPTH 1.0`, `CAMERA_HEIGHT 1.5`, `ITERATIONS_RAYMARCH 12`, `ITERATIONS_NORMAL 36` (PLAN loop caps at 16 → normal iters must be ≤16 or raise cap; quality levels can scale these).
- `wavedx` / `getwaves`: PLAN pins exactly (weight ×0.82, freq ×1.18, time mult ×1.07, iter += 1232.399963, drag 0.38). Note PLAN uses `u_waveTime` instead of `iTime`.
- `raymarchwater(camera, start, end, depth)`: start/end = intersections of ray with planes y=0 and y=-depth; loop up to 64 steps: `pos=mix(start,end,t)`, `h=getwaves(pos.xz,ITER_RAYMARCH)*depth - depth`; if `h+0.01 > pos.y` return distance; `t += pos.y - h` step (normalised by ray length).
- `normal(pos, e=0.01, depth)`: `H=getwaves(pos)*depth`; `a=vec3(pos.x,H,pos.y)`; finite differences at +e x and +e z, `normalize(cross(a-b, a-c))` (order to get up-facing).
- Camera ray: `getRay(fragCoord)`: uv = (fragCoord/iResolution*2-1), aspect-corrected, `normalize(vec3(uv.x, uv.y, 1.5))`; original rotates by mouse (`createRotationMatrixAxisAngle`) — replace with fixed slight downward pitch. If `ray.y >= 0` → sky only. Origin `vec3(iTime*0.2,CAMERA_HEIGHT,1)` (slow drift).
- Plane intersection `intersectPlane(origin, dir, point, normal)` = `clamp(dot(point-origin,normal)/dot(dir,normal),-1,9991999)`.
- Sky: `extra_cheap_atmosphere(raydir, sundir)` — Rayleigh-ish: `special_trick=1/(raydir.y+1)`, `special_trick2=1/(sundir.y*11+1)`, `raysundt=pow(abs(dot(sundir,raydir)),2)`, `sundt=pow(max(0,dot),8)`, `mymie=sundt*special_trick*0.2`, `suncolor=mix(1, max(0,1-vec3(5.5,13,22.4)/22.4), special_trick2)`, `bluesky=vec3(5.5,13,22.4)/22.4*suncolor`, etc. `sun(dir,sundir)=pow(max(0,dot),720)*210`. `getSunDirection()` animated by time.
- Shading: `fresnel = 0.04 + 0.96*pow(1-max(0,dot(-N,ray)),5)`; `R=reflect(ray,N)`, R.y=abs(R.y); reflection = atmosphere(R)+sun(R); scattering = `vec3(0.0293,0.0698,0.1717)*0.1*(0.2+(waterHitPos.y+depth)/depth)`; `C=fresnel*reflection + scattering`. Normal smoothed with distance: `N=mix(N, vec3(0,1,0), 0.8*min(1,sqrt(dist*0.01)*1.1))`.
- `aces_tonemap(color)`: matrices m1 `{0.59719,0.07600,0.02840 / 0.35458,0.90834,0.13383 / 0.04823,0.01566,0.83777}`, m2 `{1.60475,-0.10208,-0.00327 / -0.53108,1.10813,-0.07276 / -0.07367,-0.00605,1.07602}`; `v=m1*c; a=v*(v+0.0245786)-0.000090537; b=v*(0.983729*v+0.4329510)+0.238081; return pow(clamp(m2*(a/b),0,1), 1/2.2)`. Output then greyscaled by PLAN post pass, so colour accuracy matters little — "simple sky" per checklist could replace atmosphere with a vertical gradient.

## What PLAN pins
- `wavedx`/`getwaves` verbatim; post pass verbatim except **`gaussian()` is not defined** — must write it (Upitis: `exp(-(x-mu)^2/(2*sigma^2))` style; typical `float gaussian(float z,float u,float o){return (1.0/(o*sqrt(2.0*PI)))*exp(-((z-u)*(z-u))/(2.0*o*o));}`). Grain hash uses `uv*u_noiseScale` + `u_grainTime*1.5`.
- Uniforms: `iResolution, iTime, u_waveTime, u_grainTime, u_night, u_noiseScale`.

## Needed for each checklist item
- **0.35–0.4× render + upscale**: canvas `width/height = round(clientSize*scale)` (scale per quality, ×DPR? likely ignore DPR), CSS 100% size, `image-rendering:auto`. Resize via ResizeObserver/resize. `iResolution` = backing size. Single pass suffices (post pass inline at end of fragment) unless grain should be full-res — at 0.35× grain is upscaled/blurred; decide: single-pass (simple) vs. low-res FBO ocean + full-res post pass (grain crisp, costlier). Checklist says "post pass"; noiseScale may compensate.
- **Uniforms**: `u_waveTime` accumulates dt×speed (enables M4 ×0.15 later), `u_grainTime` maybe stepped (e.g. 24fps) for film look; `u_noiseScale` tied to scale.
- **Quality levels**: low/med/high → {scale, raymarch iters, normal iters, maybe fps cap}. Pick initial from `devicePixelRatio`/screen size; probe ~30–60 frames median frame time, step down if >~20ms. Needs `requestAnimationFrame` loop, `gl.finish`-free timing via rAF deltas.
- **Fallback**: `getContext('webgl')` null / shader compile fail / context lost → leave canvas hidden; CSS background on body. `static/paper.png` **does not exist** — either create (generate texture) in M1 or fallback to flat `#faf9f6` until M4 (paper texture appears in M4 checklist). Flag for decision.
- **.shader-ready fade**: CSS `#ocean{opacity:0;transition:opacity 1s}` `.shader-ready #ocean{opacity:1}` (class on `<html>` or canvas), added after first frame drawn.
- `prefers-reduced-motion` — M6, skip.

## Gaps vs checklist
- All M1 items unticked; nothing implemented: no JS, no shader dir, no paper assets, no fade CSS, no script tag.
- Open: GLSL as separate fetched files vs inline; single vs two-pass; paper.png creation; WebGL1 vs WebGL2 (WebGL1 needs constant loop bounds — PLAN's `for i<16` + break is OK); light-colour mismatch 0.97 grey vs #faf9f6.

## Start Here
`templates/base.html` + `static/styles.css` (add script + fade CSS), then create `static/ocean.js` and `static/shader/ocean.{vert,frag}.glsl` using PLAN.md 131-166.
