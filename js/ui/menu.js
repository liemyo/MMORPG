// Main menu (Normal / Sandbox / load / import) and character creation with live 3D preview.
import * as THREE from 'three';
import { FACTIONS, CLASSES } from '../data.js';
import { newCharacter, loadSlot, deleteSlot, validateSave } from '../state.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildHumanoid, animateRig } from '../models.js';
import { esc } from './hud.js';

const screen = () => document.getElementById('screen');

export function showMainMenu(onStart) {
  const slots = [1, 2, 3].map((s) => ({ s, c: loadSlot(s) }));
  screen().innerHTML = `<div class="menu"><div class="menuBox">
    <div class="logo">VEYRA</div><div class="sub">Crystal Wars · RPG perang faksi sci-fi fantasy (offline)</div>
    <button class="big pri" data-new="normal">Mulai Baru — Mode Normal<br><small>Ekonomi seimbang</small></button>
    <button class="big" data-new="sandbox" style="border-color:#a060ff">Mulai Baru — Sandbox Mode<br><small>Credit & Core Shard ∞ · semua toko tanpa batas</small></button>
    <div class="panel" style="padding:10px;margin-top:14px;text-align:left"><b>Lanjutkan</b>
      ${slots.map(({ s, c }) => `<div class="li" style="margin-top:6px"><div class="grow">Slot ${s}: ${c ? `<b style="color:${FACTIONS[c.faction]?.css}">${esc(c.name)}</b> Lv ${c.level} ${CLASSES[c.cls]?.name} <small>${c.mode === 'sandbox' ? '· Sandbox' : ''} · ${new Date(c.savedAt || c.created).toLocaleString('id-ID')}</small>` : '<small>kosong</small>'}</div>
        ${c ? `<button class="pri" data-load="${s}">Main</button><button class="warn" data-del="${s}">Hapus</button>` : ''}</div>`).join('')}
      <div class="row" style="margin-top:8px"><label><button data-imp>⬆ Import save .json</button></label><input type="file" accept=".json,application/json" id="impFile" class="hidden"></div>
    </div>
    <p><small>WASD · mouse · 1–9 skill · F interaksi · F10 developer panel</small></p>
  </div></div>`;
  const nextFree = () => (slots.find((x) => !x.c) || slots[0]).s;
  screen().querySelectorAll('[data-new]').forEach((b) => (b.onclick = () => showCreator(b.dataset.new, nextFree(), onStart)));
  screen().querySelectorAll('[data-load]').forEach((b) => (b.onclick = () => onStart(loadSlot(+b.dataset.load), +b.dataset.load)));
  screen().querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => { if (confirm(`Hapus save slot ${b.dataset.del}?`)) { deleteSlot(+b.dataset.del); showMainMenu(onStart); } }));
  const file = screen().querySelector('#impFile');
  screen().querySelector('[data-imp]').onclick = () => file.click();
  file.onchange = async () => {
    try {
      const c = JSON.parse(await file.files[0].text());
      if (!validateSave(c)) throw new Error('format');
      onStart(c, nextFree());
    } catch { alert('File save tidak valid.'); }
  };
}

const SKIN = [0xf0d0b0, 0xd8a880, 0xa87850, 0x6a4a30, 0xb0c0d0, 0x8090a0];
const PRIMARY = [0x4aa3ff, 0x5be38a, 0xff7a3d, 0xe0e0e0, 0x303848, 0xc04050, 0x9060d0, 0xe0c040];
const SECOND = [0x202028, 0xe8e8e8, 0x804020, 0xd0a040, 0x6080c0, 0x40a060, 0xc03030, 0xff80c0];

