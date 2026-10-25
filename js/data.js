// Static game data: factions, classes, skills, job advancement.
// Semua nama & lore original untuk dunia Veyra.

export const MAX_LEVEL = 60;
export const xpToNext = (lv) => Math.floor(80 * Math.pow(lv, 1.65) + 40);

export const FACTIONS = {
  union: {
    id: 'union', name: 'Orbital Union', color: 0x4aa3ff, css: '#4aa3ff',
    city: 'Helion Spire', passive: 'Exo-Frame: +8% DEF, +5% HP',
    mod: { def: 0.08, hp: 0.05 },
    lore: 'Koloni manusia dari orbit. Exo-suit dan mech adalah tulang punggung mereka.',
    titles: { warrior: 'Exo-Trooper', ranger: 'Rail Scout', caster: 'Field Technomancer', specialist: 'Mech Engineer' },
  },
  sylvaran: {
    id: 'sylvaran', name: 'Sylvaran Covenant', color: 0x5be38a, css: '#5be38a',
    city: 'Thornveil Sanctum', passive: 'Crystal Attunement: +10% MP, +8% skill dmg',
    mod: { mp: 0.10, skill: 0.08 },
    lore: 'Ras asli Veyra yang menenun sihir dari denyut kristal.',
    titles: { warrior: 'Thorn Knight', ranger: 'Glade Archer', caster: 'Crystal Sage', specialist: 'Rune Weaver' },
  },
  ferron: {
    id: 'ferron', name: 'Ferron Legion', color: 0xff7a3d, css: '#ff7a3d',
    city: 'Forgeheart Bastion', passive: 'Modular Chassis: +8% ATK, +5% CRIT',
    mod: { atk: 0.08, crit: 0.05 },
    lore: 'Legiun android yang membangun ulang tubuhnya dengan modul tempur.',
    titles: { warrior: 'Siege Frame', ranger: 'Gun Unit', caster: 'Plasma Core', specialist: 'Mod Engineer' },
  },
};
export const FACTION_IDS = Object.keys(FACTIONS);

// base = level 1, grow = per level
export const CLASSES = {
  warrior: { id: 'warrior', name: 'Warrior', role: 'Melee tank / bruiser', range: 2.6,
    base: { hp: 150, mp: 40, atk: 12, def: 9, crit: 0.05 }, grow: { hp: 24, mp: 4, atk: 2.6, def: 1.9 } },
  ranger: { id: 'ranger', name: 'Ranger', role: 'Penembak jarak jauh', range: 16,
    base: { hp: 105, mp: 60, atk: 13, def: 5, crit: 0.10 }, grow: { hp: 16, mp: 5, atk: 2.9, def: 1.2 } },
  caster: { id: 'caster', name: 'Caster', role: 'Sihir area & burst', range: 18,
    base: { hp: 90, mp: 120, atk: 15, def: 4, crit: 0.07 }, grow: { hp: 13, mp: 10, atk: 3.1, def: 1.0 } },
  specialist: { id: 'specialist', name: 'Specialist', role: 'Support / debuff / heal', range: 12,
    base: { hp: 115, mp: 85, atk: 11, def: 6, crit: 0.06 }, grow: { hp: 18, mp: 7, atk: 2.4, def: 1.5 } },
};
export const CLASS_IDS = Object.keys(CLASSES);

