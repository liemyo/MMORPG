// Global game state, character model, derived stats, economy (Normal / Sandbox), save/load JSON.
import { CLASSES, FACTIONS, JOBS, SKILLS, classSkills, xpToNext, MAX_LEVEL } from './data.js';
import { ITEMS, RARITY, PLUS_BONUS, SLOTS } from './items.js';

const listeners = {};
export const bus = {
  on(ev, fn) { (listeners[ev] ||= []).push(fn); },
  emit(ev, ...a) { (listeners[ev] || []).forEach((fn) => fn(...a)); },
};

export const G = {
  char: null,        // data karakter yang disimpan
  player: null,      // Unit runtime
  target: null,
  units: [],         // semua unit di zona aktif (monster, bot)
  zone: null,
  god: false,
  paused: false,
  time: 0,
  uiOpen: false,
  war: null,
  slot: 1,
};

export const INV_SIZE = 40;
let uidSeq = Date.now() % 100000;
export const uid = () => `i${(uidSeq++).toString(36)}`;

export const resolveId = (id, cls) => id.replace('CLASS', cls || G.char?.cls || 'warrior');

export function makeItem(id, qty = 1, opts = {}) {
  id = resolveId(id);
  const def = ITEMS[id];
  if (!def) throw new Error(`Unknown item ${id}`);
  return { uid: uid(), id, qty: def.stack ? qty : 1, plus: 0, gems: [], rarity: 'common', ...opts };
}

export function newCharacter({ name, faction, cls, look, mode }) {
  const c = {
    v: 1, name, faction, cls, look, mode,
    level: 1, xp: 0, hp: 1, mp: 1, credit: 500, shard: 20, sp: 0,
    skills: {}, hotbar: Array(9).fill(null), job: null,
    inv: Array(INV_SIZE).fill(null),
    equip: Object.fromEntries(SLOTS.map((s) => [s, null])),
    quests: { main: 0, prog: 0, daily: null },
    zone: `city_${faction}`, pos: { x: 0, z: 8 },
    stats: { kills: 0, pvp: 0, deaths: 0, crafted: 0, upgrades: 0 },
    xpBoostUntil: 0, luck: 0, created: Date.now(),
  };
  // starter kit
  c.equip.weapon = makeItem(`wpn_${cls}_0`);
  c.equip.armor = makeItem('arm_0');
  const kit = [['pot_hp1', 10], ['pot_mp1', 5], ['scroll_recall', 2]];
  kit.forEach(([id, q], i) => { c.inv[i] = makeItem(id, q); });
  unlockSkills(c);
  const s = computeStats(c);
  c.hp = s.maxHp; c.mp = s.maxMp;
  return c;
}

// Skill dasar terbuka otomatis sesuai level; hotbar diisi urut.
export function unlockSkills(c) {
  const ids = classSkills(c.cls);
  if (c.job) ids.push(`${c.job.path}_30`), c.job.tier >= 2 && ids.push(`${c.job.path}_50`);
  let added = [];
  for (const id of ids) {
    if (SKILLS[id].lv <= c.level && !c.skills[id]) {
      c.skills[id] = 1; added.push(id);
      const free = c.hotbar.indexOf(null);
      if (free >= 0 && free < 8) c.hotbar[free] = id;
    }
  }
  return added;
}

// ---------- Economy ----------
export const isSandbox = () => G.char?.mode === 'sandbox';
export const credit = () => (isSandbox() ? Infinity : G.char.credit);
export const shard = () => (isSandbox() ? Infinity : G.char.shard);
export const fmtMoney = (n) => (n === Infinity ? '∞' : Math.floor(n).toLocaleString('id-ID'));
export function canPay(cr = 0, sh = 0) { return isSandbox() || (G.char.credit >= cr && G.char.shard >= sh); }
export function pay(cr = 0, sh = 0) {
  if (!canPay(cr, sh)) return false;
  if (!isSandbox()) { G.char.credit -= cr; G.char.shard -= sh; }
  bus.emit('money');
  return true;
}
export function earn(cr = 0, sh = 0) {
  if (!isSandbox()) { G.char.credit += cr; G.char.shard += sh; }
  bus.emit('money');
}

