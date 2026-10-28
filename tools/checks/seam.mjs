// Poster vs first video frame on /digital-sun/: same pixels? same position?
import { chromium } from 'playwright';
const base = process.argv[2], W = +process.argv[3] || 1280, H = +process.argv[4] || 800;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const p = await ctx.newPage();
await p.goto(base + '/digital-sun/', { waitUntil: 'load' });
await p.waitForFunction(() => document.querySelector('.video-page video.playing'), null, { timeout: 60000 });
// Freeze the video on frame 0 and hide chrome; shot A = video only, shot B = poster only
await p.evaluate(async () => {
  const v = document.querySelector('.video-page video'); v.pause(); v.currentTime = 0;
  await new Promise(r => v.addEventListener('seeked', r, { once: true }));
  document.querySelectorAll('.chrome, .logo, .video-caption').forEach(e => e.style.visibility = 'hidden');
  v.style.transition = 'none';
});
await p.waitForTimeout(500);
await p.screenshot({ path: `/tmp/pw/seamV_${W}.png` });
const info = await p.evaluate(() => {
  const v = document.querySelector('.video-page video'), i = document.querySelector('.video-poster img');
  const rv = v.getBoundingClientRect(), ri = i.getBoundingClientRect();
  return { video: [v.currentSrc.split('/').pop(), v.videoWidth, v.videoHeight, rv.x, rv.width, rv.height], poster: [i.currentSrc.split('/').pop(), i.naturalWidth, i.naturalHeight, ri.x, ri.width, ri.height] };
});
await p.evaluate(() => { document.querySelector('.video-page video').style.visibility = 'hidden'; });
await p.waitForTimeout(300);
await p.screenshot({ path: `/tmp/pw/seamP_${W}.png` });
console.log(JSON.stringify(info));
await browser.close();
