// Категории привычек и целей: группировка списков, поле выбора и управление.
// Данные: state.categories[] = { id, name, kind: 'habit' | 'goal' };
// у привычки и цели — необязательное поле categoryId.
import { state, commit, uid } from './store.js';
import { esc, icon } from './util.js';
import { onSort } from './drag.js';

export function categoriesOf(kind) {
  return (state.categories || []).filter((c) => c.kind === kind);
}

// Делит элементы на группы по категориям (в порядке категорий), «Без категории» — в конце.
export function groupByCategory(items, kind) {
  const cats = categoriesOf(kind);
  const ids = new Set(cats.map((c) => c.id));
  const groups = cats.map((c) => ({ cat: c, items: items.filter((x) => x.categoryId === c.id) })).filter((g) => g.items.length);
  const rest = items.filter((x) => !x.categoryId || !ids.has(x.categoryId));
  if (rest.length) groups.push({ cat: null, items: rest });
  return groups;
}

// Рендер сгруппированного списка: заголовок категории + тонкий разделитель между группами.
// Если категорий нет вовсе — просто список без заголовков.
export function renderGrouped(items, kind, renderItem, { count = true } = {}) {
  const groups = groupByCategory(items, kind);
  const plain = groups.length === 1 && !groups[0].cat;
  if (plain) return groups[0].items.map(renderItem).join('');
  return groups.map((g, i) => `
    ${i ? '<hr class="cat-div">' : ''}
    <div class="cat-group">
      <div class="cat-head"><span class="label">${g.cat ? esc(g.cat.name) : 'Без категории'}</span>${count ? `<span class="mono small muted">${g.items.length}</span>` : ''}</div>
      ${g.items.map(renderItem).join('')}
    </div>`).join('');
}

// Список, который можно перетаскивать (v0.11.0): заголовки категорий — плоско в одном контейнере,
// чтобы строку можно было перенести в другую категорию. Пустые категории видны только во время перетаскивания.
// renderItem(item) должен вернуть строку с атрибутом data-sort-item="<id>".
export function renderSortable(items, kind, renderItem, name, { count = true } = {}) {
  const cats = categoriesOf(kind);
  const ids = new Set(cats.map((c) => c.id));
  if (!cats.length) return `<div class="sort-list" data-sortable="${name}">${items.map(renderItem).join('')}</div>`;
  const rest = items.filter((x) => !x.categoryId || !ids.has(x.categoryId));
  const head = (id, title, n, first) => `<div class="cat-head sort-head${n ? '' : ' empty'}${first ? ' first' : ''}" data-sort-head="${id}"><span class="label">${esc(title)}</span>${count ? `<span class="mono small muted">${n}</span>` : ''}</div>`;
  let html = '';
  let shown = 0;
  for (const c of cats) {
    const its = items.filter((x) => x.categoryId === c.id);
    html += head(c.id, c.name, its.length, !shown) + its.map(renderItem).join('');
    if (its.length) shown++;
  }
  html += head('', 'Без категории', rest.length, !shown) + rest.map(renderItem).join('');
  return `<div class="sort-list" data-sortable="${name}">${html}</div>`;
}

