// M5 htmx navigation: boosted XHR swaps, canvas/GL survival, title, oceanMode,
// menu, focus, swap animation (+ reduced motion), scroll memory, fallbacks,
// history cache miss, theme across a full-load boundary, console errors.
// Usage: node m5check.mjs [base]   (default http://127.0.0.1:1111)
import { chromium } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:1111';
const SHOTS = '/tmp/pw';
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const results = []; let failed = false;
const check = (name, ok, info) => { results.push({ name, ok: !!ok }); if (!ok) failed = true; console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + JSON.stringify(info)); };
const unexpectedErrors = [];
const expectedErrors = [];
const runTag = base.endsWith(':1111') ? 'serve' : 'built';

const browser = await chromium.launch({ args: GL });

async function open({ W = 1440, H = 900, theme = 'day', reducedMotion = 'no-preference', path = '/', expectErrors = false, ctxOpts = {}, gl = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'light', reducedMotion, ...ctxOpts });
  if (theme) await ctx.addInitScript((t) => { try { if (!sessionStorage.getItem('m5-theme-set')) { localStorage.setItem('theme', t); sessionStorage.setItem('m5-theme-set', '1'); } } catch (e) {} }, theme);
  const p = await ctx.newPage();
  p.reqs = [];
  p.on('request', (r) => { const u = new URL(r.url()); if (u.origin === new URL(base).origin) p.reqs.push({ path: u.pathname, type: r.resourceType(), nav: r.isNavigationRequest() }); });
  const sink = expectErrors ? expectedErrors : unexpectedErrors;
  p.on('pageerror', (e) => sink.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') sink.push('console: ' + m.text()); });
  await p.goto(base + path, { waitUntil: 'load' });
  if (gl) await ready(p);
  await mark(p);
  return { ctx, p };
}
const ready = (p) => p.waitForFunction(() => document.documentElement.classList.contains('shader-ready') && window.htmx, null, { timeout: 90000, polling: 100 });
// Marks the document + canvas so a later check can prove neither was replaced.
const mark = (p) => p.evaluate(() => {
  window.__m5doc = Math.random();
  window.__canvasRef = document.getElementById('ocean');
  window.__lost = 0;
  window.__canvasRef.addEventListener('webglcontextlost', () => { window.__lost++; });
  return window.__m5doc;
});
const docMark = (p) => p.evaluate(() => window.__m5doc);
const idle = (path) => location.pathname === path && !document.querySelector('.htmx-swapping, .htmx-settling, .htmx-added, .htmx-request');
const waitIdle = (p, path) => p.waitForFunction(idle, path, { timeout: 15000, polling: 20 });
const state = (p) => p.evaluate(() => {
  const o = window.__ocean || {};
  return {
    path: location.pathname, title: document.title,
    sameCanvas: document.getElementById('ocean') === window.__canvasRef, lost: window.__lost,
    glLost: (() => { const gl = document.getElementById('ocean').getContext('webgl'); return gl ? gl.isContextLost() : null; })(),
    mode: [o.fps, o.res, o.speed], surface: !!document.querySelector('.content-surface'),
    active: document.activeElement && (document.activeElement.id || document.activeElement.tagName),
    menuOpen: !!(document.querySelector('.menu') && document.querySelector('.menu').open),
    scrollY: Math.round(scrollY), night: document.documentElement.classList.contains('theme-night'),
    pages: document.querySelectorAll('div.page').length,
  };
});
const expectedTitle = (p, path) => p.evaluate(async (path) => { const t = await (await fetch(path)).text(); return new DOMParser().parseFromString(t, 'text/html').title; }, path);
const CONTENT = [15, 0.5, 0.15], HOME = [0, 1, 1];
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Clicks a boosted link and verifies the swap: XHR only, same document + canvas, title, mode.
async function boost(p, selector, path, label, { focus = true } = {}) {
  const want = await expectedTitle(p, path);
  const doc = await docMark(p);
  p.reqs.length = 0;
  await p.click(selector);
  await waitIdle(p, path);
  // M6: oceanMode tweens speed over ~600 ms after a swap; wait for it to land.
  await p.waitForFunction(() => !window.__ocean || window.__ocean.speed === (document.querySelector('.content-surface') ? 0.15 : 1), null, { timeout: 3000, polling: 20 }).catch(() => {});
  const s = await state(p);
  const reqs = p.reqs.filter((r) => r.path === path);
  const docs = p.reqs.filter((r) => r.type === 'document');
  const ok = reqs.length >= 1 && reqs.every((r) => r.type === 'xhr') && docs.length === 0 && (await docMark(p)) === doc &&
    s.sameCanvas && s.lost === 0 && s.glLost === false && s.title === want && eq(s.mode, s.surface ? CONTENT : HOME) && s.pages === 1 && (!focus || s.active === 'main');
  check(`boost ${label} → ${path}: XHR, same canvas, no GL loss, title, oceanMode${focus ? ', focus #main' : ''}`, ok, { reqs, docs, ...s, want });
  return s;
}
async function historyGo(p, dir, path, label) {
  const doc = await docMark(p);
  p.reqs.length = 0;
  await p.evaluate((d) => (d < 0 ? history.back() : history.forward()), dir);
  await waitIdle(p, path);
  await p.waitForTimeout(100);
  // M6: oceanMode tweens speed over ~600 ms after a swap; wait for it to land.
  await p.waitForFunction(() => !window.__ocean || window.__ocean.speed === (document.querySelector('.content-surface') ? 0.15 : 1), null, { timeout: 3000, polling: 20 }).catch(() => {});
  const s = await state(p);
  const want = await expectedTitle(p, path);
  const docs = p.reqs.filter((r) => r.type === 'document');
  const ok = (await docMark(p)) === doc && docs.length === 0 && s.sameCanvas && s.lost === 0 && s.glLost === false && s.title === want && eq(s.mode, s.surface ? CONTENT : HOME) && s.pages === 1 && !s.menuOpen;
  check(`${label} → ${path}: history restore, no document load, same canvas, title, oceanMode`, ok, { docs, ...s, want });
  return s;
}

