// Frames through home→sun and sun→home crossfades; mean luminance per frame.
import { chromium } from 'playwright';
const base = process.argv[2];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
const p = await ctx.newPage();
await p.goto(base + '/', { waitUntil: 'load' });
await p.waitForFunction(() => document.documentElement.classList.contains('shader-ready'), null, { timeout: 60000 });
await p.waitForTimeout(8000); // idle preload done
for (const [dir, act] of [['to', () => p.click('nav.nav-inline a')], ['back', () => p.click('a.logo')]]) {
  const t0 = Date.now(); await act();
  for (let i = 0; i < 9; i++) { await p.screenshot({ path: `/tmp/pw/xfr_${dir}_${i}.jpg`, quality: 70 }); await p.waitForTimeout(120); }
  console.log(dir, 'shots over', Date.now() - t0, 'ms');
  await p.waitForTimeout(3000);
}
await browser.close();
