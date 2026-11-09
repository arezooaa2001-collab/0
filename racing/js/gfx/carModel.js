// Procedural car models: lofted superellipse body with carved wheel arches, glass greenhouse,
// painted roof, lights, aero parts, interior and detailed wheels. Geometry detail follows the
// graphics preset; geometry is cached per model+detail and shared by all cars of that model.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { smoothstep, lerp, clamp } from '../core/utils.js';
import { plateTexture, blobShadowTexture, glowTexture } from './textures.js';

const spow = (v, p) => Math.sign(v) * Math.abs(v) ** p;

function loft(rings, closed) {
  const S = rings.length, M = rings[0].length;
  const pos = new Float32Array(S * M * 3);
  const uv = new Float32Array(S * M * 2);
  for (let s = 0; s < S; s++) {
    for (let j = 0; j < M; j++) {
      const p = rings[s][j];
      const k = s * M + j;
      pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2];
      uv[k * 2] = j / M; uv[k * 2 + 1] = s / (S - 1);
    }
  }
  const idx = [];
  const jMax = closed ? M : M - 1;
  for (let s = 0; s < S - 1; s++) {
    for (let j = 0; j < jMax; j++) {
      const a = s * M + j, b = s * M + ((j + 1) % M), c = (s + 1) * M + j, d = (s + 1) * M + ((j + 1) % M);
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function ring(M, hw, bottom, top, e, tumble, z, closed = true, phi0 = -Math.PI / 2, arc = Math.PI * 2) {
  const pts = [];
  const mid = (top + bottom) / 2, hh = Math.max(0.005, (top - bottom) / 2);
  for (let j = 0; j < M; j++) {
    const phi = phi0 + (closed ? j / M : j / (M - 1)) * arc;
    const xu = spow(Math.cos(phi), 2 / e);
    const yu = spow(Math.sin(phi), 2 / e);
    const squeeze = yu > 0 ? 1 - tumble * yu * yu * 0.55 : 1 - 0.06 * yu * yu;
    pts.push([hw * xu * squeeze, mid + yu * hh, z]);
  }
  return pts;
}

/** Shape functions of one car body (all in metres, car local: +Z forward, +X left, +Y up). */
function shapeOf(body) {
  const Lc = body.length, W = body.width;
  const zOf = (f) => Lc / 2 - f * Lc;
  const fOf = (z) => (Lc / 2 - z) / Lc;
  const axles = [body.wheelbase / 2, -body.wheelbase / 2];
  const halfW = (f) => {
    let hw = W / 2;
    const nt = smoothstep(0, 0.2, f);
    hw *= 1 - body.nosePinch * (1 - nt) ** 2;
    const tt = smoothstep(1, 0.86, f);
    hw *= 1 - body.tailPinch * (1 - tt) ** 2 - 0.05 * (1 - tt) ** 2;
    return hw;
  };
  const [c0, c1] = body.cabin;
  const topY = (f) => {
    let y;
    if (f < c0) y = lerp(body.noseY, body.cowlY, (f / c0) ** 0.7);
    else if (f < c1) y = lerp(body.cowlY, body.deckY, (f - c0) / (c1 - c0));
    else y = lerp(body.deckY, body.tailY, (f - c1) / (1 - c1));
    y -= (1 - smoothstep(0, 0.05, f)) * 0.09;
    y -= smoothstep(0.965, 1, f) * 0.06;
    return y;
  };
  const archR = body.wheelRadius * 1.14;
  const bottomY = (f) => {
    let y = body.floorY;
    if (f < 0.1) y += (1 - f / 0.1) ** 2 * 0.12;
    if (f > 0.9) y += ((f - 0.9) / 0.1) ** 2 * 0.14;
    const z = zOf(f);
    for (const za of axles) {
      const dz = z - za;
      if (Math.abs(dz) < archR) {
        const archTop = body.wheelRadius + Math.sqrt(archR * archR - dz * dz) * 0.97;
        y = Math.max(y, Math.min(archTop, topY(f) - 0.1));
      }
    }
    return y;
  };
  const [r0, r1] = body.roofSpan;
  const roofY = (f) => {
    const H = body.height;
    if (f < r0) {
      const t = clamp((f - c0) / (r0 - c0), 0, 1);
      return lerp(topY(c0), H, 1 - (1 - t) ** 1.6);
    }
    if (f <= r1) {
      const m = (f - (r0 + r1) / 2) / Math.max(0.01, r1 - r0);
      return H - 0.025 * m * m * 4;
    }
    const t = clamp((f - r1) / (c1 - r1), 0, 1);
    return lerp(H, topY(c1), t ** 1.25);
  };
  return { Lc, W, zOf, fOf, axles, halfW, topY, bottomY, roofY, archR };
}

function sampleFs(S, body, sh) {
  const fs = new Set();
  for (let i = 0; i <= S; i++) fs.add(+(i / S).toFixed(5));
  // extra resolution across the wheel arches
  const extra = Math.max(4, Math.round(S / 5));
  for (const za of sh.axles) {
    const fc = sh.fOf(za);
    const span = sh.archR / sh.Lc;
    for (let i = 0; i <= extra; i++) fs.add(+clamp(fc - span + (2 * span * i) / extra, 0, 1).toFixed(5));
    fs.add(+clamp(fc - span - 0.004, 0, 1).toFixed(5));
    fs.add(+clamp(fc + span + 0.004, 0, 1).toFixed(5));
  }
  return [...fs].sort((a, b) => a - b);
}

function buildBody(body, detail) {
  const sh = shapeOf(body);
  const M = detail.ring;
  const fs = sampleFs(detail.sections, body, sh);
  const rings = [];
  // rounded nose cap
  const capSteps = [0, 0.55, 0.85];
  const sectionAt = (f, scale = 1, dz = 0) => {
    const hw = sh.halfW(f) * scale;
    const top = sh.topY(f), bot = sh.bottomY(f);
    const mid = (top + bot) / 2;
    const t2 = mid + (top - mid) * scale, b2 = mid + (bot - mid) * scale;
    return ring(M, hw, b2, t2, body.exp, body.tumble, sh.zOf(f) + dz);
  };
  for (const s of capSteps) rings.push(sectionAt(0, s, 0.07 * (1 - s)));
  for (const f of fs) rings.push(sectionAt(f));
  for (const s of [...capSteps].reverse()) rings.push(sectionAt(1, s, -0.07 * (1 - s)));
  const paint = loft(rings, true);

  // greenhouse (glass)
  const [c0, c1] = body.cabin;
  const gS = Math.max(8, Math.round(detail.sections * 0.6));
  const grings = [];
  const gTumble = Math.min(0.85, body.tumble + 0.3);
  const gSection = (f, scale = 1) => {
    const base = sh.topY(f) - 0.12;
    const top = Math.max(sh.roofY(f), sh.topY(f) + 0.005);
    const hw = sh.halfW(f) * (1 - body.tumble * 0.5) * 0.97;
    const mid = (top + base) / 2;
    return ring(M, hw * scale, mid + (base - mid) * scale, mid + (top - mid) * scale, Math.max(2.4, body.exp * 0.85), gTumble, sh.zOf(f));
  };
  grings.push(gSection(c0, 0));
  for (let i = 0; i <= gS; i++) grings.push(gSection(lerp(c0, c1, i / gS)));
  grings.push(gSection(c1, 0));
  const glass = loft(grings, true);

  // painted roof panel slightly outside the glass
  const [r0, r1] = body.roofSpan;
  const rrings = [];
  const rS = Math.max(4, Math.round(detail.sections * 0.25));
  for (let i = 0; i <= rS; i++) {
    const f = lerp(r0 - 0.015, r1 + 0.015, i / rS);
    const base = sh.topY(f) - 0.12;
    const top = sh.roofY(f) + 0.012;
    const hw = sh.halfW(f) * (1 - body.tumble * 0.5) * 0.97 * 1.012;
    rrings.push(ring(Math.max(8, M >> 1), hw, base, top, Math.max(2.4, body.exp * 0.85), gTumble, sh.zOf(f), false, Math.PI * 0.2, Math.PI * 0.6));
  }
  const roof = loft(rrings, false);
  return { sh, paint, glass, roof };
}

function place(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
  geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz);
  geo.translate(x, y, z);
  return geo;
}

function buildDetails(body, sh, detail, buckets) {
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const [c0] = body.cabin;
  const [r0, r1] = body.roofSpan;
  // headlights
  const fH = 0.035;
  const zH = sh.zOf(fH), hwH = sh.halfW(fH);
  for (const s of [1, -1]) {
    const g = new THREE.SphereGeometry(1, 16, 10);
    g.scale(0.22, 0.06, 0.12);
    buckets.head.push(place(g, s * hwH * 0.6, sh.topY(fH) - 0.06, zH - 0.02, -0.35, s * 0.25, 0));
  }
  // grille / intake
  buckets.black.push(place(B(sh.halfW(0.01) * 1.15, 0.13, 0.1), 0, body.floorY + 0.2, sh.zOf(0.012)));
  // tail lights
  const fT = 0.988;
  const hwT = sh.halfW(fT);
  if (body.spoiler === 'bigwing' || body.spoiler === 'wing' && body.exp < 3.6) {
    buckets.tail.push(place(B(hwT * 1.75, 0.05, 0.05), 0, body.tailY - 0.1, sh.zOf(fT)));
  } else {
    for (const s of [1, -1]) buckets.tail.push(place(B(hwT * 0.55, 0.075, 0.05), s * hwT * 0.58, body.tailY - 0.1, sh.zOf(fT)));
  }
  // number plate
  buckets.plate.push(place(B(0.5, 0.12, 0.02), 0, body.floorY + 0.28, sh.zOf(1) + 0.02, 0, Math.PI, 0));
  // diffuser
  buckets.black.push(place(B(hwT * 1.6, 0.1, 0.3), 0, body.floorY + 0.06, sh.zOf(0.97)));
  // exhausts
  const ex = body.exhaust;
  const exX = ex === 1 ? [hwT * 0.55] : ex === 2 ? [hwT * 0.45, -hwT * 0.45] : [hwT * 0.5, hwT * 0.32, -hwT * 0.32, -hwT * 0.5];
  const exhaustPoints = [];
  for (const x of exX) {
    const g = new THREE.CylinderGeometry(0.045, 0.05, 0.22, 12, 1, true);
    buckets.chrome.push(place(g, x, body.floorY + 0.1, sh.zOf(0.995), Math.PI / 2));
    exhaustPoints.push(new THREE.Vector3(x, body.floorY + 0.1, sh.zOf(1) - 0.06));
  }
  // side mirrors
  const fm = c0 + 0.05;
  const hwm = sh.halfW(fm) * (1 - body.tumble * 0.5);
  for (const s of [1, -1]) {
    buckets.paint.push(place(B(0.14, 0.08, 0.07), s * (hwm + 0.1), sh.topY(fm) + 0.1, sh.zOf(fm)));
    buckets.black.push(place(B(0.08, 0.03, 0.03), s * (hwm + 0.03), sh.topY(fm) + 0.07, sh.zOf(fm)));
  }
  // aero
  const fD = 0.95;
  const deck = sh.topY(fD);
  const hwD = sh.halfW(fD);
  switch (body.spoiler) {
    case 'lip':
      buckets.paint.push(place(B(hwD * 1.6, 0.035, 0.12), 0, deck + 0.02, sh.zOf(0.975), -0.18));
      break;
    case 'duck':
      buckets.paint.push(place(B(hwD * 1.7, 0.06, 0.16), 0, deck + 0.04, sh.zOf(0.965), -0.32));
      break;
    case 'wing':
    case 'bigwing': {
      const big = body.spoiler === 'bigwing';
      const h = big ? 0.32 : 0.22;
      for (const s of [1, -1]) buckets.black.push(place(B(0.035, h, 0.12), s * hwD * 0.6, deck + h / 2, sh.zOf(0.93)));
      buckets.paint.push(place(B(hwD * (big ? 2.05 : 1.85), 0.035, big ? 0.36 : 0.26), 0, deck + h + 0.01, sh.zOf(0.935), 0.08));
      if (big) for (const s of [1, -1]) buckets.black.push(place(B(0.02, 0.17, 0.42), s * hwD * 1.03, deck + h - 0.03, sh.zOf(0.935)));
      break;
    }
    default:
      break;
  }
  if (body.scoop) {
    if (body.fin) buckets.black.push(place(B(0.34, 0.12, 0.5), 0, sh.roofY(r0 + 0.04) + 0.03, sh.zOf(r0 + 0.08)));
    else buckets.black.push(place(B(0.42, 0.07, 0.5), 0, sh.topY(c0 * 0.55) + 0.02, sh.zOf(c0 * 0.55), -0.05));
  }
  if (body.fin) {
    const g = B(0.03, 0.22, 1.0);
    buckets.paint.push(place(g, 0, sh.roofY(r1) - 0.02, sh.zOf((r1 + 1) / 2) + 0.15));
  }
  // side skirts
  for (const s of [1, -1]) {
    const len = body.wheelbase - body.wheelRadius * 2.4;
    buckets.black.push(place(B(0.05, 0.07, len), s * (sh.halfW(0.5) - 0.01), body.floorY + 0.03, 0));
  }
  if (detail.interior) {
    const fs = (r0 + r1) / 2 + 0.04;
    for (const s of [1, -1]) buckets.interior.push(place(B(0.46, 0.55, 0.45), s * 0.36, body.floorY + 0.5, sh.zOf(fs)));
    buckets.interior.push(place(B(sh.halfW(c0 + 0.06) * 1.5, 0.16, 0.32), 0, sh.topY(c0 + 0.06) - 0.03, sh.zOf(c0 + 0.07)));
    const wheel = new THREE.TorusGeometry(0.16, 0.022, 8, 20);
    buckets.black.push(place(wheel, 0.36, sh.topY(c0 + 0.1) + 0.04, sh.zOf(c0 + 0.12), -0.45));
  }
  return { exhaustPoints };
}

function buildWheel(body, detail) {
  const R = body.wheelRadius, w = body.wheelWidth;
  const ri = R * 0.67;
  const hwT = w / 2;
  const rs = Math.min(0.055, hwT * 0.42);
  const prof = [];
  prof.push(new THREE.Vector2(ri, -hwT * 0.92));
  const arcN = Math.max(2, Math.round(detail.wheelSegments / 8));
  for (let i = 0; i <= arcN; i++) {
    const a = -Math.PI / 2 + (i / arcN) * (Math.PI / 2);
    prof.push(new THREE.Vector2(R - rs + Math.cos(a) * rs, -hwT + rs + Math.sin(a) * rs));
  }
  for (let i = 0; i <= arcN; i++) {
    const a = (i / arcN) * (Math.PI / 2);
    prof.push(new THREE.Vector2(R - rs + Math.cos(a) * rs, hwT - rs + Math.sin(a) * rs));
  }
  prof.push(new THREE.Vector2(ri, hwT * 0.92));
  const tire = new THREE.LatheGeometry(prof, detail.wheelSegments);
  tire.rotateZ(-Math.PI / 2);

  const seg = detail.wheelSegments;
  const parts = [];
  const dark = [];
  const barrel = new THREE.CylinderGeometry(ri, ri, w * 0.86, seg, 1, true);
  dark.push(barrel);
  const face = hwT * 0.8;
  const hub = new THREE.CylinderGeometry(ri * 0.2, ri * 0.24, 0.05, 16);
  hub.translate(0, face, 0);
  parts.push(hub);
  const lip = new THREE.TorusGeometry(ri * 0.98, 0.012, 6, seg);
  lip.rotateX(Math.PI / 2);
  lip.translate(0, face + 0.01, 0);
  parts.push(lip);
  const spoke = (count, width, thick, twist = 0) => {
    for (let k = 0; k < count; k++) {
      const g = new THREE.BoxGeometry(width, thick, ri * 0.82);
      g.translate(0, 0, ri * 0.5);
      g.rotateY(twist);
      g.rotateY((k / count) * Math.PI * 2);
      g.translate(0, face - thick / 2, 0);
      parts.push(g);
    }
  };
  switch (body.rim) {
    case 'dish': {
      const disc = new THREE.CylinderGeometry(ri * 0.96, ri * 0.96, 0.02, seg);
      disc.translate(0, face - 0.02, 0);
      parts.push(disc);
      spoke(8, 0.03, 0.03);
      break;
    }
    case 'multi': spoke(10, 0.03, 0.035); break;
    case 'rally': spoke(6, 0.07, 0.04); break;
    case 'turbine': spoke(12, 0.025, 0.03, 0.5); break;
    default: spoke(5, 0.06, 0.04); break;
  }
  const rim = mergeGeometries(parts.map((g) => g.toNonIndexed ? g : g));
  const rimDark = mergeGeometries(dark);
  rim.rotateZ(-Math.PI / 2);
  rimDark.rotateZ(-Math.PI / 2);
  let disc = null, caliper = null;
  if (detail.brakeDiscs) {
    disc = new THREE.CylinderGeometry(ri * 0.82, ri * 0.82, 0.03, Math.max(16, seg >> 1));
    disc.rotateZ(-Math.PI / 2);
    disc.translate(-hwT * 0.15, 0, 0);
    caliper = new THREE.BoxGeometry(0.07, 0.2, 0.12);
    caliper.translate(-hwT * 0.05, ri * 0.62, -ri * 0.2);
  }
  return { tire, rim, rimDark, disc, caliper, radius: R, width: w };
}

const modelCache = new Map();

export function getCarModel(carDef, tier) {
  const detail = {
    sections: tier.carSections,
    ring: tier.carRing,
    wheelSegments: tier.wheelSegments,
    interior: tier.interior,
    brakeDiscs: tier.brakeDiscs,
  };
  const key = `${carDef.id}:${detail.sections}:${detail.ring}:${detail.wheelSegments}:${detail.interior}:${detail.brakeDiscs}`;
  if (modelCache.has(key)) return modelCache.get(key);
  const body = carDef.body;
  const { sh, paint, glass, roof } = buildBody(body, detail);
  const buckets = { paint: [], black: [], chrome: [], head: [], tail: [], plate: [], interior: [] };
  const { exhaustPoints } = buildDetails(body, sh, detail, buckets);
  const merged = {};
  const paintParts = [paint, roof, ...buckets.paint].map(stripToCommon);
  merged.paint = mergeGeometries(paintParts);
  merged.glass = glass;
  for (const k of Object.keys(buckets)) {
    if (k === 'paint' || !buckets[k].length) continue;
    merged[k] = mergeGeometries(buckets[k].map(stripToCommon));
  }
  for (const g of Object.values(merged)) g.computeBoundingSphere();
  const model = {
    key,
    body,
    geo: merged,
    wheel: buildWheel(body, detail),
    exhaustPoints,
    dims: { length: body.length, width: body.width, height: body.height },
  };
  modelCache.set(key, model);
  return model;
}

/** mergeGeometries needs identical attribute sets: keep position/normal/uv, all indexed. */
function stripToCommon(g) {
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.index) {
    const idx = new Array(g.attributes.position.count).fill(0).map((_, i) => i);
    g.setIndex(idx);
  }
  return g;
}

