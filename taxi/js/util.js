import * as THREE from 'three';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
export const dampAngle = (a, b, k, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-k * dt));

export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// deterministic generator for world building
export const rand = mulberry32(20261023);
export const rr = (a, b, r = rand) => a + (b - a) * r();
export const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];

function hash2(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export { hash2 };
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise2(x * f + i * 17.3, y * f - i * 9.1);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

const FA = '۰۱۲۳۴۵۶۷۸۹';
export const fa = (n) => String(n).replace(/[0-9]/g, (d) => FA[d]);
export const faMoney = (n) => fa(Math.round(n).toLocaleString('en-US').replace(/,/g, '٬'));
export function faDist(m) {
  if (m >= 1000) return fa((m / 1000).toFixed(1)).replace('.', '٫') + ' کیلومتر';
  return fa(Math.max(0, Math.round(m / 10) * 10)) + ' متر';
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
export function canvasTexture(w, h, draw, { repeat = null, srgb = true, aniso = 8 } = {}) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.anisotropy = aniso;
  return t;
}
export function speckle(g, w, h, base, amount, count, size = 2) {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    const v = Math.random();
    const a = Math.random() * amount;
    g.fillStyle = v > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    g.fillRect(Math.random() * w, Math.random() * h, size * Math.random() + 1, size * Math.random() + 1);
  }
}

/* ---------- geometry merging ---------- */
export function sliceGeometry(g, start, count) {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const a = g.attributes[name];
    if (!a) continue;
    out.setAttribute(name, new THREE.BufferAttribute(a.array.slice(start * a.itemSize, (start + count) * a.itemSize), a.itemSize));
  }
  return out;
}
export function concatGeometries(list) {
  let total = 0;
  for (const g of list) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let colors = list.some((g) => g.attributes.color) ? new Float32Array(total * 3).fill(1) : null;
  let o = 0;
  for (const g of list) {
    const n = g.attributes.position.count;
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array.subarray(0, n * 3), o * 3);
    nor.set(g.attributes.normal.array.subarray(0, n * 3), o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, n * 2), o * 2);
    if (colors && g.attributes.color) colors.set(g.attributes.color.array.subarray(0, n * 3), o * 3);
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (colors) out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

/** Bakes every mesh below root (except userData.noMerge branches) into one mesh per material. */
export function mergeByMaterial(root, { shadow = true } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];
  const add = (mat, g) => {
    if (!buckets.has(mat)) buckets.set(mat, []);
    buckets.get(mat).push(g);
  };
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o === root) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.noMerge) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(m);
    if (m.determinant() < 0) flipWinding(g);
    if (Array.isArray(o.material)) {
      if (g.groups.length) for (const gr of g.groups) add(o.material[gr.materialIndex], sliceGeometry(g, gr.start, gr.count));
      else add(o.material[0], g);
    } else add(o.material, g);
    remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  const meshes = [];
  for (const [mat, geoms] of buckets) {
    const mesh = new THREE.Mesh(concatGeometries(geoms), mat);
    mesh.castShadow = shadow && !mat.transparent;
    mesh.receiveShadow = true;
    mesh.userData.mat = mat.name;
    root.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}
/** merges only the direct mesh children of a group (keeps child groups / joints intact) */
export function mergeDirect(group) {
  const buckets = new Map();
  const rm = [];
  for (const o of group.children) {
    if (!o.isMesh || o.userData.noMerge) continue;
    o.updateMatrix();
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrix);
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(g);
    rm.push(o);
  }
  if (rm.length < 2) return;
  for (const o of rm) group.remove(o);
  for (const [mat, gs] of buckets) {
    const m = new THREE.Mesh(concatGeometries(gs), mat);
    m.castShadow = true;
    group.add(m);
  }
}
function flipWinding(g) {
  const p = g.attributes.position.array;
  for (let i = 0; i < p.length; i += 9) {
    for (let k = 0; k < 3; k++) {
      const t = p[i + 3 + k];
      p[i + 3 + k] = p[i + 6 + k];
      p[i + 6 + k] = t;
    }
  }
}

/* ---------- 2D collision primitives ---------- */
export class SpatialHash {
  constructor(cell = 24) {
    this.cell = cell;
    this.map = new Map();
    this.stamp = 0;
  }
  _k(i, j) {
    return (i + 4096) * 8192 + (j + 4096);
  }
  insert(o) {
    const r = o.br;
    const c = this.cell;
    const i0 = Math.floor((o.x - r) / c), i1 = Math.floor((o.x + r) / c);
    const j0 = Math.floor((o.z - r) / c), j1 = Math.floor((o.z + r) / c);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const k = this._k(i, j);
        let b = this.map.get(k);
        if (!b) this.map.set(k, (b = []));
        b.push(o);
      }
    o._s = 0;
  }
  query(x, z, r, out) {
    out.length = 0;
    const s = ++this.stamp;
    const c = this.cell;
    const i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c);
    const j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const b = this.map.get(this._k(i, j));
        if (!b) continue;
        for (const o of b) {
          if (o._s === s) continue;
          o._s = s;
          out.push(o);
        }
      }
    return out;
  }
}
export function circleCol(x, z, r, extra = {}) {
  return { t: 0, x, z, r, br: r, ...extra };
}
export function boxCol(x, z, hx, hz, rot = 0, extra = {}) {
  return { t: 1, x, z, hx, hz, c: Math.cos(rot), s: Math.sin(rot), br: Math.hypot(hx, hz), ...extra };
}
/** Returns {nx, nz, pen} when circle (x,z,R) overlaps obstacle o, else null. */
export function collideCircle(x, z, R, o, res) {
  if (o.t === 0) {
    const dx = x - o.x, dz = z - o.z;
    const d2 = dx * dx + dz * dz, rr2 = R + o.r;
    if (d2 >= rr2 * rr2) return null;
    const d = Math.sqrt(d2) || 0.0001;
    res.nx = dx / d;
    res.nz = dz / d;
    res.pen = rr2 - d;
    return res;
  }
  // oriented box: local coords (lx along rotated x axis)
  const dx = x - o.x, dz = z - o.z;
  const lx = dx * o.c - dz * o.s;
  const lz = dx * o.s + dz * o.c;
  const qx = clamp(lx, -o.hx, o.hx), qz = clamp(lz, -o.hz, o.hz);
  let ex = lx - qx, ez = lz - qz;
  const d2 = ex * ex + ez * ez;
  if (d2 >= R * R) return null;
  let nlx, nlz, pen;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    nlx = ex / d;
    nlz = ez / d;
    pen = R - d;
  } else {
    const px = o.hx - Math.abs(lx), pz = o.hz - Math.abs(lz);
    if (px < pz) {
      nlx = Math.sign(lx) || 1;
      nlz = 0;
      pen = px + R;
    } else {
      nlx = 0;
      nlz = Math.sign(lz) || 1;
      pen = pz + R;
    }
  }
  // back to world (inverse rotation)
  res.nx = nlx * o.c + nlz * o.s;
  res.nz = -nlx * o.s + nlz * o.c;
  res.pen = pen;
  return res;
}
