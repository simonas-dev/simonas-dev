// Where is the orb on screen vs the mask centre? Measure from the full-opacity video.
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
for (const [w, h] of [[1280, 800], [1920, 1080], [390, 844], [1024, 1366]]) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.goto('http://127.0.0.1:1112/'); await p.waitForFunction(() => document.querySelector('.sky-video video.playing'), null, { timeout: 30000 });
  await p.evaluate(async () => { const v = document.querySelector('.sky-video video'); v.pause(); v.currentTime = 0; await new Promise(r => v.addEventListener('seeked', r, { once: true }));
    const l = document.querySelector('.sky-video'); l.style.opacity = 1; l.style.mask = 'none'; l.style.webkitMask = 'none'; document.querySelectorAll('.chrome,.logo,#ocean').forEach(e => e.style.visibility = 'hidden'); });
  await p.waitForTimeout(300);
  const buf = await p.screenshot({ type: 'png' });
  const fs = await import('fs'); fs.writeFileSync(`/tmp/orb_${w}x${h}.png`, buf);
  console.log(w + 'x' + h, 'saved'); await p.close();
}
await browser.close();
