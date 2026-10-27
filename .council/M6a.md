# M6a — Calm sea + golden-ratio horizon (parallel lane, branch `rewrite-sea`)

Scope: PLAN.md M6 "Calm sea" and "Composition" items only, plus owner decisions
"Sea character" and "Horizon / composition". Everything else in M6 is out of scope.
PLAN.md checkboxes are NOT ticked here (owner ticks on merge). Scout: `.council/M6a-scout.md`.

Files allowed: `static/shader/ocean.frag.glsl`, `static/ocean.js`, `static/styles.css`
(fallback lines only), this memo. No `templates/`, no `static/site.js`.

## Plan (ordered steps)

1. **Composition (first, before any wave edits)**
   - Shader: `CAMERA_PITCH = -0.1561` (atan(-0.118/0.75)); comment "radians, negative = looking up".
     Keep `CAMERA_FOCAL = 1.5` (FOV/distortion; horizon formula unchanged).
   - `static/ocean.js` L32: `var HORIZON = 0.382;` with a short comment that it must equal
     `0.5 + 0.5*CAMERA_FOCAL*tan(CAMERA_PITCH)` in the shader. Saves bytes (budget < 10240 B).
   - `static/styles.css` L74-76 fallbacks: `38.2vh` / `38.2dvh`.
   - Measure with `/tmp/pw-sea/sea.mjs` before continuing.
2. **Slower motion (shader only; JS speed knob semantics unchanged)**
   - Base wave speed `tw` 2.0 → 0.9 (0.45×). Keep `tw *= 1.07` (may drop to 1.05 if HF still skitters).
   - `CAMERA_DRIFT` 0.2 → 0.08; `CAMERA_SWELL` 0.03 → 0.015. Keep `sin(iTime*0.25)`
     (coupled to `SWELL_PERIOD` in ocean.js).
3. **Lower, broader waves**: `WATER_DEPTH` 1.0 → 0.6; weight falloff `w *= 0.82` → 0.72
   (tune within 0.72–0.78 / depth 0.6–0.75 if it reads as a flat mirror).
4. **Fewer spikes**: `#define PEAK 0.6`; `wave = exp(PEAK*(sin(x)-1.0))`, derivative
   `-PEAK*wave*cos(x)`; drag 0.38 → 0.2.
5. **Shimmer**: distance-scaled normal epsilon `waterNormal(hit.xz, 0.01 + dist*0.004, …)`
   (≈ one backing pixel at 0.4× scale, F=1.5; tune 0.002–0.004). Keep existing flatten mix.
   Tier `ITERS_NORMAL` 24/16/10 → 16/12/8 in ocean.js TIERS only if the high-tier screenshot
   doesn't visibly lose glassy highlights (falloff 0.72 makes octaves > 16 < 1%); otherwise keep.
6. **Camera retune (only if needed)**: if the sea band reads flat/printed, lower
   `CAMERA_HEIGHT` 1.5 → ~1.25 (horizon independent of height). Do not change focal.
7. **Re-checks**: grain, night dim, content throttle (effective 0.15×0.45 ≈ 0.07 — acceptable,
   do not edit site.js), all tiers + static + NOGL. Sun: keep `SUN_DIR` unless the night
   contrast behind header/hero ink measures < 4.5:1, then raise to ~24° `(0, 0.4067, 0.9135)`.
8. **Evidence**: after screenshots (1280×800 + 390×844, day + night) via `TAG=after node sea.mjs`,
   frame-diff motion metric before vs after, short Playwright `recordVideo` capture, Outcome below.

## Acceptance checks

| Item | Check |
|------|-------|
| Horizon 38.2% | `sea.mjs` detected horizon row ≈ 494±6 /800 (1280×800) and ≈ 522±6 /844 (390×844), day (night detection noisier, visual check) |
| JS/CSS sync | computed `--scene-horizon-from-bottom` = 0.382 × canvas clientHeight; fallback 38.2vh/dvh |
| Horizon-positioned elements | hero sits above horizon, no header overlap at 1280×800, 390×844, 844×390 |
| Slower motion | mean abs frame diff (sea band, t vs t+1 s) ≤ 0.5× before |
| Lower/broader, fewer spikes | zoomed sea crop day+night: no bright single-pixel crests at rest |
| Re-checks | night + grain screenshots ok; content page still moves; tiers/static/NOGL render, no console errors |
| Budget | `wc -c static/ocean.js` < 10240 |
| Build | `zola build` and `zola check` pass |