export function clearCarModelCache() {
  for (const m of modelCache.values()) {
    for (const g of Object.values(m.geo)) g.dispose();
    for (const g of Object.values(m.wheel)) if (g && g.isBufferGeometry) g.dispose();
  }
  modelCache.clear();
}

// -------------------------------------------------------------------------------------------
// Materials
// -------------------------------------------------------------------------------------------

export function createSharedCarMaterials(tier) {
  const q = tier.material;
  const Std = q === 0 ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial;
  const std = (o) => {
    if (q === 0) {
      const { metalness, roughness, envMapIntensity, ...rest } = o;
      return new THREE.MeshLambertMaterial(rest);
    }
    return new THREE.MeshStandardMaterial(o);
  };
  const glass = q === 0
    ? new THREE.MeshLambertMaterial({ color: 0x0b0f16 })
    : new THREE.MeshStandardMaterial({
      color: 0x0a0f17, metalness: 0.95, roughness: 0.05, envMapIntensity: 1.8,
      transparent: tier.interior, opacity: tier.interior ? 0.72 : 1,
    });
  return {
    glass,
    black: std({ color: 0x0b0b0d, roughness: 0.8, metalness: 0.1 }),
    chrome: std({ color: 0xe6ebf0, roughness: 0.12, metalness: 1 }),
    head: new Std({ color: 0xffffff, emissive: 0xe2ecff, emissiveIntensity: 1.6 }),
    plate: std({ map: plateTexture('شتاب ۲۰'), roughness: 0.5, metalness: 0 }),
    interior: std({ color: 0x1b1b1e, roughness: 0.9, metalness: 0 }),
    tire: std({ color: 0x141414, roughness: 0.93, metalness: 0 }),
    rim: std({ color: 0xcfd6dd, roughness: 0.22, metalness: 1 }),
    rimDark: std({ color: 0x24272c, roughness: 0.4, metalness: 0.85 }),
    disc: std({ color: 0x5c6066, roughness: 0.45, metalness: 0.9 }),
    caliper: std({ color: 0xd61f26, roughness: 0.35, metalness: 0.2 }),
    blob: new THREE.MeshBasicMaterial({
      map: blobShadowTexture(), transparent: true, depthWrite: false, opacity: 0.75,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
    flame: new THREE.MeshBasicMaterial({
      color: 0x66aaff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
    beam: new THREE.MeshBasicMaterial({
      map: glowTexture(), color: 0xfff1d6, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    }),
  };
}

export function createPaintMaterial(tier, color) {
  const c = new THREE.Color(color);
  if (tier.material === 0) return new THREE.MeshLambertMaterial({ color: c });
  if (tier.material === 1) return new THREE.MeshStandardMaterial({ color: c, metalness: 0.45, roughness: 0.33 });
  return new THREE.MeshPhysicalMaterial({
    color: c, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.035, envMapIntensity: 1.15,
  });
}

function createTailMaterial(tier) {
  const M = tier.material === 0 ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial;
  return new M({ color: 0x3a0000, emissive: 0xff1010, emissiveIntensity: 0.55 });
}

// -------------------------------------------------------------------------------------------
// Per-car scene object
// -------------------------------------------------------------------------------------------

export class CarVisual {
  constructor(carDef, color, tier, shared, opts = {}) {
    this.def = carDef;
    this.tier = tier;
    const model = getCarModel(carDef, tier);
    this.model = model;
    this.paint = createPaintMaterial(tier, color);
    this.tail = createTailMaterial(tier);
    const mats = { ...shared, paint: this.paint, tail: this.tail };
    this.root = new THREE.Group();
    this.root.rotation.order = 'YXZ';
    this.chassis = new THREE.Group();
    this.body = new THREE.Group();
    this.chassis.add(this.body);
    this.root.add(this.chassis);
    const castShadow = opts.castShadow ?? true;
    this.meshes = {};
    for (const [k, g] of Object.entries(model.geo)) {
      const m = new THREE.Mesh(g, mats[k]);
      m.castShadow = castShadow && (k === 'paint' || k === 'glass' || k === 'black');
      m.receiveShadow = k === 'paint';
      if (k === 'glass' && mats.glass.transparent) m.renderOrder = 2;
      this.body.add(m);
      this.meshes[k] = m;
    }
    // wheels
    const b = carDef.body;
    const trackHalf = b.width / 2 - b.wheelWidth / 2 - 0.02;
    this.wheels = [];
    const wm = model.wheel;
    for (const [z, front] of [[b.wheelbase / 2, true], [-b.wheelbase / 2, false]]) {
      for (const side of [1, -1]) {
        const pivot = new THREE.Group();
        pivot.position.set(side * trackHalf, wm.radius, z);
        const mirror = new THREE.Group();
        mirror.scale.x = side;
        pivot.add(mirror);
        const spin = new THREE.Group();
        mirror.add(spin);
        const tire = new THREE.Mesh(wm.tire, mats.tire);
        tire.castShadow = castShadow;
        spin.add(tire);
        spin.add(new THREE.Mesh(wm.rim, mats.rim));
        spin.add(new THREE.Mesh(wm.rimDark, mats.rimDark));
        if (wm.disc) spin.add(new THREE.Mesh(wm.disc, mats.disc));
        if (wm.caliper) mirror.add(new THREE.Mesh(wm.caliper, mats.caliper));
        this.chassis.add(pivot);
        this.wheels.push({ pivot, spin, front, side, z });
      }
    }
    // contact shadow (works on every preset)
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(b.width * 1.45, b.length * 1.2), shared.blob);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.03;
    blob.renderOrder = 1;
    this.chassis.add(blob);
    this.blob = blob;
    // nitro flames
    this.flames = [];
    const flameGeo = new THREE.ConeGeometry(0.07, 0.6, 10, 1, true);
    flameGeo.rotateX(-Math.PI / 2);
    flameGeo.translate(0, 0, -0.3);
    for (const p of model.exhaustPoints) {
      const f = new THREE.Mesh(flameGeo, shared.flame);
      f.position.copy(p);
      f.visible = false;
      this.body.add(f);
      this.flames.push(f);
    }
    this.flameGeo = flameGeo;
    this.brake = 0;
    this.damage = 0;
    this.ownPaintGeo = null;
    this.lastDeform = 0;
  }

  /** Adds night-time headlight beams (cheap additive cones). */
  addHeadlightBeams(shared) {
    if (this.beams) return;
    const g = new THREE.ConeGeometry(2.2, 14, 16, 1, true);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, 7);
    const b = this.def.body;
    this.beams = [];
    for (const s of [1, -1]) {
      const m = new THREE.Mesh(g, shared.beam);
      m.position.set(s * b.width * 0.3, b.noseY - 0.08, b.length / 2 - 0.1);
      m.rotation.x = 0.06;
      this.body.add(m);
      this.beams.push(m);
    }
    this.beamGeo = g;
  }

  update(v, dt, realism, time) {
    const r = this.root;
    r.position.set(v.x, v.proj.height, v.z);
    const along = Math.sin(v.heading) * v.proj.tx + Math.cos(v.heading) * v.proj.tz;
    r.rotation.y = v.heading;
    r.rotation.x = -Math.atan(v.proj.grade * along);
    this.chassis.position.z = (v.a - v.b) / 2;
    let heave = 0;
    if (realism.roadBumps) {
      const s = v.proj.s;
      heave += 0.006 * Math.sin(s * 2.3) + 0.004 * Math.sin(s * 5.7 + 1);
      if (v.surface === 1) heave += 0.012 * Math.sin(s * 9) * Math.min(1, v.speed / 10);
      if (v.surface === 2) heave += 0.02 * Math.sin(s * 3.1 + time * 2) * Math.min(1, v.speed / 8);
    }
    const susp = realism.suspension ? 1 : 0.35;
    this.body.position.y = heave + 0.01;
    this.body.rotation.x = v.pitch * susp;
    this.body.rotation.z = v.roll * susp;
    for (const w of this.wheels) {
      w.spin.rotation.x = v.wheelAngle;
      if (w.front) w.pivot.rotation.y = v.delta;
    }
    // lights
    const braking = v.controls.brake > 0.1 && v.u > 0.5 || v.controls.handbrake;
    this.brake += ((braking ? 1 : 0) - this.brake) * Math.min(1, dt * 18);
    this.tail.emissiveIntensity = 0.55 + this.brake * 2.6;
    const nitro = v.nitroActive;
    for (const f of this.flames) {
      f.visible = nitro;
      if (nitro) {
        const k = 0.8 + Math.random() * 0.5;
        f.scale.set(k, k, 0.7 + Math.random() * 0.7);
      }
    }
  }

  /** Visual body damage: dents the paint around a local impact point. */
  deform(worldX, worldZ, worldY, strength, time) {
    if (time - this.lastDeform < 0.2 || this.damage > 1.6) return;
    this.lastDeform = time;
    if (!this.ownPaintGeo) {
      this.ownPaintGeo = this.meshes.paint.geometry.clone();
      this.meshes.paint.geometry = this.ownPaintGeo;
      this.origPos = this.ownPaintGeo.attributes.position.array.slice();
    }
    const p = new THREE.Vector3(worldX, worldY, worldZ);
    this.body.updateWorldMatrix(true, false);
    this.body.worldToLocal(p);
    const pos = this.ownPaintGeo.attributes.position;
    const arr = pos.array;
    const depth = Math.min(0.09, strength * 0.007);
    const rad = 0.55 + depth * 3;
    let touched = false;
    for (let i = 0; i < pos.count; i++) {
      const x = arr[i * 3], y = arr[i * 3 + 1], z = arr[i * 3 + 2];
      const dx = x - p.x, dz = z - p.z, dy = (y - p.y) * 0.6;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > rad) continue;
      const f = (1 - d / rad) ** 2 * depth;
      // push towards the car's centre line, never more than 12 cm from the original
      const len = Math.hypot(x, z * 0.35) || 1;
      let nx = x - (x / len) * f, nz = z - ((z * 0.35) / len) * f;
      const ox = this.origPos[i * 3], oz = this.origPos[i * 3 + 2];
      const dd = Math.hypot(nx - ox, nz - oz);
      if (dd > 0.12) { nx = ox + ((nx - ox) / dd) * 0.12; nz = oz + ((nz - oz) / dd) * 0.12; }
      arr[i * 3] = nx;
      arr[i * 3 + 2] = nz;
      arr[i * 3 + 1] = y - f * 0.3;
      touched = true;
    }
    if (touched) {
      pos.needsUpdate = true;
      this.ownPaintGeo.computeVertexNormals();
      this.damage += depth;
    }
  }

  setColor(color) {
    this.paint.color.set(color);
  }

  dispose() {
    this.paint.dispose();
    this.tail.dispose();
    this.blob.geometry.dispose();
    this.flameGeo.dispose();
    this.beamGeo?.dispose();
    this.ownPaintGeo?.dispose();
    this.root.removeFromParent();
  }
}
