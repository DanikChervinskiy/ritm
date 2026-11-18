// Состояние интерфейса (не сохраняется) и общие куски разметки.
import { today, icon, esc } from './util.js';

export const ui = {
  route: 'today',
  selDay: today(),
  goalsHorizon: 'day',
  goalsDay: today(),
  habitSel: null,
  habitEdit: null,
  bodyMetric: 'weight',
  bodyPeriod: 30,
  bodyForm: false,
  goalForm: false
};

let renderFn = () => {};
export function setRenderer(fn) { renderFn = fn; }
export function rerender() { renderFn(); }

export function header(title, label, right = '', { back = null } = {}) {
  const left = back
    ? `<a class="icon-btn" href="${back}" aria-label="Назад">${icon('back')}</a>`
    : `<button class="icon-btn burger" data-action="openMenu" aria-label="Открыть меню">${icon('menu')}</button>`;
  return `<header class="header">
    ${left}
    <div class="titles">${label ? `<span class="label">${esc(label)}</span>` : ''}<h1>${esc(title)}</h1></div>
    ${right}
  </header>`;
}

export function checkBtn(pressed, action, data, label, square = false) {
  const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
  return `<button class="check${square ? ' sq' : ''}" data-action="${action}" ${attrs} aria-pressed="${pressed}" aria-label="${esc(label)}"><span class="box">${icon('check', square ? 13 : 14)}</span></button>`;
}
