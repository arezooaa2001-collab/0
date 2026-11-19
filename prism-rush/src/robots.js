// robots.js — Prism Rush: the Iron Regent robot army and bosses.
// Procedural Three.js models (primitives + small generated CanvasTextures only) with
// procedural animation hooks. Conventions: 1 unit = 1 m, +Y up, models face +Z,
// origin at the ground contact point (flying robots / regent: origin at body centre).
import * as THREE from 'three';

export const ROBOT_TYPES = ['crawler', 'drone', 'roller', 'heavy', 'shield', 'stealth', 'sniper', 'turret', 'jumper', 'miniboss'];

/* =====================================================================================
 * Math helpers
 * ===================================================================================== */
const TAU = Math.PI * 2, PI = Math.PI, HP = Math.PI / 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const clamp01 = (x) => clamp(x, 0, 1);
const fin = (x, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const damp = (c, t, rate, dt) => c + (t - c) * (1 - Math.exp(-rate * dt));
const wrapPi = (a) => { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const _e1 = new THREE.Euler();
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const WHITE = new THREE.Color(1, 1, 1);
const _gaitOut = [0, 0];

/* =====================================================================================
 * Geometry helpers
 * ===================================================================================== */
function ensureIndex(g) {
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  return g;
}
function flipWinding(g) {
  ensureIndex(g);
  const a = g.index.array;
  for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
  g.index.needsUpdate = true;
  return g;
}
// transform geometry: p = [x,y,z], r = [rx,ry,rz] (Euler XYZ), s = number | [sx,sy,sz]
function xf(g, p, r, s) {
  _v1.set(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0);
  _q1.setFromEuler(_e1.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0));
  if (s === undefined || s === 0) _v2.set(1, 1, 1); else if (typeof s === 'number') _v2.set(s, s, s); else _v2.set(s[0], s[1], s[2]);
  _m1.compose(_v1, _q1, _v2);
  g.applyMatrix4(_m1);
  if (_v2.x * _v2.y * _v2.z < 0) flipWinding(g);
  return g;
}
const dist3 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
// geometry built along +Y and centred at origin -> spans a..b
function along(g, a, b) {
  _v3.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const L = _v3.length() || 1; _v3.divideScalar(L);
  _q1.setFromUnitVectors(UP, _v3);
  _m1.compose(_v1.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q1, _v2.set(1, 1, 1));
  return g.applyMatrix4(_m1);
}
// geometry pointing +Y (centred) -> base at `base`, pointing along `dir`
function coneAt(g, h, base, dir) {
  g.translate(0, h / 2, 0);
  _v3.set(dir[0], dir[1], dir[2]).normalize();
  _q1.setFromUnitVectors(UP, _v3);
  _m1.compose(_v1.set(base[0], base[1], base[2]), _q1, _v2.set(1, 1, 1));
  return g.applyMatrix4(_m1);
}
function merge(list) {
  list = list.filter(Boolean);
  if (list.length === 1) return list[0];
  let nv = 0, ni = 0;
  for (const g of list) {
    ensureIndex(g);
    if (!g.attributes.normal) g.computeVertexNormals();
    nv += g.attributes.position.count; ni += g.index.count;
  }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const idx = new (nv > 65535 ? Uint32Array : Uint16Array)(ni);
  let vo = 0, io = 0;
  for (const g of list) {
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, I = g.index;
    for (let i = 0; i < P.count; i++) {
      const o = (vo + i) * 3;
      pos[o] = P.getX(i); pos[o + 1] = P.getY(i); pos[o + 2] = P.getZ(i);
      nor[o] = N.getX(i); nor[o + 1] = N.getY(i); nor[o + 2] = N.getZ(i);
      if (U) { uv[(vo + i) * 2] = U.getX(i); uv[(vo + i) * 2 + 1] = U.getY(i); }
    }
    for (let i = 0; i < I.count; i++) idx[io + i] = I.getX(i) + vo;
    vo += P.count; io += I.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
// box-projected UVs in world units (consistent texel density on every part)
function planarUV(g, dens) {
  const P = g.attributes.position, N = g.attributes.normal;
  let U = g.attributes.uv;
  if (!U || U.itemSize !== 2) { U = new THREE.BufferAttribute(new Float32Array(P.count * 2), 2); g.setAttribute('uv', U); }
  for (let i = 0; i < P.count; i++) {
    const nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    let u, v;
    if (ax >= ay && ax >= az) { u = P.getZ(i) * (nx < 0 ? 1 : -1); v = P.getY(i); }
    else if (ay >= az) { u = P.getX(i); v = P.getZ(i) * (ny < 0 ? 1 : -1); }
    else { u = P.getX(i) * (nz < 0 ? -1 : 1); v = P.getY(i); }
    U.setXY(i, u * dens, v * dens);
  }
  U.needsUpdate = true;
  return g;
}
function uvMul(g, su, sv) {
  const U = g.attributes.uv;
  for (let i = 0; i < U.count; i++) U.setXY(i, U.getX(i) * su, U.getY(i) * sv);
  return g;
}
// Rounded box: subdivided box whose edge vertices are projected onto rounded edges.
function roundedBox(w, h, d, r, k) {
  r = Math.min(r, w * 0.5, h * 0.5, d * 0.5) * 0.999;
  if (k <= 0 || r <= 0.002) return new THREE.BoxGeometry(w, h, d);
  const S = 2 * k + 2, edge = 1 / S, zone = 0.5 - edge;
  const g = new THREE.BoxGeometry(1, 1, 1, S, S, S);
  const P = g.attributes.position, N = g.attributes.normal;
  const H = [w / 2, h / 2, d / 2], c = [0, 0, 0], inn = [0, 0, 0];
  for (let i = 0; i < P.count; i++) {
    const u0 = P.getX(i), u1 = P.getY(i), u2 = P.getZ(i);
    for (let a = 0; a < 3; a++) {
      const uu = a === 0 ? u0 : a === 1 ? u1 : u2;
      const au = Math.abs(uu), sg = uu < 0 ? -1 : 1, Hi = H[a] - r;
      const v = au <= edge + 1e-6 ? (au / edge) * Hi : Hi + r * Math.tan(((au - edge) / zone) * (PI / 4));
      c[a] = v * sg; inn[a] = clamp(c[a], -Hi, Hi);
    }
    let nx = c[0] - inn[0], ny = c[1] - inn[1], nz = c[2] - inn[2];
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    P.setXYZ(i, inn[0] + nx * r, inn[1] + ny * r, inn[2] + nz * r);
    N.setXYZ(i, nx, ny, nz);
  }
  return g;
}
// Box tapered along +Z (front scaled by fx, fy). mode 'bottom' keeps the bottom face flat.
function taperBox(w, h, d, fx, fy, r, k, mode) {
  const g = roundedBox(w, h, d, r, k);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const t = clamp01((P.getZ(i) + d / 2) / d);
    const sy = lerp(1, fy, t);
    let y = P.getY(i) * sy;
    if (mode === 'bottom') y -= (h / 2) * (1 - sy);
    P.setXYZ(i, P.getX(i) * lerp(1, fx, t), y, P.getZ(i));
  }
  g.computeVertexNormals();
  return g;
}
class Helix extends THREE.Curve {
  constructor(r, len, turns) { super(); this.r = r; this.len = len; this.turns = turns; }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * this.turns * TAU;
    return target.set(Math.cos(a) * this.r, -t * this.len, Math.sin(a) * this.r);
  }
}
// strip of quads between two point rows, oriented so faces point along normal n
function quadStrip(A, Bp, n) {
  const pos = [], nor = [], idx = [];
  for (let i = 0; i < A.length; i++) { pos.push(...A[i], ...Bp[i]); nor.push(n[0], n[1], n[2], n[0], n[1], n[2]); }
  for (let i = 0; i < A.length - 1; i++) {
    const a0 = i * 2, b0 = a0 + 1, a1 = a0 + 2, b1 = a0 + 3;
    _v1.fromArray(pos, a0 * 3); _v2.fromArray(pos, b0 * 3).sub(_v1); _v3.fromArray(pos, a1 * 3).sub(_v1);
    const ok = _v2.cross(_v3).dot(_v4.fromArray(n)) > 0;
    if (ok) idx.push(a0, b0, a1, b0, b1, a1); else idx.push(a0, a1, b0, b0, a1, b1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  g.setIndex(idx);
  return g;
}

function makeKit(qb) {
  const sm = [0.5, 1, 1.5][qb];
  const n = (b, min = 3) => Math.max(min, Math.round(b * sm));
  const rk = [0, 1, 2][qb];
  const K = {
    qb, n,
    box: (w, h, d, r = 0) => roundedBox(w, h, d, r, rk),
    tbox: (w, h, d, fx, fy, r = 0, mode) => taperBox(w, h, d, fx, fy, r, rk, mode),
    cyl: (rt, rb, h, rs = 16, open = false, ts = 0, tl = TAU) => new THREE.CylinderGeometry(rt, rb, h, n(rs), 1, open, ts, tl),
    prism: (rt, rb, h, sides, open = false) => new THREE.CylinderGeometry(rt, rb, h, sides, 1, open),
    sph: (r, ws = 16, hs = 12, ps = 0, pl = TAU, ts = 0, tl = PI) => new THREE.SphereGeometry(r, n(ws, 6), n(hs, 4), ps, pl, ts, tl),
    cap: (r, len, rs = 12) => new THREE.CapsuleGeometry(r, len, n(4, 2), n(rs, 6)),
    tor: (R, r, rs = 8, ts = 24, arc = TAU) => new THREE.TorusGeometry(R, r, n(rs, 3), n(ts, 6), arc),
    torN: (R, r, rs, ts, arc = TAU) => new THREE.TorusGeometry(R, r, rs, ts, arc),
    cone: (r, h, rs = 12) => new THREE.ConeGeometry(r, h, n(rs, 3)),
    coneN: (r, h, sides) => new THREE.ConeGeometry(r, h, sides),
    oct: (r) => new THREE.OctahedronGeometry(r, 0),
    lathe: (pts, segs = 16) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), n(segs, 5)),
    ext: (shape, depth, bevel = 0) => new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: bevel > 0 && qb > 0, bevelThickness: bevel, bevelSize: bevel * 0.8,
      bevelSegments: qb === 2 ? 3 : 1, curveSegments: n(6, 2),
    }),
    // cylinder from a (radius r0) to b (radius r1)
    rod: (a, b, r0, r1 = r0, rs = 10) => along(new THREE.CylinderGeometry(r1, r0, Math.max(1e-3, dist3(a, b)), n(rs)), a, b),
    capsule: (a, b, r, rs = 10) => along(new THREE.CapsuleGeometry(r, Math.max(1e-3, dist3(a, b)), n(3, 2), n(rs, 6)), a, b),
    coneAt: (r, h, base, dir, rs = 10) => coneAt(new THREE.ConeGeometry(r, h, n(rs, 3)), h, base, dir),
    spring: (r, len, turns, tube) => new THREE.TubeGeometry(new Helix(r, len, turns), n(56, 18), tube, n(6, 3), false),
  };
  return K;
}

/* =====================================================================================
 * Caches & generated textures
 * ===================================================================================== */
const geoCache = new Map();
const texCache = new Map();
const sharedMats = new Map();

function cachedGeo(key, fn) {
  let g = geoCache.get(key);
  if (!g) { g = fn(); g.userData.cached = true; if (!g.boundingSphere) g.computeBoundingSphere(); geoCache.set(key, g); }
  return g;
}
function qBucket(q) { q = clamp01(fin(q, 0.5)); return q < 0.25 ? 0 : q > 0.75 ? 2 : 1; }

function mkCanvas(w, h) {
  if (typeof document !== 'undefined' && document.createElement) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  return null;
}
function canvasTex(key, w, h, draw, opts = {}) {
  let t = texCache.get(key);
  if (t) return t;
  const c = mkCanvas(w, h);
  if (c) { draw(c.getContext('2d'), w, h); t = new THREE.CanvasTexture(c); }
  else { t = new THREE.DataTexture(new Uint8Array([200, 200, 200, 255]), 1, 1); t.needsUpdate = true; }
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  if (opts.mapping) t.mapping = opts.mapping;
  t.anisotropy = 4;
  t.name = 'robots:' + key;
  texCache.set(key, t);
  return t;
}
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function plateTex() {
  return canvasTex('plate', 256, 256, (ctx, w, h) => {
    const rnd = rng(1337);
    ctx.fillStyle = '#c9ccd2'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = (170 + rnd() * 70) | 0;
      ctx.fillStyle = `rgba(${v},${v},${v + 4},0.12)`;
      ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3);
    }
    const rects = [];
    const split = (x, y, rw, rh, dpt) => {
      if (dpt > 2 || (dpt > 0 && rnd() < 0.28) || rw < 48 || rh < 48) { rects.push([x, y, rw, rh]); return; }
      if (rw >= rh) { const s = Math.max(16, Math.round((rw * (0.35 + rnd() * 0.3)) / 16) * 16); split(x, y, s, rh, dpt + 1); split(x + s, y, rw - s, rh, dpt + 1); }
      else { const s = Math.max(16, Math.round((rh * (0.35 + rnd() * 0.3)) / 16) * 16); split(x, y, rw, s, dpt + 1); split(x, y + s, rw, rh - s, dpt + 1); }
    };
    split(0, 0, w, h, 0);
    for (const [x, y, rw, rh] of rects) {
      const tone = (190 + rnd() * 40) | 0;
      ctx.fillStyle = `rgba(${tone},${tone},${tone + 3},0.35)`; ctx.fillRect(x + 2, y + 2, rw - 4, rh - 4);
      ctx.strokeStyle = 'rgba(38,42,50,0.85)'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, rw - 2, rh - 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 1; ctx.strokeRect(x + 3.5, y + 3.5, rw - 7, rh - 7);
      if (rw >= 40 && rh >= 40) {
        for (const [px, py] of [[x + 8, y + 8], [x + rw - 8, y + 8], [x + 8, y + rh - 8], [x + rw - 8, y + rh - 8]]) {
          ctx.fillStyle = 'rgba(46,50,58,0.9)'; ctx.beginPath(); ctx.arc(px, py, 2.4, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(px - 0.7, py - 0.7, 1, 0, TAU); ctx.fill();
        }
      }
    }
    for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.05 + rnd() * 0.12})`; ctx.lineWidth = 1;
      const x = rnd() * w, y = rnd() * h, a = rnd() * TAU, l = 6 + rnd() * 22;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
  });
}
function hazardTex() {
  return canvasTex('hazard', 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ff7a1a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1d1d22';
    const p = 64;
    for (let i = -2 * p; i < 3 * p; i += p) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + p / 2, 0); ctx.lineTo(i + p / 2 - h, h); ctx.lineTo(i - h, h); ctx.closePath(); ctx.fill();
    }
    const rnd = rng(99);
    for (let i = 0; i < 500; i++) { ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.12})`; ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
  });
}
function hexTex() {
  return canvasTex('hex', 192, 111, (ctx, w, h) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const R = 32, hh = (Math.sqrt(3) / 2) * R;
    const hex = (cx, cy, r) => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i * PI) / 3; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } ctx.closePath(); };
    for (let col = -1; col <= 5; col++) for (let row = -1; row <= 3; row++) {
      const cx = col * 1.5 * R, cy = row * 2 * hh + (Math.abs(col) % 2 ? hh : 0);
      hex(cx, cy, R * 0.9); ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 5; ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke(); ctx.shadowBlur = 0;
    }
  });
}
function sparkTex() {
  return canvasTex('spark', 32, 32, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
  }, { clamp: true });
}
function starTex() {
  return canvasTex('star', 32, 32, (ctx, w) => {
    ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 4; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i * PI) / 5 - HP, r = i % 2 ? 5 : 14; ctx.lineTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  }, { clamp: true });
}
function envTex() {
  return canvasTex('env', 256, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#eef2f7'); g.addColorStop(0.3, '#b9c3cf'); g.addColorStop(0.48, '#8e8c8c');
    g.addColorStop(0.52, '#58595e'); g.addColorStop(1, '#1b1c20');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillRect(w * 0.1, h * 0.12, w * 0.14, h * 0.1); ctx.fillRect(w * 0.58, h * 0.07, w * 0.22, h * 0.06);
    ctx.fillStyle = 'rgba(255,160,90,0.55)'; ctx.fillRect(w * 0.36, h * 0.41, w * 0.18, h * 0.05);
    ctx.fillStyle = 'rgba(150,190,255,0.45)'; ctx.fillRect(w * 0.82, h * 0.38, w * 0.12, h * 0.07);
  }, { mapping: THREE.EquirectangularReflectionMapping });
}
const TEX = { plate: plateTex, hazard: hazardTex, hex: hexTex };

