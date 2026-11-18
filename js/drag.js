// Перетаскивание строк списка: зажать строку (или потянуть за ручку ≡) и отпустить на нужном месте.
// Разметка:
//   контейнер  [data-sortable="имя"]
//   строка     [data-sort-item="ключ"]
//   ручка      [data-sort-handle] внутри строки (тянется сразу, без ожидания)
//   заголовок  [data-sort-head="группа"] — строка под заголовком попадает в эту группу
// Когда отпустили, вызывается обработчик onSort(имя, [{ key, group }, …]) в новом порядке.

const handlers = {};
export function onSort(name, fn) { handlers[name] = fn; }

const LONG = 300;   // мс удержания, чтобы начать тащить строку
const SLOP = 8;     // px — если палец сдвинулся раньше, это прокрутка, а не перетаскивание
let d = null;       // текущее перетаскивание
let lp = null;      // ожидание долгого нажатия

const mid = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
const kidsOf = (box) => [...box.children].filter((k) => k.matches('[data-sort-item],[data-sort-head]'));

export const isDragging = () => !!d;

function begin(row, y) {
  const box = row.closest('[data-sortable]');
  if (!box) return;
  d = { box, row, y, raf: 0 };
  row.classList.add('dragging');
  box.classList.add('sorting');
  document.documentElement.classList.add('sorting-now');
  navigator.vibrate?.(12);
  const tick = () => {
    if (!d) return;
    const bottom = window.innerHeight - (window.innerWidth < 1000 ? 110 : 40);
    if (d.y < 70) window.scrollBy(0, -10);
    else if (d.y > bottom) window.scrollBy(0, 10);
    place();
    d.raf = requestAnimationFrame(tick);
  };
  d.raf = requestAnimationFrame(tick);
}

// Двигаем строку в DOM, пока палец не окажется между соседями.
function place() {
  const { box, row, y } = d;
  for (let guard = 0; guard < 200; guard++) {
    const kids = kidsOf(box);
    const i = kids.indexOf(row);
    const prev = kids[i - 1], next = kids[i + 1];
    // Выше первого заголовка группы строку не ставим.
    if (prev && y < mid(prev) && !(prev.matches('[data-sort-head]') && i - 1 === 0)) box.insertBefore(row, prev);
    else if (next && y > mid(next)) box.insertBefore(row, next.nextSibling);
    else break;
  }
}

function finish() {
  if (!d) return;
  const { box, row, raf } = d;
  cancelAnimationFrame(raf);
  d = null;
  row.classList.remove('dragging');
  box.classList.remove('sorting');
  document.documentElement.classList.remove('sorting-now');
  report(box);
}

function report(box) {
  let group = '';
  const out = [];
  for (const k of kidsOf(box)) {
    if (k.matches('[data-sort-head]')) group = k.dataset.sortHead;
    else out.push({ key: k.dataset.sortItem, group });
  }
  handlers[box.dataset.sortable]?.(out);
}

function cancelLp() { if (lp) { clearTimeout(lp.timer); lp = null; } }

const blocked = (t) => t.closest('button:not([data-sort-handle]),input,select,textarea,a,label');

// Ручка: мышь и палец — сразу.
document.addEventListener('pointerdown', (e) => {
  const h = e.target.closest('[data-sort-handle]');
  if (h && e.button === 0) {
    const row = h.closest('[data-sort-item]');
    if (!row) return;
    e.preventDefault();
    try { h.setPointerCapture(e.pointerId); } catch (err) { /* не важно */ }
    begin(row, e.clientY);
    return;
  }
  // Мышь: долгое нажатие на строку.
  if (e.pointerType === 'mouse' && e.button === 0) {
    const row = e.target.closest('[data-sortable] [data-sort-item]');
    if (!row || blocked(e.target)) return;
    lp = { x: e.clientX, y: e.clientY, timer: setTimeout(() => { lp = null; begin(row, e.clientY); }, LONG) };
  }
});
document.addEventListener('pointermove', (e) => {
  if (d && e.pointerType !== 'touch') { d.y = e.clientY; e.preventDefault(); return; }
  if (lp && e.pointerType === 'mouse' && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > SLOP) cancelLp();
});
document.addEventListener('pointerup', (e) => { cancelLp(); if (d && e.pointerType !== 'touch') finish(); });
document.addEventListener('pointercancel', (e) => { cancelLp(); if (d && e.pointerType !== 'touch') finish(); });

// Палец: долгое нажатие на строку, дальше страница не прокручивается, пока тащим.
document.addEventListener('touchstart', (e) => {
  if (e.touches.length > 1) { cancelLp(); return; }
  const t = e.touches[0];
  const row = e.target.closest('[data-sortable] [data-sort-item]');
  if (!row || e.target.closest('[data-sort-handle]') || blocked(e.target)) return;
  lp = { x: t.clientX, y: t.clientY, timer: setTimeout(() => { const y = lp?.cy ?? t.clientY; lp = null; begin(row, y); }, LONG) };
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  if (d) { e.preventDefault(); d.y = t.clientY; return; }
  if (lp) { lp.cy = t.clientY; if (Math.hypot(t.clientX - lp.x, t.clientY - lp.y) > SLOP) cancelLp(); }
}, { passive: false });
document.addEventListener('touchend', () => { cancelLp(); if (d) finish(); });
document.addEventListener('touchcancel', () => { cancelLp(); if (d) finish(); });
// После перетаскивания на iPhone не показываем меню «Скопировать…».
document.addEventListener('contextmenu', (e) => { if (d || e.target.closest('[data-sortable] [data-sort-item]')) e.preventDefault(); });

// Клавиатура: ручка в фокусе, стрелки ↑ ↓ двигают строку.
document.addEventListener('keydown', (e) => {
  const h = e.target.closest?.('[data-sort-handle]');
  if (!h || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
  const row = h.closest('[data-sort-item]');
  const box = row?.closest('[data-sortable]');
  if (!box) return;
  e.preventDefault();
  const kids = kidsOf(box);
  const i = kids.indexOf(row);
  if (e.key === 'ArrowUp' && i > 0 && !(kids[i - 1].matches('[data-sort-head]') && i - 1 === 0)) box.insertBefore(row, kids[i - 1]);
  else if (e.key === 'ArrowDown' && i < kids.length - 1) box.insertBefore(row, kids[i + 1].nextSibling);
  else return;
  const key = row.dataset.sortItem;
  report(box);
  requestAnimationFrame(() => document.querySelector(`[data-sortable="${box.dataset.sortable}"] [data-sort-item="${key}"] [data-sort-handle]`)?.focus());
});
