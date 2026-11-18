import { state, commit, uid } from '../store.js';
import { ui, header } from '../ui.js';
import { today, addDays, weekStart, weekDays, esc, icon, fmtLongDate, plural } from '../util.js';
import { isChecked, toggleCheck, streak, bestStreak, rate, overallRate } from '../logic.js';

const WEEKS = 15;

export function render() {
  const habits = state.habits.filter((h) => !h.archived);
  if (!ui.habitSel || !habits.find((h) => h.id === ui.habitSel)) ui.habitSel = habits[0]?.id || null;
  const sel = habits.find((h) => h.id === ui.habitSel);
  const t = today();

  const r30 = overallRate(30);
  const rPrev = overallRate(30, 30);
  const best = habits.reduce((m, h) => Math.max(m, bestStreak(h.id)), 0);
  const delta = r30 != null && rPrev != null ? Math.round((r30 - rPrev) * 100) : null;

  let heat = '';
  if (sel) {
    const start = addDays(weekStart(t), -7 * (WEEKS - 1));
    const cells = [];
    for (let i = 0; i < WEEKS * 7; i++) {
      const d = addDays(start, i);
      const future = d > t;
      const on = !future && isChecked(sel.id, d);
      cells.push(future
        ? `<button class="future" disabled aria-hidden="true" tabindex="-1"></button>`
        : `<button class="${on ? 'on' : ''}${d === t ? ' today' : ''}" data-action="heatToggle" data-day="${d}" aria-pressed="${on}" aria-label="${fmtLongDate(d)}${on ? ', выполнено' : ''}"></button>`);
    }
    heat = `<div class="heat" style="grid-template-columns:repeat(${WEEKS},minmax(0,1fr))">${cells.join('')}</div>`;
  }

  const chips = habits.map((h) => `<button class="chip" data-action="pickHabit" data-id="${h.id}" aria-pressed="${h.id === ui.habitSel}">${esc(h.name)}</button>`).join('');
  const wd = weekDays(t);
  const rows = habits.map((h) => {
    const dots = wd.map((d) => `<i class="${isChecked(h.id, d) ? 'on' : d > t ? 'future' : ''}"></i>`).join('');
    const s = streak(h.id);
    return `<div class="list-row">
      <div class="grow stack" style="gap:1px"><span class="ellipsis" style="font-weight:600">${esc(h.name)}</span>
        <span class="small muted">${s ? `серия ${s} ${plural(s, 'день', 'дня', 'дней')}` : 'нет серии'} · ${h.perWeek < 7 ? h.perWeek + '× в неделю' : 'каждый день'}</span></div>
      <div class="dots" aria-label="Эта неделя">${dots}</div>
      <span style="width:40px;text-align:right;font-weight:600;font-size:13px">${Math.round(rate(h.id) * 100)}%</span>
      <button class="icon-btn" style="width:36px;height:36px;border:0;background:transparent" data-action="editHabit" data-id="${h.id}" aria-label="Изменить: ${esc(h.name)}">${icon('next', 16)}</button>
    </div>`;
  }).join('');

  const edit = state.habits.find((h) => h.id === ui.habitEdit);
  const editForm = edit ? `
    <form class="card" data-submit="saveHabit" aria-label="Изменить привычку">
      <div class="row between"><h2>Привычка</h2><button type="button" class="icon-btn" data-action="closeEdit" aria-label="Закрыть">${icon('close', 18)}</button></div>
      <label class="field"><span>Название</span><input class="input" name="name" value="${esc(edit.name)}" required></label>
      <label class="field"><span>Сколько раз в неделю</span>
        <select class="input" name="perWeek">${[7, 6, 5, 4, 3, 2, 1].map((n) => `<option value="${n}" ${n === edit.perWeek ? 'selected' : ''}>${n === 7 ? 'Каждый день' : n + ' ' + plural(n, 'раз', 'раза', 'раз')}</option>`).join('')}</select></label>
      <div class="row"><button class="btn grow">Сохранить</button><button type="button" class="btn danger" data-action="deleteHabit" data-id="${edit.id}">${icon('trash', 16)}Удалить</button></div>
    </form>` : '';

  return `
  ${header('Привычки', 'Статистика', `<button class="icon-btn round ink" data-action="focusNewHabit" aria-label="Добавить привычку">${icon('plus')}</button>`)}
  <div class="grid3">
    <div class="card" style="gap:2px;padding:14px 12px"><span class="big">${r30 == null ? '—' : Math.round(r30 * 100) + '%'}</span><span class="small muted">за 30 дней</span></div>
    <div class="card" style="gap:2px;padding:14px 12px"><span class="big row" style="gap:4px">${best}<span style="color:var(--accent)">${icon('flame', 16)}</span></span><span class="small muted">лучшая серия</span></div>
    <div class="card" style="gap:2px;padding:14px 12px"><span class="big">${delta == null ? '—' : (delta > 0 ? '+' : '') + delta + '%'}</span><span class="small muted">к прошлым 30 дням</span></div>
  </div>
  ${editForm}
  <div class="grid-desk">
    ${sel ? `<section class="card" aria-label="Карта выполнения">
      <div class="chips">${chips}</div>
      <div class="row between"><span style="font-weight:600">${esc(sel.name)}</span><span class="small muted">${Math.round(rate(sel.id, WEEKS * 7) * 100)}% · можно отмечать прошлые дни</span></div>
      ${heat}
      <div class="row between small muted mono"><span>${WEEKS} недель назад</span><span>сегодня</span></div>
    </section>` : ''}
    <section class="card" aria-label="Все привычки" style="gap:0">
      <div class="row between" style="padding-bottom:6px"><span class="label">Эта неделя</span><span class="mono small muted">П В С Ч П С В</span></div>
      ${rows || '<div class="empty">Добавь первую привычку ниже</div>'}
      <form class="addbar" data-submit="addHabit" style="background:var(--card-2);margin-top:8px">
        <label class="sr-only" for="newHabit">Новая привычка</label>
        <input id="newHabit" name="name" placeholder="Новая привычка…" autocomplete="off">
        <button class="icon-btn round ink" aria-label="Добавить привычку" style="width:36px;height:36px">${icon('plus', 16)}</button>
      </form>
    </section>
  </div>`;
}

