// M6 checks: budget, ripples, stars + moon, reduced motion, visibility pause,
// speed tween, aria-current, OG/favicons/404, console errors.
// Usage: node m6check.mjs [base]   (default http://127.0.0.1:1111)
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import fs from 'fs';
import { execSync } from 'child_process';
const base = process.argv[2] || 'http://127.0.0.1:1111';
const REPO = '/Users/simonas/Projects/simonas-dev';
const OUT = '/tmp/m6';
fs.mkdirSync(OUT, { recursive: true });
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const results = []; let failed = false;
const check = (name, ok, info) => { results.push({ name, ok: !!ok }); if (!ok) failed = true; console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + JSON.stringify(info)); };
const errors = [];
const browser = await chromium.launch({ args: GL });

async function open({ W = 1440, H = 900, theme = 'day', path = '/', tier = 'high', reducedMotion = 'no-preference', init, wait = true, scheme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: scheme, reducedMotion });
  await ctx.addInitScript(([t, tier]) => {
    try {
      if (!sessionStorage.getItem('m6-init')) {
        if (t) localStorage.setItem('theme', t);
        if (tier) sessionStorage.setItem('ocean-tier', tier);
        sessionStorage.setItem('m6-init', '1');
      }
    } catch (e) {}
  }, [theme, tier]);
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await p.goto(base + path, { waitUntil: 'load' });
  if (wait) await ready(p);
  return { ctx, p };
}
const ready = (p) => p.waitForFunction(() => document.documentElement.classList.contains('shader-ready') && window.__ocean, null, { timeout: 120000, polling: 100 });
const png = (buf) => PNG.sync.read(buf);
const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const INK_NIGHT = lum(0xe8, 0xe6, 0xe1);
// Counts drawArrays calls on the ocean canvas.
const countDraws = () => {
  const orig = WebGLRenderingContext.prototype.drawArrays;
  window.__draws = 0;
  WebGLRenderingContext.prototype.drawArrays = function () { window.__draws++; return orig.apply(this, arguments); };
};
// document.hidden / visibilityState follow window.__hid.
const stubHidden = () => {
  window.__hid = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hid });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (window.__hid ? 'hidden' : 'visible') });
};
const setHidden = (p, h) => p.evaluate((h) => { window.__hid = h; document.dispatchEvent(new Event('visibilitychange')); }, h);
const bgOnly = (p) => p.addStyleTag({ content: 'body > :not(#ocean){visibility:hidden!important}' });

// ---------------------------------------------------------------- 1. Budget
{
  const js = fs.readdirSync(`${REPO}/static`).filter((f) => f.endsWith('.js')).map((f) => [f, fs.statSync(`${REPO}/static/${f}`).size]);
  const html = fs.readFileSync(`${REPO}/public/index.html`, 'utf8');
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].reduce((s, m) => s + Buffer.byteLength(m[1]), 0);
  const total = js.reduce((s, [, n]) => s + n, 0) + inline;
  let syntax = true;
  for (const [f] of js) { try { execSync(`node --check ${REPO}/static/${f}`); } catch (e) { syntax = false; } }
  const ocean = js.find(([f]) => f === 'ocean.js')[1];
  check('budget: ocean.js ≤ 11264 B, node --check, total JS (+inline) < 150 KB', ocean <= 11264 && syntax && total < 150 * 1024, { js, inline, total });
}

