// Zones, monsters, quests.
import { FACTIONS } from './data.js';

export const ZONES = {};
for (const f of Object.values(FACTIONS)) {
  ZONES[`city_${f.id}`] = {
    id: `city_${f.id}`, name: f.city, kind: 'city', faction: f.id, lv: [1, 60], size: 120, safe: true,
    ground: f.id === 'union' ? 0x5d6b7c : f.id === 'sylvaran' ? 0x4c6b48 : 0x6b5548,
    sky: f.id === 'union' ? 0x8fb8e8 : f.id === 'sylvaran' ? 0x9fd8b0 : 0xd8a088,
    accent: f.color, props: { tower: 10, tree: f.id === 'sylvaran' ? 30 : 6, rock: 8 }, nodes: {}, monsters: [],
  };
}

Object.assign(ZONES, {
  verge: { id: 'verge', name: 'Shardfall Verge', kind: 'field', lv: [1, 12], size: 260, ground: 0x9a8762, sky: 0xe8cfa0,
    accent: 0x7fe3ff, props: { rock: 70, crystal: 40, tree: 10, ruin: 8 },
    nodes: { ore: 14, crystal: 12 },
    monsters: [['dust_crawler', 14], ['shard_beetle', 12], ['rogue_drone', 10], ['crystal_golem', 4], ['quarry_tyrant', 1]] },
  glasswood: { id: 'glasswood', name: 'Glasswood Expanse', kind: 'field', lv: [12, 28], size: 280, ground: 0x3f6e5e, sky: 0xa8e0d8,
    accent: 0xa0ffe0, props: { tree: 110, crystal: 40, rock: 30 },
    nodes: { ore: 10, crystal: 14, lumen: 6 },
    monsters: [['glass_stalker', 14], ['thornback', 12], ['wisp_swarm', 10], ['rift_hound', 4], ['verdigris_matriarch', 1]] },
  ashen: { id: 'ashen', name: 'Ashen Rift', kind: 'field', lv: [28, 45], size: 300, ground: 0x4a3a36, sky: 0x8a5a50,
    accent: 0xff6a3a, props: { rock: 90, crystal: 30, ruin: 20 },
    nodes: { ore: 14, lumen: 10, core: 3 },
    monsters: [['ash_wraith', 14], ['magma_crab', 12], ['war_automaton', 10], ['rift_colossus', 4], ['cinder_sovereign', 1]] },
  core: { id: 'core', name: 'Crystal Core', kind: 'pvp', lv: [40, 60], size: 300, ground: 0x3a3a5a, sky: 0x40305a, pvp: true,
    accent: 0xd0a0ff, props: { crystal: 80, rock: 50, ruin: 16 },
    nodes: { lumen: 10, core: 8 },
    monsters: [['core_sentinel', 14], ['prism_horror', 8], ['heart_warden', 1]] },
});

export const FIELD_ORDER = ['verge', 'glasswood', 'ashen', 'core'];

