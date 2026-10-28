'use strict';
/*
 * Athlete character: rigid-skinned humanoid drawn in one draw call (vertex colors),
 * plus a library of procedural exercise animations.
 * Faces +Z. Left side is +X. Rotation sign conventions used by every pose:
 *   shX < 0 swings an arm forward/up, shLZ > 0 / shRZ < 0 raises arms sideways,
 *   el < 0 bends the elbow, hpX < 0 lifts a leg forward, kn > 0 bends the knee,
 *   spX > 0 leans the torso forward, bx > 0 pitches the whole body forward.
 */

const HIP_H = 0.94;
const LEG_LEN = 0.9; // hip joint to sole when standing

const CHAR_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.04 });
const PROP_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.5 });
const SHADOW_TEX = radialTexture('rgba(0,0,0,0.55)', 'rgba(0,0,0,0)');
const SHADOW_MAT = new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false });
const SHADOW_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

const POSE_KEYS = ['x', 'y', 'z', 'bx', 'by', 'bz', 'spX', 'spY', 'spZ', 'nkX', 'nkY',
  'shLX', 'shLY', 'shLZ', 'shRX', 'shRY', 'shRZ', 'elL', 'elR',
  'hpLX', 'hpLZ', 'hpRX', 'hpRZ', 'knL', 'knR', 'anL', 'anR'];
const ROOT_KEYS = new Set(['x', 'y', 'z', 'bx', 'by', 'bz']);

function makePose() {
  return {
    x: 0, y: 0, z: 0, bx: 0, by: 0, bz: 0, spX: 0, spY: 0, spZ: 0, nkX: 0, nkY: 0,
    shLX: 0.05, shLY: 0, shLZ: 0.12, shRX: 0.05, shRY: 0, shRZ: -0.12, elL: -0.18, elR: -0.18,
    hpLX: 0, hpLZ: 0.03, hpRX: 0, hpRZ: -0.03, knL: 0.04, knR: 0.04, anL: 0, anR: 0,
    autoAnkle: true,
  };
}
const STAND = makePose();

function copyPose(dst, src) {
  for (const k of POSE_KEYS) dst[k] = src[k];
  dst.autoAnkle = src.autoAnkle;
  return dst;
}
/** dst = lerp(dst, q, k) */
function mixInto(dst, q, k) {
  for (const key of POSE_KEYS) dst[key] += (q[key] - dst[key]) * k;
  if (k > 0.5) dst.autoAnkle = q.autoAnkle;
}

/** [down, forward] reach of a leg from the hip joint to the sole. a1 is the absolute thigh angle. */
function legVec(a1, kn) {
  const a2 = a1 + kn;
  return [0.44 * Math.cos(a1) + 0.38 * Math.cos(a2) + 0.08, -0.44 * Math.sin(a1) - 0.38 * Math.sin(a2)];
}
/** Lower the body so the lowest foot touches the floor, and shift it so the feet stay in place. */
function plant(p, keepFeet = true) {
  const L = legVec(p.bx + p.hpLX, p.knL);
  const R = legVec(p.bx + p.hpRX, p.knR);
  const sideDrop = Math.min(Math.cos(p.hpLZ), Math.cos(p.hpRZ));
  p.y = Math.max(L[0], R[0]) * sideDrop - LEG_LEN;
  if (keepFeet) p.z = -(L[1] + R[1]) / 2;
}

/** Walking / running leg+arm cycle. r: 0 walk .. 1 sprint. */
function gait(p, phase, r) {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const amp = lerp(0.45, 0.95, r);
  p.hpLX = -s * amp - 0.1 * r;
  p.hpRX = s * amp - 0.1 * r;
  const kb = lerp(0.12, 0.35, r);
  const ka = lerp(0.55, 1.45, r);
  p.knL = kb + ka * Math.max(0, c);
  p.knR = kb + ka * Math.max(0, -c);
  p.shLX = s * amp * 0.85;
  p.shRX = -s * amp * 0.85;
  p.shLZ = 0.12;
  p.shRZ = -0.12;
  p.elL = lerp(-0.35, -1.55, r) - 0.2 * Math.max(0, -s);
  p.elR = lerp(-0.35, -1.55, r) - 0.2 * Math.max(0, s);
  p.spX = lerp(0.04, 0.28, r);
  p.spY = s * 0.12;
  p.nkX = -p.spX * 0.6;
  p.y = lerp(0.025, 0.07, r) * Math.abs(c) - lerp(0.02, 0.06, r);
}

function crouchPose(p, c) {
  p.hpLX = p.hpRX = -1.0 * c;
  p.knL = p.knR = 1.75 * c;
  p.spX = 0.45 * c;
  p.nkX = -0.25 * c;
  plant(p);
}

/** Shared flip timeline: crouch → airborne (callback gets a = 0..1) → landing crouch. */
function flipAnim(p, t, ta, tb, height, air) {
  if (t < ta) {
    const c = smooth(t / ta);
    crouchPose(p, c);
    p.shLX = p.shRX = 0.9 * c;
    p.elL = p.elR = -0.3;
  } else if (t < tb) {
    const a = seg(t, ta, tb);
    air(p, a);
    p.y = 4 * height * a * (1 - a) - 0.3 * (1 - smooth(a / 0.12)) - 0.25 * smooth(seg(a, 0.85, 1));
  } else {
    const c = 1 - smooth(seg(t, tb + 0.03, 1));
    air(p, 1);
    const rot = { bx: p.bx, by: p.by };
    copyPose(p, STAND);
    p.bx = rot.bx;
    p.by = rot.by;
    crouchPose(p, c * 0.85);
    p.shLX = p.shRX = -1.3 * c;
    p.shLZ = 0.12 + 0.6 * c;
    p.shRZ = -p.shLZ;
  }
}

function tuck(p, a, strength = 1) {
  const k = Math.pow(Math.sin(Math.PI * a), 0.7) * strength;
  p.hpLX = p.hpRX = -0.1 - 1.9 * k;
  p.knL = p.knR = 2.3 * k;
  p.spX = 0.35 * k;
  p.nkX = 0.3 * k;
  const arm = a < 0.3 ? lerp(-2.9, -1.0, a / 0.3) : lerp(-1.0, -1.5, (a - 0.3) / 0.7);
  p.shLX = p.shRX = arm;
  p.elL = p.elR = -0.6 * k - 0.1;
  p.shLZ = 0.25;
  p.shRZ = -0.25;
}

