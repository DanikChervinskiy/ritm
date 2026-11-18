import { state, commit, uid } from '../store.js';
import { ui, header } from '../ui.js';
import { today, addDays, esc, icon, num, parseNum, fmtShortDate, fmtLongDate, toast } from '../util.js';
import { METRICS, bodySorted, latest, valueAgo } from '../logic.js';
import { subnav } from './gym.js';

const PERIODS = [{ d: 30, n: '1М' }, { d: 90, n: '3М' }, { d: 365, n: 'Год' }, { d: 0, n: 'Всё' }];

function chart(metric, days) {
  const m = METRICS.find((x) => x.k === metric);
  const from = days ? addDays(today(), -days) : '0000';
  const pts = bodySorted().filter((e) => e[metric] != null && e.date >= from);
  if (pts.length < 2) return `<div class="empty" style="height:120px;display:flex;align-items:center;justify-content:center">Нужно минимум два взвешивания за период</div>`;
  const t0 = new Date(pts[0].date).getTime(), t1 = new Date(pts[pts.length - 1].date).getTime();
  const vs = pts.map((p) => p[metric]);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
  const xy = pts.map((p) => {
    const x = t1 === t0 ? 160 : 4 + (new Date(p.date).getTime() - t0) / (t1 - t0) * 312;
    const y = 10 + (1 - (p[metric] - lo) / (hi - lo)) * 90;
    return [x, y];
  });
  const last = xy[xy.length - 1];
  return `<svg width="100%" height="120" viewBox="0 0 320 110" preserveAspectRatio="none" role="img" aria-label="${m.name}: от ${num(vs[0], m.dec)} до ${num(vs[vs.length - 1], m.dec)}">
    <line x1="0" y1="10" x2="320" y2="10" stroke="var(--line)"/><line x1="0" y1="55" x2="320" y2="55" stroke="var(--line)"/><line x1="0" y1="100" x2="320" y2="100" stroke="var(--line)"/>
    <polyline points="${xy.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" fill="none" stroke="var(--text)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4.5" fill="var(--accent)"/>
  </svg>
  <div class="row between mono small muted"><span>${fmtShortDate(pts[0].date)}</span><span>мин ${num(lo, m.dec)} · макс ${num(hi, m.dec)}</span><span>${fmtShortDate(pts[pts.length - 1].date)}</span></div>`;
}

function deltaInfo(m, days) {
  const cur = latest(m.k);
  const old = valueAgo(m.k, days || 36500);
  if (!cur || !old || cur === old) return { text: '', cls: '' };
  const d = cur[m.k] - old[m.k];
  if (Math.abs(d) < 1e-9) return { text: 'без изменений', cls: 'muted' };
  const better = d * m.good > 0;
  return { text: (d > 0 ? '+' : '−') + num(Math.abs(d), m.dec) + (m.unit && m.unit !== 'ккал' ? ' ' + m.unit : ''), cls: better ? 'good' : 'bad' };
}

export function render() {
  const sel = METRICS.find((m) => m.k === ui.bodyMetric) || METRICS[0];
  const cur = latest(sel.k);
  const lastEntry = bodySorted().slice(-1)[0];
  const di = deltaInfo(sel, ui.bodyPeriod);
  const tiles = METRICS.map((m) => {
    const l = latest(m.k);
    const d = deltaInfo(m, 30);
    const on = m.k === sel.k;
    return `<button class="tile" data-action="bodyMetric" data-k="${m.k}" aria-pressed="${on}">
      <span class="small muted ellipsis">${m.name}</span>
      <span style="font-size:17px;font-weight:700">${l ? num(l[m.k], m.dec) : '—'}<span class="small muted" style="font-weight:500"> ${m.unit === 'ккал' ? '' : m.unit}</span></span>
      <span class="small ${on ? '' : d.cls}" style="font-weight:600">${d.text || '&nbsp;'}</span>
    </button>`;
  }).join('');

  const form = ui.bodyForm ? `
  <form class="card" data-submit="bodyAdd" aria-label="Новое взвешивание">
    <div class="row between"><h2>Взвешивание</h2><button type="button" class="icon-btn" data-action="bodyFormToggle" aria-label="Закрыть">${icon('close', 18)}</button></div>
    <label class="field"><span>Дата</span><input class="input" type="date" name="date" value="${today()}" max="${today()}" required></label>
    <div class="grid3" style="gap:10px">
      ${METRICS.map((m) => `<label class="field"><span>${m.name}${m.unit ? ', ' + m.unit : ''}</span><input class="input" name="${m.k}" inputmode="decimal" autocomplete="off"></label>`).join('')}
    </div>
    <span class="small muted">Заполни только то, что показали весы. Пустые поля не сохраняются.</span>
    <button class="btn">Сохранить</button>
  </form>` : '';

  const entries = bodySorted().slice(-12).reverse().map((e) => `<div class="list-row" style="min-height:48px">
    <div class="grow stack" style="gap:1px"><span style="font-weight:600">${num(e.weight, 1)} кг${e.fat != null ? ` · жир ${num(e.fat, 1)}%` : ''}${e.muscle != null ? ` · мышцы ${num(e.muscle, 1)} кг` : ''}</span>
      <span class="small muted">${fmtLongDate(e.date)} · ${esc(e.source || 'вручную')}</span></div>
    <button class="icon-btn" style="width:36px;height:36px;border:0;background:transparent" data-action="bodyDelete" data-id="${e.id}" aria-label="Удалить запись">${icon('trash', 16)}</button>
  </div>`).join('');

  return `
  ${header('Тело', lastEntry ? `Последнее: ${fmtLongDate(lastEntry.date).toLowerCase()}` : 'Весы Xiaomi S400', `<button class="icon-btn round ink" data-action="bodyFormToggle" aria-label="Внести взвешивание">${icon('plus')}</button>`)}
  ${subnav('body')}
  ${form}
  <div class="grid-desk">
    <section class="card" aria-label="График">
      <div class="row between" style="align-items:flex-start">
        <div class="stack" style="gap:2px">
          <span class="label">${sel.name}</span>
          <span class="huge">${cur ? num(cur[sel.k], sel.dec) : '—'}<span class="muted" style="font-size:15px;font-weight:500"> ${sel.unit}</span></span>
          <span class="small ${di.cls}" style="font-weight:600">${di.text} <span class="muted" style="font-weight:400">${di.text ? (ui.bodyPeriod ? `за ${PERIODS.find((p) => p.d === ui.bodyPeriod).n}` : 'за всё время') : ''}</span></span>
        </div>
        <div class="seg sm" role="radiogroup" aria-label="Период">${PERIODS.map((p) => `<button role="radio" aria-checked="${p.d === ui.bodyPeriod}" data-action="bodyPeriod" data-d="${p.d}">${p.n}</button>`).join('')}</div>
      </div>
      ${chart(sel.k, ui.bodyPeriod)}
    </section>
    <div class="grid3">${tiles}</div>
  </div>
  <section class="card" aria-label="История" style="gap:0">
    <div class="row between" style="padding-bottom:6px"><span class="label">История</span>
      <label class="btn light sm" style="cursor:pointer">${icon('upload', 16)}Импорт CSV<input type="file" accept=".csv,text/csv" data-change="bodyCsv" class="sr-only"></label></div>
    ${entries || '<div class="empty">Нажми «+» и внеси первое взвешивание. Автоимпорт из Apple Health появится в версии для iPhone.</div>'}
  </section>`;
}

