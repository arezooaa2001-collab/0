'use strict';
/* Shared helpers: math, Persian digits, safe storage, geometry merging */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const wrapAngle = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const angleLerp = (a, b, t) => a + wrapAngle(b - a) * t;
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const fa = (v) => String(v).replace(/\d/g, (d) => FA_DIGITS[d]);

/** Turn Persian/Arabic digits into ASCII and drop everything that is not a digit. */
function digitsOnly(s) {
  return String(s)
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
}

const Store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked: play without saving */ }
  },
};

const UI_FONT = 'Vazirmatn, Tahoma, "Segoe UI", sans-serif';
const DISPLAY_FONT = 'Lalezar, Vazirmatn, Tahoma, sans-serif';

/* ---------- geometry merging (one draw call for many colored parts) ---------- */

const UnitGeo = {
  _c: {},
  get(key, make) {
    let g = this._c[key];
    if (!g) {
      g = this._c[key] = make();
      // closed convex shapes: their outline seen from above is exact (collision uses it)
      if (/^(box|cyl|cone|sph|cap)/.test(key)) g.userData.convex = true;
    }
    return g;
  },
  box() { return this.get('box', () => new THREE.BoxGeometry(1, 1, 1)); },
  cyl(seg = 16) { return this.get('cyl' + seg, () => new THREE.CylinderGeometry(1, 1, 1, seg)); },
  cone(seg = 16) { return this.get('cone' + seg, () => new THREE.CylinderGeometry(0, 1, 1, seg)); },
  sphere(w = 16, h = 12) { return this.get('sph' + w + '_' + h, () => new THREE.SphereGeometry(1, w, h)); },
  capsule(r, l, cs = 4, rs = 10) { return this.get(`cap${r}_${l}_${cs}_${rs}`, () => new THREE.CapsuleGeometry(r, l, cs, rs)); },
  torus(r, t, rs = 8, ts = 24) { return this.get(`tor${r}_${t}_${rs}_${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts)); },
};

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

function composeMatrix(x, y, z, rx, ry, rz, sx, sy, sz) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
}

/**
 * Merge parts {geo, matrix, color, bone?, emissive?} into one indexed BufferGeometry
 * with vertex colors (and rigid skin attributes when skinned is true).
 */
function mergeParts(parts, skinned) {
  let vCount = 0;
  let iCount = 0;
  for (const p of parts) {
    const n = p.geo.attributes.position.count;
    vCount += n;
    iCount += p.geo.index ? p.geo.index.count : n;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const idx = vCount > 65000 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  const si = skinned ? new Uint16Array(vCount * 4) : null;
  const sw = skinned ? new Float32Array(vCount * 4) : null;
  const nm = new THREE.Matrix3();
  let vo = 0;
  let io = 0;
  for (const p of parts) {
    const P = p.geo.attributes.position;
    const N = p.geo.attributes.normal;
    nm.getNormalMatrix(p.matrix);
    const c = p.color;
    for (let i = 0; i < P.count; i++) {
      const o = (vo + i) * 3;
      _v1.fromBufferAttribute(P, i).applyMatrix4(p.matrix);
      pos[o] = _v1.x; pos[o + 1] = _v1.y; pos[o + 2] = _v1.z;
      _v2.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      nor[o] = _v2.x; nor[o + 1] = _v2.y; nor[o + 2] = _v2.z;
      col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
      if (skinned) { si[(vo + i) * 4] = p.bone; sw[(vo + i) * 4] = 1; }
    }
    if (p.geo.index) {
      const I = p.geo.index;
      for (let i = 0; i < I.count; i++) idx[io + i] = I.getX(i) + vo;
      io += I.count;
    } else {
      for (let i = 0; i < P.count; i++) idx[io + i] = i + vo;
      io += P.count;
    }
    vo += P.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (skinned) {
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  }
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** Collects static colored parts and builds them into a single mesh. */
class Batch {
  constructor() { this.parts = []; }
  add(geo, x, y, z, color, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    this.parts.push({ geo, matrix: composeMatrix(x, y, z, rx, ry, rz, sx, sy, sz), color: new THREE.Color(color) });
    return this;
  }
  box(w, h, d, x, y, z, color, ry = 0, rx = 0, rz = 0) { return this.add(UnitGeo.box(), x, y, z, color, rx, ry, rz, w, h, d); }
  cyl(r, h, x, y, z, color, rx = 0, ry = 0, rz = 0, segs = 16) { return this.add(UnitGeo.cyl(segs), x, y, z, color, rx, ry, rz, r, h, r); }
  sphere(r, x, y, z, color, sy = 1) { return this.add(UnitGeo.sphere(), x, y, z, color, 0, 0, 0, r, r * sy, r); }
  geo(g, x, y, z, color, rx = 0, ry = 0, rz = 0, s = 1) { return this.add(g, x, y, z, color, rx, ry, rz, s, s, s); }
  build(material) {
    if (!this.parts.length) return null;
    const mesh = new THREE.Mesh(mergeParts(this.parts, false), material);
    mesh.matrixAutoUpdate = false;
    return mesh;
  }
}

/** Flat elliptical ring (running track lanes) in the XZ plane. */
function ellipseRingGeometry(a, b, width, segs = 96) {
  const pos = [];
  const nor = [];
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = (i / segs) * TAU;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pos.push(a * c, 0, b * s, (a + width) * c, 0, (b + width) * s);
    nor.push(0, 1, 0, 0, 1, 0);
    if (i < segs) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); // counter-clockwise seen from above
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** Canvas texture helper with sRGB encoding. */
function makeCanvasTexture(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 4;
  tex.userData = { canvas: cv, ctx, draw };
  return tex;
}

function redrawCanvasTexture(tex, draw) {
  const { canvas, ctx } = tex.userData;
  if (draw) tex.userData.draw = draw;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  tex.userData.draw(ctx, canvas.width, canvas.height);
  tex.needsUpdate = true;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Soft radial blob texture used for fake shadows and particles. */
function radialTexture(inner, outer, size = 64) {
  return makeCanvasTexture(size, size, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}