/* ---------------- Animation library ----------------
 * fn(p, t, ch): p arrives as a standing pose; t runs 0..1.
 * move(t): forward root speed in m/s. events: [[t, name], ...].
 */
const ANIMS = {
  pushup: {
    dur: 2.4,
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.17)) * (1 - smooth(seg(t, 0.85, 1)));
      const d = (1 - Math.cos(seg(t, 0.2, 0.82) * 2 * TAU)) / 2;
      const q = makePose();
      q.bx = lerp(1.16, 1.33, d);
      q.y = lerp(0.39, 0.24, d) - HIP_H;
      q.shLX = q.shRX = -q.bx + 1.0 * d;
      q.elL = q.elR = -1.05 * d;
      q.shLZ = 0.3; q.shRZ = -0.3;
      q.nkX = -0.6;
      q.hpLZ = 0.05; q.hpRZ = -0.05;
      q.knL = q.knR = 0;
      q.autoAnkle = false;
      q.anL = q.anR = 0.95;
      mixInto(p, q, k);
      const mid = Math.sin(Math.PI * k);
      p.knL += 1.1 * mid; p.knR += 1.1 * mid;
      p.hpLX -= 0.5 * mid; p.hpRX -= 0.5 * mid;
      p.autoAnkle = false;
    },
  },
  squat: {
    dur: 2.2,
    fn(p, t) {
      const d = (1 - Math.cos(seg(t, 0.04, 0.96) * 2 * TAU)) / 2;
      p.hpLX = p.hpRX = -1.35 * d;
      p.knL = p.knR = 2.0 * d;
      p.hpLZ = 0.12; p.hpRZ = -0.12;
      p.spX = 0.5 * d;
      p.nkX = -0.35 * d;
      p.shLX = p.shRX = -1.5 * d;
      p.shLZ = 0.12 - 0.08 * d; p.shRZ = -p.shLZ;
      p.elL = p.elR = -0.12;
      plant(p);
    },
  },
  situp: {
    dur: 2.6,
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.16)) * (1 - smooth(seg(t, 0.84, 1)));
      const d = (1 - Math.cos(seg(t, 0.2, 0.8) * 2 * TAU)) / 2;
      const q = makePose();
      q.bx = -Math.PI / 2;
      q.y = 0.17 - HIP_H;
      q.hpLX = q.hpRX = -1.0;
      q.knL = q.knR = 2.0;
      q.hpLZ = 0.12; q.hpRZ = -0.12;
      q.spX = 1.15 * d;
      q.nkX = 0.35 + 0.2 * d;
      q.shLX = q.shRX = -2.7;
      q.shLZ = 0.6; q.shRZ = -0.6;
      q.elL = q.elR = -2.3;
      mixInto(p, q, k);
      const mid = Math.sin(Math.PI * k);
      p.knL += 0.8 * mid; p.knR += 0.8 * mid;
      p.hpLX -= 0.4 * mid; p.hpRX -= 0.4 * mid;
    },
  },
  jack: {
    dur: 1.8,
    fn(p, t) {
      const r = seg(t, 0.02, 0.98) * 3;
      const open = (1 - Math.cos(r * TAU)) / 2;
      const hop = Math.abs(Math.sin(r * TAU));
      p.shLZ = 0.12 + 2.85 * open; p.shRZ = -p.shLZ;
      p.elL = p.elR = -0.15;
      p.hpLZ = 0.03 + 0.32 * open; p.hpRZ = -p.hpLZ;
      p.knL = p.knR = 0.18 * (1 - hop);
      plant(p, false);
      p.y += 0.14 * hop;
      p.autoAnkle = false;
      p.anL = p.anR = 0.35 * hop;
    },
  },
  backflip: {
    dur: 1.35,
    events: [[0.17, 'jump'], [0.82, 'land']],
    move: (t) => (t > 0.17 && t < 0.82 ? -1.3 : 0),
    fn(p, t) {
      flipAnim(p, t, 0.17, 0.82, 1.45, (q, a) => { tuck(q, a); q.bx = -TAU * smooth(a); });
    },
  },
  jumpspin: {
    dur: 1.5,
    events: [[0.15, 'jump'], [0.82, 'land']],
    fn(p, t) {
      flipAnim(p, t, 0.15, 0.82, 1.7, (q, a) => {
        const k = Math.sin(Math.PI * a);
        q.by = 2 * TAU * smooth(a);
        q.shLX = q.shRX = lerp(-2.8, -1.35, Math.min(1, a * 4));
        q.shLZ = -0.45 * k; q.shRZ = 0.45 * k;
        q.elL = q.elR = -2.0 * k;
        q.hpLZ = -0.02; q.hpRZ = 0.02;
        q.knL = q.knR = 0.2 + 0.25 * k;
        q.hpLX = q.hpRX = -0.2 * k;
        q.nkX = 0.15;
      });
    },
  },
  frontflip: {
    dur: 1.5,
    events: [[0.14, 'jump'], [0.83, 'land']],
    move: (t) => (t > 0.05 && t < 0.83 ? 3.2 : 0),
    fn(p, t) {
      flipAnim(p, t, 0.14, 0.83, 1.6, (q, a) => { tuck(q, a); q.bx = TAU * smooth(a); });
    },
  },
  curl: {
    dur: 2.4,
    props: ['dumbbells'],
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.1)) * (1 - smooth(seg(t, 0.9, 1)));
      const ph = seg(t, 0.08, 0.92) * 2 * TAU;
      const L = Math.max(0, Math.sin(ph));
      const R = Math.max(0, -Math.sin(ph));
      p.elL = lerp(-0.18, -0.25 - 2.2 * L, k);
      p.elR = lerp(-0.18, -0.25 - 2.2 * R, k);
      p.shLX = p.shRX = 0.06 - 0.15 * k * (L + R);
      p.shLZ = 0.18; p.shRZ = -0.18;
      p.hpLZ = 0.08; p.hpRZ = -0.08;
      p.spX = -0.04;
      p.nkX = 0.1 * k;
    },
  },
  rope: {
    dur: 2.4,
    props: ['rope'],
    fn(p, t, ch) {
      const k = smooth(seg(t, 0, 0.08)) * (1 - smooth(seg(t, 0.92, 1)));
      const h = seg(t, 0.06, 0.94) * 6;
      const f = h % 1;
      const air = Math.sin(Math.PI * f) * k;
      p.hpLX = p.hpRX = -0.08;
      p.knL = p.knR = 0.12 + 0.15 * (1 - air);
      p.shLX = p.shRX = -0.15;
      p.shLZ = 0.36; p.shRZ = -0.36;
      p.elL = p.elR = -0.85;
      plant(p, false);
      p.y += 0.15 * air;
      p.autoAnkle = false;
      p.anL = p.anR = 0.4 * air;
      if (ch) ch.ropeAngle = h * TAU;
    },
  },
  box: {
    dur: 2.0,
    props: ['gloves'],
    events: [[0.2, 'punch'], [0.4, 'punch'], [0.6, 'punch'], [0.8, 'punch']],
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.1)) * (1 - smooth(seg(t, 0.9, 1)));
      const ph = seg(t, 0.1, 0.9) * 4;
      const i = Math.min(3, Math.floor(ph));
      const ext = Math.pow(Math.sin(Math.PI * (ph - i)), 0.8);
      const left = i % 2 === 0;
      const q = makePose();
      q.hpLX = -0.3; q.hpRX = 0.2;
      q.knL = q.knR = 0.35;
      q.hpLZ = 0.1; q.hpRZ = -0.1;
      q.spX = 0.15;
      q.nkX = -0.1;
      q.shLX = q.shRX = -0.55;
      q.shLZ = 0.18; q.shRZ = -0.18;
      q.shLY = -0.35; q.shRY = 0.35;
      q.elL = q.elR = -2.3;
      const arm = left ? 'L' : 'R';
      q['sh' + arm + 'X'] = lerp(-0.55, -1.55, ext);
      q['sh' + arm + 'Y'] = lerp(left ? -0.35 : 0.35, left ? -0.1 : 0.1, ext);
      q['sh' + arm + 'Z'] = lerp(left ? 0.18 : -0.18, 0, ext);
      q['el' + arm] = lerp(-2.3, -0.08, ext);
      q.spY = (left ? -0.4 : 0.4) * ext;
      plant(q);
      q.y += 0.02 * Math.sin(t * 40);
      mixInto(p, q, k);
    },
  },
  kick: {
    dur: 1.4,
    events: [[0.12, 'jump'], [0.5, 'whoosh'], [0.78, 'land']],
    fn(p, t) {
      const ext = Math.sin(Math.PI * seg(t, 0.28, 0.78));
      const hop = Math.sin(Math.PI * seg(t, 0.14, 0.78));
      p.by = TAU * smooth(seg(t, 0.12, 0.85));
      p.hpRZ = -0.03 - 1.45 * ext;
      p.hpRX = -0.25 * ext;
      p.knR = 0.9 * (1 - ext) * hop;
      p.knL = 0.25 + 0.3 * (1 - hop);
      p.hpLX = -0.25 * hop;
      p.bz = -0.45 * ext;
      p.shLZ = 0.12 + 1.15 * ext; p.shRZ = -p.shLZ;
      p.elL = p.elR = -0.5;
      plant(p, false);
      p.y += 0.38 * hop;
    },
  },
  lift: {
    dur: 3.4,
    props: ['barbell'],
    barbellDrop: 0.8,
    events: [[0.8, 'drop']],
    fn(p, t) {
      if (t < 0.14) {
        const c = smooth(t / 0.14);
        p.hpLX = p.hpRX = -1.2 * c;
        p.knL = p.knR = 1.5 * c;
        p.spX = 0.8 * c;
        p.shLX = p.shRX = -0.8 * c;
        p.elL = p.elR = -0.05;
        p.shLZ = 0.2; p.shRZ = -0.2;
      } else if (t < 0.34) {
        const u = smooth(seg(t, 0.14, 0.34));
        p.hpLX = p.hpRX = -1.2 * (1 - u);
        p.knL = p.knR = 1.5 * (1 - u) + 0.3 * Math.sin(Math.PI * u);
        p.spX = 0.8 * (1 - u);
        p.shLX = p.shRX = lerp(-0.8, -1.45, u);
        p.elL = p.elR = lerp(-0.05, -2.55, u);
        p.shLZ = 0.2 + 0.1 * u; p.shRZ = -p.shLZ;
      } else {
        const v = smooth(seg(t, 0.36, 0.52));
        const w = smooth(seg(t, 0.8, 0.94));
        const shake = t > 0.52 && t < 0.8 ? 0.04 * Math.sin(t * 90) : 0;
        p.shLX = p.shRX = lerp(lerp(-1.45, -3.0, v), 0.05, w) + shake;
        p.elL = p.elR = lerp(lerp(-2.55, -0.05, v), -0.18, w);
        p.shLZ = lerp(lerp(0.3, 0.45, v), 0.12, w); p.shRZ = -p.shLZ;
        p.knL = p.knR = 0.45 * Math.sin(Math.PI * seg(t, 0.34, 0.5)) + 0.25 * Math.sin(Math.PI * seg(t, 0.8, 0.95));
        p.hpLX = -0.25 * v * (1 - w); p.hpRX = 0.2 * v * (1 - w);
        p.nkX = -0.2 * v * (1 - w);
      }
      p.hpLZ = 0.1; p.hpRZ = -0.1;
      plant(p);
    },
  },
  handstand: {
    dur: 3.4,
    fn(p, t) {
      const up = smooth(seg(t, 0, 0.22));
      const down = smooth(seg(t, 0.78, 1));
      const u = up * (1 - down);
      const hold = t > 0.22 && t < 0.78;
      p.bx = Math.PI * u;
      p.y = lerp(0, 0.3, u) - 0.42 * Math.sin(Math.PI * u);
      p.z = 0.65 * u * u;
      const armIn = smooth(seg(t, 0, 0.12)) * (1 - smooth(seg(t, 0.88, 1)));
      p.shLX = p.shRX = lerp(0.05, -3.05, armIn);
      p.elL = p.elR = -0.05;
      p.shLZ = 0.22; p.shRZ = -0.22;
      p.nkX = -0.5 * u;
      const kick = Math.sin(Math.PI * u);
      p.hpLX = -0.7 * kick;
      p.hpRX = 0.1 * kick;
      p.knL = 0.3 * kick;
      if (hold) {
        const w = Math.sin(t * 28);
        p.bz = 0.05 * Math.sin(t * 17);
        p.hpLX = 0.12 * w; p.hpRX = -0.12 * w;
        p.hpLZ = 0.06; p.hpRZ = -0.06;
        p.autoAnkle = false;
        p.anL = p.anR = 0.9;
      }
    },
  },
  hammer: {
    dur: 1.9,
    props: ['hammer'],
    events: [[0.56, 'impact']],
    fn(p, t) {
      const rec = smooth(seg(t, 0.78, 1));
      if (t < 0.4) {
        const u = smooth(seg(t, 0.02, 0.4));
        p.shLX = p.shRX = lerp(0.05, -3.0, u);
        p.elL = p.elR = -0.5 * u;
        p.spX = -0.3 * u;
        p.shLZ = lerp(0.12, -0.1, u); p.shRZ = -p.shLZ;
      } else {
        const v = Math.pow(seg(t, 0.4, 0.56), 2);
        const back = 1 - rec;
        p.shLX = p.shRX = lerp(lerp(-3.0, -0.95, v), 0.05, rec);
        p.elL = p.elR = lerp(-0.5, 0, v) * back - 0.18 * rec;
        p.spX = lerp(-0.3, 0.55, v) * back;
        p.shLZ = lerp(-0.1, 0.12, rec); p.shRZ = -p.shLZ;
        p.hpLX = p.hpRX = -0.55 * v * back;
        p.knL = p.knR = 0.9 * v * back;
      }
      p.hpLX -= 0.25; p.hpRX += 0.2;
      plant(p);
    },
  },
  treadmill: {
    dur: 3.2,
    fn(p, t) {
      gait(p, t * 3.2 * 10, 0.75);
    },
  },
  bike: {
    dur: 3.0,
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.12)) * (1 - smooth(seg(t, 0.88, 1)));
      const ph = t * 3.0 * 9;
      const q = makePose();
      q.y = 0.02;
      q.spX = 0.55; q.nkX = -0.45;
      q.shLX = q.shRX = -1.15; q.elL = q.elR = -0.35;
      q.shLZ = 0.2; q.shRZ = -0.2;
      q.hpLX = -1.2 + 0.35 * Math.sin(ph); q.hpRX = -1.2 - 0.35 * Math.sin(ph);
      q.knL = 1.35 - 0.55 * Math.cos(ph); q.knR = 1.35 + 0.55 * Math.cos(ph);
      q.hpLZ = 0.06; q.hpRZ = -0.06;
      mixInto(p, q, k);
    },
  },
  pullup: {
    dur: 3.2,
    events: [[0.08, 'jump'], [0.92, 'hop']],
    fn(p, t) {
      const grab = smooth(seg(t, 0, 0.12));
      const drop = smooth(seg(t, 0.88, 1));
      const hang = grab * (1 - drop);
      const reps = (1 - Math.cos(seg(t, 0.16, 0.84) * 3 * TAU)) / 2;
      p.shLX = p.shRX = lerp(0.05, lerp(-3.05, -2.2, reps), hang);
      p.shLZ = lerp(0.12, 0.28 + 0.15 * reps, hang); p.shRZ = -p.shLZ;
      p.elL = p.elR = lerp(-0.18, -0.05 - 1.75 * reps, hang);
      p.y = hang * (0.42 + 0.48 * reps);
      p.hpLX = p.hpRX = -0.25 * hang;
      p.knL = p.knR = 0.9 * hang;
      p.hpLZ = 0.0; p.hpRZ = 0.0;
      p.nkX = -0.25 * hang * reps;
      p.autoAnkle = false;
      p.anL = p.anR = 0.6 * hang;
    },
  },
  bench: {
    dur: 3.4,
    props: ['barbell'],
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.14)) * (1 - smooth(seg(t, 0.86, 1)));
      const d = (1 - Math.cos(seg(t, 0.18, 0.82) * 3 * TAU)) / 2;
      const q = makePose();
      q.bx = -Math.PI / 2;
      q.y = 0.66 - HIP_H;
      q.hpLX = q.hpRX = 0.2; q.knL = q.knR = 1.4;
      q.hpLZ = 0.28; q.hpRZ = -0.28;
      q.shLX = q.shRX = lerp(-1.57, -0.55, d);
      q.elL = q.elR = lerp(-0.05, -1.95, d);
      q.shLZ = 0.42; q.shRZ = -0.42;
      q.nkX = 0.15;
      mixInto(p, q, k);
      const mid = Math.sin(Math.PI * k);
      p.knL += 0.6 * mid; p.knR += 0.6 * mid;
    },
  },
  cheer: {
    dur: 2.0,
    fn(p, t) {
      const r = t * 4;
      const hop = Math.abs(Math.sin(r * Math.PI));
      p.shLX = p.shRX = -2.6;
      p.shLZ = 0.5 + 0.2 * hop; p.shRZ = -p.shLZ;
      p.elL = p.elR = -0.4 - 0.6 * (1 - hop);
      p.knL = p.knR = 0.2 * (1 - hop);
      plant(p, false);
      p.y += 0.25 * hop;
      p.nkX = -0.3;
    },
  },
};

