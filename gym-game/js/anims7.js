'use strict';
/*
 * Exercises of the three new champion gyms and the ninja course:
 * Steel Gym (log press, keg toss, truck pull, car deadlift, I-beam squat),
 * Titans' Temple (column lift, boulder throw, Atlas globe, discus),
 * Cosmic Olympus (moon jump, star throw, planet lift, comet throw, thunder slam),
 * ninja course (monkey bars, salmon ladder, warped wall, quintuple steps, balance beam).
 */

Object.assign(EXTRA_PROPS, {
  log: handsProp((b) => {
    b.cyl(0.17, 1.9, 0, 0, 0, '#8a5a32', 0, 0, Math.PI / 2, 12);
    for (const s of [-1, 1]) b.cyl(0.172, 0.02, s * 0.95, 0, 0, '#d9b27c', 0, 0, Math.PI / 2, 12);
    for (const s of [-1, 1]) b.cyl(0.035, 0.2, s * 0.28, -0.12, 0, '#2c3140');
  }, 0.12),
  ibeam: handsProp((b) => {
    b.box(2.6, 0.04, 0.2, 0, 0.09, 0, '#ff7b00');
    b.box(2.6, 0.04, 0.2, 0, -0.09, 0, '#ff7b00');
    b.box(2.6, 0.18, 0.04, 0, 0, 0, '#e85d00');
    for (const s of [-1, 1]) b.cyl(0.24, 0.1, s * 1.15, 0, 0, '#2c3140', 0, 0, Math.PI / 2, 14);
  }, 0.05),
  keg: flyProp(() => propMesh((b) => {
    b.cyl(0.2, 0.5, 0, 0, 0, '#aab3c0', Math.PI / 2, 0, 0, 14);
    for (const z of [-0.17, 0.17]) b.cyl(0.205, 0.04, 0, 0, z, '#5d6675', Math.PI / 2, 0, 0, 14);
  }), { mode: 'hands', arc: 2.2, spin: 0.25, offset: [0, -0.05, 0.05] }),
  truckRope(ch, pr) {
    const m = propMesh((b) => {
      b.cyl(0.03, 7.6, 0, 0, 3.8, '#c9a46c', Math.PI / 2, 0, 0, 6);
      b.box(0.5, 0.06, 0.12, 0, 0, 0.05, '#2c3140');
    });
    ch.root.add(m);
    pr.meshes.push(m);
    pr.tick = (c) => { handsMidLocal(c, m.position); m.rotation.x = 0.08; };
  },
  carFront(ch, pr) {
    const m = propMesh((b) => {
      b.box(1.9, 0.6, 2.4, 0, 0.55, 1.6, '#e63946');
      b.box(1.7, 0.5, 1.2, 0, 1.05, 1.9, '#c1121f');
      b.box(1.6, 0.42, 0.04, 0, 1.08, 1.29, '#9fd6ff');
      for (const s of [-1, 1]) for (const z of [0.9, 2.3]) b.cyl(0.3, 0.2, s * 0.95, 0.3, z, '#1d1d1d', 0, 0, Math.PI / 2, 14);
      for (const s of [-1, 1]) b.box(0.3, 0.12, 0.06, s * 0.6, 0.62, 0.38, '#fff4c2');
      b.box(1.4, 0.05, 0.05, 0, 0.45, 0.32, '#c9ced6');
    });
    m.position.set(0, 0, 0);
    ch.root.add(m);
    pr.meshes.push(m);
    const h = new THREE.Vector3();
    pr.tick = (c) => {
      handsMidLocal(c, h);
      m.rotation.x = -clamp((h.y - 0.55) * 0.35, 0, 0.18);
      m.position.y = clamp(h.y - 0.55, 0, 0.5) * 0.3;
    };
  },
  column: handsProp((b) => {
    b.cyl(0.26, 2.8, 0, 0, 0, '#f1ece2', 0, 0, Math.PI / 2, 14);
    for (let i = 0; i < 8; i++) b.box(2.7, 0.03, 0.03, 0, Math.cos(i * 0.785) * 0.26, Math.sin(i * 0.785) * 0.26, '#d8d0c0', 0, 0, 0);
    for (const s of [-1, 1]) b.box(0.18, 0.66, 0.66, s * 1.42, 0, 0, '#d4af37');
  }, 0.1),
  boulder: flyProp(() => propMesh((b) => {
    b.sphere(0.36, 0, 0, 0, '#7a6a5a');
    b.sphere(0.2, 0.2, 0.12, 0.08, '#6a5a4c');
  }), { mode: 'hands', arc: 3.4, spin: 0.15, offset: [0, 0.1, 0.12] }),
  globe(ch, pr) {
    const m = propMesh((b) => {
      b.sphere(0.55, 0, 0, 0, '#2f6fed');
      for (const [x, y, z, r] of [[0.3, 0.2, 0.36, 0.22], [-0.25, -0.1, 0.42, 0.2], [0.05, 0.35, -0.38, 0.24], [-0.4, 0.2, -0.2, 0.18]]) b.sphere(r, x, y, z, '#2ecc71');
      b.add(UnitGeo.torus(1, 0.02, 6, 32), 0, 0, 0, '#d4af37', Math.PI / 2, 0, 0.3, 0.6, 0.6, 0.6);
    });
    ch.root.add(m);
    pr.meshes.push(m);
    pr.tick = (c) => { handsMidLocal(c, m.position); m.position.y += 0.45; m.position.z -= 0.12; m.rotation.y += 0.01; };
  },
  discus: flyProp(() => propMesh((b) => {
    b.cyl(0.11, 0.04, 0, 0, 0, '#d4af37', 0, 0, 0, 16);
    b.cyl(0.05, 0.05, 0, 0, 0, '#fff1b0', 0, 0, 0, 10);
  }), { mode: 'right', arc: 3.2, spin: 0.05, offset: [0, -0.04, 0] }),
  starball: flyProp(() => propMesh((b) => {
    b.sphere(0.14, 0, 0, 0, '#fff3a0');
    for (let i = 0; i < 5; i++) b.add(UnitGeo.cone(4), Math.cos(i * 1.2566) * 0.18, Math.sin(i * 1.2566) * 0.18, 0, '#ffd34d', 0, 0, i * 1.2566 - Math.PI / 2, 0.07, 0.16, 0.07);
  }), { mode: 'right', arc: 5, spin: 0.3 }),
  planet(ch, pr) {
    const m = propMesh((b) => {
      b.sphere(0.7, 0, 0, 0, '#ff9f43');
      b.sphere(0.705, 0, 0.15, 0, '#ffbe76');
      b.add(UnitGeo.torus(1, 0.06, 6, 40), 0, 0, 0, '#c8a2ff', Math.PI / 2 - 0.35, 0, 0, 1.15, 1.15, 1.15);
    });
    ch.root.add(m);
    pr.meshes.push(m);
    pr.tick = (c) => { handsMidLocal(c, m.position); m.position.y += 0.62; m.rotation.y += 0.02; };
  },
  comet: flyProp(() => propMesh((b) => {
    b.sphere(0.16, 0, 0, 0, '#c9f1ff');
    b.add(UnitGeo.cone(8), 0, 0, -0.45, '#7fe0ff', -Math.PI / 2, 0, 0, 0.14, 0.7, 0.14);
  }), { mode: 'right', arc: 7, spin: 0, offset: [0, 0.05, 0] }),
});

