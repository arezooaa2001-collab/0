// Shared math / helpers
import * as THREE from 'three';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const smooth = (t) => t * t * (3 - 2 * t);
// frame-rate independent exponential smoothing
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const dampAngle = (a, b, lambda, dt) => a + angDiff(a, b) * (1 - Math.exp(-lambda * dt));
export const angDiff = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

// Deterministic RNG (mulberry32)
export function rng(seed) {
  let a = seed >>> 0;
  const f = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + f() * (hi - lo);
  f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const tmpV = [0, 1, 2, 3, 4, 5, 6, 7].map(() => new THREE.Vector3());
export const UP = new THREE.Vector3(0, 1, 0);

export function fmtTime(sec) {
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60), cs = Math.floor((sec * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// Rotate a vector towards another (unit vectors) by maxAngle radians (around up axis projection)
export function rotateTowards(out, from, to, maxAngle) {
  const dot = clamp(from.dot(to), -1, 1);
  const ang = Math.acos(dot);
  if (ang < 1e-5 || ang <= maxAngle) return out.copy(to);
  const t = maxAngle / ang;
  // slerp between unit vectors
  const s = Math.sin(ang);
  const a = Math.sin((1 - t) * ang) / s, b = Math.sin(t * ang) / s;
  out.set(from.x * a + to.x * b, from.y * a + to.y * b, from.z * a + to.z * b);
  if (!isFinite(out.x) || out.lengthSq() < 1e-8) out.copy(to);
  return out.normalize();
}

export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = opts.aniso || 1;
  return t;
}

export function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