// ---------------------------------------------------------------- 2. Shader harness: tiers, day identity, stars, moon, perf
{
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await p.goto(base + '/404.html');
  const oldFrag = fs.readFileSync(`${OUT}/ocean.frag.pre.glsl`, 'utf8');
  const r = await p.evaluate(async (oldFrag) => {
    const W = 576, H = 360; // 1440x900 at the high tier's 0.4
    const vert = await (await fetch('/shader/ocean.vert.glsl')).text();
    const newFrag = await (await fetch('/shader/ocean.frag.glsl')).text();
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const gl = c.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, alpha: false });
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, W, H);
    const TIERS = [[12, 16], [10, 12], [8, 8]];
    const build = (frag, [rm, nm]) => {
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : (console.log(gl.getShaderInfoLog(o)), null); };
      const v = sh(gl.VERTEX_SHADER, vert), f = sh(gl.FRAGMENT_SHADER, `#define ITERS_RAYMARCH ${rm}\n#define ITERS_NORMAL ${nm}\n` + frag);
      if (!v || !f) return null;
      const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.bindAttribLocation(pr, 0, 'a_position'); gl.linkProgram(pr);
      return gl.getProgramParameter(pr, gl.LINK_STATUS) ? pr : null;
    };
    const tiers = TIERS.map((t) => !!build(newFrag, t));
    const progs = { old: build(oldFrag, TIERS[0]), cur: build(newFrag, TIERS[0]), starsOnly: build(newFrag.replace('mix(day, moon, u_night)', 'day'), TIERS[0]) };
    const render = (pr, { night = 0, wave = 7.3, time = 3.1, ripples = null } = {}) => {
      gl.useProgram(pr);
      const u = (n) => gl.getUniformLocation(pr, n);
      gl.uniform2f(u('iResolution'), W, H); gl.uniform1f(u('iTime'), time); gl.uniform1f(u('u_waveTime'), wave);
      gl.uniform1f(u('u_grainTime'), 0.25); gl.uniform1f(u('u_night'), night); gl.uniform1f(u('u_noiseScale'), 1);
      const ru = u('u_ripples'); if (ru) gl.uniform4fv(ru, ripples || new Float32Array(40));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px;
    };
    // Day identity: u_night = 0, no ripples, several times.
    let dayMax = 0, dayDiffPx = 0;
    for (const [wave, time] of [[0, 0], [7.3, 3.1], [123.4, 20.2]]) {
      const a = render(progs.old, { wave, time }), b = render(progs.cur, { wave, time });
      for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d) dayDiffPx++; if (d > dayMax) dayMax = d; }
    }
    // Stars: stars-only variant vs old at night. Horizon row (from bottom) = 0.382 H.
    const horizon = Math.round(0.382 * H);
    const a = render(progs.old, { night: 1 }), s = render(progs.starsOnly, { night: 1 });
    let above = 0, below = 0, maxStar = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, d = s[i] - a[i];
      if (d > maxStar) maxStar = d;
      if (d >= 3) { if (y > horizon + 1) above++; else if (y < horizon - 1) below++; }
    }
    // Moon: brightest sky pixel of cur vs old at night, near the sun direction.
    const n = render(progs.cur, { night: 1 });
    const at = (px, x, y) => px[(y * W + x) * 4];
    const sunY = Math.round(H * (0.5 + 0.5 * 1.5 * Math.tan(15 * Math.PI / 180 - 0.1561))), sunX = W >> 1;
    const moon = { centre: at(n, sunX, sunY), side: at(n, sunX + 40, sunY), oldCentre: at(a, sunX, sunY), dayCentre: null };
    // Perf: interleaved old/cur (inactive ripples) and cur with 10 active ripples.
    const rip = new Float32Array(40); for (let k = 0; k < 10; k++) rip.set([(k - 5) * 0.15, -0.6, 7.3 - 0.2 * k, 1], k * 4);
    const time = (pr, ripples) => { const t0 = performance.now(); for (let k = 0; k < 8; k++) render(pr, { wave: 7.3 + k * 0.01, ripples }); return performance.now() - t0; };
    const ms = { old: [], cur: [], active: [] };
    time(progs.old); time(progs.cur);
    for (let k = 0; k < 6; k++) { ms.old.push(time(progs.old)); ms.cur.push(time(progs.cur)); ms.active.push(time(progs.cur, rip)); }
    const med = (v) => v.slice().sort((x, y) => x - y)[v.length >> 1];
    // Ripple visibility (deterministic): cur with one ripple aged 1.5 vs none.
    const one = new Float32Array(40); one.set([0.1, -0.7, 7.3 - 1.5, 1], 0);
    const r0 = render(progs.cur), r1 = render(progs.cur, { ripples: one });
    let rippleDiff = 0, sx = 0, sy = 0, rn = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, d = Math.abs(r1[i] - r0[i]); if (d >= 4) { rippleDiff++; sx += x; sy += y; rn++; } }
    const expect = { x: (0.1 * H + W) / 2, y: (-0.7 * H + H) / 2 };
    // Sky click: ripple uv above the horizon → no change.
    const sky = new Float32Array(40); sky.set([0.1, 0.3, 7.3 - 1.5, 1], 0);
    const r2 = render(progs.cur, { ripples: sky });
    let skyDiff = 0; for (let i = 0; i < r0.length; i++) if (r2[i] !== r0[i]) skyDiff++;
    return { tiers, dayMax, dayDiffPx, horizon, above, below, maxStar, moon, sunY, perf: { old: med(ms.old), cur: med(ms.cur), active: med(ms.active), samples: ms }, ripple: { rippleDiff, centroid: rn ? { x: sx / rn, y: sy / rn } : null, expect }, skyDiff };
  }, oldFrag);
  check('shader: all 3 tiers compile and link', r.tiers.every(Boolean), r.tiers);
  check('shader: day frame (u_night 0, no ripples) identical to pre-M6', r.dayMax === 0, { dayMax: r.dayMax, diffBytes: r.dayDiffPx });
  check('stars: sparse stars above the horizon, none in the water', r.above >= 20 && r.above < 0.02 * 576 * 360 && r.below === 0, { above: r.above, below: r.below, maxStarDelta: r.maxStar });
  check('moon: lobe brighter than the sky beside it and than the old night sun', r.moon.centre > r.moon.side + 8 && r.moon.centre > r.moon.oldCentre, r.moon);
  const ratio = r.perf.cur / r.perf.old;
  check('perf: inactive ripples + stars cost within ±5% of pre-M6 (harness, interleaved)', Math.abs(ratio - 1) <= 0.05, { ratio: +ratio.toFixed(3), oldMs8: +r.perf.old.toFixed(1), curMs8: +r.perf.cur.toFixed(1), activeRipplesMs8: +r.perf.active.toFixed(1) });
  const c = r.ripple.centroid;
  check('ripple (harness): ring drawn around the clicked point; sky ripple draws nothing', r.ripple.rippleDiff > 200 && c && Math.abs(c.x - r.ripple.expect.x) < 60 && Math.abs(c.y - r.ripple.expect.y) < 60 && r.skyDiff === 0, r.ripple);
  await ctx.close();
}

