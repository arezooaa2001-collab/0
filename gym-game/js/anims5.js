'use strict';
/* High-level exercises of the gym's new wings: strongman, Olympic lifts, rope climb, human flag and friends. */

Object.assign(EXTRA_PROPS, {
  sled(ch, pr) {
    const m = propMesh((b) => {
      b.box(0.9, 0.08, 1.1, 0, 0.06, 0, '#2c3140');
      for (const s of [-1, 1]) b.box(0.08, 0.06, 1.3, s * 0.42, 0.03, 0.05, '#c9ced6');
      b.cyl(0.04, 0.5, 0, 0.35, 0, '#c9ced6');
      for (let k = 0; k < 3; k++) b.cyl(0.24, 0.06, 0, 0.2 + k * 0.07, 0, ['#e63946', '#2f6fed', '#ffd34d'][k], 0, 0, 0, 18);
      for (const s of [-1, 1]) b.box(0.05, 1.0, 0.05, s * 0.3, 0.55, -0.45, '#c9ced6', 0, 0.45);
      b.box(0.7, 0.05, 0.05, 0, 1.0, -0.65, '#ffd34d');
    });
    m.position.set(0, 0, 1.05);
    ch.root.add(m);
    pr.meshes.push(m);
  },
  atlasStone(ch, pr) {
    const m = propMesh((b) => b.sphere(0.3, 0, 0, 0, '#8d99ae'));
    ch.root.add(m);
    pr.meshes.push(m);
    pr.tick = (c) => {
      const A = c.action && c.action.def;
      const t = A ? c.actionT / A.dur : 0;
      if (t < 0.18) m.position.set(0, 0.3, 0.42);
      else if (t < 0.62) { handsMidLocal(c, m.position); m.position.y -= 0.05; m.position.z += 0.08; }
      else m.position.set(0, 1.47, 0.78);
    };
  },
});

function sledFn(p, t) {
  const k = smooth(seg(t, 0, 0.1)) * (1 - smooth(seg(t, 0.9, 1)));
  const q = makePose();
  gait(q, t * 18, 0.7);
  q.spX += 0.5;
  q.bx = 0.25;
  q.shLX = q.shRX = -1.25;
  q.elL = q.elR = -0.5;
  q.shLZ = 0.15; q.shRZ = -0.15;
  q.nkX = -0.45;
  mixInto(p, q, k);
}

function atlasFn(p, t) {
  if (t < 0.18) {
    const c = smooth(t / 0.18);
    p.hpLX = p.hpRX = -1.4 * c;
    p.knL = p.knR = 1.7 * c;
    p.spX = 0.8 * c;
    p.shLX = p.shRX = -0.6 * c;
    p.shLZ = 0.55 * c; p.shRZ = -0.55 * c;
    p.elL = p.elR = -0.9 * c;
    p.hpLZ = 0.3 * c; p.hpRZ = -0.3 * c;
    plant(p);
  } else if (t < 0.42) {
    const u = smooth(seg(t, 0.18, 0.42));
    p.hpLX = p.hpRX = lerp(-1.4, -0.3, u);
    p.knL = p.knR = lerp(1.7, 0.4, u);
    p.spX = lerp(0.8, -0.15, u);
    p.shLX = p.shRX = lerp(-0.6, -1.3, u);
    p.shLZ = 0.45; p.shRZ = -0.45;
    p.elL = p.elR = lerp(-0.9, -1.7, u);
    p.hpLZ = 0.3; p.hpRZ = -0.3;
    plant(p);
  } else if (t < 0.62) {
    const u = smooth(seg(t, 0.42, 0.62));
    p.spX = -0.15 + 0.3 * u;
    p.shLX = p.shRX = lerp(-1.3, -1.9, u);
    p.elL = p.elR = lerp(-1.7, -0.7, u);
    p.shLZ = 0.45; p.shRZ = -0.45;
    p.knL = p.knR = 0.3 * Math.sin(Math.PI * u);
    p.hpLZ = 0.3; p.hpRZ = -0.3;
    plant(p, false);
    p.y += 0.12 * Math.sin(Math.PI * u);
  } else {
    const u = smooth(seg(t, 0.62, 0.9));
    p.shLX = p.shRX = lerp(-1.9, -2.8, u) * (1 - smooth(seg(t, 0.92, 1)));
    p.shLZ = 0.4 + 0.2 * u; p.shRZ = -p.shLZ;
    p.elL = p.elR = -0.3;
    p.nkX = -0.3 * u;
  }
}

