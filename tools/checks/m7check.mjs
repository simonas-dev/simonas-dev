import { chromium } from 'playwright';
const base = process.env.BASE || 'http://127.0.0.1:18117';
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
const browser = await chromium.launch({ args: GL });
const results = []; const errors = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' ' + info : '')); };
const chrome = () => {
  const q = (s) => document.querySelector(s);
  const st = (s) => { const el = q(s); if (!el) return null; const c = getComputedStyle(el); const r = el.getBoundingClientRect(); return { op: c.opacity, color: c.color, z: c.zIndex, vis: c.display !== 'none' && r.width > 0, r: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] }; };
  const v = q('.video-page video');
  return { logo: st('a.logo'), header: st('header.chrome'), footer: st('footer.chrome'), caption: st('.video-caption'), bodyBg: getComputedStyle(document.body).backgroundColor,
    playing: v && v.classList.contains('playing'), paused: v && v.paused, src: v && v.currentSrc.split('/').pop(), oceanPaused: window.__ocean && window.__ocean.paused, wave: window.__ocean && window.__ocean.wave,
    videoTransform: getComputedStyle(q('.video-page') || document.body).transform, night: document.documentElement.classList.contains('theme-night') };
};

// 1. Screenshots + chrome checks: desktop/mobile × day/night.
for (const theme of ['day', 'night']) for (const [W, H] of [[1440, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'light', deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch (e) {} }, theme);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + '/digital-sun/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(chrome);
  const file = `/tmp/m7/${theme}_${W}x${H}.png`;
  await page.screenshot({ path: file });
  const light = 'rgb(232, 230, 225)';
  const ok = r.logo.vis && r.logo.op === '0.55' && r.logo.color === light && +r.logo.z > 100 && r.header.op === '0.55' && r.header.color === light &&
    r.footer.op === '0.55' && r.caption.vis && r.caption.op === '0.55' && r.caption.color === light && r.bodyBg === 'rgb(0, 0, 0)' && r.night === (theme === 'night') && r.oceanPaused === true;
  check(`chrome ${file}`, ok, JSON.stringify({ playing: r.playing, src: r.src, caption: r.caption.r, logo: r.logo.r }));
  if (W === 1440) {
    await page.hover('a.logo');
    await page.waitForTimeout(400);
    const op = await page.evaluate(() => getComputedStyle(document.querySelector('a.logo')).opacity);
    check(`hover logo → 1 (${theme})`, op === '1', op);
    await page.mouse.move(700, 450);
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    await page.waitForTimeout(400);
    const f = await page.evaluate(() => ({ active: document.activeElement.textContent, header: getComputedStyle(document.querySelector('header.chrome')).opacity }));
    check(`focus-within header → 1 (${theme})`, f.header === '1', JSON.stringify(f));
  } else {
    await page.click('details.menu > summary');
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => ({ op: getComputedStyle(document.querySelector('header.chrome')).opacity, color: getComputedStyle(document.querySelector('.menu-panel a')).color, bg: getComputedStyle(document.querySelector('.menu-panel')).backgroundColor, links: [...document.querySelectorAll('.menu-panel a')].map(a => a.textContent + (a.getAttribute('aria-current') ? '*' : '')).join(',') }));
    await page.screenshot({ path: `/tmp/m7/${theme}_${W}x${H}_menu.png` });
    check(`menu open (${theme})`, m.op === '1' && m.color === 'rgb(232, 230, 225)' && m.links === 'Digital Sun*', JSON.stringify(m));
  }
  await ctx.close();
}

