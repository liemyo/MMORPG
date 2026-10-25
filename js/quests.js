// Main story quests, daily quests, job advancement.
import { G, bus, gainXp, earn, makeItem, unlockSkills } from './state.js';
import { MAIN_QUESTS, DAILY_POOL, ZONES, FIELD_ORDER, MONSTERS } from './zones.js';
import { JOBS, xpToNext } from './data.js';
import { ITEMS } from './items.js';
import { addItem } from './inventory.js';

export const currentMain = () => MAIN_QUESTS[G.char.quests.main] || null;

export function mainProgress() {
  const q = currentMain();
  if (!q) return null;
  const n = q.goal.n;
  const p = q.goal.type === 'level' ? Math.min(G.char.level, n) : Math.min(G.char.quests.prog, n);
  return { q, p, n, done: p >= n };
}

function giveReward(r) {
  if (r.credit) earn(r.credit);
  if (r.shard) earn(0, r.shard);
  if (r.xp) gainXp(r.xp);
  if (r.item) {
    const inst = makeItem(r.item[0], r.item[1]);
    if (!addItem(inst)) bus.emit('toast', 'Inventaris penuh — hadiah item hilang');
  }
  const parts = [r.credit && `${r.credit} Credit`, r.shard && `${r.shard} Core Shard`, r.xp && `${r.xp} XP`, r.item && `${r.item[1]}× ${ITEMS[makeItem(r.item[0]).id].name}`].filter(Boolean);
  bus.emit('chat', 'quest', `Hadiah: ${parts.join(', ')}`);
}

export function turnInMain() {
  const m = mainProgress();
  if (!m || !m.done) return false;
  bus.emit('chat', 'quest', `Quest selesai: ${m.q.title}`);
  giveReward(m.q.reward);
  G.char.quests.main++; G.char.quests.prog = 0;
  // gather quests count what you already hold
  const nq = currentMain();
  if (nq) bus.emit('chat', 'quest', `Quest baru: ${nq.title}`);
  bus.emit('quest');
  return true;
}

// ---------- Daily ----------
const today = () => new Date().toISOString().slice(0, 10);
export function zoneForLevel(lv) {
  return FIELD_ORDER.find((z) => lv >= ZONES[z].lv[0] && lv < ZONES[z].lv[1]) || 'core';
}

export function ensureDaily() {
  const q = G.char.quests;
  if (q.daily && q.daily.date === today()) return q.daily;
  const pool = DAILY_POOL.filter((d) => !d.minLv || G.char.level >= d.minLv).sort(() => Math.random() - 0.5).slice(0, 3);
  const zone = zoneForLevel(G.char.level);
  q.daily = { date: today(), list: pool.map((d) => ({ ...d, zone, prog: 0, claimed: false })) };
  return q.daily;
}

export function dailyDesc(d) {
  switch (d.type) {
    case 'killzone': return `Kalahkan ${d.n} monster di ${ZONES[d.zone].name}`;
    case 'gather': return `Kumpulkan ${d.n}× ${ITEMS[d.item].name}`;
    case 'elite': return `Kalahkan ${d.n} Elite/Boss`;
    case 'pvp': return `Kalahkan ${d.n} pemain faksi lawan`;
    case 'upgrade': return `Lakukan upgrade item ${d.n}×`;
    case 'craft': return `Crafting ${d.n}×`;
  }
}

export function claimDaily(i) {
  const d = G.char.quests.daily.list[i];
  if (!d || d.claimed || d.prog < d.n) return;
  d.claimed = true;
  const lv = G.char.level;
  giveReward({ credit: 150 * lv, xp: Math.round(xpToNext(lv) * 0.15), shard: 5 });
  bus.emit('quest');
}

function bumpDaily(type, match = () => true, n = 1) {
  const dl = G.char?.quests.daily;
  if (!dl) return;
  let hit = false;
  for (const d of dl.list) if (d.type === type && !d.claimed && d.prog < d.n && match(d)) { d.prog = Math.min(d.n, d.prog + n); hit = true; }
  if (hit) bus.emit('quest');
}

function bumpMain(type, match, n = 1) {
  const q = currentMain();
  if (!q || q.goal.type !== type || !match(q.goal)) return;
  G.char.quests.prog = Math.min(q.goal.n, G.char.quests.prog + n);
  if (G.char.quests.prog >= q.goal.n) bus.emit('chat', 'quest', `Tujuan tercapai: ${q.title}. Kembali ke Quartermaster.`);
  bus.emit('quest');
}

export function initQuestHooks() {
  bus.on('kill', (u) => {
    bumpMain('kill', (g) => g.target === u.mdef.id);
    bumpDaily('killzone', (d) => G.zone.id === d.zone);
    if (u.mdef.elite || u.mdef.boss) bumpDaily('elite');
  });
  bus.on('gotItem', (id, qty) => { bumpMain('gather', (g) => g.item === id, qty); bumpDaily('gather', (d) => d.item === id, qty); });
  bus.on('pvpKill', () => { bumpMain('pvp', () => true); bumpDaily('pvp'); });
  bus.on('upgraded', () => bumpDaily('upgrade'));
  bus.on('crafted', () => bumpDaily('craft'));
  bus.on('levelup', () => bus.emit('quest'));
}

// ---------- Job advancement ----------
export function jobState() {
  const c = G.char;
  if (!c.job && c.level >= 30) return { step: 1, options: JOBS[c.cls] };
  if (c.job && c.job.tier === 1 && c.level >= 50) return { step: 2, path: JOBS[c.cls].find((p) => p.id === c.job.path) };
  return null;
}
export function advanceJob(pathId) {
  const c = G.char, js = jobState();
  if (!js) return;
  if (js.step === 1) c.job = { path: pathId, tier: 1 };
  else c.job.tier = 2;
  const p = JOBS[c.cls].find((x) => x.id === c.job.path);
  unlockSkills(c);
  bus.emit('chat', 'quest', `★ Job Advancement: kamu sekarang ${c.job.tier === 1 ? p.t1 : p.t2}!`);
  bus.emit('stats'); bus.emit('skills');
}
export const jobTitle = (c) => {
  if (!c.job) return null;
  const p = JOBS[c.cls].find((x) => x.id === c.job.path);
  return c.job.tier === 1 ? p.t1 : p.t2;
};
export const monsterName = (id) => MONSTERS[id]?.name || id;
