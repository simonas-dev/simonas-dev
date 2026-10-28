import { chromium, webkit, devices } from 'playwright';
const U = 'http://127.0.0.1:1112';
for (const [name, bt, dev] of [['chromium', chromium, devices['Pixel 7']], ['webkit', webkit, devices['iPhone 14']]]) for (const hang of [false, true]) {
  const b = await bt.launch(); const p = await (await b.newContext({ ...dev })).newPage();
  p.on('pageerror', e => console.log('  pageerror', e.message));
  const st = () => p.evaluate(() => { const v = document.querySelector('.sky-video video, .video-page video'); const pic = document.querySelector('.sky-video picture'); return `${location.pathname} video paused=${v.paused} playing=${v.classList.contains('playing')} opacity=${getComputedStyle(v).opacity} poster=${pic ? getComputedStyle(pic).visibility : '-'}`; });
  const go = async () => { await p.tap('details.menu summary'); await p.waitForTimeout(300); await p.tap('.menu-panel a[href="/digital-sun/"]'); };
  await p.goto(U + '/'); await p.waitForTimeout(3000); console.log(name, hang ? 'HANG' : 'ok  ', 'home ', await st());
  await go(); await p.waitForTimeout(3000);
  if (hang) await p.evaluate(() => { const real = HTMLMediaElement.prototype.play; let n = 0; HTMLMediaElement.prototype.play = function () { if (n++ < 1) return new Promise(() => {}); return real.call(this); }; });
  await p.goBack(); await p.waitForTimeout(600); console.log(name, hang ? 'HANG' : 'ok  ', 'back0.6', await st());
  await p.waitForTimeout(3000); console.log(name, hang ? 'HANG' : 'ok  ', 'back3.6', await st());
  await b.close();
}
