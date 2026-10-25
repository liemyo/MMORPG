// Window manager + Inventory, Character and Skills windows.
import { G, bus, itemStats, computeStats, credit, shard, fmtMoney } from '../state.js';
import { SKILLS, SKILL_MAX_RANK, FACTIONS, CLASSES, JOBS, classSkills } from '../data.js';
import { ITEMS, RARITY, SLOTS, SLOT_NAMES } from '../items.js';
import { useItem, unequip, sell, sellPrice, sortInventory, canEquip } from '../inventory.js';
import { jobTitle } from '../quests.js';
import { showTip, hideTip, esc, refreshHotbar } from './hud.js';

const host = () => document.getElementById('windows');
const wins = {};
let zTop = 10;
export const RENDER = {};

export function isOpen(id) { return !!wins[id]; }
export function anyOpen() { return Object.keys(wins).length > 0; }

export function openWin(id, title, opts = {}) {
  let w = wins[id];
  if (!w) {
    const el = document.createElement('div');
    el.className = `win ${opts.cls || ''}`;
    el.innerHTML = `<div class="wh"><span class="t"></span><button class="x">✕</button></div><div class="wb"></div>`;
    const n = Object.keys(wins).length;
    el.style.left = `${opts.x ?? 120 + n * 30}px`; el.style.top = `${opts.y ?? 80 + n * 24}px`;
    if (opts.w) el.style.width = `${opts.w}px`;
    el.querySelector('.x').onclick = () => closeWin(id);
    drag(el, el.querySelector('.wh'));
    // bring to front via z-index; moving the node in the DOM would cancel the click
    el.style.zIndex = ++zTop;
    el.addEventListener('mousedown', () => { el.style.zIndex = ++zTop; });
    host().appendChild(el);
    w = wins[id] = { el, title, opts };
  }
  w.el.querySelector('.t').textContent = title;
  renderWin(id);
  return w;
}
export function closeWin(id) { const w = wins[id]; if (!w) return; w.el.remove(); delete wins[id]; hideTip(); w.opts.onClose?.(); }
export function closeAll() { Object.keys(wins).forEach(closeWin); }
export function toggleWin(id) { if (wins[id]) closeWin(id); else RENDER[id]?.open(); }
export function renderWin(id) {
  const w = wins[id]; if (!w || !RENDER[id]) return;
  const body = w.el.querySelector('.wb');
  const st = body.scrollTop;
  body.innerHTML = RENDER[id].html();
  RENDER[id].bind?.(body);
  body.scrollTop = st;
}
export function refreshAll() { Object.keys(wins).forEach(renderWin); }
['inv', 'stats', 'money', 'quest', 'skills', 'levelup', 'zone', 'war'].forEach((ev) => bus.on(ev, refreshAll));

function drag(el, handle) {
  handle.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    const ox = e.clientX - el.offsetLeft, oy = e.clientY - el.offsetTop;
    const mv = (ev) => { el.style.left = `${Math.max(0, ev.clientX - ox)}px`; el.style.top = `${Math.max(0, ev.clientY - oy)}px`; };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  });
}