function kegTossFn(p, t) {
  if (t < 0.35) {
    const c = smooth(seg(t, 0.05, 0.35));
    crouchPose(p, 0.9 * c);
    p.spX += 0.3 * c;
    p.shLX = p.shRX = lerp(0.05, -0.35, c);
    p.shLZ = 0.25; p.shRZ = -0.25;
    p.elL = p.elR = -0.1;
    p.hpLZ = 0.35 * c; p.hpRZ = -0.35 * c;
    return;
  }
  const u = smooth(seg(t, 0.35, 0.55));
  const back = smooth(seg(t, 0.75, 1));
  crouchPose(p, 0.9 * (1 - u) + 0.35 * Math.sin(Math.PI * seg(t, 0.6, 0.9)));
  p.y += 0.25 * Math.sin(Math.PI * seg(t, 0.4, 0.62));
  p.spX = lerp(0.3, -0.45, u) * (1 - back);
  p.nkX = -0.4 * u * (1 - back);
  p.shLX = p.shRX = lerp(-0.35, -3.2, u) * (1 - back) + 0.05 * back;
  p.elL = p.elR = -0.05;
  p.shLZ = 0.25; p.shRZ = -0.25;
  p.hpLZ = 0.15; p.hpRZ = -0.15;
}

function boulderThrowFn(p, t) {
  const lift = smooth(seg(t, 0.08, 0.38));
  const wind = smooth(seg(t, 0.38, 0.52));
  const thr = smooth(seg(t, 0.52, 0.62));
  const rec = smooth(seg(t, 0.8, 1));
  crouchPose(p, 0.8 * (1 - lift) * smooth(seg(t, 0, 0.08)));
  p.shLX = p.shRX = (lerp(-0.6, -2.9, lift) + 0.4 * wind - 1.5 * thr * (1 - rec)) * (1 - rec) + 0.05 * rec;
  p.elL = p.elR = lerp(-1.4, -1.6, wind) * (1 - thr) - 0.1;
  p.shLZ = 0.3; p.shRZ = -0.3;
  p.spX = (-0.35 * wind + 0.55 * thr) * (1 - rec);
  p.hpLX = -0.7 * thr * (1 - rec); p.knL = 0.4 * thr * (1 - rec);
  p.hpRX = 0.35 * thr * (1 - rec);
  plant(p, false);
}

