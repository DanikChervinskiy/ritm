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
      { id: uid(), name: 'Утро без телефона', perWeek: 7, created: today() },
      { id: uid(), name: 'Чтение 20 минут', perWeek: 7, created: today() },
      { id: uid(), name: '2 литра воды', perWeek: 7, created: today() }
    ],
    checks: {},          // { 'YYYY-MM-DD': [habitId, ...] }
    goals: [],           // { id, title, horizon, period, target, current, done, parentId, created }
    exercises: [],       // { id, name, rest }
    workouts: [],        // { id, name, date, startedAt, finishedAt, items: [{ exerciseId, sets: [{ w, r, done }] }] }
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
  for (const k of ['habits', 'goals', 'exercises', 'workouts', 'body']) if (!Array.isArray(out[k])) out[k] = [];
  if (!out.checks || typeof out.checks !== 'object') out.checks = {};
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

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error(e); }
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
