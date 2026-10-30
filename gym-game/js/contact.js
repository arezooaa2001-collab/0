'use strict';
/*
 * Real contact for climbing and hanging. A hidden copy of the skeleton (forward kinematics)
 * tells where hands and toes end up for a pose, and a small IK solver bends arms and legs so
 * they land exactly on the wall, rope or bar. Stations describe what is there:
 *   wall: distance from the station to the climbing surface, wallH: how high the holds go
 *   rope: distance to a hanging rope, ropeH: how high you can climb
 *   bar:  { y, f } height and forward distance of a bar you hang from
 */

const Contact = (() => {
const FK = (() => {
  const bones = {};
  const list = [];
  const root = new THREE.Object3D();
  for (const [name, parent, x, y, z] of BONE_DEFS) {
    const b = new THREE.Object3D();
    b.position.set(x, y, z);
    bones[name] = b;
    list.push(b);
    (parent >= 0 ? list[parent] : root).add(b);
  }
  bones.body.rotation.order = 'YXZ';
  const v = new THREE.Vector3();
  return {
    bones,
    set(c) {
      bones.body.position.set(c.x, HIP_H + c.y, c.z);
      bones.body.rotation.set(c.bx, c.by, c.bz);
      bones.spine.rotation.set(c.spX, c.spY, c.spZ);
      bones.head.rotation.set(c.nkX, c.nkY, 0);
      bones.shL.rotation.set(c.shLX, c.shLY, c.shLZ);
      bones.shR.rotation.set(c.shRX, c.shRY, c.shRZ);
      bones.elL.rotation.x = c.elL;
      bones.elR.rotation.x = c.elR;
      bones.hpL.rotation.set(c.hpLX, 0, c.hpLZ);
      bones.hpR.rotation.set(c.hpRX, 0, c.hpRZ);
      bones.knL.rotation.x = c.knL;
      bones.knR.rotation.x = c.knR;
      bones.anL.rotation.x = c.autoAnkle ? -(c.hpLX + c.knL) : c.anL;
      bones.anR.rotation.x = c.autoAnkle ? -(c.hpRX + c.knR) : c.anR;
      root.updateMatrixWorld(true);
    },
    /** Point given in a bone's frame, in the character's own frame (feet on y = 0, facing +z). */
    at(name, x, y, z, out) { return bones[name].localToWorld((out || v).set(x, y, z)); },
  };
})();

const HAND_TIP = [0, -0.06, 0];
const TOE_TIP = [0, -0.06, 0.15];
const LIMB = {
  armL: { keys: ['shLX', 'shLZ', 'elL'], bone: 'haL', tip: HAND_TIP, lo: [-3.25, -0.95, -2.6], hi: [0.6, 1.5, -0.02] },
  armR: { keys: ['shRX', 'shRZ', 'elR'], bone: 'haR', tip: HAND_TIP, lo: [-3.25, -1.5, -2.6], hi: [0.6, 0.95, -0.02] },
  legL: { keys: ['hpLX', 'hpLZ', 'knL'], bone: 'anL', tip: TOE_TIP, lo: [-2.2, -0.25, 0.02], hi: [0.6, 0.9, 2.6] },
  legR: { keys: ['hpRX', 'hpRZ', 'knR'], bone: 'anR', tip: TOE_TIP, lo: [-2.2, -0.9, 0.02], hi: [0.6, 0.25, 2.6] },
};
const _e = new THREE.Vector3();
const _p0 = new THREE.Vector3();
const _pq = new THREE.Vector3();

function limbTip(p, L, out) {
  FK.set(p);
  return FK.at(L.bone, L.tip[0], L.tip[1], L.tip[2], out);
}

/** Bend one arm or leg so its tip reaches target (character frame). Damped least squares. */
function solveLimb(p, which, target, iters = 16) {
  const L = LIMB[which];
  const k = L.keys;
  for (let it = 0; it < iters; it++) {
    limbTip(p, L, _p0);
    _e.subVectors(target, _p0);
    if (_e.lengthSq() < 1e-6) break;
    const J = [];
    for (let i = 0; i < 3; i++) {
      const old = p[k[i]];
      p[k[i]] = old + 0.002;
      const q = limbTip(p, L, _pq);
      p[k[i]] = old;
      J.push([(q.x - _p0.x) / 0.002, (q.y - _p0.y) / 0.002, (q.z - _p0.z) / 0.002]);
    }
    // (JᵀJ + λ²I) d = Jᵀe
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const b = [0, 0, 0];
    const e = [_e.x, _e.y, _e.z];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) A[i][j] = J[i][0] * J[j][0] + J[i][1] * J[j][1] + J[i][2] * J[j][2] + (i === j ? 0.0025 : 0);
      b[i] = J[i][0] * e[0] + J[i][1] * e[1] + J[i][2] * e[2];
    }
    const d = solve3(A, b);
    for (let i = 0; i < 3; i++) p[k[i]] = clamp(p[k[i]] + clamp(d[i], -0.6, 0.6), L.lo[i], L.hi[i]);
  }
  limbTip(p, L, _p0);
  return _p0.distanceTo(target);
}