// shape: crawler | beetle | drone | golem | stalker | wisp | crab | automaton | wraith
const M = (name, lv, shape, color, o = {}) => ({ name, lv, shape, color, hpMul: 1, atkMul: 1, size: 1, ...o });
export const MONSTERS = {
  dust_crawler: M('Dust Crawler', [1, 3], 'crawler', 0xb0905a, { drops: [['mat_scrap', 0.3], ['pot_hp1', 0.15]] }),
  shard_beetle: M('Shard Beetle', [3, 6], 'beetle', 0x5ab0d0, { drops: [['mat_crystal', 0.4], ['pot_hp1', 0.15]] }),
  rogue_drone: M('Rogue Drone', [5, 9], 'drone', 0x909aa8, { ranged: true, drops: [['mat_scrap', 0.6], ['pot_mp1', 0.2]] }),
  crystal_golem: M('Crystal Golem', [9, 11], 'golem', 0x7fe3ff, { elite: true, hpMul: 3, atkMul: 1.4, size: 1.8, drops: [['mat_lumen', 0.4], ['gem_ruby_0', 0.1], ['GEAR', 0.25]] }),
  quarry_tyrant: M('Quarry Tyrant', [12, 12], 'golem', 0xffb040, { boss: true, hpMul: 12, atkMul: 1.8, size: 3, respawn: 180, drops: [['mat_lumen', 1], ['mat_core', 0.5], ['GEAR_EPIC', 0.6], ['gem_prism_0', 0.5]] }),

  glass_stalker: M('Glass Stalker', [12, 17], 'stalker', 0x9fffe0, { drops: [['mat_crystal', 0.4], ['pot_hp2', 0.12]] }),
  thornback: M('Thornback', [16, 22], 'beetle', 0x3c8a3c, { hpMul: 1.3, drops: [['mat_ore', 0.4], ['pot_hp2', 0.12]] }),
  wisp_swarm: M('Wisp Swarm', [20, 25], 'wisp', 0xd0ffff, { ranged: true, drops: [['mat_lumen', 0.15], ['pot_mp2', 0.15]] }),
  rift_hound: M('Rift Hound', [25, 27], 'stalker', 0x8040c0, { elite: true, hpMul: 3, atkMul: 1.4, size: 1.7, drops: [['mat_lumen', 0.6], ['gem_verdant_1', 0.08], ['GEAR', 0.3]] }),
  verdigris_matriarch: M('Verdigris Matriarch', [28, 28], 'beetle', 0x60ff90, { boss: true, hpMul: 14, atkMul: 1.8, size: 3.2, respawn: 240, drops: [['mat_core', 1], ['GEAR_EPIC', 0.7], ['gem_ruby_1', 0.5]] }),

  ash_wraith: M('Ash Wraith', [28, 34], 'wraith', 0x6a6a7a, { ranged: true, drops: [['mat_lumen', 0.2], ['pot_hp3', 0.08]] }),
  magma_crab: M('Magma Crab', [32, 39], 'crab', 0xff5a2a, { hpMul: 1.5, drops: [['mat_ore', 0.6], ['pot_hp3', 0.1]] }),
  war_automaton: M('War Automaton', [37, 43], 'automaton', 0xa08060, { atkMul: 1.2, drops: [['mat_scrap', 0.8], ['mat_core', 0.05]] }),
  rift_colossus: M('Rift Colossus', [42, 44], 'golem', 0xc04030, { elite: true, hpMul: 3.5, atkMul: 1.5, size: 2.2, drops: [['mat_core', 0.4], ['gem_obsid_1', 0.1], ['GEAR', 0.35]] }),
  cinder_sovereign: M('Cinder Sovereign', [45, 45], 'wraith', 0xff3a10, { boss: true, hpMul: 16, atkMul: 2, size: 3.5, respawn: 300, drops: [['mat_core', 2], ['GEAR_EPIC', 0.8], ['gem_prism_1', 0.6]] }),

  core_sentinel: M('Core Sentinel', [46, 55], 'automaton', 0xd0a0ff, { atkMul: 1.2, drops: [['mat_core', 0.15], ['pot_hp3', 0.15]] }),
  prism_horror: M('Prism Horror', [52, 58], 'wisp', 0xff80ff, { ranged: true, hpMul: 1.4, drops: [['mat_core', 0.25], ['GEAR', 0.2]] }),
  heart_warden: M('Heart Warden', [60, 60], 'golem', 0xffffff, { boss: true, hpMul: 20, atkMul: 2.2, size: 4, respawn: 360, drops: [['mat_core', 4], ['GEAR_EPIC', 1], ['gem_prism_2', 0.4]] }),
};
for (const [id, m] of Object.entries(MONSTERS)) m.id = id;

export const monsterStats = (m, lv) => {
  const mul = m.boss ? 1 : m.elite ? 1 : 1;
  return {
    hp: Math.round((55 + lv * 36 + lv * lv * 1.4) * m.hpMul * mul),
    atk: Math.round((5 + lv * 2.5) * m.atkMul),
    def: Math.round(2 + lv * 1.5),
    xp: Math.round((25 + lv * lv * 0.25 + lv * 12) * (m.boss ? 15 : m.elite ? 3 : 1)),
    credit: Math.round((5 + lv * 3) * (m.boss ? 20 : m.elite ? 4 : 1)),
  };
};

