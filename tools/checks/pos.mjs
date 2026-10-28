import { chromium } from 'playwright';
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: +process.argv[3] || 1280, height: 800 } });
await p.goto(process.argv[2] + '/nope/'); await p.waitForTimeout(600);
console.log(JSON.stringify(await p.evaluate(() => ['a.logo', 'nav.nav-inline a', 'details.menu summary', 'footer a', '.content-surface a'].map(s => { const a = document.querySelector(s); if (!a) return null; const r = document.createRange(); r.selectNodeContents(a); const b = r.getBoundingClientRect(); return s + ' ' + Math.round(b.x) + ',' + Math.round(b.y); }))));
await browser.close();
