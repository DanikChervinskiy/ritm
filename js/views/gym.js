import { state, commit, uid } from '../store.js';
import { ui, header, checkBtn } from '../ui.js';
import { today, esc, icon, kg, parseNum, fmtDuration, fmtLongDate, fmtShortDate, num, plural } from '../util.js';
import { activeWorkout, exerciseName, lastSession, bestSet, e1rm, workoutVolume } from '../logic.js';
import { startRest } from '../rest.js';

export const subnav = (cur) => `<nav class="seg" aria-label="Зал">
  <a href="#/gym" ${cur === 'gym' ? 'aria-current="page"' : ''}>Тренировки</a>
  <a href="#/body" ${cur === 'body' ? 'aria-current="page"' : ''}>Тело и вес</a></nav>`;

function setsLabel(sets) {
  return sets.map((s) => `${kg(s.w)}×${s.r}`).join(' · ');
}

function renderActive(w) {
  const items = w.items.map((it, i) => {
    const last = lastSession(it.exerciseId, w.id);
    const best = bestSet(it.exerciseId, w.id);
    const rows = it.sets.map((s, j) => {
      const prev = last?.sets[j];
      return `<div class="set-row">
        <span style="font-weight:600">${j + 1}</span>
        <span class="small muted ellipsis">${prev ? `${kg(prev.w)} × ${prev.r}` : '—'}</span>
        <input class="input" inputmode="decimal" aria-label="Вес, подход ${j + 1}" value="${s.w == null ? '' : kg(s.w)}" placeholder="${prev ? kg(prev.w) : 'кг'}" data-change="setField" data-i="${i}" data-j="${j}" data-f="w">
        <input class="input" inputmode="numeric" aria-label="Повторы, подход ${j + 1}" value="${s.r ?? ''}" placeholder="${prev ? prev.r : 'повт'}" data-change="setField" data-i="${i}" data-j="${j}" data-f="r">
        ${checkBtn(!!s.done, 'setDone', { i, j }, (s.done ? 'Снять отметку с подхода ' : 'Подход выполнен: ') + (j + 1))}
      </div>`;
    }).join('');
    // Подсказка о прогрессе: сравниваем лучший выполненный подход сегодня с прошлым разом.
    const doneSets = it.sets.filter((s) => s.done && s.w != null && s.r);
    let hint = '';
    if (doneSets.length && last) {
      const todayBest = Math.max(...doneSets.map((s) => e1rm(s.w, s.r)));
      const lastBest = Math.max(...last.sets.map((s) => e1rm(s.w, s.r)));
      if (todayBest > lastBest + 0.01) hint = `<div class="hint row" style="gap:6px">${icon('up', 14)}Сильнее, чем в прошлый раз</div>`;
    }
    if (doneSets.length && best && doneSets.some((s) => s.w > best.w || (s.w === best.w && s.r > best.r))) {
      hint = `<div class="hint row" style="gap:6px">${icon('trophy', 14)}Новый рекорд!</div>`;
    }
    return `<section class="card" aria-label="${esc(exerciseName(it.exerciseId))}">
      <div class="row between"><h2>${esc(exerciseName(it.exerciseId))}</h2>
        <button class="icon-btn" style="width:36px;height:36px;border:0;background:transparent" data-action="removeItem" data-i="${i}" aria-label="Убрать упражнение">${icon('trash', 16)}</button></div>
      <div class="grid2" style="gap:8px">
        <div class="pill"><span class="small muted row" style="gap:4px">${icon('clock', 12)}Прошлый раз${last ? ' · ' + fmtShortDate(last.workout.date) : ''}</span>
          <span style="font-weight:700">${last ? setsLabel(last.sets.slice(0, 2)) : '—'}</span>
          <span class="small muted">${last ? `${last.sets.length} ${plural(last.sets.length, 'подход', 'подхода', 'подходов')}` : 'ещё нет истории'}</span></div>
        <div class="pill ink"><span class="small muted row" style="gap:4px"><span style="color:var(--accent)">${icon('trophy', 12)}</span>Лучший результат</span>
          <span style="font-weight:700">${best ? `${kg(best.w)} кг × ${best.r}` : '—'}</span>
          <span class="small muted">${best ? `1ПМ ≈ ${num(e1rm(best.w, best.r), 0)} кг · ${fmtShortDate(best.date)}` : 'появится после подхода'}</span></div>
      </div>
      <div class="sets">
        <div class="set-row head mono small muted"><span>#</span><span>Прошлый</span><span>кг</span><span>Повт.</span><span></span></div>
        ${rows}
      </div>
      ${hint}
      <button class="btn light sm" data-action="addSet" data-i="${i}">${icon('plus', 16)}Подход</button>
    </section>`;
  }).join('');

  const names = state.exercises.map((e) => `<option value="${esc(e.name)}">`).join('');
  return `
  ${header(w.name || 'Тренировка', '', `<span class="mono small muted" id="elapsed" aria-label="Длительность">${fmtDuration(Date.now() - w.startedAt)}</span>`, { back: '#/today' })}
  ${subnav('gym')}
  ${items || '<div class="empty">Добавь первое упражнение</div>'}
  <form class="addbar" data-submit="addExercise">
    <label class="sr-only" for="exName">Упражнение</label>
    <input id="exName" name="name" list="exList" placeholder="Добавить упражнение…" autocomplete="off">
    <datalist id="exList">${names}</datalist>
    <button class="icon-btn round ink" aria-label="Добавить упражнение" style="width:40px;height:40px">${icon('plus', 18)}</button>
  </form>
  <button class="btn block" data-action="finishWorkout">Завершить тренировку</button>
  <button class="btn block danger" data-action="cancelWorkout">Отменить тренировку</button>`;
}