// Quest utama (berurutan). type: kill | gather | level | pvp | war
export const MAIN_QUESTS = [
  { id: 'm1', title: 'Pendaratan di Veyra', text: 'Koloni butuh jalur aman. Bersihkan Dust Crawler di Shardfall Verge.', goal: { type: 'kill', target: 'dust_crawler', n: 5 }, reward: { credit: 150, xp: 120, item: ['pot_hp1', 5] } },
  { id: 'm2', title: 'Hama Kristal', text: 'Shard Beetle menggerogoti urat kristal. Kurangi jumlah mereka.', goal: { type: 'kill', target: 'shard_beetle', n: 6 }, reward: { credit: 250, xp: 300, item: ['wpn_CLASS_1', 1] } },
  { id: 'm3', title: 'Bahan Baku', text: 'Kumpulkan Veyrite Ore dari node tambang (tekan F di dekat node).', goal: { type: 'gather', item: 'mat_ore', n: 6 }, reward: { credit: 300, xp: 400, item: ['mat_refine', 3] } },
  { id: 'm4', title: 'Sinyal Liar', text: 'Drone tambang tua menjadi liar. Matikan mereka.', goal: { type: 'kill', target: 'rogue_drone', n: 6 }, reward: { credit: 400, xp: 700, item: ['arm_1', 1] } },
  { id: 'm5', title: 'Golem Terbangun', text: 'Kristal hidup membentuk golem. Hancurkan dua.', goal: { type: 'kill', target: 'crystal_golem', n: 2 }, reward: { credit: 600, xp: 1200, shard: 10 } },
  { id: 'm6', title: 'Tiran Penggalian', text: 'Quarry Tyrant menguasai lubang tambang utama. Kalahkan dia.', goal: { type: 'kill', target: 'quarry_tyrant', n: 1 }, reward: { credit: 1500, xp: 2500, shard: 20, item: ['gem_ruby_0', 2] } },
  { id: 'm7', title: 'Hutan Kaca', text: 'Pergi ke Glasswood Expanse (lv 12+). Kurangi Glass Stalker.', goal: { type: 'kill', target: 'glass_stalker', n: 10 }, reward: { credit: 2000, xp: 6000 } },
  { id: 'm8', title: 'Duri dan Cangkang', text: 'Thornback merusak jalur logistik.', goal: { type: 'kill', target: 'thornback', n: 10 }, reward: { credit: 2600, xp: 9000, item: ['mat_lumen', 4] } },
  { id: 'm9', title: 'Induk Hutan', text: 'Verdigris Matriarch melahirkan kawanan baru. Hentikan.', goal: { type: 'kill', target: 'verdigris_matriarch', n: 1 }, reward: { credit: 6000, xp: 20000, shard: 30 } },
  { id: 'm10', title: 'Jalan Menuju Job', text: 'Capai level 30 dan pilih jalur Job Advancement di Quartermaster.', goal: { type: 'level', n: 30 }, reward: { credit: 5000, xp: 0, item: ['mat_core', 2] } },
  { id: 'm11', title: 'Abu Rekahan', text: 'Ashen Rift membara. Lumpuhkan War Automaton.', goal: { type: 'kill', target: 'war_automaton', n: 12 }, reward: { credit: 9000, xp: 50000 } },
  { id: 'm12', title: 'Penguasa Bara', text: 'Cinder Sovereign mengklaim Rift. Jatuhkan dia.', goal: { type: 'kill', target: 'cinder_sovereign', n: 1 }, reward: { credit: 20000, xp: 90000, shard: 50 } },
  { id: 'm13', title: 'Perang Inti', text: 'Bertarunglah di Crystal Core. Kalahkan 10 pemain faksi lawan.', goal: { type: 'pvp', n: 10 }, reward: { credit: 30000, xp: 150000, shard: 80 } },
  { id: 'm14', title: 'Jantung Veyra', text: 'Heart Warden menjaga kristal terbesar. Buktikan faksimu layak.', goal: { type: 'kill', target: 'heart_warden', n: 1 }, reward: { credit: 100000, xp: 300000, shard: 200, item: ['wpn_CLASS_7', 1] } },
];

// Pool quest harian, dipilih 3 per hari sesuai level
export const DAILY_POOL = [
  { id: 'd_hunt', title: 'Perburuan Harian', type: 'killzone', n: 20 },
  { id: 'd_ore', title: 'Shift Tambang', type: 'gather', item: 'mat_ore', n: 10 },
  { id: 'd_crys', title: 'Panen Kristal', type: 'gather', item: 'mat_crystal', n: 8 },
  { id: 'd_elite', title: 'Target Elite', type: 'elite', n: 2 },
  { id: 'd_pvp', title: 'Patroli Perbatasan', type: 'pvp', n: 3, minLv: 40 },
  { id: 'd_up', title: 'Perawatan Senjata', type: 'upgrade', n: 1 },
  { id: 'd_craft', title: 'Kerajinan Harian', type: 'craft', n: 3 },
];
