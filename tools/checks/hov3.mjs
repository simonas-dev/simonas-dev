import { chromium } from 'playwright';
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const shots = [];
for (const path of ['/', '/nope/']) {
  await p.goto('http://127.0.0.1:1112' + path); await p.waitForTimeout(800);
  for (const sel of ['a.logo', 'nav.nav-inline a', 'footer a', '.content-surface a']) {
    const el = await p.$(sel); if (!el) continue;
    await p.mouse.move(640, 300); await p.waitForTimeout(300);
    const before = await el.evaluate(a => { const r = a.getClientRects()[0]; const t = document.createRange(); t.selectNodeContents(a); const tr = t.getBoundingClientRect(); return { tx: tr.x, ty: tr.y, th: getComputedStyle(a).textDecorationThickness }; });
    await el.hover(); await p.waitForTimeout(400);
    const after = await el.evaluate(a => { const t = document.createRange(); t.selectNodeContents(a); const tr = t.getBoundingClientRect(); const b = a.getBoundingClientRect(); return { tx: tr.x, ty: tr.y, th: getComputedStyle(a).textDecorationThickness, bg: getComputedStyle(a).backgroundColor, box: [Math.round(b.width - tr.width), Math.round(b.height - tr.height)] }; });
    console.log(path.padEnd(7), sel.padEnd(20), 'thickness', before.th, '→', after.th, '| text moved', (after.tx - before.tx).toFixed(1), (after.ty - before.ty).toFixed(1), '| wash', after.bg, 'box +', after.box.join('×'));
    if (path === '/nope/' && (sel === '.content-surface a' || sel === 'nav.nav-inline a')) {
      const b = await el.boundingBox(); const f = `/private/tmp/glim/h3_${sel.replace(/[^a-z]/g, '')}_${Date.now()}.png`;
      await p.screenshot({ path: f, clip: { x: b.x - 16, y: b.y - 10, width: b.width + 32, height: b.height + 20 } }); shots.push(f);
    }
  }
}
await p.goto('http://127.0.0.1:1112/'); await p.keyboard.press('Tab'); await p.waitForTimeout(200);
console.log('skip-link', JSON.stringify(await p.evaluate(() => { const s = document.querySelector('.skip-link'); const b = s.getBoundingClientRect(); return { focused: document.activeElement === s, x: b.x, y: b.y, margin: getComputedStyle(s).margin }; })));
console.log(shots.join(' '));
await browser.close();
