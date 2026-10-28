// Does home warm the cache so the Digital Sun page plays from it?
// Runs twice: WARM (normal) vs COLD (fetch disabled on home). 1920x1080 → 4K AV1 tier.
import { chromium } from 'playwright';
const base = process.argv[2];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
for (const mode of ['WARM', 'COLD']) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p); await cdp.send('Network.enable');
  const net = []; const ids = {};
  cdp.on('Network.requestWillBeSent', e => { if (/video-.*mp4/.test(e.request.url)) ids[e.requestId] = { url: e.request.url.split('/').pop(), type: e.type, range: e.request.headers.Range || '' }; });
  cdp.on('Network.responseReceived', e => { if (ids[e.requestId]) Object.assign(ids[e.requestId], { status: e.response.status, fromDiskCache: e.response.fromDiskCache, fromCache: !!e.response.fromDiskCache || !!e.response.fromMemoryCache }); });
  cdp.on('Network.loadingFinished', e => { if (ids[e.requestId]) { ids[e.requestId].bytes = e.encodedDataLength; net.push(ids[e.requestId]); } });
  if (mode === 'COLD') await p.addInitScript(() => { window.fetch = undefined; });
  await p.goto(base + '/', { waitUntil: 'load' });
  await p.waitForFunction(() => document.documentElement.classList.contains('shader-ready'), null, { timeout: 60000 });
  await p.waitForTimeout(12000); // idle warm-up has time to finish
  const t0 = Date.now();
  await p.click('nav.nav-inline a');
  await p.waitForFunction(() => { const v = document.querySelector('.video-page video'); return v && v.classList.contains('playing'); }, null, { timeout: 60000 });
  const ms = Date.now() - t0;
  const src = await p.evaluate(() => document.querySelector('.video-page video').currentSrc.split('/').pop());
  console.log(`${mode}: click→playing ${ms} ms, plays ${src}`);
  for (const r of net) console.log('   ', JSON.stringify(r));
  await ctx.close();
}
await browser.close();
