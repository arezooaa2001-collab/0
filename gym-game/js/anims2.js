'use strict';
/*
 * 40 more exercises. Most are built from two key poses the body moves between
 * (keyAnim); the acrobatic and equipment ones have their own timelines.
 */

const BASES = {
  plank: { bx: 1.16, y: 0.39 - HIP_H, shLX: -1.16, shRX: -1.16, elL: 0, elR: 0, shLZ: 0.3, shRZ: -0.3, nkX: -0.6, hpLZ: 0.05, hpRZ: -0.05, knL: 0, knR: 0, autoAnkle: false, anL: 0.95, anR: 0.95 },
  lieBack: { bx: -Math.PI / 2, y: 0.17 - HIP_H, shLX: 0, shRX: 0, shLZ: 0.15, shRZ: -0.15, elL: 0, elR: 0, knL: 0, knR: 0 },
  prone: { bx: Math.PI / 2, y: 0.15 - HIP_H, shLX: -3.0, shRX: -3.0, shLZ: 0.25, shRZ: -0.25, elL: 0, elR: 0, knL: 0, knR: 0, autoAnkle: false, anL: 0.8, anR: 0.8 },
  allFours: { bx: 1.5, y: 0.55 - HIP_H, hpLX: -1.5, hpRX: -1.5, knL: 1.57, knR: 1.57, shLX: -1.5, shRX: -1.5, elL: -0.1, elR: -0.1, autoAnkle: false, anL: 0.5, anR: 0.5 },
  seated: { bx: -0.6, y: 0.16 - HIP_H, hpLX: -1.0, hpRX: -1.0, knL: 1.4, knR: 1.4, shLX: -1.0, shRX: -1.0, elL: -1.0, elR: -1.0, shLZ: -0.35, shRZ: 0.35 },
  guard: { hpLX: -0.3, hpRX: 0.2, knL: 0.35, knR: 0.35, spX: 0.15, shLX: -0.55, shRX: -0.55, shLZ: 0.18, shRZ: -0.18, shLY: -0.35, shRY: 0.35, elL: -2.3, elR: -2.3 },
};

/** Two key poses a and b on top of an optional base; the body swings a→b→a `reps` times. */
function keyAnim({ dur, reps = 2, base = null, a = {}, b = {}, inOut = 0.14, plantFeet = false, hop = 0, hopEvery = 1, wobble = 0, extra, props, events }) {
  return {
    dur, props, events,
    fn(p, t, ch) {
      const k = smooth(seg(t, 0, inOut)) * (1 - smooth(seg(t, 1 - inOut, 1)));
      const u = seg(t, inOut, 1 - inOut);
      const d = (1 - Math.cos(u * reps * TAU)) / 2;
      const q = makePose();
      if (base) Object.assign(q, base);
      const A = Object.assign({}, q, a);
      const B = Object.assign({}, q, b);
      for (const key of POSE_KEYS) q[key] = lerp(A[key], B[key], d);
      q.autoAnkle = A.autoAnkle && B.autoAnkle;
      if (plantFeet) plant(q, false);
      if (hop) q.y += hop * Math.abs(Math.sin(u * reps * hopEvery * Math.PI));
      if (wobble) q.y += wobble * Math.sin(t * 60);
      if (extra) extra(q, t, u, d, ch);
      mixInto(p, q, k);
      if (!q.autoAnkle) p.autoAnkle = false;
      if (base && Math.abs(base.bx || 0) > 0.3) {
        const mid = Math.sin(Math.PI * k);
        p.knL += 0.9 * mid; p.knR += 0.9 * mid;
        p.hpLX -= 0.45 * mid; p.hpRX -= 0.45 * mid;
      }
    },
  };
}

const PUSH_BOTTOM = { y: 0.24 - HIP_H, bx: 1.33, shLX: -0.33, shRX: -0.33, elL: -1.05, elR: -1.05 };

