# M3 scout — Day / night

## Checklist (PLAN.md:104-107)
1. Three-state toggle auto→night→day, stored in localStorage
2. `.theme-night` on `<html>`, CSS transition 900ms `cubic-bezier(0.333333,0,0.666667,1)`
3. Animate `u_night` 0↔1 in the render loop over the same duration

Decisions (.council/decisions.md:22-23): night = `#1a1a1a` bg, `#2e2d2b` surface, `#e8e6e1` ink. Class is `.theme-night` only, with **no prefers-color-scheme until M3**, so M3 owns "auto = follow the OS". The toggle stays visible but disabled until M3.

## Hooks
- `templates/base.html:6` has `<meta name="color-scheme" content="light">`. This needs to become `light dark`, or be updated by script. Otherwise the UA chrome/scrollbars stay light at night. `.theme-night` already sets `color-scheme: dark` (styles.css:65).
- `base.html:16` loads `<script src="/ocean.js" defer>`. That is the only script, and M2 validation asserted "1 `<script>`" per page. Adding a script changes this count, so m2check/validation expectations need updating.
- `base.html:44` has the current toggle markup:
  `<button type="button" class="theme-toggle" disabled aria-label="Theme: Auto (coming soon)">Auto</button>`
  M3 should remove `disabled` and update the label/text for each state (Auto/Night/Day). Probably also add `aria-pressed` or a live label.
- `static/styles.css:56-57` defines the tokens `--ease: cubic-bezier(0.333333, 0, 0.666667, 1)` and `--dur-theme: 900ms`. Both are defined, but nothing uses `--dur-theme` yet.
- `styles.css:60-66` holds the night token block (`.theme-night { --paper; --surface; --ink; color-scheme: dark }`).
- `styles.css:70-71` sets body `background: var(--paper); color: var(--ink)`. This needs `transition: background-color/color var(--dur-theme) var(--ease)`. Custom properties don't interpolate unless registered with `@property`. Other users of `--paper` also need transitions: footer scrim gradient :230 (gradients don't transition, so consider `@property --paper` with `syntax:'<color>'`), menu panel :286, skip-link/other :324-325.
- `styles.css:242-251` contains the `.theme-toggle` and `:disabled` styles. The disabled style can be dropped.
- `styles.css:114` already has a `transition: opacity 1000ms var(--ease)` (canvas fade, `.shader-ready #ocean` at :118).

## ocean.js (10,124 B; budget 10,240 B means **116 B headroom**)
- :35 `var state = window.__ocean = { speed: 1, night: 0, tier: null };`. The comment says later milestones drive `night`.
- :30 declares the uniform names, including `u_night`. :165 `draw()` uploads `state.night` every frame. :155-167 is `draw(now)`, :210-223 is `frame()`, and the rAF loop stops in static mode.
- Static tier: `settleStatic` :172-177, then `drawStatic` :225-229, which calls `stopLoop()`, draws one frame and stops. **When night toggles in static tier nothing redraws.** M3 needs either a final `draw()` after the tween or a short rAF tween loop (~900 ms) that ends in a single static draw.
- No-WebGL: `fallback()` :74-77 removes `shader-ready` and adds `no-webgl`. The canvas stays hidden and the page shows the body `--paper` background, so night is pure CSS. The tween must no-op when `gl`/`program` is null.
- Context lost (:300-310) stops the loop. On restore, `init` re-runs and uses the current `state.night`, which is fine.
- Budget: an easing tween inside ocean.js (start time, from/to, smoothstep `t*t*(3-2t)`, which matches the cubic-bezier) likely exceeds 116 B. Recommendation: put the toggle, localStorage and matchMedia in **`static/site.js`** (the PLAN layout lists it for nav/theme). It would compute the target and set `__ocean.nightTarget` or call a tiny hook. Keep ocean.js minimal: in `draw`, ease `state.night` toward its target by `dt/0.9` with smoothstep, and restart rAF if static. Either way it needs trimming or a budget-reconciliation decision; ask the supervisor if it goes over.

## Shader (static/shader/ocean.frag.glsl)
- :11 `uniform float u_night; // 0 = day, 1 = night`
- :101-104 mixes the grain sigma, grain amount and the `dark`/`light` endpoints by `u_night`. Interpolating it linearly is fine; to match the CSS bezier, apply smoothstep to the time parameter in JS.

## No-flash
`ocean.js` and any `site.js` are deferred, so the class would apply after first paint and cause a light flash. Add a tiny **inline head script** before the stylesheet (base.html, between :6 and :13). It would read `localStorage.theme`. Values: `'night'`/`'day'`; absent = auto, i.e. `matchMedia('(prefers-color-scheme: dark)')`. It sets `.theme-night` on `<html>` and seeds `window.__ocean`. Note that ocean.js:35 *overwrites* `window.__ocean`, so either merge (`state.night = <html>.classList.contains('theme-night')?1:0` at init) or read the class. Also suppress transitions on initial load. The class is set before CSS applies, so there is no transition then. site.js handles clicks, cycles auto→night→day, and listens to the matchMedia `change` event while in auto.

## Tooling / harness
- zola 0.23.6, node v26.12.1. `/tmp/pw` has playwright installed.
- To serve: `zola serve --interface 127.0.0.1 --port 1111`
- `node /tmp/pw/shot.mjs http://127.0.0.1:1111 / /about/` runs under SwiftShader. It waits for `html.shader-ready`, writes screenshots and fails on console errors. Env vars: `NOGL=1`, `W`/`H`, `WAIT`, `TAG`, `SLOW=40` (forces static tier).
- `node /tmp/pw/m2check.mjs` checks layout metrics, tab order and the menu. It expects the toggle to be skipped in tab order (disabled), so it **will need updating** now that the toggle is focusable.
- `lifecycle.mjs` checks tier reuse, that there are 6 active uniforms, and context loss.
- An M3 check script is needed: click to cycle, verify localStorage plus class, sample `__ocean.night` mid/after 900 ms, run with SLOW=40 and NOGL, emulate `colorScheme:'dark'` with auto, and reload with no flash.

## Gaps vs checklist
- No toggle logic, no localStorage, no prefers-color-scheme, no site.js, no inline head script.
- No CSS transitions on colours; `--dur-theme` is unused.
- No u_night tween. The static tier doesn't redraw and the no-WebGL path needs a guard.
- The color-scheme meta is still `light`.

## Risks
- ocean.js byte budget (116 B headroom).
- `__ocean` overwrite ordering.
- The gradient scrim won't transition without `@property`.
- The M2 validators assert 1 script per page and a disabled toggle.