// Поле выбора категории: «Без категории», существующие и «+ Новая категория…».
export function categorySelect(kind, selectedId = '', { name = 'categoryId', id = '' } = {}) {
  const opts = categoriesOf(kind).map((c) => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  return `<select class="input" name="${name}" ${id ? `id="${id}"` : ''} data-change="catPick" data-kind="${kind}">
    <option value="">Без категории</option>${opts}<option value="__new">+ Новая категория…</option></select>`;
}

function askName(current = '') {
  const n = prompt(current ? 'Новое название категории' : 'Название новой категории', current);
  return n == null ? null : n.trim().slice(0, 40) || null;
}

// Карточка управления категориями (переименовать, порядок, удалить, добавить).
export function categoryManager(kind, toggleKey, ui) {
  const cats = categoriesOf(kind);
  const rows = cats.map((c) => `<div class="list-row sort-row" style="min-height:44px;padding:6px 0;gap:8px" data-sort-item="${c.id}">
      <span class="drag-handle" data-sort-handle tabindex="0" role="button" aria-label="Переместить категорию ${esc(c.name)}. Потяни или нажимай стрелки вверх и вниз">${icon('grip', 16)}</span>
      <span class="grow" style="font-weight:600">${esc(c.name)}</span>
      <button type="button" class="icon-btn" style="width:34px;height:34px" data-action="catRename" data-id="${c.id}" aria-label="Переименовать: ${esc(c.name)}">${icon('pen', 15)}</button>
      <button type="button" class="icon-btn" style="width:34px;height:34px;border:0;background:transparent" data-action="catDelete" data-id="${c.id}" aria-label="Удалить категорию: ${esc(c.name)}">${icon('trash', 15)}</button>
    </div>`).join('');
  return `<details class="card" ${ui[toggleKey] ? 'open' : ''} data-toggle="${toggleKey}">
    <summary class="row between"><span>Категории</span><span class="small muted">${cats.length || 'нет'}</span></summary>
    ${rows ? `<div class="sort-list" data-sortable="cats-${kind}">${rows}</div>${cats.length > 1 ? '<span class="small muted" style="padding:6px 0 0">Зажми категорию (или потяни за ⋮⋮) и перетащи — в таком порядке группы идут в списках.</span>' : ''}` : '<div class="small muted" style="padding:4px 0">Категорий пока нет</div>'}
    <form class="addbar" data-submit="catAdd" data-kind="${kind}" style="background:var(--card-2)">
      <label class="sr-only" for="newCat-${kind}">Новая категория</label>
      <input id="newCat-${kind}" name="name" placeholder="Новая категория…" autocomplete="off" maxlength="40">
      <button class="icon-btn round ink" aria-label="Добавить категорию" style="width:36px;height:36px">${icon('plus', 16)}</button>
    </form>
  </details>`;
}

export const categoryActions = {
  // Выбор «+ Новая категория…» в любом поле: создаём без перерисовки, чтобы не стереть введённый текст.
  catPick(el) {
    if (el.value !== '__new') return;
    const name = askName();
    if (!name) { el.value = ''; return; }
    const kind = el.dataset.kind;
    const ex = categoriesOf(kind).find((c) => c.name.toLowerCase() === name.toLowerCase());
    const id = ex ? ex.id : uid();
    if (!ex) commit((s) => s.categories.push({ id, name, kind }), { render: false });
    document.querySelectorAll(`select[data-change="catPick"][data-kind="${kind}"]`).forEach((sel) => {
      if (!ex) sel.querySelector('option[value="__new"]').insertAdjacentHTML('beforebegin', `<option value="${id}">${esc(name)}</option>`);
    });
    el.value = id;
  },
  catAdd(form) {
    const name = form.name.value.trim().slice(0, 40);
    const kind = form.dataset.kind;
    if (!name) return;
    if (!categoriesOf(kind).some((c) => c.name.toLowerCase() === name.toLowerCase())) commit((s) => s.categories.push({ id: uid(), name, kind }));
    requestAnimationFrame(() => document.getElementById('newCat-' + kind)?.focus());
  },
  catRename(el) {
    const c = state.categories.find((x) => x.id === el.dataset.id);
    if (!c) return;
    const name = askName(c.name);
    if (name) commit(() => { c.name = name; });
  },
  catMove(el) { // клавиатура/старые ссылки — оставлено на всякий случай
    commit((s) => {
      const c = s.categories.find((x) => x.id === el.dataset.id);
      if (!c) return;
      const same = s.categories.filter((x) => x.kind === c.kind);
      const j = same.indexOf(c) + Number(el.dataset.d);
      if (j < 0 || j >= same.length) return;
      const other = same[j];
      const a = s.categories.indexOf(c), b = s.categories.indexOf(other);
      s.categories[a] = other; s.categories[b] = c;
    });
  },
  catDelete(el) {
    const c = state.categories.find((x) => x.id === el.dataset.id);
    if (!c || !confirm(`Удалить категорию «${c.name}»? ${c.kind === 'habit' ? 'Привычки' : 'Цели'} из неё останутся — просто без категории.`)) return;
    commit((s) => {
      s.categories = s.categories.filter((x) => x.id !== c.id);
      for (const x of [...s.habits, ...s.goals]) if (x.categoryId === c.id) delete x.categoryId;
    });
  }
};

// Новый порядок категорий одного вида; категории другого вида остаются на своих местах.
function reorderCats(kind, order) {
  commit((s) => {
    const byId = new Map(s.categories.map((c) => [c.id, c]));
    const sorted = order.map((o) => byId.get(o.key)).filter((c) => c && c.kind === kind);
    if (sorted.length !== s.categories.filter((c) => c.kind === kind).length) return;
    let k = 0;
    s.categories = s.categories.map((c) => (c.kind === kind ? sorted[k++] : c));
  });
}
onSort('cats-habit', (order) => reorderCats('habit', order));
onSort('cats-goal', (order) => reorderCats('goal', order));

// Перетаскивание привычек: порядок и перенос в другую категорию.
onSort('habits', (order) => {
  commit((s) => {
    const byId = new Map(s.habits.map((h) => [h.id, h]));
    const moved = [];
    for (const { key, group } of order) {
      const h = byId.get(key);
      if (!h) continue;
      if (group) h.categoryId = group; else delete h.categoryId;
      moved.push(h);
      byId.delete(key);
    }
    s.habits = [...moved, ...byId.values()]; // архивные и прочие — в конце, как были
  });
});