## Deferred

- Reduced-motion speed path, visibilitychange, ripples, stars/moon/sun glow redesign, OG/404, Lighthouse (rest of M6 on `rewrite`).
- Swell frequency change (needs `SWELL_PERIOD` edit); site.js throttle retune; short-landscape media query.
- PLAN.md checkbox ticking (owner, on merge).

## Owner decisions

- Memo/evidence lives in `.council/M6a.md` (PLAN text says M6.md) — lane note; no conflict with `rewrite`.
- Base speed in shader `tw` (not JS waveTime rate) — council unanimous, autopilot.
- `HORIZON` literal 0.382 in JS (derivation in comment) — council unanimous, autopilot.
- Camera height / SUN_DIR / tier normal counts: tune only on screenshot evidence per steps 5–7 — autopilot.

## Council record

- Roster: council-designer, council-perf, council-skeptic (project profiles, context fresh). Pass cap 2.
- Pass 1 run ids: designer `3f500c74-a61d-4764-921d-3fb78998d2c2`, perf `c272bfcf-b270-492f-9c34-298e12f98f23`, skeptic `1a542823-25ef-4830-b605-8b88454ec6ba`.
- Passes run: 1. Converged — all three agreed on pitch −0.1561 / focal 1.5, literal HORIZON, shader-side speed (tw 0.9), drift ~0.08, swell amp 0.015, depth 0.6, falloff ~0.72–0.74, peak k 0.6–0.65, drag 0.2, distance-scaled normal eps, no site.js/template edits. Remaining differences (tier normal counts, camera height 1.5 vs 1.25, sun move) are visual-tuning calls settled by screenshots, not advisor evidence → no Pass 2.
- Accepted: all of the above; perf's sun contrast threshold (raise only if < 4.5:1); designer's normal tier cut conditional on visual parity.
- Rejected: designer's per-pixel distance-tapered normal iteration count (skeptic: avoid runtime-varying loop bound; eps widening is cheaper — perf); skeptic's "record in M6.md" (lane note says M6a.md); focal change (all).

## Outcome

PLAN.md M6 items done in this lane (owner ticks on merge; not ticked here):
- [x] Calm sea — slower motion (tw 0.45×, drift 0.4×, swell amp 0.5×)
- [x] Calm sea — lower, broader waves (depth 0.75, falloff 0.76)
- [x] Calm sea — fewer spikes (PEAK 0.6, effective drag 0.12, normal tiers 16/12/8, pixel-footprint normal eps)
- [x] Calm sea — re-check grain, night, content throttle, tiers (reduced-motion has no JS path yet; separate M6 item)
- [x] Calm sea — acceptance: before/after screenshots + captures desktop/mobile day/night (recorded here, not M6.md)
- [x] Composition — horizon 38.2% from bottom (measured 306/800 px = 38.25%, 323/844 px = 38.27%)
- [x] Composition — JS/CSS sync (`HORIZON 0.382`, fallback 38.2vh/dvh); hero checked; footer-fade note → M6

Review loop: round 1 worker + 3 parallel reviewers (acceptance / visual+a11y / perf+correctness; run
`7f8a39d7`) → no P0/P1; P2s: far-field bricks, eps not resolution-aware, memo drag/tier rationale, motion
wording, footer fade. Round 2 worker fixed the shader P2s and memo; residual dim lines + footer fade deferred.
Stopped at round 2 of 3 (only P2 left). Surprises: 1 s motion metric saturates; HF horizon detector stops
firing on a calm sea; the owner approved the look mid-run (decisions.md).

Status: implemented and committed on `rewrite-sea` as `M6a: calm sea and golden-ratio horizon`. Steps 1–5 per plan, step 6 applied (camera height),
step 7 checks done (SUN_DIR kept), step 8 evidence below. 3 tuning rounds (iter1 → iter2 → normal-count check),
then review round 2 (grazing-angle normal epsilon, memo corrections). Owner approved the look
(`.council/decisions.md`, "M6a sea look approved"): treat these constants as the baseline.

### Constants (before → after)