function ropeClimbFn(p, t) {
  const up = seg(t, 0.08, 0.72);
  const down = smooth(seg(t, 0.74, 0.96));
  const k = smooth(seg(t, 0, 0.08)) * (1 - smooth(seg(t, 0.96, 1)));
  const ph = up * 8 * Math.PI;
  p.y = (4.2 * up * (1 - down)) * k;
  const s = Math.sin(ph);
  p.shLX = lerp(0.05, -2.9 + 0.35 * s, k);
  p.shRX = lerp(0.05, -2.9 - 0.35 * s, k);
  p.shLZ = 0.08; p.shRZ = -0.08;
  p.elL = (-0.3 - 0.6 * Math.max(0, s)) * k;
  p.elR = (-0.3 - 0.6 * Math.max(0, -s)) * k;
  p.hpLX = p.hpRX = (-0.7 + 0.4 * Math.abs(s)) * k;
  p.knL = (1.2 - 0.6 * Math.abs(s)) * k;
  p.knR = 0.4 * k;
  p.hpLZ = -0.08 * k; p.hpRZ = 0.05 * k;
  p.autoAnkle = false;
  p.anL = p.anR = 0.5 * k;
  p.nkX = -0.35 * k;
}

/** Snatch: floor to overhead in one move, catching in a deep squat. */
function snatchFn(p, t) {
  if (t < 0.16) {
    const c = smooth(t / 0.16);
    p.hpLX = p.hpRX = -1.25 * c; p.knL = p.knR = 1.45 * c; p.spX = 0.75 * c;
    p.shLX = p.shRX = -0.75 * c; p.shLZ = 0.55 * c; p.shRZ = -0.55 * c; p.elL = p.elR = -0.05;
    plant(p);
  } else if (t < 0.3) {
    const u = smooth(seg(t, 0.16, 0.3));
    p.hpLX = p.hpRX = lerp(-1.25, 0.1, u); p.knL = p.knR = lerp(1.45, 0.1, u); p.spX = lerp(0.75, -0.2, u);
    p.shLX = p.shRX = lerp(-0.75, -1.4, u); p.shLZ = 0.55; p.shRZ = -0.55; p.elL = p.elR = -0.05 - 0.9 * u;
    plant(p);
    p.y += 0.06 * u;
  } else if (t < 0.5) {
    const u = smooth(seg(t, 0.3, 0.5));
    p.hpLX = p.hpRX = lerp(0.1, -1.6, u); p.knL = p.knR = lerp(0.1, 2.2, u); p.spX = lerp(-0.2, 0.25, u);
    p.shLX = p.shRX = lerp(-1.4, -3.05, u); p.shLZ = p.shRZ = 0; p.shLZ = 0.6; p.shRZ = -0.6; p.elL = p.elR = lerp(-0.95, -0.02, u);
    p.hpLZ = 0.3; p.hpRZ = -0.3;
    plant(p);
  } else if (t < 0.78) {
    const u = smooth(seg(t, 0.5, 0.78));
    p.hpLX = p.hpRX = lerp(-1.6, 0, u); p.knL = p.knR = lerp(2.2, 0.05, u); p.spX = lerp(0.25, 0, u);
    p.shLX = p.shRX = -3.05 + 0.03 * Math.sin(t * 80); p.shLZ = 0.6; p.shRZ = -0.6; p.elL = p.elR = -0.02;
    p.hpLZ = 0.3 * (1 - u) + 0.1; p.hpRZ = -p.hpLZ;
    plant(p);
  } else {
    const u = smooth(seg(t, 0.8, 0.95));
    p.shLX = p.shRX = lerp(-3.05, 0.05, u); p.shLZ = lerp(0.6, 0.12, u); p.shRZ = -p.shLZ; p.elL = p.elR = -0.05;
  }
}

