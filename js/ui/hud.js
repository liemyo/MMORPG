// HUD: frames, hotbar, XP, minimap, chat log, quest tracker, war box, toast.
import { G, bus, credit, shard, fmtMoney, isSandbox, saveGame } from '../state.js';
import { SKILLS, FACTIONS, CLASSES, xpToNext, MAX_LEVEL } from '../data.js';
import { ITEMS } from '../items.js';
import { world } from '../world.js';
import { useHotbar, gatherProgress } from '../player.js';
import { countItem } from '../inventory.js';
import { mainProgress, ensureDaily, dailyDesc, monsterName, jobTitle } from '../quests.js';
import { fmtTime, leader } from '../war.js';
import { botName } from '../units.js';

const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Hotbar ----------
export function buildHotbar() {
  const hb = $('hotbar');
  hb.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const el = document.createElement('div');
    el.className = 'hk';
    el.innerHTML = `<span class="k">${i + 1}</span><span class="ic"></span><span class="q"></span><div class="cd"></div><span class="cdt"></span>`;
    el.onclick = () => useHotbar(i);
    el.onmouseenter = (e) => { const id = G.char.hotbar[i]; if (id) showTip(e, hotTip(id)); };
    el.onmouseleave = hideTip;
    hb.appendChild(el);
  }
  refreshHotbar();
}
function hotTip(id) {
  if (id.startsWith('item:')) { const d = ITEMS[id.slice(5)]; return `<h5>${d.icon} ${d.name}</h5>Sisa: ${countItem(d.id)}`; }
  const s = SKILLS[id], r = G.char.skills[id] || 0;
  return `<h5>${s.icon} ${s.name} <small>Rank ${r}</small></h5>${s.type} · MP ${s.mp || 0} · CD ${s.cd}s${s.mult ? ` · ${Math.round(s.mult * 100)}% ATK` : ''}`;
}
export function refreshHotbar() {
  const els = $('hotbar').children;
  G.char.hotbar.forEach((id, i) => {
    const el = els[i];
    el.querySelector('.ic').textContent = id ? (id.startsWith('item:') ? ITEMS[id.slice(5)].icon : SKILLS[id].icon) : '';
    el.dataset.id = id || '';
  });
}
function tickHotbar() {
  const els = $('hotbar').children, p = G.player;
  G.char.hotbar.forEach((id, i) => {
    const el = els[i];
    let frac = 0, txt = '', q = '';
    if (id && !id.startsWith('item:')) {
      const cd = p.cds[id] || 0, max = SKILLS[id].cd;
      if (cd > 0) { frac = cd / max; txt = cd > 1 ? Math.ceil(cd) : cd.toFixed(1); }
      el.style.opacity = p.mp < (SKILLS[id].mp || 0) ? 0.45 : 1;
    } else if (id) q = countItem(id.slice(5));
    el.querySelector('.cd').style.height = `${frac * 100}%`;
    el.querySelector('.cdt').textContent = txt;
    el.querySelector('.q').textContent = q;
  });
}
bus.on('cast', (id) => {
  const i = G.char.hotbar.indexOf(id);
  const el = $('hotbar').children[i];
  if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 150); }
});

// ---------- Tooltip ----------
let tipEl;
export function showTip(e, html) {
  tipEl ||= Object.assign(document.createElement('div'), { className: 'tip' });
  document.body.appendChild(tipEl);
  tipEl.innerHTML = html;
  const r = e.currentTarget.getBoundingClientRect();
  tipEl.style.left = `${Math.min(innerWidth - 270, r.right + 6)}px`;
  tipEl.style.top = `${Math.max(6, Math.min(innerHeight - tipEl.offsetHeight - 6, r.top))}px`;
}
export function hideTip() { tipEl?.remove(); }

// ---------- Frames ----------
const buffHtml = (u) => [
  ...u.buffs.map((b) => `<span class="${b.debuff ? 'de' : ''}">${esc(b.name)} ${Math.ceil(b.t)}s</span>`),
  u.stun > 0 ? `<span class="de">Stun ${u.stun.toFixed(1)}</span>` : '', u.slow ? '<span class="de">Slow</span>' : '',
  u.dots.length ? `<span class="de">DoT×${u.dots.length}</span>` : '',
].join('');