/** Solve, and if the warm start got stuck, start that limb again from a neutral bend. */
function reachLimb(p, which, target, seed) {
  const tgt = _rt.copy(target);
  if (solveLimb(p, which, tgt) < 0.03) return;
  for (const key of LIMB[which].keys) p[key] = seed[key];
  solveLimb(p, which, tgt, 24);
}
const _rt = new THREE.Vector3();

function solve3(A, b) {
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A);
  if (Math.abs(D) < 1e-12) return [0, 0, 0];
  const out = [];
  for (let c = 0; c < 3; c++) {
    const M = A.map((row, r) => row.map((v, j) => (j === c ? b[r] : v)));
    out.push(det(M) / D);
  }
  return out;
}

/** Steps up a wall in a 4-beat rhythm: right hand, left foot, left hand, right foot. */
function climbHolds(c, K, s) {
  const x = c * K * 4;
  const prog = (i) => {
    const cyc = Math.floor(x / 4);
    if (cyc >= K) return { v: K, lift: 0 };
    const r = x - cyc * 4;
    if (r >= i + 1) return { v: cyc + 1, lift: 0 };
    if (r > i) { const f = r - i; return { v: cyc + smooth(f), lift: Math.sin(Math.PI * f) }; }
    return { v: cyc, lift: 0 };
  };
  const rh = prog(0); const lf = prog(1); const lh = prog(2); const rf = prog(3);
  return {
    hL: 1.92 + s * lh.v, hR: 1.8 + s * rh.v, fL: 0.52 + s * lf.v, fR: 0.38 + s * rf.v,
    lift: { armL: lh.lift, armR: rh.lift, legL: lf.lift, legR: rf.lift },
  };
}

const _t = new THREE.Vector3();
const _poseCache = new WeakMap();
/** One scratch pose per character, so climbers don't share state. */
function makePoseCached(ch) {
  if (!ch) return makePose();
  let q = _poseCache.get(ch);
  if (!q) { q = makePose(); _poseCache.set(ch, q); }
  return q;
}

