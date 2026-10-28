import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:1112';
const browser = await chromium.launch();
let bad = 0;
for (const [w, h] of [[1280, 800], [390, 844]]) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  for (const path of ['/', '/digital-sun/', '/nope/', '/posts/']) {
    await p.goto(base + path, { waitUntil: 'load' });
    if (w < 600) await p.evaluate(() => { const m = document.querySelector('details.menu'); if (m) m.open = true; });
    await p.mouse.move(0, h - 1);
    const r = await p.evaluate(() => [...document.querySelectorAll('a')].map(a => {
      const cs = getComputedStyle(a), vis = a.offsetParent !== null || cs.position === 'fixed';
      return { t: (a.textContent || '').trim().slice(0, 18), line: cs.textDecorationLine, vis };
    }));
    for (const x of r) { const ok = x.line.includes('underline'); if (!ok) bad++; console.log(`${w}`.padEnd(5), path.padEnd(14), ok ? 'ok ' : 'BAD', x.t.padEnd(20), x.line, x.vis ? '' : '(hidden)'); }
  }
  await p.close();
}
console.log(bad ? `FAIL ${bad}` : 'PASS: every link underlined');
await browser.close();