/* ---------------- Rig ---------------- */

const BONE_DEFS = [
  ['body', -1, 0, HIP_H, 0],
  ['spine', 0, 0, 0.08, 0],
  ['head', 1, 0, 0.6, 0],
  ['shL', 1, 0.26, 0.5, 0],
  ['elL', 3, 0, -0.29, 0],
  ['haL', 4, 0, -0.26, 0],
  ['shR', 1, -0.26, 0.5, 0],
  ['elR', 6, 0, -0.29, 0],
  ['haR', 7, 0, -0.26, 0],
  ['hpL', 0, 0.11, -0.04, 0],
  ['knL', 9, 0, -0.44, 0],
  ['anL', 10, 0, -0.38, 0],
  ['hpR', 0, -0.11, -0.04, 0],
  ['knR', 12, 0, -0.44, 0],
  ['anR', 13, 0, -0.38, 0],
];
const BONE_INDEX = {};
const REST_WORLD = [];
BONE_DEFS.forEach(([name, parent, x, y, z], i) => {
  BONE_INDEX[name] = i;
  const m = new THREE.Matrix4().makeTranslation(x, y, z);
  if (parent >= 0) m.premultiply(REST_WORLD[parent]);
  REST_WORLD.push(m);
});

const HAIR_GEO = new THREE.SphereGeometry(1, 16, 8, 0, TAU, 0, Math.PI * 0.55);

