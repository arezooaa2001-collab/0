/**
 * Prism Rush — procedural character models + procedural animation.
 *
 * All characters are original designs built from Three.js primitives only
 * (plus two tiny generated CanvasTextures). One unit = one metre. Rig origin is
 * at the feet (y = 0), facing +Z, +Y up. The game owns an outer container; this
 * module only animates the contents of `rig.root`.
 *
 * Exports:
 *   CHARACTER_IDS, CHARACTER_INFO, createRig(charId, {quality, skin}), disposeCharacterCache()
 *
 * Rig API:
 *   root, height, ballRadius, charId, skin
 *   update(dt, anim)        anim: {state, speed, speedNorm, boosting, vy, lean, pitch, charge,
 *                                  wallSide, timeInState, prism, lod}
 *   setExpression(name, holdSeconds = 2.5)
 *   lookAt(worldVec3 | null)
 *   setSkin(id), setOpacity(a), setPrism(bool), setVisible(bool), dispose()
 *   getJoint(name)  'head','hand_l','hand_r','foot_l','foot_r','chest','hips','spine','neck',
 *                   'center' (ball/body centre), 'tail' (tail tip, if any)
 */
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// math helpers
// ---------------------------------------------------------------------------
const TAU = Math.PI * 2;
const PI = Math.PI;
const HP = Math.PI / 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sat = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sm = (t) => { t = sat(t); return t * t * (3 - 2 * t); };
const ss = (a, b, x) => sm((x - a) / (b - a));
const dk = (lambda, dt) => 1 - Math.exp(-lambda * dt);
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const bump = (t) => { t = sat(t); const s = Math.sin(t * PI); return s * s; };
const env = (t, dur, fin, fout) => ss(0, fin, t) * (1 - ss(dur - fout, dur, t));
const ease = (t) => { t = sat(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const kv = (k, a, b, c) => (k <= 1 ? lerp(a, b, k) : lerp(b, c, Math.min(1, k - 1)));
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------------------
// character data
// ---------------------------------------------------------------------------
const COMMON = {
  sclera: '#fbfaf6', pupil: '#0a0a12', highlight: '#ffffff', mouth: '#6e1f2c',
  lens: '#8fdcff', nose: '#2a2226', inner: '#f2a7b8', dark: '#2b2d34',
};

const DEFS = {
  zara: {
    info: { name: 'Zara', species: 'hare', voicePitch: 1.15, height: 1.3 },
    colors: (s) => ({ primary: s.fur, secondary: s.belly, accent: s.accent }),
    skins: {
      default: { fur: '#19b3a6', belly: '#f7ecd6', accent: '#c8102e', dark: '#2b2d34', iris: '#f4a516', shoe: '#ff7a1a', sole: '#2d2e36', extra: '#3a3f4b', lens: '#8fe4ff', inner: '#f5a5b6', nose: '#e06f87' },
      midnight: { fur: '#523a8a', belly: '#e6dff8', accent: '#f2b632', dark: '#1d1b2b', iris: '#ffd34d', shoe: '#9c8cff', sole: '#1f1d33', extra: '#2a2740', lens: '#ffd98a', inner: '#d9a2e0', nose: '#c77fbf' },
      sunset: { fur: '#ff875a', belly: '#fff1dc', accent: '#6b2d91', dark: '#3b2540', iris: '#22a596', shoe: '#ffd23f', sole: '#3b1f4a', extra: '#4a2b52', lens: '#ffc0e0', inner: '#ffb3c1', nose: '#d9576f' },
      arctic: { fur: '#e8f2f6', belly: '#ffffff', accent: '#17a9cf', dark: '#4f5b6b', iris: '#3aa8ff', shoe: '#bfefff', sole: '#3c4f60', extra: '#5d6b7c', lens: '#bff3ff', inner: '#ffc3cf', nose: '#e98ea2' },
    },
    dims: { thigh: 0.21, shin: 0.22, ankle: 0.07, hipX: 0.07, hipJY: -0.01, spineY: 0.08, chestY: 0.12, neckY: 0.12, headY: 0.035, headCY: 0.19, headCZ: 0.015, headR: 0.265, shX: 0.125, shY: 0.085, upper: 0.16, fore: 0.15, ballR: 0.45 },
    style: { stance: 0.02, armOut: 0.02, bounce: 0.006, tailUp: 0.3 },
    attack: 'kick', victory: 'fistpump', fidget: 'tap',
    expr: {},
    alias: { nose: 'inner', extra: 'sole' },
    build: buildZara,
  },
  pip: {
    info: { name: 'Pip', species: 'sugar glider', voicePitch: 1.4, height: 1.1 },
    colors: (s) => ({ primary: s.fur, secondary: s.fur2, accent: s.accent }),
    skins: {
      default: { fur: '#f8c630', fur2: '#968679', belly: '#fff3c8', accent: '#8a5631', dark: '#3b2f2b', iris: '#26170f', extra: '#d0a052', lens: '#9fe6ff', inner: '#f6b3a4', nose: '#3b2a2a', membrane: '#ffe48a' },
      dusk: { fur: '#c7a6ff', fur2: '#5c5672', belly: '#f1e8ff', accent: '#3e3456', membrane: '#e2d0ff', iris: '#1a1430', extra: '#c9c0e8', inner: '#f0b8e0' },
      mint: { fur: '#8ee6c2', fur2: '#788a85', belly: '#eefff7', accent: '#c0583a', membrane: '#c4f5df', iris: '#10261f', extra: '#e0c070' },
      cocoa: { fur: '#d38d50', fur2: '#5d483d', belly: '#fbe5c8', accent: '#2f6f8a', membrane: '#ecc090', iris: '#1c0f08', extra: '#d8d8e0' },
    },
    dims: { thigh: 0.165, shin: 0.165, ankle: 0.055, hipX: 0.068, hipJY: -0.01, spineY: 0.065, chestY: 0.1, neckY: 0.095, headY: 0.03, headCY: 0.18, headCZ: 0.015, headR: 0.252, shX: 0.118, shY: 0.07, upper: 0.13, fore: 0.12, ballR: 0.39 },
    style: { stance: 0.03, armOut: 0.0, bounce: 0, tailUp: 0.55, handsIn: 1 },
    attack: 'spinkick', victory: 'spin', fidget: 'look',
    expr: { lt: -0.08 },
    alias: { nose: 'pupil' },
    build: buildPip,
  },
  rook: {
    info: { name: 'Rook', species: 'pangolin', voicePitch: 0.8, height: 1.3 },
    colors: (s) => ({ primary: s.fur2, secondary: s.fur, accent: s.accent }),
    skins: {
      default: { fur: '#dcb68b', fur2: '#a32e22', belly: '#ecd3b0', accent: '#5d636e', extra2: '#dcb24c', dark: '#2c2320', iris: '#4f9a54', shoe: '#4b3427', sole: '#231d1a', nose: '#3a2a24', inner: '#c98f73' },
      obsidian: { fur: '#bba68f', fur2: '#2f2b37', belly: '#d8c8b4', accent: '#b3432d', extra2: '#e8e2d0', iris: '#ff8a3d', shoe: '#1f1c22', sole: '#121014' },
      jade: { fur: '#e3caa0', fur2: '#2f8060', belly: '#f2e2c4', accent: '#8b6a3a', extra2: '#e6c45a', iris: '#d9a23a', shoe: '#3a2b20' },
      gold: { fur: '#f1dab6', fur2: '#d29d18', belly: '#fbecd4', accent: '#4b3f74', extra2: '#f5f0e0', iris: '#5a7dff', shoe: '#3d2f5c', sole: '#221a33' },
    },
    dims: { thigh: 0.18, shin: 0.17, ankle: 0.085, hipX: 0.095, hipJY: -0.01, spineY: 0.085, chestY: 0.13, neckY: 0.135, headY: 0.035, headCY: 0.185, headCZ: 0.02, headR: 0.262, shX: 0.18, shY: 0.08, upper: 0.16, fore: 0.15, ballR: 0.47 },
    style: { stance: 0.08, armOut: 0.14, bounce: 0, tailUp: 0.0, heavy: 1 },
    attack: 'punch', victory: 'flex', fidget: 'knuckles',
    expr: { bt: 0.14, by: -0.004 },
    alias: { nose: 'pupil', fur2: 'scales' },
    build: buildRook,
  },
  lumi: {
    info: { name: 'Lumi', species: 'gecko', voicePitch: 1.3, height: 1.25 },
    colors: (s) => ({ primary: s.fur, secondary: s.spots, accent: s.accent }),
    skins: {
      default: { fur: '#b9a3ea', spots: '#7ce9ba', belly: '#f1eaff', accent: '#ff6f91', staff: '#c98a4b', extra: '#3fc7a0', iris: '#ffc933', dark: '#4a3a6a', nose: '#5b4785', inner: '#f6b8d0' },
      coral: { fur: '#ff9f8a', spots: '#ffe27a', belly: '#fff0ea', accent: '#3a8fd6', extra: '#ffd24a', iris: '#35c2a5', dark: '#7a3a3a', nose: '#b85a5a' },
      night: { fur: '#4a4380', spots: '#62f0ff', belly: '#aaa2dc', accent: '#ffcf3d', staff: '#2f2f42', extra: '#62f0ff', iris: '#ff9de0', dark: '#1e1a38', nose: '#2a2550' },
      lime: { fur: '#a3e070', spots: '#ff9ee0', belly: '#f3ffe6', accent: '#7a4bd1', extra: '#ff9ee0', iris: '#ff7b3a', dark: '#3a5a2a', nose: '#4f7a3a' },
    },
    dims: { thigh: 0.21, shin: 0.23, ankle: 0.06, hipX: 0.066, hipJY: -0.01, spineY: 0.075, chestY: 0.12, neckY: 0.115, headY: 0.035, headCY: 0.175, headCZ: 0.02, headR: 0.248, shX: 0.115, shY: 0.08, upper: 0.155, fore: 0.15, ballR: 0.43 },
    style: { stance: 0.035, armOut: 0.03, bounce: 0, tailUp: 0.1 },
    attack: 'staff', victory: 'twirl', fidget: 'lookTail',
    expr: {},
    alias: { nose: 'dark' },
    build: buildLumi,
  },
  vex: {
    info: { name: 'Vex', species: 'panther', voicePitch: 0.95, height: 1.32 },
    colors: (s) => ({ primary: s.fur, secondary: s.glow, accent: s.accent }),
    skins: {
      default: { fur: '#2a2932', belly: '#67636f', accent: '#2c2044', glow: '#a64dff', iris: '#c8f03c', dark: '#121117', shoe: '#18171d', nose: '#4a3a5e', inner: '#4a3a5e', extra: '#9a9aa8' },
      crimson: { glow: '#ff2e55', iris: '#ffb31a', accent: '#3d1018', inner: '#5e2a35', nose: '#5e2a35' },
      ghost: { fur: '#d6d8e2', belly: '#f2f3f8', accent: '#3c4d6b', glow: '#2fc6ff', iris: '#8a63ff', dark: '#6a6f80', shoe: '#e8eaf2', nose: '#9aa0b5', inner: '#b9c1d6' },
      toxic: { fur: '#1f2b23', belly: '#2f3d33', accent: '#14261b', glow: '#3dff8b', iris: '#ff4fd8', inner: '#2f4a38', nose: '#2f4a38' },
    },
    dims: { thigh: 0.225, shin: 0.24, ankle: 0.07, hipX: 0.068, hipJY: -0.01, spineY: 0.085, chestY: 0.13, neckY: 0.125, headY: 0.035, headCY: 0.18, headCZ: 0.015, headR: 0.24, shX: 0.128, shY: 0.09, upper: 0.17, fore: 0.16, ballR: 0.45 },
    style: { stance: 0.03, armOut: 0.05, bounce: 0, tailUp: 0.2, slouch: 0.04, cool: 1 },
    attack: 'roundhouse', victory: 'point', fidget: 'claws',
    expr: { lt: 0.2, tilt: 0.1, mc: -0.12 },
    alias: { nose: 'inner' },
    build: buildVex,
  },
  ember: {
    info: { name: 'Ember', species: 'red panda', voicePitch: 1.2, height: 1.2 },
    colors: (s) => ({ primary: s.fur, secondary: s.belly, accent: s.shoe }),
    skins: {
      default: { fur: '#d05a1c', fur2: '#4a2416', belly: '#fbe6c8', accent: '#1f9e9a', shoe: '#ff5a1a', shoeGlow: '#ff9a1a', sole: '#ffe08a', iris: '#8b4a22', dark: '#2b1a14', nose: '#2b1a14', inner: '#fbe6c8' },
      snow: { fur: '#efe7de', fur2: '#6e5d52', belly: '#ffffff', accent: '#e0474c', shoe: '#5ec8ff', shoeGlow: '#7fe0ff', sole: '#e9f8ff', iris: '#3d7bd9', inner: '#ffffff' },
      ash: { fur: '#6f6866', fur2: '#2b2727', belly: '#d9d3cc', accent: '#ffb52e', shoe: '#9b5cff', shoeGlow: '#c08aff', sole: '#2b2727', iris: '#e0a030', inner: '#d9d3cc' },
      cherry: { fur: '#d63a6a', fur2: '#4a1a2c', belly: '#ffe3ec', accent: '#ffd23f', shoe: '#ffd23f', shoeGlow: '#fff07a', sole: '#4a1a2c', iris: '#6a2a8a', inner: '#ffe3ec' },
    },
    dims: { thigh: 0.18, shin: 0.19, ankle: 0.07, hipX: 0.074, hipJY: -0.01, spineY: 0.07, chestY: 0.115, neckY: 0.11, headY: 0.035, headCY: 0.185, headCZ: 0.015, headR: 0.258, shX: 0.124, shY: 0.075, upper: 0.145, fore: 0.135, ballR: 0.42 },
    style: { stance: 0.03, armOut: 0.02, bounce: 0.004, tailUp: 0.35 },
    attack: 'kick', victory: 'thumbs', fidget: 'stretch',
    expr: {},
    alias: { nose: 'pupil' },
    build: buildEmber,
  },
};

export const CHARACTER_IDS = ['zara', 'pip', 'rook', 'lumi', 'vex', 'ember'];

export const CHARACTER_INFO = {};
for (const id of CHARACTER_IDS) {
  const d = DEFS[id];
  CHARACTER_INFO[id] = {
    id,
    name: d.info.name,
    species: d.info.species,
    voicePitch: d.info.voicePitch,
    colors: d.colors(d.skins.default),
    skins: Object.keys(d.skins),
    height: d.info.height,
    ballRadius: d.dims.ballR,
  };
}

// ---------------------------------------------------------------------------
// geometry cache (shared between rigs; keyed by shape + quality bucket)
// ---------------------------------------------------------------------------
const GEO = new Map();
const TEX = new Map();
const MOUTH_CACHE = new Map();
const FACE_CACHE = new Map();
const SEG = [
  { sw: 10, sh: 8, cyl: 8, lathe: 8, cap: 3, tr: 5, tt: 12, plate: [7, 3], prof: 5 },
  { sw: 20, sh: 14, cyl: 14, lathe: 14, cap: 5, tr: 8, tt: 20, plate: [9, 4], prof: 8 },
  { sw: 28, sh: 20, cyl: 20, lathe: 20, cap: 7, tr: 10, tt: 28, plate: [11, 5], prof: 11 },
];
const bucketOf = (q) => (q < 0.25 ? 0 : q <= 0.75 ? 1 : 2);
function cg(key, make) {
  let g = GEO.get(key);
  if (!g) { g = make(); g.userData.shared = true; GEO.set(key, g); }
  return g;
}
const fk = (v) => Math.round(v * 1000);

function gSphere(b) { return cg(`sph|${b}`, () => new THREE.SphereGeometry(1, SEG[b].sw, SEG[b].sh)); }
function gCapTop(b) { return cg(`capT|${b}`, () => new THREE.SphereGeometry(1, SEG[b].sw, Math.max(4, SEG[b].sh >> 1), 0, TAU, 0, HP)); }
function gCapBot(b) { return cg(`capB|${b}`, () => new THREE.SphereGeometry(1, SEG[b].sw, Math.max(4, SEG[b].sh >> 1), 0, TAU, HP, HP)); }
/** spherical cap around +Z (iris / pupil), concentric with a unit eyeball */
function gEyeCap(b, theta) {
  return cg(`eyecap|${b}|${fk(theta)}`, () => {
    const g = new THREE.SphereGeometry(1, SEG[b].sw, Math.max(4, SEG[b].sh >> 1), 0, TAU, 0, theta);
    g.rotateX(HP);
    return g;
  });
}
function gDome(b, theta) { return cg(`dome|${b}|${fk(theta)}`, () => new THREE.SphereGeometry(1, SEG[b].sw, Math.max(4, SEG[b].sh >> 1), 0, TAU, 0, theta)); }
/** rounded tapered tube from y=0 (radius r0) to y=len (radius r1), pointing +Y */
function gTaper(b, r0, r1, len) {
  return cg(`tap|${b}|${fk(r0)}|${fk(r1)}|${fk(len)}`, () => {
    const n = SEG[b].cap, pts = [];
    for (let i = 0; i <= n; i++) { const a = -HP + (i / n) * HP; pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * r0), Math.sin(a) * r0)); }
    for (let i = 0; i <= n; i++) { const a = (i / n) * HP; pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * r1), len + Math.sin(a) * r1)); }
    return new THREE.LatheGeometry(pts, SEG[b].lathe);
  });
}
function gTorus(b, R, r, arc = TAU) { return cg(`tor|${b}|${fk(R)}|${fk(r)}|${fk(arc)}`, () => new THREE.TorusGeometry(R, r, SEG[b].tr, SEG[b].tt, arc)); }
function gCyl(b, rt, rb, h, open = false) { return cg(`cyl|${b}|${fk(rt)}|${fk(rb)}|${fk(h)}|${open}`, () => new THREE.CylinderGeometry(rt, rb, h, SEG[b].cyl, 1, open)); }
/** lathe from a radius profile function: fn(t) for t∈[0,1] over height [0,len]; ends closed */
function gProfile(key, b, len, fn, closeBottom = true, closeTop = true) {
  return cg(`prof|${b}|${key}`, () => {
    const n = SEG[b].prof + 4, pts = [];
    const r0 = fn(0), r1 = fn(1);
    if (closeBottom && r0 > 1e-3) { pts.push(new THREE.Vector2(1e-4, -r0 * 0.55)); pts.push(new THREE.Vector2(r0 * 0.72, -r0 * 0.38)); }
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push(new THREE.Vector2(Math.max(1e-4, fn(t)), t * len)); }
    if (closeTop && r1 > 1e-3) { pts.push(new THREE.Vector2(r1 * 0.72, len + r1 * 0.38)); pts.push(new THREE.Vector2(1e-4, len + r1 * 0.55)); }
    return new THREE.LatheGeometry(pts, SEG[b].lathe);
  });
}
/** ear / leaf segment: covers t0..t1 of a leaf of total length len and half-width w */
function gLeaf(b, len, w, t0, t1, shape = 0.7, taper = 0.25) {
  const prof = (t) => w * Math.pow(Math.max(0, Math.sin(PI * (0.1 + 0.9 * t))), shape) * (1 - taper * t);
  return gProfile(`leaf|${fk(len)}|${fk(w)}|${fk(t0)}|${fk(t1)}|${fk(shape)}|${fk(taper)}`, b, (t1 - t0) * len,
    (t) => prof(t0 + (t1 - t0) * t), true, t1 < 0.999);
}