function sharedMat(key, make) { let m = sharedMats.get(key); if (!m) { m = make(); sharedMats.set(key, m); } return m; }
function starMaterial() {
  return sharedMat('stars', () => new THREE.PointsMaterial({ size: 0.2, map: starTex(), color: 0xffe36a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
}

/* =====================================================================================
 * Materials (per instance; ≤ ~6 per robot)
 * ===================================================================================== */
const MDEF = {
  steel: { color: 0x9aa1ab, map: 'plate', uvd: 1.3, metal: 0.6, rough: 0.38, env: 1.0, bump: 0.6, flatOK: true },
  dark: { color: 0x3b4048, map: 'plate', uvd: 1.6, metal: 0.55, rough: 0.48, env: 0.85, flatOK: true },
  orange: { color: 0xff7318, metal: 0.25, rough: 0.4, env: 0.55 },
  hazard: { color: 0xffffff, map: 'hazard', uvd: 4, metal: 0.25, rough: 0.45, env: 0.5 },
  red: { color: 0xa01e1e, metal: 0.4, rough: 0.38, env: 0.75, flatOK: true },
  glow: { color: 0x1a0200, emissive: 0xff1e05, ei: 1.75, metal: 0.1, rough: 0.3, env: 0.25, tele: true, hot: 5.5, clearcoat: true },
  glow2: { color: 0x1a0200, emissive: 0xff2a08, ei: 1.9, metal: 0.1, rough: 0.3, env: 0.25, tele: true, hot: 6, clearcoat: true },
  cyan: { color: 0x002a36, emissive: 0x00c4ff, ei: 1.3, metal: 0.1, rough: 0.2, env: 0.4, clearcoat: true },
  magma: { color: 0x1c0300, emissive: 0xff3204, ei: 1.55, metal: 0, rough: 0.7, env: 0.2 },
  mouth: { color: 0x200300, emissive: 0xff3a08, ei: 1.8, metal: 0, rough: 0.6, env: 0.2, tele: true, hot: 7 },
  shield: { basic: true, color: 0xffa035, map: 'hex', keepUV: true, opacity: 0.5, additive: true, side: THREE.DoubleSide },
  bubble: { basic: true, color: 0xffa83a, map: 'hex', keepUV: true, opacity: 0.55, additive: true, side: THREE.DoubleSide },
  laser: { basic: true, color: 0xff1206, opacity: 1, additive: true, noCloak: true },
  beam: { basic: true, color: 0xffa040, opacity: 0.55, additive: true },
  blur: { basic: true, color: 0x8d95a0, opacity: 0.16, side: THREE.DoubleSide },
  edge: { line: true, color: 0xd6c2ff, opacity: 0.55, noCloak: true },
};
const DARKEN_KINDS = new Set(['steel', 'dark', 'orange', 'hazard', 'red']);

class MatSet {
  constructor(qb, o = {}) { this.qb = qb; this.list = []; this.by = Object.create(null); this.flat = !!o.flat; }
  get(kind) { return this.by[kind] || (this.by[kind] = this._make(kind)); }
  _make(kind) {
    const D = MDEF[kind] || MDEF.steel;
    const map = D.map ? TEX[D.map]() : null;
    let m;
    if (D.line) {
      m = new THREE.LineBasicMaterial({ color: D.color, transparent: true, opacity: D.opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    } else if (D.basic) {
      m = new THREE.MeshBasicMaterial({
        color: D.color, map, transparent: true, opacity: D.opacity, depthWrite: false, side: D.side || THREE.FrontSide,
        blending: D.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
    } else {
      const p = { color: D.color, map, emissive: D.emissive || 0x000000, flatShading: this.flat && !!D.flatOK };
      if (this.qb === 0) m = new THREE.MeshLambertMaterial(p);
      else {
        p.metalness = D.metal; p.roughness = D.rough; p.envMap = envTex(); p.envMapIntensity = D.env ?? 1;
        if (this.qb === 2 && D.clearcoat) { p.clearcoat = 1; p.clearcoatRoughness = 0.06; m = new THREE.MeshPhysicalMaterial(p); }
        else m = new THREE.MeshStandardMaterial(p);
        if (this.qb === 2 && D.bump && map) { m.bumpMap = map; m.bumpScale = D.bump; }
      }
    }
    m.name = 'robot:' + kind;
    const u = m.userData;
    u.kind = kind; u.def = D; u.baseColor = m.color.clone(); u.baseOpacity = m.opacity; u.transpBase = m.transparent;
    u.baseEm = m.emissive && D.emissive ? m.emissive.clone().multiplyScalar(D.ei || 1) : null;
    u.emMul = 1; u.dyn = 1; u.colMul = 1;
    this.list.push(m);
    return m;
  }
  apply(flash, opacity, tele, time) {
    for (const m of this.list) {
      const u = m.userData, D = u.def;
      if (m.isLineBasicMaterial || m.isMeshBasicMaterial) {
        m.color.copy(u.baseColor).multiplyScalar(u.colMul);
        if (flash > 0) m.color.lerp(WHITE, flash * 0.7);
        m.opacity = clamp01(u.baseOpacity * u.dyn * (D.noCloak ? 1 : opacity));
        continue;
      }
      if (u.baseEm) {
        _c1.copy(u.baseEm);
        if (D.tele && tele > 0) {
          _c2.setRGB(1.0, 0.82, 0.72).multiplyScalar(D.hot || 5);
          _c1.lerp(_c2, tele);
          if (tele > 0.6) _c1.multiplyScalar(1 + 0.28 * Math.sin(time * 38) * sstep(0.6, 1, tele));
        }
        _c1.multiplyScalar(u.emMul);
        if (flash > 0) _c1.lerp(_c2.setRGB(1.6, 1.6, 1.6), flash);
        m.emissive.copy(_c1);
      } else if (m.emissive) {
        const f = flash * 0.85; m.emissive.setRGB(f, f, f);
      }
      m.color.copy(u.baseColor).multiplyScalar(u.colMul);
      const a = clamp01(u.baseOpacity * opacity);
      const tr = u.transpBase || a < 0.995;
      if (tr !== m.transparent) { m.transparent = tr; m.depthWrite = !tr; m.needsUpdate = true; }
      m.opacity = a;
    }
  }
  dispose() { for (const m of this.list) m.dispose(); this.list.length = 0; this.by = Object.create(null); }
}

function makeBuilder(prefix, qb, K, M, root, rig, uvScale = 1) {
  const keyBase = prefix + '|' + qb + '|';
  const add = (parent, name, kind, fn, p, r, s) => {
    const D = MDEF[kind];
    const geo = cachedGeo(keyBase + name, () => {
      const g = fn();
      if (D && D.map && !D.keepUV) planarUV(g, (D.uvd || 1) * uvScale);
      return g;
    });
    const mesh = new THREE.Mesh(geo, M.get(kind));
    mesh.name = name;
    if (p) mesh.position.fromArray(p);
    if (r) mesh.rotation.set(r[0], r[1], r[2]);
    if (s !== undefined) { if (typeof s === 'number') mesh.scale.setScalar(s); else mesh.scale.fromArray(s); }
    (parent || rig).add(mesh);
    return mesh;
  };
  const grp = (parent, p, r, name) => {
    const g = new THREE.Group();
    if (name) g.name = name;
    if (p) g.position.fromArray(p);
    if (r) g.rotation.set(r[0], r[1], r[2]);
    (parent || rig).add(g);
    return g;
  };
  const cg = (name, fn) => cachedGeo(keyBase + name, fn);
  return { K, M, add, grp, cg, root, rig, qb };
}

/* =====================================================================================
 * Animation helpers
 * ===================================================================================== */
// Two-bone IK in a pivot's YZ plane. Angles measured from -Y toward +Z ("forward angle").
// rest1/rest2: forward angles of the bones at zero rotation. Returns tip bone forward angle.
function ik2(p1, p2, L1, L2, rest1, rest2, ty, tz, bend = 1) {
  const d = clamp(Math.hypot(ty, tz), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-4);
  const a = Math.atan2(tz, -ty);
  const A = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const a1 = a + A * bend;
  const kz = L1 * Math.sin(a1), ky = -L1 * Math.cos(a1);
  const a2 = Math.atan2(Math.sin(a) * d - kz, -(-Math.cos(a) * d - ky));
  p1.rotation.x = rest1 - a1;
  p2.rotation.x = rest2 - a2 - p1.rotation.x;
  return a2;
}
// biped leg with bones along -Y; keeps foot pitch (world) = footPitch
function legIK(L, ty, tz, footPitch = 0) {
  const a2 = ik2(L.hip, L.kn, L.L1, L.L2, 0, 0, ty, tz, 1);
  if (L.ank) L.ank.rotation.x = a2 + footPitch;
}
// gait foot trajectory: out = [z, lift]
function gait(ph, S, H, out = _gaitOut) {
  ph = ((ph % TAU) + TAU) % TAU;
  if (ph < PI) { out[0] = S * 0.5 - S * (ph / PI); out[1] = 0; }
  else { const u = (ph - PI) / PI; out[0] = -S * 0.5 + S * (0.5 - 0.5 * Math.cos(PI * u)); out[1] = H * Math.sin(PI * u); }
  return out;
}
function eyeMul(R) {
  let m = 1;
  if (R.w.stunned > 0.02) m *= 1 - R.w.stunned * 0.65 * (0.5 + 0.5 * Math.sin(R.t * 31));
  return m * (1 - R.w.dead * 0.95);
}
function addMuzzleFlash(B, parent, size) {
  const { K } = B;
  const m = B.add(parent, 'mflash', 'glow', () => merge([
    xf(K.coneN(size * 0.4, size * 1.6, 5), [0, 0, size * 0.8], [HP, 0, 0]),
    xf(K.coneN(size * 0.25, size * 0.9, 5), [0, 0, size * 0.2], [HP, 0, PI / 5], [1.8, 1, 1.8]),
    new THREE.IcosahedronGeometry(size * 0.38, 0),
  ]));
  m.visible = false;
  m.userData.noShadow = true;
  return m;
}
class Sparks {
  constructor(n, size) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n); this.max = new Float32Array(n).fill(1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.PointsMaterial({ size, map: sparkTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false; this.points.name = 'sparks';
    this.active = 0;
  }
  emit(p, count, speed) {
    for (let k = 0; k < count; k++) {
      const i = (this.i = (this.i + 1) % this.n), o = i * 3;
      this.pos[o] = p.x; this.pos[o + 1] = p.y; this.pos[o + 2] = p.z;
      const a = Math.random() * TAU, e = Math.random() * 0.9 + 0.2;
      this.vel[o] = Math.cos(a) * Math.cos(e) * speed; this.vel[o + 1] = Math.sin(e) * speed * 1.2; this.vel[o + 2] = Math.sin(a) * Math.cos(e) * speed;
      this.life[i] = this.max[i] = 0.3 + Math.random() * 0.5;
    }
    this.active = 1.2;
  }
  update(dt, gravity) {
    this.points.visible = this.active > 0;
    if (this.active <= 0) return;
    this.active -= dt;
    for (let i = 0; i < this.n; i++) {
      const o = i * 3;
      if (this.life[i] > 0) {
        this.life[i] -= dt;
        this.vel[o + 1] -= gravity * dt;
        this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt;
        const f = Math.max(0, this.life[i] / this.max[i]);
        this.col[o] = 1.0 * f; this.col[o + 1] = (0.45 + 0.4 * f) * f; this.col[o + 2] = 0.18 * f * f;
      } else { this.col[o] = this.col[o + 1] = this.col[o + 2] = 0; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
  dispose() { this.points.removeFromParent(); this.points.geometry.dispose(); this.mat.dispose(); }
}

/* =====================================================================================
 * ROBOT BUILDERS
 * Each returns { radius, height, muzzle, weakPoint, anim(dt, R, s), yawLimit, pitchMin,
 * pitchMax, aimSpace, idleYaw, muzzles, starY }
 * ===================================================================================== */

// ---------- CRAWLER: armoured beetle scuttler with snapping pincers ----------
function buildCrawler(B) {
  const { K, add, grp, rig, M } = B;
  const body = grp(rig, [0, 0.42, 0], null, 'body');
  const SH = [1, 0.8, 1.15];
  add(body, 'shell', 'steel', () => xf(K.sph(0.5, 22, 12, 0, TAU, 0, HP), 0, 0, SH));
  add(body, 'trim', 'orange', () => merge([
    xf(xf(K.tor(0.476, 0.042, 6, 28, PI), [0.17, 0, 0], [0, HP, 0]), 0, 0, SH),
    xf(xf(K.tor(0.476, 0.042, 6, 28, PI), [-0.17, 0, 0], [0, HP, 0]), 0, 0, SH),
    xf(K.box(0.19, 0.055, 0.08, 0.02), [0.14, 0.215, 0.585], [0.15, 0, 0.4]),
    xf(K.box(0.19, 0.055, 0.08, 0.02), [-0.14, 0.215, 0.585], [0.15, 0, -0.4]),
    xf(K.cone(0.05, 0.16, 6), [0, 0.42, -0.25], [-0.6, 0, 0]),
  ]));
  add(body, 'under', 'dark', () => merge([
    xf(K.cyl(0.53, 0.48, 0.12, 22), [0, -0.02, 0], 0, [1, 1, 1.15]),
    xf(K.box(0.72, 0.2, 0.98, 0.07), [0, -0.14, 0]),
    xf(K.box(0.56, 0.3, 0.16, 0.06), [0, 0.07, 0.53]),
    xf(K.tor(0.09, 0.024, 6, 16), [0.14, 0.08, 0.615]),
    xf(K.tor(0.09, 0.024, 6, 16), [-0.14, 0.08, 0.615]),
  ]));
  add(body, 'eyes', 'glow', () => merge([
    xf(K.sph(0.08, 12, 8), [0.14, 0.08, 0.61], 0, [1, 1, 0.55]),
    xf(K.sph(0.08, 12, 8), [-0.14, 0.08, 0.61], 0, [1, 1, 0.55]),
  ]));
  const jaw = (d) => xf(xf(K.cone(0.065, 0.28, 8), [0, 0, 0.14], [HP, 0, 0], [0.75, 1, 1]), [0, 0.035 * d, 0], [0.28 * d, 0, 0]);
  const pincers = [];
  for (const sd of [1, -1]) {
    const arm = grp(body, [0.27 * sd, -0.08, 0.5], [0, 0.22 * sd, 0]);
    add(arm, 'parm', 'dark', () => merge([K.capsule([0, 0, 0], [0, 0, 0.24], 0.055, 8), xf(K.sph(0.075, 10, 8), [0, 0, 0.27])]));
    const claw = grp(arm, [0, 0, 0.28]);
    const up = grp(claw), lo = grp(claw);
    add(up, 'jawU', 'orange', () => jaw(1));
    add(lo, 'jawL', 'orange', () => jaw(-1));
    pincers.push({ arm, up, lo, sd });
  }
  const legs = [];
  const spreads = [0.6, 0, -0.6], zs = [0.26, 0, -0.26];
  for (const sd of [1, -1]) for (let j = 0; j < 3; j++) {
    const base = sd > 0 ? -spreads[j] : PI + spreads[j];
    const yawG = grp(body, [0.32 * sd, -0.04, zs[j]], [0, base, 0]);
    const lift = grp(yawG);
    add(lift, 'legU', 'steel', () => merge([K.capsule([0, 0, 0], [0.3, 0.16, 0], 0.05, 8), xf(K.sph(0.07, 10, 8), [0.3, 0.16, 0])]));
    const knee = grp(lift, [0.3, 0.16, 0]);
    add(knee, 'legL', 'dark', () => merge([K.rod([0, 0, 0], [0.2, -0.47, 0], 0.045, 0.024, 8), xf(K.cone(0.024, 0.08, 6), [0.216, -0.507, 0], [0, 0, PI + 0.4])]));
    legs.push({ yawG, lift, knee, base, sd, g: (j + (sd > 0 ? 0 : 1)) % 2 });
  }
  const muzzle = grp(body, [0, 0, 0.8], null, 'muzzle');
  const anim = (dt, R) => {
    const wT = R.w.telegraph * R.teleS, wA = R.w.attack, wS = R.w.stunned, wD = R.w.dead;
    const mv = clamp(R.spd / 3, 0, 1) * (1 - wD) * (1 - wS);
    R.phase += dt * R.spd * 4.2;
    const idle = Math.sin(R.t * 2.1 + R.rnd);
    for (const L of legs) {
      const ph = R.phase + L.g * PI;
      const sw = Math.sin(ph) * 0.34 * mv, lf = Math.max(0, Math.cos(ph)) * 0.5 * mv;
      L.yawG.rotation.y = L.base + (L.sd > 0 ? -sw : sw);
      L.lift.rotation.z = lf + 0.04 * idle * (1 - mv) + wS * (0.25 + 0.15 * Math.sin(R.t * 14 + L.base * 3)) + wD * 0.75 - wT * 0.1;
      L.knee.rotation.z = -lf * 0.5 - wD * 1.3 + wT * 0.12;
    }
    body.position.y = 0.42 + Math.abs(Math.sin(R.phase * 2)) * 0.03 * mv + 0.01 * idle - wD * 0.27 + wT * 0.05 - wS * 0.06;
    body.position.z = 0.1 * wA * Math.sin(Math.min(R.stT, 0.3) / 0.3 * PI) * (R.st === 'attack' ? 1 : 0);
    body.rotation.x = -0.16 * wT + 0.08 * wA + Math.sin(R.phase * 2) * 0.02 * mv;
    body.rotation.z = Math.sin(R.phase) * 0.04 * mv + wS * Math.sin(R.t * 9) * 0.14 + wD * 0.22;
    body.rotation.y = R.yaw;
    const snap = R.st === 'attack' ? Math.abs(Math.sin(R.stT * 26)) : 0;
    for (const P of pincers) {
      P.arm.rotation.x = -0.6 * wT - 0.1 * wA + wS * 0.4 + wD * 0.6 + 0.05 * idle;
      const open = Math.max(0, 0.12 + 0.08 * Math.sin(R.t * 3 + P.sd) + 0.65 * wT + 0.5 * snap * wA - 0.2 * wD);
      P.up.rotation.x = -open; P.lo.rotation.x = open;
    }
  };
  return { radius: 0.7, height: 0.9, muzzle, weakPoint: null, anim, yawLimit: 0.5, aimSpace: rig, starY: 1.0 };
}

// ---------- DRONE: hover-eye with shrouded rotor and under-gun ----------
function buildDrone(B) {
  const { K, add, grp, rig } = B;
  const body = grp(rig, null, null, 'body');
  add(body, 'body', 'steel', () => xf(K.sph(0.32, 22, 16), 0, 0, [1, 0.86, 1]));
  add(body, 'bdark', 'dark', () => merge([
    K.cyl(0.334, 0.334, 0.08, 24),
    xf(K.cyl(0.05, 0.07, 0.16, 10), [0, 0.33, 0]),
    ...[PI, PI / 3, -PI / 3].map((a) => K.rod([0.21 * Math.sin(a), 0.2, 0.21 * Math.cos(a)], [0.53 * Math.sin(a), 0.41, 0.53 * Math.cos(a)], 0.026, 0.02, 6)),
    xf(K.tor(0.135, 0.028, 6, 18), [0, 0.03, 0.29]),
    xf(K.cyl(0.07, 0.055, 0.14, 10), [0.17, -0.26, -0.06]),
    xf(K.cyl(0.07, 0.055, 0.14, 10), [-0.17, -0.26, -0.06]),
  ]));
  add(body, 'borange', 'orange', () => merge([
    xf(K.tor(0.56, 0.045, 8, 36), [0, 0.41, 0], [HP, 0, 0]),
    xf(K.box(0.3, 0.055, 0.14, 0.02), [0, 0.2, 0.25], [0.5, 0, 0]),
    xf(K.box(0.05, 0.13, 0.24, 0.02), [0.335, 0.0, -0.03], [0, 0, -0.5]),
    xf(K.box(0.05, 0.13, 0.24, 0.02), [-0.335, 0.0, -0.03], [0, 0, 0.5]),
  ]));
  add(body, 'beye', 'glow', () => merge([
    xf(K.sph(0.115, 16, 12), [0, 0.03, 0.29], 0, [1, 1, 0.5]),
    xf(K.cyl(0.05, 0.05, 0.02, 10), [0.17, -0.335, -0.06]),
    xf(K.cyl(0.05, 0.05, 0.02, 10), [-0.17, -0.335, -0.06]),
  ]));
  const rotor = grp(body, [0, 0.41, 0], null, 'rotor');
  add(rotor, 'blades', 'dark', () => merge([
    K.cyl(0.07, 0.07, 0.06, 12),
    ...[0, 1, 2].map((i) => xf(xf(K.box(0.44, 0.014, 0.075, 0.005), [0.26, 0, 0], [0.22, 0, 0]), 0, [0, (i * TAU) / 3, 0])),
  ]));
  if (B.qb > 0) add(rotor, 'blur', 'blur', () => xf(new THREE.CircleGeometry(0.5, 32), [0, 0.004, 0], [-HP, 0, 0]));
  const yawP = grp(body, [0, -0.22, 0.1]); const pitchP = grp(yawP);
  add(pitchP, 'gun', 'dark', () => merge([
    K.box(0.13, 0.11, 0.18, 0.03),
    xf(K.cyl(0.03, 0.03, 0.28, 8), [0, 0, 0.22], [HP, 0, 0]),
    xf(K.cyl(0.042, 0.042, 0.05, 8), [0, 0, 0.35], [HP, 0, 0]),
  ]));
  const muzzle = grp(pitchP, [0, 0, 0.39], null, 'muzzle');
  const flash = addMuzzleFlash(B, muzzle, 0.12);
  let tilt = 0;
  const anim = (dt, R) => {
    const wT = R.w.telegraph * R.teleS, wA = R.w.attack, wS = R.w.stunned, wD = R.w.dead;
    rotor.rotation.y += dt * (30 + R.spd * 3) * (1 - 0.7 * wS) * (1 - wD);
    tilt = damp(tilt, clamp(R.spd * 0.06, 0, 0.42), 4, dt);
    const kick = R.st === 'attack' ? Math.exp(-R.stT * 10) : 0;
    body.position.y = Math.sin(R.t * 2.3 + R.rnd) * 0.06 * (1 - wD) - wD * 0.35 + wT * 0.05;
    body.rotation.x = tilt - wT * 0.22 - kick * 0.12 + wD * 0.8;
    body.rotation.z = Math.sin(R.t * 1.3 + R.rnd) * 0.06 + wS * Math.sin(R.t * 6) * 0.45 + wD * 0.3;
    body.rotation.y = wS * Math.sin(R.t * 2.2) * 0.6;
    yawP.rotation.y = R.yaw; pitchP.rotation.x = -R.pitch;
    pitchP.position.z = -0.05 * kick;
    flash.visible = R.st === 'attack' && R.stT < 0.07;
  };
  return { radius: 0.6, height: 0.9, muzzle, weakPoint: null, anim, yawLimit: 1.2, pitchMin: -1.2, pitchMax: 0.4, aimSpace: body, starY: 0.6 };
}

// ---------- ROLLER: armoured ball, spinning side shells, eye band, pop-out spikes ----------
function buildRoller(B) {
  const { K, add, grp, rig } = B;
  const RB = 0.62;
  const core = grp(rig, [0, RB, 0], null, 'core');
  add(core, 'slab', 'dark', () => xf(K.cyl(0.57, 0.57, 0.3, 30), 0, [0, 0, HP]));
  add(core, 'rims', 'orange', () => merge([
    xf(K.tor(0.57, 0.028, 6, 36), [0.15, 0, 0], [0, HP, 0]),
    xf(K.tor(0.57, 0.028, 6, 36), [-0.15, 0, 0], [0, HP, 0]),
  ]));
  const eyeG = grp(core, null, null, 'eye');
  add(eyeG, 'eyeD', 'steel', () => merge([
    xf(K.tor(0.13, 0.032, 6, 18), [0, 0.06, 0.572]),
    xf(K.box(0.3, 0.07, 0.13, 0.025), [0, 0.215, 0.535], [0.55, 0, 0]),
  ]));
  add(eyeG, 'eyeL', 'glow', () => merge([
    xf(K.sph(0.12, 16, 12), [0, 0.06, 0.565], 0, [1, 1, 0.55]),
    xf(K.box(0.22, 0.03, 0.04, 0.012), [0, -0.12, 0.562], [-0.2, 0, 0]),
  ]));
  const capShell = () => {
    const pts = [[0.4, 0.17]];
    const t0 = Math.acos(0.18 / RB), N = 12;
    for (let i = 0; i <= N; i++) { const t = t0 * (1 - i / N); pts.push([RB * Math.sin(t), RB * Math.cos(t)]); }
    return xf(K.lathe(pts, 28), 0, [0, 0, -HP]);
  };
  const spikeDirs = [];
  for (let i = 0; i < 6; i++) { const az = (i * TAU) / 6, pol = 0.95; spikeDirs.push([Math.cos(pol), Math.sin(pol) * Math.cos(az), Math.sin(pol) * Math.sin(az)]); }
  const caps = [];
  for (const sd of [1, -1]) {
    const cap = grp(core, null, [0, sd > 0 ? 0 : PI, 0]);
    add(cap, 'capS', 'steel', capShell);
    add(cap, 'capO', 'orange', () => merge([
      xf(K.tor(0.458, 0.03, 6, 32), [0.42, 0, 0], [0, HP, 0]),
      xf(K.cyl(0.13, 0.15, 0.05, 16), [0.6, 0, 0], [0, 0, -HP]),
      ...spikeDirs.map((d) => coneAt(K.cyl(0.075, 0.075, 0.03, 10), 0.03, [d[0] * (RB - 0.012), d[1] * (RB - 0.012), d[2] * (RB - 0.012)], d)),
    ]));
    const spikes = add(cap, 'spikes', 'dark', () => merge(spikeDirs.map((d) => K.coneAt(0.065, 0.26, [d[0] * (RB - 0.07), d[1] * (RB - 0.07), d[2] * (RB - 0.07)], d, 8))));
    caps.push({ cap, spikes });
  }
  let roll = 0, ext = 0;
  const muzzle = grp(core, [0, -0.1, 0.7], null, 'muzzle');
  const anim = (dt, R) => {
    const wT = R.w.telegraph * R.teleS, wA = R.w.attack, wS = R.w.stunned, wD = R.w.dead;
    const atk = R.st === 'attack' ? 1 : 0;
    roll = (roll + dt * (R.spd / RB + 18 * wT + 16 * wA * atk) * (1 - wD) * (1 - 0.85 * wS)) % TAU;
    ext = damp(ext, Math.max(R.st === 'telegraph' ? R.teleS : 0, atk), 14, dt);
    const sc = lerp(0.72, 1, ext);
    for (const c of caps) { c.cap.rotation.x = roll; c.spikes.scale.setScalar(sc); }
    core.position.y = RB + Math.sin(R.t * 3 + R.rnd) * 0.008 - wD * 0.04;
    core.position.x = wT * Math.sin(R.t * 70) * 0.012;
    core.rotation.z = wS * Math.sin(R.t * 8) * 0.12 + wD * 0.16;
    eyeG.rotation.x = clamp(-R.pitch, -0.5, 0.5) * (1 - wD) + wD * 0.5;
  };
  return { radius: 0.7, height: 1.24, muzzle, weakPoint: null, anim, yawLimit: 0, pitchMin: -0.5, pitchMax: 0.5, aimSpace: core, starY: 1.4 };
}

// ---------- HEAVY: 2.2 m bruiser, giant fists, ground slam ----------
function buildHeavy(B) {
  const { K, add, grp, rig, M } = B;
  const pelvis = grp(rig, [0, 0.9, 0], null, 'pelvis');
  add(pelvis, 'pelvis', 'dark', () => merge([K.box(0.8, 0.3, 0.55, 0.08), xf(K.cyl(0.19, 0.19, 0.95, 12), [0, -0.05, 0], [0, 0, HP])]));
  const torso = grp(pelvis, [0, 0.12, 0], null, 'torso');
  add(torso, 'torso', 'steel', () => merge([
    xf(K.box(1.3, 0.95, 0.85, 0.2), [0, 0.62, 0]),
    xf(K.box(0.5, 0.3, 0.44, 0.1), [0, 1.08, 0.04]),
  ]));
  add(torso, 'tdark', 'dark', () => merge([
    xf(K.box(0.92, 0.32, 0.66, 0.08), [0, 0.12, 0.01]),
    xf(K.cyl(0.25, 0.27, 0.16, 18), [0, 0.65, -0.46], [HP, 0, 0]),
    xf(K.tor(0.2, 0.035, 6, 18), [0, 0.65, -0.545]),
    xf(K.box(0.4, 0.04, 0.06, 0.01), [0, 0.65, -0.56]),
    xf(K.box(0.12, 0.3, 0.5, 0.03), [0.66, 0.58, 0.05]),
    xf(K.box(0.12, 0.3, 0.5, 0.03), [-0.66, 0.58, 0.05]),
    ...[-0.24, -0.08, 0.08, 0.24].map((x) => xf(K.box(0.07, 0.24, 0.05, 0.015), [x, 0.33, 0.43])),
  ]));
  add(torso, 'thaz', 'hazard', () => merge([
    xf(K.box(0.8, 0.36, 0.12, 0.05), [0, 0.76, 0.43]),
    xf(K.box(0.6, 0.34, 0.72, 0.13), [0.84, 0.99, 0], [0, 0, -0.28]),
    xf(K.box(0.6, 0.34, 0.72, 0.13), [-0.84, 0.99, 0], [0, 0, 0.28]),
  ]));
  const core = add(torso, 'core', 'cyan', () => xf(K.sph(0.16, 14, 10), 0, 0, [1, 1, 0.7]), [0, 0.65, -0.53]);
  const yawP = grp(torso, [0, 1.12, 0.2]); const pitchP = grp(yawP);
  add(pitchP, 'head', 'steel', () => merge([
    xf(K.box(0.46, 0.3, 0.42, 0.1), [0, 0.08, 0.02]),
    xf(K.box(0.5, 0.07, 0.14, 0.03), [0, 0.2, 0.19], [0.35, 0, 0]),
  ]));
  add(pitchP, 'visor', 'glow', () => merge([
    xf(K.box(0.17, 0.065, 0.05, 0.02), [0.085, 0.1, 0.235], [0, 0, 0.22]),
    xf(K.box(0.17, 0.065, 0.05, 0.02), [-0.085, 0.1, 0.235], [0, 0, -0.22]),
  ]));
  const arms = [];
  for (const sd of [1, -1]) {
    const sh = grp(torso, [0.8 * sd, 0.88, 0]);
    add(sh, 'uarm', 'dark', () => merge([K.sph(0.2, 12, 10), K.capsule([0, 0, 0], [0, -0.48, 0], 0.15, 10)]));
    const el = grp(sh, [0, -0.5, 0]);
    add(el, 'farm', 'steel', () => merge([xf(K.box(0.4, 0.55, 0.44, 0.1), [0, -0.3, 0.02]), xf(K.box(0.54, 0.44, 0.54, 0.14), [0, -0.74, 0.04])]));
    add(el, 'knuck', 'orange', () => merge([xf(K.box(0.5, 0.13, 0.17, 0.05), [0, -0.66, 0.3]), xf(K.box(0.46, 0.08, 0.48, 0.03), [0, -0.97, 0.04])]));
    arms.push({ sh, el, sd });
  }
  const legs = [];
  for (const sd of [1, -1]) {
    const hip = grp(pelvis, [0.36 * sd, -0.05, 0]);
    add(hip, 'thigh', 'dark', () => K.capsule([0, 0, 0], [0, -0.36, 0], 0.16, 10));
    const kn = grp(hip, [0, -0.38, 0]);
    add(kn, 'shin', 'steel', () => merge([xf(K.box(0.34, 0.36, 0.38, 0.08), [0, -0.16, 0]), xf(K.box(0.3, 0.16, 0.16, 0.05), [0, -0.02, 0.18])]));
    const ank = grp(kn, [0, -0.33, 0]);
    add(ank, 'foot', 'dark', () => xf(K.box(0.44, 0.16, 0.62, 0.06), [0, -0.06, 0.08]));
    legs.push({ hip, kn, ank, sd, L1: 0.38, L2: 0.33 });
  }
  const muzzle = grp(torso, [0, 0.6, 0.62], null, 'muzzle');
  const cyanM = M.get('cyan');
  const anim = (dt, R) => {
    const wT = R.w.telegraph * R.teleS, wA = R.w.attack, wS = R.w.stunned, wD = R.w.dead;
    const busy = Math.max(R.w.telegraph, wA, wS, wD);
    const mv = clamp(R.spd / 2.5, 0, 1) * (1 - busy);
    R.phase += dt * Math.PI * R.spd / 0.55;
    const ph = R.phase, s1 = Math.sin(ph);
    const slam = R.st === 'attack' ? sstep(0, 0.13, R.stT) : 1;
    const br = Math.sin(R.t * 1.8 + R.rnd);
    const hy = 0.885 - 0.04 * mv * (0.5 + 0.5 * Math.cos(2 * ph)) + 0.01 * br - 0.1 * wT - 0.28 * wA * slam - 0.12 * wS - 0.42 * wD;
    pelvis.position.y = hy;
    for (const L of legs) {
      const g = gait(ph + (L.sd > 0 ? 0 : PI), 0.55, 0.2);
      legIK(L, -(hy - 0.05) + g[1] * mv + 0.14, g[0] * mv + (wA * slam * (L.sd > 0 ? 0.18 : -0.1)));
      L.hip.rotation.z = 0.03 * L.sd + wD * 0.25 * L.sd;
    }
    torso.rotation.x = -0.22 * wT + 0.5 * wA * slam + 0.22 * wS - 0.45 * wD + 0.02 * br;
    torso.rotation.z = s1 * 0.07 * mv + wS * Math.sin(R.t * 5) * 0.08;
    torso.rotation.y = s1 * 0.12 * mv;
    for (const A of arms) {
      let ax = s1 * 0.35 * mv * A.sd + 0.03 * br, ex = -0.15;
      ax = lerp(ax, -2.75, wT); ex = lerp(ex, -0.6, wT);
      ax = lerp(ax, lerp(-2.75, -1.05, slam), wA); ex = lerp(ex, lerp(-0.6, -0.12, slam), wA);
      ax = lerp(ax, 0.15 + 0.15 * Math.sin(R.t * 3 + A.sd), wS); ax = lerp(ax, -0.5, wD);
      A.sh.rotation.x = ax; A.el.rotation.x = ex;
      A.sh.rotation.z = (0.12 + 0.25 * wD + 0.1 * wT) * A.sd;
    }
    yawP.rotation.y = R.yaw; pitchP.rotation.x = -R.pitch + 0.3 * wS;
    cyanM.userData.emMul = 1 + 0.2 * Math.sin(R.t * 4);
  };
  return { radius: 1.1, height: 2.2, muzzle, weakPoint: core, anim, yawLimit: 0.9, pitchMin: -0.4, pitchMax: 0.4, aimSpace: torso, starY: 2.45 };
}

// ---------- SHIELD: soldier with a hex energy shield and blaster ----------
function buildShield(B) {
  const { K, add, grp, rig, M } = B;
  const pelvis = grp(rig, [0, 0.72, 0], null, 'pelvis');
  add(pelvis, 'pelvis', 'dark', () => K.box(0.42, 0.18, 0.3, 0.05));
  const twist = grp(pelvis, [0, 0.06, 0]);
  const torso = grp(twist, null, null, 'torso');
  add(torso, 'torso', 'steel', () => merge([xf(K.box(0.6, 0.48, 0.4, 0.12), [0, 0.34, 0]), xf(K.box(0.42, 0.16, 0.32, 0.05), [0, 0.05, 0])]));
  add(torso, 'torange', 'orange', () => merge([xf(K.box(0.3, 0.08, 0.06, 0.02), [0, 0.44, 0.2]), xf(K.box(0.5, 0.07, 0.36, 0.03), [0, 0.6, 0])]));
  add(torso, 'pack', 'dark', () => merge([
    xf(K.box(0.38, 0.4, 0.18, 0.05), [0, 0.34, -0.27]),
    xf(K.cyl(0.085, 0.085, 0.05, 12), [0, 0.52, -0.38]),
    xf(K.cyl(0.085, 0.085, 0.05, 12), [0, 0.2, -0.38]),
  ]));
  const cell = add(torso, 'cell', 'cyan', () => K.cyl(0.065, 0.065, 0.28, 12), [0, 0.36, -0.38]);
  const head = grp(torso, [0, 0.66, 0.02]);
  add(head, 'helm', 'steel', () => merge([xf(K.sph(0.17, 18, 14), [0, 0.04, 0], 0, [1, 0.95, 1.05]), xf(K.box(0.2, 0.08, 0.12, 0.03), [0, -0.08, 0.12])]));
  add(head, 'visor', 'glow', () => xf(K.cyl(0.18, 0.18, 0.055, 18, true, -0.9, 1.8), [0, 0.04, 0], 0, [1, 1, 1.05]));
  add(head, 'crest', 'orange', () => xf(K.box(0.045, 0.1, 0.28, 0.02), [0, 0.2, -0.02]));
  const shL = grp(torso, [0.38, 0.48, 0]);
  add(shL, 'uarm', 'dark', () => merge([K.sph(0.09, 10, 8), K.capsule([0, 0, 0], [0, -0.24, 0], 0.065, 8)]));
  const elL = grp(shL, [0, -0.26, 0]);
  add(elL, 'farmL', 'steel', () => merge([xf(K.box(0.14, 0.14, 0.32, 0.04), [0, 0, 0.12]), xf(K.cyl(0.09, 0.09, 0.05, 14), [0, 0, 0.29], [HP, 0, 0])]));
  const shieldG = grp(elL, [-0.2, 0.1, 0.42], null, 'shield');
  const shieldMesh = add(shieldG, 'shieldE', 'shield', () => uvMul(xf(new THREE.CircleGeometry(0.62, 6), 0, 0, [1, 1.1, 1]), 2, 3.8));
  add(shieldG, 'shieldF', 'glow', () => xf(K.torN(0.62, 0.022, 4, 6), 0, 0, [1, 1.1, 1]));
  shieldMesh.renderOrder = 2;
  const shR = grp(torso, [-0.38, 0.48, 0]);
  add(shR, 'uarm', 'dark', () => merge([K.sph(0.09, 10, 8), K.capsule([0, 0, 0], [0, -0.24, 0], 0.065, 8)]));
  const elR = grp(shR, [0, -0.26, 0]);
  add(elR, 'gun', 'dark', () => merge([
    xf(K.box(0.14, 0.16, 0.42, 0.04), [0, -0.02, 0.15]),
    xf(K.cyl(0.035, 0.035, 0.24, 10), [0, 0, 0.46], [HP, 0, 0]),
    xf(K.box(0.05, 0.1, 0.1, 0.02), [0, -0.12, 0.05]),
  ]));
  add(elR, 'gunO', 'orange', () => merge([xf(K.cyl(0.046, 0.046, 0.05, 10), [0, 0, 0.56], [HP, 0, 0]), xf(K.box(0.15, 0.035, 0.22, 0.01), [0, 0.07, 0.15])]));
  const muzzle = grp(elR, [0, 0, 0.6], null, 'muzzle');
  const charge = add(muzzle, 'charge', 'glow', () => K.sph(0.06, 10, 8));
  const flash = addMuzzleFlash(B, muzzle, 0.12);
  const legs = [];
  for (const sd of [1, -1]) {
    const hip = grp(pelvis, [0.14 * sd, -0.06, 0]);
    add(hip, 'thigh', 'dark', () => K.capsule([0, 0, 0], [0, -0.3, 0], 0.07, 8));
    const kn = grp(hip, [0, -0.32, 0]);
    add(kn, 'shin', 'steel', () => merge([xf(K.box(0.13, 0.28, 0.15, 0.04), [0, -0.14, 0]), xf(K.box(0.12, 0.08, 0.06, 0.02), [0, -0.02, 0.08])]));
    const ank = grp(kn, [0, -0.3, 0]);
    add(ank, 'foot', 'dark', () => xf(K.box(0.16, 0.08, 0.27, 0.03), [0, -0.02, 0.05]));
    legs.push({ hip, kn, ank, sd, L1: 0.32, L2: 0.3 });
  }
  const shieldMat = M.get('shield'), frameMat = M.get('glow');
  const anim = (dt, R) => {
    const wT = R.w.telegraph * R.teleS, wA = R.w.attack, wS = R.w.stunned, wD = R.w.dead;
    const busy = Math.max(wS, wD);
    const mv = clamp(R.spd / 3, 0, 1) * (1 - busy);
    R.phase += dt * Math.PI * R.spd / 0.45;
    const ph = R.phase, s1 = Math.sin(ph), br = Math.sin(R.t * 2 + R.rnd);
    const hy = 0.72 - 0.03 * mv * (0.5 + 0.5 * Math.cos(2 * ph)) + 0.005 * br - 0.05 * wT - 0.12 * wS - 0.3 * wD;
    pelvis.position.y = hy;
    for (const L of legs) {
      const g = gait(ph + (L.sd > 0 ? 0 : PI), 0.45, 0.12);
      legIK(L, -(hy - 0.06) + g[1] * mv + 0.06, g[0] * mv + (L.sd > 0 ? 0.06 : -0.04) * (1 - mv));
    }
    twist.rotation.y = R.yaw;
    torso.rotation.x = 0.04 + 0.04 * wT + 0.3 * wS - 0.35 * wD;
    torso.rotation.z = s1 * 0.04 * mv + wS * Math.sin(R.t * 5) * 0.07;
    const kick = R.st === 'attack' ? Math.exp(-R.stT * 12) : 0;
    shR.rotation.x = lerp(-R.pitch - kick * 0.35 + s1 * 0.08 * mv, 0.5, Math.max(wS, wD));
    elR.rotation.x = lerp(0, 1.0, Math.max(wS, wD));
    shL.rotation.x = -0.05 + 0.02 * br + wD * 0.6 + wS * 0.35;
    shL.rotation.z = -0.04;
    head.rotation.x = -R.pitch * 0.5 + 0.35 * wS;
    charge.visible = R.st === 'telegraph' && R.teleS > 0.02;
    charge.scale.setScalar(0.3 + 1.2 * R.teleS);
    flash.visible = R.st === 'attack' && R.stT < 0.07;
    let sh = (0.85 + 0.15 * Math.sin(R.t * 7)) * (1 - wD);
    if (R.flash > 0.02) sh *= hash(Math.floor(R.t * 40)) > 0.45 ? 1.4 : 0.15;
    if (wS > 0.2) sh *= hash(Math.floor(R.t * 25) + 7) > 0.5 ? 0.6 : 0.08;
    shieldMat.userData.dyn = sh;
    shieldMesh.visible = sh > 0.01;
    frameMat.userData.emMul = eyeMul(R) * (0.6 + 0.4 * sh);
  };
  return { radius: 0.8, height: 1.65, muzzle, weakPoint: cell, anim, yawLimit: 0.7, pitchMin: -0.6, pitchMax: 0.6, aimSpace: pelvis, starY: 1.8 };
}

// ---------- STEALTH: slim faceted assassin with blades + shimmer edges ----------
function buildStealth(B) {
  const { K, add, grp, rig, M, cg } = B;
  const edgeMat = M.get('edge');
  const edges = [];
  const edgeOf = (name, parent, fn) => {
    const geo = cg(name + '_edges', () => { const src = fn(); const e = new THREE.EdgesGeometry(src, 20); src.dispose(); return e; });
    const l = new THREE.LineSegments(geo, edgeMat); l.name = name + '_edges'; parent.add(l); edges.push(l); return l;
  };
  const pelvis = grp(rig, [0, 0.72, 0], null, 'pelvis');
  add(pelvis, 'pelv', 'dark', () => xf(K.oct(0.12), 0, 0, [1.3, 0.7, 0.9]));
  const torso = grp(pelvis, [0, 0.05, 0], null, 'torso');
  const torsoG = () => xf(K.prism(0.25, 0.1, 0.5, 6), [0, 0.28, 0], 0, [1, 1, 0.62]);
  add(torso, 'torso', 'steel', torsoG);
  edgeOf('torso', torso, torsoG);
  add(torso, 'tdark', 'dark', () => merge([
    xf(K.prism(0.16, 0.2, 0.1, 6), [0, 0.56, 0], 0, [1, 1, 0.7]),
    xf(K.coneN(0.05, 0.45, 3), [0.12, 0.52, -0.16], [-0.7, 0, 0.45]),
    xf(K.coneN(0.05, 0.45, 3), [-0.12, 0.52, -0.16], [-0.7, 0, -0.45]),
    xf(K.oct(0.09), [0, 0.03, 0], 0, [1.2, 0.8, 0.9]),
  ]));
  const yawP = grp(torso, [0, 0.6, 0.02]); const pitchP = grp(yawP);
  const headG = () => xf(K.oct(0.15), [0, 0.08, 0.02], 0, [0.85, 0.7, 1.35]);
  add(pitchP, 'head', 'steel', headG);
  edgeOf('head', pitchP, headG);
  add(pitchP, 'eye', 'glow', () => merge([
    xf(K.box(0.09, 0.022, 0.03), [0.045, 0.085, 0.142], [0, -0.55, 0.3]),
    xf(K.box(0.09, 0.022, 0.03), [-0.045, 0.085, 0.142], [0, 0.55, -0.3]),
  ]));
  const arms = [];
  const bladeG = () => xf(K.coneN(0.07, 0.6, 4), [0, -0.42, 0.03], [PI, 0, 0], [0.25, 1, 1]);
  for (const sd of [1, -1]) {
    const sh = grp(torso, [0.27 * sd, 0.47, 0]);
    add(sh, 'uarm', 'dark', () => merge([K.oct(0.06), K.rod([0, 0, 0], [0, -0.27, 0], 0.045, 0.035, 4)]));
    const el = grp(sh, [0, -0.28, 0]);
    add(el, 'farm', 'steel', () => K.rod([0, 0, 0], [0, -0.22, 0], 0.045, 0.04, 4));
    add(el, 'blade', 'red', bladeG);
    edgeOf('blade', el, bladeG);
    arms.push({ sh, el, sd });
  }
  const legs = [];
  for (const sd of [1, -1]) {
    const hip = grp(pelvis, [0.11 * sd, -0.03, 0]);
    add(hip, 'thigh', 'dark', () => K.rod([0, 0, 0], [0, -0.3, 0.1], 0.06, 0.045, 4));
    const kn = grp(hip, [0, -0.3, 0.1]);
    add(kn, 'shin', 'steel', () => merge([K.rod([0, 0, 0], [0, -0.32, -0.12], 0.045, 0.03, 4), xf(K.coneN(0.045, 0.22, 4), [0, -0.345, -0.03], [HP, 0, 0], [0.8, 1, 0.5])]));
    legs.push({ hip, kn, sd });
  }
  const muzzle = grp(torso, [0, 0.3, 0.45], null, 'muzzle');
  const anim = (dt, R) => {
    const wT = R.w.telegraph * R.teleS, wA = R.w.attack, wS = R.w.stunned, wD = R.w.dead;
    const busy = Math.max(R.w.telegraph, wA, wS, wD);
    const mv = clamp(R.spd / 4, 0, 1.2) * (1 - busy);
    R.phase += dt * R.spd * 2.9;
    const ph = R.phase, s1 = Math.sin(ph), c1 = Math.cos(ph), br = Math.sin(R.t * 1.7 + R.rnd);
    const crouch = 0.22 + 0.05 * br * (1 - mv) + 0.25 * wT + 0.18 * wA - 0.12 * mv + 0.1 * wS + 0.3 * wD;
    let drop = 0.62 - (0.62 * Math.cos(crouch) - 0.22 * Math.sin(crouch));
    for (const L of legs) {
      const s = L.sd > 0 ? s1 : -s1, c = L.sd > 0 ? c1 : -c1;
      L.hip.rotation.x = -crouch - s * 0.6 * mv;
      L.kn.rotation.x = 2 * crouch + Math.max(0, c) * 0.9 * mv;
    }
    pelvis.position.y = 0.72 - drop + Math.abs(c1) * 0.04 * mv - 0.15 * wD;
    const slash = R.st === 'attack' ? sstep(0, 0.18, R.stT) : 1;
    pelvis.position.z = 0.16 * wA * slash;
    torso.rotation.x = 0.15 + 0.4 * Math.min(mv, 1) + 0.15 * wT + 0.3 * wA * slash + 0.25 * wS + 0.5 * wD;
    torso.rotation.y = s1 * 0.15 * mv;
    torso.rotation.z = wS * Math.sin(R.t * 6) * 0.1;
    for (const A of arms) {
      let ax = lerp(-0.35 + 0.05 * br, 0.95, Math.min(mv, 1)), ex = lerp(-1.0, -0.3, Math.min(mv, 1)), az = 0.08 * A.sd;
      ax = lerp(ax, -2.3, wT); ex = lerp(ex, -0.6, wT); az = lerp(az, 0.35 * A.sd, wT);
      ax = lerp(ax, lerp(-2.3, 0.35, slash), wA); ex = lerp(ex, -0.15, wA); az = lerp(az, lerp(0.35, -0.5, slash) * A.sd, wA);
      ax = lerp(ax, 0.25, Math.max(wS, wD)); ex = lerp(ex, -0.2, Math.max(wS, wD));
      A.sh.rotation.x = ax; A.el.rotation.x = ex; A.sh.rotation.z = az;
    }
    yawP.rotation.y = R.yaw; pitchP.rotation.x = -R.pitch - torso.rotation.x * 0.6 + 0.4 * wS;
    edgeMat.userData.dyn = (0.32 + 0.68 * (1 - R.opacity) * (0.55 + 0.45 * Math.sin(R.t * 9.0 + Math.sin(R.t * 2.3) * 3))) * (1 - wD * 0.8);
  };
  return { radius: 0.6, height: 1.5, muzzle, weakPoint: null, anim, yawLimit: 1.0, pitchMin: -0.7, pitchMax: 0.5, aimSpace: torso, starY: 1.65 };
}

// ---------- SNIPER: tripod walker with long rail-rifle and laser sight ----------
function buildSniper(B) {
  const { K, add, grp, rig } = B;
  const hubY = 1.05;
  const hub = grp(rig, [0, hubY, 0], null, 'hub');
  const angs = [PI, PI / 3, -PI / 3];
  add(hub, 'hub', 'dark', () => merge([K.cyl(0.17, 0.21, 0.2, 14), ...angs.map((a) => xf(K.box(0.14, 0.1, 0.12, 0.03), [Math.sin(a) * 0.17, -0.02, Math.cos(a) * 0.17], [0, a, 0]))]));
  const legs = [];
  for (let i = 0; i < 3; i++) {
    const yawG = grp(hub, null, [0, angs[i], 0]);
    const lift = grp(yawG, [0, 0, 0.12]);
    add(lift, 'legU', 'steel', () => merge([xf(K.cyl(0.05, 0.05, 0.13, 10), 0, [0, 0, HP]), K.rod([0, 0, 0], [0, 0.2, 0.45], 0.045, 0.04, 8), xf(K.sph(0.06, 10, 8), [0, 0.2, 0.45])]));
    const kn = grp(lift, [0, 0.2, 0.45]);
    add(kn, 'legL', 'dark', () => merge([K.rod([0, 0, 0], [0, -1.25, 0.32], 0.04, 0.025, 8), xf(K.cyl(0.07, 0.09, 0.05, 12), [0, -1.225, 0.32])]));
    add(kn, 'legO', 'orange', () => K.rod([0, -0.33, 0.0845], [0, -0.43, 0.11], 0.05, 0.048, 10));
    legs.push({ yawG, lift, kn, base: angs[i], i });
  }
  const yawP = grp(hub, [0, 0.12, 0]); const pitchP = grp(yawP, [0, 0.2, 0], null, 'turret');
  add(pitchP, 'body', 'steel', () => merge([K.box(0.5, 0.36, 0.64, 0.1), xf(K.box(0.36, 0.1, 0.4, 0.04), [0, -0.2, -0.02])]));
  add(pitchP, 'bdark', 'dark', () => merge([
    xf(K.cyl(0.13, 0.13, 0.34, 14), [0, 0.25, 0.08], [HP, 0, 0]),
    xf(K.tor(0.12, 0.03, 6, 18), [0, 0.25, 0.26]),
    xf(K.box(0.08, 0.1, 0.12, 0.02), [0, 0.17, 0.0]),
    K.rod([0.17, 0.18, -0.24], [0.23, 0.62, -0.32], 0.012, 0.008, 5),
    xf(K.cyl(0.09, 0.09, 0.04, 10), [0.17, 0.02, -0.38], [0, 0, HP]),
    xf(K.cyl(0.09, 0.09, 0.04, 10), [-0.17, 0.02, -0.38], [0, 0, HP]),
    xf(K.box(0.3, 0.16, 0.1, 0.03), [0, -0.06, -0.33]),
  ]));
  add(pitchP, 'eye', 'glow', () => xf(K.sph(0.105, 14, 10), [0, 0.25, 0.255], 0, [1, 1, 0.5]));
  const cell = add(pitchP, 'cell', 'cyan', () => xf(K.cyl(0.07, 0.07, 0.3, 12), 0, [0, 0, HP]), [0, 0.02, -0.38]);
  const barrel = grp(pitchP, [0, 0, 0.3], null, 'barrel');
  add(barrel, 'barrel', 'dark', () => merge([
    xf(K.cyl(0.05, 0.06, 1.5, 12), [0, 0, 0.75], [HP, 0, 0]),
    xf(K.box(0.13, 0.13, 0.2, 0.03), [0, 0, 1.55]),
    xf(K.cyl(0.075, 0.075, 0.25, 12), [0, 0, 0.12], [HP, 0, 0]),
  ]));
  add(barrel, 'bands', 'orange', () => merge([xf(K.cyl(0.066, 0.066, 0.05, 12), [0, 0, 0.55], [HP, 0, 0]), xf(K.cyl(0.062, 0.062, 0.05, 12), [0, 0, 1.05], [HP, 0, 0])]));
  const muzzle = grp(barrel, [0, 0, 1.67], null, 'muzzle');
  const laser = add(muzzle, 'laser', 'laser', () => xf(new THREE.CylinderGeometry(0.018, 0.018, 60, 6, 1, true), [0, 0, 30], [HP, 0, 0]));
  laser.visible = false; laser.raycast = () => {}; laser.userData.noShadow = true; laser.name = 'laserSight'; laser.renderOrder = 3;
  const charge = add(muzzle, 'charge', 'glow', () => K.sph(0.05, 10, 8));
  const flash = addMuzzleFlash(B, muzzle, 0.16);
  const laserMat = laser.material;
  const anim = (dt, R) => {
    const wT = R.w.telegraph * R.teleS, wS = R.w.stunned, wD = R.w.dead;
    const mv = clamp(R.spd / 2, 0, 1) * (1 - R.w.telegraph) * (1 - wD) * (1 - wS);
    R.phase += dt * R.spd * 3;
    for (const L of legs) {
      const p = Math.sin(R.phase - (L.i * TAU) / 3);
      const lf = Math.pow(Math.max(0, p), 2) * 0.5 * mv;
      L.yawG.rotation.y = L.base + Math.cos(R.phase - (L.i * TAU) / 3) * 0.14 * mv;
      L.lift.rotation.x = -lf + wD * 0.35 + wS * 0.12 * Math.sin(R.t * 7 + L.i);
      L.kn.rotation.x = lf * 0.5 - wD * 0.5;
    }
    hub.position.y = hubY + Math.sin(R.phase * 3) * 0.015 * mv - wD * 0.45 - wS * 0.12;
    hub.rotation.z = wS * Math.sin(R.t * 6) * 0.08 + wD * 0.2;
    yawP.rotation.y = R.yaw; pitchP.rotation.x = -R.pitch + 0.35 * wS + 0.45 * wD;
    const kick = R.st === 'attack' ? Math.exp(-R.stT * 9) : 0;
    barrel.position.z = 0.3 - 0.22 * kick;
    const tele = R.st === 'telegraph' ? R.tele : 0;
    laser.visible = tele > 0.005;
    laserMat.userData.dyn = tele * (0.85 + 0.15 * Math.sin(R.t * 40));
    charge.visible = tele > 0.02; charge.scale.setScalar(0.4 + 1.4 * tele);
    flash.visible = R.st === 'attack' && R.stT < 0.07;
  };
  return { radius: 0.8, height: 1.75, muzzle, weakPoint: cell, anim, yawLimit: PI, pitchMin: -0.7, pitchMax: 0.7, aimSpace: hub, aimRate: 4, starY: 1.95, laser };
}

// ---------- TURRET: fixed base, rotating head with twin barrels ----------
function buildTurret(B) {
  const { K, add, grp, rig } = B;
  add(rig, 'base', 'dark', () => merge([
    xf(K.prism(0.8, 0.9, 0.3, 8), [0, 0.15, 0], [0, PI / 8, 0]),
    ...[...Array(8)].map((_, i) => xf(K.cyl(0.035, 0.035, 0.05, 6), [Math.sin((i * TAU) / 8 + PI / 8) * 0.72, 0.31, Math.cos((i * TAU) / 8 + PI / 8) * 0.72])),
  ]));
  add(rig, 'baseH', 'hazard', () => xf(new THREE.CylinderGeometry(0.84, 0.885, 0.14, 8, 1, true), [0, 0.15, 0], [0, PI / 8, 0]));
  add(rig, 'col', 'steel', () => merge([xf(K.prism(0.62, 0.72, 0.14, 8), [0, 0.37, 0], [0, PI / 8, 0]), xf(K.cyl(0.3, 0.36, 0.5, 16), [0, 0.68, 0])]));
  const yawP = grp(rig, [0, 0.95, 0], null, 'head');
  add(yawP, 'head', 'steel', () => merge([xf(K.box(0.95, 0.46, 0.85, 0.2), [0, 0.22, -0.02]), xf(K.sph(0.4, 18, 8, 0, TAU, 0, HP), [0, 0.42, -0.05], 0, [1, 0.45, 1])]));
  add(yawP, 'hdark', 'dark', () => merge([
    K.cyl(0.36, 0.36, 0.1, 18),
    xf(K.tor(0.13, 0.03, 6, 18), [0, 0.24, 0.42]),
    xf(K.box(0.42, 0.07, 0.1, 0.03), [0, 0.4, 0.37], [0.35, 0, 0]),
    xf(K.tor(0.15, 0.028, 6, 16), [0, 0.12, -0.5], [HP, 0, 0]),
    xf(K.tor(0.15, 0.028, 6, 16), [0, 0.38, -0.5], [HP, 0, 0]),
    K.rod([0.3, 0.45, -0.2], [0.34, 0.85, -0.25], 0.015, 0.01, 5),
  ]));
  add(yawP, 'eye', 'glow', () => xf(K.sph(0.115, 16, 12), [0, 0.24, 0.415], 0, [1, 1, 0.5]));
  const core = add(yawP, 'core', 'cyan', () => K.cyl(0.11, 0.11, 0.3, 12), [0, 0.25, -0.5]);
  const pitchP = grp(yawP, [0, 0.2, 0.05]);
  const barrels = [], muzzles = [];
  for (const sd of [1, -1]) {
    const bg = grp(pitchP, [0.36 * sd, 0, 0]);
    add(bg, 'barrel', 'dark', () => merge([xf(K.box(0.2, 0.22, 0.45, 0.05), [0, 0, 0.2]), xf(K.cyl(0.06, 0.065, 0.75, 12), [0, 0, 0.7], [HP, 0, 0]), xf(K.cyl(0.085, 0.085, 0.12, 12), [0, 0, 1.05], [HP, 0, 0])]));
    add(bg, 'bglow', 'glow', () => merge([xf(K.cyl(0.075, 0.075, 0.04, 12), [0, 0, 0.55], [HP, 0, 0]), xf(K.cyl(0.072, 0.072, 0.04, 12), [0, 0, 0.75], [HP, 0, 0])]));
    const mz = grp(bg, [0, 0, 1.13], null, 'muzzle' + (sd > 0 ? 'L' : 'R'));
    barrels.push({ bg, flash: addMuzzleFlash(B, mz, 0.16), sd });
    muzzles.push(mz);
  }
  const muzzle = grp(pitchP, [0, 0, 1.13], null, 'muzzle');
  const anim = (dt, R) => {
    const wT = R.w.telegraph * R.teleS, wS = R.w.stunned, wD = R.w.dead;
    yawP.rotation.y = R.yaw + wS * Math.sin(R.t * 5) * 0.25;
    pitchP.rotation.x = -R.pitch + 0.4 * wS + 0.55 * wD + wT * Math.sin(R.t * 60) * 0.01;
    const firing = R.st === 'attack';
    const f = R.stT * 8, which = Math.floor(f) % 2, local = f - Math.floor(f);
    for (let i = 0; i < 2; i++) {
      const b = barrels[i], on = firing && which === i;
      b.bg.position.z = on ? -0.15 * Math.exp(-local * 6) : 0;
      b.flash.visible = on && local < 0.35;
    }
  };
  const idleYaw = (R) => Math.sin(R.t * 0.5 + R.rnd) * 0.9;
  return { radius: 0.9, height: 1.6, muzzle, muzzles, weakPoint: core, anim, yawLimit: PI, pitchMin: -0.6, pitchMax: 0.7, aimSpace: rig, aimRate: 5, idleYaw, starY: 1.75 };
}

// ---------- JUMPER: frog-like hopper with telescopic spring legs ----------
function buildJumper(B) {
  const { K, add, grp, rig } = B;
  const body = grp(rig, [0, 0.55, 0], null, 'body');
  add(body, 'body', 'steel', () => merge([
    xf(K.sph(0.42, 22, 16), 0, 0, [1.1, 0.72, 1.05]),
    xf(K.sph(0.16, 14, 10), [0.2, 0.25, 0.16]),
    xf(K.sph(0.16, 14, 10), [-0.2, 0.25, 0.16]),
  ]));
  add(body, 'bdark', 'dark', () => merge([
    xf(K.sph(0.4, 18, 10, 0, TAU, HP, HP), [0, -0.02, 0], 0, [1.08, 0.8, 1.03]),
    xf(K.box(0.46, 0.07, 0.1, 0.03), [0, -0.01, 0.42], [-0.1, 0, 0]),
    xf(K.tor(0.095, 0.025, 6, 16), [0.2, 0.27, 0.305]),
    xf(K.tor(0.095, 0.025, 6, 16), [-0.2, 0.27, 0.305]),
  ]));
  add(body, 'borange', 'orange', () => merge([
    xf(K.box(0.17, 0.045, 0.09, 0.02), [0.2, 0.42, 0.24], [0.3, 0, 0.4]),
    xf(K.box(0.17, 0.045, 0.09, 0.02), [-0.2, 0.42, 0.24], [0.3, 0, -0.4]),
    xf(K.box(0.52, 0.05, 0.14, 0.02), [0, -0.08, 0.39], [-0.25, 0, 0]),
    xf(K.box(0.12, 0.06, 0.34, 0.03), [0, 0.3, -0.2], [-0.5, 0, 0]),
  ]));
  add(body, 'eyes', 'glow', () => merge([xf(K.sph(0.095, 14, 10), [0.2, 0.27, 0.3], 0, [1, 1, 0.5]), xf(K.sph(0.095, 14, 10), [-0.2, 0.27, 0.3], 0, [1, 1, 0.5])]));
  const mkLeg = (hipLocal, footRig, Lmax, big) => {
    const g = grp(rig);
    let spring = null;
    if (big) {
      add(g, 'hhouse', 'steel', () => merge([K.sph(0.1, 12, 10), K.capsule([0, 0, 0], [0, -0.16, 0], 0.08, 10)]));
      spring = add(g, 'spring', 'orange', () => K.spring(0.062, 0.3, 5, 0.016), [0, -0.14, 0]);
    }
    const rod = add(g, big ? 'hrod' : 'frod', 'dark', () => xf(K.cyl(big ? 0.028 : 0.035, big ? 0.028 : 0.03, 1, 8), [0, -0.5, 0]));
    const foot = grp(g);
    add(foot, big ? 'hfoot' : 'ffoot', 'dark', () => big
      ? merge([xf(K.box(0.2, 0.06, 0.34, 0.02), [0, 0.03, 0.08]), xf(K.sph(0.05, 8, 6), [0, 0.05, 0]), ...[-0.06, 0.06].map((x) => xf(K.cone(0.03, 0.1, 6), [x, 0.03, 0.27], [HP, 0, 0]))])
      : merge([xf(K.box(0.12, 0.05, 0.16, 0.02), [0, 0.025, 0.03]), xf(K.sph(0.045, 8, 6), [0, 0.04, 0])]));
    return { g, spring, rod, foot, hipLocal, footRig, Lmax };
  };
  const legs = [];
  for (const sd of [1, -1]) legs.push(mkLeg(new THREE.Vector3(0.33 * sd, -0.08, -0.16), new THREE.Vector3(0.46 * sd, 0, -0.34), 0.78, true));
  for (const sd of [1, -1]) legs.push(mkLeg(new THREE.Vector3(0.24 * sd, -0.14, 0.24), new THREE.Vector3(0.3 * sd, 0, 0.36), 0.55, false));
  const muzzle = grp(body, [0, 0, 0.5], null, 'muzzle');
  const hip = new THREE.Vector3(), foot = new THREE.Vector3(), dir = new THREE.Vector3();
  const anim = (dt, R) => {
    const wT = R.w.telegraph * R.teleS, wA = R.w.attack, wS = R.w.stunned, wD = R.w.dead;
    const mv = clamp(R.spd / 2.5, 0, 1) * (1 - R.w.telegraph) * (1 - wA) * (1 - wS) * (1 - wD);
    if (mv > 0.02) R.phase += dt * TAU * 1.5; else R.phase = damp(R.phase, Math.ceil(R.phase / PI) * PI, 4, dt);
    const h = Math.sin(R.phase), air = Math.max(0, h) * mv;
    const atkExt = R.st === 'attack' ? sstep(0, 0.08, R.stT) : 1;
    let ext = (h > 0 ? 0.6 * h : 0.5 * h) * mv + 0.04 * Math.sin(R.t * 2.2 + R.rnd);
    ext += -1.0 * wT + 1.0 * wA * atkExt - 0.5 * wS - 0.9 * wD;
    ext = clamp(ext, -1, 1);
    rig.position.y = 0.32 * air;
    body.position.y = 0.55 + (ext < 0 ? 0.19 * ext : 0.3 * ext);
    body.rotation.x = -0.25 * wT + 0.15 * wA - 0.12 * air + 0.06 * Math.min(0, h) * mv + 0.25 * wD;
    body.rotation.z = wS * Math.sin(R.t * 7) * 0.15;
    body.rotation.y = R.yaw;
    body.updateMatrix();
    for (const L of legs) {
      hip.copy(L.hipLocal).applyMatrix4(body.matrix);
      foot.copy(L.footRig); if (wA > 0) foot.z -= 0.08 * wA;
      dir.subVectors(foot, hip);
      let len = dir.length();
      if (len < 1e-4) { dir.set(0, -1, 0); len = 0.2; } else dir.divideScalar(len);
      len = clamp(len, 0.16, L.Lmax);
      L.g.position.copy(hip);
      L.g.quaternion.setFromUnitVectors(DOWN, dir);
      L.rod.scale.y = len;
      L.foot.position.set(0, -len, 0);
      L.foot.quaternion.copy(L.g.quaternion).invert();
      if (L.spring) L.spring.scale.y = clamp((len - 0.24) / 0.3, 0.25, 1.8);
    }
  };
  return { radius: 0.7, height: 1.0, muzzle, weakPoint: null, anim, yawLimit: 0.5, aimSpace: rig, starY: 1.2 };
}

// ---------- MINIBOSS: 3.5 m six-legged spider tank ----------
function buildMiniboss(B) {
  const { K, add, grp, rig, M } = B;
  const body = grp(rig, [0, 2.1, 0], null, 'body');
  add(body, 'hull', 'steel', () => merge([xf(K.prism(1.3, 1.12, 0.8, 6), 0, [0, PI / 6, 0]), xf(K.prism(1.0, 1.3, 0.22, 6), [0, 0.51, 0], [0, PI / 6, 0])]));
  const eyesBig = [[0.25, 0.12, 1.045, 0.13], [-0.25, 0.12, 1.045, 0.13]], eyesSmall = [[0.52, 0.22, 0.99, 0.065], [-0.52, 0.22, 0.99, 0.065], [0.1, 0.3, 1.03, 0.06], [-0.1, 0.3, 1.03, 0.06]];
  const allEyes = eyesBig.concat(eyesSmall);
  add(body, 'hdark', 'dark', () => merge([
    xf(K.prism(1.12, 0.75, 0.35, 6), [0, -0.575, 0], [0, PI / 6, 0]),
    xf(K.cyl(0.55, 0.6, 0.12, 20), [0, 0.66, 0.1]),
    xf(K.tor(0.42, 0.06, 6, 20), [0, 0.68, -0.78], [HP, 0, 0]),
    ...[0, 1, 2, 3].map((i) => xf(K.tor(0.4, 0.035, 4, 14, PI), [0, 0.68, -0.78], [0, (i * PI) / 4, 0])),
    K.rod([0.62, 0.6, -0.82], [0.78, 1.5, -1.0], 0.04, 0.025, 6),
    ...allEyes.map((e) => xf(K.tor(e[3] * 1.05, e[3] * 0.25, 6, 16), [e[0], e[1], e[2] + 0.01])),
    ...[0.62, 1.57, 2.5].flatMap((a) => [1, -1].map((sd) => xf(K.sph(0.24, 12, 10), [1.02 * Math.sin(a * sd), -0.1, 1.02 * Math.cos(a * sd)]))),
  ]));
  add(body, 'hhaz', 'hazard', () => xf(new THREE.CylinderGeometry(1.264, 1.223, 0.18, 6, 1, true), [0, 0.05, 0], [0, PI / 6, 0]));
  add(body, 'horange', 'orange', () => merge([
    xf(K.box(1.0, 0.22, 0.32, 0.06), [0, -0.38, 0.98]),
    ...[-0.3, 0, 0.3].map((x) => K.coneAt(0.07, 0.22, [x, -0.4, 1.12], [0, -0.3, 1], 8)),
    xf(K.sph(0.06, 8, 6), [0.78, 1.52, -1.0]),
  ]));
  add(body, 'eyes', 'glow', () => merge(allEyes.map((e) => xf(K.sph(e[3], 14, 10), [e[0], e[1], e[2]], 0, [1, 1, 0.55]))));
  const core = add(body, 'core', 'cyan', () => K.sph(0.36, 18, 12), [0, 0.68, -0.78]);
  const yawP = grp(body, [0, 0.72, 0.1], null, 'turret');
  add(yawP, 'turret', 'steel', () => merge([xf(K.box(1.05, 0.5, 1.15, 0.16), [0, 0.25, 0]), xf(K.box(0.7, 0.2, 0.7, 0.08), [0, 0.55, -0.1])]));
  const pitchP = grp(yawP, [0, 0.28, 0.45]);
  const cannon = grp(pitchP);
  add(cannon, 'cannon', 'dark', () => merge([
    xf(K.cyl(0.32, 0.32, 0.5, 16), [0, 0, 0.1], [HP, 0, 0]),
    xf(K.cyl(0.17, 0.2, 1.7, 16), [0, 0, 1.1], [HP, 0, 0]),
    xf(K.box(0.46, 0.46, 0.4, 0.08), [0, 0, 2.0]),
  ]));
  add(cannon, 'cband', 'orange', () => merge([xf(K.cyl(0.215, 0.215, 0.08, 16), [0, 0, 0.6], [HP, 0, 0]), xf(K.cyl(0.2, 0.2, 0.08, 16), [0, 0, 1.4], [HP, 0, 0])]));
  const muzzle = grp(cannon, [0, 0, 2.22], null, 'muzzle');
  const charge = add(muzzle, 'charge', 'glow', () => K.sph(0.2, 14, 10));
  const flash = addMuzzleFlash(B, muzzle, 0.45);
  const legs = [];
  const angs = [0.62, 1.57, 2.5];
  const fem = [0, 0.9, 1.0], tib = [0, -2.93, 0.835];
  const L1 = Math.hypot(fem[1], fem[2]), L2 = Math.hypot(tib[1], tib[2]);
  const rest1 = Math.atan2(fem[2], -fem[1]), rest2 = Math.atan2(tib[2], -tib[1]);
  for (const sd of [1, -1]) for (let j = 0; j < 3; j++) {
    const a = angs[j] * sd;
    const yawG = grp(body, [1.02 * Math.sin(a), -0.1, 1.02 * Math.cos(a)], [0, a, 0]);
    const lift = grp(yawG);
    add(lift, 'femur', 'steel', () => merge([K.capsule([0, 0, 0], fem, 0.15, 10), xf(K.sph(0.2, 12, 10), fem), xf(K.box(0.32, 0.12, 0.7, 0.05), [0, 0.6, 0.55], [-0.73, 0, 0])]));
    const kn = grp(lift, fem);
    add(kn, 'tibia', 'dark', () => merge([K.rod([0, 0, 0], [0, -1.2, 0.35], 0.21, 0.17, 10), K.rod([0, -1.2, 0.35], [0, -2.75, 0.81], 0.13, 0.07, 10), xf(K.cyl(0.24, 0.24, 0.14, 12), [0, -1.2, 0.35], [0.28, 0, 0]), K.rod([0, -0.2, -0.16], [0, -1.05, 0.1], 0.06, 0.06, 6), xf(K.cone(0.08, 0.2, 8), [0, -2.83, 0.83], [PI, 0, 0])]));
    legs.push({ yawG, lift, kn, a, sd, g: (j + (sd > 0 ? 0 : 1)) % 2 });
  }
  const cyanM = M.get('cyan');
  const anim = (dt, R) => {
    const wT = R.w.telegraph * R.teleS, wA = R.w.attack, wS = R.w.stunned, wD = R.w.dead;
    const mv = clamp(R.spd / 2.5, 0, 1) * (1 - R.w.telegraph) * (1 - wS) * (1 - wD);
    R.phase += dt * R.spd * 1.5;
    const br = Math.sin(R.t * 1.4 + R.rnd);
    const kick = R.st === 'attack' ? Math.exp(-R.stT * 7) : 0;
    const by = 2.1 + Math.abs(Math.sin(R.phase)) * 0.06 * mv + 0.02 * br - 0.25 * wT - 0.45 * wS - 1.0 * wD;
    body.position.y = by;
    body.position.z = -0.15 * kick;
    body.rotation.x = -0.05 * kick + 0.04 * wS + 0.12 * wD;
    body.rotation.z = Math.sin(R.phase) * 0.03 * mv + wS * Math.sin(R.t * 4) * 0.05 + 0.1 * wD;
    for (const L of legs) {
      const ph = R.phase + L.g * PI;
      const sw = Math.sin(ph) * 0.2 * mv, lf = Math.max(0, Math.cos(ph)) * 0.5 * mv;
      L.yawG.rotation.y = L.a - L.sd * sw;
      const spread = 0.15 * wT + 0.2 * wS + 0.35 * wD;
      ik2(L.lift, L.kn, L1, L2, rest1, rest2, -(by - 0.1) + lf, 1.87 + spread, 1);
    }
    yawP.rotation.y = R.yaw; pitchP.rotation.x = -R.pitch + 0.25 * wS + 0.4 * wD;
    cannon.position.z = -0.35 * kick;
    charge.visible = R.st === 'telegraph' && R.teleS > 0.02; charge.scale.setScalar(0.3 + 1.1 * R.teleS);
    flash.visible = R.st === 'attack' && R.stT < 0.09;
    cyanM.userData.emMul = (1 + 0.25 * Math.sin(R.t * 3.5)) * (1 + 0.6 * wS);
  };
  return { radius: 2.2, height: 3.5, muzzle, weakPoint: core, anim, yawLimit: PI, pitchMin: -0.5, pitchMax: 0.5, aimSpace: body, aimRate: 2.5, starY: 3.9, starScale: 3 };
}

const ROBOT_BUILD = {
  crawler: buildCrawler, drone: buildDrone, roller: buildRoller, heavy: buildHeavy, shield: buildShield,
  stealth: buildStealth, sniper: buildSniper, turret: buildTurret, jumper: buildJumper, miniboss: buildMiniboss,
};
const ROBOT_STATES = new Set(['idle', 'patrol', 'chase', 'telegraph', 'attack', 'stunned', 'dead']);

/**
 * createRobot(type, quality 0..1) -> Robot
 * { root, radius, height, muzzle, weakPoint, update(dt, s), setFlash(x), setOpacity(a), aim(dir|null), dispose() }
 */
export function createRobot(type, quality = 0.5) {
  if (!ROBOT_BUILD[type]) { console.warn('[robots] unknown robot type', type); type = 'crawler'; }
  const qb = qBucket(quality);
  const K = makeKit(qb);
  const M = new MatSet(qb, { flat: type === 'stealth' });
  const root = new THREE.Group(); root.name = 'Robot:' + type;
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const B = makeBuilder(type, qb, K, M, root, rig, 1);
  const d = ROBOT_BUILD[type](B);
  root.traverse((o) => {
    if (o.isMesh) { const tr = o.material.transparent || o.userData.noShadow; o.castShadow = !tr; o.receiveShadow = !o.material.transparent; }
  });
  // dizzy stars while stunned
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3).setUsage(THREE.DynamicDrawUsage));
  const stars = new THREE.Points(starGeo, starMaterial());
  stars.position.y = d.starY || d.height + 0.2; stars.visible = false; stars.frustumCulled = false; stars.name = 'stunStars';
  rig.add(stars);
  const starR = 0.28 * (d.starScale || 1);

  const R = {
    t: 0, st: 'idle', stT: 0, speed: 0, spd: 0, tele: 0, teleS: 0,
    w: { telegraph: 0, attack: 0, stunned: 0, dead: 0 },
    yaw: 0, pitch: 0, aimDir: new THREE.Vector3(0, 0, 1), hasAim: false,
    flash: 0, opacity: 1, phase: 0, rnd: Math.random() * 100,
  };
  const yawLim = d.yawLimit ?? 1.0, pMin = d.pitchMin ?? -0.6, pMax = d.pitchMax ?? 0.6, aimRate = d.aimRate ?? 7;
  const aimSpace = d.aimSpace || rig;
  const glowM = M.get('glow');
  let shadowOn = true;
  const apply = () => M.apply(R.flash, R.opacity, R.teleS, R.t);

  const api = {
    type, root, radius: d.radius, height: d.height, muzzle: d.muzzle, weakPoint: d.weakPoint || null,
    muzzles: d.muzzles || [d.muzzle], laser: d.laser || null, quality: qb,
    update(dt, s) {
      dt = clamp(fin(dt, 0), 0, 0.1);
      s = s || {};
      const st = ROBOT_STATES.has(s.state) ? s.state : 'idle';
      if (st !== R.st) { R.st = st; R.stT = 0; } else R.stT += dt;
      R.t += dt;
      R.speed = Math.abs(fin(s.speed, 0));
      R.spd = damp(R.spd, R.speed, 8, dt);
      R.tele = clamp01(fin(s.telegraph, 0));
      R.teleS = damp(R.teleS, R.tele, 20, dt);
      R.w.telegraph = damp(R.w.telegraph, st === 'telegraph' ? 1 : 0, 10, dt);
      R.w.attack = damp(R.w.attack, st === 'attack' ? 1 : 0, 12, dt);
      R.w.stunned = damp(R.w.stunned, st === 'stunned' ? 1 : 0, 8, dt);
      R.w.dead = damp(R.w.dead, st === 'dead' ? 1 : 0, 5, dt);
      // aim (smoothed yaw/pitch in aimSpace)
      let ty = d.idleYaw ? d.idleYaw(R) : 0, tp = 0;
      if (R.hasAim && st !== 'stunned' && st !== 'dead') {
        aimSpace.getWorldQuaternion(_q2).invert();
        _v5.copy(R.aimDir).applyQuaternion(_q2);
        ty = Math.atan2(_v5.x, _v5.z);
        tp = Math.atan2(_v5.y, Math.hypot(_v5.x, _v5.z));
      }
      if (yawLim < PI) ty = clamp(ty, -yawLim, yawLim);
      tp = clamp(tp, pMin, pMax);
      const k = 1 - Math.exp(-aimRate * dt);
      R.yaw = yawLim >= PI ? wrapPi(R.yaw + wrapPi(ty - R.yaw) * k) : R.yaw + (ty - R.yaw) * k;
      R.pitch += (tp - R.pitch) * k;
      glowM.userData.emMul = eyeMul(R);
      d.anim(dt, R, s);
      // stun stars
      stars.visible = R.w.stunned > 0.3;
      if (stars.visible) {
        const a = starGeo.attributes.position;
        for (let i = 0; i < 3; i++) { const an = R.t * 4 + (i * TAU) / 3; a.setXYZ(i, Math.cos(an) * starR, 0.05 * Math.sin(R.t * 6 + i), Math.sin(an) * starR); }
        a.needsUpdate = true;
      }
      apply();
    },
    setFlash(x) { R.flash = clamp01(fin(x, 0)); apply(); },
    setOpacity(a) {
      R.opacity = clamp01(fin(a, 1));
      const on = R.opacity > 0.5;
      if (on !== shadowOn) { shadowOn = on; root.traverse((o) => { if (o.isMesh && !o.material.userData.transpBase && !o.userData.noShadow) o.castShadow = on; }); }
      apply();
    },
    aim(dir) {
      if (dir && Number.isFinite(dir.x) && Number.isFinite(dir.y) && Number.isFinite(dir.z) && dir.x * dir.x + dir.y * dir.y + dir.z * dir.z > 1e-10) {
        R.aimDir.set(dir.x, dir.y, dir.z).normalize(); R.hasAim = true;
      } else R.hasAim = false;
    },
    dispose() { root.removeFromParent(); M.dispose(); starGeo.dispose(); },
  };
  root.userData.robot = api;
  api.update(0, { state: 'idle' });
  return api;
}

/* =====================================================================================
 * BOSSES
 * ===================================================================================== */

// ---------- TITAN: 14 m bipedal siege walker ----------
function buildTitan(B) {
  const { K, add, grp, rig, M } = B;
  const parts = {};
  const hips = grp(rig, [0, 7.4, 0], null, 'pelvis');
  parts.pelvis = hips;
  add(hips, 'pelvis', 'dark', () => merge([K.box(3.4, 1.3, 2.3, 0.35), xf(K.cyl(0.75, 0.75, 3.9, 16), [0, -0.3, 0], [0, 0, HP])]));
  add(hips, 'codpiece', 'hazard', () => merge([xf(K.box(1.5, 1.1, 0.4, 0.12), [0, -0.15, 1.2], [0.12, 0, 0]), xf(K.box(1.3, 0.9, 0.35, 0.12), [0, -0.05, -1.2], [-0.1, 0, 0])]));
  const legs = [];
  for (const sd of [1, -1]) {
    const hip = grp(hips, [1.55 * sd, -0.3, 0], null, 'hip' + (sd > 0 ? 'L' : 'R'));
    add(hip, 'thigh', 'steel', () => merge([K.sph(0.85, 16, 12), xf(K.box(1.3, 2.9, 1.4, 0.3), [0, -1.65, 0])]));
    add(hip, 'thighA', 'hazard', () => xf(K.box(1.0, 1.7, 0.3, 0.1), [0, -1.45, 0.76], [-0.05, 0, 0]));
    const kn = grp(hip, [0, -3.3, 0]);
    add(kn, 'shin', 'steel', () => merge([xf(K.cyl(0.72, 0.72, 1.45, 16), 0, [0, 0, HP]), xf(K.tbox(1.6, 1.8, 3.1, 0.8, 0.85, 0.35), [0, -1.8, 0], [HP, 0, 0])]));
    add(kn, 'kneeA', 'orange', () => merge([xf(K.box(1.3, 1.25, 0.5, 0.2), [0, -0.15, 0.85], [0.15, 0, 0]), xf(K.coneN(0.25, 0.7, 4), [0, -0.1, 1.2], [HP, PI / 4, 0])]));
    add(kn, 'shinD', 'dark', () => merge([K.rod([0, -0.6, -0.95], [0, -3.0, -0.8], 0.2, 0.2, 10), xf(K.cyl(0.32, 0.32, 0.4, 10), [0, -0.6, -0.95]), K.rod([0.5, -0.9, -0.88], [0.5, -2.8, -0.75], 0.11, 0.11, 8), K.rod([-0.5, -0.9, -0.88], [-0.5, -2.8, -0.75], 0.11, 0.11, 8)]));
    const ank = grp(kn, [0, -3.5, 0], null, 'foot' + (sd > 0 ? 'L' : 'R'));
    add(ank, 'foot', 'steel', () => merge([K.sph(0.62, 14, 10), xf(K.tbox(2.1, 0.9, 3.2, 0.9, 0.7, 0.25, 'bottom'), [0, -0.45, 0.45])]));
    add(ank, 'toes', 'orange', () => merge([-0.65, 0, 0.65].map((x) => xf(K.tbox(0.55, 0.5, 0.8, 0.75, 0.55, 0.1, 'bottom'), [x, -0.65, 2.2]))));
    add(ank, 'heel', 'dark', () => xf(K.tbox(1.0, 0.5, 0.9, 0.7, 0.6, 0.1, 'bottom'), [0, -0.65, -1.4], [0, PI, 0]));
    legs.push({ hip, kn, ank, sd, L1: 3.3, L2: 3.5 });
  }
  parts.footL = legs[0].ank; parts.footR = legs[1].ank; parts.stompFoot = legs[1].ank;
  const waist = grp(hips, [0, 0.5, 0], null, 'torso');
  parts.torso = waist;
  add(waist, 'abdomen', 'dark', () => merge([
    xf(K.cyl(1.3, 1.5, 1.3, 18), [0, 0.3, 0]),
    xf(K.tor(0.86, 0.2, 8, 24), [0, 1.9, 1.5]),
    xf(K.box(1.2, 0.8, 1.0, 0.2), [0, 4.4, 0.15]),
    ...[-1, 1].map((sd) => xf(K.box(0.25, 1.6, 0.6, 0.08), [2.55 * sd, 2.3, 0.6])),
    ...[-1, 1].flatMap((sd) => [0, 1, 2].map((i) => xf(K.box(0.9, 0.12, 0.2, 0.04), [1.8 * sd, 0.95 + i * 0.25, 1.52]))),
  ]));
  add(waist, 'chest', 'steel', () => merge([
    xf(K.box(5.0, 3.3, 3.1, 0.55), [0, 2.55, -0.05]),
    xf(K.box(6.6, 1.3, 2.5, 0.4), [0, 3.75, -0.15]),
    xf(K.box(3.6, 1.6, 1.4, 0.4), [0, 2.9, -1.6]),
  ]));
  const crown = new THREE.Shape();
  [[-0.8, 0], [0.8, 0], [0.8, 0.55], [0.42, 0.28], [0, 0.72], [-0.42, 0.28], [-0.8, 0.55]].forEach((p, i) => (i ? crown.lineTo(p[0], p[1]) : crown.moveTo(p[0], p[1])));
  add(waist, 'emblem', 'orange', () => merge([xf(K.ext(crown, 0.15, 0.04), [0, 3.35, 1.43]), xf(K.box(2.6, 0.18, 0.2, 0.05), [0, 3.15, 1.5])]));
  const core = add(waist, 'core', 'cyan', () => K.sph(0.72, 20, 16), [0, 1.9, 0.85]);
  parts.core = core;
  const doors = [];
  for (const sd of [1, -1]) {
    const hinge = grp(waist, [1.3 * sd, 1.9, 1.62], null, 'coreDoor' + (sd > 0 ? 'L' : 'R'));
    add(hinge, 'door' + sd, 'steel', () => xf(K.box(1.3, 2.1, 0.36, 0.12), [-0.65 * sd, 0, 0.18]));
    add(hinge, 'doorH' + sd, 'hazard', () => xf(K.box(0.28, 2.14, 0.4, 0.08), [-1.14 * sd, 0, 0.19]));
    doors.push({ hinge, sd });
  }
  parts.coreDoors = doors.map((d) => d.hinge);
  const neck = grp(waist, [0, 4.35, 0.3], null, 'head');
  neck.scale.setScalar(1.25);
  parts.head = neck;
  add(neck, 'head', 'steel', () => merge([xf(K.tbox(1.8, 1.25, 1.7, 0.85, 0.8, 0.35), [0, 0.7, 0.1]), xf(K.box(1.0, 0.5, 0.9, 0.15), [0, 0.05, -0.1])]));
  add(neck, 'headD', 'dark', () => merge([xf(K.box(1.25, 0.42, 0.42, 0.12), [0, 0.32, 0.86]), K.rod([0.62, 1.2, -0.4], [0.78, 2.35, -0.72], 0.07, 0.035, 6)]));
  add(neck, 'visor', 'glow', () => merge([
    xf(K.box(0.62, 0.17, 0.14, 0.05), [0.33, 0.74, 0.92], [0, 0.12, 0.13]),
    xf(K.box(0.62, 0.17, 0.14, 0.05), [-0.33, 0.74, 0.92], [0, -0.12, -0.13]),
    xf(K.sph(0.06, 8, 6), [0.78, 2.36, -0.72]),
  ]));
  const horns = add(neck, 'horns', 'orange', () => merge([1, -1].map((sd) => K.coneAt(0.26, 1.7, [0.55 * sd, 1.15, 0.15], [0.38 * sd, 0.75, -0.6], 10))));
  parts.horns = horns;
  const arms = [];
  for (const sd of [1, -1]) {
    const sh = grp(waist, [3.65 * sd, 3.35, -0.1], null, 'shoulder' + (sd > 0 ? 'L' : 'R'));
    add(sh, 'shoulderJ', 'dark', () => K.sph(1.0, 16, 12));
    const pad = add(sh, 'pad' + sd, 'hazard', () => xf(K.box(2.1, 0.7, 2.6, 0.28), [0.3 * sd, 1.0, 0], [0, 0, -0.22 * sd]));
    const el = grp(sh, [0, -3.0, 0]);
    add(sh, 'uarm', 'steel', () => xf(K.box(1.25, 2.4, 1.35, 0.3), [0, -1.55, 0]));
    if (sd > 0) {
      add(el, 'farmL', 'steel', () => xf(K.box(1.45, 2.3, 1.55, 0.35), [0, -1.25, 0.05]));
      add(el, 'fistL', 'dark', () => merge([K.sph(0.75, 14, 10), xf(K.box(1.7, 1.4, 1.7, 0.35), [0, -2.95, 0.1])]));
      add(el, 'knuckL', 'orange', () => merge([xf(K.box(1.75, 0.38, 0.5, 0.12), [0, -2.65, 0.92]), ...[-0.5, 0, 0.5].map((x) => K.coneAt(0.16, 0.5, [x, -2.65, 1.1], [0, 0, 1], 8))]));
    } else {
      add(el, 'farmR', 'steel', () => xf(K.box(1.4, 1.9, 1.5, 0.35), [0, -1.0, 0]));
      add(el, 'cannonR', 'dark', () => merge([K.sph(0.75, 14, 10), xf(K.cyl(0.5, 0.6, 2.6, 18), [0, -3.0, 0]), xf(K.cyl(0.72, 0.72, 0.5, 18), [0, -4.4, 0])]));
      add(el, 'coils', 'glow2', () => merge([...[-2.2, -2.9, -3.6].map((y) => xf(K.tor(0.62, 0.1, 6, 24), [0, y, 0], [HP, 0, 0])), xf(K.cyl(0.36, 0.36, 0.1, 16), [0, -4.66, 0])]));
      const lm = grp(el, [0, -4.75, 0], [HP, 0, 0], 'laserMuzzle');
      parts.laserMuzzle = lm;
      parts.laserCharge = add(lm, 'lcharge', 'glow2', () => K.sph(0.5, 14, 10));
    }
    arms.push({ sh, el, sd, pad });
  }
  parts.laserArm = arms[1].sh; parts.fist = arms[0].el;
  parts.missileMuzzles = []; parts.missilePods = [];
  const pods = [];
  const tubes = [];
  for (const c of [-0.5, 0, 0.5]) for (const r of [0.3, 0.72]) tubes.push([c, r]);
  for (const sd of [1, -1]) {
    const pod = grp(waist, [2.3 * sd, 4.42, -0.6], null, 'missilePod' + (sd > 0 ? 'L' : 'R'));
    add(pod, 'pod', 'steel', () => xf(K.box(1.8, 1.05, 2.2, 0.2), [0, 0.52, 0]));
    add(pod, 'podD', 'dark', () => merge([...tubes.map(([c, r]) => xf(K.cyl(0.2, 0.2, 0.3, 12), [c, r, 1.12], [HP, 0, 0])), xf(K.box(1.0, 0.3, 1.4, 0.1), [0, -0.08, 0])]));
    add(pod, 'podG', 'glow', () => merge(tubes.map(([c, r]) => xf(K.cyl(0.14, 0.14, 0.04, 12), [c, r, 1.25], [HP, 0, 0]))));
    const lid = grp(pod, [0, 1.05, 1.18]);
    add(lid, 'lid', 'hazard', () => xf(K.box(1.75, 0.98, 0.14, 0.06), [0, -0.5, 0.2]));
    for (const [c, r] of tubes) parts.missileMuzzles.push(grp(pod, [c, r, 1.32], null, 'missileMuzzle'));
    pods.push({ pod, lid, sd });
    parts.missilePods.push(pod);
  }
  const anchors = [arms[0].sh, arms[1].sh, legs[0].kn, legs[1].kn, neck, core, pods[0].pod, pods[1].pod];
  const W = { walk: 0, stomp: 0, missiles: 0, laser: 0, stunned: 0, dying: 0 };
  let walkPh = 0, shake = 0, impactT = -1;
  const glow2 = M.get('glow2'), glow = M.get('glow');
  const P = { hy: 7.4, hx: 0, lx: 0, lz: 0, ly: 0, rz: 0, ry: 0, lp: 0, rp: 0, lean: 0, twist: 0, roll: 0, aLx: 0, aLz: 0.12, eL: -0.2, aRx: 0, aRz: -0.12, eR: -0.2, head: 0, pod: 0, lid: 0 };
  const T = {};
  const blend = (w) => { if (w <= 0) return; for (const k in T) P[k] = lerp(P[k], T[k], w); };
  const anim = (dt, R, s) => {
    const st = R.st, t = R.t2;
    for (const k in W) W[k] = damp(W[k], st === k ? 1 : 0, k === 'dying' ? 2.5 : 6, dt);
    if (st === 'stomp') W.stomp = Math.max(W.stomp, sstep(0, 0.15, t));
    const br = Math.sin(R.t * 1.2);
    // idle base
    Object.assign(P, { hy: 7.4 + 0.05 * br, hx: 0, lx: 0, lz: 0.15, ly: 0, rz: -0.15, ry: 0, lp: 0, rp: 0, lean: 0.02 * br, twist: 0, roll: 0, aLx: 0.05 * br, aLz: 0.14, eL: -0.25, aRx: 0.05 * br, aRz: -0.14, eR: -0.25, head: 0.04 * br, pod: 0, lid: 0 });
    // walk
    const v = st === 'walk' ? Math.max(fin(s.speed, 0), 1.6) : 0;
    walkPh += dt * PI * v / 3.6;
    if (W.walk > 0.001) {
      const gl = gait(walkPh, 3.6, 1.1, [0, 0]), gr = gait(walkPh + PI, 3.6, 1.1, [0, 0]);
      const sw = Math.sin(walkPh);
      for (const k in T) delete T[k];
      Object.assign(T, { hy: 7.25 - 0.2 * (0.5 + 0.5 * Math.cos(2 * walkPh)), lz: gl[0], ly: gl[1], rz: gr[0], ry: gr[1], lp: -0.15 * gl[1], rp: -0.15 * gr[1], roll: sw * 0.05, twist: sw * 0.08, hx: sw * 0.25, aLx: sw * 0.25, aRx: -sw * 0.25, lean: 0.04 });
      blend(W.walk);
    }
    // stomp (slam at t = 0.8)
    if (W.stomp > 0.001) {
      let y, z;
      if (t < 0.55) { const u = sstep(0, 0.55, t); y = 3.2 * u; z = 1.4 * u; }
      else if (t < 0.7) { y = 3.2 + 0.3 * sstep(0.55, 0.7, t); z = 1.4; }
      else if (t < 0.8) { const u = (t - 0.7) / 0.1; y = 3.5 * (1 - u * u); z = 1.4 + 0.35 * u; }
      else { y = 0; z = 1.75; }
      const imp = t >= 0.8 ? Math.exp(-(t - 0.8) * 7) : 0;
      const sh = t < 0.8 ? sstep(0, 0.4, t) : 1 - sstep(0.85, 1.4, t);
      const armS = t < 0.8 ? -0.95 * sstep(0, 0.6, t) : lerp(lerp(-0.95, 0.35, sstep(0.8, 0.88, t)), 0, sstep(0.95, 1.3, t));
      for (const k in T) delete T[k];
      Object.assign(T, {
        hy: 7.4 - 0.15 * sh - 0.7 * imp, hx: 0.75 * sh, ry: y, rz: z, rp: -0.35 * sstep(0.1, 0.55, t) * (t < 0.78 ? 1 : 0), lz: -0.2,
        lean: -0.1 * sstep(0, 0.6, t) * (t < 0.8 ? 1 : 0) + 0.2 * imp, roll: -0.08 * sh,
        aLx: armS, aRx: armS, aLz: 0.4 - 0.15 * imp, aRz: -0.4 + 0.15 * imp, eL: -0.6 + 0.4 * imp, eR: -0.6 + 0.4 * imp,
      });
      blend(W.stomp);
      if (st === 'stomp' && t >= 0.8 && impactT < 0) { impactT = 0; shake = 0.35; }
    }
    if (st !== 'stomp') impactT = -1;
    // missiles
    if (W.missiles > 0.001) {
      const k = st === 'missiles' ? sstep(0, 0.5, t) : 1;
      for (const kk in T) delete T[kk];
      Object.assign(T, { pod: k, lid: k, lean: -0.07, aLz: 0.3, aRz: -0.3, head: -0.1 });
      blend(W.missiles);
    }
    // arm laser
    if (W.laser > 0.001) {
      const k = st === 'laser' ? sstep(0, 0.6, t) : 1;
      for (const kk in T) delete T[kk];
      Object.assign(T, { aRx: -1.52 * k, aRz: -0.05, eR: 0, twist: 0.12 * k, lean: 0.03, head: 0.06 });
      blend(W.laser);
    }
    // stunned: kneel (core reachable ~4-5 m)
    if (W.stunned > 0.001) {
      for (const kk in T) delete T[kk];
      Object.assign(T, { hy: 3.5, hx: 0.1, lz: 2.0, ly: 0, lp: 0, rz: -1.15, ry: 0, rp: 0.9, lean: 0.7 + 0.03 * Math.sin(R.t * 2), roll: 0.05, twist: 0.06,
        aLx: -0.35, aLz: 0.45, eL: -0.3, aRx: 0.25, aRz: -0.4, eR: -0.25, head: -0.1 });
      blend(W.stunned);
    }
    // dying: shaking, slumping
    if (W.dying > 0.001) {
      const k = st === 'dying' ? sstep(0, 3.5, t) : 1;
      for (const kk in T) delete T[kk];
      Object.assign(T, { hy: lerp(6.6, 4.4, k), hx: -0.3 * k, lz: 1.6, rz: -2.4 * k, ry: 0, rp: 0.9 * k, lean: lerp(0.3, 0.75, k), roll: 0.18 * k, twist: -0.1,
        aLx: 0.25, aLz: 0.35, eL: -0.1, aRx: 0.3, aRz: -0.45, eR: -0.1, head: 0.5 * k });
      blend(W.dying);
    }
    // apply pose
    shake = Math.max(0, shake - dt * 0.9);
    const shk = shake + W.dying * (st === 'dying' ? 0.12 * (1 - sstep(3, 4.5, t)) : 0) + W.stunned * 0.01;
    rig.position.set((Math.random() - 0.5) * shk, (Math.random() - 0.5) * shk * 0.5, (Math.random() - 0.5) * shk);
    hips.position.set(P.hx, P.hy, 0);
    const L = legs[0], Rl = legs[1];
    legIK(L, 0.9 + P.ly - (P.hy - 0.3), P.lz, P.lp);
    legIK(Rl, 0.9 + P.ry - (P.hy - 0.3), P.rz, P.rp);
    for (const l of legs) l.hip.rotation.z = -Math.asin(clamp(P.hx / 6.6, -0.5, 0.5));
    waist.rotation.set(P.lean, P.twist, P.roll);
    neck.rotation.x = P.head;
    arms[0].sh.rotation.set(P.aLx, 0, P.aLz); arms[0].el.rotation.x = P.eL;
    arms[1].sh.rotation.set(P.aRx, 0, P.aRz); arms[1].el.rotation.x = P.eR;
    for (const p of pods) { p.pod.rotation.x = -0.65 * P.pod; p.lid.rotation.x = -1.9 * P.lid; }
    const open = clamp01(fin(s.coreOpen, 0));
    for (const dr of doors) dr.hinge.rotation.y = dr.sd * 1.75 * open;
    // glows
    const laserK = st === 'laser' ? sstep(0.15, 1.0, t) : 0;
    R.laserK = damp(R.laserK || 0, laserK, 10, dt);
    glow2.userData.emMul = 1 + 2.5 * R.laserK;
    parts.laserCharge.visible = R.laserK > 0.02;
    parts.laserCharge.scale.setScalar(0.2 + 1.1 * R.laserK * (0.9 + 0.1 * Math.sin(R.t * 30)));
    let eye = 1;
    if (W.stunned > 0.05) eye *= 1 - 0.6 * W.stunned * (0.5 + 0.5 * Math.sin(R.t * 23));
    if (st === 'dying') eye *= hash(Math.floor(R.t * 18)) > 0.3 + 0.6 * sstep(1, 4, t) ? 1 : 0.05;
    if (R.phase >= 3) eye *= hash(Math.floor(R.t * 9)) > 0.15 ? 1 : 0.3;
    glow.userData.emMul = eye * (R.phase >= 2 ? 1.25 : 1);
    M.get('cyan').userData.emMul = (1 + 0.25 * Math.sin(R.t * 4)) * (1 + 0.6 * open);
    R.teleOut = W.missiles * (st === 'missiles' ? sstep(0, 0.6, t) * 0.6 : 0);
  };
  const onPhase = (n) => {
    horns.visible = n < 3;
    arms[1].pad.rotation.set(n >= 2 ? 0.25 : 0, 0, n >= 2 ? -0.35 : 0);
    arms[0].pad.visible = n < 3;
  };
  return { parts, weakPoints: [core], anim, anchors, onPhase, sparkSize: 0.5, sparkSpeed: 6 };
}

// ---------- WYRM: mechanical magma serpent (game drives the head) ----------
function buildWyrm(B) {
  const { K, add, grp, root, M } = B;
  const parts = {};
  const head = new THREE.Group(); head.name = 'wyrmHead'; root.add(head);
  const hr = grp(head, null, null, 'headRig');
  hr.scale.setScalar(1.08);
  add(hr, 'skull', 'steel', () => merge([
    xf(K.tbox(1.5, 0.8, 2.8, 0.55, 0.62, 0.22), [0, 0.25, 0.35]),
    xf(K.box(1.75, 1.15, 1.35, 0.32), [0, 0.38, -0.75]),
    ...[-1, 1].flatMap((sd) => [0, 1, 2, 3, 4].map((i) => K.coneAt(0.07, 0.3, [sd * (0.62 - i * 0.07), -0.08, 1.45 - i * 0.42], [0, -1, 0.15], 6))),
  ]));
  add(hr, 'skullD', 'dark', () => merge([
    ...[-1, 1].map((sd) => xf(K.tbox(0.5, 0.25, 1.4, 0.6, 0.6, 0.06), [0.6 * sd, 0.72, 0.15], [0.1, -0.25 * sd, 0])),
    ...[-1, 1].map((sd) => K.coneAt(0.24, 1.9, [0.55 * sd, 0.85, -0.95], [0.32 * sd, 0.42, -0.9], 10)),
    xf(K.cyl(0.95, 1.05, 0.5, 18), [0, 0.15, -1.45], [HP, 0, 0]),
    xf(K.tor(0.6, 0.12, 6, 18), [0, -0.68, -0.95], [HP, 0, 0]),
  ]));
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.7, 0); finShape.lineTo(0.5, 0); finShape.quadraticCurveTo(0.05, 0.35, -0.55, 1.0); finShape.lineTo(-0.7, 0);
  const finGeo = (s) => xf(xf(K.ext(finShape, 0.12, 0.03), [0, 0, -0.06]), 0, [0, -HP, 0], s);
  add(hr, 'crest', 'orange', () => merge([
    xf(finGeo([1, 1, 1]), [0, 0.92, 0.2]), xf(finGeo([0.8, 0.8, 1]), [0, 0.92, -0.55]), xf(finGeo([0.6, 0.6, 1]), [0, 0.88, -1.15]),
    ...[-1, 1].map((sd) => K.coneAt(0.09, 0.4, [0.55 * sd + 0.32 * sd * 1.8, 0.85 + 0.42 * 1.8 * 0.95, -0.95 - 0.9 * 1.8 * 0.95], [0.32 * sd, 0.42, -0.9], 8)),
  ]));
  add(hr, 'eyes', 'glow', () => merge([-1, 1].map((sd) => xf(K.box(0.16, 0.2, 0.7, 0.05), [0.7 * sd, 0.55, 0.3], [0.12, 0.32 * sd, -0.2 * sd]))));
  add(hr, 'palate', 'mouth', () => xf(K.box(0.95, 0.1, 2.2, 0.04), [0, -0.02, 0.45]));
  const orb = add(hr, 'orb', 'mouth', () => K.sph(0.4, 16, 12), [0, -0.25, 1.1]);
  const jaw = grp(hr, [0, -0.05, -0.75], null, 'jaw');
  add(jaw, 'jaw', 'steel', () => merge([
    xf(K.tbox(1.3, 0.42, 2.5, 0.6, 0.65, 0.16), [0, -0.27, 1.2]),
    ...[-1, 1].flatMap((sd) => [0, 1, 2, 3].map((i) => K.coneAt(0.06, 0.26, [sd * (0.5 - i * 0.07), -0.08, 2.15 - i * 0.42], [0, 1, 0.1], 6))),
  ]));
  add(jaw, 'tongue', 'mouth', () => xf(K.box(0.8, 0.08, 2.0, 0.03), [0, -0.1, 1.15]));
  add(jaw, 'chin', 'dark', () => merge([xf(K.tbox(0.9, 0.25, 1.8, 0.5, 0.6, 0.08), [0, -0.5, 1.0]), xf(K.box(1.4, 0.35, 0.5, 0.1), [0, -0.2, 0.05])]));
  const throat = add(hr, 'throatCore', 'cyan', () => K.sph(0.5, 18, 12), [0, -0.78, -0.95]);
  parts.head = head; parts.jaw = jaw; parts.mouthOrb = orb; parts.throatCore = throat;
  // body segments (16, last 4 taper into the tail)
  const N = 16, SP = 2.2, NECK = 1.45, FIRST = 1.05;
  const shellGeo = () => xf(K.lathe([[0.95, -0.85], [1.12, -0.5], [1.2, 0], [1.12, 0.5], [0.95, 0.85]], 22), 0, [HP, 0, 0]);
  const segments = [];
  const weakPoints = [throat];
  for (let i = 0; i < N; i++) {
    const seg = new THREE.Group(); seg.name = 'wyrmSeg' + i; root.add(seg);
    const k = (i === 0 ? 0.7 : 0.8) * (1 - 0.6 * sstep(7, 15, i));
    const inner = grp(seg, null, null, 'segBody'); inner.scale.set(k, k, 1);
    add(inner, 'segShell', 'steel', shellGeo);
    const magma = add(inner, 'segMagma', 'magma', () => xf(K.cyl(0.88, 0.88, 2.35, 18, true), 0, [HP, 0, 0]));
    add(inner, 'segDark', 'dark', () => merge([xf(K.box(0.72, 0.3, 1.4, 0.1), [0, 1.14, 0]), xf(K.box(1.0, 0.26, 1.4, 0.1), [0, -1.1, 0]), ...[-1, 1].map((sd) => xf(K.box(0.2, 0.5, 1.2, 0.06), [1.16 * sd, 0, 0]))]));
    let fin = null;
    if (i === 5 || i === 10) {
      const wp = add(inner, 'backCore', 'cyan', () => K.sph(0.45, 16, 12, 0, TAU, 0, HP * 1.15), [0, 1.22, 0]);
      add(inner, 'backRing', 'dark', () => xf(K.tor(0.5, 0.11, 6, 18), [0, 1.24, 0], [HP, 0, 0]));
      weakPoints.push(wp);
    } else if (i === N - 1) {
      fin = add(inner, 'tailFin', 'orange', () => merge([xf(finGeo([2.2, 1.6, 1]), [0, 0.3, -0.6]), xf(finGeo([2.2, 1.6, 1]), [0, -0.3, -0.6], [0, 0, PI]), xf(K.coneN(0.3, 2.2, 4), [0, 0, -1.9], [-HP, 0, 0], [1, 1, 0.3])]));
    } else {
      fin = add(inner, 'segFin', 'orange', () => finGeo([0.9, 0.9, 1]), [0, 1.26, 0.1]);
    }
    seg.userData.k = k;
    segments.push({ seg, inner, magma, fin, k });
  }
  const segObjs = segments.map((s) => s.seg);
  // chain follow
  const up = new THREE.Vector3(), prev = new THREE.Vector3(), f = new THREE.Vector3(), r = new THREE.Vector3(), u = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const neckPoint = (out) => out.set(0, 0, -NECK).applyQuaternion(head.quaternion).add(head.position);
  const snapChain = () => {
    neckPoint(prev); f.set(0, 0, -1).applyQuaternion(head.quaternion);
    for (let i = 0; i < N; i++) { prev.addScaledVector(f, i === 0 ? FIRST : SP); segObjs[i].position.copy(prev); segObjs[i].quaternion.copy(head.quaternion); }
  };
  snapChain();
  const followChain = () => {
    neckPoint(prev);
    up.set(0, 1, 0).applyQuaternion(head.quaternion);
    for (let i = 0; i < N; i++) {
      const s = segObjs[i], spacing = i === 0 ? FIRST : SP;
      f.subVectors(s.position, prev);
      let len = f.length();
      if (!(len > 1e-5)) { f.set(0, 0, -1).applyQuaternion(i === 0 ? head.quaternion : segObjs[i - 1].quaternion); len = 1; } else f.divideScalar(len);
      s.position.copy(prev).addScaledVector(f, spacing);
      f.negate(); // forward = toward previous link
      r.crossVectors(up, f);
      if (r.lengthSq() < 1e-6) r.set(1, 0, 0).applyQuaternion(s.quaternion);
      r.normalize();
      u.crossVectors(f, r).normalize();
      basis.makeBasis(r, u, f);
      s.quaternion.setFromRotationMatrix(basis);
      prev.copy(s.position); up.copy(u);
    }
  };
  const magmaM = M.get('magma'), mouthM = M.get('mouth'), glowM = M.get('glow'), cyanM = M.get('cyan');
  let jawA = 0;
  const anim = (dt, R, s) => {
    const st = R.st, t = R.t2;
    const tele = clamp01(fin(s.telegraph, 0)), mo = clamp01(fin(s.mouthOpen, 0));
    const stun = st === 'stunned' ? 1 : 0, dying = st === 'dying' ? 1 : 0;
    R.stunW = damp(R.stunW || 0, stun, 6, dt); R.dieW = damp(R.dieW || 0, dying, 3, dt);
    jawA = damp(jawA, Math.max(mo * 0.78, R.stunW * 0.35, R.dieW * 0.5) + 0.04 * Math.sin(R.t * 1.7), 14, dt);
    jaw.rotation.x = jawA;
    orb.visible = tele > 0.02;
    orb.scale.setScalar(0.3 + 0.9 * tele + 0.06 * Math.sin(R.t * 35) * tele);
    followChain();
    const shk = R.dieW * (dying ? 0.18 * (1 - sstep(3, 5, t)) : 0) + 0.02 * R.stunW;
    hr.position.set((Math.random() - 0.5) * shk, (Math.random() - 0.5) * shk, 0);
    const glowFade = 1 - R.dieW * sstep(1, 4, dying ? t : 4);
    for (let i = 0; i < N; i++) {
      const S = segments[i];
      const pulse = 1 + 0.035 * Math.sin(R.t * 4 - i * 0.6);
      S.magma.scale.set(pulse, pulse, 1);
      if (S.fin) S.fin.rotation.x = Math.sin(R.t * 3 - i * 0.45) * 0.12;
      S.inner.position.set((Math.random() - 0.5) * shk, (Math.random() - 0.5) * shk, 0);
    }
    const ph = R.phase;
    magmaM.userData.emMul = (1 + 0.15 * Math.sin(R.t * 2.5) + 0.35 * tele) * (ph >= 3 ? 1.5 : ph >= 2 ? 1.2 : 1) * glowFade;
    mouthM.userData.emMul = (0.7 + 0.6 * mo) * glowFade;
    let eye = (1 - 0.6 * R.stunW * (0.5 + 0.5 * Math.sin(R.t * 27))) * glowFade;
    if (ph >= 3) eye *= hash(Math.floor(R.t * 8)) > 0.12 ? 1.2 : 0.4;
    glowM.userData.emMul = eye;
    cyanM.userData.emMul = (1 + 0.25 * Math.sin(R.t * 4)) * (1 + 0.5 * R.stunW) * (1 - 0.7 * R.dieW * sstep(2, 5, dying ? t : 5));
    R.teleOut = tele;
  };
  parts.segments = segObjs;
  const anchors = [head, ...segObjs.filter((_, i) => i % 3 === 1)];
  return { parts, weakPoints, anim, anchors, sparkSize: 0.45, sparkSpeed: 5, extra: { head, segments: segObjs, snapChain, spacing: SP } };
}

// ---------- KRAKEN: ocean mech squid ----------
function buildKraken(B) {
  const { K, add, grp, rig, M } = B;
  const parts = {};
  const body = grp(rig, [0, 1.6, 0], null, 'body');
  const mantle = grp(body, [0, 0.8, -0.1], [-0.28, 0, 0], 'mantle');
  const prof = [[1.95, 0], [2.15, 0.8], [2.05, 1.9], [1.72, 3.1], [1.25, 4.3], [0.72, 5.4], [0.3, 6.3], [0.04, 6.75]];
  add(mantle, 'mantle', 'steel', () => K.lathe(prof, 28));
  const ribAt = (y) => { let r = 0; for (let i = 0; i < prof.length - 1; i++) if (y >= prof[i][1] && y <= prof[i + 1][1]) r = lerp(prof[i][0], prof[i + 1][0], (y - prof[i][1]) / (prof[i + 1][1] - prof[i][1])); return r; };
  add(mantle, 'ribs', 'red', () => merge([...[1.2, 2.4, 3.6, 4.8].map((y) => xf(K.tor(ribAt(y) + 0.02, 0.13 - y * 0.014, 6, 30), [0, y, 0], [HP, 0, 0])), ...[0, 1, 2, 3, 4].map((i) => { const y = 1.0 + i * 1.05, rr = ribAt(y); return xf(K.box(0.35, 0.8, 0.3, 0.1), [0, y, -rr + 0.05], [-0.25, 0, 0]); })]));
  add(mantle, 'mlights', 'glow', () => merge([...[0, 1, 2, 3, 4, 5].map((i) => { const a = (i * TAU) / 6 + 0.5, y = 2.0 + (i % 2) * 0.9, rr = ribAt(y); return xf(K.sph(0.13, 10, 8), [Math.sin(a) * rr, y, Math.cos(a) * rr]); }), xf(K.sph(0.15, 10, 8), [0, 6.05, 0])]));
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0); finShape.quadraticCurveTo(1.6, 0.3, 2.4, 1.6); finShape.quadraticCurveTo(1.2, 1.9, 0, 2.2); finShape.lineTo(0, 0);
  const fins = [];
  for (const sd of [1, -1]) {
    const fg = grp(mantle, [0.7 * sd, 4.4, -0.1], [0, 0, 0]);
    add(fg, 'fin' + sd, 'orange', () => xf(xf(K.ext(finShape, 0.14, 0.05), [0, 0, -0.07]), 0, [0, sd > 0 ? 0 : PI, 0]));
    fins.push({ fg, sd });
  }
  add(body, 'face', 'dark', () => merge([
    K.lathe([[1.75, -0.7], [2.1, -0.3], [2.25, 0.4], [2.05, 1.1]], 28),
    xf(K.tor(1.02, 0.24, 10, 32), [0, 0.6, 1.92]),
    xf(K.cyl(0.35, 0.5, 0.9, 14), [0, -0.35, 1.9], [1.1, 0, 0]),
    xf(K.box(0.16, 1.0, 0.1, 0.04), [0, 0.6, 2.72]),
    xf(new THREE.CircleGeometry(1.76, 28), [0, -0.7, 0], [HP, 0, 0]),
    ...[-1, 1].map((sd) => xf(K.box(1.25, 0.32, 0.7, 0.1), [0.62 * sd, 1.72, 2.0], [0.35, -0.3 * sd, 0.3 * sd])),
  ]));
  add(body, 'collar', 'red', () => merge([...Array(10)].map((_, i) => { const a = (i * TAU) / 10 + PI / 10; return K.coneAt(0.32, 1.0, [Math.sin(a) * 2.05, 1.0, Math.cos(a) * 2.05], [Math.sin(a), 0.9, Math.cos(a)], 6); })));
  add(body, 'flights', 'glow', () => merge([...[-1.3, -0.9, 0.9, 1.3].map((a) => xf(K.sph(0.12, 10, 8), [Math.sin(a) * 2.15, 0.9 - Math.abs(a) * 0.3, Math.cos(a) * 2.15])), xf(K.cyl(0.25, 0.25, 0.06, 12), [0, -0.75, 2.27], [1.1, 0, 0])]));
  const eye = add(body, 'eye', 'cyan', () => K.sph(0.9, 24, 18), [0, 0.6, 1.85]);
  parts.eye = eye;
  const lidU = grp(body, [0, 0.6, 1.85], null, 'lidUpper'), lidL = grp(body, [0, 0.6, 1.85], null, 'lidLower');
  add(lidU, 'lidU', 'steel', () => K.sph(0.97, 20, 10, 0, PI, 0, HP));
  add(lidL, 'lidL', 'steel', () => K.sph(0.97, 20, 10, 0, PI, HP, HP));
  const inkMuzzle = grp(body, [0, -0.72, 2.3], [0.45, 0, 0], 'inkMuzzle');
  parts.inkMuzzle = inkMuzzle;
  // tentacles
  const NT = 6, NS = 8;
  const tAng = [0.5, -0.5, 1.57, -1.57, 2.6, -2.6];
  const tentacles = [], tips = [];
  const segL = (j) => 1.25 - 0.06 * j, segR = (j) => 0.44 - 0.036 * j;
  for (let i = 0; i < NT; i++) {
    const base = grp(body, [Math.sin(tAng[i]) * 1.55, -0.45, Math.cos(tAng[i]) * 1.55], [0, tAng[i], 0], 'tentacle' + i);
    const pitch = grp(base);
    const chain = [];
    let parent = pitch;
    for (let j = 0; j < NS; j++) {
      const piv = grp(parent, j === 0 ? null : [0, 0, segL(j - 1)]);
      const last = j === NS - 1;
      add(piv, 'tseg' + j, last ? 'orange' : j % 2 ? 'red' : 'steel', () => last
        ? merge([K.sph(segR(j), 10, 8), xf(K.cone(segR(j), segL(j) * 1.1, 10), [0, 0, segL(j) * 0.55], [HP, 0, 0]), K.coneAt(segR(j) * 0.5, 0.5, [0, -segR(j) * 0.3, segL(j) * 0.8], [0, -1, 0.6], 6)])
        : merge([K.sph(segR(j) * 1.04, 12, 8), xf(K.cyl(segR(j + 1), segR(j), segL(j), 12), [0, 0, segL(j) / 2], [HP, 0, 0])]));
      chain.push(piv); parent = piv;
    }
    const tip = grp(parent, [0, 0, segL(NS - 1)], null, 'tentacleTip' + i);
    tips.push(tip);
    tentacles.push({ base, pitch, chain, i, ang: tAng[i] });
  }
  parts.tentacleTips = tips; parts.tentacles = tentacles.map((t) => t.base);
  const glowM = M.get('glow'), cyanM = M.get('cyan');
  let blinkT = 2 + Math.random() * 3, blink = 0, swingStart = -1, maxTele = 0;
  const anim = (dt, R, s) => {
    const st = R.st, t = R.t2, tele = clamp01(fin(s.telegraph, 0));
    const w = (R.wk = R.wk || { swipe: 0, ink: 0, stunned: 0, dying: 0 });
    for (const k in w) w[k] = damp(w[k], st === k ? 1 : 0, k === 'dying' ? 2 : 5, dt);
    if (st === 'swipe') { if (t < R.lastT2 || R.stT === 0) { swingStart = -1; maxTele = 0; } maxTele = Math.max(maxTele, tele); if (swingStart < 0 && ((maxTele < 0.2 && t > 0.05) || (maxTele > 0.5 && tele < maxTele - 0.25))) swingStart = t; }
    else { swingStart = -1; maxTele = 0; }
    R.lastT2 = t;
    const swing = swingStart >= 0 ? sstep(swingStart, swingStart + 0.55, t) : 0;
    const wind = st === 'swipe' ? Math.max(tele, swingStart >= 0 ? 1 - swing * 0.2 : 0) : 0;
    const dying = st === 'dying' ? sstep(0, 4, t) : w.dying;
    body.position.y = 1.6 + Math.sin(R.t * 0.9) * 0.3 * (1 - w.stunned) - 0.6 * w.stunned - 3.8 * dying;
    body.rotation.x = 0.22 * w.stunned + 0.35 * dying + Math.sin(R.t * 0.6) * 0.03;
    body.rotation.z = Math.sin(R.t * 0.7) * 0.04 + 0.12 * dying;
    const shk = dying * (1 - sstep(3, 4, st === 'dying' ? t : 4)) * 0.12;
    rig.position.set((Math.random() - 0.5) * shk, 0, (Math.random() - 0.5) * shk);
    const sq = 1 - 0.08 * w.ink * (0.5 + 0.5 * Math.sin(R.t * 9)) + 0.02 * Math.sin(R.t * 1.3);
    mantle.scale.set(sq, 1 + (1 - sq) * 0.6, sq);
    mantle.rotation.x = -0.18 + 0.05 * Math.sin(R.t * 0.9 + 1);
    for (const F of fins) F.fg.rotation.y = F.sd * (0.15 + 0.25 * Math.sin(R.t * 2.2 + F.sd));
    // eyelids: blink idle, half-close for ink, wide open when stunned
    blinkT -= dt;
    if (blinkT < 0) { blink = 1; blinkT = 3 + Math.random() * 4; }
    blink = Math.max(0, blink - dt * 5);
    const close = clamp01(Math.max(Math.sin(blink * PI), 0.55 * w.ink, 0.25 * dying) * (1 - w.stunned));
    lidU.rotation.x = -1.35 * (1 - close); lidL.rotation.x = 1.35 * (1 - close);
    const limp = Math.max(w.stunned, dying);
    for (const T of tentacles) {
      const front = T.i < 2;
      const sd = T.ang > 0 ? 1 : -1;
      const amp = 1 - 0.7 * limp;
      let basePitch = -0.2 + 0.12 * Math.sin(R.t * 0.8 + T.i) + 0.32 * limp - 0.3 * w.ink;
      let baseYaw = 0;
      if (front) {
        basePitch = lerp(basePitch, -1.15, wind * w.swipe);
        baseYaw = lerp(0, 0.55 * sd, wind * w.swipe);
        if (swing > 0) { basePitch = lerp(basePitch, 0.15, swing * w.swipe); baseYaw = lerp(baseYaw, -1.05 * sd, swing * w.swipe); }
      }
      T.pitch.rotation.x = basePitch; T.pitch.rotation.y = baseYaw;
      for (let j = 0; j < NS; j++) {
        const a = (0.1 + 0.035 * j) * amp;
        const wave = Math.sin(R.t * (1.6 + 2.5 * w.ink) + T.i * 1.1 - j * 0.55);
        let rx = lerp((j < 3 ? 0.16 : -0.2) + a * wave, j < 2 ? 0.12 : -0.05 + 0.04 * Math.sin(R.t * 1.5 + j), limp);
        if (front && w.swipe > 0) rx = lerp(rx, -0.22 * wind + 0.08 * swing, w.swipe);
        rx -= 0.18 * w.ink;
        T.chain[j].rotation.x = rx;
        T.chain[j].rotation.y = a * 0.8 * Math.sin(R.t * 1.1 + T.i * 0.7 - j * 0.45);
      }
    }
    const ph = R.phase;
    let ge = 1 - 0.5 * w.stunned * (0.5 + 0.5 * Math.sin(R.t * 20));
    if (st === 'dying') ge *= hash(Math.floor(R.t * 15)) > sstep(0.5, 4, t) ? 1 : 0.05;
    if (ph >= 3) ge *= hash(Math.floor(R.t * 7)) > 0.15 ? 1.2 : 0.4;
    glowM.userData.emMul = ge * (1 + 0.8 * w.ink);
    cyanM.userData.emMul = (1 + 0.2 * Math.sin(R.t * 3)) * (1 + 0.6 * w.stunned) * (1 - 0.8 * (st === 'dying' ? sstep(2, 4.5, t) : 0));
    R.teleOut = Math.max(tele, w.ink * 0.5);
  };
  const anchors = [mantle, eye, ...tentacles.map((T) => T.chain[2])];
  return { parts, weakPoints: [eye], anim, anchors, sparkSize: 0.4, sparkSpeed: 4 };
}

// ---------- REGENT: the Iron Regent's flying fortress core ----------
function buildRegent(B) {
  const { K, add, grp, rig, M, qb } = B;
  const parts = {};
  const RS = 5, RI = 4.6, T0 = 0.42, T1 = PI - 0.42, HALF = PI / 8 - 0.035;
  const coreG = grp(rig, null, null, 'coreGroup');
  const core = add(coreG, 'core', 'cyan', () => K.sph(3.0, 32, 24));
  parts.core = core;
  const cage = add(coreG, 'cage', 'dark', () => merge([xf(K.tor(3.25, 0.12, 6, 40), 0, [HP, 0, 0]), xf(K.tor(3.25, 0.12, 6, 40), 0, [0, 0, 0]), xf(K.tor(3.25, 0.12, 6, 40), 0, [0, HP, 0]), xf(K.tor(3.25, 0.1, 6, 40), 0, [HP, PI / 4, 0])]));
  // armour gores (louvre plates around the core)
  const gores = [];
  const goreOuter = () => new THREE.SphereGeometry(RS, K.n(6, 3), K.n(22, 8), HP - HALF, 2 * HALF, T0, T1 - T0);
  const goreInner = () => {
    const g = new THREE.SphereGeometry(RI, K.n(6, 3), K.n(22, 8), HP - HALF, 2 * HALF, T0, T1 - T0);
    flipWinding(g); const Nn = g.attributes.normal; for (let i = 0; i < Nn.count; i++) Nn.setXYZ(i, -Nn.getX(i), -Nn.getY(i), -Nn.getZ(i));
    const walls = [];
    const sp = (r, ph, th) => [-r * Math.cos(ph) * Math.sin(th), r * Math.cos(th), r * Math.sin(ph) * Math.sin(th)];
    const nt = K.n(16, 6);
    for (const [ph, sg] of [[HP - HALF, -1], [HP + HALF, 1]]) {
      const A = [], Bb = [];
      for (let i = 0; i <= nt; i++) { const th = T0 + ((T1 - T0) * i) / nt; A.push(sp(RI, ph, th)); Bb.push(sp(RS, ph, th)); }
      walls.push(quadStrip(A, Bb, [sg * Math.sin(ph), 0, sg * Math.cos(ph)]));
    }
    for (const [th, sg] of [[T0, -1], [T1, 1]]) {
      const A = [], Bb = [];
      for (let i = 0; i <= 4; i++) { const ph = HP - HALF + (2 * HALF * i) / 4; A.push(sp(RI, ph, th)); Bb.push(sp(RS, ph, th)); }
      walls.push(quadStrip(A, Bb, [0, -sg * Math.sin(th), sg * Math.cos(th)]));
    }
    return merge([g, ...walls]);
  };
  const goreStripe = () => merge([
    new THREE.SphereGeometry(RS + 0.04, 2, K.n(22, 8), HP - 0.07, 0.14, T0 + 0.12, T1 - T0 - 0.24),
    ...[-1, 1].map((sd) => xf(K.box(0.9, 0.35, 0.2, 0.08), [0, 0, RS + 0.02], [0, 0, 0]).rotateX(sd * 0.5)),
  ]);
  for (let i = 0; i < 8; i++) {
    const c = PI / 8 + (i * PI) / 4;
    const gRot = grp(rig, null, [0, c, 0], 'armor' + i);
    const g = grp(gRot);
    const louvre = grp(g, [0, 0, RS]);
    const plate = grp(louvre, [0, 0, -RS]);
    add(plate, 'goreO', 'steel', goreOuter);
    add(plate, 'goreI', 'dark', goreInner);
    if (i % 2 === 0) add(plate, 'goreS', 'orange', goreStripe);
    else add(plate, 'goreV', 'glow', () => merge([-0.55, -0.18, 0.18, 0.55].map((lat) => xf(K.box(0.22, 0.5, 0.2, 0.06), [0, 0, RS + 0.02]).rotateX(lat))));
    gores.push({ gRot, g, louvre, c });
  }
  parts.armorPlates = gores.map((g) => g.gRot);
  // caps, crown spire, thruster, arm hub
  add(rig, 'caps', 'steel', () => merge([new THREE.SphereGeometry(RS, K.n(28, 10), K.n(5, 2), 0, TAU, 0, T0 + 0.02), new THREE.SphereGeometry(RS, K.n(28, 10), K.n(5, 2), 0, TAU, T1 - 0.02, PI - T1 + 0.02)]));
  const spikeN = 8;
  add(rig, 'crownD', 'dark', () => merge([
    xf(K.tor(RS * Math.sin(T0), 0.2, 6, 32), [0, RS * Math.cos(T0), 0], [HP, 0, 0]),
    xf(K.tor(RS * Math.sin(T0), 0.2, 6, 32), [0, -RS * Math.cos(T0), 0], [HP, 0, 0]),
    xf(K.cyl(1.85, 2.15, 0.95, 32), [0, 4.95, 0]),
    K.coneAt(0.6, 4.3, [0, 5.3, 0], [0, 1, 0], 10),
    xf(K.cyl(1.5, 0.9, 1.4, 20), [0, -5.3, 0]),
    xf(K.cyl(3.5, 3.0, 0.7, 32), [0, -4.65, 0]),
  ]));
  add(rig, 'crownO', 'orange', () => merge([...[...Array(spikeN)].map((_, i) => { const a = (i * TAU) / spikeN + PI / spikeN, h = i % 2 ? 1.6 : 2.5; return K.coneAt(0.36, h, [Math.sin(a) * 1.8, 5.3, Math.cos(a) * 1.8], [Math.sin(a) * 0.3, 1, Math.cos(a) * 0.3], 8); }), xf(K.tor(1.95, 0.12, 6, 32), [0, 5.45, 0], [HP, 0, 0])]));
  add(rig, 'crownG', 'glow', () => merge([
    xf(K.cyl(2.17, 2.17, 0.3, 32, true, -0.95, 1.9), [0, 4.92, 0]),
    ...[...Array(spikeN)].map((_, i) => { const a = (i * TAU) / spikeN; return xf(K.sph(0.2, 10, 8), [Math.sin(a) * 2.02, 5.25, Math.cos(a) * 2.02]); }),
    xf(K.sph(0.38, 14, 10), [0, 9.7, 0]),
    xf(K.cyl(0.85, 0.85, 0.1, 18), [0, -6.02, 0]),
  ]));
  // rotating gyroscope rings
  const rings = [];
  const ringDef = [[7.0, 0, 0, 0.6], [7.6, 0.38, 0, -0.45], [8.2, -0.36, HP, 0.35]];
  for (let i = 0; i < 3; i++) {
    const [Rr, tx, ty, spd] = ringDef[i];
    const tilt = grp(rig, null, [tx, ty, 0], 'ringTilt' + i);
    const spin = grp(tilt, null, null, 'ring' + i);
    add(spin, 'ring' + i, 'dark', () => xf(K.tor(Rr, 0.26, 8, 64), 0, [HP, 0, 0]));
    add(spin, 'ringG' + i, 'glow', () => merge([...Array(12)].map((_, k) => { const a = (k * TAU) / 12; return xf(K.box(0.7, 0.3, 0.3, 0.08), [Math.sin(a) * Rr, 0, Math.cos(a) * Rr], [0, a, 0]); })));
    rings.push({ spin, spd });
  }
  parts.rings = rings.map((r) => r.spin);
  // 4 cannon arms (hang below the ring sweep)
  const armA = [PI / 4, -PI / 4, (3 * PI) / 4, (-3 * PI) / 4];
  add(rig, 'booms', 'steel', () => merge(armA.map((a) => { const d = [Math.sin(a), Math.cos(a)]; return along(K.box(0.95, dist3([d[0] * 3.3, -4.65, d[1] * 3.3], [d[0] * 7.2, -5.7, d[1] * 7.2]), 0.95, 0.2), [d[0] * 3.3, -4.65, d[1] * 3.3], [d[0] * 7.2, -5.7, d[1] * 7.2]); })));
  add(rig, 'joints', 'dark', () => merge(armA.flatMap((a) => [xf(K.sph(0.85, 14, 10), [Math.sin(a) * 3.3, -4.65, Math.cos(a) * 3.3]), xf(K.sph(0.8, 14, 10), [Math.sin(a) * 7.2, -5.7, Math.cos(a) * 7.2])])));
  const cannons = [];
  parts.cannonMuzzles = []; parts.cannonArms = [];
  for (const a of armA) {
    const piv = grp(rig, [Math.sin(a) * 7.2, -5.7, Math.cos(a) * 7.2], [0, a, 0], 'cannonArm');
    const pitch = grp(piv, null, [0.3, 0, 0]);
    add(pitch, 'cannon', 'dark', () => merge([xf(K.cyl(0.45, 0.5, 3.4, 16), [0, 0, 1.7], [HP, 0, 0]), xf(K.box(1.1, 1.1, 0.7, 0.2), [0, 0, 3.4]), xf(K.box(1.2, 1.0, 1.4, 0.25), [0, 0.1, 0.2])]));
    add(pitch, 'cband', 'orange', () => merge([xf(K.cyl(0.55, 0.55, 0.2, 16), [0, 0, 1.2], [HP, 0, 0]), xf(K.cyl(0.52, 0.52, 0.2, 16), [0, 0, 2.2], [HP, 0, 0])]));
    add(pitch, 'ctip', 'glow2', () => xf(K.tor(0.38, 0.1, 6, 18), [0, 0, 3.78]));
    const mz = grp(pitch, [0, 0, 3.9], null, 'cannonMuzzle');
    parts.cannonMuzzles.push(mz); parts.cannonArms.push(piv);
    cannons.push({ piv, pitch, a });
  }
  // shield bubble
  const bubble = add(rig, 'bubble', 'bubble', () => uvMul(new THREE.SphereGeometry(9.6, K.n(40, 16), K.n(28, 10)), 14, 12));
  bubble.renderOrder = 5; bubble.userData.noShadow = true;
  parts.shieldBubble = bubble;
  // shield generator pylons (separate objects — NOT parented to root)
  const generators = [], genCores = [], genRings = [], beams = [];
  const gM = new MatSet(qb);
  const gB = makeBuilder('boss_regentGen', qb, K, gM, null, null, 0.45);
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group(); g.name = 'shieldGenerator' + i;
    const a = PI / 4 + (i * PI) / 2;
    g.position.set(Math.sin(a) * 18, 0, Math.cos(a) * 18);
    gB.add(g, 'gbase', 'dark', () => merge([xf(K.prism(1.6, 1.9, 0.6, 6), [0, 0.3, 0]), xf(K.prism(0.9, 1.2, 0.5, 6), [0, 3.95, 0])]));
    gB.add(g, 'gcol', 'steel', () => merge([xf(K.cyl(0.6, 0.8, 3.4, 14), [0, 2.3, 0])]));
    gB.add(g, 'gband', 'hazard', () => merge([xf(K.cyl(0.84, 0.86, 0.5, 14, true), [0, 1.1, 0]), xf(K.cyl(0.66, 0.7, 0.4, 14, true), [0, 3.2, 0])]));
    gB.add(g, 'gprong', 'orange', () => merge([0, 1, 2].map((k) => { const b = (k * TAU) / 3; return K.capsule([Math.sin(b) * 0.7, 4.1, Math.cos(b) * 0.7], [Math.sin(b) * 0.95, 5.6, Math.cos(b) * 0.95], 0.12, 8); })));
    const crystal = gB.add(g, 'gcrystal', 'cyan', () => xf(new THREE.OctahedronGeometry(0.65, 0), 0, 0, [1, 1.6, 1]), [0, 5.2, 0]);
    const ring = gB.add(g, 'gring', 'dark', () => merge([xf(K.tor(1.15, 0.09, 6, 28), 0, [HP, 0, 0]), xf(K.tor(1.35, 0.07, 6, 28), 0, [HP + 0.5, 0, 0])]), [0, 5.2, 0]);
    const beam = gB.add(g, 'gbeam', 'beam', () => xf(new THREE.CylinderGeometry(0.22, 0.32, 1, 10, 1, true), [0, 0.5, 0]), [0, 5.2, 0]);
    beam.userData.noShadow = true; beam.raycast = () => {}; beam.frustumCulled = false;
    g.traverse((o) => { if (o.isMesh) { o.castShadow = !o.material.transparent; o.receiveShadow = !o.material.transparent; } });
    generators.push(g); genCores.push(crystal); genRings.push(ring); beams.push(beam);
  }
  parts.generators = generators; parts.generatorCores = genCores;
  const glow2 = M.get('glow2'), glowM = M.get('glow'), cyanM = M.get('cyan'), bubbleM = M.get('bubble'), beamM = gM.get('beam'), gCyan = gM.get('cyan');
  const coreW = new THREE.Vector3(), tmp = new THREE.Vector3();
  let ringBoost = 0;
  const anim = (dt, R, s) => {
    const st = R.st, t = R.t2;
    const open = clamp01(fin(s.armorOpen, 0)), tele = clamp01(fin(s.telegraph, 0)), shield = clamp01(fin(s.shield, 0));
    const w = (R.wk = R.wk || { stunned: 0, dying: 0 });
    for (const k in w) w[k] = damp(w[k], st === k ? 1 : 0, k === 'dying' ? 2 : 5, dt);
    const dying = st === 'dying' ? sstep(0, 5, t) : w.dying;
    rig.position.y = Math.sin(R.t * 0.7) * 0.4 - 1.5 * w.stunned - 6 * dying;
    rig.rotation.z = Math.sin(R.t * 0.5) * 0.03 + 0.15 * w.stunned * Math.sin(R.t * 1.5) + 0.3 * dying;
    rig.rotation.x = 0.12 * w.stunned + 0.2 * dying;
    const shk = (st === 'dying' ? (1 - sstep(4, 6, t)) * 0.25 : 0) + 0.03 * w.stunned;
    rig.position.x = (Math.random() - 0.5) * shk; rig.position.z = (Math.random() - 0.5) * shk;
    ringBoost = damp(ringBoost, tele * 2.5, 4, dt);
    const ringMul = (1 + ringBoost) * (1 - 0.85 * w.stunned) * (1 - dying);
    for (const r of rings) r.spin.rotation.y += dt * r.spd * ringMul;
    coreG.rotation.y += dt * 0.25; coreG.rotation.x = Math.sin(R.t * 0.3) * 0.2;
    for (const G of gores) {
      G.g.position.z = 1.35 * open;
      G.louvre.rotation.y = 0.9 * open;
    }
    for (const C of cannons) {
      C.pitch.rotation.x = 0.3 + 0.08 * Math.sin(R.t * 0.9 + C.a) + 0.5 * dying;
      C.pitch.rotation.y = 0.12 * Math.sin(R.t * 0.6 + C.a * 2);
    }
    // shield bubble
    bubble.visible = shield > 0.01;
    bubbleM.userData.dyn = shield * (0.75 + 0.25 * Math.sin(R.t * 3)) * (R.flash > 0.02 ? 1.8 : 1);
    bubble.rotation.y += dt * 0.1;
    bubble.scale.setScalar(1 + 0.01 * Math.sin(R.t * 5));
    // generators: spin rings, aim beams at the core
    core.getWorldPosition(coreW);
    for (let i = 0; i < 4; i++) {
      const g = generators[i];
      genRings[i].rotation.y += dt * 1.6; genRings[i].rotation.z = Math.sin(R.t + i) * 0.2;
      genCores[i].rotation.y += dt * 0.8; genCores[i].position.y = 5.2 + Math.sin(R.t * 2 + i) * 0.12;
      const b = beams[i];
      const on = shield > 0.01 && g.visible && !!g.parent;
      b.visible = on;
      if (on) {
        g.updateWorldMatrix(true, false);
        tmp.copy(coreW); g.worldToLocal(tmp); tmp.sub(b.position);
        const L = tmp.length();
        if (L > 1e-3) { b.quaternion.setFromUnitVectors(UP, tmp.divideScalar(L)); b.scale.set(1 + 0.15 * Math.sin(R.t * 11 + i), Math.max(0.001, L - 3.0), 1 + 0.15 * Math.sin(R.t * 11 + i)); }
      }
    }
    beamM.userData.dyn = shield * (0.7 + 0.3 * Math.sin(R.t * 14));
    const ph = R.phase;
    glow2.userData.emMul = 1 + 1.5 * tele;
    let ge = (1 - 0.6 * w.stunned * (0.5 + 0.5 * Math.sin(R.t * 19))) * (ph >= 2 ? 1.2 : 1);
    if (st === 'dying') ge *= hash(Math.floor(R.t * 14)) > sstep(1, 5, t) ? 1 : 0.05;
    if (ph >= 3) ge *= hash(Math.floor(R.t * 7)) > 0.15 ? 1.1 : 0.35;
    glowM.userData.emMul = ge;
    cyanM.userData.emMul = (0.8 + 0.25 * Math.sin(R.t * 3) + 0.6 * open) * (1 - 0.8 * (st === 'dying' ? sstep(3, 6, t) : 0));
    gCyan.userData.emMul = 1 + 0.3 * Math.sin(R.t * 4);
    gM.apply(0, 1, 0, R.t);
    R.teleOut = tele;
  };
  const anchors = [gores[0].louvre, gores[3].louvre, gores[6].louvre, cannons[0].piv, cannons[2].piv, rig];
  const extraDispose = () => { for (const g of generators) g.removeFromParent(); gM.dispose(); };
  return { parts, weakPoints: [core], anim, anchors, sparkSize: 0.5, sparkSpeed: 6, extraDispose };
}

const BOSS_BUILD = { titan: buildTitan, wyrm: buildWyrm, kraken: buildKraken, regent: buildRegent };

/**
 * createBoss(type 'titan'|'wyrm'|'kraken'|'regent', quality 0..1) -> Boss
 * { root, parts, weakPoints, update(dt, s), setFlash(x), setPhase(n), dispose() } (+ wyrm: head, segments)
 */
export function createBoss(type, quality = 0.6) {
  if (!BOSS_BUILD[type]) { console.warn('[robots] unknown boss type', type); type = 'titan'; }
  const qb = qBucket(quality);
  const K = makeKit(qb);
  const M = new MatSet(qb);
  const root = new THREE.Group(); root.name = 'Boss:' + type;
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const B = makeBuilder('boss_' + type, qb, K, M, root, rig, 0.35);
  const d = BOSS_BUILD[type](B);
  root.traverse((o) => { if (o.isMesh) { const tr = o.material.transparent || o.userData.noShadow; o.castShadow = !tr; o.receiveShadow = !o.material.transparent; } });
  const sparks = new Sparks(qb === 0 ? 48 : 110, d.sparkSize || 0.4);
  root.add(sparks.points);
  const R = { t: 0, t2: 0, st: 'idle', stT: 0, phase: 1, flash: 0, sparkAcc: 0, teleOut: 0 };
  const anchors = d.anchors || [rig];
  const apply = () => M.apply(R.flash, 1, R.teleOut, R.t);
  const api = {
    type, root, parts: d.parts, weakPoints: d.weakPoints, quality: qb,
    update(dt, s) {
      dt = clamp(fin(dt, 0), 0, 0.1);
      s = s || {};
      const st = typeof s.state === 'string' ? s.state : 'idle';
      if (st !== R.st) { R.st = st; R.stT = 0; } else R.stT += dt;
      R.t += dt;
      R.t2 = Number.isFinite(s.t) ? Math.max(0, s.t) : R.stT;
      d.anim(dt, R, s);
      // damage sparks
      const rate = [0, 5, 14][R.phase - 1] + (st === 'dying' ? 45 : 0) + (st === 'stunned' ? 8 : 0);
      R.sparkAcc += rate * dt;
      while (R.sparkAcc >= 1) {
        R.sparkAcc -= 1;
        const a = anchors[(Math.random() * anchors.length) | 0];
        a.getWorldPosition(_v4); root.worldToLocal(_v4);
        _v4.x += (Math.random() - 0.5) * 1.2; _v4.y += (Math.random() - 0.5) * 1.2; _v4.z += (Math.random() - 0.5) * 1.2;
        sparks.emit(_v4, 3 + ((Math.random() * 4) | 0), d.sparkSpeed || 5);
      }
      sparks.update(dt, 9.8);
      apply();
    },
    setFlash(x) { R.flash = clamp01(fin(x, 0)); apply(); },
    setPhase(n) {
      n = clamp(Math.round(fin(n, 1)), 1, 3); R.phase = n;
      const dk = [1, 0.78, 0.56][n - 1];
      for (const m of M.list) {
        const k = m.userData.kind;
        if (DARKEN_KINDS.has(k)) m.userData.colMul = k === 'orange' || k === 'hazard' ? lerp(1, dk, 0.6) : dk;
        if (k === 'glow' || k === 'glow2') { m.userData.baseEm.setHex(n >= 3 ? 0xff0c04 : n >= 2 ? 0xff1604 : (k === 'glow2' ? 0xff2a08 : 0xff1e05)).multiplyScalar((m.userData.def.ei || 1) * (n >= 3 ? 1.5 : 1)); }
      }
      if (d.onPhase) d.onPhase(n);
      apply();
    },
    dispose() { root.removeFromParent(); sparks.dispose(); if (d.extraDispose) d.extraDispose(); M.dispose(); },
  };
  if (d.extra) Object.assign(api, d.extra);
  root.userData.boss = api;
  api.update(0, { state: 'idle' });
  return api;
}

/** Dispose every cached geometry / generated texture / shared material (call on level unload). */
export function disposeRobotCache() {
  for (const g of geoCache.values()) g.dispose();
  geoCache.clear();
  for (const t of texCache.values()) t.dispose();
  texCache.clear();
  for (const m of sharedMats.values()) m.dispose();
  sharedMats.clear();
}
