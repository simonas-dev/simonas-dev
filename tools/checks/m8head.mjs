import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 320, height: 640 } })).newPage();
await p.goto('http://127.0.0.1:1198/photos/'); await p.waitForTimeout(1200);
await p.click('details.menu > summary'); await p.waitForTimeout(400);
await p.screenshot({ path: '/tmp/m8/HEAD-before-m8_day_320_photos_menu.png' });
console.log(await p.evaluate(() => { const l = document.querySelector('a.logo').getBoundingClientRect(); const e = document.elementFromPoint(l.left + 5, l.top + l.height / 2); return e.tagName + '.' + e.className; }));
await b.close();