// type: dmg | aoe (around target) | self_aoe | heal | buff | debuff | leap
// fx: { stun, slow, dot, buff:{stat,pct,dur}, debuff:{stat,pct,dur} }
export const SKILLS = {
  // Warrior
  w_strike: { cls: 'warrior', name: 'Cleave Strike', icon: '⚔', type: 'dmg', mult: 1.3, mp: 0, cd: 1.2, range: 'melee', lv: 1 },
  w_bash:   { cls: 'warrior', name: 'Shield Bash', icon: '⛨', type: 'dmg', mult: 1.2, mp: 10, cd: 8, range: 'melee', lv: 1, fx: { stun: 1.5 } },
  w_whirl:  { cls: 'warrior', name: 'Whirlwind', icon: '◎', type: 'self_aoe', mult: 1.1, radius: 5, mp: 15, cd: 6, lv: 4 },
  w_roar:   { cls: 'warrior', name: 'War Cry', icon: '♜', type: 'buff', mp: 20, cd: 30, lv: 8, fx: { buff: { stat: 'atk', pct: 0.25, dur: 12 } } },
  w_guard:  { cls: 'warrior', name: 'Iron Guard', icon: '▣', type: 'buff', mp: 15, cd: 25, lv: 14, fx: { buff: { stat: 'def', pct: 0.4, dur: 10 } } },
  w_leap:   { cls: 'warrior', name: 'Crushing Leap', icon: '⤒', type: 'leap', mult: 1.8, radius: 4, mp: 25, cd: 14, range: 15, lv: 20 },
  // Ranger
  r_shot:   { cls: 'ranger', name: 'Quick Shot', icon: '➹', type: 'dmg', mult: 1.2, mp: 0, cd: 1.0, lv: 1 },
  r_pierce: { cls: 'ranger', name: 'Piercing Bolt', icon: '➶', type: 'dmg', mult: 2.0, mp: 10, cd: 5, lv: 1 },
  r_volley: { cls: 'ranger', name: 'Arc Volley', icon: '⋔', type: 'aoe', mult: 1.0, radius: 4, mp: 18, cd: 8, lv: 4 },
  r_toxin:  { cls: 'ranger', name: 'Toxin Round', icon: '☣', type: 'debuff', mult: 0.5, mp: 12, cd: 10, lv: 8, fx: { dot: { pct: 0.4, dur: 8 } } },
  r_focus:  { cls: 'ranger', name: 'Hawk Focus', icon: '◉', type: 'buff', mp: 15, cd: 30, lv: 14, fx: { buff: { stat: 'crit', pct: 0.25, dur: 12 } } },
  r_snipe:  { cls: 'ranger', name: 'Deadeye', icon: '✛', type: 'dmg', mult: 3.5, mp: 30, cd: 18, range: 24, lv: 20 },
  // Caster
  c_bolt:   { cls: 'caster', name: 'Shard Bolt', icon: '✦', type: 'dmg', mult: 1.3, mp: 4, cd: 1.3, lv: 1 },
  c_flare:  { cls: 'caster', name: 'Prism Flare', icon: '✺', type: 'dmg', mult: 2.2, mp: 14, cd: 4, lv: 1 },
  c_nova:   { cls: 'caster', name: 'Frost Nova', icon: '❄', type: 'self_aoe', mult: 1.0, radius: 6, mp: 20, cd: 10, lv: 4, fx: { slow: { pct: 0.5, dur: 4 } } },
  c_brand:  { cls: 'caster', name: 'Ember Brand', icon: '♨', type: 'debuff', mult: 0.6, mp: 14, cd: 9, lv: 8, fx: { dot: { pct: 0.6, dur: 8 } } },
  c_ward:   { cls: 'caster', name: 'Arcane Ward', icon: '⬡', type: 'buff', mp: 20, cd: 28, lv: 14, fx: { buff: { stat: 'def', pct: 0.5, dur: 12 } } },
  c_star:   { cls: 'caster', name: 'Starfall', icon: '☄', type: 'aoe', mult: 3.0, radius: 6, mp: 40, cd: 20, range: 20, lv: 20 },
  // Specialist
  s_zap:    { cls: 'specialist', name: 'Pulse Zap', icon: 'ϟ', type: 'dmg', mult: 1.1, mp: 0, cd: 1.0, lv: 1 },
  s_mend:   { cls: 'specialist', name: 'Nano Mend', icon: '✚', type: 'heal', mult: 2.5, mp: 18, cd: 6, lv: 1 },
  s_mine:   { cls: 'specialist', name: 'Shock Mine', icon: '✸', type: 'aoe', mult: 1.4, radius: 4, mp: 16, cd: 9, lv: 4, fx: { stun: 1.0 } },
  s_disrupt:{ cls: 'specialist', name: 'Disrupt Field', icon: '⊘', type: 'debuff', mult: 0.8, mp: 12, cd: 12, lv: 8, fx: { debuff: { stat: 'def', pct: -0.3, dur: 10 } } },
  s_over:   { cls: 'specialist', name: 'Overclock', icon: '⏫', type: 'buff', mp: 20, cd: 30, lv: 14, fx: { buff: { stat: 'atk', pct: 0.2, dur: 12 }, buff2: { stat: 'spd', pct: 0.3, dur: 12 } } },
  s_beam:   { cls: 'specialist', name: 'Orbital Beam', icon: '⇓', type: 'aoe', mult: 2.6, radius: 5, mp: 35, cd: 18, range: 18, lv: 20 },
};