const _cq = new THREE.Quaternion(), _ce = new THREE.Euler(), _cv = new THREE.Vector3(), _cs = new THREE.Vector3();
function M(pos = [0, 0, 0], scl = [1, 1, 1], rot = [0, 0, 0], order = 'XYZ') {
  return new THREE.Matrix4().compose(_cv.set(pos[0], pos[1], pos[2]), _cq.setFromEuler(_ce.set(rot[0], rot[1], rot[2], order)), _cs.set(scl[0], scl[1], scl[2]));
}
/** merge [geometry, Matrix4] pairs into one indexed geometry (position/normal/uv) */
function mergeGeos(parts) {
  let nv = 0, ni = 0;
  const gs = parts.map(([g, m]) => {
    const c = g.clone(); c.applyMatrix4(m);
    nv += c.attributes.position.count; ni += c.index ? c.index.count : c.attributes.position.count;
    return c;
  });
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const hasCol = gs.some((c) => c.attributes.color);
  const col = hasCol ? new Float32Array(nv * 3).fill(1) : null;
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const c of gs) {
    const n = c.attributes.position.count;
    pos.set(c.attributes.position.array, vo * 3);
    if (col && c.attributes.color) col.set(c.attributes.color.array, vo * 3);
    if (c.attributes.normal) nor.set(c.attributes.normal.array, vo * 3);
    if (c.attributes.uv) uv.set(c.attributes.uv.array, vo * 2);
    if (c.index) { const a = c.index.array; for (let i = 0; i < a.length; i++) idx[io++] = a[i] + vo; }
    else for (let i = 0; i < n; i++) idx[io++] = vo + i;
    vo += n; c.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
/** closed tube hugging an ellipsoid along a tilted plane (headbands, straps, sashes) */
function gBand(key, b, c, rad, tilt, h, tube, pad = 0.6, scaleR = 1) {
  return cg(`band|${b}|${key}`, () => {
    const pts = [], n = 28;
    const u1 = new THREE.Vector3(1, 0, 0), u2 = new THREE.Vector3(0, Math.sin(tilt), Math.cos(tilt));
    const R = new THREE.Vector3(rad[0], rad[1], rad[2]);
    const p0 = new THREE.Vector3(0, h, 0);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * TAU;
      const dir = u1.clone().multiplyScalar(Math.sin(th)).addScaledVector(u2, Math.cos(th));
      const q = p0.clone().divide(R), e = dir.clone().divide(R);
      const A = e.dot(e), B = q.dot(e), Cc = q.dot(q) - 1;
      const t = (-B + Math.sqrt(Math.max(0, B * B - A * Cc))) / A;
      const p = p0.clone().addScaledVector(dir, t * scaleR);
      const nn = p.clone().divide(R).divide(R).normalize();
      p.addScaledVector(nn, tube * pad).add(new THREE.Vector3(c[0], c[1], c[2]));
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    return new THREE.TubeGeometry(curve, SEG[b].tt * 2, tube, SEG[b].tr, true);
  });
}
/** shingle plate (dome + flat base) with local +Y = outward normal, +Z = upstream */
function gPlateUnit(b, pointed = true) {
  return cg(`plate|${b}|${pointed}`, () => {
    const [w, h] = SEG[b].plate;
    const dome = new THREE.SphereGeometry(1, w, h, 0, TAU, 0, HP);
    const base = new THREE.CircleGeometry(1, w); base.rotateX(HP);
    const g = mergeGeos([[dome, new THREE.Matrix4()], [base, new THREE.Matrix4()]]);
    dome.dispose(); base.dispose();
    // taper the trailing edge (-Z) into a rounded point, like a fingernail scale
    const P = g.attributes.position;
    const col = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      const z = P.getZ(i), y = P.getY(i), k = sat(-z);
      if (pointed) {
        P.setX(i, P.getX(i) * (1 - 0.55 * k * k));
        P.setZ(i, z * (z < 0 ? 1.15 : 1));
      }
      // darker where tucked under the previous row, lighter at the exposed tip
      let sh = lerp(0.55, 1.12, sat((1 - z) * 0.5));
      if (y < 0.02) sh = 0.42;
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = sh;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  });
}
const _pX = new THREE.Vector3(), _pY = new THREE.Vector3(), _pZ = new THREE.Vector3();
function plateMatrix(p, n, t, w, l, th, lift) {
  _pY.copy(n).normalize();
  _pZ.copy(t).multiplyScalar(-1); _pZ.addScaledVector(_pY, -_pZ.dot(_pY)).normalize();
  _pX.crossVectors(_pY, _pZ).normalize();
  const m = new THREE.Matrix4().makeBasis(_pX, _pY, _pZ);
  m.multiply(new THREE.Matrix4().makeRotationX(lift));
  m.multiply(new THREE.Matrix4().makeScale(w, th, l));
  m.setPosition(p.x, p.y, p.z);
  return m;
}
/** plates on an ellipsoid. dir(a,b) = (sin b, cos b cos a, -cos b sin a): a=0 top, a=π/2 back */
function ellipsoidPlates(b, c, rad, rows, opts) {
  const out = [];
  const unit = gPlateUnit(b, opts.pointed !== false);
  const P = new THREE.Vector3(), N = new THREE.Vector3(), T = new THREE.Vector3(), D = new THREE.Vector3();
  for (let i = 0; i < rows.length; i++) {
    const [a, bmax, cols] = rows[i];
    for (let k = 0; k < cols; k++) {
      const bb = cols === 1 ? 0 : -bmax + (2 * bmax * k) / (cols - 1);
      D.set(Math.sin(bb), Math.cos(bb) * Math.cos(a), -Math.cos(bb) * Math.sin(a));
      P.set(c[0] + D.x * rad[0], c[1] + D.y * rad[1], c[2] + D.z * rad[2]);
      N.set(D.x / rad[0], D.y / rad[1], D.z / rad[2]).normalize();
      T.set(0, -Math.cos(bb) * Math.sin(a) * rad[1], -Math.cos(bb) * Math.cos(a) * rad[2]).normalize();
      P.addScaledVector(N, opts.off || 0);
      const sc = opts.scale ? opts.scale(i, k) : 1;
      out.push([unit, plateMatrix(P, N, T, opts.w * sc, opts.l * sc, opts.th, opts.lift)]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// generated textures
// ---------------------------------------------------------------------------
function cachedTex(key, make) {
  if (typeof document === 'undefined') return null;
  let t = TEX.get(key);
  if (!t) { t = make(); TEX.set(key, t); }
  return t;
}
function swirlTexture() {
  return cachedTex('swirl', () => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 128);
    for (let i = 0; i < 7; i++) {
      const u0 = (i / 7) * 256 + (i % 2) * 9;
      const len = 60 + (i % 3) * 18;
      const grad = g.createLinearGradient(u0, 0, u0 + len, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.8, 'rgba(255,255,255,0.85)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      const v0 = 18 + (i % 3) * 10, v1 = 110 - ((i + 1) % 3) * 10;
      g.beginPath();
      g.moveTo(u0, v0); g.quadraticCurveTo(u0 + len * 0.5, (v0 + v1) * 0.5 - 30, u0 + len, v0 + 6);
      g.lineTo(u0 + len, v1 - 6); g.quadraticCurveTo(u0 + len * 0.5, (v0 + v1) * 0.5 + 30, u0, v1);
      g.closePath(); g.fill();
      // wrap copy
      if (u0 + len > 256) { g.save(); g.translate(-256, 0); g.fill(); g.restore(); }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}
function stripeTexture() {
  return cachedTex('stripes', () => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#fff';
    const bands = [0.16, 0.38, 0.6, 0.82];
    bands.forEach((v, i) => {
      const y = v * 128;
      for (const side of [0, 64]) {
        const x0 = side + 6 + i * 7;
        g.beginPath();
        g.moveTo(x0, y);
        g.quadraticCurveTo(x0 + 22, y - 6, x0 + 46, y - 1);
        g.quadraticCurveTo(x0 + 24, y + 2.5, x0, y);
        g.fill();
      }
    });
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

// ---------------------------------------------------------------------------
// materials
// ---------------------------------------------------------------------------
const ROLE = {
  fur: { r: 0.82 }, fur2: { r: 0.82 }, belly: { r: 0.88 }, accent: { r: 0.7 }, dark: { r: 0.65 },
  inner: { r: 0.8 }, nose: { r: 0.32, gloss: 1 }, sclera: { r: 0.16, gloss: 1 }, iris: { r: 0.12, gloss: 1 },
  pupil: { r: 0.06, gloss: 1 }, shoe: { r: 0.42, gloss: 1 }, sole: { r: 0.6 }, extra: { r: 0.45, m: 0.2 },
  extra2: { r: 0.32, m: 0.45 }, lens: { r: 0.06, gloss: 1, em: 0.3 }, mouth: { r: 0.6 },
  membrane: { r: 0.85, side: 2 }, stripe: { r: 0.8, stripes: 1 }, glow: { r: 0.4, em: 1.4 },
  spots: { r: 0.7 }, staff: { r: 0.55 }, highlight: { basic: 1 }, scales: { r: 0.55, vc: 1 },
};
const PRISM_BODY = new THREE.Color('#fff3d2');
const PRISM_GEAR = new THREE.Color('#ffd25e');
const PRISM_EM = new THREE.Color('#ffbf3a');
const PRISM_AURA = new THREE.Color('#ffe7a0');
const PRISM_BODY_ROLES = new Set(['fur', 'fur2', 'belly', 'inner', 'membrane', 'spots', 'stripe', 'scales']);
const PRISM_SKIP = new Set(['sclera', 'pupil', 'highlight', 'mouth']);

const AURA_VS = `
varying vec3 vN; varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const AURA_FS = `
uniform vec3 uColor; uniform float uIntensity; uniform float uOpacity; uniform float uPower; uniform float uTime;
varying vec3 vN; varying vec3 vV;
void main() {
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  f = pow(f, uPower);
  float ripple = 0.85 + 0.15 * sin(uTime * 9.0 + vN.y * 7.0);
  float a = clamp((0.07 + f * 1.25) * uOpacity * ripple, 0.0, 1.0);
  gl_FragColor = vec4(uColor * uIntensity * (0.4 + f * 1.4), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ---------------------------------------------------------------------------
// pose channels
// ---------------------------------------------------------------------------
const CHN = [
  'rootPitch', 'rootRoll', 'rootYaw', 'squash', 'cPitch', 'cRoll', 'cYaw', 'cy', 'cz',
  'px', 'py', 'pz', 'hipPitch', 'hipYaw', 'hipRoll',
  'spinePitch', 'spineYaw', 'spineRoll', 'chestPitch', 'chestYaw', 'chestRoll',
  'neckPitch', 'neckYaw', 'headPitch', 'headYaw', 'headRoll',
  'shL', 'armSwL', 'armRaL', 'armTwL', 'elbowL', 'wristL',
  'shR', 'armSwR', 'armRaR', 'armTwR', 'elbowR', 'wristR',
  'legSwL', 'legSpL', 'legTwL', 'kneeL', 'ankleL',
  'legSwR', 'legSpR', 'legTwR', 'kneeR', 'ankleR',
  'tailPitch', 'tailYaw', 'tailCurl', 'earBack', 'earSpread', 'earDroop',
  'membrane', 'aura', 'ball', 'staffSpin', 'gazeYaw', 'gazePitch',
];
const C = {};
CHN.forEach((n, i) => { C[n] = i; });
const NCH = CHN.length;
const ARM = [C.shL, C.shR];
const LEG = [C.legSwL, C.legSwR];

function arm(p, s, sw, ra, tw, el, wr) {
  const o = ARM[s];
  p[o + 1] = sw; p[o + 2] = ra;
  if (tw !== undefined) p[o + 3] = tw;
  if (el !== undefined) p[o + 4] = el;
  if (wr !== undefined) p[o + 5] = wr;
}
function leg(p, s, sw, sp, tw, kn, an) {
  const o = LEG[s];
  p[o] = sw; p[o + 1] = sp;
  if (tw !== undefined) p[o + 2] = tw;
  if (kn !== undefined) p[o + 3] = kn;
  if (an !== undefined) p[o + 4] = an;
}
/** set ankle so the foot is level with the ground (plus extra toe-down) */
function flatFoot(p, s, extra = 0) {
  const o = LEG[s];
  p[o + 4] = p[o] - p[o + 3] - p[C.hipPitch] - p[C.rootPitch] - p[C.cPitch] + extra;
}
/** keep feet planted when the pelvis shifts sideways / rolls */
function plant(p, r) {
  const L = r.d.thigh + r.d.shin;
  const dsp = p[C.px] / L + p[C.hipRoll];
  p[C.legSpL] -= dsp; p[C.legSpR] += dsp;
}

// ---------------------------------------------------------------------------
// expressions
// ---------------------------------------------------------------------------
const EXPR_KEYS = ['lt', 'lb', 'tilt', 'by', 'bt', 'mc', 'mo', 'mw', 'pu', 'sm'];
const EXPR = {
  neutral: { lt: -0.7, lb: 0.95, tilt: 0, by: 0, bt: 0, mc: 0.4, mo: 0, mw: 1, pu: 1, sm: 0 },
  happy: { lt: -0.78, lb: 0.3, tilt: -0.05, by: 0.012, bt: -0.12, mc: 1, mo: 0.6, mw: 1.15, pu: 1.08, sm: 0 },
  determined: { lt: -0.3, lb: 0.6, tilt: 0.22, by: -0.006, bt: 0.32, mc: 0.6, mo: 0.18, mw: 1.1, pu: 0.95, sm: 0.25 },
  hurt: { lt: 0.4, lb: 0.1, tilt: -0.15, by: 0.006, bt: -0.4, mc: -0.85, mo: 0.45, mw: 0.9, pu: 0.85, sm: 0 },
  sad: { lt: -0.25, lb: 0.85, tilt: -0.3, by: 0.008, bt: -0.45, mc: -0.75, mo: 0, mw: 0.8, pu: 1.12, sm: 0 },
  surprised: { lt: -1.1, lb: 1.15, tilt: 0, by: 0.022, bt: -0.08, mc: 0, mo: 0.85, mw: 0.55, pu: 0.72, sm: 0 },
  angry: { lt: -0.26, lb: 0.66, tilt: 0.38, by: -0.01, bt: 0.55, mc: -0.55, mo: 0.22, mw: 1, pu: 0.85, sm: 0 },
};
const AUTO_EXPR = {
  idle: 'neutral', walk: 'neutral', run: 'neutral', sprint: 'determined', skid: 'surprised', jump: 'happy',
  fall: 'neutral', ball: 'determined', spindash: 'determined', slide: 'determined', wallrun: 'determined',
  climb: 'determined', glide: 'happy', fly: 'happy', swim: 'neutral', grind: 'happy', hurt: 'hurt',
  land: 'neutral', backflip: 'happy', sideflip: 'happy', stomp: 'angry', attack: 'angry', pogo: 'happy',
  celebrate: 'happy', victory: 'happy', defeat: 'sad', frustrated: 'angry', high5: 'happy', cannon: 'surprised',
  dead: 'hurt',
};

// state flags: look = head tracking weight, lean = lean response, loco = uses run cycle
const SF = {
  idle: { look: 1, lean: 0.4 }, walk: { look: 1, lean: 1, loco: 1 }, run: { look: 0.9, lean: 1, loco: 1 },
  sprint: { look: 0.5, lean: 1, loco: 1 }, skid: { look: 0.5, lean: 0.6 }, jump: { look: 0.6, lean: 0.6 },
  fall: { look: 0.6, lean: 0.6 }, ball: { lean: 0 }, spindash: { lean: 0 }, slide: { look: 0.6, lean: 0.7 },
  wallrun: { look: 0.3, lean: 0.4, loco: 1 }, climb: { look: 0.2, lean: 0 }, glide: { look: 0.4, lean: 1 },
  fly: { look: 0.4, lean: 1 }, swim: { look: 0.3, lean: 0.6 }, grind: { look: 0.6, lean: 0.8 },
  hurt: { lean: 0 }, land: { look: 0.5, lean: 0.5 }, backflip: { lean: 0 }, sideflip: { lean: 0 },
  stomp: { lean: 0 }, attack: { look: 0.3, lean: 0.4 }, pogo: { look: 0.4, lean: 0.4 },
  celebrate: { look: 0.5, lean: 0 }, victory: { look: 0.3, lean: 0 }, defeat: { lean: 0 },
  frustrated: { lean: 0 }, high5: { look: 1, lean: 0 }, cannon: { lean: 0 }, dead: { lean: 0 },
};
const STATES = Object.keys(SF);
const LOCO = new Set(['walk', 'run', 'sprint']);
const BALLISH = new Set(['ball', 'spindash', 'cannon']);

// ---------------------------------------------------------------------------
// secondary-motion chain (ears, tails, scarf ribbons)
// ---------------------------------------------------------------------------
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const _e1 = new THREE.Euler();
const AX = new THREE.Vector3(1, 0, 0), AZ = new THREE.Vector3(0, 0, 1);

class Chain {
  constructor(joints, o) {
    this.joints = joints;
    this.n = joints.length;
    this.rest = joints.map((j) => j.quaternion.clone());
    this.axis = o.axis || new THREE.Vector3(0, 1, 0);
    this.k = o.k ?? 90; this.c = o.c ?? 11;
    this.wind = o.wind ?? 1; this.grav = o.grav ?? 0.3; this.inertia = o.inertia ?? 0.015;
    this.stiff = o.stiff ?? 1; this.maxBend = o.maxBend ?? 1.5;
    this.flutter = o.flutter ?? 0; this.flutterFreq = o.flutterFreq ?? 9;
    this.dyn = o.dyn || null;      // (i, rig, pose, euler) -> euler offset in parent frame
    this.sweep = o.sweep ?? 0;     // cheap lod-1 sweep (rad at full speed, about X)
    this.stretch = o.stretch || null; // {meshes:[], len:[], amount}
    this.kind = o.kind || 'generic';
    this.r = new Float32Array(this.n * 3);
    this.v = new Float32Array(this.n * 3);
    this.prev = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.acc = new THREE.Vector3();
    this.init = false;
    this.restDyn = joints.map(() => new THREE.Quaternion());
    this.phase = Math.random() * 10;
  }
  _restQ(i, rig, p) {
    const q = this.restDyn[i].copy(this.rest[i]);
    if (this.dyn) {
      _e1.set(0, 0, 0);
      this.dyn(i, rig, p, _e1);
      if (_e1.x || _e1.y || _e1.z) { _q1.setFromEuler(_e1); q.premultiply(_q1); }
    }
    return q;
  }
  simple(rig, p, sn) {
    for (let i = 0; i < this.n; i++) {
      const q = this._restQ(i, rig, p);
      const j = this.joints[i];
      if (i === 0 && this.sweep) { _q2.setFromAxisAngle(AX, -this.sweep * Math.min(1.2, sn)); j.quaternion.copy(_q2).multiply(q); }
      else j.quaternion.copy(q);
      this.r[i * 3] = this.r[i * 3 + 1] = this.r[i * 3 + 2] = 0;
    }
    this.init = false;
    this._stretch(sn);
  }
  _stretch(sn) {
    if (!this.stretch) return;
    const s = 1 + this.stretch.amount * clamp(sn, 0, 1.3);
    const { meshes, len } = this.stretch;
    for (let i = 0; i < meshes.length; i++) {
      meshes[i].scale.y = meshes[i].userData.baseSY * s;
      if (i + 1 < this.n) this.joints[i + 1].position.y = len[i] * s;
    }
  }
  update(rig, p, dt, F, sn, time, stiffMul) {
    const anchor = this.joints[0].parent;
    _m1.multiplyMatrices(rig._rootInv, anchor.matrixWorld);
    _v1.setFromMatrixPosition(_m1);
    if (!this.init || dt <= 0) {
      this.prev.copy(_v1); this.vel.set(0, 0, 0); this.acc.set(0, 0, 0); this.init = true;
    } else {
      _v2.copy(_v1).sub(this.prev).divideScalar(dt);
      _v3.copy(_v2).sub(this.vel).divideScalar(dt);
      if (_v3.lengthSq() > 3600) _v3.setLength(60);
      this.acc.lerp(_v3, 0.5);
      this.vel.copy(_v2); this.prev.copy(_v1);
    }
    const Fx = F.x - this.acc.x * this.inertia;
    const Fy = F.y - this.acc.y * this.inertia;
    const Fz = F.z - this.acc.z * this.inertia;
    const steps = dt > 1 / 45 ? 2 : 1;
    const h = dt / steps;
    const k = this.k * stiffMul, c = this.c * Math.sqrt(stiffMul);
    const fl = this.flutter * clamp(sn, 0, 1.3);
    for (let i = 0; i < this.n; i++) {
      const j = this.joints[i];
      const restQ = this._restQ(i, rig, p);
      // parent rotation relative to rig root
      _m1.multiplyMatrices(rig._rootInv, j.parent.matrixWorld);
      _m2.extractRotation(_m1);
      _q2.setFromRotationMatrix(_m2).invert();
      _v2.set(Fx, Fy, Fz).applyQuaternion(_q2);        // force in parent frame
      _v3.copy(this.axis).applyQuaternion(restQ);      // rest direction in parent frame
      _v4.copy(_v3).multiplyScalar(this.stiff).add(_v2);
      let tx = 0, ty = 0, tz = 0;
      if (_v4.lengthSq() > 1e-8) {
        _v4.normalize();
        const d = clamp(_v3.dot(_v4), -1, 1);
        let ang = Math.acos(d);
        if (ang > 1e-4) {
          _v2.crossVectors(_v3, _v4);
          const l = _v2.length();
          if (l > 1e-6) {
            ang = Math.min(ang, this.maxBend);
            _v2.multiplyScalar(ang / l);
            tx = _v2.x; ty = _v2.y; tz = _v2.z;
          }
        }
      }
      if (fl > 0) {
        const ph = time * this.flutterFreq - i * 1.3 + this.phase;
        tx += fl * 0.35 * Math.sin(ph) * (0.5 + i * 0.3);
        ty += fl * 0.25 * Math.sin(ph * 1.37 + 1.1) * (0.5 + i * 0.3);
      }
      const o = i * 3;
      for (let s = 0; s < steps; s++) {
        const ax = k * (tx - this.r[o]) - c * this.v[o];
        const ay = k * (ty - this.r[o + 1]) - c * this.v[o + 1];
        const az = k * (tz - this.r[o + 2]) - c * this.v[o + 2];
        this.v[o] += ax * h; this.v[o + 1] += ay * h; this.v[o + 2] += az * h;
        this.r[o] += this.v[o] * h; this.r[o + 1] += this.v[o + 1] * h; this.r[o + 2] += this.v[o + 2] * h;
      }
      const rx = this.r[o], ry = this.r[o + 1], rz = this.r[o + 2];
      const ra = Math.sqrt(rx * rx + ry * ry + rz * rz);
      if (!Number.isFinite(ra)) { this.r.fill(0); this.v.fill(0); j.quaternion.copy(restQ); continue; }
      if (ra > 1e-6) { _v2.set(rx / ra, ry / ra, rz / ra); _q3.setFromAxisAngle(_v2, ra); j.quaternion.copy(_q3).multiply(restQ); }
      else j.quaternion.copy(restQ);
      j.updateMatrix();
      j.matrixWorld.multiplyMatrices(j.parent.matrixWorld, j.matrix);
    }
    this._stretch(sn);
  }
}

// ---------------------------------------------------------------------------
// Rig
// ---------------------------------------------------------------------------
let RIG_SEED = 1;

class Rig {
  constructor(charId, opts = {}) {
    const def = DEFS[charId] || DEFS.zara;
    this.charId = DEFS[charId] ? charId : 'zara';
    this.def = def;
    this.quality = clamp(num(opts.quality, 0.6), 0, 1);
    this.bucket = bucketOf(this.quality);
    this.height = def.info.height;
    const d = Object.assign({ clavX: 0.035, shZ: 0, neckZ: 0, hipJY: 0, headCZ: 0.015 }, def.dims);
    d.hipY = d.thigh + d.shin + d.ankle - d.hipJY;
    d.pivotH = d.ballR;
    this.d = d;
    this.ballRadius = d.ballR;
    this.seed = RIG_SEED++;
    this._rnd = hash(this.seed * 7.13) * 1000;

    this.root = new THREE.Group();
    this.root.name = `rig_${this.charId}`;
    this.j = {};
    this.mats = {};
    this.matList = [];
    this.meshes = [];
    this.details = [];
    this.chains = [];
    this.ownGeos = [];
    this.eyes = [];
    this.brows = [];
    this.staff = null;
    this.membranes = [];
    this.skin = 'default';
    this.palette = {};

    this._buildSkeleton();
    this._setPalette(opts.skin || 'default');
    def.build(this);
    this._buildFx();

    // animation state
    this.pose = new Float32Array(NCH);
    this.from = new Float32Array(NCH);
    this.out = new Float32Array(NCH);
    this.blendOut = new Float32Array(NCH);
    this.rest = new Float32Array(NCH);
    this._makeRest();
    this.out.set(this.rest);
    this.blendOut.set(this.rest);
    this.from.set(this.rest);
    this.state = 'idle';
    this.prevState = 'idle';
    this.blendT = 1; this.blendDur = 0.15;
    this.time = 0; this.stateTime = 0;
    this.phase = 0; this.climbPhase = 0; this.swimPhase = 0;
    this.k = 0;
    this.spinX = 0; this.spinZ = 0; this.spinRateX = 0; this.spinRateZ = 0;
    this.spinMode = 'none'; this.flipBaseX = 0; this.flipBaseZ = 0; this.flipOffX = 0; this.flipOffZ = 0;
    this.settleX = 0; this.settleZ = 0; this.flipDir = 1; this.spinVX = 0; this.spinVZ = 0; this.settleW = 18;
    this.leanW = 0.4; this.pitchW = 1; this.leanS = 0; this.pitchS = 0;
    this.impact = 0; this.impactT = 9; this.impactA = 0; this._lastTis = 0;
    this.expr = {}; this.exprTarget = 'neutral'; this.exprManual = null; this.exprHold = 0;
    for (const kk of EXPR_KEYS) this.expr[kk] = EXPR.neutral[kk] + (def.expr[kk] || 0);
    this.blink = 0; this.blinkT = -1; this.nextBlink = 1.5 + hash(this.seed) * 2.5; this.winkL = 0;
    this.gaze = { yaw: 0, pitch: 0, ty: 0, tp: 0, next: 1 };
    this.look = { target: null, w: 0, yaw: 0, pitch: 0 };
    this.prism = false; this.prismAmt = 0; this._prismApplied = -1;
    this.opacity = 1;
    this.glow = 0; this._glowApplied = -1;
    this.lod = 0; this._lodApplied = -1;
    this.propMode = 'back';
    this._ankEx = [0, 0];
    this._rootInv = new THREE.Matrix4();
    this._F = new THREE.Vector3();
    this._qRootInv = new THREE.Quaternion();
    this._mouthKey = '';
    this.A = { state: 'idle', speed: 0, speedNorm: 0, boosting: false, vy: 0, lean: 0, pitch: 0, charge: 0, wallSide: 1, t: 0, prism: false, lod: 0 };
    this._applyMaterials(true);
    this._apply(this.out);
    this._updateFace(0, true);
    this.root.updateMatrixWorld(true);
    for (const ch of this.chains) ch.simple(this, this.out, 0);
  }

  // ----------------------------------------------------------------- building
  _G(name, parent, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.name = name; g.position.set(x, y, z);
    parent.add(g);
    this.j[name] = g;
    return g;
  }
  _buildSkeleton() {
    const d = this.d;
    this.body = this._G('body', this.root);
    this.mover = this._G('mover', this.body);
    this.pivot = this._G('pivot', this.mover, 0, d.pivotH, 0);
    const anchor = this._G('anchor', this.pivot, 0, -d.pivotH, 0);
    const hips = this._G('hips', anchor, 0, d.hipY, 0);
    const spine = this._G('spine', hips, 0, d.spineY, 0);
    const chest = this._G('chest', spine, 0, d.chestY, 0);
    const neck = this._G('neck', chest, 0, d.neckY, d.neckZ);
    const head = this._G('head', neck, 0, d.headY, 0);
    this._G('headC', head, 0, d.headCY, d.headCZ);
    hips.rotation.order = 'YXZ'; head.rotation.order = 'YXZ'; this.mover.rotation.order = 'YXZ';
    for (let s = 0; s < 2; s++) {
      const sg = s ? -1 : 1, sx = s ? '_r' : '_l';
      const clav = this._G('clav' + sx, chest, sg * d.clavX, d.shY, d.shZ);
      const a = this._G('arm' + sx, clav, sg * (d.shX - d.clavX), 0, 0);
      a.rotation.order = 'XZY';
      const e = this._G('elbow' + sx, a, 0, -d.upper, 0);
      this._G('hand' + sx, e, 0, -d.fore, 0);
      const t = this._G('thigh' + sx, hips, sg * d.hipX, d.hipJY, 0);
      t.rotation.order = 'XZY';
      const k = this._G('knee' + sx, t, 0, -d.thigh, 0);
      this._G('foot' + sx, k, 0, -d.shin, 0);
    }
  }
  _setPalette(skin) {
    const def = this.def;
    const id = def.skins[skin] ? skin : 'default';
    this.skin = id;
    this.palette = Object.assign({}, COMMON, def.skins.default, def.skins[id]);
    if (!this.palette.membrane) this.palette.membrane = this.palette.fur;
    if (!this.palette.spots) this.palette.spots = this.palette.fur2 || this.palette.belly;
    if (!this.palette.staff) this.palette.staff = this.palette.extra || '#a0703a';
    if (!this.palette.glow) this.palette.glow = this.palette.accent;
    if (!this.palette.fur2) this.palette.fur2 = this.palette.fur;
    if (!this.palette.extra2) this.palette.extra2 = this.palette.extra || '#cccccc';
    if (!this.palette.extra) this.palette.extra = '#888888';
    if (!this.palette.shoe) this.palette.shoe = this.palette.fur2;
    if (!this.palette.sole) this.palette.sole = this.palette.dark;
  }
  mat(role) {
    const al = this.def.alias;
    if (al && al[role]) role = al[role];
    let e = this.mats[role];
    if (e) return e.mat;
    const spec = ROLE[role] || ROLE.fur;
    const b = this.bucket;
    let m;
    if (spec.basic) m = new THREE.MeshBasicMaterial({ color: 0xffffff });
    else if (b === 0) m = new THREE.MeshLambertMaterial();
    else if (b === 2 && spec.gloss) m = new THREE.MeshPhysicalMaterial({ roughness: spec.r, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 });
    else m = new THREE.MeshStandardMaterial({ roughness: spec.r, metalness: spec.m || 0 });
    if (spec.side === 2) m.side = THREE.DoubleSide;
    if (spec.vc) m.vertexColors = true;
    if (spec.stripes) { const t = stripeTexture(); if (t) m.emissiveMap = t; }
    m.name = `${this.charId}_${role}`;
    e = { role, mat: m, base: new THREE.Color(), em: new THREE.Color(0, 0, 0), emI: 0, spec, transparent: false };
    this.mats[role] = e;
    this.matList.push(e);
    this._baseColor(e);
    return m;
  }
  _baseColor(e) {
    const P = this.palette, role = e.role;
    const col = P[role] || P.fur || '#ffffff';
    e.base.set(col);
    e.em.setRGB(0, 0, 0); e.emI = 0;
    if (role === 'stripe') { e.base.set(P.fur); e.em.set(P.glow); e.emI = 1.25; }
    else if (role === 'scales') { e.base.set(P.fur2); }
    else if (role === 'glow') { e.em.set(P.glow); e.base.set(P.glow); e.emI = e.spec.em; }
    else if (role === 'lens') { e.em.set(col); e.emI = 0.3; }
    else if (role === 'shoe' && P.shoeGlow) { e.em.set(P.shoeGlow); e.emI = 0.18; }
  }
  /** add a mesh */
  mesh(parent, geo, role, pos, scl, rot, o = {}) {
    const m = new THREE.Mesh(geo, this.mat(role));
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (scl) { if (typeof scl === 'number') m.scale.setScalar(scl); else m.scale.set(scl[0], scl[1], scl[2]); }
    if (rot) m.rotation.set(rot[0], rot[1], rot[2], rot[3] || 'XYZ');
    m.castShadow = o.shadow !== false; m.receiveShadow = false;
    m.name = o.name || role;
    parent.add(m);
    this.meshes.push(m);
    if (o.detail) this.details.push(m);
    return m;
  }
  ell(parent, role, pos, scl, rot, o) { return this.mesh(parent, gSphere(this.bucket), role, pos, scl, rot, o); }
  limb(joint, role, r0, r1, len, o) {
    // tube hanging down from the joint
    return this.mesh(joint, gTaper(this.bucket, r0, r1, len), role, [0, 0, 0], null, [PI, 0, 0], o);
  }
  merged(key, parts) {
    return cg(`mrg|${this.charId}|${this.bucket}|${key}`, () => mergeGeos(parts()));
  }
  addChain(joints, o) { const c = new Chain(joints, o); this.chains.push(c); return c; }

  /** generic face: eyes with lids, brows, mouth, nose */
  _surfZ(x, y, targets, fallback) {
    const H = this.j.headC;
    const ray = this._ray || (this._ray = new THREE.Raycaster());
    const o = H.localToWorld(new THREE.Vector3(x, y, 1));
    const d = new THREE.Vector3(0, 0, -1).transformDirection(H.matrixWorld);
    ray.set(o, d);
    const hit = ray.intersectObjects(targets, false)[0];
    return hit ? H.worldToLocal(hit.point.clone()).z : fallback;
  }
  face(f) {
    const b = this.bucket, H = this.j.headC;
    this.f = f;
    const fkey = `${this.charId}|${this.bucket}`;
    let fc = FACE_CACHE.get(fkey);
    if (!fc) {
      this.root.updateMatrixWorld(true);
      const head = H.children.filter((c) => c.isMesh && c.name === 'head');
      fc = {
        eyeZ: this._surfZ(f.eyeX, f.eyeY, head, f.eyeZ || 0.18) - f.eyeR[2] * (f.eyeSink ?? 0.56),
        browZ: f.brow ? this._surfZ(f.brow.x, f.brow.y, head, f.brow.z || 0.2) + f.brow.t * 0.2 : 0,
      };
      FACE_CACHE.set(fkey, fc);
    }
    for (let s = 0; s < 2; s++) {
      const sg = s ? -1 : 1;
      const root = new THREE.Group();
      root.position.set(sg * f.eyeX, f.eyeY, fc.eyeZ);
      root.rotation.set(f.eyePitch || 0, sg * f.eyeYaw, sg * (f.eyeRoll || 0), 'YXZ');
      root.scale.set(f.eyeR[0], f.eyeR[1], f.eyeR[2]);
      H.add(root);
      this.mesh(root, gSphere(b), 'sclera', null, null, null, { name: 'sclera' });
      const gaze = new THREE.Group(); root.add(gaze);
      const ir = f.iris, py = f.pupil[1], pxr = f.pupil[0] / f.pupil[1];
      this.mesh(gaze, gEyeCap(b, Math.asin(clamp(ir, 0.1, 0.95))), 'iris', null, [1.012, 1.012, 1.012], null, { name: 'iris' });
      const pupil = this.mesh(gaze, gEyeCap(b, Math.asin(clamp(py, 0.1, 0.9))), 'pupil', null, [1.03 * pxr, 1.03, 1.03], null, { name: 'pupil' });
      const hl = new THREE.Vector3(0.27 * (f.hlX || 1), 0.33, 0.9).normalize().multiplyScalar(1.02);
      this.mesh(root, gSphere(b), 'highlight', [hl.x, hl.y, hl.z], [0.085, 0.085, 0.035], [-0.33, 0.28, 0], { name: 'highlight', detail: true });
      if (f.hl2) {
        const h2 = new THREE.Vector3(-0.2, -0.27, 0.94).normalize().multiplyScalar(1.025);
        this.mesh(root, gSphere(b), 'highlight', [h2.x, h2.y, h2.z], [0.045, 0.045, 0.02], [0.28, -0.2, 0], { name: 'highlight2', detail: true });
      }
      const topRoll = new THREE.Group(); root.add(topRoll);
      const top = new THREE.Group(); topRoll.add(top);
      this.mesh(top, gCapTop(b), f.lidRole || 'fur', null, [1.075, 1.075, 1.075], null, { name: 'lidTop' });
      const botRoll = new THREE.Group(); root.add(botRoll);
      const bot = new THREE.Group(); botRoll.add(bot);
      this.mesh(bot, gCapBot(b), f.lidRole || 'fur', null, [1.065, 1.065, 1.065], null, { name: 'lidBot', detail: true });
      this.eyes.push({ root, gaze, pupil, top, topRoll, bot, botRoll, sg, pup: [1.03 * pxr, 1.03] });
    }
    // brows
    if (f.brow) {
      const bg = gTaper(b, f.brow.t, f.brow.t * 0.8, f.brow.len);
      for (let s = 0; s < 2; s++) {
        const sg = s ? -1 : 1;
        const g = new THREE.Group();
        g.position.set(sg * f.brow.x, f.brow.y, fc.browZ);
        g.rotation.set(f.brow.pitch || -0.25, sg * (f.brow.yaw || 0.3), 0, 'YXZ');
        H.add(g);
        // tube along X, centred
        this.mesh(g, bg, f.brow.role || 'dark', [sg * -f.brow.len * 0.5, 0, 0], [1, 1, 0.65], [0, 0, sg * -HP], { name: 'brow', detail: true });
        this.brows.push({ g, sg, y: f.brow.y });
      }
    }
    // mouth: dynamic tube + open ellipse, projected onto the muzzle surface
    const mg = new THREE.Group();
    const place = this._mouthPlacement(f);
    mg.position.copy(place.p);
    mg.quaternion.copy(place.q);
    H.add(mg);
    this._mouthGeo = this._makeMouthGeo();
    this.ownGeos.push(this._mouthGeo);
    this.mouthLine = this.mesh(mg, this._mouthGeo, f.mouthRole || 'dark', null, null, null, { name: 'mouthLine', detail: true });
    this.mouthOpen = this.mesh(mg, gSphere(b), 'mouth', [0, 0, -0.006], [0.02, 0.01, 0.014], null, { name: 'mouthOpen', detail: true });
    this.mouthG = mg;
  }
  _mouthPlacement(f) {
    const key = `${this.charId}|${this.bucket}`;
    let pl = MOUTH_CACHE.get(key);
    if (pl) return pl;
    const H = this.j.headC;
    const targets = H.children.filter((c) => c.isMesh);
    this.root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const o = H.localToWorld(new THREE.Vector3(0, f.mouthY, 1));
    const d = new THREE.Vector3(0, 0, -1).transformDirection(H.matrixWorld);
    ray.set(o, d);
    const hit = ray.intersectObjects(targets, false)[0];
    const p = new THREE.Vector3(0, f.mouthY, f.mouthZ), q = new THREE.Quaternion();
    if (hit) {
      p.copy(H.worldToLocal(hit.point.clone()));
      p.z += f.mouthT * 0.9;
      if (hit.face) {
        const n = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
        const inv = new THREE.Matrix4().extractRotation(H.matrixWorld).invert();
        n.applyMatrix4(inv); n.x = 0; n.normalize();
        q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n.lerp(new THREE.Vector3(0, 0, 1), 0.35).normalize());
      }
    } else q.setFromAxisAngle(AX, f.mouthPitch || 0);
    pl = { p, q };
    MOUTH_CACHE.set(key, pl);
    return pl;
  }
  _makeMouthGeo() {
    const N = 12, Mr = 6;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * Mr * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((N + 1) * Mr * 3), 3));
    const idx = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < Mr; j++) {
      const a = i * Mr + j, bq = i * Mr + ((j + 1) % Mr), c = (i + 1) * Mr + j, dq = (i + 1) * Mr + ((j + 1) % Mr);
      idx.push(a, c, bq, bq, c, dq);
    }
    g.setIndex(idx);
    g.userData.N = N; g.userData.M = Mr;
    return g;
  }
  _updateMouthGeo(curve, width, smirk) {
    const g = this._mouthGeo, f = this.f, N = g.userData.N, Mr = g.userData.M;
    const P = g.attributes.position.array, Nn = g.attributes.normal.array;
    const w = f.mouthW * 0.5 * width * 1.2, h = f.mouthH * 1.5, rt = f.mouthT * 1.3, bend = f.mouthBend || 0.6;
    const yAt = (s) => curve * h * (s * s - 0.35) + smirk * h * s * 0.8;
    for (let i = 0; i <= N; i++) {
      const s = (i / N) * 2 - 1;
      const x = s * w, y = yAt(s), z = -bend * s * s * w * 0.3;
      const ds = 0.01, dx = 2 * ds * w, dy = yAt(s + ds) - yAt(s - ds);
      const tl = Math.hypot(dx, dy) || 1;
      const nx = -dy / tl, ny = dx / tl;
      const r = rt * (0.35 + 0.65 * Math.pow(Math.sin((i / N) * PI), 0.4));
      for (let j = 0; j < Mr; j++) {
        const th = (j / Mr) * TAU, cx = Math.cos(th), sz = Math.sin(th);
        const ox = nx * cx, oy = ny * cx, oz = sz;
        const o = (i * Mr + j) * 3;
        P[o] = x + ox * r; P[o + 1] = y + oy * r; P[o + 2] = z + oz * r * 0.6;
        Nn[o] = ox; Nn[o + 1] = oy; Nn[o + 2] = oz;
      }
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    g.computeBoundingSphere();
    // open-mouth ellipse placement
    return yAt(0);
  }
  _buildFx() {
    const b = this.bucket, P = this.palette;
    const um = {
      uColor: { value: new THREE.Color(P.accent) }, uIntensity: { value: 1 }, uOpacity: { value: 0 },
      uPower: { value: 2.2 }, uTime: { value: 0 },
    };
    this.auraMat = new THREE.ShaderMaterial({
      uniforms: um, vertexShader: AURA_VS, fragmentShader: AURA_FS, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    });
    this.aura = new THREE.Mesh(gSphere(Math.max(1, b)), this.auraMat);
    this.aura.name = 'aura'; this.aura.castShadow = false; this.aura.renderOrder = 5; this.aura.visible = false;
    this.mover.add(this.aura);
    this.swirlMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(P.accent), map: swirlTexture(), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.swirl = new THREE.Mesh(gSphere(Math.max(1, b)), this.swirlMat);
    this.swirl.name = 'swirl'; this.swirl.castShadow = false; this.swirl.renderOrder = 6; this.swirl.visible = false;
    this.swirl.rotation.z = HP;
    this.swirl.scale.setScalar(this.d.ballR * 0.97);
    this.pivot.add(this.swirl);
    this.centerJ = new THREE.Group(); this.centerJ.name = 'center';
    this.pivot.add(this.centerJ);
  }
  _makeRest() {
    const p = this.rest, st = this.def.style;
    p.fill(0);
    p[C.squash] = 1;
    for (let s = 0; s < 2; s++) {
      arm(p, s, 0.04, 0.14 + (st.armOut || 0), 0, 0.3, 0);
      leg(p, s, 0, 0.03 + (st.stance || 0), 0, 0.06, 0);
      flatFoot(p, s);
    }
    p[C.spinePitch] = st.slouch || 0;
    p[C.tailPitch] = 0;
  }

  // ----------------------------------------------------------------- public API
  getJoint(name) {
    const J = this.j;
    switch (name) {
      case 'head': return J.headC;
      case 'center': case 'ball': return this.centerJ;
      case 'tail': return this.tailTip || J.hips;
      default: return J[name] || null;
    }
  }
  setExpression(name, hold = 2.5) {
    if (!EXPR[name]) name = 'neutral';
    this.exprManual = name;
    this.exprHold = num(hold, 2.5);
  }
  lookAt(v) {
    if (v && typeof v.x === 'number') {
      if (!this.look.target) this.look.target = new THREE.Vector3();
      this.look.target.set(v.x, v.y, v.z);
      this.look.has = true;
    } else this.look.has = false;
  }
  setSkin(id) {
    this._setPalette(id);
    for (const e of this.matList) this._baseColor(e);
    this.auraMat.uniforms.uColor.value.set(this.palette.accent);
    this.swirlMat.color.set(this.palette.accent);
    this._applyMaterials(true);
  }
  setPrism(on) { this.prism = !!on; }
  setVisible(v) { this.root.visible = !!v; }
  setOpacity(a) {
    a = clamp(num(a, 1), 0, 1);
    this.opacity = a;
    const tr = a < 0.999;
    for (const e of this.matList) {
      const m = e.mat;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = a;
      m.depthWrite = !tr;
    }
    const cast = a > 0.6;
    for (const m of this.meshes) m.castShadow = cast;
  }
  dispose() {
    if (this.root.parent) this.root.parent.remove(this.root);
    for (const e of this.matList) e.mat.dispose();
    this.auraMat.dispose(); this.swirlMat.dispose();
    for (const g of this.ownGeos) g.dispose();
    this.matList = []; this.mats = {};
    this.chains = [];
  }

  // ----------------------------------------------------------------- update
  update(dt, a) {
    dt = clamp(num(dt, 1 / 60), 0, 0.1);
    a = a || {};
    const A = this.A;
    let st = typeof a.state === 'string' && SF[a.state] ? a.state : 'idle';
    if (st === 'pogo' && !this.staff) st = 'ball';
    A.boosting = !!a.boosting;
    const defSpeed = { walk: 1.6, run: 8, sprint: 24, wallrun: 18, grind: 16, ball: 14, slide: 10, cannon: 30 }[st] || 0;
    A.speed = Math.max(0, num(a.speed, defSpeed));
    A.speedNorm = Math.max(0, num(a.speedNorm, A.speed / 28));
    A.vy = clamp(num(a.vy, 0), -80, 80);
    A.lean = clamp(num(a.lean, 0), -1.2, 1.2);
    A.pitch = clamp(num(a.pitch, 0), -1.2, 1.2);
    A.charge = clamp(num(a.charge, 0), 0, 1);
    A.wallSide = num(a.wallSide, 1) < 0 ? -1 : 1;
    A.lod = num(a.lod, 0) >= 1 ? 1 : 0;
    if (a.prism !== undefined) this.prism = !!a.prism;
    // state change (or re-entry of the same state signalled by a timeInState reset)
    const tisIn = num(a.timeInState, NaN);
    if (st !== this.state) this._enterState(st, a);
    else if (Number.isFinite(tisIn) && tisIn + 0.05 < this._lastTis) this._enterState(st, a);
    this._lastTis = Number.isFinite(tisIn) ? tisIn : this.stateTime + dt;
    this.stateTime += dt;
    A.t = Math.max(0, num(a.timeInState, this.stateTime));
    A.state = st;
    this.time += dt;
    const T = this.time;

    // locomotion intensity & phase
    const sn = A.speedNorm;
    let kt = sn < 0.22 ? (sn / 0.22) : 1 + (sn - 0.22) / 0.45;
    if (st === 'walk') kt = Math.min(kt, 1);
    else if (st === 'run') kt = clamp(kt, 0.85, 1.6);
    else if (st === 'sprint') kt = Math.max(kt, 1.45);
    else if (st === 'wallrun') kt = Math.max(kt, 1.2);
    kt = clamp(kt, 0, 2);
    this.k = lerp(this.k, kt, dk(LOCO.has(st) || st === 'wallrun' ? 7 : 3, dt));
    const stride = kv(this.k, 1.25, 2.4, 5.4);
    const freq = clamp(A.speed / stride, 0.55, A.boosting ? 4.3 : 3.7);
    this.phase = (this.phase + TAU * freq * dt) % (TAU * 1000);

    // target pose
    const p = this.pose;
    this._evalPose(st, p, A, dt);

    // crossfade
    this.blendT += dt;
    const w = this.blendDur > 0 ? sm(this.blendT / this.blendDur) : 1;
    const bl = this.blendOut, o = this.out;
    if (w >= 1) bl.set(p);
    else for (let i = 0; i < NCH; i++) bl[i] = lerp(this.from[i], p[i], w);
    o.set(bl); // additive layers below are applied on top of the pure blended pose

    // additive layers
    const sf = SF[st];
    const kw = dk(9, dt);
    this.leanW = lerp(this.leanW, sf.lean || 0, kw);
    this.pitchW = lerp(this.pitchW, sf.lean ? 1 : 0.5, kw);
    this.leanS = lerp(this.leanS, A.lean, dk(14, dt));
    this.pitchS = lerp(this.pitchS, A.pitch, dk(14, dt));
    const L = this.leanS * this.leanW;
    o[C.rootRoll] += L * 0.85;
    o[C.headRoll] -= L * 0.35;
    o[C.spineRoll] += L * 0.15;
    o[C.rootPitch] += this.pitchS * this.pitchW;
    this.impactT += dt;
    this.impact = this.impactA * ss(0, 0.07, this.impactT) * Math.exp(-Math.max(0, this.impactT - 0.07) * 8);
    if (this.impact > 0.001) {
      const im = this.impact;
      o[C.squash] *= 1 - 0.14 * im;
      o[C.py] -= 0.06 * im;
      o[C.kneeL] += 0.5 * im; o[C.kneeR] += 0.5 * im;
      o[C.legSwL] += 0.25 * im; o[C.legSwR] += 0.25 * im;
      o[C.ankleL] -= 0.25 * im; o[C.ankleR] -= 0.25 * im;
      o[C.spinePitch] += 0.12 * im;
    }
    // spin
    this._updateSpin(dt, A);
    // head tracking
    if (A.lod === 0) this._updateLook(dt, o, sf.look || 0);
    this._apply(o);

    const needMatrices = A.lod === 0 || this.staff || (this.membranes.length && o[C.membrane] > 0.02);
    if (needMatrices) {
      this.root.updateMatrixWorld(true);
      this._rootInv.copy(this.root.matrixWorld).invert();
    }
    // secondary motion
    if (A.lod === 0) {
      _m2.extractRotation(this.root.matrixWorld);
      const qInv = this._qRootInv.setFromRotationMatrix(_m2).invert();
      const ball = o[C.ball];
      const F = this._F;
      for (const ch of this.chains) {
        const g = ch.grav * (1 - ball * 0.7);
        F.set(0, -g, 0).applyQuaternion(qInv);
        F.y += -A.vy * 0.035 * ch.wind; F.z += -A.speed * 0.085 * ch.wind * (1 - ball * 0.5);
        ch.update(this, o, dt, F, sn, T, 1 + ball * 2);
      }
    } else {
      for (const ch of this.chains) ch.simple(this, o, sn);
    }
    if (this.membranes.length) this._updateMembranes(o[C.membrane]);
    if (this.staff) this._updateStaff(dt, o);
    if (A.lod === 0 || this._lodApplied !== A.lod) this._updateFace(dt, A.lod === 0 ? false : true);
    this._updateFx(dt, o, A);
    if (this._lodApplied !== A.lod) {
      this._lodApplied = A.lod;
      for (const m of this.details) m.visible = A.lod === 0;
    }
    if (this.mouthOpen && A.lod === 1) this.mouthOpen.visible = false;
  }

  _enterState(st, a) {
    const prev = this.state;
    this.prevState = prev;
    this.state = st;
    this.stateTime = 0;
    this.from.set(this.blendOut);
    this.blendT = 0;
    let bd = 0.16;
    if (LOCO.has(prev) && LOCO.has(st)) bd = 0.3;
    else if (BALLISH.has(st) || BALLISH.has(prev)) bd = 0.12;
    else if (st === 'attack' || st === 'hurt' || st === 'land' || st === 'stomp' || st === 'jump') bd = 0.11;
    else if (prev === 'land') bd = 0.2;
    else if (st === 'victory' || st === 'defeat' || st === 'dead' || st === 'celebrate') bd = 0.28;
    this.blendDur = bd;
    // landing impact when going from air straight to ground states
    const air = prev === 'fall' || prev === 'jump' || prev === 'stomp' || prev === 'backflip' || prev === 'sideflip' || prev === 'glide';
    if (air && (LOCO.has(st) || st === 'idle' || st === 'skid')) { this.impactA = 0.8; this.impactT = 0; }
    // spin modes
    const mode = (BALLISH.has(st) || (st === 'pogo' && !this.staff)) ? 'rate'
      : (st === 'backflip' || st === 'sideflip') ? 'abs' : 'none';
    if (mode === 'abs') {
      this.flipBaseX = Math.round(this.spinX / TAU) * TAU;
      this.flipBaseZ = Math.round(this.spinZ / TAU) * TAU;
      this.flipOffX = this.spinX - this.flipBaseX;
      this.flipOffZ = this.spinZ - this.flipBaseZ;
      const ls = num(a && a.lean, 0);
      this.flipDir = ls < -0.05 ? -1 : ls > 0.05 ? 1 : (a && num(a.wallSide, 1) < 0 ? -1 : 1);
    } else if (mode === 'none') {
      const fx = this.spinRateX;
      // settle to the next upright orientation ahead of where the spin would coast to
      // (critically damped with w = v0 / distance => monotonic deceleration from the current rate)
      const ahead = this.spinX + fx / 30;
      if (Math.abs(fx) > 3) {
        this.settleX = (fx > 0 ? Math.ceil(ahead / TAU) : Math.floor(ahead / TAU)) * TAU;
        this.settleW = clamp(Math.abs(fx) / Math.max(1e-3, Math.abs(this.settleX - this.spinX)), 7, 30);
      } else { this.settleX = Math.round(this.spinX / TAU) * TAU; this.settleW = 18; }
      this.settleZ = Math.round(this.spinZ / TAU) * TAU;
      this.spinVX = fx; this.spinVZ = 0;
    }
    this.spinMode = mode;
    if (st === 'attack') this.attackSide = (this.attackSide || 0) ^ 1;
  }

  _updateSpin(dt, A) {
    const st = A.state;
    if (this.spinMode === 'rate') {
      let rate;
      if (st === 'spindash') rate = 16 + 38 * A.charge;
      else rate = Math.max(12, A.speed / this.d.ballR) * (A.boosting ? 1.2 : 1);
      rate = Math.min(rate, 70);
      this.spinRateX = lerp(this.spinRateX, rate, dk(14, dt));
      this.spinX += this.spinRateX * dt;
      if (this.spinX > TAU * 50) this.spinX -= TAU * 50;
      this.spinZ = lerp(this.spinZ, Math.round(this.spinZ / TAU) * TAU, dk(12, dt));
    } else if (this.spinMode === 'abs') {
      const u = ease(A.t / 0.6);
      const decay = Math.exp(-A.t * 18);
      if (st === 'backflip') {
        this.spinX = this.flipBaseX - TAU * u + this.flipOffX * decay;
        this.spinZ = this.flipBaseZ + this.flipOffZ * decay;
      } else {
        this.spinZ = this.flipBaseZ + this.flipDir * TAU * u + this.flipOffZ * decay;
        this.spinX = this.flipBaseX + this.flipOffX * decay;
      }
      this.spinRateX = 0;
    } else {
      // critically damped spring (velocity-continuous, no snapping)
      const w = this.settleW || 18, K = w * w, Cd = 2 * w, n = Math.max(1, Math.ceil(dt * w / 0.25)), h = dt / n;
      for (let i = 0; i < n; i++) {
        this.spinVX += (K * (this.settleX - this.spinX) - Cd * this.spinVX) * h; this.spinX += this.spinVX * h;
        this.spinVZ += (324 * (this.settleZ - this.spinZ) - 36 * this.spinVZ) * h; this.spinZ += this.spinVZ * h;
      }
      if (Math.abs(this.spinX - this.settleX) < 1e-3 && Math.abs(this.spinVX) < 0.01) { this.spinX = 0; this.settleX = 0; this.spinVX = 0; }
      if (Math.abs(this.spinZ - this.settleZ) < 1e-3 && Math.abs(this.spinVZ) < 0.01) { this.spinZ = 0; this.settleZ = 0; this.spinVZ = 0; }
      this.spinRateX = this.spinVX;
    }
  }

  _updateLook(dt, o, stateW) {
    const L = this.look;
    let ty = 0, tp = 0, tw = 0;
    if (L.has && stateW > 0) {
      const chest = this.j.chest;
      _v1.copy(L.target);
      chest.worldToLocal(_v1);
      const n = this.j.neck.position;
      const dx = _v1.x - n.x, dy = _v1.y - n.y - this.d.headCY, dz = _v1.z - n.z;
      const hd = Math.hypot(dx, dz);
      ty = Math.atan2(dx, dz);
      tp = -Math.atan2(dy, Math.max(hd, 1e-3));
      tw = stateW * (1 - ss(1.6, 2.3, Math.abs(ty)));
      ty = clamp(ty, -1.05, 1.05);
      tp = clamp(tp, -0.55, 0.5);
    }
    const kk = dk(7, dt);
    L.w = lerp(L.w, tw, kk);
    L.yaw = lerp(L.yaw, ty, kk);
    L.pitch = lerp(L.pitch, tp, kk);
    if (!Number.isFinite(L.yaw) || !Number.isFinite(L.pitch)) { L.yaw = 0; L.pitch = 0; L.w = 0; }
    o[C.neckYaw] += L.yaw * L.w * 0.35;
    o[C.headYaw] += L.yaw * L.w * 0.55;
    o[C.neckPitch] += L.pitch * L.w * 0.3;
    o[C.headPitch] += L.pitch * L.w * 0.5;
    o[C.gazeYaw] += L.yaw * L.w * 0.25;
    o[C.gazePitch] += -L.pitch * L.w * 0.25;
  }

  _apply(p) {
    const J = this.j, d = this.d;
    this.mover.rotation.set(p[C.rootPitch], p[C.rootYaw], p[C.rootRoll], 'YXZ');
    const s = clamp(p[C.squash], 0.5, 1.6), inv = 1 / Math.sqrt(s);
    this.mover.scale.set(inv, s, inv);
    this.pivot.position.set(0, d.pivotH + p[C.cy], p[C.cz]);
    _e1.set(p[C.cPitch], p[C.cYaw], p[C.cRoll], 'YXZ');
    _q1.setFromEuler(_e1);
    _q2.setFromAxisAngle(AX, this.spinX);
    _q3.setFromAxisAngle(AZ, this.spinZ);
    this.pivot.quaternion.copy(_q2).multiply(_q3).multiply(_q1);
    J.hips.position.set(p[C.px], d.hipY + p[C.py], p[C.pz]);
    J.hips.rotation.set(p[C.hipPitch], p[C.hipYaw], p[C.hipRoll], 'YXZ');
    J.spine.rotation.set(p[C.spinePitch], p[C.spineYaw], p[C.spineRoll]);
    J.chest.rotation.set(p[C.chestPitch], p[C.chestYaw], p[C.chestRoll]);
    J.neck.rotation.set(p[C.neckPitch], p[C.neckYaw], 0);
    J.head.rotation.set(p[C.headPitch], p[C.headYaw], p[C.headRoll], 'YXZ');
    for (let i = 0; i < 2; i++) {
      const sg = i ? -1 : 1, sx = i ? '_r' : '_l', o = ARM[i], l = LEG[i];
      J['clav' + sx].rotation.z = sg * p[o];
      J['arm' + sx].rotation.set(p[o + 1], sg * p[o + 3], sg * p[o + 2], 'XZY');
      J['elbow' + sx].rotation.x = -p[o + 4];
      J['hand' + sx].rotation.x = -p[o + 5];
      J['thigh' + sx].rotation.set(-p[l], sg * p[l + 2], sg * p[l + 1], 'XZY');
      J['knee' + sx].rotation.x = p[l + 3];
      J['foot' + sx].rotation.set(p[l + 4], 0, -(p[C.hipRoll] + sg * p[l + 1]) * 0.9);
    }
  }

  // ----------------------------------------------------------------- face
  _updateFace(dt, frozen) {
    if (!this.eyes.length) return;
    const A = this.A, st = A.state || 'idle';
    // choose expression
    this.exprHold -= dt;
    let target;
    if (this.exprManual && this.exprHold > 0) target = this.exprManual;
    else {
      this.exprManual = null;
      target = AUTO_EXPR[st] || 'neutral';
      if (A.boosting && !['hurt', 'dead', 'defeat', 'celebrate', 'victory', 'high5'].includes(st)) target = 'determined';
      if (st === 'fall' && A.t > 0.9) target = 'surprised';
      if (st === 'idle' && A.t > 12 && this.def.style.cool) target = 'neutral';
    }
    if (frozen) target = 'neutral';
    this.exprTarget = target;
    const E = EXPR[target], bias = this.def.expr, ex = this.expr;
    const kk = frozen ? 1 : dk(11, dt);
    for (const key of EXPR_KEYS) ex[key] = lerp(ex[key], E[key] + (bias[key] || 0), kk);
    // blink
    if (!frozen) {
      this.nextBlink -= dt;
      if (this.nextBlink <= 0 && this.blinkT < 0 && st !== 'dead') {
        this.blinkT = 0;
        const rr = hash(this.seed * 3.1 + this.time * 1.7);
        this.nextBlink = 2 + rr * 3;
        this._doubleBlink = rr < 0.18;
      }
      if (this.blinkT >= 0) {
        this.blinkT += dt;
        const dur = 0.16;
        let bl = this.blinkT < dur ? Math.sin((this.blinkT / dur) * PI) : 0;
        if (this._doubleBlink && this.blinkT > dur + 0.06 && this.blinkT < dur * 2 + 0.06) bl = Math.sin(((this.blinkT - dur - 0.06) / dur) * PI);
        this.blink = bl;
        if (this.blinkT > (this._doubleBlink ? dur * 2 + 0.07 : dur)) { this.blinkT = -1; this.blink = 0; }
      }
      // saccades
      const G = this.gaze;
      G.next -= dt;
      if (G.next <= 0) {
        const rr = hash(this.seed + this.time * 3.3), r2 = hash(this.seed * 2 + this.time * 5.1);
        const calm = st === 'idle' || st === 'defeat' || st === 'victory' || st === 'celebrate';
        G.ty = calm ? (rr - 0.5) * 0.5 : (rr - 0.5) * 0.12;
        G.tp = calm ? (r2 - 0.5) * 0.25 : 0;
        G.next = 0.8 + rr * 2.4;
      }
      G.yaw = lerp(G.yaw, G.ty, dk(25, dt));
      G.pitch = lerp(G.pitch, G.tp, dk(25, dt));
    }
    const o = this.out;
    let closed = this.blink;
    if (st === 'dead') closed = 1;
    if (st === 'ball' || st === 'spindash' || st === 'cannon') closed = Math.max(closed, 0.35);
    const wink = this.winkL;
    const gy = clamp(this.gaze.yaw + o[C.gazeYaw], -0.55, 0.55);
    const gp = clamp(this.gaze.pitch + o[C.gazePitch], -0.4, 0.4);
    for (const e of this.eyes) {
      const cl = Math.max(closed, e.sg > 0 ? wink : 0);
      e.top.rotation.x = lerp(ex.lt, 1.52, cl);
      e.topRoll.rotation.z = e.sg * ex.tilt * (1 - cl);
      e.bot.rotation.x = lerp(ex.lb, Math.max(0.2, ex.lb * 0.5), cl * 0.5);
      e.botRoll.rotation.z = -e.sg * ex.tilt * 0.3;
      e.gaze.rotation.set(-gp, gy, 0, 'YXZ');
      e.pupil.scale.set(e.pup[0] * ex.pu, e.pup[1] * ex.pu, 1.03);
    }
    for (const bw of this.brows) {
      bw.g.position.y = bw.y + ex.by;
      bw.g.rotation.z = bw.sg * ex.bt;
    }
    // mouth
    if (this._mouthGeo) {
      const key = `${Math.round(ex.mc * 50)}|${Math.round(ex.mw * 50)}|${Math.round(ex.sm * 50)}`;
      let cy = this._mouthCY || 0;
      if (key !== this._mouthKey) { this._mouthKey = key; cy = this._updateMouthGeo(ex.mc, ex.mw, ex.sm); this._mouthCY = cy; }
      const f = this.f;
      const open = ex.mo;
      this.mouthOpen.visible = open > 0.04 && !frozen;
      if (this.mouthOpen.visible) {
        const mw0 = Math.min(f.mouthW, 0.075);
        const ow = mw0 * 0.42 * ex.mw * (0.75 + 0.25 * open);
        const oh = mw0 * 0.36 * open;
        this.mouthOpen.scale.set(Math.max(0.004, ow), Math.max(0.002, oh), mw0 * 0.2);
        this.mouthOpen.position.set(0, cy - oh * 0.75, -0.004);
      }
    }
  }

  // ----------------------------------------------------------------- fx / materials
  _updateFx(dt, o, A) {
    // prism blend
    const pt = this.prism ? 1 : 0;
    this.prismAmt = lerp(this.prismAmt, pt, dk(6, dt));
    if (Math.abs(this.prismAmt - pt) < 0.002) this.prismAmt = pt;
    // ember shoe glow
    const gt = A.boosting ? 1 : 0;
    this.glow = lerp(this.glow, gt, dk(8, dt));
    this._applyMaterials(false);
    // aura
    const ball = o[C.ball];
    const auraAmt = Math.max(o[C.aura], this.prismAmt);
    const u = this.auraMat.uniforms;
    u.uTime.value = this.time;
    if (auraAmt > 0.01 && this.opacity > 0.02) {
      const d = this.d, H = this.height;
      this.aura.visible = true;
      const bb = sat(ball);
      const rb = d.ballR * 1.1 * (1 + 0.04 * Math.sin(this.time * 30) * bb);
      this.aura.position.set(0, lerp(H * 0.5, d.pivotH + o[C.cy], bb), lerp(0, o[C.cz], bb));
      this.aura.scale.set(lerp(H * 0.37, rb, bb), lerp(H * 0.56, rb, bb), lerp(H * 0.37, rb, bb));
      const pr = this.prismAmt * (1 - 0.45 * bb);
      const charge = A.state === 'spindash' ? A.charge : 0;
      u.uOpacity.value = Math.min(0.95, o[C.aura] * (0.75 + charge * 0.6) * (1 - pr * 0.4) + pr * (0.62 + 0.12 * Math.sin(this.time * 7))) * this.opacity;
      u.uIntensity.value = 1 + charge * 1.6 + pr * 0.15;
      u.uPower.value = lerp(2.2, 1.6, pr);
      u.uColor.value.set(this.palette.accent).lerp(PRISM_AURA, pr);
    } else this.aura.visible = false;
    const sw = ball * (A.state === 'cannon' ? 0.5 : 1);
    if (sw > 0.02 && this.opacity > 0.02) {
      this.swirl.visible = true;
      const charge = A.state === 'spindash' ? A.charge : 0;
      this.swirlMat.opacity = sat(sw * (0.55 + 0.45 * charge)) * this.opacity * (1 - 0.5 * this.prismAmt);
      this.swirlMat.color.set(this.palette.accent).lerp(PRISM_AURA, this.prismAmt);
      this.swirl.position.set(0, 0, 0);
    } else this.swirl.visible = false;
  }
  _applyMaterials(force) {
    const pa = this.prismAmt, gl = this.glow;
    if (!force && Math.abs(pa - this._prismApplied) < 0.002 && Math.abs(gl - this._glowApplied) < 0.004) return;
    this._prismApplied = pa; this._glowApplied = gl;
    for (const e of this.matList) {
      const m = e.mat;
      if (e.spec.basic) { m.color.copy(e.base); continue; }
      m.color.copy(e.base);
      m.emissive.copy(e.em);
      let ei = e.emI;
      if (e.role === 'shoe' && this.palette.shoeGlow) ei = e.emI + gl * 1.5;
      m.emissiveIntensity = ei;
      if (pa > 0 && !PRISM_SKIP.has(e.role)) {
        const target = e.role === 'iris' ? PRISM_GEAR : PRISM_BODY_ROLES.has(e.role) ? PRISM_BODY : PRISM_GEAR;
        m.color.lerp(target, pa * 0.85);
        // emissive: blend toward gold glow
        _c1.copy(e.em).multiplyScalar(ei).lerp(PRISM_EM, pa);
        const mx = Math.max(_c1.r, _c1.g, _c1.b, 1e-4);
        m.emissive.copy(_c1).multiplyScalar(1 / mx);
        m.emissiveIntensity = mx * (e.role === 'iris' ? 0.5 : 0.55 + 0.1 * Math.sin(this.time * 6));
      }
    }
  }

  // ----------------------------------------------------------------- membranes (pip)
  _updateMembranes(amount) {
    const show = amount > 0.02;
    for (const mb of this.membranes) {
      mb.mesh.visible = show;
      if (!show) continue;
      const pts = mb.pts; // [shoulder, elbow, wrist, hip, knee, ankle] joints
      const inv = _m1.copy(this.body.matrixWorld).invert();
      const P = mb.P;
      for (let i = 0; i < 6; i++) {
        P[i].setFromMatrixPosition(pts[i].matrixWorld).applyMatrix4(inv);
      }
      // a little beyond the wrist / ankle
      const NU = mb.NU, NV = mb.NV, arr = mb.geo.attributes.position.array;
      const top = _v1, bot = _v2, pos = _v3, cen = _v4;
      for (let iu = 0; iu <= NU; iu++) {
        const u = (iu / NU) * amount;
        // top edge: shoulder -> elbow -> wrist
        if (u < 0.5) top.lerpVectors(P[0], P[1], u * 2); else top.lerpVectors(P[1], P[2], (u - 0.5) * 2);
        if (u < 0.5) bot.lerpVectors(P[3], P[4], u * 2); else bot.lerpVectors(P[4], P[5], (u - 0.5) * 2);
        for (let iv = 0; iv <= NV; iv++) {
          const v = iv / NV;
          pos.lerpVectors(top, bot, v);
          // scalloped free edge: pull inward between wrist and ankle
          cen.lerpVectors(P[0], P[3], v);
          const sag = 0.28 * u * u * Math.sin(PI * v);
          pos.lerp(cen, sag);
          const o = (iu * (NV + 1) + iv) * 3;
          arr[o] = pos.x; arr[o + 1] = pos.y; arr[o + 2] = pos.z;
        }
      }
      mb.geo.attributes.position.needsUpdate = true;
      mb.geo.computeVertexNormals();
      mb.geo.computeBoundingSphere();
    }
  }
  _addMembranes(role) {
    for (let s = 0; s < 2; s++) {
      const sx = s ? '_r' : '_l', J = this.j;
      const NU = 6, NV = 5;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NU + 1) * (NV + 1) * 3), 3));
      const idx = [];
      for (let iu = 0; iu < NU; iu++) for (let iv = 0; iv < NV; iv++) {
        const a = iu * (NV + 1) + iv, b2 = a + 1, c = a + NV + 1, d2 = c + 1;
        if (s === 0) idx.push(a, b2, c, b2, d2, c); else idx.push(a, c, b2, b2, c, d2);
      }
      g.setIndex(idx);
      g.computeVertexNormals();
      this.ownGeos.push(g);
      const mesh = this.mesh(this.body, g, role, null, null, null, { name: 'membrane' + sx });
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.membranes.push({
        mesh, geo: g, NU, NV,
        pts: [J['arm' + sx], J['elbow' + sx], J['hand' + sx], J['thigh' + sx], J['knee' + sx], J['foot' + sx]],
        P: [0, 0, 0, 0, 0, 0].map(() => new THREE.Vector3()),
      });
    }
  }

  // ----------------------------------------------------------------- staff (lumi)
  _updateStaff(dt, o) {
    const S = this.staff;
    const mode = this.propMode;
    const sock = mode === 'hand' ? S.hand : mode === 'pogo' ? S.pogo : S.back;
    _m1.copy(this.body.matrixWorld).invert().multiply(sock.matrixWorld);
    _m1.decompose(_v1, _q1, _v2);
    if (!S.init || this.A.lod === 1) { S.root.position.copy(_v1); S.root.quaternion.copy(_q1); S.init = true; }
    else {
      const kk = dk(mode === S.lastMode ? 40 : 16, dt);
      S.root.position.lerp(_v1, kk);
      S.root.quaternion.slerp(_q1, kk);
    }
    S.lastMode = mode;
    S.spin.rotation.z = o[C.staffSpin];
  }

  // ----------------------------------------------------------------- pose evaluation
  _evalPose(st, p, A, dt) {
    p.set(this.rest);
    this.propMode = 'back';
    this.winkL = lerp(this.winkL, 0, dk(10, dt));
    const t = A.t;
    switch (st) {
      case 'idle': poseIdle(this, p, A, t); break;
      case 'walk': case 'run': case 'sprint': poseLoco(this, p, A, this.k); break;
      case 'skid': poseSkid(this, p, A, t); break;
      case 'jump': poseJump(this, p, A, t); break;
      case 'fall': poseFall(this, p, A, t); break;
      case 'ball': case 'cannon': poseBall(this, p, A, t, st === 'cannon' ? 0.6 : 1); break;
      case 'spindash': poseBall(this, p, A, t, 1, true); break;
      case 'pogo': if (this.staff) posePogo(this, p, A, t); else poseBall(this, p, A, t, 1); break;
      case 'slide': poseSlide(this, p, A, t); break;
      case 'wallrun': poseWallrun(this, p, A); break;
      case 'climb': this.climbPhase += dt * clamp(A.speed * 3.2, 0, 9); poseClimb(this, p, A, t); break;
      case 'glide': poseGlide(this, p, A, t, false); break;
      case 'fly': poseGlide(this, p, A, t, true); break;
      case 'swim': this.swimPhase += dt * TAU * clamp(0.6 + A.speed * 0.12, 0.6, 1.6); poseSwim(this, p, A, t); break;
      case 'grind': poseGrind(this, p, A, t); break;
      case 'hurt': poseHurt(this, p, A, t); break;
      case 'land': poseLand(this, p, A, t); break;
      case 'backflip': case 'sideflip': poseFlip(this, p, A, t, st === 'sideflip'); break;
      case 'stomp': poseStomp(this, p, A, t); break;
      case 'attack': poseAttack(this, p, A, t); break;
      case 'celebrate': poseCelebrate(this, p, A, t); break;
      case 'victory': poseVictory(this, p, A, t); break;
      case 'defeat': poseDefeat(this, p, A, t); break;
      case 'frustrated': poseFrustrated(this, p, A, t); break;
      case 'high5': poseHigh5(this, p, A, t); break;
      case 'dead': poseDead(this, p, A, t); break;
      default: poseIdle(this, p, A, t);
    }
  }
}
const _c1 = new THREE.Color();

// ---------------------------------------------------------------------------
// pose functions
// ---------------------------------------------------------------------------
function tailWag(r, p, amt, freq) { p[C.tailYaw] += amt * Math.sin(r.time * freq + 0.6); }

function poseIdle(r, p, A, t) {
  const T = r.time + r._rnd, st = r.def.style;
  const br = Math.sin(T * TAU / 3.4);
  p[C.chestPitch] += -0.02 - 0.025 * br;
  p[C.headPitch] += 0.01 * br;
  p[C.shL] += 0.02 + 0.025 * br; p[C.shR] += 0.02 + 0.025 * br;
  p[C.armRaL] += 0.025 * br; p[C.armRaR] += 0.025 * br;
  const ws = Math.sin(T * TAU / 6.0 + 0.7);
  p[C.px] += 0.016 * ws;
  p[C.hipRoll] += -0.04 * ws; p[C.spineRoll] += 0.025 * ws; p[C.chestRoll] += 0.015 * ws; p[C.headRoll] += -0.025 * ws;
  p[C.kneeL] += 0.08 * Math.max(0, -ws); p[C.kneeR] += 0.08 * Math.max(0, ws);
  p[C.py] -= 0.008 * Math.abs(ws) + 0.004;
  if (st.bounce) {
    const bb = 0.5 + 0.5 * Math.sin(T * TAU * 1.5);
    p[C.py] += st.bounce * bb;
    p[C.kneeL] += 0.05 * (1 - bb); p[C.kneeR] += 0.05 * (1 - bb);
  }
  if (st.handsIn) { // cute paws held near chest
    arm(p, 0, -0.55, 0.12, -0.4, 1.7, 0.4); arm(p, 1, -0.55, 0.12, -0.4, 1.7, 0.4);
  }
  if (st.heavy) { // tough, fists out
    p[C.armSwL] -= 0.05; p[C.armSwR] -= 0.05; p[C.elbowL] += 0.25; p[C.elbowR] += 0.25;
    p[C.spinePitch] += 0.05; p[C.headPitch] += -0.05;
  }
  if (st.cool) { // hand on hip, weight on one leg
    arm(p, 1, 0.2, 0.8, -1.5, 1.6, 0.2);
    p[C.hipRoll] += 0.05; p[C.px] += 0.012; p[C.headRoll] -= 0.06; p[C.headYaw] += 0.1;
  }
  p[C.tailPitch] = st.tailUp || 0;
  tailWag(r, p, 0.22, 1.4);
  p[C.earSpread] = 0.04 * Math.sin(T * 0.9);
  // fidget
  r._ankEx[0] = 0; r._ankEx[1] = 0;
  if (t > 4) {
    const ft = (t - 4) % 7.5;
    if (ft < 2.6) fidget(r, p, ft, env(ft, 2.6, 0.45, 0.55));
  }
  plant(p, r);
  flatFoot(p, 0, r._ankEx[0]); flatFoot(p, 1, r._ankEx[1]);
}

function fidget(r, p, ft, w) {
  const kind = r.def.fidget;
  if (kind === 'tap') { // foot tap + hand on hip
    p[C.armRaL] += 0.66 * w; p[C.elbowL] += 1.3 * w; p[C.armTwL] += -1.5 * w; p[C.armSwL] += 0.16 * w;
    p[C.legSwR] += 0.12 * w; r._ankEx[1] = -0.4 * w * (0.5 + 0.5 * Math.sin(ft * 15));
    p[C.headRoll] += 0.08 * w * Math.sin(ft * 7.5);
  } else if (kind === 'look') {
    p[C.headYaw] += 0.7 * w * Math.sin(ft * 2.4);
    p[C.headPitch] -= 0.08 * w;
    p[C.gazeYaw] += 0.3 * w * Math.sin(ft * 2.4);
    p[C.earSpread] += 0.2 * w;
  } else if (kind === 'knuckles') {
    arm(p, 0, lerp(p[C.armSwL], -0.95, w), lerp(p[C.armRaL], -0.3, w), lerp(p[C.armTwL], -0.3, w), lerp(p[C.elbowL], 1.35, w), 0);
    arm(p, 1, lerp(p[C.armSwR], -0.95, w), lerp(p[C.armRaR], -0.3, w), lerp(p[C.armTwR], -0.3, w), lerp(p[C.elbowR], 1.35 + 0.25 * Math.sin(ft * 10), w), 0);
    p[C.headPitch] += 0.12 * w; p[C.shL] += 0.05 * w; p[C.shR] += 0.05 * w;
  } else if (kind === 'stretch') {
    const e = w;
    arm(p, 0, lerp(p[C.armSwL], -0.45, e), lerp(p[C.armRaL], 2.45, e), 0, lerp(p[C.elbowL], 0.3, e), 0);
    arm(p, 1, lerp(p[C.armSwR], -0.45, e), lerp(p[C.armRaR], 2.45, e), 0, lerp(p[C.elbowR], 0.3, e), 0);
    p[C.spinePitch] -= 0.12 * e; p[C.headPitch] -= 0.2 * e; p[C.py] += 0.015 * e;
    r._ankEx[0] = 0.3 * e; r._ankEx[1] = 0.3 * e;
  } else if (kind === 'claws') {
    arm(p, 0, lerp(p[C.armSwL], -1.25, w), lerp(p[C.armRaL], -0.15, w), lerp(p[C.armTwL], -0.9, w), lerp(p[C.elbowL], 1.9, w), -0.5 * w);
    p[C.headPitch] += 0.25 * w; p[C.headYaw] += 0.3 * w; p[C.gazePitch] -= 0.2 * w; p[C.gazeYaw] += 0.15 * w;
  } else if (kind === 'lookTail') {
    p[C.headYaw] += -0.9 * w; p[C.chestYaw] += -0.25 * w; p[C.headPitch] += 0.15 * w;
    p[C.tailCurl] += 0.5 * w * (0.5 + 0.5 * Math.sin(ft * 6)); p[C.tailYaw] += 0.5 * w * Math.sin(ft * 4);
  }
}

function poseLoco(r, p, A, k) {
  const ph = r.phase, s1 = Math.sin(ph), c1 = Math.cos(ph), st = r.def.style;
  const legA = kv(k, 0.42, 0.85, 1.05);
  const kb = kv(k, 0.1, 0.28, 0.4), ka = kv(k, 0.55, 1.45, 1.9);
  const armA = kv(k, 0.42, 0.95, 0.95);
  const elb = kv(k, 0.3, 1.45, 1.45);
  const back = ss(1.15, 1.75, k);
  const lean = kv(k, 0.03, 0.16, 0.42) + (A.boosting ? 0.08 : 0);
  const bob = kv(k, 0.012, 0.045, 0.035);
  const twist = kv(k, 0.1, 0.2, 0.12);
  const kr = Math.min(1, k);
  for (let s = 0; s < 2; s++) {
    const ps = ph + s * PI, sn = Math.sin(ps), cs = Math.cos(ps);
    const rec = Math.max(0, cs);
    const swing = legA * sn + kv(k, 0, 0.06, 0.15);
    const knee = kb + ka * Math.pow(rec, 1.3) + 0.12 * Math.max(0, -cs) * kr;
    const o = LEG[s];
    p[o] = swing; p[o + 1] = 0.03 + (st.stance || 0) * 0.5; p[o + 3] = knee;
    const flat = swing - knee;
    p[o + 4] = flat * lerp(0.9, 0.35, kr) - 0.25 * rec * kr + 0.45 * Math.max(0, -sn) * kr;
    // arms
    const asw = armA * sn;
    const ao = ARM[s];
    p[ao + 1] = lerp(asw - 0.05, 1.25 + 0.12 * sn, back);
    p[ao + 2] = lerp(0.12 + (st.armOut || 0), 0.35, back);
    p[ao + 3] = lerp(-0.15 * kr, 0.25, back);
    p[ao + 4] = lerp(elb + 0.3 * Math.max(0, -sn) * kr, 0.3, back);
    p[ao + 5] = lerp(0, -0.35, back);
    p[ao] = 0.03 * kr;
  }
  p[C.hipYaw] = -twist * s1;
  p[C.chestYaw] = twist * 1.25 * s1 * (1 - back * 0.6);
  p[C.hipRoll] = 0.03 * Math.cos(2 * ph) * kr;
  p[C.spinePitch] += lean * 0.55;
  p[C.chestPitch] += lean * 0.45;
  p[C.neckPitch] -= lean * 0.45;
  p[C.headPitch] -= lean * 0.65 - 0.025 * Math.cos(2 * ph);
  p[C.py] = -bob * Math.cos(2 * ph) - kv(k, 0, 0.02, 0.045);
  p[C.tailPitch] = (st.tailUp || 0) + kv(k, 0, 0.2, 0.35);
  p[C.tailYaw] = 0.18 * s1;
  p[C.earBack] = kv(k, 0, 0.2, 0.45);
}

function poseSkid(r, p, A, t) {
  const jit = Math.sin(r.time * 55) * 0.006;
  p[C.py] = -0.1; p[C.pz] = -0.02;
  p[C.hipPitch] = -0.12;
  p[C.spinePitch] = -0.22; p[C.chestPitch] = -0.1; p[C.headPitch] = 0.05;
  leg(p, 0, 0.85, 0.08, 0, 0.12); flatFoot(p, 0, -0.45);
  leg(p, 1, -0.12, 0.06, 0, 0.95); flatFoot(p, 1, 0.15);
  arm(p, 0, -1.15 + jit * 10, 0.55, 0.2, 0.6, 0.3);
  arm(p, 1, -0.6 - jit * 10, 0.85, 0.2, 0.5, 0.3);
  p[C.px] = jit; p[C.hipYaw] = 0.15; p[C.chestYaw] = -0.1;
  p[C.earBack] = -0.15; p[C.tailPitch] = 0.3;
}

function poseJump(r, p, A, t) {
  const ant = 1 - ss(0.0, 0.08, t);
  const rise = clamp(A.vy / 9, -1, 1);
  const str = 1 + 0.12 * Math.exp(-Math.max(0, t - 0.07) * 7) * (1 - ant);
  p[C.squash] = lerp(str, 0.86, ant);
  p[C.py] = -0.07 * ant;
  // airborne pose
  arm(p, 0, lerp(-2.6, -1.4, sat(-rise)), lerp(0.45, 0.8, sat(-rise)), 0.1, 0.3, 0.2);
  arm(p, 1, lerp(-0.9, -0.6, sat(-rise)), 0.75, 0.1, 0.9, 0.2);
  leg(p, 0, 0.75, 0.05, 0, 1.35, 0.35);
  leg(p, 1, -0.25, 0.04, 0, 0.45, 0.55);
  p[C.spinePitch] = -0.08; p[C.headPitch] = -0.12;
  // anticipation crouch
  if (ant > 0) {
    for (let s = 0; s < 2; s++) {
      const o = LEG[s];
      p[o] = lerp(p[o], 0.45, ant); p[o + 3] = lerp(p[o + 3], 0.95, ant); p[o + 4] = lerp(p[o + 4], -0.4, ant);
      const ao = ARM[s];
      p[ao + 1] = lerp(p[ao + 1], 0.7, ant); p[ao + 4] = lerp(p[ao + 4], 0.4, ant);
    }
    p[C.spinePitch] = lerp(p[C.spinePitch], 0.25, ant);
  }
  p[C.earBack] = 0.25; p[C.tailPitch] = 0.2;
}

function poseFall(r, p, A, t) {
  const T = r.time;
  const fl = Math.sin(T * 8.5), fl2 = Math.sin(T * 7.1 + 1);
  arm(p, 0, -0.35 + 0.12 * fl, 1.2 + 0.1 * fl2, 0.1, 0.45, 0.2);
  arm(p, 1, -0.35 - 0.12 * fl, 1.2 - 0.1 * fl2, 0.1, 0.45, 0.2);
  leg(p, 0, 0.35 + 0.1 * fl2, 0.08, 0, 0.6 + 0.15 * fl, 0.35);
  leg(p, 1, -0.05 - 0.1 * fl2, 0.06, 0, 0.35 - 0.1 * fl, 0.45);
  p[C.headPitch] = 0.2; p[C.spinePitch] = -0.05;
  p[C.earDroop] = -0.25; p[C.tailPitch] = 0.4;
}

function tuck(r, p, amt = 1) {
  const d = r.d;
  const w = amt;
  p[C.spinePitch] = lerp(p[C.spinePitch], 0.55, w);
  p[C.chestPitch] = lerp(p[C.chestPitch], 0.45, w);
  p[C.neckPitch] = lerp(p[C.neckPitch], 0.25, w);
  p[C.headPitch] = lerp(p[C.headPitch], 0.5, w);
  for (let s = 0; s < 2; s++) {
    const o = ARM[s];
    p[o] = lerp(p[o], 0.05, w); p[o + 1] = lerp(p[o + 1], -0.75, w); p[o + 2] = lerp(p[o + 2], 0.28, w);
    p[o + 3] = lerp(p[o + 3], -0.3, w); p[o + 4] = lerp(p[o + 4], 2.0, w); p[o + 5] = lerp(p[o + 5], 0.4, w);
    const l = LEG[s];
    p[l] = lerp(p[l], 1.95, w); p[l + 1] = lerp(p[l + 1], 0.14, w); p[l + 3] = lerp(p[l + 3], 2.4, w); p[l + 4] = lerp(p[l + 4], 0.7, w);
  }
  p[C.py] = lerp(p[C.py], -(d.hipY - d.ballR) - 0.05 * (d.ballR / 0.45), w);
  p[C.pz] = lerp(p[C.pz], -0.1 * (d.ballR / 0.45), w);
  p[C.earBack] = lerp(p[C.earBack], 1.1, w);
  p[C.tailPitch] = lerp(p[C.tailPitch], -1.35, w);
  p[C.tailCurl] = lerp(p[C.tailCurl], 1.1, w);
}

function poseBall(r, p, A, t, auraMul, dash) {
  tuck(r, p, 1);
  p[C.ball] = 1;
  p[C.aura] = auraMul * (dash ? 0.6 + 0.4 * A.charge : 0.85);
  if (dash) p[C.squash] = 1 - 0.05 * A.charge + 0.025 * Math.sin(r.time * 40) * A.charge;
}

function posePogo(r, p, A, t) {
  r.propMode = 'pogo';
  const comp = sat(-A.vy / 10) * 0.6 + bump((t % 0.55) / 0.55) * 0.15;
  p[C.py] = 0.16 - comp * 0.12;
  p[C.spinePitch] = 0.12; p[C.headPitch] = -0.1;
  arm(p, 0, -0.85, -0.15, -0.6, 1.25, 0.3);
  arm(p, 1, -1.05, -0.15, -0.5, 1.0, 0.3);
  leg(p, 0, 0.5 + comp * 0.4, -0.05, 0, 0.9 + comp * 0.6); flatFoot(p, 0);
  leg(p, 1, 0.5 + comp * 0.4, -0.05, 0, 0.9 + comp * 0.6); flatFoot(p, 1);
  p[C.squash] = 1 - comp * 0.06;
  p[C.tailPitch] = 0.3 - comp; p[C.tailCurl] = 0.4;
}

function poseSlide(r, p, A, t) {
  const d = r.d;
  p[C.py] = -(d.hipY - 0.17);
  p[C.pz] = -0.05;
  p[C.hipPitch] = -1.0;
  p[C.spinePitch] = 0.18; p[C.chestPitch] = 0.15; p[C.neckPitch] = 0.2; p[C.headPitch] = 0.38;
  leg(p, 0, 0.45, 0.06, 0, 0.12, 0.2);
  leg(p, 1, 0.05, 0.12, 0.25, 1.75, 0.3);
  arm(p, 0, -0.3, 0.7, 0.2, 0.5, 0.2);
  arm(p, 1, 0.35, 0.45, 0.2, 0.25, -0.4);
  p[C.earBack] = 0.8; p[C.tailPitch] = -0.2;
  p[C.px] = 0.005 * Math.sin(r.time * 50);
}

function poseWallrun(r, p, A) {
  poseLoco(r, p, A, Math.max(r.k, 1.3));
  const ws = A.wallSide;
  p[C.rootRoll] += 0.32 * ws;
  // inner arm reaches toward the wall
  const s = ws > 0 ? 1 : 0;
  arm(p, s, -0.25, 1.05, 0.1, 0.4, 0.2);
  p[C.headRoll] -= 0.15 * ws;
}

function poseClimb(r, p, A, t) {
  const c = r.climbPhase, s1 = Math.sin(c);
  p[C.spinePitch] = 0.12; p[C.chestPitch] = 0.05; p[C.headPitch] = -0.3; p[C.pz] = -0.02;
  const a0 = 0.5 + 0.5 * s1, a1 = 1 - a0; // 1 = reaching high
  arm(p, 0, lerp(-1.9, -2.85, a0), lerp(0.75, 0.5, a0), 0.2, lerp(1.25, 0.15, a0), 0.4);
  arm(p, 1, lerp(-1.9, -2.85, a1), lerp(0.75, 0.5, a1), 0.2, lerp(1.25, 0.15, a1), 0.4);
  leg(p, 0, 0.75 - 0.45 * s1, 0.15, 0, 1.35 - 0.5 * s1, 0.1);
  leg(p, 1, 0.75 + 0.45 * s1, 0.15, 0, 1.35 + 0.5 * s1, 0.1);
  p[C.py] = 0.03 * s1 * s1 - 0.04;
  p[C.hipRoll] = 0.06 * s1; p[C.chestRoll] = -0.05 * s1;
  p[C.tailPitch] = -0.5; tailWag(r, p, 0.15, 2);
}

function poseGlide(r, p, A, t, fly) {
  const T = r.time;
  const isPip = r.membranes.length > 0;
  if (isPip) {
    const flap = fly ? Math.sin(T * TAU * 2.6) : 0.12 * Math.sin(T * 2.2);
    p[C.cPitch] = 1.05; p[C.cy] = 0.05;
    p[C.headPitch] = -0.85; p[C.neckPitch] = -0.3;
    p[C.spinePitch] = -0.05;
    const ra = 1.35 + 0.28 * flap;
    arm(p, 0, -0.55 - 0.15 * flap, ra, 0.2, 0.08, -0.2);
    arm(p, 1, -0.55 - 0.15 * flap, ra, 0.2, 0.08, -0.2);
    leg(p, 0, -0.35 + 0.08 * flap, 0.75, 0, 0.12, 0.6);
    leg(p, 1, -0.35 + 0.08 * flap, 0.75, 0, 0.12, 0.6);
    p[C.membrane] = 1;
    p[C.tailPitch] = 0.95; p[C.tailCurl] = -0.25;
    p[C.earBack] = 0.4;
    p[C.cRoll] = 0.06 * Math.sin(T * 1.3);
  } else {
    // arms-out glide; 'fly' adds a slow wing-like flap
    const sw = Math.sin(T * 2.1);
    const fl = fly ? Math.sin(T * TAU * 1.6) : 0;
    p[C.cPitch] = fly ? 0.75 : 0.5; p[C.cRoll] = 0.08 * sw;
    p[C.headPitch] = fly ? -0.65 : -0.45;
    arm(p, 0, 0.2 - 0.15 * fl, 1.4 + 0.06 * sw + 0.35 * fl, 0.15, 0.15, -0.1);
    arm(p, 1, 0.2 - 0.15 * fl, 1.4 - 0.06 * sw + 0.35 * fl, 0.15, 0.15, -0.1);
    leg(p, 0, -0.2, 0.08, 0, 0.25, 0.5);
    leg(p, 1, 0.15, 0.06, 0, 0.85, 0.5);
    p[C.earBack] = 0.6; p[C.tailPitch] = 0.8;
  }
}

function poseSwim(r, p, A, t) {
  const s = r.swimPhase, c = Math.cos(s), sn = Math.sin(s);
  p[C.cPitch] = 1.3; p[C.cy] = 0.05;
  p[C.headPitch] = -1.0; p[C.neckPitch] = -0.25;
  const reach = 0.5 + 0.5 * c;           // 1 = arms extended forward
  const sweep = Math.max(0, -sn);         // outward sweep phase
  for (let k = 0; k < 2; k++) {
    arm(p, k, lerp(-1.6, -2.95, reach), lerp(0.3, 1.2, sweep) * (1 - reach * 0.6), -0.3, lerp(1.5, 0.15, reach), 0.2);
    leg(p, k, lerp(0.15, -0.3, reach), lerp(0.55, 0.12, reach), 0.2, lerp(1.6, 0.1, reach), 0.7);
  }
  p[C.py] = 0.02 * sn;
  p[C.earBack] = 0.9; p[C.tailPitch] = 0.9; tailWag(r, p, 0.3, 4);
}

function poseGrind(r, p, A, t) {
  const T = r.time, sw = Math.sin(T * 2.3), sw2 = Math.sin(T * 1.7 + 1);
  p[C.py] = -0.07;
  p[C.hipYaw] = 1.15; p[C.chestYaw] = -0.45; p[C.headYaw] = -0.55; p[C.neckYaw] = -0.15;
  p[C.hipRoll] = 0.05 * sw; p[C.spinePitch] = 0.12; p[C.spineRoll] = -0.04 * sw;
  leg(p, 0, 0.05, 0.36, 0, 0.6); flatFoot(p, 0);
  leg(p, 1, 0.05, 0.36, 0, 0.6); flatFoot(p, 1);
  arm(p, 0, -0.25 + 0.1 * sw2, 1.2 - 0.2 * sw, 0.2, 0.35, 0);
  arm(p, 1, -0.25 - 0.1 * sw2, 1.2 + 0.2 * sw, 0.2, 0.35, 0);
  p[C.earBack] = 0.4; p[C.tailPitch] = 0.6;
  plant(p, r);
}

function poseHurt(r, p, A, t) {
  const k = Math.exp(-t * 5);
  const sh = Math.sin(t * 30) * 0.05 * k;
  p[C.cPitch] = -0.45 * (0.5 + 0.5 * k);
  p[C.spinePitch] = -0.2; p[C.headPitch] = -0.35 + sh;
  arm(p, 0, -1.35, 0.75, 0.2, 0.6, 0.4);
  arm(p, 1, -1.0, 0.95, 0.2, 0.7, 0.4);
  leg(p, 0, 0.75, 0.1, 0, 0.6, 0.4);
  leg(p, 1, 0.35, 0.1, 0, 0.9, 0.4);
  p[C.squash] = 1 - 0.06 * k;
  p[C.earDroop] = 0.4; p[C.earBack] = -0.4; p[C.tailPitch] = 0.6;
}

function poseLand(r, p, A, t) {
  const k = Math.exp(-t * 7);
  p[C.squash] = 1 - 0.16 * Math.exp(-t * 14);
  p[C.py] = -0.11 * k;
  p[C.spinePitch] = 0.28 * k; p[C.headPitch] = -0.12 * k;
  for (let s = 0; s < 2; s++) {
    leg(p, s, 0.5 * k, 0.07, 0, 0.06 + 1.05 * k); flatFoot(p, s);
    arm(p, s, -0.45 * k + 0.04, 0.14 + 0.5 * k, 0, 0.3 + 0.2 * k, 0);
  }
  p[C.earDroop] = 0.3 * k;
}

function poseFlip(r, p, A, t, side) {
  const u = sat(t / 0.6);
  const tk = Math.sin(u * PI);
  tuck(r, p, tk * 0.85);
  const open = 1 - tk;
  // arms out at start/end
  p[C.armRaL] = lerp(p[C.armRaL], 1.1, open * 0.6); p[C.armRaR] = lerp(p[C.armRaR], 1.1, open * 0.6);
  if (side) { p[C.legSpL] += 0.3 * tk; p[C.legSpR] += 0.3 * tk; }
  p[C.earBack] = 0.7;
}

function poseStomp(r, p, A, t) {
  const k = ss(0, 0.12, t);
  p[C.squash] = 1 + 0.08 * k;
  p[C.spinePitch] = 0.25; p[C.chestPitch] = 0.15; p[C.headPitch] = 0.35;
  arm(p, 0, -0.2, 0.25, -0.2, 1.7, 0.4);
  arm(p, 1, -0.2, 0.25, -0.2, 1.7, 0.4);
  leg(p, 0, 1.0, 0.12, 0, 1.9, 0.6);
  leg(p, 1, 1.0, 0.12, 0, 1.9, 0.6);
  p[C.py] = -0.04;
  p[C.aura] = 0.55 * k;
  p[C.earBack] = -0.6; p[C.earDroop] = -0.4; p[C.tailPitch] = 1.0;
}

function poseAttack(r, p, A, t) {
  const u = sat(t / 0.35);
  const wind = ss(0, 0.22, u) * (1 - ss(0.22, 0.38, u));
  const hit = ss(0.22, 0.4, u) * (1 - ss(0.62, 1, u) * 0.85);
  const kind = r.def.attack;
  if (kind === 'punch') {
    const s = r.attackSide || 0, o = 1 - s; // alternate fists
    p[C.chestYaw] = (s ? -1 : 1) * (0.35 * wind - 0.55 * hit);
    p[C.hipYaw] = (s ? -1 : 1) * (0.15 * wind - 0.25 * hit);
    p[C.spinePitch] = 0.12 + 0.1 * hit;
    arm(p, s, lerp(lerp(-0.4, 0.55, wind), -1.55, hit), 0.15, -0.3, lerp(lerp(1.6, 2.1, wind), 0.08, hit), 0);
    arm(p, o, -0.9, 0.1, -0.3, 1.9, 0);
    leg(p, 0, 0.35, 0.1, 0, 0.4); flatFoot(p, 0);
    leg(p, 1, -0.3, 0.1, 0, 0.35); flatFoot(p, 1);
    p[C.py] = -0.05; p[C.headPitch] = -0.05;
  } else if (kind === 'staff') {
    r.propMode = 'hand';
    const sweep = lerp(1.1 * wind, -1.6, hit);
    p[C.chestYaw] = sweep * 0.6; p[C.spineYaw] = sweep * 0.35; p[C.hipYaw] = sweep * 0.15;
    arm(p, 1, -1.35, 0.25 + 0.3 * hit, -1.4, 0.35, 0.2);
    arm(p, 0, -1.0, 0.1, -0.4, 1.4, 0);
    p[C.staffSpin] = 0;
    leg(p, 0, 0.3, 0.12, 0, 0.45); flatFoot(p, 0);
    leg(p, 1, -0.25, 0.12, 0, 0.35); flatFoot(p, 1);
    p[C.py] = -0.05;
    p[C.tailYaw] = -sweep * 0.5;
  } else if (kind === 'roundhouse' || kind === 'spinkick') {
    const spin = ease(ss(0.05, 0.8, u)) * TAU;
    p[C.hipYaw] = spin % TAU;
    leg(p, 0, lerp(0.3, 0.9, hit), lerp(0.08, 1.2, hit), 0, lerp(1.3, 0.1, hit), 0.5);
    leg(p, 1, 0, 0.06, 0, 0.3); flatFoot(p, 1);
    arm(p, 0, -0.5, 0.9, 0, 0.8, 0); arm(p, 1, -0.9, 0.6, 0, 1.2, 0);
    p[C.spineRoll] = -0.35 * hit; p[C.headRoll] = 0.2 * hit;
    p[C.tailPitch] = 0.6; p[C.tailYaw] = 0.6 * hit;
  } else { // front kick
    p[C.spinePitch] = -0.15 * hit;
    leg(p, 1, lerp(lerp(0.2, 1.1, wind), 1.45, hit), 0.06, 0, lerp(lerp(0.3, 1.7, wind), 0.05, hit), lerp(0.3, 0.8, hit));
    leg(p, 0, -0.1, 0.06, 0, 0.3); flatFoot(p, 0);
    arm(p, 0, -0.7, 0.5, 0, 1.2, 0); arm(p, 1, 0.5 * hit, 0.7, 0, 0.6, 0);
    p[C.py] = 0.02 * hit;
    p[C.earBack] = 0.3;
  }
}

function poseCelebrate(r, p, A, t) {
  const hop = Math.abs(Math.sin(t * 6.5));
  p[C.py] = 0.05 * hop;
  p[C.squash] = 1 + 0.04 * (hop - 0.5);
  const pump = 0.5 + 0.5 * Math.sin(t * 13);
  arm(p, 0, -0.4, 2.35, 0, 0.3 + 0.45 * pump, 0);
  arm(p, 1, -0.4, 2.35, 0, 0.3 + 0.45 * pump, 0);
  leg(p, 0, 0.1 * hop, 0.06, 0, 0.1 + 0.3 * (1 - hop)); flatFoot(p, 0, 0.3 * hop);
  leg(p, 1, 0.1 * hop, 0.06, 0, 0.1 + 0.3 * (1 - hop)); flatFoot(p, 1, 0.3 * hop);
  p[C.headPitch] = -0.2; p[C.headRoll] = 0.12 * Math.sin(t * 6.5);
  tailWag(r, p, 0.6, 12); p[C.tailPitch] = 0.6;
  p[C.earSpread] = 0.15;
}

function poseVictory(r, p, A, t) {
  const kind = r.def.victory, T = r.time;
  if (kind === 'fistpump') {
    const pump = t < 1.6 ? 0.5 + 0.5 * Math.sin(t * 11) : 0.85;
    arm(p, 1, -0.3, 2.15, 1.45, 0.75 + 0.6 * pump, 0);
    arm(p, 0, 0.2, 0.8, -1.5, 1.6, 0.2);
    p[C.hipRoll] = -0.07; p[C.px] = -0.015; p[C.headRoll] = 0.1; p[C.headPitch] = -0.12;
    p[C.chestYaw] = 0.12;
    leg(p, 0, 0, 0.1, 0, 0.12); leg(p, 1, 0.05, 0.05, 0, 0.05);
    r.winkL = lerp(r.winkL, ss(0.4, 0.6, t) * (1 - ss(1.8, 2.0, t)), 0.5);
    tailWag(r, p, 0.3, 9);
  } else if (kind === 'spin') {
    const sp = ease(sat(t / 1.0));
    p[C.hipYaw] = (sp * TAU * 2) % TAU;
    const up = ss(0.7, 1.1, t);
    arm(p, 0, lerp(-0.3, -0.35, up), lerp(1.3, 2.35, up), 0, 0.3, 0);
    arm(p, 1, lerp(-0.3, -0.35, up), lerp(1.3, 2.35, up), 0, 0.3, 0);
    p[C.membrane] = 0.6 * (1 - up);
    p[C.py] = 0.04 * bump(sat(t / 1.0)) + 0.02 * up * Math.abs(Math.sin(t * 5));
    leg(p, 0, 0.05, 0.08, 0, 0.1); leg(p, 1, 0.05, 0.08, 0, 0.1);
    p[C.headPitch] = -0.2; tailWag(r, p, 0.4, 7); p[C.tailPitch] = 0.8;
  } else if (kind === 'flex') {
    const pose = ss(0.2, 0.6, t);
    const fl = pose * (0.9 + 0.1 * Math.sin(t * 9));
    arm(p, 0, lerp(0.05, -0.15, pose), lerp(0.2, 1.45, pose), lerp(0, 1.5, pose), lerp(0.3, 2.0 * fl, pose), 0.3);
    arm(p, 1, lerp(0.05, -0.15, pose), lerp(0.2, 1.45, pose), lerp(0, 1.5, pose), lerp(0.3, 2.0 * fl, pose), 0.3);
    p[C.shL] = 0.1 * pose; p[C.shR] = 0.1 * pose;
    p[C.chestPitch] = -0.12 * pose; p[C.headPitch] = -0.15 * pose;
    leg(p, 0, 0, 0.16, 0, 0.25); leg(p, 1, 0, 0.16, 0, 0.25);
    p[C.py] = -0.03 * pose;
  } else if (kind === 'twirl') {
    r.propMode = 'hand';
    const tw = t < 1.8 ? t * 16 : 1.8 * 16 + (t - 1.8) * 5;
    p[C.staffSpin] = tw % TAU;
    const up = ss(0.0, 0.3, t);
    arm(p, 1, lerp(-1.1, -0.3, up), lerp(0.3, 2.6, up), 0, lerp(1.0, 0.35, up), 0.3);
    arm(p, 0, 0.2, 0.8, -1.5, 1.6, 0.2);
    p[C.headPitch] = -0.2 * up; p[C.hipRoll] = -0.05;
    leg(p, 0, 0, 0.08, 0, 0.1); leg(p, 1, 0.12, 0.05, 0, 0.12);
    tailWag(r, p, 0.3, 6); p[C.tailCurl] = 0.4;
  } else if (kind === 'point') {
    const pose = ss(0.15, 0.5, t);
    arm(p, 1, lerp(0, -1.45, pose), 0.25, 0.3, lerp(0.3, 0.12, pose), 0.0);
    arm(p, 0, 0.2, 0.8, -1.5, 1.6, 0.2);
    p[C.chestYaw] = -0.25 * pose; p[C.headYaw] = 0.18 * pose; p[C.headRoll] = -0.12 * pose; p[C.headPitch] = 0.05;
    p[C.hipRoll] = 0.06; p[C.px] = 0.012;
    leg(p, 0, -0.05, 0.08, 0, 0.12); leg(p, 1, 0.12, 0.05, 0, 0.05);
    tailWag(r, p, 0.25, 2.5); p[C.tailPitch] = 0.4; p[C.tailCurl] = 0.6;
  } else { // thumbs (ember)
    const hop = t < 0.6 ? Math.sin(sat(t / 0.6) * PI) : 0;
    p[C.py] = 0.12 * hop;
    const pose = ss(0.25, 0.55, t);
    arm(p, 1, lerp(-1.8, -1.35, pose), 0.35, 0, lerp(0.5, 1.05, pose), 0.3);
    arm(p, 0, 0.2, 0.8, -1.5, 1.6, 0.2);
    p[C.headRoll] = 0.12 * pose; p[C.headPitch] = -0.1;
    leg(p, 0, 0.3 * hop, 0.08, 0, 0.1 + 0.8 * hop); leg(p, 1, 0.3 * hop, 0.08, 0, 0.1 + 0.6 * hop);
    tailWag(r, p, 0.45, 8); p[C.tailPitch] = 0.6;
    r.winkL = lerp(r.winkL, ss(0.5, 0.7, t) * (1 - ss(1.6, 1.8, t)), 0.5);
  }
  plant(p, r);
  flatFoot(p, 0); flatFoot(p, 1);
}

function poseDefeat(r, p, A, t) {
  const br = Math.sin(r.time * 1.6);
  p[C.spinePitch] = 0.26; p[C.chestPitch] = 0.18 + 0.03 * br; p[C.neckPitch] = 0.08; p[C.headPitch] = 0.28;
  p[C.shL] = -0.06; p[C.shR] = -0.06;
  arm(p, 0, -0.2, 0.06, 0.2, 0.15, 0.1); arm(p, 1, -0.2, 0.06, 0.2, 0.15, 0.1);
  leg(p, 0, 0.1, 0.02, 0.15, 0.2); leg(p, 1, 0.1, 0.02, 0.15, 0.2);
  p[C.py] = -0.025;
  flatFoot(p, 0); flatFoot(p, 1);
  p[C.earDroop] = 1; p[C.tailPitch] = -0.7; p[C.tailCurl] = 0.2;
}

function poseFrustrated(r, p, A, t) {
  const st = Math.sin(t * 9);
  const lift = Math.max(0, st);
  leg(p, 1, 0.3 * lift, 0.08, 0, 0.75 * lift); flatFoot(p, 1);
  leg(p, 0, 0, 0.08, 0, 0.12); flatFoot(p, 0);
  p[C.headYaw] = 0.3 * Math.sin(t * 13); p[C.headPitch] = 0.1;
  arm(p, 0, 0.25, 0.4, 0.3, 0.6, 0); arm(p, 1, 0.25, 0.4, 0.3, 0.6, 0);
  p[C.shL] = 0.08; p[C.shR] = 0.08;
  p[C.py] = -0.02 - 0.02 * (1 - lift);
  p[C.squash] = 1 - 0.03 * Math.max(0, -st);
  p[C.tailYaw] = 0.5 * Math.sin(t * 13); p[C.earBack] = 0.3;
}

function poseHigh5(r, p, A, t) {
  const up = ss(0, 0.25, t);
  arm(p, 1, lerp(-0.3, -0.45, up), lerp(0.2, 2.0, up), lerp(0, 1.3, up), lerp(0.8, 0.55, up), lerp(0, -0.5, up));
  arm(p, 0, 0.05, 0.2, 0, 0.4, 0);
  p[C.chestRoll] = 0.06 * up; p[C.headPitch] = -0.12; p[C.headRoll] = 0.06;
  leg(p, 1, 0.1, 0.05, 0, 0.1); flatFoot(p, 1, 0.15 * up);
  tailWag(r, p, 0.5, 10);
}

function poseDead(r, p, A, t) {
  const d = r.d;
  p[C.cPitch] = -1.5;
  p[C.cy] = -(d.pivotH - 0.13);
  p[C.cz] = 0.15;
  p[C.headYaw] = 0.55; p[C.headPitch] = -0.2;
  arm(p, 0, -0.4, 1.15, 0.3, 0.45, 0.2); arm(p, 1, -0.9, 0.85, 0.3, 0.75, 0.2);
  leg(p, 0, 0.15, 0.32, 0.2, 0.3, 0.3); leg(p, 1, 0.3, 0.22, 0.2, 0.55, 0.3);
  p[C.earDroop] = 1; p[C.tailPitch] = -0.3;
}

// ---------------------------------------------------------------------------
// shared part builders
// ---------------------------------------------------------------------------
function simpleHands(r, role, sz, opts = {}) {
  // mitten paw: palm + thumb (+ optional finger bumps)
  const b = r.bucket;
  const geo = r.merged(`paw|${role}|${fk(sz)}|${opts.toes ? 1 : 0}`, () => {
    const s = gSphere(b), parts = [
      [s, M([0, -sz * 0.95, sz * 0.05], [sz * 0.85, sz * 1.05, sz * 0.8])],
      [s, M([0, -sz * 0.8, sz * 0.62], [sz * 0.36, sz * 0.42, sz * 0.34])],
    ];
    if (opts.toes) for (let i = 0; i < 3; i++) parts.push([s, M([(i - 1) * sz * 0.48, -sz * 1.9, sz * 0.2], [sz * 0.3, sz * 0.3, sz * 0.3])]);
    return parts;
  });
  for (const sx of ['_l', '_r']) r.mesh(r.j['hand' + sx], geo, role, null, null, null, { name: 'hand' });
}
function standardLimbs(r, o) {
  const J = r.j;
  for (const sx of ['_l', '_r']) {
    if (o.upper) r.limb(J['arm' + sx], o.upper[2], o.upper[0], o.upper[1], r.d.upper);
    if (o.fore) r.limb(J['elbow' + sx], o.fore[2], o.fore[0], o.fore[1], r.d.fore);
    if (o.thigh) r.limb(J['thigh' + sx], o.thigh[2], o.thigh[0], o.thigh[1], r.d.thigh);
    if (o.shin) r.limb(J['knee' + sx], o.shin[2], o.shin[0], o.shin[1], r.d.shin);
  }
}
function sneakers(r, o) {
  const b = r.bucket, J = r.j, a = r.d.ankle;
  const L = o.len, W = o.w;
  const upper = r.merged(`shoeU|${fk(L)}|${fk(W)}`, () => {
    const s = gSphere(b);
    return [
      [s, M([0, -a * 0.2, L * 0.32], [W, a * 0.82, L * 0.95])],
      [gTorus(b, W * 0.72, W * 0.2), M([0, a * 0.42, 0.0], [1, 1, 1.05], [HP, 0, 0])],
    ];
  });
  const sole = r.merged(`shoeS|${fk(L)}|${fk(W)}|${o.stripe ? 1 : 0}`, () => {
    const s = gSphere(b);
    const parts = [
      [s, M([0, -a * 0.8, L * 0.32], [W * 1.12, a * 0.32, L * 1.05])],
      [s, M([0, -a * 0.42, L * 1.0], [W * 0.78, a * 0.5, L * 0.38])],
    ];
    if (o.stripe) {
      for (const sg of [1, -1]) parts.push([s, M([sg * W * 0.9, -a * 0.15, L * 0.3], [W * 0.14, a * 0.22, L * 0.55], [0.35, 0, 0])]);
    }
    return parts;
  });
  for (const sx of ['_l', '_r']) {
    r.mesh(J['foot' + sx], upper, o.role || 'shoe', null, null, null, { name: 'shoe' });
    r.mesh(J['foot' + sx], sole, o.sole || 'sole', null, null, null, { name: 'sole' });
  }
}
function earChain(r, sx, o) {
  // o: {pos, rot, len, w, segs, role, inner, flat}
  const J = r.j, b = r.bucket, sg = sx === '_l' ? 1 : -1;
  const joints = [];
  let parent = J.headC;
  const n = o.segs || 1;
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    g.name = 'ear' + i + sx;
    if (i === 0) { g.position.set(sg * o.pos[0], o.pos[1], o.pos[2]); g.rotation.set(o.rot[0], sg * (o.rot[1] || 0), sg * o.rot[2], 'YXZ'); }
    else g.position.set(0, o.len / n, 0);
    if (i > 0 && o.bend) g.rotation.x = o.bend;
    parent.add(g);
    const t0 = i / n, t1 = (i + 1) / n;
    r.mesh(g, gLeaf(b, o.len, o.w, t0, t1, o.shape ?? 0.7, o.taper ?? 0.25), o.role || 'fur', null, [1, 1, o.flat || 0.4]);
    if (o.inner && (i === 0 || o.innerAll)) {
      r.mesh(g, gLeaf(b, o.len * 0.9, o.w * 0.68, t0, Math.min(1, t1 + (n > 1 ? 0.04 : 0)), o.shape ?? 0.7, o.taper ?? 0.25), o.inner, [0, o.len * 0.03, o.w * (o.flat || 0.4) * 0.45], [1, 1, (o.flat || 0.4) * 0.5], null, { detail: true });
    }
    joints.push(g);
    parent = g;
  }
  J['ear' + sx] = joints[0];
  return joints;
}
function earDyn(sgn, droopBack = 1.4) {
  return (i, r, p, e) => {
    if (i !== 0) { e.x = -p[C.earDroop] * 0.25; return; }
    e.x = -p[C.earBack] - p[C.earDroop] * droopBack * 0.6;
    e.z = sgn * (-p[C.earSpread] - p[C.earDroop] * 0.5);
  };
}
function tailChain(r, o) {
  // o: {pos, segs:[{len, r0, r1, role}], rest, curl, flat, axisUp}
  const J = r.j, b = r.bucket;
  const joints = [];
  let parent = J.hips;
  o.segs.forEach((sgm, i) => {
    const g = new THREE.Group();
    g.name = 'tail' + i;
    if (i === 0) { g.position.set(o.pos[0], o.pos[1], o.pos[2]); g.rotation.x = o.rest; }
    else { g.position.set(0, o.segs[i - 1].len, 0); g.rotation.x = (o.curl && o.curl[i]) || 0; }
    parent.add(g);
    if (sgm.geo) r.mesh(g, sgm.geo, sgm.role, null, sgm.scl, null);
    else r.mesh(g, gTaper(b, sgm.r0, sgm.r1, sgm.len), sgm.role, [0, 0, 0], [1, 1, o.flat || 1]);
    joints.push(g);
    parent = g;
  });
  r.tailTip = joints[joints.length - 1];
  r.tailJoints = joints;
  const n = joints.length;
  const curlW = o.curlW || joints.map((_, i) => i / n);
  r.addChain(joints, {
    axis: new THREE.Vector3(0, 1, 0), k: o.k ?? 60, c: o.c ?? 9, stiff: o.stiff ?? 1.4,
    wind: o.wind ?? 0.5, grav: o.grav ?? 0.25, inertia: o.inertia ?? 0.012, maxBend: 0.9,
    dyn: (i, rr, p, e) => {
      if (i === 0) { e.x = p[C.tailPitch] * 0.6; e.z = p[C.tailYaw]; }
      else { e.x = -p[C.tailCurl] * curlW[i] * 0.6 + p[C.tailPitch] * 0.08; e.z = p[C.tailYaw] * 0.25; }
    },
  });
  return joints;
}

// ---------------------------------------------------------------------------
// ZARA — hare speedster
// ---------------------------------------------------------------------------
function buildZara(r) {
  const J = r.j, d = r.d, R = d.headR, b = r.bucket;
  // torso
  r.ell(J.hips, 'fur', [0, 0.035, -0.005], [0.108, 0.095, 0.098]);
  r.ell(J.chest, 'fur', [0, -0.02, 0], [0.13, 0.158, 0.11]);
  r.ell(J.chest, 'belly', [0, -0.045, 0.048], [0.092, 0.118, 0.072]);
  r.ell(J.hips, 'belly', [0, 0.07, -0.1], [0.06, 0.058, 0.058], null, { name: 'tailPuff' });
  // head
  r.ell(J.headC, 'fur', [0, 0, 0], [R, R * 0.93, R * 0.95], null, { name: 'head' });
  const muzzle = r.merged('muzzle', () => {
    const s = gSphere(b);
    return [
      [s, M([0.052, -0.072, 0.18], [0.08, 0.062, 0.07])],
      [s, M([-0.052, -0.072, 0.18], [0.08, 0.062, 0.07])],
      [s, M([0, -0.108, 0.168], [0.066, 0.05, 0.062])],
    ];
  });
  r.mesh(J.headC, muzzle, 'belly');
  r.ell(J.headC, 'nose', [0, -0.045, 0.245], [0.03, 0.021, 0.019]);
  r.face({
    eyeX: 0.088, eyeY: 0.03, eyeZ: 0.18, eyeR: [0.07, 0.092, 0.055], eyeYaw: 0.3, eyePitch: 0.0,
    iris: 0.62, pupil: [0.3, 0.34],
    brow: { x: 0.088, y: 0.145, z: 0.19, len: 0.07, t: 0.011, role: 'dark', pitch: -0.45, yaw: 0.32 },
    mouthY: -0.122, mouthZ: 0.232, mouthW: 0.062, mouthH: 0.013, mouthT: 0.0055, mouthPitch: 0.15,
  });
  // ears (2 segments, long)
  for (const sx of ['_l', '_r']) {
    const sg = sx === '_l' ? 1 : -1;
    const joints = earChain(r, sx, { pos: [0.07, 0.19, -0.035], rot: [-0.22, 0.12, -0.16], len: 0.46, w: 0.062, segs: 2, role: 'fur', inner: 'inner', flat: 0.36, innerAll: true });
    r.addChain(joints, { axis: new THREE.Vector3(0, 1, 0), k: 85, c: 10, stiff: 1.3, wind: 1.1, grav: 0.35, inertia: 0.018, maxBend: 1.45, dyn: earDyn(sg, 2.2), sweep: 1.1, kind: 'ear' });
  }
  // goggles pushed up on forehead
  r.mesh(J.headC, gBand('zaraStrap', b, [0, 0, 0], [R, R * 0.93, R * 0.95], 0.72, 0.03, 0.012), 'extra', null, null, null, { name: 'strap' });
  const gogFrames = r.merged('gogF', () => {
    const parts = [];
    for (const sg of [1, -1]) {
      const n = new THREE.Vector3(sg * 0.4, 0.62, 0.68).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      const e = new THREE.Euler().setFromQuaternion(q);
      const p0 = n.clone().multiplyScalar(R * 0.985);
      parts.push([gTorus(b, 0.05, 0.016), M([p0.x, p0.y, p0.z], [1, 1, 1], [e.x, e.y, e.z])]);
      const qy = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      parts.push([gCyl(b, 0.054, 0.054, 0.024), new THREE.Matrix4().compose(p0.clone().addScaledVector(n, -0.006), qy, new THREE.Vector3(1, 1, 1))]);
    }
    return parts;
  });
  r.mesh(J.headC, gogFrames, 'extra', null, null, null, { name: 'goggles' });
  const lenses = r.merged('gogL', () => {
    const parts = [];
    for (const sg of [1, -1]) {
      const n = new THREE.Vector3(sg * 0.4, 0.62, 0.68).normalize();
      const p0 = n.clone().multiplyScalar(R * 0.985 + 0.004);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      parts.push([gSphere(b), new THREE.Matrix4().compose(p0, q, new THREE.Vector3(0.043, 0.043, 0.026))]);
    }
    return parts;
  });
  r.mesh(J.headC, lenses, 'lens', null, null, null, { name: 'lenses' });
  // scarf
  const scarf = r.merged('scarf', () => [
    [gTorus(b, 0.082, 0.034), M([0, 0, 0], [1.12, 1.0, 1.0], [HP, 0, 0])],
    [gSphere(b), M([0.03, -0.005, -0.098], [0.038, 0.034, 0.03])],
  ]);
  r.mesh(J.chest, scarf, 'accent', [0, 0.118, -0.004], null, [0.1, 0, 0], { name: 'scarf' });
  const ribbon = gSphere(b);
  for (let k = 0; k < 2; k++) {
    const joints = [], meshes = [], lens = [];
    let parent = J.chest;
    const n = 3, L = k ? 0.1 : 0.12;
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      if (i === 0) { g.position.set(0.035 - k * 0.03, 0.11, -0.11); g.rotation.set(-2.6, 0, (k ? -1 : 1) * 0.22); }
      else g.position.set(0, L, 0);
      parent.add(g);
      const m = r.mesh(g, ribbon, 'accent', [0, L * 0.5, 0], [0.026 - i * 0.002, L * 0.6, 0.0065], null, { name: 'ribbon' });
      m.userData.baseSY = m.scale.y;
      meshes.push(m); lens.push(L);
      joints.push(g); parent = g;
    }
    r.addChain(joints, { axis: new THREE.Vector3(0, 1, 0), k: 55, c: 6.5, stiff: 0.9, wind: 1.4, grav: 0.9, inertia: 0.03, maxBend: 1.6, flutter: 0.9, flutterFreq: 14 + k * 3, sweep: 0, stretch: { meshes, len: lens, amount: 0.55 }, kind: 'ribbon' });
  }
  // limbs
  standardLimbs(r, { upper: [0.045, 0.039, 'fur'], fore: [0.039, 0.034, 'fur'], thigh: [0.067, 0.05, 'fur'], shin: [0.05, 0.038, 'fur'] });
  // fingerless gloves: dark palm + cuff, fur fingers
  const glove = r.merged('glove', () => [
    [gSphere(b), M([0, -0.042, 0.003], [0.046, 0.05, 0.04])],
    [gTorus(b, 0.034, 0.012), M([0, -0.008, 0], [1, 1, 1], [HP, 0, 0])],
  ]);
  const fingers = r.merged('fingers', () => [
    [gSphere(b), M([0, -0.083, 0.012], [0.04, 0.026, 0.035])],
    [gSphere(b), M([0, -0.04, 0.042], [0.018, 0.024, 0.018])],
  ]);
  for (const sx of ['_l', '_r']) {
    r.mesh(J['hand' + sx], glove, 'dark', null, null, null, { name: 'glove' });
    r.mesh(J['hand' + sx], fingers, 'fur', null, null, null, { name: 'fingers', detail: true });
  }
  sneakers(r, { len: 0.12, w: 0.064, stripe: true });
}

// ---------------------------------------------------------------------------
// PIP — sugar glider
// ---------------------------------------------------------------------------
function buildPip(r) {
  const J = r.j, d = r.d, R = d.headR, b = r.bucket;
  r.ell(J.hips, 'fur', [0, 0.03, -0.005], [0.112, 0.092, 0.104]);
  r.ell(J.chest, 'fur', [0, -0.025, 0], [0.12, 0.14, 0.11]);
  r.ell(J.chest, 'belly', [0, -0.05, 0.05], [0.085, 0.1, 0.07]);
  // head
  r.ell(J.headC, 'fur', [0, 0, 0], [R * 1.04, R * 0.92, R * 0.95], null, { name: 'head' });
  r.ell(J.headC, 'fur2', [0, 0.02, -0.01], [0.034, R * 0.95, R * 0.97], null, { name: 'stripe' });
  const muzzle = r.merged('muzzle', () => [
    [gSphere(b), M([0, -0.075, 0.16], [0.11, 0.07, 0.08])],
    [gSphere(b), M([0.105, -0.05, 0.13], [0.06, 0.05, 0.05])],
    [gSphere(b), M([-0.105, -0.05, 0.13], [0.06, 0.05, 0.05])],
  ]);
  r.mesh(J.headC, muzzle, 'belly');
  r.ell(J.headC, 'nose', [0, -0.045, 0.237], [0.024, 0.017, 0.016]);
  r.face({
    eyeX: 0.096, eyeY: 0.02, eyeZ: 0.165, eyeR: [0.084, 0.098, 0.062], eyeYaw: 0.34,
    iris: 0.8, pupil: [0.5, 0.54], hl2: true,
    brow: { x: 0.095, y: 0.135, z: 0.18, len: 0.055, t: 0.009, role: 'fur2', pitch: -0.45, yaw: 0.35 },
    mouthY: -0.098, mouthZ: 0.225, mouthW: 0.05, mouthH: 0.011, mouthT: 0.005, mouthPitch: 0.15,
  });
  // big round ears
  for (const sx of ['_l', '_r']) {
    const sg = sx === '_l' ? 1 : -1;
    const joints = earChain(r, sx, { pos: [0.15, 0.12, -0.03], rot: [-0.15, 0.25, -0.75], len: 0.15, w: 0.072, segs: 1, role: 'fur2', inner: 'inner', flat: 0.32, shape: 0.55, taper: 0.1 });
    r.addChain(joints, { k: 120, c: 12, stiff: 1.8, wind: 0.6, grav: 0.2, inertia: 0.01, maxBend: 0.8, dyn: earDyn(sg, 0.8), sweep: 0.5, kind: 'ear' });
  }
  // aviator cap
  const cap = r.merged('cap', () => [
    [gDome(b, 1.05), M([0, 0.005, -0.01], [R * 1.07, R * 0.99, R * 1.03], [-0.32, 0, 0])],
    [gSphere(b), M([0.19, -0.06, 0.035], [0.028, 0.07, 0.06], [0, 0, 0.3])],
    [gSphere(b), M([-0.19, -0.06, 0.035], [0.028, 0.07, 0.06], [0, 0, -0.3])],
    [gTorus(b, R * 1.03, 0.012), M([0, 0.095, -0.03], [1.04, 1, 0.98], [HP - 0.32, 0, 0])],
  ]);
  r.mesh(J.headC, cap, 'accent', null, null, null, { name: 'cap' });
  const gog = r.merged('gog', () => {
    const parts = [];
    for (const sg of [1, -1]) {
      const n = new THREE.Vector3(sg * 0.3, 0.78, 0.55).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      const e = new THREE.Euler().setFromQuaternion(q);
      const p0 = n.clone().multiplyScalar(R * 1.03);
      parts.push([gTorus(b, 0.035, 0.011), M([p0.x, p0.y, p0.z], [1, 1, 1], [e.x, e.y, e.z])]);
    }
    return parts;
  });
  r.mesh(J.headC, gog, 'extra', null, null, null, { name: 'goggles' });
  const lens = r.merged('lens', () => {
    const parts = [];
    for (const sg of [1, -1]) {
      const n = new THREE.Vector3(sg * 0.3, 0.78, 0.55).normalize();
      const p0 = n.clone().multiplyScalar(R * 1.03);
      parts.push([gSphere(b), M([p0.x, p0.y, p0.z], [0.03, 0.03, 0.03])]);
    }
    return parts;
  });
  r.mesh(J.headC, lens, 'lens', null, null, null, { name: 'lenses' });
  // limbs: grey paws
  standardLimbs(r, { upper: [0.036, 0.031, 'fur'], fore: [0.031, 0.028, 'fur2'], thigh: [0.055, 0.042, 'fur'], shin: [0.04, 0.032, 'fur2'] });
  simpleHands(r, 'fur2', 0.036, { toes: true });
  const foot = r.merged('foot', () => {
    const s = gSphere(b), a = d.ankle;
    const parts = [[s, M([0, -a * 0.45, 0.04], [0.05, 0.042, 0.085])]];
    for (let i = 0; i < 3; i++) parts.push([s, M([(i - 1) * 0.026, -a * 0.6, 0.11], [0.018, 0.018, 0.02])]);
    return parts;
  });
  for (const sx of ['_l', '_r']) r.mesh(J['foot' + sx], foot, 'fur2', null, null, null, { name: 'foot' });
  // membranes
  r._addMembranes('membrane');
  // broad flat bushy tail
  const segs = [];
  const tl = [0.11, 0.12, 0.12, 0.11];
  const tw = [0.06, 0.08, 0.085, 0.07];
  for (let i = 0; i < 4; i++) segs.push({ len: tl[i], role: i === 3 ? 'dark' : 'fur2', geo: gSphere(b), scl: [tw[i], tl[i] * 0.72, tw[i] * 0.42] });
  const joints = tailChain(r, { pos: [0, 0.03, -0.09], rest: -HP - 0.05, segs, curl: [0, 0.2, 0.25, 0.3], k: 55, c: 8, stiff: 1.6, wind: 0.7, grav: 0.1 });
  // offset tail segment meshes to centre along segment
  joints.forEach((j, i) => { const m = j.children.find((c) => c.isMesh); if (m) m.position.y = tl[i] * 0.5; });
}

// ---------------------------------------------------------------------------
// ROOK — pangolin brawler
// ---------------------------------------------------------------------------
function buildRook(r) {
  const J = r.j, d = r.d, R = d.headR, b = r.bucket;
  // torso: tan front, crimson plated back
  r.ell(J.hips, 'fur', [0, 0.03, 0], [0.15, 0.11, 0.13]);
  r.ell(J.chest, 'fur', [0, -0.02, 0.01], [0.175, 0.18, 0.14]);
  r.ell(J.chest, 'belly', [0, -0.05, 0.06], [0.12, 0.13, 0.09]);
  const back = r.merged('backPlates', () => ellipsoidPlates(b, [0, -0.01, -0.005], [0.182, 0.19, 0.15], [
    [0.2, 0.5, 3], [0.68, 0.95, 4], [1.15, 1.2, 5], [1.62, 1.3, 5], [2.1, 1.2, 4],
  ], { w: 0.085, l: 0.12, th: 0.034, lift: 0.3, off: 0.0 }));
  r.mesh(J.chest, back, 'scales', null, null, null, { name: 'backPlates' });
  const hipPl = r.merged('hipPlates', () => ellipsoidPlates(b, [0, 0.02, -0.005], [0.152, 0.115, 0.13], [
    [1.15, 1.2, 5], [1.7, 1.1, 4],
  ], { w: 0.08, l: 0.11, th: 0.032, lift: 0.3 }));
  r.mesh(J.hips, hipPl, 'scales', null, null, null, { name: 'hipPlates' });
  // head
  r.ell(J.headC, 'fur', [0, 0, 0], [R, R * 0.92, R * 0.95], null, { name: 'head' });
  const hood = r.merged('hood', () => ellipsoidPlates(b, [0, 0.0, -0.01], [R * 1.0, R * 0.93, R * 0.95], [
    [-0.3, 0.32, 2], [0.2, 0.62, 3], [0.72, 0.9, 4], [1.25, 0.95, 4], [1.78, 0.75, 3],
  ], { w: 0.13, l: 0.14, th: 0.03, lift: 0.1, off: -0.006, pointed: false, scale: (i) => (i === 0 ? 0.8 : 1) }));
  r.mesh(J.headC, hood, 'scales', null, null, null, { name: 'hood' });
  const snout = r.merged('snout', () => [
    [gSphere(b), M([0, -0.07, 0.17], [0.1, 0.075, 0.11])],
    [gSphere(b), M([0, -0.058, 0.25], [0.058, 0.048, 0.07])],
  ]);
  r.mesh(J.headC, snout, 'belly');
  r.ell(J.headC, 'nose', [0, -0.052, 0.315], [0.03, 0.023, 0.02]);
  r.face({
    eyeX: 0.09, eyeY: 0.035, eyeZ: 0.178, eyeR: [0.066, 0.078, 0.05], eyeYaw: 0.3,
    iris: 0.64, pupil: [0.32, 0.35],
    brow: { x: 0.088, y: 0.13, z: 0.2, len: 0.075, t: 0.017, role: 'dark', pitch: -0.4, yaw: 0.3 },
    mouthY: -0.112, mouthZ: 0.245, mouthW: 0.07, mouthH: 0.012, mouthT: 0.006, mouthPitch: 0.25,
  });
  // tiny ears
  for (const sg of [1, -1]) r.ell(J.headC, 'inner', [sg * 0.2, 0.02, -0.06], [0.03, 0.04, 0.025], null, { detail: true });
  // limbs
  standardLimbs(r, { shin: [0.066, 0.06, 'fur'] });
  const platedLimb = (key, r0, r1, len) => r.merged(key, () => {
    const parts = [[gTaper(b, r0, r1, len), M([0, 0, 0], [1, 1, 1], [PI, 0, 0])]];
    for (let row = 0; row < 3; row++) {
      for (let c = -1; c <= 1; c++) {
        const th = c * 0.9 + (row % 2) * 0.45 - 0.2;
        const y = -len * (0.12 + row * 0.3);
        const rr = lerp(r0, r1, (row * 0.3 + 0.12)) * 0.95;
        const P = new THREE.Vector3(Math.sin(th) * rr, y, Math.cos(th) * rr * -1);
        const N = new THREE.Vector3(Math.sin(th), 0.2, -Math.cos(th)).normalize();
        parts.push([gPlateUnit(b), plateMatrix(P, N, new THREE.Vector3(0, -1, 0), rr * 0.75, len * 0.3, 0.018, 0.25)]);
      }
    }
    return parts;
  });
  const upperG = platedLimb('upperArm', 0.062, 0.056, d.upper), thighG = platedLimb('thigh', 0.08, 0.068, d.thigh);
  for (const sx of ['_l', '_r']) {
    r.mesh(J['arm' + sx], upperG, 'scales', null, null, null, { name: 'upperArm' });
    r.mesh(J['thigh' + sx], thighG, 'scales', null, null, null, { name: 'thigh' });
  }
  // gauntlets
  const gaunt = r.merged('gaunt', () => [
    [gTaper(b, 0.07, 0.085, d.fore * 0.95), M([0, 0, 0], [1, 1, 1], [PI, 0, 0])],
    [gTorus(b, 0.082, 0.016), M([0, -d.fore * 0.92, 0], [1, 1, 1], [HP, 0, 0])],
    [gTorus(b, 0.07, 0.014), M([0, -0.01, 0], [1, 1, 1], [HP, 0, 0])],
  ]);
  const fist = r.merged('fist', () => [
    [gSphere(b), M([0, -0.06, 0.01], [0.08, 0.082, 0.075])],
    [gSphere(b), M([0, -0.05, 0.07], [0.03, 0.036, 0.03])],
  ]);
  const studs = r.merged('studs', () => {
    const parts = [];
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 0.034;
      parts.push([gCyl(b, 0.008, 0.016, 0.022), M([x, -0.104, 0.066], [1, 1, 1], [HP + 0.64, 0, 0])]);
    }
    return parts;
  });
  for (const sx of ['_l', '_r']) {
    r.mesh(J['elbow' + sx], gaunt, 'accent', null, null, null, { name: 'gauntlet' });
    r.mesh(J['hand' + sx], fist, 'accent', null, null, null, { name: 'fist' });
    r.mesh(J['hand' + sx], studs, 'extra2', null, null, null, { name: 'studs', detail: true });
  }
  // heavy boots
  const a = d.ankle;
  const boot = r.merged('boot', () => [
    [gSphere(b), M([0, -a * 0.25, 0.06], [0.09, a * 0.85, 0.14])],
    [gCyl(b, 0.072, 0.082, 0.09), M([0, 0.03, 0], [1, 1, 1])],
  ]);
  const bootSole = r.merged('bootSole', () => [
    [gSphere(b), M([0, -a * 0.82, 0.06], [0.1, a * 0.28, 0.16])],
    [gTorus(b, 0.08, 0.014), M([0, 0.075, 0], [1, 1, 1], [HP, 0, 0])],
  ]);
  for (const sx of ['_l', '_r']) {
    r.mesh(J['foot' + sx], boot, 'shoe', null, null, null, { name: 'boot' });
    r.mesh(J['foot' + sx], bootSole, 'sole', null, null, null, { name: 'bootSole' });
  }
  // plated tail
  const tl = [0.13, 0.13, 0.12, 0.11];
  const tr = [0.095, 0.085, 0.07, 0.05];
  const segs = tl.map((len, i) => ({
    len, role: 'scales', scl: null,
    geo: r.merged('tailSeg' + i, () => {
      const parts = [[gSphere(b), M([0, len * 0.5, 0], [tr[i] * 0.9, len * 0.62, tr[i] * 0.62])]];
      for (let row = 0; row < 2; row++) {
        for (let c = -2; c <= 2; c++) {
          const th = c * 0.62 + (row % 2) * 0.31;
          const y = len * (0.25 + row * 0.42);
          const rr = tr[i] * (1 - row * 0.12);
          const P = new THREE.Vector3(Math.sin(th) * rr * 0.92, y, Math.cos(th) * rr * 0.66);
          const N = new THREE.Vector3(Math.sin(th), 0.15, Math.cos(th) * 1.3).normalize();
          parts.push([gPlateUnit(b), plateMatrix(P, N, new THREE.Vector3(0, 1, 0), rr * 0.6, len * 0.42, 0.02, 0.25)]);
        }
      }
      return parts;
    }),
  }));
  tailChain(r, { pos: [0, 0.02, -0.11], rest: -HP + 0.45, segs, curl: [0, 0.22, 0.22, 0.25], k: 70, c: 11, stiff: 2.0, wind: 0.25, grav: 0.12 });
}

// ---------------------------------------------------------------------------
// LUMI — gecko acrobat
// ---------------------------------------------------------------------------
function spotsGeo(r, key, list) {
  return r.merged(key, () => list.map(([p, s]) => [gSphere(r.bucket), M(p, [s, s * 0.9, s * 0.35], [0, 0, 0])]));
}
function surfaceSpots(r, key, c, rad, pts, size) {
  // pts: [[x,y,z] directions]; place flattened spots on ellipsoid surface oriented by normal
  return r.merged(key, () => pts.map(([dx, dy, dz, sc]) => {
    const D = new THREE.Vector3(dx, dy, dz).normalize();
    const P = new THREE.Vector3(c[0] + D.x * rad[0], c[1] + D.y * rad[1], c[2] + D.z * rad[2]);
    const N = new THREE.Vector3(D.x / rad[0], D.y / rad[1], D.z / rad[2]).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), N);
    const s = size * (sc || 1);
    return [gSphere(r.bucket), new THREE.Matrix4().compose(P, q, new THREE.Vector3(s, s * 0.85, s * 0.3))];
  }));
}
function buildLumi(r) {
  const J = r.j, d = r.d, R = d.headR, b = r.bucket;
  r.ell(J.hips, 'fur', [0, 0.03, -0.005], [0.102, 0.09, 0.092]);
  r.ell(J.chest, 'fur', [0, -0.02, 0], [0.112, 0.15, 0.098]);
  r.ell(J.chest, 'belly', [0, -0.04, 0.042], [0.08, 0.115, 0.066]);
  r.mesh(J.chest, surfaceSpots(r, 'backSpots', [0, -0.02, 0], [0.112, 0.15, 0.098], [
    [0.3, 0.6, -0.7, 1], [-0.35, 0.3, -0.85, 0.8], [0.1, -0.1, -1, 1.1], [0.45, -0.45, -0.75, 0.7], [-0.25, -0.6, -0.75, 0.9], [-0.7, 0.4, -0.5, 0.6], [0.75, 0.1, -0.6, 0.65],
  ], 0.026), 'spots', null, null, null, { name: 'spots', detail: true });
  // sash
  r.mesh(J.hips, gBand('lumiSash', b, [0, 0.03, -0.005], [0.102, 0.09, 0.092], -0.15, 0.03, 0.018), 'accent', null, null, null, { name: 'sash' });
  // head: wide gecko head
  r.ell(J.headC, 'fur', [0, 0, 0], [R * 1.1, R * 0.88, R * 0.97], null, { name: 'head' });
  r.mesh(J.headC, surfaceSpots(r, 'headSpots', [0, 0, 0], [R * 1.1, R * 0.88, R * 0.97], [
    [0, 1, -0.2, 1.1], [0.42, 0.85, -0.35, 0.8], [-0.45, 0.82, -0.3, 0.9], [0.2, 0.6, -0.8, 0.75], [-0.25, 0.55, -0.82, 0.7], [0.8, 0.3, -0.5, 0.6], [-0.78, 0.35, -0.52, 0.65], [0.0, 0.25, -1, 0.9],
  ], 0.032), 'spots', null, null, null, { name: 'headSpots', detail: true });
  // nostrils
  for (const sg of [1, -1]) r.ell(J.headC, 'nose', [sg * 0.03, -0.02, 0.222], [0.01, 0.007, 0.008], null, { detail: true });
  r.face({
    eyeX: 0.118, eyeY: 0.055, eyeZ: 0.145, eyeR: [0.088, 0.092, 0.068], eyeYaw: 0.48, eyePitch: -0.08,
    iris: 0.72, pupil: [0.26, 0.48], hl2: true,
    brow: { x: 0.115, y: 0.16, z: 0.15, len: 0.06, t: 0.009, role: 'dark', pitch: -0.55, yaw: 0.5 },
    mouthY: -0.062, mouthZ: 0.215, mouthW: 0.15, mouthH: 0.016, mouthT: 0.0055, mouthPitch: 0.2, mouthBend: 0.45,
  });
  // headband
  r.mesh(J.headC, gBand('lumiBand', b, [0, 0, 0], [R * 1.1, R * 0.88, R * 0.97], 0.4, 0.105, 0.014), 'accent', null, null, null, { name: 'headband' });
  // limbs
  standardLimbs(r, { upper: [0.036, 0.031, 'fur'], fore: [0.031, 0.028, 'fur'], thigh: [0.05, 0.04, 'fur'], shin: [0.04, 0.03, 'fur'] });
  // sticky-toe hands and feet
  const hand = r.merged('hand', () => {
    const s = gSphere(b), parts = [[s, M([0, -0.035, 0.005], [0.036, 0.04, 0.03])]];
    for (let i = 0; i < 3; i++) {
      const a = (i - 1) * 0.45;
      parts.push([gTaper(b, 0.009, 0.007, 0.04), M([Math.sin(a) * 0.012, -0.05, 0.008], [1, 1, 1], [PI + 0.15, 0, a])]);
      parts.push([s, M([Math.sin(a) * 0.04, -0.05 - Math.cos(a) * 0.038, 0.012], [0.014, 0.014, 0.014])]);
    }
    parts.push([s, M([0, -0.03, 0.035], [0.012, 0.022, 0.012])]);
    return parts;
  });
  for (const sx of ['_l', '_r']) r.mesh(J['hand' + sx], hand, 'fur', null, null, null, { name: 'hand' });
  // wrist wraps
  for (const sx of ['_l', '_r']) r.mesh(J['elbow' + sx], gTorus(b, 0.032, 0.011), 'accent', [0, -d.fore * 0.8, 0], [1, 1.6, 1], [HP, 0, 0], { name: 'wrap', detail: true });
  const foot = r.merged('foot', () => {
    const s = gSphere(b), a = d.ankle, parts = [[s, M([0, -a * 0.55, 0.04], [0.048, 0.03, 0.075])]];
    for (let i = 0; i < 4; i++) {
      const ang = (i - 1.5) * 0.42;
      parts.push([gTaper(b, 0.01, 0.008, 0.05), M([0, -a * 0.7, 0.07], [1, 1, 1], [HP, ang, 0], 'YXZ')]);
      parts.push([s, M([Math.sin(ang) * 0.055, -a * 0.7, 0.07 + Math.cos(ang) * 0.055], [0.017, 0.012, 0.017])]);
    }
    return parts;
  });
  for (const sx of ['_l', '_r']) r.mesh(J['foot' + sx], foot, 'fur', null, null, null, { name: 'foot' });
  // long curling tail
  const n = 7;
  const segs = [];
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    segs.push({ len: 0.1 - i * 0.004, r0: 0.055 * (1 - t0 * 0.78), r1: 0.055 * (1 - t1 * 0.78), role: 'fur' });
  }
  const tj = tailChain(r, { pos: [0, 0.02, -0.085], rest: -HP + 0.2, segs, curl: [0, 0.0, 0.08, 0.2, 0.45, 0.85, 1.15], k: 45, c: 7, stiff: 1.5, wind: 0.6, grav: 0.1 });
  // spots on a few tail segments
  [1, 3, 5].forEach((i) => {
    const s = segs[i];
    r.mesh(tj[i], spotsGeo(r, 'tsp' + i, [[[0, s.len * 0.5, s.r0 * 0.95], s.r0 * 0.45]]), 'spots', null, null, null, { detail: true });
  });
  // bo staff
  const staffLen = 1.1;
  const root = new THREE.Group(); root.name = 'staff'; r.body.add(root);
  const spin = new THREE.Group(); root.add(spin);
  r.mesh(spin, gCyl(b, 0.017, 0.017, staffLen), 'staff', null, null, null, { name: 'staffShaft' });
  const caps = r.merged('staffCaps', () => [
    [gCyl(b, 0.024, 0.024, 0.08), M([0, staffLen / 2 - 0.04, 0])],
    [gSphere(b), M([0, staffLen / 2, 0], [0.024, 0.012, 0.024])],
    [gCyl(b, 0.024, 0.024, 0.08), M([0, -staffLen / 2 + 0.04, 0])],
    [gSphere(b), M([0, -staffLen / 2, 0], [0.024, 0.012, 0.024])],
    [gCyl(b, 0.021, 0.021, 0.12), M([0, 0, 0])],
    [gCyl(b, 0.045, 0.045, 0.012), M([0, -staffLen / 2 + 0.25, 0])],
  ]);
  r.mesh(spin, caps, 'extra', null, null, null, { name: 'staffCaps' });
  const sBack = new THREE.Group(); sBack.position.set(0, 0.0, -0.13); sBack.rotation.set(0, 0, 0.75); J.chest.add(sBack);
  const sHand = new THREE.Group(); sHand.position.set(0, -0.045, 0.01); sHand.rotation.set(HP, 0, 0); J.hand_r.add(sHand);
  const sPogo = new THREE.Group(); sPogo.position.set(0, staffLen / 2 + 0.01, 0.15); r.mover.add(sPogo);
  r.staff = { root, spin, back: sBack, hand: sHand, pogo: sPogo, init: false, lastMode: 'back' };
}

