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
styles.css                     design system, incl. dark mode and print styles
lib.js                         shared data loading, date and status helpers
main.js                        home page: directory + search
store.js                       store page: renders a listing from stores.json
server.js                      dev server with live reload
private/                       source scans and reference docs — gitignored, never served
```

## Updating a listing

Edit the store's `items` array in `data/stores.json`, bump `last_updated`, then commit and push.
Both the directory card and the store page read from that file, so they can never disagree.

```json
{
  "slug": "radhey-medicals",
  "name": "Radhey Medicals",
  "address": "123 Main Road, Example City, State",
  "premises": "123 Main Road, Example City, State — 226001",
  "license": "XYZ123",
  "pharmacist": { "name": "Example Pharmacist", "registration": "UPSPC/00000" },
  "contact": "+91 98765 43210",
  "last_updated": "2026-10-08",
  "items": [
    {
      "name": "Paracetamol",
      "brand": "ACME Pharma",
      "form": "Tablet",
      "strength": "500 mg",
      "batch": "B321",
      "mfg": "2025-04",
      "expiry": "2027-04",
      "quantity": 120,
      "mrp": "₹60",
      "remarks": "OTC"
    }
  ]
}
```

Status badges are derived, not stored:

- **expiry** — `Expired`, `Expiring soon` (within 5 months) or `Valid`
- **freshness** — `Up to date`, `Update due` (over 7 days) or `Update overdue` (over 14 days),
  reflecting the weekly update requirement

## Adding a store

1. Add an object to `stores` in `data/stores.json`.
2. Copy `stores/radhey-medicals/` to `stores/<your-slug>/`.
3. Change `data-slug` on the `<body>` tag to match. Nothing else in that file needs editing.

## Hosting

Plain static HTML/CSS/JS — push to GitHub and enable Pages on `main` (root). `private/` is
gitignored, so reference scans never reach the repository or the published site.

## Notes

- Sample data is fictional and for demonstration only.
- The store page needs JavaScript, since the listing is rendered from `stores.json` at runtime.
