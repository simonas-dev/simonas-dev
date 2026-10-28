// M3 day/night checks: toggle cycle/storage/reload/OS scheme/keyboard/storage-throwing,
// no flash on night reload, CSS + u_night tween timing, reversal, static tier, NOGL.
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
const base = 'http://127.0.0.1:1111';
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const results = []; let failed = false;
const check = (name, ok, info) => { results.push({ name, ok: !!ok, info }); if (!ok) failed = true; console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + JSON.stringify(info)); };
const allErrors = [];
async function open(browser, { scheme = 'light', init, slow, path = '/', wait = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') allErrors.push('console: ' + m.text()); });
  if (slow) await p.addInitScript((ms) => { window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), ms); }, slow);
  if (init) await p.addInitScript(init);
  await p.goto(base + path, { waitUntil: 'load' });
  if (wait) await p.waitForFunction(() => document.documentElement.classList.contains('shader-ready'), null, { timeout: 60000 });
  return { ctx, p };
}
const ui = (p) => p.evaluate(() => { const b = document.querySelector('.theme-toggle'); let s; try { s = localStorage.getItem('theme'); } catch (e) { s = 'THROWS'; } return { stored: s, night: document.documentElement.classList.contains('theme-night'), text: b.textContent, label: b.getAttribute('aria-label'), disabled: b.disabled, u: window.__ocean && window.__ocean.night }; });

const settle = (p) => p.waitForFunction(() => !window.__ocean || window.__ocean.night === (document.documentElement.classList.contains('theme-night') ? 1 : 0), null, { timeout: 8000 }).catch(() => {});
const gl = await chromium.launch({ args: GL });

// 1. Cycle + storage + reload.
{
  const { ctx, p } = await open(gl);
  const s0 = await ui(p);
  check('initial auto (light OS)', s0.stored === null && !s0.night && s0.text === 'Auto' && s0.label === 'Theme: Auto' && !s0.disabled && s0.u === 0, s0);
  const seq = [];
  for (let i = 0; i < 3; i++) { await p.click('.theme-toggle'); await p.waitForTimeout(1000); await settle(p); seq.push(await ui(p)); }
  check('click → night', seq[0].stored === 'night' && seq[0].night && seq[0].text === 'Night' && seq[0].label === 'Theme: Night' && seq[0].u === 1, seq[0]);
  check('click → day', seq[1].stored === 'day' && !seq[1].night && seq[1].text === 'Day' && seq[1].label === 'Theme: Day' && seq[1].u === 0, seq[1]);
  check('click → auto (key removed)', seq[2].stored === null && !seq[2].night && seq[2].text === 'Auto' && seq[2].u === 0, seq[2]);
  await p.click('.theme-toggle'); await p.waitForTimeout(1000);
  await p.reload({ waitUntil: 'load' });
  const r1 = await ui(p);
  check('reload keeps night', r1.stored === 'night' && r1.night && r1.text === 'Night' && r1.u === 1, r1);
  await p.click('.theme-toggle'); await p.waitForTimeout(100); await p.reload({ waitUntil: 'load' });
  const r2 = await ui(p);
  check('reload keeps day', r2.stored === 'day' && !r2.night && r2.text === 'Day' && r2.u === 0, r2);
  await ctx.close();
}

// 2. OS scheme: dark + auto → night; live flip in auto; ignored in day.
{
  const { ctx, p } = await open(gl, { scheme: 'dark' });
  const a = await ui(p);
  check('dark OS + auto → night on load', a.night && a.text === 'Auto' && a.u === 1, a);
  await p.emulateMedia({ colorScheme: 'light' }); await p.waitForTimeout(1000); await settle(p);
  const b = await ui(p);
  check('auto live flip dark→light', !b.night && b.u === 0, b);
  await p.emulateMedia({ colorScheme: 'dark' }); await p.waitForTimeout(1000); await settle(p);
  const c = await ui(p);
  check('auto live flip light→dark', c.night && c.u === 1, c);
  await p.click('.theme-toggle'); await p.click('.theme-toggle'); await p.waitForTimeout(1000); // → night → day
  const d = await ui(p);
  check('day mode on dark OS', d.stored === 'day' && !d.night && d.u === 0, d);
  await p.emulateMedia({ colorScheme: 'light' }); await p.waitForTimeout(300);
  await p.emulateMedia({ colorScheme: 'dark' }); await p.waitForTimeout(1000);
  const e = await ui(p);
  check('day mode ignores OS flip', !e.night && e.u === 0, e);
  await ctx.close();
}

