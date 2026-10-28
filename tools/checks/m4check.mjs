// M4 content pages: surface, prose, posts/feed/alias, photos, content-mode throttle,
// tier caching, static tier, NOGL, grain/contrast, day+night screenshots (incl. scrolled).
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import fs from 'fs';
const base = 'http://127.0.0.1:1111';
const REPO = '/Users/simonas/Projects/simonas-dev';
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const NOGL = ['--disable-webgl', '--disable-3d-apis', '--disable-gpu'];
const PATHS = ['/about/', '/posts/', '/posts/ballistic-wizard/', '/photos/'];
const results = []; let failed = false;
const check = (name, ok, info) => { results.push({ name, ok: !!ok }); if (!ok) failed = true; console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + JSON.stringify(info)); };
const allErrors = [];
const tag = (p) => p.replace(/\//g, '_');

// Counts drawArrays calls and records the backing width per draw.
const drawCounter = () => {
  window.__draws = 0; window.__drawWidths = [];
  const orig = WebGLRenderingContext.prototype.drawArrays;
  WebGLRenderingContext.prototype.drawArrays = function () {
    window.__draws++;
    if (window.__drawWidths.length < 400) window.__drawWidths.push(this.canvas.width);
    return orig.apply(this, arguments);
  };
};
const setTheme = (t) => { try { localStorage.setItem('theme', t); } catch (e) {} };

async function newCtx(browser, { W = 1440, H = 900, theme = 'day', slow } = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'light' });
  await ctx.addInitScript(setTheme, theme);
  await ctx.addInitScript(drawCounter);
  if (slow) await ctx.addInitScript((ms) => { window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), ms); }, slow);
  return ctx;
}
async function goto(ctx, path, { gl = true } = {}) {
  const p = ctx.pages()[0] || await ctx.newPage();
  if (!p.__hooked) {
    p.__hooked = true;
    p.on('pageerror', (e) => allErrors.push('pageerror: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') allErrors.push('console: ' + m.text()); });
  }
  await p.goto(base + path, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  if (gl) {
    await p.waitForFunction(() => document.documentElement.classList.contains('shader-ready'), null, { timeout: 90000 });
    await p.waitForFunction(() => getComputedStyle(document.getElementById('ocean')).opacity === '1', null, { timeout: 30000, polling: 100 });
  }
  return p;
}
const settled = (p) => p.waitForFunction(() => !!sessionStorage.getItem('ocean-tier'), null, { timeout: 90000, polling: 100 });
async function drawRate(p, ms = 3000) {
  return p.evaluate(async (ms) => {
    const c0 = window.__draws, t0 = performance.now();
    await new Promise((r) => setTimeout(r, ms));
    return +((window.__draws - c0) / ((performance.now() - t0) / 1000)).toFixed(2);
  }, ms);
}
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lumRGB = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const cr = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const nums = (s) => (s.match(/[\d.]+/g) || []).map(Number);

// Pixel stats of a clip (text hidden): luminance std-dev and worst ink contrast.
async function panelPixels(p, clip, ink) {
  await p.addStyleTag({ content: '.content-surface, .content-surface * { color: transparent !important; text-decoration-color: transparent !important; border-color: transparent !important; } .content-surface img { visibility: hidden !important; }' });
  await p.waitForTimeout(50);
  const png = PNG.sync.read(await p.screenshot({ clip }));
  const [ir, ig, ib] = nums(ink); const inkL = lumRGB(ir, ig, ib);
  let s = 0, s2 = 0, n = 0, worst = Infinity, sumL = 0;
  for (let k = 0; k < png.data.length; k += 4) {
    const y = 0.299 * png.data[k] + 0.587 * png.data[k + 1] + 0.114 * png.data[k + 2];
    s += y; s2 += y * y; n++;
    const L = lumRGB(png.data[k], png.data[k + 1], png.data[k + 2]); sumL += L;
    worst = Math.min(worst, cr(inkL, L));
  }
  const m = s / n;
  return { std: +Math.sqrt(s2 / n - m * m).toFixed(2), meanY: +m.toFixed(1), crMean: +cr(inkL, sumL / n).toFixed(2), crWorst: +worst.toFixed(2) };
}

const gl = await chromium.launch({ args: GL });

