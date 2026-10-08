/**
 * Store listing page.
 *
 * The page is a thin shell: it declares `data-slug` on <body> and every value
 * below is rendered from data/stores.json, so the listing can never drift from
 * the source data. Adding a store = copy this folder, change the slug.
 */

import { loadStores, escapeHtml, formatDate, expiryStatus, freshness, pill } from './lib.js';

const slug = document.body.dataset.slug;

const $ = (id) => document.getElementById(id);

function metaRow(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || '—')}</dd></div>`;
}

function stockRow(item) {
  const status = expiryStatus(item.expiry);
  const strength = [item.form, item.strength].filter(Boolean).join(' · ');

  return `
    <tr>
      <td class="cell-item">
        ${escapeHtml(item.name)}
        ${strength ? `<span class="cell-sub">${escapeHtml(strength)}</span>` : ''}
      </td>
      <td>${escapeHtml(item.brand)}</td>
      <td>${escapeHtml(item.batch)}</td>
      <td>${escapeHtml(formatDate(item.mfg))}</td>
      <td>${escapeHtml(formatDate(item.expiry))}</td>
      <td>${pill(status)}</td>
      <td class="num">${escapeHtml(item.quantity)}</td>
      <td class="num">${escapeHtml(item.mrp)}</td>
      <td>${escapeHtml(item.remarks)}</td>
    </tr>`;
}

function render(store) {
  const items = store.items ?? [];
  const totalUnits = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  document.title = `${store.name} — stock listing | Rojaco`;

  $('store-name').textContent = store.name;
  $('store-address').textContent = store.premises || store.address;
  $('crumb-store').textContent = store.name;
  $('store-freshness').innerHTML = pill(freshness(store.last_updated));
  $('store-updated').innerHTML = `Last updated <time datetime="${escapeHtml(store.last_updated)}">${escapeHtml(
    formatDate(store.last_updated),
  )}</time>`;

  $('store-meta').innerHTML = [
    metaRow('Drug licence no.', store.license),
    metaRow('Appointed pharmacist', store.pharmacist?.name),
    metaRow('Pharmacist registration', store.pharmacist?.registration),
    metaRow('Contact', store.contact),
  ].join('');

  $('stock-body').innerHTML = items.length
    ? items.map(stockRow).join('')
    : `<tr><td colspan="9" style="text-align:center;padding:2.5rem;color:var(--muted)">No items listed for this period.</td></tr>`;

  $('stock-summary').textContent = `${items.length} item${items.length === 1 ? '' : 's'} · ${totalUnits} unit${
    totalUnits === 1 ? '' : 's'
  } in stock`;

  $('stock-total').textContent = `${totalUnits} units across ${items.length} item${items.length === 1 ? '' : 's'}`;
  $('declared-by').textContent = store.pharmacist?.name || store.name;
  $('doc-ready').hidden = false;
  updateScrollHint();
}

/** Only advertise horizontal scrolling when the table actually overflows. */
function updateScrollHint() {
  const scroller = $('table-scroll');
  const hint = $('scroll-hint');
  if (!scroller || !hint) return;
  hint.hidden = scroller.scrollWidth <= scroller.clientWidth;
}

window.addEventListener('resize', updateScrollHint);

function showError(message) {
  $('doc-ready').hidden = false;
  document.querySelector('.doc').innerHTML = `
    <div class="state" style="border:0;margin:1rem">
      <strong>Listing unavailable</strong>
      ${escapeHtml(message)}
      <p style="margin-top:1rem"><a href="../../">← Back to all stores</a></p>
    </div>`;
}

loadStores()
  .then((stores) => {
    const store = stores.find((candidate) => candidate.slug === slug);
    if (!store) throw new Error(`No store with slug “${slug}” in data/stores.json.`);
    render(store);
  })
  .catch((error) => {
    console.error('Failed to render store listing', error);
    showError(error.message);
  });

$('print-btn')?.addEventListener('click', () => window.print());
