import { state, commit, exportJSON, replaceAll, resetAll, clearGym, listBackups, restoreBackup, backupNow } from '../store.js';
import { isWorkoutsFile, previewWorkouts, mergeWorkouts } from '../importWorkouts.js';
import { ui, header } from '../ui.js';
import { VERSION } from '../version.js';
import { esc, icon, download, today, toast, fmtTime } from '../util.js';
import { applyTheme } from '../theme.js';
import { sync, signInGoogle, signInEmail, signUpEmail, resetPassword, signOutCloud, syncNow, loadCloudBackups, restoreCloudBackup, errText } from '../sync.js';

const STATUS = {
  loading: 'подключаюсь…', syncing: 'синхронизирую…', synced: 'всё сохранено в облаке',
  offline: 'нет сети — сохранится, когда появится', error: 'ошибка', signedout: '', off: ''
};
const hhmm = (t) => new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function cloudCard() {
  if (!sync.configured) return '';
  let body;
  if (!sync.ready) {
    body = `<div class="list-row"><span class="grow muted">${sync.status === 'offline' ? 'Нет сети — облако подключится, когда она появится' : 'Подключаюсь…'}</span></div>`;
  } else if (!sync.user) {
    body = `<div class="stack" style="gap:10px;padding:12px 0">
      <span class="small muted">Войди — и вся статистика будет храниться в облаке: не пропадёт, даже если удалить приложение, и будет одинаковой на телефоне и компьютере.</span>
      <form class="stack" data-submit="cloudEmail" style="gap:8px">
        <label class="sr-only" for="cEmail">Email</label><input class="input" id="cEmail" name="email" type="email" autocomplete="username" placeholder="Email" required>
        <label class="sr-only" for="cPass">Пароль</label><input class="input" id="cPass" name="pass" type="password" autocomplete="current-password" placeholder="Пароль (от 6 символов)" required>
        <div class="row" style="gap:8px"><button class="btn sm grow" name="mode" value="in">Войти</button><button class="btn light sm grow" name="mode" value="up">Создать аккаунт</button></div>
        <button type="button" class="btn light sm" data-action="cloudReset" style="background:transparent">Забыли пароль?</button>
      </form>
      <span class="label" style="padding-top:4px">или</span>
      <button class="btn light block" data-action="cloudGoogle">Войти через Google</button>
      <span class="small muted">На телефоне и компьютере входи одним и тем же способом — иначе это будут два разных аккаунта.</span>
    </div>`;
  } else {
    const st = sync.status === 'error' ? 'ошибка: ' + sync.error : STATUS[sync.status] || '';
    const last = sync.lastAt ? ' · ' + hhmm(sync.lastAt) : '';
    const backups = sync.backups == null
      ? `<div class="list-row"><div class="grow stack" style="gap:1px"><span style="font-weight:500">Копии в облаке</span><span class="small muted">раз в неделю, хранятся 8 недель</span></div><button class="btn light sm" data-action="cloudBackups">Показать</button></div>`
      : (sync.backups.length ? sync.backups : [{ week: '' }]).map((b) => b.week
        ? `<div class="list-row"><div class="grow stack" style="gap:1px"><span style="font-weight:500">Копия ${esc(b.week.replace('-W', ', неделя '))}</span><span class="small muted">${b.createdAt ? hhmm(b.createdAt) : ''}${b.device ? ' · ' + esc(b.device) : ''}</span></div><button class="btn light sm" data-action="cloudRestore" data-v="${esc(b.week)}">Вернуть</button></div>`
        : `<div class="list-row"><span class="grow small muted">Копий пока нет — первая появится после синхронизации</span></div>`).join('');
    body = `<div class="list-row"><div class="grow stack" style="gap:1px;min-width:0"><span style="font-weight:600;overflow:hidden;text-overflow:ellipsis">${esc(sync.user.email || sync.user.name || 'Аккаунт')}</span><span class="small ${sync.status === 'error' ? '' : 'muted'}" ${sync.status === 'error' ? 'style="color:var(--bad)"' : ''} role="status">${esc(st + last)}</span></div>
      <button class="btn light sm" data-action="cloudSync" aria-label="Синхронизировать сейчас">${icon('refresh', 16)}</button></div>
      ${backups}
      <div class="list-row"><span class="grow small muted">Выйти: данные останутся на этом устройстве, но перестанут сохраняться в облако</span><button class="btn danger sm" data-action="cloudSignOut">Выйти</button></div>`;
  }
  return `<span class="label" style="padding:8px 6px 0">Облако</span>
  <section class="card" style="gap:0;padding:4px 14px">${body}</section>`;
}

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

  ${cloudCard()}

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
    <div class="list-row"><div class="grow stack" style="gap:1px"><span style="font-weight:500">Добавить тренировки из файла</span><span class="small muted">история и программы дописываются к текущим данным, ничего не стирается</span></div>
      <label class="btn light sm" style="cursor:pointer">${icon('upload', 16)}Файл<input type="file" accept="application/json,.json" class="sr-only" data-change="importWorkouts"></label></div>
    ${backups.map((b) => `<div class="list-row"><div class="grow stack" style="gap:1px"><span style="font-weight:500">${/^\d+\.\d+\.\d+$/.test(b) ? 'Копия перед обновлением' : 'Копия на устройстве'}</span><span class="small muted">${/^\d+\.\d+\.\d+$/.test(b) ? 'данные из версии ' + esc(b) : esc(b)}</span></div><button class="btn light sm" data-action="restoreBackup" data-v="${esc(b)}">Вернуть</button></div>`).join('')}
    <div class="list-row"><div class="grow stack" style="gap:1px"><span style="font-weight:500">Очистить зал</span><span class="small muted">удалить все тренировки, программы, упражнения и отметки привычки «тренировка»; остальное останется</span></div><button class="btn danger sm" data-action="clearGym">Очистить</button></div>
    <div class="list-row"><div class="grow stack" style="gap:1px"><span style="font-weight:500">Сбросить всё</span><span class="small muted">удалить данные на этом устройстве</span></div><button class="btn danger sm" data-action="resetData">Сбросить</button></div>
  </section>

  <span class="label" style="padding:8px 6px 0">Версии приложения</span>
  <section class="card" style="gap:0;padding:4px 14px">
    <div class="list-row"><div class="grow stack" style="gap:1px"><span style="font-weight:600">Сейчас: ${VERSION}</span><span class="small muted">любую прошлую версию можно открыть ниже — данные общие</span></div>
      <a class="btn light sm" href="${REPO}/releases" target="_blank" rel="noopener">Что нового</a></div>
    ${vlist}
  </section>`;
}

const busy = async (fn, ok) => { try { await fn(); if (ok) toast(ok); } catch (e) { console.error(e); toast(errText(e)); } };

function addWorkouts(data) {
  const p = previewWorkouts(state, data);
  if (!p.workouts) { toast('Эти тренировки уже добавлены'); return; }
  const fmt = (d) => d.split('-').reverse().join('.');
  const msg = [
    `Добавить ${p.workouts} тренировок (${fmt(p.from)} – ${fmt(p.to)})?`,
    p.newTemplates.length ? `Новые программы: ${p.newTemplates.join(', ')}.` : 'Программы с такими названиями уже есть — их не трогаю.',
    p.newExercises ? `Новых упражнений: ${p.newExercises}.` : '',
    p.habit ? `Привычка «${p.habit}» отметится в эти дни.` : 'Будет создана привычка «Тренировка» (3× в неделю) и отмечена в эти дни.',
    'Текущие данные не стираются.'
  ].filter(Boolean).join('\n');
  if (!confirm(msg)) return;
  backupNow('до импорта тренировок ' + today());
  let res;
  commit((s) => { res = mergeWorkouts(s, data); });
  toast(`Добавлено тренировок: ${res.added}`);
}

export const actions = {
  cloudGoogle() { busy(signInGoogle); },
  cloudEmail(form, e) {
    const email = form.email.value.trim(), pass = form.pass.value;
    const up = e.submitter?.value === 'up';
    busy(() => (up ? signUpEmail(email, pass) : signInEmail(email, pass)), up ? 'Аккаунт создан' : '');
  },
  cloudReset(el) {
    const email = el.closest('form').email.value.trim();
    if (!email) { toast('Сначала впиши email'); return; }
    busy(() => resetPassword(email), 'Письмо для смены пароля отправлено');
  },
  cloudSync() { busy(syncNow); },
  cloudSignOut() {
    if (!confirm('Выйти из аккаунта? Данные на этом устройстве останутся.')) return;
    busy(signOutCloud, 'Вы вышли');
  },
  cloudBackups() { busy(loadCloudBackups); },
  cloudRestore(el) {
    if (!confirm(`Вернуть данные из копии ${el.dataset.v}? Текущие данные будут заменены (на устройстве сохранится их копия).`)) return;
    busy(() => restoreCloudBackup(el.dataset.v), 'Данные восстановлены');
  },
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
      if (isWorkoutsFile(data)) { el.value = ''; return addWorkouts(data); } // файл истории тренировок — дописываем, а не заменяем
      if (!confirm('Заменить текущие данные данными из файла?')) return;
      replaceAll(data); applyTheme(); toast('Данные загружены');
    } catch (e) { toast('Файл не подходит'); }
  },
  async importWorkouts(el) {
    const f = el.files?.[0];
    el.value = '';
    if (!f) return;
    let data;
    try { data = JSON.parse(await f.text()); } catch (e) { toast('Файл не подходит'); return; }
    if (!isWorkoutsFile(data)) { toast('Это не файл с тренировками'); return; }
    addWorkouts(data);
  },
  restoreBackup(el) {
    if (!confirm(`Вернуть данные из копии версии ${el.dataset.v}? Текущие данные будут заменены.`)) return;
    if (restoreBackup(el.dataset.v)) { applyTheme(); toast('Данные восстановлены'); }
  },
  clearGym() {
    if (!confirm('Удалить все тренировки, программы и упражнения, а также отметки привычки про зал? Привычки, цели и вес останутся. Копия сохранится на устройстве.')) return;
    clearGym(); toast('Зал очищен — можно начинать с нуля');
  },
  resetData() {
    const msg = sync.user
      ? 'Удалить все данные? Они удалятся и на этом устройстве, и в облаке (недельные копии в облаке останутся).'
      : 'Удалить все данные на этом устройстве? Сначала лучше сделать экспорт.';
    if (!confirm(msg)) return;
    resetAll(); applyTheme(); toast('Данные сброшены');
  }
};