const version = await (async () => { const { ctx, p } = await open({ gl: false }); const v = await p.evaluate(() => window.htmx && window.htmx.version); await ctx.close(); return v; })();
check('htmx loaded', version === '2.0.11', version);

// 1. Desktop: nav/logo/post links boosted; back/forward restores; first load has no animation.
{
  const { ctx, p } = await open({ theme: null });
  const first = await p.evaluate(() => ({ anims: document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#main')).length, opacity: getComputedStyle(document.querySelector('#main > *')).opacity }));
  check('first load: no #main animation, content opacity 1', first.anims === 0 && first.opacity === '1', first);
  const s0 = await state(p);
  check('home: oceanMode 0/1/1', eq(s0.mode, HOME), s0);
  await boost(p, '.nav-inline a[href="/posts/"]', '/posts/', 'nav');
  await boost(p, '.post-list a', '/posts/ballistic-wizard/', 'post link (in swapped content)');
  await boost(p, '.nav-inline a[href="/about/"]', '/about/', 'nav');
  await boost(p, '.logo', '/', 'logo');
  await historyGo(p, -1, '/about/', 'back');
  await historyGo(p, -1, '/posts/ballistic-wizard/', 'back');
  await historyGo(p, -1, '/posts/', 'back');
  await historyGo(p, 1, '/posts/ballistic-wizard/', 'forward');
  await historyGo(p, 1, '/about/', 'forward');
  await historyGo(p, 1, '/', 'forward');
  // Theme toggle (footer, outside the swap) still works after swaps.
  await p.click('.theme-toggle');
  const t = await p.evaluate(() => ({ night: document.documentElement.classList.contains('theme-night'), label: document.querySelector('.theme-toggle').textContent }));
  check('theme toggle works after swaps', t.night && t.label === 'Night', t);
  await ctx.close();
}

// 2. Mobile 390: menu link boosted, menu closes, focus on #main.
{
  const { ctx, p } = await open({ W: 390, H: 844 });
  await p.click('.menu summary');
  await p.waitForFunction(() => document.querySelector('.menu').open, null, { polling: 20 });
  await boost(p, '.menu-panel a[href="/photos/"]', '/photos/', 'menu link 390');
  const s = await state(p);
  check('390: menu closed after menu link swap', !s.menuOpen, s);
  await p.click('.menu summary');
  await p.waitForFunction(() => document.querySelector('.menu').open, null, { polling: 20 });
  await historyGo(p, -1, '/', 'back with menu open (menu closes)');
  await ctx.close();
}

// 3. Swap animation, natural timing (recorder samples old/new content each frame).
async function recordSwap(p, selector, path) {
  await p.evaluate(() => {
    window.__frames = [];
    const ids = new WeakMap(); let n = 0;
    const t0 = performance.now();
    const step = () => {
      const page = document.querySelector('div.page'); const el = document.querySelector('#main > *');
      if (el && !ids.has(el)) ids.set(el, ++n);
      const cs = el && getComputedStyle(el);
      window.__frames.push({ t: Math.round(performance.now() - t0), swapping: page.classList.contains('htmx-swapping'), added: page.classList.contains('htmx-added'), el: el && ids.get(el), opacity: cs && +cs.opacity, transform: cs && cs.transform, pageOpacity: getComputedStyle(page).opacity, pageTransform: getComputedStyle(page).transform, backdrop: (document.querySelector('.content-surface') && getComputedStyle(document.querySelector('.content-surface')).backdropFilter) || null });
      if (performance.now() - t0 < 1200) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  await p.click(selector);
  await waitIdle(p, path);
  await p.waitForTimeout(1300);
  return p.evaluate(() => window.__frames);
}
function analyse(frames) {
  const oldF = frames.filter((f) => f.el === 1), newF = frames.filter((f) => f.el === 2);
  const swapF = frames.filter((f) => f.swapping);
  return {
    frames: frames.length,
    swappingMs: swapF.length ? swapF[swapF.length - 1].t - swapF[0].t : 0,
    oldMin: Math.min(...oldF.map((f) => f.opacity)),
    newMin: newF.length ? Math.min(...newF.map((f) => f.opacity)) : null,
    newEnd: newF.length ? newF[newF.length - 1].opacity : null,
    newRise: newF.some((f) => f.opacity > 0 && f.opacity < 1),
    transforms: [...new Set(frames.map((f) => f.transform))],
    pageOpacity: [...new Set(frames.map((f) => f.pageOpacity))], pageTransform: [...new Set(frames.map((f) => f.pageTransform))],
    backdrop: [...new Set(frames.map((f) => f.backdrop))],
  };
}
{
  const { ctx, p } = await open({ path: '/about/' });
  const a = analyse(await recordSwap(p, '.nav-inline a[href="/posts/"]', '/posts/'));
  check('animation: .htmx-swapping ~220ms, old fades out, new fades 0→1, .page never transformed/faded, backdrop kept',
    a.swappingMs >= 150 && a.swappingMs <= 300 && a.oldMin < 0.3 && a.newMin !== null && a.newMin < 0.3 && a.newRise && a.newEnd === 1 &&
    eq(a.pageOpacity, ['1']) && eq(a.pageTransform, ['none']) && a.backdrop.every((b) => b === null || /blur\(8px\)/.test(b)) && a.transforms.some((t) => t !== 'none'), a);
  // Fade-in reliability without an observer forcing style each frame.
  const runs = [];
  for (const [sel, path] of [['.nav-inline a[href="/photos/"]', '/photos/'], ['.nav-inline a[href="/about/"]', '/about/'], ['.nav-inline a[href="/posts/"]', '/posts/'], ['.logo', '/'], ['.nav-inline a[href="/about/"]', '/about/'], ['.nav-inline a[href="/photos/"]', '/photos/'], ['.nav-inline a[href="/posts/"]', '/posts/'], ['.post-list a', '/posts/ballistic-wizard/'], ['.logo', '/'], ['.nav-inline a[href="/about/"]', '/about/'], ['.nav-inline a[href="/posts/"]', '/posts/'], ['.nav-inline a[href="/photos/"]', '/photos/']]) {
    await p.evaluate(() => {
      window.__fadeIn = null;
      document.addEventListener('htmx:afterSettle', () => {
        const el = document.querySelector('#main > *');
        const tr = el.getAnimations().filter((x) => x.transitionProperty === 'opacity');
        window.__fadeIn = tr.length > 0;
      }, { once: true });
    });
    await p.click(sel); await waitIdle(p, path); await p.waitForTimeout(300);
    runs.push(await p.evaluate(() => window.__fadeIn));
  }
  check('animation: fade-in transition starts at settle on every swap (no observer)', runs.every(Boolean), runs);
  await ctx.close();
}

// 4. Mid-transition screenshots: hold htmx's 220ms swap timer, freeze transitions at 110ms.
async function holdSwap(p) {
  await p.evaluate(() => {
    const orig = window.setTimeout; window.__held = [];
    window.setTimeout = function (fn, ms, ...rest) { if (ms === 220) { window.__held.push(fn); return 0; } return orig.call(window, fn, ms, ...rest); };
    window.__release = () => { window.setTimeout = orig; window.__held.splice(0).forEach((f) => f()); };
  });
}
const freezeAt = (p, ms) => p.evaluate((ms) => {
  const anims = document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#main'));
  anims.forEach((a) => { a.pause(); a.currentTime = ms; });
  const el = document.querySelector('#main > *'); const cs = getComputedStyle(el);
  const s = document.querySelector('.content-surface');
  return { n: anims.length, opacity: +cs.opacity, transform: cs.transform, backdrop: s && getComputedStyle(s).backdropFilter, pageOpacity: getComputedStyle(document.querySelector('div.page')).opacity, pageTransform: getComputedStyle(document.querySelector('div.page')).transform };
}, ms);
const unfreeze = (p) => p.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
for (const reducedMotion of ['no-preference', 'reduce']) {
  for (const theme of ['day', 'night']) {
    if (reducedMotion === 'reduce' && theme === 'night') continue;
    const { ctx, p } = await open({ path: '/about/', reducedMotion, theme });
    await holdSwap(p);
    await p.click('.nav-inline a[href="/posts/"]');
    await p.waitForFunction(() => document.querySelector('div.page.htmx-swapping'), null, { polling: 20 });
    await p.waitForTimeout(30);
    const out = await freezeAt(p, 110);
    const rm = reducedMotion === 'reduce' ? '_reduced' : '';
    const shotOut = `${SHOTS}/m5_mid_out_${theme}${rm}.png`;
    await p.screenshot({ path: shotOut });
    await unfreeze(p);
    await p.evaluate(() => window.__release());
    await p.waitForFunction(() => { const el = document.querySelector('#main > *'); return location.pathname === '/posts/' && !document.querySelector('.htmx-added') && el.getAnimations().length > 0; }, null, { polling: 5, timeout: 5000 });
    const inn = await freezeAt(p, 110);
    const shotIn = `${SHOTS}/m5_mid_in_${theme}${rm}.png`;
    await p.screenshot({ path: shotIn });
    await unfreeze(p);
    const done = await p.evaluate(() => { const cs = getComputedStyle(document.querySelector('#main > *')); return { opacity: cs.opacity, transform: cs.transform }; });
    const base = Math.abs(out.opacity - 0.5) < 0.2 && Math.abs(inn.opacity - 0.5) < 0.2 && /blur\(8px\)/.test(out.backdrop) && /blur\(8px\)/.test(inn.backdrop) &&
      out.pageOpacity === '1' && out.pageTransform === 'none' && inn.pageOpacity === '1' && inn.pageTransform === 'none' && done.opacity === '1' && done.transform === 'none';
    if (reducedMotion === 'reduce') check(`reduced motion ${theme}: transform none during swap, opacity fade kept`, base && out.transform === 'none' && inn.transform === 'none', { out, inn, done, shots: [shotOut, shotIn] });
    else check(`mid-transition ${theme}: fade + translate at 110ms, backdrop blur kept, .page untouched`, base && out.transform !== 'none' && inn.transform !== 'none', { out, inn, done, shots: [shotOut, shotIn] });
    await ctx.close();
  }
}

// 5. Scroll: forward → top; back → restored; forward → correct page.
{
  const { ctx, p } = await open({ W: 1440, H: 600, path: '/photos/' });
  const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const y = Math.min(700, max - 10);
  await p.evaluate((y) => window.scrollTo(0, y), y);
  await p.waitForTimeout(200);
  const before = await p.evaluate(() => Math.round(scrollY));
  const s1 = await boost(p, '.nav-inline a[href="/about/"]', '/about/', 'from scrolled /photos/');
  await p.waitForTimeout(300);
  const y1 = await p.evaluate(() => Math.round(scrollY));
  check('scroll: forward boosted nav lands at top', before > 300 && s1.scrollY === 0 && y1 === 0, { max, before, afterSettle: s1.scrollY, after300: y1 });
  await historyGo(p, -1, '/photos/', 'back (scroll)');
  await p.waitForFunction((b) => Math.abs(scrollY - b) <= 2, before, { timeout: 3000, polling: 20 }).catch(() => {});
  const r1 = await p.evaluate(() => Math.round(scrollY));
  await p.waitForTimeout(600);
  const r2 = await p.evaluate(() => Math.round(scrollY));
  const sc = await p.evaluate(() => ({ same: document.getElementById('ocean') === window.__canvasRef, restoration: history.scrollRestoration }));
  check('scroll: back restores scrollY (±2px), stays put, canvas unchanged', Math.abs(r1 - before) <= 2 && Math.abs(r2 - before) <= 2 && sc.same, { before, r1, r2, ...sc });
  await p.screenshot({ path: `${SHOTS}/m5_back_scroll_photos.png` });
  const f = await historyGo(p, 1, '/about/', 'forward (scroll)');
  check('scroll: forward after back shows /about/', f.path === '/about/', f);
  await ctx.close();
}

// 6. Fallbacks.
async function injectLink(p, href, id) {
  await p.evaluate(([href, id]) => { const a = document.createElement('a'); a.id = id; a.href = href; a.textContent = id; document.querySelector('#main > *').prepend(a); htmx.process(a); }, [href, id]);
}
{
  // 404: XHR gets 404 → full navigation shows the real 404 page.
  const { ctx, p } = await open({ path: '/about/', expectErrors: true });
  await injectLink(p, '/no-such-page/', 'm5-missing');
  p.reqs.length = 0;
  const resP = p.waitForResponse((r) => r.url().endsWith('/no-such-page/') && r.request().resourceType() === 'document', { timeout: 15000 });
  await p.click('#m5-missing');
  const res = await resP;
  await p.waitForURL(/\/no-such-page\/$/, { waitUntil: 'load', timeout: 15000 });
  await p.waitForFunction(() => document.readyState === 'complete' && window.__m5doc === undefined, null, { polling: 50 });
  const body = await p.evaluate(() => ({ path: location.pathname, text: document.body.innerText.slice(0, 60), marked: window.__m5doc !== undefined }));
  const types = p.reqs.filter((r) => r.path === '/no-such-page/').map((r) => r.type);
  check('404: XHR then full document load showing the 404', eq(types, ['xhr', 'document']) && res.status() === 404 && body.path === '/no-such-page/' && /404|not found/i.test(body.text) && !body.marked, { types, status: res.status(), ...body });
  await ctx.close();
}
{
  // sendError: route-abort the XHR → full navigation to the same URL.
  const { ctx, p } = await open({ path: '/', expectErrors: true });
  await ctx.route('**/about/', (route) => (route.request().resourceType() === 'xhr' ? route.abort() : route.continue()));
  p.reqs.length = 0;
  await p.click('.nav-inline a[href="/about/"]');
  await p.waitForFunction(() => location.pathname === '/about/' && window.__m5doc === undefined && document.readyState === 'complete', null, { timeout: 15000, polling: 50 });
  await ready(p);
  const types = p.reqs.filter((r) => r.path === '/about/').map((r) => r.type);
  const s = await p.evaluate(() => ({ surface: !!document.querySelector('.content-surface'), mode: [__ocean.fps, __ocean.res, __ocean.speed] }));
  check('sendError (route.abort): full navigation to /about/', eq(types, ['xhr', 'document']) && s.surface && eq(s.mode, CONTENT), { types, ...s });
  await ctx.close();
}
{
  // .apk is a download, not an XHR; RSS opens as a document.
  const { ctx, p } = await open({ path: '/posts/ballistic-wizard/', ctxOpts: { acceptDownloads: true } });
  p.reqs.length = 0;
  const dlP = p.waitForEvent('download', { timeout: 15000 });
  await p.click('a[href$=".apk"]');
  const dl = await dlP;
  const url = dl.url();
  await dl.cancel();
  await p.waitForTimeout(200);
  const apk = p.reqs.filter((r) => r.path.endsWith('.apk'));
  check('.apk: browser download, never XHR', apk.length >= 1 && apk.every((r) => r.type !== 'xhr') && url.endsWith('.apk'), { apk, url });
  p.reqs.length = 0;
  await p.click('footer a[href="/feed.xml"]');
  await p.waitForURL(/\/feed\.xml$/, { timeout: 15000 });
  const rss = p.reqs.filter((r) => r.path === '/feed.xml');
  check('RSS: document load, never XHR', rss.length >= 1 && rss.every((r) => r.type === 'document'), rss);
  await ctx.close();
}
{
  // /posts/wizard: direct load resolves; a boosted link to it falls back to a full load (alias page has no div.page).
  const { ctx, p } = await open({ path: '/', gl: false });
  await p.goto(base + '/posts/wizard');
  await p.waitForURL(/\/posts\/ballistic-wizard\/$/, { timeout: 15000 });
  check('/posts/wizard direct load → /posts/ballistic-wizard/', true, p.url());
  await p.goto(base + '/about/'); await ready(p); await mark(p);
  await injectLink(p, '/posts/wizard', 'm5-wizard');
  p.reqs.length = 0;
  await p.click('#m5-wizard');
  await p.waitForURL(/\/posts\/ballistic-wizard\/$/, { waitUntil: 'load', timeout: 15000 });
  await p.waitForFunction(() => document.readyState === 'complete' && window.__m5doc === undefined, null, { polling: 50 });
  const s = await p.evaluate(() => ({ h1: document.querySelector('h1') && document.querySelector('h1').textContent, pages: document.querySelectorAll('div.page').length }));
  const types = p.reqs.filter((r) => r.path.startsWith('/posts/wizard')).map((r) => r.type);
  check('boosted /posts/wizard: alias XHR rejected → full load → post', types[0] === 'xhr' && types.includes('document') && s.pages === 1 && !!s.h1, { types, ...s });
  await ctx.close();
}
{
  // History cache miss: htmx 2.0.11 keeps snapshots in sessionStorage (cleared here,
  // plus localStorage) → refreshOnHistoryMiss reloads the page.
  const { ctx, p } = await open({ path: '/' });
  await boost(p, '.nav-inline a[href="/posts/"]', '/posts/', 'pre cache-miss');
  await boost(p, '.nav-inline a[href="/about/"]', '/about/', 'pre cache-miss');
  const cached = await p.evaluate(() => (JSON.parse(sessionStorage.getItem('htmx-history-cache')) || []).map((i) => i.url));
  await p.evaluate(() => { sessionStorage.removeItem('htmx-history-cache'); localStorage.clear(); });
  p.reqs.length = 0;
  await p.evaluate(() => history.back());
  await p.waitForFunction(() => location.pathname === '/posts/' && window.__m5doc === undefined && document.readyState === 'complete', null, { timeout: 15000, polling: 50 });
  await ready(p);
  const s = await p.evaluate(() => ({ title: document.title, list: !!document.querySelector('.post-list'), mode: [__ocean.fps, __ocean.res, __ocean.speed], pages: document.querySelectorAll('div.page').length }));
  const types = p.reqs.filter((r) => r.path === '/posts/').map((r) => r.type);
  check('history cache miss: back reloads /posts/ as a document', cached.includes('/posts') && types.includes('document') && s.list && s.pages === 1 && eq(s.mode, CONTENT), { cached, types, ...s });
  await ctx.close();
}
{
  // Theme across a full-load boundary: boost to /posts/, full-load /about/, toggle to night, back.
  const { ctx, p } = await open({ path: '/', theme: null });
  await boost(p, '.nav-inline a[href="/posts/"]', '/posts/', 'pre full-load');
  await p.goto(base + '/about/', { waitUntil: 'load' }); await ready(p);
  await p.click('.theme-toggle'); // auto → night
  await p.waitForTimeout(100);
  const stored = await p.evaluate(() => localStorage.getItem('theme'));
  await p.evaluate(() => history.back());
  await p.waitForFunction(() => location.pathname === '/posts/' && document.readyState === 'complete', null, { timeout: 15000, polling: 50 });
  await ready(p);
  await p.waitForFunction(() => window.__ocean && window.__ocean.night === 1, null, { timeout: 5000, polling: 50 }).catch(() => {});
  const s = await p.evaluate(() => ({ night: document.documentElement.classList.contains('theme-night'), label: document.querySelector('.theme-toggle').textContent, u: window.__ocean.night, list: !!document.querySelector('.post-list'), mode: [__ocean.fps, __ocean.res, __ocean.speed] }));
  check('theme correct after back across a full load', stored === 'night' && s.night && s.label === 'Night' && s.u === 1 && s.list && eq(s.mode, CONTENT), { stored, ...s });
  // And back to day the other way.
  await p.evaluate(() => history.forward());
  await p.waitForFunction(() => location.pathname === '/about/' && document.readyState === 'complete', null, { timeout: 15000, polling: 50 });
  await ready(p);
  await p.click('.theme-toggle'); // night → day
  await p.waitForTimeout(100);
  await p.evaluate(() => history.back());
  await p.waitForFunction(() => location.pathname === '/posts/' && document.readyState === 'complete', null, { timeout: 15000, polling: 50 });
  await p.waitForFunction(() => window.__ocean && window.__ocean.night === 0, null, { timeout: 5000, polling: 50 }).catch(() => {});
  const d = await p.evaluate(() => ({ night: document.documentElement.classList.contains('theme-night'), label: document.querySelector('.theme-toggle').textContent, u: window.__ocean.night }));
  check('theme day after back across a full load', !d.night && d.label === 'Day' && d.u === 0, d);
  await ctx.close();
}

// 7. JS disabled: plain links still work.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'load' });
  const [res] = await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.click('.nav-inline a[href="/posts/"]')]);
  check('JS disabled: nav link is a normal document navigation', res && res.status() === 200 && new URL(p.url()).pathname === '/posts/' && (await p.$('.post-list')) !== null, { url: p.url(), status: res && res.status() });
  await ctx.close();
}

// 8. Races: rapid double nav, back during a pending navigation, skip link after a swap.
// URL, title and #main content must agree (content compared against a fetch of the URL).
const agree = (p) => p.evaluate(async () => {
  const path = location.pathname;
  const doc = new DOMParser().parseFromString(await (await fetch(path)).text(), 'text/html');
  const norm = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
  return { path, title: document.title, wantTitle: doc.title, content: norm(document.querySelector('#main')) === norm(doc.querySelector('#main')), pages: document.querySelectorAll('div.page').length };
});
const agrees = (a, path) => a.path === path && a.title === a.wantTitle && a.content && a.pages === 1;
// Polls across possible document loads (waitForFunction dies with the context).
async function settleAt(p, path, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (await p.evaluate((path) => document.readyState === 'complete' && location.pathname === path && !document.querySelector('.htmx-swapping, .htmx-settling, .htmx-added, .htmx-request'), path)) return true; } catch (e) { /* navigating */ }
    await p.waitForTimeout(50);
  }
  return false;
}
const delayXhr = (ctx, ms) => ctx.route((u) => ['/posts/', '/photos/'].includes(u.pathname), async (route) => {
  if (route.request().resourceType() === 'xhr') await new Promise((r) => setTimeout(r, ms));
  await route.continue();
});
async function historyAgree(p, dir, path, label) {
  await p.evaluate((d) => (d < 0 ? history.back() : history.forward()), dir);
  const settled = await settleAt(p, path);
  await p.waitForTimeout(300);
  const a = await agree(p);
  check(`${label} → ${path}: URL, title, content agree`, settled && agrees(a, path), { settled, ...a });
}
for (const [gap, xhrDelay, label] of [[100, 0, 'rapid nav ~100ms apart (in swap window)'], [300, 0, 'rapid nav ~300ms apart'], [100, 300, 'rapid nav ~100ms apart (XHR in flight, 300ms latency)']]) {
  const { ctx, p } = await open({ path: '/about/' });
  if (xhrDelay) await delayXhr(ctx, xhrDelay);
  const doc = await docMark(p);
  p.reqs.length = 0;
  await p.click('.nav-inline a[href="/posts/"]');
  await p.waitForTimeout(gap);
  await p.click('.nav-inline a[href="/photos/"]');
  const settled = await settleAt(p, '/photos/');
  await p.waitForTimeout(500);
  const a = await agree(p);
  const docs = p.reqs.filter((r) => r.type === 'document');
  const s = await state(p);
  check(`${label}: ends on /photos/, URL/title/content agree, no document load, same canvas`, settled && agrees(a, '/photos/') && docs.length === 0 && (await docMark(p)) === doc && s.sameCanvas && eq(s.mode, CONTENT) && s.active === 'main', { settled, ...a, docs, mode: s.mode, active: s.active });
  await historyAgree(p, -1, '/posts/', `${label}: back`);
  await historyAgree(p, -1, '/about/', `${label}: back`);
  await historyAgree(p, 1, '/posts/', `${label}: forward`);
  await historyAgree(p, 1, '/photos/', `${label}: forward`);
  await ctx.close();
}
for (const [xhrDelay, label] of [[0, 'back during the 220ms swap window'], [400, 'back while the XHR is in flight']]) {
  const { ctx, p } = await open({ path: '/' });
  await boost(p, '.nav-inline a[href="/about/"]', '/about/', `pre ${label}`);
  if (xhrDelay) await delayXhr(ctx, xhrDelay);
  const doc = await docMark(p);
  await p.click('.nav-inline a[href="/posts/"]');
  if (xhrDelay) await p.waitForTimeout(100);
  else await p.waitForFunction(() => document.querySelector('div.page.htmx-swapping'), null, { polling: 5, timeout: 5000 });
  const inSwap = await p.evaluate(() => !!document.querySelector('div.page.htmx-swapping'));
  await p.evaluate(() => history.back());
  const settled = await settleAt(p, '/');
  await p.waitForTimeout(800); // past the stale swap timer
  const stillSettled = await settleAt(p, '/');
  const a = await agree(p);
  const sameDoc = await p.evaluate(() => window.__m5doc).then((m) => m === doc).catch(() => false);
  check(`${label}: lands on /, URL/title/content agree, no stale swap/push`, (xhrDelay ? !inSwap : inSwap) && settled && stillSettled && agrees(a, '/') && (!xhrDelay || sameDoc), { inSwap, settled, stillSettled, sameDoc, ...a });
  await historyAgree(p, 1, '/about/', `${label}: forward (entry kept)`);
  await historyAgree(p, -1, '/', `${label}: back`);
  await ctx.close();
}
{
  const { ctx, p } = await open({ path: '/' });
  await boost(p, '.nav-inline a[href="/posts/"]', '/posts/', 'pre skip link');
  p.reqs.length = 0;
  await p.focus('.skip-link');
  const before = await p.evaluate(() => document.activeElement.className);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(300);
  const s = await p.evaluate(() => ({ active: document.activeElement.id, path: location.pathname, hash: location.hash }));
  const loads = p.reqs.filter((r) => r.type === 'xhr' || r.type === 'document');
  check('skip link after a swap: focus #main, no XHR/document request', before === 'skip-link' && s.active === 'main' && s.path === '/posts/' && s.hash === '#main' && loads.length === 0, { before, ...s, loads });
  await boost(p, '.nav-inline a[href="/about/"]', '/about/', 'after skip link');
  await ctx.close();
}

await browser.close();

const REPO = '/Users/simonas/Projects/simonas-dev';
const js = fs.readdirSync(`${REPO}/static`).filter((f) => f.endsWith('.js')).map((f) => [f, fs.statSync(`${REPO}/static/${f}`).size]);
const total = js.reduce((s, [, n]) => s + n, 0);
check('budgets: ocean.js ≤ 11264 B (M6), total static JS < 150 KB', js.find(([f]) => f === 'ocean.js')[1] <= 11264 && total < 150 * 1024, { js, total });
console.log('expected errors (404/abort scenarios):', JSON.stringify(expectedErrors));
check('no unexpected console errors / pageerrors', unexpectedErrors.length === 0, unexpectedErrors);
console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS', `${results.filter((r) => r.ok).length}/${results.length}`, runTag);
process.exit(failed ? 1 : 0);
