import * as THREE from 'three';
import { canvasTexture, mergeByMaterial, mergeDirect, sliceGeometry, concatGeometries, pick, fa } from './util.js';

/* =========================================================
   Shared materials
   ========================================================= */
const std = (o) => new THREE.MeshStandardMaterial(o);
let M = null;
export function sharedMats() {
  if (M) return M;
  M = {
    trim: std({ color: 0x18191c, roughness: 0.55, name: 'trim' }),
    plastic: std({ color: 0x2b2d31, roughness: 0.8, name: 'plastic' }),
    dash: std({ color: 0x24252a, roughness: 0.85, name: 'dash' }),
    interior: std({ color: 0x4a4440, roughness: 0.9, name: 'interior' }),
    seat: std({ color: 0x2c2724, roughness: 0.95, name: 'seat' }),
    seatStripe: std({ color: 0x8a7a62, roughness: 0.95, name: 'seat2' }),
    headliner: std({ color: 0xc9c2b4, roughness: 0.95, name: 'headliner' }),
    carpet: std({ color: 0x1f1f22, roughness: 1, name: 'carpet' }),
    chrome: std({ color: 0xeeeeee, metalness: 1, roughness: 0.12, name: 'chrome' }),
    tire: std({ color: 0x141414, roughness: 0.92, name: 'tire' }),
    rim: std({ color: 0xc4c8ce, metalness: 0.85, roughness: 0.28, name: 'rim' }),
    glassDark: std({ color: 0x1a2430, metalness: 0.7, roughness: 0.08, name: 'glassDark' }),
    lampOff: std({ color: 0xdde4ea, metalness: 0.6, roughness: 0.15, emissive: 0xfff3d6, emissiveIntensity: 0.15, name: 'lamp' }),
    tailOff: std({ color: 0x6a0808, roughness: 0.3, emissive: 0xff1010, emissiveIntensity: 0.25, name: 'tail' }),
    indicator: std({ color: 0xff9a20, roughness: 0.3, emissive: 0xff8a00, emissiveIntensity: 0.15, name: 'ind' }),
    rubber: std({ color: 0x0c0c0c, roughness: 0.9, name: 'rubber' }),
    mirror: std({ color: 0xaab4bf, metalness: 1, roughness: 0.02, name: 'mirror' }),
  };
  M.glass = new THREE.MeshPhysicalMaterial({
    color: 0x9fb4c4,
    metalness: 0.1,
    roughness: 0.04,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.6,
    name: 'glass',
  });
  M.plate = new THREE.MeshStandardMaterial({ map: plateTexture(), roughness: 0.5, name: 'plate' });
  M.checker = new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.4, name: 'checker' });
  M.policeStripe = new THREE.MeshStandardMaterial({ map: policeTexture(), roughness: 0.4, name: 'pstripe' });
  return M;
}
const paintCache = new Map();
export function paintMat(hex, physical = false) {
  const k = hex + (physical ? 'p' : '');
  if (paintCache.has(k)) return paintCache.get(k);
  const m = physical
    ? new THREE.MeshPhysicalMaterial({ color: hex, metalness: 0.35, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06, name: 'paint' })
    : std({ color: hex, metalness: 0.45, roughness: 0.38, name: 'paint' });
  paintCache.set(k, m);
  return m;
}

function plateTexture() {
  return canvasTexture(256, 56, (g, w, h) => {
    g.fillStyle = '#f4f4f0';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1946a8';
    g.fillRect(0, 0, 34, h);
    g.fillStyle = '#fff';
    g.font = 'bold 13px sans-serif';
    g.fillText('I.R.', 5, 44);
    g.fillStyle = '#c8a000';
    g.fillRect(4, 6, 26, 14);
    g.strokeStyle = '#111';
    g.lineWidth = 3;
    g.strokeRect(2, 2, w - 4, h - 4);
    g.fillStyle = '#111';
    g.font = 'bold 34px Vazirmatn, Tahoma, sans-serif';
    g.textAlign = 'center';
    g.fillText('۱۲ ت ۳۴۵', 130, 42);
    g.fillRect(200, 6, 2, h - 12);
    g.font = 'bold 26px Vazirmatn, Tahoma, sans-serif';
    g.fillText('۶۷', 228, 42);
  });
}
function checkerTexture() {
  const t = canvasTexture(128, 32, (g, w, h) => {
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? '#111' : '#f5f5f5';
        g.fillRect(i * 16, j * 16, 16, 16);
      }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
function policeTexture() {
  return canvasTexture(512, 64, (g, w, h) => {
    g.fillStyle = '#0f6b3a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 4, w, 4);
    g.fillRect(0, h - 8, w, 4);
    g.font = 'bold 40px Vazirmatn, Tahoma, sans-serif';
    g.textAlign = 'center';
    g.fillText('پلیس ۱۱۰', w / 2, 46);
  });
}
function signTexture(text, bg, fg) {
  return canvasTexture(256, 80, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, bg);
    gr.addColorStop(1, '#222');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = 'bold 44px Vazirmatn, Tahoma, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

/* =========================================================
   helpers
   ========================================================= */
const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
export function box(w, h, d, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), mat);
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}
export function cyl(rt, rb, h, mat, seg = 16, parent) {
  const m = new THREE.Mesh(cached(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat);
  if (parent) parent.add(m);
  return m;
}
export function sphere(r, mat, ws = 16, hs = 12, parent) {
  const m = new THREE.Mesh(cached(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs)), mat);
  if (parent) parent.add(m);
  return m;
}
const _up = new THREE.Vector3(0, 1, 0);
/** box stretched between two points (thickness a along local x, b along local z) */
export function beam(p1, p2, a, b, mat, parent) {
  const d = new THREE.Vector3().subVectors(p2, p1);
  const len = d.length();
  const m = new THREE.Mesh(new THREE.BoxGeometry(a, len, b), mat);
  m.position.copy(p1).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(_up, d.normalize());
  if (parent) parent.add(m);
  return m;
}
export function quad(a, b, c, d, mat, parent) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  if (parent) parent.add(m);
  return m;
}

/* =========================================================
   CAR
   Local frame: +Z forward, +Y up, +X = car's LEFT (driver side).
   ========================================================= */
