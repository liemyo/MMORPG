// Developer cheat panel (F10).
import { G, bus, earn, setLevel, makeItem, unlockSkills, isSandbox } from '../state.js';
import { ITEMS, RARITY } from '../items.js';
import { ZONES } from '../zones.js';
import { MAX_LEVEL } from '../data.js';
import { addItem } from '../inventory.js';
import { kill } from '../combat.js';
import { startWarNow } from '../war.js';
import { RENDER, openWin, renderWin } from './windows.js';

const log = (m) => bus.emit('chat', 'cheat', `[DEV] ${m}`);
const opts = (list) => list.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');

RENDER.cheat = {
  open: () => openWin('cheat', 'Developer Panel (F10)', { x: innerWidth - 400, y: 60, w: 360, cls: 'cheat' }),
  html: () => {
    const items = Object.values(ITEMS).map((d) => [d.id, `${d.icon} ${d.name}${d.type === 'equip' ? ` (Lv${d.lv}${d.cls ? ' ' + d.cls : ''})` : ''}`]);
    return `
    <b>Uang</b>
    <div class="row"><input id="ckCr" type="number" value="100000" style="width:110px"><button data-a="cr">+ Credit</button></div>
    <div class="row"><input id="ckSh" type="number" value="1000" style="width:110px"><button data-a="sh">+ Core Shard</button></div>
    <div class="row"><button data-a="mode">Mode: ${isSandbox() ? 'Sandbox ∞ → Normal' : 'Normal → Sandbox ∞'}</button></div>
    <b>Level</b>
    <div class="row"><input id="ckLv" type="number" min="1" max="${MAX_LEVEL}" value="${G.char.level}" style="width:70px"><button data-a="lv">Set level</button><button data-a="sp">+10 SP</button></div>
    <b>Spawn item</b>
    <div class="row"><select id="ckIt" style="max-width:220px">${opts(items)}</select></div>
    <div class="row"><input id="ckQ" type="number" min="1" value="1" style="width:60px">
      <select id="ckR">${opts(Object.keys(RARITY).map((r) => [r, r]))}</select>
      <input id="ckP" type="number" min="0" max="15" value="0" style="width:50px" title="+plus"><button data-a="item">Spawn</button></div>
    <b>Teleport</b>
    <div class="row"><select id="ckZ">${opts(Object.values(ZONES).map((z) => [z.id, z.name]))}</select><button data-a="tp">Go</button></div>
    <div class="row"><input id="ckX" type="number" value="0" style="width:60px"><input id="ckZz" type="number" value="0" style="width:60px"><button data-a="xy">Ke X,Z</button></div>
    <b>Lainnya</b>
    <div class="row"><button data-a="god" class="${G.god ? 'pri' : ''}">God mode: ${G.god ? 'ON' : 'OFF'}</button><button data-a="heal">Full heal</button><button data-a="cd">Reset CD</button></div>
    <div class="row"><button data-a="killt">Bunuh target</button><button data-a="war">Mulai perang</button><button data-a="spd">Speed x2: ${G.speedHack ? 'ON' : 'OFF'}</button></div>`;
  },
  bind: (b) => {
    const v = (id) => b.querySelector(`#${id}`).value;
    const act = {
      cr: () => { earn(+v('ckCr') || 0); log(`+${v('ckCr')} Credit`); },
      sh: () => { earn(0, +v('ckSh') || 0); log(`+${v('ckSh')} Core Shard`); },
      mode: () => { G.char.mode = isSandbox() ? 'normal' : 'sandbox'; bus.emit('money'); log(`Mode ${G.char.mode}`); },
      lv: () => { setLevel(+v('ckLv')); unlockSkills(G.char); bus.emit('stats'); bus.emit('skills'); log(`Level ${G.char.level}`); },
      sp: () => { G.char.sp += 10; bus.emit('skills'); },
      item: () => {
        const d = ITEMS[v('ckIt')], q = Math.max(1, +v('ckQ') || 1);
        const n = d.stack ? 1 : Math.min(q, 40);
        for (let i = 0; i < n; i++) addItem(makeItem(d.id, d.stack ? q : 1, d.type === 'equip' ? { rarity: v('ckR'), plus: Math.max(0, Math.min(15, +v('ckP') || 0)) } : {}));
        log(`Spawn ${q}× ${d.name}`);
      },
      tp: () => bus.emit('travel', v('ckZ')),
      xy: () => { const p = G.player; p.pos.x = +v('ckX') || 0; p.pos.z = +v('ckZz') || 0; },
      god: () => { G.god = !G.god; log(`God mode ${G.god ? 'ON' : 'OFF'}`); },
      heal: () => { G.player.hp = G.player.maxHp; G.player.mp = G.player.maxMp; },
      cd: () => { G.player.cds = {}; },
      killt: () => { if (G.target) kill(G.target, G.player); },
      war: () => { startWarNow(); log('Perang faksi dipicu'); },
      spd: () => { G.speedHack = !G.speedHack; G.player.base.spd = (G.player.base.spd || 0) + (G.speedHack ? 1 : -1); },
    };
    b.querySelectorAll('[data-a]').forEach((el) => (el.onclick = () => { act[el.dataset.a](); renderWin('cheat'); }));
  },
};
