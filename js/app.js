import { state, subscribe, commit } from './store.js';
import { ui, setRenderer } from './ui.js';
import { icon, esc, guessIcon } from './util.js';
import { applyTheme } from './theme.js';
import { dayProgress, overallRate, activeWorkout, latest, status, setStatus } from './logic.js';
import { paint as paintRest, restActions } from './rest.js';
import { VERSION } from './version.js';
import { sync, initSync, onSyncChange } from './sync.js';
import { categoryActions } from './categories.js';
import * as today from './views/today.js';
import * as habits from './views/habits.js';
import * as goals from './views/goals.js';
import * as gym from './views/gym.js';
import * as body from './views/body.js';
import * as settings from './views/settings.js';
import * as stats from './views/stats.js';

const ROUTES = { today, habits, goals, gym, body, stats, settings };
const actions = { ...restActions, ...categoryActions, openMenu, closeMenu };
for (const v of Object.values(ROUTES)) Object.assign(actions, v.actions);

const $view = document.getElementById('view');
const $side = document.getElementById('sidebar');
const $tabs = document.getElementById('tabbar');
const $backdrop = document.getElementById('backdrop');

function routeFromHash() {
  const r = (location.hash.replace(/^#\/?/, '').split('/')[0]) || 'today';
  return ROUTES[r] ? r : 'today';
}

function renderSidebar() {
  const r = ui.route;
  const cur = (k) => (r === k ? 'aria-current="page"' : '');
  const p = dayProgress(ui.selDay);
  const rate = overallRate(30);
  const w = latest('weight');
  const aw = activeWorkout();
  const name = state.profile.name || 'Ритм';
  $side.innerHTML = `
    <div class="row" style="padding:0 6px">
      <span class="avatar" aria-hidden="true">${esc(name.slice(0, 1).toUpperCase())}</span>
      <div class="grow stack" style="gap:2px"><span style="font-weight:700;font-size:16px">${esc(name)}</span><span class="small muted">версия ${VERSION}${syncBadge()}</span></div>
      <button class="icon-btn close-drawer" data-action="closeMenu" aria-label="Закрыть меню" style="background:var(--bg);border:0">${icon('close', 18)}</button>
    </div>
    <nav aria-label="Меню приложения" class="stack" style="gap:2px">
      <a class="menu-item" href="#/today" ${cur('today')}>${icon('home')}<span class="grow">Сегодня</span><span class="small" style="opacity:.7">${p.done}/${p.total}</span></a>
      <a class="menu-item" href="#/habits" ${cur('habits')}>${icon('habits')}<span class="grow">Привычки</span><span class="small" style="opacity:.7">${rate == null ? '' : Math.round(rate * 100) + '%'}</span></a>
      <a class="menu-item" href="#/goals" ${cur('goals')}>${icon('goals')}<span class="grow">Цели и задачи</span></a>
      <div class="menu-chips">${[['year', 'Год'], ['month', 'Месяц'], ['week', 'Неделя'], ['day', 'День']].map(([k, n]) => `<a href="#/goals" data-action="goHorizon" data-h="${k}">${n}</a>`).join('')}</div>
      <div class="menu-item" style="cursor:default">${icon('gym')}<span class="grow">Зал и фитнес</span></div>
      <a class="menu-item menu-sub" href="#/gym" ${cur('gym')}><span class="grow">Тренировки</span><span class="small" style="opacity:.7">${aw ? 'идёт' : ''}</span></a>
      <a class="menu-item menu-sub" href="#/body" ${cur('body')}><span class="grow">Тело и вес</span><span class="small" style="opacity:.7">${w ? String(w.weight).replace('.', ',') + ' кг' : ''}</span></a>
      <a class="menu-item" href="#/stats" ${cur('stats')}>${icon('stats')}<span class="grow">Статистика</span></a>
    </nav>
    <div class="stack" style="margin-top:auto;gap:10px">
      <a class="menu-item" href="#/settings" ${cur('settings')} style="${r === 'settings' ? '' : 'background:var(--bg)'};height:52px">${icon('settings')}<span class="grow" style="font-weight:600">Настройки</span>${icon('next', 16)}</a>
    </div>`;
}

function syncBadge() {
  if (!sync.user) return '';
  return { synced: ' · в облаке', syncing: ' · сохраняю…', offline: ' · нет сети', error: ' · ошибка облака' }[sync.status] || '';
}

function renderTabs() {
  const r = ui.route;
  const tab = (k, ic, label, match = [k]) => `<a class="tab" href="#/${k}" aria-label="${label}" ${match.includes(r) ? 'aria-current="page"' : ''}>${icon(ic, 22)}</a>`;
  $tabs.innerHTML = tab('today', 'home', 'Сегодня') + tab('habits', 'habits', 'Привычки') + tab('goals', 'goals', 'Цели') + tab('gym', 'gym', 'Зал', ['gym', 'body']);
}

function render() {
  ui.route = routeFromHash();
  const view = ROUTES[ui.route];
  const scrollY = window.scrollY;
  const focusId = document.activeElement?.id;
  $view.innerHTML = view.render();
  renderSidebar();
  renderTabs();
  paintRest();
  if (focusId && document.getElementById(focusId) && document.activeElement === document.body) document.getElementById(focusId).focus({ preventScroll: true });
  window.scrollTo(0, scrollY);
}

function openMenu() {
  $side.classList.add('open');
  $backdrop.hidden = false;
  $side.querySelector('a,button')?.focus();
}
function closeMenu() {
  $side.classList.remove('open');
  $backdrop.hidden = true;
}
actions.goHorizon = (el) => { ui.goalsHorizon = el.dataset.h; closeMenu(); if (location.hash === '#/goals') render(); };

// ---------- события: одно делегирование на весь документ ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) {
    if (e.target.closest('#sidebar a')) closeMenu();
    return;
  }
  const fn = actions[el.dataset.action];
  if (!fn) return;
  if (el.tagName !== 'A') e.preventDefault();
  fn(el, e);
});
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-submit]');
  if (!form) return;
  e.preventDefault();
  actions[form.dataset.submit]?.(form, e);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el) actions[el.dataset.change]?.(el, e);
});
document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (d.dataset?.toggle) ui[d.dataset.toggle] = d.open;
}, true);
$backdrop.addEventListener('click', closeMenu);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $side.classList.contains('open')) closeMenu(); });

