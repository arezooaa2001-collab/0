// تولید بافت‌های رویه‌ای (بدون فایل خارجی) روی بوم
import * as THREE from 'three';
import { mulberry32 } from './util.js';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// نویز مقداری قابل تکرار (tileable)
function makeNoise(period, seed) {
  const rng = mulberry32(seed);
  const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % period) + period) % period, y0 = ((yi % period) + period) % period;
    const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    const a = g[y0 * period + x0], b = g[y0 * period + x1], c = g[y1 * period + x0], d = g[y1 * period + x1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbmField(size, basePeriod, octaves, seed) {
  const out = new Float32Array(size * size);
  const noises = [];
  for (let o = 0; o < octaves; o++) noises.push(makeNoise(basePeriod << o, seed + o * 101));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let amp = 0.5, sum = 0, norm = 0;
      for (let o = 0; o < octaves; o++) {
        const p = basePeriod << o;
        sum += noises[o]((x / size) * p, (y / size) * p) * amp;
        norm += amp;
        amp *= 0.5;
      }
      out[y * size + x] = sum / norm;
    }
  }
  return out;
}

function toTexture(c, { srgb = true, repeat = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

function heightToNormal(height, size, strength) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xl = (x - 1 + size) % size, xr = (x + 1) % size;
      const yu = (y - 1 + size) % size, yd = (y + 1) % size;
      const dx = (height[y * size + xr] - height[y * size + xl]) * strength;
      const dy = (height[yd * size + x] - height[yu * size + x]) * strength;
      let nx = -dx, ny = dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * size + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function grayToCanvas(field, size, fn) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < size * size; i++) {
    const [r, g, b] = fn(field[i], i);
    d[i * 4] = r;
    d[i * 4 + 1] = g;
    d[i * 4 + 2] = b;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// سطح سکوها: کاشی با درز + خش و لک
export function makeSurfaceSet(kind = 'tiles', size = 512, seed = 7) {
  const n = fbmField(size, 8, 5, seed);
  const n2 = fbmField(size, 32, 3, seed + 50);
  const h = new Float32Array(size * size);
  const alb = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const rng = mulberry32(seed * 3 + 1);
  const tiles = kind === 'metal' ? 2 : 4;
  const cell = size / tiles;
  const tileTint = [];
  for (let i = 0; i < tiles * tiles; i++) tileTint.push(0.9 + rng() * 0.12);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const tx = Math.floor(x / cell), ty = Math.floor(y / cell);
      const fx = (x % cell) / cell, fy = (y % cell) / cell;
      const edge = Math.min(fx, fy, 1 - fx, 1 - fy);
      let height = 1, a = 1, r = 0.7;
      if (kind === 'tiles') {
        const groove = Math.min(1, edge / 0.03);
        height = groove * (0.85 + n2[i] * 0.15);
        a = (0.55 + groove * 0.45) * tileTint[ty * tiles + tx] * (0.82 + n[i] * 0.3);
        r = 0.55 + n[i] * 0.35 + (1 - groove) * 0.2;
      } else if (kind === 'metal') {
        const groove = Math.min(1, edge / 0.015);
        // پرچ‌ها
        const rx = Math.min(fx, 1 - fx), ry = Math.min(fy, 1 - fy);
        const rivet = Math.hypot(rx - 0.06, ry - 0.06) < 0.025 ? 1 : 0;
        // خطوط برس‌خورده
        const brushed = (Math.sin(y * 0.9 + n2[i] * 6) * 0.5 + 0.5) * 0.06;
        height = groove * 0.9 + rivet * 0.15 + brushed;
        a = (0.7 + groove * 0.3) * (0.88 + n[i] * 0.2) + rivet * 0.1;
        r = 0.3 + n[i] * 0.35 + brushed;
      } else {
        // بتن/سنگ
        height = n[i] * 0.7 + n2[i] * 0.3;
        a = 0.78 + n[i] * 0.3 - (n2[i] > 0.72 ? 0.12 : 0);
        r = 0.75 + n2[i] * 0.2;
      }
      h[i] = height;
      alb[i] = Math.min(1, a);
      rough[i] = Math.min(1, Math.max(0.05, r));
    }
  }
  const map = toTexture(grayToCanvas(alb, size, (v) => [v * 255, v * 255, v * 255]));
  const normalMap = toTexture(heightToNormal(h, size, kind === 'metal' ? 6 : 4), { srgb: false });
  const roughnessMap = toTexture(grayToCanvas(rough, size, (v) => [v * 255, v * 255, v * 255]), { srgb: false });
  return { map, normalMap, roughnessMap };
}