// ---------- Derived stats ----------
export function itemStats(inst) {
  const def = ITEMS[inst.id];
  const out = {};
  const mult = (1 + PLUS_BONUS * inst.plus) * RARITY[inst.rarity || 'common'].mult;
  for (const [k, v] of Object.entries(def.stats || {})) out[k] = k === 'crit' || k === 'spd' ? v * (1 + 0.03 * inst.plus) : Math.round(v * mult);
  for (const g of inst.gems || []) {
    const gd = ITEMS[g];
    if (gd) out[gd.stat] = (out[gd.stat] || 0) + gd.val;
  }
  return out;
}

export function computeStats(c) {
  const cl = CLASSES[c.cls], f = FACTIONS[c.faction].mod, L = c.level - 1;
  const s = {
    maxHp: cl.base.hp + cl.grow.hp * L, maxMp: cl.base.mp + cl.grow.mp * L,
    atk: cl.base.atk + cl.grow.atk * L, def: cl.base.def + cl.grow.def * L,
    crit: cl.base.crit, spd: 0, skill: f.skill || 0, range: cl.range,
  };
  for (const inst of Object.values(c.equip)) {
    if (!inst) continue;
    const st = itemStats(inst);
    s.maxHp += st.hp || 0; s.maxMp += st.mp || 0; s.atk += st.atk || 0; s.def += st.def || 0;
    s.crit += st.crit || 0; s.spd += st.spd || 0;
  }
  const jb = c.job ? JOBS[c.cls].find((p) => p.id === c.job.path).bonus : {};
  const jm = c.job ? c.job.tier : 0;
  s.maxHp *= 1 + (f.hp || 0) + (jb.hp || 0) * jm;
  s.maxMp *= 1 + (f.mp || 0) + (jb.mp || 0) * jm;
  s.atk *= 1 + (f.atk || 0) + (jb.atk || 0) * jm;
  s.def *= 1 + (f.def || 0) + (jb.def || 0) * jm;
  s.crit += (f.crit || 0) + (jb.crit || 0) * jm;
  for (const k of ['maxHp', 'maxMp', 'atk', 'def']) s[k] = Math.round(s[k]);
  s.crit = Math.min(0.75, s.crit);
  return s;
}

export function gainXp(n) {
  const c = G.char;
  if (c.level >= MAX_LEVEL) return;
  if (Date.now() < c.xpBoostUntil) n *= 2;
  c.xp += Math.round(n);
  let ups = 0;
  while (c.level < MAX_LEVEL && c.xp >= xpToNext(c.level)) {
    c.xp -= xpToNext(c.level); c.level++; c.sp++; ups++;
  }
  if (c.level >= MAX_LEVEL) c.xp = 0;
  if (ups) bus.emit('levelup', ups);
  bus.emit('xp');
}

export function setLevel(lv) {
  const c = G.char;
  const old = c.level;
  c.level = Math.max(1, Math.min(MAX_LEVEL, lv | 0));
  c.xp = 0;
  if (c.level > old) c.sp += c.level - old;
  bus.emit('levelup', c.level - old);
}

// ---------- Save / Load ----------
const KEY = (slot) => `veyra_save_${slot}`;
export function saveGame(slot = G.slot) {
  if (!G.char) return false;
  const c = G.char;
  if (G.player) { c.pos = { x: +G.player.pos.x.toFixed(2), z: +G.player.pos.z.toFixed(2) }; c.hp = G.player.hp; c.mp = G.player.mp; }
  c.savedAt = Date.now();
  try { localStorage.setItem(KEY(slot), JSON.stringify(c)); } catch (e) { return false; }
  bus.emit('chat', 'sys', `Game tersimpan di slot ${slot}.`);
  return true;
}
export function loadSlot(slot) {
  try { const raw = localStorage.getItem(KEY(slot)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function deleteSlot(slot) { try { localStorage.removeItem(KEY(slot)); } catch {} }
export function exportJson() {
  saveGame();
  const blob = new Blob([JSON.stringify(G.char, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `veyra_${G.char.name}_lv${G.char.level}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function validateSave(c) {
  return c && c.name && FACTIONS[c.faction] && CLASSES[c.cls] && Array.isArray(c.inv) && c.equip;
}
