# UI requirements

Binding UI rules for this site, set by the owner. Every template and stylesheet
change must follow them. Change a rule only with the owner's approval, and
record the change in `.council/decisions.md`.

Each rule has an ID (`UI-n`), so commits, reviews and checks can refer to it.

---

## UI-1 — Touch targets are at least 44×44 CSS px

Every interactive element must have a hit area of **at least 44×44 CSS px** on
touch devices. This covers links, buttons, `<summary>`, form controls and
custom controls.

- What counts is the hit area, not the visible glyph. You can grow it with
  padding (cancelled by negative margin, as `a` already does), `min-block-size`
  / `min-inline-size`, or a `::before` overlay. None of these may shift the
  layout.
- Scope: `@media (pointer: coarse)` must meet 44px. Fine-pointer (mouse)
  layouts may use smaller targets but should not go below 24×24 (WCAG 2.2
  SC 2.5.8).
- Hit areas of neighbouring targets must not overlap. If they would, add
  spacing.
- Exception: inline links inside running text (paragraphs, lists) are exempt,
  as WCAG allows. Standalone links are not exempt. That includes the logo,
  nav, menu, footer, buttons, cards and pagination.

Check: in DevTools with touch emulation on, every standalone interactive
element's box (including padding) is ≥ 44×44.

## UI-2 — All interactive links are underlined at rest

Every hyperlink (`<a href>`) is underlined at rest, not only on hover or focus.

- This covers the logo, header and nav links, menu links, footer links and
  links in content.
- The underline weight is fixed at **1px**. Hover, focus, visited and
  current-page (`aria-current`) states must not change its thickness, offset or
  colour, or remove it. Hover feedback is the faint background wash.
- No extra current-page marker (glyph, wash or weight). In the header, the
  current page is shown only by its centre position (UI-3). Never mark it by
  removing the underline.
- Never put `text-decoration: none` on an `<a>`. The base rule lives on `a` in
  `static/styles.css`.
- Buttons and `<summary>` are not links and are not underlined. They still need
  a visible affordance that makes them read as controls.

Check: `rg -n 'text-decoration:\s*none' static/` returns no rule that applies
to `a`. Every `<a>` is underlined at rest in both themes.

## UI-3 — Folder-style header: parent · current · children

Navigation follows the site's URL hierarchy, like folders. Each page is a node
in a tree rooted at `simonas.dev/`:

```
/                        ~/            (root)
└── /digital-sun/        Digital Sun
    └── /digital-sun/001-plan/   001 Plan   (future)
```

The header has three fixed regions. They are the same on every page and at
every width, and each shows one level of that tree:

| Region | Shows | Link target |
| --- | --- | --- |
| **Left: parent** | The name of the node one level **up** | The parent's URL. Empty on the root. |
| **Centre: current** | The name of the node you are **on** | Itself (`aria-current="page"`) |
| **Right: children** | The names of the nodes one level **down**, as a list | Each child's URL. Empty on a leaf. |

Worked example:

| Page | Left | Centre | Right |
| --- | --- | --- | --- |
| `/` | (empty) | `~/` | `Digital Sun` |
| `/digital-sun/` | `~/` | `Digital Sun` | `001 Plan` (once it exists) |
| `/digital-sun/001-plan/` | `Digital Sun` | `001 Plan` | (empty) |

Rules:

- **Parent, not history.** The left link always goes to the hierarchical parent,
  whichever way the visitor arrived. It is not a "Back" button: it isn't
  labelled "Back" or "←", and it never calls `history.back()`. It is labelled
  with the parent's name, so the header reads as a path. The browser's back
  button handles history.
- **Names.** A node's name is its page/section `title`. The root's name is `~/`.
  The same node has the same name in every region.
- **All three regions are links** and follow UI-1 (44px targets) and UI-2
  (underlined). The centre link is the current-page cue, shown by its position.
- **No menus.** Children are always visible as a list. Never collapse them
  behind a hamburger, `<details>`, "Menu" button or popover, at any width. When
  they don't fit on one line, the list stacks vertically (one per line,
  right-aligned) and the header grows taller. Items are never truncated or
  hidden.
- **Derived, not hand-kept.** The tree comes from Zola's content structure
  (`section.subsections`, `section.pages`, `page.ancestors`/`section.ancestors`).
  Adding a page to a folder adds it to that folder's right region and gives it
  the folder as its left region. Only direct children are listed, never
  grandchildren. A page or section opts out of its parent's right region
  with `[extra] nav = false` in its front matter (e.g. `/posts/`). The
  page itself still has the normal header.

Check: for the root, a section and a leaf page, the header matches the worked
example pattern (left = parent, centre = self, right = direct children). At
320px wide, all children are visible without opening anything.
