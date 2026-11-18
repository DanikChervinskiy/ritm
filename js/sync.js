// Синхронизация с облаком (Firebase: вход + база Firestore).
// Устройство по-прежнему работает со своими данными в localStorage, а этот модуль
// тихо отправляет изменения в облако и забирает чужие (с другого устройства).
// Если нет сети — всё работает как раньше, отправится позже.
import { state, onSave, replaceAll, backupNow } from './store.js';
import { firebaseConfig } from './firebase-config.js';
import { toDocStrings, toDocObjects, fromDocObjects, hash, decide, EMPTY } from './syncdata.js';
import { applyTheme } from './theme.js';
import { today, isoWeek } from './util.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.18.0/';
const META_KEY = 'ritm:sync';
const KEEP_BACKUPS = 8; // недель еженедельных копий в облаке

export const sync = {
  configured: !!(firebaseConfig && firebaseConfig.apiKey),
  ready: false,      // SDK загружен, знаем, вошёл ли пользователь
  user: null,        // { uid, email, name }
  status: 'off',     // off | loading | signedout | syncing | synced | offline | error
  lastAt: null,
  error: '',
  backups: null      // список недельных копий в облаке (грузится по кнопке)
};

const listeners = new Set();
export function onSyncChange(fn) { listeners.add(fn); }
function emit() { listeners.forEach((fn) => fn()); }
function setStatus(st, err = '') { sync.status = st; sync.error = err; emit(); }

let fb = null;         // модули Firebase
let auth = null, db = null;
let unsubSnap = null;
let meta = loadMeta(); // { uid, initialized, hashes, changedAt, lh, backupWeek, lastAt }

function loadMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch (e) { return {}; }
}
function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* ничего */ } }
function freshMeta(uid) { return { uid, initialized: false, hashes: {}, changedAt: {}, lh: {}, backupWeek: null, lastAt: null }; }

const device = /iPhone|iPad|Android/.test(navigator.userAgent) ? 'телефон' : 'компьютер';
const weekKey = () => { const w = isoWeek(today()); return `${w.year}-W${String(w.week).padStart(2, '0')}`; };

// ---------- запуск ----------
export async function initSync() {
  sync.lastAt = meta.lastAt || null;
  if (!sync.configured) return;
  setStatus('loading');
  try {
    const [app, a, f] = await Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-auth.js'),
      import(SDK + 'firebase-firestore.js')
    ]);
    fb = { ...app, ...a, ...f };
  } catch (e) {
    // Нет сети при самом первом запуске — попробуем, когда она появится.
    setStatus('offline');
    window.addEventListener('online', () => { if (!fb) initSync(); }, { once: true });
    return;
  }
  const app = fb.initializeApp(firebaseConfig);
  auth = fb.getAuth(app);
  auth.languageCode = 'ru';
  db = fb.getFirestore(app);
  onSave(onLocalSave);
  fb.onAuthStateChanged(auth, (user) => {
    sync.ready = true;
    if (user) {
      sync.user = { uid: user.uid, email: user.email || '', name: user.displayName || '' };
      if (meta.uid !== user.uid) { meta = freshMeta(user.uid); saveMeta(); }
      startListening();
    } else {
      sync.user = null;
      stopListening();
      setStatus('signedout');
    }
    emit();
  });
  window.addEventListener('online', () => schedulePush(0));
  window.addEventListener('offline', () => { if (sync.user) setStatus('offline'); });
}

// ---------- вход / выход ----------
const ERRORS = {
  'auth/invalid-email': 'Неверный email',
  'auth/missing-password': 'Введи пароль',
  'auth/weak-password': 'Пароль слишком короткий — минимум 6 символов',
  'auth/email-already-in-use': 'Такой аккаунт уже есть — нажми «Войти»',
  'auth/invalid-credential': 'Неверный email или пароль',
  'auth/wrong-password': 'Неверный пароль',
  'auth/user-not-found': 'Аккаунта нет — нажми «Создать аккаунт»',
  'auth/too-many-requests': 'Слишком много попыток, подожди пару минут',
  'auth/network-request-failed': 'Нет сети',
  'auth/popup-blocked': 'Окно входа заблокировано. На iPhone удобнее войти по email',
  'auth/popup-closed-by-user': 'Окно входа закрыто',
  'auth/cancelled-popup-request': 'Окно входа закрыто',
  'auth/unauthorized-domain': 'Домен не разрешён в Firebase (Authentication → Settings → Authorized domains)',
  'auth/operation-not-allowed': 'Этот способ входа не включён в Firebase',
  'permission-denied': 'Нет доступа к базе — проверь правила Firestore'
};
export const errText = (e) => ERRORS[e?.code] || e?.message || 'Что-то пошло не так';

