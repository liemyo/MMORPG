// Monster models: organic/mechanical silhouettes with PBR materials, jointed legs and glow accents.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { hideTex, metalTex, rockTex, glowTex } from './gfx/textures.js';

const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };
const piv = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

function displaced(r, detail = 3, amt = 0.15, seed = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + (Math.sin(v.x * 5 + seed) * Math.cos(v.z * 4.3 + seed) + Math.sin(v.y * 6.1)) * amt * 0.5);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Two-segment insect/arthropod leg attached at (x,y,z), splayed outward by side
function insectLeg(parent, mat, x, y, z, side, len = 0.5) {
  const hip = piv(parent, x, y, z);
  hip.rotation.z = side * 0.9;
  const up = mesh(new THREE.CapsuleGeometry(0.04, len, 4, 8), mat, 0, -len / 2, 0); hip.add(up);
  const knee = piv(hip, 0, -len, 0); knee.rotation.z = -side * 1.7;
  knee.add(mesh(new THREE.CapsuleGeometry(0.03, len * 1.1, 4, 8), mat, 0, -len * 0.55, 0));
  return hip;
}

export function buildMonster(shape, color, size = 1) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const base = new THREE.Color(color);
  const hide = new THREE.MeshPhysicalMaterial({ color, map: hideTex(), roughness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.3, bumpMap: hideTex(), bumpScale: 1.5 });
  const dark = new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(0.35), map: hideTex(), roughness: 0.6 });
  const metalM = new THREE.MeshPhysicalMaterial({ color, map: metalTex('panel'), metalness: 0.85, roughness: 0.35, clearcoat: 0.5 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: base.clone().lerp(new THREE.Color(0xffffff), 0.3), emissiveIntensity: 2.6 });
  const eyeRed = new THREE.MeshStandardMaterial({ color: 0xff3020, emissive: 0xff3020, emissiveIntensity: 3 });
  const parts = { body, legs: [], orbit: [], shape };
  let height = 1.4, float = 0;
  const eyes = (parent, y, z, spread, r = 0.045, m = eyeRed) => { for (const sx of [-spread, spread]) parent.add(mesh(new THREE.SphereGeometry(r, 10, 8), m, sx, y, z)); };

  switch (shape) {
    case 'crawler': { // segmented centipede-like scavenger
      for (let i = 0; i < 4; i++) {
        const seg = mesh(new THREE.SphereGeometry(0.42 - i * 0.05, 16, 12), hide, 0, 0.42, 0.45 - i * 0.48); seg.scale.set(1.2, 0.7, 1); body.add(seg);
        for (const s of [-1, 1]) parts.legs.push(insectLeg(body, dark, s * 0.38, 0.42, 0.45 - i * 0.48, s, 0.32));
      }
      const head = mesh(new THREE.SphereGeometry(0.3, 16, 12), hide, 0, 0.45, 0.85); head.scale.set(1, 0.75, 1.1); body.add(head);
      for (const s of [-1, 1]) { const mand = mesh(new THREE.ConeGeometry(0.05, 0.35, 6), dark, s * 0.14, 0.38, 1.1); mand.rotation.set(Math.PI / 2, 0, s * 0.5); body.add(mand); }
      eyes(body, 0.55, 1.08, 0.1);
      height = 1.1; break;
    }
    case 'beetle': { // armored crystal beetle
      const shell = mesh(new THREE.SphereGeometry(0.85, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), hide, 0, 0.45, 0); shell.scale.set(1, 0.85, 1.35); body.add(shell);
      const under = mesh(new THREE.SphereGeometry(0.75, 16, 10), dark, 0, 0.45, 0); under.scale.set(1, 0.35, 1.3); body.add(under);
      const seam = mesh(new THREE.BoxGeometry(0.03, 0.02, 2.1), dark, 0, 1.17, 0); body.add(seam);
      const head = mesh(new THREE.SphereGeometry(0.38, 16, 12), dark, 0, 0.5, 1.15); head.scale.set(1, 0.8, 0.9); body.add(head);
      const horn = mesh(new THREE.ConeGeometry(0.12, 0.7, 6), glow, 0, 0.85, 1.35); horn.rotation.x = 0.6; body.add(horn);
      for (let k = 0; k < 4; k++) { const c = mesh(new THREE.OctahedronGeometry(0.12, 0), glow, (k - 1.5) * 0.25, 1.15, -0.2 + (k % 2) * 0.4); c.scale.y = 2.2; body.add(c); }
      for (let i = 0; i < 3; i++) for (const s of [-1, 1]) parts.legs.push(insectLeg(body, dark, s * 0.65, 0.4, 0.5 - i * 0.5, s, 0.42));
      eyes(body, 0.6, 1.45, 0.17, 0.05);
      height = 1.6; break;
    }
    case 'drone': { // rogue mining drone
      const core = mesh(new THREE.SphereGeometry(0.42, 24, 16), metalM); body.add(core);
      const band = mesh(new THREE.TorusGeometry(0.45, 0.05, 8, 32), new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.9, roughness: 0.3 })); band.rotation.x = Math.PI / 2; body.add(band);
      const lens = mesh(new THREE.SphereGeometry(0.13, 16, 12), eyeRed, 0, 0.02, 0.38); body.add(lens);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2, arm = piv(body, Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4);
        arm.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), metalM, Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25)).children.at(-1).rotation.set(Math.PI / 2, -a, 0);
        const rotor = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 20), new THREE.MeshBasicMaterial({ color: 0xa0d8ff, transparent: true, opacity: 0.25 }), Math.cos(a) * 0.5, 0.1, Math.sin(a) * 0.5);
        arm.add(rotor); parts.orbit.push(rotor);
      }
      const thr = mesh(new THREE.ConeGeometry(0.12, 0.3, 12), glow, 0, -0.5, 0); thr.rotation.x = Math.PI; body.add(thr);
      float = 1.7; height = 0.9; break;
    }
    case 'golem': { // crystal-and-rock colossus
      const rock = new THREE.MeshStandardMaterial({ color: base.clone().lerp(new THREE.Color(0x6a6660), 0.6), map: rockTex(), roughness: 0.9, bumpMap: rockTex(), bumpScale: 3 });
      const torso = mesh(displaced(0.9, 3, 0.2, 2), rock, 0, 1.7, 0); torso.scale.set(1.15, 1, 0.85); body.add(torso);
      body.add(mesh(displaced(0.45, 2, 0.2, 5), rock, 0, 2.75, 0.15));
      body.add(mesh(new THREE.IcosahedronGeometry(0.28, 1), glow, 0, 1.75, 0.68));
      eyes(body, 2.8, 0.52, 0.14, 0.06, glow);
      for (const s of [-1, 1]) {
        const sh = piv(body, s * 1.15, 2.1, 0);
        sh.add(mesh(displaced(0.42, 2, 0.25, s + 3), rock, 0, 0, 0));
        sh.add(mesh(displaced(0.35, 2, 0.2, s + 7), rock, 0, -0.65, 0.05));
        sh.add(mesh(displaced(0.42, 2, 0.2, s + 9), rock, 0, -1.25, 0.1));
        parts.legs.push(sh);
        const leg = piv(body, s * 0.45, 0.95, 0);
        leg.add(mesh(displaced(0.38, 2, 0.2, s + 11), rock, 0, -0.3, 0));
        leg.add(mesh(displaced(0.35, 2, 0.2, s + 13), rock, 0, -0.75, 0.05));
        parts.legs.push(leg);
      }
      for (let k = 0; k < 7; k++) { const c = mesh(new THREE.OctahedronGeometry(0.16, 0), glow, (Math.random() - 0.5) * 1.6, 2.2 + Math.random() * 0.6, -0.4 - Math.random() * 0.3); c.scale.y = 3; c.rotation.z = (Math.random() - 0.5); body.add(c); }
      height = 3.2; break;
    }
    case 'stalker': { // lean predator quadruped
      const torso = mesh(new THREE.CapsuleGeometry(0.32, 1.2, 6, 14), hide, 0, 1.05, 0); torso.rotation.x = Math.PI / 2; body.add(torso);
      const neck = piv(body, 0, 1.15, 0.75); neck.rotation.x = -0.5;
      neck.add(mesh(new THREE.CapsuleGeometry(0.17, 0.45, 4, 10), hide, 0, 0.25, 0));
      const head = mesh(new THREE.ConeGeometry(0.2, 0.65, 8), dark, 0, 0.55, 0.22); head.rotation.x = Math.PI / 2 + 0.5; neck.add(head);
      eyes(neck, 0.6, 0.25, 0.1, 0.04);
      for (const [x, z] of [[-0.25, 0.55], [0.25, 0.55], [-0.25, -0.55], [0.25, -0.55]]) {
        const hip = piv(body, x, 1.0, z);
        hip.add(mesh(new THREE.CapsuleGeometry(0.09, 0.45, 4, 8), hide, 0, -0.25, 0));
        const knee = piv(hip, 0, -0.52, 0); knee.rotation.x = z > 0 ? 0.5 : -0.5;
        knee.add(mesh(new THREE.CapsuleGeometry(0.06, 0.4, 4, 8), dark, 0, -0.22, 0));
        parts.legs.push(hip);
      }
      const tail = mesh(new THREE.ConeGeometry(0.12, 1.2, 8), hide, 0, 1.05, -1.25); tail.rotation.x = -Math.PI / 2 - 0.3; body.add(tail);
      for (let k = 0; k < 5; k++) { const sp = mesh(new THREE.ConeGeometry(0.06, 0.4, 5), glow, 0, 1.4, 0.5 - k * 0.25); sp.rotation.x = -0.4; body.add(sp); }
      height = 1.8; break;
    }
    case 'wisp': { // living energy swarm
      body.add(mesh(new THREE.IcosahedronGeometry(0.28, 2), glow));
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); halo.scale.setScalar(2.2); body.add(halo);
      for (let k = 0; k < 7; k++) { const s = mesh(new THREE.OctahedronGeometry(0.09, 0), glow); s.userData.r = 0.5 + Math.random() * 0.3; s.userData.o = Math.random() * 6; body.add(s); parts.orbit.push(s); }
      float = 1.8; height = 0.9; break;
    }
    case 'crab': { // magma crab
      const shell = mesh(displaced(0.8, 3, 0.18, 3), hide, 0, 0.75, 0); shell.scale.set(1.4, 0.55, 1); body.add(shell);
      for (let k = 0; k < 6; k++) body.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), glow, (Math.random() - 0.5) * 1.6, 1.05, (Math.random() - 0.5) * 0.9));
      for (const s of [-1, 1]) {
        const arm = piv(body, s * 0.95, 0.85, 0.55);
        arm.add(mesh(new THREE.CapsuleGeometry(0.1, 0.4, 4, 8), dark, 0, 0, 0.2)).children.at(-1).rotation.x = Math.PI / 2;
        const claw = mesh(displaced(0.28, 2, 0.15, s), hide, 0, 0.05, 0.6); claw.scale.set(0.8, 0.6, 1.3); arm.add(claw);
        parts.legs.push(arm);
        for (let i = 0; i < 3; i++) parts.legs.push(insectLeg(body, dark, s * 0.95, 0.65, 0.2 - i * 0.35, s, 0.45));
      }
      eyes(body, 1.05, 0.75, 0.15, 0.06);
      height = 1.4; break;
    }
    case 'automaton': { // war mech
      const steel = new THREE.MeshPhysicalMaterial({ color, map: metalTex('hex'), metalness: 0.9, roughness: 0.35, clearcoat: 0.4 });
      const chest = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.9, 0.7, 3, 0.12), steel); chest.position.y = 1.85; body.add(chest);
      const head = new THREE.Mesh(new RoundedBoxGeometry(0.45, 0.38, 0.45, 3, 0.08), steel); head.position.y = 2.55; body.add(head);
      body.add(mesh(new THREE.BoxGeometry(0.36, 0.06, 0.05), eyeRed, 0, 2.58, 0.23));
      body.add(mesh(new THREE.IcosahedronGeometry(0.15, 1), glow, 0, 1.9, 0.36));
      body.add(mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.35, 12), metalM, 0, 1.25, 0));
      for (const s of [-1, 1]) {
        const sh = piv(body, s * 0.72, 2.1, 0);
        sh.add(new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.32, 0.5, 3, 0.08), steel));
        sh.add(mesh(new THREE.CapsuleGeometry(0.12, 0.5, 4, 10), metalM, 0, -0.5, 0));
        sh.add(mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.5, 10), steel, 0, -1.0, 0.05));
        parts.legs.push(sh);
        const hip = piv(body, s * 0.28, 1.1, 0);
        hip.add(mesh(new THREE.CapsuleGeometry(0.14, 0.4, 4, 10), metalM, 0, -0.3, 0));
        const shin = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.55, 0.38, 3, 0.06), steel); shin.position.set(0, -0.8, 0.03); hip.add(shin);
        parts.legs.push(hip);
      }
      height = 2.85; break;
    }
    case 'wraith': { // ash wraith
      const robe = new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity: 0.82, side: THREE.DoubleSide });
      const pts = [[0.05, 2.0], [0.25, 1.9], [0.32, 1.5], [0.4, 0.9], [0.6, 0.2], [0.7, 0]].map(([r, y]) => new THREE.Vector2(r, y));
      const cloak = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), robe); body.add(cloak); parts.cloak = cloak;
      const hood = mesh(new THREE.SphereGeometry(0.3, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65), robe, 0, 2.05, -0.02); body.add(hood);
      body.add(mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0x050505 }), 0, 2.0, 0.08));
      eyes(body, 2.03, 0.24, 0.07, 0.035, glow);
      for (const s of [-1, 1]) { const arm = piv(body, s * 0.35, 1.6, 0.1); arm.add(mesh(new THREE.ConeGeometry(0.12, 0.8, 8), robe, 0, -0.35, 0)); arm.add(mesh(new THREE.ConeGeometry(0.04, 0.25, 5), dark, 0, -0.85, 0.05)); parts.legs.push(arm); }
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.5, depthWrite: false })); halo.scale.setScalar(3); halo.position.y = 1.2; body.add(halo);
      float = 0.4; height = 2.5; break;
    }
  }
  body.scale.setScalar(size);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, parts, height: (height + float) * size, float: float * size };
}