function collarGeo(b) {
  return cg(`vexCollar|${b}`, () => {
    // thick flared ring (outer + inner wall + rim), open at the front
    const pts = [];
    const n = 8;
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push(new THREE.Vector2(0.1 + 0.085 * t * t, t * 0.15)); }
    for (let i = n; i >= 0; i--) { const t = i / n; pts.push(new THREE.Vector2(0.088 + 0.08 * t * t, t * 0.15 - 0.004)); }
    pts.push(pts[0].clone());
    return new THREE.LatheGeometry(pts, SEG[b].lathe + 4, 0.75, TAU - 1.5);
  });
}

// ---------------------------------------------------------------------------
// VEX — panther rival
// ---------------------------------------------------------------------------
function buildVex(r) {
  const J = r.j, d = r.d, R = d.headR, b = r.bucket;
  r.ell(J.hips, 'stripe', [0, 0.035, -0.005], [0.105, 0.095, 0.095]);
  // jacket with high collar
  const jacket = r.merged('jacket', () => [
    [gSphere(b), M([0, -0.02, 0], [0.128, 0.16, 0.108])],
    [collarGeo(b), M([0, 0.07, -0.02], [1.15, 1, 1.0], [-0.22, 0, 0])],
    [gTorus(b, 0.105, 0.012), M([0, -0.155, 0], [1.2, 1, 1.02], [HP, 0, 0])],
  ]);
  const jm = r.mesh(J.chest, jacket, 'accent', null, null, null, { name: 'jacket' });
  jm.material.side = THREE.DoubleSide;
  r.mesh(J.chest, r.merged('zip', () => [
    [gCyl(b, 0.006, 0.006, 0.22), M([0, -0.02, 0.107], [1, 1, 0.6], [-0.08, 0, 0])],
    [gTorus(b, 0.09, 0.006, PI * 0.9), M([0, 0.11, 0.0], [1.1, 1, 1], [HP - 0.15, 0, PI * 0.05])],
  ]), 'glow', null, null, null, { name: 'zip', detail: true });
  // head
  r.ell(J.headC, 'fur', [0, 0, 0], [R * 1.02, R * 0.94, R * 0.97], null, { name: 'head' });
  const muzzle = r.merged('muzzle', () => [
    [gSphere(b), M([0.04, -0.075, 0.165], [0.068, 0.055, 0.062])],
    [gSphere(b), M([-0.04, -0.075, 0.165], [0.068, 0.055, 0.062])],
    [gSphere(b), M([0, -0.1, 0.15], [0.05, 0.04, 0.05])],
  ]);
  r.mesh(J.headC, muzzle, 'belly');
  r.ell(J.headC, 'nose', [0, -0.045, 0.223], [0.026, 0.018, 0.016], [0.2, 0, 0]);
  // cheek glow marks + brow chevron
  const marks = r.merged('marks', () => {
    const parts = [];
    for (const sg of [1, -1]) {
      for (let k = 0; k < 2; k++) {
        const n = new THREE.Vector3(sg * (0.86 - k * 0.07), -0.14 - k * 0.18, 0.5).normalize();
        const p0 = n.clone().multiplyScalar(R * 0.985);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        const e = new THREE.Euler().setFromQuaternion(q);
        const m = M([p0.x, p0.y, p0.z], [0.038 - k * 0.008, 0.007, 0.008], [e.x, e.y, e.z]);
        m.multiply(new THREE.Matrix4().makeRotationZ(sg * 0.35));
        parts.push([gSphere(b), m]);
      }
      const n2 = new THREE.Vector3(sg * 0.18, 0.72, 0.67).normalize();
      const p2 = n2.clone().multiplyScalar(R * 0.98);
      const q2 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n2);
      const e2 = new THREE.Euler().setFromQuaternion(q2);
      const m2 = M([p2.x, p2.y, p2.z], [0.03, 0.006, 0.008], [e2.x, e2.y, e2.z]);
      m2.multiply(new THREE.Matrix4().makeRotationZ(-sg * 0.5));
      parts.push([gSphere(b), m2]);
    }
    return parts;
  });
  r.mesh(J.headC, marks, 'glow', null, null, null, { name: 'marks', detail: true });
  r.face({
    eyeX: 0.088, eyeY: 0.035, eyeZ: 0.172, eyeR: [0.074, 0.068, 0.05], eyeYaw: 0.3, eyeRoll: 0.22,
    iris: 0.64, pupil: [0.13, 0.46],
    brow: { x: 0.088, y: 0.13, z: 0.195, len: 0.07, t: 0.011, role: 'belly', pitch: -0.45, yaw: 0.32 },
    mouthY: -0.128, mouthZ: 0.206, mouthW: 0.058, mouthH: 0.011, mouthT: 0.005, mouthPitch: 0.25,
  });
  // pointed ears
  for (const sx of ['_l', '_r']) {
    const sg = sx === '_l' ? 1 : -1;
    const joints = earChain(r, sx, { pos: [0.14, 0.15, -0.035], rot: [-0.12, 0.2, -0.45], len: 0.13, w: 0.062, segs: 1, role: 'fur', inner: 'inner', flat: 0.35, shape: 0.9, taper: 0.75 });
    r.addChain(joints, { k: 140, c: 14, stiff: 2.2, wind: 0.4, grav: 0.1, inertia: 0.006, maxBend: 0.6, dyn: earDyn(sg, 0.6), sweep: 0.35, kind: 'ear' });
  }
  // limbs (striped)
  standardLimbs(r, { upper: [0.04, 0.034, 'accent'], fore: [0.034, 0.029, 'stripe'], thigh: [0.055, 0.042, 'stripe'], shin: [0.042, 0.032, 'stripe'] });
  simpleHands(r, 'fur', 0.038);
  sneakers(r, { len: 0.12, w: 0.058, role: 'shoe', sole: 'glow' });
  // long tail with curl
  const n = 6, segs = [];
  for (let i = 0; i < n; i++) segs.push({ len: 0.1, r0: 0.034 - i * 0.003, r1: 0.031 - i * 0.003, role: i === n - 1 ? 'glow' : 'stripe' });
  tailChain(r, { pos: [0, 0.02, -0.09], rest: -HP - 0.25, segs, curl: [0, 0.1, 0.22, 0.35, 0.5, 0.65], k: 50, c: 7, stiff: 1.6, wind: 0.6, grav: 0.1 });
}