// ---------------------------------------------------------------- 3. Ripples on the live page
const diffRegion = (a, b, cx, cy, rad) => {
  let sum = 0, n = 0;
  for (let y = Math.max(0, cy - rad); y < Math.min(a.height, cy + rad); y++) for (let x = Math.max(0, cx - rad); x < Math.min(a.width, cx + rad); x++) {
    const i = (y * a.width + x) * 4; sum += Math.abs(a.data[i] - b.data[i]); n++;
  }
  return sum / n;
};
// Grain-free comparison: 8x8 block means of the red channel, max |delta| in a box.
const blockDiff = (a, b, cx, cy, rad, B = 8) => {
  let max = 0;
  for (let by = Math.max(0, cy - rad); by + B <= Math.min(a.height, cy + rad); by += B) for (let bx = Math.max(0, cx - rad); bx + B <= Math.min(a.width, cx + rad); bx += B) {
    let s = 0;
    for (let y = by; y < by + B; y++) for (let x = bx; x < bx + B; x++) { const i = (y * a.width + x) * 4; s += a.data[i] - b.data[i]; }
    max = Math.max(max, Math.abs(s / (B * B)));
  }
  return max;
};
const diffImage = (a, b, path) => {
  const d = new PNG({ width: a.width, height: a.height });
  for (let i = 0; i < a.data.length; i += 4) { const v = Math.min(255, Math.abs(a.data[i] - b.data[i]) * 8); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  fs.writeFileSync(path, PNG.sync.write(d));
};
{
  const { ctx, p } = await open({ path: '/' });
  await bgOnly(p);
  // Freeze time: rAF always reports one timestamp, so waves, swell and grain stand
  // still and frames differ only by ripples; clicks are aged by hand.
  await p.waitForTimeout(1500); // past the 1 s canvas fade-in
  await p.evaluate(() => { const t = performance.now(); window.requestAnimationFrame = (cb) => setTimeout(() => cb(t), 16); });
  await p.waitForTimeout(300);
  const shot = async () => png(await p.screenshot());
  const A = await shot(); await p.waitForTimeout(250); const B = await shot();
  // Below the horizon (horizon at 61.8% from top).
  const cx = 820, cy = 760;
  const before = await p.evaluate(() => Array.from(window.__ocean.ripples));
  await p.mouse.click(cx, cy);
  const after = await p.evaluate(() => Array.from(window.__ocean.ripples));
  const slot = after.findIndex((v, i) => i % 4 === 3 && v === 1) - 3;
  const uv = after.slice(slot, slot + 2);
  const wantUv = [(2 * cx - 1440) / 900, (900 - 2 * cy) / 900];
  check('ripple click: pointerdown below horizon writes one slot with canvas uv', before.every((v) => v === 0) && slot === 0 && Math.abs(uv[0] - wantUv[0]) < 1e-3 && Math.abs(uv[1] - wantUv[1]) < 1e-3, { uv, wantUv });
  await p.evaluate(() => { window.__ocean.ripples[2] -= 1.5; });
  await p.waitForTimeout(400);
  const C = await shot();
  const noise = blockDiff(A, B, cx, cy, 160), ring = blockDiff(A, C, cx, cy, 160), far = blockDiff(A, C, 200, 150, 100);
  diffImage(A, C, `${OUT}/m6_ripple_diff.png`);
  fs.writeFileSync(`${OUT}/m6_ripple.png`, PNG.sync.write(C));
  check('ripple visible in diff screenshot around the click (vs grain noise)', ring > noise * 2 + 1, { noise: +noise.toFixed(2), ring: +ring.toFixed(2), farSky: +far.toFixed(2), shots: [`${OUT}/m6_ripple.png`, `${OUT}/m6_ripple_diff.png`] });
  // Sky click: a slot is written, the shader draws nothing.
  await p.evaluate(() => window.__ocean.ripples.fill(0));
  await p.waitForTimeout(300);
  const D = await shot();
  await p.mouse.click(720, 200);
  await p.evaluate(() => { window.__ocean.ripples[2] -= 1.5; });
  await p.waitForTimeout(400);
  const E = await shot(); await p.waitForTimeout(250); const F = await shot();
  const skyN = blockDiff(E, F, 720, 200, 150), sky = blockDiff(D, E, 720, 200, 150), skyW = blockDiff(D, E, 720, 700, 150);
  check('sky click: no visible ripple', sky < skyN * 2 + 1 && skyW < skyN * 2 + 1, { noise: +skyN.toFixed(2), sky: +sky.toFixed(2), waterBelow: +skyW.toFixed(2) });
  await ctx.close();
}
{
  // Night ripple under the moon: ripple normals push |R| > 1; sky() must clamp so the
  // moon's pow(sun, 3000) reflection doesn't blow out to clipped white.
  const { ctx, p } = await open({ path: '/', theme: 'night' });
  await bgOnly(p);
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const t = performance.now(); window.requestAnimationFrame = (cb) => setTimeout(() => cb(t), 16); });
  await p.waitForTimeout(300);
  const cx = 720, cy = 750; // flat-water reflection of the moon (15 deg below horizontal)
  const white = (im) => { let n = 0; for (let y = cy - 200; y < cy + 150; y++) for (let x = cx - 300; x < cx + 300; x++) { const i = (y * im.width + x) * 4; if (im.data[i] >= 254 && im.data[i + 1] >= 254 && im.data[i + 2] >= 254) n++; } return n; };
  const base0 = white(png(await p.screenshot()));
  await p.mouse.click(cx, cy);
  const counts = {}; let prev = 0, worst = 0, worstShot = null;
  for (const age of [0.4, 0.8, 1.2, 1.6, 2.2]) {
    await p.evaluate((d) => { window.__ocean.ripples[2] -= d; }, age - prev); prev = age;
    await p.waitForTimeout(400);
    const buf = await p.screenshot(); const n = white(png(buf)); counts[age] = n;
    if (n >= worst) { worst = n; worstShot = buf; }
  }
  fs.writeFileSync(`${OUT}/m6_ripple_night.png`, worstShot);
  check('night ripple below the moon: no clipped white in the ripple region', base0 === 0 && worst <= 4, { noRipple: base0, whiteByAge: counts, shot: `${OUT}/m6_ripple_night.png` });
  await ctx.close();
}
{
  // Links / header / footer: no slot written. Content page: none. Reduced motion: none.
  const { ctx, p } = await open({ path: '/' });
  const fire = (sel) => p.evaluate((sel) => {
    const el = document.querySelector(sel); const r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: r.x + 2, clientY: r.y + 2 }));
    return Array.from(window.__ocean.ripples).some((v) => v !== 0);
  }, sel);
  const hits = {};
  for (const sel of ['.logo', '.nav-inline a', '.theme-toggle', 'footer.chrome small']) hits[sel] = await fire(sel);
  check('ripple: ignored on logo/nav/toggle/footer', Object.values(hits).every((v) => !v), hits);
  await ctx.close();
}
{
  const { ctx, p } = await open({ path: '/posts/' });
  await p.mouse.click(30, 700);
  const any = await p.evaluate(() => Array.from(window.__ocean.ripples).some((v) => v !== 0));
  check('ripple: none on content pages', !any, { any });
  await ctx.close();
}
{
  const { ctx, p } = await open({ path: '/', reducedMotion: 'reduce' });
  await p.mouse.click(820, 760);
  const any = await p.evaluate(() => Array.from(window.__ocean.ripples).some((v) => v !== 0));
  check('ripple: none under reduced motion', !any, { any });
  await ctx.close();
}
{
  const { ctx, p } = await open({ path: '/', tier: 'static' });
  await p.mouse.click(820, 760);
  const s = await p.evaluate(() => ({ ripples: window.__ocean.ripples, cache: sessionStorage.getItem('ocean-tier') }));
  check('ripple: never in the static tier', s.ripples === null && s.cache === 'static', s);
  await ctx.close();
}

