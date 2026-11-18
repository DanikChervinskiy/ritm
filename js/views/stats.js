// Статистика по календарным периодам: конкретный год (2026) или месяц (январь 2026) целиком.
// История не удаляется — можно листать назад сколько угодно лет.
import { state, commit } from '../store.js';
import { ui, header, habitIcon } from '../ui.js';
import { today, addDays, parseDate, periodTitle, shiftDay, esc, icon, num, kg, plural, periodKey } from '../util.js';
import { status, score, dayProgress, rangeStats, overallRange, bestStreak, goalsFor, isGoalDone, goalProgress, workoutVolume, habitStart } from '../logic.js';

const MONTHS_SHORT = ['Я', 'Ф', 'М', 'А', 'М', 'И', 'И', 'А', 'С', 'О', 'Н', 'Д'];

function range(mode, day) {
  const d = parseDate(day);
  const y = d.getFullYear(), m = d.getMonth();
  const z = (n) => String(n).padStart(2, '0');
  if (mode === 'year') return { from: `${y}-01-01`, to: `${y}-12-31` };
  const last = new Date(y, m + 1, 0).getDate();
  return { from: `${y}-${z(m + 1)}-01`, to: `${y}-${z(m + 1)}-${z(last)}` };
}

function earliestYear() {
  let min = today();
  for (const h of state.habits) { const s = habitStart(h); if (s < min) min = s; }
  for (const w of state.workouts) if (w.date < min) min = w.date;
  for (const b of state.body) if (b.date < min) min = b.date;
  for (const g of state.goals) if (g.period < min) min = g.period;
  return Math.min(Number(min.slice(0, 4)), new Date().getFullYear() - 4);
}

function dayScore(day, habitId) {
  if (habitId) return score(status(habitId, day));
  const p = dayProgress(day);
  return p.total ? p.score : null;
}

function cellStyle(sc) {
  if (sc == null || sc === 0) return '';
  const pct = Math.round(25 + sc * 75);
  return `background:color-mix(in srgb, var(--accent) ${pct}%, var(--line));color:${sc > 0.5 ? '#111' : 'var(--text)'}`;
}

