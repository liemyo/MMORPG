// NPC windows: shops, refiner (upgrade + gems), crafting, travel, quest giver/job advancement, system menu.
import { G, bus, credit, shard, fmtMoney, canPay, isSandbox, saveGame, exportJson } from '../state.js';
import { ITEMS, SHOP_STOCK, RECIPES, SLOTS, SLOT_NAMES, MAX_PLUS } from '../items.js';
import { ZONES, FIELD_ORDER } from '../zones.js';
import { FACTIONS } from '../data.js';
import { buy, upgrade, upgradeInfo, socket, unsocket, canCraft, craft, recipeOut, countItem } from '../inventory.js';
import { mainProgress, turnInMain, ensureDaily, dailyDesc, claimDaily, jobState, advanceJob, monsterName } from '../quests.js';
import { RENDER, openWin, closeWin, isOpen, renderWin, itemTip, itemName, slotHtml, invSel } from './windows.js';
import { showTip, hideTip, esc } from './hud.js';

const priceTag = (d, q = 1) => (d.premium ? `◆ ${d.premium * q}` : `◎ ${(d.price * q).toLocaleString('id-ID')}`);
const money = () => `<div class="row"><span class="gold">◎ ${fmtMoney(credit())}</span><span class="gold">◆ ${fmtMoney(shard())}</span>${isSandbox() ? '<small>Sandbox: semua gratis & tanpa batas</small>' : ''}</div>`;

// ---------- Shops ----------
const shopState = { kind: 'general', tier: -1, slot: 'all' };
function stockList() {
  if (shopState.kind === 'gear') {
    return SHOP_STOCK.gear().filter((id) => {
      const d = ITEMS[id];
      if (d.cls && d.cls !== G.char.cls) return false;
      if (shopState.slot !== 'all' && d.slot !== shopState.slot) return false;
      return shopState.tier < 0 ? d.lv <= G.char.level + 8 && d.lv >= G.char.level - 16 : d.tier === shopState.tier;
    });
  }
  return SHOP_STOCK[shopState.kind];
}
RENDER.shop = {
  open: (kind = 'general', title = 'Toko') => { shopState.kind = kind; openWin('shop', title, { x: 120, y: 80, w: 470, onClose: () => renderWin('inventory') }); RENDER.inventory.open(); },
  html: () => {
    let h = money();
    if (shopState.kind === 'gear') {
      h += `<div class="tabs">${['all', ...SLOTS].map((s) => `<button data-sl="${s}" class="${shopState.slot === s ? 'on' : ''}">${s === 'all' ? 'Semua' : SLOT_NAMES[s]}</button>`).join('')}</div>
        <div class="tabs"><button data-t="-1" class="${shopState.tier < 0 ? 'on' : ''}">Sesuai level</button>${[0, 1, 2, 3, 4, 5, 6, 7].map((t) => `<button data-t="${t}" class="${shopState.tier === t ? 'on' : ''}">T${t + 1}</button>`).join('')}</div>`;
    }
    h += '<div class="list">' + stockList().map((id) => {
      const d = ITEMS[id];
      const stack = d.stack;
      return `<div class="li" data-id="${id}"><span class="ic">${d.icon}</span><div class="grow"><b>${d.name}</b><br><small>${d.type === 'equip' ? `Lv ${d.lv} · ${SLOT_NAMES[d.slot]}` : d.type}</small></div>
        <span class="price">${priceTag(d)}</span>${stack ? `<input type="number" min="1" max="999" value="1" style="width:56px">` : ''}<button class="pri" data-buy="${id}" ${canPay(d.premium ? 0 : d.price, d.premium || 0) ? '' : 'disabled'}>Beli</button></div>`;
    }).join('') + '</div><small>Jual item: buka Inventaris lalu Shift+klik item.</small>';
    return h;
  },
  bind: (b) => {
    b.querySelectorAll('[data-sl]').forEach((el) => (el.onclick = () => { shopState.slot = el.dataset.sl; renderWin('shop'); }));
    b.querySelectorAll('[data-t]').forEach((el) => (el.onclick = () => { shopState.tier = +el.dataset.t; renderWin('shop'); }));
    b.querySelectorAll('.li').forEach((li) => {
      const id = li.dataset.id;
      li.querySelector('.ic').onmouseenter = (e) => showTip(e, itemTip({ id, qty: 1, plus: 0, gems: [], rarity: 'common' }));
      li.querySelector('.ic').onmouseleave = hideTip;
      li.querySelector('[data-buy]').onclick = () => {
        const q = li.querySelector('input'); buy(id, q ? Math.max(1, Math.min(999, +q.value || 1)) : 1);
      };
    });
  },
};

