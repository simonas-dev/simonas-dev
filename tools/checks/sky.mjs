// Home sky-video check: day/night × desktop/mobile. Reports video state + mask.
import { chromium } from 'playwright';
const base = 'http://127.0.0.1:1112';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
for (const [name, w, h, night] of [['day_1280', 1280, 800, 0], ['night_1280', 1280, 800, 1], ['day_390', 390, 844, 0], ['night_390', 390, 844, 1]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: night ? 'dark' : 'light' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(base + '/', { waitUntil: 'load' });
  await p.waitForFunction(() => document.documentElement.classList.contains('shader-ready'), null, { timeout: 60000 }).catch(() => errs.push('no shader-ready'));
  await p.waitForTimeout(4000);
  const info = await p.evaluate(() => {
    const v = document.querySelector('.sky-video video'), l = document.querySelector('.sky-video'), cs = getComputedStyle(l);
    return { src: v.currentSrc.split('/').pop(), paused: v.paused, playing: v.classList.contains('playing'), t: +v.currentTime.toFixed(2),
      opacity: cs.opacity, mask: (cs.maskImage || cs.webkitMaskImage).slice(0, 120), horizon: getComputedStyle(document.documentElement).getPropertyValue('--scene-horizon-from-bottom'),
      oceanPaused: !!(window.__ocean && window.__ocean.paused), nav: document.querySelectorAll('header').length };
  });
  await p.screenshot({ path: `/tmp/pw/sky_${name}.png` });
  console.log(name, JSON.stringify(info), errs.length ? 'ERR ' + errs.join(' | ') : 'no errors');
  await ctx.close();
}
await browser.close();