/** Full climbing pose with hands and toes on the wall plane z = D. */
function wallPose(p, c, D, K, s, seedFrom) {
  const h = climbHolds(c, K, s);
  // hips high enough for the top hand, low enough for the bottom foot
  const lo = Math.max(h.hL, h.hR) - 1.06;
  const hi = Math.min(h.fL, h.fR) + 0.78;
  const hipY = lo <= hi ? clamp((h.fL + h.fR) / 2 + 0.62, lo, hi) : (lo + hi) / 2;
  if (seedFrom) copyPose(p, seedFrom);
  p.y = hipY - HIP_H;
  p.z = D - 0.33;
  p.x = 0;
  p.bx = 0.1; p.by = 0; p.bz = 0;
  p.spX = 0.04; p.spY = 0; p.spZ = 0;
  p.nkX = -0.35 - 0.1 * (h.lift.armL + h.lift.armR);
  p.shLY = p.shRY = 0;
  p.autoAnkle = false;
  p.anL = -(p.hpLX + p.knL) - p.bx - 0.15;
  p.anR = -(p.hpRX + p.knR) - p.bx - 0.15;
  const off = (k) => 0.12 * h.lift[k];
  reachLimb(p, 'armL', _t.set(0.27, h.hL, D - 0.045 - off('armL')), _climbSeed);
  reachLimb(p, 'armR', _t.set(-0.27, h.hR, D - 0.045 - off('armR')), _climbSeed);
  for (const [leg, x, y] of [['legL', 0.19, h.fL], ['legR', -0.19, h.fR]]) {
    reachLimb(p, leg, _t.set(x, y, D - 0.01 - off(leg)), _climbSeed);
    const a = leg === 'legL' ? 'anL' : 'anR';
    p[a] = -(p[leg === 'legL' ? 'hpLX' : 'hpRX'] + p[leg === 'legL' ? 'knL' : 'knR']) - p.bx - 0.15;
    solveLimb(p, leg, _t.set(x, y, D - 0.01 - off(leg)), 4);
  }
  return p;
}

const _climbSeed = makePose();
Object.assign(_climbSeed, { shLX: -2.5, shRX: -2.5, shLZ: 0.3, shRZ: -0.3, elL: -1.0, elR: -1.0, hpLX: -0.9, hpRX: -0.9, hpLZ: 0.15, hpRZ: -0.15, knL: 1.3, knR: 1.3 });

/** Climbing wall: walk up, grab, climb to the top holds, climb back down, step off. */
function wallClimbFn(p, t, ch) {
  const st = ch && ch.station;
  const D = st && st.wall != null ? st.wall : 0.7;
  const H = st && st.wallH ? st.wallH : 3.2;
  const R = Math.max(0.35, H - 0.15 - 1.92);
  const K = Math.max(1, Math.round(R / 0.35));
  const s = R / K;
  let c;
  if (t < 0.12) c = 0;
  else if (t < 0.52) c = seg(t, 0.12, 0.52);
  else if (t < 0.58) c = 1;
  else if (t < 0.88) c = 1 - seg(t, 0.58, 0.88);
  else c = 0;
  // warm-start the solver from this climber's last frame
  const mem = ch || {};
  if (!mem._ikWall || t < 0.02) mem._ikWall = copyPose(makePose(), _climbSeed);
  const q = wallPose(makePoseCached(ch), c, D, K, s, mem._ikWall);
  copyPose(mem._ikWall, q);
  if (t < 0.12) {
    const k = smooth(t / 0.12);
    gait(p, t * 30, 0);
    p.z = (D - 0.33) * k;
    mixInto(p, q, smooth(seg(t, 0.04, 0.12)));
    if (t < 0.04) p.z = (D - 0.33) * k;
    return;
  }
  if (t > 0.88) {
    const k = 1 - smooth(seg(t, 0.88, 1));
    copyPose(p, STAND);
    mixInto(p, q, k);
    return;
  }
  copyPose(p, q);
}

/* ---------- rope climbing ---------- */

const _ropeSeed = makePose();
Object.assign(_ropeSeed, { shLX: -2.8, shRX: -2.8, shLZ: -0.1, shRZ: 0.1, elL: -0.7, elR: -0.7, hpLX: -0.6, hpRX: -0.4, knL: 1.2, knR: 0.6 });

