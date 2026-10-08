/**
 * Light/dark switching.
 *
 * The initial theme is applied by a tiny inline script in <head> so the page
 * never flashes the wrong colours. This module only wires up the button and
 * remembers the choice.
 *
 * Stored value is 'light', 'dark', or absent — absent means "follow the OS",
 * which stays live via the matchMedia listener below.
 */

const STORAGE_KEY = 'rojaco-theme';

const systemQuery = window.matchMedia?.('(prefers-color-scheme: dark)');

const stored = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
};

const systemTheme = () => (systemQuery?.matches ? 'dark' : 'light');

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  const button = document.getElementById('theme-toggle');
  if (!button) return;
  const next = theme === 'dark' ? 'light' : 'dark';
  button.setAttribute('aria-label', `Switch to ${next} theme`);
  button.setAttribute('title', `Switch to ${next} theme`);
  button.setAttribute('aria-pressed', String(theme === 'dark'));
}

apply(stored() ?? systemTheme());

// Only track the OS while the visitor hasn't made an explicit choice.
systemQuery?.addEventListener('change', () => {
  if (!stored()) apply(systemTheme());
});

document.getElementById('theme-toggle')?.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* private mode — the choice just won't persist */
  }
  apply(next);
});
