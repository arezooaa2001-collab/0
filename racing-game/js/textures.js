// تکسچرهای رویه‌ای (Procedural) ساخته‌شده با Canvas
import * as THREE from 'three';
import { mulberry32, clamp } from './utils.js';

export const TEX = { aniso: 8 };
const cache = new Map();
const FONT = "'Vazirmatn', 'Tahoma', sans-serif";

function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function toTex(c, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = TEX.aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}
function cached(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }

// نویز مقداری تکرارشونده (بدون درز)
function periodicNoise(size, cells, rng, octaves = 4) {
  const out = new Float32Array(size * size);
  let amp = 1, total = 0, c = cells;
  for (let o = 0; o < octaves; o++) {
    const g = new Float32Array(c * c);
    for (let i = 0; i < g.length; i++) g[i] = rng();
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * c, y0 = Math.floor(fy), ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * c, x0 = Math.floor(fx), tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const x1 = (x0 + 1) % c, y1 = (y0 + 1) % c, xa = x0 % c, ya = y0 % c;
        const a = g[ya * c + xa], b = g[ya * c + x1], d = g[y1 * c + xa], e = g[y1 * c + x1];
        out[y * size + x] += amp * ((a + (b - a) * sx) + ((d + (e - d) * sx) - (a + (b - a) * sx)) * sy);
      }
    }
    total += amp; amp *= 0.5; c *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function normalFromHeight(h, size, strength = 2) {
  const c = cv(size); const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
    const u = h[((y - 1 + size) % size) * size + x], d = h[((y + 1) % size) * size + x];
    let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * size + x) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return toTex(c, { srgb: false });
}

export function asphalt() {
  return cached('asphalt', () => {
    const S = 512, rng = mulberry32(77);
    const blot = periodicNoise(S, 8, rng, 5);
    const h = new Float32Array(S * S);
    const c = cv(S); const ctx = c.getContext('2d'); const img = ctx.createImageData(S, S);
    const rc = cv(S); const rctx = rc.getContext('2d'); const rimg = rctx.createImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      const grain = rng();
      const stone = grain > 0.93 ? 0.35 : grain < 0.05 ? -0.25 : 0;
      const v = 0.5 * blot[i] + 0.25 * grain + stone;
      h[i] = v;
      const base = 50 + v * 46;
      const k = i * 4;
      img.data[k] = base * 0.98; img.data[k + 1] = base * 0.99; img.data[k + 2] = base * 1.03; img.data[k + 3] = 255;
      const rough = clamp(170 + (grain - 0.5) * 90 - blot[i] * 40, 0, 255);
      rimg.data[k] = rough; rimg.data[k + 1] = rough; rimg.data[k + 2] = rough; rimg.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); rctx.putImageData(rimg, 0, 0);
    return { map: toTex(c), normal: normalFromHeight(h, S, 3.5), rough: toTex(rc, { srgb: false }) };
  });
}

export function grass() {
  return cached('grass', () => {
    const S = 512, rng = mulberry32(12);
    const c = cv(S); const ctx = c.getContext('2d');
    const n = periodicNoise(S, 6, rng, 5);
    const img = ctx.createImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      const v = n[i]; const k = i * 4;
      img.data[k] = 52 + v * 40; img.data[k + 1] = 98 + v * 55; img.data[k + 2] = 34 + v * 22; img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 16000; i++) {
      const x = rng() * S, y = rng() * S, len = 3 + rng() * 7, ang = -Math.PI / 2 + (rng() - 0.5) * 0.9;
      const g = 90 + rng() * 90;
      ctx.strokeStyle = `rgba(${g * 0.45 | 0},${g | 0},${g * 0.3 | 0},${0.35 + rng() * 0.4})`;
      ctx.lineWidth = 0.6 + rng() * 0.9;
      for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) {
        if (x + ox < -10 || x + ox > S + 10 || y + oy < -10 || y + oy > S + 10) continue;
        ctx.beginPath(); ctx.moveTo(x + ox, y + oy); ctx.lineTo(x + ox + Math.cos(ang) * len, y + oy + Math.sin(ang) * len); ctx.stroke();
      }
    }
    const h = new Float32Array(S * S);
    const d = ctx.getImageData(0, 0, S, S).data;
    for (let i = 0; i < S * S; i++) h[i] = d[i * 4 + 1] / 255;
    return { map: toTex(c), normal: normalFromHeight(h, S, 2.0) };
  });
}

