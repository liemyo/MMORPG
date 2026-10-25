// Item database (generated), gems, materials, consumables, crafting recipes, upgrade table.

export const SLOTS = ['weapon', 'helm', 'armor', 'boots', 'ring', 'amulet'];
export const SLOT_NAMES = { weapon: 'Senjata', helm: 'Helm', armor: 'Armor', boots: 'Boots', ring: 'Ring', amulet: 'Amulet' };

const TIER_LV = [1, 8, 16, 24, 32, 40, 48, 56];
const TIER_NAME = ['Scrap', 'Forged', 'Tempered', 'Lumen', 'Rift', 'Astral', 'Core', 'Veyran'];
const WEAPON_NOUN = { warrior: 'Cleaver', ranger: 'Railgun', caster: 'Focus Prism', specialist: 'Gauntlet' };
const WEAPON_ICON = { warrior: '🗡', ranger: '🔫', caster: '🔮', specialist: '🧤' };

export const RARITY = {
  common: { name: 'Common', mult: 1.0, css: '#c8d0dc' },
  rare:   { name: 'Rare',   mult: 1.12, css: '#4aa3ff' },
  epic:   { name: 'Epic',   mult: 1.28, css: '#c77dff' },
};

export const ITEMS = {};
const price = (t) => Math.round(60 * Math.pow(t + 1, 2.3));

for (let t = 0; t < TIER_LV.length; t++) {
  const lv = TIER_LV[t], tn = TIER_NAME[t];
  for (const cls of Object.keys(WEAPON_NOUN)) {
    ITEMS[`wpn_${cls}_${t}`] = { name: `${tn} ${WEAPON_NOUN[cls]}`, icon: WEAPON_ICON[cls], type: 'equip', slot: 'weapon', cls, tier: t, lv,
      stats: { atk: 8 + t * 15 }, sockets: Math.min(3, 1 + Math.floor(t / 3)), price: price(t) * 1.4 | 0 };
  }
  ITEMS[`arm_${t}`] = { name: `${tn} Plate`, icon: '🛡', type: 'equip', slot: 'armor', tier: t, lv,
    stats: { def: 6 + t * 10, hp: 20 + t * 45 }, sockets: Math.min(3, 1 + Math.floor(t / 3)), price: price(t) };
  ITEMS[`helm_${t}`] = { name: `${tn} Visor`, icon: '⛑', type: 'equip', slot: 'helm', tier: t, lv,
    stats: { def: 3 + t * 5, hp: 10 + t * 22 }, sockets: t >= 4 ? 1 : 0, price: price(t) * 0.6 | 0 };
  ITEMS[`boot_${t}`] = { name: `${tn} Treads`, icon: '👢', type: 'equip', slot: 'boots', tier: t, lv,
    stats: { def: 2 + t * 4, spd: 0.03 + t * 0.005 }, sockets: t >= 4 ? 1 : 0, price: price(t) * 0.5 | 0 };
  ITEMS[`ring_${t}`] = { name: `${tn} Signet`, icon: '💍', type: 'equip', slot: 'ring', tier: t, lv,
    stats: { atk: 3 + t * 5, crit: 0.01 + t * 0.005 }, sockets: t >= 2 ? 1 : 0, price: price(t) * 0.7 | 0 };
  ITEMS[`amu_${t}`] = { name: `${tn} Pendant`, icon: '📿', type: 'equip', slot: 'amulet', tier: t, lv,
    stats: { hp: 20 + t * 38, mp: 15 + t * 22 }, sockets: t >= 2 ? 1 : 0, price: price(t) * 0.7 | 0 };
}

// Gems: socket ke slot permata
const GEMS = [
  ['ruby', 'Ember Shard', '🔴', 'atk', [6, 18, 40]],
  ['azure', 'Tide Shard', '🔵', 'mp', [25, 70, 160]],
  ['verdant', 'Grove Shard', '🟢', 'hp', [40, 120, 300]],
  ['obsid', 'Bastion Shard', '⚫', 'def', [5, 15, 34]],
  ['prism', 'Prism Shard', '🟣', 'crit', [0.02, 0.04, 0.07]],
];
const GEM_TIER = ['Chipped', 'Polished', 'Radiant'];
for (const [k, name, icon, stat, vals] of GEMS) {
  vals.forEach((v, i) => {
    ITEMS[`gem_${k}_${i}`] = { name: `${GEM_TIER[i]} ${name}`, icon, type: 'gem', stat, val: v, tier: i, stack: true,
      price: [400, 2500, 12000][i], premium: i === 2 ? 30 : 0 };
  });
}