// ---------------------------------------------------------------- 4. Night screenshots, stars, moon, contrast
for (const [W, H] of [[1440, 900], [390, 844]]) {
  const { ctx, p } = await open({ W, H, theme: 'night', path: '/' });
  await p.waitForTimeout(1500);
  const full = `${OUT}/m6_night_${W}x${H}.png`;
  await p.screenshot({ path: full });
  const boxes = await p.evaluate(() => [...document.querySelectorAll('.logo, .nav-inline a, .menu summary, .hero h1, .hero p, footer.chrome small, .theme-toggle')]
    .map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height).map((r) => [r.x, r.y, r.width, r.height].map(Math.round)));
  await bgOnly(p); await p.waitForTimeout(300);
  const bgPath = `${OUT}/m6_night_${W}x${H}_bg.png`;
  const bg = png(await p.screenshot({ path: bgPath }));
  // Brightest background pixel under any chrome/hero text box.
  let maxL = 0;
  for (const [x0, y0, w, h] of boxes) for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) {
    const i = (y * W + x) * 4; maxL = Math.max(maxL, lum(bg.data[i], bg.data[i + 1], bg.data[i + 2]));
  }
  const worst = contrast(INK_NIGHT, maxL);
  check(`night ${W}x${H}: #e8e6e1 ≥ 4.5:1 over the brightest sampled sky pixel under text`, worst >= 4.5, { worst: +worst.toFixed(2), boxes: boxes.length, shots: [full, bgPath] });
  // Moon vs sky beside it (in CSS px of this viewport).
  const sunY = Math.round(H * (0.5 - 0.5 * 1.5 * Math.tan(15 * Math.PI / 180 - 0.1561))), sunX = W >> 1;
  const avg = (cx, cy) => { let s = 0, n = 0; for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) { s += bg.data[(y * W + x) * 4]; n++; } return s / n; };
  const moon = avg(sunX, sunY), side = avg(sunX + Math.round(W * 0.1), sunY);
  check(`night ${W}x${H}: moon lobe visible`, moon > side + 6, { moon: +moon.toFixed(1), side: +side.toFixed(1), at: [sunX, sunY] });
  await ctx.close();
}