// ---------- Item helpers ----------
const STAT_NAMES = { atk: 'ATK', def: 'DEF', hp: 'HP', mp: 'MP', crit: 'CRIT', spd: 'SPD' };
const fmtStat = (k, v) => (k === 'crit' || k === 'spd' ? `${(v * 100).toFixed(1)}%` : Math.round(v));
export function itemName(inst) {
  const d = ITEMS[inst.id];
  return `${d.name}${inst.plus ? ` +${inst.plus}` : ''}`;
}
export function itemTip(inst, extra = '') {
  const d = ITEMS[inst.id], r = RARITY[inst.rarity || 'common'];
  let h = `<h5 style="color:${r.css}">${d.icon} ${esc(itemName(inst))}</h5>`;
  if (d.type === 'equip') {
    const st = itemStats(inst);
    h += `<small>${SLOT_NAMES[d.slot]} · ${r.name} · Lv ${d.lv}${d.cls ? ` · ${CLASSES[d.cls].name}` : ''}</small><br>`;
    h += Object.entries(st).map(([k, v]) => `${STAT_NAMES[k]} +${fmtStat(k, v)}`).join('<br>');
    h += `<br><small>Slot permata: ${inst.gems.length}/${d.sockets}</small>`;
    inst.gems.forEach((g) => (h += `<br><small>• ${ITEMS[g].icon} ${ITEMS[g].name}</small>`));
    const why = canEquip(inst); if (why) h += `<br><span class="bad">${why}</span>`;
  } else if (d.type === 'gem') h += `Permata: ${STAT_NAMES[d.stat]} +${fmtStat(d.stat, d.val)}<br><small>Pasang di Refiner</small>`;
  else if (d.type === 'use') h += `<small>Klik kanan / dobel klik untuk pakai</small>`;
  else h += '<small>Bahan crafting</small>';
  if (inst.qty > 1) h += `<br>Jumlah: ${inst.qty}`;
  h += `<br><small>Jual: ${sellPrice(inst)} Credit</small>${extra}`;
  return h;
}
export function slotHtml(inst, attrs = '') {
  if (!inst) return `<div class="slot" ${attrs}></div>`;
  const d = ITEMS[inst.id];
  return `<div class="slot ${inst.rarity || ''}" ${attrs}>${d.icon}${inst.plus ? `<span class="p">+${inst.plus}</span>` : ''}${inst.qty > 1 ? `<span class="q">${inst.qty}</span>` : ''}</div>`;
}

// ---------- Inventory ----------
export const invSel = { idx: -1, onPick: null };
RENDER.inventory = {
  open: () => openWin('inventory', 'Inventaris (I)', { x: innerWidth - 440, y: 90 }),
  html: () => `
    <div class="grid">${G.char.inv.map((x, i) => slotHtml(x, `data-i="${i}" class="${invSel.idx === i ? 'sel' : ''}"`)).join('')}</div>
    <div class="row" style="margin-top:8px">
      <span class="gold">◎ ${fmtMoney(credit())}</span><span class="gold">◆ ${fmtMoney(shard())}</span>
      <span style="flex:1"></span>
      <button data-a="use">Pakai</button>${isOpen('shop') ? '<button data-a="sell">Jual</button>' : ''}<button data-a="sort">Urutkan</button>
    </div>
    <small>Klik = pilih · dobel klik / klik kanan = pakai/equip${isOpen('shop') ? ' · Shift+klik = jual' : ''}</small>`,
  bind: (b) => {
    b.querySelectorAll('.slot').forEach((s) => {
      const i = +s.dataset.i;
      const inst = G.char.inv[i];
      if (invSel.idx === i) s.classList.add('sel');
      s.onclick = (e) => {
        if (inst && e.shiftKey && isOpen('shop')) return sell(i);
        if (inst && invSel.onPick) return invSel.onPick(i);
        invSel.idx = i; renderWin('inventory');
      };
      s.ondblclick = () => inst && useItem(i);
      s.oncontextmenu = (e) => { e.preventDefault(); if (inst) useItem(i); };
      if (inst) { s.onmouseenter = (e) => showTip(e, itemTip(inst)); s.onmouseleave = hideTip; }
    });
    b.querySelector('[data-a=use]').onclick = () => invSel.idx >= 0 && useItem(invSel.idx);
    b.querySelector('[data-a=sort]').onclick = () => { invSel.idx = -1; sortInventory(); };
    const sb = b.querySelector('[data-a=sell]'); if (sb) sb.onclick = () => invSel.idx >= 0 && sell(invSel.idx);
  },
};