| Constant | File | Before | After | Note |
|----------|------|--------|-------|------|
| `CAMERA_PITCH` | shader | 0.12 (down) | −0.1561 (up) | horizon 0.382 |
| `CAMERA_FOCAL` | shader | 1.5 | 1.5 | unchanged |
| `CAMERA_HEIGHT` | shader | 1.5 | 1.25 | step 6: iter1 (1.5/0.6/0.72) read as a flat mirror |
| `CAMERA_DRIFT` | shader | 0.2 | 0.08 | |
| `CAMERA_SWELL` | shader | 0.03 | 0.015 | `sin(iTime*0.25)` kept |
| base `tw` | shader | 2.0 | 0.9 | `tw *= 1.07` kept (1.05 tried: no measurable change) |
| `WATER_DEPTH` | shader | 1.0 | 0.75 | top of plan range (0.6 too flat) |
| weight falloff `w *=` | shader | 0.82 | 0.76 | within 0.72–0.78 (0.72 too flat) |
| `PEAK` (new define) | shader | 1.0 (implicit) | 0.6 | `exp(PEAK*(sin x−1))`, deriv `−PEAK*wave*cos x` |
| drag | shader | 0.38 | 0.2 | effective drag = drag × derivative scale = 0.2 × PEAK = **0.12** (before 0.38 × 1 = 0.38) |
| normal epsilon | shader | 0.01 | 0.01 + dist·3 / (CAMERA_FOCAL · iResolution.y · max(−ray.y, 0.03)) | round 2 (was 0.01 + dist·0.004); flatten mix kept |
| `SUN_DIR` | shader | (0, .2588, .9659) | unchanged | night contrast ≥ 4.5 |
| `HORIZON` | ocean.js | `0.5+0.75*Math.tan(0.12)` (0.5905) | `0.382` | comment gives shader formula |
| TIERS normal | ocean.js | 24 / 16 / 10 | 16 / 12 / 8 | rationale is the measurement, not the plan's falloff-0.72 argument (final falloff is 0.76): high 24 vs 16 deterministic frame (virtual clock, t=3 s) mean abs diff 0.58/255, max 6 → no visible loss |
| CSS fallback | styles.css | 59.05vh / 59.05dvh | 38.2vh / 38.2dvh | |

### Horizon

Detected as the sky→sea luminance turn (row luminance peaks at the last sky row; `sea.mjs` HF detector
no longer fires on the calm sea, so rows were read with `/tmp/pw-sea/hrow.mjs`). Target = 0.618·H from top.

| Shot | Target row | Detected row | From bottom | CSS `--scene-horizon-from-bottom` |
|------|-----------|--------------|-------------|------------------------------------|
| day 1280×800 | 494.4 | 494 | 306 px = 38.25 % | 305.6px (= 0.382 × 800) |
| night 1280×800 | 494.4 | 494 | 306 px = 38.25 % | 305.6px |
| day 390×844 | 521.6 | 521 | 323 px = 38.27 % | 322.408px (= 0.382 × 844) |
| night 390×844 | 521.6 | 521 | 323 px = 38.27 % | 322.408px |
| 844×390 (day/night) | — | visual | — | 148.98px (= 0.382 × 390) |

Step-1 measurement (pitch only, old waves): `sea.mjs` 495/800 (38.1 %), mobile HF detector 529 (lag;
actual luminance turn 521). Before: horizon at 59.05 % (row 328/800, 346/844).
Hero sits above the horizon with no header overlap at 1280×800, 390×844, 844×390.

### Motion (`/tmp/pw-sea/motion.mjs`, virtual rAF/performance.now clock, cached high tier, day, sea band = horizon+3 % → bottom, medians of 4 pairs)

| Metric | 1280×800 before → after | 390×844 before → after |
|--------|-------------------------|------------------------|
| raw mean abs diff, Δt = 1 s | 8.04 → 6.42 (0.80×) | 8.21 → 6.58 (0.80×) |
| 8×8-block diff, Δt = 1 s | 6.04 → 5.25 (0.87×) | 6.41 → 5.52 (0.86×) |
| 8×8-block diff, Δt = 0.25 s | 4.15 → 1.95 (**0.47×**) | 4.00 → 1.89 (**0.47×**) |
| same minus frozen-wave floor (speed 0: grain + swell) | 2.47 → 0.88 (**0.36×**) | 2.35 → 0.85 (**0.36×**) |
| saturation level (8×8, Δt = 8 s) | 5.38 → 6.02 | 5.37 → 6.58 |