// ---------------------------------------------------------------- 5. Reduced motion
{
  const { ctx, p } = await open({ path: '/', reducedMotion: 'reduce' });
  const home = await p.evaluate(() => window.__ocean.speed);
  await bgOnly(p);
  const a = await p.screenshot(); await p.waitForTimeout(300); const b = await p.screenshot();
  const grain = !a.equals(b);
  await ctx.close();
  const c = await open({ path: '/posts/', reducedMotion: 'reduce' });
  const content = await c.p.evaluate(() => window.__ocean.speed);
  await c.ctx.close();
  check('reduced motion: speed 0.3 home / 0.045 content, frames still change (grain)', Math.abs(home - 0.3) < 1e-9 && Math.abs(content - 0.045) < 1e-9 && grain, { home, content, grain });
}
{
  const { ctx, p } = await open({ path: '/' });
  const s0 = await p.evaluate(() => window.__ocean.speed);
  await p.emulateMedia({ reducedMotion: 'reduce' }); await p.waitForTimeout(200);
  const s1 = await p.evaluate(() => window.__ocean.speed);
  await p.emulateMedia({ reducedMotion: 'no-preference' }); await p.waitForTimeout(200);
  const s2 = await p.evaluate(() => window.__ocean.speed);
  check('reduced motion: live media change 1 → 0.3 → 1', s0 === 1 && Math.abs(s1 - 0.3) < 1e-9 && s2 === 1, { s0, s1, s2 });
  await ctx.close();
}

