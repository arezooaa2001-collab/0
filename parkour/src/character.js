// شخصیت انسانی رویه‌ای با اسکلت (SkinnedMesh) و انیمیشن رویه‌ای: دویدن، پرش، پشتک، سُر، دیواردوی، بالا رفتن، سقوط، جشن
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, lerp, damp, TAU, smoothstep } from './util.js';

const V3 = THREE.Vector3;
// شاخص مفاصل ژست
const J = { pivot: 0, pelvis: 1, spine: 2, chest: 3, neck: 4, head: 5, armL: 6, elbowL: 7, handL: 8, armR: 9, elbowR: 10, handR: 11, legL: 12, kneeL: 13, footL: 14, legR: 15, kneeR: 16, footR: 17 };
const NJ = 18;
const PY = NJ * 3; // جابجایی عمودی بدن
const PZ = NJ * 3 + 1; // جابجایی جلو
const PLEN = NJ * 3 + 2;

const BONE_DEFS = [
  // name, parent, position
  ['root', -1, [0, 0, 0]],
  ['pivot', 0, [0, 0.95, 0]],
  ['pelvis', 1, [0, 0, 0]],
  ['spine', 2, [0, 0.1, 0]],
  ['chest', 3, [0, 0.2, 0]],
  ['neck', 4, [0, 0.2, 0]],
  ['head', 5, [0, 0.08, 0]],
  ['armL', 4, [0.185, 0.15, 0]],
  ['elbowL', 7, [0, -0.27, 0]],
  ['handL', 8, [0, -0.25, 0]],
  ['armR', 4, [-0.185, 0.15, 0]],
  ['elbowR', 10, [0, -0.27, 0]],
  ['handR', 11, [0, -0.25, 0]],
  ['legL', 2, [0.1, -0.05, 0]],
  ['kneeL', 13, [0, -0.43, 0]],
  ['footL', 14, [0, -0.42, 0]],
  ['legR', 2, [-0.1, -0.05, 0]],
  ['kneeR', 16, [0, -0.43, 0]],
  ['footR', 17, [0, -0.42, 0]],
];
const BI = Object.fromEntries(BONE_DEFS.map((b, i) => [b[0], i]));

function capsule(r, len, radial = 10) {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, radial);
  g.translate(0, -len / 2, 0);
  return g;
}
function rbox(w, h, d, r) {
  return new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
}

export class Character {
  constructor(look, opts = {}) {
    this.look = look;
    this.opts = opts;
    this.root = new THREE.Group();
    this.build(look);
    this.phase = Math.random() * TAU;
    this.t = Math.random() * 10;
    this.w = { idle: 1, run: 0, air: 0, slide: 0, wall: 0, mantle: 0, knock: 0, cele: 0 };
    this.flipT = -1;
    this.landT = 0;
    this.landAmt = 0;
    this.lead = 1;
    this.prevGrounded = true;
    this.knockRot = new V3();
    this.waveT = -1;
    this.pose = new Float32Array(PLEN);
    this.cur = new Float32Array(PLEN);
    this.tmp = new Float32Array(PLEN);
    this.lookYaw = 0;
    this.stepCb = null;
    this.lastStepPhase = 0;
    if (opts.scarf) this.buildScarf(look.accent);
  }

  build(look) {
    const bones = BONE_DEFS.map(([name]) => {
      const b = new THREE.Bone();
      b.name = name;
      return b;
    });
    BONE_DEFS.forEach(([, parent, p], i) => {
      bones[i].position.set(...p);
      if (parent >= 0) bones[parent].add(bones[i]);
    });
    this.bones = bones;
    // ماتریس جهانی هر استخوان در حالت ایستاده
    const world = [];
    BONE_DEFS.forEach(([, parent, p], i) => {
      const m = new THREE.Matrix4().makeTranslation(...p);
      world[i] = parent >= 0 ? world[parent].clone().multiply(m) : m;
    });

    const C = (h) => new THREE.Color(h);
    const skin = C(look.skin), shirt = C(look.shirt), pants = C(look.pants), shoes = C(look.shoes), hair = C(look.hair), accent = C(look.accent);
    const dark = C('#15161c');
    const parts = [], glow = [];
    const add = (bone, geo, color, mtx, list = parts) => list.push({ bone: BI[bone], geo, color, mtx });
    const T = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
      new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(sx, sy, sz));

