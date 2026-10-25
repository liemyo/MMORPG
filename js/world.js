// Builds the active zone: atmosphere, textured terrain, grass, props, faction architecture, NPCs, portals, nodes.
import { THREE, scene, camera, setTerrain, heightAt, makePlate, MOBILE } from './engine.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { G, bus } from './state.js';
import { ZONES } from './zones.js';
import { FACTIONS } from './data.js';
import { groundTex, metalTex, rockTex, barkTex, windowsTex, clothTex, bladeTex } from './gfx/textures.js';
import { buildSky, updateSky } from './gfx/sky.js';
import { buildHumanoid, animateRig } from './models.js';

export const world = { group: null, npcs: [], nodes: [], portals: [], capture: null, pickables: [], anim: [] };

let rngS = 1;
const rnd = () => ((rngS = (rngS * 16807) % 2147483647) / 2147483647);
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
const glow = (c, i = 2) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3 });

// Per-zone art direction
const LOOK = {
  city_union:    { skyTop: 0x2a4f86, skyHorizon: 0xa9c4dc, fog: 0x9fb3c6, sun: 0xfff1d8, elev: 0.55, ground: 'stone', fogD: 0.006, mote: 0x9fd0ff, grass: 0, cloud: 0.5 },
  city_sylvaran: { skyTop: 0x2c5a6a, skyHorizon: 0xc8e2c4, fog: 0xaecdb0, sun: 0xfff0c0, elev: 0.45, ground: 'stone', fogD: 0.007, mote: 0xb0ffb8, grass: 1500, grassCol: 0x6a9a4a, cloud: 0.6 },
  city_ferron:   { skyTop: 0x4a3030, skyHorizon: 0xd09a70, fog: 0xa88068, sun: 0xffc890, elev: 0.3, ground: 'stone', fogD: 0.008, mote: 0xffa060, grass: 0, cloud: 0.7 },
  verge:     { skyTop: 0x3a6aa0, skyHorizon: 0xe8cfa0, fog: 0xd8c0a0, sun: 0xffe4b0, elev: 0.35, ground: 'sand', slope: 'stone', fogD: 0.0065, mote: 0xffe8c0, grass: 5000, grassCol: 0xa89a58, cloud: 0.55 },
  glasswood: { skyTop: 0x1f4a5a, skyHorizon: 0x98d0c0, fog: 0x7fb0a8, sun: 0xe8fff0, elev: 0.5, ground: 'forest', slope: 'grass', fogD: 0.008, mote: 0x80fff0, moteSize: 0.45, grass: 9000, grassCol: 0x5a9a5a, cloud: 0.7 },
  ashen:     { skyTop: 0x1a0c0c, skyHorizon: 0x9a3a20, fog: 0x5a2a1c, sun: 0xff7030, elev: 0.12, ground: 'ash', slope: 'ash', fogD: 0.009, mote: 0xff6020, moteSize: 0.3, grass: 0, cloud: 0.8 },
  core:      { skyTop: 0x0a0818, skyHorizon: 0x5a3a8a, fog: 0x2a2048, sun: 0xd0a0ff, elev: 0.2, ground: 'void', slope: 'void', fogD: 0.009, mote: 0xd0a0ff, moteSize: 0.5, grass: 0, cloud: 0.3, stars: 1 },
};

export function ground(x, z) { return heightAt(x, z); }

