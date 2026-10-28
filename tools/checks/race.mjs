// Context lost+restored while GLSL fetch is pending: expect exactly one program and one buffer.
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:1111';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => {
  window.__counts = { program: 0, buffer: 0 };
  const P = WebGLRenderingContext.prototype;
  const cp = P.createProgram, cb = P.createBuffer;
  P.createProgram = function () { window.__counts.program++; return cp.call(this); };
  P.createBuffer = function () { window.__counts.buffer++; return cb.call(this); };
});
let release; const gate = new Promise((r) => (release = r));
await page.route('**/shader/*.glsl', async (route) => { await gate; await route.continue(); });
await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
await page.evaluate(async () => {
  const ext = document.getElementById('ocean').getContext('webgl').getExtension('WEBGL_lose_context');
  ext.loseContext(); await new Promise((r) => setTimeout(r, 200));
  ext.restoreContext(); await new Promise((r) => setTimeout(r, 200));
});
release();
await page.waitForFunction(() => document.documentElement.classList.contains('shader-ready'), null, { timeout: 60000 });
await page.waitForTimeout(500);
const counts = await page.evaluate(() => window.__counts);
console.log(JSON.stringify({ counts, errors }));
await browser.close();
const ok = counts.program === 1 && counts.buffer === 1 && !errors.length;
console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL'); process.exit(ok ? 0 : 1);
