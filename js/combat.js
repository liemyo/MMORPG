// Combat: skills, damage, buffs/debuffs, DoT, death, rewards & loot. Visual FX are primitives.
import { THREE, floatText } from './engine.js';
import { projectile as fxProjectile, shockwave, burst, aura, updateFx } from './gfx/fx.js';
import { G, bus, gainXp, earn, makeItem, resolveId } from './state.js';
import { SKILLS } from './data.js';
import { ITEMS, itemTierFor } from './items.js';
import { addItem } from './inventory.js';

export const GCD = 0.45;

export function hostile(a, b) {
  if (a.dead || b.dead || a.peaceful || b.peaceful || b.isNpc) return false;
  const am = a.kind === 'monster', bm = b.kind === 'monster';
  if (am !== bm) return true;
  if (am && bm) return false;
  return a.faction !== b.faction && !!G.zone?.pvp;
}

export function skillRange(u, s) {
  if (s.range === 'melee') return 3.2;
  if (typeof s.range === 'number') return s.range;
  return u.range || (u.cls ? { warrior: 3.2, ranger: 16, caster: 18, specialist: 12 }[u.cls] : 3);
}

const rankOf = (u, id) => (u.kind === 'player' ? G.char.skills[id] || 0 : 1 + Math.floor(u.level / 15));
export const needsTarget = (s) => ['dmg', 'aoe', 'debuff', 'leap'].includes(s.type);

// returns true if cast happened; reason string on failure for UI
export function useSkill(u, id, target) {
  const s = SKILLS[id];
  if (!s || u.dead || u.stun > 0) return false;
  const rank = rankOf(u, id);
  if (!rank) return fail(u, 'Skill belum dipelajari');
  if ((u.cds[id] || 0) > 0 || u.gcd > 0) return false;
  const mp = Math.round((s.mp || 0) * (1 + 0.1 * (rank - 1)));
  if (u.mp < mp) return fail(u, 'MP tidak cukup');
  if (needsTarget(s)) {
    if (!target || target.dead || !hostile(u, target)) return fail(u, 'Tidak ada target');
    if (target.pos.distanceTo(u.pos) > skillRange(u, s) + 0.5) return fail(u, 'Terlalu jauh');
  }
  if (u.kind === 'player' && G.zone?.safe && needsTarget(s)) return fail(u, 'Zona aman');
  u.mp -= mp;
  u.cds[id] = s.cd * (u.kind === 'player' ? 1 : 1.4);
  u.gcd = GCD;
  u.atkT = 0.25;
  const pw = 1 + 0.12 * (rank - 1);
  const mult = (s.mult || 0) * pw;
  if (target && needsTarget(s)) u.root.rotation.y = Math.atan2(target.pos.x - u.pos.x, target.pos.z - u.pos.z);

  switch (s.type) {
    case 'dmg':
      projectile(u, target, s);
      hit(u, target, mult, s);
      break;
    case 'debuff':
      projectile(u, target, s);
      hit(u, target, mult, s);
      break;
    case 'aoe':
      ring(target.pos, s.radius, colOf(u));
      for (const o of around(target.pos, s.radius)) if (hostile(u, o)) hit(u, o, mult, s);
      break;
    case 'self_aoe':
      ring(u.pos, s.radius, colOf(u));
      for (const o of around(u.pos, s.radius)) if (hostile(u, o)) hit(u, o, mult, s);
      break;
    case 'leap': {
      const dir = new THREE.Vector3().subVectors(u.pos, target.pos).setY(0).normalize().multiplyScalar(1.6);
      u.pos.set(target.pos.x + dir.x, target.pos.y, target.pos.z + dir.z);
      ring(target.pos, s.radius, 0xff8040);
      for (const o of around(target.pos, s.radius)) if (hostile(u, o)) hit(u, o, mult, s);
      break;
    }
    case 'heal': {
      const amt = Math.round(u.atk * s.mult * pw);
      heal(u, amt);
      aura(u.pos, 0x60ff90);
      break;
    }
    case 'buff':
      applySelfFx(u, s, pw);
      aura(u.pos, 0xfff080);
      break;
  }
  if (u.kind === 'player') bus.emit('cast', id);
  return true;
}