export function macroNoise() {
  return cached('macro', () => {
    const S = 256, rng = mulberry32(5);
    const n = periodicNoise(S, 4, rng, 5);
    const c = cv(S); const ctx = c.getContext('2d'); const img = ctx.createImageData(S, S);
    for (let i = 0; i < S * S; i++) { const v = n[i] * 255; const k = i * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    return toTex(c, { srgb: false });
  });
}

export function gravel() {
  return cached('gravel', () => {
    const S = 512, rng = mulberry32(33);
    const c = cv(S); const ctx = c.getContext('2d');
    ctx.fillStyle = '#a8946e'; ctx.fillRect(0, 0, S, S);
    const h = new Float32Array(S * S);
    for (let i = 0; i < 9000; i++) {
      const x = rng() * S, y = rng() * S, r = 1.2 + rng() * 3.2;
      const l = 120 + rng() * 110;
      const col = `rgb(${l | 0},${(l * 0.9) | 0},${(l * 0.72) | 0})`;
      for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) {
        const px = x + ox, py = y + oy; if (px < -6 || px > S + 6 || py < -6 || py > S + 6) continue;
        const g = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, 0.2, px, py, r);
        g.addColorStop(0, '#f3ead6'); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(60,50,35,0.9)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py, r, r * (0.7 + rng() * 0.3), rng() * 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    const d = ctx.getImageData(0, 0, S, S).data;
    for (let i = 0; i < S * S; i++) h[i] = d[i * 4] / 255;
    return { map: toTex(c), normal: normalFromHeight(h, S, 3) };
  });
}

export function concrete() {
  return cached('concrete', () => {
    const S = 512, rng = mulberry32(91);
    const n = periodicNoise(S, 5, rng, 6);
    const c = cv(S); const ctx = c.getContext('2d'); const img = ctx.createImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      const v = 175 + (n[i] - 0.5) * 70 + (rng() - 0.5) * 18; const k = i * 4;
      img.data[k] = v; img.data[k + 1] = v * 0.99; img.data[k + 2] = v * 0.96; img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return toTex(c);
  });
}

export function garageFloor() {
  return cached('gfloor', () => {
    const S = 1024, rng = mulberry32(4);
    const n = periodicNoise(S, 6, rng, 6);
    const c = cv(S); const ctx = c.getContext('2d'); const img = ctx.createImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      const v = 46 + (n[i] - 0.5) * 30 + (rng() - 0.5) * 6; const k = i * 4;
      img.data[k] = v; img.data[k + 1] = v * 1.0; img.data[k + 2] = v * 1.06; img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * S / 4, 0); ctx.lineTo(i * S / 4, S); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * S / 4); ctx.lineTo(S, i * S / 4); ctx.stroke(); }
    return toTex(c);
  });
}

export function checker(n = 8, m = 2) {
  return cached('checker' + n + 'x' + m, () => {
    const c = cv(64 * n, 64 * m); const ctx = c.getContext('2d');
    for (let y = 0; y < m; y++) for (let x = 0; x < n; x++) { ctx.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; ctx.fillRect(x * 64, y * 64, 64, 64); }
    const t = toTex(c); t.magFilter = THREE.NearestFilter; return t;
  });
}

export function chainLink() {
  return cached('chain', () => {
    const S = 128; const c = cv(S); const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(210,215,220,1)'; ctx.lineWidth = 5;
    for (let i = -2; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * S / 2, 0); ctx.lineTo(i * S / 2 + S, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i * S / 2 + S, 0); ctx.lineTo(i * S / 2, S); ctx.stroke();
    }
    return toTex(c);
  });
}

export function softDot() {
  return cached('dot', () => {
    const S = 128; const c = cv(S); const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    return toTex(c, { repeat: false });
  });
}

export function smokePuff() {
  return cached('smoke', () => {
    const S = 128, rng = mulberry32(8); const c = cv(S); const ctx = c.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const x = S / 2 + (rng() - 0.5) * S * 0.4, y = S / 2 + (rng() - 0.5) * S * 0.4, r = S * (0.15 + rng() * 0.22);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    }
    return toTex(c, { repeat: false });
  });
}

