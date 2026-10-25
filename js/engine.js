// Three.js setup: renderer, camera rig, input, terrain height, floating text & nameplates.
import * as THREE from 'three';
import { G, bus } from './state.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export { THREE };
// Mobile mode: auto on touch devices, override with ?mobile=1 / ?mobile=0
const mq = new URLSearchParams(location.search).get('mobile');
export const MOBILE = mq === '1' || (mq !== '0' && (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1));
if (MOBILE) document.documentElement.classList.add('mobile');
export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(MOBILE ? Math.min(1.25, devicePixelRatio) : Math.min(1.5, devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.88;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('game').appendChild(renderer.domElement);

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1200);
export const cam = { yaw: Math.PI, pitch: 0.36, dist: 13 };

// Post-processing: bloom only catches bright emissive parts (crystals, visors, skill FX)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
export const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.4, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());
export const pmrem = new THREE.PMREMGenerator(renderer);
export function render() { composer.render(); }

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- Terrain height ----------
let hSeed = 0, hAmp = 0, flat = [];
export function setTerrain(seed, amp, flatZones = []) { hSeed = seed; hAmp = amp; flat = flatZones; }
export function heightAt(x, z) {
  if (!hAmp) return 0;
  let h = Math.sin(x * 0.045 + hSeed) * Math.cos(z * 0.038 + hSeed * 2) * 1.0
        + Math.sin(x * 0.11 + z * 0.07 + hSeed) * 0.45 + Math.cos(z * 0.16 - x * 0.05) * 0.25;
  h *= hAmp;
  for (const f of flat) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r) h *= Math.min(1, Math.max(0, (d - f.r * 0.6) / (f.r * 0.4)));
  }
  return h;
}

// ---------- Input ----------
export const keys = new Set();
export const typing = () => {
  const a = document.activeElement;
  return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT');
};
addEventListener('keydown', (e) => {
  if (typing()) { if (e.key === 'Escape') document.activeElement.blur(); return; }
  if (e.key === 'F10' || e.key === 'Tab') e.preventDefault();
  if (!e.repeat) bus.emit('key', e.key.length === 1 ? e.key.toLowerCase() : e.key, e);
  keys.add(e.key.toLowerCase());
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

const canvas = renderer.domElement;
let drag = null;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, b: e.button, moved: 0 }; });
addEventListener('mousemove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  drag.x = e.clientX; drag.y = e.clientY;
  if (drag.moved > 4) {
    cam.yaw -= dx * 0.006;
    cam.pitch = Math.max(0.08, Math.min(1.35, cam.pitch + dy * 0.005));
  }
});
addEventListener('mouseup', (e) => {
  if (drag && drag.moved <= 4 && e.target === canvas) bus.emit('click', e.clientX, e.clientY, drag.b);
  drag = null;
});
canvas.addEventListener('wheel', (e) => { cam.dist = Math.max(4, Math.min(40, cam.dist + e.deltaY * 0.015)); }, { passive: true });

// Touch on the canvas only (targetTouches ignores fingers on the joystick/buttons):
// one finger drags the camera, two fingers pinch-zoom, a short tap selects.
let touch = null, pinch = 0;
const spread = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
canvas.addEventListener('touchstart', (e) => {
  const ts = e.targetTouches;
  if (ts.length === 1) touch = { id: ts[0].identifier, x: ts[0].clientX, y: ts[0].clientY, moved: 0 };
  if (ts.length === 2) { pinch = spread(ts); if (touch) touch.moved = 99; }
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  const ts = e.targetTouches;
  if (ts.length >= 2 && pinch) { const d = spread(ts); cam.dist = Math.max(4, Math.min(40, cam.dist * (pinch / d))); pinch = d; return; }
  const t = touch && [...ts].find((x) => x.identifier === touch.id);
  if (!t) return;
  const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
  touch.moved += Math.abs(dx) + Math.abs(dy); touch.x = t.clientX; touch.y = t.clientY;
  cam.yaw -= dx * 0.008; cam.pitch = Math.max(0.08, Math.min(1.35, cam.pitch + dy * 0.006));
}, { passive: true });
canvas.addEventListener('touchend', (e) => {
  e.preventDefault(); // suppress the synthetic mouse events
  if (e.targetTouches.length < 2) pinch = 0;
  if (touch && ![...e.targetTouches].some((x) => x.identifier === touch.id)) {
    if (touch.moved < 8) bus.emit('click', touch.x, touch.y, 0);
    touch = null;
  }
}, { passive: false });

const ray = new THREE.Raycaster();
export function pick(x, y, objects) {
  ray.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  return ray.intersectObjects(objects, true)[0] || null;
}

export function updateCamera(target, dt) {
  const t = new THREE.Vector3(target.x, target.y + 1.9, target.z);
  if (keys.has('q')) cam.yaw += dt * 1.8;
  if (keys.has('e')) cam.yaw -= dt * 1.8;
  const off = new THREE.Vector3(
    Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch),
  ).multiplyScalar(cam.dist);
  const want = t.clone().add(off);
  const gh = heightAt(want.x, want.z) + 1;
  if (want.y < gh) want.y = gh;
  camera.position.lerp(want, Math.min(1, dt * 10));
  camera.lookAt(t);
}

// ---------- Screen-space overlays ----------
const overlay = document.getElementById('overlay');
const floats = [];
const v3 = new THREE.Vector3();
function toScreen(p, yOff = 0) {
  v3.set(p.x, p.y + yOff, p.z).project(camera);
  if (v3.z > 1) return null;
  return { x: (v3.x * 0.5 + 0.5) * innerWidth, y: (-v3.y * 0.5 + 0.5) * innerHeight };
}
export function floatText(text, pos, cls = 'dmg') {
  const el = document.createElement('div');
  el.className = `float ${cls}`;
  el.textContent = text;
  overlay.appendChild(el);
  floats.push({ el, p: { x: pos.x + (Math.random() - 0.5), y: pos.y + 2.2, z: pos.z }, t: 0 });
}

export function updateOverlays(dt, units) {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.t += dt; f.p.y += dt * 1.6;
    const s = toScreen(f.p);
    if (!s || f.t > 1.1) { f.el.remove(); floats.splice(i, 1); continue; }
    f.el.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-50%)`;
    f.el.style.opacity = String(1 - Math.max(0, f.t - 0.6) / 0.5);
  }
  for (const u of units) {
    if (!u.plate) continue;
    const d = u.pos.distanceTo(camera.position);
    const s = !u.dead && d < 60 ? toScreen(u.pos, u.height + 0.6) : null;
    if (!s) { u.plate.style.display = 'none'; continue; }
    u.plate.style.display = 'block';
    u.plate.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-100%)`;
    u.plateBar.style.width = `${Math.max(0, (u.hp / u.maxHp) * 100)}%`;
    u.plate.classList.toggle('targeted', G.target === u);
  }
}

export function makePlate(u, label, cls) {
  const el = document.createElement('div');
  el.className = `plate ${cls}`;
  el.innerHTML = `<div class="pn">${label}</div><div class="pb"><i></i></div>`;
  overlay.appendChild(el);
  u.plate = el; u.plateBar = el.querySelector('i');
}

export function clearOverlay() { overlay.innerHTML = ''; floats.length = 0; }
