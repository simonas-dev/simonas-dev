// Brightness profile down the centre column, ocean only (sky video hidden)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://127.0.0.1:1112/'); await p.waitForFunction(() => document.documentElement.classList.contains('shader-ready'), null, { timeout: 60000 });
await p.addStyleTag({ content: '.sky-video{display:none!important}' }); await p.waitForTimeout(2500);
await p.evaluate(() => { window.__ocean.speed = 0; }); await p.waitForTimeout(500);
await p.screenshot({ path: '/tmp/hz.png' });
await browser.close();
