// Lifecycle checks: sessionStorage tier reuse across navigation, context loss/restore.
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:1111';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const ready = () => page.waitForFunction(() => document.documentElement.classList.contains('shader-ready'), null, { timeout: 60000 });
await page.goto(base + '/'); await ready();
const first = await page.evaluate(() => ({ tier: window.__ocean.tier, cache: sessionStorage.getItem('ocean-tier') }));
await page.goto(base + '/about/');
const t0 = Date.now(); await ready(); const reuseMs = Date.now() - t0;
const second = await page.evaluate(() => {
  const gl = document.getElementById('ocean').getContext('webgl');
  const prog = gl.getParameter(gl.CURRENT_PROGRAM);
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  const active = [];
  for (let i = 0; i < n; i++) active.push(gl.getActiveUniform(prog, i).name);
  return { tier: window.__ocean.tier, activeUniforms: active.sort() };
});
const lost = await page.evaluate(async () => {
  const gl = document.getElementById('ocean').getContext('webgl');
  const ext = gl.getExtension('WEBGL_lose_context');
  ext.loseContext();
  await new Promise((r) => setTimeout(r, 300));
  const afterLoss = document.documentElement.className;
  ext.restoreContext();
  return afterLoss;
});
await ready();
const restored = await page.evaluate(() => document.documentElement.className);
console.log(JSON.stringify({ first, second, reuseMs, afterLoss: lost, restored, errors }));
await browser.close();
const ok = second.activeUniforms.length === 7 && second.activeUniforms.includes('u_ripples[0]') && first.cache === first.tier && second.tier === first.tier && !lost.includes('shader-ready') && restored.includes('shader-ready') && !errors.length;
console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL'); process.exit(ok ? 0 : 1);
