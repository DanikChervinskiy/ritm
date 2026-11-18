import { state, commit, uid } from '../store.js';
import { ui, header, checkBtn } from '../ui.js';
import { today, periodKey, periodTitle, shiftDay, esc, icon, parseNum, plural, parseDate, weekDays, fmtShortDate, toast } from '../util.js';
import { renderGrouped, categorySelect, categoryManager } from '../categories.js';
import { goalsFor, goalProgress, isGoalDone, HORIZONS, parentOptions, REPEAT_TEXT, seriesOf } from '../logic.js';

// Границы календарного периода: весь год, весь месяц, неделя пн–вс, день.
function bounds(hz, day) {
  const d = parseDate(day);
  const y = d.getFullYear(), m = d.getMonth();
  if (hz === 'year') return [new Date(y, 0, 1), new Date(y, 11, 31)];
  if (hz === 'month') return [new Date(y, m, 1), new Date(y, m + 1, 0)];
  if (hz === 'week') { const w = weekDays(day); return [parseDate(w[0]), parseDate(w[6])]; }
  return [d, d];
}
function timeInfo(hz, day) {
  const [a, b] = bounds(hz, day);
  const now = parseDate(today());
  const fmt = (x) => fmtShortDate(today(x));
  const span = hz === 'day' ? '' : `${fmt(a)} – ${fmt(b)} ${b.getFullYear()}`;
  let pct;
  if (now > b) pct = 1; else if (now < a) pct = 0;
  else pct = ((now - a) / 864e5 + 1) / ((b - a) / 864e5 + 1);
  const left = Math.max(0, Math.round((b - now) / 864e5));
  const note = now > b ? 'период завершён' : now < a ? 'ещё не начался' : hz === 'day' ? 'сегодня' : `прошло ${Math.round(pct * 100)}% · осталось ${left} ${plural(left, 'день', 'дня', 'дней')}`;
  return { span, note, pct };
}

