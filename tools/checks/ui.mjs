// UI requirements checker (UI-REQUIREMENTS.md: UI-1 touch targets, UI-2 link
// underlines, UI-3 folder-style header). Prints a PASS/FAIL table per
// rule/page/viewport, then the failure details; exits 1 on any FAIL.
//   node ui.mjs [baseUrl]        (default http://127.0.0.1:1112)
import { chromium } from 'playwright';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = (process.argv[2] || 'http://127.0.0.1:1112').replace(/\/$/, '');
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PATHS = ['/', '/digital-sun/', '/posts/', '/404.html'];
const VIEWPORTS = [
  { name: 'touch-320', width: 320, height: 568, touch: true },
  { name: 'touch-390', width: 390, height: 844, touch: true },
  { name: 'desktop-1280', width: 1280, height: 800, touch: false },
];

const rows = []; // { rule, page, vp, ok, details: string[] }
const record = (rule, page, vp, details) => rows.push({ rule, page, vp, ok: details.length === 0, details });

// ---- UI-2 static part: `text-decoration: none` on rules that could match `a`.
function cssFiles(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? cssFiles(p) : p.endsWith('.css') ? [p] : [];
  });
}
// Could the last compound selector match an <a> element (not a pseudo-element)?
function couldMatchAnchor(selector) {
  const flat = selector.replace(/\([^()]*\)/g, '()').replace(/\[[^\]]*\]/g, '[]').trim();
  const compound = flat.split(/\s*[>+~]\s*|\s+/).pop() || '';
  if (/::|:(before|after|first-line|first-letter|marker)\b/.test(compound)) return false;
  const type = compound.match(/^(?:[\w-]+\|)?([a-zA-Z][\w-]*|\*)/);
  return !type || type[1] === '*' || type[1].toLowerCase() === 'a';
}
function scanCss() {
  const hits = [];
  for (const file of cssFiles(join(repoRoot, 'static'))) {
    const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
    const stack = []; // preludes of open blocks
    let start = 0;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (c === '{') { stack.push(src.slice(start, i).trim()); start = i + 1; }
      else if (c === '}') {
        const prelude = stack.pop() || '';
        const body = src.slice(start, i);
        if (!prelude.startsWith('@') && /text-decoration(-line)?\s*:\s*none/.test(body)) {
          const bad = prelude.split(',').filter(couldMatchAnchor);
          if (bad.length) {
            const line = src.slice(0, i).split('\n').length;
            hits.push(`${relative(repoRoot, file)}:${line} \`${bad.map((s) => s.trim()).join(', ')}\` sets text-decoration none`);
          }
        }
        start = i + 1;
      } else if (c === ';' && stack.length === 0) start = i + 1; // top-level @import etc.
    }
  }
  return hits;
}
record('UI-2 css', 'static/**/*.css', '-', scanCss());

