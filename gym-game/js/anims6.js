'use strict';
/* Athletics (long jump, high jump, hurdles, javelin, shot put) and parkour (vault, wall flip, precision). */

Object.assign(EXTRA_PROPS, {
  javelin: flyProp(() => propMesh((b) => {
    b.cyl(0.015, 2.4, 0, 0, 0, '#d5dce6', Math.PI / 2, 0, 0, 6);
    b.cyl(0.022, 0.3, 0, 0, 0.05, '#e63946', Math.PI / 2, 0, 0, 6);
    b.add(UnitGeo.cone(6), 0, 0, 1.25, '#9aa0a8', Math.PI / 2, 0, 0, 0.02, 0.12, 0.02);
  }), { mode: 'right', arc: 3.5, spin: 0, offset: [0, 0.05, 0] }),
  shot: flyProp(() => propMesh((b) => b.sphere(0.07, 0, 0, 0, '#3c4250')), { mode: 'right', arc: 2.6, spin: 0.2 }),
});

function runUp(p, t, t0, t1, dist) {
  const u = seg(t, t0, t1);
  gait(p, u * 14, 1);
  p.z = dist * u * u * 0.9 + dist * 0.1 * u;
}

function longJumpFn(p, t) {
  const RUN = 4;
  const JUMP = 6;
  if (t < 0.42) { runUp(p, t, 0, 0.42, RUN); return; }
  if (t < 0.78) {
    const a = seg(t, 0.42, 0.78);
    p.z = RUN + JUMP * a;
    p.y = 4 * 0.9 * a * (1 - a);
    p.hpLX = p.hpRX = lerp(-0.5, -1.45, a);
    p.knL = p.knR = lerp(1.2, 0.2, a);
    p.shLX = p.shRX = lerp(-2.6, -1.0, a);
    p.spX = 0.3 * a;
    return;
  }
  p.z = RUN + JUMP;
  crouchPose(p, 0.9 * (1 - smooth(seg(t, 0.84, 1))));
  p.z = RUN + JUMP;
  p.shLX = p.shRX = -1.3;
}

function highJumpFn(p, t) {
  const RUN = 3.2;
  if (t < 0.4) { runUp(p, t, 0, 0.4, RUN); return; }
  if (t < 0.75) {
    const a = seg(t, 0.4, 0.75);
    p.z = RUN + 1.6 * a;
    p.y = 4 * 1.25 * a * (1 - a) + 0.35 * smooth(a);
    p.by = Math.PI * smooth(seg(a, 0, 0.3));
    p.bx = -1.2 * Math.sin(Math.PI * a);
    p.spX = -0.5 * Math.sin(Math.PI * a);
    p.hpLX = p.hpRX = 0.3 * Math.sin(Math.PI * a) - 0.8 * smooth(seg(a, 0.6, 1));
    p.knL = p.knR = 1.2 * Math.sin(Math.PI * a);
    p.shLX = p.shRX = -0.4;
    p.shLZ = 0.6; p.shRZ = -0.6;
    return;
  }
  const r = smooth(seg(t, 0.75, 1));
  p.z = RUN + 1.6;
  p.by = Math.PI;
  p.bx = lerp(-1.5, 0, r);
  p.y = lerp(0.67 - HIP_H, 0.5, r);
  p.hpLX = p.hpRX = lerp(-1.2, 0, r);
  p.knL = p.knR = lerp(0.8, 0, r);
}

function hurdlesFn(p, t) {
  const u = seg(t, 0.05, 0.95);
  const D = 16;
  gait(p, u * 34, 1);
  p.z = D * u;
  for (const h of [0.2, 0.45, 0.7]) {
    const a = (u - h) / 0.09;
    if (a > 0 && a < 1) {
      const k = Math.sin(Math.PI * a);
      p.y = 0.45 * k;
      p.hpLX = -1.55 * k; p.knL = 0.1;
      p.hpRX = 0.2 * k; p.hpRZ = -0.9 * k; p.knR = 1.7 * k;
      p.spX = 0.55 * k;
      p.shRX = -1.6 * k; p.shLX = 0.4 * k;
    }
  }
  if (t > 0.95) p.z = D;
}

