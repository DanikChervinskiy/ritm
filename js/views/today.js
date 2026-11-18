import { state, commit, uid } from '../store.js';
import { ui, header, checkBtn, habitBtn, habitIcon } from '../ui.js';
import { today, weekDays, parseDate, WD_SHORT, fmtLongDate, esc, icon, ring, plural, num } from '../util.js';
import { renderGrouped } from '../categories.js';
import { status, dayProgress, streak, weekCount, goalsFor, isGoalDone, activeWorkout, lastFinishedWorkout, nextTemplate, exerciseName } from '../logic.js';

export function render() {
  const sel = ui.selDay;
  const t = today();
  const days = weekDays(sel).map((d, i) => {
    const p = dayProgress(d);
    const cls = ['day'];
    if (d === sel) cls.push('sel');
    else if (p.total && p.done === p.total) cls.push('full');
    else if (p.done + p.partial > 0) cls.push('part');
    if (d === t) cls.push('today');
    return `<button class="${cls.join(' ')}" data-action="selDay" data-day="${d}" aria-label="${fmtLongDate(d)}" aria-pressed="${d === sel}">
      <span class="mono small muted">${WD_SHORT[i]}</span><span class="n">${parseDate(d).getDate()}</span><span class="dot"></span></button>`;
  }).join('');

  const habits = state.habits.filter((h) => !h.archived);
  const p = dayProgress(sel);
  const habitRows = habits.length
    ? renderGrouped(habits, 'habit', (h) => {
      const st = status(h.id, sel);
      const s = streak(h.id);
      const meta = h.perWeek < 7 ? `${num(weekCount(h.id, sel), weekCount(h.id, sel) % 1 ? 1 : 0)} из ${h.perWeek} за неделю` : s ? `серия ${s} ${plural(s, 'день', 'дня', 'дней')}` : 'начни серию сегодня';
      return `<div class="list-row">
        ${habitIcon(h, 36)}
        <div class="grow stack" style="gap:1px"><span style="font-weight:600" class="${st === 'done' ? 'done-text' : ''}">${esc(h.name)}</span>
          <span class="small muted">${st === 'partial' ? '<span class="part-tag">частично · </span>' : ''}${meta}</span></div>
        ${habitBtn(h, sel, st)}
      </div>`;
    })
    : `<div class="empty">Привычек пока нет. <a href="#/habits">Добавить</a></div>`;

  const tasks = goalsFor('day', sel);
  const taskRows = renderGrouped(tasks, 'goal', (g) => {
    const done = isGoalDone(g);
    return `<div class="list-row" style="min-height:44px">
      ${checkBtn(done, 'toggleTask', { id: g.id }, (done ? 'Снять отметку: ' : 'Выполнено: ') + g.title, true)}
      <span class="grow ${done ? 'done-text' : ''}" style="font-size:14px;font-weight:500">${esc(g.title)}</span>
    </div>`;
  });
  const tasksDone = tasks.filter(isGoalDone).length;

  const aw = activeWorkout();
  const lw = lastFinishedWorkout();
  const nt = nextTemplate();
  const others = state.templates.filter((x) => nt && x.id !== nt.id);
  const gym = aw
    ? `<span class="label">Зал · идёт тренировка</span><span style="font-size:18px;font-weight:700">${esc(aw.name || 'Тренировка')}</span>
       <a class="btn white sm" href="#/gym" style="margin-top:auto">${icon('play', 14)}Продолжить</a>`
    : nt
    ? `<span class="label">Зал · следующая тренировка</span><span style="font-size:18px;font-weight:700;line-height:1.15">${esc(nt.name)}</span>
       <span class="small muted">${nt.items.length ? esc(nt.items.slice(0, 3).map((it) => exerciseName(it.exerciseId)).join(' · ')) + (nt.items.length > 3 ? ' · ещё ' + (nt.items.length - 3) : '') : 'упражнений пока нет'}${lw ? ' · прошлая: ' + fmtLongDate(lw.date).toLowerCase() : ''}</span>
       ${others.length ? `<div class="row" style="gap:6px;flex-wrap:wrap">${others.map((x) => `<button class="chip-dark" data-action="startTemplate" data-id="${x.id}" aria-label="Начать: ${esc(x.name)}">${icon('play', 11)}${esc(x.name)}</button>`).join('')}</div>` : ''}
       <button class="btn white sm" data-action="startTemplate" data-id="${nt.id}" style="margin-top:auto">${icon('play', 14)}Начать</button>`
    : `<span class="label">Зал</span><span style="font-size:18px;font-weight:700;line-height:1.15">${lw ? esc(lw.name || 'Тренировка') : 'Первая тренировка'}</span>
       <span class="small muted">${lw ? 'прошлая: ' + fmtLongDate(lw.date).toLowerCase() : 'вес и подходы сохранятся'}</span>
       <button class="btn white sm" data-action="quickStartWorkout" style="margin-top:auto">${icon('play', 14)}Начать</button>`;

  return `
  ${header(sel === t ? 'Сегодня' : fmtLongDate(sel).split(',')[0], fmtLongDate(sel), `<a class="icon-btn" href="#/goals" aria-label="Цели и задачи">${icon('calendar')}</a>`)}
  <div class="week">${days}</div>
  <div class="grid-desk">
    <section class="card" aria-label="Привычки за день" style="gap:4px;padding-bottom:6px">
      <div class="row between" style="padding-bottom:6px">
        <div class="stack" style="gap:2px"><span class="label">Привычки</span><span class="big">${p.done} <span class="muted" style="font-size:16px;font-weight:500">/ ${p.total}${p.partial ? ` · ${p.partial} частично` : ''}</span></span></div>
        ${ring(p.score, 52, 6, 'var(--accent)', `Выполнено ${p.done} из ${p.total}, частично ${p.partial}`)}
      </div>
      ${habitRows}
      ${habits.length ? '<span class="small muted" style="padding:8px 0 4px">Нажми — выполнено · двойное нажатие или удержание — частично</span>' : ''}
    </section>
    <div class="stack" style="gap:12px">
      <section class="card" aria-label="Задачи дня">
        <div class="row between"><span class="label">Задачи дня</span><span class="small muted">${tasksDone} / ${tasks.length}</span></div>
        <div>${taskRows || '<div class="small muted" style="padding:4px 0">Пусто — добавь первую задачу</div>'}</div>
        <form class="addbar" data-submit="addTask" style="background:var(--card-2)">
          <label class="sr-only" for="newTask">Новая задача</label>
          <input id="newTask" name="title" placeholder="Новая задача…" autocomplete="off">
          <button class="icon-btn round ink" aria-label="Добавить задачу" style="width:36px;height:36px">${icon('plus', 16)}</button>
        </form>
      </section>
      <section class="card ink" aria-label="Зал" style="min-height:150px">${gym}</section>
    </div>
  </div>`;
}

export const actions = {
  selDay(el) { ui.selDay = el.dataset.day; commit(() => {}); },
  toggleTask(el) { commit((s) => { const g = s.goals.find((x) => x.id === el.dataset.id); if (g) g.done = !g.done; }); },
  addTask(form) {
    const title = form.title.value.trim();
    if (!title) return;
    commit((s) => s.goals.push({ id: uid(), title, horizon: 'day', period: ui.selDay, target: null, current: 0, done: false, parentId: null, created: Date.now() }));
    requestAnimationFrame(() => document.getElementById('newTask')?.focus());
  }
};