// ---- In-page helpers (serialised into the page).
function collectTargets() {
  const SEL = 'a[href], button, summary, input:not([type=hidden]), select, textarea, [role=button], [role=link], [tabindex="0"]';
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  };
  const label = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} "${(el.getAttribute('aria-label') || el.textContent || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 24)}"`;
  // Inline link in running text: an inline <a> whose nearest block ancestor is
  // a p/li inside .content-surface, and not in header/footer/nav/.post-list.
  const isInlineProse = (el) => {
    if (el.tagName !== 'A' || getComputedStyle(el).display !== 'inline') return false;
    if (el.closest('header, footer, nav, .post-list') || !el.closest('.content-surface')) return false;
    let b = el.parentElement;
    while (b && getComputedStyle(b).display.startsWith('inline')) b = b.parentElement;
    return !!b && (b.tagName === 'P' || b.tagName === 'LI');
  };
  // Hit rect: border box, grown by an absolutely positioned ::before/::after overlay.
  const hitRect = (el) => {
    const r = el.getBoundingClientRect();
    let { left, top, right, bottom } = r;
    if (getComputedStyle(el).position !== 'static') {
      for (const pe of ['::before', '::after']) {
        const s = getComputedStyle(el, pe);
        if (s.content === 'none' || s.content === 'normal' || s.position !== 'absolute' || s.pointerEvents === 'none') continue;
        const px = (v) => (v.endsWith('px') ? parseFloat(v) : 0);
        left = Math.min(left, r.left + px(s.left));
        top = Math.min(top, r.top + px(s.top));
        right = Math.max(right, r.right - px(s.right));
        bottom = Math.max(bottom, r.bottom - px(s.bottom));
      }
    }
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  };
  const all = [...document.querySelectorAll(SEL)];
  window.__uiTargets = all;
  return all.map((el, i) => {
    const cs = getComputedStyle(el);
    return {
      i, label: label(el), tag: el.tagName, visible: isVisible(el), exempt: isInlineProse(el),
      skip: el.classList.contains('skip-link'), current: el.getAttribute('aria-current') === 'page',
      rect: hitRect(el), nested: all.filter((o) => o !== el && o.contains(el)).map((o) => all.indexOf(o)),
      deco: { line: cs.textDecorationLine, thick: cs.textDecorationThickness, offset: cs.textUnderlineOffset, color: cs.textDecorationColor },
    };
  });
}

function inspectHeader() {
  const vw = innerWidth, vh = innerHeight;
  const header = document.querySelector('header.chrome');
  if (!header) return { missing: true };
  const text = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ');
  const links = [...header.querySelectorAll('a[href]')];
  const clipped = (el) => {
    const r = el.getBoundingClientRect();
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) return 'text overflows its box';
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.clipPath !== 'none') {
        const pr = p.getBoundingClientRect();
        if (r.left < pr.left - 0.5 || r.right > pr.right + 0.5 || r.top < pr.top - 0.5 || r.bottom > pr.bottom + 0.5) return `clipped by ${p.tagName.toLowerCase()}.${p.className}`;
      }
    }
    return '';
  };
  return {
    missing: false,
    path: location.pathname,
    vw, vh,
    links: links.map((a) => {
      const r = a.getBoundingClientRect();
      return {
        text: text(a), path: new URL(a.href, location.href).pathname, current: a.getAttribute('aria-current') === 'page',
        rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height },
        visible: r.width > 0 && r.height > 0 && a.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
        inViewport: r.left >= -0.5 && r.right <= vw + 0.5 && r.top >= -0.5 && r.bottom <= vh + 0.5,
        clipped: clipped(a),
        historyBack: /history\.back|history\.go/.test(a.getAttribute('onclick') || '') || /^javascript:/i.test(a.getAttribute('href')),
      };
    }),
    menus: [...header.querySelectorAll('details, summary, [popover], [aria-haspopup], button')]
      .filter((el) => el.tagName !== 'BUTTON' || /menu/i.test(text(el)) || el.hasAttribute('aria-haspopup') || el.hasAttribute('popovertarget'))
      .map((el) => `${el.tagName.toLowerCase()} "${text(el).slice(0, 20)}"`),
  };
}

// ---- Rules evaluated in Node from the page data.
const fmt = (r) => `${Math.round(r.width)}x${Math.round(r.height)}`;
const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;

function checkUI1(targets, coarse) {
  const min = coarse ? 44 : 24;
  const measured = targets.filter((t) => t.visible && !t.exempt);
  const out = measured.filter((t) => t.rect.width < min - 0.01 || t.rect.height < min - 0.01)
    .map((t) => `${t.label} hit ${fmt(t.rect)} < ${min}x${min}`);
  for (let a = 0; a < measured.length; a++)
    for (let b = a + 1; b < measured.length; b++) {
      const A = measured[a], B = measured[b];
      if (A.nested.includes(B.i) || B.nested.includes(A.i)) continue;
      // The skip link is off-screen until focused, then overlays the header by design.
      if (A.skip || B.skip) continue;
      if (overlap(A.rect, B.rect)) out.push(`overlap: ${A.label} ${fmt(A.rect)} ∩ ${B.label} ${fmt(B.rect)}`);
    }
  return out;
}

function decoProblems(d, state) {
  const out = [];
  if (!d.line.includes('underline')) out.push(`${state}: text-decoration-line "${d.line}"`);
  if (d.thick !== '1px') out.push(`${state}: thickness ${d.thick}`);
  return out;
}

function checkUI3(h, page) {
  if (h.missing) return ['no header.chrome'];
  const out = [];
  const vis = h.links.filter((l) => l.visible);
  if (!vis.length) out.push('header.chrome has no visible links');
  if (h.menus.length) out.push(`menu control in header: ${h.menus.join(', ')}`);
  for (const l of h.links) {
    if (/^\s*(back\b|←)/i.test(l.text) || l.text.includes('←')) out.push(`link labelled as Back: "${l.text}"`);
    if (l.historyBack) out.push(`link uses history: "${l.text}"`);
  }
  for (const l of h.links) {
    if (!l.visible) out.push(`hidden header link "${l.text}"`);
    else if (!l.inViewport) out.push(`header link "${l.text}" outside viewport (${Math.round(l.rect.left)}..${Math.round(l.rect.right)} of ${h.vw})`);
    else if (l.clipped) out.push(`header link "${l.text}" ${l.clipped}`);
  }
  if (page === '/404.html') return out; // not a node in the tree: no current/parent/children checks
  const cur = h.links.filter((l) => l.current);
  if (cur.length !== 1) { out.push(`expected exactly one aria-current="page" link in header, found ${cur.length}`); return out; }
  const c = cur[0];
  if (c.path !== h.path) out.push(`aria-current link "${c.text}" → ${c.path}, but page is ${h.path}`);
  const cx = (c.rect.left + c.rect.right) / 2;
  const left = vis.filter((l) => !l.current && (l.rect.left + l.rect.right) / 2 < cx);
  const right = vis.filter((l) => !l.current && (l.rect.left + l.rect.right) / 2 >= cx);
  if (h.path === '/') { if (left.length) out.push(`root has parent-region link(s): ${left.map((l) => `"${l.text}"`).join(', ')}`); }
  else if (left.length !== 1) out.push(`expected one parent link left of current, found ${left.length}`);
  else if (!(h.path.startsWith(left[0].path) && left[0].path !== h.path)) out.push(`parent link "${left[0].text}" → ${left[0].path} is not an ancestor of ${h.path}`);
  const depth = (p) => p.split('/').filter(Boolean).length;
  for (const l of right)
    if (!(l.path.startsWith(h.path) && depth(l.path) === depth(h.path) + 1)) out.push(`children-region link "${l.text}" → ${l.path} is not a direct child of ${h.path}`);
  return out;
}

function regionText(h) {
  if (h.missing) return '(no header.chrome)';
  const vis = h.links.filter((l) => l.visible);
  const c = vis.find((l) => l.current);
  const cx = c ? (c.rect.left + c.rect.right) / 2 : h.vw / 2;
  const names = (ls) => ls.map((l) => l.text).join(', ') || '(empty)';
  return `left: ${names(vis.filter((l) => !l.current && (l.rect.left + l.rect.right) / 2 < cx))} | centre: ${c ? c.text : '(none)'} | right: ${names(vis.filter((l) => !l.current && (l.rect.left + l.rect.right) / 2 >= cx))}`;
}

// ---- Run.
const browser = await chromium.launch();
const regions = [];
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: vp.touch, isMobile: vp.touch, deviceScaleFactor: vp.touch ? 2 : 1,
  });
  const p = await ctx.newPage();
  for (const page of PATHS) {
    await p.goto(base + page, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    const coarse = await p.evaluate(() => matchMedia('(pointer: coarse)').matches);
    const envBad = coarse === vp.touch ? [] : [`matchMedia('(pointer: coarse)') is ${coarse}, expected ${vp.touch}`];

    // Skip link: measured (and its decoration read) while focused.
    const targets = await p.evaluate(collectTargets);
    const skipIdx = targets.filter((t) => t.skip).map((t) => t.i);
    for (const i of skipIdx) {
      await p.evaluate((i) => window.__uiTargets[i].focus(), i);
      await p.waitForTimeout(400);
      const focused = await p.evaluate(collectTargets);
      targets[i] = focused[i];
      await p.evaluate((i) => window.__uiTargets[i].blur(), i);
    }
    record('UI-1 targets', page, vp.name, [...envBad, ...checkUI1(targets, coarse)]);

    const anchors = targets.filter((t) => t.tag === 'A' && t.visible);
    const ui2 = [];
    for (const t of anchors) {
      const tag = `${t.label}${t.current ? ' [aria-current]' : ''}`;
      for (const d of decoProblems(t.deco, t.skip ? 'focus' : 'rest')) ui2.push(`${tag} ${d}`);
    }
    if (!vp.touch) {
      for (const t of anchors.filter((t) => !t.skip)) {
        await p.mouse.move(0, 0);
        try { await p.evaluate((i) => window.__uiTargets[i].scrollIntoView({ block: 'center' }), t.i); } catch {}
        const r = await p.evaluate((i) => { const b = window.__uiTargets[i].getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, t.i);
        await p.mouse.move(r.x, r.y);
        await p.waitForTimeout(300);
        const hovered = await p.evaluate((i) => window.__uiTargets[i].matches(':hover'), t.i);
        const cs = await p.evaluate((i) => { const s = getComputedStyle(window.__uiTargets[i]); return { line: s.textDecorationLine, thick: s.textDecorationThickness, offset: s.textUnderlineOffset, color: s.textDecorationColor }; }, t.i);
        const tag = `${t.label}${t.current ? ' [aria-current]' : ''}`;
        if (!hovered) { ui2.push(`${tag} hover: element not hoverable at its centre (covered?)`); continue; }
        for (const d of decoProblems(cs, 'hover')) ui2.push(`${tag} ${d}`);
        for (const k of ['offset', 'color']) if (cs[k] !== t.deco[k]) ui2.push(`${tag} hover: underline ${k} ${t.deco[k]} → ${cs[k]}`);
      }
      await p.mouse.move(0, 0);
    }
    record('UI-2 underline', page, vp.name, ui2);

    const h = await p.evaluate(inspectHeader);
    record('UI-3 header', page, vp.name, checkUI3(h, page));
    regions.push(`${vp.name.padEnd(13)} ${page.padEnd(14)} ${regionText(h)}`);
  }
  await ctx.close();
}
await browser.close();

// ---- Report.
console.log(`UI checks against ${base}\n`);
console.log(`${'rule'.padEnd(15)} ${'page'.padEnd(16)} ${'viewport'.padEnd(13)} result`);
for (const r of rows) console.log(`${r.rule.padEnd(15)} ${r.page.padEnd(16)} ${r.vp.padEnd(13)} ${r.ok ? 'PASS' : `FAIL (${r.details.length})`}`);
console.log('\nUI-3 header regions (compare with the worked example in UI-REQUIREMENTS.md):');
for (const l of regions) console.log('  ' + l);
const failed = rows.filter((r) => !r.ok);
if (failed.length) {
  console.log('\nFailures:');
  for (const r of failed) {
    console.log(`  ${r.rule} ${r.page} ${r.vp}`);
    for (const d of r.details) console.log(`    - ${d}`);
  }
}
console.log(`\n${failed.length ? 'FAIL' : 'PASS'}: ${rows.length - failed.length}/${rows.length} rows pass`);
process.exit(failed.length ? 1 : 0);