// ---------- Refiner: upgrade & gems ----------
const smith = { pick: null }; // { where: 'equip'|'inv', key }
const pickedInst = () => !smith.pick ? null : smith.pick.where === 'equip' ? G.char.equip[smith.pick.key] : G.char.inv[smith.pick.key];
RENDER.smith = {
  open: () => {
    openWin('smith', 'Refiner — Upgrade & Permata', { x: 120, y: 70, w: 480, onClose: () => { invSel.onPick = null; } });
    RENDER.inventory.open();
    invSel.onPick = (i) => {
      const it = G.char.inv[i], d = ITEMS[it.id];
      const cur = pickedInst();
      if (d.type === 'gem' && cur) socket(cur, i);
      else if (d.type === 'equip') smith.pick = { where: 'inv', key: i };
      renderWin('smith');
    };
  },
  html: () => {
    const inst = pickedInst();
    let h = money() + '<small>Pilih equipment: klik slot di bawah, atau klik item equip di Inventaris. Klik permata di Inventaris untuk memasangnya.</small>';
    h += `<div class="row">${SLOTS.map((s) => `<div title="${SLOT_NAMES[s]}">${slotHtml(G.char.equip[s], `data-eq="${s}"`)}</div>`).join('')}</div>`;
    if (!inst || ITEMS[inst.id]?.type !== 'equip') return h + '<p><small>Belum ada item dipilih.</small></p>';
    const d = ITEMS[inst.id], info = upgradeInfo(inst);
    h += `<div class="li"><span class="ic">${d.icon}</span><div class="grow"><b>${esc(itemName(inst))}</b><br><small>Peluang sukses ke +${inst.plus + 1}: <b class="${info.chance > 0.5 ? 'ok' : 'bad'}">${info.max ? '—' : Math.round(info.chance * 100) + '%'}</b>${G.char.luck ? ' (Fortune +10%)' : ''}</small><br>
      <small>Biaya: ◎ ${isSandbox() ? '∞ (gratis)' : info.cost.credit.toLocaleString('id-ID')} + ${info.cost.refine}× Refine Catalyst (punya ${countItem('mat_refine')})</small><br>
      <small class="bad">Gagal = turun 1 level, item TIDAK hancur.</small></div><button class="pri" data-up ${info.max ? 'disabled' : ''}>Upgrade</button></div>`;
    h += `<div style="margin-top:8px"><b>Slot Permata (${inst.gems.length}/${d.sockets})</b></div><div class="row">`;
    for (let i = 0; i < d.sockets; i++) {
      const g = inst.gems[i];
      h += g ? `<button data-un="${i}" title="Lepas (200 Credit)">${ITEMS[g].icon} ${ITEMS[g].name} ✕</button>` : '<span class="slot" style="width:120px;font-size:11px">kosong</span>';
    }
    h += `</div><div class="row" style="margin-top:6px"><small>Upgrade +${inst.plus}/${MAX_PLUS} · tiap +1 = +8% stat dasar</small><button data-up5>Upgrade ×5</button></div>`;
    return h;
  },
  bind: (b) => {
    b.querySelectorAll('[data-eq]').forEach((el) => {
      const inst = G.char.equip[el.dataset.eq];
      el.onclick = () => { smith.pick = { where: 'equip', key: el.dataset.eq }; renderWin('smith'); };
      if (inst) { el.onmouseenter = (e) => showTip(e, itemTip(inst)); el.onmouseleave = hideTip; }
    });
    const inst = pickedInst();
    b.querySelector('[data-up]')?.addEventListener('click', () => upgrade(inst));
    b.querySelector('[data-up5]')?.addEventListener('click', () => { for (let i = 0; i < 5; i++) if (upgrade(inst) === undefined) break; });
    b.querySelectorAll('[data-un]').forEach((el) => (el.onclick = () => unsocket(inst, +el.dataset.un)));
  },
};