export function render() {
  const mode = ui.statsMode || 'month';
  const day = ui.statsDay || today();
  const { from, to } = range(mode, day);
  const t = today();
  const habits = state.habits.filter((h) => !h.archived || rangeStats(h.id, from, to).done);
  const sel = habits.find((h) => h.id === ui.statsHabit) || null;
  const ids = sel ? [sel.id] : habits.map((h) => h.id);

  // прошло ли время периода
  let timeLine;
  if (to < t) timeLine = 'период завершён';
  else if (from > t) timeLine = 'ещё не начался';
  else {
    const total = (parseDate(to) - parseDate(from)) / 864e5 + 1;
    const passed = (parseDate(t) - parseDate(from)) / 864e5 + 1;
    timeLine = `прошло ${Math.round(passed / total * 100)}% ${mode === 'year' ? 'года' : 'месяца'}`;
  }

  const r = overallRange(from, to, ids);
  const prevDay = shiftDay(mode, day, -1);
  const pr = range(mode, prevDay);
  const rPrev = overallRange(pr.from, pr.to, ids);
  const delta = r != null && rPrev != null ? Math.round((r - rPrev) * 100) : null;

  let perfect = 0;
  for (let d = from; d <= to && d <= t; d = addDays(d, 1)) {
    const p = dayProgress(d);
    if (p.total && p.done === p.total) perfect++;
  }

  const ws = state.workouts.filter((w) => w.finishedAt && w.date >= from && w.date <= to);
  const vol = ws.reduce((a, w) => a + workoutVolume(w), 0);
  const goals = goalsFor(mode, day);
  const goalsDone = goals.filter(isGoalDone).length;

  const bodyIn = state.body.filter((b) => b.weight != null && b.date >= from && b.date <= to).sort((a, b) => (a.date < b.date ? -1 : 1));
  const wFirst = bodyIn[0], wLast = bodyIn[bodyIn.length - 1];

  // календарь месяца или столбики по месяцам года
  let chart = '';
  if (mode === 'month') {
    const first = parseDate(from);
    const pad = (first.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < pad; i++) cells.push('<span class="cell empty"></span>');
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const n = parseDate(d).getDate();
      if (d > t) { cells.push(`<span class="cell future">${n}</span>`); continue; }
      const sc = dayScore(d, sel?.id);
      cells.push(`<span class="cell" style="${cellStyle(sc)}" title="${sc == null ? '' : Math.round(sc * 100) + '%'}">${n}</span>`);
    }
    chart = `<div class="row between mono small muted" style="padding:0 2px">${['П', 'В', 'С', 'Ч', 'П', 'С', 'В'].map((x) => `<span style="width:calc(100%/7);text-align:center">${x}</span>`).join('')}</div>
      <div class="cal" role="img" aria-label="Календарь выполнения привычек">${cells.join('')}</div>`;
  } else {
    const y = from.slice(0, 4);
    const bars = Array.from({ length: 12 }, (_, m) => {
      const mr = range('month', `${y}-${String(m + 1).padStart(2, '0')}-01`);
      const v = mr.from > t ? null : overallRange(mr.from, mr.to, ids);
      const cur = periodKey('month', t) === mr.from.slice(0, 7);
      return `<button class="${cur ? 'cur' : ''}" data-action="statsOpenMonth" data-day="${mr.from}" aria-label="${periodTitle('month', mr.from)}: ${v == null ? 'нет данных' : Math.round(v * 100) + '%'}">
        <span>${v == null ? '' : Math.round(v * 100)}</span><i style="height:${v == null ? 0 : Math.max(2, v * 100)}%"></i><span>${MONTHS_SHORT[m]}</span></button>`;
    }).join('');
    chart = `<div class="mbars">${bars}</div><span class="small muted">Нажми на месяц, чтобы открыть его календарь</span>`;
  }

  const habitRows = habits.map((h) => {
    const s = rangeStats(h.id, from, to);
    if (!s.days) return '';
    return `<div class="list-row">
      ${habitIcon(h, 32)}
      <div class="grow stack" style="gap:1px;min-width:0"><span class="ellipsis" style="font-weight:600">${esc(h.name)}</span>
        <span class="small muted">${s.done} вып.${s.partial ? ` · ${s.partial} частично` : ''} · серия до ${bestStreak(h.id, from, to)}</span></div>
      <span style="font-weight:700">${Math.round(s.rate * 100)}%</span>
    </div>`;
  }).join('');

  const goalRows = goals.map((g) => `<div class="stack" style="gap:6px">
      <div class="row between" style="font-size:14px"><span style="font-weight:600" class="${isGoalDone(g) && !g.target ? 'done-text' : ''}">${esc(g.title)}</span>
        <span class="muted">${g.target ? `${g.current || 0} / ${g.target}` : isGoalDone(g) ? 'готово' : 'не готово'}</span></div>
      <div class="bar"><i style="width:${Math.round(goalProgress(g) * 100)}%"></i></div></div>`).join('');

  const years = [];
  for (let y = new Date().getFullYear() + 1; y >= earliestYear(); y--) years.push(y);
  const curYear = Number(from.slice(0, 4));

  return `
  ${header('Статистика', 'Вся история хранится')}
  <div class="seg" role="tablist" aria-label="Период">
    <button role="tab" aria-selected="${mode === 'month'}" data-action="statsMode" data-m="month">Месяц</button>
    <button role="tab" aria-selected="${mode === 'year'}" data-action="statsMode" data-m="year">Год</button>
  </div>
  <div class="row between">
    <button class="icon-btn" data-action="statsShift" data-d="-1" aria-label="Предыдущий период">${icon('back', 18)}</button>
    <div class="stack" style="align-items:center;gap:2px">
      <span style="font-weight:700;font-size:17px">${periodTitle(mode, day)}</span>
      <span class="small muted">${timeLine}</span>
    </div>
    <button class="icon-btn" data-action="statsShift" data-d="1" aria-label="Следующий период">${icon('next', 18)}</button>
  </div>
  <div class="row" style="gap:8px">
    <label class="sr-only" for="statsYear">Год</label>
    <select id="statsYear" class="input" data-change="statsYear" style="flex:1">${years.map((y) => `<option value="${y}" ${y === curYear ? 'selected' : ''}>${y} год</option>`).join('')}</select>
    <button class="btn light sm" data-action="statsNow">Сейчас</button>
  </div>
  <div class="chips">
    <button class="chip" data-action="statsHabit" data-id="" aria-pressed="${!sel}">Все привычки</button>
    ${habits.map((h) => `<button class="chip row" style="gap:6px" data-action="statsHabit" data-id="${h.id}" aria-pressed="${sel?.id === h.id}">${icon(h.icon || 'habits', 15)}${esc(h.name)}</button>`).join('')}
  </div>
  <div class="grid2" style="gap:8px">
    <div class="card" style="gap:2px;padding:14px"><span class="big">${r == null ? '—' : Math.round(r * 100) + '%'}</span><span class="small muted">привычки выполнены${delta == null ? '' : ` · <b class="${delta >= 0 ? 'good' : 'bad'}">${delta > 0 ? '+' : ''}${delta}%</b> к прошлому`}</span></div>
    <div class="card" style="gap:2px;padding:14px"><span class="big">${perfect}</span><span class="small muted">${plural(perfect, 'идеальный день', 'идеальных дня', 'идеальных дней')}</span></div>
    <div class="card" style="gap:2px;padding:14px"><span class="big">${ws.length}</span><span class="small muted">${plural(ws.length, 'тренировка', 'тренировки', 'тренировок')} · ${Math.round(vol).toLocaleString('ru-RU')} кг</span></div>
    <div class="card" style="gap:2px;padding:14px"><span class="big">${goalsDone}/${goals.length}</span><span class="small muted">целей ${mode === 'year' ? 'года' : 'месяца'} выполнено</span></div>
  </div>
  <div class="grid-desk">
    <section class="card" aria-label="${mode === 'month' ? 'Календарь' : 'По месяцам'}">
      <div class="row between"><span class="label">${mode === 'month' ? 'Календарь' : 'По месяцам'}</span><span class="small muted">${sel ? esc(sel.name) : 'все привычки'}</span></div>
      ${chart}
    </section>
    <section class="card" aria-label="Привычки за период" style="gap:0">
      <span class="label" style="padding-bottom:6px">Привычки</span>
      ${habitRows || '<div class="empty">За этот период нет отметок</div>'}
    </section>
  </div>
  <div class="grid-desk">
    <section class="card" aria-label="Цели периода">
      <div class="row between"><span class="label">Цели ${mode === 'year' ? 'года' : 'месяца'}</span><a class="small" href="#/goals" data-action="statsToGoals">открыть</a></div>
      ${goalRows || '<div class="small muted">Целей на этот период не было</div>'}
    </section>
    <section class="card" aria-label="Тело">
      <span class="label">Вес за период</span>
      ${wFirst ? `<div class="row between"><span class="big">${num(wLast.weight, 1)} <span class="muted" style="font-size:15px;font-weight:500">кг</span></span>
        <span class="${wLast.weight - wFirst.weight <= 0 ? 'good' : 'bad'}" style="font-weight:600">${wLast === wFirst ? '' : (wLast.weight - wFirst.weight > 0 ? '+' : '−') + num(Math.abs(wLast.weight - wFirst.weight), 1) + ' кг'}</span></div>
        <span class="small muted">${bodyIn.length} ${plural(bodyIn.length, 'взвешивание', 'взвешивания', 'взвешиваний')} · от ${kg(Math.min(...bodyIn.map((b) => b.weight)))} до ${kg(Math.max(...bodyIn.map((b) => b.weight)))} кг</span>`
        : '<div class="small muted">Взвешиваний не было</div>'}
    </section>
  </div>`;
}

export const actions = {
  statsMode(el) { ui.statsMode = el.dataset.m; commit(() => {}); },
  statsShift(el) { ui.statsDay = shiftDay(ui.statsMode || 'month', ui.statsDay || today(), Number(el.dataset.d)); commit(() => {}); },
  statsNow() { ui.statsDay = today(); commit(() => {}); },
  statsYear(el) {
    const cur = parseDate(ui.statsDay || today());
    ui.statsDay = `${el.value}-${String(cur.getMonth() + 1).padStart(2, '0')}-01`;
    commit(() => {});
  },
  statsHabit(el) { ui.statsHabit = el.dataset.id || null; commit(() => {}); },
  statsOpenMonth(el) { ui.statsMode = 'month'; ui.statsDay = el.dataset.day; commit(() => {}); window.scrollTo({ top: 0 }); },
  statsToGoals() { ui.goalsHorizon = ui.statsMode || 'month'; ui.goalsDay = ui.statsDay || today(); }
};
