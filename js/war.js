// Faction war event (every 30 min, 5 min long) + simulated world chatter from AI players.
import { G, bus } from './state.js';
import { FACTIONS, FACTION_IDS } from './data.js';
import { world } from './world.js';
import { botName } from './units.js';

export const WAR_INTERVAL = 30 * 60;
export const WAR_DURATION = 5 * 60;

export function initWar(owner = null) {
  G.war = { next: 5 * 60, active: false, t: 0, score: zero(), owner, warned: false };
  bus.on('warKill', (f) => { if (G.war.active && f && FACTIONS[f]) G.war.score[f] += 3; });
  bus.on('pvpKill', () => { if (G.war.active) G.war.score[G.char.faction] += 2; });
}
const zero = () => Object.fromEntries(FACTION_IDS.map((f) => [f, 0]));

export function startWarNow() { if (!G.war.active) { G.war.next = 0; G.war.warned = true; } }

export function updateWar(dt) {
  const w = G.war;
  if (!w) return;
  if (!w.active) {
    w.next -= dt;
    if (!w.warned && w.next <= 60) { w.warned = true; bus.emit('chat', 'war', '⚠ Perang faksi di Crystal Core dimulai dalam 1 menit!'); }
    if (w.next <= 0) {
      w.active = true; w.t = WAR_DURATION; w.score = zero();
      bus.emit('chat', 'war', '⚔ PERANG FAKSI DIMULAI! Kuasai Crystal Core (Lv 40+).');
      bus.emit('war', 'start');
    }
    return;
  }
  w.t -= dt;
  // Influence: units standing on the capture ring each second
  w.acc = (w.acc || 0) + dt;
  if (w.acc >= 1) {
    w.acc -= 1;
    if (G.zone?.pvp && world.capture) {
      const c = world.capture;
      const all = G.player && !G.player.dead ? [...G.units, G.player] : G.units;
      for (const u of all) {
        if (u.dead || u.kind === 'monster' || !FACTIONS[u.faction]) continue;
        if (Math.hypot(u.pos.x - c.x, u.pos.z - c.z) < c.r) w.score[u.faction] += u === G.player ? 2 : 1;
      }
    } else {
      // abstract simulation when the player is elsewhere
      for (const f of FACTION_IDS) w.score[f] += Math.random() < 0.5 ? Math.floor(Math.random() * 4) : 0;
    }
    const lead = leader();
    if (world.capture && lead) world.capture.ring.material.color.setHex(FACTIONS[lead].color);
  }
  if (w.t <= 0) endWar();
}

export function leader() {
  const s = G.war.score;
  const best = FACTION_IDS.reduce((a, b) => (s[b] > s[a] ? b : a));
  return s[best] > 0 ? best : null;
}

function endWar() {
  const w = G.war;
  w.active = false; w.next = WAR_INTERVAL - WAR_DURATION; w.warned = false;
  w.owner = leader();
  G.char.warOwner = w.owner;
  const name = w.owner ? FACTIONS[w.owner].name : 'Tidak ada';
  bus.emit('chat', 'war', `🏆 Perang selesai. Pemenang: ${name}. Faksi pemenang mendapat +50% drop & Credit sampai perang berikutnya.`);
  if (w.owner === G.char.faction) bus.emit('chat', 'war', 'Faksimu menguasai Core! Bonus drop aktif.');
  bus.emit('war', 'end');
}

// ---------- World chatter ----------
const LINES = [
  'LFG Glasswood, butuh healer', 'WTS Polished Ember Shard, PM', 'ada yang tahu respawn Quarry Tyrant?', 'gas ke Core habis ini',
  'upgrade +9 gagal lagi, turun +8 :(', 'akhirnya +10!!', 'Specialist itu underrated', 'party Ashen Rift, lv 35+',
  'jual Lumen Crystal murah', 'siapa yang pegang Core sekarang?', 'GG war tadi', 'nyari guild aktif',
  'drop epic dari golem, hoki banget', 'Caster AoE paling enak buat farming', 'jangan solo Matriarch, sakit',
];
let chatT = 8;
export function updateChatter(dt) {
  if ((chatT -= dt) > 0) return;
  chatT = 12 + Math.random() * 30;
  const f = FACTION_IDS[Math.floor(Math.random() * 3)];
  const line = G.war?.active && Math.random() < 0.5
    ? ['semua ke tengah!', 'tahan ring!', 'butuh bantuan di Core', 'mereka push dari timur', 'fokus Caster mereka'][Math.floor(Math.random() * 5)]
    : LINES[Math.floor(Math.random() * LINES.length)];
  bus.emit('chat', `f-${f}`, `[${botName()}] ${line}`);
}

export const fmtTime = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