const PROFILES = {
  sedan: {
    len: 4.5, W: 0.88, belt: 0.97, roof: 1.46, wsZ: 0.9, roofF: 0.12, roofR: -0.95, rwZ: -1.5, wheelZ: 1.38,
    top: [[-2.25, 0.6], [-2.23, 0.8], [-2.12, 0.93], [-1.9, 0.97], [0.9, 0.97], [1.5, 0.9], [2.08, 0.83], [2.2, 0.76], [2.25, 0.6]],
  },
  hatch: {
    len: 4.0, W: 0.86, belt: 0.98, roof: 1.5, wsZ: 0.85, roofF: 0.1, roofR: -1.55, rwZ: -1.95, wheelZ: 1.28,
    top: [[-2.0, 0.6], [-1.99, 0.85], [-1.95, 0.98], [0.85, 0.98], [1.4, 0.9], [1.88, 0.84], [1.98, 0.76], [2.0, 0.6]],
  },
  van: {
    len: 4.8, W: 0.95, belt: 1.15, roof: 2.0, wsZ: 1.55, roofF: 1.15, roofR: -2.3, rwZ: -2.38, wheelZ: 1.55,
    top: [[-2.4, 0.6], [-2.39, 1.15], [1.55, 1.15], [2.2, 1.0], [2.38, 0.85], [2.4, 0.6]],
  },
};
function interp(pts, z) {
  if (z <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (z <= pts[i][0]) {
      const [z0, y0] = pts[i - 1], [z1, y1] = pts[i];
      return y0 + ((y1 - y0) * (z - z0)) / (z1 - z0 || 1);
    }
  }
  return pts[pts.length - 1][1];
}
function profileShape(z0, z1, topFn, botFn) {
  const s = new THREE.Shape();
  const n = Math.max(2, Math.ceil((z1 - z0) / 0.04));
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    if (i === 0) s.moveTo(z, topFn(z));
    else s.lineTo(z, topFn(z));
  }
  for (let i = n; i >= 0; i--) {
    const z = z0 + ((z1 - z0) * i) / n;
    s.lineTo(z, botFn(z));
  }
  return s;
}
function extrudeX(shape, xFrom, xTo, bevel = 0) {
  const depth = Math.max(0.002, xTo - xFrom - 2 * bevel);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geo.rotateY(-Math.PI / 2);
  geo.translate(xTo - bevel, 0, 0);
  return geo;
}

function dialTexture(kind) {
  return canvasTexture(256, 256, (g, w) => {
    const c = w / 2;
    const gr = g.createRadialGradient(c, c, 10, c, c, c);
    gr.addColorStop(0, '#1d2128');
    gr.addColorStop(1, '#07080a');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(c, c, c - 2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#9aa';
    g.lineWidth = 4;
    g.stroke();
    const max = kind === 'speed' ? 280 : 8;
    const step = kind === 'speed' ? 20 : 1;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let v = 0; v <= max; v += step / 2) {
      const a = -Math.PI * 1.25 + (v / max) * Math.PI * 1.5;
      const major = v % step === 0;
      const r1 = c - 14, r2 = major ? c - 34 : c - 24;
      g.strokeStyle = kind === 'rpm' && v >= 6.5 ? '#ff4040' : '#e8f0f0';
      g.lineWidth = major ? 4 : 2;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
      g.lineTo(c + Math.cos(a) * r2, c + Math.sin(a) * r2);
      g.stroke();
      if (major) {
        g.fillStyle = '#fff';
        g.font = 'bold 20px sans-serif';
        g.fillText(String(v), c + Math.cos(a) * (c - 54), c + Math.sin(a) * (c - 54));
      }
    }
    g.fillStyle = '#8fd';
    g.font = 'bold 18px sans-serif';
    g.fillText(kind === 'speed' ? 'km/h' : 'x1000 rpm', c, c + 60);
  });
}
function gearKnobTexture() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#111';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#ddd';
    g.lineWidth = 5;
    g.beginPath();
    const xs = [19, 49, 79, 109];
    for (const x of xs) { g.moveTo(x, 30); g.lineTo(x, 98); }
    g.moveTo(19, 64); g.lineTo(109, 64);
    g.stroke();
    g.fillStyle = '#fff';
    g.font = 'bold 18px sans-serif';
    g.textAlign = 'center';
    ['1', '3', '5', '7'].forEach((t, i) => g.fillText(t, xs[i], 20));
    ['2', '4', '6', 'R'].forEach((t, i) => g.fillText(t, xs[i], 120));
  });
}

/**
 * Builds a car.
 * opts: { type:'taxi'|'sedan'|'hatch'|'van'|'police', color, interior:bool }
 */
