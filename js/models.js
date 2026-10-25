// Character models: realistic-proportion jointed rig + faction armor sets + class weapons + procedural animation.
// Replace buildHumanoid with a GLTF loader later; keep the returned { root, parts, height } shape.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FACTIONS } from './data.js';
import { metalTex, clothTex } from './gfx/textures.js';
import { animateMonster } from './monsters.js';
export { buildMonster } from './monsters.js';

const matCache = new Map();
const cached = (key, make) => (matCache.has(key) ? matCache.get(key) : (matCache.set(key, make()), matCache.get(key)));
const metal = (c, rough = 0.32) => cached(`m${c}${rough}`, () => new THREE.MeshPhysicalMaterial({ color: c, map: metalTex('panel'), metalness: 0.85, roughness: rough, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
const cloth = (c) => cached(`c${c}`, () => new THREE.MeshStandardMaterial({ color: c, map: clothTex(), roughness: 0.92, side: THREE.DoubleSide }));
const skinM = (c) => cached(`s${c}`, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.55, sheen: 0.15, sheenColor: new THREE.Color(0xffc8b0) }));
const glowM = (c, i = 2.5) => cached(`g${c}${i}`, () => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.2 }));
const plain = (c, r = 0.6, m = 0) => cached(`p${c}${r}${m}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }));

const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };
const rotX = (o, a) => { o.rotation.x = a; return o; };
const capsule = (r, len, m, y) => mesh(new THREE.CapsuleGeometry(r, len, 6, 14), m, 0, y);
const rbox = (w, h, d, r, m) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m);
const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

function lathe(profile, m, segs = 24) {
  return new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs), m);
}

// ---------- Humanoid ----------
export function buildHumanoid(faction, cls, look) {
  const root = new THREE.Group();
  const fcol = FACTIONS[faction].color;
  // Mature MMO palette: pull saturation/brightness down from the picked swatch
  const prim = new THREE.Color(look.primary).offsetHSL(0, -0.28, -0.16).getHex(), sec = look.secondary;
  const isF = faction === 'ferron', isS = faction === 'sylvaran', isU = faction === 'union';
  const body = isF ? metal(0x3a3c42, 0.4) : isS ? cloth(new THREE.Color(prim).multiplyScalar(0.55).getHex()) : plain(0x1c2026, 0.7, 0.2); // under-suit
  const skin = skinM(look.skin);
  const armor = isS ? metal(0xd8b860, 0.28) : metal(isF ? new THREE.Color(prim).multiplyScalar(0.6).getHex() : prim);
  const trim = isS ? metal(0xd8b860, 0.25) : metal(isF ? 0x2a2a2e : 0xe8ecf0);
  const g = glowM(fcol, 1.3);

  const hips = pivot(root, 0, 0.98, 0);
  const spine = pivot(hips, 0, 0.02, 0);
  // Torso
  const torso = lathe([[0.001, -0.05], [0.14, -0.04], [0.155, 0.08], [0.145, 0.2], [0.175, 0.34], [0.2, 0.46], [0.19, 0.54], [0.08, 0.62], [0.001, 0.62]], body);
  torso.scale.z = 0.68; spine.add(torso);
  const pelvis = mesh(new THREE.SphereGeometry(0.16, 16, 10), body, 0, -0.04, 0); pelvis.scale.set(1, 0.6, 0.75); hips.add(pelvis);
  const neck = pivot(spine, 0, 0.6, 0);
  neck.add(capsule(0.05, 0.08, isF ? metal(0x2a2c30) : skin, 0.04));
  const head = pivot(neck, 0, 0.17, 0.005);
  buildHead(head, faction, look, skin, armor, g);

  // Arms
  const arm = (side) => {
    const sh = pivot(spine, side * 0.215, 0.5, 0);
    sh.add(capsule(isF ? 0.045 : 0.055, 0.2, body, -0.14));
    const el = pivot(sh, 0, -0.29, 0);
    el.add(capsule(isF ? 0.04 : 0.046, 0.2, isF ? body : skin, -0.13));
    const hand = pivot(el, 0, -0.29, 0);
    hand.add(mesh(new THREE.SphereGeometry(0.048, 12, 8), isF ? metal(0x2a2c30) : skin, 0, -0.02, 0));
    if (isF) { sh.add(mesh(new THREE.SphereGeometry(0.06, 12, 8), g)); el.add(mesh(new THREE.SphereGeometry(0.05, 12, 8), g)); }
    return { sh, el, hand };
  };
  const L = arm(-1), R = arm(1);
  // Legs
  const leg = (side) => {
    const th = pivot(hips, side * 0.095, -0.03, 0);
    th.add(capsule(isF ? 0.06 : 0.075, 0.3, body, -0.21));
    const kn = pivot(th, 0, -0.45, 0);
    kn.add(capsule(isF ? 0.05 : 0.06, 0.32, body, -0.22));
    const foot = rbox(0.11, 0.08, 0.26, 0.03, isS ? plain(0x3a2a20, 0.7) : trim); foot.position.set(0, -0.47, 0.05); kn.add(foot);
    if (isF) { th.add(mesh(new THREE.SphereGeometry(0.07, 12, 8), g)); kn.add(mesh(new THREE.SphereGeometry(0.06, 12, 8), g)); }
    return { th, kn };
  };
  const LL = leg(-1), LR = leg(1);
  const parts = { rig: true, hips, spine, neck, head, shL: L.sh, elL: L.el, handL: L.hand, shR: R.sh, elR: R.el, handR: R.hand, thL: LL.th, knL: LL.kn, thR: LR.th, knR: LR.kn, fx: [] };

  // Faction armor
  if (isU) unionArmor(parts, armor, trim, g, sec);
  else if (isS) sylvaranArmor(parts, armor, prim, sec, g);
  else ferronArmor(parts, armor, trim, g);

  parts.wpn = buildWeapon(cls, faction, parts, g, trim);
  root.scale.setScalar(1.12);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, parts, height: 2.25 };
}

function buildHead(head, faction, look, skin, armor, g) {
  const isF = faction === 'ferron';
  if (isF) {
    const h = rbox(0.2, 0.24, 0.24, 0.05, metal(new THREE.Color(look.skin).lerp(new THREE.Color(0x707680), 0.6).getHex(), 0.3)); head.add(h);
    const jaw = rbox(0.17, 0.08, 0.18, 0.03, metal(0x2a2c30)); jaw.position.set(0, -0.1, 0.03); head.add(jaw);
    const eye = look.face === 1 ? new THREE.SphereGeometry(0.035, 12, 8) : new THREE.BoxGeometry(0.17, 0.03, 0.02);
    head.add(mesh(eye, g, 0, 0.02, 0.122));
    const ant = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), metal(0x2a2c30), 0.09, 0.16, -0.04); ant.rotation.z = -0.3; head.add(ant);
    head.add(mesh(new THREE.SphereGeometry(0.018, 8, 6), g, 0.115, 0.235, -0.04));
    if (look.hair === 3) { const c = rbox(0.04, 0.08, 0.22, 0.015, g); c.position.y = 0.14; head.add(c); }
    return;
  }
  const skull = mesh(new THREE.SphereGeometry(0.115, 24, 18), skin); skull.scale.set(0.92, 1.08, 1); head.add(skull);
  const jaw = mesh(new THREE.SphereGeometry(0.09, 16, 10), skin, 0, -0.06, 0.02); jaw.scale.set(0.9, 0.8, 0.95); head.add(jaw);
  head.add(rotX(mesh(new THREE.ConeGeometry(0.016, 0.05, 6), skin, 0, -0.005, 0.115), Math.PI / 2));
  const f = look.face | 0;
  const visor = f === 3 || (faction === 'union' && look.hair === 0);
  if (visor) {
    const helm = mesh(new THREE.SphereGeometry(0.135, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), armor, 0, 0.01, 0); helm.scale.set(0.98, 1.08, 1.05); head.add(helm);
    const band = mesh(new THREE.TorusGeometry(0.128, 0.018, 6, 24, Math.PI * 0.75), g, 0, 0.01, 0); band.rotation.set(Math.PI / 2, 0, Math.PI * 0.125); head.add(band);
  } else {
    const eyeW = [1, 1.25, 0.85][f] || 1, eyeH = [1, 0.6, 1.1][f] || 1;
    for (const sx of [-0.04, 0.04]) {
      const white = mesh(new THREE.SphereGeometry(0.017, 10, 8), plain(0xf0f0f0, 0.3), sx, 0.022, 0.1); white.scale.set(eyeW, eyeH, 0.6); head.add(white);
      head.add(mesh(new THREE.SphereGeometry(0.009, 8, 6), faction === 'sylvaran' ? glowM(0x40c070, 0.5) : plain(0x2a3a5a, 0.2), sx, 0.022, 0.111));
      const brow = mesh(new THREE.BoxGeometry(0.036, 0.007, 0.01), plain(look.secondary, 0.8), sx, 0.045, 0.105);
      brow.rotation.z = f === 1 ? -Math.sign(sx) * 0.3 : 0; head.add(brow);
    }
    head.add(mesh(new THREE.BoxGeometry(0.035, 0.005, 0.01), plain(0x8a4a40, 0.6), 0, -0.05, 0.1));
    if (faction === 'sylvaran') for (const sx of [-1, 1]) { const ear = mesh(new THREE.ConeGeometry(0.02, 0.11, 6), skin, sx * 0.11, 0.03, -0.01); ear.rotation.z = -sx * 1.25; ear.rotation.y = sx * 0.4; head.add(ear); }
  }
  // Hair
  const hm = plain(look.secondary, 0.65);
  const h = look.hair | 0;
  if (h >= 1 && !visor) { const cap = mesh(new THREE.SphereGeometry(0.122, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hm, 0, 0.012, -0.008); cap.scale.set(0.98, 1.1, 1.05); head.add(cap); }
  if (h === 1 && !visor) for (let i = 0; i < 9; i++) { const s = mesh(new THREE.ConeGeometry(0.03, 0.11, 5), hm, Math.sin(i * 0.7) * 0.07, 0.11, -0.06 + (i % 3) * 0.04); s.rotation.set(-0.6 + (i % 3) * 0.4, 0, Math.sin(i) * 0.5); head.add(s); }
  if (h === 2) { const tail = capsule(0.035, 0.22, hm, -0.08); const tp = pivot(head, 0, 0.04, -0.12); tp.rotation.x = 0.35; tp.add(tail); }
  if (h === 3) { const crest = rbox(0.035, 0.08, 0.24, 0.015, hm); crest.position.set(0, 0.13, -0.01); head.add(crest); }
  if (faction === 'sylvaran') { // circlet with crystal
    const c = mesh(new THREE.TorusGeometry(0.118, 0.008, 6, 32), metal(0xd8b860, 0.25), 0, 0.05, 0); c.rotation.x = Math.PI / 2 - 0.15; head.add(c);
    head.add(mesh(new THREE.OctahedronGeometry(0.022, 0), g, 0, 0.075, 0.115));
  }
}

function unionArmor(p, armor, trim, g, sec) {
  const chest = lathe([[0.152, 0.26], [0.188, 0.34], [0.212, 0.46], [0.2, 0.55], [0.11, 0.6]], armor); chest.scale.z = 0.76; p.spine.add(chest);
  const core = mesh(new THREE.CircleGeometry(0.035, 6), g, 0, 0.43, 0.158); p.spine.add(core);
  for (let i = 0; i < 3; i++) { const ab = rbox(0.17 - i * 0.01, 0.05, 0.05, 0.015, trim); ab.position.set(0, 0.2 - i * 0.065, 0.1); p.spine.add(ab); }
  for (const [sh, s] of [[p.shL, -1], [p.shR, 1]]) {
    const pad = mesh(new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), armor, s * 0.02, 0.0, 0); pad.scale.set(1.1, 0.8, 1); sh.add(pad);
    const stripe = mesh(new THREE.TorusGeometry(0.1, 0.01, 4, 20, Math.PI), g, s * 0.02, 0.0, 0); stripe.rotation.y = Math.PI / 2; sh.add(stripe);
  }
  for (const el of [p.elL, p.elR]) { const gl = rbox(0.11, 0.18, 0.11, 0.03, armor); gl.position.y = -0.15; el.add(gl); }
  for (const kn of [p.knL, p.knR]) {
    const gr = rbox(0.12, 0.26, 0.13, 0.04, armor); gr.position.set(0, -0.2, 0.01); kn.add(gr);
    kn.add(mesh(new THREE.SphereGeometry(0.065, 12, 8), trim, 0, 0, 0.04));
  }
  for (const th of [p.thL, p.thR]) { const tp = rbox(0.15, 0.22, 0.16, 0.04, trim); tp.position.y = -0.18; th.add(tp); }
  const pack = rbox(0.28, 0.32, 0.12, 0.04, trim); pack.position.set(0, 0.4, -0.17); p.spine.add(pack);
  for (const sx of [-0.09, 0.09]) {
    const t = mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.2, 12), metal(0x30343a), sx, 0.28, -0.24); p.spine.add(t);
    const flame = mesh(new THREE.ConeGeometry(0.035, 0.12, 10), g, sx, 0.13, -0.24); flame.rotation.x = Math.PI; p.spine.add(flame); p.fx.push(flame);
  }
  const belt = mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 24), plain(sec, 0.5, 0.4), 0, 0.02, 0); belt.rotation.x = Math.PI / 2; belt.scale.y = 0.7; p.spine.add(belt);
}

function sylvaranArmor(p, gold, prim, sec, g) {
  const robe = cloth(new THREE.Color(prim).offsetHSL(0, -0.05, -0.12).getHex()); // deeper dyed cloth
  const coat = lathe([[0.16, 0.2], [0.19, 0.34], [0.215, 0.47], [0.2, 0.55], [0.1, 0.61]], robe); coat.scale.z = 0.74; p.spine.add(coat);
  const skirt = lathe([[0.17, 0.02], [0.2, -0.2], [0.26, -0.5], [0.32, -0.85]], robe, 28); p.hips.add(skirt);
  p.skirt = skirt;
  const sash = mesh(new THREE.TorusGeometry(0.165, 0.025, 6, 28), cloth(sec), 0, 0.04, 0); sash.rotation.x = Math.PI / 2; sash.scale.y = 0.75; p.spine.add(sash);
  const trimRing = mesh(new THREE.TorusGeometry(0.32, 0.012, 6, 40), gold, 0, -0.85, 0); trimRing.rotation.x = Math.PI / 2; p.hips.add(trimRing);
  // Mantle + crystal pauldrons
  const mantle = mesh(new THREE.SphereGeometry(0.26, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.3), cloth(sec), 0, 0.45, 0); mantle.scale.z = 0.8; p.spine.add(mantle);
  for (const [sh, s] of [[p.shL, -1], [p.shR, 1]]) {
    const pad = mesh(new THREE.SphereGeometry(0.085, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold, s * 0.02, 0, 0); sh.add(pad);
    const cr = mesh(new THREE.OctahedronGeometry(0.045, 0), g, s * 0.05, 0.07, 0); cr.scale.y = 2; sh.add(cr);
    const sleeve = lathe([[0.06, 0.0], [0.08, -0.15], [0.11, -0.3]], robe, 16); sh.add(sleeve);
  }
  for (const el of [p.elL, p.elR]) { const cuff = mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.08, 14), gold, 0, -0.2, 0); el.add(cuff); }
  // Two orbiting crystal motes
  for (let i = 0; i < 2; i++) { const o = mesh(new THREE.OctahedronGeometry(0.04, 0), g); o.scale.y = 1.8; p.spine.add(o); p.fx.push(o); }
  p.orbit = true;
}

function ferronArmor(p, armor, trim, g) {
  const chest = rbox(0.38, 0.3, 0.26, 0.06, armor); chest.position.set(0, 0.42, 0.01); p.spine.add(chest);
  p.spine.add(mesh(new THREE.IcosahedronGeometry(0.05, 1), g, 0, 0.43, 0.14));
  for (let i = 0; i < 4; i++) { const seg = mesh(new THREE.CylinderGeometry(0.11 - i * 0.004, 0.12 - i * 0.004, 0.045, 16), trim, 0, 0.22 - i * 0.055, 0); seg.scale.z = 0.75; p.spine.add(seg); }
  for (const [sh, s] of [[p.shL, -1], [p.shR, 1]]) {
    const pad = rbox(0.17, 0.12, 0.2, 0.03, armor); pad.position.set(s * 0.04, 0.03, 0); pad.rotation.z = s * -0.25; sh.add(pad);
    const light = mesh(new THREE.BoxGeometry(0.1, 0.012, 0.012), g, s * 0.05, 0.05, 0.1); sh.add(light);
  }
  for (const el of [p.elL, p.elR]) { const f = rbox(0.1, 0.2, 0.1, 0.025, armor); f.position.y = -0.14; el.add(f); }
  for (const kn of [p.knL, p.knR]) { const sh = rbox(0.1, 0.28, 0.12, 0.03, armor); sh.position.set(0, -0.22, 0.015); kn.add(sh); }
  for (const th of [p.thL, p.thR]) { const t = rbox(0.13, 0.24, 0.13, 0.03, armor); t.position.y = -0.2; th.add(t); }
  for (let i = 0; i < 3; i++) { const v = rbox(0.06, 0.18, 0.05, 0.015, trim); v.position.set(-0.09 + i * 0.09, 0.45, -0.15); p.spine.add(v); p.spine.add(mesh(new THREE.BoxGeometry(0.03, 0.12, 0.01), g, -0.09 + i * 0.09, 0.45, -0.178)); }
}

// ---------- Weapons (held in right hand) ----------
function bladeShape(len, w) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(-w / 2, len * 0.82); s.lineTo(0, len); s.lineTo(w / 2, len * 0.82); s.lineTo(w / 2, 0); s.lineTo(-w / 2, 0);
  return new THREE.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 1 });
}

function buildWeapon(cls, faction, p, g, trim) {
  const w = new THREE.Group();
  const steel = metal(0xc8ccd4, 0.2), dark = metal(0x2a2c30, 0.4), gold = metal(0xd8b860, 0.25);
  if (cls === 'warrior') {
    if (faction === 'ferron') { // heavy hammer
      w.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.9, 8), dark, 0, 0.3, 0));
      const head = rbox(0.18, 0.18, 0.34, 0.03, trim); head.position.y = 0.75; w.add(head);
      w.add(mesh(new THREE.BoxGeometry(0.19, 0.03, 0.35), g, 0, 0.75, 0));
    } else {
      w.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), plain(0x3a2a20, 0.8), 0, 0, 0));
      w.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), faction === 'sylvaran' ? gold : steel, 0, -0.12, 0));
      const guard = rbox(0.24, 0.035, 0.05, 0.012, faction === 'sylvaran' ? gold : trim); guard.position.y = 0.12; w.add(guard);
      const blade = new THREE.Mesh(bladeShape(1.05, 0.085), steel); blade.position.set(0, 0.13, -0.008); w.add(blade);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.85, 0.032), g); edge.position.set(0, 0.56, 0); w.add(edge);
    }
    w.rotation.x = Math.PI / 2 + 0.4; w.position.set(0, -0.04, 0.02);
  } else if (cls === 'ranger') {
    if (faction === 'sylvaran') { // bow
      const arc = mesh(new THREE.TorusGeometry(0.5, 0.016, 6, 32, Math.PI * 0.8), gold); arc.rotation.z = Math.PI / 2 + Math.PI * 0.1; w.add(arc);
      const str = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.95, 4), glowM(0xc0ffd0, 1.5), -0.0, 0, 0); str.position.x = 0.15; w.add(str);
      w.rotation.set(0, Math.PI / 2, 0); w.position.set(0, -0.04, 0);
    } else { // rifle
      const body = rbox(0.07, 0.11, 0.62, 0.02, faction === 'ferron' ? trim : dark); body.position.z = 0.18; w.add(body);
      w.add(rotX(mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.5, 10), steel, 0, 0.02, 0.7), Math.PI / 2));
      w.add(rotX(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 10), dark, 0, 0.09, 0.2), Math.PI / 2));
      w.add(mesh(new THREE.BoxGeometry(0.075, 0.02, 0.3), g, 0, 0.0, 0.25));
      const stock = rbox(0.06, 0.12, 0.2, 0.02, dark); stock.position.set(0, -0.03, -0.18); w.add(stock);
      w.position.set(0, -0.06, 0);
    }
  } else if (cls === 'caster') {
    w.add(mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.6, 8), faction === 'sylvaran' ? plain(0x5a3a22, 0.7) : dark, 0, 0.45, 0));
    const claw = mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 16), faction === 'sylvaran' ? gold : trim, 0, 1.28, 0); w.add(claw);
    const cr = mesh(new THREE.OctahedronGeometry(0.07, 0), g, 0, 1.3, 0); cr.scale.y = 1.6; w.add(cr); p.fx.push(cr);
    w.position.set(0, -0.04, 0.02); w.rotation.x = 0.15;
  } else { // specialist: gauntlet + hover drone
    const gaunt = rbox(0.12, 0.2, 0.13, 0.03, trim); gaunt.position.y = 0.06; w.add(gaunt);
    w.add(mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.12, 10), g, 0, -0.08, 0.04));
    const drone = new THREE.Group();
    drone.add(mesh(new THREE.SphereGeometry(0.07, 14, 10), dark));
    drone.add(rotX(mesh(new THREE.TorusGeometry(0.1, 0.01, 6, 20), trim), Math.PI / 2));
    drone.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), g, 0, 0, 0.065));
    drone.position.set(0.32, 0.72, -0.12); p.spine.add(drone); p.drone = drone;
  }
  p.handR.add(w);
  return w;
}

// ---------- Animation ----------
const lerp = (a, b, t) => a + (b - a) * t;
export function animateRig(u, dt) {
  const p = u.parts;
  if (!p.rig) return animateMonster(u, dt);
  u.mv = lerp(u.mv || 0, u.moving ? 1 : 0, Math.min(1, dt * 10));
  u.anim = (u.anim || 0) + dt * (u.moving ? 7 * Math.min(1.5, u.speedMul || 1) : 1.2);
  const m = u.mv, ph = u.anim, s = Math.sin(ph), c = Math.cos(ph);
  const breath = Math.sin(ph * (u.moving ? 0.5 : 1.6)) * 0.012;
  // legs
  p.thL.rotation.x = -s * 0.75 * m; p.thR.rotation.x = s * 0.75 * m;
  p.knL.rotation.x = Math.max(0, c) * 1.1 * m + 0.05; p.knR.rotation.x = Math.max(0, -c) * 1.1 * m + 0.05;
  p.hips.position.y = 0.98 + Math.abs(c) * 0.035 * m - 0.02 * m;
  p.spine.rotation.y = s * 0.12 * m;
  p.spine.rotation.x = 0.08 * m + breath;
  p.hips.rotation.y = -s * 0.08 * m;
  // arms
  const ranged = u.cls === 'ranger' || u.cls === 'caster';
  p.shL.rotation.set(s * 0.6 * m + breath * 2, 0, -0.12);
  p.elL.rotation.x = -0.25 - Math.max(0, s) * 0.4 * m;
  let rx = -s * 0.6 * m + breath * 2, ry = 0, rz = 0.12, ex = -0.3;
  if (ranged && !u.moving) { rx = -0.35; ex = -0.9; }
  if (u.atkT > 0) {
    const k = Math.min(1, u.atkT / 0.3);
    if (u.cls === 'warrior') { rx = lerp(-0.4, -2.6, k); ex = -0.2; ry = 0.3; }
    else if (u.cls === 'ranger') { rx = -1.5; ex = -0.1; p.shL.rotation.x = -1.4; p.elL.rotation.x = -0.6; }
    else { rx = -2.2 * k - 0.6; ex = -0.2; }
  }
  if (u.gather) { rx = -1.2 + Math.sin(ph * 6) * 0.4; ex = -0.8; p.spine.rotation.x = 0.35; }
  p.shR.rotation.set(rx, ry, rz); p.elR.rotation.x = ex;
  p.head.rotation.y = Math.sin(ph * 0.3) * 0.15 * (1 - m);
  // fx: thruster flicker, orbit crystals, drone hover
  const t = performance.now() / 1000;
  if (p.orbit) p.fx.forEach((o, i) => o.position.set(Math.cos(t * 1.5 + i * 3.14) * 0.38, 0.55 + Math.sin(t * 2 + i) * 0.06, Math.sin(t * 1.5 + i * 3.14) * 0.3));
  else p.fx.forEach((o) => { o.scale.y = 0.8 + Math.random() * 0.5 + m * 0.6; });
  if (p.drone) { p.drone.position.y = 0.72 + Math.sin(t * 2.4) * 0.05; p.drone.rotation.y = t; }
  if (p.skirt) p.skirt.rotation.y = s * 0.1 * m;
}
