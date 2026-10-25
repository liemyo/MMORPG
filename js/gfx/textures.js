// Procedural, tileable textures generated on canvas (no external image assets).
import * as THREE from 'three';

const cache = new Map();

// Tileable value-noise fbm in [0,1]
function makeNoise(size, cells, seed) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const grids = [];
  for (let o = 0; o < 5; o++) {
    const n = cells << o, g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    grids.push({ n, g });
  }
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    let v = 0, amp = 0.5, tot = 0;
    for (const { n, g } of grids) {
      const fx = (x / size) * n, fy = (y / size) * n;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
      const a = g[(y0 % n) * n + (x0 % n)], b = g[(y0 % n) * n + ((x0 + 1) % n)];
      const c = g[((y0 + 1) % n) * n + (x0 % n)], d = g[((y0 + 1) % n) * n + ((x0 + 1) % n)];
      v += amp * ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty);
      tot += amp; amp *= 0.5;
    }
    return v / tot;
  };
}

function canvasTex(key, size, draw, { repeat = 1, color = true } = {}) {
  const k = `${key}|${repeat}`;
  if (cache.has(k)) return cache.get(k);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(k, t);
  return t;
}

function pixels(ctx, size, fn) {
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [r, g, b] = fn(x, y), i = (y * size + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
const mix = (a, b, t) => a + (b - a) * t;
const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

// Ground: two colors + detail speckle (grass, sand, ash, crystal soil, paving)
export function groundTex(kind, repeat) {
  const P = {
    grass: [0x3d5a2a, 0x6b7a3a, 0x2a3a1e], sand: [0x8a7452, 0xb09468, 0x6a5638], forest: [0x2c4a34, 0x48704a, 0x1c2e22],
    ash: [0x2e2624, 0x4a3a34, 0x1a1414], void: [0x2a2838, 0x45405e, 0x18161f], stone: [0x8c8a84, 0xa8a59c, 0x6a6862],
  }[kind];
  return canvasTex(`ground-${kind}`, 512, (ctx, S) => {
    const n = makeNoise(S, 4, kind.length * 7), d = makeNoise(S, 32, 3);
    const A = hex(P[0]), B = hex(P[1]), C = hex(P[2]);
    pixels(ctx, S, (x, y) => {
      const t = n(x, y), sp = d(x, y);
      const base = A.map((a, i) => mix(a, B[i], Math.min(1, Math.max(0, (t - 0.35) * 2))));
      return base.map((v, i) => mix(v, C[i], sp > 0.62 ? (sp - 0.62) * 2.4 : 0) * (0.85 + sp * 0.3));
    });
    if (kind === 'stone') { // paving tiles
      ctx.strokeStyle = 'rgba(40,38,34,0.55)'; ctx.lineWidth = 3;
      for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(0, i * S / 4); ctx.lineTo(S, i * S / 4); ctx.stroke(); }
      for (let r = 0; r < 4; r++) for (let i = 0; i <= 4; i++) { const x = (i + (r % 2) * 0.5) * S / 4; ctx.beginPath(); ctx.moveTo(x, r * S / 4); ctx.lineTo(x, (r + 1) * S / 4); ctx.stroke(); }
    }
  }, { repeat });
}

// Brushed/panelled metal for armor & architecture
export function metalTex(variant = 'panel') {
  return canvasTex(`metal-${variant}`, 256, (ctx, S) => {
    const n = makeNoise(S, 8, 11), streak = makeNoise(S, 64, 5);
    pixels(ctx, S, (x, y) => { const v = 175 + n(x, y) * 50 + (streak(x, (y * 0.05) | 0) - 0.5) * 30; return [v, v, v]; });
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2;
    if (variant === 'panel') {
      ctx.strokeRect(4, 4, S - 8, S / 2 - 6); ctx.strokeRect(4, S / 2 + 2, S / 2 - 6, S / 2 - 6); ctx.strokeRect(S / 2 + 2, S / 2 + 2, S / 2 - 6, S / 2 - 6);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      for (const [x, y] of [[12, 12], [S - 12, 12], [12, S / 2 - 10], [S - 12, S / 2 - 10]]) { ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
    } else if (variant === 'hex') {
      const r = S / 8;
      for (let row = 0; row < 6; row++) for (let col = 0; col < 6; col++) {
        const cx = col * r * 1.5, cy = row * r * 1.73 + (col % 2) * r * 0.866;
        ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } ctx.stroke();
      }
    }
  });
}

// Cloth weave for robes / capes
export function clothTex() {
  return canvasTex('cloth', 256, (ctx, S) => {
    const n = makeNoise(S, 8, 21);
    pixels(ctx, S, (x, y) => { const w = ((x % 4 < 2) ^ (y % 4 < 2)) ? 12 : -12; const v = 190 + w + n(x, y) * 50; return [v, v, v]; });
  });
}

// Organic hide / chitin for monsters
export function hideTex() {
  return canvasTex('hide', 256, (ctx, S) => {
    const n = makeNoise(S, 6, 31), c = makeNoise(S, 24, 41);
    pixels(ctx, S, (x, y) => { const cell = Math.abs(c(x, y) - 0.5) < 0.04 ? 0.55 : 1; const v = (150 + n(x, y) * 100) * cell; return [v, v, v]; });
  });
}

// Bark & rock
export function barkTex() {
  return canvasTex('bark', 256, (ctx, S) => {
    const n = makeNoise(S, 4, 51);
    pixels(ctx, S, (x, y) => { const v = 70 + n(x * 6 % S, y * 0.5) * 90; return [v * 1.1, v * 0.85, v * 0.6]; });
  });
}
export function rockTex() {
  return canvasTex('rock', 256, (ctx, S) => {
    const n = makeNoise(S, 6, 61), d = makeNoise(S, 32, 71);
    pixels(ctx, S, (x, y) => { const v = 95 + n(x, y) * 90 + (d(x, y) - 0.5) * 40; return [v, v * 0.97, v * 0.92]; });
  });
}

// Emissive window strips for sci-fi buildings
export function windowsTex(color) {
  return canvasTex(`win-${color}`, 256, (ctx, S) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
    for (let y = 8; y < S; y += 22) for (let x = 6; x < S; x += 18) {
      if (Math.random() < 0.35) continue;
      ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`; ctx.globalAlpha = 0.4 + Math.random() * 0.6;
      ctx.fillRect(x, y, 10, 8);
    }
    ctx.globalAlpha = 1;
  });
}

// Soft radial glow sprite for particles & projectiles
export function glowTex() {
  return canvasTex('glow', 128, (ctx, S) => {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.65)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  });
}

// Grass blade alpha (vertical gradient)
export function bladeTex() {
  return canvasTex('blade', 64, (ctx, S) => {
    const g = ctx.createLinearGradient(0, S, 0, 0);
    g.addColorStop(0, '#2a3a18'); g.addColorStop(1, '#a8b860');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  });
}
