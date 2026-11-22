// ساخت انسان واقعی (سر، صورت، چشم، بینی، دهان، گوش، گردن، بدن، شکم، دست، انگشت، پا، کفش)
// دو حالت: اسکلت مفصل‌دار (راننده، رئیس) و هندسه ادغام‌شده برای تماشاگران Instanced با انیمیشن در شیدر
import * as THREE from 'three';
import { mergeGeos, fillAttr, mulberry32, pbrEligible, vertexPBRMaterial } from './utils.js';

export const PART = { LEGS: 0, TORSO: 1, HEAD: 2, UARM_L: 3, LARM_L: 4, UARM_R: 5, LARM_R: 6, LONGHAIR: 7 };
const MAT = { SKIN: 0, SHIRT: 1, PANTS: 2, HAIR: 3, FIXED: 4 };

const J = {
  pelvis: [0, 0.92, 0], spine: [0, 0.07, 0], neck: [0, 0.45, 0], head: [0, 0.07, 0],
  shoulderL: [0.185, 0.395, 0], shoulderR: [-0.185, 0.395, 0],
  elbow: [0, -0.285, 0], wrist: [0, -0.255, 0],
  hipL: [0.093, -0.04, 0], hipR: [-0.093, -0.04, 0], knee: [0, -0.43, 0], ankle: [0, -0.42, 0]
};

function sph(r, ws, hs, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0, ts = 0, tl = Math.PI) {
  const g = new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, ts, tl);
  g.scale(sx, sy, sz); g.translate(x, y, z); return g;
}
function caps(r, len, x, y, z, seg) { const g = new THREE.CapsuleGeometry(r, len, Math.max(2, seg >> 2), seg); g.translate(x, y, z); return g; }
function cyl(rt, rb, h, seg, x, y, z) { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, true); g.translate(x, y, z); return g; }