export async function signInGoogle() {
  const provider = new fb.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await fb.signInWithPopup(auth, provider);
}
export async function signInEmail(email, pass) { await fb.signInWithEmailAndPassword(auth, email, pass); }
export async function signUpEmail(email, pass) { await fb.createUserWithEmailAndPassword(auth, email, pass); }
export async function resetPassword(email) { await fb.sendPasswordResetEmail(auth, email); }
export async function signOutCloud() {
  stopListening();
  await fb.signOut(auth);
  meta = {}; saveMeta();
  sync.backups = null;
}

// ---------- получение изменений из облака ----------
const docsCol = () => fb.collection(db, 'users', sync.user.uid, 'docs');

function startListening() {
  stopListening();
  setStatus('syncing');
  unsubSnap = fb.onSnapshot(docsCol(), (snap) => {
    if (snap.metadata.hasPendingWrites) return;
    const remote = {};
    snap.docs.forEach((d) => { remote[d.id] = d.data(); });
    handleRemote(remote, snap.metadata.fromCache);
  }, (e) => setStatus('error', errText(e)));
}
function stopListening() { unsubSnap?.(); unsubSnap = null; clearTimeout(pushTimer); }

function handleRemote(remote, fromCache) {
  if (!meta.initialized) {
    if (fromCache) return; // ждём ответа сервера
    if (Object.keys(remote).length) {
      // В облаке уже есть данные (например, вход на втором устройстве):
      // берём облако, а то, что было на устройстве, сохраняем копией.
      backupNow('до входа ' + today());
      const objs = {};
      for (const [id, d] of Object.entries(remote)) { objs[id] = JSON.parse(d.json || EMPTY); meta.hashes[id] = hash(d.json || EMPTY); }
      meta.initialized = true;
      applyObjects(objs, Object.keys(remote));
    } else {
      meta.initialized = true; // облако пустое — отправим всё с этого устройства
    }
    saveMeta();
    schedulePush(0);
    return;
  }
  const local = toDocStrings(state);
  const objs = toDocObjects(state);
  let changed = false;
  const applied = [];
  for (const [id, d] of Object.entries(remote)) {
    const r = { json: d.json || EMPTY, updatedAt: d.updatedAt || 0 };
    const what = decide(local[id], r, meta.hashes[id], meta.changedAt[id]);
    if (what === 'mark') meta.hashes[id] = hash(r.json);
    else if (what === 'apply') { objs[id] = JSON.parse(r.json); meta.hashes[id] = hash(r.json); changed = true; applied.push(id); }
  }
  if (changed) applyObjects(objs, applied);
  saveMeta();
  schedulePush(changed ? 300 : 0);
}

// Применить документы из облака. После применения данные проходят migrate() и могут
// записаться чуть иначе (порядок полей, новые поля) — синхронизированным считаем именно
// этот вид, иначе два устройства пересылали бы друг другу одно и то же по кругу.
function applyObjects(objs, ids = []) {
  replaceAll(fromDocObjects(objs));
  const local = toDocStrings(state);
  for (const id of ids) meta.hashes[id] = hash(local[id] ?? EMPTY);
  saveMeta();
  applyTheme();
}

// ---------- отправка изменений в облако ----------
let pushTimer = null, pushing = false, again = false;

function onLocalSave() {
  if (!sync.user) return;
  // запоминаем, когда меняли каждый документ — это решает спор «чья правка новее»
  const local = toDocStrings(state);
  const now = Date.now();
  for (const id of new Set([...Object.keys(local), ...Object.keys(meta.lh || {})])) {
    const h = hash(local[id] ?? EMPTY);
    if ((meta.lh ||= {})[id] !== h) { meta.lh[id] = h; meta.changedAt[id] = now; }
  }
  saveMeta();
  schedulePush(1200);
}