// ---------- Character ----------
RENDER.character = {
  open: () => openWin('character', 'Karakter (C)', { x: 120, y: 90, w: 420 }),
  html: () => {
    const c = G.char, s = computeStats(c), f = FACTIONS[c.faction];
    const eq = SLOTS.map((sl) => `<div><div class="lbl">${SLOT_NAMES[sl]}</div>${slotHtml(c.equip[sl], `data-s="${sl}"`)}</div>`).join('');
    return `
      <div class="row"><b style="color:${f.css};font-size:16px">${esc(c.name)}</b><small>Lv ${c.level} · ${jobTitle(c) || f.titles[c.cls]} (${CLASSES[c.cls].name})</small></div>
      <div class="row"><small>${f.name} — ${f.passive}</small></div>
      <div class="row" style="align-items:flex-start;gap:16px">
        <div class="equip">${eq}</div>
        <div class="stat" style="flex:1">
          <span>HP</span><b>${s.maxHp}</b><span>MP</span><b>${s.maxMp}</b><span>ATK</span><b>${s.atk}</b>
          <span>DEF</span><b>${s.def}</b><span>CRIT</span><b>${(s.crit * 100).toFixed(1)}%</b><span>SPD</span><b>+${(s.spd * 100).toFixed(0)}%</b>
          <span>Skill Point</span><b class="gold">${c.sp}</b><span>Kill / PvP</span><b>${c.stats.kills} / ${c.stats.pvp}</b>
        </div>
      </div>
      <small>Klik slot equipment untuk melepas.</small>`;
  },
  bind: (b) => b.querySelectorAll('[data-s]').forEach((s) => {
    const inst = G.char.equip[s.dataset.s];
    s.onclick = () => unequip(s.dataset.s);
    if (inst) { s.onmouseenter = (e) => showTip(e, itemTip(inst)); s.onmouseleave = hideTip; }
  }),
};

// ---------- Skills ----------
export function allSkillIds(c) {
  const ids = classSkills(c.cls);
  for (const p of JOBS[c.cls]) ids.push(`${p.id}_30`, `${p.id}_50`);
  return ids;
}
RENDER.skills = {
  open: () => openWin('skills', 'Skill Tree (K)', { x: 160, y: 70, w: 520 }),
  html: () => {
    const c = G.char;
    let h = `<div class="row"><b>Skill Point: <span class="gold">${c.sp}</span></b><small>· +1 per level · Rank maks ${SKILL_MAX_RANK} (+12% power/rank)</small></div><div class="list">`;
    let section = '';
    for (const id of allSkillIds(c)) {
      const s = SKILLS[id];
      const path = s.job ? JOBS[c.cls].find((p) => p.id === s.job) : null;
      const sec = path ? `Job: ${path.t1} → ${path.t2}` : `${CLASSES[c.cls].name} (dasar)`;
      if (sec !== section) { section = sec; h += `<div style="margin-top:6px"><small class="gold">${sec}</small></div>`; }
      const r = c.skills[id] || 0;
      const locked = !r;
      const slot = c.hotbar.indexOf(id);
      h += `<div class="li" style="${locked ? 'opacity:.5' : ''}"><span class="ic">${s.icon}</span><div class="grow"><b>${s.name}</b> <small>Rank ${r}/${SKILL_MAX_RANK} · Lv ${s.lv}${path ? ` · ${path.t1}` : ''}</small><br>
        <small>${s.type}${s.mult ? ` · ${Math.round(s.mult * 100 * (1 + 0.12 * Math.max(0, r - 1)))}% ATK` : ''}${s.radius ? ` · radius ${s.radius}` : ''} · MP ${s.mp || 0} · CD ${s.cd}s${s.fx?.stun ? ` · stun ${s.fx.stun}s` : ''}${s.fx?.buff ? ` · ${s.fx.buff.stat} +${s.fx.buff.pct * 100}%` : ''}${s.fx?.dot ? ' · DoT' : ''}${s.fx?.slow ? ' · slow' : ''}</small></div>
        ${locked ? '<small>Terkunci</small>' : `<button data-up="${id}" ${c.sp < 1 || r >= SKILL_MAX_RANK ? 'disabled' : ''}>+</button>
        <select data-hb="${id}"><option value="">Hotbar</option>${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<option value="${n - 1}" ${slot === n - 1 ? 'selected' : ''}>Slot ${n}</option>`).join('')}</select>`}</div>`;
    }
    return `${h}</div>`;
  },
  bind: (b) => {
    b.querySelectorAll('[data-up]').forEach((el) => (el.onclick = () => {
      const c = G.char, id = el.dataset.up;
      if (c.sp < 1 || c.skills[id] >= SKILL_MAX_RANK) return;
      c.sp--; c.skills[id]++; bus.emit('skills');
    }));
    b.querySelectorAll('[data-hb]').forEach((el) => (el.onchange = () => {
      const c = G.char, id = el.dataset.hb, i = el.value;
      const prev = c.hotbar.indexOf(id); if (prev >= 0) c.hotbar[prev] = null;
      if (i !== '') c.hotbar[+i] = id;
      refreshHotbar(); bus.emit('skills');
    }));
  },
};
