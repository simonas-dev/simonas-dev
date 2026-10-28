import { chromium, webkit, devices } from 'playwright';
const U = process.argv[2] || 'http://127.0.0.1:1112';
for (const [name, bt, dev] of [['chromium-pixel', chromium, devices['Pixel 7']], ['webkit-iphone', webkit, devices['iPhone 14']]]) {
  let b; try { b = await bt.launch(); } catch (e) { console.log(name, 'launch failed', e.message.split('\n')[0]); continue; }
  const p = await (await b.newContext({ ...dev })).newPage();
  p.on('console', m => { if (m.type() === 'error') console.log('  console', m.text().slice(0, 120)); });
  const state = () => p.evaluate(() => { const v = document.querySelector('.sky-video video, .video-page video'); const s = document.querySelector('.sky-video'); return { path: location.pathname, cls: document.documentElement.className, vid: v && { paused: v.paused, rs: v.readyState, net: v.networkState, cls: v.className, src: (v.currentSrc || '').split('/').pop(), err: v.error && v.error.code }, failed: s && s.classList.contains('video-failed'), skyOpacity: s && getComputedStyle(s).opacity }; });
  const go = async () => { await p.tap('details.menu summary'); await p.waitForTimeout(300); await p.tap('.menu-panel a[href="/digital-sun/"]'); };
  await p.goto(U + '/'); await p.waitForTimeout(3000); console.log(name, 'home   ', JSON.stringify(await state()));
  await go(); await p.waitForTimeout(3500); console.log(name, 'sun    ', JSON.stringify(await state()));
  await p.goBack(); for (const t of [500, 2500, 5000]) { await p.waitForTimeout(t === 500 ? 500 : 2000); console.log(name, 'back+' + t, JSON.stringify(await state())); }
  await go(); await p.waitForTimeout(3000); await p.tap('a.logo'); await p.waitForTimeout(3000); console.log(name, 'logo   ', JSON.stringify(await state()));
  await b.close();
}