const BRANDS = [
  { t: 'TURBO X', s: 'روغن موتور', bg: ['#0b1d4d', '#1749c9'], fg: '#ffd400' },
  { t: 'نوا', s: 'سوخت پرقدرت', bg: ['#d10f1f', '#ff5230'], fg: '#ffffff' },
  { t: 'ARIA TYRES', s: 'لاستیک مسابقه', bg: ['#111111', '#333333'], fg: '#ffcc00' },
  { t: 'سرعت', s: 'نوشیدنی انرژی‌زا', bg: ['#00a86b', '#00d18b'], fg: '#ffffff' },
  { t: 'PERSIS', s: 'ساعت‌های دقیق', bg: ['#f5f5f5', '#d9d9d9'], fg: '#0b1d4d' },
  { t: 'آذرخش', s: 'باتری و برق خودرو', bg: ['#5b1bb8', '#a43cff'], fg: '#fff27a' },
  { t: 'KAVIR', s: 'لوازم یدکی', bg: ['#ff8a00', '#ffb100'], fg: '#1b1b1b' },
  { t: 'ستاره', s: 'بیمه رانندگان', bg: ['#0f6f8f', '#15a6c9'], fg: '#ffffff' }
];
export const brandCount = BRANDS.length;

export function billboard(i) {
  return cached('bb' + i, () => {
    const b = BRANDS[i % BRANDS.length];
    const c = cv(1024, 256); const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 1024, 256); g.addColorStop(0, b.bg[0]); g.addColorStop(1, b.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.moveTo(k * 160 - 60, 256); ctx.lineTo(k * 160 + 40, 0); ctx.lineTo(k * 160 + 90, 0); ctx.lineTo(k * 160 - 10, 256); ctx.fill(); }
    ctx.fillStyle = b.fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 120px ${FONT}`; ctx.fillText(b.t, 512, 108);
    ctx.font = `600 46px ${FONT}`; ctx.globalAlpha = 0.9; ctx.fillText(b.s, 512, 205); ctx.globalAlpha = 1;
    ctx.strokeStyle = b.fg; ctx.lineWidth = 8; ctx.strokeRect(10, 10, 1004, 236);
    return toTex(c, { repeat: false });
  });
}

export function adWall() {
  return cached('adwall', () => {
    const W = 2048, H = 128; const c = cv(W, H); const ctx = c.getContext('2d');
    const n = 4;
    for (let k = 0; k < n; k++) {
      const b = BRANDS[(k * 3 + 1) % BRANDS.length];
      ctx.fillStyle = b.bg[1]; ctx.fillRect(k * W / n, 0, W / n, H);
      ctx.fillStyle = b.fg; ctx.font = `900 70px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.t, k * W / n + W / n / 2, H / 2 + 4);
    }
    const t = toTex(c); return t;
  });
}

export function banner(text, color, sub = '') {
  const c = cv(1024, 160); const ctx = c.getContext('2d');
  ctx.fillStyle = color; ctx.fillRect(0, 0, 1024, 160);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, 124, 1024, 36);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8;
  ctx.font = `900 72px ${FONT}`; ctx.fillText(text, 512, 66);
  if (sub) { ctx.font = `600 26px ${FONT}`; ctx.fillText(sub, 512, 142); }
  return toTex(c, { repeat: false });
}

export function fireBanner(text) {
  const c = cv(1024, 160); const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 1024, 0);
  g.addColorStop(0, '#ff1e1e'); g.addColorStop(0.5, '#ff7a00'); g.addColorStop(1, '#ffd400');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 160);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(120,0,0,0.7)'; ctx.shadowBlur = 10;
  ctx.font = `900 76px ${FONT}`; ctx.fillText(text, 512, 80);
  return toTex(c, { repeat: false });
}