export function buildZone(zoneId) {
  const Z = ZONES[zoneId];
  if (world.group) { scene.remove(world.group); world.group.traverse((o) => o.geometry?.dispose()); }
  world.group = new THREE.Group();
  Object.assign(world, { npcs: [], nodes: [], portals: [], pickables: [], anim: [], capture: null, spin: null });
  G.zone = Z;
  const L = (Z.look = LOOK[zoneId]);
  rngS = [...zoneId].reduce((a, ch) => a + ch.charCodeAt(0) * 131, 7);

  const flats = [{ x: 0, z: 0, r: Z.kind === 'city' ? 70 : 24 }];
  setTerrain(rnd() * 10, Z.kind === 'city' ? 0 : 3.2, flats);

  // Lighting
  const sunDir = new THREE.Vector3(0.6, L.elev, 0.35).normalize();
  scene.fog = new THREE.FogExp2(L.fog, L.fogD);
  scene.environment = buildSky(world.group, Z, sunDir);
  const hemi = new THREE.HemisphereLight(L.skyHorizon, 0x2a241e, 0.38);
  const sun = new THREE.DirectionalLight(L.sun, 2.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
  world.sun = sun; world.sunDir = sunDir;
  world.group.add(hemi, sun, sun.target);

  buildTerrain(Z, L);
  if (Z.kind === 'city') buildCity(Z); else buildField(Z);
  scatterProps(Z);
  if (L.grass) buildGrass(Z, { ...L, grass: Math.round(L.grass * (MOBILE ? 0.35 : 1)) });
  scene.add(world.group);
  bus.emit('zone', Z);
  return Z;
}

function buildTerrain(Z, L) {
  const S = Z.size + 200, seg = 200;
  const geo = new THREE.PlaneGeometry(S, S, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, cols = [];
  const tint = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const out = Math.hypot(x, z) - Z.size * 0.5; // gentle hills past the playable edge
    pos.setY(i, heightAt(x, z) + (out > 0 ? out * (Z.kind === 'city' ? 0.06 : 0.16) * (1 + Math.sin(x * 0.05) * Math.cos(z * 0.04) * 0.6) : 0));
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const steep = 1 - nrm.getY(i), h = pos.getY(i);
    tint.setRGB(1, 1, 1).offsetHSL(0, 0, h * 0.02 - steep * 1.6 + (rnd() - 0.5) * 0.04);
    cols.push(tint.r, tint.g, tint.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const map = groundTex(L.ground, S / 12);
  const terrain = new THREE.Mesh(geo, std({ map, vertexColors: true, roughness: 0.95, bumpMap: map, bumpScale: 1.2 }));
  terrain.receiveShadow = true;
  world.terrain = terrain;
  world.group.add(terrain);
}

function place(obj, x, z, yOff = 0) { obj.position.set(x, ground(x, z) + yOff, z); world.group.add(obj); return obj; }
function shadows(o, cast = true) { o.traverse((m) => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = true; } }); return o; }
function freeSpot(r0, r1) { const a = rnd() * Math.PI * 2, d = r0 + rnd() * (r1 - r0); return [Math.cos(a) * d, Math.sin(a) * d]; }

// ---------- Props ----------
function rockGeo(r) {
  const g = new THREE.IcosahedronGeometry(r, 3), p = g.attributes.position, v = new THREE.Vector3();
  const s1 = rnd() * 10, s2 = rnd() * 10;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + Math.sin(v.x * 2.1 + s1) * 0.12 + Math.cos(v.z * 2.7 + s2) * 0.1 + Math.sin(v.y * 3.3) * 0.08;
    v.multiplyScalar(n); v.y *= 0.65; p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function crystalCluster(color, scale = 1) {
  const g = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.88, clearcoat: 1 });
  const n = 3 + Math.floor(rnd() * 4);
  for (let k = 0; k < n; k++) {
    const h = (1.2 + rnd() * 2.4) * scale;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.28 * scale, h * 0.35, 6), m);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.22 * scale, h * 0.65, 6), m);
    c.position.y = h * 0.65 + h * 0.175; b.position.y = h * 0.325;
    const s = new THREE.Group(); s.add(b, c);
    s.position.set((rnd() - 0.5) * scale, -0.1, (rnd() - 0.5) * scale);
    s.rotation.set((rnd() - 0.5) * 0.7, rnd() * 3, (rnd() - 0.5) * 0.7);
    g.add(s);
  }
  return g;
}