window.addEventListener('hashchange', () => { closeMenu(); render(); window.scrollTo(0, 0); $view.focus({ preventScroll: true }); });

// Привычкам из прошлых версий подбираем иконку по названию.
if (state.habits.some((h) => !h.icon)) commit((s) => s.habits.forEach((h) => { if (!h.icon) h.icon = guessIcon(h.name); }), { render: false });

setRenderer(render);
subscribe(render);
applyTheme();
render();
setInterval(gym.tickElapsed, 1000);

// Облако: при смене статуса перерисовываем, но не мешаем вводу текста.
onSyncChange(() => {
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { renderSidebar(); return; }
  render();
});
initSync();

// Новый день, пока приложение открыто: обновить «сегодня».
document.addEventListener('visibilitychange', () => { if (!document.hidden) commit(() => {}); });

// ---------- привычки: тап / двойной тап / удержание ----------
let lastTap = null;
let lp = { timer: null, fired: false, x: 0, y: 0, el: null };
const applyHabit = (id, day, st) => commit((s) => setStatus(s, id, day, st));
const partialToggle = (id, day, from) => applyHabit(id, day, from === 'partial' ? null : 'partial');

actions.habitTap = (el) => {
  if (lp.fired) { lp.fired = false; return; }
  const { id, day } = el.dataset;
  const key = id + '|' + day;
  const now = Date.now();
  if (lastTap && lastTap.key === key && now - lastTap.t < 350) {
    // второй тап подряд: от исходного состояния — «частично»
    partialToggle(id, day, lastTap.prev);
    lastTap = null;
    navigator.vibrate?.(20);
    return;
  }
  const cur = status(id, day);
  lastTap = { key, t: now, prev: cur };
  applyHabit(id, day, cur === 'done' ? null : 'done');
};
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-action="habitTap"]');
  if (!el || e.button !== 0) return;
  lp = { timer: null, fired: false, x: e.clientX, y: e.clientY, el };
  el.classList.add('pressing');
  const { id, day } = el.dataset;
  const before = status(id, day);
  lp.timer = setTimeout(() => {
    lp.fired = true;
    navigator.vibrate?.(30);
    partialToggle(id, day, before);
  }, 450);
});
const cancelLp = () => { clearTimeout(lp.timer); lp.el?.classList.remove('pressing'); };
document.addEventListener('pointerup', cancelLp);
document.addEventListener('pointercancel', () => { cancelLp(); lp.fired = false; });
document.addEventListener('pointermove', (e) => { if (lp.timer && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) cancelLp(); });
document.addEventListener('contextmenu', (e) => {
  const el = e.target.closest('[data-action="habitTap"]');
  if (!el) return;
  e.preventDefault();
  if (lp.fired || e.pointerType === 'touch') return; // на телефоне это уже сделало удержание
  partialToggle(el.dataset.id, el.dataset.day, status(el.dataset.id, el.dataset.day));
});

// ---------- потянуть вниз — обновить ----------
const ptr = document.createElement('div');
ptr.className = 'ptr';
ptr.setAttribute('aria-hidden', 'true');
ptr.innerHTML = icon('refresh', 20);
document.body.appendChild(ptr);
let pull = { y0: null, d: 0 };
const PULL_MAX = 110, PULL_GO = 70;
function ptrReset() { ptr.style.transition = 'transform .2s, opacity .2s'; ptr.style.transform = ''; ptr.style.opacity = ''; pull = { y0: null, d: 0 }; }
document.addEventListener('touchstart', (e) => {
  if (window.scrollY > 0 || $side.classList.contains('open') || e.touches.length > 1 || e.target.closest('input,select,textarea,.chips,[data-sortable]')) { pull.y0 = null; return; }
  pull = { y0: e.touches[0].clientY, d: 0 };
  ptr.style.transition = 'none';
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (pull.y0 == null) return;
  const dy = e.touches[0].clientY - pull.y0;
  if (dy <= 0 || window.scrollY > 0) { ptr.style.transform = ''; ptr.style.opacity = ''; pull.d = 0; return; }
  pull.d = Math.min(PULL_MAX, dy * 0.5);
  ptr.style.transform = `translateY(${pull.d - 20}px) rotate(${pull.d * 4}deg)`;
  ptr.style.opacity = String(Math.min(1, pull.d / PULL_GO));
}, { passive: true });
document.addEventListener('touchend', async () => {
  if (pull.y0 == null) return;
  if (pull.d >= PULL_GO) {
    ptr.style.transition = 'transform .2s';
    ptr.style.transform = 'translateY(50px)';
    ptr.classList.add('spin');
    navigator.vibrate?.(15);
    try { const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update(); } catch (e) { /* офлайн */ }
    setTimeout(() => location.reload(), 300);
    return;
  }
  ptrReset();
});

// Просим браузер не удалять данные при нехватке места.
navigator.storage?.persist?.().catch(() => {});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Запрет масштабирования щипком в Safari на iPhone (user-scalable=no он игнорирует).
['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