function ropePose(p, c, F, K, s, seed) {
  // hands alternate up the rope; legs clamp it lower down
  const x = c * K * 2;
  const cyc = Math.min(K, Math.floor(x / 2));
  const r = cyc >= K ? 0 : x - cyc * 2;
  const up = (i) => (cyc >= K ? K : cyc + (r >= i + 1 ? 1 : r > i ? smooth(r - i) : 0));
  const hR = 1.95 + s * up(0);
  const hL = 2.3 + s * up(1);
  const hipY = Math.min(hR, hL) - 1.08 + 0.18 * Math.sin(Math.PI * (r % 1));
  copyPose(p, seed || _ropeSeed);
  p.x = 0;
  p.y = hipY - HIP_H;
  p.z = F - 0.2;
  p.bx = 0.05; p.by = 0; p.bz = 0;
  p.spX = 0; p.nkX = -0.3;
  p.autoAnkle = false;
  p.anL = 0.5; p.anR = 0.3;
  reachLimb(p, 'armL', _t.set(0.05, hL, F - 0.02), _ropeSeed);
  reachLimb(p, 'armR', _t.set(-0.05, hR, F - 0.02), _ropeSeed);
  reachLimb(p, 'legL', _t.set(0.06, hipY - 0.62, F - 0.06), _ropeSeed);
  reachLimb(p, 'legR', _t.set(-0.06, hipY - 0.78, F + 0.02), _ropeSeed);
  return p;
}

function ropeClimbContactFn(p, t, ch) {
  const st = ch && ch.station;
  const F = st && st.rope != null ? st.rope : 0.25;
  const H = st && st.ropeH ? st.ropeH : 6;
  const R = Math.max(0.5, H - 0.4 - 2.3);
  const K = Math.max(1, Math.round(R / 0.5));
  const s = R / K;
  let c;
  if (t < 0.1) c = 0;
  else if (t < 0.62) c = seg(t, 0.1, 0.62);
  else if (t < 0.68) c = 1;
  else if (t < 0.9) c = 1 - seg(t, 0.68, 0.9);
  else c = 0;
  const mem = ch || {};
  if (!mem._ikRope || t < 0.02) mem._ikRope = copyPose(makePose(), _ropeSeed);
  const q = ropePose(makePoseCached(ch), c, F, K, s, mem._ikRope);
  copyPose(mem._ikRope, q);
  if (t < 0.1) {
    copyPose(p, STAND);
    p.z = (F - 0.2) * smooth(t / 0.1);
    mixInto(p, q, smooth(seg(t, 0.03, 0.1)));
    return;
  }
  if (t > 0.9) {
    copyPose(p, STAND);
    mixInto(p, q, 1 - smooth(seg(t, 0.9, 1)));
    return;
  }
  copyPose(p, q);
}

/* ---------- hanging from a bar: move the body so the hands are on it ---------- */

const _hl = new THREE.Vector3();
const _hr = new THREE.Vector3();

/** Shift the body so the gripping hands sit on the bar. w: 0 standing .. 1 hanging. */
function gripBar(p, ch, w, mode = 'mid', yOverride) {
  if (w <= 0) return;
  const st = ch && ch.station;
  const bar = (st && st.bar) || { y: 2.5, f: 0 };
  const by = yOverride != null ? yOverride : bar.y;
  FK.set(p);
  FK.at('haL', 0, -0.05, 0, _hl);
  FK.at('haR', 0, -0.05, 0, _hr);
  let hy;
  let hz;
  if (mode === 'high') {
    const top = _hl.y > _hr.y ? _hl : _hr;
    hy = top.y; hz = top.z;
  } else { hy = (_hl.y + _hr.y) / 2; hz = (_hl.z + _hr.z) / 2; }
  p.y += (by - hy) * w;
  if (mode !== 'yOnly') p.z += ((bar.f || 0) - hz) * w;
}

function wrapGrip(def, weight, mode, yFn) {
  const fn = def.fn;
  return Object.assign({}, def, {
    snapAll: true,
    fn(p, t, ch) {
      fn(p, t, ch);
      gripBar(p, ch, weight(t), mode, yFn ? yFn(t, ch) : undefined);
    },
  });
}

const hangW = (a, b, c, d) => (t) => smooth(seg(t, a, b)) * (1 - smooth(seg(t, c, d)));

