// Runtime units (player, monsters, AI bots) + their AI.
import { THREE, scene, makePlate } from './engine.js';
import { G, computeStats, makeItem } from './state.js';
import { CLASSES, CLASS_IDS, FACTIONS, FACTION_IDS, SKILLS, classSkills } from './data.js';
import { MONSTERS, monsterStats } from './zones.js';
import { itemTierFor } from './items.js';
import { buildHumanoid, buildMonster, animateRig } from './models.js';
import { world, ground } from './world.js';
import { useSkill, basicAttack, hostile } from './combat.js';

export class Unit {
  constructor(o) {
    Object.assign(this, { buffs: [], dots: [], cds: {}, stun: 0, slow: null, dead: false, gcd: 0, anim: 0, atkT: 0 }, o);
    this.pos = this.root.position;
    this.root.userData.ref = this;
    this.hp = this.hp ?? this.base.maxHp; this.mp = this.mp ?? this.base.maxMp;
    scene.add(this.root);
  }
  get maxHp() { return this.base.maxHp; }
  get maxMp() { return this.base.maxMp; }
  mod(stat) { let p = 0; for (const b of this.buffs) if (b.stat === stat) p += b.pct; return p; }
  get atk() { return this.base.atk * (1 + this.mod('atk')); }
  get def() { return Math.max(0, this.base.def * (1 + this.mod('def'))); }
  get crit() { return this.base.crit + this.mod('crit'); }
  get speedMul() { return Math.max(0.2, 1 + (this.base.spd || 0) + this.mod('spd') - (this.slow ? this.slow.pct : 0)); }
  remove() { scene.remove(this.root); this.plate?.remove(); }
}

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));

export function placeUnit(u, x, z) { u.pos.set(x, ground(x, z), z); }

export function moveToward(u, x, z, dt, stop = 0.5, speed = 6) {
  const dx = x - u.pos.x, dz = z - u.pos.z, d = Math.hypot(dx, dz);
  if (d <= stop) return true;
  const step = Math.min(d - stop, speed * u.speedMul * dt);
  u.pos.x += (dx / d) * step; u.pos.z += (dz / d) * step;
  u.pos.y = ground(u.pos.x, u.pos.z);
  u.root.rotation.y = Math.atan2(dx, dz);
  u.moving = true;
  return false;
}
export function face(u, t) { u.root.rotation.y = Math.atan2(t.pos.x - u.pos.x, t.pos.z - u.pos.z); }

export function animate(u, dt) {
  animateRig(u, dt);
  u.atkT -= dt;
  u.moving = false;
}

// ---------- Player ----------
export function createPlayer(c) {
  const { root, parts, height } = buildHumanoid(c.faction, c.cls, c.look);
  const u = new Unit({ kind: 'player', name: c.name, level: c.level, faction: c.faction, cls: c.cls, root, parts, height,
    base: computeStats(c), hp: c.hp, mp: c.mp });
  return u;
}

// ---------- Monsters ----------
export function spawnMonster(id, x, z) {
  const def = MONSTERS[id];
  const lv = randi(def.lv[0], def.lv[1]);
  const st = monsterStats(def, lv);
  const { root, parts, height, float } = buildMonster(def.shape, def.color, def.size * (def.boss ? 1 : rand(0.9, 1.1)));
  const u = new Unit({ kind: 'monster', mdef: def, name: def.name, level: lv, faction: 'monster', root, parts, height, float,
    base: { maxHp: st.hp, maxMp: 0, atk: st.atk, def: st.def, crit: 0.05, spd: 0 }, reward: st,
    home: { x, z }, state: 'idle', wanderT: rand(1, 5), range: def.ranged ? 11 : 2.2 + def.size * 0.6 });
  placeUnit(u, x, z);
  const tag = def.boss ? 'BOSS ' : def.elite ? 'Elite ' : '';
  makePlate(u, `<small>Lv${lv}</small> ${tag}${def.name}`, def.boss ? 'boss' : def.elite ? 'elite' : 'mob');
  G.units.push(u);
  return u;
}

