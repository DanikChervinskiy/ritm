// Добавление истории тренировок из файла (с v0.7.0). Ничего не заменяет — только дописывает.
// Формат файла: { type: 'ritm-workouts', version: 1,
//   exercises: [{ name }],
//   templates: [{ name, items: [{ exercise, sets }] }],
//   workouts:  [{ key, name, template, date, startedAt, finishedAt,
//                 items: [{ exercise, feel?, note?, nextAdd?, sets: [{ w, r, done, feel? }] }] }] }
// Повторный импорт того же файла ничего не дублирует (по полю key → workout.importKey).
import { uid } from './store.js';
import { setStatus } from './logic.js';

export const isWorkoutsFile = (d) => d && d.type === 'ritm-workouts' && Array.isArray(d.workouts);

const low = (x) => String(x || '').trim().toLowerCase();

function gymHabit(s) {
  const hs = s.habits.filter((h) => !h.archived);
  return hs.find((h) => h.icon === 'gym') || hs.find((h) => /зал|трен|спорт|качал/i.test(h.name)) || null;
}

// Что произойдёт при импорте — для подтверждения.
export function previewWorkouts(s, d) {
  const keys = new Set(s.workouts.map((w) => w.importKey).filter(Boolean));
  const fresh = d.workouts.filter((w) => !keys.has(w.key));
  const exNames = new Set(s.exercises.map((e) => low(e.name)));
  const tplNames = new Set((s.templates || []).map((t) => low(t.name)));
  const dates = fresh.map((w) => w.date).sort();
  return {
    workouts: fresh.length,
    skipped: d.workouts.length - fresh.length,
    newExercises: new Set(d.workouts.flatMap((w) => w.items.map((i) => i.exercise)).concat((d.templates || []).flatMap((t) => t.items.map((i) => i.exercise))).filter((n) => !exNames.has(low(n))).map(low)).size,
    newTemplates: (d.templates || []).filter((t) => !tplNames.has(low(t.name))).map((t) => t.name),
    from: dates[0], to: dates[dates.length - 1],
    habit: gymHabit(s)?.name || null
  };
}

export function mergeWorkouts(s, d) {
  s.templates ||= [];
  const exId = (name) => {
    let e = s.exercises.find((x) => low(x.name) === low(name));
    if (!e) { e = { id: uid(), name: String(name).trim(), rest: null }; s.exercises.push(e); }
    return e.id;
  };
  const dates = d.workouts.map((w) => w.date).sort();

  let habit = gymHabit(s);
  if (!habit) {
    habit = { id: uid(), name: 'Тренировка', icon: 'gym', perWeek: 3, created: dates[0] || new Date().toISOString().slice(0, 10) };
    s.habits.push(habit);
  }

  const tplId = {};
  for (const t of d.templates || []) {
    let ex = s.templates.find((x) => low(x.name) === low(t.name));
    if (!ex) {
      ex = { id: uid(), name: t.name, items: t.items.map((i) => ({ exerciseId: exId(i.exercise), sets: Math.max(1, Math.min(12, i.sets || 3)) })), habitId: habit.id };
      s.templates.push(ex);
    }
    tplId[low(t.name)] = ex.id;
  }

  const keys = new Set(s.workouts.map((w) => w.importKey).filter(Boolean));
  let added = 0;
  for (const w of d.workouts) {
    if (keys.has(w.key)) continue;
    const t = w.template ? tplId[low(w.template)] : null;
    s.workouts.push({
      id: uid(), importKey: w.key, name: w.name || '', date: w.date, startedAt: w.startedAt, finishedAt: w.finishedAt,
      ...(t ? { templateId: t } : {}),
      items: w.items.map((it) => ({
        exerciseId: exId(it.exercise),
        ...(it.feel ? { feel: it.feel } : {}), ...(it.note ? { note: it.note } : {}), ...(it.nextAdd ? { nextAdd: it.nextAdd } : {}),
        sets: it.sets.map((x) => ({ w: x.w ?? null, r: x.r ?? null, done: true, ...(x.feel ? { feel: x.feel } : {}) }))
      }))
    });
    setStatus(s, habit.id, w.date, 'done');
    added++;
  }
  // Если привычка создана позже первой тренировки — статистика считает с самой ранней отметки.
  return { added, habit: habit.name };
}