export function roundel(num, ring = '#111') {
  const c = cv(256); const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(128, 128, 124, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 12; ctx.strokeStyle = ring; ctx.beginPath(); ctx.arc(128, 128, 116, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#111'; ctx.font = `900 150px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(num), 128, 140);
  const t = toTex(c, { repeat: false }); return t;
}

export function plate(text) {
  const c = cv(256, 64); const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2f2ee'; ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#1c3faa'; ctx.fillRect(0, 0, 34, 64);
  ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 252, 60);
  ctx.fillStyle = '#111'; ctx.font = `800 40px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 146, 36);
  return toTex(c, { repeat: false });
}

export function carbon() {
  return cached('carbon', () => {
    const S = 128; const c = cv(S); const ctx = c.getContext('2d');
    ctx.fillStyle = '#121214'; ctx.fillRect(0, 0, S, S);
    const s = 16;
    for (let y = 0; y < S / s; y++) for (let x = 0; x < S / s; x++) {
      const g = ctx.createLinearGradient(x * s, y * s, x * s + s, y * s + s);
      const flip = (x + y) % 2;
      g.addColorStop(0, flip ? '#2a2a30' : '#0b0b0d'); g.addColorStop(1, flip ? '#0b0b0d' : '#2a2a30');
      ctx.fillStyle = g; ctx.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
    }
    return toTex(c);
  });
}

export function gaugeFace(style = 'classic', label = 'km/h', max = 240) {
  return cached('gauge' + style + label + max, () => {
    const S = 256; const c = cv(S); const ctx = c.getContext('2d');
    const classic = style === 'classic';
    ctx.fillStyle = classic ? '#efe6cf' : '#0c0d10'; ctx.beginPath(); ctx.arc(128, 128, 126, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = classic ? '#222' : '#e8e8e8'; ctx.fillStyle = ctx.strokeStyle;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    for (let i = 0; i <= 40; i++) {
      const a = a0 + (a1 - a0) * i / 40; const big = i % 5 === 0;
      ctx.lineWidth = big ? 4 : 2;
      ctx.beginPath(); ctx.moveTo(128 + Math.cos(a) * (big ? 96 : 104), 128 + Math.sin(a) * (big ? 96 : 104)); ctx.lineTo(128 + Math.cos(a) * 114, 128 + Math.sin(a) * 114); ctx.stroke();
      if (big) { ctx.font = `700 18px ${FONT}`; ctx.fillText(String(Math.round(max * i / 40)), 128 + Math.cos(a) * 78, 128 + Math.sin(a) * 78); }
    }
    if (!classic) { ctx.strokeStyle = '#ff2a2a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(128, 128, 110, a0 + (a1 - a0) * 0.82, a1); ctx.stroke(); }
    ctx.font = `600 16px ${FONT}`; ctx.fillStyle = classic ? '#333' : '#aaa'; ctx.fillText(label, 128, 175);
    return toTex(c, { repeat: false });
  });
}

export function fireStripes() {
  return cached('fire', () => {
    const c = cv(64, 256); const ctx = c.getContext('2d');
    const cols = ['#ff1e1e', '#ff7a00', '#ffd400', '#ff7a00'];
    for (let i = 0; i < 8; i++) {
      const g = ctx.createLinearGradient(0, i * 32, 0, i * 32 + 32);
      g.addColorStop(0, cols[i % 4]); g.addColorStop(1, cols[(i + 1) % 4]);
      ctx.fillStyle = g; ctx.fillRect(0, i * 32, 64, 32);
    }
    return toTex(c);
  });
}

export function distanceBoard(n) {
  return cached('dist' + n, () => {
    const c = cv(256, 256); const ctx = c.getContext('2d');
    ctx.fillStyle = '#f7f7f7'; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 14; ctx.strokeRect(7, 7, 242, 242);
    ctx.fillStyle = '#111'; ctx.font = `900 120px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(n), 128, 136);
    return toTex(c, { repeat: false });
  });
}

export function fabric() {
  return cached('fabric', () => {
    const S = 256, rng = mulberry32(3); const h = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const wx = Math.sin(x * Math.PI / 2) * 0.5 + 0.5, wy = Math.sin(y * Math.PI / 2) * 0.5 + 0.5;
      h[y * S + x] = ((x >> 1) + (y >> 1)) % 2 ? wx : wy + rng() * 0.1;
    }
    return normalFromHeight(h, S, 1.2);
  });
}

