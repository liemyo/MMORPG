// Inventory grid, equipment, consumables, shop, upgrade + gem sockets, crafting.
import { G, bus, makeItem, pay, earn, canPay, isSandbox, resolveId, INV_SIZE } from './state.js';
import { ITEMS, RECIPES, UPGRADE_CHANCE, MAX_PLUS, upgradeCost } from './items.js';

const inv = () => G.char.inv;
const changed = () => bus.emit('inv');

export function addItem(inst) {
  const def = ITEMS[inst.id];
  if (def.stack) {
    const s = inv().find((x) => x && x.id === inst.id);
    if (s) { s.qty += inst.qty; changed(); progress(inst); return true; }
  }
  const i = inv().indexOf(null);
  if (i < 0) return false;
  inv()[i] = inst; changed(); progress(inst);
  return true;
}
function progress(inst) { if (ITEMS[inst.id].type === 'mat') bus.emit('gotItem', inst.id, inst.qty); }

export const countItem = (id) => inv().reduce((n, x) => n + (x && x.id === id ? x.qty : 0), 0);
export const freeSlots = () => inv().filter((x) => !x).length;

export function consume(id, n = 1) {
  if (countItem(id) < n) return false;
  for (let i = 0; i < INV_SIZE && n > 0; i++) {
    const x = inv()[i];
    if (!x || x.id !== id) continue;
    const take = Math.min(n, x.qty);
    x.qty -= take; n -= take;
    if (x.qty <= 0) inv()[i] = null;
  }
  changed();
  return true;
}

export function canEquip(inst) {
  const d = ITEMS[inst.id];
  if (d.type !== 'equip') return 'Bukan equipment';
  if (d.lv > G.char.level) return `Butuh level ${d.lv}`;
  if (d.cls && d.cls !== G.char.cls) return 'Bukan untuk kelasmu';
  return null;
}

export function equip(idx) {
  const inst = inv()[idx];
  if (!inst) return;
  const why = canEquip(inst);
  if (why) return bus.emit('toast', why);
  const slot = ITEMS[inst.id].slot;
  inv()[idx] = G.char.equip[slot];
  G.char.equip[slot] = inst;
  changed(); bus.emit('stats');
}

export function unequip(slot) {
  const inst = G.char.equip[slot];
  if (!inst) return;
  const i = inv().indexOf(null);
  if (i < 0) return bus.emit('toast', 'Inventaris penuh');
  inv()[i] = inst; G.char.equip[slot] = null;
  changed(); bus.emit('stats');
}

export function useItem(idx) {
  const inst = inv()[idx];
  if (!inst) return;
  const d = ITEMS[inst.id], p = G.player;
  if (d.type === 'equip') return equip(idx);
  if (d.type !== 'use') return;
  if (p.dead) return;
  if (d.heal) { p.hp = Math.min(p.maxHp, p.hp + d.heal); bus.emit('chat', 'sys', `HP +${d.heal}`); }
  if (d.mana) p.mp = Math.min(p.maxMp, p.mp + d.mana);
  if (d.recall) bus.emit('travel', `city_${G.char.faction}`);
  if (d.xpBoost) { G.char.xpBoostUntil = Math.max(Date.now(), G.char.xpBoostUntil) + d.xpBoost * 1000; bus.emit('toast', 'XP x2 aktif 30 menit'); }
  if (d.luck) { G.char.luck += 1; bus.emit('toast', 'Fortune Chip: upgrade berikutnya +10%'); }
  consume(inst.id, 1);
}

// Pakai potion pertama dengan id tertentu (dipakai hotbar)
export function quickUse(id) {
  const idx = inv().findIndex((x) => x && x.id === id);
  if (idx < 0) return bus.emit('toast', `${ITEMS[id].name} habis`);
  useItem(idx);
}

// ---------- Shop ----------
export function buy(id, qty = 1) {
  const d = ITEMS[resolveId(id)];
  const cr = (d.premium ? 0 : d.price) * qty, sh = (d.premium || 0) * qty;
  if (!canPay(cr, sh)) return bus.emit('toast', d.premium ? 'Core Shard tidak cukup' : 'Credit tidak cukup');
  const need = d.stack ? 1 : qty;
  if (freeSlots() < need && !(d.stack && countItem(d.id))) return bus.emit('toast', 'Inventaris penuh');
  pay(cr, sh);
  if (d.stack) addItem(makeItem(d.id, qty));
  else for (let i = 0; i < qty; i++) addItem(makeItem(d.id));
  bus.emit('chat', 'sys', `Membeli ${qty}× ${d.name}`);
}

