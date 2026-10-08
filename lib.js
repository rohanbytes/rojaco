/**
 * Shared helpers for the Rojaco pages.
 *
 * Paths are resolved against this module's own URL so the same code works from
 * the site root (index.html) and from a nested store page (stores/<slug>/).
 */

const DATA_URL = new URL('data/stores.json', import.meta.url);

/** Cache the fetch so a page can ask for the data more than once. */
let dataPromise = null;

export function loadStores() {
  dataPromise ??= fetch(DATA_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    })
    .then((json) => (Array.isArray(json?.stores) ? json.stores : []))
    .catch((error) => {
      dataPromise = null;
      throw error;
    });

  return dataPromise;
}

export const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );

/** "2026-10-08" → "8 Oct 2026"; "2027-04" → "Apr 2027". Unparseable input passes through. */
export function formatDate(value) {
  if (!value) return '—';
  const [, year, month, day] = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(value).trim()) ?? [];
  if (!year) return String(value);

  const date = new Date(Number(year), Number(month) - 1, Number(day ?? 1));
  return new Intl.DateTimeFormat('en-IN', {
    ...(day ? { day: 'numeric' } : {}),
    month: 'short',
    year: 'numeric',
  }).format(date);
}

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/** Whole days between a YYYY-MM-DD string and today. Negative means in the past. */
export function daysFromToday(value) {
  const [, year, month, day] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim()) ?? [];
  if (!year) return null;
  const target = new Date(Number(year), Number(month) - 1, Number(day));
  return Math.round((target - startOfToday()) / 86_400_000);
}

/**
 * Expiry state for a stock row. Batches expire at the end of their stated
 * month, so "2026-10" is still valid throughout October 2026.
 */
export function expiryStatus(value) {
  const [, year, month] = /^(\d{4})-(\d{2})/.exec(String(value ?? '').trim()) ?? [];
  if (!year) return { tone: 'neutral', label: 'Unknown' };

  const today = startOfToday();
  const monthsAway =
    (Number(year) - today.getFullYear()) * 12 + (Number(month) - 1 - today.getMonth());

  if (monthsAway < 0) return { tone: 'bad', label: 'Expired' };
  if (monthsAway <= 5) return { tone: 'warn', label: 'Expiring soon' };
  return { tone: 'ok', label: 'Valid' };
}

/**
 * The order requires weekly updates, so flag listings that have gone stale.
 */
export function freshness(lastUpdated) {
  const days = daysFromToday(lastUpdated);
  if (days === null) return { tone: 'neutral', label: 'Not dated' };
  const age = -days;
  if (age > 14) return { tone: 'bad', label: 'Update overdue' };
  if (age > 7) return { tone: 'warn', label: 'Update due' };
  return { tone: 'ok', label: 'Up to date' };
}

/** "Radhey Medicals" → "RM" */
export const initials = (name) =>
  String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

export const pill = ({ tone, label }) => `<span class="pill pill-${tone}">${escapeHtml(label)}</span>`;
