# Code Context: M6a Calm sea + Composition

## 1. static/shader/ocean.frag.glsl
- L14 `MAX_WAVE_ITERS 36`, L15 `RAYMARCH_STEPS 64`, L16 `WATER_DEPTH 1.0`, L18 `NIGHT_DIM 0.32`
- L23 `CAMERA_HEIGHT = 1.5`, L24 `CAMERA_PITCH = 0.12` (rad, downward), L25 `CAMERA_FOCAL = 1.5`, L26 `CAMERA_DRIFT = 0.2` (per unit u_waveTime), L27 `CAMERA_SWELL = 0.03` (used as `sin(iTime*0.25)`, L118)
- L29 `SUN_DIR = (0, 0.2588, 0.9659)`
- ITERS_RAYMARCH / ITERS_NORMAL come from ocean.js defines (no defaults in shader).
- Wave fn (L31-48):
```glsl
vec2 wavedx(vec2 p, vec2 d, float freq, float t) {
  float x = dot(d, p) * freq + t;
  float wave = exp(sin(x) - 1.0);              // L33 peakiness
  return vec2(wave, -wave * cos(x)); }
float getwaves(vec2 p, int iters) {
  float iter=0.0, freq=1.0, tw=2.0, w=1.0, sum=0.0, sumw=0.0;
  for (...) { if (i >= iters) break;
    vec2 d = vec2(sin(iter), cos(iter));
    vec2 r = wavedx(p, d, freq, u_waveTime * tw);   // L42: base speed tw=2.0
    p += d * r.y * w * 0.38;                         // L43 drag
    sum += r.x * w; sumw += w;
    w *= 0.82; freq *= 1.18; tw *= 1.07; iter += 1232.399963; } // L45
  return sum / sumw; }
```
- Camera ray (L87-92):
```glsl
vec2 uv = (fragCoord * 2.0 - iResolution) / iResolution.y;
vec3 d = normalize(vec3(uv, CAMERA_FOCAL));
float c = cos(CAMERA_PITCH), s = sin(CAMERA_PITCH);
return vec3(d.x, d.y * c - d.z * s, d.y * s + d.z * c);
```
- main L114: `ray.y >= -1e-4` → sky. Origin L117-118: `vec3(u_waveTime*CAMERA_DRIFT, CAMERA_HEIGHT + CAMERA_SWELL*sin(iTime*0.25), 1.0)`. Normal eps 0.01 (L125); distance flattening `N = mix(N, up, 0.8*min(1, sqrt(dist*0.01)*1.1))` L126 (place to fade HF detail).
- Grain/night in `post()` L99-109 (grain sigma mix(0.75,0.6,night), strength mix(0.4,0.065,night)). No quality-tier defines in shader beyond ITERS_*.

## 2. static/ocean.js (10238 B — only 2 B under 10240 budget!)
- TIERS L11-15: high scale .4 rm 12 nm 24; med .375/10/16; low .35/8/10.
- L27 `SWELL_PERIOD = 8*PI` (must match `sin(iTime*0.25)`; iTime wrapped `elapsed % SWELL_PERIOD` L162). L26 GRAIN_STEPS 16.
- L32 `var HORIZON = 0.5 + 0.75 * Math.tan(0.12);` (hard-coded, = 0.5905)
- L161 `waveTime += Math.min(dt, MAX_DT) * state.speed;` → rate 1 unit/s × speed (MAX_DT 0.1, L19). No base-rate constant; calm slowdown must go here (or tw in shader).
- L296 onResize: `root.style.setProperty('--scene-horizon-from-bottom', canvas.clientHeight * HORIZON + 'px')`.
- Speed knobs: static/site.js L91-98 `oceanMode()`: content → speed 0.15, res 0.5, fps 15; else 1. No reduced-motion handling in JS (grep found none); only CSS media query styles.css L367.

## 3. CSS/templates using horizon
- styles.css L74-76: fallback `--scene-horizon-from-bottom: 59.05vh;` then `59.05dvh;` → change to 38.2vh/38.2dvh.
- L186-195 `.hero` padding-bottom `calc(var(--scene-horizon-from-bottom) + var(--hero-gap))` (only consumer). L206-219 short-landscape media (max-height:30rem) adjusts hero-gap/h1.
- Not horizon-relative but check visually: footer scrim L269-270, content header scrim L274-286, content footer L289-290, `.content-surface` L386+, mask L359-360. Templates: no horizon references.

## 4. Math
horizonFromBottom = 0.5 + 0.5·F·tan(P) = 0.5+0.75·tan(0.12)=0.5+0.75·0.12058 = **0.5904** (59.05%). For 0.382: tan(P) = (0.382−0.5)/0.75 = −0.15733 → **P ≈ −0.1561 rad** (looking up). Derivation verified from cameraRay (ray.y=0 ⇔ uv.y = F·tan P). Note with upward pitch at height 1.5 the sea gets more compressed; may retune focal/height.

## 5. Tooling
- zola 0.23.6, node v26.12.1.
- /tmp/pw-sea (playwright installed in node_modules): `shot.mjs [baseUrl=http://127.0.0.1:1111] [paths]` env W/H (1280x800), WAIT, TAG, NOGL, SLOW; swiftshader GL, waits for shader-ready, screenshots. `m3check.mjs`: day/night toggle/tween/static-tier/NOGL checks against hard-coded `http://127.0.0.1:1111`, writes screenshots to `/tmp/pw/` (not /tmp/pw-sea). Also crop.mjs (url W H scale clip), m4check/m5check, zoom.mjs. Port 1111 = `zola serve` default.

## Start Here
static/shader/ocean.frag.glsl L20-48, then ocean.js L32/L161 and styles.css L74-76.

## Risks
- ocean.js at 10238/10240 B: any edit to HORIZON (e.g. tan(-0.156)) must not grow file; consider literal `0.382`.
- Reduced motion has no JS speed path; PLAN M6 item separate.
- m3check screenshot dir /tmp/pw may not exist.