// ---------------------------------------------------------------- 6. Visibility pause
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  await ctx.addInitScript(`(${countDraws})();(${stubHidden})();try{if(!sessionStorage.getItem('m6v')){sessionStorage.setItem('ocean-tier','high');sessionStorage.setItem('m6v','1')}}catch(e){}`);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await p.goto(base + '/'); await ready(p);
  const d0 = await p.evaluate(() => window.__draws);
  await setHidden(p, true); await p.waitForTimeout(150);
  const h0 = await p.evaluate(() => window.__draws); await p.waitForTimeout(800);
  const h1 = await p.evaluate(() => window.__draws);
  await setHidden(p, false); await p.waitForTimeout(800);
  const v1 = await p.evaluate(() => window.__draws);
  check('visibility: 0 drawArrays while hidden, resumes on visible', d0 > 0 && h1 === h0 && v1 > h1, { d0, hiddenStart: h0, hiddenEnd: h1, visible: v1 });
  // Context loss: hidden → visible must not restart the loop.
  const lost = await p.evaluate(async () => {
    const gl = document.getElementById('ocean').getContext('webgl');
    window.__ext = gl.getExtension('WEBGL_lose_context');
    window.__ext.loseContext();
    await new Promise((r) => setTimeout(r, 200));
    window.__hid = true; document.dispatchEvent(new Event('visibilitychange'));
    window.__hid = false; document.dispatchEvent(new Event('visibilitychange'));
    const a = window.__draws;
    await new Promise((r) => setTimeout(r, 600));
    return { a, b: window.__draws, cls: document.documentElement.className };
  });
  check('visibility: no restart after context loss', lost.a === lost.b && !lost.cls.includes('shader-ready'), lost);
  await p.evaluate(() => window.__ext.restoreContext());
  await ready(p);
  await ctx.close();
}
{
  // Mid-probe hide: baseline probe tier vs probe interrupted by a 1.5 s hidden gap.
  const probeRun = async (hide) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
    await ctx.addInitScript(`(${stubHidden})();`);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await p.goto(base + '/');
    let hidMidProbe = false;
    if (hide) {
      await p.waitForFunction(() => window.__ocean && window.__ocean.tier && !document.documentElement.classList.contains('shader-ready'), null, { timeout: 60000, polling: 10 });
      hidMidProbe = await p.evaluate(() => !document.documentElement.classList.contains('shader-ready') && !sessionStorage.getItem('ocean-tier'));
      await setHidden(p, true); await p.waitForTimeout(1500); await setHidden(p, false);
    }
    await ready(p);
    const r = await p.evaluate(() => ({ tier: window.__ocean.tier, cache: sessionStorage.getItem('ocean-tier') }));
    await ctx.close();
    return { ...r, hidMidProbe };
  };
  const baseline = await probeRun(false);
  const hidden = await probeRun(true);
  check('visibility: hidden mid-probe leaves the cached tier unchanged', hidden.hidMidProbe && hidden.cache === baseline.cache && hidden.cache !== 'static', { baseline, hidden });
}