export function populateMonsters(Z) {
  const S = Z.size * 0.45;
  for (const [id, n] of Z.monsters) {
    const def = MONSTERS[id];
    for (let i = 0; i < n; i++) {
      let x, z;
      if (def.boss) { const a = Math.random() * 6.28; x = Math.cos(a) * S * 0.8; z = Math.sin(a) * S * 0.8; if (Z.pvp) { x = 0; z = S * 0.6; } } // keep the Core boss off the capture point
      else { const a = Math.random() * 6.28, d = rand(32, S); x = Math.cos(a) * d; z = Math.sin(a) * d; }
      spawnMonster(id, x, z);
    }
  }
}

// ---------- AI bots (simulated players) ----------
const SYL = ['ka', 'ri', 'vo', 'len', 'tor', 'mi', 'zar', 'el', 'dra', 'sy', 'ne', 'qu', 'ox', 'fa', 'ul', 'thi', 'ro', 'ven'];
export const botName = () => { const n = randi(2, 3); let s = ''; for (let i = 0; i < n; i++) s += SYL[randi(0, SYL.length - 1)]; return s[0].toUpperCase() + s.slice(1) + (Math.random() < 0.3 ? randi(1, 99) : ''); };

export function spawnBot(faction, lv, x, z) {
  const cls = CLASS_IDS[randi(0, 3)];
  const t = itemTierFor(lv);
  const fake = { cls, faction, level: lv, job: null, equip: { weapon: makeItem(`wpn_${cls}_${t}`, 1, { plus: randi(0, 6) }), armor: makeItem(`arm_${t}`, 1, { plus: randi(0, 4) }), helm: makeItem(`helm_${t}`) } };
  const pal = FACTIONS[faction].color;
  const look = { skin: [0xf0d0b0, 0xc89a70, 0x8a6040, 0xa0a8b0][randi(0, 3)], primary: new THREE.Color(pal).offsetHSL(0, 0, rand(-0.2, 0.05)).getHex(), secondary: [0x303040, 0xe0e0e0, 0x804020, 0x202020][randi(0, 3)], face: randi(0, 3), hair: randi(0, 3) };
  const { root, parts, height } = buildHumanoid(faction, cls, look);
  const skills = classSkills(cls).filter((id) => SKILLS[id].lv <= lv && SKILLS[id].type !== 'buff' && SKILLS[id].type !== 'heal');
  const u = new Unit({ kind: 'bot', name: botName(), level: lv, faction, cls, root, parts, height, base: computeStats(fake), skills,
    home: { x, z }, state: 'idle', wanderT: rand(0, 4), potT: 0, range: CLASSES[cls].range, look });
  placeUnit(u, x, z);
  makePlate(u, `<small>Lv${lv}</small> ${u.name}`, `bot f-${faction}${faction !== G.char.faction && G.zone.pvp ? ' hostile' : ''}`);
  G.units.push(u);
  return u;
}

export function populateBots(Z) {
  const S = Z.size * 0.42;
  if (Z.kind === 'city') {
    for (let i = 0; i < 10; i++) { const a = rand(0, 6.28), d = rand(6, 30); spawnBot(Z.faction, randi(1, 60), Math.cos(a) * d, Math.sin(a) * d).peaceful = true; }
    return;
  }
  const count = Z.pvp ? 0 : 7;
  for (let i = 0; i < count; i++) {
    const a = rand(0, 6.28), d = rand(20, S);
    spawnBot(Math.random() < 0.6 ? G.char.faction : FACTION_IDS[randi(0, 2)], randi(Z.lv[0], Z.lv[1]), Math.cos(a) * d, Math.sin(a) * d);
  }
  if (Z.pvp) for (const f of FACTION_IDS) for (let i = 0; i < 6; i++) {
    const s = world.factionSpawn[f];
    spawnBot(f, randi(45, 60), s.x + rand(-6, 6), s.z + rand(-6, 6)).coreBot = true;
  }
}