// 1. Surface + prose + overflow, day and night, 1440 and 390; screenshots (top + scrolled).
for (const theme of ['day', 'night']) {
  for (const [W, H] of [[1440, 900], [390, 844]]) {
    const ctx = await newCtx(gl, { W, H, theme });
    // Home: no surface.
    {
      const p = await goto(ctx, '/');
      const home = await p.evaluate(() => ({ surface: !!document.querySelector('.content-surface'), speed: __ocean.speed, res: __ocean.res, fps: __ocean.fps }));
      check(`home ${theme} ${W}: no surface, full mode`, !home.surface && home.speed === 1 && home.res === 1 && home.fps === 0, home);
    }
    for (const path of PATHS) {
      const p = await goto(ctx, path);
      // Lazy images: scroll through so everything is loaded, then back to top.
      await p.evaluate(async () => { for (const img of document.images) { img.loading = 'eager'; } });
      await p.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30000, polling: 100 });
      const info = await p.evaluate(() => {
        const s = document.querySelector('.content-surface');
        if (!s) return { surface: false };
        const cs = getComputedStyle(s);
        const probe = document.createElement('div'); probe.style.width = '68ch'; s.appendChild(probe);
        const ch68 = probe.getBoundingClientRect().width; probe.remove();
        const contentW = s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const para = s.querySelector('p:not(.meta)') || s.querySelector('.post-list a') || s;
        const pcs = getComputedStyle(para);
        const code = document.createElement('code'); code.textContent = 'x'; s.appendChild(code);
        const codeFont = getComputedStyle(code).fontFamily; code.remove();
        const t = s.querySelector('time'), meta = s.querySelector('.meta');
        const sr = s.getBoundingClientRect();
        const overflowers = [...s.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > sr.right + 0.5 || r.left < sr.left - 0.5); }).map((e) => e.tagName);
        return {
          surface: true, wide: s.classList.contains('wide'), bg: cs.backgroundColor, bgImage: cs.backgroundImage.slice(0, 80),
          backdrop: cs.backdropFilter || cs.webkitBackdropFilter, contentW: +contentW.toFixed(1), ch68: +ch68.toFixed(1),
          paraFont: pcs.fontFamily, fontSize: pcs.fontSize, lineHeight: pcs.lineHeight, codeFont,
          timeFont: t && getComputedStyle(t).fontFamily, metaFont: meta && getComputedStyle(meta).fontFamily, metaOpacity: meta && getComputedStyle(meta).opacity,
          docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, overflowers,
          ink: getComputedStyle(document.body).color, speed: __ocean.speed, res: __ocean.res, fps: __ocean.fps,
        };
      });
      const alpha = (() => { const m = info.bg && info.bg.match(/\/\s*([\d.]+)\)|rgba\([^)]*,\s*([\d.]+)\)/); return m ? +(m[1] || m[2]) : 1; })();
      const texture = theme === 'day' ? 'paper.png' : 'paper-dark.png';
      const lhOk = Math.abs(parseFloat(info.lineHeight) - 1.6 * parseFloat(info.fontSize)) < 0.6;
      const widthOk = info.wide ? info.contentW <= 64 * 16 + 0.5 : info.contentW <= info.ch68 + 0.5;
      check(`${path} ${theme} ${W}: surface`, info.surface && Math.abs(alpha - 0.97) < 0.005 && /blur\(8px\)/.test(info.backdrop) && info.bgImage.includes(texture) && widthOk && (path === '/photos/') === info.wide,
        { alpha, bg: info.bg, backdrop: info.backdrop, bgImage: info.bgImage, contentW: info.contentW, ch68: info.ch68, wide: info.wide });
      check(`${path} ${theme} ${W}: prose`, /Newsreader/.test(info.paraFont) && lhOk && /Departure Mono/.test(info.codeFont) && (!info.timeFont || /Departure Mono/.test(info.timeFont)) && (!info.metaFont || /Departure Mono/.test(info.metaFont)) && (!info.metaOpacity || +info.metaOpacity >= 0.75),
        { paraFont: info.paraFont.slice(0, 20), fontSize: info.fontSize, lineHeight: info.lineHeight, code: info.codeFont.slice(0, 16), time: info.timeFont && info.timeFont.slice(0, 16), meta: info.metaFont && info.metaFont.slice(0, 16), metaOpacity: info.metaOpacity });
      check(`${path} ${theme} ${W}: no horizontal overflow`, info.docOverflow <= 0 && info.overflowers.length === 0 || (path === '/photos/' && info.docOverflow <= 0 && info.overflowers.every((t) => t !== 'IMG')), { docOverflow: info.docOverflow, overflowers: info.overflowers });
      check(`${path} ${theme} ${W}: content mode`, info.speed === 0.15 && info.res === 0.5 && info.fps === 15, { speed: info.speed, res: info.res, fps: info.fps });
      if (path === '/photos/') {
        const edges = await p.evaluate(() => {
          const s = document.querySelector('.content-surface').getBoundingClientRect();
          return [...document.querySelectorAll('.bleed img')].map((i) => { const r = i.getBoundingClientRect(); return [+(r.left - s.left).toFixed(1), +(s.right - r.right).toFixed(1)]; });
        });
        check(`/photos/ ${theme} ${W}: images reach panel edges`, edges.length === 2 && edges.every(([l, r]) => Math.abs(l) < 1 && Math.abs(r) < 1), edges);
      }
      await p.evaluate(() => window.scrollTo(0, 0));
      const top = `/tmp/pw/m4_${theme}_${W}x${H}${tag(path)}.png`;
      await p.screenshot({ path: top });
      // Scrolled: put panel text under the header chrome. Short pages get filler
      // paragraphs (marked in the file name) so the collision can be judged.
      const scrolled = await p.evaluate(() => {
        const s = document.querySelector('.content-surface');
        let filler = false;
        if (document.documentElement.scrollHeight < innerHeight + 300) {
          filler = true;
          for (let i = 0; i < 12; i++) { const el = document.createElement('p'); el.className = 'filler'; el.textContent = 'Filler paragraph for the scroll check. The quick brown fox jumps over the lazy dog, again and again, so the panel is taller than the viewport.'; s.appendChild(el); }
        }
        const target = s.querySelector(filler ? 'p.filler' : 'p:not(.meta), li, figure') || s;
        const hdr = document.querySelector('header.chrome').getBoundingClientRect();
        const y = target.getBoundingClientRect().top + scrollY - hdr.top - 4;
        window.scrollTo(0, Math.max(0, Math.min(y, document.documentElement.scrollHeight - innerHeight)));
        return { y: scrollY, filler };
      });
      await p.waitForTimeout(150);
      const sc = `/tmp/pw/m4_${theme}_${W}x${H}${tag(path)}_scrolled${scrolled.filler ? '_filler' : ''}.png`;
      await p.screenshot({ path: sc });
      console.log('SHOT', top, sc, 'scrollY=' + scrolled.y);
      await p.evaluate(() => document.querySelectorAll('.filler').forEach((e) => e.remove()));
      // Grain + contrast on the about panel (text hidden), top of page.
      if (path === '/about/') {
        await p.evaluate(() => window.scrollTo(0, 0));
        const clip = await p.evaluate(() => { const r = document.querySelector('.content-surface').getBoundingClientRect(); return { x: Math.round(r.left + 4), y: Math.round(r.top + 4), width: Math.round(r.width - 8), height: Math.round(Math.min(r.height, innerHeight - r.top) - 8) }; });
        const px = await panelPixels(p, clip, info.ink);
        check(`/about/ ${theme} ${W}: grain visible + ink contrast ≥ 7`, px.std > 0 && px.crWorst >= 7, { ...px, ink: info.ink });
      }
    }
    await ctx.close();
  }
}