export function showCreator(mode, slot, onStart) {
  const st = { faction: 'union', cls: 'warrior', name: '', look: { skin: SKIN[0], primary: PRIMARY[0], secondary: SECOND[0], face: 0, hair: 1 } };
  screen().innerHTML = `<div class="menu"><div class="cc">
    <div class="panel">
      <h3>Faksi</h3><div class="cards" id="fac"></div>
      <h3>Kelas</h3><div class="cards c4" id="cls"></div>
      <h3>Wajah & Warna</h3>
      <div class="row"><small style="width:70px">Kulit</small><div class="swatches" data-k="skin"></div></div>
      <div class="row"><small style="width:70px">Utama</small><div class="swatches" data-k="primary"></div></div>
      <div class="row"><small style="width:70px">Rambut/aksen</small><div class="swatches" data-k="secondary"></div></div>
      <div class="row"><small style="width:70px">Wajah</small><div class="tabs" data-k="face"></div></div>
      <div class="row"><small style="width:70px">Rambut</small><div class="tabs" data-k="hair"></div></div>
    </div>
    <div class="panel">
      <canvas id="ccPreview"></canvas>
      <div id="ccInfo" style="margin:8px 0"></div>
      <input id="ccName" maxlength="16" placeholder="Nama karakter" style="width:100%">
      <div class="row" style="margin-top:10px"><button id="ccBack">← Kembali</button><span style="flex:1"></span><button class="pri" id="ccGo">Mulai (${mode === 'sandbox' ? 'Sandbox ∞' : 'Normal'})</button></div>
    </div></div></div>`;
  const $ = (q) => screen().querySelector(q);

  // preview renderer
  const cv = $('#ccPreview');
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio));
  r.setSize(cv.clientWidth, cv.clientHeight, false);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace; r.shadowMap.enabled = true;
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x07090f);
  const pm = new THREE.PMREMGenerator(r);
  sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const cam = new THREE.PerspectiveCamera(30, cv.clientWidth / cv.clientHeight, 0.1, 50);
  cam.position.set(0, 1.45, 5.6); cam.lookAt(0, 1.15, 0);
  sc.add(new THREE.HemisphereLight(0xbfd4ff, 0x1a1410, 0.6));
  const key = new THREE.DirectionalLight(0xfff0dd, 2.6); key.position.set(2.5, 4, 3); key.castShadow = true; sc.add(key);
  const rim = new THREE.DirectionalLight(0x6aa8ff, 2.2); rim.position.set(-3, 2.5, -3); sc.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 64), new THREE.MeshStandardMaterial({ color: 0x1a2030, metalness: 0.8, roughness: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
  const halo = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.42, 64), new THREE.MeshBasicMaterial({ color: 0xd8b860 }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.005; sc.add(halo);
  let model = null, alive = true;
  const dummy = { anim: 0, moving: false, atkT: 0 };
  const rebuild = () => { if (model) sc.remove(model.root); model = buildHumanoid(st.faction, st.cls, st.look); dummy.parts = model.parts; dummy.cls = st.cls; sc.add(model.root); };
  let last = performance.now();
  (function loop(now = performance.now()) { if (!alive) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; if (model) { model.root.rotation.y += dt * 0.4; animateRig(dummy, dt); } r.render(sc, cam); requestAnimationFrame(loop); })();

  const draw = () => {
    $('#fac').innerHTML = Object.values(FACTIONS).map((f) => `<div class="card ${st.faction === f.id ? 'on' : ''}" data-f="${f.id}"><b style="color:${f.css}">${f.name}</b>${f.lore}<br><small>${f.passive}</small></div>`).join('');
    $('#cls').innerHTML = Object.values(CLASSES).map((c) => `<div class="card ${st.cls === c.id ? 'on' : ''}" data-c="${c.id}"><b>${FACTIONS[st.faction].titles[c.id]}</b>${c.name}<br><small>${c.role}</small></div>`).join('');
    screen().querySelectorAll('.swatches').forEach((box) => {
      const k = box.dataset.k, pal = k === 'skin' ? SKIN : k === 'primary' ? PRIMARY : SECOND;
      box.innerHTML = pal.map((c) => `<div class="sw ${st.look[k] === c ? 'on' : ''}" data-v="${c}" style="background:#${c.toString(16).padStart(6, '0')}"></div>`).join('');
    });
    screen().querySelectorAll('.tabs[data-k]').forEach((box) => {
      const k = box.dataset.k, names = k === 'face' ? ['Tenang', 'Tajam', 'Lebar', 'Visor'] : ['Botak/Helm', 'Spike', 'Ikat', 'Jambul'];
      box.innerHTML = names.map((n, i) => `<button class="${st.look[k] === i ? 'on' : ''}" data-v="${i}">${n}</button>`).join('');
    });
    const c = CLASSES[st.cls];
    $('#ccInfo').innerHTML = `<b style="color:${FACTIONS[st.faction].css}">${FACTIONS[st.faction].titles[st.cls]}</b> · ${c.name}<br><small>HP ${c.base.hp} · MP ${c.base.mp} · ATK ${c.base.atk} · DEF ${c.base.def} · Jangkauan ${c.range}m</small><br><small>Kota awal: ${FACTIONS[st.faction].city}</small>`;
    bind();
    rebuild();
  };
  const bind = () => {
    screen().querySelectorAll('[data-f]').forEach((e) => (e.onclick = () => { st.faction = e.dataset.f; st.look.primary = FACTIONS[st.faction].color; draw(); }));
    screen().querySelectorAll('[data-c]').forEach((e) => (e.onclick = () => { st.cls = e.dataset.c; draw(); }));
    screen().querySelectorAll('[data-k]').forEach((box) => box.querySelectorAll('[data-v]').forEach((e) => (e.onclick = () => { st.look[box.dataset.k] = +e.dataset.v; draw(); })));
  };
  draw();
  $('#ccBack').onclick = () => { alive = false; r.dispose(); showMainMenu(onStart); };
  $('#ccGo').onclick = () => {
    const name = $('#ccName').value.trim().replace(/[<>]/g, '');
    if (name.length < 2) { $('#ccName').focus(); $('#ccName').placeholder = 'Nama minimal 2 huruf'; return; }
    alive = false; r.dispose();
    onStart(newCharacter({ name, faction: st.faction, cls: st.cls, look: { ...st.look }, mode }), slot, true);
  };
}

export function clearScreen() { screen().innerHTML = ''; }