export function animateMonster(u, dt) {
  const p = u.parts;
  u.anim = (u.anim || 0) + dt * (u.moving ? 9 : 2);
  const t = u.anim, s = Math.sin(t);
  p.body.position.y = (u.float || 0) + (u.float ? Math.sin(t * 0.5) * 0.15 : 0);
  p.body.rotation.x = u.atkT > 0 ? -0.3 : 0;
  const bipedal = p.shape === 'golem' || p.shape === 'automaton';
  p.legs.forEach((l, i) => {
    if (bipedal) { const side = i < 2 ? 1 : -1, arm = i % 2 === 0; l.rotation.x = side * (arm ? -1 : 1) * s * 0.5 * (u.moving ? 1 : 0.08) + (arm && u.atkT > 0 ? -1.4 : 0); }
    else if (p.shape === 'wraith') l.rotation.x = -0.3 + Math.sin(t * 0.7 + i) * 0.2 + (u.atkT > 0 ? -1 : 0);
    else l.rotation.x = Math.sin(t + i * 1.3) * (u.moving ? 0.45 : 0.06);
  });
  if (p.shape === 'wisp') p.orbit.forEach((o, i) => { const a = t * 0.8 + o.userData.o; o.position.set(Math.cos(a) * o.userData.r, Math.sin(a * 1.3) * 0.3, Math.sin(a) * o.userData.r); o.rotation.y += dt * 3; });
  else p.orbit.forEach((o) => (o.rotation.y += dt * 25));
  if (p.cloak) p.cloak.rotation.y = Math.sin(t * 0.5) * 0.2;
}