export function buildCar(opts = {}) {
  const mats = sharedMats();
  const type = opts.type || 'sedan';
  const pname = type === 'taxi' || type === 'police' ? 'sedan' : type;
  const P = PROFILES[pname];
  const interior = !!opts.interior;
  const paint = opts.paintMat || paintMat(opts.color ?? 0xf2c40d, interior);
  const glass = interior ? mats.glass : mats.glassDark;
  const lamp = opts.lampMat || mats.lampOff;
  const tail = opts.tailMat || mats.tailOff;
  const half = P.len / 2;
  const W = P.W;
  const archR = 0.43, axleY = 0.33;
  const topFn = (z) => interp(P.top, z);
  const botFn = (z) => {
    let y = interp([[-half, 0.44], [-half + 0.17, 0.3], [half - 0.17, 0.3], [half, 0.44]], z);
    for (const wz of [P.wheelZ, -P.wheelZ]) {
      const dz = z - wz;
      if (Math.abs(dz) < archR) y = Math.max(y, axleY + Math.sqrt(archR * archR - dz * dz));
    }
    return y;
  };

  const root = new THREE.Group();
  root.name = 'car';
  const body = new THREE.Group();
  root.add(body);

  // --- solid front & rear blocks
  const front = new THREE.Mesh(extrudeX(profileShape(P.wsZ, half, topFn, botFn), -W, W, 0.035), paint);
  body.add(front);
  const rear = new THREE.Mesh(extrudeX(profileShape(-half, P.rwZ, topFn, botFn), -W, W, 0.035), paint);
  body.add(rear);

  // --- side panels (doors are separate groups)
  const sideT = 0.05;
  const doors = {};
  const doorDefs = pname === 'van'
    ? [['fl', P.wsZ, 0.55, 1], ['fr', P.wsZ, 0.55, -1]]
    : [['fl', P.wsZ, -0.2, 1], ['fr', P.wsZ, -0.2, -1], ['rl', -0.2, -1.0, 1], ['rr', -0.2, -1.0, -1]];
  const panelSpans = pname === 'van'
    ? [[P.rwZ, 0.55]]
    : [[P.rwZ, -1.0]];
  const winTop = P.roof - 0.03;
  // A pillar line (z at height y)
  const aZ = (y) => P.wsZ + ((P.roofF - P.wsZ) * (y - P.belt)) / (P.roof - P.belt);
  const cZ = (y) => P.rwZ + ((P.roofR - P.rwZ) * (y - P.belt)) / (P.roof - P.belt);

  const sideBand = (zA, zB, side, parent) => {
    if (type !== 'taxi' && type !== 'police') return;
    const len = zA - zB;
    const g = new THREE.PlaneGeometry(len, type === 'police' ? 0.2 : 0.1);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len * (type === 'police' ? 0.25 : 1.6));
    const m = new THREE.Mesh(g, type === 'police' ? mats.policeStripe : mats.checker);
    m.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    m.position.set(side * (W + 0.006), type === 'police' ? 0.66 : 0.72, (zA + zB) / 2);
    if (side < 0) m.scale.x = 1;
    parent.add(m);
  };

  for (const [z0, z1] of panelSpans) {
    for (const side of [1, -1]) {
      const g = extrudeX(profileShape(z0, z1, topFn, botFn), side > 0 ? W - sideT : -W, side > 0 ? W : -W + sideT);
      body.add(new THREE.Mesh(g, paint));
      sideBand(z1, z0, side, body);
      if (interior) {
        const tg = extrudeX(profileShape(z0, z1, (z) => topFn(z) - 0.06, (z) => botFn(z) + 0.02), side > 0 ? W - sideT - 0.03 : -W + sideT, side > 0 ? W - sideT : -W + sideT + 0.03);
        body.add(new THREE.Mesh(tg, mats.interior));
      }
    }
  }

  for (const [key, zF, zB, side] of doorDefs) {
    const pivot = new THREE.Group();
    const hx = side * W;
    pivot.position.set(hx, 0, zF);
    const inner = new THREE.Group();
    inner.position.set(-hx, 0, -zF);
    pivot.add(inner);
    root.add(pivot);
    const xo = side > 0 ? W : -W + sideT;
    const xi = side > 0 ? W - sideT : -W;
    inner.add(new THREE.Mesh(extrudeX(profileShape(zB, zF - 0.012, topFn, botFn), Math.min(xo, xi), Math.max(xo, xi)), paint));
    sideBand(zF - 0.012, zB, side, inner);
    // seam shadow line
    box(0.01, P.belt - 0.33, 0.012, mats.trim, side * (W + 0.002), (P.belt + 0.33) / 2, zB, inner);
    // handle
    box(0.03, 0.035, 0.16, mats.chrome, side * (W + 0.012), P.belt - 0.12, zB + 0.18, inner);
    // window glass (frameless)
    const gz0 = Math.min(zF, aZ(P.belt)) - 0.04;
    const pts = key[0] === 'f'
      ? [[gz0, P.belt], [aZ(winTop) - 0.04, winTop], [zB + 0.03, winTop], [zB + 0.03, P.belt]]
      : [[zF - 0.03, P.belt], [zF - 0.03, winTop], [Math.max(zB, cZ(winTop)) + 0.03, winTop], [zB + 0.04, P.belt]];
    const gx = side * (W - 0.035);
    const gq = quad([gx, pts[0][1], pts[0][0]], [gx, pts[1][1], pts[1][0]], [gx, pts[2][1], pts[2][0]], [gx, pts[3][1], pts[3][0]], glass, inner);
    gq.renderOrder = 5;
    // window bottom rubber strip
    box(0.05, 0.025, Math.abs(zF - zB) - 0.04, mats.rubber, side * (W - 0.02), P.belt + 0.005, (zF + zB) / 2, inner);
    if (interior) {
      const it = extrudeX(profileShape(zB + 0.02, zF - 0.03, (z) => P.belt - 0.02, () => 0.36), side > 0 ? W - sideT - 0.035 : -W + sideT, side > 0 ? W - sideT : -W + sideT + 0.035);
      inner.add(new THREE.Mesh(it, mats.interior));
      box(0.07, 0.04, Math.abs(zF - zB) * 0.55, mats.plastic, side * (W - sideT - 0.06), 0.7, (zF + zB) / 2, inner); // armrest
      box(0.02, 0.03, 0.1, mats.chrome, side * (W - sideT - 0.04), 0.82, zF - 0.25, inner); // inner handle
      box(0.03, 0.25, Math.abs(zF - zB) * 0.7, mats.seatStripe, side * (W - sideT - 0.04), 0.55, (zF + zB) / 2 - 0.05, inner);
    }
    if (key[0] === 'f') {
      // side mirror on front doors
      const mg = new THREE.Group();
      mg.position.set(side * (W + 0.1), P.belt + 0.08, zF - 0.12);
      box(0.18, 0.12, 0.08, paint, 0, 0, 0, mg);
      box(0.15, 0.09, 0.01, mats.mirror, 0, 0, -0.045, mg);
      box(0.08, 0.03, 0.04, mats.trim, -side * 0.1, -0.03, 0.01, mg);
      inner.add(mg);
    }
    doors[key] = { pivot, side, open: 0, target: 0 };
  }

  // --- pillars, roof, glass
  const gA = interior ? mats.trim : paint;
  for (const side of [1, -1]) {
    const x = side * (W - 0.04);
    beam(new THREE.Vector3(x, P.belt, P.wsZ - 0.01), new THREE.Vector3(side * (W - 0.08), P.roof, P.roofF), 0.07, 0.11, paint, body);
    if (interior) beam(new THREE.Vector3(side * (W - 0.075), P.belt, P.wsZ - 0.04), new THREE.Vector3(side * (W - 0.11), P.roof - 0.02, P.roofF - 0.01), 0.035, 0.065, mats.plastic, body);
    if (pname !== 'van') box(0.07, P.roof - P.belt, 0.11, mats.trim, side * (W - 0.045), (P.roof + P.belt) / 2, -0.2, body); // B
    // C pillar panel
    const cs = new THREE.Shape();
    cs.moveTo(P.rwZ, P.belt);
    cs.lineTo(cZ(P.belt) - 0.02, P.belt);
    if (pname === 'van') {
      cs.lineTo(P.roofR, P.roof);
      cs.lineTo(P.roofR - 0.08, P.roof);
    } else {
      cs.lineTo(P.roofR - 0.05, P.roof);
      cs.lineTo(P.roofR - 0.2, P.roof);
    }
    cs.lineTo(P.rwZ, P.belt);
    // C pillar: panel from rear door to rear glass
    const c2 = new THREE.Shape();
    const zDoorEnd = pname === 'van' ? 0.55 : -1.0;
    c2.moveTo(zDoorEnd, P.belt);
    c2.lineTo(cZ(winTop) + 0.0, winTop + 0.03);
    c2.lineTo(P.roofR - 0.02, P.roof);
    c2.lineTo(P.rwZ + 0.02, P.belt);
    if (pname === 'van') {
      // van: big side panel (no rear windows)
      const vs = new THREE.Shape();
      vs.moveTo(0.55, P.belt); vs.lineTo(0.55, P.roof); vs.lineTo(P.roofR, P.roof); vs.lineTo(P.rwZ, P.belt);
      body.add(new THREE.Mesh(extrudeX(vs, side > 0 ? W - sideT : -W, side > 0 ? W : -W + sideT), paint));
    } else {
      body.add(new THREE.Mesh(extrudeX(c2, side > 0 ? W - sideT : -W, side > 0 ? W : -W + sideT), paint));
      if (interior) body.add(new THREE.Mesh(extrudeX(c2, side > 0 ? W - sideT - 0.02 : -W + sideT, side > 0 ? W - sideT : -W + sideT + 0.02), mats.headliner));
    }
    void cs; void gA;
  }
  // roof
  const roofLen = P.roofF - P.roofR + 0.04;
  const roof = new THREE.Mesh(
    cached(`roof${pname}`, () => new THREE.BoxGeometry(2 * W - 0.1, 0.06, roofLen)),
    [paint, paint, paint, interior ? mats.headliner : paint, paint, paint]
  );
  roof.position.set(0, P.roof + 0.02, (P.roofF + P.roofR) / 2);
  body.add(roof);
  for (const side of [1, -1]) box(0.06, 0.05, roofLen, paint, side * (W - 0.06), P.roof, (P.roofF + P.roofR) / 2, body);
  // windshield + rear glass
  const ws = quad([W - 0.06, P.belt + 0.005, P.wsZ], [-(W - 0.06), P.belt + 0.005, P.wsZ], [-(W - 0.1), P.roof - 0.005, P.roofF], [W - 0.1, P.roof - 0.005, P.roofF], glass, body);
  ws.renderOrder = 5;
  const rw = quad([W - 0.06, P.belt + 0.005, P.rwZ], [-(W - 0.06), P.belt + 0.005, P.rwZ], [-(W - 0.1), P.roof - 0.005, P.roofR], [W - 0.1, P.roof - 0.005, P.roofR], pname === 'van' ? paint : glass, body);
  rw.renderOrder = 5;
  // wipers (animated on the player's car)
  const wipers = [];
  const wsDir = new THREE.Vector3(0, P.roof - P.belt, P.roofF - P.wsZ).normalize();
  const wsN = new THREE.Vector3(1, 0, 0).cross(wsDir).normalize();
  for (const x of [0.66, 0.02]) {
    const pv = new THREE.Group();
    pv.position.set(x, P.belt + 0.035, P.wsZ - 0.045);
    const arm = new THREE.Group();
    pv.add(arm);
    box(0.6, 0.014, 0.022, mats.trim, -0.3, 0, 0, arm);
    box(0.56, 0.02, 0.012, mats.rubber, -0.3, -0.012, 0.004, arm);
    if (interior) {
      pv.userData.noMerge = true;
      root.add(pv);
    } else body.add(pv);
    wipers.push(arm);
  }

  // --- face details
  const fz = half;
  for (const side of [1, -1]) {
    const hl = box(0.34, 0.11, 0.08, lamp, side * (W - 0.27), topFn(fz - 0.1) - 0.1, fz - 0.03, body);
    hl.userData.lamp = true;
    box(0.36, 0.13, 0.06, mats.chrome, side * (W - 0.27), topFn(fz - 0.1) - 0.1, fz - 0.06, body);
    box(0.1, 0.05, 0.05, mats.indicator, side * (W - 0.05), topFn(fz - 0.1) - 0.14, fz - 0.06, body);
    const tl = box(0.32, 0.12, 0.06, tail, side * (W - 0.24), topFn(-half + 0.1) - 0.12, -half + 0.02, body);
    tl.userData.tail = true;
  }
  box(0.62, 0.14, 0.05, mats.trim, 0, topFn(fz - 0.1) - 0.13, fz, body); // grille
  for (let i = 0; i < 3; i++) box(0.6, 0.012, 0.02, mats.chrome, 0, topFn(fz - 0.1) - 0.08 - i * 0.045, fz + 0.02, body);
  box(2 * W + 0.02, 0.16, 0.14, mats.plastic, 0, 0.4, half - 0.02, body); // bumper F
  box(2 * W + 0.02, 0.16, 0.14, mats.plastic, 0, 0.42, -half + 0.03, body); // bumper R
  const pf = new THREE.Mesh(cached('plate', () => new THREE.PlaneGeometry(0.52, 0.115)), mats.plate);
  pf.position.set(0, 0.42, half + 0.055);
  body.add(pf);
  const pr = pf.clone();
  pr.position.set(0, 0.52, -half - 0.03);
  pr.rotation.y = Math.PI;
  body.add(pr);
  const ex = cyl(0.035, 0.035, 0.2, mats.chrome, 10, body);
  ex.rotation.x = Math.PI / 2;
  ex.position.set(-0.5, 0.3, -half - 0.02);

  // --- wheels
  const wheels = [];
  const tireG = cached('tire', () => {
    const g = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 26);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const rimG = cached('rim', () => {
    const g = new THREE.CylinderGeometry(0.21, 0.21, 0.235, 18);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  for (const [wz, front] of [[P.wheelZ, true], [-P.wheelZ, false]]) {
    for (const side of [1, -1]) {
      const steer = new THREE.Group();
      steer.position.set(side * (W - 0.12), axleY, wz);
      const spin = new THREE.Group();
      steer.add(spin);
      spin.add(new THREE.Mesh(tireG, mats.tire));
      spin.add(new THREE.Mesh(rimG, mats.rim));
      for (let i = 0; i < 5; i++) {
        const sp = box(0.02, 0.36, 0.05, mats.chrome, side * 0.12, 0, 0, spin);
        sp.rotation.x = (i / 5) * Math.PI;
      }
      const hub = cyl(0.06, 0.06, 0.25, mats.chrome, 10, spin);
      hub.rotation.z = Math.PI / 2;
      mergeDirect(spin);
      root.add(steer);
      if (interior || opts.dynamicWheels) steer.userData.noMerge = true;
      wheels.push({ steer, spin, front, side });
    }
  }

  const out = { root, body, wheels, doors, P, type, paint, wipers, wsN };

  // --- type specific roof equipment
  if (type === 'taxi') {
    const sg = new THREE.Group();
    sg.position.set(0, P.roof + 0.16, (P.roofF + P.roofR) / 2 - 0.1);
    const signMat = new THREE.MeshStandardMaterial({ map: signTexture('تاکسی', '#ffd21a', '#111'), emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0.0, roughness: 0.4 });
    const signMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.17, 0.22), [mats.plastic, mats.plastic, mats.plastic, mats.plastic, signMat, signMat]);
    sg.add(signMesh);
    box(0.62, 0.03, 0.24, mats.trim, 0, -0.1, 0, sg);
    sg.userData.noMerge = true;
    root.add(sg);
    out.roofSign = signMat;
  }
  if (type === 'police') {
    const lb = new THREE.Group();
    lb.position.set(0, P.roof + 0.1, (P.roofF + P.roofR) / 2);
    box(1.1, 0.06, 0.26, mats.trim, 0, -0.04, 0, lb);
    const red = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff0000, emissiveIntensity: 0.3 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x000055, emissive: 0x0040ff, emissiveIntensity: 0.3 });
    box(0.5, 0.11, 0.22, red, 0.28, 0.04, 0, lb);
    box(0.5, 0.11, 0.22, blue, -0.28, 0.04, 0, lb);
    lb.userData.noMerge = true;
    root.add(lb);
    out.sirenMats = [red, blue];
    const hood = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), mats.policeStripe);
    hood.rotation.x = -Math.PI / 2 + 0.12;
    hood.position.set(0, topFn(1.6) + 0.035, 1.6);
    hood.rotation.z = Math.PI;
    body.add(hood);
  }

  if (interior) buildInterior(out, P, mats);
  else {
    // dark cabin silhouette for NPC cars so the glass doesn't look empty
    for (const x of [0.38, -0.38]) box(0.45, 0.55, 0.12, mats.seat, x, 0.8, -0.45, body);
    box(1.5, 0.5, 0.12, mats.seat, 0, 0.78, -1.3, body);
    box(1.7, 0.12, 0.3, mats.dash, 0, 0.9, P.wsZ - 0.25, body);
  }

  if (opts.merge !== false) {
    if (interior) {
      mergeByMaterial(body);
      for (const k in doors) mergeByMaterial(doors[k].pivot.children[0]);
    } else {
      bakeLite(root);
    }
  }
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = !o.material.transparent;
      o.receiveShadow = true;
    }
  });
  return out;
}

