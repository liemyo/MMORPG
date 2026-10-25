// Mobile controls: virtual joystick, touch skill wheel (re-uses the HUD hotbar), action buttons, fullscreen, rotate hint.
import { G, bus } from '../state.js';
import { keys, MOBILE } from '../engine.js';
import { useHotbar, cycleTarget, interactNearest } from '../player.js';
import { toggleWin } from './windows.js';

let ready = false;
export function initMobile() {
  if (!MOBILE || ready) return;
  ready = true;
  const hud = document.getElementById('hud');

  // ---------- Joystick ----------
  const joy = document.createElement('div');
  joy.id = 'mJoy';
  joy.innerHTML = '<div class="base"><div class="knob"></div></div>';
  hud.appendChild(joy);
  const base = joy.firstElementChild, knob = base.firstElementChild;
  let jid = null;
  const R = 52;
  const moveJoy = (e) => {
    const r = base.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    G.joy = { x: dx / R, y: dy / R };
  };
  base.addEventListener('pointerdown', (e) => { e.preventDefault(); jid = e.pointerId; base.setPointerCapture(jid); moveJoy(e); });
  base.addEventListener('pointermove', (e) => { if (e.pointerId === jid) moveJoy(e); });
  const endJoy = (e) => { if (e.pointerId !== jid) return; jid = null; G.joy = null; knob.style.transform = ''; };
  base.addEventListener('pointerup', endJoy);
  base.addEventListener('pointercancel', endJoy);

  // ---------- Skill wheel: the existing hotbar, triggered on pointerdown (multi-touch safe) ----------
  const hb = document.getElementById('hotbar');
  [...hb.children].forEach((el, i) => {
    el.onclick = null;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); useHotbar(i); });
  });

  // ---------- Action buttons ----------
  const acts = document.createElement('div');
  acts.id = 'mActs';
  const btn = (label, cls, down, up) => {
    const b = document.createElement('button');
    b.className = `mBtn ${cls}`; b.innerHTML = label;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); down(); });
    if (up) { b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up); }
    acts.appendChild(b);
    return b;
  };
  btn('🎯<small>Target</small>', 'tgt', () => cycleTarget());
  btn('✋<small>Aksi</small>', 'act', () => interactNearest());
  btn('⤒<small>Lompat</small>', 'jmp', () => keys.add(' '), () => keys.delete(' '));
  btn('🔋<small>MP</small>', 'mp', () => bus.emit('key', '0'));
  hud.appendChild(acts);

  // ---------- Extra menu buttons ----------
  const menu = document.getElementById('menuBtns');
  const extra = (label, title, fn) => {
    const b = document.createElement('button');
    b.innerHTML = label; b.title = title;
    b.addEventListener('click', fn);
    menu.appendChild(b);
  };
  extra('💬', 'Chat', () => document.getElementById('chat').classList.toggle('open'));
  extra('⛶', 'Layar penuh', goFullscreen);
  extra('🛠', 'Developer (F10)', () => toggleWin('cheat'));

  // ---------- Rotate hint (portrait) ----------
  const hint = document.createElement('div');
  hint.id = 'rotateHint';
  hint.innerHTML = '<div>📱↻<br>Putar HP ke <b>landscape</b><br><small>ketuk untuk tutup</small></div>';
  hint.onclick = () => hint.remove();
  document.body.appendChild(hint);

  // First touch in game → try fullscreen + landscape lock (Android; iOS ignores it)
  document.getElementById('game').addEventListener('pointerdown', goFullscreen, { once: true });
}

function goFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!document.fullscreenElement && req) {
    Promise.resolve(req.call(el)).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  }
}