// ---------- AI tick ----------
function nearestHostile(u, radius, filter) {
  let best = null, bd = radius;
  const cands = G.player && !G.player.dead ? [...G.units, G.player] : G.units;
  for (const o of cands) {
    if (o === u || o.dead || !hostile(u, o) || (filter && !filter(o))) continue;
    const d = o.pos.distanceTo(u.pos);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function wander(u, dt, radius) {
  if ((u.wanderT -= dt) <= 0) {
    u.wanderT = rand(3, 8);
    const a = rand(0, 6.28), d = rand(0, radius);
    u.wp = { x: u.home.x + Math.cos(a) * d, z: u.home.z + Math.sin(a) * d };
  }
  if (u.wp && moveToward(u, u.wp.x, u.wp.z, dt, 0.5, u.kind === 'bot' ? 4.5 : 2.5)) u.wp = null;
}

export function updateAI(u, dt) {
  if (u.dead) {
    if ((u.respawnT -= dt) <= 0) respawn(u);
    return;
  }
  if (u.stun > 0) return;
  if (u.kind === 'monster') return monsterAI(u, dt);
  if (u.kind === 'bot') return botAI(u, dt);
}

function monsterAI(u, dt) {
  const def = u.mdef;
  const homeD = Math.hypot(u.pos.x - u.home.x, u.pos.z - u.home.z);
  if (u.state === 'reset') {
    if (moveToward(u, u.home.x, u.home.z, dt, 1, 9)) { u.state = 'idle'; u.hp = u.maxHp; u.dots = []; }
    return;
  }
  if (u.target && (u.target.dead || homeD > (def.boss ? 30 : 40))) { u.target = null; u.state = 'reset'; return; }
  if (!u.target) {
    const aggro = def.boss ? 14 : def.elite ? 11 : 8;
    u.target = nearestHostile(u, aggro);
    if (!u.target) return wander(u, dt, 10);
  }
  const t = u.target, d = t.pos.distanceTo(u.pos);
  if (d > u.range) moveToward(u, t.pos.x, t.pos.z, dt, u.range * 0.9, def.boss ? 6 : 6.5);
  else { face(u, t); basicAttack(u, t); }
}

const potHeal = 0.4;
function botAI(u, dt) {
  if (u.peaceful) return wander(u, dt, 12);
  u.potT -= dt;
  if (u.hp < u.maxHp * 0.3 && u.potT <= 0) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * potHeal); u.potT = 18; }
  const Z = G.zone, war = G.war?.active && Z.pvp;
  if (u.target && (u.target.dead || u.target.pos.distanceTo(u.pos) > 40)) u.target = null;
  if (!u.target || (u.target.kind === 'monster' && Math.random() < 0.01)) {
    const enemyPlayer = Z.pvp ? nearestHostile(u, war ? 22 : 16, (o) => o.kind !== 'monster') : null;
    u.target = enemyPlayer || u.target || nearestHostile(u, Z.pvp && war ? 10 : 26, (o) => o.kind === 'monster' && (!o.mdef.boss || u.level >= o.level));
  }
  if (!u.target) {
    if (war) { const c = world.capture; if (!u.capOff) u.capOff = { x: rand(-8, 8), z: rand(-8, 8) }; return moveToward(u, c.x + u.capOff.x, c.z + u.capOff.z, dt, 0.8, 6); }
    return wander(u, dt, 25);
  }
  const t = u.target, d = t.pos.distanceTo(u.pos);
  const rng = u.range;
  if (d > rng) { moveToward(u, t.pos.x, t.pos.z, dt, rng * 0.85, 6.5); return; }
  face(u, t);
  // try a skill, fallback to the basic one
  const pick = u.skills[randi(0, u.skills.length - 1)];
  if (!useSkill(u, pick, t)) useSkill(u, u.skills[0], t);
}

function respawn(u) {
  u.dead = false; u.hp = u.maxHp; u.mp = u.maxMp; u.buffs = []; u.dots = []; u.stun = 0; u.slow = null;
  u.target = null; u.state = 'idle';
  let { x, z } = u.home;
  if (u.kind === 'bot' && G.zone.pvp) { const s = world.factionSpawn[u.faction]; x = s.x + rand(-5, 5); z = s.z + rand(-5, 5); }
  placeUnit(u, x, z);
  u.root.visible = true;
}

export function clearUnits() {
  for (const u of G.units) u.remove();
  G.units = [];
  G.target = null;
}