function schedulePush(delay = 1200) {
  if (!sync.user || !meta.initialized) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, delay);
}

async function push() {
  if (!sync.user || !meta.initialized) return;
  if (pushing) { again = true; return; }
  const local = toDocStrings(state);
  const writes = [];
  for (const id of new Set([...Object.keys(local), ...Object.keys(meta.hashes)])) {
    const json = local[id] ?? EMPTY;
    const h = hash(json);
    if (h !== meta.hashes[id]) writes.push({ id, json, h });
  }
  if (!writes.length) { done(); await weeklyBackup(); return; }
  pushing = true;
  setStatus(navigator.onLine === false ? 'offline' : 'syncing');
  try {
    const batch = fb.writeBatch(db);
    for (const w of writes) {
      batch.set(fb.doc(db, 'users', sync.user.uid, 'docs', w.id), { json: w.json, updatedAt: meta.changedAt[w.id] || Date.now(), device });
    }
    await batch.commit();
    for (const w of writes) meta.hashes[w.id] = w.h;
    done();
  } catch (e) {
    console.error(e);
    setStatus('error', errText(e));
  } finally {
    pushing = false;
    if (again) { again = false; schedulePush(300); }
  }
  await weeklyBackup();
}

function done() {
  meta.lastAt = sync.lastAt = Date.now();
  saveMeta();
  setStatus('synced');
}

// Кнопка «Синхронизировать»: забрать всё с сервера и отправить своё.
export async function syncNow() {
  if (!sync.user) return;
  setStatus('syncing');
  try {
    const snap = await fb.getDocsFromServer(docsCol());
    const remote = {};
    snap.docs.forEach((d) => { remote[d.id] = d.data(); });
    handleRemote(remote, false);
    await push();
  } catch (e) { setStatus(navigator.onLine === false ? 'offline' : 'error', errText(e)); }
}

// ---------- еженедельные копии в облаке ----------
// Раз в неделю кладём полный снимок в users/<uid>/backups/<неделя>/parts/<документ>.
// Хранятся последние KEEP_BACKUPS недель — на случай случайного «Сбросить всё».
async function weeklyBackup() {
  const wk = weekKey();
  if (!sync.user || meta.backupWeek === wk || navigator.onLine === false) return;
  try {
    const uid = sync.user.uid;
    const local = toDocStrings(state);
    const batch = fb.writeBatch(db);
    batch.set(fb.doc(db, 'users', uid, 'backups', wk), { createdAt: Date.now(), device, ids: Object.keys(local) });
    for (const [id, json] of Object.entries(local)) batch.set(fb.doc(db, 'users', uid, 'backups', wk, 'parts', id), { json });
    await batch.commit();
    meta.backupWeek = wk; saveMeta();
    // старые копии удаляем
    const all = await fb.getDocs(fb.collection(db, 'users', uid, 'backups'));
    const old = all.docs.map((d) => d.id).sort().reverse().slice(KEEP_BACKUPS);
    for (const w of old) {
      const parts = await fb.getDocs(fb.collection(db, 'users', uid, 'backups', w, 'parts'));
      const del = fb.writeBatch(db);
      parts.docs.forEach((p) => del.delete(p.ref));
      del.delete(fb.doc(db, 'users', uid, 'backups', w));
      await del.commit();
    }
    sync.backups = null;
  } catch (e) { console.error('Копия в облаке не сохранилась', e); }
}

export async function loadCloudBackups() {
  const snap = await fb.getDocs(fb.collection(db, 'users', sync.user.uid, 'backups'));
  sync.backups = snap.docs.map((d) => ({ week: d.id, ...d.data() })).sort((a, b) => b.week.localeCompare(a.week));
  emit();
}

export async function restoreCloudBackup(week) {
  const snap = await fb.getDocs(fb.collection(db, 'users', sync.user.uid, 'backups', week, 'parts'));
  const objs = {};
  snap.docs.forEach((d) => { objs[d.id] = JSON.parse(d.data().json || EMPTY); });
  if (!objs.core) throw new Error('Копия пустая');
  backupNow('до восстановления ' + today());
  applyObjects(objs); // сохранение само отправит восстановленные данные в облако
}