export const actions = {
  pickHabit(el) { ui.habitSel = el.dataset.id; commit(() => {}); },
  heatToggle(el) { commit((s) => toggleCheck(s, ui.habitSel, el.dataset.day)); },
  focusNewHabit() { document.getElementById('newHabit')?.focus(); },
  addHabit(form) {
    const name = form.name.value.trim();
    if (!name) return;
    const id = uid();
    commit((s) => s.habits.push({ id, name, perWeek: 7, created: today() }));
    ui.habitSel = id;
    requestAnimationFrame(() => document.getElementById('newHabit')?.focus());
  },
  editHabit(el) { ui.habitEdit = el.dataset.id; commit(() => {}); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  closeEdit() { ui.habitEdit = null; commit(() => {}); },
  saveHabit(form) {
    const name = form.name.value.trim();
    if (!name) return;
    commit((s) => { const h = s.habits.find((x) => x.id === ui.habitEdit); if (h) { h.name = name; h.perWeek = Number(form.perWeek.value); } });
    ui.habitEdit = null; commit(() => {});
  },
  deleteHabit(el) {
    const h = state.habits.find((x) => x.id === el.dataset.id);
    if (!h || !confirm(`Удалить привычку «${h.name}» вместе с историей?`)) return;
    ui.habitEdit = null;
    commit((s) => {
      s.habits = s.habits.filter((x) => x.id !== h.id);
      for (const d of Object.keys(s.checks)) { s.checks[d] = s.checks[d].filter((id) => id !== h.id); if (!s.checks[d].length) delete s.checks[d]; }
    });
  }
};