// نمای ساختمان: پنجره‌ها + نقشهٔ روشنایی پنجره‌ها
export function makeFacade(size = 512, seed = 11) {
  const rng = mulberry32(seed);
  const c = canvas(size), e = canvas(size);
  const ctx = c.getContext('2d'), ectx = e.getContext('2d');
  ctx.fillStyle = '#8a8f99';
  ctx.fillRect(0, 0, size, size);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, size, size);
  const cols = 8, rows = 16;
  const cw = size / cols, rh = size / rows;
  for (let r = 0; r < rows; r++) {
    // نوار طبقات
    ctx.fillStyle = 'rgba(40,44,54,0.5)';
    ctx.fillRect(0, r * rh + rh * 0.82, size, rh * 0.18);
    for (let col = 0; col < cols; col++) {
      const x = col * cw + cw * 0.14, y = r * rh + rh * 0.12;
      const w = cw * 0.72, hh = rh * 0.62;
      const g = ctx.createLinearGradient(x, y, x + w, y + hh);
      g.addColorStop(0, '#2b3445');
      g.addColorStop(1, '#151b26');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, hh);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x, y, w, hh * 0.18);
      if (rng() < 0.42) {
        const warm = rng() < 0.7;
        const b = 0.5 + rng() * 0.5;
        ectx.fillStyle = warm ? `rgba(255,${190 + rng() * 40 | 0},${120 + rng() * 60 | 0},${b})` : `rgba(${150 + rng() * 60 | 0},${210 + rng() * 40 | 0},255,${b})`;
        ectx.fillRect(x + 1, y + 1, w - 2, hh - 2);
      }
    }
  }
  return { map: toTexture(c), emissiveMap: toTexture(e) };
}

export function makeRock(size = 256, seed = 21) {
  const n = fbmField(size, 4, 6, seed);
  const strata = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      strata[i] = n[i] * 0.6 + (Math.sin((y / size) * 40 + n[i] * 8) * 0.5 + 0.5) * 0.4;
    }
  const map = toTexture(grayToCanvas(strata, size, (v) => [v * 220 + 30, v * 210 + 28, v * 200 + 26]));
  const normalMap = toTexture(heightToNormal(strata, size, 5), { srgb: false });
  return { map, normalMap };
}

export function makeStripes(c1 = '#ffd23d', c2 = '#1b1b1f', size = 128) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = c2;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = c1;
  for (let i = -size; i < size * 2; i += size / 2) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size / 4, 0);
    ctx.lineTo(i + size / 4 - size, size);
    ctx.lineTo(i - size, size);
    ctx.fill();
  }
  return toTexture(c);
}

export function makeConveyor(size = 256) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1c1f26';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size; i += 8) {
    ctx.fillStyle = i % 16 ? '#252a33' : '#20242c';
    ctx.fillRect(0, i, size, 8);
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.06;
  ctx.lineCap = 'round';
  for (let k = 0; k < 2; k++) {
    const y = k * size * 0.5 + size * 0.15;
    ctx.beginPath();
    ctx.moveTo(size * 0.2, y + size * 0.22);
    ctx.lineTo(size * 0.5, y);
    ctx.lineTo(size * 0.8, y + size * 0.22);
    ctx.stroke();
  }
  return toTexture(c);
}

export function makeSprite(kind = 'soft', size = 128) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const m = size / 2;
  if (kind === 'soft') {
    const g = ctx.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  } else if (kind === 'star') {
    const g = ctx.createRadialGradient(m, m, 0, m, m, m * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'lighter';
    for (const [w, h] of [[size, size * 0.06], [size * 0.06, size]]) {
      const lg = ctx.createRadialGradient(m, m, 0, m, m, m);
      lg.addColorStop(0, 'rgba(255,255,255,0.9)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(m - w / 2, m - h / 2, w, h);
    }
  } else if (kind === 'cloud') {
    const rng = mulberry32(5);
    for (let i = 0; i < 26; i++) {
      const x = m + (rng() - 0.5) * size * 0.55, y = m + (rng() - 0.5) * size * 0.3;
      const r = size * (0.12 + rng() * 0.2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
  } else if (kind === 'ring') {
    ctx.strokeStyle = '#fff';
    const g = ctx.createRadialGradient(m, m, m * 0.6, m, m, m);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.75, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  } else if (kind === 'blob') {
    const g = ctx.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, 'rgba(0,0,0,0.65)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// بافت پرچم/بنر خط پایان با متن فارسی
export function makeBanner(text, sub, colors = ['#ff7a3d', '#ff3d8b']) {
  const c = canvas(1024, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 1024, 0);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 256);
  // شطرنجی کناره‌ها
  for (let i = 0; i < 32; i++) {
    ctx.fillStyle = i % 2 ? '#111' : '#fff';
    ctx.fillRect(i * 32, 0, 32, 18);
    ctx.fillStyle = i % 2 ? '#fff' : '#111';
    ctx.fillRect(i * 32, 238, 32, 18);
  }
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.font = '900 110px Vazirmatn, Tahoma, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 12;
  ctx.fillText(text, 512, sub ? 112 : 128);
  if (sub) {
    ctx.font = '700 44px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText(sub, 512, 196);
  }
  return toTexture(c, { repeat: false });
}