/** Ball and other hand-held props follow the midpoint of the hands until released. */
const _bh1 = new THREE.Vector3();
const _bh2 = new THREE.Vector3();
function handsMidLocal(ch, out) {
  ch.root.updateMatrixWorld(true);
  ch.B.haL.getWorldPosition(_bh1);
  ch.B.haR.getWorldPosition(_bh2);
  out.copy(_bh1).add(_bh2).multiplyScalar(0.5);
  return ch.root.worldToLocal(out);
}

function ballProp(color, r, mode) {
  return (ch, pr) => {
    const b = new Batch();
    b.sphere(r, 0, 0, 0, color);
    b.add(UnitGeo.torus(1, 0.04, 6, 20), 0, 0, 0, '#ffffff', Math.PI / 2, 0, 0, r * 1.01, r * 1.01, r * 1.01);
    const m = new THREE.Mesh(mergeParts(b.parts, false), PROP_MAT);
    ch.root.add(m);
    pr.meshes.push(m);
    pr.ball = m;
    const from = new THREE.Vector3();
    pr.tick = (c) => {
      const A = c.action && c.action.def;
      if (!A) return;
      const t = c.actionT / A.dur;
      const rel = A.releaseAt || 2;
      if (mode === 'ground' && t < rel) {
        m.position.set(0, r, 0.55);
        from.copy(m.position);
      } else if (t < rel) {
        handsMidLocal(c, m.position);
        m.position.y += 0.05;
        from.copy(m.position);
      } else {
        const f = clamp((t - rel) / (1 - rel), 0, 1);
        const [tx, ty, tz] = A.target || [0, 3, 5];
        m.position.set(lerp(from.x, tx, f), lerp(from.y, ty, f) + Math.sin(Math.PI * f) * 1.6, lerp(from.z, tz, f));
        m.rotation.x += 0.3;
        m.visible = f < 0.98;
      }
    };
  };
}

const EXTRA_PROPS = {
  skis(ch, pr) {
    for (const s of ['anL', 'anR']) {
      const b = new Batch();
      b.box(0.1, 0.03, 1.6, 0, -0.09, 0.18, '#e63946');
      b.box(0.1, 0.03, 0.2, 0, -0.06, 0.95, '#e63946', 0, -0.5);
      const m = new THREE.Mesh(mergeParts(b.parts, false), PROP_MAT);
      ch.B[s].add(m);
      pr.meshes.push(m);
    }
    for (const s of ['haL', 'haR']) {
      const b = new Batch();
      b.cyl(0.015, 1.2, 0, -0.55, 0, '#c9ced6');
      b.cyl(0.05, 0.02, 0, -1.05, 0, '#222222');
      const m = new THREE.Mesh(mergeParts(b.parts, false), PROP_MAT);
      m.rotation.x = 0.5;
      ch.B[s].add(m);
      pr.meshes.push(m);
    }
  },
  skates(ch, pr) {
    for (const s of ['anL', 'anR']) {
      const b = new Batch();
      b.box(0.025, 0.07, 0.32, 0, -0.11, 0.05, '#dfe6ee');
      const m = new THREE.Mesh(mergeParts(b.parts, false), PROP_MAT);
      ch.B[s].add(m);
      pr.meshes.push(m);
    }
  },
  hoop(ch, pr) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 8, 40), new THREE.MeshStandardMaterial({ color: '#ff4d8d', roughness: 0.4 }));
    m.rotation.x = Math.PI / 2;
    ch.root.add(m);
    pr.meshes.push(m);
    pr.tick = (c) => {
      const a = c.hoopAngle || 0;
      m.position.set(Math.cos(a + Math.PI) * 0.16 + c.cur.x, HIP_H + 0.05 + c.cur.y, Math.sin(a + Math.PI) * 0.16 + c.cur.z);
    };
  },
  bball: ballProp('#e8742a', 0.13, 'hands'),
  vball: ballProp('#ffd34d', 0.12, 'hands'),
  sball: ballProp('#f5f5f5', 0.12, 'ground'),
};

/* ---------- custom timelines ---------- */