function fail(u, msg) {
  if (u.kind === 'player') bus.emit('toast', msg);
  return false;
}

function applySelfFx(u, s, pw) {
  const fx = s.fx || {};
  for (const k of ['buff', 'buff2']) if (fx[k]) addBuff(u, { ...fx[k], pct: fx[k].pct * (0.9 + pw * 0.1) }, s.name);
  if (fx.heal) heal(u, Math.round(u.maxHp * fx.heal));
}

export function addBuff(u, b, name) {
  u.buffs = u.buffs.filter((x) => !(x.name === name && x.stat === b.stat));
  u.buffs.push({ name, stat: b.stat, pct: b.pct, t: b.dur, dur: b.dur, debuff: b.pct < 0 });
}

function around(p, r) {
  const list = G.units.filter((o) => !o.dead && o.pos.distanceTo(p) <= r);
  if (G.player && !G.player.dead && G.player.pos.distanceTo(p) <= r) list.push(G.player);
  return list;
}

export function heal(u, amt) {
  const real = Math.min(amt, u.maxHp - u.hp);
  u.hp += real;
  if (u.kind === 'player' || u === G.target) floatText(`+${Math.round(real)}`, u.pos, 'heal');
}

function hit(src, dst, mult, s) {
  if (dst.dead) return;
  const skillBonus = src.base.skill || 0;
  damage(src, dst, mult * (1 + skillBonus), s?.fx);
}

export function basicAttack(u, t) {
  if (u.gcd > 0 || u.stun > 0) return;
  u.gcd = u.mdef?.boss ? 1.6 : 1.9;
  u.atkT = 0.3;
  if (u.mdef?.ranged) projectile(u, t, { icon: '' });
  // bosses occasionally slam AoE
  if (u.mdef?.boss && Math.random() < 0.25) {
    ring(u.pos, 7, 0xff4020);
    for (const o of around(u.pos, 7)) if (hostile(u, o)) damage(u, o, 1.6);
    return;
  }
  damage(u, t, 1);
}

export function damage(src, dst, mult, fx) {
  if (dst.dead) return 0;
  const K = 40 + src.level * 6;
  let raw = src.atk * mult * (0.9 + Math.random() * 0.2);
  const crit = Math.random() < src.crit;
  if (crit) raw *= 1.8;
  let dmg = Math.max(1, Math.round(raw * K / (K + dst.def)));
  if (src.kind !== 'monster' && dst.kind !== 'monster') dmg = Math.round(dmg * 0.55); // PvP scaling
  if (dst.kind === 'player' && G.god) dmg = 0;
  dst.hp -= dmg;
  if (dst.kind === 'player' || src.kind === 'player') floatText(crit ? `${dmg}!` : `${dmg}`, dst.pos, dst.kind === 'player' ? 'hurt' : crit ? 'crit' : 'dmg');
  if (!dst.target && dst.kind !== 'player') dst.target = src;
  if (dst.kind === 'monster' && dst.target?.kind === 'bot' && src.kind === 'player' && Math.random() < 0.3) dst.target = src;
  if (dst.kind === 'player') { dst.lastHitBy = src; bus.emit('hurt'); }
  if (fx && dmg > 0) {
    if (fx.stun) dst.stun = Math.max(dst.stun, dst.mdef?.boss ? fx.stun * 0.4 : fx.stun);
    if (fx.slow) dst.slow = { pct: fx.slow.pct, t: fx.slow.dur };
    if (fx.dot) dst.dots.push({ dps: src.atk * fx.dot.pct, t: fx.dot.dur, src, acc: 0 });
    if (fx.debuff) addBuff(dst, fx.debuff, 'debuff');
  }
  if (dst.hp <= 0) kill(dst, src);
  return dmg;
}