function tree(Z) {
  const g = new THREE.Group();
  const crystal = Z.id === 'glasswood';
  const h = 4 + rnd() * 4;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, h, 8, 4), std({ map: barkTex(), color: 0x8a7060 }));
  trunk.position.y = h / 2;
  g.add(trunk);
  const leafMat = crystal
    ? new THREE.MeshPhysicalMaterial({ color: 0x7fe8d0, emissive: 0x2a9a88, emissiveIntensity: 0.6, roughness: 0.15, transparent: true, opacity: 0.8, clearcoat: 1 })
    : std({ color: Z.look.grassCol ? new THREE.Color(Z.look.grassCol).multiplyScalar(0.7) : 0x3f6a34, roughness: 0.9 });
  const clumps = 4 + Math.floor(rnd() * 4);
  for (let i = 0; i < clumps; i++) {
    const r = 1.2 + rnd() * 1.2;
    const c = new THREE.Mesh(crystal ? new THREE.OctahedronGeometry(r, 0) : rockGeo(r), leafMat);
    c.position.set((rnd() - 0.5) * 2.4, h - 0.5 + rnd() * 2.2, (rnd() - 0.5) * 2.4);
    if (crystal) c.scale.y = 1.6;
    g.add(c);
  }
  return g;
}

function ruin() {
  const g = new THREE.Group(), m = std({ map: rockTex(), color: 0xb8b0a0 });
  const n = 2 + Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++) {
    const h = 2 + rnd() * 5;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, h, 12), m);
    col.position.set(k * 2.6, h / 2, 0); col.rotation.z = (rnd() - 0.5) * 0.15;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 1.3), m); cap.position.set(k * 2.6, h + 0.17, 0);
    g.add(col, cap);
  }
  if (rnd() < 0.5) { const beam = new THREE.Mesh(new THREE.BoxGeometry(n * 2.6, 0.5, 1), m); beam.position.set((n - 1) * 1.3, 5.3, 0); beam.rotation.z = 0.12; g.add(beam); }
  const base = new THREE.Mesh(new THREE.BoxGeometry(n * 2.6 + 1, 0.4, 2.2), m); base.position.set((n - 1) * 1.3, 0.2, 0); g.add(base);
  g.rotation.y = rnd() * 3;
  return g;
}