export function render() {
  const hz = ui.goalsHorizon;
  const day = ui.goalsDay;
  const items = goalsFor(hz, day).sort((a, b) => Number(isGoalDone(a)) - Number(isGoalDone(b)) || a.created - b.created);
  const avg = items.length ? items.reduce((a, g) => a + goalProgress(g), 0) / items.length : 0;
  const doneN = items.filter(isGoalDone).length;
  const isCurrent = periodKey(hz, day) === periodKey(hz, today());
  const tinfo = timeInfo(hz, day);

  const tabs = HORIZONS.map((h) => `<button role="tab" aria-selected="${h.id === hz}" data-action="goalsTab" data-h="${h.id}">${h.name}</button>`).join('');

  const rows = renderGrouped(items, 'goal', (g) => {
    const done = isGoalDone(g);
    const parent = g.parentId ? state.goals.find((x) => x.id === g.parentId) : null;
    const children = state.goals.filter((x) => x.parentId === g.id).length;
    const linkText = parent ? `→ ${esc(parent.title)}` : children ? `${children} ${plural(children, 'подзадача', 'подзадачи', 'подзадач')}` : '';
    const rep = `<button type="button" class="rep-chip" data-action="goalRepeat" data-id="${g.id}" aria-pressed="${!!g.repeat}" aria-label="${g.repeat ? 'Повторяется ' + REPEAT_TEXT[g.horizon] + '. Нажми, чтобы сделать одноразовой' : 'Одноразовая. Нажми, чтобы повторять ' + REPEAT_TEXT[g.horizon]}">${icon('refresh', 12)}${g.repeat ? REPEAT_TEXT[g.horizon] : 'один раз'}</button>`;
    const right = g.target
      ? `<div class="row" style="gap:4px">
          <button class="icon-btn" style="width:36px;height:36px" data-action="goalStep" data-id="${g.id}" data-d="-1" aria-label="Минус один">${icon('minus', 16)}</button>
          <button class="icon-btn ink" style="width:36px;height:36px" data-action="goalStep" data-id="${g.id}" data-d="1" aria-label="Плюс один">${icon('plus', 16)}</button></div>`
      : '';
    return `<div class="card" style="padding:12px 14px;gap:6px">
      <div class="row" style="gap:10px">
        ${g.target ? '' : checkBtn(done, 'goalToggle', { id: g.id }, (done ? 'Снять отметку: ' : 'Выполнено: ') + g.title, true)}
        <div class="grow stack" style="gap:6px">
          <div class="row between" style="align-items:baseline;gap:8px">
            <button type="button" class="plain-btn ${done && !g.target ? 'done-text' : ''}" style="font-weight:600" data-action="goalEdit" data-id="${g.id}" aria-label="Изменить: ${esc(g.title)}">${esc(g.title)}</button>
            ${g.target ? `<span class="small muted" style="white-space:nowrap">${g.current || 0} / ${g.target}</span>` : ''}
          </div>
          ${g.target ? `<div class="bar"><i style="width:${Math.round(goalProgress(g) * 100)}%"></i></div>` : ''}
          <div class="row" style="gap:8px;flex-wrap:wrap">${rep}${linkText ? `<span class="small muted row" style="gap:4px">${parent ? icon('link', 12) : ''}${linkText}</span>` : ''}</div>
        </div>
        ${right}
        <button class="icon-btn" style="width:36px;height:36px;border:0;background:transparent" data-action="goalDelete" data-id="${g.id}" aria-label="Удалить: ${esc(g.title)}">${icon('trash', 16)}</button>
      </div>
    </div>`;
  });

  const edit = state.goals.find((g) => g.id === ui.goalEdit);
  const editForm = edit ? `
  <form class="card" data-submit="goalSave" aria-label="Изменить цель">
    <div class="row between"><h2>${edit.horizon === 'day' || edit.horizon === 'week' ? 'Задача' : 'Цель'}</h2><button type="button" class="icon-btn" data-action="goalEditClose" aria-label="Закрыть">${icon('close', 18)}</button></div>
    <label class="field"><span>Название</span><input class="input" name="title" value="${esc(edit.title)}" required autocomplete="off"></label>
    <div class="grid2">
      <label class="field"><span>Категория</span>${categorySelect('goal', edit.categoryId || '')}</label>
      <label class="field"><span>Цель в числах (необязательно)</span><input class="input" name="target" inputmode="numeric" value="${edit.target || ''}" placeholder="без числа"></label>
    </div>
    <div class="list-row" style="border:0;padding:0;min-height:44px"><div class="grow stack" style="gap:1px"><span style="font-weight:500">Повторять ${REPEAT_TEXT[edit.horizon]}</span><span class="small muted">выполнил — в следующем периоде появится снова</span></div>
      <button type="button" class="switch" role="switch" aria-checked="${!!edit.repeat}" aria-label="Повторять ${REPEAT_TEXT[edit.horizon]}" data-action="goalRepeat" data-id="${edit.id}"><span></span></button></div>
    <button class="btn">Сохранить</button>
  </form>` : '';

  const parents = parentOptions(hz, day);
  const parentName = HORIZONS.find((h) => h.id === HORIZONS.find((x) => x.id === hz).parent)?.name.toLowerCase();
  const ph = { year: 'Цель на год…', month: 'Цель на месяц…', week: 'Задача на неделю…', day: 'Задача на день…' }[hz];

  return `
  ${header('Цели', periodTitle(hz, day))}
  <div class="seg" role="tablist" aria-label="Горизонт">${tabs}</div>
  <div class="row between">
    <button class="icon-btn" data-action="goalsShift" data-d="-1" aria-label="Предыдущий период">${icon('back', 18)}</button>
    <button class="btn light sm" data-action="goalsNow" ${isCurrent ? 'disabled style="opacity:.5"' : ''}>Текущий период</button>
    <button class="icon-btn" data-action="goalsShift" data-d="1" aria-label="Следующий период">${icon('next', 18)}</button>
  </div>
  <div class="stack" style="gap:6px;padding:0 4px">
    <div class="row between small"><span class="muted">${tinfo.span}</span><span class="muted">${tinfo.note}</span></div>
    <div class="bar" style="height:4px" aria-hidden="true"><i style="width:${Math.round(tinfo.pct * 100)}%;background:var(--muted)"></i></div>
  </div>
  ${editForm}
  <section class="card ink" aria-label="Итог периода">
    <div class="row between"><span class="label">${HORIZONS.find((h) => h.id === hz).name}: прогресс</span><span class="small muted">${doneN} из ${items.length} готово</span></div>
    <span class="huge">${Math.round(avg * 100)}%</span>
    <div class="bar"><i style="width:${Math.round(avg * 100)}%"></i></div>
  </section>
  <div class="stack">${rows || '<div class="empty">Здесь пока пусто</div>'}</div>
  <form class="card" data-submit="goalAdd" aria-label="Добавить">
    <label class="sr-only" for="goalTitle">Название</label>
    <div class="addbar" style="background:var(--card-2);padding-left:12px">
      <input id="goalTitle" name="title" placeholder="${ph}" autocomplete="off" required>
      <button class="icon-btn round ink" aria-label="Добавить" style="width:36px;height:36px">${icon('plus', 16)}</button>
    </div>
    <label class="field"><span>Категория</span>${categorySelect('goal', ui.goalNewCat || '')}</label>
    <div class="list-row" style="border:0;padding:0;min-height:44px"><div class="grow stack" style="gap:1px"><span style="font-weight:500">Повторять ${REPEAT_TEXT[hz]}</span><span class="small muted">${ui.goalNewRepeat ? 'выполнил — в следующем периоде появится снова' : 'одноразовая'}</span></div>
      <button type="button" class="switch" role="switch" aria-checked="${!!ui.goalNewRepeat}" aria-label="Повторять ${REPEAT_TEXT[hz]}" data-action="goalNewRepeat"><span></span></button></div>
    <details ${ui.goalForm ? 'open' : ''} data-toggle="goalForm">
      <summary class="small muted" style="cursor:pointer">Число и связь с целью</summary>
      <div class="grid2" style="margin-top:10px">
        <label class="field"><span>Цель в числах (необязательно)</span><input class="input" name="target" inputmode="numeric" placeholder="например, 24"></label>
        <label class="field"><span>Часть цели (${parentName || '—'})</span>
          <select class="input" name="parentId" ${parents.length ? '' : 'disabled'}><option value="">без связи</option>${parents.map((p) => `<option value="${p.id}">${esc(p.title)}</option>`).join('')}</select></label>
      </div>
    </details>
  </form>
  ${categoryManager('goal', 'goalCats', ui)}`;
}