/** Clean and jerk: to the shoulders, then split-jerk overhead. */
function cleanJerkFn(p, t) {
  if (t < 0.14) {
    const c = smooth(t / 0.14);
    p.hpLX = p.hpRX = -1.25 * c; p.knL = p.knR = 1.45 * c; p.spX = 0.75 * c;
    p.shLX = p.shRX = -0.75 * c; p.shLZ = 0.3 * c; p.shRZ = -0.3 * c; p.elL = p.elR = -0.05;
    plant(p);
  } else if (t < 0.36) {
    const u = smooth(seg(t, 0.14, 0.36));
    const sq = Math.sin(Math.PI * u);
    p.hpLX = p.hpRX = lerp(-1.25, 0, u) - 0.8 * sq; p.knL = p.knR = lerp(1.45, 0.1, u) + 1.0 * sq; p.spX = lerp(0.75, 0, u);
    p.shLX = p.shRX = lerp(-0.75, -1.25, u); p.shLZ = 0.3; p.shRZ = -0.3; p.elL = p.elR = lerp(-0.05, -2.6, u);
    plant(p);
  } else if (t < 0.52) {
    p.shLX = p.shRX = -1.25; p.shLZ = 0.3; p.shRZ = -0.3; p.elL = p.elR = -2.6;
    const dip = Math.sin(Math.PI * seg(t, 0.4, 0.52));
    p.knL = p.knR = 0.4 * dip; p.hpLX = p.hpRX = -0.3 * dip;
    plant(p);
  } else if (t < 0.8) {
    const u = smooth(seg(t, 0.52, 0.6));
    const back = smooth(seg(t, 0.68, 0.78));
    p.shLX = p.shRX = lerp(-1.25, -3.05, u); p.shLZ = 0.4; p.shRZ = -0.4; p.elL = p.elR = lerp(-2.6, -0.02, u);
    const split = u * (1 - back);
    p.hpLX = -0.75 * split; p.knL = 0.8 * split;
    p.hpRX = 0.55 * split; p.knR = 0.35 * split;
    plant(p, false);
  } else {
    const u = smooth(seg(t, 0.82, 0.96));
    p.shLX = p.shRX = lerp(-3.05, 0.05, u); p.shLZ = lerp(0.4, 0.12, u); p.shRZ = -p.shLZ; p.elL = p.elR = -0.05;
  }
}

const HIGH_ANIMS = {
  sledpush: { dur: 3.4, props: ['sled'], move: (t) => (t > 0.1 && t < 0.9 ? 1.0 : 0), fn: sledFn },
  atlas: { dur: 3.2, props: ['atlasStone'], events: [[0.62, 'thud']], fn: atlasFn },
  ropeclimb: { dur: 5.0, events: [[0.06, 'jump'], [0.97, 'hop']], fn: ropeClimbFn },
  snatch: { dur: 3.4, props: ['barbell'], barbellDrop: 0.82, events: [[0.82, 'drop']], fn: snatchFn },
  cleanjerk: { dur: 3.8, props: ['barbell'], barbellDrop: 0.84, events: [[0.84, 'drop']], fn: cleanJerkFn },
  humanflag: keyAnim({ dur: 3.6, reps: 1, inOut: 0.22, wobble: 0.003,
    b: { bz: -1.45, y: 0.55, x: 0.25, shLX: 0, shLZ: 3.0, shRX: 0, shRZ: 1.4, elL: 0, elR: -0.2, hpLZ: 0.1, hpRZ: -0.1, knL: 0, knR: 0, nkY: 0.4, autoAnkle: false, anL: 0.6, anR: 0.6 } }),
  planche: keyAnim({ dur: 3.4, reps: 1, inOut: 0.25, wobble: 0.003,
    b: { bx: 1.5, y: 0.66 - HIP_H, z: 0.05, shLX: -1.2, shRX: -1.2, shLZ: 0.25, shRZ: -0.25, elL: 0, elR: 0, hpLX: 0.05, hpRX: 0.05, knL: 0, knR: 0, nkX: -0.5, autoAnkle: false, anL: 0.9, anR: 0.9 } }),
  onearm: keyAnim({ dur: 3.0, reps: 2, base: Object.assign({}, BASES.plank, { shRX: 0.3, shRZ: -0.3, elR: -2.2, shLZ: 0.05, hpLZ: 0.32, hpRZ: -0.32, bz: 0.12 }),
    b: { y: 0.27 - HIP_H, bx: 1.36, shLX: -0.4, elL: -1.2, bz: 0.18 } }),
  tripleflip: {
    dur: 1.9,
    events: [[0.14, 'jump'], [0.86, 'land']],
    move: (t) => (t > 0.14 && t < 0.86 ? -0.8 : 0),
    fn(p, t) { flipAnim(p, t, 0.14, 0.86, 2.4, (q, a) => { tuck(q, a, 1.1); q.bx = -3 * TAU * smooth(a); }); },
  },
  bigpunch: { dur: 1.5, props: ['gloves'], events: [[0.55, 'smash']], fn: sequenceAnim(1.5, [
    { hpLX: -0.3, hpRX: 0.25, knL: 0.35, knR: 0.35, shLX: -0.6, shLY: -0.35, elL: -2.3, shRX: -0.3, shRY: 0.6, elR: -2.4, spY: 0.6 },
    { hpLX: -0.45, hpRX: 0.35, knL: 0.4, knR: 0.25, shLX: -0.6, shLY: -0.35, elL: -2.3, shRX: -1.6, elR: -0.05, spY: -0.6, spX: 0.2 },
    { hpLX: -0.3, hpRX: 0.25, knL: 0.35, knR: 0.35, shLX: -0.6, shLY: -0.35, elL: -2.3, shRX: -1.5, elR: -0.1, spY: -0.5 },
  ]).fn },
};
Object.assign(ANIMS, HIGH_ANIMS);
