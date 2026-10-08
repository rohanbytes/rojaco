/**
 * Store listing page.
 *
 * The page is a thin shell: it declares `data-slug` on <body> and everything
 * below is rendered from data/stores.json, so the listing can never drift from
 * the source data. Adding a store = copy this folder, change the slug.
 *
 * Columns are chosen from the data rather than hardcoded — a store that tracks
 * batch and expiry gets those columns, one that only tracks pack and quantity
 * does not end up with a table full of dashes.
 */

import { loadStores, escapeHtml, formatDate, expiryStatus, freshness, pill } from './lib.js';

const slug = document.body.dataset.slug;
const $ = (id) => document.getElementById(id);

const esc = (value) => escapeHtml(value ?? '');
const qty = (value) => (Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-IN') : esc(value));

const COLUMNS = [
  {
    id: 'name',
    label: 'Item',
    always: true,
    cell: (item) => {
      const sub = [item.form, item.strength].filter(Boolean).join(' · ');
      return `<span class="cell-item">${esc(item.name)}${sub ? `<span class="cell-sub">${esc(sub)}</span>` : ''}</span>`;
    },
  },
  { id: 'company', label: 'Company', cell: (i) => esc(i.company) },
  { id: 'brand', label: 'Brand / Manufacturer', cell: (i) => esc(i.brand) },
  { id: 'pack', label: 'Pack', cell: (i) => esc(i.pack) },
  { id: 'batch', label: 'Batch', cell: (i) => esc(i.batch) },
  { id: 'mfg', label: 'Mfg', cell: (i) => esc(formatDate(i.mfg)) },
  { id: 'expiry', label: 'Expiry', cell: (i) => esc(formatDate(i.expiry)) },
  { id: 'expiry', label: 'Status', cell: (i) => pill(expiryStatus(i.expiry)) },
  { id: 'quantity', label: 'Qty', num: true, cell: (i) => qty(i.quantity) },
  { id: 'mrp', label: 'MRP', num: true, cell: (i) => esc(i.mrp) },
  { id: 'remarks', label: 'Remarks', cell: (i) => esc(i.remarks) },
];

const hasValue = (items, key) =>
  items.some((item) => item[key] !== undefined && item[key] !== null && String(item[key]).trim() !== '');

const metaRow = (label, value, wide = false) =>
  value ? `<div${wide ? ' class="meta-wide"' : ''}><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>` : '';

let state = { items: [], columns: [], query: '' };

function renderRows() {
  const { items, columns, query } = state;
  const visible = query
    ? items.filter((item) => {
        const hay = `${item.name} ${item.company ?? ''} ${item.brand ?? ''} ${item.pack ?? ''} ${item.batch ?? ''}`.toLowerCase();
        return query.split(/\s+/).every((term) => hay.includes(term));
      })
    : items;

  $('stock-body').innerHTML = visible.length
    ? visible
        .map(
          (item) =>
            `<tr>${columns.map((c) => `<td${c.num ? ' class="num"' : ''}>${c.cell(item)}</td>`).join('')}</tr>`,
        )
        .join('')
    : `<tr><td colspan="${columns.length}" style="text-align:center;padding:2.5rem;color:var(--muted)">No item matches “${esc(
        query,
      )}”.</td></tr>`;

  const units = visible.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  $('stock-total').textContent = query
    ? `${visible.length.toLocaleString('en-IN')} of ${items.length.toLocaleString('en-IN')} items · ${units.toLocaleString('en-IN')} units shown`
    : `${items.length.toLocaleString('en-IN')} items · ${units.toLocaleString('en-IN')} units in stock`;

  updateScrollHint();
}

function render(store) {
  const items = store.items ?? [];
  const columns = COLUMNS.filter((column) => column.always || hasValue(items, column.id));

  state = { items, columns, query: '' };
  document.title = `${store.name} — stock listing | Rojaco`;

  $('store-name').textContent = store.name;
  $('store-address').textContent = store.premises || store.address;
  $('crumb-store').textContent = store.name;
  $('store-freshness').innerHTML = pill(freshness(store.last_updated));
  $('store-updated').innerHTML = `Stock as on <time datetime="${esc(store.last_updated)}">${esc(
    formatDate(store.last_updated),
  )}</time>`;

  $('store-meta').innerHTML = [
    metaRow('Drug licence no.', store.license),
    metaRow('GSTIN', store.gstin),
    metaRow('Appointed pharmacist', store.pharmacist?.name),
    metaRow('Pharmacist registration', store.pharmacist?.registration),
    metaRow('Phone', (store.phones ?? [store.contact]).filter(Boolean).join(' · ')),
    metaRow('Email', store.email, true),
  ].join('');

  $('stock-head').innerHTML = `<tr>${columns
    .map((c) => `<th scope="col"${c.num ? ' class="num"' : ''}>${esc(c.label)}</th>`)
    .join('')}</tr>`;
  $('stock-foot').innerHTML = `<tr><td colspan="${columns.length}" id="stock-total">—</td></tr>`;

  // Keep the table readable: narrower listings should not force a scrollbar.
  $('table-scroll').style.setProperty('--stock-min-width', `${Math.max(480, columns.length * 120)}px`);

  $('stock-summary').textContent = `${items.length.toLocaleString('en-IN')} item${
    items.length === 1 ? '' : 's'
  } across ${new Set(items.map((i) => i.company).filter(Boolean)).size || 1} suppliers`;

  $('declared-by').textContent = store.pharmacist?.name || store.name;
  $('doc-ready').hidden = false;

  renderRows();
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
      ${esc(message)}
      <p style="margin-top:1rem"><a href="../../">← Back to all stores</a></p>
    </div>`;
}

loadStores()
  .then((stores) => {
    const store = stores.find((candidate) => candidate.slug === slug);
    if (!store) throw new Error(`No store published under “${slug}”.`);
    render(store);
  })
  .catch((error) => {
    console.error('Failed to render store listing', error);
    showError(error.message);
  });

let timer;
$('item-search')?.addEventListener('input', (event) => {
  const query = event.target.value.trim().toLowerCase();
  clearTimeout(timer);
  timer = setTimeout(() => {
    state.query = query;
    renderRows();
  }, 120);
});

$('print-btn')?.addEventListener('click', () => window.print());
