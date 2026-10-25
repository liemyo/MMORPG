// Entry point: boot, game start, zone travel, input bindings, core loop.
import { render, camera, cam, updateCamera, updateOverlays, clearOverlay, floatText } from './engine.js';
import { G, bus, computeStats, unlockSkills, saveGame, isSandbox, pay } from './state.js';
import { FACTIONS } from './data.js';
import { ZONES } from './zones.js';
import { world, buildZone, updateWorld, ground } from './world.js';
import { createPlayer, populateMonsters, populateBots, clearUnits, updateAI, placeUnit } from './units.js';
import { tickUnit, updateFx } from './combat.js';
import { updatePlayer, handleClick, cycleTarget, useHotbar, interactNearest } from './player.js';
import { quickUse } from './inventory.js';
import { initQuestHooks, ensureDaily } from './quests.js';
import { initWar, updateWar, updateChatter } from './war.js';
import { updateHud, buildHotbar, refreshHotbar, initChat } from './ui/hud.js';
import { RENDER, toggleWin, closeAll, anyOpen, refreshAll } from './ui/windows.js';
import { openNpc } from './ui/npcwin.js';
import './ui/cheat.js';
import { showMainMenu, clearScreen } from './ui/menu.js';
import { initMobile } from './ui/mobile.js';

window.G = G; // debug console access

function startGame(c, slot, isNew) {
  G.char = c; G.slot = slot;
  // migrate / defaults
  c.hotbar ||= Array(9).fill(null);
  if (!c.hotbar[8]) c.hotbar[8] = 'item:pot_hp1';
  c.stats ||= { kills: 0, pvp: 0, deaths: 0, crafted: 0, upgrades: 0 };
  if (!ZONES[c.zone] || (ZONES[c.zone].kind === 'city' && ZONES[c.zone].faction !== c.faction)) c.zone = `city_${c.faction}`;
  unlockSkills(c);
  clearScreen();
  document.getElementById('hud').classList.remove('hidden');
  initChat(); initQuestHooks(); initWar(c.warOwner || null);
  ensureDaily();
  G.player = createPlayer(c);
  enterZone(c.zone, c.pos);
  buildHotbar();
  initMobile();
  bus.emit('chat', 'sys', `Selamat datang di Veyra, ${c.name} dari ${FACTIONS[c.faction].name}.${isSandbox() ? ' [Sandbox Mode: uang ∞]' : ''}`);
  bus.emit('chat', 'sys', 'Ketik /help untuk kontrol. Temui Quartermaster (!) untuk quest pertama.');
  if (isNew) saveGame();
  setInterval(() => saveGame(), 60000);
  last = performance.now();
  requestAnimationFrame(loop);
}

function enterZone(zoneId, pos) {
  const Z = ZONES[zoneId];
  clearUnits(); clearOverlay();
  buildZone(zoneId);
  G.char.zone = zoneId;
  const p = G.player;
  const sp = pos && Math.hypot(pos.x, pos.z) < Z.size * 0.48 ? pos : world.spawn;
  placeUnit(p, sp.x, sp.z);
  cam.yaw = Math.hypot(sp.x, sp.z) > 10 ? Math.atan2(sp.x, sp.z) : 0; // camera behind player, looking toward zone center
  p.autoMove = null; p.gather = null; G.target = null;
  populateMonsters(Z);
  populateBots(Z);
  bus.emit('chat', 'sys', `Memasuki ${Z.name}${Z.pvp ? ' — ZONA PVP! Faksi lain bisa menyerangmu.' : Z.safe ? ' (zona aman)' : ''}`);
}

bus.on('travel', (zoneId) => {
  const Z = ZONES[zoneId];
  if (!Z) return;
  if (Z.kind === 'city' && Z.faction !== G.char.faction) return bus.emit('toast', 'Kota faksi lain tertutup');
  if (G.player.dead) revive(false);
  closeAll();
  enterZone(zoneId, null);
  saveGame();
});

bus.on('npc', openNpc);
bus.on('click', (x, y) => handleClick(x, y));