// 3. Keyboard: Enter and Space.
{
  const { ctx, p } = await open(gl);
  await p.focus('.theme-toggle');
  await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  const a = await ui(p);
  await p.keyboard.press('Space'); await p.waitForTimeout(100);
  const b = await ui(p);
  check('Enter → night, Space → day', a.stored === 'night' && b.stored === 'day', { a: a.stored, b: b.stored });
  // Tab reaches the toggle.
  await p.evaluate(() => document.activeElement.blur());
  const order = [];
  for (let i = 0; i < 8; i++) { await p.keyboard.press('Tab'); order.push(await p.evaluate(() => document.activeElement.className || document.activeElement.tagName)); }
  check('toggle in tab order', order.includes('theme-toggle'), order);
  await ctx.close();
}

// 4. Storage throwing.
{
  const errsBefore = allErrors.length;
  const { ctx, p } = await open(gl, { init: () => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }); } });
  const seq = [await ui(p)];
  for (let i = 0; i < 3; i++) { await p.click('.theme-toggle'); await p.waitForTimeout(150); seq.push(await ui(p)); }
  check('storage throwing: cycles in memory, no errors', allErrors.length === errsBefore && seq.map((s) => s.text).join() === 'Auto,Night,Day,Auto' && seq[1].night && !seq[2].night, seq.map((s) => [s.stored, s.text, s.night]));
  await ctx.close();
}

// 5. No light flash on night reload: state at DOMContentLoaded + screenshot.
{
  const { ctx, p } = await open(gl, { init: () => {
    try { localStorage.setItem('theme', 'night'); } catch (e) {}
    document.addEventListener('DOMContentLoaded', () => {
      window.__dcl = { cls: document.documentElement.className, bg: getComputedStyle(document.body).backgroundColor, anims: document.getAnimations().length };
    });
  }, wait: false });
  await p.reload({ waitUntil: 'commit' });
  await p.waitForFunction(() => window.__dcl);
  const shot = await p.screenshot({ path: '/tmp/pw/m3_night_reload_dcl.png' });
  const png = PNG.sync.read(shot); let max = 0, sum = 0;
  for (let k = 0; k < png.data.length; k += 4) { const l = 0.299 * png.data[k] + 0.587 * png.data[k + 1] + 0.114 * png.data[k + 2]; sum += l; }
  // Brightest pixel ignoring text: sample a text-free band (row 150).
  for (let i = 0; i < png.width; i++) { const k = (png.width * 150 + i) * 4; max = Math.max(max, png.data[k]); }
  const dcl = await p.evaluate(() => window.__dcl);
  check('night reload: dark at DCL, no transition', dcl.cls.includes('theme-night') && dcl.bg === 'rgb(26, 26, 26)' && dcl.anims === 0 && max < 60, { dcl, meanLum: +(sum / (png.data.length / 4)).toFixed(1), row150Max: max, shot: '/tmp/pw/m3_night_reload_dcl.png' });
  await ctx.close();
}