// Названия колонок, которые понимает импорт CSV.
const CSV_KEYS = {
  date: ['date', 'дата', 'time', 'timestamp', 'datetime'],
  weight: ['weight', 'вес', 'weight(kg)', 'weight_kg'],
  fat: ['fat', 'bodyfat', 'body fat', 'body_fat', 'fat%', 'жир', 'fat_rate'],
  muscle: ['muscle', 'musclemass', 'muscle mass', 'muscle_mass', 'мышцы'],
  water: ['water', 'bodywater', 'body water', 'body_water', 'вода'],
  visceral: ['visceral', 'visceralfat', 'visceral fat', 'visceral_fat'],
  bone: ['bone', 'bonemass', 'bone mass', 'bone_mass', 'кости'],
  protein: ['protein', 'protein%', 'белок'],
  bmr: ['bmr', 'metabolic', 'basal metabolism', 'обмен'],
  bmi: ['bmi', 'имт']
};

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const head = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const idx = {};
  for (const [k, names] of Object.entries(CSV_KEYS)) {
    const i = head.findIndex((h) => names.includes(h) || names.some((n) => h.replace(/[\s_()%]/g, '') === n.replace(/[\s_()%]/g, '')));
    if (i >= 0) idx[k] = i;
  }
  if (idx.date == null || idx.weight == null) throw new Error('Нужны колонки date и weight');
  return lines.slice(1).map((l) => {
    const c = l.split(sep).map((x) => x.trim().replace(/^"|"$/g, ''));
    const raw = c[idx.date];
    const d = /^\d{9,13}$/.test(raw) ? new Date(Number(raw) * (raw.length <= 10 ? 1000 : 1)) : new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    const e = { id: uid(), date: today(d), source: 'CSV' };
    for (const k of Object.keys(CSV_KEYS)) if (k !== 'date' && idx[k] != null) e[k] = parseNum(c[idx[k]]);
    return e.weight ? e : null;
  }).filter(Boolean);
}

export const actions = {
  bodyMetric(el) { ui.bodyMetric = el.dataset.k; commit(() => {}); },
  bodyPeriod(el) { ui.bodyPeriod = Number(el.dataset.d); commit(() => {}); },
  bodyFormToggle() { ui.bodyForm = !ui.bodyForm; commit(() => {}); },
  bodyAdd(form) {
    const e = { id: uid(), date: form.date.value || today(), source: 'вручную' };
    let any = false;
    for (const m of METRICS) { const v = parseNum(form[m.k].value); if (v != null) { e[m.k] = v; any = true; } }
    if (!any) { toast('Введи хотя бы вес'); return; }
    ui.bodyForm = false;
    commit((s) => s.body.push(e));
    toast('Взвешивание сохранено');
  },
  bodyDelete(el) {
    if (!confirm('Удалить запись?')) return;
    commit((s) => { s.body = s.body.filter((x) => x.id !== el.dataset.id); });
  },
  async bodyCsv(el) {
    const f = el.files?.[0];
    if (!f) return;
    try {
      const rows = parseCsv(await f.text());
      const seen = new Set(state.body.map((b) => b.date + '|' + b.weight));
      const fresh = rows.filter((r) => !seen.has(r.date + '|' + r.weight));
      commit((s) => s.body.push(...fresh));
      toast(`Импортировано: ${fresh.length}`);
    } catch (err) {
      toast('Не получилось: ' + err.message);
    }
  }
};