// ---------------------------------------------------------------- 7. Speed tween + aria-current
{
  const { ctx, p } = await open({ path: '/' });
  const current = () => p.evaluate(() => ['.nav-inline', '.menu-panel'].map((n) => [...document.querySelectorAll(`${n} a[aria-current="page"]`)].map((a) => a.getAttribute('href'))));
  const aria = { home: await current() };
  await p.evaluate(() => { window.__speeds = []; const tick = () => { window.__speeds.push(window.__ocean.speed); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await p.click('.nav-inline a[href="/posts/"]');
  await p.waitForFunction(() => location.pathname === '/posts/' && !document.querySelector('.htmx-swapping, .htmx-settling, .htmx-added'), null, { timeout: 15000, polling: 20 });
  aria.posts = await current();
  await p.waitForFunction(() => window.__ocean.speed === 0.15, null, { timeout: 5000, polling: 20 }).catch(() => {});
  const speeds = await p.evaluate(() => window.__speeds.slice());
  const final = await p.evaluate(() => window.__ocean.speed);
  const mid = speeds.filter((s) => s > 0.16 && s < 0.99).length;
  check('speed tween: home → /posts/ passes intermediate speeds, ends at 0.15', mid >= 3 && final === 0.15 && speeds[0] === 1, { intermediates: mid, first: speeds[0], final, n: speeds.length });
  await p.click('.nav-inline a[href="/photos/"]');
  await p.waitForFunction(() => location.pathname === '/photos/' && !document.querySelector('.htmx-swapping, .htmx-settling, .htmx-added'), null, { timeout: 15000, polling: 20 });
  aria.photos = await current();
  await p.click('.logo');
  await p.waitForFunction(() => location.pathname === '/' && !document.querySelector('.htmx-swapping, .htmx-settling, .htmx-added'), null, { timeout: 15000, polling: 20 });
  aria.homeAgain = await current();
  await p.goBack();
  await p.waitForFunction(() => location.pathname === '/photos/' && !document.querySelector('.htmx-swapping, .htmx-settling, .htmx-added'), null, { timeout: 15000, polling: 20 });
  aria.back = await current();
  await ctx.close();
  const c = await open({ path: '/photos/', W: 390, H: 844 });
  aria.photosFull = await c.p.evaluate(() => ['.nav-inline', '.menu-panel'].map((n) => [...document.querySelectorAll(`${n} a[aria-current="page"]`)].map((a) => a.getAttribute('href'))));
  const underline = await c.p.evaluate(() => { document.querySelector('.menu').open = true; return getComputedStyle(document.querySelector('.menu-panel a[aria-current]')).textDecorationLine; });
  await c.ctx.close();
  const one = (v, href) => v.every((list) => list.length === 1 && list[0] === href);
  const none = (v) => v.every((list) => list.length === 0);
  check('aria-current: one per nav on nav pages (full load + swaps + back), none on home; underlined', none(aria.home) && one(aria.posts, '/posts/') && one(aria.photos, '/photos/') && none(aria.homeAgain) && one(aria.back, '/photos/') && one(aria.photosFull, '/photos/') && underline === 'underline', { ...aria, underline });
}

// ---------------------------------------------------------------- 8. OG, favicons, 404
{
  const html = fs.readFileSync(`${REPO}/public/index.html`, 'utf8');
  const og = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1];
  const sips = execSync(`sips -g pixelWidth -g pixelHeight ${REPO}/static/og.jpg`).toString();
  const w = +sips.match(/pixelWidth: (\d+)/)[1], h = +sips.match(/pixelHeight: (\d+)/)[1];
  const size = fs.statSync(`${REPO}/static/og.jpg`).size;
  const tags = ['og:title', 'og:description', 'og:url', 'og:type'].every((t) => html.includes(`property="${t}"`)) && html.includes('name="twitter:card" content="summary_large_image"');
  check('OG: absolute og:image in built HTML; 1200x630 ≤ 120 KB; og/twitter tags', og === 'https://simonas.dev/og.jpg' && w === 1200 && h === 630 && size <= 120 * 1024 && tags, { og, w, h, size, tags });
  const icons = ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png'].every((f) => fs.existsSync(`${REPO}/public/${f}`)) && /rel="icon" href="\/favicon.svg" type="image\/svg\+xml"/.test(html) && /rel="apple-touch-icon"/.test(html);
  const ap = execSync(`sips -g pixelWidth -g pixelHeight -g hasAlpha ${REPO}/static/apple-touch-icon.png`).toString();
  check('icons: svg + ico + apple-touch-icon (180, opaque) linked and built', icons && /pixelWidth: 180/.test(ap) && /hasAlpha: no/.test(ap), { icons, ap: ap.replace(/\n\s*/g, ' ') });
  const colours = {};
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 200, height: 200 }, colorScheme: scheme });
    const p = await ctx.newPage();
    const shot = `${OUT}/m6_favicon_${scheme}.png`;
    await p.setContent(`<body style="margin:0;background:#888"><img src="${base}/favicon.svg" width="176" height="176" style="margin:12px"></body>`);
    await p.waitForTimeout(300);
    const im = png(await p.screenshot({ path: shot }));
    const px = (x, y) => { const i = (y * 200 + x) * 4; return '#' + [0, 1, 2].map((k) => im.data[i + k].toString(16).padStart(2, '0')).join(''); };
    // 16-unit grid at 11 px/unit; ink on the S top bar (unit 7.5, 4.5).
    colours[scheme] = { bg: px(12 + 16, 12 + 100), ink: px(12 + Math.round(7.5 * 11), 12 + Math.round(4.5 * 11)), shot };
    await ctx.close();
  }
  check('favicon.svg flips colours under prefers-color-scheme: dark', colours.light.bg === '#faf9f6' && colours.light.ink === '#353431' && colours.dark.bg === '#1a1a1a' && colours.dark.ink === '#e8e6e1', colours);
  const exists = fs.existsSync(`${REPO}/public/404.html`);
  const res = await fetch(base + '/no-such-page/');
  const body = await res.text();
  check('404: public/404.html exists; unknown path → 404 page', exists && res.status === 404 && body.includes('class="not-found"'), { exists, status: res.status });
  const { ctx, p } = await open({ path: '/' });
  const docs = [];
  p.on('request', (r) => { if (r.isNavigationRequest()) docs.push(new URL(r.url()).pathname); });
  await p.evaluate(() => { const a = document.createElement('a'); a.href = '/no-such-page/'; a.id = 'm6missing'; a.textContent = 'missing'; document.querySelector('#main').prepend(a); });
  await p.click('#m6missing');
  await p.waitForFunction(() => location.pathname === '/no-such-page/' && document.querySelector('.not-found'), null, { timeout: 30000, polling: 50 });
  const s = await p.evaluate(() => ({ h1: document.querySelector('.not-found').textContent, font: getComputedStyle(document.querySelector('.not-found')).fontFamily, title: document.title, surface: !!document.querySelector('.content-surface'), speed: window.__ocean && window.__ocean.speed }));
  await p.screenshot({ path: `${OUT}/m6_404.png` });
  // The full load itself logs the expected 404 resource error.
  for (let i = errors.length - 1; i >= 0; i--) if (/404|Response Status Error/.test(errors[i])) errors.splice(i, 1);
  check('404: boosted link to a missing page full-loads the 404 page (mono 404, content surface)', docs.includes('/no-such-page/') && s.h1 === '404' && /Departure Mono/.test(s.font) && s.surface, { docs, ...s, shot: `${OUT}/m6_404.png` });
  await ctx.close();
}

await browser.close();
check('no console errors / pageerrors', errors.length === 0, errors);
console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS', `${results.filter((r) => r.ok).length}/${results.length}`);
process.exit(failed ? 1 : 0);