// 2. Posts list, post meta, feed, alias.
{
  const ctx = await newCtx(gl);
  const p = await goto(ctx, '/posts/');
  const list = await p.evaluate(() => [...document.querySelectorAll('.post-list li')].map((li) => ({ title: li.querySelector('a').textContent, href: li.querySelector('a').getAttribute('href'), date: li.querySelector('time') && li.querySelector('time').getAttribute('datetime'), text: li.textContent.replace(/\s+/g, ' ').trim() })));
  check('/posts/ lists title, date, reading time', list.length >= 1 && list.every((i) => i.title && i.date && /\d+ min read/.test(i.text)), list);
  await goto(ctx, '/posts/ballistic-wizard/');
  const post = await p.evaluate(() => ({ time: document.querySelector('.content-surface time[datetime="2024-06-27"]') && document.querySelector('.content-surface time').textContent, meta: document.querySelector('.meta') && document.querySelector('.meta').textContent, h1s: document.querySelectorAll('h1').length }));
  const n = +((post.meta || '').match(/(\d+) min read/) || [])[1];
  check('post: time datetime=2024-06-27, N ≥ 1 min read, one h1', !!post.time && n >= 1 && post.h1s === 1, post);
  const feed = await p.evaluate(async () => { const r = await fetch('/feed.xml'); const t = await r.text(); return { status: r.status, item: t.includes('<item>'), pubDate: t.includes('<pubDate>') }; });
  check('/feed.xml 200 with <item>/<pubDate>', feed.status === 200 && feed.item && feed.pubDate, feed);
  await p.goto(base + '/posts/wizard');
  await p.waitForURL(/\/posts\/ballistic-wizard\/$/, { timeout: 15000 });
  check('/posts/wizard alias → /posts/ballistic-wizard/', true, p.url());
  await ctx.close();
}

