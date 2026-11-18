// Расчёты: серии привычек, прогресс целей, рекорды в зале.
import { state } from './store.js';
import { today, addDays, weekDays, periodKey } from './util.js';

// ---------- привычки ----------
export function isChecked(habitId, day) {
  return (state.checks[day] || []).includes(habitId);
}
export function toggleCheck(s, habitId, day) {
  const arr = s.checks[day] || [];
  s.checks[day] = arr.includes(habitId) ? arr.filter((x) => x !== habitId) : [...arr, habitId];
  if (!s.checks[day].length) delete s.checks[day];
}
export function dayProgress(day) {
  const hs = state.habits.filter((h) => !h.archived && h.created <= day);
  if (!hs.length) return { done: 0, total: 0 };
  const done = hs.filter((h) => isChecked(h.id, day)).length;
  return { done, total: hs.length };
}
export function streak(habitId) {
  let d = today();
  if (!isChecked(habitId, d)) d = addDays(d, -1); // сегодня ещё можно успеть
  let n = 0;
  while (isChecked(habitId, d)) { n++; d = addDays(d, -1); }
  return n;
}
export function bestStreak(habitId) {
  const days = Object.keys(state.checks).filter((k) => state.checks[k].includes(habitId)).sort();
  let best = 0, cur = 0, prev = null;
  for (const d of days) {
    cur = prev && addDays(prev, 1) === d ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}
export function rate(habitId, days = 30) {
  const h = state.habits.find((x) => x.id === habitId);
  if (!h) return 0;
  let total = 0, hit = 0, d = today();
  for (let i = 0; i < days; i++) {
    if (d < h.created) break;
    total++;
    if (isChecked(habitId, d)) hit++;
    d = addDays(d, -1);
  }
  return total ? hit / total : 0;
}
export function overallRate(days = 30, offset = 0) {
  const hs = state.habits.filter((h) => !h.archived);
  let total = 0, hit = 0, d = addDays(today(), -offset);
  for (let i = 0; i < days; i++) {
    for (const h of hs) {
      if (d < h.created) continue;
      total++;
      if (isChecked(h.id, d)) hit++;
    }
    d = addDays(d, -1);
  }
  return total ? hit / total : null;
}
export function weekCount(habitId, day = today()) {
  return weekDays(day).filter((d) => isChecked(habitId, d)).length;
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
    if (sets && sets.length) return { workout: w, sets };
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
export function workoutVolume(w) {
  return w.items.reduce((a, it) => a + it.sets.reduce((b, s) => b + (s.done && s.w && s.r ? s.w * s.r : 0), 0), 0);
}
export function activeWorkout() {
  return state.workouts.find((w) => w.id === state.activeWorkoutId) || null;
}
export function lastFinishedWorkout() {
  return state.workouts.filter((w) => w.finishedAt).sort((a, b) => b.startedAt - a.startedAt)[0] || null;
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