    // لگن و شورت
    add('pelvis', rbox(0.31, 0.18, 0.2, 0.06), pants, T(0, -0.03, 0));
    add('pelvis', rbox(0.3, 0.035, 0.2, 0.015), dark, T(0, 0.05, 0)); // کمربند
    // تنه
    add('spine', rbox(0.29, 0.23, 0.18, 0.07), shirt, T(0, 0.1, 0));
    add('chest', rbox(0.37, 0.27, 0.21, 0.08), shirt, T(0, 0.1, 0.005));
    add('chest', rbox(0.2, 0.08, 0.06, 0.02), shirt.clone().multiplyScalar(0.8), T(0, 0.2, -0.1)); // یقه پشت (کلاه هودی)
    add('chest', rbox(0.022, 0.24, 0.205, 0.01), accent, T(0.1, 0.08, 0.002), glow); // نوار نورانی
    add('chest', rbox(0.022, 0.24, 0.205, 0.01), accent, T(-0.1, 0.08, 0.002), glow);
    if (look.backpack !== false) add('chest', rbox(0.22, 0.24, 0.09, 0.04), dark.clone().lerp(shirt, 0.3), T(0, 0.07, -0.135));
    // گردن و سر
    add('neck', new THREE.CylinderGeometry(0.048, 0.055, 0.12, 10), skin, T(0, 0.04, 0));
    add('head', new THREE.SphereGeometry(0.118, 20, 16), skin, T(0, 0.105, 0.005, 0, 0, 0, 0.94, 1.08, 1));
    add('head', new THREE.SphereGeometry(0.03, 8, 6), skin, T(0.112, 0.1, -0.005, 0, 0, 0, 0.5, 1, 0.8)); // گوش
    add('head', new THREE.SphereGeometry(0.03, 8, 6), skin, T(-0.112, 0.1, -0.005, 0, 0, 0, 0.5, 1, 0.8));
    add('head', new THREE.SphereGeometry(0.018, 8, 6), skin.clone().multiplyScalar(0.95), T(0, 0.085, 0.118)); // بینی
    add('head', new THREE.SphereGeometry(0.019, 10, 8), dark, T(0.042, 0.115, 0.102, 0, 0, 0, 1, 1.25, 0.6)); // چشم
    add('head', new THREE.SphereGeometry(0.019, 10, 8), dark, T(-0.042, 0.115, 0.102, 0, 0, 0, 1, 1.25, 0.6));
    add('head', new THREE.SphereGeometry(0.0065, 6, 4), C('#ffffff'), T(0.047, 0.122, 0.112), glow);
    add('head', new THREE.SphereGeometry(0.0065, 6, 4), C('#ffffff'), T(-0.037, 0.122, 0.112), glow);
    add('head', rbox(0.035, 0.008, 0.01, 0.003), hair, T(0.043, 0.146, 0.106, 0, 0, -0.12)); // ابرو
    add('head', rbox(0.035, 0.008, 0.01, 0.003), hair, T(-0.043, 0.146, 0.106, 0, 0, 0.12));
    add('head', rbox(0.04, 0.007, 0.01, 0.003), skin.clone().multiplyScalar(0.7), T(0, 0.052, 0.108)); // دهان
    // مو
    const hs = look.hairStyle || 'short';
    add('head', new THREE.SphereGeometry(0.126, 18, 12, 0, TAU, 0, Math.PI * 0.55), hair, T(0, 0.118, -0.006, -0.25, 0, 0, 0.98, 1.1, 1.05));
    if (hs === 'spiky') {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU;
        add('head', new THREE.ConeGeometry(0.035, 0.09, 6), hair, T(Math.sin(a) * 0.06, 0.225, Math.cos(a) * 0.05 - 0.02, Math.cos(a) * 0.6 - 0.3, 0, -Math.sin(a) * 0.6));
      }
    } else if (hs === 'ponytail') {
      add('head', capsule(0.035, 0.16), hair, T(0, 0.16, -0.12, 0.5, 0, 0));
      add('head', new THREE.TorusGeometry(0.03, 0.01, 6, 12), accent, T(0, 0.17, -0.12, 1.2, 0, 0), glow);
    } else if (hs === 'bun') {
      add('head', new THREE.SphereGeometry(0.06, 12, 10), hair, T(0, 0.24, -0.05));
    } else if (hs === 'messy') {
      for (let i = 0; i < 6; i++) add('head', new THREE.SphereGeometry(0.045, 8, 6), hair, T((i % 3 - 1) * 0.06, 0.2 + (i % 2) * 0.02, -0.02 - Math.floor(i / 3) * 0.05));
    }
    if (look.hat === 'cap') {
      add('head', new THREE.SphereGeometry(0.13, 16, 10, 0, TAU, 0, Math.PI * 0.5), accent.clone().lerp(shirt, 0.5), T(0, 0.13, 0, -0.1));
      add('head', rbox(0.2, 0.015, 0.11, 0.006), accent.clone().lerp(shirt, 0.5), T(0, 0.15, 0.13, -0.15));
    } else if (look.hat === 'beanie') {
      add('head', new THREE.SphereGeometry(0.132, 16, 10, 0, TAU, 0, Math.PI * 0.52), accent.clone().multiplyScalar(0.6), T(0, 0.13, -0.005, -0.15, 0, 0, 1, 1.12, 1));
      add('head', new THREE.TorusGeometry(0.12, 0.022, 8, 24), accent.clone().multiplyScalar(0.5), T(0, 0.135, -0.01, Math.PI / 2 - 0.15));
      add('head', new THREE.SphereGeometry(0.035, 8, 6), accent, T(0, 0.275, -0.04));
    } else if (look.hat === 'headphones') {
      add('head', new THREE.TorusGeometry(0.13, 0.014, 6, 24, Math.PI), dark, T(0, 0.12, 0));
      add('head', new THREE.CylinderGeometry(0.045, 0.045, 0.035, 14), dark, T(0.122, 0.1, 0, 0, 0, Math.PI / 2));
      add('head', new THREE.CylinderGeometry(0.045, 0.045, 0.035, 14), dark, T(-0.122, 0.1, 0, 0, 0, Math.PI / 2));
      add('head', new THREE.TorusGeometry(0.035, 0.006, 6, 16), accent, T(0.142, 0.1, 0, 0, Math.PI / 2, 0), glow);
      add('head', new THREE.TorusGeometry(0.035, 0.006, 6, 16), accent, T(-0.142, 0.1, 0, 0, Math.PI / 2, 0), glow);
    }
    // دست‌ها
    for (const s of ['L', 'R']) {
      const sg = s === 'L' ? 1 : -1;
      add('arm' + s, new THREE.SphereGeometry(0.062, 12, 8), shirt, T(0, -0.01, 0)); // شانه
      add('arm' + s, capsule(0.056, 0.21), shirt, T(0, -0.015, 0));
      add('elbow' + s, capsule(0.047, 0.19), skin, T(0, -0.01, 0));
      add('elbow' + s, new THREE.CylinderGeometry(0.047, 0.047, 0.045, 10), accent, T(0, -0.2, 0), glow); // مچ‌بند
      add('hand' + s, rbox(0.07, 0.085, 0.04, 0.018), skin, T(0, -0.045, 0.006));
      add('hand' + s, capsule(0.014, 0.035), skin, T(-0.03 * sg, -0.02, 0.025, 0.4, 0, -0.6 * sg));
      // پاها
      add('leg' + s, capsule(0.079, 0.35), pants, T(0, -0.02, 0));
      add('knee' + s, capsule(0.063, 0.33), pants, T(0, -0.01, 0));
      add('knee' + s, new THREE.SphereGeometry(0.06, 10, 8), pants.clone().multiplyScalar(0.8), T(0, 0, 0.02)); // زانوبند
      add('foot' + s, rbox(0.1, 0.085, 0.25, 0.035), shoes, T(0, -0.012, 0.05));
      add('foot' + s, rbox(0.105, 0.022, 0.255, 0.01), accent, T(0, -0.055, 0.05), glow); // کفی نورانی
      add('foot' + s, rbox(0.102, 0.03, 0.08, 0.012), dark, T(0, 0.012, -0.045));
    }

    const assemble = (list) => {
      const geos = [];
      for (const pt of list) {
        let g = pt.geo.index ? pt.geo.toNonIndexed() : pt.geo;
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
        g.applyMatrix4(world[pt.bone].clone().multiply(pt.mtx));
        const n = g.attributes.position.count;
        const col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) {
          col[i * 3] = pt.color.r; col[i * 3 + 1] = pt.color.g; col[i * 3 + 2] = pt.color.b;
          si[i * 4] = pt.bone;
          sw[i * 4] = 1;
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
        g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
        geos.push(g);
      }
      return mergeGeometries(geos, false);
    };
    const bodyGeo = assemble(parts);
    const glowGeo = assemble(glow);
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.04 });
    this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.2, 2.2, 2.2) });
    this.body = new THREE.SkinnedMesh(bodyGeo, this.mat);
    this.body.add(bones[0]);
    this.skeleton = new THREE.Skeleton(bones);
    this.body.bind(this.skeleton);
    this.glow = new THREE.SkinnedMesh(glowGeo, this.glowMat);
    this.glow.bind(this.skeleton, this.body.matrixWorld);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.body.frustumCulled = false;
    this.glow.frustumCulled = false;
    this.root.add(this.body, this.glow);
    this.jointBones = [
      bones[BI.pivot], bones[BI.pelvis], bones[BI.spine], bones[BI.chest], bones[BI.neck], bones[BI.head],
      bones[BI.armL], bones[BI.elbowL], bones[BI.handL], bones[BI.armR], bones[BI.elbowR], bones[BI.handR],
      bones[BI.legL], bones[BI.kneeL], bones[BI.footL], bones[BI.legR], bones[BI.kneeR], bones[BI.footR],
    ];
  }

  buildScarf(color) {
    const N = 10;
    this.scarfN = N;
    this.scarfPts = Array.from({ length: N }, () => new V3());
    this.scarfPrev = Array.from({ length: N }, () => new V3());
    this.scarfInit = false;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 2 * 3);
    const idx = [];
    for (let i = 0; i < N - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const uv = new Float32Array(N * 2 * 2);
    for (let i = 0; i < N; i++) { uv[i * 4] = 0; uv[i * 4 + 1] = i / (N - 1); uv[i * 4 + 2] = 1; uv[i * 4 + 3] = i / (N - 1); }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.scarfMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), emissive: new THREE.Color(color), emissiveIntensity: 0.5, side: THREE.DoubleSide, roughness: 0.7 });
    this.scarf = new THREE.Mesh(geo, this.scarfMat);
    this.scarf.frustumCulled = false;
    this.scarf.castShadow = true;
  }

  // موقعیت جهانی سر (برای برچسب نام)
  headWorld(out) {
    return this.bones[BI.head].getWorldPosition(out);
  }
  boneWorld(name, out) {
    return this.bones[BI[name]].getWorldPosition(out);
  }
  triggerFlip() {
    this.flipT = 0;
  }
  triggerLand(impact) {
    this.landT = 1;
    this.landAmt = clamp(impact, 0.15, 1);
  }
  wave() {
    this.waveT = 0;
  }

  // ---------- ژست‌ها ----------
  setJ(P, j, x, y = 0, z = 0) {
    P[j * 3] = x; P[j * 3 + 1] = y; P[j * 3 + 2] = z;
  }
  poseIdle(P) {
    const t = this.t;
    const br = Math.sin(t * 1.9);
    this.setJ(P, J.spine, 0.03 + br * 0.012);
    this.setJ(P, J.chest, 0.02 + br * 0.02, Math.sin(t * 0.5) * 0.05);
    this.setJ(P, J.pelvis, 0, 0, Math.sin(t * 0.6) * 0.035);
    this.setJ(P, J.head, -0.02 + Math.sin(t * 0.7) * 0.04, this.lookYaw + Math.sin(t * 0.33) * 0.35 * smoothstep(0.3, 1, Math.sin(t * 0.21)), 0);
    this.setJ(P, J.armL, 0.06 + br * 0.02, 0.1, 0.12 + br * 0.015);
    this.setJ(P, J.armR, 0.06 + br * 0.02, -0.1, -0.12 - br * 0.015);
    this.setJ(P, J.elbowL, -0.25);
    this.setJ(P, J.elbowR, -0.25);
    this.setJ(P, J.handL, 0, 0, 0.1);
    this.setJ(P, J.handR, 0, 0, -0.1);
    const sh = Math.sin(t * 0.6) * 0.03;
    this.setJ(P, J.legL, -0.04, 0.05, 0.04 + sh);
    this.setJ(P, J.legR, 0.02, -0.05, -0.04 + sh);
    this.setJ(P, J.kneeL, 0.08);
    this.setJ(P, J.kneeR, 0.04);
    this.setJ(P, J.footL, -0.04, 0, -0.04 - sh);
    this.setJ(P, J.footR, -0.02, 0, 0.04 - sh);
    P[PY] = -0.01 + br * 0.004;
  }
  poseRun(P, k, sn, phase, lean) {
    const s = Math.sin(phase), c = Math.cos(phase);
    const legs = [[J.legL, J.kneeL, J.footL, 1, s, c], [J.legR, J.kneeR, J.footR, -1, -s, -c]];
    for (const [leg, knee, foot, sg, ls, lc] of legs) {
      this.setJ(P, leg, -ls * 0.92 * k - 0.1 * k, 0, 0.035 * sg);
      const swing = Math.pow(Math.max(0, Math.cos(phase * (sg > 0 ? 1 : 1) + (sg > 0 ? 0.35 : Math.PI + 0.35))), 1.3);
      this.setJ(P, knee, k * (0.22 + 1.45 * swing + 0.22 * Math.max(0, -lc)));
      this.setJ(P, foot, k * (0.5 * Math.pow(Math.max(0, -ls), 2) - 0.32 * Math.max(0, lc)));
    }
    this.setJ(P, J.armL, s * 0.9 * k - 0.1, -0.08 * k, 0.12 + 0.05 * k);
    this.setJ(P, J.armR, -s * 0.9 * k - 0.1, 0.08 * k, -0.12 - 0.05 * k);
    this.setJ(P, J.elbowL, -(1.15 - 0.4 * s) * Math.min(1, 0.5 + k * 0.6));
    this.setJ(P, J.elbowR, -(1.15 + 0.4 * s) * Math.min(1, 0.5 + k * 0.6));
    this.setJ(P, J.handL, -0.2, 0, 0.15);
    this.setJ(P, J.handR, -0.2, 0, -0.15);
    this.setJ(P, J.pelvis, 0, -s * 0.2 * k, c * 0.04 * k);
    const spineLean = 0.06 + 0.24 * sn + lean;
    this.setJ(P, J.spine, spineLean, s * 0.08 * k);
    this.setJ(P, J.chest, 0.04 * sn, s * 0.22 * k);
    this.setJ(P, J.neck, -spineLean * 0.35);
    this.setJ(P, J.head, -spineLean * 0.3 + Math.abs(c) * 0.03 * k, -s * 0.12 * k + this.lookYaw * 0.4);
    P[PY] = -0.035 * k - 0.065 * k * Math.abs(c) + 0.02 * k;
    P[PZ] = 0;
  }
  poseAir(P, vy) {
    const t = this.t;
    const rise = smoothstep(-6, 3, vy);
    const ld = this.lead;
    const [lead, leadK, trail, trailK] = ld > 0 ? [J.legL, J.kneeL, J.legR, J.kneeR] : [J.legR, J.kneeR, J.legL, J.kneeL];
    // بالا رفتن: حالت گام بلند
    const fallMix = 1 - rise;
    const bike = Math.sin(t * 9);
    this.setJ(P, lead, lerp(-0.4 - bike * 0.5, -1.0, rise), 0, 0.05 * ld);
    this.setJ(P, leadK, lerp(0.9 + bike * 0.4, 1.35, rise));
    this.setJ(P, trail, lerp(0.15 + bike * 0.5, 0.42, rise), 0, -0.05 * ld);
    this.setJ(P, trailK, lerp(0.9 - bike * 0.3, 0.75, rise));
    this.setJ(P, J.footL, 0.25);
    this.setJ(P, J.footR, 0.25);
    const flail = Math.sin(t * 13) * 0.35 * fallMix;
    const armFwd = ld > 0 ? J.armR : J.armL;
    const armBack = ld > 0 ? J.armL : J.armR;
    const fwdSide = armFwd === J.armL ? 1 : -1;
    this.setJ(P, armFwd, lerp(-0.5, -1.45, rise), 0, fwdSide * lerp(1.3 + flail, 0.2, rise));
    this.setJ(P, armBack, lerp(-0.4, 0.75, rise), 0, -fwdSide * lerp(1.3 - flail, 0.3, rise));
    this.setJ(P, J.elbowL, lerp(-0.4, -0.7, rise));
    this.setJ(P, J.elbowR, lerp(-0.4, -0.7, rise));
    this.setJ(P, J.spine, lerp(-0.12, 0.28, rise));
    this.setJ(P, J.chest, lerp(-0.05, 0.08, rise), (ld > 0 ? 1 : -1) * 0.18 * rise);
    this.setJ(P, J.head, lerp(0.25, -0.12, rise));
    P[PY] = lerp(0.05, 0.08, rise);
  }
  poseSlide(P) {
    this.setJ(P, J.pivot, -0.78, 0, 0.08);
    this.setJ(P, J.legL, -1.05, 0, 0.08);
    this.setJ(P, J.kneeL, 0.12);
    this.setJ(P, J.footL, -0.35);
    this.setJ(P, J.legR, -0.15, 0, -0.18);
    this.setJ(P, J.kneeR, 2.0);
    this.setJ(P, J.footR, 0.4);
    this.setJ(P, J.armR, 0.85, 0, -0.55);
    this.setJ(P, J.elbowR, -0.15);
    this.setJ(P, J.armL, -1.0, 0, 0.45);
    this.setJ(P, J.elbowL, -0.9);
    this.setJ(P, J.spine, 0.2);
    this.setJ(P, J.chest, 0.15, 0.15);
    this.setJ(P, J.head, 0.55, 0.1);
    P[PY] = -0.5;
    P[PZ] = -0.05;
  }
  poseWall(P, phase, side) {
    this.poseRun(P, 1.15, 1, phase, 0.05);
    this.setJ(P, J.pivot, 0, 0, side * 0.62);
    const arm = side > 0 ? J.armL : J.armR;
    this.setJ(P, arm, -0.5, 0, side * 1.25);
    this.setJ(P, side > 0 ? J.elbowL : J.elbowR, -0.25);
    this.setJ(P, J.head, -0.1, 0, -side * 0.35);
  }
  poseMantle(P, m) {
    const up = smoothstep(0, 0.6, m);
    this.setJ(P, J.armL, lerp(-2.9, -0.6, up), 0, 0.2);
    this.setJ(P, J.armR, lerp(-2.9, -0.6, up), 0, -0.2);
    this.setJ(P, J.elbowL, lerp(-0.2, -1.3, up));
    this.setJ(P, J.elbowR, lerp(-0.2, -1.3, up));
    this.setJ(P, J.legL, lerp(-0.3, -1.5, m), 0, 0.1);
    this.setJ(P, J.kneeL, lerp(0.6, 2.1, m));
    this.setJ(P, J.legR, lerp(0.2, -0.4, m), 0, -0.1);
    this.setJ(P, J.kneeR, lerp(0.4, 1.2, m));
    this.setJ(P, J.spine, lerp(0.1, 0.7, up));
    this.setJ(P, J.head, lerp(-0.4, 0.1, m));
    P[PY] = lerp(-0.1, -0.35, up);
    P[PZ] = lerp(-0.15, 0.05, m);
  }
  poseKnock(P) {
    const t = this.t;
    this.setJ(P, J.armL, -1.2 + Math.sin(t * 15) * 0.5, 0, 1.6);
    this.setJ(P, J.armR, -1.2 + Math.cos(t * 14) * 0.5, 0, -1.6);
    this.setJ(P, J.legL, -0.8 + Math.sin(t * 12) * 0.6, 0, 0.4);
    this.setJ(P, J.legR, -0.2 + Math.cos(t * 11) * 0.6, 0, -0.4);
    this.setJ(P, J.kneeL, 1.2);
    this.setJ(P, J.kneeR, 0.8);
    this.setJ(P, J.spine, -0.3);
    this.setJ(P, J.head, 0.4);
  }
  poseCele(P) {
    const t = this.t;
    const hop = Math.abs(Math.sin(t * 5.2));
    this.setJ(P, J.armL, -2.6 + Math.sin(t * 10.4) * 0.35, 0, 0.35);
    this.setJ(P, J.armR, -2.6 + Math.cos(t * 10.4) * 0.35, 0, -0.35);
    this.setJ(P, J.elbowL, -0.5 - Math.max(0, Math.sin(t * 10.4)) * 0.8);
    this.setJ(P, J.elbowR, -0.5 - Math.max(0, Math.cos(t * 10.4)) * 0.8);
    this.setJ(P, J.legL, -0.25 * (1 - hop), 0, 0.12);
    this.setJ(P, J.legR, -0.25 * (1 - hop), 0, -0.12);
    this.setJ(P, J.kneeL, 0.55 * (1 - hop));
    this.setJ(P, J.kneeR, 0.55 * (1 - hop));
    this.setJ(P, J.chest, -0.1, Math.sin(t * 2.6) * 0.3);
    this.setJ(P, J.head, -0.3, Math.sin(t * 2.6) * 0.25);
    P[PY] = hop * 0.22 - 0.06;
  }

  /**
   * S: { speed, maxSpeed, grounded, vy, slide, wall (±1|0), mantle (-1|0..1), knock, cele, lean }
   */
  update(dt, S) {
    this.t += dt;
    const speed = S.speed || 0;
    const sn = clamp(speed / Math.max(1, S.maxSpeed || 7.4), 0, 1.3);
    const grounded = S.grounded;
    // پیشرفت چرخهٔ گام بر اساس مسافت
    const stride = 2.1 + speed * 0.11;
    if ((grounded && speed > 0.2) || S.wall) {
      const before = this.phase;
      this.phase += (TAU * Math.max(speed, S.wall ? 8 : 0)) / stride * dt * (S.wall ? 1.2 : 1);
      // صدای قدم در لحظهٔ تماس پا
      const stepA = Math.floor((before - Math.PI / 2) / Math.PI), stepB = Math.floor((this.phase - Math.PI / 2) / Math.PI);
      if (stepB !== stepA && this.stepCb && grounded) this.stepCb(sn);
    }
    if (!grounded && this.prevGrounded && S.vy > 0) this.lead = -this.lead;
    this.prevGrounded = grounded;

    // وزن حالت‌ها
    const tgt = { idle: 0, run: 0, air: 0, slide: 0, wall: 0, mantle: 0, knock: 0, cele: 0 };
    if (S.knock) tgt.knock = 1;
    else if (S.cele) tgt.cele = 1;
    else if (S.mantle >= 0) tgt.mantle = 1;
    else if (S.wall) tgt.wall = 1;
    else if (S.slide) tgt.slide = 1;
    else if (!grounded) tgt.air = 1;
    else if (speed > 0.35) tgt.run = 1;
    else tgt.idle = 1;
    const fast = { mantle: 30, slide: 20, wall: 18, knock: 25 };
    let sum = 0;
    for (const k in this.w) {
      this.w[k] = damp(this.w[k], tgt[k], fast[k] || (k === 'air' ? 14 : 12), dt);
      sum += this.w[k];
    }
    const P = this.pose;
    P.fill(0);
    const add = (w, fn) => {
      if (w < 0.002) return;
      const T = this.tmp;
      T.fill(0);
      fn(T);
      for (let i = 0; i < PLEN; i++) P[i] += T[i] * (w / sum);
    };
    const k = clamp(speed / 6.5, 0.22, 1.18);
    add(this.w.idle, (T) => this.poseIdle(T));
    add(this.w.run, (T) => this.poseRun(T, k, sn, this.phase, S.lean || 0));
    add(this.w.air, (T) => this.poseAir(T, S.vy || 0));
    add(this.w.slide, (T) => this.poseSlide(T));
    add(this.w.wall, (T) => this.poseWall(T, this.phase, S.wall || 1));
    add(this.w.mantle, (T) => this.poseMantle(T, Math.max(0, S.mantle)));
    add(this.w.knock, (T) => this.poseKnock(T));
    add(this.w.cele, (T) => this.poseCele(T));

    // فرود: خم شدن زانو
    if (this.landT > 0) {
      this.landT = Math.max(0, this.landT - dt / 0.26);
      const a = Math.sin(this.landT * Math.PI * 0.5) * this.landAmt * (1 - this.w.slide);
      P[PY] -= 0.3 * a;
      P[J.legL * 3] -= 0.75 * a; P[J.legR * 3] -= 0.65 * a;
      P[J.kneeL * 3] += 1.45 * a; P[J.kneeR * 3] += 1.35 * a;
      P[J.footL * 3] -= 0.5 * a; P[J.footR * 3] -= 0.5 * a;
      P[J.spine * 3] += 0.5 * a;
      P[J.armL * 3] -= 0.6 * a; P[J.armR * 3] -= 0.6 * a;
      P[J.armL * 3 + 2] += 0.3 * a; P[J.armR * 3 + 2] -= 0.3 * a;
      P[J.head * 3] -= 0.25 * a;
    }
    // پشتک (پرش دوبل)
    let flipAngle = 0;
    if (this.flipT >= 0) {
      this.flipT += dt / 0.52;
      if (this.flipT >= 1) this.flipT = -1;
      else {
        const f = this.flipT;
        flipAngle = (1 - Math.pow(1 - f, 2.2)) * TAU;
        const tuck = Math.sin(f * Math.PI);
        P[J.legL * 3] = lerp(P[J.legL * 3], -1.9, tuck); P[J.legR * 3] = lerp(P[J.legR * 3], -1.8, tuck);
        P[J.kneeL * 3] = lerp(P[J.kneeL * 3], 2.3, tuck); P[J.kneeR * 3] = lerp(P[J.kneeR * 3], 2.3, tuck);
        P[J.armL * 3] = lerp(P[J.armL * 3], -1.3, tuck); P[J.armR * 3] = lerp(P[J.armR * 3], -1.3, tuck);
        P[J.elbowL * 3] = lerp(P[J.elbowL * 3], -1.7, tuck); P[J.elbowR * 3] = lerp(P[J.elbowR * 3], -1.7, tuck);
        P[J.spine * 3] = lerp(P[J.spine * 3], 0.6, tuck);
        P[J.head * 3] = lerp(P[J.head * 3], 0.5, tuck);
      }
    }
    // دست تکان دادن (چت)
    if (this.waveT >= 0) {
      this.waveT += dt / 1.6;
      if (this.waveT >= 1) this.waveT = -1;
      else {
        const wv = Math.sin(this.waveT * Math.PI) * (this.w.idle + this.w.run * 0.6);
        P[J.armR * 3] = lerp(P[J.armR * 3], -0.4, wv);
        P[J.armR * 3 + 2] = lerp(P[J.armR * 3 + 2], -2.5, wv);
        P[J.elbowR * 3] = lerp(P[J.elbowR * 3], -0.4, wv);
        P[J.elbowR * 3 + 2] = lerp(P[J.elbowR * 3 + 2], Math.sin(this.t * 14) * 0.5, wv);
      }
    }
    // چرخش پرتاب
    if (S.knock) {
      this.knockRot.x += dt * 9;
      this.knockRot.z += dt * 4;
    } else {
      this.knockRot.multiplyScalar(Math.exp(-dt * 12));
    }

    // اعمال به استخوان‌ها با هموارسازی سبک
    const C = this.cur;
    const lam = 40;
    for (let i = 0; i < PLEN; i++) C[i] = damp(C[i], P[i], lam, dt);
    const jb = this.jointBones;
    for (let j = 0; j < NJ; j++) jb[j].rotation.set(C[j * 3], C[j * 3 + 1], C[j * 3 + 2]);
    const pv = jb[J.pivot];
    pv.rotation.x += flipAngle + this.knockRot.x;
    pv.rotation.z += this.knockRot.z + (S.bank || 0);
    pv.position.y = 0.95 + C[PY];
    pv.position.z = C[PZ];
    if (flipAngle) pv.position.y += Math.sin((flipAngle / TAU) * Math.PI) * 0.15;
  }

  updateScarf(dt, vel) {
    if (!this.scarf) return;
    const N = this.scarfN;
    const T = this._sc || (this._sc = { a: new V3(), b: new V3(), v: new V3(), d: new V3(), back: new V3(), right: new V3(), wind: new V3() });
    const anchor = T.a;
    this.bones[BI.chest].localToWorld(anchor.set(0, 0.22, -0.11));
    const back = T.back.set(0, 0, -1).applyQuaternion(this.root.quaternion);
    if (!this.scarfInit) {
      for (let i = 0; i < N; i++) {
        this.scarfPts[i].copy(anchor).addScaledVector(back, i * 0.07);
        this.scarfPrev[i].copy(this.scarfPts[i]);
      }
      this.scarfInit = true;
    }
    const seg = 0.075;
    const h = Math.min(dt, 1 / 30);
    const wind = T.wind.set(0, 0, 0);
    let vl = 0;
    if (vel) { wind.copy(vel).multiplyScalar(-0.9); vl = vel.length(); }
    wind.y += 0.5;
    const h2 = h * h;
    for (let i = 1; i < N; i++) {
      const p = this.scarfPts[i], pr = this.scarfPrev[i];
      const v = T.v.subVectors(p, pr).multiplyScalar(0.96);
      pr.copy(p);
      const flutter = Math.sin(this.t * 18 + i * 0.9) * 0.6 * Math.min(1, vl / 6);
      p.add(v);
      p.x += wind.x * h2 * 1.6;
      p.y += (-9.8 + wind.y * 1.6 + flutter * 4) * h2;
      p.z += wind.z * h2 * 1.6;
    }
    this.scarfPts[0].copy(anchor);
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < N; i++) {
        const a = this.scarfPts[i - 1], b = this.scarfPts[i];
        const d = T.d.subVectors(b, a);
        const l = d.length() || 1e-5;
        b.copy(a).addScaledVector(d, seg / l);
      }
    }
    const right = T.right.set(1, 0, 0).applyQuaternion(this.root.quaternion);
    const pos = this.scarf.geometry.attributes.position;
    for (let i = 0; i < N; i++) {
      const w = 0.07 * (1 - (i / N) * 0.4);
      const p = this.scarfPts[i];
      pos.setXYZ(i * 2, p.x - right.x * w, p.y - right.y * w, p.z - right.z * w);
      pos.setXYZ(i * 2 + 1, p.x + right.x * w, p.y + right.y * w, p.z + right.z * w);
    }
    pos.needsUpdate = true;
    this.scarf.geometry.computeVertexNormals();
  }

  setGhost(alpha) {
    const tr = alpha < 0.999;
    for (const m of [this.mat, this.glowMat]) {
      m.transparent = tr;
      m.opacity = alpha;
      m.depthWrite = !tr;
    }
    this.body.castShadow = alpha > 0.5;
  }

  dispose() {
    this.body.geometry.dispose();
    this.glow.geometry.dispose();
    this.mat.dispose();
    this.glowMat.dispose();
    if (this.scarf) {
      this.scarf.geometry.dispose();
      this.scarfMat.dispose();
    }
  }
}