export function signText(text, bg = '#101826', fg = '#ffffff', w = 1024, h = 256, size = 120) {
  const c = cv(w, h); const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${size}px ${FONT}`; ctx.fillText(text, w / 2, h / 2 + size * 0.06);
  return toTex(c, { repeat: false });
}

export function makeCanvasTexture(w, h) {
  const c = cv(w, h);
  const t = toTex(c, { repeat: false });
  return { canvas: c, ctx: c.getContext('2d'), tex: t };
}

export { FONT };

// ---------------- تکسچرهای شهر آزاد ----------------
export function cityRoad() {
  return cached('cityRoad', () => {
    const W = 512, H = 512; const c = cv(W, H); const ctx = c.getContext('2d');
    const base = asphalt().map.image; ctx.drawImage(base, 0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, 0, W, H);
    const px = (m) => (m / 16) * W;
    ctx.fillStyle = '#ecebe4'; ctx.fillRect(px(0.4), 0, px(0.18), H); ctx.fillRect(px(15.42), 0, px(0.18), H);
    ctx.fillStyle = '#f2c230'; ctx.fillRect(px(7.82), 0, px(0.14), H); ctx.fillRect(px(8.04), 0, px(0.14), H);
    ctx.fillStyle = '#ecebe4'; for (const x of [4, 12]) for (let y = 0; y < H; y += H / 4) ctx.fillRect(px(x - 0.08), y, px(0.16), H / 8);
    const t = toTex(c); return t;
  });
}
export function crosswalk() {
  return cached('crosswalk', () => { const c = cv(256, 64); const ctx = c.getContext('2d'); ctx.clearRect(0, 0, 256, 64); ctx.fillStyle = '#f1f0ea'; for (let i = 0; i < 8; i++) ctx.fillRect(i * 32 + 6, 0, 20, 64); return toTex(c); });
}
export function sidewalk() {
  return cached('sidewalk', () => {
    const S = 256, rng = mulberry32(21); const c = cv(S); const ctx = c.getContext('2d');
    ctx.drawImage(concrete().image, 0, 0, S, S);
    ctx.strokeStyle = 'rgba(60,60,60,0.45)'; ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * S / 4, 0); ctx.lineTo(i * S / 4, S); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * S / 4); ctx.lineTo(S, i * S / 4); ctx.stroke(); }
    for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(0,0,0,${rng() * 0.08})`; ctx.beginPath(); ctx.arc(rng() * S, rng() * S, rng() * 6, 0, 7); ctx.fill(); }
    return toTex(c);
  });
}
export function brick(color = '#a4492f') {
  return cached('brick' + color, () => {
    const S = 256, rng = mulberry32(31); const c = cv(S); const ctx = c.getContext('2d');
    ctx.fillStyle = '#c9c1b5'; ctx.fillRect(0, 0, S, S);
    const bh = S / 8, bw = S / 4; const base = new THREE.Color(color);
    for (let r = 0; r < 8; r++) for (let k = -1; k < 5; k++) {
      const x = k * bw + (r % 2 ? bw / 2 : 0); const v = 0.85 + rng() * 0.3; const cc = base.clone().multiplyScalar(v);
      ctx.fillStyle = '#' + cc.getHexString(); ctx.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
    }
    return toTex(c);
  });
}
export function plaster() {
  return cached('plaster', () => {
    const S = 256, rng = mulberry32(41); const n = periodicNoise(S, 6, rng, 5); const c = cv(S); const ctx = c.getContext('2d'); const img = ctx.createImageData(S, S);
    for (let i = 0; i < S * S; i++) { const v = 225 + (n[i] - 0.5) * 40 + (rng() - 0.5) * 10; img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0); return toTex(c);
  });
}
export function roofTiles(color = '#9c3b22') {
  return cached('roof' + color, () => {
    const S = 256, rng = mulberry32(51); const c = cv(S); const ctx = c.getContext('2d'); const base = new THREE.Color(color);
    ctx.fillStyle = '#' + base.clone().multiplyScalar(0.5).getHexString(); ctx.fillRect(0, 0, S, S);
    for (let r = 0; r < 10; r++) for (let k = -1; k < 9; k++) {
      const x = k * 32 + (r % 2 ? 16 : 0), y = r * 26; const v = 0.8 + rng() * 0.35;
      const g = ctx.createLinearGradient(0, y, 0, y + 26); g.addColorStop(0, '#' + base.clone().multiplyScalar(v * 1.15).getHexString()); g.addColorStop(1, '#' + base.clone().multiplyScalar(v * 0.7).getHexString());
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x + 1, y, 30, 28, [0, 0, 12, 12]); ctx.fill();
    }
    return toTex(c);
  });
}
export function woodFloor() {
  return cached('wood', () => {
    const S = 512, rng = mulberry32(61); const c = cv(S); const ctx = c.getContext('2d');
    for (let r = 0; r < 8; r++) for (let k = -1; k < 4; k++) {
      const x = k * 170 + (r % 2 ? 85 : 0), y = r * 64; const v = 0.75 + rng() * 0.35;
      ctx.fillStyle = `rgb(${150 * v | 0},${98 * v | 0},${58 * v | 0})`; ctx.fillRect(x, y, 168, 62);
      for (let l = 0; l < 14; l++) { ctx.strokeStyle = `rgba(60,30,10,${0.08 + rng() * 0.12})`; ctx.lineWidth = 1; ctx.beginPath(); const yy = y + rng() * 62; ctx.moveTo(x, yy); ctx.bezierCurveTo(x + 50, yy + rng() * 6 - 3, x + 110, yy + rng() * 6 - 3, x + 168, yy); ctx.stroke(); }
    }
    return toTex(c);
  });
}
export function tiles(color = '#e8e4dc', size = 8) {
  return cached('tiles' + color + size, () => {
    const S = 256; const c = cv(S); const ctx = c.getContext('2d');
    ctx.fillStyle = '#9a9a9a'; ctx.fillRect(0, 0, S, S);
    const t = S / size; const base = new THREE.Color(color); const rng = mulberry32(71);
    for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) { ctx.fillStyle = '#' + base.clone().multiplyScalar(0.94 + rng() * 0.08).getHexString(); ctx.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3); }
    return toTex(c);
  });
}
export function facade(color = '#8aa0b8', night = false) {
  return cached('facade' + color + night, () => {
    const W = 256, H = 512, rng = mulberry32(81); const c = cv(W, H); const ctx = c.getContext('2d');
    ctx.fillStyle = night ? '#000' : color; ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < 8; r++) for (let k = 0; k < 4; k++) {
      const x = k * 64 + 10, y = r * 64 + 12; const lit = rng() < 0.45;
      if (night) { ctx.fillStyle = lit ? `rgba(255,${200 + rng() * 40 | 0},${120 + rng() * 60 | 0},1)` : '#000'; }
      else { const g = ctx.createLinearGradient(x, y, x + 44, y + 44); g.addColorStop(0, '#9fc3dd'); g.addColorStop(1, '#2d4a63'); ctx.fillStyle = g; }
      ctx.fillRect(x, y, 44, 42);
      if (!night) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, 44, 4); }
    }
    return toTex(c);
  });
}
export function painting(seed = 1) {
  return cached('paint' + seed, () => {
    const c = cv(256, 192); const ctx = c.getContext('2d'); const rng = mulberry32(seed * 13 + 5);
    const g = ctx.createLinearGradient(0, 0, 0, 192); g.addColorStop(0, `hsl(${rng() * 360},60%,70%)`); g.addColorStop(1, `hsl(${rng() * 360},55%,40%)`); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 192);
    for (let i = 0; i < 9; i++) { ctx.fillStyle = `hsla(${rng() * 360},70%,${40 + rng() * 40}%,0.85)`; ctx.beginPath(); ctx.arc(rng() * 256, rng() * 192, 10 + rng() * 50, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(30,60,30,0.8)'; ctx.beginPath(); ctx.moveTo(0, 150); for (let x = 0; x <= 256; x += 16) ctx.lineTo(x, 130 + Math.sin(x * 0.05 + seed) * 18); ctx.lineTo(256, 192); ctx.lineTo(0, 192); ctx.fill();
    return toTex(c, { repeat: false });
  });
}
export function stripes(a = '#e3141c', b = '#ffffff', n = 12) {
  return cached('stripes' + a + b + n, () => { const c = cv(512, 64); const ctx = c.getContext('2d'); for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? b : a; ctx.fillRect(i * 512 / n, 0, 512 / n + 1, 64); } return toTex(c); });
}

// نقشه زبری/فلزی نما: شیشه‌ها براق و بازتابنده، دیوار مات
export function facadeMR() {
  return cached('facadeMR', () => {
    const W = 256, H = 512; const c = cv(W, H); const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgb(0,220,25)'; ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < 8; r++) for (let k = 0; k < 4; k++) { ctx.fillStyle = 'rgb(0,20,230)'; ctx.fillRect(k * 64 + 10, r * 64 + 12, 44, 42); }
    return toTex(c, { srgb: false });
  });
}
// نقشه نرمال آب برای موج‌های ریز متحرک
export function waterNormal() {
  return cached('waterN', () => { const S = 256; const h = periodicNoise(S, 8, mulberry32(91), 4); return normalFromHeight(h, S, 4); });
}