const LITE = {};
function liteMats() {
  if (!LITE.body) {
    LITE.body = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.42 });
    LITE.lamp = new THREE.MeshBasicMaterial({ vertexColors: true });
  }
  return LITE;
}
/** NPC cars: bake everything into a few vertex-colored meshes (3-4 draw calls per car) */
function bakeLite(root) {
  const L = liteMats();
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const body = [], glass = [], lamps = [], textured = new Map(), rm = [];
  const col = new THREE.Color();
  const LAMPC = { lamp: new THREE.Color(1, 0.96, 0.82), tail: new THREE.Color(0.9, 0.06, 0.04), ind: new THREE.Color(1, 0.55, 0.05) };
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.noMerge) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const g0 = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(m);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const parts = Array.isArray(o.material) && g0.groups.length ? g0.groups.map((gr) => [sliceGeometry(g0, gr.start, gr.count), mats[gr.materialIndex]]) : [[g0, mats[0]]];
    for (const [g, mat] of parts) {
      if (mat.map) {
        if (!textured.has(mat)) textured.set(mat, []);
        textured.get(mat).push(g);
        continue;
      }
      if (mat.name === 'glass' || mat.name === 'glassDark') {
        glass.push(g);
        continue;
      }
      const lamp = LAMPC[mat.name];
      col.copy(lamp || mat.color);
      const n = g.attributes.position.count;
      const ca = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { ca[i * 3] = col.r; ca[i * 3 + 1] = col.g; ca[i * 3 + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
      (lamp ? lamps : body).push(g);
    }
    rm.push(o);
  });
  for (const o of rm) o.parent.remove(o);
  const add = (list, mat) => {
    if (!list.length) return;
    const mesh = new THREE.Mesh(concatGeometries(list), mat);
    mesh.castShadow = mat === L.body;
    mesh.receiveShadow = true;
    root.add(mesh);
  };
  add(body, L.body);
  add(glass, sharedMats().glassDark);
  add(lamps, L.lamp);
  for (const [mat, list] of textured) add(list, mat);
}