// فهرست قطعات بدن: هر قطعه به یک مفصل وصل است
// سطح جزئیات: hi (راننده و رئیس از نزدیک)، mid (تماشاگر نزدیک)، lo (تماشاگر دور، بسیار سبک)
const SEG = {
  hi: { head: [22, 16], small: [10, 8], tiny: [8, 6], torso: 18, limb: 10, cap: 3, ring: 12, fingers: true, face: true, belt: true },
  mid: { head: [9, 7], small: [5, 4], tiny: [4, 3], torso: 8, limb: 5, cap: 1, ring: 5, fingers: false, face: true, belt: false },
  lo: { head: [6, 4], small: [4, 3], tiny: [4, 3], torso: 5, limb: 4, cap: 1, ring: 4, fingers: false, face: false, belt: false, boxes: true }
};
function bodyParts(o) {
  const D = SEG[o.detail] || SEG.hi;
  const parts = [];
  const add = (joint, geo, mat, part, color = null) => parts.push({ joint, geo, mat, part, color });
  const box = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
  const capsL = (r, len, x, y, z) => { if (D.boxes) return box(r * 1.8, len + r * 1.6, r * 1.8, x, y, z); const g = new THREE.CapsuleGeometry(r, len, D.cap, D.limb); g.translate(x, y, z); return g; };
  const blob = (r, ws, hs, sx, sy, sz, x, y, z) => (D.boxes ? box(r * 1.7 * sx, r * 1.7 * sy, r * 1.7 * sz, x, y, z) : sph(r, ws, hs, sx, sy, sz, x, y, z));

  // تنه با شکم
  const prof = [[0.146, -0.03], [0.155, 0.06], [0.16, 0.15], [0.17, 0.25], [0.176, 0.31], [0.165, 0.37], [0.13, 0.415], [0.05, 0.45]];
  const torso = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * (o.build || 1), y)), D.torso);
  const tp = torso.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), y = tp.getY(i); let z = tp.getZ(i) * 0.64;
    const r = Math.hypot(x, tp.getZ(i)) || 1;
    if (z > 0) z += (o.belly || 0) * Math.exp(-(((y - 0.1) / 0.085) ** 2)) * (z / (r * 0.64));
    if (z > 0) z += 0.012 * Math.exp(-(((y - 0.3) / 0.05) ** 2)) * (z / (r * 0.64));
    tp.setZ(i, z);
  }
  torso.computeVertexNormals();
  add('spine', torso, MAT.SHIRT, PART.TORSO);
  if (!D.boxes) {
    add('spine', sph(0.062, D.small[0], D.small[1], 1, 1, 1, J.shoulderL[0], J.shoulderL[1], 0), MAT.SHIRT, PART.TORSO);
    add('spine', sph(0.062, D.small[0], D.small[1], 1, 1, 1, J.shoulderR[0], J.shoulderR[1], 0), MAT.SHIRT, PART.TORSO);
  }
  add('neck', cyl(0.045, 0.05, 0.12, Math.max(4, D.limb - 2), 0, 0.03, 0), MAT.SKIN, PART.TORSO);

  // لگن و کمربند
  add('pelvis', blob(0.158, D.head[0], Math.max(3, D.head[1] - 3), 1, 0.62, 0.68, 0, 0, 0), MAT.PANTS, PART.LEGS);
  if (D.belt) {
    const belt = new THREE.TorusGeometry(0.149, 0.013, 4, 20); belt.rotateX(Math.PI / 2); belt.scale(1, 1, 0.66); belt.translate(0, 0.045, 0);
    add('pelvis', belt, MAT.FIXED, PART.LEGS, 0x2a1d14);
  }

  // سر و صورت
  const hc = 0.105;
  add('head', sph(0.104, D.head[0], D.head[1], 0.93, 1.1, 1.0, 0, hc, 0), MAT.SKIN, PART.HEAD);
  if (D.face) {
    add('head', sph(0.074, D.small[0], D.small[1], 0.95, 0.8, 1.0, 0, hc - 0.05, 0.028), MAT.SKIN, PART.HEAD);
    for (const sx of [1, -1]) add('head', sph(0.026, D.tiny[0], D.tiny[1], 0.45, 1, 0.75, sx * 0.097, hc - 0.005, -0.005), MAT.SKIN, PART.HEAD);
    // بینی
    add('head', sph(0.0185, D.tiny[0], D.tiny[1], 0.85, 1.25, 1.15, 0, hc - 0.018, 0.101), MAT.SKIN, PART.HEAD);
    if (o.detail === 'hi') add('head', sph(0.011, 8, 6, 1.6, 0.8, 1, 0, hc - 0.036, 0.1), MAT.SKIN, PART.HEAD);
    // چشم‌ها: سفیدی، عنبیه، مردمک
    for (const sx of [1, -1]) {
      add('head', sph(0.0165, D.tiny[0], D.tiny[1], 1, 1, 0.8, sx * 0.036, hc + 0.012, 0.086), MAT.FIXED, PART.HEAD, 0xf3f0ea);
      add('head', sph(0.0098, D.tiny[0], Math.max(3, D.tiny[1] - 1), 1, 1, 0.5, sx * 0.036, hc + 0.012, 0.0985), MAT.FIXED, PART.HEAD, o.eye || 0x4a2c16);
      if (o.detail === 'hi') add('head', sph(0.0048, 8, 6, 1, 1, 0.5, sx * 0.036, hc + 0.012, 0.1035), MAT.FIXED, PART.HEAD, 0x050505);
      const brow = new THREE.BoxGeometry(0.036, 0.0075, 0.012); brow.rotateZ(sx * -0.14); brow.translate(sx * 0.037, hc + 0.039, 0.094);
      add('head', brow, MAT.HAIR, PART.HEAD);
    }
    // دهان (لب‌های خندان)
    const mouth = new THREE.TorusGeometry(0.02, 0.0058, o.detail === 'hi' ? 6 : 3, o.detail === 'hi' ? 16 : 6, Math.PI); mouth.rotateZ(Math.PI); mouth.rotateX(-0.25); mouth.translate(0, hc - 0.046, 0.094);
    add('head', mouth, MAT.FIXED, PART.HEAD, 0x9a3a36);
  } else {
    // از دور فقط دو نقطه تیره برای چشم
    for (const sx of [1, -1]) { const e = new THREE.BoxGeometry(0.02, 0.014, 0.01); e.translate(sx * 0.036, hc + 0.012, 0.098); add('head', e, MAT.FIXED, PART.HEAD, 0x1a1210); }
  }
  // مو
  if (o.hairStyle !== 'bald' && !o.helmet) {
    const hair = new THREE.SphereGeometry(0.111, D.head[0], Math.max(3, Math.round(D.head[1] * 0.6)), 0, Math.PI * 2, 0, Math.PI * 0.56);
    hair.scale(0.95, 1.08, 1.04); hair.rotateX(-0.42); hair.translate(0, hc + 0.008, -0.006);
    add('head', hair, MAT.HAIR, PART.HEAD);
    // موی بلند: در تماشاگران همیشه ساخته می‌شود و در شیدر برای مو کوتاه‌ها پنهان می‌شود
    if (o.hairStyle === 'long' || o.longHairPart) add('head', blob(0.1, D.small[0], D.small[1], 1.02, 1.35, 0.55, 0, hc - 0.05, -0.058), MAT.HAIR, o.longHairPart ? PART.LONGHAIR : PART.HEAD);
  }

  // دست‌ها (بازو، آستین، ساعد، کف دست، انگشتان، شست)
  for (const side of ['L', 'R']) {
    const up = side === 'L' ? PART.UARM_L : PART.UARM_R, lo = side === 'L' ? PART.LARM_L : PART.LARM_R;
    const sgn = side === 'L' ? 1 : -1;
    add('shoulder' + side, capsL(0.045, 0.2, 0, -0.14, 0), o.longSleeve ? MAT.SHIRT : MAT.SKIN, up);
    if (!D.boxes) add('shoulder' + side, cyl(0.059, 0.054, 0.15, D.limb + 1, 0, -0.065, 0), MAT.SHIRT, up);
    add('elbow' + side, capsL(0.038, 0.19, 0, -0.125, 0), o.longSleeve ? MAT.SHIRT : MAT.SKIN, lo);
    add('wrist' + side, blob(0.045, D.small[0], D.small[1], 0.42, 1.0, 0.85, 0, -0.045, 0), o.gloves ? MAT.FIXED : MAT.SKIN, lo, o.gloves || null);
    if (D.fingers) {
      for (const fz of [-0.026, -0.009, 0.009, 0.026]) add('wrist' + side, caps(0.0088, 0.042 + (Math.abs(fz) < 0.01 ? 0.008 : 0), 0, -0.104, fz, 6), o.gloves ? MAT.FIXED : MAT.SKIN, lo, o.gloves || null);
      const th = new THREE.CapsuleGeometry(0.0105, 0.035, 2, 6); th.rotateX(0.75); th.rotateZ(sgn * -0.2); th.translate(sgn * 0.006, -0.05, 0.042);
      add('wrist' + side, th, o.gloves ? MAT.FIXED : MAT.SKIN, lo, o.gloves || null);
    }
  }

  // پاها و کفش
  for (const side of ['L', 'R']) {
    add('hip' + side, capsL(0.073, 0.32, 0, -0.215, 0), MAT.PANTS, PART.LEGS);
    add('knee' + side, capsL(0.054, 0.33, 0, -0.21, 0), MAT.PANTS, PART.LEGS);
    add('ankle' + side, blob(0.055, D.small[0], D.small[1], 0.88, 0.6, 1.85, 0, -0.022, 0.045), MAT.FIXED, PART.LEGS, o.shoes || 0x1c1c22);
    if (o.detail === 'hi') { const sole = new THREE.BoxGeometry(0.098, 0.022, 0.22); sole.translate(0, -0.052, 0.045); add('ankle' + side, sole, MAT.FIXED, PART.LEGS, 0xe8e8e8); }
  }

  // کلاه ایمنی باز (برای رانندگان) - صورت دیده می‌شود
  if (o.helmet) {
    const hs = o.detail === 'hi' ? 28 : 14;
    const top = new THREE.SphereGeometry(0.128, hs, o.detail === 'hi' ? 10 : 5, 0, Math.PI * 2, 0, Math.PI * 0.36);
    top.translate(0, hc + 0.012, -0.004);
    add('head', top, MAT.FIXED, PART.HEAD, o.helmet);
    const gap = 1.0;
    const ring = new THREE.SphereGeometry(0.128, hs, o.detail === 'hi' ? 8 : 4, Math.PI / 2 + gap, Math.PI * 2 - gap * 2, Math.PI * 0.36, Math.PI * 0.27);
    ring.translate(0, hc + 0.012, -0.004);
    add('head', ring, MAT.FIXED, PART.HEAD, o.helmet);
    const stripe = new THREE.TorusGeometry(0.129, 0.012, 4, hs, Math.PI); stripe.rotateY(Math.PI / 2); stripe.translate(0, hc + 0.015, -0.004);
    add('head', stripe, MAT.FIXED, PART.HEAD, o.helmetStripe || 0xffffff);
    const gg = new THREE.TorusGeometry(0.105, 0.012, 4, Math.round(hs * 0.8), Math.PI * 0.7); gg.rotateX(Math.PI / 2); gg.rotateY(-Math.PI * 0.15); gg.translate(0, hc + 0.085, 0.02);
    add('head', gg, MAT.FIXED, PART.HEAD, 0x222222);
  }
  if (o.glasses) {
    for (const sx of [1, -1]) add('head', sph(0.024, 12, 8, 1.2, 0.8, 0.35, sx * 0.037, hc + 0.012, 0.102), MAT.FIXED, PART.HEAD, 0x050510);
    const br = new THREE.BoxGeometry(0.03, 0.006, 0.006); br.translate(0, hc + 0.018, 0.106); add('head', br, MAT.FIXED, PART.HEAD, 0x111111);
  }
  if (o.crown) {
    const band = new THREE.CylinderGeometry(0.098, 0.092, 0.05, 24, 1, true); band.translate(0, hc + 0.1, -0.006);
    add('head', band, MAT.FIXED, PART.HEAD, 0xffc400);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2; const cone = new THREE.ConeGeometry(0.018, 0.07, 6);
      cone.translate(Math.sin(a) * 0.095, hc + 0.155, Math.cos(a) * 0.095 - 0.006); add('head', cone, MAT.FIXED, PART.HEAD, 0xffc400);
      const gem = sph(0.012, 8, 6, 1, 1, 1, Math.sin(a) * 0.099, hc + 0.1, Math.cos(a) * 0.099 - 0.006); add('head', gem, MAT.FIXED, PART.HEAD, [0xff2244, 0x22aaff, 0x33ff88][k % 3]);
    }
  }
  return parts;
}