function buildCharGeometry(o, m) {
  const parts = [];
  const add = (bone, geo, x, y, z, color, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const bi = BONE_INDEX[bone];
    const mat = composeMatrix(x, y, z, rx, ry, rz, sx, sy, sz).premultiply(REST_WORLD[bi]);
    parts.push({ geo, matrix: mat, color: new THREE.Color(color), bone: bi });
  };
  const sph = UnitGeo.sphere(14, 10);
  const cyl = UnitGeo.cyl(14);
  const box = UnitGeo.box();
  const ma = 1 + 0.5 * m; // upper arm
  const mb = 1 + 0.9 * m; // biceps
  const mf = 1 + 0.3 * m; // forearm
  const ml = 1 + 0.22 * m; // legs
  const tw = 1 + 0.16 * m; // torso width
  const mc = 1 + 0.5 * m; // chest
  const tee = o.style === 'tee';
  const armTop = tee ? o.shirt : o.skin;

  // pelvis / shorts
  add('body', cyl, 0, -0.03, 0, o.shorts, 0, 0, 0, 0.165 * tw, 0.22, 0.125 * tw);
  add('body', sph, 0, -0.12, 0, o.shorts, 0, 0, 0, 0.165 * tw, 0.09, 0.125 * tw);
  add('body', cyl, 0, 0.085, 0, o.accent, 0, 0, 0, 0.17 * tw, 0.035, 0.13 * tw);
  // torso
  add('spine', UnitGeo.capsule(0.17, 0.26, 4, 12), 0, 0.3, 0, o.shirt, 0, 0, 0, 1.06 * tw, 1, 0.8);
  add('spine', sph, 0, 0.47, -0.01, o.shirt, 0, 0, 0, 0.245 * tw * (1 + 0.12 * m), 0.11, 0.14);
  add('spine', sph, 0.085, 0.4, 0.07, o.shirt, 0, 0, 0, 0.095 * mc, 0.075 * mc, 0.07 * mc);
  add('spine', sph, -0.085, 0.4, 0.07, o.shirt, 0, 0, 0, 0.095 * mc, 0.075 * mc, 0.07 * mc);
  add('spine', cyl, 0, 0.585, 0, o.accent, 0, 0, 0, 0.085, 0.035, 0.08);
  if (o.number) add('spine', box, -0.08, 0.36, 0.135 + 0.025 * m, o.accent, 0, 0, 0, 0.08, 0.06, 0.02);
  // neck & head
  add('head', cyl, 0, 0.02, 0, o.skin, 0, 0, 0, 0.062 * (1 + 0.3 * m), 0.12, 0.062 * (1 + 0.3 * m));
  add('head', sph, 0, 0.17, 0.01, o.skin, 0, 0, 0, 0.118, 0.135, 0.125);
  add('head', HAIR_GEO, 0, 0.18, -0.008, o.hair, -0.35, 0, 0, 0.128, 0.13, 0.135);
  add('head', sph, 0.043, 0.185, 0.113, '#141414', 0, 0, 0, 0.017, 0.019, 0.012);
  add('head', sph, -0.043, 0.185, 0.113, '#141414', 0, 0, 0, 0.017, 0.019, 0.012);
  add('head', box, 0.045, 0.214, 0.115, o.hair, 0, 0, 0.08, 0.05, 0.012, 0.012);
  add('head', box, -0.045, 0.214, 0.115, o.hair, 0, 0, -0.08, 0.05, 0.012, 0.012);
  add('head', sph, 0, 0.16, 0.128, o.skin, 0, 0, 0, 0.02, 0.026, 0.02);
  add('head', box, 0, 0.12, 0.115, '#8a3b3b', 0, 0, 0, 0.042, 0.009, 0.01);
  add('head', sph, 0.117, 0.17, 0, o.skin, 0, 0, 0, 0.018, 0.032, 0.026);
  add('head', sph, -0.117, 0.17, 0, o.skin, 0, 0, 0, 0.018, 0.032, 0.026);
  if (o.band) add('head', UnitGeo.torus(1, 0.13, 6, 24), 0, 0.225, 0, o.band, Math.PI / 2, 0, 0, 0.124, 0.124, 0.124);
  // arms
  for (const side of ['L', 'R']) {
    add('sh' + side, sph, 0, -0.02, 0, armTop, 0, 0, 0, 0.083 * ma, 0.085 * ma, 0.08 * ma);
    add('sh' + side, UnitGeo.capsule(0.06, 0.16, 3, 10), 0, -0.15, 0, o.skin, 0, 0, 0, ma, 1, ma);
    add('sh' + side, sph, 0, -0.15, 0.03, o.skin, 0, 0, 0, 0.05 * mb, 0.075 * mb, 0.045 * mb);
    if (tee) add('sh' + side, cyl, 0, -0.07, 0, o.shirt, 0, 0, 0, 0.083 * ma, 0.13, 0.083 * ma);
    add('el' + side, UnitGeo.capsule(0.05, 0.16, 3, 10), 0, -0.12, 0, o.skin, 0, 0, 0, mf, 1, mf);
    if (o.wrist) add('el' + side, cyl, 0, -0.215, 0, side === 'L' ? o.wrist : (o.wrist2 || o.wrist), 0, 0, 0, 0.056 * mf, 0.05, 0.056 * mf);
    add('ha' + side, sph, 0, -0.045, 0, o.skin, 0, 0, 0, 0.042, 0.06, 0.052);
  }
  // legs
  for (const side of ['L', 'R']) {
    add('hp' + side, UnitGeo.capsule(0.085, 0.26, 3, 10), 0, -0.21, 0, o.skin, 0, 0, 0, ml, 1, ml);
    if (o.longPants) add('hp' + side, cyl, 0, -0.2, 0, o.shorts, 0, 0, 0, 0.1 * ml, 0.46, 0.1 * ml);
    else add('hp' + side, cyl, 0, -0.08, 0, o.shorts, 0, 0, 0, 0.1 * ml, 0.24, 0.1 * ml);
    if (o.longPants) add('kn' + side, cyl, 0, -0.18, 0, o.shorts, 0, 0, 0, 0.078 * ml, 0.38, 0.078 * ml);
    else {
      add('kn' + side, UnitGeo.capsule(0.064, 0.24, 3, 10), 0, -0.18, 0, o.skin, 0, 0, 0, ml, 1, ml);
      add('kn' + side, sph, 0, -0.12, -0.025, o.skin, 0, 0, 0, 0.06 * ml, 0.09, 0.06 * ml);
    }
    if (o.highShoes) add('kn' + side, cyl, 0, -0.3, 0, o.shoes, 0, 0, 0, 0.074, 0.16, 0.074);
    else if (!o.longPants) add('kn' + side, cyl, 0, -0.33, 0, o.socks, 0, 0, 0, 0.067, 0.09, 0.067);
    add('an' + side, box, 0, -0.035, 0.045, o.shoes, 0, 0, 0, 0.11, 0.085, 0.25);
    add('an' + side, box, 0, -0.07, 0.045, o.sole, 0, 0, 0, 0.115, 0.022, 0.26);
    add('an' + side, box, 0, -0.02, 0.17, o.accent, 0.5, 0, 0, 0.1, 0.03, 0.03);
  }
  const geo = mergeParts(parts, true);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 2.6);
  return geo;
}

