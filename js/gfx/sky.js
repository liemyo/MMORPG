// Atmospheric sky dome with procedural clouds + PBR environment map + floating motes.
import * as THREE from 'three';
import { pmrem } from '../engine.js';
import { glowTex } from './textures.js';

const vert = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const frag = `
uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor; uniform float cloud; uniform float time; uniform float stars;
varying vec3 vDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h,0.0,1.0), 0.55)) : mix(horizon, bottom, clamp(-h*3.0,0.0,1.0));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 600.0) * 4.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.12);
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.15) * 1.6 + vec2(time * 0.004, time * 0.002);
    float c = smoothstep(0.45, 0.85, fbm(uv)) * cloud * smoothstep(0.0, 0.25, h);
    vec3 cc = mix(horizon * 1.15, sunColor, pow(s, 4.0) * 0.6);
    col = mix(col, cc, c * 0.85);
    float st = step(0.998, hash(floor(d.xz / (h + 0.3) * 300.0))) * stars * smoothstep(0.1, 0.5, h);
    col += vec3(st);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

let sky, motes;
export function buildSky(group, Z, sunDir) {
  const L = Z.look;
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(L.skyTop) }, horizon: { value: new THREE.Color(L.skyHorizon) }, bottom: { value: new THREE.Color(L.fog) },
      sunDir: { value: sunDir.clone() }, sunColor: { value: new THREE.Color(L.sun) }, cloud: { value: L.cloud ?? 0.6 },
      time: { value: 0 }, stars: { value: L.stars ?? 0 },
    },
  });
  sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  sky.renderOrder = -1;
  group.add(sky);

  // Environment map for metal reflections (rendered from the sky only)
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat));
  const env = pmrem.fromScene(envScene, 0.02).texture;

  // Floating dust / crystal motes
  const N = 500, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 120; pos[i * 3 + 1] = Math.random() * 18; pos[i * 3 + 2] = (Math.random() - 0.5) * 120; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  motes = new THREE.Points(g, new THREE.PointsMaterial({ map: glowTex(), color: L.mote, size: L.moteSize || 0.35, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  group.add(motes);
  return env;
}

export function updateSky(dt, center) {
  if (!sky) return;
  sky.material.uniforms.time.value += dt;
  sky.position.copy(center);
  if (motes) {
    motes.position.set(center.x, 0, center.z);
    const a = motes.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i) + dt * 0.4; if (y > 18) y = 0;
      a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(y + i) * dt * 0.2);
    }
    a.needsUpdate = true;
  }
}