function recalc() {
  const p = G.player, ratio = p.hp / p.maxHp, mr = p.mp / Math.max(1, p.maxMp);
  p.base = computeStats(G.char);
  if (G.speedHack) p.base.spd += 1;
  p.level = G.char.level;
  p.hp = Math.min(p.maxHp, Math.max(1, Math.round(p.maxHp * ratio))); p.mp = Math.round(p.maxMp * mr);
}
bus.on('stats', recalc);
bus.on('levelup', (n) => {
  if (n <= 0) return recalc();
  recalc();
  G.player.hp = G.player.maxHp; G.player.mp = G.player.maxMp;
  const added = unlockSkills(G.char);
  refreshHotbar();
  floatText(`LEVEL ${G.char.level}!`, G.player.pos, 'crit');
  bus.emit('chat', 'quest', `★ Level naik ke ${G.char.level}! +${n} Skill Point${added.length ? ` · Skill baru: ${added.length}` : ''}`);
  if (G.char.level === 30 || G.char.level === 50) bus.emit('chat', 'quest', '★ Job Advancement terbuka — temui Quartermaster di kota!');
  bus.emit('skills');
});
bus.on('skills', refreshHotbar);

// ---------- Death ----------
bus.on('playerDeath', (killer) => {
  G.char.stats.deaths++;
  const loss = isSandbox() ? 0 : Math.floor(G.char.xp * 0.05);
  G.char.xp -= loss;
  const el = document.createElement('div');
  el.className = 'dead'; el.id = 'deadBox';
  el.innerHTML = `<div class="panel"><h2>Kamu tumbang</h2><p>Dikalahkan oleh ${killer?.name || '???'}${loss ? ` · −${loss} XP` : ''}</p>
    <div class="row" style="justify-content:center"><button class="pri" id="rvTown">Bangkit di kota</button>
    <button id="rvHere">Bangkit di tempat (◆ 5)</button></div></div>`;
  document.body.appendChild(el);
  el.querySelector('#rvTown').onclick = () => { revive(false); bus.emit('travel', `city_${G.char.faction}`); };
  el.querySelector('#rvHere').onclick = () => { if (pay(0, 5)) revive(true); else bus.emit('toast', 'Core Shard tidak cukup'); };
});
function revive(here) {
  document.getElementById('deadBox')?.remove();
  const p = G.player;
  p.dead = false; p.root.visible = true; p.hp = p.maxHp * (here ? 0.5 : 1); p.mp = p.maxMp * 0.5;
  p.buffs = []; p.dots = []; p.stun = 0; p.slow = null;
  for (const u of G.units) if (u.target === p) u.target = null;
}

// ---------- Keys ----------
bus.on('key', (k) => {
  if (!G.char || document.getElementById('screen').innerHTML) return;
  if (k === 'F10') return toggleWin('cheat');
  if (k === 'Escape') { if (anyOpen()) closeAll(); else RENDER.system.open(); return; }
  if (G.player.dead) return;
  if (k >= '1' && k <= '9') return useHotbar(+k - 1);
  if (k === '0') return quickUse(['pot_mp2', 'pot_mp1'].find((id) => G.char.inv.some((x) => x?.id === id)) || 'pot_mp1');
  if (k === 'Tab') return cycleTarget();
  if (k === 'f') return interactNearest();
  const win = { i: 'inventory', c: 'character', k: 'skills', l: 'quests', m: 'travel' }[k];
  if (win) toggleWin(win);
});

// ---------- Loop ----------
let last = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;
  const p = G.player;
  tickUnit(p, dt);
  updatePlayer(dt);
  for (const u of G.units) { tickUnit(u, dt); updateAI(u, dt); if (!u.dead) animateUnit(u, dt); }
  if (G.nearQuestNpc) { const q = world.npcs.find((n) => n.role === 'quest'); if (!q || q.pos.distanceTo(p.pos) > 9) { G.nearQuestNpc = false; refreshAll(); } }
  updateWorld(dt);
  updateFx(dt);
  updateWar(dt);
  updateChatter(dt);
  updateCamera(p.pos, dt);
  render();
  updateOverlays(dt, [...G.units, ...world.npcs, ...world.portals]);
  updateHud(dt);
}
import { animate as animateUnit } from './units.js';

showMainMenu(startGame);