The 1 s window saturates: the before sea is already fully decorrelated at 1 s (8×8 1 s diff 6.04 ≥ its
8 s level 5.38), so the 1 s metric cannot show the 0.45× speed cut (after sits at ~0.87 of its own
saturation level). **Acceptance amended to the 0.25 s window**: 0.47× (8×8 blocks) and 0.36× net of the
grain/swell floor — consistent with tw 2.0→0.9 and drift 0.2→0.08. The owner approved the look as
previewed (decisions.md row "M6a sea look approved"), so tw is not lowered further.

Round 2 shader (1280×800 day, same script, `motion_r2.json`): 8×8 Δt=0.25 s 1.95 → 1.80,
raw Δt=1 s 6.42 → 5.98, speed-0 floor 1.07 → 1.03 — slightly calmer, not busier.

### Re-checks

- Night contrast (`m3contrast.mjs`, THEME=night), worst-pixel ratio, after (before):
  1280×800 h1 4.67 (4.67), p 5.04 (5.04), logo 6.57 (5.04), nav 6.89 (6.36), footer 13.52 (13.37);
  390×844 h1 4.89 (4.97), p 5.12 (5.12), logo 6.78 (5.44), nav 6.78 (5.98), footer 13.81 (13.52).
  All ≥ 4.5:1 → `SUN_DIR` unchanged (sun glow now sits just above the hero, still passes).
- Tiers (`/tmp/pw-sea/m6acheck.mjs`, cached via sessionStorage `ocean-tier`): high (512 px backing),
  med (480), low (448) render + animate day/night; `static` renders, no loop (frame diff 0); no console errors.
- NOGL (`--disable-webgl`): `no-webgl` class, paper fallback day/night, no errors.
- `/photos/` (speed 0.15, res 0.5, fps 15): 16×16-block diff over 5 s 1.40 vs 0.64 with speed forced 0 → still moves (slowly).
- Grain/night dim unchanged in shader; screenshots ok. Zoomed sea crops day+night: no bright single-pixel crests
  (far field shows soft horizontal glint streaks instead of the old sparkle).
- `static/ocean.js` 10228 B (< 10240; was 10238); unchanged in round 2.
- `zola build -o /tmp/m6a-public --force` ok; `zola check` ok (3 pages, 1 section) — re-run after the round-2 shader edit.

### Round 2: far-field streaks (shader only)

Review found hard-ended 1-backing-pixel horizontal dashes/bricks in the band just below the horizon
(round-1 `m6a_after_night_1280x800.png` y≈500–580, `m6a_after_tier_low_day.png`, `m6a_after_zoom_night_1280.png`).
Cause: the normal epsilon was isotropic and fixed for 0.4× backing scale, while a pixel's footprint along
the view ray grows by ~1/|ray.y| at grazing angles and backing height varies (tiers 0.4/0.375/0.35,
content res 0.5, `MAX_BACKING_WIDTH` clamp). `iResolution` is the backing-store size (ocean.js `uniform2f(w, h)`).

Tried in order, deterministic chrome-hidden frames (virtual clock t=3 s, `/tmp/pw-sea/r2det.mjs`;
far band = horizon+4 px … +11 % H, near band = bottom 18 %; metric `/tmp/pw-sea/r2metric.mjs`):

| Variant | Far vertical HF, high day / low day | Near-field mean abs diff vs current (/255) | Visual |
|---------|-------------------------------------|--------------------------------------------|--------|
| current `0.01 + dist·0.004` | 2.73 / 2.43 | — | streaks |
| (1) `dist·3/(F·iResolution.y)` | 2.74 / 2.42 | 0.07 | no visible change |
| (2) (1) ÷ `max(−ray.y, 0.1)` | 2.24 / 2.13 | 0.57 / 0.45 | dashes fewer; bricks remain in the top ~4 backing rows |
| **(2′) (1) ÷ `max(−ray.y, 0.03)`** | **1.75 / 1.62** | 0.57 / 0.45 | bricks under the horizon gone, near swell unchanged |
| (3) (2′) + flatten cap 0.8→0.9 | 1.63 / 1.51 | 0.58 / 0.47 | indistinguishable from (2′) → reverted |