// Job advancement: lv 30 pilih path, lv 50 tier 2 dari path itu.
export const JOBS = {
  warrior: [
    { id: 'bulwark', t1: 'Bulwark', t2: 'Aegis Lord', desc: 'Tank: HP & DEF tinggi', bonus: { hp: 0.2, def: 0.2 },
      s30: { name: 'Fortress', icon: '⛫', type: 'buff', mp: 30, cd: 40, fx: { buff: { stat: 'def', pct: 0.8, dur: 8 }, heal: 0.2 } },
      s50: { name: 'Titan Wall', icon: '⬢', type: 'self_aoe', mult: 1.8, radius: 7, mp: 40, cd: 22, fx: { stun: 2 } } },
    { id: 'berserker', t1: 'Berserker', t2: 'Warlord', desc: 'DPS: ATK & CRIT tinggi', bonus: { atk: 0.2, crit: 0.1 },
      s30: { name: 'Rampage', icon: '⚡', type: 'dmg', mult: 3.2, mp: 30, cd: 12, range: 'melee' },
      s50: { name: 'Execution', icon: '☠', type: 'dmg', mult: 5.0, mp: 45, cd: 20, range: 'melee' } },
  ],
  ranger: [
    { id: 'sharpshot', t1: 'Sharpshot', t2: 'Void Marksman', desc: 'Single target burst', bonus: { atk: 0.2, crit: 0.08 },
      s30: { name: 'Rail Lance', icon: '➳', type: 'dmg', mult: 3.4, mp: 28, cd: 10, range: 26 },
      s50: { name: 'Singularity Shot', icon: '◈', type: 'dmg', mult: 5.5, mp: 50, cd: 22, range: 28 } },
    { id: 'trapper', t1: 'Trapper', t2: 'Wild Warden', desc: 'AoE & kontrol', bonus: { hp: 0.1, atk: 0.12 },
      s30: { name: 'Snare Field', icon: '⌗', type: 'aoe', mult: 1.6, radius: 6, mp: 28, cd: 14, fx: { slow: { pct: 0.6, dur: 5 } } },
      s50: { name: 'Storm of Barbs', icon: '⁂', type: 'aoe', mult: 3.0, radius: 8, mp: 50, cd: 22, fx: { dot: { pct: 0.5, dur: 6 } } } },
  ],
  caster: [
    { id: 'pyromancer', t1: 'Pyromancer', t2: 'Sunbreaker', desc: 'Damage api besar', bonus: { atk: 0.22 },
      s30: { name: 'Solar Lance', icon: '☀', type: 'dmg', mult: 3.6, mp: 32, cd: 9 },
      s50: { name: 'Nova Collapse', icon: '✹', type: 'aoe', mult: 4.2, radius: 8, mp: 60, cd: 24 } },
    { id: 'cryomancer', t1: 'Cryomancer', t2: 'Glacier Oracle', desc: 'Kontrol & bertahan', bonus: { def: 0.15, mp: 0.2 },
      s30: { name: 'Ice Prison', icon: '❆', type: 'debuff', mult: 1.5, mp: 28, cd: 14, fx: { stun: 2.5 } },
      s50: { name: 'Absolute Zero', icon: '❅', type: 'self_aoe', mult: 2.8, radius: 9, mp: 55, cd: 24, fx: { slow: { pct: 0.7, dur: 6 } } } },
  ],
  specialist: [
    { id: 'medic', t1: 'Field Medic', t2: 'Lifeweaver', desc: 'Heal & sustain', bonus: { hp: 0.15, mp: 0.15 },
      s30: { name: 'Regen Matrix', icon: '❤', type: 'heal', mult: 5.0, mp: 35, cd: 15 },
      s50: { name: 'Phoenix Protocol', icon: '♆', type: 'buff', mp: 50, cd: 60, fx: { buff: { stat: 'def', pct: 1.0, dur: 10 }, heal: 0.6 } } },
    { id: 'saboteur', t1: 'Saboteur', t2: 'Chaos Architect', desc: 'Debuff & ledakan', bonus: { atk: 0.18, crit: 0.05 },
      s30: { name: 'Overload Charge', icon: '✷', type: 'aoe', mult: 2.8, radius: 5, mp: 30, cd: 12 },
      s50: { name: 'System Crash', icon: '⌁', type: 'debuff', mult: 3.0, mp: 45, cd: 20, fx: { stun: 2, debuff: { stat: 'def', pct: -0.4, dur: 10 } } } },
  ],
};

// Register advancement skills into SKILLS with generated ids.
for (const [cls, paths] of Object.entries(JOBS)) {
  for (const p of paths) {
    SKILLS[`${p.id}_30`] = { cls, ...p.s30, lv: 30, job: p.id };
    SKILLS[`${p.id}_50`] = { cls, ...p.s50, lv: 50, job: p.id };
  }
}

export const SKILL_MAX_RANK = 5;
export const classSkills = (cls) =>
  Object.entries(SKILLS).filter(([, s]) => s.cls === cls && !s.job).map(([id]) => id);