// 3. Photos markup + WebP 200.
{
  const ctx = await newCtx(gl);
  const p = await goto(ctx, '/photos/', { gl: false });
  const pics = await p.evaluate(() => [...document.querySelectorAll('.content-surface picture')].map((pic) => { const s = pic.querySelector('source'); const i = pic.querySelector('img'); return { type: s && s.type, srcset: s && s.srcset, sizes: s && s.sizes, src: i.getAttribute('src'), w: i.getAttribute('width'), h: i.getAttribute('height'), loading: i.getAttribute('loading'), decoding: i.getAttribute('decoding'), alt: !!i.alt }; }));
  check('photos: <picture> WebP source + JPEG img, width/height, first eager rest lazy', pics.length === 2 && pics.every((x) => x.type === 'image/webp' && /1200w/.test(x.srcset) && /\.JPG$/.test(x.src) && x.w && x.h && x.alt && x.decoding === 'async') && pics[0].loading === null && pics.slice(1).every((x) => x.loading === 'lazy'), pics);
  const urls = pics.flatMap((x) => x.srcset.split(',').map((s) => s.trim().split(' ')[0]));
  const st = await p.evaluate(async (urls) => Promise.all(urls.map(async (u) => { const r = await fetch(u); const b = await r.arrayBuffer(); return [u, r.status, r.headers.get('content-type'), b.byteLength]; })), urls);
  check('photos: WebP URLs 200', st.length === 4 && st.every((x) => x[1] === 200), st);
  const cur = await p.evaluate(() => document.querySelector('.bleed img').currentSrc);
  check('photos: browser picks WebP', /\.webp$/.test(cur), cur);
  await ctx.close();
}

// 4. Throttle: fps, res, speed vs home in the same session (tier cached).
{
  const ctx = await newCtx(gl, { W: 1280, H: 800 });
  const home = await goto(ctx, '/');
  await settled(home);
  await home.waitForTimeout(500);
  const h = await home.evaluate(() => ({ tier: __ocean.tier, cache: sessionStorage.getItem('ocean-tier'), w: document.getElementById('ocean').width, speed: __ocean.speed, res: __ocean.res, fps: __ocean.fps }));
  h.rate = await drawRate(home);
  const ab = await goto(ctx, '/about/');
  await ab.waitForFunction(() => window.__draws > 5, null, { timeout: 30000, polling: 100 });
  const a = await ab.evaluate(() => ({ tier: __ocean.tier, w: document.getElementById('ocean').width, speed: __ocean.speed, res: __ocean.res, fps: __ocean.fps }));
  a.rate = await drawRate(ab);
  check('home: full speed/res/rate', h.speed === 1 && h.res === 1 && h.fps === 0 && h.rate > a.rate, h);
  check('/about/: speed .15, width ≈ 0.5× home at same tier, 15±3 fps', a.speed === 0.15 && a.tier === h.tier && Math.abs(a.w - h.w / 2) <= 1 && a.rate >= 12 && a.rate <= 18, { about: a, homeW: h.w, homeRate: h.rate });
  await ctx.close();
}

