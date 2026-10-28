import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:1112';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto(base + '/', { waitUntil: 'load' });
await p.waitForFunction(() => document.documentElement.classList.contains('shader-ready'), null, { timeout: 60000 });
await p.waitForTimeout(2000);
// record view-transition animations as they start
await p.evaluate(() => { window.__vt = []; const o = new MutationObserver(() => {}); 
  setInterval(() => { for (const a of document.getAnimations()) { const pe = a.effect && a.effect.pseudoElement; if (pe && pe.includes('view-transition') && !window.__vt.some(x => x.a === a)) window.__vt.push({ a, pe, d: a.effect.getTiming().duration, t: performance.now() }); } }, 20); });
const step = async (label, act, shot) => {
  await p.evaluate(() => { window.__vt.length = 0; });
  await act();
  await p.waitForTimeout(700); await p.screenshot({ path: `/tmp/pw/xf_${shot}.png` });
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => ({ path: location.pathname, vt: [...new Set(window.__vt.map(x => x.pe + ' ' + x.d))], cls: document.documentElement.classList.contains('sun-crossfade'),
    playing: [...document.querySelectorAll('video')].map(v => v.parentElement.className + ':' + !v.paused), paused: !!window.__ocean.paused }));
  console.log(label.padEnd(14), JSON.stringify(r));
};
await step('home→sun', () => p.click('nav.nav-inline a'), 'to_sun');
await step('back→home', () => p.goBack(), 'back_home');
await step('forward→sun', () => p.goForward(), 'fwd_sun');
await step('logo→home', () => p.click('a.logo'), 'logo_home');
await p.goto(base + '/nope/'); await p.waitForTimeout(1500); await p.evaluate(() => { window.__vt = []; setInterval(() => { for (const a of document.getAnimations()) { const pe = a.effect && a.effect.pseudoElement; if (pe && pe.includes('view-transition') && !window.__vt.some(x => x.a === a)) window.__vt.push({ a, pe, d: a.effect.getTiming().duration }); } }, 20); });
await step('404→home', () => p.click('a.logo'), 'nf_home');
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
await browser.close();