function makeJoints() {
  const g = (name, pos, parent) => { const o = new THREE.Group(); o.name = name; o.position.set(...pos); if (parent) parent.add(o); return o; };
  const root = new THREE.Group();
  const j = {};
  j.pelvis = g('pelvis', J.pelvis, root);
  j.spine = g('spine', J.spine, j.pelvis);
  j.neck = g('neck', J.neck, j.spine);
  j.head = g('head', J.head, j.neck);
  for (const s of ['L', 'R']) {
    j['shoulder' + s] = g('shoulder' + s, J['shoulder' + s], j.spine);
    j['elbow' + s] = g('elbow' + s, J.elbow, j['shoulder' + s]);
    j['wrist' + s] = g('wrist' + s, J.wrist, j['elbow' + s]);
    j['hip' + s] = g('hip' + s, J['hip' + s], j.pelvis);
    j['knee' + s] = g('knee' + s, J.knee, j['hip' + s]);
    j['ankle' + s] = g('ankle' + s, J.ankle, j['knee' + s]);
  }
  return { root, j };
}

export function applyPose(j, pose, p = {}) {
  for (const k in j) j[k].rotation.set(0, 0, 0);
  j.pelvis.position.set(...J.pelvis);
  if (pose === 'sit' || pose === 'drive' || pose === 'sitArmsDown') {
    j.pelvis.position.y = p.seatY ?? 0.46;
    j.hipL.rotation.x = j.hipR.rotation.x = -Math.PI / 2 - (pose === 'drive' ? 0.2 : 0);
    j.kneeL.rotation.x = j.kneeR.rotation.x = Math.PI / 2 - (pose === 'drive' ? 0.72 : 0);
    if (pose === 'drive') {
      const r = p.recline ?? 0.15;
      j.hipL.rotation.z = 0.07; j.hipR.rotation.z = -0.07; j.ankleL.rotation.x = j.ankleR.rotation.x = -0.35;
      j.spine.rotation.x = -r; j.neck.rotation.x = r * 0.55; j.head.rotation.x = r * 0.3;
      j.hipL.rotation.x += -r * 0.3; j.hipR.rotation.x += -r * 0.3;
      if (p.gas !== undefined) { j.ankleR.rotation.x = -0.35 + p.gas * 0.3; }
    }
  }
  if (pose === 'sit') {
    j.shoulderL.rotation.x = j.shoulderR.rotation.x = -0.3;
    j.elbowL.rotation.x = j.elbowR.rotation.x = -1.25;
  }
  if (pose === 'drive') {
    const steer = p.steer || 0;
    j.shoulderL.rotation.x = -1.05 + steer * 0.22; j.shoulderR.rotation.x = -1.05 - steer * 0.22;
    j.shoulderL.rotation.z = -0.04 - steer * 0.05; j.shoulderR.rotation.z = 0.04 - steer * 0.05;
    j.elbowL.rotation.x = -0.7 - steer * 0.18; j.elbowR.rotation.x = -0.7 + steer * 0.18;
    j.wristL.rotation.y = -0.35; j.wristR.rotation.y = 0.35;
    j.head.rotation.y = steer * 0.3;
  }
  if (pose === 'stand') {
    j.shoulderL.rotation.z = 0.06; j.shoulderR.rotation.z = -0.06;
    j.elbowL.rotation.x = j.elbowR.rotation.x = -0.12;
  }
}