Kept (2′). Near-field crops (`r2base_zoom_near.png` vs `r2o3_zoom_near.png`) are visually identical
(diff < 1/255 mean). Residual: a few longer, dimmer horizontal lines remain mid-band; they do not respond
to epsilon or flatten (likely raymarch hit/silhouette quantisation at low backing res) — not pursued.

Horizon re-measured on round-2 chrome-hidden shots (`hrow.mjs`, peak row luminance): day 1280×800 494,
day 390×844 521, day/night 844×390 241 (target 241.0); night 1280×800 493, night 390×844 518 (night peak is a
flat ±0.2 plateau over 518–522 now that the far sea is smoother) — all within ±6. CSS
`--scene-horizon-from-bottom` unchanged (305.6 / 322.408 / 148.98 px). No console errors in any r2 run.

### Evidence paths (/tmp/pw-sea)

- After: `m6a_after_{day,night}_{1280x800,390x844,844x390}.png` (+ `_bg.png`, chrome hidden).
- Before: `m6a_before_{day,night}_{1280x800,390x844}.png` (+ `_bg.png`).
- Step 1 only: `m6a_step1_*`; tuning rounds: `m6a_iter1_*`, `m6a_iter2_*`.
- Zoomed crops: `m6a_{before,after}_zoom_{day,night}_1280.png`; normal-count check `z_n24.png` / `z_n16.png`.
- Round 2: `m6a_r2_{day,night}_{1280x800,390x844,844x390}{,_bg}.png` (`TAG=r2 sea.mjs`);
  deterministic `m6a_r2_det_{high,low}_{day,night}_1280x800.png`, `m6a_r2_det_high_day_390x844.png`,
  `m6a_r2_det_high_night_844x390.png` (pre-fix: `m6a_r2base_det_*`; variants `m6a_r2o{1,2,3,4}_det_*`);
  zooms `m6a_r2_zoom_{day,night}_1280.png`, `m6a_r2_zoom_tier_low_day_1280.png` vs `m6a_r2base_zoom_tier_low_day_1280.png`,
  `m6a_r2_zoom_night_844x390.png` vs `m6a_r2base_zoom_night_844x390.png`; scripts `r2det.mjs`, `r2metric.mjs`.
- Contrast: `m6a_after_contrast_night_{1280x800,390x844}{,_bg}.png`, `m6a_before_contrast_night_*`.
- Tiers/NOGL/content: `m6a_after_tier_{high,med,low,static}_{day,night}.png`, `m6a_after_nogl_{day,night}.png`, `m6a_after_photos.png`.
- Captures (~6 s, cached high tier, swiftshader): `m6a_capture_{before,after}_{desktop,mobile}.webm`.
- Scripts: `motion.mjs`, `detshot.mjs`, `pdiff.mjs`, `hrow.mjs`, `m6acheck.mjs`, `photosmove.mjs`, `capture.mjs`; `sea.mjs` gained a second (step) detector.
- Before build served from `/tmp/m6a-before-public` (git archive HEAD) on :1114, stopped after use.

### Deferred / notes

- Motion acceptance: settled — 0.25 s window, owner approved the look (see Motion).
- Day near-field is brighter/lower-contrast than before: upward pitch puts most visible water at grazing angles (high Fresnel). Not tuned further.
- Far-field streaks: fixed in round 2 except a few dim mid-band lines (see Round 2).
- Footer fade now covers a larger share of the smaller sea band (≈39 % at 1280×800, ≈60 % at 844×390).
  Out of lane scope (`styles.css` footer rules / short-landscape query). Recommendation for M6 on `rewrite`:
  reduce the footer fade height/opacity in `@media (max-height: 30rem)`.
- Everything in the plan's Deferred list untouched; no templates/site.js/PLAN.md edits.

Summary: horizon moved to the golden-ratio line (pitch −0.1561, HORIZON 0.382, CSS 38.2vh/dvh), waves
slowed (tw 0.9, drift 0.08, swell 0.015), lowered and rounded (depth 0.75, falloff 0.76, PEAK 0.6, drag 0.2,
camera 1.25), far shimmer damped (pixel-footprint normal eps: distance, backing height and grazing angle),
normal octaves cut to 16/12/8 at no visible cost. Look approved by owner.
