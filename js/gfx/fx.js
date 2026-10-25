// Skill & hit effects: glowing projectiles with trails, ground shockwaves, light pillars, particle bursts.
import * as THREE from 'three';
import { scene } from '../engine.js';
import { glowTex } from './textures.js';

const live = [];
const additive = (color, opacity = 1) => new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

function sprite(color, size, pos, opacity = 1) {
  const s = new THREE.Sprite(additive(color, opacity));
  s.scale.setScalar(size); s.position.copy(pos);
  scene.add(s);
  return s;
}

export function burst(pos, color, n = 14, speed = 4, size = 0.35) {
  for (let i = 0; i < n; i++) {
    const s = sprite(color, size, pos);
    const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5 + 0.2, (Math.random() - 0.5) * 2).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
    live.push({ obj: s, t: 0, life: 0.5 + Math.random() * 0.3, upd: (f, k, dt) => { s.position.addScaledVector(v, dt); v.y -= 6 * dt; s.material.opacity = 1 - k; s.scale.setScalar(size * (1 - k * 0.6)); } });
  }
}

export function projectile(from, to, color) {
  const a = from.clone(), b = to.clone();
  const head = sprite(color, 0.9, a);
  const core = sprite(0xffffff, 0.35, a);
  const dist = a.distanceTo(b), life = Math.max(0.12, dist / 45);
  let trailT = 0;
  live.push({ obj: head, extra: [core], t: 0, life, upd: (f, k, dt) => {
    head.position.lerpVectors(a, b, k); head.position.y += Math.sin(k * Math.PI) * dist * 0.04;
    core.position.copy(head.position);
    if ((trailT += dt) > 0.012) {
      trailT = 0;
      const tr = sprite(color, 0.55, head.position, 0.8);
      live.push({ obj: tr, t: 0, life: 0.25, upd: (g, kk) => { tr.material.opacity = 0.8 * (1 - kk); tr.scale.setScalar(0.55 * (1 - kk)); } });
    }
  }, done: () => burst(b, color, 10, 3, 0.3) });
}

export function shockwave(pos, radius, color) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(pos.x, pos.y + 0.12, pos.z);
  scene.add(ring);
  const disk = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  disk.rotation.x = -Math.PI / 2; disk.position.copy(ring.position); disk.scale.setScalar(radius);
  scene.add(disk);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.6, radius * 0.9, 6, 32, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
  pillar.position.set(pos.x, pos.y + 3, pos.z);
  scene.add(pillar);
  live.push({ obj: ring, extra: [disk, pillar], t: 0, life: 0.55, upd: (f, k) => {
    ring.scale.setScalar(0.3 + k * radius); ring.material.opacity = 0.9 * (1 - k);
    disk.material.opacity = 0.35 * (1 - k); pillar.material.opacity = 0.25 * (1 - k); pillar.scale.y = 0.3 + k;
  } });
  burst(pos, color, Math.round(10 + radius * 3), radius * 1.4, 0.45);
}

export function aura(pos, color) { // buff / heal column
  shockwave(pos, 1.6, color);
  for (let i = 0; i < 16; i++) {
    const p = pos.clone().add(new THREE.Vector3(Math.cos(i) * 0.7, 0.2, Math.sin(i) * 0.7));
    const s = sprite(color, 0.3, p);
    const vy = 1.5 + Math.random() * 2;
    live.push({ obj: s, t: 0, life: 0.9, upd: (f, k, dt) => { s.position.y += vy * dt; s.material.opacity = 1 - k; } });
  }
}

export function updateFx(dt) {
  for (let i = live.length - 1; i >= 0; i--) {
    const f = live[i];
    f.t += dt;
    const k = Math.min(1, f.t / f.life);
    f.upd(f, k, dt);
    if (k >= 1) {
      for (const o of [f.obj, ...(f.extra || [])]) { scene.remove(o); o.material.dispose(); if (!o.isSprite) o.geometry.dispose(); }
      live.splice(i, 1);
      f.done?.();
    }
  }
}