function burpeeFn(p, t) {
  const k = smooth(seg(t, 0, 0.06)) * (1 - smooth(seg(t, 0.94, 1)));
  const r = (seg(t, 0.04, 0.96) * 2) % 1;
  const q = makePose();
  if (r < 0.2) crouchPose(q, smooth(r / 0.2));
  else if (r < 0.45) {
    const u = smooth((r - 0.2) / 0.25);
    crouchPose(q, 1 - u);
    const pl = Object.assign(makePose(), BASES.plank);
    mixInto(q, pl, u);
  } else if (r < 0.62) {
    const u = smooth((r - 0.45) / 0.17);
    Object.assign(q, BASES.plank);
    const c = makePose();
    crouchPose(c, 1);
    mixInto(q, c, u);
  } else {
    const a = (r - 0.62) / 0.38;
    crouchPose(q, Math.max(0, 1 - a * 4));
    q.y += 0.8 * Math.sin(Math.PI * clamp((a - 0.15) / 0.75, 0, 1));
    q.shLX = q.shRX = -2.9 * Math.sin(Math.PI * a);
  }
  mixInto(p, q, k);
  p.autoAnkle = q.autoAnkle !== false;
}

function jumpSquatFn(p, t) {
  const r = (seg(t, 0.03, 0.97) * 3) % 1;
  if (r < 0.45) {
    const c = Math.sin((Math.PI / 2) * (r / 0.45));
    crouchPose(p, c);
    p.shLX = p.shRX = 0.7 * c;
  } else {
    const a = (r - 0.45) / 0.55;
    crouchPose(p, Math.max(0, 1 - a * 5) + 0.6 * smooth(seg(a, 0.85, 1)));
    p.y += 0.75 * Math.sin(Math.PI * clamp((a - 0.05) / 0.8, 0, 1));
    p.shLX = p.shRX = -2.6 * Math.sin(Math.PI * clamp(a / 0.85, 0, 1));
  }
}

function starJumpFn(p, t) {
  const r = (seg(t, 0.02, 0.98) * 2) % 1;
  if (r < 0.25) {
    crouchPose(p, smooth(r / 0.25));
    p.shLX = p.shRX = 0.6 * smooth(r / 0.25);
    return;
  }
  const a = clamp((r - 0.25) / 0.6, 0, 1);
  const s = Math.sin(Math.PI * a);
  crouchPose(p, r > 0.85 ? 0.6 * Math.sin(Math.PI * (r - 0.85) / 0.15) : 0);
  p.y += 0.95 * 4 * a * (1 - a);
  p.shLZ = 0.12 + 2.55 * s; p.shRZ = -p.shLZ;
  p.hpLZ = 0.03 + 0.62 * s; p.hpRZ = -p.hpLZ;
  p.elL = p.elR = -0.1;
}

function cartwheelFn(p, t) {
  const a = smooth(seg(t, 0.1, 0.9));
  const th = TAU * a;
  p.bz = th;
  p.shLZ = 0.12 + 2.6 * Math.sin(Math.PI * seg(t, 0, 0.2) / 2) * (1 - smooth(seg(t, 0.88, 1)));
  p.shRZ = -p.shLZ;
  p.hpLZ = 0.03 + 0.65 * Math.sin(Math.PI * a); p.hpRZ = -p.hpLZ;
  p.elL = p.elR = -0.05;
  p.y = -0.2 * Math.abs(Math.sin(th)) + 0.26 * (1 - Math.cos(th)) / 2;
}

function headspinFn(p, t) {
  const up = smooth(seg(t, 0, 0.2));
  const down = smooth(seg(t, 0.82, 1));
  const u = up * (1 - down);
  p.bx = Math.PI * u;
  p.y = lerp(0, 0.06, u) - 0.42 * Math.sin(Math.PI * u);
  p.by = TAU * 3 * smooth(seg(t, 0.2, 0.82));
  p.hpLZ = 0.03 + 0.7 * u; p.hpRZ = -p.hpLZ;
  p.shLZ = 0.12 + 1.2 * u; p.shRZ = -p.shLZ;
  p.elL = p.elR = -0.3;
  p.nkX = -0.3 * u;
  p.autoAnkle = false;
  p.anL = p.anR = 0.8 * u;
}