// 2. Ocean pause/resume + playback + release across htmx nav and history.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const mp4 = []; page.on('request', (q) => { if (q.url().endsWith('.mp4')) mp4.push(q.url().split('/').pop()); });
  await page.goto(base + '/digital-sun/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const w1 = await page.evaluate(() => window.__ocean.wave);
  await page.waitForTimeout(800);
  const a = await page.evaluate(chrome);
  check('cold load: ocean paused, no frames', a.oceanPaused === true && a.wave === w1, `wave=${w1}→${a.wave}`);
  check('cold load: video playing', a.playing && !a.paused, JSON.stringify({ src: a.src, mp4 }));
  // visibility hidden → pause; visible → play
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  const h = await page.evaluate(() => document.querySelector('video').paused);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(600);
  const hv = await page.evaluate(() => ({ paused: document.querySelector('video').paused, ocean: window.__ocean.paused }));
  check('visibility: hidden pauses, visible resumes (ocean stays paused)', h === true && hv.paused === false && hv.ocean === true, JSON.stringify({ h, hv }));
  // boosted nav away
  await page.evaluate(() => { window.__v = document.querySelector('video'); });
  await page.click('a.logo');
  await page.waitForTimeout(1500);
  const b = await page.evaluate(() => ({ videos: document.querySelectorAll('video').length, connected: window.__v.isConnected, children: window.__v.children.length, net: window.__v.networkState, ready: window.__v.readyState, paused: window.__v.paused, ocean: window.__ocean.paused, wave: window.__ocean.wave, path: location.pathname }));
  await page.waitForTimeout(500);
  const wb = await page.evaluate(() => window.__ocean.wave);
  check('nav away: video removed + released, ocean resumes', b.path === '/' && b.videos === 0 && !b.connected && b.children === 0 && b.net === 0 && b.ready === 0 && b.paused && b.ocean === false && wb > b.wave, JSON.stringify({ ...b, wb }));
  // back (history restore)
  await page.goBack();
  await page.waitForTimeout(1500);
  const c = await page.evaluate(chrome);
  const wc0 = c.wave; await page.waitForTimeout(500); const wc1 = await page.evaluate(() => window.__ocean.wave);
  check('back to video: ocean paused, video playing', c.oceanPaused === true && wc0 === wc1 && c.playing && !c.paused, JSON.stringify({ wc0, wc1, playing: c.playing }));
  await page.goForward();
  await page.waitForTimeout(1500);
  const d = await page.evaluate(() => ({ videos: document.querySelectorAll('video').length, ocean: window.__ocean.paused, path: location.pathname }));
  check('forward to home: ocean resumes', d.ocean === false && d.videos === 0 && d.path === '/', JSON.stringify(d));
  // boosted nav to video from photos
  await page.click('nav.nav-inline a[href="/digital-sun/"]');
  await page.waitForTimeout(2000);
  const e = await page.evaluate(chrome);
  const cur = await page.evaluate(() => [...document.querySelectorAll('nav.nav-inline a')].map(a => a.textContent + (a.getAttribute('aria-current') ? '*' : '')).join(','));
  check('boosted nav (home→video, via forward history) to video: paused ocean, playing, aria-current', e.oceanPaused === true && e.playing && cur === 'Digital Sun*' && e.videoTransform === 'none', JSON.stringify({ cur, t: e.videoTransform }));
  const snap = await page.evaluate(() => { const c = JSON.parse(sessionStorage.getItem('htmx-history-cache') || '[]'); const v = c.find(x => x.url.includes('digital-sun')); return v ? /class="[^"]*playing/.test(v.content.match(/<video[^>]*>/)[0]) : 'none'; });
  check('history snapshot of video page has no .playing', snap === false, String(snap));
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.click('nav.nav-inline a[href="/digital-sun/"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/m7/boosted_from_home.png' });
  const f = await page.evaluate(chrome);
  check('home → video boosted: ocean paused, playing', f.oceanPaused === true && f.playing, '');
  await ctx.close();
}

// 3. Reduced motion and Save-Data: zero mp4 requests.
for (const mode of ['reduce', 'savedata', '2g']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: mode === 'reduce' ? 'reduce' : 'no-preference' });
  if (mode !== 'reduce') await ctx.addInitScript((m) => { Object.defineProperty(Navigator.prototype, 'connection', { configurable: true, get: () => ({ saveData: m === 'savedata', effectiveType: m === '2g' ? 'slow-2g' : '4g' }) }); }, mode);
  const page = await ctx.newPage();
  const mp4 = []; page.on('request', (q) => { if (q.url().endsWith('.mp4')) mp4.push(q.url()); });
  await page.goto(base + '/digital-sun/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const r = await page.evaluate(chrome);
  const posterOk = await page.evaluate(() => { const i = document.querySelector('.video-poster img'); return i.complete && i.naturalWidth > 0 ? i.currentSrc.split('/').pop() : null; });
  check(`${mode}: zero mp4 requests, poster shown`, mp4.length === 0 && !r.playing && !!posterOk, JSON.stringify({ mp4: mp4.length, poster: posterOk }));
  if (mode === 'reduce') await page.screenshot({ path: '/tmp/m7/reduced_poster.png' });
  await ctx.close();
}

await browser.close();
console.log('errors:', JSON.stringify(errors));
process.exit(results.every(Boolean) ? 0 : 1);
