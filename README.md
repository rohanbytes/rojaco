# Rojaco — MVP static site

This repository is a minimal MVP for Rojaco: a static site that publishes retail medical store stock listings in a government-friendly, printable format.

Hosting
- This is plain static HTML/CSS/JS and can be hosted on GitHub Pages. Push to a repository and enable Pages from the `main` branch (root)

Structure
- index.html — home page and store directory
- styles.css — site styles (Tailwind not used; simple handcrafted CSS for MVP)
- main.js — client-side script that loads data/stores.json and renders store cards
- data/stores.json — store data (Radhey Medicals sample)
- stores/<slug>/index.html — per-store page(s)

How to update a store
- Edit `data/stores.json` and update the store's `items` array. Commit and push; the site will update on GitHub Pages.

Next steps (optional)
- Convert to Eleventy / Next.js for templated generation
- Add GitHub Actions to build and deploy automatically
- Add CSV import / Google Sheets sync