function buildInterior(out, P, mats) {
  const body = out.body;
  const root = out.root;
  const W = P.W;
  // floor & firewall
  box(2 * W - 0.08, 0.06, P.wsZ - P.rwZ, mats.carpet, 0, 0.33, (P.wsZ + P.rwZ) / 2, body);
  box(2 * W - 0.1, 0.62, 0.03, mats.trim, 0, 0.66, P.wsZ - 0.02, body);
  box(2 * W - 0.1, 0.03, 0.22, mats.plastic, 0, P.belt - 0.01, P.rwZ + 0.12, body); // parcel shelf
  box(2 * W - 0.1, 0.62, 0.03, mats.trim, 0, 0.66, P.rwZ + 0.02, body);
  // dashboard
  const dashTop = 0.93;
  box(2 * W - 0.1, 0.26, 0.4, mats.dash, 0, 0.8, P.wsZ - 0.22, body);
  const lip = cyl(0.07, 0.07, 2 * W - 0.12, mats.dash, 14, body);
  lip.rotation.z = Math.PI / 2;
  lip.position.set(0, dashTop - 0.06, P.wsZ - 0.42);
  box(2 * W - 0.14, 0.03, 0.34, mats.plastic, 0, dashTop, P.wsZ - 0.2, body);
  // vents
  for (const x of [0.65, 0.12, -0.12, -0.65]) box(0.14, 0.05, 0.02, mats.trim, x, 0.86, P.wsZ - 0.425, body);
  // glovebox
  box(0.42, 0.14, 0.02, mats.plastic, -0.42, 0.74, P.wsZ - 0.425, body);
  // instrument binnacle
  const dx = 0.38;
  box(0.44, 0.09, 0.16, mats.dash, dx, dashTop + 0.035, P.wsZ - 0.36, body);
  const dialSp = new THREE.MeshBasicMaterial({ map: dialTexture('speed') });
  const dialRp = new THREE.MeshBasicMaterial({ map: dialTexture('rpm') });
  const needles = {};
  for (const [x, mat, key] of [[dx + 0.09, dialSp, 'speed'], [dx - 0.09, dialRp, 'rpm']]) {
    const d = new THREE.Mesh(cached('dial', () => new THREE.CircleGeometry(0.068, 32)), mat);
    d.position.set(x, 0.885, P.wsZ - 0.43);
    d.rotation.y = Math.PI;
    d.rotation.x = 0.12;
    root.add(d);
    const pv = new THREE.Group();
    pv.position.set(x, 0.885, P.wsZ - 0.437);
    pv.rotation.y = Math.PI;
    pv.rotation.x = 0.12;
    const n = box(0.005, 0.058, 0.004, new THREE.MeshBasicMaterial({ color: 0xff3a1a }), 0, 0.026, 0, pv);
    void n;
    sphere(0.009, mats.chrome, 8, 6, pv);
    root.add(pv);
    needles[key] = pv;
  }
  // fuel mini gauge
  const fuelBar = new THREE.Group();
  fuelBar.position.set(dx, 0.84, P.wsZ - 0.437);
  fuelBar.rotation.y = Math.PI;
  box(0.08, 0.014, 0.002, new THREE.MeshBasicMaterial({ color: 0x222222 }), 0, 0, 0, fuelBar);
  const fuelFill = box(0.08, 0.012, 0.003, new THREE.MeshBasicMaterial({ color: 0x38d16a }), 0, 0, -0.001, fuelBar);
  root.add(fuelBar);
  needles.fuel = fuelFill;
  // center screen (navigation map lives here)
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.14), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  screen.position.set(0, 0.88, P.wsZ - 0.432);
  screen.rotation.y = Math.PI;
  screen.rotation.x = 0.15;
  root.add(screen);
  box(0.25, 0.17, 0.02, mats.trim, 0, 0.88, P.wsZ - 0.42, body);
  // center console
  box(0.26, 0.24, 0.95, mats.plastic, 0, 0.48, 0.08, body);
  box(0.24, 0.02, 0.35, mats.trim, 0, 0.6, 0.2, body);
  // steering column + wheel
  const col = cyl(0.04, 0.05, 0.36, mats.trim, 10, body);
  col.position.set(dx, 0.86, 0.52);
  col.rotation.x = Math.PI / 2 + 0.4;
  const wheelMount = new THREE.Group();
  wheelMount.position.set(dx, 0.93, 0.36);
  wheelMount.rotation.x = -0.42;
  const wheel = new THREE.Group();
  wheelMount.add(wheel);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.6 });
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.022, 10, 40), rimMat));
  for (const a of [0, Math.PI, -Math.PI / 2]) {
    const s = box(0.03, 0.17, 0.02, mats.plastic, Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0, wheel);
    s.rotation.z = a - Math.PI / 2;
  }
  const hub = cyl(0.06, 0.07, 0.05, mats.plastic, 18, wheel);
  hub.rotation.x = Math.PI / 2;
  const logo = cyl(0.025, 0.025, 0.052, mats.chrome, 12, wheel);
  logo.rotation.x = Math.PI / 2;
  mergeDirect(wheel);
  root.add(wheelMount);
  // gear lever
  const gearPivot = new THREE.Group();
  gearPivot.position.set(0, 0.61, 0.22);
  const stick = cyl(0.011, 0.014, 0.2, mats.chrome, 8, gearPivot);
  stick.position.y = 0.1;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), new THREE.MeshStandardMaterial({ map: gearKnobTexture(), roughness: 0.4 }));
  knob.position.y = 0.21;
  knob.rotation.y = Math.PI;
  gearPivot.add(knob);
  const knobTip = new THREE.Object3D();
  knobTip.position.y = 0.215;
  gearPivot.add(knobTip);
  root.add(gearPivot);
  const boot = cyl(0.02, 0.07, 0.08, mats.rubber, 12, body);
  boot.position.set(0, 0.63, 0.22);
  // handbrake
  const hb = new THREE.Group();
  hb.position.set(0, 0.62, -0.12);
  const hbl = box(0.04, 0.03, 0.26, mats.trim, 0, 0.0, -0.13, hb);
  void hbl;
  hb.rotation.x = 0.15;
  root.add(hb);
  // pedals
  const pedals = {};
  for (const [k, x] of [['clutch', dx + 0.13], ['brake', dx - 0.01], ['gas', dx - 0.14]]) {
    const pv = new THREE.Group();
    pv.position.set(x, 0.62, 0.66);
    const arm = box(0.02, 0.22, 0.02, mats.trim, 0, -0.11, 0, pv);
    void arm;
    box(k === 'brake' ? 0.08 : 0.06, 0.06, 0.012, mats.rubber, 0, -0.22, -0.01, pv);
    pv.rotation.x = 0.35;
    mergeDirect(pv);
    root.add(pv);
    pedals[k] = pv;
  }
  // seats
  const seat = (x, z, w) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    box(w, 0.13, 0.52, mats.seat, 0, 0.42, 0, g);
    box(w * 0.6, 0.135, 0.5, mats.seatStripe, 0, 0.425, 0, g);
    const back = new THREE.Group();
    back.position.set(0, 0.46, -0.25);
    back.rotation.x = -0.2;
    box(w, 0.62, 0.13, mats.seat, 0, 0.3, 0, back);
    box(w * 0.6, 0.5, 0.135, mats.seatStripe, 0, 0.3, 0.005, back);
    box(w * 0.5, 0.18, 0.11, mats.seat, 0, 0.72, -0.01, back);
    g.add(back);
    return g;
  };
  body.add(seat(dx, -0.12, 0.5));
  body.add(seat(-dx, -0.12, 0.5));
  const rb = seat(0, -1.05, 1.5);
  body.add(rb);
  // headliner details
  const rv = new THREE.Group();
  rv.position.set(0, P.roof - 0.1, P.roofF - 0.1);
  box(0.24, 0.07, 0.025, mats.trim, 0, 0, 0, rv);
  box(0.22, 0.055, 0.01, mats.mirror, 0, 0, -0.015, rv);
  box(0.02, 0.06, 0.02, mats.trim, 0, 0.05, 0.01, rv);
  body.add(rv);
  for (const x of [dx, -dx]) {
    const sv = box(0.36, 0.015, 0.16, mats.headliner, x, P.roof - 0.04, P.roofF - 0.06, body);
    sv.rotation.x = 0.1;
  }
  box(0.14, 0.02, 0.08, new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffee, emissiveIntensity: 0.1 }), 0, P.roof - 0.03, -0.4, body);
  // taxi meter on dash
  const meterMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const meter = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.035), meterMat);
  meter.position.set(-0.22, dashTop + 0.038, P.wsZ - 0.205);
  meter.rotation.y = Math.PI;
  meter.rotation.x = -0.3;
  root.add(meter);
  box(0.12, 0.05, 0.05, mats.trim, -0.22, dashTop + 0.025, P.wsZ - 0.18, body);

  out.steering = wheel;
  out.wheelMount = wheelMount;
  out.gearPivot = gearPivot;
  out.knobTip = knobTip;
  out.needles = needles;
  out.pedals = pedals;
  out.screen = screen;
  out.meter = meter;
  out.handbrake = hb;
  out.seats = {
    driver: new THREE.Vector3(dx, 0.53, -0.04),
    front: new THREE.Vector3(-dx, 0.53, -0.04),
    rearR: new THREE.Vector3(-0.4, 0.53, -1.0),
    rearL: new THREE.Vector3(0.4, 0.53, -1.0),
  };
  out.eye = new THREE.Vector3(dx, 1.235, 0.0);
  [gearPivot, hb, wheelMount, screen, meter].forEach((o) => (o.userData.noMerge = true));
  for (const k in needles) needles[k].userData.noMerge = true;
  for (const k in pedals) pedals[k].userData.noMerge = true;
  fuelBar.userData.noMerge = true;
}

