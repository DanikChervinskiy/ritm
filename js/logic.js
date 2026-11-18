// Расчёты: серии привычек, прогресс целей, рекорды в зале.
import { state } from './store.js';
import { today, addDays, weekDays, periodKey } from './util.js';

// ---------- привычки ----------
// Состояние привычки за день: 'done' | 'partial' | null. Частично = половина в статистике.
export function status(habitId, day) {
  if ((state.checks[day] || []).includes(habitId)) return 'done';
  if ((state.partial?.[day] || []).includes(habitId)) return 'partial';
  return null;
}
export const isChecked = (habitId, day) => status(habitId, day) === 'done';
export const isMarked = (habitId, day) => status(habitId, day) != null;
export const score = (st) => (st === 'done' ? 1 : st === 'partial' ? 0.5 : 0);

export function setStatus(s, habitId, day, st) {
  for (const key of ['checks', 'partial']) {
    if (!s[key]) s[key] = {};
    const arr = (s[key][day] || []).filter((x) => x !== habitId);
    if ((key === 'checks' && st === 'done') || (key === 'partial' && st === 'partial')) arr.push(habitId);
    if (arr.length) s[key][day] = arr; else delete s[key][day];
  }
}
// Для тепловой карты: пусто → выполнено → частично → пусто.
export function cycleStatus(s, habitId, day) {
  const st = status(habitId, day);
  setStatus(s, habitId, day, st == null ? 'done' : st === 'done' ? 'partial' : null);
}

// С какого дня считать привычку: дата создания или самая ранняя отметка (если отмечали прошлое).
export function habitStart(h) {
  let start = h.created;
  for (const key of ['checks', 'partial']) {
    for (const d of Object.keys(state[key] || {})) if (d < start && state[key][d].includes(h.id)) start = d;
  }
  return start;
}

// Дни недели привычки (с v0.9.0): h.days = [1…7], 1 — понедельник. Пусто — любой день.
export const WD_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const weekdayOf = (day) => { const g = new Date(day + 'T12:00:00').getDay(); return g === 0 ? 7 : g; };
export const hasDays = (h) => Array.isArray(h?.days) && h.days.length > 0 && h.days.length < 7;
// Нужна ли привычка в этот день (по расписанию).
export const isDue = (h, day) => !hasDays(h) || h.days.includes(weekdayOf(day));
// Показывать ли привычку в этот день: по расписанию или уже отмечена.
export const showsOn = (h, day) => isDue(h, day) || isMarked(h.id, day);
export const daysLabel = (h) => hasDays(h) ? [...h.days].sort().map((d) => WD_NAMES[d - 1]).join(', ') : '';

