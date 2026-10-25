// Player controller: movement, targeting, hotbar, interaction & gathering.
import { THREE, keys, cam, pick, typing } from './engine.js';
import { G, bus, makeItem } from './state.js';
import { SKILLS } from './data.js';
import { ITEMS } from './items.js';
import { world, ground } from './world.js';
import { useSkill, hostile, skillRange, needsTarget } from './combat.js';
import { moveToward, animate } from './units.js';
import { addItem, quickUse } from './inventory.js';

const INTERACT_R = 4.5;
let vy = 0, jumpY = 0;

export function cycleTarget() {
  const p = G.player;
  const list = G.units.filter((u) => !u.dead && hostile(p, u) && u.pos.distanceTo(p.pos) < 35)
    .sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos));
  if (!list.length) return (G.target = null);
  const i = list.indexOf(G.target);
  G.target = list[(i + 1) % list.length];
}

export function handleClick(x, y) {
  if (!G.player || G.paused) return;
  const roots = [...G.units.filter((u) => !u.dead).map((u) => u.root), ...world.pickables];
  const hit = pick(x, y, roots);
  if (!hit) return;
  let o = hit.object;
  while (o && !o.userData.ref) o = o.parent;
  const ref = o?.userData.ref;
  if (!ref) return;
  if (ref.isNpc || ref.isPortal || ref.isNode) return approach(ref);
  G.target = ref;
}

function approach(ref) {
  G.player.autoMove = { x: ref.pos.x, z: ref.pos.z, stop: INTERACT_R - 1, then: () => interactWith(ref) };
}

function interactWith(ref) {
  if (ref.isNpc) bus.emit('npc', ref);
  else if (ref.isPortal) bus.emit('npc', { role: 'travel', name: ref.name });
  else if (ref.isNode) startGather(ref);
}

export function interactNearest() {
  const p = G.player;
  const all = [...world.npcs, ...world.portals, ...world.nodes.filter((n) => n.ready)];
  let best = null, bd = INTERACT_R;
  for (const r of all) { const d = Math.hypot(r.pos.x - p.pos.x, r.pos.z - p.pos.z); if (d < bd) { bd = d; best = r; } }
  if (best) interactWith(best); else bus.emit('toast', 'Tidak ada yang bisa diinteraksi di dekatmu');
}

function startGather(node) {
  if (!node.ready) return bus.emit('toast', 'Node sedang tumbuh kembali');
  G.player.gather = { node, t: 0, dur: 1.6 };
}

export function useHotbar(i) {
  const id = G.char.hotbar[i];
  if (!id || !G.player || G.player.dead) return;
  if (id.startsWith('item:')) return quickUse(id.slice(5));
  const s = SKILLS[id];
  if (needsTarget(s) && (!G.target || G.target.dead || !hostile(G.player, G.target))) cycleTarget();
  const t = G.target;
  if (needsTarget(s) && t && t.pos.distanceTo(G.player.pos) > skillRange(G.player, s)) {
    // walk into range then cast
    G.player.autoMove = { x: t.pos.x, z: t.pos.z, stop: skillRange(G.player, s) - 1, follow: t, then: () => useSkill(G.player, id, t) };
    return;
  }
  useSkill(G.player, id, t);
}

export function updatePlayer(dt) {
  const p = G.player;
  if (!p || p.dead) return;
  p.inCombat = G.units.some((u) => u.target === p && !u.dead);
  if (p.stun > 0) return animate(p, dt);

  let mx = 0, mz = 0;
  if (!typing() && !G.uiBlock) {
    if (keys.has('w') || keys.has('arrowup')) mz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) mz += 1;
    if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    if (keys.has('d') || keys.has('arrowright')) mx += 1;
  }
  if (G.joy) { mx += G.joy.x; mz += G.joy.y; }
  const analog = Math.min(1, Math.hypot(mx, mz));
  const speed = 8 * p.speedMul * analog;
  if (analog > 0.05) {
    p.autoMove = null; p.gather = null;
    const f = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const dir = f.multiplyScalar(-mz).add(r.multiplyScalar(mx)).normalize();
    p.pos.x += dir.x * speed * dt; p.pos.z += dir.z * speed * dt;
    p.root.rotation.y = Math.atan2(dir.x, dir.z);
    p.moving = true;
  } else if (p.autoMove) {
    const a = p.autoMove;
    if (a.follow) { if (a.follow.dead) { p.autoMove = null; } else { a.x = a.follow.pos.x; a.z = a.follow.pos.z; } }
    if (p.autoMove && moveToward(p, a.x, a.z, dt, a.stop, 8)) { p.autoMove = null; a.then?.(); }
  }
  // bounds
  const lim = G.zone.size * 0.48, d = Math.hypot(p.pos.x, p.pos.z);
  if (d > lim) { p.pos.x *= lim / d; p.pos.z *= lim / d; }
  // jump
  if (keys.has(' ') && jumpY === 0 && !typing()) vy = 7;
  if (vy || jumpY) { jumpY = Math.max(0, jumpY + vy * dt); vy -= 20 * dt; if (jumpY === 0) vy = 0; }
  p.pos.y = ground(p.pos.x, p.pos.z) + jumpY;

  if (p.gather) {
    const g = p.gather;
    g.t += dt;
    p.atkT = 0.1;
    if (g.t >= g.dur) {
      p.gather = null;
      const n = g.node;
      const qty = 1 + (Math.random() < 0.35 ? 1 : 0);
      if (addItem(makeItem(n.item, qty))) bus.emit('chat', 'loot', `Mengumpulkan ${qty}× ${ITEMS[n.item].name}`);
      else bus.emit('toast', 'Inventaris penuh');
      n.ready = false; n.timer = 30; n.mesh.visible = false;
    }
  }
  animate(p, dt);
}

export function gatherProgress() { const g = G.player?.gather; return g ? g.t / g.dur : 0; }
