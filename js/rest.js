// Таймер отдыха: переживает перезагрузку страницы (хранится время окончания).
import { state, commit } from './store.js';
import { fmtTime, icon } from './util.js';

let tick = null;
let audioCtx = null;

function left() {
  const r = state.rest;
  if (!r) return 0;
  if (r.pausedLeft != null) return r.pausedLeft;
  return Math.max(0, (r.endAt - Date.now()) / 1000);
}

export function startRest(total) {
  // Разблокируем звук на iOS: AudioContext создаётся в ответ на нажатие.
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume?.(); } catch (e) { /* без звука */ }
  commit((s) => { s.rest = { endAt: Date.now() + total * 1000, total, pausedLeft: null }; }, { render: false });
  paint();
}

function beep() {
  if (!state.settings.sound) return;
  try { navigator.vibrate?.([200, 100, 200]); } catch (e) { /* нет вибрации */ }
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  [0, 0.25, 0.5].forEach((d) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.3, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.18);
    o.start(t + d); o.stop(t + d + 0.2);
  });
}

const handlers = {
  restToggle() {
    commit((s) => {
      const r = s.rest; if (!r) return;
      if (r.pausedLeft != null) { r.endAt = Date.now() + r.pausedLeft * 1000; r.pausedLeft = null; }
      else r.pausedLeft = left();
    }, { render: false });
    paint();
  },
  restShift(el) {
    const d = Number(el.dataset.d);
    commit((s) => {
      const r = s.rest; if (!r) return;
      if (r.pausedLeft != null) r.pausedLeft = Math.max(0, r.pausedLeft + d);
      else r.endAt = Math.max(Date.now(), r.endAt + d * 1000);
      r.total = Math.max(r.total, left());
    }, { render: false });
    paint();
  },
  restStop() { commit((s) => { s.rest = null; }, { render: false }); paint(); }
};
export const restActions = handlers;

export function paint() {
  const el = document.getElementById('rest');
  const main = document.getElementById('view');
  const r = state.rest;
  if (!r) {
    el.hidden = true; main.classList.remove('with-rest');
    clearInterval(tick); tick = null;
    return;
  }
  const l = left();
  const paused = r.pausedLeft != null;
  const C = 2 * Math.PI * 30;
  const dash = `${(C * (r.total ? l / r.total : 0)).toFixed(1)} ${C.toFixed(1)}`;
  const finished = l <= 0;
  el.hidden = false; main.classList.add('with-rest');
  el.setAttribute('role', 'timer');
  el.setAttribute('aria-label', 'Таймер отдыха');
  if (!el.firstChild) {
    el.innerHTML = `<svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r="30" fill="none" stroke="#2E2E2C" stroke-width="6"/>
        <circle class="arc" cx="36" cy="36" r="30" fill="none" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" transform="rotate(-90 36 36)"/>
        <text class="t" x="36" y="42" text-anchor="middle" fill="#fff" font-family="DM Sans, sans-serif" font-size="17" font-weight="700"></text></svg>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="label rl" style="color:#A8A8A3"></span>
          <button data-action="restStop" style="border:0;background:transparent;color:#BDBDB8;font-size:13px;padding:4px 0;min-height:32px">Скрыть</button>
        </div>
        <div style="display:flex;gap:6px">
          <button class="ctl" data-action="restShift" data-d="-15" aria-label="Минус 15 секунд">−15</button>
          <button class="play" data-action="restToggle"></button>
          <button class="ctl" data-action="restShift" data-d="15" aria-label="Плюс 15 секунд">+15</button>
        </div>
      </div>`;
  }
  el.querySelector('.arc').setAttribute('stroke-dasharray', dash);
  el.querySelector('.t').textContent = fmtTime(l);
  el.querySelector('.rl').textContent = finished ? 'Отдых окончен — подход!' : paused ? 'Пауза' : `Отдых · ${fmtTime(r.total)}`;
  const play = el.querySelector('.play');
  play.innerHTML = paused || finished ? icon('play', 16) : icon('pause', 16);
  play.setAttribute('aria-label', finished ? 'Ещё раз' : paused ? 'Продолжить' : 'Пауза');
  if (finished && !r.beeped) { r.beeped = true; beep(); }
  if (finished) play.dataset.action = 'restAgain'; else play.dataset.action = 'restToggle';
  if (!tick) tick = setInterval(paint, 500);
}
handlers.restAgain = () => startRest(state.rest?.total || state.settings.restDefault);
