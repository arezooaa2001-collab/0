// ابزارهای عمومی: اعداد تصادفی، نویز، ریاضی، ادغام هندسه و اعداد فارسی
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));
export const wrapAngle = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

export function mulberry32(seed) {
  let a = seed >>> 0;
  const f = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (a1, b1) => a1 + (b1 - a1) * f();
  f.int = (a1, b1) => Math.floor(a1 + (b1 - a1 + 1) * f());
  f.pick = (arr) => arr[Math.floor(f() * arr.length) % arr.length];
  f.chance = (p) => f() < p;
  return f;
}

// نویز مقداری دوبعدی هموار
export function makeNoise2D(seed = 1) {
  const rng = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = new Float32Array(512);
  for (let i = 0; i < 512; i++) grad[i] = rng() * 2 - 1;
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const a = grad[perm[X + perm[Y]]], b = grad[perm[X + 1 + perm[Y]]];
    const c = grad[perm[X + perm[Y + 1]]], d = grad[perm[X + 1 + perm[Y + 1]]];
    const u = fade(xf), v = fade(yf);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  n2.fbm = (x, y, oct = 4, lac = 2, gain = 0.5) => {
    let amp = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += amp * n2(x * f, y * f); n += amp; amp *= gain; f *= lac; }
    return s / n;
  };
  return n2;
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export function toFa(v) {
  return String(v).replace(/[0-9]/g, (d) => FA_DIGITS[+d]);
}
export function fromFa(str) {
  return String(str)
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}
export function fmtNum(n) {
  return toFa(Math.round(n).toLocaleString('en-US'));
}
export function fmtTime(sec) {
  if (!isFinite(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec * 1000) % 1000);
  return toFa(`${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`);
}

// ادغام هندسه‌ها با ویژگی‌های مشترک (موقعیت، نرمال، uv و ویژگی‌های سفارشی)
export function mergeGeos(list, attrNames = ['position', 'normal', 'uv']) {
  const geos = list.filter(Boolean).map((g) => {
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
  });
  if (!geos.length) return new THREE.BufferGeometry();
  let vCount = 0, iCount = 0;
  for (const g of geos) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  const arrays = {};
  for (const name of attrNames) {
    const src = geos.find((g) => g.attributes[name]);
    if (!src) continue;
    const size = src.attributes[name].itemSize;
    const fill = name === 'color' ? 1 : 0;
    arrays[name] = { size, arr: new Float32Array(vCount * size).fill(fill) };
  }
  const index = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  let vo = 0, io = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    for (const name in arrays) {
      const { size, arr } = arrays[name];
      const a = g.attributes[name];
      if (a) {
        const sz = Math.min(size, a.itemSize);
        for (let i = 0; i < n; i++) for (let k = 0; k < sz; k++) arr[(vo + i) * size + k] = a.getComponent(i, k);
      }
    }
    if (g.index) { for (let i = 0; i < g.index.count; i++) index[io++] = g.index.getX(i) + vo; }
    else { for (let i = 0; i < n; i++) index[io++] = i + vo; }
    vo += n;
  }
  for (const name in arrays) out.setAttribute(name, new THREE.BufferAttribute(arrays[name].arr, arrays[name].size));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

// افزودن ویژگی ثابت به همه رئوس یک هندسه
export function fillAttr(geo, name, values) {
  const n = geo.attributes.position.count;
  const size = values.length;
  const arr = new Float32Array(n * size);
  for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) arr[i * size + k] = values[k];
  geo.setAttribute(name, new THREE.BufferAttribute(arr, size));
  return geo;
}

// متریال مشترک «رنگ و زبری در رأس»: ده‌ها قطعه با متریال‌های ساده در یک draw call
const _vpbr = new Map();
export function vertexPBRMaterial(side = THREE.FrontSide) {
  if (_vpbr.has(side)) return _vpbr.get(side);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, side, roughness: 1, metalness: 1 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aMR; varying vec2 vMR;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMR = aMR;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vMR;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vMR.y;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vMR.x;');
  };
  m.customProgramCacheKey = () => 'vpbr';
  m.userData.vpbr = true;
  _vpbr.set(side, m);
  return m;
}
const _baseOBC = THREE.Material.prototype.onBeforeCompile;
export function pbrEligible(m) {
  return m && m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial && !m.map && !m.normalMap && !m.alphaMap && !m.emissiveMap && !m.roughnessMap && !m.metalnessMap &&
    !m.transparent && !m.vertexColors && !m.userData.noMerge && m.onBeforeCompile === _baseOBC && (m.emissiveIntensity === 0 || (m.emissive.r + m.emissive.g + m.emissive.b) === 0);
}

// ادغام همه قطعات ثابت یک گروه: متریال‌های ساده در یک متریال مشترک و بقیه بر اساس متریال،
// با تقسیم‌بندی مکانی (cell) تا حذف خارج از دید دوربین همچنان کار کند
export function optimizeStatic(root, { cell = 0, mapCell, skip = () => false } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const toRemove = [];
  const box = new THREE.Box3(), ctr = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o === root) return;
    if (o.userData.keep || skip(o)) return;
    let p = o.parent; let dyn = false;
    while (p && p !== root) { if (p.userData.dynamic || p.userData.keep) { dyn = true; break; } p = p.parent; }
    if (dyn || o.userData.dynamic) return;
    const m = o.material; if (Array.isArray(m) || !o.visible) return;
    const pbr = pbrEligible(m);
    let ck = '';
    const cs = (m.map && mapCell !== undefined) ? mapCell : cell;
    if (cs) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); box.getCenter(ctr);
      ck = Math.floor(ctr.x / cs) + ':' + Math.floor(ctr.z / cs) + ':';
    }
    const key = ck + (pbr ? 'pbr' + m.side : m.uuid);
    const src = o.geometry;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', src.attributes.position);
    if (src.attributes.normal) geo.setAttribute('normal', src.attributes.normal);
    if (src.attributes.uv) geo.setAttribute('uv', src.attributes.uv);
    if (src.attributes.color) geo.setAttribute('color', src.attributes.color);
    if (src.index) geo.setIndex(src.index);
    const g2 = geo.clone();
    g2.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (pbr) {
      const c = m.color; fillAttr(g2, 'color', [c.r, c.g, c.b]); fillAttr(g2, 'aMR', [m.metalness, m.roughness]);
    }
    if (!buckets.has(key)) buckets.set(key, { pbr, mat: pbr ? vertexPBRMaterial(m.side) : m, geos: [], cast: false, recv: false, order: o.renderOrder });
    const b = buckets.get(key);
    b.geos.push(g2); b.cast = b.cast || o.castShadow; b.recv = b.recv || o.receiveShadow;
    toRemove.push(o);
  });
  for (const o of toRemove) o.parent.remove(o);
  const made = [];
  for (const [, b] of buckets) {
    const names = ['position', 'normal', 'uv'];
    if (b.pbr) names.push('color', 'aMR'); else if (b.mat.vertexColors) names.push('color');
    const mesh = new THREE.Mesh(mergeGeos(b.geos, names), b.mat);
    mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; mesh.renderOrder = b.order;
    root.add(mesh); made.push(mesh);
  }
  return made;
}
// سازگاری با کد قدیمی
export function mergeStaticByMaterial(root, opts = {}) { return optimizeStatic(root, opts); }

export function hsl(h, s, l) { return new THREE.Color().setHSL(h, s, l); }

export const isTouch = () => (typeof window !== 'undefined') && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);

export function sleepFrame() { return new Promise((r) => requestAnimationFrame(() => r())); }
