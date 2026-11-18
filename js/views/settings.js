import { state, commit, exportJSON, replaceAll, resetAll, listBackups, restoreBackup } from '../store.js';
import { ui, header } from '../ui.js';
import { VERSION } from '../version.js';
import { esc, icon, download, today, toast, fmtTime } from '../util.js';
import { applyTheme } from '../theme.js';

const ACCENTS = [['#E8613C', 'Оранжевый'], ['#2F6FEB', 'Синий'], ['#1F9D6B', 'Зелёный'], ['#8B5CF6', 'Фиолетовый']];
const REPO = 'https://github.com/DanikChervinskiy/ritm';
let versions = null;

function loadVersions() {
  if (versions !== null) return;
  versions = [];
  fetch('versions.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])).then((v) => { versions = Array.isArray(v) ? v : []; if (ui.route === 'settings') commit(() => {}); }).catch(() => {});
}

const sw = (key, label, sub) => `<div class="list-row">
  <div class="grow stack" style="gap:1px"><span style="font-weight:500">${label}</span><span class="small muted">${sub}</span></div>
  <button class="switch" role="switch" aria-checked="${!!state.settings[key]}" aria-label="${label}" data-action="toggleSetting" data-k="${key}"><span></span></button></div>`;

export function render() {
  loadVersions();
  const s = state.settings;
  const backups = listBackups();
  const vlist = (versions || []).slice().reverse().map((v) => `<div class="list-row" style="min-height:44px">
      <span class="grow" style="font-weight:600">${esc(v)}${v === 'v' + VERSION ? ' <span class="small muted">· открыта сейчас</span>' : ''}</span>
      <a class="btn light sm" href="v/${esc(v)}/" target="_blank" rel="noopener">Открыть</a></div>`).join('');

  return `
  ${header('Настройки', 'Ритм · версия ' + VERSION)}
  <span class="label" style="padding:4px 6px 0">Профиль</span>
  <form class="card" data-submit="saveProfile" style="gap:10px">
    <label class="field"><span>Имя</span><input class="input" name="name" value="${esc(state.profile.name)}" placeholder="Как к тебе обращаться"></label>
    <div class="grid3" style="gap:10px">
      <label class="field"><span>Рост, см</span><input class="input" name="height" inputmode="numeric" value="${state.profile.height ?? ''}"></label>
      <label class="field"><span>Год рождения</span><input class="input" name="birthYear" inputmode="numeric" value="${state.profile.birthYear ?? ''}"></label>
      <label class="field"><span>Пол</span><select class="input" name="sex"><option value="">—</option><option value="m" ${state.profile.sex === 'm' ? 'selected' : ''}>муж.</option><option value="f" ${state.profile.sex === 'f' ? 'selected' : ''}>жен.</option></select></label>
    </div>
    <button class="btn sm">Сохранить профиль</button>
  </form>

  <span class="label" style="padding:8px 6px 0">Внешний вид</span>
  <section class="card" style="gap:0;padding:4px 14px">
    <div class="list-row"><span class="grow" style="font-weight:500">Тема</span>
      <div class="seg sm" role="radiogroup" aria-label="Тема">${[['light', 'Светлая'], ['dark', 'Тёмная'], ['auto', 'Авто']].map(([k, n]) => `<button role="radio" aria-checked="${s.theme === k}" data-action="setTheme" data-v="${k}">${n}</button>`).join('')}</div></div>
    <div class="list-row"><span class="grow" style="font-weight:500">Акцент</span>
      <div class="row" style="gap:4px">${ACCENTS.map(([c, n]) => `<button class="swatch" aria-pressed="${s.accent === c}" aria-label="Акцент: ${n}" data-action="setAccent" data-v="${c}"><i style="background:${c}"></i></button>`).join('')}</div></div>
  </section>

  <span class="label" style="padding:8px 6px 0">Зал</span>
  <section class="card" style="gap:0;padding:4px 14px">
    <div class="list-row"><div class="grow stack" style="gap:1px"><span style="font-weight:500">Отдых по умолчанию</span><span class="small muted">между подходами</span></div>
      <label class="sr-only" for="restDef">Отдых по умолчанию</label>
      <select id="restDef" class="input" style="width:110px" data-change="setRest">${[45, 60, 75, 90, 120, 150, 180, 240].map((v) => `<option value="${v}" ${v === s.restDefault ? 'selected' : ''}>${fmtTime(v)}</option>`).join('')}</select></div>
    ${sw('autoTimer', 'Автостарт таймера', 'запускать после отметки подхода')}
    ${sw('sound', 'Звук и вибрация', 'когда отдых закончился')}
  </section>

  <span class="label" style="padding:8px 6px 0">Весы Xiaomi S400</span>
  <section class="card" style="gap:0;padding:4px 14px">
    <div class="list-row"><div class="grow stack" style="gap:1px"><span style="font-weight:500">Apple Health</span><span class="small muted">вес, % жира, ИМТ — появится в версии-приложении для iPhone</span></div><span class="small muted">скоро</span></div>
    <div class="list-row"><div class="grow stack" style="gap:1px"><span style="font-weight:500">Облако Xiaomi Home</span><span class="small muted">мышцы, вода, висц. жир и остальное</span></div><span class="small muted">скоро</span></div>
    <div class="list-row"><div class="grow stack" style="gap:1px"><span style="font-weight:500">Сейчас</span><span class="small muted">ручной ввод и импорт CSV в разделе «Тело»</span></div><a class="btn light sm" href="#/body">Открыть</a></div>
  </section>

  <span class="label" style="padding:8px 6px 0">Данные</span>
  <section class="card" style="gap:0;padding:4px 14px">
    <div class="list-row"><div class="grow stack" style="gap:1px"><span style="font-weight:500">Экспорт</span><span class="small muted">все данные одним файлом JSON</span></div><button class="btn light sm" data-action="exportData">${icon('download', 16)}Скачать</button></div>
    <div class="list-row"><div class="grow stack" style="gap:1px"><span style="font-weight:500">Импорт</span><span class="small muted">заменит текущие данные</span></div>
      <label class="btn light sm" style="cursor:pointer">${icon('upload', 16)}Файл<input type="file" accept="application/json,.json" class="sr-only" data-change="importData"></label></div>
    ${backups.map((b) => `<div class="list-row"><div class="grow stack" style="gap:1px"><span style="font-weight:500">Копия перед обновлением</span><span class="small muted">данные из версии ${esc(b)}</span></div><button class="btn light sm" data-action="restoreBackup" data-v="${esc(b)}">Вернуть</button></div>`).join('')}
    <div class="list-row"><div class="grow stack" style="gap:1px"><span style="font-weight:500">Сбросить всё</span><span class="small muted">удалить данные на этом устройстве</span></div><button class="btn danger sm" data-action="resetData">Сбросить</button></div>
  </section>

  <span class="label" style="padding:8px 6px 0">Версии приложения</span>
  <section class="card" style="gap:0;padding:4px 14px">
    <div class="list-row"><div class="grow stack" style="gap:1px"><span style="font-weight:600">Сейчас: ${VERSION}</span><span class="small muted">любую прошлую версию можно открыть ниже — данные общие</span></div>
      <a class="btn light sm" href="${REPO}/releases" target="_blank" rel="noopener">Что нового</a></div>
    ${vlist}
  </section>`;
}

export const actions = {
  saveProfile(form) {
    const n = (v) => { const x = parseInt(v, 10); return Number.isFinite(x) ? x : null; };
    commit((s) => { s.profile = { name: form.name.value.trim(), height: n(form.height.value), birthYear: n(form.birthYear.value), sex: form.sex.value }; });
    toast('Профиль сохранён');
  },
  setTheme(el) { commit((s) => { s.settings.theme = el.dataset.v; }); applyTheme(); },
  setAccent(el) { commit((s) => { s.settings.accent = el.dataset.v; }); applyTheme(); },
  setRest(el) { commit((s) => { s.settings.restDefault = Number(el.value); }); },
  toggleSetting(el) { commit((s) => { s.settings[el.dataset.k] = !s.settings[el.dataset.k]; }); },
  exportData() { download(`ritm-${today()}.json`, exportJSON()); },
  async importData(el) {
    const f = el.files?.[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!confirm('Заменить текущие данные данными из файла?')) return;
      replaceAll(data); applyTheme(); toast('Данные загружены');
    } catch (e) { toast('Файл не подходит'); }
  },
  restoreBackup(el) {
    if (!confirm(`Вернуть данные из копии версии ${el.dataset.v}? Текущие данные будут заменены.`)) return;
    if (restoreBackup(el.dataset.v)) { applyTheme(); toast('Данные восстановлены'); }
  },
  resetData() {
    if (!confirm('Удалить все данные на этом устройстве? Сначала лучше сделать экспорт.')) return;
    resetAll(); applyTheme(); toast('Данные сброшены');
  }
};