function renderIdle() {
  const done = state.workouts.filter((w) => w.finishedAt).sort((a, b) => b.startedAt - a.startedAt);
  const recent = done.slice(0, 8).map((w) => `<div class="list-row">
      <div class="grow stack" style="gap:1px"><span style="font-weight:600">${esc(w.name || 'Тренировка')}</span>
        <span class="small muted">${fmtLongDate(w.date)} · ${w.items.length} ${plural(w.items.length, 'упражнение', 'упражнения', 'упражнений')} · ${fmtDuration(w.finishedAt - w.startedAt)}</span></div>
      <span class="small muted">${Math.round(workoutVolume(w)).toLocaleString('ru-RU')} кг</span>
      <button class="icon-btn" style="width:36px;height:36px" data-action="repeatWorkout" data-id="${w.id}" aria-label="Повторить тренировку">${icon('play', 14)}</button>
    </div>`).join('');
  const records = state.exercises.map((e) => ({ e, b: bestSet(e.id) })).filter((x) => x.b)
    .sort((a, b) => e1rm(b.b.w, b.b.r) - e1rm(a.b.w, a.b.r))
    .map(({ e, b }) => `<div class="list-row" style="min-height:44px"><span class="grow" style="font-weight:600">${esc(e.name)}</span>
      <span style="font-weight:700">${kg(b.w)} × ${b.r}</span><span class="small muted" style="width:76px;text-align:right">1ПМ ${num(e1rm(b.w, b.r), 0)}</span></div>`).join('');
  return `
  ${header('Зал', `${done.length} ${plural(done.length, 'тренировка', 'тренировки', 'тренировок')} всего`)}
  ${subnav('gym')}
  <form class="card ink" data-submit="startWorkout" aria-label="Новая тренировка">
    <span class="label">Новая тренировка</span>
    <label class="sr-only" for="wName">Название</label>
    <input id="wName" name="name" class="input" placeholder="Например: грудь + трицепс" style="background:#222220;border-color:#333;color:#fff" autocomplete="off">
    <button class="btn white">${icon('play', 14)}Начать</button>
  </form>
  <div class="grid-desk">
    <section class="card" aria-label="Последние тренировки" style="gap:0">
      <span class="label" style="padding-bottom:6px">Последние</span>
      ${recent || '<div class="empty">Тут появится история</div>'}
    </section>
    <section class="card" aria-label="Рекорды" style="gap:0">
      <span class="label" style="padding-bottom:6px">Рекорды</span>
      ${records || '<div class="empty">Рекорды появятся после первой тренировки</div>'}
    </section>
  </div>`;
}

export function render() {
  const w = activeWorkout();
  return w ? renderActive(w) : renderIdle();
}

function newWorkout(s, name, items = []) {
  const w = { id: uid(), name, date: today(), startedAt: Date.now(), finishedAt: null, items };
  s.workouts.push(w);
  s.activeWorkoutId = w.id;
}