/* ---------------- Props (shared geometry) ---------------- */

const PropGeo = {};
function propGeo(name) {
  if (PropGeo[name]) return PropGeo[name];
  const b = new Batch();
  const cylX = (r, len, x, color) => b.cyl(r, len, x, 0, 0, color, 0, 0, Math.PI / 2, 12);
  if (name === 'dumbbell') {
    cylX(0.017, 0.2, 0, '#c9ced6');
    cylX(0.065, 0.045, 0.085, '#2b2d33');
    cylX(0.065, 0.045, -0.085, '#2b2d33');
    cylX(0.05, 0.03, 0.12, '#3a3d45');
    cylX(0.05, 0.03, -0.12, '#3a3d45');
  } else if (name === 'glove') {
    b.sphere(0.085, 0, -0.06, 0.015, '#d62828', 1.15);
    b.sphere(0.04, 0.05, -0.04, 0.05, '#d62828');
    b.cyl(0.07, 0.07, 0, 0.03, 0, '#f1f1f1');
  } else if (name === 'barbell') {
    cylX(0.02, 1.8, 0, '#d4d8de');
    cylX(0.23, 0.07, 0.62, '#d62828');
    cylX(0.23, 0.07, -0.62, '#d62828');
    cylX(0.19, 0.05, 0.69, '#2f6fed');
    cylX(0.19, 0.05, -0.69, '#2f6fed');
    cylX(0.035, 0.05, 0.54, '#9aa0a8');
    cylX(0.035, 0.05, -0.54, '#9aa0a8');
  } else if (name === 'hammer') {
    b.cyl(0.024, 0.95, 0, -0.42, 0, '#8b5a2b');
    b.box(0.34, 0.16, 0.16, 0, -0.9, 0, '#2b2d33');
    b.box(0.36, 0.04, 0.17, 0, -0.9, 0, '#d4a017');
  } else if (name === 'ropeHandle') {
    b.cyl(0.025, 0.14, 0, 0, 0, '#ffbe0b');
  }
  const g = mergeParts(b.parts, false);
  PropGeo[name] = g;
  return g;
}

