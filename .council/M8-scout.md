# M8 Scout: Content edits

## Files Retrieved
1. `PLAN.md` (lines 206-238): the M8 checklist. Older references to the post and About page are at lines 10, 20-28, 54-62 and 87.
2. `.council/decisions.md` (owner rows): the hero, post and About page are to be removed. Horizon stays at 38.2% (`HORIZON` in ocean.js plus the CSS var).
3. `content/_index.md`: holds the `# Simonas Sankauskas` heading and the line "Senior Software Engineer, Android."
4. `templates/index.html` (lines 1-7): `<section class="hero">{{ section.content }}</section>`.
5. `static/styles.css`: lines 72 (`--hero-gap`), 74-76 (`--scene-horizon-from-bottom` 38.2vh/dvh fallback) and 210-245 (`.hero`, `.hero > *`, `.hero p`, and the `@media (max-height:30rem)` block). That media block also sets `--page-pad-block` in `:root`, which is not hero-only, so check it before deleting the block.
6. `static/ocean.js`: line 32 `var HORIZON = 0.382;` and line 304 in `onResize`, which sets `--scene-horizon-from-bottom`.
7. `templates/base.html` (lines 9-17 meta/og, 36-60 nav/footer).
8. `static/site.js`: lines 127-140 (ripples), 143-150 (`markCurrentNav`), 198 (comment mentioning ".apk").
9. `templates/section.html`, `post.html`, `feed.xml`, `internal/alias.html`, `components/post_meta.html`.
10. `config.toml`, `vercel.json`, `README.md:26`, `.vercelignore`.
11. `.pi/prompts/milestone.md:101-102` and `.pi/agents/council-skeptic.md:16`: the curl key-URL lists include `/about/` and `/posts/ballistic-wizard/`.

## (1) Hero and `--scene-horizon-from-bottom`
- The hero text lives only in `content/_index.md` and in `index.html` (`.hero`). The `.hero` styles are in styles.css 210-245, plus `--hero-gap` at line 72.
- **`--scene-horizon-from-bottom`** is set by the styles.css fallback (lines 75-76) and by ocean.js:304.
- **Its only consumer is `.hero` padding-bottom** (styles.css:218). It is not used by the header scrim (`body:has(.content-surface)::before`, ~line 302), the footer scrim (footer.chrome, ~line 290), the ripples (site.js:130, which compute from the canvas rect) or the shader.
- With the hero gone, the var can be dropped from both the CSS and ocean.js:304. Removing line 304 also saves bytes against the ocean.js budget (11,264 B). `HORIZON` stays: it is a decision-recorded literal. Check whether ocean.js uses it anywhere besides line 304; if not, keep it as a documentation const or remove it, but the council should confirm.
- **There is no visually-hidden / sr-only class in styles.css yet.** M8 needs one for the hidden home `<h1>`.
- The home page has no `.content-surface`. Ripples and the transparent scrim rely on that, so the new home markup must not add `.content-surface`.
- `<title>` comes from base.html. The description meta is `config.description` ("…Senior Software Engineer, Android."), which stays.

## (2) Ballistic Wizard references
- Post: `content/posts/ballistic-wizard.md`. It has `aliases=["/posts/wizard"]`, the img `/images/baller-wizard.jpg`, the apk link, and GitHub links to the ballistic-wizard and wizard-gun-firmware repos.
- Assets: `static/images/baller-wizard.jpg` and `static/ballistic-wizard-1.0.0.apk`. Nothing else references them (grep of templates, static and content). `og.jpg` is a separate file and is unrelated.
- `vercel.json:9-13`: `/posts/wizard` → `/posts/ballistic-wizard/` 301.
- `README.md:26` mentions `/posts/wizard`.
- PLAN.md lines 21, 24, 28, 58 and 87 are historical.
- `site.js:198` is a comment mentioning ".apk". The download-exclusion logic it describes is generic, so it can stay; only the comment wording needs updating.
- `.pi/prompts/milestone.md:102` and `council-skeptic.md:16` list the old URLs.
- `processed_images` exists in `static/`. Check whether it contains a derived wizard image (it is generated output).