function splitFn(p, t) {
  const k = smooth(seg(t, 0, 0.25)) * (1 - smooth(seg(t, 0.78, 1)));
  const q = makePose();
  q.hpLX = -1.45; q.hpRX = 1.45; q.knL = q.knR = 0;
  q.y = 0.13 - HIP_H;
  q.shLZ = 1.6 + 0.1 * Math.sin(t * 12); q.shRZ = -q.shLZ;
  q.elL = q.elR = -0.1;
  q.autoAnkle = false;
  q.anL = 0.7; q.anR = -0.4;
  mixInto(p, q, k);
  const mid = Math.sin(Math.PI * k);
  p.knL += 0.7 * mid; p.knR += 0.7 * mid;
  p.autoAnkle = false;
}

function diveFn(p, t) {
  if (t < 0.15) {
    crouchPose(p, smooth(t / 0.15));
    p.shLX = p.shRX = 0.9 * smooth(t / 0.15);
    return;
  }
  const a = seg(t, 0.15, 0.8);
  tuck(p, a, 0.8);
  p.bx = (TAU + Math.PI / 2) * smooth(a);
  p.y = 4 * 0.9 * a * (1 - a) - 2.6 * a * a;
  if (t > 0.8) {
    p.y = -2.6 - (t - 0.8) * 3;
    p.bx = TAU + Math.PI / 2;
    p.shLX = p.shRX = -3.0;
    p.hpLX = p.hpRX = 0; p.knL = p.knR = 0;
  }
}

function swimFn(p, t) {
  const k = smooth(seg(t, 0, 0.1)) * (1 - smooth(seg(t, 0.9, 1)));
  const ph = t * 3.6 * 6;
  const q = makePose();
  q.bx = Math.PI / 2;
  q.y = 0.12 - HIP_H;
  q.shLX = -1.57 + 1.5 * Math.sin(ph);
  q.shRX = -1.57 - 1.5 * Math.sin(ph);
  q.shLZ = 0.2; q.shRZ = -0.2;
  q.elL = q.elR = -0.2;
  q.hpLX = 0.25 * Math.sin(ph * 3); q.hpRX = -q.hpLX;
  q.knL = q.knR = 0.1;
  q.nkX = -0.5; q.nkY = 0.6 * Math.max(0, Math.sin(ph));
  q.autoAnkle = false; q.anL = q.anR = 0.8;
  mixInto(p, q, k);
  p.autoAnkle = false;
}

function climbFn(p, t) {
  const k = smooth(seg(t, 0, 0.1));
  const drop = smooth(seg(t, 0.86, 1));
  const ph = seg(t, 0.1, 0.86) * 6 * Math.PI;
  const h = 1.9 * seg(t, 0.1, 0.86) * (1 - drop);
  p.y = h;
  p.z = -0.12 * k * (1 - drop);
  p.shLX = lerp(0.05, -2.7 + 0.5 * Math.sin(ph), k * (1 - drop));
  p.shRX = lerp(0.05, -2.7 - 0.5 * Math.sin(ph), k * (1 - drop));
  p.shLZ = 0.35; p.shRZ = -0.35;
  p.elL = p.elR = -0.6 * k * (1 - drop);
  p.hpLX = (-0.9 + 0.5 * Math.sin(ph)) * k * (1 - drop);
  p.hpRX = (-0.9 - 0.5 * Math.sin(ph)) * k * (1 - drop);
  p.knL = p.knR = 1.3 * k * (1 - drop);
  p.hpLZ = 0.25; p.hpRZ = -0.25;
  p.spX = 0.1;
}