// 6. Timing: --paper / __ocean.night at 450 ms and 950 ms; mid-tween reversal.
async function timing(p, label) {
  return p.evaluate(async () => {
    const cs = () => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
    const t0 = performance.now();
    document.querySelector('.theme-toggle').click();
    await new Promise((r) => setTimeout(r, 450));
    const mid = { t: Math.round(performance.now() - t0), paper: cs(), night: window.__ocean.night };
    await new Promise((r) => setTimeout(r, 500));
    const end = { t: Math.round(performance.now() - t0), paper: cs(), night: window.__ocean.night };
    return { mid, end };
  });
}
const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
{
  const { ctx, p } = await open(gl);
  await p.waitForTimeout(500);
  const t = await timing(p);
  const m = rgb(t.mid.paper)[0];
  check('--paper midway at ~450ms', m < 250 && m > 26, t.mid);
  check('__ocean.night ≈0.5 at ~450ms', Math.abs(t.mid.night - 0.5) < 0.12, t.mid);
  check('final at ≥950ms: --paper #1a1a1a, night === 1', rgb(t.end.paper).join() === '26,26,26' && t.end.night === 1, t.end);
  // Reverse: back to day via night→day (click once more = day).
  const t2 = await timing(p);
  check('night→day final', rgb(t2.end.paper).join() === '250,249,246' && t2.end.night === 0, t2);
  // Mid-tween reversal: day → (auto) no change; so go auto, then night, reverse at 300ms by clicking twice (night→day).
  await p.click('.theme-toggle'); await p.waitForTimeout(100); // → auto (day)
  const rev = await p.evaluate(async () => {
    const samples = []; let stop = false;
    const t0 = performance.now();
    (function s() { samples.push([Math.round(performance.now() - t0), window.__ocean.night, getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()]); if (!stop) setTimeout(s, 10); })();
    document.querySelector('.theme-toggle').click(); // auto → night
    await new Promise((r) => setTimeout(r, 300));
    document.querySelector('.theme-toggle').click(); // night → day (reversal)
    await new Promise((r) => setTimeout(r, 1000));
    stop = true;
    return samples;
  });
  let maxJump = 0, maxPaperJump = 0, peak = 0;
  for (let i = 1; i < rev.length; i++) { maxJump = Math.max(maxJump, Math.abs(rev[i][1] - rev[i - 1][1])); maxPaperJump = Math.max(maxPaperJump, Math.abs(rgb(rev[i][2])[0] - rgb(rev[i - 1][2])[0])); peak = Math.max(peak, rev[i][1]); }
  const last = rev[rev.length - 1];
  check('mid-tween reversal continuous', maxJump < 0.12 && maxPaperJump < 40 && peak > 0.1 && peak < 0.6 && last[1] === 0 && rgb(last[2]).join() === '250,249,246', { samples: rev.length, maxJump: +maxJump.toFixed(3), maxPaperJump, peak: +peak.toFixed(3), last });
  await ctx.close();
}

// 7. Static tier (SLOW=40): night toggle redraws the canvas.
{
  const { ctx, p } = await open(gl, { slow: 40 });
  await p.waitForTimeout(500);
  const tier = await p.evaluate(() => ({ tier: window.__ocean.tier, cache: sessionStorage.getItem('ocean-tier') }));
  const skyLum = async () => { const png = PNG.sync.read(await p.screenshot({ clip: { x: 900, y: 140, width: 300, height: 60 } })); let s = 0; for (let k = 0; k < png.data.length; k += 4) s += png.data[k]; return s / (png.data.length / 4); };
  const before = await skyLum();
  await p.evaluate(() => { const o = window.__ocean; const r = o.redraw; o.__calls = 0; o.redraw = function () { o.__calls++; r(); }; });
  await p.click('.theme-toggle'); await p.waitForTimeout(1200);
  const after = await skyLum();
  const st = await p.evaluate(() => ({ calls: window.__ocean.__calls, night: window.__ocean.night }));
  await p.screenshot({ path: '/tmp/pw/m3_static_night.png' });
  check('static tier redraws on toggle', tier.cache === 'static' && st.calls > 5 && st.night === 1 && before > 200 && after < 110, { ...tier, ...st, skyBefore: +before.toFixed(1), skyAfter: +after.toFixed(1), shot: '/tmp/pw/m3_static_night.png' });
  await ctx.close();
}
await gl.close();

// 8. NOGL night.
{
  const nogl = await chromium.launch({ args: ['--disable-webgl', '--disable-3d-apis', '--disable-gpu'] });
  const { ctx, p } = await open(nogl, { wait: false });
  await p.click('.theme-toggle'); await p.waitForTimeout(1100);
  const s = await p.evaluate(() => ({ cls: document.documentElement.className, bg: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.body).color, footerBg: getComputedStyle(document.querySelector('footer.chrome')).backgroundImage.slice(0, 60), night: window.__ocean && window.__ocean.night }));
  await p.screenshot({ path: '/tmp/pw/m3_nogl_night.png' });
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = (s) => { const [r, g, b] = rgb(s); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
  const cr = (L(s.ink) + 0.05) / (L(s.bg) + 0.05);
  check('NOGL night: dark bg, ink ≥ 4.5:1', s.cls.includes('no-webgl') && s.cls.includes('theme-night') && s.bg === 'rgb(26, 26, 26)' && cr >= 4.5, { ...s, contrast: +cr.toFixed(2), shot: '/tmp/pw/m3_nogl_night.png' });
  await ctx.close(); await nogl.close();
}

check('no console errors / pageerrors', allErrors.length === 0, allErrors);
console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS', `${results.filter((r) => r.ok).length}/${results.length}`);
process.exit(failed ? 1 : 0);
