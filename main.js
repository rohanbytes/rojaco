/** Homepage: store directory with search. */

import { loadStores, escapeHtml, formatDate, freshness, initials, pill } from './lib.js';

const grid = document.getElementById('store-grid');
const status = document.getElementById('search-status');
const search = document.getElementById('search');

const ARROW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

function storeCard(store, index) {
  const itemCount = store.items?.length ?? 0;

  return `
    <article class="store-card" style="animation-delay:${Math.min(index, 8) * 45}ms">
      <div class="store-card-top">
        <span class="store-avatar" aria-hidden="true">${escapeHtml(initials(store.name))}</span>
        ${pill(freshness(store.last_updated))}
      </div>

      <h3><a href="stores/${encodeURIComponent(store.slug)}/">${escapeHtml(store.name)}</a></h3>
      <p class="store-address">${escapeHtml(store.address)}</p>

      <dl class="store-facts">
        <div><dt>Licence</dt><dd>${escapeHtml(store.license)}</dd></div>
        <div><dt>Items listed</dt><dd>${itemCount.toLocaleString('en-IN')}</dd></div>
        <div><dt>Last updated</dt><dd>${escapeHtml(formatDate(store.last_updated))}</dd></div>
      </dl>

      <div class="store-card-foot">
        <span class="muted" style="font-size:.8rem">${escapeHtml(store.contact ?? '')}</span>
        <span class="view-link">View listing ${ARROW}</span>
      </div>
    </article>`;
}

const ctaCard = `
  <article class="store-card is-cta">
    <span class="plus" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
    </span>
    <h3>List your pharmacy</h3>
    <p class="store-address">Send us your shop details and your current stock list — we'll put your listing live and keep it updated.</p>
    <div class="store-card-foot">
      <a class="view-link" href="#contact">Get started ${ARROW}</a>
    </div>
  </article>`;

/** Built once per store — rebuilding it per keystroke is slow on large listings. */
const haystacks = new WeakMap();

function haystack(store) {
  let value = haystacks.get(store);
  if (value === undefined) {
    value = [store.name, store.address, store.premises, store.license, store.gstin, store.pharmacist?.name]
      .concat((store.items ?? []).flatMap((item) => [item.name, item.company, item.brand, item.batch]))
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    haystacks.set(store, value);
  }
  return value;
}

function matches(store, query) {
  if (!query) return true;
  const hay = haystack(store);
  return query.split(/\s+/).every((term) => hay.includes(term));
}

function render(stores, query = '') {
  const visible = stores.filter((store) => matches(store, query));
  grid.setAttribute('aria-busy', 'false');

  if (!visible.length) {
    grid.innerHTML = `
      <div class="state">
        <strong>No match for “${escapeHtml(query)}”</strong>
        Try a store name, a licence number, or a medicine you're looking for.
      </div>`;
    status.textContent = `No stores match “${query}”.`;
    return;
  }

  grid.innerHTML = visible.map(storeCard).join('') + (query ? '' : ctaCard);
  status.textContent = query
    ? `Showing ${visible.length} of ${stores.length} store${stores.length === 1 ? '' : 's'} for “${query}”.`
    : `${stores.length} store${stores.length === 1 ? '' : 's'} published.`;
}

async function init() {
  try {
    const stores = await loadStores();

    if (!stores.length) {
      grid.setAttribute('aria-busy', 'false');
      grid.innerHTML = `<div class="state"><strong>No stores published yet</strong>Listings will appear here as pharmacies are onboarded.</div>`;
      return;
    }

    render(stores);

    let timer;
    search.addEventListener('input', (event) => {
      const query = event.target.value.trim().toLowerCase();
      clearTimeout(timer);
      timer = setTimeout(() => render(stores, query), 120);
    });
  } catch (error) {
    console.error('Failed to load store data', error);
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML = `
      <div class="state">
        <strong>Couldn't load the store directory</strong>
        Please refresh the page. If this keeps happening, get in touch and we'll sort it out.
      </div>`;
  }
}

// Header gets a hairline border once the page scrolls away from the top.
const header = document.getElementById('site-header');
if (header) {
  const sentinel = document.createElement('div');
  document.body.prepend(sentinel);
  new IntersectionObserver(([entry]) => header.classList.toggle('is-stuck', !entry.isIntersecting)).observe(sentinel);
}

init();