// ---------------------------------------------------------------------------
// EMBER — red panda
// ---------------------------------------------------------------------------
function buildEmber(r) {
  const J = r.j, d = r.d, R = d.headR, b = r.bucket;
  r.ell(J.hips, 'fur2', [0, 0.03, -0.005], [0.11, 0.092, 0.1]);
  r.ell(J.chest, 'fur', [0, -0.02, 0], [0.122, 0.148, 0.108]);
  r.ell(J.chest, 'fur2', [0, -0.06, 0.05], [0.072, 0.082, 0.062]);
  // head: round & wide
  r.ell(J.headC, 'fur', [0, 0, 0], [R * 1.07, R * 0.92, R * 0.95], null, { name: 'head' });
  const face = r.merged('faceMarks', () => {
    const s = gSphere(b);
    return [
      [s, M([0, -0.08, 0.16], [0.1, 0.07, 0.085])],
      [s, M([0.135, -0.06, 0.14], [0.08, 0.065, 0.06], [0, 0.5, 0.3])],
      [s, M([-0.135, -0.06, 0.14], [0.08, 0.065, 0.06], [0, -0.5, -0.3])],
      [s, M([0.085, 0.135, 0.18], [0.034, 0.022, 0.02], [-0.6, 0.3, 0.2])],
      [s, M([-0.085, 0.135, 0.18], [0.034, 0.022, 0.02], [-0.6, -0.3, -0.2])],
    ];
  });
  r.mesh(J.headC, face, 'belly', null, null, null, { name: 'faceMarks' });
  // tear marks (dark)
  const tears = r.merged('tears', () => {
    const parts = [];
    for (const sg of [1, -1]) {
      const n = new THREE.Vector3(sg * 0.42, -0.25, 0.87).normalize();
      const p0 = n.clone().multiplyScalar(R * 0.97);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      const e = new THREE.Euler().setFromQuaternion(q);
      const m = M([p0.x, p0.y, p0.z], [0.016, 0.04, 0.012], [e.x, e.y, e.z]);
      m.multiply(new THREE.Matrix4().makeRotationZ(-sg * 0.35));
      parts.push([gSphere(b), m]);
    }
    return parts;
  });
  r.mesh(J.headC, tears, 'fur', null, null, null, { name: 'tears', detail: true });
  r.ell(J.headC, 'nose', [0, -0.05, 0.243], [0.03, 0.021, 0.02]);
  r.face({
    eyeX: 0.09, eyeY: 0.025, eyeZ: 0.18, eyeR: [0.068, 0.085, 0.052], eyeYaw: 0.3,
    iris: 0.64, pupil: [0.32, 0.36],
    brow: { x: 0.088, y: 0.128, z: 0.2, len: 0.055, t: 0.009, role: 'fur2', pitch: -0.45, yaw: 0.32 },
    mouthY: -0.11, mouthZ: 0.235, mouthW: 0.058, mouthH: 0.012, mouthT: 0.0055, mouthPitch: 0.2,
  });
  // rounded ears with cream inner
  for (const sx of ['_l', '_r']) {
    const sg = sx === '_l' ? 1 : -1;
    const joints = earChain(r, sx, { pos: [0.16, 0.14, -0.03], rot: [-0.1, 0.22, -0.55], len: 0.12, w: 0.07, segs: 1, role: 'fur', inner: 'belly', flat: 0.4, shape: 0.6, taper: 0.45 });
    r.addChain(joints, { k: 130, c: 13, stiff: 2.0, wind: 0.45, grav: 0.15, inertia: 0.008, maxBend: 0.7, dyn: earDyn(sg, 0.6), sweep: 0.4, kind: 'ear' });
  }
  // headband
  r.mesh(J.headC, gBand('emberBand', b, [0, 0, 0], [R * 1.07, R * 0.92, R * 0.95], 0.42, 0.095, 0.016), 'accent', null, null, null, { name: 'headband' });
  // limbs: dark brown
  standardLimbs(r, { upper: [0.04, 0.035, 'fur2'], fore: [0.035, 0.031, 'fur2'], thigh: [0.058, 0.045, 'fur2'], shin: [0.045, 0.034, 'fur2'] });
  simpleHands(r, 'fur2', 0.04);
  sneakers(r, { len: 0.115, w: 0.064, stripe: true });
  // ringed bushy tail
  const n = 6, segs = [];
  const rr = [0.06, 0.078, 0.085, 0.082, 0.072, 0.052];
  for (let i = 0; i < n; i++) {
    const len = 0.1;
    segs.push({ len, role: i % 2 ? 'belly' : 'fur', geo: gSphere(b), scl: [rr[i], len * 0.82, rr[i]] });
  }
  const tj = tailChain(r, { pos: [0, 0.03, -0.09], rest: -HP + 0.2, segs, curl: [0, 0.1, 0.12, 0.14, 0.16, 0.2], k: 55, c: 8, stiff: 1.6, wind: 0.6, grav: 0.1 });
  tj.forEach((j, i) => { const m = j.children.find((c) => c.isMesh); if (m) m.position.y = segs[i].len * 0.5; });
}

// ---------------------------------------------------------------------------
// public factory
// ---------------------------------------------------------------------------
export function createRig(charId, options = {}) {
  return new Rig(charId, options || {});
}

export function disposeCharacterCache() {
  for (const g of GEO.values()) g.dispose();
  GEO.clear();
  MOUTH_CACHE.clear();
  FACE_CACHE.clear();
  for (const t of TEX.values()) t.dispose();
  TEX.clear();
}

export const CHARACTER_STATES = STATES;
export const CHARACTER_EXPRESSIONS = Object.keys(EXPR);