function scatterProps(Z) {
  const S = Z.size * 0.47, minR = Z.kind === 'city' ? 50 : 26;
  const rockMat = std({ map: rockTex(), color: new THREE.Color(0xffffff).lerp(new THREE.Color(Z.look.fog), 0.25), roughness: 0.95, bumpMap: rockTex(), bumpScale: 2 });
  for (const [kind, n] of Object.entries(Z.props)) {
    for (let i = 0; i < n; i++) {
      const [x, z] = freeSpot(minR, S);
      let m, y = 0;
      if (kind === 'rock') { m = new THREE.Mesh(rockGeo(0.7 + rnd() * 2.6), rockMat); m.rotation.y = rnd() * 6; y = -0.2; }
      else if (kind === 'crystal') m = crystalCluster(Z.accent, 0.8 + rnd() * 1.2);
      else if (kind === 'tree') m = tree(Z);
      else if (kind === 'ruin') m = ruin();
      else if (kind === 'tower') continue; // city towers are built by the faction architecture
      place(shadows(m), x, z, y);
    }
  }
  // Distant mountains ring for depth
  const mm = std({ color: new THREE.Color(Z.look.fog).multiplyScalar(0.8), roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2, d = Z.size * 0.5 + 60 + rnd() * 40;
    const m = new THREE.Mesh(rockGeo(20 + rnd() * 25), mm);
    m.scale.y = 1.4 + rnd();
    m.position.set(Math.cos(a) * d, -4, Math.sin(a) * d);
    world.group.add(m);
  }
}

// Instanced grass tufts with wind sway
function buildGrass(Z, L) {
  const blades = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.PlaneGeometry(0.09, 0.7, 1, 3);
    b.translate(0, 0.35, 0);
    const p = b.attributes.position;
    for (let k = 0; k < p.count; k++) { const y = p.getY(k); p.setX(k, p.getX(k) * (1 - y / 0.75)); p.setZ(k, y * y * 0.25); }
    b.rotateY((i / 5) * Math.PI); b.translate((rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3);
    blades.push(b);
  }
  const geo = mergeGeometries(blades);
  const mat = std({ map: bladeTex(), color: L.grassCol, side: THREE.DoubleSide, roughness: 1 });
  const uTime = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp0 = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
      float sway = sin(uTime * 1.8 + wp0.x * 0.35 + wp0.z * 0.27) * 0.18 + sin(uTime * 3.1 + wp0.x) * 0.05;
      transformed.x += sway * position.y; transformed.z += sway * 0.6 * position.y;`);
  };
  const im = new THREE.InstancedMesh(geo, mat, L.grass);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const R = Z.size * 0.48, minR = Z.kind === 'city' ? 36 : 6;
  for (let i = 0; i < L.grass; i++) {
    const [x, z] = freeSpot(minR, R);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
    const sc = 0.7 + rnd() * 0.9;
    s.set(sc, sc * (0.8 + rnd() * 0.6), sc);
    p.set(x, ground(x, z) - 0.05, z);
    im.setMatrixAt(i, m4.compose(p, q, s));
  }
  im.receiveShadow = true;
  world.group.add(im);
  world.anim.push((dt) => (uTime.value += dt));
}

// ---------- City architecture ----------
const NPC_DEFS = [
  { role: 'quest', name: 'Quartermaster Ivo', x: 0, z: -10, cls: 'warrior', tag: '!' },
  { role: 'shop', name: 'Merchant Pell', x: -14, z: -4, cls: 'specialist', tag: '$' },
  { role: 'gear', name: 'Armorer Kade', x: -14, z: 8, cls: 'warrior', tag: '⚔' },
  { role: 'smith', name: 'Refiner Oska', x: 14, z: -4, cls: 'specialist', tag: '⚒' },
  { role: 'craft', name: 'Artisan Lune', x: 14, z: 8, cls: 'caster', tag: '✂' },
  { role: 'premium', name: 'Shard Broker', x: -6, z: 18, cls: 'caster', tag: '◆' },
  { role: 'travel', name: 'Gate Warden', x: 0, z: 28, cls: 'ranger', tag: '⇆' },
];

function buildCity(Z) {
  const f = Z.faction, accent = Z.accent;
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(36, 36.5, 0.4, 64), std({ map: groundTex('stone', 9), roughness: 0.7, bumpMap: groundTex('stone', 9), bumpScale: 1.5 }));
  plaza.receiveShadow = true; place(plaza, 0, 0, 0.2);
  const inlay = new THREE.Mesh(new THREE.RingGeometry(10, 10.6, 64), glow(accent, 1.4));
  inlay.rotation.x = -Math.PI / 2; place(inlay, 0, 0, 0.42);

  if (f === 'union') unionCity(accent); else if (f === 'sylvaran') sylvaranCity(accent); else ferronCity(accent);

  // Perimeter wall with a gate gap facing +Z
  const wallMat = std({ map: metalTex('panel'), color: f === 'sylvaran' ? 0xc8c0a8 : f === 'ferron' ? 0x5a5650 : 0xd8dde4, metalness: f === 'sylvaran' ? 0 : 0.6, roughness: 0.5 });
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    if (Math.abs(a - Math.PI / 2) < 0.22) continue;
    const seg = new THREE.Mesh(new RoundedBoxGeometry(7.4, 7, 1.6, 2, 0.3), wallMat);
    seg.rotation.y = -a + Math.PI / 2;
    place(shadows(seg), Math.cos(a) * 58, Math.sin(a) * 58, 3.5);
    if (i % 4 === 0) {
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 10, 8), wallMat);
      place(shadows(tw), Math.cos(a) * 58, Math.sin(a) * 58, 5);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), glow(accent, 3)); place(l, Math.cos(a) * 58, Math.sin(a) * 58, 10.5);
    }
  }
  // Lamp posts around the plaza
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13, r = 33;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 4.2, 8), std({ color: 0x30343a, metalness: 0.8, roughness: 0.3 }));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), glow(f === 'ferron' ? 0xffb060 : 0xfff2d0, 3));
    place(shadows(post), Math.cos(a) * r, Math.sin(a) * r, 2.1); place(bulb, Math.cos(a) * r, Math.sin(a) * r, 4.3);
  }
  // Banners
  const bannerMat = std({ map: clothTex(), color: accent, side: THREE.DoubleSide, roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5, r = 30;
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.6, 1, 8), bannerMat);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6.5, 6), std({ color: 0x8a7a50, metalness: 0.8, roughness: 0.3 }));
    place(pole, Math.cos(a) * r, Math.sin(a) * r, 3.25);
    b.rotation.y = -a; place(b, Math.cos(a) * r, Math.sin(a) * r, 4.4);
    world.anim.push((dt, t) => { b.rotation.y = -a + Math.sin(t * 1.3 + i) * 0.15; });
  }
  for (const d of NPC_DEFS) spawnNpc(d, f);
  world.spawn = { x: 0, z: 8 };
}

function ringOfBuildings(make, n = 9, r = 46) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    if (Math.abs(a - Math.PI / 2) < 0.35 || Math.abs(a - Math.PI / 2 - Math.PI * 2) < 0.35) continue;
    const b = make(i); b.rotation.y = -a - Math.PI / 2;
    place(shadows(b), Math.cos(a) * r, Math.sin(a) * r);
  }
}

function unionCity(accent) {
  const steel = std({ map: metalTex('panel'), color: 0xe4e8ee, metalness: 0.7, roughness: 0.35 });
  const dark = std({ color: 0x2a3038, metalness: 0.8, roughness: 0.4 });
  const win = std({ color: 0x111820, emissive: 0xffffff, emissiveMap: windowsTex(0x8fd0ff), emissiveIntensity: 1.2, metalness: 0.5, roughness: 0.2 });
  // Central spire with orbiting holo rings
  const spire = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 2.6, 26, 12), steel); core.position.y = 13;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.6, 6, 12), glow(accent, 2.5)); tip.position.y = 29;
  spire.add(core, tip);
  for (let k = 0; k < 3; k++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(3.4 + k * 1.3, 0.08, 6, 64), glow(accent, 3)); r.position.y = 8 + k * 6; r.rotation.x = Math.PI / 2 + 0.3 * k;
    spire.add(r); world.anim.push((dt) => { r.rotation.z += dt * (0.6 + k * 0.3); });
  }
  place(shadows(spire), 0, 0, 0);
  ringOfBuildings((i) => {
    const g = new THREE.Group(), h = 14 + (i % 3) * 7;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.4, h, 8), steel); t.position.y = h / 2;
    const w = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 4.2, h * 0.8, 8, 1, true), win); w.position.y = h / 2; w.scale.set(1.01, 1, 1.01);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(5, 3.2, 1.2, 8), dark); top.position.y = h + 0.6;
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), glow(0xff4040, 3)); beacon.position.y = h + 1.6;
    g.add(t, w, top, beacon);
    return g;
  });
}

function sylvaranCity(accent) {
  const stone = std({ map: rockTex(), color: 0xe8e0cc, roughness: 0.75 });
  const gold = std({ color: 0xd8b060, metalness: 1, roughness: 0.25 });
  // Floating crystal monument
  const mon = crystalCluster(accent, 3);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 1.6, 12), stone);
  place(shadows(plinth), 0, 0, 0.8);
  place(mon, 0, 0, 3);
  world.spin = mon;
  ringOfBuildings((i) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.4, 7, 16), stone); base.position.y = 3.5;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), i % 2 ? gold : std({ color: 0x4a8a6a, roughness: 0.4, metalness: 0.3 }));
    dome.position.y = 7;
    for (let k = 0; k < 8; k++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 7, 10), stone);
      c.position.set(Math.cos(k / 8 * 6.28) * 5.6, 3.5, Math.sin(k / 8 * 6.28) * 5.6); g.add(c);
    }
    const spike = crystalCluster(accent, 0.8); spike.position.y = 11.5;
    g.add(base, dome, spike);
    return g;
  });
}

function ferronCity(accent) {
  const iron = std({ map: metalTex('hex'), color: 0x6a6660, metalness: 0.85, roughness: 0.45 });
  const rust = std({ color: 0x5a3a28, metalness: 0.6, roughness: 0.7 });
  const vent = glow(0xff6a20, 2.5);
  // Forge monument: rotating gear + molten core
  const gear = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.9, 8, 32), iron); gear.add(ring);
  for (let k = 0; k < 12; k++) { const t = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 1.4), iron); t.position.set(Math.cos(k / 12 * 6.28) * 6, Math.sin(k / 12 * 6.28) * 6, 0); t.rotation.z = k / 12 * 6.28; gear.add(t); }
  const coreM = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), vent); gear.add(coreM);
  gear.position.y = 9; place(shadows(gear), 0, 0, 0);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), iron); place(shadows(stand), 0, 0, 1.5);
  world.anim.push((dt) => { gear.rotation.z += dt * 0.3; });
  ringOfBuildings((i) => {
    const g = new THREE.Group(), h = 10 + (i % 3) * 5;
    const b = new THREE.Mesh(new RoundedBoxGeometry(9, h, 8, 2, 0.4), iron); b.position.y = h / 2;
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 8, 12), rust); stack.position.set(2.5, h + 4, -1.5);
    const glowRim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.15, 6, 16), vent); glowRim.rotation.x = Math.PI / 2; glowRim.position.set(2.5, h + 8, -1.5);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, h, 8), rust); pipe.position.set(-4.7, h / 2, 2);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.4), vent); door.position.set(0, 1.7, 4.02);
    g.add(b, stack, glowRim, pipe, door);
    return g;
  });
}

function spawnNpc(d, faction) {
  const pal = { quest: 0xc8a040, shop: 0x4a7aa8, gear: 0x8a8a90, smith: 0xa85a2a, craft: 0x4a8a4a, premium: 0x8a4ab0, travel: 0xe0e0e0 }[d.role];
  const rig = buildHumanoid(faction, d.cls, { skin: 0xe0b896, primary: pal, secondary: 0x2a2a30, face: 0, hair: 2 });
  rig.root.rotation.y = Math.atan2(-d.x, -d.z);
  place(rig.root, d.x, d.z);
  const npc = { ...d, mesh: rig.root, root: rig.root, rig, parts: rig.parts, pos: rig.root.position, height: rig.height, hp: 1, maxHp: 1, isNpc: true, anim: rnd() * 6, cls: d.cls };
  rig.root.userData.ref = npc;
  makePlate(npc, `<b class="tag">${d.tag}</b> ${d.name}`, 'npc');
  world.npcs.push(npc); world.pickables.push(rig.root);
}

// ---------- Field ----------
const NODE_LOOK = {
  ore: { color: 0xd08040, item: 'mat_ore', name: 'Veyrite Vein' },
  crystal: { color: 0x7fe3ff, item: 'mat_crystal', name: 'Crystal Cluster' },
  lumen: { color: 0xfff080, item: 'mat_lumen', name: 'Lumen Bloom' },
  core: { color: 0xff9020, item: 'mat_core', name: 'Core Seam' },
};

function buildField(Z) {
  addPortal(0, -14, 'travel', 'Gerbang Kota');
  world.spawn = { x: 0, z: 6 }; // camera ends up on the +Z side, looking past the portal
  const rockMat = std({ map: rockTex(), color: 0x9a948a, roughness: 0.9 });
  for (const [kind, n] of Object.entries(Z.nodes)) {
    const L = NODE_LOOK[kind];
    for (let i = 0; i < n; i++) {
      const [x, z] = freeSpot(30, Z.size * 0.45);
      const g = new THREE.Group();
      if (kind === 'ore' || kind === 'core') {
        g.add(new THREE.Mesh(rockGeo(1.3), rockMat));
        for (let k = 0; k < 6; k++) { const v = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), glow(L.color, 1.5)); v.position.set((rnd() - 0.5) * 2, 0.2 + rnd() * 0.8, (rnd() - 0.5) * 2); g.add(v); }
      } else g.add(crystalCluster(L.color, kind === 'lumen' ? 0.6 : 0.9));
      shadows(g);
      place(g, x, z, 0);
      const node = { kind, ...L, mesh: g, pos: g.position, ready: true, timer: 0, isNode: true };
      g.userData.ref = node;
      world.nodes.push(node); world.pickables.push(g);
    }
  }
  if (Z.pvp) buildCore(Z);
}

function buildCore(Z) {
  const stone = std({ map: metalTex('hex'), color: 0x5a5470, metalness: 0.6, roughness: 0.4 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(13, 14, 0.8, 48), stone); place(shadows(base), 0, 0, 0.4);
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * 6.28, p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 7, 8), stone);
    place(shadows(p), Math.cos(a) * 12.5, Math.sin(a) * 12.5, 3.5);
    const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), glow(0xd0a0ff, 3)); place(o, Math.cos(a) * 12.5, Math.sin(a) * 12.5, 7.6);
  }
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(4.5, 0), new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: 0xc8a0ff, emissiveIntensity: 1.6, roughness: 0.05, transparent: true, opacity: 0.85, clearcoat: 1 }));
  crystal.scale.y = 1.9; place(crystal, 0, 0, 11);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 120, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xc8a0ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
  place(beam, 0, 0, 60);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(12, 0.25, 6, 96), glow(0xffffff, 2)); ring.rotation.x = Math.PI / 2; place(ring, 0, 0, 0.9);
  const light = new THREE.PointLight(0xc8a0ff, 60, 40, 1.6); place(light, 0, 0, 10);
  world.capture = { mesh: crystal, ring, x: 0, z: 0, r: 12 };
  world.spin = crystal;
  world.factionSpawn = {};
  Object.keys(FACTIONS).forEach((f, i) => {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2, r = Z.size * 0.38;
    world.factionSpawn[f] = { x: Math.cos(a) * r, z: Math.sin(a) * r };
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.4, 0.4, 6), std({ color: FACTIONS[f].color, emissive: FACTIONS[f].color, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3 }));
    place(shadows(pad), Math.cos(a) * r, Math.sin(a) * r, 0.2);
  });
  world.spawn = world.factionSpawn[G.char.faction];
  world.portals[0].mesh.position.set(world.spawn.x, ground(world.spawn.x, world.spawn.z) + 0, world.spawn.z + 8);
}

function addPortal(x, z, role, name) {
  const g = new THREE.Group();
  const stone = std({ map: rockTex(), color: 0xa8a4b0, roughness: 0.6 });
  for (const sx of [-2.6, 2.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 6, 0.9), stone); p.position.set(sx, 3, 0); g.add(p); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.9, 1.1), stone); lintel.position.y = 6.2; g.add(lintel);
  const disk = new THREE.Mesh(new THREE.CircleGeometry(2.3, 48), new THREE.MeshBasicMaterial({ color: 0x80d0ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
  disk.position.y = 3; disk.scale.y = 1.15; g.add(disk);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.12, 8, 48), glow(0x80d0ff, 3)); ring.position.y = 3; ring.scale.y = 1.15; g.add(ring);
  shadows(g);
  place(g, x, z, 0);
  world.anim.push((dt, t) => { disk.material.opacity = 0.4 + Math.sin(t * 3) * 0.15; ring.rotation.z += dt; });
  const p = { role, name, mesh: g, pos: g.position, isPortal: true, height: 6.5, hp: 1, maxHp: 1 };
  g.userData.ref = p;
  world.portals.push(p); world.pickables.push(g);
}

let T = 0;
export function updateWorld(dt) {
  T += dt;
  if (world.spin) world.spin.rotation.y += dt * 0.4;
  for (const fn of world.anim) fn(dt, T);
  for (const n of world.nodes) if (!n.ready && (n.timer -= dt) <= 0) { n.ready = true; n.mesh.visible = true; }
  for (const n of world.npcs) animateRig(n, dt);
  updateSky(dt, camera.position);
  if (G.player && world.sun) {
    const p = G.player.pos;
    world.sun.position.set(p.x + world.sunDir.x * 120, p.y + world.sunDir.y * 120, p.z + world.sunDir.z * 120);
    world.sun.target.position.copy(p);
  }
}