// 5. Fresh session landing on /posts/ caches the same tier as a fresh session on /; probe at full res.
{
  const c1 = await newCtx(gl, { W: 1280, H: 800 });
  const p1 = await goto(c1, '/'); await settled(p1);
  const homeTier = await p1.evaluate(() => sessionStorage.getItem('ocean-tier'));
  await c1.close();
  const c2 = await newCtx(gl, { W: 1280, H: 800 });
  const p2 = await goto(c2, '/posts/'); await settled(p2);
  await p2.waitForFunction(() => window.__drawWidths.length > 0 && document.getElementById('ocean').width < window.__drawWidths[0], null, { timeout: 10000, polling: 100 }).catch(() => {});
  const r = await p2.evaluate(() => ({ tier: sessionStorage.getItem('ocean-tier'), widths: [...new Set(window.__drawWidths)], first: window.__drawWidths[0], now: document.getElementById('ocean').width }));
  check('fresh /posts/ caches same tier as /; probe full res then half', r.tier === homeTier && r.first === Math.round(1280 * { high: 0.4, med: 0.375, low: 0.35 }[r.tier]) && Math.abs(r.now - r.first / 2) <= 1, { homeTier, ...r });
  await c2.close();
}

// 6. Static tier (SLOW=40) on a content page.
{
  const ctx = await newCtx(gl, { W: 1280, H: 800, slow: 40 });
  const p = await goto(ctx, '/about/');
  const s = await p.evaluate(() => ({ cache: sessionStorage.getItem('ocean-tier'), cls: document.documentElement.className, speed: __ocean.speed, w: document.getElementById('ocean').width }));
  const d0 = await p.evaluate(() => window.__draws);
  await p.waitForTimeout(500);
  const d1 = await p.evaluate(() => window.__draws);
  await p.screenshot({ path: '/tmp/pw/m4_static_about.png' });
  check('static tier on /about/: settles, no loop', s.cache === 'static' && s.cls.includes('shader-ready') && s.speed === 0.15 && d1 === d0, { ...s, drawsIn500ms: d1 - d0, shot: '/tmp/pw/m4_static_about.png' });
  await ctx.close();
}
await gl.close();

// 7. NOGL: body textured; menu panel textured (390), day + night.
{
  const nogl = await chromium.launch({ args: NOGL });
  for (const theme of ['day', 'night']) {
    const tex = theme === 'day' ? 'paper.png' : 'paper-dark.png';
    const ctx = await newCtx(nogl, { W: 390, H: 844, theme });
    const p = await goto(ctx, '/about/', { gl: false });
    const b = await p.evaluate(() => ({ cls: document.documentElement.className, bodyImg: getComputedStyle(document.body).backgroundImage, speed: __ocean.speed }));
    const shot = `/tmp/pw/m4_nogl_${theme}_390x844_about_.png`;
    await p.screenshot({ path: shot });
    await goto(ctx, '/', { gl: false });
    const shotHome = `/tmp/pw/m4_nogl_${theme}_390x844_.png`;
    await p.screenshot({ path: shotHome });
    await p.click('.menu summary');
    await p.waitForFunction(() => document.querySelector('.menu').open, null, { polling: 50 });
    const menuImg = await p.evaluate(() => getComputedStyle(document.querySelector('.menu-panel')).backgroundImage);
    const shotMenu = `/tmp/pw/m4_nogl_${theme}_390x844_menu.png`;
    await p.waitForTimeout(300);
    await p.screenshot({ path: shotMenu });
    check(`NOGL ${theme}: body + menu panel textured`, b.cls.includes('no-webgl') && b.bodyImg.includes(tex) && menuImg.includes(tex), { ...b, menuImg, shots: [shot, shotHome, shotMenu] });
    await ctx.close();
  }
  await nogl.close();
}

// 8. Asset sizes.
{
  const sizes = Object.fromEntries(['static/paper.png', 'static/paper-dark.png', 'static/ocean.js'].map((f) => [f, fs.statSync(`${REPO}/${f}`).size]));
  check('paper PNGs ≤ 20 KB, ocean.js ≤ 11264 B (M6)', sizes['static/paper.png'] <= 20480 && sizes['static/paper-dark.png'] <= 20480 && sizes['static/ocean.js'] <= 11264, sizes);
}

check('no console errors / pageerrors', allErrors.length === 0, allErrors);
console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS', `${results.filter((r) => r.ok).length}/${results.length}`);
process.exit(failed ? 1 : 0);