function discusFn(p, t) {
  const spin = smooth(seg(t, 0.1, 0.6));
  const rec = smooth(seg(t, 0.75, 1));
  p.by = -TAU * 1.5 * spin;
  crouchPose(p, 0.35 * Math.sin(Math.PI * seg(t, 0.05, 0.6)));
  p.shRZ = -1.4 * (1 - rec);
  p.shRX = lerp(0.3, -1.4, smooth(seg(t, 0.5, 0.62))) * (1 - rec);
  p.elR = -0.1;
  p.shLZ = 0.9 * (1 - rec); p.shLX = -1.0 * (1 - rec);
  p.spY = 0.6 * Math.sin(TAU * spin * 1.5) * (1 - rec);
  p.y += 0.12 * Math.abs(Math.sin(TAU * 1.5 * spin));
}

function moonJumpFn(p, t) {
  if (t < 0.18) {
    crouchPose(p, smooth(t / 0.18));
    p.shLX = p.shRX = 0.7 * smooth(t / 0.18);
    return;
  }
  if (t < 0.85) {
    const a = seg(t, 0.18, 0.85);
    p.y = 4.2 * 4 * a * (1 - a);
    const s = Math.sin(Math.PI * a);
    p.shLZ = 0.12 + 2.4 * s; p.shRZ = -p.shLZ;
    p.hpLZ = 0.05 + 0.5 * s; p.hpRZ = -p.hpLZ;
    p.bx = -TAU * smooth(seg(a, 0.3, 0.7));
    if (a > 0.3 && a < 0.7) tuck(p, seg(a, 0.3, 0.7), 0.8);
    p.y = 4.2 * 4 * a * (1 - a);
    return;
  }
  crouchPose(p, 0.8 * (1 - smooth(seg(t, 0.86, 1))));
}

function thunderSlamFn(p, t) {
  if (t < 0.2) { crouchPose(p, smooth(t / 0.2)); return; }
  if (t < 0.58) {
    const a = seg(t, 0.2, 0.58);
    p.y = 2.6 * Math.sin(Math.PI * Math.min(1, a * 1.25)) * (a < 0.8 ? 1 : 1);
    p.shLX = p.shRX = -3.1 * Math.sin(Math.PI * Math.min(1, a * 1.6) / 2 + 0.01);
    p.shLZ = 0.3; p.shRZ = -0.3;
    p.hpLX = p.hpRX = -0.9 * a;
    p.knL = p.knR = 1.3 * a;
    if (a > 0.8) p.y = 2.6 * (1 - smooth(seg(a, 0.8, 1)));
    return;
  }
  const r = smooth(seg(t, 0.75, 1));
  crouchPose(p, 1 - r);
  p.hpLX = -1.4 * (1 - r); p.knL = 1.9 * (1 - r);
  p.hpRX = 0.6 * (1 - r); p.knR = 1.9 * (1 - r);
  p.y -= 0.1 * (1 - r);
  p.shLX = p.shRX = -0.9 * (1 - r);
  p.spX = 0.8 * (1 - r);
  p.elL = p.elR = -0.1;
}

/* ---------- ninja course ---------- */

function monkeyBarsFn(p, t) {
  const grab = smooth(seg(t, 0, 0.08));
  const drop = smooth(seg(t, 0.9, 1));
  const hang = grab * (1 - drop);
  const u = seg(t, 0.08, 0.9);
  const sw = Math.sin(u * 6 * Math.PI);
  p.y = hang * 0.62;
  p.z = 4.2 * u;
  p.shLX = lerp(0.05, -3.0 + 0.45 * Math.max(0, sw), hang);
  p.shRX = lerp(0.05, -3.0 + 0.45 * Math.max(0, -sw), hang);
  p.elL = p.elR = -0.1 * hang;
  p.shLZ = 0.2 * hang; p.shRZ = -0.2 * hang;
  p.bx = 0.12 * sw * hang;
  p.hpLX = (-0.4 + 0.3 * sw) * hang; p.hpRX = (-0.4 - 0.3 * sw) * hang;
  p.knL = p.knR = 0.7 * hang;
  p.autoAnkle = false;
  p.anL = p.anR = 0.5 * hang;
  if (t >= 0.9) p.z = 4.2;
}

