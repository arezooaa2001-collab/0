// Procedurally generated textures (no image assets needed). Results are cached per size.

import * as THREE from 'three';
import { RNG, fbm2D, clamp } from '../core/utils.js';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finish(tex, { srgb = true, repeat = true, aniso = 1, mips = true } = {}) {
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = aniso;
  tex.generateMipmaps = mips;
  tex.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

export function disposeTextureCache() {
  for (const v of cache.values()) {
    if (v && v.isTexture) v.dispose();
    else if (v && typeof v === 'object') for (const t of Object.values(v)) if (t && t.isTexture) t.dispose();
  }
  cache.clear();
}

/** Tileable grayscale fbm noise values in [0,1] (size <= 512 for speed). */
function noiseData(size, seed, cells, octaves, contrast = 1) {
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = fbm2D((x / size) * cells, (y / size) * cells, octaves, seed, cells);
      out[y * size + x] = clamp((v - 0.5) * contrast + 0.5, 0, 1);
    }
  }
  return { data: out, w: size, h: size };
}

function noiseCanvas(size, seed, cells, octaves, contrast = 1) {
  const nd = noiseData(size, seed, cells, octaves, contrast);
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const b = nd.data[i] * 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  c.noise = nd;
  return c;
}

/** Converts height values ({data,w,h} in 0..1, tileable) into a tangent-space normal map canvas. */
function heightToNormal(hd, strength) {
  const { data, w, h } = hd;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const out = ctx.createImageData(w, h);
  const H = (x, y) => data[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

/** Noise + per-pixel grain + specks, written straight into ImageData (no read-backs). */
function grainTile(size, seed, base, amount, speckChance, speckAmount) {
  const n = noiseCanvas(Math.min(size, 256), seed, 8, 5, 1.6);
  const nd = n.noise;
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const rng = new RNG(seed * 7 + 1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const nv = nd.data[(y % nd.h) * nd.w + (x % nd.w)] - 0.5;
      let l = nv * amount + (rng.next() - 0.5) * amount * 0.35;
      if (rng.next() < speckChance) l += (rng.next() < 0.5 ? -1 : 1) * speckAmount;
      d[i * 4] = clamp(base[0] + l, 0, 255);
      d[i * 4 + 1] = clamp(base[1] + l, 0, 255);
      d[i * 4 + 2] = clamp(base[2] + l, 0, 255);
      d[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { color: c, height: n };
}

/**
 * Asphalt with lane paint. Canvas x = across the road (u), y = along the road (v).
 * One texture tile spans the road width and ~20 m of length. Fine detail comes from a small
 * tile repeated as a pattern (fast to generate even for 4K textures); the normal/roughness
 * maps are tile-sized and repeated with their own texture transform.
 */
export function roadTextures(size, opts = {}) {
  const { aniso = 1, normals = false, theme = 'meadow' } = opts;
  return cached(`road:${size}:${normals}:${theme}:${aniso}`, () => {
    const W = Math.max(128, size / 2), Hh = size;
    const rng = new RNG(1234);
    const color = canvas(W, Hh);
    const ctx = color.getContext('2d');
    const base = theme === 'desert' ? [92, 86, 80] : theme === 'city' ? [52, 54, 60] : theme === 'snow' ? [70, 72, 78] : [64, 64, 68];
    const tile = Math.min(256, Math.max(64, size / 8));
    const g = grainTile(tile, 7, base, 34, 0.04, 34);
    ctx.fillStyle = ctx.createPattern(g.color, 'repeat');
    ctx.fillRect(0, 0, W, Hh);
    // rubbered-in racing lines (darker, smoother)
    for (const lane of [0.3, 0.7]) {
      const gr = ctx.createLinearGradient((lane - 0.12) * W, 0, (lane + 0.12) * W, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(0.5, 'rgba(10,10,12,0.16)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect((lane - 0.12) * W, 0, 0.24 * W, Hh);
    }
    // patches / repairs
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = `rgba(${rng.next() < 0.5 ? '20,20,22' : '110,110,112'},0.12)`;
      ctx.fillRect(rng.range(0.1, 0.7) * W, rng.next() * Hh, rng.range(0.08, 0.25) * W, rng.range(0.03, 0.12) * Hh);
    }
    // cracks (only on larger textures)
    if (size >= 1024) {
      ctx.strokeStyle = 'rgba(15,15,15,0.5)';
      for (let i = 0; i < 10; i++) {
        let x = rng.next() * W, y = rng.next() * Hh;
        ctx.lineWidth = rng.range(0.6, 1.4) * (size / 1024);
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 8; k++) {
          x += rng.range(-12, 12) * (size / 1024);
          y += rng.range(-14, 14) * (size / 1024);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    // paint: edge lines + dashed centre line
    ctx.fillStyle = 'rgba(240,240,240,0.95)';
    ctx.fillRect(0.035 * W, 0, 0.022 * W, Hh);
    ctx.fillRect((1 - 0.057) * W, 0, 0.022 * W, Hh);
    ctx.fillStyle = theme === 'city' ? 'rgba(245,214,90,0.95)' : 'rgba(236,236,236,0.95)';
    for (let k = 0; k < 2; k++) ctx.fillRect(0.4925 * W, (k * 0.5 + 0.05) * Hh, 0.015 * W, 0.25 * Hh);

    const map = finish(new THREE.CanvasTexture(color), { aniso });
    const res = { map };
    if (normals) {
      const reps = new THREE.Vector2(W / tile, Hh / tile);
      res.normalMap = finish(new THREE.CanvasTexture(heightToNormal(g.height.noise, 2.4)), { srgb: false, aniso });
      res.normalMap.repeat.copy(reps).multiplyScalar(tile / g.height.width);
      const rough = canvas(g.height.width, g.height.width);
      const rctx = rough.getContext('2d');
      rctx.fillStyle = 'rgb(0,210,0)';
      rctx.fillRect(0, 0, rough.width, rough.height);
      rctx.globalCompositeOperation = 'multiply';
      rctx.drawImage(g.height, 0, 0);
      rctx.globalCompositeOperation = 'source-over';
      rctx.fillStyle = 'rgba(0,200,0,0.55)';
      rctx.fillRect(0, 0, rough.width, rough.height);
      res.roughnessMap = finish(new THREE.CanvasTexture(rough), { srgb: false, aniso });
      res.roughnessMap.repeat.copy(res.normalMap.repeat);
    }
    return res;
  });
}

const GROUND = {
  grass: { base: [74, 112, 46], amount: 46, speck: 0.08, streak: true },
  forest: { base: [62, 82, 38], amount: 42, speck: 0.08, streak: true },
  sand: { base: [212, 178, 124], amount: 30, speck: 0.05, streak: false },
  snow: { base: [236, 240, 246], amount: 14, speck: 0.03, streak: false },
  dirt: { base: [128, 102, 72], amount: 34, speck: 0.06, streak: false },
  concrete: { base: [92, 94, 100], amount: 22, speck: 0.05, streak: false },
};

export function groundTexture(type, size, aniso = 1) {
  return cached(`ground:${type}:${size}:${aniso}`, () => {
    const g = GROUND[type] || GROUND.grass;
    const S = Math.min(1024, size);
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    const t = grainTile(Math.min(S, 512), 31 + type.length, g.base, g.amount, g.speck, g.amount * 0.9);
    ctx.fillStyle = ctx.createPattern(t.color, 'repeat');
    ctx.fillRect(0, 0, S, S);
    // large-scale colour variation so the repetition is less visible
    const big = noiseCanvas(64, 5 + type.length, 3, 3, 1.3);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.35;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(big, 0, 0, S, S);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (g.streak) {
      // short grass-blade strokes
      const rng = new RNG(3);
      ctx.lineWidth = Math.max(1, S / 512);
      for (let i = 0; i < 1600; i++) {
        const x = rng.next() * S, y = rng.next() * S;
        ctx.strokeStyle = rng.next() < 0.5 ? 'rgba(20,40,10,0.35)' : 'rgba(150,190,90,0.3)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + rng.range(-2, 2), y - rng.range(3, 7) * (S / 512));
        ctx.stroke();
      }
    }
    return finish(new THREE.CanvasTexture(c), { aniso });
  });
}

export function curbTexture() {
  return cached('curb', () => {
    const c = canvas(64, 256);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#f2f2f2' : '#d81e1e';
      ctx.fillRect(0, i * 64, 64, 64);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 0, 6, 256);
    return finish(new THREE.CanvasTexture(c));
  });
}

export function checkerTexture() {
  return cached('checker', () => {
    const c = canvas(256, 64);
    const ctx = c.getContext('2d');
    const n = 16, m = 4;
    for (let x = 0; x < n; x++) for (let y = 0; y < m; y++) {
      ctx.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4';
      ctx.fillRect((x * 256) / n, (y * 64) / m, 256 / n, 64 / m);
    }
    return finish(new THREE.CanvasTexture(c), { repeat: false });
  });
}

export function wallTexture(style) {
  return cached(`wall:${style}`, () => {
    const c = canvas(512, 64);
    const ctx = c.getContext('2d');
    if (style === 'concrete') {
      ctx.fillStyle = '#b9bcc2';
      ctx.fillRect(0, 0, 512, 64);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#d22' : '#f3f3f3';
        ctx.fillRect(i * 128, 40, 128, 24);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 0; i < 4; i++) ctx.fillRect(i * 128, 0, 2, 64);
    } else {
      // guard rail (armco) with blue/white sponsor band
      const g = ctx.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, '#e7ecf2');
      g.addColorStop(0.3, '#9aa4b0');
      g.addColorStop(0.5, '#f0f4f8');
      g.addColorStop(0.7, '#8994a1');
      g.addColorStop(1, '#cfd6de');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 64);
      ctx.fillStyle = 'rgba(30,30,40,0.35)';
      for (let i = 0; i < 8; i++) ctx.fillRect(i * 64 + 30, 26, 4, 12);
    }
    return finish(new THREE.CanvasTexture(c));
  });
}

/** Banner / billboard texture with Persian text (canvas handles RTL shaping). */
export function bannerTexture(text, sub = '', bg = '#e11d48', fg = '#ffffff', w = 1024, h = 256) {
  return cached(`banner:${text}:${sub}:${bg}:${fg}:${w}`, () => {
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, bg);
    g.addColorStop(1, shade(bg, -40));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 12; i++) ctx.fillRect(i * (w / 12), 0, w / 24, h);
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fg;
    ctx.font = `900 ${Math.round(h * (sub ? 0.46 : 0.6))}px Vazirmatn, Tahoma, sans-serif`;
    ctx.fillText(text, w / 2, h * (sub ? 0.4 : 0.52));
    if (sub) {
      ctx.font = `700 ${Math.round(h * 0.2)}px Vazirmatn, Tahoma, sans-serif`;
      ctx.fillText(sub, w / 2, h * 0.8);
    }
    return finish(new THREE.CanvasTexture(c), { repeat: false });
  });
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}

export function radialTexture(key, stops, size = 128) {
  return cached(`radial:${key}:${size}`, () => {
    const c = canvas(size, size);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, col] of stops) g.addColorStop(o, col);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return finish(new THREE.CanvasTexture(c), { repeat: false });
  });
}