export const actions = {
  startWorkout(form) { const name = form.name.value.trim(); commit((s) => newWorkout(s, name)); },
  quickStartWorkout() { commit((s) => newWorkout(s, '')); location.hash = '#/gym'; },
  repeatWorkout(el) {
    const src = state.workouts.find((w) => w.id === el.dataset.id);
    if (!src) return;
    commit((s) => newWorkout(s, src.name, src.items.map((it) => ({ exerciseId: it.exerciseId, sets: it.sets.filter((x) => x.done).map(() => ({ w: null, r: null, done: false })) }))));
    window.scrollTo({ top: 0 });
  },
  addExercise(form) {
    const name = form.name.value.trim();
    if (!name) return;
    commit((s) => {
      let ex = s.exercises.find((e) => e.name.toLowerCase() === name.toLowerCase());
      if (!ex) { ex = { id: uid(), name, rest: null }; s.exercises.push(ex); }
      const w = s.workouts.find((x) => x.id === s.activeWorkoutId);
      const last = lastSession(ex.id, w.id);
      const n = last ? last.sets.length : 3;
      w.items.push({ exerciseId: ex.id, sets: Array.from({ length: n }, () => ({ w: null, r: null, done: false })) });
    });
  },
  removeItem(el) {
    if (!confirm('Убрать упражнение из тренировки?')) return;
    commit((s) => { const w = s.workouts.find((x) => x.id === s.activeWorkoutId); w.items.splice(Number(el.dataset.i), 1); });
  },
  addSet(el) {
    commit((s) => {
      const w = s.workouts.find((x) => x.id === s.activeWorkoutId);
      const it = w.items[Number(el.dataset.i)];
      const prev = it.sets[it.sets.length - 1];
      it.sets.push({ w: prev?.w ?? null, r: prev?.r ?? null, done: false });
    });
  },
  setField(el) {
    const i = Number(el.dataset.i), j = Number(el.dataset.j), f = el.dataset.f;
    const v = parseNum(el.value);
    commit((s) => {
      const w = s.workouts.find((x) => x.id === s.activeWorkoutId);
      w.items[i].sets[j][f] = v == null ? null : (f === 'r' ? Math.round(v) : v);
    }, { render: false });
  },
  setDone(el) {
    const i = Number(el.dataset.i), j = Number(el.dataset.j);
    const w = activeWorkout();
    const it = w.items[i];
    const set = it.sets[j];
    const willBeDone = !set.done;
    // Пустые поля заполняем значениями из прошлого раза (как подсказка в плейсхолдере).
    const prev = lastSession(it.exerciseId, w.id)?.sets[j];
    commit(() => {
      if (willBeDone) {
        if (set.w == null && prev) set.w = prev.w;
        if (set.r == null && prev) set.r = prev.r;
      }
      set.done = willBeDone;
    });
    if (willBeDone && state.settings.autoTimer) {
      const ex = state.exercises.find((e) => e.id === it.exerciseId);
      startRest(ex?.rest || state.settings.restDefault);
    }
  },
  finishWorkout() {
    const w = activeWorkout();
    const hasDone = w.items.some((it) => it.sets.some((s) => s.done));
    if (!hasDone && !confirm('Ни одного подхода не отмечено. Всё равно завершить?')) return;
    commit((s) => {
      const x = s.workouts.find((y) => y.id === s.activeWorkoutId);
      x.finishedAt = Date.now();
      x.items = x.items.map((it) => ({ ...it, sets: it.sets.filter((st) => st.done) })).filter((it) => it.sets.length);
      if (!x.items.length) s.workouts = s.workouts.filter((y) => y.id !== x.id);
      s.activeWorkoutId = null;
      s.rest = null;
    });
  },
  cancelWorkout() {
    if (!confirm('Отменить тренировку? Отмеченные подходы не сохранятся.')) return;
    commit((s) => { s.workouts = s.workouts.filter((y) => y.id !== s.activeWorkoutId); s.activeWorkoutId = null; s.rest = null; });
  }
};

export function tickElapsed() {
  const el = document.getElementById('elapsed');
  const w = activeWorkout();
  if (el && w) el.textContent = fmtDuration(Date.now() - w.startedAt);
}
