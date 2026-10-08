# Rojaco

A static site that lets a retail pharmacy publish its licence, appointed pharmacist, licensed
premises and weekly stock listing on a public page — formatted to print cleanly on A4 for
inspection.

Built for UP FSDA order `FS/SD/A/O/2026-27/3208`, which requires every retail pharmacy to maintain
a public website with these details from **1 November 2026**.

## Local development

```bash
npm run dev            # http://localhost:3000
npm run dev -- --port 8080 --open
```

`server.js` is a zero-dependency static server with live reload:

- editing `.html`, `.js` or `.json` reloads the page
- editing `.css` hot-swaps the stylesheet without losing scroll position
- `private/`, `node_modules/`, `.git/` and dotfiles are never served
- if the port is busy it walks forward to the next free one

No install step — there are no dependencies.

## Structure

```
index.html                     home page and store directory
stores/<slug>/index.html       per-store listing (a thin shell; data comes from JSON)
data/stores.json               the only file you edit to update a listing
styles.css                     design system, incl. theming and print styles
lib.js                         shared data loading, date and status helpers
theme.js                       light/dark toggle
main.js                        home page: directory + search
store.js                       store page: renders a listing from stores.json
server.js                      dev server with live reload
private/                       source scans and reference docs — gitignored, never served
```

## Theming

The header has a light/dark toggle. It defaults to the visitor's OS setting and keeps following it
until they pick a theme explicitly, at which point the choice is stored in `localStorage` under
`rojaco-theme`.

Every light/dark difference lives in the two token blocks at the top of `styles.css` — `:root` and
`:root[data-theme="dark"]` — so components never branch on theme. A small inline script in each
page's `<head>` applies the theme before first paint to avoid a flash. Printing is always forced to
black on white, whichever theme is on screen.

## Updating a listing

Edit the store's `items` array in `data/stores.json`, bump `last_updated`, then commit and push.
Both the directory card and the store page read from that file, so they can never disagree.

```json
{
  "slug": "radhey-medicals",
  "name": "Radhey Medicals",
  "address": "B-2 First Floor, Surya Medicine Market, Latouche Road, Lucknow",
  "premises": "B-2 First Floor, Surya Medicine Market, Latouche Road, Lucknow, Uttar Pradesh",
  "license": "XYZ123",
  "gstin": "09ADVPA7406Q1ZT",
  "pharmacist": { "name": "Example Pharmacist", "registration": "UPSPC/00000" },
  "phones": ["0522-4230735", "9161740152"],
  "email": "owner@example.com",
  "last_updated": "2026-10-07",
  "items": [
    { "name": "PAN 40", "company": "Alkem (Pan)", "pack": "20*10", "quantity": 4928, "unit": "PCS" }
  ]
}
```

### Item columns are data-driven

The stock table renders only the columns the data actually has, so a store that tracks batch and
expiry gets those columns and one that doesn't isn't left with a table of dashes. Recognised item
fields, in display order:

`name`, `company`, `brand`, `pack`, `batch`, `mfg`, `expiry`, `quantity`, `mrp`, `remarks`

`name` is always shown. `unit` is kept in the data but not rendered — it carries no information
when almost every row is the same value.

Derived badges:

- **freshness** (always) — `Up to date`, `Update due` (over 7 days) or `Update overdue`
  (over 14 days), reflecting the weekly update requirement
- **expiry** (only when items carry `expiry`) — `Expired`, `Expiring soon` (within 5 months)
  or `Valid`

## Adding a store

1. Add an object to `stores` in `data/stores.json`.
2. Copy `stores/radhey-medicals/` to `stores/<your-slug>/`.
3. Change `data-slug` on the `<body>` tag to match. Nothing else in that file needs editing.

## Hosting

Plain static HTML/CSS/JS with no build step — `npm` is only used to run the local dev server, so
GitHub Pages can serve the repository as-is for free.

One caveat: Pages on a **public** repo makes the whole repository public too — including this
README and `server.js`. If the delivery details should stay private, either run Pages from a
private repo (requires a paid GitHub plan) or publish only the site files to Pages from a private
repo via a GitHub Actions workflow.

`private/` is gitignored, so the reference scans never reach the repository or the published site
either way.

## Notes

- Item quantities published here are deliberately offset from the source stock report.
- The store page needs JavaScript, since the listing is rendered from `stores.json` at runtime.
- `license` and `pharmacist` are still placeholders — the stock report does not contain them.
