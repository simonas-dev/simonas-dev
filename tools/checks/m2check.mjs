// M2 layout checks: metrics, tab order, mobile <details> menu (open screenshot).
import { chromium } from 'playwright';
const base = 'http://127.0.0.1:1111';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function metrics(W, H, path = '/') {
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(base + path, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  const m = await p.evaluate(() => {
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) }; };
    const cs = getComputedStyle(document.documentElement);
    const logo = document.querySelector('.logo');
    const navA = document.querySelector('.nav-inline a');
    const summary = document.querySelector('.menu summary');
    const base = (el) => { if (!el || !el.offsetParent && getComputedStyle(el).position !== 'fixed') return null; const s = document.createElement('span'); s.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'; el.appendChild(s); const y = s.getBoundingClientRect().top; s.remove(); return Math.round(y * 10) / 10; };
    const hero = document.querySelector('.hero');
    const heroLast = hero && hero.lastElementChild;
    const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;width:var(--frame-inline);height:var(--frame-block)'; document.body.appendChild(probe);
    const frame = [probe.getBoundingClientRect().width, probe.getBoundingClientRect().height]; probe.remove();
    const canvas = document.getElementById('ocean');
    return {
      frame, horizonVar: document.documentElement.style.getPropertyValue('--scene-horizon-from-bottom') || cs.getPropertyValue('--scene-horizon-from-bottom'),
      horizonExpected: canvas.clientHeight * (0.5 + 0.75 * Math.tan(0.12)), horizonTopY: canvas.clientHeight * (1 - (0.5 + 0.75 * Math.tan(0.12))),
      logo: r(logo), logoBaseline: base(logo), logoCenterOff: logo ? Math.round((logo.getBoundingClientRect().left + logo.getBoundingClientRect().right) / 2 - innerWidth / 2) : null,
      nav: r(document.querySelector('.nav-inline')), navVisible: navA ? navA.offsetParent !== null : false, navBaseline: navA && navA.offsetParent ? base(navA) : null,
      summary: r(summary), summaryVisible: summary ? summary.offsetParent !== null : false, summaryBaseline: summary && summary.offsetParent ? base(summary) : null,
      navFont: navA ? getComputedStyle(navA).fontFamily : null,
      heroText: heroLast ? r(heroLast) : null, heroH1: hero ? r(hero.querySelector('h1')) : null,
      footerSmall: r(document.querySelector('footer small')), toggle: r(document.querySelector('.theme-toggle')),
      bodyColor: getComputedStyle(document.body).color, bodyBg: getComputedStyle(document.body).backgroundColor,
      linkColor: document.querySelector('main a') ? getComputedStyle(document.querySelector('main a')).color : null,
      fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.style),
      scripts: document.querySelectorAll('script[src]').length, // M3 under zola serve: ocean.js + site.js + livereload.js
      night: !!document.querySelector('.theme-night'),
      docH: document.documentElement.scrollHeight,
    };
  });
  await p.close();
  return { W, H, path, ...m, errs };
}
for (const [W, H, path] of [[1440, 900, '/'], [1280, 800, '/'], [390, 844, '/'], [320, 640, '/'], [844, 390, '/'], [390, 844, '/about/']]) console.log(JSON.stringify(await metrics(W, H, path)));

// Tab order + keyboard menu at 390.
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto(base + '/', { waitUntil: 'load' });
await p.waitForFunction(() => document.documentElement.classList.contains('shader-ready'), null, { timeout: 60000 });
await p.waitForTimeout(1500);
const order = [];
for (let i = 0; i < 8; i++) { await p.keyboard.press('Tab'); order.push(await p.evaluate(() => { const a = document.activeElement; return a.tagName + ':' + (a.textContent || '').trim().slice(0, 20); })); }
console.log('tab order 390:', order.join(' | '));
await p.keyboard.press('Shift+Tab'); // back to summary? find summary
await p.focus('.menu summary');
await p.keyboard.press('Enter');
console.log('open after Enter:', await p.evaluate(() => document.querySelector('.menu').open));
await p.keyboard.press('Tab');
console.log('focus after open+Tab:', await p.evaluate(() => document.activeElement.textContent.trim()));
const panel = await p.evaluate(() => { const n = document.querySelector('.menu-panel'); const cs = getComputedStyle(n); const b = n.getBoundingClientRect(); return { bg: cs.backgroundColor, mask: cs.maskImage || cs.webkitMaskImage, rect: [b.left, b.top, b.right, b.bottom] }; });
console.log('panel:', JSON.stringify(panel));
await p.keyboard.press('Shift+Tab');
await p.waitForTimeout(400);
await p.screenshot({ path: '/tmp/pw/m2_390_menu_open.png' });
await p.focus('.menu summary');
await p.keyboard.press('Space');
console.log('open after Space:', await p.evaluate(() => document.querySelector('.menu').open));
await p.close();
const d = await b.newPage({ viewport: { width: 1440, height: 900 } });
await d.goto(base + '/', { waitUntil: 'load' });
const order2 = [];
for (let i = 0; i < 7; i++) { await d.keyboard.press('Tab'); order2.push(await d.evaluate(() => { const a = document.activeElement; return a.tagName + ':' + (a.textContent || '').trim().slice(0, 20); })); }
console.log('tab order 1440:', order2.join(' | '));
// M3: toggle is enabled by site.js, so it is the last tab stop (was skipped while disabled in M2).
console.log('M3 toggle focusable:', order2[order2.length - 1] === 'BUTTON:Auto' ? 'PASS' : 'FAIL');
await b.close();
