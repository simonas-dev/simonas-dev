// Sky/sea luminance 250 ms into home→sun and sun→home, normal and reduced motion.
import { chromium } from 'playwright';
const base = process.argv[2];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
for (const [name, opts] of [['normal', {}], ['reduced', { reducedMotion: 'reduce' }]]) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 600 }, ...opts });
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'load' });
  await p.waitForFunction(() => document.documentElement.classList.contains('shader-ready'), null, { timeout: 60000 });
  await p.waitForTimeout(5000);
  await p.screenshot({ path: `/tmp/pw/xb_${name}_home.jpg`, quality: 70 });
  await p.click('nav.nav-inline a'); await p.waitForTimeout(250);
  await p.screenshot({ path: `/tmp/pw/xb_${name}_to.jpg`, quality: 70 });
  await p.waitForTimeout(4000);
  await p.screenshot({ path: `/tmp/pw/xb_${name}_sun.jpg`, quality: 70 });
  await p.click('a.logo'); await p.waitForTimeout(250);
  await p.screenshot({ path: `/tmp/pw/xb_${name}_back.jpg`, quality: 70 });
  await ctx.close();
}
await browser.close();
