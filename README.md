# simonas-dev

Personal website of Simonas Sankauskas — a static site built with
[Zola](https://www.getzola.org). See `PLAN.md` for the roadmap.

## Requirements

- Zola **0.23.6** (`brew install zola`, or a release binary from GitHub)

## Develop

```sh
zola serve   # http://127.0.0.1:1111, live reload
zola build   # writes the site to public/ (ignored by git)
zola check   # build + check external links
```

Content lives in `content/` (Markdown), templates in `templates/`, and static
assets (images, favicon, APK, `styles.css`) in `static/`. The RSS feed is
generated at `/feed.xml` from `templates/feed.xml`.

## Deploy

Hosted on Vercel. `vercel.json` downloads the pinned Zola 0.23.6 Linux binary,
runs `./zola build`, and serves `public/`. It also holds 301 redirects for old
URLs (`/posts/wizard`, `/tags/*`). Keep the Zola version in `vercel.json` in
sync with the one used locally.