function spikeFn(p, t) {
  if (t < 0.28) {
    crouchPose(p, smooth(t / 0.28) * 0.9);
    p.shLX = p.shRX = 0.9 * smooth(t / 0.28);
    return;
  }
  const a = seg(t, 0.28, 0.85);
  p.y = 1.15 * 4 * a * (1 - a);
  p.hpLX = p.hpRX = -0.3;
  p.knL = p.knR = 0.6;
  const hit = smooth(seg(t, 0.5, 0.62));
  p.shRX = lerp(-3.0, -0.6, hit); p.elR = lerp(-1.6, 0, hit);
  p.shLX = -2.2 + 1.0 * hit; p.elL = -0.3;
  p.spX = lerp(-0.35, 0.35, hit);
  p.spY = lerp(0.4, -0.3, hit);
  if (t > 0.85) crouchPose(p, Math.sin(Math.PI * seg(t, 0.85, 1)) * 0.7);
}

function basketFn(p, t) {
  if (t < 0.28) {
    const c = smooth(t / 0.28);
    crouchPose(p, c * 0.75);
    p.shLX = p.shRX = -1.2;
    p.elL = p.elR = -1.7;
    p.shLZ = -0.25; p.shRZ = 0.25;
    return;
  }
  const a = seg(t, 0.28, 0.85);
  p.y = 0.75 * 4 * a * (1 - a);
  const up = smooth(seg(t, 0.32, 0.6));
  p.shLX = p.shRX = lerp(-1.2, -2.75, up);
  p.elL = p.elR = lerp(-1.7, -0.25, up);
  p.shLZ = -0.2; p.shRZ = 0.2;
  p.knL = p.knR = 0.3 * (1 - up);
  if (t > 0.85) crouchPose(p, Math.sin(Math.PI * seg(t, 0.85, 1)) * 0.6);
}

function penaltyFn(p, t) {
  if (t < 0.42) {
    gait(p, t * 22, 0.6);
    p.z = lerp(-1.1, -0.15, t / 0.42);
    return;
  }
  const a = seg(t, 0.42, 0.75);
  const sw = Math.sin(Math.PI * a);
  p.z = -0.15;
  p.hpRX = lerp(0.9, -1.3, smooth(a));
  p.knR = 1.2 * (1 - smooth(a)) + 0.1;
  p.hpLX = -0.2; p.knL = 0.35;
  p.shLZ = 0.12 + 1.0 * sw; p.shRZ = -0.12 - 0.6 * sw;
  p.spX = -0.15 * sw;
  plant(p, false);
}

function giantSwingFn(p, t, barH = 2.7) {
  const grab = smooth(seg(t, 0, 0.12));
  const drop = smooth(seg(t, 0.9, 1));
  const th = TAU * 2 * smooth(seg(t, 0.12, 0.9));
  const hang = grab * (1 - drop);
  p.shLX = p.shRX = lerp(0.05, -Math.PI, hang);
  p.shLZ = lerp(0.12, 0.12, hang); p.shRZ = -p.shLZ;
  p.elL = p.elR = lerp(-0.18, 0, hang);
  p.hpLX = p.hpRX = -0.25 * hang * Math.abs(Math.sin(th / 2));
  p.bx = th;
  p.y = hang * (barH - 1.18 * Math.cos(th) - HIP_H);
  p.z = -1.18 * Math.sin(th) * hang;
  p.autoAnkle = false;
  p.anL = p.anR = 0.7 * hang;
}

function ringsFn(p, t) {
  ANIMS.pullup.fn(p, t);
  const hang = smooth(seg(t, 0.12, 0.2)) * (1 - smooth(seg(t, 0.84, 0.9)));
  p.hpLX = p.hpRX = lerp(p.hpLX, -1.45, hang);
  p.knL = p.knR = lerp(p.knL, 0, hang);
  p.shLZ += 0.12 * hang; p.shRZ -= 0.12 * hang;
}