let slowT = 0;
export function updateHud(dt) {
  const p = G.player, c = G.char;
  if (!p) return;
  $('hHp').style.width = `${(p.hp / p.maxHp) * 100}%`; $('hHpT').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  $('hMp').style.width = `${(p.mp / Math.max(1, p.maxMp)) * 100}%`; $('hMpT').textContent = `${Math.floor(p.mp)} / ${p.maxMp}`;
  const need = xpToNext(c.level);
  $('hXp').style.width = c.level >= MAX_LEVEL ? '100%' : `${(c.xp / need) * 100}%`;
  $('hXpT').textContent = c.level >= MAX_LEVEL ? 'LEVEL MAX' : `Lv ${c.level} · ${c.xp.toLocaleString()} / ${need.toLocaleString()} XP (${((c.xp / need) * 100).toFixed(1)}%)${Date.now() < c.xpBoostUntil ? ' · x2' : ''}`;
  tickHotbar();
  const gp = gatherProgress();
  $('cast').classList.toggle('hidden', !gp);
  if (gp) $('cast').firstElementChild.style.width = `${gp * 100}%`;
  const t = G.target;
  $('tframe').classList.toggle('hidden', !t || t.dead);
  if (t && !t.dead) {
    const fac = t.kind === 'bot' ? ` · ${FACTIONS[t.faction].name}` : t.mdef?.boss ? ' · BOSS' : t.mdef?.elite ? ' · Elite' : '';
    $('tName').innerHTML = `Lv ${t.level} ${esc(t.name)} <small>${fac}</small>`;
    $('tHp').style.width = `${(t.hp / t.maxHp) * 100}%`; $('tHpT').textContent = `${Math.ceil(t.hp)} / ${t.maxHp}`;
    $('tBuffs').innerHTML = buffHtml(t);
  }
  if ((slowT -= dt) > 0) return;
  slowT = 0.25;
  $('hName').textContent = `${c.name}`;
  $('hName').style.color = FACTIONS[c.faction].css;
  $('hClass').textContent = `Lv ${c.level} ${jobTitle(c) || FACTIONS[c.faction].titles[c.cls]}`;
  $('hCredit').textContent = fmtMoney(credit());
  $('hShard').textContent = fmtMoney(shard());
  $('hMode').textContent = isSandbox() ? 'SANDBOX' : '';
  $('hMode').style.display = isSandbox() ? '' : 'none';
  $('hBuffs').innerHTML = buffHtml(p) + (G.god ? '<span>GOD</span>' : '');
  drawMinimap();
  updateWarBox();
  updateQuestTrack();
}

// ---------- Minimap ----------
function drawMinimap() {
  const cv = $('minimap'), g = cv.getContext('2d'), W = cv.width, R = W / 2, p = G.player;
  const scale = R / 60;
  g.clearRect(0, 0, W, W);
  g.save(); g.beginPath(); g.arc(R, R, R, 0, 7); g.clip();
  g.fillStyle = '#0d1420'; g.fillRect(0, 0, W, W);
  const dot = (x, z, col, r = 2.5) => {
    const dx = (x - p.pos.x) * scale + R, dz = (z - p.pos.z) * scale + R;
    g.fillStyle = col; g.beginPath(); g.arc(dx, dz, r, 0, 7); g.fill();
  };
  // zone boundary
  g.strokeStyle = '#ffffff30'; g.beginPath(); g.arc(R - p.pos.x * scale, R - p.pos.z * scale, G.zone.size * 0.48 * scale, 0, 7); g.stroke();
  if (world.capture) { g.strokeStyle = G.war?.active ? '#ff60c0' : '#d0a0ff'; g.beginPath(); g.arc(R - p.pos.x * scale, R - p.pos.z * scale, world.capture.r * scale, 0, 7); g.stroke(); }
  for (const n of world.nodes) if (n.ready) dot(n.pos.x, n.pos.z, '#7fe3ff', 2);
  for (const n of world.npcs) dot(n.pos.x, n.pos.z, '#ffd060', 3);
  for (const n of world.portals) dot(n.pos.x, n.pos.z, '#a0e0ff', 4);
  for (const u of G.units) {
    if (u.dead) continue;
    const col = u.kind === 'monster' ? (u.mdef.boss ? '#ff2050' : u.mdef.elite ? '#ffa030' : '#e55') : FACTIONS[u.faction].css;
    dot(u.pos.x, u.pos.z, col, u.mdef?.boss ? 4 : 2.2);
  }
  g.restore();
  // player arrow
  g.save(); g.translate(R, R); g.rotate(-p.root.rotation.y + Math.PI);
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 5); g.lineTo(-4, 5); g.fill(); g.restore();
  $('zoneName').innerHTML = `${esc(G.zone.name)} <small>${G.zone.safe ? 'Zona aman' : G.zone.pvp ? 'PvP' : `Lv ${G.zone.lv[0]}–${G.zone.lv[1]}`}</small>`;
}

