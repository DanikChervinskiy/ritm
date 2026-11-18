import { state } from './store.js';

const mq = window.matchMedia('(prefers-color-scheme: dark)');

export function applyTheme() {
  const t = state.settings.theme;
  const dark = t === 'dark' || (t === 'auto' && mq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.setProperty('--accent', state.settings.accent || '#E8613C');
  const meta = document.querySelectorAll('meta[name="theme-color"]');
  meta.forEach((m) => m.setAttribute('content', dark ? '#0E0E0D' : '#F2F2EF'));
}
mq.addEventListener?.('change', applyTheme);
