# M0 Scout — simonas-dev

## 1. Files (bytes)
- pages/: _app.js 569, _document.js 863, index.mdx 292, photos.mdx 314, posts/index.md 59, posts/wizard.md 484, tags/[tag].mdx 208
- public/: favicon.ico 15086, images/DSCF2021.JPG 12,424,913, images/R1-09309-017A.JPG 7,580,392, images/baller-wizard.jpg 157,508, ballistic-wizard-1.0.0.apk 17,438,213, fonts/Inter-roman.latin.var.woff2 51896, fonts/Inter-italic.latin.var.woff2 56108
- styles/main.css 1378; scripts/gen-rss.js 1173
- root: next.config.js, theme.config.js, package.json (Next 12.0.8, nextra 2 beta, build = `node scripts/gen-rss.js && next build`), yarn.lock, README.md (stock Nextra starter boilerplate), .gitignore (already rewritten for Zola), PLAN.md, AGENTS.md, .council/, .pi/

### pages/index.mdx
Front matter `type: page, title: About, date: 2023-08-03`. Body: `# Simonas Sankauskas`; "I am a Senior Software Engineer with 7 years of experience working on Android apps."; `---`; "Reach me at:" list: https://github.com/simonas-dev, https://instagram.com/swimonas, https://www.linkedin.com/in/simonas-sankauskas/

### pages/posts/wizard.md
Front matter `title: Ballistic Wizard, date: 2024/6/27, tag: android, esp32, bluetooth, author: You` (date format must become `2024-06-27` for Zola). Body: `![baller wizard using the app](/images/baller-wizard.jpg)`, `# Ballistic Wizard`, "A quick and dirty solution to sending numeric data to ESP32 using Android app via Bluetooth.", links: `[Download Android App APK](/ballistic-wizard-1.0.0.apk)`, `[Andorid App Source Code](https://github.com/simonas-dev/ballistic-wizard)` (typo "Andorid"), `[ESP32 Gun Firmware Source Code](https://github.com/simonas-dev/wizard-gun-firmware)`.
pages/posts/index.md: `type: posts, title: Posts, date: 2021-03-18`, `# Posts`.

### pages/photos.mdx
`type: page, title: Photos, date: 2021-03-18`; `# Photos`; two `next/image` with width 1125 height 750, `priority`, class `next-image`: `/images/DSCF2021.JPG`, `/images/R1-09309-017A.JPG`. Trailing stray `*/}`.

### scripts/gen-rss.js (feed)
Uses `rss` + `gray-matter`; placeholder title "Your Name", site_url `https://yoursite.com`, feed_url `https://yoursite.com/feed.xml`; reads pages/posts (skip index.*), url `/posts/<name>`, categories from `tag.split(', ')`; writes `public/feed.xml`. So the live feed item URL is `/posts/wizard` with bogus domain.

### theme.config.js
Footer only: `<time>{YEAR}</time> © Simonas Sankauskas.` + `<a href="/feed.xml">RSS</a>` floated right.

### next.config.js
`require('nextra')('nextra-theme-blog','./theme.config.js')`; **no redirects**. No vercel.json exists.

### .gitignore
Already Zola-ready: ignores `/public/` (build output; comment notes legacy public/ files stay tracked until M0), node_modules, .next/out, `.vercel/`, `.env*`, `.pi/*` except `.pi/agents/`, `.pi/prompts/`, OS/editor, logs. Likely needs only removal of legacy-comment lines.

## 2. Images
| file | px | size |
|---|---|---|
| baller-wizard.jpg | 1024×1024 | 154 KB |
| DSCF2021.JPG | 6240×4160 | 12.4 MB |
| R1-09309-017A.JPG | 3610×2433 | 7.6 MB |
Both photos are 3:2-ish (R1 is 1.484). Need resize (e.g. 2000–2400px long edge) + WebP.

## 3. Tooling
- zola 0.23.6; node v26.12.1; vercel CLI 65.4.0
- `vercel whoami` → **Logged out**. `.vercel/project.json` **absent** (not linked locally).
- sips: /usr/bin/sips ✓; cwebp: /opt/homebrew/bin/cwebp ✓; ImageMagick (`magick`/`convert`): **not installed**.

## 4. Git
Branch `rewrite` (checked out), also `main`, remote `origin/main`. Working tree clean. HEAD 617b157 "chore: add rewrite plan, council agents, and gitignore" (on top of 85874e1 "fix apk").

## 5. Gaps vs M0 checklist
- Teardown not done: pages, styles, scripts, public/fonts, next/theme config, package.json, yarn.lock still present. Kept assets (public/images/*, apk, favicon.ico) need `git mv` into `static/`. Caution: `/public/` is gitignored, so after moving, Zola build output lands in an ignored dir — fine; but ensure `git mv` (not copy) so tracked legacy files leave the index.
- **Decision override**: PLAN says do teardown "on main in one rewrite commit"; decisions.md says all work on `rewrite`, main untouched, commit per milestone, never push / never `--prod`.
- No config.toml, content/, templates/, static/, vercel.json. README is Nextra boilerplate → replace.
- base.html layer stack: not started.
- Vercel "builds from main… confirm simonas-dev.vercel.app serves new site": **blocked/conflicts** — CLI logged out, project not linked, and decision forbids touching main/prod. At most: write vercel.json (Zola install + `zola build`, output `public`) and verify local `zola build`; preview deploy needs owner login. Escalate.
- Content migration: about (index.mdx), photos (resize first; cwebp/sips available), post → `content/posts/ballistic-wizard.md` (fix date format; consider `aliases = ["/posts/wizard"]`), `/feed.xml` via `generate_feeds = true`, `feed_filenames = ["feed.xml"]` (Zola 0.23 syntax), `base_url` choice (domain decision open; vercel.app likely). `/photos` URL preserved if page path `/photos/`. Tags dropped.
- Open: home vs about — PLAN wants both home (`_index.md`) and `about.md`; old `/` was About.