function updateWarBox() {
  const w = G.war;
  if (!w) return;
  const own = w.owner ? `<span style="color:${FACTIONS[w.owner].css}">${FACTIONS[w.owner].name}</span>` : '—';
  if (!w.active) { $('warBox').innerHTML = `Perang berikut: <b>${fmtTime(w.next)}</b><br>Core: ${own}`; return; }
  const lead = leader();
  $('warBox').innerHTML = `<b class="c-war">⚔ PERANG ${fmtTime(w.t)}</b><div class="sc">${Object.keys(FACTIONS).map((f) =>
    `<span style="color:${FACTIONS[f].css}">${FACTIONS[f].name.split(' ')[1] || f}: ${w.score[f]}${lead === f ? '★' : ''}</span>`).join('')}</div>`;
}

function updateQuestTrack() {
  const m = mainProgress();
  let h = '<h4>Quest Utama</h4>';
  if (m) {
    const g = m.q.goal;
    const what = g.type === 'kill' ? monsterName(g.target) : g.type === 'gather' ? ITEMS[g.item].name : g.type === 'level' ? 'Level' : 'Pemain lawan';
    h += `<b>${esc(m.q.title)}</b><br>${what}: <span class="${m.done ? 'ok' : ''}">${m.p}/${m.n}</span>${m.done ? '<br><small class="ok">✔ Lapor ke Quartermaster</small>' : ''}`;
  } else h += '<small>Semua quest utama selesai!</small>';
  const d = ensureDaily();
  h += '<h4 style="margin-top:8px">Harian</h4>' + d.list.map((q) => `<div class="${q.claimed ? 'ok' : ''}"><small>${dailyDesc(q)}: ${q.prog}/${q.n}${q.claimed ? ' ✔' : ''}</small></div>`).join('');
  $('questTrack').innerHTML = h;
}

// ---------- Toast ----------
let toastT;
bus.on('toast', (msg) => {
  const el = $('toast');
  el.textContent = msg; el.style.opacity = 1;
  clearTimeout(toastT); toastT = setTimeout(() => (el.style.opacity = 0), 1400);
});

// ---------- Chat ----------
let chatFilter = 'all';
const log = [];
bus.on('chat', (cls, text) => {
  log.push({ cls, text });
  if (log.length > 200) log.shift();
  renderChatLine({ cls, text });
});
const chatGroup = (cls) => (cls.startsWith('f-') || cls === 'me' ? 'world' : cls === 'loot' ? 'loot' : 'sys');
function renderChatLine(l) {
  if (chatFilter !== 'all' && chatGroup(l.cls) !== chatFilter) return;
  const box = $('chatLog');
  const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 20;
  const d = document.createElement('div');
  d.className = `c-${l.cls}`; d.textContent = l.text;
  box.appendChild(d);
  while (box.children.length > 150) box.firstChild.remove();
  if (atBottom) box.scrollTop = box.scrollHeight;
}
export function initChat() {
  document.querySelectorAll('#chatTabs button').forEach((b) => (b.onclick = () => {
    chatFilter = b.dataset.f;
    document.querySelectorAll('#chatTabs button').forEach((x) => x.classList.toggle('on', x === b));
    $('chatLog').innerHTML = ''; log.forEach(renderChatLine);
  }));
  const inp = $('chatIn');
  inp.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const v = inp.value.trim(); inp.value = ''; inp.blur();
    if (!v) return;
    if (v.startsWith('/')) return command(v);
    bus.emit('chat', 'me', `[${G.char.name}] ${v}`);
    if (Math.random() < 0.5) setTimeout(() => bus.emit('chat', `f-${G.char.faction}`, `[${botName()}] ${['setuju', 'wkwk', 'gas', 'mantap', 'ikut dong', '+1'][Math.floor(Math.random() * 6)]}`), 1200 + Math.random() * 2500);
  });
  addEventListener('keydown', (e) => { if (e.key === 'Enter' && document.activeElement !== inp && !G.uiBlock) { e.preventDefault(); inp.focus(); } });
}
function command(v) {
  const [cmd] = v.slice(1).split(' ');
  if (cmd === 'help') bus.emit('chat', 'sys', 'Perintah: /save /where /stats /help · Tombol: WASD gerak, Q/E kamera, klik/Tab target, 1–9 skill, F interaksi, I/C/K/L/M jendela, F10 cheat');
  else if (cmd === 'save') saveGame();
  else if (cmd === 'where') bus.emit('chat', 'sys', `${G.zone.name} (${G.player.pos.x.toFixed(0)}, ${G.player.pos.z.toFixed(0)})`);
  else if (cmd === 'stats') bus.emit('chat', 'sys', `Kill ${G.char.stats.kills} · PvP ${G.char.stats.pvp} · Mati ${G.char.stats.deaths} · Upgrade ${G.char.stats.upgrades}`);
  else bus.emit('chat', 'warn', 'Perintah tidak dikenal. /help');
}
export const className = (c) => CLASSES[c.cls].name;