ANIMS.climb = { snapAll: true, dur: 7.0, events: [[0.1, 'hop'], [0.95, 'hop']], fn: wallClimbFn };
ANIMS.boulder = ANIMS.climb;
ANIMS.ropeclimb = { snapAll: true, dur: 6.4, events: [[0.08, 'jump'], [0.97, 'hop']], fn: ropeClimbContactFn };
/** Pull-up with the hands fixed on the bar and the body just behind it, so the chin clears the bar. */
const _pullSeed = makePose();
Object.assign(_pullSeed, { shLX: -2.9, shRX: -2.9, shLZ: 0.3, shRZ: -0.3, elL: -0.3, elR: -0.3 });
const _pullBase = ANIMS.pullup.fn;
function pullupContactFn(p, t, ch) {
  _pullBase(p, t, ch);
  const grab = smooth(seg(t, 0, 0.12));
  const drop = smooth(seg(t, 0.88, 1));
  const hang = grab * (1 - drop);
  if (hang <= 0) return;
  const st = ch && ch.station;
  const bar = (st && st.bar) || { y: 2.5, f: 0 };
  const reps = (1 - Math.cos(seg(t, 0.16, 0.84) * 3 * TAU)) / 2;
  const q = makePoseCached(ch);
  copyPose(q, p);
  q.y = (bar.y - 2.5 + 0.42 + 0.46 * reps);
  q.z = (bar.f || 0) - 0.17;
  q.bx = 0.06;
  for (const [arm, x] of [['armL', 0.27], ['armR', -0.27]]) {
    q[arm === 'armL' ? 'shLX' : 'shRX'] = _pullSeed.shLX;
    q[arm === 'armL' ? 'elL' : 'elR'] = _pullSeed.elL;
    q[arm === 'armL' ? 'shLZ' : 'shRZ'] = arm === 'armL' ? 0.3 : -0.3;
    reachLimb(q, arm, _t.set(x, bar.y, bar.f || 0), _pullSeed);
  }
  mixInto(p, q, hang);
  if (hang > 0.5) copyPose(p, q);
}
ANIMS.pullup = Object.assign({}, ANIMS.pullup, { snapAll: true, fn: pullupContactFn });
ANIMS.muscleup = wrapGrip(ANIMS.muscleup, hangW(0, 0.1, 0.45, 0.55), 'mid');
ANIMS.monkeybars = wrapGrip(ANIMS.monkeybars, hangW(0, 0.08, 0.9, 1), 'yOnly');
ANIMS.salmon = wrapGrip(ANIMS.salmon, hangW(0, 0.08, 0.9, 1), 'mid', (t, ch) => {
  const base = (ch && ch.station && ch.station.bar && ch.station.bar.y) || 2.5;
  const u = seg(t, 0.08, 0.9) * 3;
  const step = Math.floor(Math.min(u, 2.999));
  const f = u - step;
  return base + 0.55 * (step + smooth(seg(f, 0.3, 0.6)));
});

/* ---------- ninja warped wall: run up the curve, grab the top, mantle, slide back down ---------- */

const _warpQ = makePose();
const _warpSeed = makePose();
Object.assign(_warpSeed, { shLX: -2.7, shRX: -2.7, shLZ: 0.25, shRZ: -0.25, elL: -0.4, elR: -0.4, hpLX: -0.8, hpRX: -0.6, hpLZ: 0.1, hpRZ: -0.1, knL: 1.2, knR: 1.0 });

function warpSurf(f, W) {
  if (f <= W.f0) return 0;
  if (f >= W.f0 + W.R) return W.R;
  const a = Math.asin((f - W.f0) / W.R);
  return W.R * (1 - Math.cos(a));
}

