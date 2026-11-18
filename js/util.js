// Общие помощники: даты, форматирование, иконки, экранирование.
import { today } from './store.js';
export { today };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function parseDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(key, n) {
  const d = parseDate(key);
  d.setDate(d.getDate() + n);
  return today(d);
}
export function weekStart(key) {
  const d = parseDate(key);
  const wd = (d.getDay() + 6) % 7; // пн = 0
  d.setDate(d.getDate() - wd);
  return today(d);
}
export function weekDays(key) {
  const s = weekStart(key);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}
export function isoWeek(key) {
  const d = parseDate(key);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return { year: t.getUTCFullYear(), week: w };
}

// Ключ периода для целей: год / месяц / неделя / день.
export function periodKey(horizon, dayKey) {
  if (horizon === 'year') return dayKey.slice(0, 4);
  if (horizon === 'month') return dayKey.slice(0, 7);
  if (horizon === 'week') { const w = isoWeek(dayKey); return `${w.year}-W${String(w.week).padStart(2, '0')}`; }
  return dayKey;
}
export function shiftDay(horizon, dayKey, dir) {
  const d = parseDate(dayKey);
  if (horizon === 'year') d.setFullYear(d.getFullYear() + dir);
  else if (horizon === 'month') { d.setDate(1); d.setMonth(d.getMonth() + dir); }
  else if (horizon === 'week') d.setDate(d.getDate() + 7 * dir);
  else d.setDate(d.getDate() + dir);
  return today(d);
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WD = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
export const WD_SHORT = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];

export function fmtLongDate(key) {
  const d = parseDate(key);
  return `${WD[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function fmtShortDate(key) {
  const d = parseDate(key);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}
export function periodTitle(horizon, dayKey) {
  const d = parseDate(dayKey);
  if (horizon === 'year') return `${d.getFullYear()} год`;
  if (horizon === 'month') return `${MONTHS_NOM[d.getMonth()]} ${d.getFullYear()}`;
  if (horizon === 'week') {
    const days = weekDays(dayKey);
    const w = isoWeek(dayKey);
    return `Неделя ${w.week} · ${fmtShortDate(days[0])} – ${fmtShortDate(days[6])}`;
  }
  return fmtLongDate(dayKey);
}

export const num = (v, dec = 1) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(dec).replace('.', ','));
// Вес снаряда: 80 → «80», 82.5 → «82,5».
export const kg = (v) => (v == null ? '—' : String(Math.round(v * 100) / 100).replace('.', ','));
export const parseNum = (s) => {
  if (s == null || s === '') return null;
  const v = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};
export function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
export function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const z = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${z(m)}:${z(r)}` : `${z(m)}:${z(r)}`;
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

const P = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  habits: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  goals: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  gym: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="m9 6 6 6-6 6"/>',
  play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" stroke="none"/>',
  flame: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.5 3 2.5 3-1-3 0-6 0-8z"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M9 21h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  link: '<path d="M7 17 17 7M9 7h8v8"/>',
  scale: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 9a5 5 0 0 1 8 0l-3 3"/>',
  widgets: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="18" height="8" rx="2"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M4 4h16"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  minus: '<path d="M5 12h14"/>'
};
export function icon(name, size = 20, extra = '') {
  const sw = name === 'check' ? 'stroke-width="3"' : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" ${P} ${sw} ${extra}>${ICONS[name] || ''}</svg>`;
}

export function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

export function download(name, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function ring(pct, size = 52, stroke = 6, color = 'var(--accent)', label = '') {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = `${(c * Math.max(0, Math.min(1, pct))).toFixed(1)} ${c.toFixed(1)}`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${dash}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}