export const actions = {
  goalsTab(el) { ui.goalsHorizon = el.dataset.h; commit(() => {}); },
  goalsShift(el) { ui.goalsDay = shiftDay(ui.goalsHorizon, ui.goalsDay, Number(el.dataset.d)); commit(() => {}); },
  goalsNow() { ui.goalsDay = today(); commit(() => {}); },
  goalToggle(el) { commit((s) => { const g = s.goals.find((x) => x.id === el.dataset.id); if (g) g.done = !g.done; }); },
  goalStep(el) {
    commit((s) => {
      const g = s.goals.find((x) => x.id === el.dataset.id);
      if (g) g.current = Math.max(0, (g.current || 0) + Number(el.dataset.d));
    });
  },
  goalNewRepeat() { ui.goalNewRepeat = !ui.goalNewRepeat; commit(() => {}); },
  // Повтор включается/выключается для всей серии: выключил — новые копии больше не появятся.
  goalRepeat(el) {
    const g = state.goals.find((x) => x.id === el.dataset.id);
    if (!g) return;
    const on = !g.repeat;
    commit((s) => {
      for (const x of s.goals) if (x.horizon === g.horizon && seriesOf(x) === seriesOf(g)) { if (on) x.repeat = true; else delete x.repeat; }
    });
    toast(on ? `Будет повторяться ${REPEAT_TEXT[g.horizon]}` : 'Теперь одноразовая');
  },
  goalDelete(el) {
    const g = state.goals.find((x) => x.id === el.dataset.id);
    if (!g || !confirm(g.repeat ? `Удалить «${g.title}»? Повтор тоже выключится — в следующих периодах её не будет.` : `Удалить «${g.title}»?`)) return;
    commit((s) => {
      if (g.repeat) for (const x of s.goals) if (x.horizon === g.horizon && seriesOf(x) === seriesOf(g)) delete x.repeat;
      s.goals = s.goals.filter((x) => x.id !== g.id);
      for (const c of s.goals) if (c.parentId === g.id) c.parentId = null;
    });
  },
  goalEdit(el) { ui.goalEdit = el.dataset.id; commit(() => {}); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  goalEditClose() { ui.goalEdit = null; commit(() => {}); },
  goalSave(form) {
    const title = form.title.value.trim();
    if (!title) return;
    const target = parseNum(form.target.value);
    const c = form.categoryId.value;
    commit((s) => {
      const g = s.goals.find((x) => x.id === ui.goalEdit);
      if (!g) return;
      g.title = title;
      g.target = target && target > 0 ? Math.round(target) : null;
      if (c && c !== '__new') g.categoryId = c; else delete g.categoryId;
    });
    ui.goalEdit = null; commit(() => {});
  },
  goalAdd(form) {
    const title = form.title.value.trim();
    if (!title) return;
    const target = parseNum(form.target.value);
    const parentId = form.parentId.value || null;
    const cat = form.categoryId.value && form.categoryId.value !== '__new' ? form.categoryId.value : null;
    ui.goalNewCat = cat; // следующая цель — в ту же категорию
    commit((s) => s.goals.push({
      id: uid(), title, horizon: ui.goalsHorizon, period: periodKey(ui.goalsHorizon, ui.goalsDay),
      target: target && target > 0 ? Math.round(target) : null, current: 0, done: false, parentId, created: Date.now(),
      ...(cat ? { categoryId: cat } : {}), ...(ui.goalNewRepeat ? { repeat: true } : {})
    }));
    requestAnimationFrame(() => document.getElementById('goalTitle')?.focus());
  }
};