let ROPE_GEO = null;
function ropeGeometry() {
  if (ROPE_GEO) return ROPE_GEO;
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const s = i / 24;
    pts.push(new THREE.Vector3(0.38 - 0.76 * s, Math.sin(Math.PI * s), 0));
  }
  ROPE_GEO = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.014, 5, false);
  return ROPE_GEO;
}
const ROPE_MAT = new THREE.MeshStandardMaterial({ color: 0xff3b6b, roughness: 0.5 });

/* ---------------- Character ---------------- */

const _hand1 = new THREE.Vector3();
const _hand2 = new THREE.Vector3();

class Character {
  constructor(opts = {}) {
    this.o = Object.assign({
      skin: '#d9a07a', hair: '#2a1b12', shirt: '#e63946', accent: '#ffffff', shorts: '#1d2433',
      shoes: '#f2f2f2', sole: '#ffffff', socks: '#ffffff', style: 'tank', band: null, wrist: null,
      longPants: false, highShoes: false, number: false,
    }, opts);
    this.root = new THREE.Group();
    this.bones = [];
    this.B = {};
    for (const [name, parent, x, y, z] of BONE_DEFS) {
      const b = new THREE.Bone();
      b.name = name;
      b.position.set(x, y, z);
      this.bones.push(b);
      this.B[name] = b;
      if (parent >= 0) this.bones[parent].add(b);
    }
    this.B.body.rotation.order = 'YXZ';
    this.mq = Math.round(clamp(opts.muscle || 0, 0, 1) * 8);
    this.mesh = new THREE.SkinnedMesh(buildCharGeometry(this.o, this.mq / 8), CHAR_MAT);
    this.mesh.add(this.bones[0]);
    this.mesh.updateMatrixWorld(true);
    this.mesh.bind(new THREE.Skeleton(this.bones));
    this.root.add(this.mesh);

    this.shadow = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT);
    this.shadow.scale.set(1.1, 1, 1.1);
    this.shadow.position.y = 0.015;
    this.shadow.renderOrder = 1;
    this.root.add(this.shadow);

