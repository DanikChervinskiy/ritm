import { state, commit, uid } from '../store.js';
import { ui, header, checkBtn } from '../ui.js';
import { today, esc, icon, kg, parseNum, fmtDuration, fmtLongDate, fmtShortDate, num, plural, toast } from '../util.js';
import { activeWorkout, exerciseName, lastSession, bestSet, e1rm, workoutVolume, setStatus, FEELS, plannedWeight, nextTemplate, lastTemplateWorkout, guessGymHabit } from '../logic.js';
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
    const lastItem = last?.item;
    const rows = it.sets.map((s, j) => {
      const prev = last?.sets[j];
      const plan = plannedWeight(prev, lastItem);
      return `<div class="set-row">
        <span style="font-weight:600">${j + 1}</span>
        <span class="small muted ellipsis">${prev ? `${kg(prev.w)} × ${prev.r}` : '—'}</span>
        <input class="input" inputmode="decimal" aria-label="Вес, подход ${j + 1}" value="${s.w == null ? '' : kg(s.w)}" placeholder="${plan != null ? kg(plan) : 'кг'}" data-change="setField" data-i="${i}" data-j="${j}" data-f="w">
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
    // Пометка с прошлого раза: «+N кг» и/или заметка.
    const planNote = lastItem && (lastItem.nextAdd || lastItem.note)
      ? `<div class="plan-note"><span class="label" style="color:inherit">План с прошлого раза</span>
          ${lastItem.nextAdd ? `<span style="font-weight:700">${lastItem.nextAdd > 0 ? '+' : '−'}${kg(Math.abs(lastItem.nextAdd))} кг → ${kg(plannedWeight(last.sets[0], lastItem))} кг</span>` : ''}
          ${lastItem.note ? `<span>${esc(lastItem.note)}</span>` : ''}</div>`
      : '';
    const feelRow = FEELS.map((f, k) => `<button type="button" class="feel${it.feel === k + 1 ? ' on' : ''}" data-action="setFeel" data-i="${i}" data-v="${k + 1}" aria-pressed="${it.feel === k + 1}"><b>${k + 1}</b>${f}</button>`).join('');
    const addOpts = [2.5, 5];
    const custom = it.nextAdd && !addOpts.includes(it.nextAdd);
    const nextRow = addOpts.map((v) => `<button type="button" class="chip sm" data-action="setNextAdd" data-i="${i}" data-v="${v}" aria-pressed="${it.nextAdd === v}">+${kg(v)} кг</button>`).join('')
      + `<button type="button" class="chip sm" data-action="setNextAdd" data-i="${i}" data-v="custom" aria-pressed="${!!custom}">${custom ? (it.nextAdd > 0 ? '+' : '−') + kg(Math.abs(it.nextAdd)) + ' кг' : 'Другое…'}</button>`;
    const doneAny = it.sets.some((x) => x.done);
    return `<section class="card" aria-label="${esc(exerciseName(it.exerciseId))}">
      <div class="row between"><h2>${esc(exerciseName(it.exerciseId))}</h2>
        <button class="icon-btn" style="width:36px;height:36px;border:0;background:transparent" data-action="removeItem" data-i="${i}" aria-label="Убрать упражнение">${icon('trash', 16)}</button></div>
      <div class="grid2" style="gap:8px">
        <div class="pill"><span class="small muted row" style="gap:4px">${icon('clock', 12)}Прошлый раз${last ? ' · ' + fmtShortDate(last.workout.date) : ''}</span>
          <span style="font-weight:700">${last ? setsLabel(last.sets.slice(0, 2)) : '—'}</span>
          <span class="small muted">${last ? `${last.sets.length} ${plural(last.sets.length, 'подход', 'подхода', 'подходов')}${lastItem?.feel ? ' · ' + FEELS[lastItem.feel - 1].toLowerCase() : ''}` : 'ещё нет истории'}</span></div>
        <div class="pill ink"><span class="small muted row" style="gap:4px"><span style="color:var(--accent)">${icon('trophy', 12)}</span>Лучший результат</span>
          <span style="font-weight:700">${best ? `${kg(best.w)} кг × ${best.r}` : '—'}</span>
          <span class="small muted">${best ? `1ПМ ≈ ${num(e1rm(best.w, best.r), 0)} кг · ${fmtShortDate(best.date)}` : 'появится после подхода'}</span></div>
      </div>
      <div class="sets">
        <div class="set-row head mono small muted"><span>#</span><span>Прошлый</span><span>кг</span><span>Повт.</span><span></span></div>
        ${rows}
      </div>
      ${planNote}
      ${hint}
      <button class="btn light sm" data-action="addSet" data-i="${i}">${icon('plus', 16)}Подход</button>
      <details class="after" ${doneAny || it.feel || it.nextAdd || it.note ? 'open' : ''}>
        <summary class="small muted">Как было и что в следующий раз</summary>
        <div class="stack" style="gap:10px;margin-top:10px">
          <div class="field"><span>Насколько было тяжело</span><div class="feels" role="group" aria-label="Ощущение">${feelRow}</div></div>
          <div class="field"><span>В следующий раз добавить вес</span><div class="row" style="gap:6px;flex-wrap:wrap">${nextRow}</div></div>
          <label class="field"><span>Заметка на следующий раз</span>
            <input class="input" value="${esc(it.note || '')}" placeholder="например: держать локти, медленнее вниз" data-change="setNote" data-i="${i}" autocomplete="off" maxlength="140"></label>
        </div>
      </details>
    </section>`;
  }).join('');

  const names = state.exercises.map((e) => `<option value="${esc(e.name)}">`).join('');
  const tpl = w.templateId ? state.templates.find((t) => t.id === w.templateId) : null;
  const habit = tpl?.habitId ? state.habits.find((h) => h.id === tpl.habitId) : null;
  return `
  ${header(w.name || 'Тренировка', tpl ? 'Программа' : '', `<span class="mono small muted" id="elapsed" aria-label="Длительность">${fmtDuration(Date.now() - w.startedAt)}</span>`, { back: '#/today' })}
  ${subnav('gym')}
  ${habit ? `<div class="hint row" style="gap:6px">${icon('check', 14)}После завершения отметится привычка «${esc(habit.name)}»</div>` : ''}
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

function renderTemplates() {
  const next = nextTemplate();
  const cards = state.templates.map((t) => {
    const last = lastTemplateWorkout(t.id);
    const habit = t.habitId ? state.habits.find((h) => h.id === t.habitId) : null;
    const exs = t.items.map((it) => exerciseName(it.exerciseId)).join(' · ');
    const isNext = next && next.id === t.id && state.templates.length > 1;
    return `<div class="list-row" style="align-items:flex-start">
      <div class="grow stack" style="gap:3px;min-width:0">
        <span class="row" style="gap:8px;flex-wrap:wrap"><span style="font-weight:700;font-size:16px">${esc(t.name)}</span>${isNext ? '<span class="tag-next">следующая</span>' : ''}</span>
        <span class="small muted">${exs ? esc(exs) : 'упражнений пока нет'}</span>
        <span class="small muted">${t.items.length} ${plural(t.items.length, 'упражнение', 'упражнения', 'упражнений')} · ${last ? 'была ' + fmtShortDate(last.date) : 'ещё не делал'}${habit ? ' · привычка «' + esc(habit.name) + '»' : ''}</span>
      </div>
      <button class="icon-btn" style="width:40px;height:40px" data-action="tplEdit" data-id="${t.id}" aria-label="Изменить программу: ${esc(t.name)}">${icon('pen', 16)}</button>
      <button class="icon-btn round ink" style="width:40px;height:40px" data-action="startTemplate" data-id="${t.id}" aria-label="Начать: ${esc(t.name)}">${icon('play', 14)}</button>
    </div>`;
  }).join('');
  return `<section class="card" aria-label="Мои тренировки" style="gap:0">
    <div class="row between" style="padding-bottom:6px"><span class="label">Мои тренировки</span>
      <button class="btn light sm" data-action="tplNew">${icon('plus', 16)}Программа</button></div>
    ${cards || '<div class="empty" style="text-align:left;padding:8px 0">Создай свои тренировки заранее (например, 3 в неделю), занеси в них упражнения — и потом запускай одной кнопкой.</div>'}
  </section>`;
}

function renderEditor(t) {
  const names = state.exercises.map((e) => `<option value="${esc(e.name)}">`).join('');
  const habits = state.habits.filter((h) => !h.archived);
  const rows = t.items.map((it, i) => `<div class="list-row" style="gap:8px">
      <span class="mono small muted" style="width:18px">${i + 1}</span>
      <span class="grow" style="font-weight:600;min-width:0">${esc(exerciseName(it.exerciseId))}</span>
      <div class="row" style="gap:4px;flex:none" aria-label="Подходы">
        <button type="button" class="icon-btn" style="width:32px;height:32px" data-action="tplSets" data-i="${i}" data-d="-1" ${it.sets > 1 ? '' : 'disabled'} aria-label="Меньше подходов">${icon('minus', 14)}</button>
        <span class="small" style="min-width:52px;text-align:center;font-weight:600">${it.sets} ${plural(it.sets, 'подход', 'подхода', 'подходов')}</span>
        <button type="button" class="icon-btn" style="width:32px;height:32px" data-action="tplSets" data-i="${i}" data-d="1" ${it.sets < 12 ? '' : 'disabled'} aria-label="Больше подходов">${icon('plus', 14)}</button>
      </div>
      <button type="button" class="icon-btn" style="width:32px;height:32px" data-action="tplMove" data-i="${i}" data-d="-1" ${i ? '' : 'disabled'} aria-label="Выше">${icon('up', 14)}</button>
      <button type="button" class="icon-btn" style="width:32px;height:32px;border:0;background:transparent" data-action="tplRemove" data-i="${i}" aria-label="Убрать упражнение">${icon('trash', 14)}</button>
    </div>`).join('');
  return `
  ${header('Программа', 'Тренировка заранее', '', { back: '#/gym' })}
  <section class="card" aria-label="Программа тренировки">
    <label class="field"><span>Название</span><input class="input" id="tplName" value="${esc(t.name)}" data-change="tplName" placeholder="Например: Грудь + трицепс" autocomplete="off"></label>
    <div class="stack" style="gap:0">
      <span class="label" style="padding:6px 0">Упражнения</span>
      ${rows || '<div class="small muted" style="padding:4px 0 8px">Добавь упражнения в том порядке, в котором делаешь</div>'}
    </div>
    <form class="addbar" data-submit="tplAddExercise" style="background:var(--card-2)">
      <label class="sr-only" for="tplEx">Упражнение</label>
      <input id="tplEx" name="name" list="tplExList" placeholder="Добавить упражнение…" autocomplete="off">
      <datalist id="tplExList">${names}</datalist>
      <button class="icon-btn round ink" aria-label="Добавить упражнение" style="width:36px;height:36px">${icon('plus', 16)}</button>
    </form>
    <label class="field"><span>Отмечать привычку, когда тренировка завершена</span>
      <select class="input" data-change="tplHabit">
        <option value="">Не отмечать</option>
        ${habits.map((h) => `<option value="${h.id}" ${h.id === t.habitId ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}
        <option value="__new">+ Создать привычку «Тренировка» (3× в неделю)</option>
      </select></label>
  </section>
  <button class="btn block" data-action="startTemplate" data-id="${t.id}" ${t.items.length ? '' : 'disabled'}>${icon('play', 14)}Начать сейчас</button>
  <a class="btn block light" href="#/gym" data-action="tplDone">Готово</a>
  <button class="btn block danger" data-action="tplDelete" data-id="${t.id}">${icon('trash', 16)}Удалить программу</button>`;
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
  ${renderTemplates()}
  <form class="card ink" data-submit="startWorkout" aria-label="Свободная тренировка">
    <span class="label">Свободная тренировка</span>
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
  if (w) return renderActive(w);
  // Редактор программы открыт по адресу #/gym/tpl — так «Назад» и «Готово» работают как обычные ссылки.
  const t = location.hash.startsWith('#/gym/tpl') && ui.tplEdit && state.templates.find((x) => x.id === ui.tplEdit);
  return t ? renderEditor(t) : renderIdle();
}

function newWorkout(s, name, items = [], templateId = null) {
  const w = { id: uid(), name, date: today(), startedAt: Date.now(), finishedAt: null, items, ...(templateId ? { templateId } : {}) };
  s.workouts.push(w);
  s.activeWorkoutId = w.id;
}

export const actions = {
  startWorkout(form) { const name = form.name.value.trim(); commit((s) => newWorkout(s, name)); },
  quickStartWorkout() { commit((s) => newWorkout(s, '')); location.hash = '#/gym'; },
  repeatWorkout(el) {
    const src = state.workouts.find((w) => w.id === el.dataset.id);
    if (!src) return;
    const tplId = state.templates.some((t) => t.id === src.templateId) ? src.templateId : null;
    commit((s) => newWorkout(s, src.name, src.items.map((it) => ({ exerciseId: it.exerciseId, sets: it.sets.filter((x) => x.done).map(() => ({ w: null, r: null, done: false })) })), tplId));
    window.scrollTo({ top: 0 });
  },
  addExercise(form) {
    const name = form.name.value.trim();
    if (!name) return;
    commit((s) => {
      const ex = findOrCreateExercise(s, name);
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
    const ls = lastSession(it.exerciseId, w.id);
    const prev = ls?.sets[j];
    commit(() => {
      if (willBeDone) {
        if (set.w == null && prev) set.w = plannedWeight(prev, ls.item);
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
    const tpl = w.templateId ? state.templates.find((t) => t.id === w.templateId) : null;
    // Добавил в тренировке новые упражнения — предложить дописать их в программу.
    // Пропущенные упражнения программу не меняют (сегодня можно делать не всё).
    const added = tpl ? w.items.filter((it) => it.sets.some((x) => x.done) && !tpl.items.some((t) => t.exerciseId === it.exerciseId)) : [];
    const addToTpl = added.length && confirm(`Добавить в программу «${tpl.name}»: ${added.map((it) => exerciseName(it.exerciseId)).join(', ')}?`);
    const habit = hasDone && tpl?.habitId ? state.habits.find((h) => h.id === tpl.habitId) : null;
    commit((s) => {
      if (addToTpl) {
        const t = s.templates.find((x) => x.id === tpl.id);
        for (const it of added) t.items.push({ exerciseId: it.exerciseId, sets: it.sets.filter((x) => x.done).length });
      }
      if (habit) setStatus(s, habit.id, w.date, 'done');
      const x = s.workouts.find((y) => y.id === s.activeWorkoutId);
      x.finishedAt = Date.now();
      x.items = x.items.map((it) => ({ ...it, sets: it.sets.filter((st) => st.done) })).filter((it) => it.sets.length);
      if (!x.items.length) s.workouts = s.workouts.filter((y) => y.id !== x.id);
      s.activeWorkoutId = null;
      s.rest = null;
    });
    if (habit) toast(`Привычка «${habit.name}» отмечена`);
  },
  cancelWorkout() {
    if (!confirm('Отменить тренировку? Отмеченные подходы не сохранятся.')) return;
    commit((s) => { s.workouts = s.workouts.filter((y) => y.id !== s.activeWorkoutId); s.activeWorkoutId = null; s.rest = null; });
  }
};

Object.assign(actions, {
  setFeel(el) {
    const i = Number(el.dataset.i), v = Number(el.dataset.v);
    commit((s) => { const it = s.workouts.find((x) => x.id === s.activeWorkoutId).items[i]; if (it.feel === v) delete it.feel; else it.feel = v; });
  },
  setNextAdd(el) {
    const i = Number(el.dataset.i);
    const it = activeWorkout().items[i];
    let v;
    if (el.dataset.v === 'custom') {
      if (it.nextAdd && ![2.5, 5].includes(it.nextAdd)) v = null; // повторное нажатие — снять
      else {
        const ans = prompt('Сколько кг добавить в следующий раз? (можно с минусом, чтобы уменьшить)', '1');
        if (ans == null) return;
        v = parseNum(ans);
        if (!v) return;
      }
    } else v = it.nextAdd === Number(el.dataset.v) ? null : Number(el.dataset.v);
    commit((s) => { const x = s.workouts.find((y) => y.id === s.activeWorkoutId).items[i]; if (v) x.nextAdd = v; else delete x.nextAdd; });
  },
  setNote(el) {
    const i = Number(el.dataset.i), v = el.value.trim().slice(0, 140);
    commit((s) => { const x = s.workouts.find((y) => y.id === s.activeWorkoutId).items[i]; if (v) x.note = v; else delete x.note; }, { render: false });
  },
  startTemplate(el) {
    const t = state.templates.find((x) => x.id === el.dataset.id);
    if (!t || !t.items.length) { toast('Сначала добавь упражнения в программу'); return; }
    if (activeWorkout()) { location.hash = '#/gym'; return; }
    ui.tplEdit = null;
    commit((s) => newWorkout(s, t.name, t.items.map((it) => ({ exerciseId: it.exerciseId, sets: Array.from({ length: it.sets || 3 }, () => ({ w: null, r: null, done: false })) })), t.id));
    if (location.hash !== '#/gym') location.hash = '#/gym';
    window.scrollTo({ top: 0 });
  },
  tplNew() {
    const id = uid();
    const n = state.templates.length + 1;
    commit((s) => s.templates.push({ id, name: `Тренировка ${n}`, items: [], ...(guessGymHabit() ? { habitId: guessGymHabit() } : {}) }));
    ui.tplEdit = id;
    location.hash = '#/gym/tpl';
    setTimeout(() => document.getElementById('tplEx')?.focus(), 50);
  },
  tplEdit(el) { ui.tplEdit = el.dataset.id; if (location.hash === '#/gym/tpl') commit(() => {}); else location.hash = '#/gym/tpl'; },
  tplDone() { ui.tplEdit = null; },
  tplName(el) {
    const name = el.value.trim() || 'Тренировка';
    commit((s) => { const t = s.templates.find((x) => x.id === ui.tplEdit); if (t) t.name = name; }, { render: false });
  },
  tplAddExercise(form) {
    const name = form.name.value.trim();
    if (!name) return;
    commit((s) => {
      const t = s.templates.find((x) => x.id === ui.tplEdit);
      if (!t) return;
      const ex = findOrCreateExercise(s, name);
      const last = lastSession(ex.id);
      t.items.push({ exerciseId: ex.id, sets: last ? last.sets.length : 3 });
    });
    requestAnimationFrame(() => document.getElementById('tplEx')?.focus());
  },
  tplSets(el) {
    commit((s) => {
      const it = s.templates.find((x) => x.id === ui.tplEdit)?.items[Number(el.dataset.i)];
      if (it) it.sets = Math.min(12, Math.max(1, (it.sets || 3) + Number(el.dataset.d)));
    });
  },
  tplMove(el) {
    commit((s) => {
      const t = s.templates.find((x) => x.id === ui.tplEdit);
      const i = Number(el.dataset.i), j = i + Number(el.dataset.d);
      if (!t || j < 0 || j >= t.items.length) return;
      [t.items[i], t.items[j]] = [t.items[j], t.items[i]];
    });
  },
  tplRemove(el) { commit((s) => { s.templates.find((x) => x.id === ui.tplEdit)?.items.splice(Number(el.dataset.i), 1); }); },
  tplHabit(el) {
    let id = el.value;
    if (id === '__new') {
      id = uid();
      commit((s) => s.habits.push({ id, name: 'Тренировка', icon: 'gym', perWeek: 3, created: today() }), { render: false });
    }
    commit((s) => { const t = s.templates.find((x) => x.id === ui.tplEdit); if (t) { if (id) t.habitId = id; else delete t.habitId; } });
  },
  tplDelete(el) {
    const t = state.templates.find((x) => x.id === el.dataset.id);
    if (!t || !confirm(`Удалить программу «${t.name}»? История тренировок останется.`)) return;
    ui.tplEdit = null;
    commit((s) => { s.templates = s.templates.filter((x) => x.id !== t.id); });
    location.hash = '#/gym';
  }
});

function findOrCreateExercise(s, name) {
  let ex = s.exercises.find((e) => e.name.toLowerCase() === name.toLowerCase());
  if (!ex) { ex = { id: uid(), name, rest: null }; s.exercises.push(ex); }
  return ex;
}

export function tickElapsed() {
  const el = document.getElementById('elapsed');
  const w = activeWorkout();
  if (el && w) el.textContent = fmtDuration(Date.now() - w.startedAt);
}