function salmonFn(p, t) {
  const grab = smooth(seg(t, 0, 0.08));
  const drop = smooth(seg(t, 0.9, 1));
  const hang = grab * (1 - drop);
  const u = seg(t, 0.08, 0.9) * 3;
  const step = Math.floor(Math.min(u, 2.999));
  const f = u - step;
  const pull = Math.sin(Math.PI * Math.min(1, f * 1.4));
  p.y = hang * (0.45 + 0.55 * step + 0.55 * smooth(seg(f, 0.25, 0.6)));
  p.shLX = p.shRX = lerp(0.05, -3.0 + 0.8 * pull, hang);
  p.elL = p.elR = lerp(-0.18, -0.05 - 1.6 * pull, hang);
  p.shLZ = (0.25 + 0.2 * pull) * hang; p.shRZ = -p.shLZ;
  p.hpLX = p.hpRX = (-0.8 * pull - 0.2) * hang;
  p.knL = p.knR = (0.6 + 0.6 * pull) * hang;
  p.autoAnkle = false;
  p.anL = p.anR = 0.6 * hang;
  if (drop > 0) p.y *= 1 - drop;
}

function warpWallFn(p, t) {
  if (t < 0.32) { runUp(p, t, 0, 0.32, 3.2); return; }
  if (t < 0.5) {
    const a = seg(t, 0.32, 0.5);
    gait(p, a * 7, 1);
    p.z = 3.2 + 0.9 * a;
    p.y = 3.0 * smooth(a);
    p.spX = 0.3;
    p.shLX = -1.5 - 1.3 * a; p.shRX = -1.0 - 1.8 * a;
    return;
  }
  if (t < 0.72) {
    const a = smooth(seg(t, 0.5, 0.62));
    p.z = 4.1;
    p.y = 3.0 + 0.1 * a;
    p.shLX = p.shRX = -2.6;
    p.shLZ = 0.3; p.shRZ = -0.3;
    p.elL = p.elR = -0.6 * (1 - a) - 0.1;
    p.hpLX = p.hpRX = -0.6 + 0.4 * a; p.knL = p.knR = 1.2 * (1 - a);
    p.autoAnkle = false;
    return;
  }
  const d = smooth(seg(t, 0.72, 0.92));
  p.z = 4.1 - 0.3 * d;
  p.y = 3.0 * (1 - d);
  p.shLX = p.shRX = -2.6 * (1 - d);
  crouchPose(p, 0.7 * Math.sin(Math.PI * seg(t, 0.88, 1)));
  p.z = 4.1 - 0.3 * d;
}

function qStepsFn(p, t) {
  const u = seg(t, 0.05, 0.95);
  const n = 5;
  const k = Math.min(n - 1, Math.floor(u * n));
  const f = u * n - k;
  p.z = 1.2 * (k + smooth(f));
  p.x = (k % 2 ? -0.45 : 0.45) * (1 - smooth(f)) + (k % 2 ? 0.45 : -0.45) * smooth(f);
  p.y = 0.25 + 0.45 * Math.sin(Math.PI * f);
  p.bz = (k % 2 ? 1 : -1) * 0.2 * (1 - 2 * f);
  p.hpLX = -0.9 * Math.sin(Math.PI * f); p.knL = 1.2 * Math.sin(Math.PI * f);
  p.hpRX = -0.4 * Math.sin(Math.PI * f); p.knR = 0.8 * Math.sin(Math.PI * f);
  p.shLX = -1.0 * Math.sin(Math.PI * f); p.shRX = 0.4 * Math.sin(Math.PI * f);
  p.shLZ = 0.6; p.shRZ = -0.6;
  if (t < 0.05 || t > 0.95) p.y = 0.25 * smooth(seg(t, 0, 0.05)) * (1 - smooth(seg(t, 0.95, 1)));
}

function beamWalkFn(p, t) {
  const u = seg(t, 0.06, 0.94);
  gait(p, u * 16, 0);
  p.z = 5.4 * u;
  const up = smooth(seg(t, 0, 0.06)) * (1 - smooth(seg(t, 0.94, 1)));
  p.y += 0.42 * up;
  p.shLZ = 0.12 + 1.45 * up; p.shRZ = -p.shLZ;
  p.shLX = p.shRX = 0;
  p.elL = p.elR = -0.05;
  p.bz = 0.12 * Math.sin(t * 13) * up;
  p.spY = 0.06 * Math.sin(t * 9);
  if (t > 0.94) p.z = 5.4;
}

