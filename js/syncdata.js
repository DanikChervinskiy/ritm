// Чистые функции синхронизации (без браузера и Firebase) — их легко проверить.
// Данные делятся на документы Firestore, чтобы ни один не упёрся в лимит 1 МБ:
//   core            — профиль, настройки, привычки, упражнения и всё прочее
//   checks-ГГГГ     — отметки привычек за год (checks + partial)
//   goals-ГГГГ      — цели и задачи с периодом в этом году
//   workouts-ГГГГ   — тренировки года
//   body-ГГГГ       — замеры тела года
// В облаке документ хранится как JSON-строка — так Firestore принимает любые данные как есть.

export const EMPTY = '{}';
const SPLIT = ['checks', 'partial', 'goals', 'workouts', 'body'];
const LOCAL_ONLY = ['appVersion', 'schema'];

function yearOf(v) {
  if (typeof v === 'string' && /^\d{4}/.test(v)) return v.slice(0, 4);
  if (typeof v === 'number' && v > 0) return String(new Date(v).getFullYear());
  return '0000';
}

export function toDocObjects(s) {
  const core = {};
  for (const [k, v] of Object.entries(s)) if (!SPLIT.includes(k) && !LOCAL_ONLY.includes(k)) core[k] = v;
  const docs = { core };
  const get = (id, init) => (docs[id] ||= init());
  for (const [day, ids] of Object.entries(s.checks || {})) get('checks-' + yearOf(day), () => ({ checks: {}, partial: {} })).checks[day] = ids;
  for (const [day, ids] of Object.entries(s.partial || {})) get('checks-' + yearOf(day), () => ({ checks: {}, partial: {} })).partial[day] = ids;
  for (const g of s.goals || []) get('goals-' + yearOf(g.period || g.created), () => ({ goals: [] })).goals.push(g);
  for (const w of s.workouts || []) get('workouts-' + yearOf(w.date || w.startedAt), () => ({ workouts: [] })).workouts.push(w);
  for (const b of s.body || []) get('body-' + yearOf(b.date), () => ({ body: [] })).body.push(b);
  return docs;
}

export function toDocStrings(s) {
  const out = {};
  for (const [id, o] of Object.entries(toDocObjects(s))) out[id] = JSON.stringify(o);
  return out;
}

export function fromDocObjects(docs) {
  const out = { ...(docs.core || {}), checks: {}, partial: {}, goals: [], workouts: [], body: [] };
  for (const id of Object.keys(docs).filter((k) => k !== 'core').sort()) {
    const o = docs[id] || {};
    Object.assign(out.checks, o.checks || {});
    Object.assign(out.partial, o.partial || {});
    if (Array.isArray(o.goals)) out.goals.push(...o.goals);
    if (Array.isArray(o.workouts)) out.workouts.push(...o.workouts);
    if (Array.isArray(o.body)) out.body.push(...o.body);
  }
  return out;
}

// Короткий отпечаток строки (FNV-1a), чтобы не хранить копию всех данных.
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + ':' + str.length.toString(36);
}

// Что делать с документом из облака.
//   local      — JSON этого документа на устройстве (или EMPTY)
//   remote     — { json, updatedAt } из облака
//   synced     — отпечаток последней синхронизированной версии
//   changedAt  — когда документ последний раз меняли на устройстве
// Возвращает 'skip' (уже совпадает), 'mark' (содержимое то же — просто отметить),
// 'apply' (взять облако) или 'keep' (локальная правка новее — отправить свою).
export function decide(local, remote, synced, changedAt) {
  const rh = hash(remote.json || EMPTY);
  if (rh === synced) return 'skip';
  const lh = hash(local || EMPTY);
  if (lh === rh) return 'mark';
  const localDirty = lh !== synced;
  if (localDirty && (changedAt || 0) > (remote.updatedAt || 0)) return 'keep';
  return 'apply';
}