function javelinFn(p, t) {
  if (t < 0.45) {
    runUp(p, t, 0, 0.45, 3);
    p.shRX = -2.2; p.shRY = 0.4; p.elR = -1.0;
    return;
  }
  p.z = 3;
  const back = smooth(seg(t, 0.45, 0.58));
  const fwd = smooth(seg(t, 0.58, 0.68));
  p.spY = 0.8 * back * (1 - fwd) - 0.5 * fwd;
  p.spX = -0.3 * back + 0.4 * fwd;
  p.shRX = lerp(-2.2, -1.2, back) - 1.6 * fwd;
  p.shRZ = -0.4 * back;
  p.elR = -0.2 - 0.8 * (1 - fwd);
  p.shLX = -1.4 * back;
  p.hpLX = -0.6 * back; p.knL = 0.3;
  p.hpRX = 0.4 * back;
  plant(p, false);
  p.z = 3;
}

function shotPutFn(p, t) {
  const crouch = smooth(seg(t, 0.05, 0.35));
  const push = smooth(seg(t, 0.45, 0.62));
  p.spY = 1.0 * crouch * (1 - push) - 0.6 * push;
  p.knL = p.knR = 0.9 * crouch * (1 - push);
  p.hpLX = p.hpRX = -0.6 * crouch * (1 - push);
  p.spX = 0.4 * crouch * (1 - push) - 0.1 * push;
  p.shRX = lerp(-1.0, -2.3, push);
  p.shRZ = -0.9 * (1 - push);
  p.elR = lerp(-2.5, -0.1, push);
  p.shLX = -1.5 * (1 - push);
  plant(p, false);
  p.y += 0.1 * push;
}

function vaultFn(p, t) {
  if (t < 0.35) { runUp(p, t, 0, 0.35, 1.8); return; }
  if (t < 0.75) {
    const a = seg(t, 0.35, 0.75);
    p.z = 1.8 + 2.2 * a;
    p.y = 0.75 * Math.sin(Math.PI * a) + 0.05;
    p.bz = 0.9 * Math.sin(Math.PI * a);
    p.hpLX = p.hpRX = -1.4 * Math.sin(Math.PI * a);
    p.knL = p.knR = 0.4 * Math.sin(Math.PI * a);
    p.shLX = -1.9; p.shLZ = 0.3; p.elL = 0;
    p.shRX = -0.6;
    return;
  }
  p.z = 4;
  crouchPose(p, 0.6 * (1 - smooth(seg(t, 0.78, 1))));
  p.z = 4;
}

function wallFlipFn(p, t) {
  if (t < 0.3) { runUp(p, t, 0, 0.3, 1.6); return; }
  if (t < 0.45) {
    const a = seg(t, 0.3, 0.45);
    p.z = 1.6 + 0.3 * a;
    p.y = 1.1 * a;
    gait(p, a * 6, 1);
    p.hpLX = -1.2; p.knL = 1.1;
    return;
  }
  const a = seg(t, 0.45, 0.85);
  if (t < 0.85) {
    p.z = 1.9 - 1.6 * a;
    p.y = 1.1 + 4 * 0.6 * a * (1 - a) - 1.1 * a;
    tuck(p, a);
    p.bx = -TAU * smooth(a);
    return;
  }
  p.z = 0.3;
  crouchPose(p, 0.7 * (1 - smooth(seg(t, 0.88, 1))));
  p.z = 0.3;
}

Object.assign(ANIMS, {
  longjump: { dur: 2.6, events: [[0.42, 'jump'], [0.78, 'sand']], fn: longJumpFn },
  highjump: { dur: 2.8, events: [[0.4, 'jump'], [0.75, 'land']], fn: highJumpFn },
  hurdles: { dur: 3.6, events: [[0.24, 'whoosh'], [0.48, 'whoosh'], [0.72, 'whoosh']], fn: hurdlesFn },
  javelin: { dur: 2.8, props: ['javelin'], releaseAt: 0.66, target: [0.4, 0.3, 38], events: [[0.66, 'whoosh']], fn: javelinFn },
  shotput: { dur: 2.4, props: ['shot'], releaseAt: 0.62, target: [0, 0.1, 13], events: [[0.62, 'whoosh']], fn: shotPutFn },
  vault: { dur: 2.0, events: [[0.35, 'jump'], [0.76, 'land']], fn: vaultFn },
  wallflip: { dur: 2.4, events: [[0.3, 'hop'], [0.45, 'jump'], [0.86, 'land']], fn: wallFlipFn },
});
