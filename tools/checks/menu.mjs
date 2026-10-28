import { chromium } from 'playwright';
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
await p.goto('http://127.0.0.1:1112/'); await p.click('details.menu summary'); await p.waitForTimeout(300);
console.log('menu link', await p.evaluate(() => { const a = document.querySelector('.menu-panel a'); const r = document.createRange(); r.selectNodeContents(a); const b = r.getBoundingClientRect(); return Math.round(b.x) + ',' + Math.round(b.y); }));
await browser.close();
