// Хранилище данных: localStorage + автоматические резервные копии при смене версии.
import { VERSION } from './version.js';

const KEY = 'ritm:data';
const BACKUP_PREFIX = 'ritm:backup:';
export const SCHEMA = 1;

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function defaults() {
  return {
    schema: SCHEMA,
    appVersion: VERSION,
    profile: { name: '', height: null, birthYear: null, sex: '' },
    settings: { theme: 'auto', accent: '#E8613C', restDefault: 90, autoTimer: true, sound: true, weekStart: 1 },
    habits: [
      { id: uid(), name: 'Утро без телефона', icon: 'phoneoff', perWeek: 7, created: today() },
      { id: uid(), name: 'Чтение 20 минут', icon: 'book', perWeek: 7, created: today() },
      { id: uid(), name: '2 литра воды', icon: 'water', perWeek: 7, created: today() }
    ],
    checks: {},          // { 'YYYY-MM-DD': [habitId, ...] } — выполнено
    partial: {},         // { 'YYYY-MM-DD': [habitId, ...] } — выполнено частично
    goals: [],           // { id, title, horizon, period, target, current, done, parentId, created, categoryId? }
    categories: [],      // { id, name, kind: 'habit' | 'goal' } — с v0.4.0; у привычек и целей поле categoryId
    exercises: [],       // { id, name, rest }
    templates: [],       // программы тренировок (с v0.5.0): { id, name, items: [{ exerciseId, sets }], habitId? }
    workouts: [],        // { id, name, date, startedAt, finishedAt, templateId?, items: [{ exerciseId, sets: [{ w, r, done }] }] }
    activeWorkoutId: null,
    body: [],            // { id, date, weight, fat, muscle, water, visceral, bone, protein, bmr, bmi, source }
    rest: null           // { endAt, total, pausedLeft }
  };
}

export function today(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function migrate(data) {
  const base = defaults();
  const out = { ...base, ...data };
  out.settings = { ...base.settings, ...(data.settings || {}) };
  out.profile = { ...base.profile, ...(data.profile || {}) };
  for (const k of ['habits', 'goals', 'exercises', 'workouts', 'body', 'categories', 'templates']) if (!Array.isArray(out[k])) out[k] = [];
  if (!out.checks || typeof out.checks !== 'object') out.checks = {};
  if (!out.partial || typeof out.partial !== 'object') out.partial = {}; // с v0.2.0: частично выполненные привычки
  out.schema = SCHEMA;
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const data = JSON.parse(raw);
    if (data.appVersion && data.appVersion !== VERSION) {
      // Перед первой загрузкой новой версии сохраняем копию данных старой версии.
      try { localStorage.setItem(BACKUP_PREFIX + data.appVersion, raw); } catch (e) { /* место закончилось */ }
    }
    return migrate(data);
  } catch (e) {
    console.error('Не удалось прочитать данные', e);
    return defaults();
  }
}

export const state = load();
state.appVersion = VERSION;

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

let saveHook = null;
// Синхронизация подписывается сюда, чтобы узнавать о каждом сохранении.
export function onSave(fn) { saveHook = fn; }

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error(e); }
  saveHook?.();
}

// Отдельная копия текущих данных (например, перед заменой данными из облака).
export function backupNow(label) {
  try { localStorage.setItem(BACKUP_PREFIX + label, JSON.stringify(state)); } catch (e) { /* место закончилось */ }
}

export function commit(mutator, { render = true } = {}) {
  mutator(state);
  save();
  if (render) listeners.forEach((fn) => fn());
}

export function listBackups() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(BACKUP_PREFIX)) out.push(k.slice(BACKUP_PREFIX.length));
  }
  return out.sort().reverse();
}

export function restoreBackup(version) {
  const raw = localStorage.getItem(BACKUP_PREFIX + version);
  if (!raw) return false;
  replaceAll(JSON.parse(raw));
  return true;
}

export function replaceAll(data) {
  const next = migrate(data);
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, next, { appVersion: VERSION });
  save();
  listeners.forEach((fn) => fn());
}

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function resetAll() {
  replaceAll(defaults());
}

save();