Object.assign(ANIMS, {
  logpress: Object.assign({}, ANIMS.lift, { props: ['log'] }),
  beamsquat: keyAnim({ dur: 3.2, reps: 3, plantFeet: true, props: ['ibeam'], inOut: 0.16,
    base: { shLX: -2.7, shRX: -2.7, elL: -2.3, elR: -2.3, shLZ: 0.75, shRZ: -0.75, hpLZ: 0.16, hpRZ: -0.16 },
    a: { hpLX: -1.35, hpRX: -1.35, knL: 1.95, knR: 1.95, spX: 0.4, nkX: -0.2 }, b: {} }),
  kegtoss: { dur: 2.6, props: ['keg'], releaseAt: 0.55, target: [0, 3.6, -3.2], events: [[0.55, 'whoosh'], [0.9, 'thud']], fn: kegTossFn },
  truckpull: keyAnim({ dur: 3.4, reps: 6, plantFeet: true, props: ['truckRope'], inOut: 0.1,
    base: { spX: -0.3, hpLX: -0.55, hpRX: -0.2, knL: 0.8, knR: 0.5, shLZ: 0.1, shRZ: -0.1, nkX: 0.2 },
    a: { shLX: -1.75, elL: -0.2, shRX: -0.7, elR: -1.6 }, b: { shLX: -0.7, elL: -1.6, shRX: -1.75, elR: -0.2 } }),
  carlift: keyAnim({ dur: 3.4, reps: 3, plantFeet: true, props: ['carFront'], inOut: 0.14,
    base: { hpLZ: 0.12, hpRZ: -0.12, elL: -0.02, elR: -0.02, shLZ: 0.2, shRZ: -0.2 },
    a: { spX: 0.6, hpLX: -1.1, hpRX: -1.1, knL: 1.0, knR: 1.0, shLX: -0.4, shRX: -0.4, nkX: -0.4 },
    b: { spX: -0.1, shLX: 0.05, shRX: 0.05, nkX: 0.1 } }),
  columnlift: Object.assign({}, ANIMS.lift, { props: ['column'], dur: 4.0 }),
  boulderthrow: { dur: 2.8, props: ['boulder'], releaseAt: 0.6, target: [0, 0.4, 14], events: [[0.6, 'whoosh']], fn: boulderThrowFn },
  globehold: keyAnim({ dur: 3.8, reps: 2, plantFeet: true, props: ['globe'], inOut: 0.18, wobble: 0.004,
    base: { shLX: -2.75, shRX: -2.75, elL: -1.3, elR: -1.3, shLZ: 0.7, shRZ: -0.7, hpLZ: 0.2, hpRZ: -0.2, nkX: 0.25 },
    a: { hpLX: -0.9, hpRX: -0.9, knL: 1.3, knR: 1.3, spX: 0.25 }, b: { nkX: -0.15 } }),
  discus: { dur: 2.8, props: ['discus'], releaseAt: 0.62, target: [-1.5, 0.2, 30], events: [[0.62, 'whoosh']], fn: discusFn },
  moonjump: { dur: 3.6, events: [[0.18, 'jump'], [0.85, 'land']], fn: moonJumpFn },
  starthrow: Object.assign({}, ANIMS.shotput, { props: ['starball'], target: [0, 9, 34] }),
  planetlift: Object.assign({}, ANIMS.lift, { props: ['planet'], dur: 4.2 }),
  cometthrow: Object.assign({}, ANIMS.javelin, { props: ['comet'], target: [0.4, 14, 55] }),
  thunderslam: { dur: 2.6, events: [[0.2, 'jump'], [0.58, 'smash']], fn: thunderSlamFn },
  monkeybars: { dur: 4.4, events: [[0.06, 'jump'], [0.95, 'hop']], fn: monkeyBarsFn },
  salmon: { dur: 4.4, events: [[0.06, 'jump'], [0.4, 'clap'], [0.65, 'clap'], [0.9, 'clap'], [0.97, 'land']], fn: salmonFn },
  warpwall: { dur: 3.6, events: [[0.32, 'hop'], [0.5, 'clap'], [0.92, 'land']], fn: warpWallFn },
  qsteps: { dur: 3.0, events: [[0.2, 'hop'], [0.38, 'hop'], [0.56, 'hop'], [0.74, 'hop'], [0.95, 'land']], fn: qStepsFn },
  beamwalk: { dur: 4.6, events: [[0.05, 'hop'], [0.96, 'hop']], fn: beamWalkFn },
});