// ---------- Crafting ----------
RENDER.craft = {
  open: () => openWin('craft', 'Artisan — Crafting', { x: 140, y: 70, w: 480 }),
  html: () => money() + '<small>Kumpulkan bahan dari node di zona leveling (tekan F di dekat node).</small><div class="list">' + RECIPES.map((r, i) => {
    const out = ITEMS[recipeOut(r)];
    const need = Object.entries(r.need).map(([id, n]) => { const have = countItem(id); return `<span class="${have >= n ? 'ok' : 'bad'}">${ITEMS[id].icon}${ITEMS[id].name} ${have}/${n}</span>`; }).join(' · ');
    return `<div class="li"><span class="ic">${out.icon}</span><div class="grow"><b>${r.qty}× ${out.name}</b>${r.rarity ? ` <small>[${r.rarity}]</small>` : ''}<br><small>${need} · ◎ ${r.cost}</small></div><button class="pri" data-c="${i}" ${canCraft(r) ? '' : 'disabled'}>Craft</button></div>`;
  }).join('') + '</div>',
  bind: (b) => b.querySelectorAll('[data-c]').forEach((el) => (el.onclick = () => craft(RECIPES[+el.dataset.c]))),
};

// ---------- Travel ----------
RENDER.travel = {
  open: () => openWin('travel', 'Gate Warden — Teleport (M)', { x: 200, y: 90, w: 420 }),
  html: () => {
    const c = G.char;
    const list = [`city_${c.faction}`, ...FIELD_ORDER];
    return '<div class="list">' + list.map((z) => {
      const Z = ZONES[z], here = G.zone.id === z;
      const warn = Z.kind !== 'city' && c.level < Z.lv[0] ? `<small class="bad">Disarankan Lv ${Z.lv[0]}+</small>` : '';
      return `<div class="li"><span class="ic">${Z.kind === 'city' ? '🏙' : Z.pvp ? '⚔' : '🌄'}</span><div class="grow"><b>${Z.name}</b> ${warn}<br><small>${Z.kind === 'city' ? 'Kota faksi · zona aman' : Z.pvp ? `Zona PvP pusat · Lv ${Z.lv[0]}–${Z.lv[1]} · perang faksi` : `Zona leveling · Lv ${Z.lv[0]}–${Z.lv[1]}`}</small></div>
        <button class="pri" data-z="${z}" ${here ? 'disabled' : ''}>${here ? 'Di sini' : 'Teleport'}</button></div>`;
    }).join('') + '</div><small>Kota faksi lain tertutup untukmu.</small>';
  },
  bind: (b) => b.querySelectorAll('[data-z]').forEach((el) => (el.onclick = () => { closeWin('travel'); bus.emit('travel', el.dataset.z); })),
};