function trampolineFn(p, t) {
  const bounces = 3;
  const r = seg(t, 0.05, 0.95) * bounces;
  const i = Math.min(bounces - 1, Math.floor(r));
  const a = r - i;
  const h = 1.0 + i * 0.45;
  p.y = h * 4 * a * (1 - a) - 0.12 * Math.max(0, 1 - a * 8) - 0.12 * Math.max(0, a * 8 - 7);
  p.shLX = p.shRX = -2.6 * Math.sin(Math.PI * a);
  p.shLZ = 0.4; p.shRZ = -0.4;
  if (i === bounces - 1) {
    tuck(p, a, 0.9);
    p.bx = -TAU * smooth(clamp((a - 0.1) / 0.8, 0, 1));
  }
}

Object.assign(ANIMS, {
  lunge: keyAnim({ dur: 2.6, reps: 3, plantFeet: true, b: { hpLX: -1.25, knL: 1.35, hpRX: 0.55, knR: 1.45, spX: 0.05, shLZ: 0.45, shRZ: -0.45, elL: -1.5, elR: -1.5 }, a: { shLZ: 0.45, shRZ: -0.45, elL: -1.5, elR: -1.5 } }),
  burpee: { dur: 3.6, events: [[0.38, 'hop'], [0.88, 'hop']], fn: burpeeFn },
  mountain: keyAnim({ dur: 2.4, reps: 4, base: BASES.plank, a: { hpLX: -1.5, knL: 1.7 }, b: { hpRX: -1.5, knR: 1.7 } }),
  plank: keyAnim({ dur: 3.2, reps: 1, base: { bx: 1.35, y: 0.21 - HIP_H, shLX: -1.35, shRX: -1.35, elL: -1.57, elR: -1.57, shLZ: 0.2, shRZ: -0.2, nkX: -0.5, knL: 0, knR: 0, autoAnkle: false, anL: 0.95, anR: 0.95 }, wobble: 0.004 }),
  bridge: keyAnim({ dur: 2.8, reps: 3, base: Object.assign({}, BASES.lieBack, { hpLX: -1.0, hpRX: -1.0, knL: 2.0, knR: 2.0 }), b: { y: 0.4 - HIP_H, bx: -1.15 } }),
  bikecrunch: keyAnim({ dur: 2.8, reps: 3, base: Object.assign({}, BASES.lieBack, { spX: 0.7, nkX: 0.4, shLX: -2.7, shRX: -2.7, shLZ: 0.6, shRZ: -0.6, elL: -2.3, elR: -2.3 }),
    a: { hpLX: -1.6, knL: 1.6, hpRX: -0.5, knR: 0.2, spY: 0.45 }, b: { hpRX: -1.6, knR: 1.6, hpLX: -0.5, knL: 0.2, spY: -0.45 } }),
  highknees: keyAnim({ dur: 2.0, reps: 4, plantFeet: true, hop: 0.1, hopEvery: 2, inOut: 0.08,
    a: { hpLX: -1.6, knL: 1.8, shLX: 0.6, shRX: -0.9, elL: -1.4, elR: -1.4 }, b: { hpRX: -1.6, knR: 1.8, shRX: 0.6, shLX: -0.9, elL: -1.4, elR: -1.4 } }),
  buttkick: keyAnim({ dur: 2.0, reps: 4, plantFeet: true, hop: 0.08, hopEvery: 2, inOut: 0.08,
    a: { knL: 2.4, hpLX: 0.15, shLX: -0.6, shRX: 0.5, elL: -1.3, elR: -1.3 }, b: { knR: 2.4, hpRX: 0.15, shRX: -0.6, shLX: 0.5, elL: -1.3, elR: -1.3 } }),
  jumpsquat: { dur: 2.7, events: [[0.32, 'jump'], [0.64, 'jump'], [0.96, 'hop']], fn: jumpSquatFn },
  diamond: keyAnim({ dur: 2.6, reps: 2, base: Object.assign({}, BASES.plank, { shLZ: 0.04, shRZ: -0.04 }), b: Object.assign({}, PUSH_BOTTOM, { shLZ: 0.04, shRZ: -0.04 }) }),
  clap: keyAnim({ dur: 2.8, reps: 3, base: BASES.plank, b: PUSH_BOTTOM, events: [[0.33, 'punch'], [0.6, 'punch']],
    extra(q, t, u) {
      const c = Math.pow(Math.max(0, Math.cos(u * 3 * TAU)), 6);
      q.y += 0.2 * c;
      q.shLZ -= 0.65 * c; q.shRZ += 0.65 * c;
      q.shLX -= 0.4 * c; q.shRX -= 0.4 * c;
    } }),
  superman: keyAnim({ dur: 2.8, reps: 3, base: BASES.prone, b: { spX: -0.35, nkX: -0.4, hpLX: 0.35, hpRX: 0.35 } }),
  legraise: keyAnim({ dur: 2.8, reps: 3, base: BASES.lieBack, b: { hpLX: -1.45, hpRX: -1.45 } }),
  russian: keyAnim({ dur: 2.8, reps: 4, base: BASES.seated, a: { spY: 0.7 }, b: { spY: -0.7 } }),
  starjump: { dur: 2.4, events: [[0.14, 'jump'], [0.63, 'jump']], fn: starJumpFn },
  skater: keyAnim({ dur: 2.4, reps: 3, plantFeet: true, hop: 0.3, hopEvery: 2,
    a: { x: 0.45, hpRX: 0.5, knR: 0.9, hpRZ: 0.3, knL: 0.5, hpLX: -0.3, bz: -0.15, spX: 0.4, shLX: -0.8, shRX: 0.6 },
    b: { x: -0.45, hpLX: 0.5, knL: 0.9, hpLZ: -0.3, knR: 0.5, hpRX: -0.3, bz: 0.15, spX: 0.4, shRX: -0.8, shLX: 0.6 } }),
  toetouch: keyAnim({ dur: 2.6, reps: 2, b: { spX: 1.35, nkX: 0.3, shLX: -1.1, shRX: -1.1, elL: 0, elR: 0 } }),
  tree: keyAnim({ dur: 3.2, reps: 2, plantFeet: true, base: { hpRX: -0.6, hpRZ: -1.1, knR: 2.3, shLX: -3.05, shRX: -3.05, shLZ: 0.08, shRZ: -0.08, elL: -0.1, elR: -0.1 }, b: { bz: 0.05 } }),
  catcow: keyAnim({ dur: 3.0, reps: 3, base: BASES.allFours, a: { spX: 0.35, nkX: 0.5 }, b: { spX: -0.35, nkX: -0.5 } }),
  shadow: { dur: 2.0, events: [[0.2, 'punch'], [0.4, 'punch'], [0.6, 'punch'], [0.8, 'punch']], fn: ANIMS.box.fn },
  uppercut: keyAnim({ dur: 2.2, reps: 3, plantFeet: true, base: BASES.guard, events: [[0.25, 'punch'], [0.5, 'punch'], [0.75, 'punch']],
    a: { shLX: -2.0, elL: -1.2, spY: -0.35, knL: 0.1 }, b: { shRX: -2.0, elR: -1.2, spY: 0.35, knR: 0.1 } }),
  frontkick: keyAnim({ dur: 2.2, reps: 3, plantFeet: true, base: BASES.guard, events: [[0.25, 'whoosh'], [0.5, 'whoosh'], [0.75, 'whoosh']],
    b: { hpRX: -1.8, knR: 0.1, spX: -0.25, shLZ: 0.6, shRZ: -0.6 } }),
  cartwheel: { dur: 1.7, events: [[0.1, 'whoosh'], [0.9, 'land']], side: (t) => (t > 0.1 && t < 0.9 ? -2.0 : 0), fn: cartwheelFn },
  dbackflip: {
    dur: 1.8, events: [[0.15, 'jump'], [0.84, 'land']], move: (t) => (t > 0.15 && t < 0.84 ? -1.3 : 0),
    fn(p, t) { flipAnim(p, t, 0.15, 0.84, 2.4, (q, a) => { tuck(q, a, 1.1); q.bx = -2 * TAU * smooth(a); }); },
  },
  spin1080: {
    dur: 1.8, events: [[0.14, 'jump'], [0.84, 'land']],
    fn(p, t) { ANIMS.jumpspin.fn(p, t); p.by *= 1.5; if (t > 0.14 && t < 0.84) p.y *= 1.35; },
  },
  headspin: { dur: 3.4, events: [[0.2, 'whoosh']], fn: headspinFn },
  split: { dur: 3.2, fn: splitFn },
  hoop: keyAnim({ dur: 3.2, reps: 1, props: ['hoop'], base: { shLX: -2.8, shRX: -2.8, shLZ: 0.45, shRZ: -0.45, elL: -0.2, elR: -0.2, knL: 0.15, knR: 0.15 },
    extra(q, t, u, d, ch) { const ph = t * 3.2 * 9; q.x = 0.07 * Math.cos(ph); q.z = 0.07 * Math.sin(ph); if (ch) ch.hoopAngle = ph; } }),
  swim: { dur: 3.6, fn: swimFn },
  dive: { dur: 2.0, events: [[0.15, 'jump'], [0.8, 'splash']], move: (t) => (t > 0.15 && t < 0.8 ? 1.6 : 0), fn: diveFn },
  ski: keyAnim({ dur: 3.0, reps: 3, plantFeet: true, props: ['skis'], base: { hpLX: -0.6, hpRX: -0.6, knL: 0.9, knR: 0.9, spX: 0.45, shLX: -0.5, shRX: -0.5, elL: -0.6, elR: -0.6, shLZ: 0.4, shRZ: -0.4 },
    a: { x: 0.5, bz: -0.25, by: 0.3 }, b: { x: -0.5, bz: 0.25, by: -0.3 }, events: [[0.3, 'snow'], [0.6, 'snow'], [0.9, 'snow']] }),
  climb: { dur: 3.6, events: [[0.92, 'hop']], fn: climbFn },
  skate: keyAnim({ dur: 3.0, reps: 3, plantFeet: true, props: ['skates'],
    a: { hpLZ: 0.6, hpLX: 0.3, knR: 0.7, hpRX: -0.4, x: -0.3, spX: 0.5, shLX: 0.6, shRX: -0.9, bz: 0.15 },
    b: { hpRZ: -0.6, hpRX: 0.3, knL: 0.7, hpLX: -0.4, x: 0.3, spX: 0.5, shRX: 0.6, shLX: -0.9, bz: -0.15 } }),
  spike: { dur: 1.9, props: ['vball'], releaseAt: 0.6, target: [0, 1.2, 9], events: [[0.28, 'jump'], [0.58, 'punch'], [0.86, 'land']], fn: spikeFn },
  basket: { dur: 2.0, props: ['bball'], releaseAt: 0.6, target: [0, 3.05, 4.4], events: [[0.28, 'jump'], [0.85, 'land']], fn: basketFn },
  penalty: { dur: 2.2, props: ['sball'], releaseAt: 0.62, target: [0.8, 1.4, 11], events: [[0.6, 'punch']], fn: penaltyFn },
  giantswing: { dur: 4.0, events: [[0.06, 'jump'], [0.95, 'land']], fn: (p, t) => giantSwingFn(p, t) },
  rings: { dur: 3.2, events: [[0.08, 'jump'], [0.92, 'hop']], fn: ringsFn },
  parallel: keyAnim({ dur: 3.0, reps: 3, base: { y: 0.3, shLX: 0, shRX: 0, shLZ: 0.08, shRZ: -0.08, elL: 0, elR: 0, hpLX: -0.2, hpRX: -0.2, knL: 1.0, knR: 1.0 },
    b: { y: 0.04, shLX: 0.7, shRX: 0.7, elL: -1.1, elR: -1.1, spX: 0.3 } }),
  trampoline: { dur: 3.4, events: [[0.08, 'jump'], [0.38, 'jump'], [0.68, 'jump'], [0.96, 'land']], fn: trampolineFn },
});