Object.assign(ITEMS, {
  mat_ore:     { name: 'Veyrite Ore', icon: '🪨', type: 'mat', stack: true, price: 12 },
  mat_crystal: { name: 'Raw Crystal', icon: '💎', type: 'mat', stack: true, price: 18 },
  mat_lumen:   { name: 'Lumen Crystal', icon: '✨', type: 'mat', stack: true, price: 90 },
  mat_core:    { name: 'Core Fragment', icon: '🔶', type: 'mat', stack: true, price: 400 },
  mat_steel:   { name: 'Ferrosteel Ingot', icon: '🔩', type: 'mat', stack: true, price: 60 },
  mat_refine:  { name: 'Refine Catalyst', icon: '⚗', type: 'mat', stack: true, price: 150 },
  mat_scrap:   { name: 'Drone Scrap', icon: '⚙', type: 'mat', stack: true, price: 8 },
  pot_hp1: { name: 'Repair Gel', icon: '🧪', type: 'use', stack: true, heal: 150, price: 25 },
  pot_hp2: { name: 'Repair Gel+', icon: '🧪', type: 'use', stack: true, heal: 700, price: 120 },
  pot_hp3: { name: 'Repair Gel X', icon: '🧪', type: 'use', stack: true, heal: 2500, price: 450 },
  pot_mp1: { name: 'Mana Cell', icon: '🔋', type: 'use', stack: true, mana: 80, price: 30 },
  pot_mp2: { name: 'Mana Cell+', icon: '🔋', type: 'use', stack: true, mana: 350, price: 140 },
  scroll_recall: { name: 'Recall Beacon', icon: '📡', type: 'use', stack: true, recall: true, price: 60 },
  pass_xp: { name: 'Insight Chip (XP x2 30m)', icon: '📀', type: 'use', stack: true, xpBoost: 1800, price: 0, premium: 25 },
  pass_luck: { name: 'Fortune Chip (Upgrade +10%)', icon: '🍀', type: 'use', stack: true, luck: true, price: 0, premium: 15 },
});
for (const [id, it] of Object.entries(ITEMS)) it.id = id;

// Shop stock per NPC kind
export const SHOP_STOCK = {
  general: ['pot_hp1', 'pot_hp2', 'pot_hp3', 'pot_mp1', 'pot_mp2', 'scroll_recall', 'mat_refine', 'gem_ruby_0', 'gem_azure_0', 'gem_verdant_0', 'gem_obsid_0', 'gem_prism_0'],
  premium: ['pass_xp', 'pass_luck', 'gem_ruby_2', 'gem_azure_2', 'gem_verdant_2', 'gem_obsid_2', 'gem_prism_2'],
  gear: () => Object.values(ITEMS).filter((i) => i.type === 'equip').map((i) => i.id),
};

// Crafting: hasil + bahan + biaya credit
export const RECIPES = [
  { out: 'mat_steel', qty: 1, need: { mat_ore: 3 }, cost: 10 },
  { out: 'mat_refine', qty: 1, need: { mat_crystal: 2, mat_steel: 1 }, cost: 20 },
  { out: 'pot_hp2', qty: 3, need: { mat_crystal: 2 }, cost: 30 },
  { out: 'pot_mp2', qty: 3, need: { mat_crystal: 2, mat_scrap: 2 }, cost: 30 },
  { out: 'gem_ruby_1', qty: 1, need: { gem_ruby_0: 3, mat_lumen: 1 }, cost: 300 },
  { out: 'gem_verdant_1', qty: 1, need: { gem_verdant_0: 3, mat_lumen: 1 }, cost: 300 },
  { out: 'gem_obsid_1', qty: 1, need: { gem_obsid_0: 3, mat_lumen: 1 }, cost: 300 },
  { out: 'gem_ruby_2', qty: 1, need: { gem_ruby_1: 3, mat_core: 1 }, cost: 2000 },
  { out: 'arm_3', qty: 1, need: { mat_steel: 8, mat_lumen: 3 }, cost: 800, rarity: 'rare' },
  { out: 'arm_5', qty: 1, need: { mat_steel: 20, mat_lumen: 8, mat_core: 2 }, cost: 4000, rarity: 'rare' },
  { out: 'CLASS_WPN_3', qty: 1, need: { mat_steel: 10, mat_lumen: 4 }, cost: 1000, rarity: 'rare' },
  { out: 'CLASS_WPN_5', qty: 1, need: { mat_steel: 24, mat_lumen: 10, mat_core: 3 }, cost: 5000, rarity: 'rare' },
  { out: 'CLASS_WPN_7', qty: 1, need: { mat_steel: 40, mat_lumen: 20, mat_core: 10 }, cost: 20000, rarity: 'epic' },
];

// Upgrade +1..+15: chance sukses. Gagal = turun 1 level (tidak hancur).
export const UPGRADE_CHANCE = [1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.42, 0.35, 0.28, 0.22, 0.16, 0.12, 0.08, 0.05];
export const MAX_PLUS = UPGRADE_CHANCE.length;
export const upgradeCost = (item, plus) => ({ credit: Math.round((item.price || 100) * 0.3 * (plus + 1)), refine: 1 + Math.floor(plus / 3) });
export const PLUS_BONUS = 0.08; // +8% stat dasar per +1

export const itemTierFor = (lv) => { let t = 0; TIER_LV.forEach((l, i) => { if (lv >= l) t = i; }); return t; };