export const blobShadowTexture = () =>
  radialTexture('blob', [[0, 'rgba(0,0,0,0.85)'], [0.45, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']], 128);

export const glowTexture = () =>
  radialTexture('glow', [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.65)'], [0.5, 'rgba(255,255,255,0.15)'], [1, 'rgba(255,255,255,0)']], 128);

export function smokeTexture() {
  return cached('smoke', () => {
    const S = 128;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x / S - 0.5, dy = y / S - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const n = fbm2D(x / 22, y / 22, 4, 5);
      const a = clamp((1 - r) * 1.4, 0, 1) ** 1.6 * (0.55 + 0.45 * n);
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
    ctx.putImageData(img, 0, 0);
    return finish(new THREE.CanvasTexture(c), { repeat: false });
  });
}

/** Animated-water normal map (tileable). */
export function waterNormalTexture() {
  return cached('waternormal', () => {
    const n = noiseCanvas(256, 77, 8, 4, 1.2);
    return finish(new THREE.CanvasTexture(heightToNormal(n.noise, 3)), { srgb: false });
  });
}

/** Number plate / small decal with Persian text. */
export function plateTexture(text) {
  return cached(`plate:${text}`, () => {
    const c = canvas(256, 64);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#1f3fae';
    ctx.fillRect(0, 0, 34, 64);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 60);
    ctx.fillStyle = '#111';
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 38px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText(text, 145, 34);
    return finish(new THREE.CanvasTexture(c), { repeat: false });
  });
}