// ---------- Quest giver / job ----------
RENDER.quests = {
  open: () => openWin('quests', 'Quest (L)', { x: 180, y: 70, w: 460 }),
  html: () => {
    const m = mainProgress();
    let h = '<b class="gold">Quest Utama</b>';
    if (m) {
      const g = m.q.goal;
      const what = g.type === 'kill' ? `Kalahkan ${monsterName(g.target)}` : g.type === 'gather' ? `Kumpulkan ${ITEMS[g.item].name}` : g.type === 'level' ? 'Capai level' : 'Kalahkan pemain faksi lawan';
      h += `<div class="li"><div class="grow"><b>${esc(m.q.title)}</b><br><small>${esc(m.q.text)}</small><br>${what}: <b class="${m.done ? 'ok' : ''}">${m.p}/${m.n}</b></div>
        <button class="pri" data-turn ${m.done && G.nearQuestNpc ? '' : 'disabled'} title="${G.nearQuestNpc ? '' : 'Lapor di Quartermaster (kota)'}">Lapor</button></div>`;
    } else h += '<p>Cerita utama selesai. Terima kasih, pahlawan Veyra!</p>';
    const d = ensureDaily();
    h += '<div style="margin-top:10px"><b class="gold">Quest Harian</b> <small>(reset tiap hari · hadiah Credit, XP, 5 Core Shard)</small></div>';
    h += d.list.map((q, i) => `<div class="li"><div class="grow"><b>${q.title}</b><br><small>${dailyDesc(q)}</small> · ${q.prog}/${q.n}</div>
      <button data-d="${i}" ${q.prog >= q.n && !q.claimed && G.nearQuestNpc ? '' : 'disabled'}>${q.claimed ? 'Selesai' : 'Klaim'}</button></div>`).join('');
    const js = jobState();
    if (js && G.nearQuestNpc) {
      h += '<div style="margin-top:10px"><b class="gold">★ Job Advancement</b></div>';
      if (js.step === 1) h += js.options.map((p) => `<div class="li"><div class="grow"><b>${p.t1}</b> <small>→ ${p.t2} (Lv 50)</small><br><small>${p.desc} · skill: ${p.s30.name}</small></div><button class="pri" data-job="${p.id}">Pilih</button></div>`).join('');
      else h += `<div class="li"><div class="grow"><b>${js.path.t1} → ${js.path.t2}</b><br><small>Skill baru: ${js.path.s50.name} · bonus stat ×2</small></div><button class="pri" data-job="${js.path.id}">Naik Job</button></div>`;
    } else if (js) h += '<p><small class="gold">★ Job Advancement tersedia — temui Quartermaster di kota.</small></p>';
    return h;
  },
  bind: (b) => {
    b.querySelector('[data-turn]')?.addEventListener('click', () => turnInMain());
    b.querySelectorAll('[data-d]').forEach((el) => (el.onclick = () => claimDaily(+el.dataset.d)));
    b.querySelectorAll('[data-job]').forEach((el) => (el.onclick = () => advanceJob(el.dataset.job)));
  },
};

// ---------- System menu ----------
RENDER.system = {
  open: () => openWin('system', 'Menu', { x: innerWidth / 2 - 160, y: 120, w: 320 }),
  html: () => `<div class="list">
    <button data-a="save" class="pri">💾 Simpan (slot ${G.slot})</button>
    <button data-a="export">⬇ Export save (.json)</button>
    <button data-a="help">❓ Kontrol</button>
    <button data-a="quit" class="warn">⏏ Simpan & ke Menu Utama</button></div>
    <p><small>Mode: <b>${isSandbox() ? 'Sandbox (uang ∞)' : 'Normal'}</b> · F10 = panel developer</small></p>`,
  bind: (b) => {
    b.querySelector('[data-a=save]').onclick = () => saveGame();
    b.querySelector('[data-a=export]').onclick = () => exportJson();
    b.querySelector('[data-a=help]').onclick = () => bus.emit('chat', 'sys', 'WASD gerak · Q/E/drag mouse kamera · scroll zoom · klik/Tab target · 1–9 skill/potion · 0 MP potion · F interaksi/gather · Spasi lompat · I C K L M jendela · Enter chat · F10 cheat · Esc tutup');
    b.querySelector('[data-a=quit]').onclick = () => { saveGame(); location.reload(); };
  },
};

// NPC click → window
export function openNpc(npc) {
  G.nearQuestNpc = npc.role === 'quest';
  switch (npc.role) {
    case 'shop': return RENDER.shop.open('general', `${npc.name} — Toko Umum`);
    case 'gear': shopState.tier = -1; return RENDER.shop.open('gear', `${npc.name} — Senjata & Armor`);
    case 'premium': return RENDER.shop.open('premium', `${npc.name} — Toko Core Shard`);
    case 'smith': return RENDER.smith.open();
    case 'craft': return RENDER.craft.open();
    case 'travel': return RENDER.travel.open();
    case 'quest': bus.emit('chat', 'quest', `[${npc.name}] ${(mainProgress()?.q.text) || 'Veyra berutang padamu.'}`); return RENDER.quests.open();
  }
}
bus.on('zone', () => { G.nearQuestNpc = false; if (isOpen('quests')) renderWin('quests'); });
