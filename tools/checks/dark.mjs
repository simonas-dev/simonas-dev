import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:1112';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
  await ctx.addInitScript(() => { try { localStorage.setItem('theme', 'day'); } catch (e) {} }); // old stored choice must be ignored
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  for (const path of ['/', '/nope/']) {
    await p.goto(base + path, { waitUntil: 'load' });
    await p.waitForFunction(() => document.documentElement.classList.contains('shader-ready'), null, { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => ({ cls: document.documentElement.className, night: window.__ocean && window.__ocean.night, ink: getComputedStyle(document.body).color, footer: document.querySelector('footer').innerText.trim(), toggle: !!document.querySelector('.theme-toggle') }));
    await p.screenshot({ path: `/tmp/pw/dark_${scheme}${path.replace(/\//g, '_')}.png` });
    console.log(scheme.padEnd(5), path.padEnd(7), JSON.stringify(r));
  }
  if (errs.length) console.log('ERR', errs);
  await ctx.close();
}
await browser.close();