export function dayProgress(day) {
  const hs = state.habits.filter((h) => !h.archived && habitStart(h) <= day && showsOn(h, day));
  let done = 0, partial = 0;
  for (const h of hs) { const st = status(h.id, day); if (st === 'done') done++; else if (st === 'partial') partial++; }
  return { done, partial, total: hs.length, score: hs.length ? (done + partial / 2) / hs.length : 0 };
}
export function streak(habitId) {
  const h = state.habits.find((x) => x.id === habitId);
  if (hasDays(h)) {
    // Серия по дням расписания: дни вне расписания пропускаются.
    let d = today(), n = 0, guard = 0;
    if (!isDue(h, d) || !isMarked(habitId, d)) d = addDays(d, -1); // сегодня ещё можно успеть
    for (; guard < 3660; guard++, d = addDays(d, -1)) {
      if (!isDue(h, d)) continue;
      if (!isMarked(habitId, d)) break;
      n++;
    }
    return n;
  }
  let d = today();
  if (!isMarked(habitId, d)) d = addDays(d, -1); // сегодня ещё можно успеть
  let n = 0;
  while (isMarked(habitId, d)) { n++; d = addDays(d, -1); }
  return n;
}
function markedDays(habitId, from = '0000', to = '9999') {
  const out = [];
  for (const key of ['checks', 'partial']) {
    for (const [d, ids] of Object.entries(state[key] || {})) if (d >= from && d <= to && ids.includes(habitId)) out.push(d);
  }
  return [...new Set(out)].sort();
}
export function bestStreak(habitId, from, to) {
  const h = state.habits.find((x) => x.id === habitId);
  if (hasDays(h)) {
    const marked = markedDays(habitId, from, to);
    if (!marked.length) return 0;
    let best = 0, cur = 0;
    const end = marked[marked.length - 1];
    for (let d = marked[0]; d <= end; d = addDays(d, 1)) {
      if (!isDue(h, d)) continue;
      cur = isMarked(habitId, d) ? cur + 1 : 0;
      best = Math.max(best, cur);
    }
    return best;
  }
  let best = 0, cur = 0, prev = null;
  for (const d of markedDays(habitId, from, to)) {
    cur = prev && addDays(prev, 1) === d ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}
// Доля выполнения привычки за отрезок дат [from, to] (включительно, не позже сегодня).
export function rangeStats(habitId, from, to) {
  const h = state.habits.find((x) => x.id === habitId);
  const res = { days: 0, done: 0, partial: 0, rate: null };
  if (!h) return res;
  const start = habitStart(h);
  const end = to < today() ? to : today();
  for (let d = from < start ? start : from; d <= end; d = addDays(d, 1)) {
    const st = status(habitId, d);
    if (!isDue(h, d) && !st) continue; // день не по расписанию — не считается
    res.days++;
    if (st === 'done') res.done++; else if (st === 'partial') res.partial++;
  }
  res.rate = res.days ? (res.done + res.partial / 2) / res.days : null;
  return res;
}
export function rate(habitId, days = 30) {
  return rangeStats(habitId, addDays(today(), -(days - 1)), today()).rate || 0;
}
export function overallRange(from, to, habitIds = null) {
  let days = 0, pts = 0;
  for (const h of state.habits) {
    if (habitIds && !habitIds.includes(h.id)) continue;
    const r = rangeStats(h.id, from, to);
    days += r.days; pts += r.done + r.partial / 2;
  }
  return days ? pts / days : null;
}
export function overallRate(days = 30, offset = 0) {
  const to = addDays(today(), -offset);
  return overallRange(addDays(to, -(days - 1)), to, state.habits.filter((h) => !h.archived).map((h) => h.id));
}
export function weekCount(habitId, day = today()) {
  return weekDays(day).reduce((a, d) => a + score(status(habitId, d)), 0);
}

// ---------- цели ----------
export function goalsFor(horizon, day) {
  const p = periodKey(horizon, day);
  return state.goals.filter((g) => g.horizon === horizon && g.period === p);
}
export function goalProgress(g) {
  if (g.target) return Math.max(0, Math.min(1, (g.current || 0) / g.target));
  return g.done ? 1 : 0;
}
export function isGoalDone(g) {
  return g.target ? (g.current || 0) >= g.target : !!g.done;
}
// ---------- повтор целей (v0.12.0) ----------
// g.repeat = true — цель повторяется: в новом периоде (неделя, месяц…) появляется её копия, не выполненная.
// Все копии одной цели связаны g.seriesId (= id первой цели). id копии детерминированный
// («серия~период»), поэтому телефон и компьютер не создадут дублей.
export const REPEAT_TEXT = { day: 'каждый день', week: 'каждую неделю', month: 'каждый месяц', year: 'каждый год' };
export const seriesOf = (g) => g.seriesId || g.id;
export function ensureRepeats(s, day = today(), dry = false) {
  const latest = new Map();
  for (const g of s.goals) {
    const k = g.horizon + '|' + seriesOf(g);
    const cur = latest.get(k);
    if (!cur || g.period > cur.period) latest.set(k, g);
  }
  let n = 0;
  for (const g of latest.values()) {
    if (!g.repeat) continue;
    const p = periodKey(g.horizon, day);
    if (g.period >= p) continue;
    const id = seriesOf(g) + '~' + p;
    if (s.goals.some((x) => x.id === id)) continue;
    n++;
    if (dry) continue;
    s.goals.push({
      id, title: g.title, horizon: g.horizon, period: p, target: g.target || null, current: 0, done: false,
      parentId: null, created: g.created || 0, repeat: true, seriesId: seriesOf(g), ...(g.categoryId ? { categoryId: g.categoryId } : {})
    });
  }
  return n;
}

export const HORIZONS = [
  { id: 'year', name: 'Год', parent: null },
  { id: 'month', name: 'Месяц', parent: 'year' },
  { id: 'week', name: 'Неделя', parent: 'month' },
  { id: 'day', name: 'День', parent: 'week' }
];
export function parentOptions(horizon, day) {
  const h = HORIZONS.find((x) => x.id === horizon);
  if (!h || !h.parent) return [];
  return goalsFor(h.parent, day);
}

// ---------- зал ----------
export function exerciseName(id) {
  return state.exercises.find((e) => e.id === id)?.name || 'Упражнение';
}
export const e1rm = (w, r) => (w && r ? w * (1 + r / 30) : 0); // формула Эпли

// Последняя завершённая тренировка с этим упражнением (кроме текущей).
export function lastSession(exerciseId, excludeWorkoutId) {
  const ws = state.workouts
    .filter((w) => w.finishedAt && w.id !== excludeWorkoutId)
    .sort((a, b) => b.startedAt - a.startedAt);
  for (const w of ws) {
    const it = w.items.find((i) => i.exerciseId === exerciseId);
    const sets = it?.sets.filter((s) => s.done && s.w != null && s.r);
    if (sets && sets.length) return { workout: w, sets, item: it };
  }
  return null;
}
export function bestSet(exerciseId, excludeWorkoutId) {
  let best = null;
  for (const w of state.workouts) {
    if (w.id === excludeWorkoutId) continue;
    for (const it of w.items) {
      if (it.exerciseId !== exerciseId) continue;
      for (const s of it.sets) {
        if (!s.done || s.w == null || !s.r) continue;
        if (!best || s.w > best.w || (s.w === best.w && s.r > best.r)) best = { ...s, date: w.date };
      }
    }
  }
  return best;
}
// Единица веса упражнения (с v0.7.1): кг, ф (деления/блины тренажёра без перевода в кг),
// блин (штуки), сек (вес в кг, а вместо повторов — секунды).
export const UNITS = {
  'кг': { w: 'кг', r: 'Повт.', steps: [2.5, 5] },
  'ф': { w: 'ф', r: 'Повт.', steps: [5, 10] },
  'блин': { w: 'бл.', r: 'Повт.', steps: [1] },
  'сек': { w: 'кг', r: 'Сек.', steps: [10] }
};
export const UNIT_ORDER = ['кг', 'ф', 'блин', 'сек'];
export function unitOf(exerciseId) {
  const e = state.exercises.find((x) => x.id === exerciseId);
  if (e?.unit && UNITS[e.unit]) return e.unit;
  const n = e?.name || '';
  if (/\(ф\)\s*$/i.test(n)) return 'ф';
  if (/\(блины\)\s*$/i.test(n)) return 'блин';
  if (/\(сек\)\s*$/i.test(n)) return 'сек';
  return 'кг';
}
// Объём считаем только по упражнениям в килограммах.
export function workoutVolume(w) {
  return w.items.filter((it) => unitOf(it.exerciseId) === 'кг').reduce((a, it) => a + it.sets.reduce((b, s) => b + (s.done && s.w && s.r ? s.w * s.r : 0), 0), 0);
}
export function activeWorkout() {
  return state.workouts.find((w) => w.id === state.activeWorkoutId) || null;
}
export function lastFinishedWorkout() {
  return state.workouts.filter((w) => w.finishedAt).sort((a, b) => b.startedAt - a.startedAt)[0] || null;
}

// Ощущение после упражнения (с v0.6.0): item.feel = 1…5.
export const FEELS = ['Легко', 'Нормально', 'Тяжело', 'Очень тяжело', 'На пределе'];
// Вес, который стоит взять сегодня: прошлый вес подхода + пометка «на следующий раз».
export function plannedWeight(prevSet, prevItem) {
  if (!prevSet || prevSet.w == null) return null;
  const add = prevItem?.nextAdd || 0;
  return Math.max(0, Math.round((prevSet.w + add) * 100) / 100);
}

// ---------- программы тренировок (с v0.5.0) ----------
// state.templates[] = { id, name, items: [{ exerciseId, sets }], habitId? }
export function lastTemplateWorkout(tplId) {
  return state.workouts.filter((w) => w.finishedAt && w.templateId === tplId).sort((a, b) => b.startedAt - a.startedAt)[0] || null;
}
// Следующая по кругу: после последней сделанной программы идёт следующая в списке.
export function nextTemplate() {
  const t = state.templates || [];
  if (!t.length) return null;
  const last = state.workouts.filter((w) => w.finishedAt && t.some((x) => x.id === w.templateId)).sort((a, b) => b.startedAt - a.startedAt)[0];
  if (!last) return t[0];
  return t[(t.findIndex((x) => x.id === last.templateId) + 1) % t.length];
}
// Привычка «зал/тренировка» по умолчанию для новой программы.
export function guessGymHabit() {
  const hs = state.habits.filter((h) => !h.archived);
  return (hs.find((h) => h.icon === 'gym') || hs.find((h) => /зал|трен|спорт|качал/i.test(h.name)))?.id || null;
}

// ---------- тело ----------
export const METRICS = [
  { k: 'weight', name: 'Вес', unit: 'кг', dec: 1, good: -1 },
  { k: 'fat', name: 'Жир', unit: '%', dec: 1, good: -1 },
  { k: 'muscle', name: 'Мышцы', unit: 'кг', dec: 1, good: 1 },
  { k: 'water', name: 'Вода', unit: '%', dec: 1, good: 1 },
  { k: 'visceral', name: 'Висц. жир', unit: '', dec: 0, good: -1 },
  { k: 'bone', name: 'Кости', unit: 'кг', dec: 1, good: 1 },
  { k: 'protein', name: 'Белок', unit: '%', dec: 1, good: 1 },
  { k: 'bmr', name: 'Обмен', unit: 'ккал', dec: 0, good: 1 },
  { k: 'bmi', name: 'ИМТ', unit: '', dec: 1, good: -1 }
];
export function bodySorted() {
  return [...state.body].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
export function latest(metric) {
  const s = bodySorted();
  for (let i = s.length - 1; i >= 0; i--) if (s[i][metric] != null) return s[i];
  return null;
}
export function valueAgo(metric, days) {
  const limit = addDays(today(), -days);
  const s = bodySorted().filter((e) => e[metric] != null);
  let found = null;
  for (const e of s) { if (e.date <= limit) found = e; }
  return found || s[0] || null;
}