    this.cur = makePose();
    this.tgt = makePose();
    this.manual = false;
    this.manualPose = makePose();
    this.manualSnap = false;
    this.rate = 16;
    this.action = null;
    this.actionT = 0;
    this.rootSpeed = 0;
    this.speed = 0; // horizontal speed, set by the owner
    this.runBlend = 0;
    this.phase = Math.random() * TAU;
    this.airY = 0;
    this.vy = 0;
    this.grounded = true;
    this.props = {};
    this.ropeAngle = 0;
    this.barbellDrop = null;
    this.time = Math.random() * 10;
    this.onEvent = null;
    this.apply();
  }

  setMuscle(m) {
    const q = Math.round(clamp(m, 0, 1) * 8);
    if (q === this.mq) return;
    this.mq = q;
    const old = this.mesh.geometry;
    this.mesh.geometry = buildCharGeometry(this.o, q / 8);
    old.dispose();
  }

  get busy() { return !!this.action; }

  play(name, onDone) {
    const def = ANIMS[name];
    if (!def || this.action || !this.grounded) return false;
    this.action = { name, def, ev: 0, onDone };
    this.actionT = 0;
    for (const p of def.props || []) this.showProp(p, true);
    if (name === 'lift') this.barbellDrop = null;
    return true;
  }

  stopAction(silent = true) {
    if (!this.action) return;
    const a = this.action;
    this.action = null;
    for (const p of a.def.props || []) this.showProp(p, false);
    this.rootSpeed = 0;
    this.cur.bx = wrapAngle(this.cur.bx);
    this.cur.by = wrapAngle(this.cur.by);
    this.cur.bz = wrapAngle(this.cur.bz);
    if (!silent && a.onDone) a.onDone(a.name);
  }

  jump(v = 5.5) {
    if (!this.grounded || this.action) return false;
    this.vy = v;
    this.grounded = false;
    return true;
  }

  showProp(name, on) {
    if (on && !this.props[name]) this.props[name] = this.createProp(name);
    const pr = this.props[name];
    if (pr) for (const m of pr.meshes) m.visible = on;
  }

  createProp(name) {
    const meshes = [];
    const pr = { meshes };
    if (name === 'dumbbells') {
      for (const s of ['haL', 'haR']) {
        const m = new THREE.Mesh(propGeo('dumbbell'), PROP_MAT);
        m.position.set(0, -0.05, 0);
        this.B[s].add(m);
        meshes.push(m);
      }
    } else if (name === 'gloves') {
      for (const s of ['haL', 'haR']) {
        const m = new THREE.Mesh(propGeo('glove'), PROP_MAT);
        this.B[s].add(m);
        meshes.push(m);
      }
    } else if (name === 'hammer') {
      const m = new THREE.Mesh(propGeo('hammer'), PROP_MAT);
      m.position.set(0.1, -0.04, 0);
      m.rotation.x = 0.55;
      this.B.haR.add(m);
      meshes.push(m);
    } else if (name === 'barbell') {
      const m = new THREE.Mesh(propGeo('barbell'), PROP_MAT);
      this.root.add(m);
      meshes.push(m);
      pr.bar = m;
    } else if (name === 'rope') {
      const holder = new THREE.Group();
      holder.position.set(0, 0.15, 0.28);
      holder.scale.set(1.13, 1.18, 0.62);
      const spin = new THREE.Group();
      holder.add(spin);
      const rope = new THREE.Mesh(ropeGeometry(), ROPE_MAT);
      spin.add(rope);
      this.B.body.add(holder);
      meshes.push(holder);
      for (const s of ['haL', 'haR']) {
        const h = new THREE.Mesh(propGeo('ropeHandle'), PROP_MAT);
        h.position.set(0, -0.05, 0);
        this.B[s].add(h);
        meshes.push(h);
      }
      pr.spin = spin;
    }
    return pr;
  }

  setLabel(name, sub, color = '#ffd34d') {
    if (!this.label) {
      const tex = makeCanvasTexture(256, 84, () => {});
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      this.label = new THREE.Sprite(mat);
      this.label.scale.set(1.5, 0.49, 1);
      this.label.position.y = 2.3;
      this.label.renderOrder = 5;
      this.root.add(this.label);
    }
    const key = name + '|' + sub + '|' + color;
    if (this.labelKey === key) return;
    this.labelKey = key;
    redrawCanvasTexture(this.label.material.map, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(8,12,26,0.72)';
      roundRect(ctx, 6, 6, w - 12, h - 12, 18);
      ctx.fill();
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 30px ${UI_FONT}`;
      ctx.fillText(name, w / 2, 32);
      ctx.fillStyle = color;
      ctx.font = `700 22px ${UI_FONT}`;
      ctx.fillText(sub, w / 2, 62);
    });
  }

  locomotion(p, dt) {
    if (!this.grounded) {
      const up = clamp(this.vy / 5, -1, 1);
      p.hpLX = -0.7; p.hpRX = -0.2;
      p.knL = 1.1; p.knR = 0.5;
      p.shLX = -0.9 - 0.4 * up; p.shRX = 0.3;
      p.shLZ = 0.4; p.shRZ = -0.4;
      p.elL = p.elR = -0.9;
      p.spX = 0.2;
      return;
    }
    const sp = this.speed;
    if (sp < 0.2) {
      const br = Math.sin(this.time * 2.2) * 0.025;
      p.spX = br;
      p.shLZ = 0.13 + br; p.shRZ = -p.shLZ;
      p.nkX = -br;
      return;
    }
    const r = clamp((sp - 2.2) / 2.6, 0, 1);
    this.runBlend = r;
    this.phase += dt * (4.6 + sp * 1.25);
    gait(p, this.phase, r);
  }

  update(dt) {
    this.time += dt;
    const p = this.tgt;
    copyPose(p, STAND);
    let snap = false;
    let finished = false;
    this.rootSpeed = 0;
    if (this.manual) {
      copyPose(p, this.manualPose);
      snap = this.manualSnap;
    } else if (this.action) {
      this.actionT += dt;
      const A = this.action.def;
      const t = Math.min(1, this.actionT / A.dur);
      A.fn(p, t, this);
      if (A.move) this.rootSpeed = A.move(t);
      const evs = A.events || [];
      while (this.action.ev < evs.length && t >= evs[this.action.ev][0]) {
        if (this.onEvent) this.onEvent(evs[this.action.ev][1], this);
        this.action.ev++;
      }
      snap = true;
      finished = t >= 1;
    } else {
      this.locomotion(p, dt);
    }
    if (p.autoAnkle) {
      p.anL = -(p.hpLX + p.knL);
      p.anR = -(p.hpRX + p.knR);
    }
    if (!this.grounded) {
      this.vy -= 20 * dt;
      this.airY += this.vy * dt;
      if (this.airY <= 0) {
        this.airY = 0;
        this.vy = 0;
        this.grounded = true;
        if (this.onEvent) this.onEvent('hop', this);
      }
    }
    const a = damp(this.rate, dt);
    const c = this.cur;
    for (const k of POSE_KEYS) {
      if (snap && ROOT_KEYS.has(k)) c[k] = p[k];
      else c[k] += (p[k] - c[k]) * a;
    }
    if (finished) {
      const act = this.action;
      this.action = null;
      c.bx = wrapAngle(c.bx); c.by = wrapAngle(c.by); c.bz = wrapAngle(c.bz);
      for (const pr of act.def.props || []) this.showProp(pr, false);
      if (act.onDone) act.onDone(act.name);
    }
    this.apply();
    this.updateProps(dt);
  }

  apply() {
    const c = this.cur;
    const B = this.B;
    B.body.position.set(c.x, HIP_H + c.y + this.airY, c.z);
    B.body.rotation.set(c.bx, c.by, c.bz);
    B.spine.rotation.set(c.spX, c.spY, c.spZ);
    B.head.rotation.set(c.nkX, c.nkY, 0);
    B.shL.rotation.set(c.shLX, c.shLY, c.shLZ);
    B.shR.rotation.set(c.shRX, c.shRY, c.shRZ);
    B.elL.rotation.x = c.elL;
    B.elR.rotation.x = c.elR;
    B.hpL.rotation.set(c.hpLX, 0, c.hpLZ);
    B.hpR.rotation.set(c.hpRX, 0, c.hpRZ);
    B.knL.rotation.x = c.knL;
    B.knR.rotation.x = c.knR;
    B.anL.rotation.x = c.anL;
    B.anR.rotation.x = c.anR;
    const h = Math.max(0, c.y + this.airY + 0.3);
    const s = clamp(1.15 - h * 0.35, 0.45, 1.3);
    const lying = Math.abs(Math.sin(c.bx));
    this.shadow.position.set(c.x, 0.015, c.z);
    this.shadow.scale.set(s, 1, s * (1 + lying * 1.1));
  }

  updateProps(dt) {
    const rope = this.props.rope;
    if (rope && rope.spin.parent.visible) rope.spin.rotation.x = this.ropeAngle;
    const bb = this.props.barbell;
    if (bb && bb.bar.visible) {
      const A = this.action && this.action.def;
      const t = A ? this.actionT / A.dur : 1;
      const dropAt = A && A.barbellDrop ? A.barbellDrop : 2;
      if (t < dropAt) {
        this.root.updateMatrixWorld(true);
        this.B.haL.getWorldPosition(_hand1);
        this.B.haR.getWorldPosition(_hand2);
        _hand1.add(_hand2).multiplyScalar(0.5);
        this.root.worldToLocal(_hand1);
        bb.bar.position.copy(_hand1);
        bb.bar.position.y -= 0.04;
        bb.bar.scale.setScalar(1);
        this.barbellDrop = { vy: 0 };
      } else if (this.barbellDrop) {
        const d = this.barbellDrop;
        d.vy -= 18 * dt;
        bb.bar.position.y += d.vy * dt;
        if (bb.bar.position.y < 0.23) {
          bb.bar.position.y = 0.23;
          d.vy = Math.abs(d.vy) > 2 ? -d.vy * 0.3 : 0;
        }
        bb.bar.scale.setScalar(1 - smooth(seg(t, 0.93, 1)));
      }
    }
  }
}

/* ---------------- Outfits ---------------- */

const PALETTE = {
  shirts: ['#e63946', '#2f6fed', '#2ecc71', '#f4a261', '#9b5de5', '#00b4d8', '#ff006e', '#ffbe0b', '#23262e', '#f1faee', '#06d6a0', '#ef476f', '#ff7b00'],
  shorts: ['#1d2433', '#22223b', '#343a40', '#3a0ca3', '#1b4332', '#5c636a', '#003049', '#111111'],
  shoes: ['#f8f9fa', '#212529', '#e63946', '#3a86ff', '#ffbe0b', '#06d6a0', '#ff006e'],
  skins: ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#d9a07a', '#b97a56'],
  hair: ['#1b1b1b', '#2a1b12', '#4a2e1a', '#6b4423', '#a0522d', '#111111', '#3b3b3b'],
};

function randomOutfit() {
  const shirt = pick(PALETTE.shirts);
  return {
    skin: pick(PALETTE.skins),
    hair: pick(PALETTE.hair),
    shirt,
    accent: pick(['#ffffff', '#ffd34d', '#111111', '#e5e5e5']),
    shorts: pick(PALETTE.shorts),
    shoes: pick(PALETTE.shoes),
    sole: '#f5f5f5',
    socks: pick(['#ffffff', '#ffffff', '#111111']),
    style: Math.random() < 0.55 ? 'tee' : 'tank',
    band: Math.random() < 0.3 ? pick(['#ffffff', '#e63946', '#ffd34d', '#2f6fed']) : null,
    wrist: Math.random() < 0.35 ? pick(['#ffffff', '#111111', '#e63946']) : null,
    number: Math.random() < 0.4,
  };
}