/* =========================================================
   PEOPLE
   ========================================================= */
const SKIN = [0xf1c8a8, 0xe0ac86, 0xc98f68, 0xa8714f, 0xf5d2b8];
const SHIRT = [0x2e5c8a, 0x8a2e2e, 0x2e8a5a, 0x555555, 0xe0e0e0, 0x6b4a8a, 0xc27a2e, 0x1f2a44, 0x7a8a3a];
const PANTS = [0x1f2433, 0x2b2b2b, 0x4a3a2a, 0x3a4a5a, 0x222222];
const HAIR = [0x1a1210, 0x2b1d14, 0x4a3020, 0x111111, 0x6a5a4a];
const SCARF = [0x1a1a1a, 0x8a1f3a, 0x2e4a8a, 0x5a2e6b, 0xc28a2e, 0x2e6b5a];
const matPool = new Map();
function cmat(hex, rough = 0.85) {
  const k = hex + ':' + rough;
  if (!matPool.has(k)) matPool.set(k, std({ color: hex, roughness: rough }));
  return matPool.get(k);
}
function capsule(r, total, mat) {
  const len = Math.max(0.001, total - 2 * r);
  return new THREE.Mesh(cached(`cap${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 10)), mat);
}

export const ARM = { L1: 0.28, L2: 0.29 };

export function buildPerson(o = {}) {
  const female = o.female ?? Math.random() < 0.45;
  const skin = cmat(o.skin ?? pick(SKIN), 0.7);
  const shirt = cmat(o.shirt ?? pick(SHIRT));
  const pants = cmat(o.pants ?? pick(PANTS));
  const shoes = cmat(0x1a1714, 0.6);
  const hair = cmat(o.hair ?? pick(HAIR), 0.9);
  const dark = cmat(0x111111, 0.4);
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  root.add(hips);
  const pelvis = capsule(0.13, 0.36, pants);
  pelvis.rotation.z = Math.PI / 2;
  pelvis.scale.set(1, 1, 0.8);
  hips.add(pelvis);
  const spine = new THREE.Group();
  spine.position.y = 0.06;
  hips.add(spine);
  const chest = capsule(0.16, 0.56, shirt);
  chest.position.y = 0.26;
  chest.scale.set(1.12, 1, 0.72);
  spine.add(chest);
  if (o.uniform) {
    box(0.36, 0.05, 0.25, cmat(0x222222), 0, -0.02, 0, spine); // belt
    box(0.06, 0.06, 0.01, cmat(0xd4af37, 0.3), 0.08, 0.38, 0.12, spine); // badge
  }
  const neck = cyl(0.05, 0.055, 0.1, skin, 10, spine);
  neck.position.y = 0.55;
  const head = new THREE.Group();
  head.position.y = 0.6;
  spine.add(head);
  const skull = sphere(0.115, skin, 18, 14, head);
  skull.position.y = 0.1;
  skull.scale.set(0.95, 1.1, 1.02);
  for (const s of [1, -1]) {
    const e = sphere(0.016, dark, 8, 6, head);
    e.position.set(s * 0.042, 0.12, 0.1);
    const brow = box(0.04, 0.008, 0.01, hair, s * 0.043, 0.15, 0.108, head);
    void brow;
  }
  const nose = box(0.022, 0.04, 0.03, skin, 0, 0.09, 0.115, head);
  void nose;
  const mouth = box(0.04, 0.008, 0.01, cmat(0x7a3a3a), 0, 0.045, 0.108, head);
  void mouth;
  const headParts = [];
  if (female) {
    const scarfMat = cmat(o.scarf ?? pick(SCARF), 0.95);
    const sc = new THREE.Mesh(
      cached('scarf', () => new THREE.SphereGeometry(0.135, 18, 12, Math.PI * 0.62, Math.PI * 1.76, 0, Math.PI * 0.72)),
      scarfMat
    );
    sc.position.y = 0.11;
    sc.position.z = -0.01;
    head.add(sc);
    const drape = cyl(0.1, 0.19, 0.26, scarfMat, 14, head);
    drape.position.set(0, -0.06, -0.035);
    headParts.push(sc, drape);
  } else {
    const hr = new THREE.Mesh(cached('hair', () => new THREE.SphereGeometry(0.122, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45)), hair);
    hr.position.set(0, 0.115, -0.012);
    hr.rotation.x = -0.25;
    head.add(hr);
    headParts.push(hr);
    if (o.mustache ?? Math.random() < 0.5) box(0.07, 0.016, 0.02, hair, 0, 0.062, 0.112, head);
    if (o.cap) {
      const capM = cmat(o.cap);
      const cp = cyl(0.125, 0.125, 0.07, capM, 16, head);
      cp.position.y = 0.2;
      const brim = box(0.2, 0.012, 0.12, cmat(0x111111), 0, 0.17, 0.12, head);
      void brim;
    }
  }
  const mkArm = (side) => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.2, 0.46, 0);
    spine.add(sh);
    const up = capsule(0.052, 0.3, shirt);
    up.position.y = -0.14;
    sh.add(up);
    const el = new THREE.Group();
    el.position.y = -ARM.L1;
    sh.add(el);
    const fo = capsule(0.044, 0.27, female ? shirt : skin);
    fo.position.y = -0.125;
    el.add(fo);
    const hand = box(0.06, 0.09, 0.035, skin, 0, -0.28, 0, el);
    void hand;
    return { sh, el };
  };
  const mkLeg = (side) => {
    const hp = new THREE.Group();
    hp.position.set(side * 0.09, -0.02, 0);
    hips.add(hp);
    const th = capsule(0.072, 0.46, pants);
    th.position.y = -0.22;
    hp.add(th);
    const kn = new THREE.Group();
    kn.position.y = -0.44;
    hp.add(kn);
    const sh = capsule(0.058, 0.44, pants);
    sh.position.y = -0.21;
    kn.add(sh);
    const ft = box(0.09, 0.06, 0.24, shoes, 0, -0.45, 0.05, kn);
    void ft;
    return { hp, kn };
  };
  const armL = mkArm(1), armR = mkArm(-1);
  const legL = mkLeg(1), legR = mkLeg(-1);
  let skirt = null;
  if (female) {
    skirt = cyl(0.19, 0.25, 0.6, shirt, 16, hips);
    skirt.position.y = -0.25;
  }
  if (skirt) skirt.userData.noMerge = true;
  for (const j of [hips, spine, head, armL.sh, armL.el, armR.sh, armR.el, legL.hp, legL.kn, legR.hp, legR.kn]) mergeDirect(j);
  root.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
    }
  });
  return {
    root, hips, spine, head, headParts, female, skirt,
    shL: armL.sh, elL: armL.el, shR: armR.sh, elR: armR.el,
    hpL: legL.hp, knL: legL.kn, hpR: legR.hp, knR: legR.kn,
    walkPhase: Math.random() * 10,
  };
}

export function resetPose(p) {
  for (const j of [p.shL, p.elL, p.shR, p.elR, p.hpL, p.knL, p.hpR, p.knR, p.spine, p.head]) j.quaternion.identity();
  p.hips.position.y = 0.95;
  if (p.skirt) p.skirt.visible = true;
}
export function poseWalk(p, dt, speed) {
  p.walkPhase += dt * speed * 4.2;
  const s = Math.sin(p.walkPhase), c = Math.cos(p.walkPhase);
  const a = Math.min(1, speed / 1.4);
  p.hpL.rotation.set(-s * 0.5 * a, 0, 0);
  p.hpR.rotation.set(s * 0.5 * a, 0, 0);
  p.knL.rotation.set(Math.max(0, c) * 0.8 * a, 0, 0);
  p.knR.rotation.set(Math.max(0, -c) * 0.8 * a, 0, 0);
  p.shL.rotation.set(s * 0.45 * a, 0, 0.06);
  p.shR.rotation.set(-s * 0.45 * a, 0, -0.06);
  p.elL.rotation.set(-0.3 * a, 0, 0);
  p.elR.rotation.set(-0.3 * a, 0, 0);
  p.hips.position.y = 0.95 + Math.abs(s) * 0.03 * a;
  p.spine.rotation.set(0.04 * a, s * 0.05 * a, 0);
}
export function poseIdle(p, t) {
  resetPose(p);
  p.shL.rotation.z = 0.08;
  p.shR.rotation.z = -0.08;
  p.spine.rotation.x = Math.sin(t * 1.3) * 0.015;
  p.head.rotation.y = Math.sin(t * 0.4) * 0.3;
}
export function poseWave(p, t) {
  poseIdle(p, t);
  p.shR.rotation.set(0, 0, -2.6 + Math.sin(t * 3) * 0.08);
  p.elR.rotation.set(0, 0, -0.5 + Math.sin(t * 9) * 0.45);
  p.head.rotation.y = 0;
}
export function poseAngry(p, t) {
  resetPose(p);
  p.shL.rotation.set(-1.0 + Math.sin(t * 7) * 0.4, 0, 0.5);
  p.elL.rotation.set(-1.2 + Math.sin(t * 9) * 0.3, 0, 0);
  p.shR.rotation.set(-1.3 + Math.cos(t * 6) * 0.5, 0, -0.4);
  p.elR.rotation.set(-0.9 + Math.cos(t * 8) * 0.4, 0, 0);
  p.spine.rotation.x = 0.1 + Math.sin(t * 5) * 0.05;
  p.head.rotation.x = Math.sin(t * 8) * 0.1;
}
export function poseHandsUp(p, t, walking = 0, dt = 0) {
  if (walking > 0) poseWalk(p, dt, walking);
  else resetPose(p);
  p.shL.rotation.set(0, 0, 2.7);
  p.shR.rotation.set(0, 0, -2.7);
  p.elL.rotation.set(0, 0, 0.6 + Math.sin(t * 2) * 0.05);
  p.elR.rotation.set(0, 0, -0.6);
}
/** alternating jabs */
export function posePunch(p, t) {
  resetPose(p);
  const beat = t * 2.6;
  const left = Math.floor(beat) % 2 === 0;
  const ext = Math.sin((beat % 1) * Math.PI);
  const [sh, el, osh, oel] = left ? [p.shL, p.elL, p.shR, p.elR] : [p.shR, p.elR, p.shL, p.elL];
  sh.rotation.set(-1.55, 0, left ? -0.15 : 0.15);
  el.rotation.set(-1.7 * (1 - ext), 0, 0);
  osh.rotation.set(-1.15, 0, left ? 0.35 : -0.35);
  oel.rotation.set(-2.0, 0, 0);
  p.spine.rotation.set(0.12, (left ? -1 : 1) * 0.3 * ext, 0);
  p.hpL.rotation.x = -0.25;
  p.knL.rotation.x = 0.3;
  p.hpR.rotation.x = 0.15;
  p.head.rotation.x = 0.1;
}
export function posePhone(p, t) {
  poseIdle(p, t);
  p.shR.rotation.set(-0.3, 0, -0.35);
  p.elR.rotation.set(-2.3, 0, 0);
  p.head.rotation.y = -0.3;
}
export function poseSit(p) {
  resetPose(p);
  p.hips.position.y = 0;
  p.hpL.rotation.set(-1.45, 0, 0.05);
  p.hpR.rotation.set(-1.45, 0, -0.05);
  p.knL.rotation.set(1.3, 0, 0);
  p.knR.rotation.set(1.3, 0, 0);
  p.spine.rotation.x = -0.12;
  p.shL.rotation.set(-0.5, 0, 0.1);
  p.shR.rotation.set(-0.5, 0, -0.1);
  p.elL.rotation.set(-0.9, 0, 0);
  p.elR.rotation.set(-0.9, 0, 0);
  if (p.skirt) p.skirt.visible = false;
}

const _m = new THREE.Matrix4(), _t = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _d2 = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);
/** Two-bone IK: places hand at world-space target. pole is in spine space. */
export function armIK(p, side, target, pole) {
  const sh = side > 0 ? p.shL : p.shR;
  const el = side > 0 ? p.elL : p.elR;
  _m.copy(p.spine.matrixWorld).invert();
  _t.copy(target).applyMatrix4(_m);
  const S = sh.position;
  _d.subVectors(_t, S);
  const L1 = ARM.L1, L2 = ARM.L2;
  const dist = Math.min(Math.max(_d.length(), 0.08), L1 + L2 - 0.002);
  _d.normalize();
  const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  _p.copy(pole).addScaledVector(_d, -pole.dot(_d)).normalize();
  _e.copy(S).addScaledVector(_d, a).addScaledVector(_p, h);
  _d2.subVectors(_e, S).normalize();
  sh.quaternion.setFromUnitVectors(DOWN, _d2);
  // forearm direction in shoulder space
  _t.copy(S).addScaledVector(_d, dist).sub(_e).normalize();
  _q.copy(sh.quaternion).invert();
  _t.applyQuaternion(_q);
  el.quaternion.setFromUnitVectors(DOWN, _t);
}

/* =========================================================
   misc props
   ========================================================= */
export function buildArrow() {
  const s = new THREE.Shape();
  s.moveTo(0, 1.1);
  s.lineTo(0.7, 0.2);
  s.lineTo(0.28, 0.2);
  s.lineTo(0.28, -0.8);
  s.lineTo(-0.28, -0.8);
  s.lineTo(-0.28, 0.2);
  s.lineTo(-0.7, 0.2);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
  g.translate(0, 0, -0.09);
  g.rotateX(-Math.PI / 2); // shape +y -> -z ... fix below
  g.rotateY(Math.PI); // now points +z
  const mat = new THREE.MeshStandardMaterial({ color: 0x29e07a, emissive: 0x18c060, emissiveIntensity: 0.9, roughness: 0.3, transparent: true, opacity: 0.92, depthTest: true });
  const m = new THREE.Mesh(g, mat);
  m.castShadow = false;
  const grp = new THREE.Group();
  grp.add(m);
  return { group: grp, mat };
}

export function buildBeacon(color) {
  const g = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beamG = new THREE.CylinderGeometry(2.2, 2.2, 120, 24, 1, true);
  beamG.translate(0, 60, 0);
  const beam = new THREE.Mesh(beamG, beamMat);
  g.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.5, 5.2, 48), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  g.add(ring);
  g.userData = { beamMat, ringMat, ring };
  return g;
}

export { signTexture, fa };