const matCache = new Map();
function fixedMat(hex) {
  if (!matCache.has(hex)) matCache.set(hex, new THREE.MeshStandardMaterial({ color: hex, roughness: hex === 0xf3f0ea ? 0.25 : 0.5, metalness: hex === 0xffc400 ? 0.9 : 0 }));
  return matCache.get(hex);
}

export const PATTERN_UNIFORMS = { uTime: { value: 0 } };

// متریال طرح‌دار: رنگین‌کمانی متحرک (رئیس) یا آتشین قرمز-نارنجی-زرد
export function patternMaterial(kind, base = {}) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05, ...base });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = PATTERN_UNIFORMS.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPatP; varying vec3 vPatL;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvPatP = (modelMatrix * vec4(transformed,1.0)).xyz; vPatL = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vPatP; varying vec3 vPatL; uniform float uTime;
      vec3 hsv2rgb(vec3 c){ vec4 K = vec4(1., 2./3., 1./3., 3.); vec3 p = abs(fract(c.xxx + K.xyz) * 6. - K.www); return c.z * mix(K.xxx, clamp(p - K.xxx, 0., 1.), c.y); }`)
      .replace('#include <color_fragment>', kind === 'rainbow' ? `#include <color_fragment>
        float hh = fract(vPatP.y * 1.4 + vPatP.x * 0.6 + vPatP.z * 0.6 - uTime * 0.45);
        vec3 rb = hsv2rgb(vec3(hh, 0.9, 1.0)); diffuseColor.rgb = pow(rb, vec3(2.2));` : `#include <color_fragment>
        float ff = fract(vPatL.y * 9.0 + sin(vPatL.x * 30.0 + vPatL.z * 20.0) * 0.18);
        vec3 c1 = vec3(1.0, 0.02, 0.02), c2 = vec3(1.0, 0.2, 0.0), c3 = vec3(1.0, 0.62, 0.0);
        vec3 fc = ff < 0.333 ? mix(c1, c2, smoothstep(0.2, 0.333, ff)) : (ff < 0.666 ? mix(c2, c3, smoothstep(0.53, 0.666, ff)) : mix(c3, c1, smoothstep(0.86, 1.0, ff)));
        diffuseColor.rgb = fc;`)
      .replace('#include <emissivemap_fragment>', kind === 'rainbow' ? '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.45;' : '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.08;');
  };
  mat.customProgramCacheKey = () => 'pattern-' + kind;
  return mat;
}

// انسان با اسکلت (راننده، رئیس کل، داور)
export function buildHuman(opts = {}) {
  const o = { detail: 'hi', skin: 0xe0b08a, shirt: 0x2255cc, pants: 0x223344, hair: 0x2a1a10, hairStyle: 'short', belly: 0.01, build: 1, ...opts };
  const { root, j } = makeJoints();
  const skinM = new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.62 });
  const shirtM = o.shirtMat || new THREE.MeshStandardMaterial({ color: o.shirt, roughness: 0.78 });
  const pantsM = o.pantsMat || new THREE.MeshStandardMaterial({ color: o.pants, roughness: 0.82 });
  const hairM = new THREE.MeshStandardMaterial({ color: o.hair, roughness: 0.7 });
  const mats = [skinM, shirtM, pantsM, hairM];
  for (const p of bodyParts(o)) {
    const m = p.mat === MAT.FIXED ? fixedMat(p.color) : mats[p.mat];
    const mesh = new THREE.Mesh(p.geo, m);
    mesh.castShadow = true; mesh.receiveShadow = false;
    j[p.joint].add(mesh);
  }
  // ادغام قطعات هر مفصل: متریال‌های ساده در یک متریال مشترک (کمترین draw call)
  for (const k in j) {
    const joint = j[k];
    const byMat = new Map();
    for (const c of [...joint.children]) {
      if (!c.isMesh) continue;
      const pbr = pbrEligible(c.material);
      const key = pbr ? 'pbr' : c.material;
      if (!byMat.has(key)) byMat.set(key, { pbr, mat: pbr ? vertexPBRMaterial() : c.material, geos: [] });
      c.updateMatrix(); const g = c.geometry.clone(); g.applyMatrix4(c.matrix);
      if (pbr) { const col = c.material.color; fillAttr(g, 'color', [col.r, col.g, col.b]); fillAttr(g, 'aMR', [c.material.metalness, c.material.roughness]); }
      byMat.get(key).geos.push(g); joint.remove(c);
    }
    for (const [, b] of byMat) { const mesh = new THREE.Mesh(mergeGeos(b.geos, b.pbr ? ['position', 'normal', 'uv', 'color', 'aMR'] : ['position', 'normal', 'uv']), b.mat); mesh.castShadow = true; joint.add(mesh); }
  }
  const human = {
    root, j, opts: o, walkT: 0,
    pose(name, p) { applyPose(j, name, p); },
    walk(dt, speed = 1.4) {
      this.walkT += dt * speed * 2.6;
      const t = this.walkT; const s = Math.sin(t);
      applyPose(j, 'stand');
      j.hipL.rotation.x = s * 0.45; j.hipR.rotation.x = -s * 0.45;
      j.kneeL.rotation.x = Math.max(0, -Math.cos(t)) * 0.7; j.kneeR.rotation.x = Math.max(0, Math.cos(t)) * 0.7;
      j.shoulderL.rotation.x = -s * 0.4; j.shoulderR.rotation.x = s * 0.4;
      j.elbowL.rotation.x = j.elbowR.rotation.x = -0.35;
      j.pelvis.position.y = J.pelvis[1] - 0.02 + Math.abs(Math.cos(t)) * 0.03;
    },
    cheer(t) {
      applyPose(j, 'stand');
      j.shoulderL.rotation.x = j.shoulderR.rotation.x = -2.7 + Math.sin(t * 6) * 0.15;
      j.shoulderL.rotation.z = 0.35 + Math.sin(t * 5) * 0.2; j.shoulderR.rotation.z = -0.35 - Math.sin(t * 5 + 1) * 0.2;
      j.elbowL.rotation.x = j.elbowR.rotation.x = -0.3;
      j.pelvis.position.y = J.pelvis[1] + Math.abs(Math.sin(t * 4)) * 0.06;
    },
    lookAtWorld(target, maxYaw = 1.1) {
      const hp = new THREE.Vector3(); j.neck.getWorldPosition(hp);
      const inv = new THREE.Matrix4().copy(j.neck.matrixWorld).invert();
      const local = target.clone().applyMatrix4(inv);
      const yaw = Math.max(-maxYaw, Math.min(maxYaw, Math.atan2(local.x, local.z)));
      const pitch = Math.max(-0.4, Math.min(0.5, -Math.atan2(local.y, Math.hypot(local.x, local.z)))) * 0.7;
      j.head.rotation.y += (yaw - j.head.rotation.y) * 0.15;
      j.head.rotation.x += (pitch - j.head.rotation.x) * 0.15;
    }
  };
  return human;
}

// هندسه ادغام‌شده تماشاگر نشسته/ایستاده برای Instancing
const fanGeoCache = new Map();
export function fanGeometry(detail = 'mid', pose = 'sit') {
  const key = detail + pose;
  if (fanGeoCache.has(key)) return fanGeoCache.get(key);
  const o = { detail, hairStyle: 'short', longHairPart: true, belly: 0.015 };
  const { root, j } = makeJoints();
  applyPose(j, pose === 'sit' ? 'sitArmsDown' : 'stand');
  // بازوها صاف به پایین برای چرخش در شیدر
  for (const s of ['L', 'R']) { j['shoulder' + s].rotation.set(0, 0, 0); j['elbow' + s].rotation.set(0, 0, 0); }
  root.updateMatrixWorld(true);
  const geos = [];
  for (const p of bodyParts(o)) {
    const g = p.geo.clone();
    g.applyMatrix4(j[p.joint].matrixWorld);
    const keep = new THREE.BufferGeometry();
    keep.setAttribute('position', g.attributes.position); keep.setAttribute('normal', g.attributes.normal);
    if (g.index) keep.setIndex(g.index);
    fillAttr(keep, 'aPart', [p.part]);
    fillAttr(keep, 'aMat', [p.mat]);
    const c = new THREE.Color(p.color ?? 0xffffff).convertSRGBToLinear();
    fillAttr(keep, 'color', [c.r, c.g, c.b]);
    geos.push(keep);
  }
  const merged = mergeGeos(geos, ['position', 'normal', 'aPart', 'aMat', 'color']);
  const w = (n) => { const v = new THREE.Vector3(); j[n].getWorldPosition(v); return v; };
  merged.userData.pivots = { sL: w('shoulderL'), sR: w('shoulderR'), eL: w('elbowL'), eR: w('elbowR'), neck: w('head'), hip: w('pelvis') };
  fanGeoCache.set(key, merged);
  return merged;
}

// متریال تماشاگران با انیمیشن تشویق، دنبال کردن ماشین با سر، و رنگ هر نفر
export function fanMaterial(pivots) {
  const uniforms = {
    uTime: { value: 0 }, uExcite: { value: 0 }, uFocus: { value: new THREE.Vector3() },
    uSL: { value: pivots.sL }, uSR: { value: pivots.sR }, uEL: { value: pivots.eL }, uER: { value: pivots.eR },
    uNeck: { value: pivots.neck }, uHip: { value: pivots.hip }
  };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 });
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute float aPart; attribute float aMat;
      attribute vec3 iSkin; attribute vec3 iShirt; attribute vec3 iPants; attribute vec3 iHair; attribute vec4 iAnim;
      uniform float uTime; uniform float uExcite; uniform vec3 uFocus;
      uniform vec3 uSL; uniform vec3 uSR; uniform vec3 uEL; uniform vec3 uER; uniform vec3 uNeck; uniform vec3 uHip;
      varying vec3 vFanP; varying float vFanPat; varying float vFanShirt;
      mat3 fRX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
      mat3 fRY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
      mat3 fRZ(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
    `).replace('#include <beginnormal_vertex>', `
      vec3 objectNormal = vec3(normal);
      vec3 animPos = position;
      {
        float ph = iAnim.x; float energy = iAnim.y; float style = iAnim.z;
        float t = uTime * (0.85 + 0.35 * energy) + ph * 37.0;
        float ex = clamp(uExcite * (0.55 + 0.6 * energy) + 0.05 * sin(t * 0.37 + ph * 9.0), 0.0, 1.0);
        float fI = -0.3, eI = -1.25;
        float sF, eB, zL, zR;
        if (style < 0.5) { float cl = sin(t * 13.0); sF = -1.05; eB = -0.85; zL = -0.24 - 0.12 * cl; zR = 0.24 + 0.12 * cl; }
        else if (style < 1.5) { sF = -2.75 + 0.15 * sin(t * 5.0); eB = -0.25; zL = 0.35 + 0.25 * sin(t * 6.0); zR = -0.35 - 0.25 * sin(t * 6.0 + 1.0); }
        else { sF = -2.3 + 0.55 * sin(t * 8.0); eB = -0.6 - 0.3 * sin(t * 8.0); zL = 0.15; zR = -0.15; }
        float fL = mix(fI, sF, ex), eL = mix(eI, eB, ex), fR = fL, eR = eL;
        float aL = mix(0.04, zL, ex), aR = mix(-0.04, zR, ex);
        if (style > 1.5) { fL = mix(fI, -0.9, ex); eL = mix(eI, -1.1, ex); aL = 0.1; }
        mat3 R = mat3(1.0);
        float part = aPart;
        if (part > 6.5) { part = 2.0; if (floor(iAnim.w / 10.0 + 0.01) < 0.5) animPos = uNeck; }
        if (part > 2.5 && part < 4.5) {
          mat3 Rs = fRZ(aL) * fRX(fL);
          vec3 rel = animPos - uSL;
          if (part > 3.5) { mat3 Re = fRX(eL); rel = Re * (animPos - uEL) + (uEL - uSL); R = Rs * Re; } else { R = Rs; }
          animPos = uSL + Rs * rel;
        } else if (part > 4.5) {
          mat3 Rs = fRZ(aR) * fRX(fR);
          vec3 rel = animPos - uSR;
          if (part > 5.5) { mat3 Re = fRX(eR); rel = Re * (animPos - uER) + (uER - uSR); R = Rs * Re; } else { R = Rs; }
          animPos = uSR + Rs * rel;
        } else if (part > 1.5) {
          mat4 im = modelMatrix * instanceMatrix;
          vec3 wp = (im * vec4(uNeck, 1.0)).xyz;
          vec3 dl = transpose(mat3(im)) * (uFocus - wp);
          float yaw = clamp(atan(dl.x, dl.z), -1.15, 1.15) + 0.12 * sin(t * 0.5);
          float pit = clamp(-atan(dl.y, length(dl.xz)), -0.35, 0.45) * 0.6;
          mat3 Rh = fRY(yaw) * fRX(pit);
          animPos = uNeck + Rh * (animPos - uNeck);
          R = Rh;
        }
        if (part > 0.5) {
          float lean = 0.12 * ex * (0.5 + 0.5 * sin(t * 3.0));
          mat3 Rt = fRX(lean);
          float bounce = ex * 0.045 * abs(sin(t * 7.0));
          animPos = uHip + Rt * (animPos - uHip) + vec3(0.0, bounce, 0.0);
          R = Rt * R;
        }
        objectNormal = R * objectNormal;
      }
    `).replace('#include <begin_vertex>', 'vec3 transformed = animPos;')
      .replace('#include <color_vertex>', `
        vColor = color;
        if (aMat < 0.5) vColor = iSkin; else if (aMat < 1.5) vColor = iShirt; else if (aMat < 2.5) vColor = iPants; else if (aMat < 3.5) vColor = iHair;
        vFanP = position; vFanPat = mod(iAnim.w, 10.0); vFanShirt = (aMat > 0.5 && aMat < 1.5) ? 1.0 : 0.0;
      `);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFanP; varying float vFanPat; varying float vFanShirt;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vFanShirt > 0.5 && vFanPat > 0.5) {
          if (vFanPat < 1.5) {
            float ff = fract(vFanP.y * 7.0 + sin(vFanP.x * 25.0 + vFanP.z * 18.0) * 0.14);
            vec3 c1 = vec3(1.0, 0.02, 0.02), c2 = vec3(1.0, 0.2, 0.0), c3 = vec3(1.0, 0.62, 0.0);
            diffuseColor.rgb = ff < 0.333 ? mix(c1, c2, smoothstep(0.22, 0.333, ff)) : (ff < 0.666 ? mix(c2, c3, smoothstep(0.55, 0.666, ff)) : mix(c3, c1, smoothstep(0.88, 1.0, ff)));
          } else {
            float b = step(0.55, fract(vFanP.y * 5.0)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85), b * 0.85);
          }
        }`);
  };
  mat.customProgramCacheKey = () => 'fan-v2';
  return mat;
}

const SKINS = [0xf1c9a5, 0xe0ac7e, 0xc68a5e, 0x9b6a45, 0x6e4a2e, 0xf6d5bd, 0xd9a173];
const HAIRS = [0x1a120c, 0x2c1b10, 0x5a3a1e, 0x8a5a2b, 0xc9a35a, 0x0d0d0d, 0x7a7a7a, 0xa0391e];
const PANTS = [0x1d2a44, 0x2b2b30, 0x3a4a6a, 0x5b4a36, 0x15151a, 0x6b6f75, 0x24385e];

// ساخت گروه تماشاگران: یک InstancedMesh برای هر سطح جزئیات (مو کوتاه و بلند در شیدر)
// نزدیک: جزئیات متوسط، دور: بسیار سبک، خیلی دور: پنهان
export function createCrowd(placements, { shirtFn, patternFn, rng = mulberry32(1), pose = 'sit', nearDist = 45, farDist = 320, qualityHi = true }) {
  const group = new THREE.Group();
  const n = placements.length;
  const geoMid = fanGeometry('mid', pose);
  const mat = fanMaterial(geoMid.userData.pivots);
  const iSkin = new Float32Array(n * 3), iShirt = new Float32Array(n * 3), iPants = new Float32Array(n * 3), iHair = new Float32Array(n * 3), iAnim = new Float32Array(n * 4);
  const c = new THREE.Color();
  placements.forEach((p, i) => {
    c.setHex(SKINS[(rng() * SKINS.length) | 0]).convertSRGBToLinear(); iSkin.set([c.r, c.g, c.b], i * 3);
    c.set(shirtFn(p, rng)).convertSRGBToLinear(); iShirt.set([c.r, c.g, c.b], i * 3);
    c.setHex(PANTS[(rng() * PANTS.length) | 0]).convertSRGBToLinear(); iPants.set([c.r, c.g, c.b], i * 3);
    c.setHex(HAIRS[(rng() * HAIRS.length) | 0]).convertSRGBToLinear(); iHair.set([c.r, c.g, c.b], i * 3);
    const pat = patternFn ? patternFn(p, rng) : 0; const longHair = rng() < 0.38 ? 1 : 0;
    iAnim.set([rng(), rng(), Math.floor(rng() * 3), pat + longHair * 10], i * 4);
  });
  const attrs = {
    iSkin: new THREE.InstancedBufferAttribute(iSkin, 3), iShirt: new THREE.InstancedBufferAttribute(iShirt, 3),
    iPants: new THREE.InstancedBufferAttribute(iPants, 3), iHair: new THREE.InstancedBufferAttribute(iHair, 3), iAnim: new THREE.InstancedBufferAttribute(iAnim, 4)
  };
  const mk = (detail) => {
    const g = fanGeometry(detail, pose).clone();
    for (const k in attrs) g.setAttribute(k, attrs[k]);
    const m = new THREE.InstancedMesh(g, mat, n);
    m.castShadow = false; m.receiveShadow = false;
    return m;
  };
  const lo = mk('lo');
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  placements.forEach((p, i) => {
    q.setFromAxisAngle(up, p.yaw);
    const s = p.scale ?? (0.92 + rng() * 0.16);
    sc.set(s, s, s); mtx.compose(p.pos, q, sc); lo.setMatrixAt(i, mtx);
  });
  lo.computeBoundingSphere(); group.add(lo);
  let mid = null;
  if (qualityHi) { mid = mk('mid'); mid.instanceMatrix = lo.instanceMatrix; mid.boundingSphere = lo.boundingSphere.clone(); mid.visible = false; group.add(mid); }
  const center = new THREE.Vector3();
  placements.forEach((p) => center.add(p.pos)); center.divideScalar(Math.max(1, n));
  const radius = lo.boundingSphere.radius;
  return {
    group, mat, meshes: [{ hi: mid, lo }], center, count: n,
    update(time, excite, focus, camPos) {
      const d = camPos.distanceTo(center) - radius;
      const near = !!mid && d < nearDist, show = d < farDist;
      if (mid) mid.visible = near;
      lo.visible = show && !near;
      if (!show) return;
      const u = mat.userData.uniforms;
      u.uTime.value = time; u.uExcite.value = excite; u.uFocus.value.copy(focus);
    }
  };
}