export function tickUnit(u, dt) {
  if (u.dead) return;
  u.gcd -= dt;
  if (u.stun > 0) u.stun -= dt;
  for (const k in u.cds) if (u.cds[k] > 0) u.cds[k] -= dt;
  if (u.slow && (u.slow.t -= dt) <= 0) u.slow = null;
  if (u.buffs.length) u.buffs = u.buffs.filter((b) => (b.t -= dt) > 0);
  for (const d of u.dots) {
    d.t -= dt; d.acc += dt;
    if (d.acc >= 1) { d.acc -= 1; if (!u.dead) { const n = Math.max(1, Math.round(d.dps)); u.hp -= n; if (d.src === G.player || u === G.player) floatText(n, u.pos, 'dot'); if (u.hp <= 0) kill(u, d.src); } }
  }
  if (u.dots.length) u.dots = u.dots.filter((d) => d.t > 0);
  // regen out of combat
  const regen = u.kind === 'monster' ? 0 : u.inCombat ? 0.004 : 0.02;
  if (!u.dead) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * regen * dt); u.mp = Math.min(u.maxMp, u.mp + u.maxMp * (regen + 0.01) * dt); }
}

// ---------- Death & rewards ----------
export function kill(dst, src) {
  if (dst.dead) return;
  dst.dead = true; dst.hp = 0; dst.target = null; dst.dots = []; dst.buffs = [];
  dst.root.visible = false;
  if (G.target === dst) G.target = null;
  if (dst.kind === 'player') { bus.emit('playerDeath', src); return; }
  dst.respawnT = dst.kind === 'bot' ? 12 : dst.mdef.boss ? dst.mdef.respawn : dst.mdef.elite ? 60 : 18;
  if (src === G.player) reward(dst);
  if (dst.kind === 'bot' && G.war?.active) bus.emit('warKill', src?.faction);
}

const warBonus = () => (G.war?.owner === G.char.faction ? 1.5 : 1);

function reward(dst) {
  const c = G.char;
  if (dst.kind === 'monster') {
    const r = dst.reward, lvDiff = dst.level - c.level;
    const xpMul = lvDiff < -8 ? 0.2 : lvDiff < -4 ? 0.6 : lvDiff > 4 ? 1.3 : 1;
    gainXp(r.xp * xpMul);
    const cr = Math.round(r.credit * (0.8 + Math.random() * 0.4) * warBonus());
    earn(cr);
    c.stats.kills++;
    bus.emit('chat', 'loot', `+${r.xp * xpMul | 0} XP, +${cr} Credit`);
    for (const [id, ch] of dst.mdef.drops || []) if (Math.random() < ch * warBonus()) dropItem(id, dst);
    bus.emit('kill', dst);
  } else if (dst.kind === 'bot') {
    c.stats.pvp++;
    gainXp(200 + dst.level * 25);
    earn(100 + dst.level * 10, 1);
    bus.emit('chat', 'pvp', `Kamu mengalahkan ${dst.name} (${dst.faction}). +1 Core Shard`);
    bus.emit('pvpKill', dst);
  }
}

function dropItem(id, src) {
  let inst;
  if (id === 'GEAR' || id === 'GEAR_EPIC') {
    const t = Math.min(7, itemTierFor(src.level));
    const slots = [`wpn_${G.char.cls}_${t}`, `arm_${t}`, `helm_${t}`, `boot_${t}`, `ring_${t}`, `amu_${t}`];
    const pick = slots[Math.floor(Math.random() * slots.length)];
    inst = makeItem(pick, 1, { rarity: id === 'GEAR_EPIC' ? 'epic' : Math.random() < 0.6 ? 'rare' : 'common' });
  } else inst = makeItem(resolveId(id), 1);
  if (addItem(inst)) bus.emit('chat', 'loot', `Dapat: ${ITEMS[inst.id].name}${inst.rarity !== 'common' ? ` [${inst.rarity}]` : ''}`);
  else bus.emit('toast', 'Inventaris penuh!');
}

// ---------- FX ----------
const SKILL_COL = { warrior: 0xffa040, ranger: 0x80ff90, caster: 0x60b0ff, specialist: 0xfff060 };
const colOf = (u) => (u.kind === 'monster' ? 0xff4030 : SKILL_COL[u.cls] || 0xffffff);
function ring(p, r, color) { shockwave(p, r, color); }
function projectile(src, dst) {
  if (!dst) return;
  const a = src.pos.clone(); a.y += 1.5;
  const b = dst.pos.clone(); b.y += Math.min(1.4, (dst.height || 2) * 0.55);
  if (src.pos.distanceTo(dst.pos) < 4) return burst(b, colOf(src), 8, 3, 0.3);
  fxProjectile(a, b, colOf(src));
}
export { updateFx };