/** Hanging from the top edge with toes on the curve, or pressing up over it (k = 0 .. 1). */
function warpHangPose(p, W, k) {
  const edgeY = W.R + 0.03;
  const edgeF = W.f0 + W.R - 0.05;
  copyPose(p, _warpSeed);
  // hang back from the wall with the arms reaching forward, so the knees stay clear of it
  const hipY = lerp(edgeY - 1.08, edgeY + 0.05, k);
  p.y = hipY - HIP_H;
  p.z = lerp(edgeF - 0.42, edgeF - 0.12, k);
  p.bx = lerp(0.3, 0.45, k);
  p.nkX = -0.4 * (1 - k);
  p.autoAnkle = false;
  p.anL = p.anR = -0.2;
  solveLimb(p, 'armL', _t.set(0.26, edgeY, edgeF));
  solveLimb(p, 'armR', _t.set(-0.26, edgeY, edgeF));
  const fy = hipY - lerp(0.75, 0.55, k);
  const a = Math.acos(clamp(1 - fy / W.R, -1, 1));
  const ff = W.f0 + W.R * Math.sin(a) - 0.02;
  solveLimb(p, 'legL', _t.set(0.16, fy + 0.05, ff));
  solveLimb(p, 'legR', _t.set(-0.16, fy - 0.1, ff + 0.02));
  return p;
}

function warpWallContactFn(p, t, ch) {
  const st = ch && ch.station;
  const W = (st && st.warp) || WARP;
  if (t < 0.26) { runUp(p, t, 0, 0.26, W.f0); return; }
  if (t < 0.4) {
    const a = 1.05 * seg(t, 0.26, 0.4);
    const f = W.f0 + W.R * Math.sin(a);
    gait(p, t * 34, 1);
    p.z = f;
    p.y = warpSurf(f, W) + 0.02;
    p.spX = 0.3;
    return;
  }
  if (t < 0.48) {
    // jump up the last bit and catch the edge
    const k = smooth(seg(t, 0.4, 0.48));
    const a = 1.05;
    const f = W.f0 + W.R * Math.sin(a);
    copyPose(p, STAND);
    gait(p, 0.4 * 34, 1);
    p.z = f;
    p.y = warpSurf(f, W) + 0.02;
    mixInto(p, warpHangPose(_warpQ, W, 0), k);
    return;
  }
  if (t < 0.6) {
    const k = smooth(seg(t, 0.5, 0.6));
    copyPose(p, warpHangPose(_warpQ, W, k));
    return;
  }
  if (t < 0.7) {
    // stand up on the platform, arms up
    const k = smooth(seg(t, 0.6, 0.66));
    copyPose(p, warpHangPose(_warpQ, W, 1));
    const q = makePoseCached(ch);
    copyPose(q, STAND);
    q.y = W.R;
    q.z = W.f0 + W.R + 0.5;
    const v = smooth(seg(t, 0.64, 0.7));
    q.shLZ = 0.12 + 2.5 * v; q.shRZ = -q.shLZ;
    mixInto(p, q, k);
    return;
  }
  // walk across the platform and jump down off the back
  const top = W.f0 + W.R;
  if (t < 0.82) {
    const u = seg(t, 0.7, 0.82);
    gait(p, u * 10, 0);
    p.z = lerp(top + 0.5, top + W.back - 0.25, u);
    p.y = W.R;
    return;
  }
  const a = seg(t, 0.82, 0.93);
  if (t < 0.93) {
    p.z = lerp(top + W.back - 0.25, top + W.back + W.land, a);
    p.y = W.R * (1 - a * a) + 0.5 * Math.sin(Math.PI * a);
    tuck(p, Math.sin(Math.PI * a) * 0.6);
    p.z = lerp(top + W.back - 0.25, top + W.back + W.land, a);
    p.y = W.R * (1 - a * a) + 0.5 * Math.sin(Math.PI * a);
    return;
  }
  crouchPose(p, 0.8 * (1 - smooth(seg(t, 0.93, 1))));
  p.z = top + W.back + W.land;
}

ANIMS.warpwall = { snapAll: true, dur: 5.6, events: [[0.26, 'hop'], [0.46, 'clap'], [0.6, 'land'], [0.82, 'jump'], [0.93, 'land']], fn: warpWallContactFn };

return { FK, solveLimb, gripBar };
})();