## (3) About and social links
- `content/about.md` holds the GitHub, Instagram and LinkedIn links.
- `base.html:39` and `:46` hold the About nav links.
- `config.toml:15-17` has `[link_checker] skip_prefixes=["https://www.linkedin.com/"]`. LinkedIn appears nowhere else, so the entry can be dropped.
- The only other GitHub link is in the wizard post, which is also being deleted. The Newsreader font licence URL in `static/fonts` and the Zola download URL in `vercel.json` are unaffected.
- **No `/about/` redirect exists yet** in `vercel.json`.

## (4) Nav
- `base.html:36-50`: `path = current_path`. `nav.nav-inline` (header) and `details.menu > nav.menu-panel` (mobile) each list About, Posts and Photos, with server-side `aria-current` set on exact path match.
- `site.js:143-150` `markCurrentNav()` re-marks `header.chrome nav a` by pathname after htmx swaps. It is generic and needs no change.
- Footer (`base.html:57-60`): ©, an RSS link to `/feed.xml` (`hx-boost=false`) and the theme toggle. It does not link to nav items.
- After M8 the nav has only Photos (plus video from M7, if M7 has landed; there is no video page on this branch now).
- Decide whether the mobile `<details>` menu with a single item is still worthwhile.

## (5) Posts and feed
- `content/posts/_index.md` sets `sort_by=date` and `page_template=post.html`. It has no `extra` or noindex.
- `section.html` always renders `<ul class="post-list">`. **There is no empty-state branch and no noindex hook**: base.html has no `{% block robots %}` or meta-robots block, so one has to be added.
- `config.toml` has `generate_feeds=true`, `feed_filenames=["feed.xml"]` and a custom `templates/feed.xml`, which is RSS 2.0 at the root.
- **Experiment** (copy in /tmp/m8x, post removed, zola 0.23.6):
  - Build: OK, "2 pages (0 orphan) and 1 sections"; `zola check` passes.
  - `feed.xml` is valid (`xmllint` OK): `<channel>` with title, link, description, generator, language and atom:link, and zero `<item>` elements. `lastBuildDate` is omitted because `last_updated` is undefined, which is still valid RSS.
  - `/posts/index.html` renders `<h1>Posts</h1>` and an empty `<ul class="post-list">`.
  - The sitemap lists `/`, `/about/`, `/photos/` and `/posts/`. `/posts/` stays in the sitemap unless the section gets `render`/`in_search_index` changes or a template override.
  - `robots.txt` is Zola's default (Allow all + Sitemap).

## (6) Test scripts
- **No m3check..m6check scripts exist in the repo**, and none are found outside it with `find -maxdepth 3`. Earlier milestones checked ad hoc: `/tmp` has only logs and dirs (`m2check.log`, `m4`, `m6`, `m6a-*`).
- The "test procedure" is in `.pi/prompts/milestone.md:101-102`: `zola check`, then `zola serve` with curl of `/`, `/about/`, `/photos/`, `/posts/ballistic-wizard/` and `/feed.xml`, plus JS sizes. Both the About and post entries depend on removed content and need updating.
- The `.pi/runs/` orchestrator files (`agents.py`, `follow.py`) are not tests.

## (7) Vercel, sitemap, robots
- `vercel.json`: `trailingSlash:true`. Redirects: `/posts/wizard` → `/posts/ballistic-wizard/`, and `/tags/:path*/` and `/tags/:path*` → `/posts/`.
- Needed: drop or replace the wizard redirect; add `/posts/wizard` and `/posts/ballistic-wizard/` → `/` (both slash variants, per the decisions note on trailingSlash); add `/about/` → `/` (both slash variants).
- **Risk:** `/tags/*` → `/posts/` now lands on an empty page, so consider retargeting it to `/`.
- No sitemap or robots templates exist; Zola generates both.

## (8) Tool versions
- Local: zola 0.23.6 (`/opt/homebrew`), node v26.12.1.
- Vercel: zola 0.23.6 musl; the project's Node setting is 24.x (unused).

## Gaps vs the M8 checklist
- Not started: every item is open, and no partial edits are present.
- Missing pieces: a visually-hidden utility class, a noindex hook in base.html, a `section.html` empty-state branch, and `/about/` plus old-post redirects.
- Nav lists in base.html are duplicated across the header and the mobile menu, so both need editing.
- The milestone.md curl list is stale.

## Start Here
Open `templates/base.html` first, then `static/styles.css:205-245` and `vercel.json`.