export const sellPrice = (inst) => {
  const d = ITEMS[inst.id];
  const base = d.premium ? 50 : d.price;
  return Math.max(1, Math.round(base * 0.3 * (1 + inst.plus * 0.2) * (inst.rarity === 'epic' ? 3 : inst.rarity === 'rare' ? 1.6 : 1)));
};
export function sell(idx, all = true) {
  const inst = inv()[idx];
  if (!inst) return;
  const n = all ? inst.qty : 1;
  earn(sellPrice(inst) * n);
  bus.emit('chat', 'sys', `Menjual ${n}× ${ITEMS[inst.id].name} (+${sellPrice(inst) * n} Credit)`);
  if (inst.qty > n) inst.qty -= n; else inv()[idx] = null;
  changed();
}

// ---------- Upgrade & gems ----------
export function upgradeInfo(inst) {
  const d = ITEMS[inst.id];
  const cost = upgradeCost(d, inst.plus);
  const chance = inst.plus >= MAX_PLUS ? 0 : Math.min(1, UPGRADE_CHANCE[inst.plus] + (G.char.luck > 0 ? 0.1 : 0));
  return { cost, chance, max: inst.plus >= MAX_PLUS };
}

export function upgrade(inst) {
  const { cost, chance, max } = upgradeInfo(inst);
  if (max) return bus.emit('toast', 'Sudah maksimal +15');
  if (!isSandbox() && countItem('mat_refine') < cost.refine) return bus.emit('toast', `Butuh ${cost.refine} Refine Catalyst`);
  if (!pay(cost.credit)) return bus.emit('toast', 'Credit tidak cukup');
  if (!isSandbox()) consume('mat_refine', cost.refine);
  if (G.char.luck > 0) G.char.luck--;
  const name = ITEMS[inst.id].name;
  G.char.stats.upgrades++;
  bus.emit('upgraded');
  let ok;
  if (Math.random() < chance) { inst.plus++; ok = true; bus.emit('chat', 'sys', `✔ Upgrade sukses: ${name} +${inst.plus}`); }
  else {
    const was = inst.plus; inst.plus = Math.max(0, inst.plus - 1); ok = false;
    bus.emit('chat', 'warn', `✖ Upgrade gagal: ${name} turun +${was} → +${inst.plus} (item tidak hancur)`);
  }
  changed(); bus.emit('stats');
  return ok;
}

export function socket(inst, gemIdx) {
  const g = inv()[gemIdx];
  if (!g || ITEMS[g.id].type !== 'gem') return;
  const d = ITEMS[inst.id];
  if (inst.gems.length >= d.sockets) return bus.emit('toast', 'Slot permata penuh');
  inst.gems.push(g.id);
  consume(g.id, 1);
  bus.emit('chat', 'sys', `${ITEMS[g.id].name} dipasang ke ${d.name}`);
  bus.emit('stats');
}
export function unsocket(inst, i) {
  const gid = inst.gems[i];
  if (!gid) return;
  if (!pay(200)) return bus.emit('toast', 'Butuh 200 Credit untuk melepas permata');
  inst.gems.splice(i, 1);
  addItem(makeItem(gid, 1));
  bus.emit('stats');
}

// ---------- Crafting ----------
export const recipeOut = (r) => resolveId(r.out.replace('CLASS_WPN', 'wpn_CLASS'));
export function canCraft(r) {
  return Object.entries(r.need).every(([id, n]) => countItem(id) >= n) && canPay(r.cost);
}
export function craft(r) {
  if (!canCraft(r)) return bus.emit('toast', 'Bahan / Credit kurang');
  const out = recipeOut(r);
  const d = ITEMS[out];
  if (!d.stack && freeSlots() < 1) return bus.emit('toast', 'Inventaris penuh');
  pay(r.cost);
  for (const [id, n] of Object.entries(r.need)) consume(id, n);
  addItem(makeItem(out, r.qty, r.rarity ? { rarity: r.rarity } : {}));
  G.char.stats.crafted++;
  bus.emit('crafted');
  bus.emit('chat', 'sys', `Crafting: ${r.qty}× ${d.name}`);
}

export function sortInventory() {
  const order = { equip: 0, use: 1, gem: 2, mat: 3 };
  const items = inv().filter(Boolean).sort((a, b) => (order[ITEMS[a.id].type] - order[ITEMS[b.id].type]) || a.id.localeCompare(b.id));
  G.char.inv = [...items, ...Array(INV_SIZE - items.length).fill(null)];
  changed();
}
