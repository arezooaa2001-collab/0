'use strict';
/*
 * The "pro" exercises of the bigger gym (kettlebell, battle ropes, rower, box jump, tire flip,
 * leg press, lat pulldown, bouldering, speed bag, deadlift, muscle-up, ball slam, yoga and
 * calisthenics) and the moves of the four new venues (dojo, tennis, boxing, golf).
 */

/* ---------------- props ---------------- */

/** A held object that flies to `target` (root-local) after `releaseAt`; arc is the flight height. */
function flyProp(build, { mode = 'hands', arc = 1.6, ground = [0, 0.05, 0.55], spin = 0.3, offset = [0, 0.05, 0] } = {}) {
  return (ch, pr) => {
    const m = build();
    ch.root.add(m);
    pr.meshes.push(m);
    const from = new THREE.Vector3();
    pr.tick = (c) => {
      const A = c.action && c.action.def;
      if (!A) return;
      const t = c.actionT / A.dur;
      const rel = A.releaseAt || 2;
      m.visible = true;
      if (t < rel) {
        if (mode === 'ground') m.position.set(ground[0], ground[1], ground[2]);
        else if (mode === 'right') {
          c.root.updateMatrixWorld(true);
          c.B.haR.getWorldPosition(m.position);
          c.root.worldToLocal(m.position);
        } else handsMidLocal(c, m.position);
        if (mode !== 'ground') m.position.add(_flyOff.set(offset[0], offset[1], offset[2]));
        from.copy(m.position);
        m.rotation.set(0, 0, 0);
      } else {
        const f = clamp((t - rel) / Math.min(0.35, 1 - rel), 0, 1);
        const [tx, ty, tz] = A.target || [0, 2, 8];
        m.position.set(lerp(from.x, tx, f), lerp(from.y, ty, f) + Math.sin(Math.PI * f) * arc, lerp(from.z, tz, f));
        m.rotation.x += spin;
        m.visible = f < 0.97;
      }
    };
  };
}
const _flyOff = new THREE.Vector3();

function propMesh(fill) {
  const b = new Batch();
  fill(b);
  return new THREE.Mesh(mergeParts(b.parts, false), PROP_MAT);
}

/** Small object that follows the midpoint of the hands for the whole move. */
function handsProp(fill, dy = 0) {
  return (ch, pr) => {
    const m = propMesh(fill);
    ch.root.add(m);
    pr.meshes.push(m);
    pr.tick = (c) => { handsMidLocal(c, m.position); m.position.y += dy; };
  };
}

Object.assign(EXTRA_PROPS, {
  kettle: handsProp((b) => {
    b.sphere(0.13, 0, -0.14, 0, '#ff7b00');
    b.cyl(0.135, 0.03, 0, -0.04, 0, '#1d2433');
    b.add(UnitGeo.torus(1, 0.18, 6, 16), 0, 0, 0, '#2c3140', 0, 0, 0, 0.08, 0.08, 0.08);
  }),
  mball(ch, pr) {
    const m = propMesh((b) => {
      b.sphere(0.17, 0, 0, 0, '#e63946');
      b.add(UnitGeo.torus(1, 0.05, 6, 20), 0, 0, 0, '#111111', Math.PI / 2, 0, 0, 0.172, 0.172, 0.172);
      b.add(UnitGeo.torus(1, 0.05, 6, 20), 0, 0, 0, '#ffd34d', 0, 0, 0, 0.172, 0.172, 0.172);
    });
    ch.root.add(m);
    pr.meshes.push(m);
    pr.tick = (c) => {
      if (c.mballDown) m.position.set(0, 0.17, 0.5);
      else { handsMidLocal(c, m.position); m.position.y += 0.03; }
    };
  },
  racket(ch, pr) {
    const m = propMesh((b) => {
      b.cyl(0.018, 0.3, 0, -0.18, 0, '#1d2433');
      b.add(UnitGeo.torus(1, 0.08, 6, 24), 0, -0.5, 0, '#ff4d8d', 0, Math.PI / 2, 0, 0.15, 0.2, 0.15);
      b.box(0.01, 0.36, 0.26, 0, -0.5, 0, '#f2f2f2');
    });
    m.rotation.x = 0.4;
    ch.B.haR.add(m);
    pr.meshes.push(m);
  },
  tball: flyProp(() => propMesh((b) => b.sphere(0.04, 0, 0, 0, '#d7ff3d')), { mode: 'hands', arc: 0.6, spin: 0.5 }),
  club(ch, pr) {
    const m = propMesh((b) => {
      b.cyl(0.014, 1.0, 0, -0.5, 0, '#c9ced6');
      b.cyl(0.022, 0.25, 0, -0.08, 0, '#111111');
      b.box(0.05, 0.06, 0.14, 0, -1.0, 0.05, '#2f6fed');
    });
    m.rotation.x = 0.2;
    ch.B.haR.add(m);
    pr.meshes.push(m);
  },
  gball: flyProp(() => propMesh((b) => b.sphere(0.03, 0, 0, 0, '#ffffff')), { mode: 'ground', ground: [0.05, 0.03, 0.62], arc: 9, spin: 0.2 }),
  pball: flyProp(() => propMesh((b) => b.sphere(0.03, 0, 0, 0, '#ffffff')), { mode: 'ground', ground: [0.05, 0.03, 0.42], arc: 0, spin: 0.4 }),
  bow(ch, pr) {
    const m = propMesh((b) => {
      b.add(UnitGeo.torus(1, 0.03, 6, 24), 0, 0, 0.08, '#8b5a2b', 0, Math.PI / 2, 0, 0.55, 0.55, 0.55);
      b.cyl(0.02, 0.14, 0, 0, 0, '#e63946');
    });
    // keep only the front arc of the ring: squash it so it reads as a bow
    m.scale.set(1, 1, 0.35);
    m.position.set(0, -0.06, 0.02);
    ch.B.haL.add(m);
    pr.meshes.push(m);
  },
  arrow: flyProp(() => propMesh((b) => {
    b.cyl(0.012, 0.75, 0, 0, 0, '#d9c49a', Math.PI / 2, 0, 0);
    b.add(UnitGeo.cone(8), 0, 0, 0.4, '#9aa0a8', Math.PI / 2, 0, 0, 0.03, 0.08, 0.03);
    b.box(0.06, 0.005, 0.1, 0, 0, -0.33, '#e63946');
    b.box(0.005, 0.06, 0.1, 0, 0, -0.33, '#ffd34d');
  }), { mode: 'right', arc: 0.15, spin: 0 }),
  tire(ch, pr) {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.12, 1.55);
    const tire = propMesh((b) => {
      b.add(UnitGeo.torus(1, 0.42, 8, 24), 0, 0, 0, '#22252b', Math.PI / 2, 0, 0, 0.55, 0.55, 0.55);
      b.cyl(0.32, 0.2, 0, 0, 0, '#3c4250');
      b.cyl(0.12, 0.22, 0, 0, 0, '#ffd34d');
    });
    tire.position.set(0, 0, -0.62);
    pivot.add(tire);
    ch.root.add(pivot);
    pr.meshes.push(pivot);
    pr.tick = (c) => { pivot.rotation.x = c.tireAngle || 0; };
  },
  ropes(ch, pr) {
    const segs = [];
    const holder = new THREE.Group();
    ch.root.add(holder);
    pr.meshes.push(holder);
    const geo = new THREE.SphereGeometry(0.045, 8, 6);
    const mats = [new THREE.MeshStandardMaterial({ color: '#2f6fed', roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: '#ff7b00', roughness: 0.7 })];
    for (let s = 0; s < 2; s++) {
      const row = [];
      for (let i = 0; i < 22; i++) {
        const m = new THREE.Mesh(geo, mats[s]);
        holder.add(m);
        row.push(m);
      }
      segs.push(row);
    }
    const h = new THREE.Vector3();
    pr.tick = (c) => {
      c.root.updateMatrixWorld(true);
      ['haL', 'haR'].forEach((bn, s) => {
        c.B[bn].getWorldPosition(h);
        c.root.worldToLocal(h);
        const ax = s ? -0.3 : 0.3;
        const row = segs[s];
        for (let i = 0; i < row.length; i++) {
          const u = i / (row.length - 1);
          const wave = Math.sin(c.time * 14 - u * 9 + s * Math.PI) * 0.22 * (1 - u) * u * 3;
          row[i].position.set(lerp(h.x, ax, u), lerp(h.y, 0.25, u) + wave, lerp(h.z, 3.2, u));
        }
      });
    };
  },
  boards(ch, pr) {
    const halves = [];
    const holder = new THREE.Group();
    ch.root.add(holder);
    pr.meshes.push(holder);
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(s * 0.01, 0.78, 0.62);
      const m = propMesh((b) => {
        for (let k = 0; k < 3; k++) b.box(0.22, 0.03, 0.3, s * 0.11, k * 0.032, 0, k % 2 ? '#e3c08d' : '#d4a96a');
      });
      g.add(m);
      holder.add(g);
      halves.push({ g, s });
    }
    pr.tick = (c) => {
      const A = c.action && c.action.def;
      const t = A ? c.actionT / A.dur : 0;
      const f = clamp((t - 0.55) / 0.2, 0, 1);
      for (const { g, s } of halves) {
        g.rotation.z = -s * 1.2 * f;
        g.position.set(s * (0.01 + 0.12 * f), 0.78 - 0.7 * f * f, 0.62);
      }
    };
  },
});

/* ---------------- timelines ---------------- */

/** Step through key poses with smooth blends; events[i] fires when pose i is reached. */
function sequenceAnim(dur, poses, { base = {}, props, events, plantFeet = true, extra } = {}) {
  return {
    dur, props, events,
    fn(p, t, ch) {
      const k = smooth(seg(t, 0, 0.08)) * (1 - smooth(seg(t, 0.92, 1)));
      const u = seg(t, 0.06, 0.94) * poses.length;
      const i = Math.min(poses.length - 1, Math.floor(u));
      const f = smooth(clamp((u - i) * 2.2, 0, 1));
      const prev = poses[(i + poses.length - 1) % poses.length];
      const q = makePose();
      Object.assign(q, base);
      const A = Object.assign({}, q, i === 0 ? {} : prev);
      const B = Object.assign({}, q, poses[i]);
      for (const key of POSE_KEYS) q[key] = lerp(A[key], B[key], f);
      if (plantFeet) plant(q, false);
      if (extra) extra(q, t, ch);
      mixInto(p, q, k);
    },
  };
}

function boxJumpFn(p, t) {
  const H = 0.6;
  const D = 0.62;
  if (t < 0.22) {
    const c = smooth(t / 0.22);
    crouchPose(p, c * 0.9);
    p.shLX = p.shRX = 0.9 * c;
  } else if (t < 0.5) {
    const a = seg(t, 0.22, 0.5);
    p.y = H * smooth(a) + 0.45 * Math.sin(Math.PI * a);
    p.z = D * smooth(a);
    const k = Math.sin(Math.PI * a);
    p.hpLX = p.hpRX = -1.2 * k;
    p.knL = p.knR = 1.6 * k;
    p.shLX = p.shRX = lerp(0.9, -2.4, smooth(a));
  } else if (t < 0.68) {
    crouchPose(p, Math.sin(Math.PI * seg(t, 0.5, 0.68)) * 0.7);
    p.y += H;
    p.z = D;
    p.shLX = p.shRX = -1.6;
  } else if (t < 0.82) {
    p.y = H;
    p.z = D;
    p.shLX = p.shRX = -2.7;
    p.shLZ = 0.45; p.shRZ = -0.45;
  } else {
    const a = smooth(seg(t, 0.82, 1));
    p.y = H * (1 - a);
    p.z = D * (1 - a);
    p.hpLX = 0.5 * Math.sin(Math.PI * a);
    p.knL = 0.6 * Math.sin(Math.PI * a);
  }
}

function tireFlipFn(p, t, ch) {
  let ang = 0;
  if (t < 0.2) {
    const c = smooth(t / 0.2);
    p.hpLX = p.hpRX = -1.35 * c;
    p.knL = p.knR = 1.55 * c;
    p.spX = 0.85 * c;
    p.shLX = p.shRX = -0.95 * c;
    p.elL = p.elR = -0.1;
    p.shLZ = 0.3; p.shRZ = -0.3;
    plant(p);
  } else if (t < 0.48) {
    const u = smooth(seg(t, 0.2, 0.48));
    p.hpLX = p.hpRX = lerp(-1.35, -0.4, u);
    p.knL = p.knR = lerp(1.55, 0.4, u);
    p.spX = lerp(0.85, 0.15, u);
    p.shLX = p.shRX = lerp(-0.95, -1.3, u);
    p.elL = p.elR = lerp(-0.1, -1.9, u);
    p.shLZ = 0.3; p.shRZ = -0.3;
    plant(p);
    ang = 1.6 * u;
  } else if (t < 0.72) {
    const u = smooth(seg(t, 0.48, 0.72));
    p.hpLX = -0.7 * Math.sin(Math.PI * u); p.knL = 0.5 * Math.sin(Math.PI * u);
    p.hpRX = 0.25 * u;
    p.spX = 0.25;
    p.shLX = p.shRX = lerp(-1.3, -2.2, u);
    p.elL = p.elR = lerp(-1.9, -0.1, u);
    p.z = 0.25 * u;
    plant(p, false);
    ang = lerp(1.6, Math.PI, u);
  } else {
    const u = smooth(seg(t, 0.72, 1));
    p.z = 0.25 * (1 - u);
    p.shLX = p.shRX = lerp(-2.2, 0.05, u);
    p.shLZ = 0.12 + 0.4 * Math.sin(Math.PI * u); p.shRZ = -p.shLZ;
    ang = Math.PI;
  }
  if (ch) ch.tireAngle = ang;
}

function muscleUpFn(p, t) {
  const grab = smooth(seg(t, 0, 0.1));
  const drop = smooth(seg(t, 0.9, 1));
  const hang = grab * (1 - drop);
  const pull = smooth(seg(t, 0.12, 0.42));
  const over = smooth(seg(t, 0.42, 0.56));
  const push = smooth(seg(t, 0.56, 0.72));
  const lower = smooth(seg(t, 0.78, 0.9));
  const up = (pull * 0.9 + over * 0.35 + push * 0.35) * (1 - lower);
  p.y = hang * (0.42 + up);
  p.shLX = p.shRX = lerp(0.05, lerp(lerp(lerp(-3.05, -2.0, pull), -0.6, over), 0.25, push * (1 - lower)), hang);
  p.elL = p.elR = lerp(-0.18, lerp(lerp(-0.05 - 1.9 * pull, -2.4, over), -0.05, push * (1 - lower)), hang);
  p.shLZ = 0.28; p.shRZ = -0.28;
  p.spX = 0.35 * over * (1 - push);
  p.hpLX = p.hpRX = -0.5 * hang;
  p.knL = p.knR = 0.4 * hang;
  p.autoAnkle = false;
  p.anL = p.anR = 0.6 * hang;
}

function slamFn(p, t, ch) {
  const k = smooth(seg(t, 0, 0.08)) * (1 - smooth(seg(t, 0.92, 1)));
  const u = seg(t, 0.06, 0.94) * 2;
  const f = u % 1;
  const up = f < 0.45 ? smooth(f / 0.45) : 1 - smooth(seg(f, 0.45, 0.6));
  const down = f >= 0.45 && f < 0.85;
  if (ch) ch.mballDown = f > 0.58 && f < 0.88;
  const q = makePose();
  q.shLX = q.shRX = lerp(-0.9, -3.0, up);
  q.elL = q.elR = lerp(-0.4, -0.3, up);
  q.shLZ = -0.1; q.shRZ = 0.1;
  const c = down ? Math.sin(Math.PI * seg(f, 0.45, 0.85)) : 0.15 * (1 - up);
  q.hpLX = q.hpRX = -1.0 * c;
  q.knL = q.knR = 1.2 * c;
  q.spX = 0.8 * c;
  if (down && f > 0.55) { q.shLX = q.shRX = -0.6; q.elL = q.elR = -0.2; }
  plant(q, false);
  q.y += 0.06 * up;
  mixInto(p, q, k);
}

function archeryFn(p, t) {
  const k = smooth(seg(t, 0, 0.12)) * (1 - smooth(seg(t, 0.88, 1)));
  const draw = smooth(seg(t, 0.15, 0.4));
  const rel = t > 0.6 ? smooth(seg(t, 0.6, 0.66)) : 0;
  const q = makePose();
  q.spY = 0.15;
  q.hpLZ = 0.15; q.hpRZ = -0.15;
  q.shLX = -1.5; q.shLZ = 0.15; q.elL = -0.05;
  q.shRX = -1.5;
  q.shRY = 0.6 * draw * (1 - rel);
  q.shRZ = -0.1 + 0.6 * rel;
  q.elR = lerp(-0.3, -2.5, draw * (1 - rel));
  q.nkY = -0.1;
  mixInto(p, q, k);
}

function serveFn(p, t) {
  const toss = smooth(seg(t, 0.05, 0.35));
  const hit = smooth(seg(t, 0.48, 0.6));
  const after = smooth(seg(t, 0.6, 0.85));
  const end = smooth(seg(t, 0.88, 1));
  p.shLX = lerp(lerp(0.05, -2.8, toss), -0.6, hit) * (1 - end);
  p.elL = -0.1;
  p.shRX = lerp(lerp(0.05, -2.5, toss), lerp(-3.0, -0.6, after), hit) * (1 - end);
  p.elR = lerp(lerp(-0.2, -2.3, toss), -0.2, hit) * (1 - end) - 0.18 * end;
  p.shRZ = -0.3;
  p.spX = lerp(-0.25 * toss, 0.45 * after, hit) * (1 - end);
  p.knL = p.knR = 0.4 * toss * (1 - hit);
  const air = Math.sin(Math.PI * seg(t, 0.45, 0.68));
  p.y = 0.18 * air;
  if (air <= 0) plant(p, false);
}

function forehandFn(p, t) {
  const k = smooth(seg(t, 0, 0.12)) * (1 - smooth(seg(t, 0.86, 1)));
  const back = smooth(seg(t, 0.08, 0.38));
  const swing = smooth(seg(t, 0.42, 0.62));
  const q = makePose();
  q.hpLX = -0.3; q.hpRX = 0.2; q.knL = q.knR = 0.4;
  q.spX = 0.2;
  q.spY = lerp(0.9 * back, -1.0, swing);
  q.shRX = lerp(-0.6, -1.6, swing);
  q.shRZ = lerp(-1.1, -0.5, swing);
  q.elR = -0.5;
  q.shLX = -1.0; q.shLZ = 0.6; q.elL = -0.8;
  plant(q, false);
  mixInto(p, q, k);
}

function golfFn(p, t) {
  const k = smooth(seg(t, 0, 0.1)) * (1 - smooth(seg(t, 0.92, 1)));
  const back = smooth(seg(t, 0.12, 0.45));
  const down = smooth(seg(t, 0.48, 0.58));
  const thru = smooth(seg(t, 0.58, 0.8));
  const q = makePose();
  q.spX = lerp(0.55, 0.15, thru);
  q.knL = q.knR = 0.25;
  q.hpLZ = 0.12; q.hpRZ = -0.12;
  q.nkX = 0.35 * (1 - thru);
  q.spY = lerp(lerp(0, -1.1, back), lerp(0.2, 1.2, thru), down);
  const arms = lerp(lerp(-0.55, -2.1, back), lerp(-0.6, -2.2, thru), down);
  q.shLX = q.shRX = arms;
  q.shLZ = -0.22; q.shRZ = 0.22;
  q.elL = q.elR = -0.05 - 0.6 * back * (1 - down);
  q.spZ = -0.15 * back * (1 - down) + 0.15 * thru;
  plant(q, false);
  mixInto(p, q, k);
}

function puttFn(p, t) {
  const k = smooth(seg(t, 0, 0.12)) * (1 - smooth(seg(t, 0.9, 1)));
  const sw = t < 0.5 ? -Math.sin(Math.PI * seg(t, 0.15, 0.5) * 0.5) : Math.sin(Math.PI * seg(t, 0.5, 0.7) * 0.5) * (1 - seg(t, 0.75, 0.9));
  const q = makePose();
  q.spX = 0.75; q.nkX = 0.4;
  q.knL = q.knR = 0.2;
  q.hpLZ = 0.1; q.hpRZ = -0.1;
  q.shLX = q.shRX = -0.75 + 0.25 * sw;
  q.shLZ = -0.2; q.shRZ = 0.2;
  q.elL = q.elR = -0.15;
  plant(q, false);
  mixInto(p, q, k);
}

function speedBagFn(p, t) {
  const k = smooth(seg(t, 0, 0.1)) * (1 - smooth(seg(t, 0.9, 1)));
  const ph = t * 2.0 * 14;
  const q = makePose();
  q.hpLX = -0.2; q.hpRX = 0.1; q.knL = q.knR = 0.2;
  q.shLX = -1.55 + 0.25 * Math.sin(ph);
  q.shRX = -1.55 + 0.25 * Math.sin(ph + Math.PI);
  q.elL = -1.9 + 0.35 * Math.cos(ph);
  q.elR = -1.9 + 0.35 * Math.cos(ph + Math.PI);
  q.shLZ = 0.35; q.shRZ = -0.35;
  q.shLY = -0.3; q.shRY = 0.3;
  q.nkX = -0.15;
  plant(q, false);
  mixInto(p, q, k);
}

function farmerFn(p, t, ch) {
  const k = smooth(seg(t, 0, 0.1)) * (1 - smooth(seg(t, 0.9, 1)));
  const q = makePose();
  gait(q, t * 22, 0.1);
  q.shLX = q.shRX = 0.02;
  q.elL = q.elR = -0.05;
  q.shLZ = 0.2; q.shRZ = -0.2;
  q.spX = -0.06;
  q.nkX = 0.05;
  mixInto(p, q, k);
  p.autoAnkle = true;
}

function meditateFn(p, t) {
  const k = smooth(seg(t, 0, 0.15)) * (1 - smooth(seg(t, 0.85, 1)));
  const q = Object.assign(makePose(), BASES.seated, {
    bx: -0.05, hpLX: -1.5, hpRX: -1.5, knL: 2.5, knR: 2.5, hpLZ: 0.75, hpRZ: -0.75,
    shLX: -0.7, shRX: -0.7, shLZ: 0.3, shRZ: -0.3, elL: -0.6, elR: -0.6, nkX: 0.15,
  });
  const breathe = Math.sin(t * 9) * 0.03;
  q.spX = breathe;
  q.y = 0.12 - HIP_H + 0.08 * Math.sin(Math.PI * seg(t, 0.2, 0.8));
  q.autoAnkle = false;
  q.anL = q.anR = 0.6;
  mixInto(p, q, k);
}

const PRO_ANIMS = {
  kettle: keyAnim({ dur: 2.8, reps: 4, plantFeet: true, props: ['kettle'], inOut: 0.1,
    base: { hpLZ: 0.14, hpRZ: -0.14, shLZ: 0.04, shRZ: -0.04, elL: -0.02, elR: -0.02 },
    a: { spX: 0.65, hpLX: -0.75, hpRX: -0.75, knL: 0.45, knR: 0.45, shLX: 0.5, shRX: 0.5, nkX: -0.35 },
    b: { spX: -0.05, shLX: -1.45, shRX: -1.45 } }),
  ropes: keyAnim({ dur: 2.6, reps: 7, props: ['ropes'], inOut: 0.08, plantFeet: true,
    base: { hpLX: -0.6, hpRX: -0.6, knL: 0.8, knR: 0.8, spX: 0.35, hpLZ: 0.12, hpRZ: -0.12, elL: -0.5, elR: -0.5, nkX: -0.25, shLZ: 0.15, shRZ: -0.15 },
    a: { shLX: -1.35, shRX: -0.35 }, b: { shLX: -0.35, shRX: -1.35 } }),
  rower: keyAnim({ dur: 3.2, reps: 3, inOut: 0.14,
    base: { y: 0.36 - HIP_H, bx: 0, autoAnkle: false, anL: -0.3, anR: -0.3, shLZ: 0.1, shRZ: -0.1 },
    a: { z: 0.3, bx: 0.3, hpLX: -2.1, hpRX: -2.1, knL: 2.2, knR: 2.2, shLX: -1.75, shRX: -1.75, elL: -0.05, elR: -0.05 },
    b: { z: -0.2, bx: -0.3, hpLX: -1.25, hpRX: -1.25, knL: 0.1, knR: 0.1, shLX: -0.25, shRX: -0.25, elL: -2.0, elR: -2.0 } }),
  boxjump: { dur: 2.6, events: [[0.22, 'jump'], [0.5, 'land'], [0.99, 'hop']], fn: boxJumpFn },
  tireflip: { dur: 3.4, props: ['tire'], events: [[0.72, 'drop']], fn: tireFlipFn },
  legpress: keyAnim({ dur: 3.2, reps: 3, inOut: 0.16,
    base: { bx: -1.05, y: 0.52 - HIP_H, shLX: -0.2, shRX: -0.2, shLZ: 0.45, shRZ: -0.45, elL: -0.4, elR: -0.4, nkX: 0.5, autoAnkle: false, anL: 0.2, anR: 0.2, hpLZ: 0.12, hpRZ: -0.12 },
    a: { hpLX: -2.0, hpRX: -2.0, knL: 1.9, knR: 1.9 }, b: { hpLX: -1.25, hpRX: -1.25, knL: 0.12, knR: 0.12 } }),
  latpull: keyAnim({ dur: 3.0, reps: 3, inOut: 0.14,
    base: { y: 0.5 - HIP_H, hpLX: -1.5, hpRX: -1.5, knL: 1.5, knR: 1.5, autoAnkle: false, anL: 0, anR: 0, nkX: -0.15 },
    a: { shLX: -2.95, shRX: -2.95, shLZ: 0.45, shRZ: -0.45, elL: -0.1, elR: -0.1 },
    b: { shLX: -1.15, shRX: -1.15, shLZ: 1.15, shRZ: -1.15, elL: -2.2, elR: -2.2, spX: -0.15 } }),
  boulder: ANIMS.climb,
  speedbag: { dur: 2.2, props: ['gloves'], events: [0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85].map((x) => [x, 'clap']), fn: speedBagFn },
  deadlift: keyAnim({ dur: 3.2, reps: 3, plantFeet: true, props: ['barbell'], inOut: 0.14,
    base: { hpLZ: 0.1, hpRZ: -0.1, elL: -0.02, elR: -0.02, shLZ: 0.16, shRZ: -0.16 },
    a: { spX: 0.55, hpLX: -0.95, hpRX: -0.95, knL: 0.75, knR: 0.75, shLX: -0.45, shRX: -0.45, nkX: -0.4 },
    b: { spX: -0.05, shLX: 0.05, shRX: 0.05 } }),
  muscleup: { dur: 3.4, events: [[0.06, 'jump'], [0.95, 'hop']], fn: muscleUpFn },
  mball: { dur: 2.6, props: ['mball'], events: [[0.33, 'thud'], [0.77, 'thud']], fn: slamFn },
  warrior: keyAnim({ dur: 3.4, reps: 1, inOut: 0.2, plantFeet: true, wobble: 0.002,
    b: { hpLX: -1.05, knL: 1.15, hpRX: 0.6, knR: 0.05, hpLZ: 0.15, hpRZ: -0.1, shLZ: 1.55, shRZ: -1.55, elL: -0.02, elR: -0.02, nkY: 0.7, spY: -0.25 } }),
  cobra: keyAnim({ dur: 3.4, reps: 2, base: Object.assign({}, BASES.prone, { shLX: -0.7, shRX: -0.7, shLZ: 0.35, shRZ: -0.35, elL: -1.4, elR: -1.4 }),
    b: { spX: -0.95, nkX: -0.45, shLX: -1.3, shRX: -1.3, elL: -0.2, elR: -0.2 } }),
  downdog: keyAnim({ dur: 3.4, reps: 2, inOut: 0.22,
    base: { bx: 2.05, y: -0.12, hpLX: -1.55, hpRX: -1.55, knL: 0, knR: 0, shLX: -2.95, shRX: -2.95, shLZ: 0.25, shRZ: -0.25, elL: 0, elR: 0, nkX: 0.4, autoAnkle: false, anL: 0.55, anR: 0.55 },
    b: { hpLX: -1.8, knL: 0.35 } }),
  meditate: { dur: 4.2, fn: meditateFn },
  sideplank: keyAnim({ dur: 3.2, reps: 2, inOut: 0.2,
    base: { bz: -1.15, y: 0.5 - HIP_H, shRZ: 0.35, shRX: 0, elR: 0, shLZ: 2.6, elL: 0, hpLZ: 0.05, hpRZ: -0.05, knL: 0, knR: 0, autoAnkle: false },
    b: { y: 0.6 - HIP_H, bz: -1.25 } }),
  pistol: keyAnim({ dur: 3.0, reps: 2, plantFeet: true, inOut: 0.14,
    base: { hpRX: -0.35, knR: 0, shLX: -1.5, shRX: -1.5, shLZ: 0.1, shRZ: -0.1, elL: -0.05, elR: -0.05 },
    b: { hpLX: -1.4, knL: 2.1, hpRX: -1.45, spX: 0.45, nkX: -0.3 } }),
  lsit: keyAnim({ dur: 3.2, reps: 1, inOut: 0.2, wobble: 0.003,
    b: { y: 0.32 - HIP_H, hpLX: -1.5, hpRX: -1.5, knL: 0, knR: 0, shLX: 0.15, shRX: 0.15, shLZ: 0.32, shRZ: -0.32, elL: 0, elR: 0, spX: 0.2, nkX: -0.2, autoAnkle: false, anL: 0.6, anR: 0.6 } }),
  hspu: keyAnim({ dur: 3.4, reps: 2, inOut: 0.22,
    base: { bx: Math.PI, y: 0.3, shLX: -3.05, shRX: -3.05, shLZ: 0.32, shRZ: -0.32, elL: -0.05, elR: -0.05, nkX: -0.5, autoAnkle: false, anL: 0.9, anR: 0.9 },
    b: { y: 0.02, elL: -1.5, elR: -1.5, shLX: -2.6, shRX: -2.6 } }),
  farmer: { dur: 3.0, props: ['dumbbells'], move: (t) => (t > 0.1 && t < 0.9 ? 1.1 : 0), fn: farmerFn },
  // dojo
  boardbreak: sequenceAnim(2.6, [
    { hpLZ: 0.5, hpRZ: -0.5, knL: 0.9, knR: 0.9, hpLX: -0.5, hpRX: -0.5, shLX: -1.2, elL: -1.8, shRX: -1.2, elR: -1.8 },
    { hpLZ: 0.5, hpRZ: -0.5, knL: 0.9, knR: 0.9, hpLX: -0.5, hpRX: -0.5, shRX: -3.0, elR: -0.3, shLX: -0.8, elL: -1.5, nkX: -0.2 },
    { hpLZ: 0.5, hpRZ: -0.5, knL: 1.0, knR: 1.0, hpLX: -0.55, hpRX: -0.55, shRX: -0.95, elR: -0.02, spX: 0.45, shLX: 0.3, elL: -1.6, nkX: 0.3 },
    { hpLZ: 0.5, hpRZ: -0.5, knL: 0.9, knR: 0.9, hpLX: -0.5, hpRX: -0.5, shRX: -0.9, elR: -0.05, spX: 0.4, shLX: 0.3, elL: -1.6 },
  ], { props: ['boards'], events: [[0.57, 'break']] }),
  archery: { dur: 3.0, props: ['bow', 'arrow'], releaseAt: 0.6, target: [0.35, 1.45, 14], events: [[0.6, 'whoosh']], fn: archeryFn },
  kata: sequenceAnim(3.6, [
    { hpLX: -0.7, knL: 0.8, hpRX: 0.45, knR: 0.1, shLX: -1.55, elL: 0, shRX: 0.2, elR: -2.2, spY: -0.3 },
    { hpLX: -0.7, knL: 0.8, hpRX: 0.45, knR: 0.1, shRX: -1.55, elR: 0, shLX: 0.2, elL: -2.2, spY: 0.3 },
    { hpRX: -0.7, knR: 0.8, hpLX: 0.45, knL: 0.1, shLX: -2.6, shLZ: 0.2, elL: -1.4, shRX: 0.2, elR: -2.2 },
    { hpRX: -1.6, knR: 0.2, hpLX: 0.1, knL: 0.3, shLX: -0.6, elL: -2.0, shRX: -0.6, elR: -2.0, spX: -0.15 },
    { hpLZ: 0.45, hpRZ: -0.45, knL: 0.8, knR: 0.8, hpLX: -0.45, hpRX: -0.45, shLX: -1.55, elL: 0, shRX: -1.55, elR: 0 },
  ], { events: [[0.24, 'punch'], [0.42, 'punch'], [0.6, 'whoosh'], [0.78, 'whoosh'], [0.95, 'punch']] }),
  // tennis
  serve: { dur: 2.2, props: ['racket', 'tball'], releaseAt: 0.56, target: [0.8, 0.1, 18], events: [[0.45, 'jump'], [0.56, 'punch']], fn: serveFn },
  forehand: { dur: 1.9, props: ['racket', 'tball'], releaseAt: 0.52, target: [-1.5, 0.3, 20], events: [[0.52, 'punch']], fn: forehandFn },
  // boxing arena
  combo: sequenceAnim(2.4, [
    { hpLX: -0.3, hpRX: 0.2, knL: 0.35, knR: 0.35, spX: 0.15, shLX: -1.55, elL: -0.1, shRX: -0.55, shRY: 0.35, elR: -2.3, spY: 0.25 },
    { hpLX: -0.3, hpRX: 0.2, knL: 0.35, knR: 0.35, spX: 0.15, shRX: -1.55, elR: -0.1, shLX: -0.55, shLY: -0.35, elL: -2.3, spY: -0.4 },
    { hpLX: -0.3, hpRX: 0.2, knL: 0.45, knR: 0.45, spX: 0.15, shLX: -1.4, shLZ: 1.2, elL: -1.6, shRX: -0.55, elR: -2.3, spY: 0.6 },
    { hpLX: -0.3, hpRX: 0.2, knL: 0.6, knR: 0.6, spX: 0.1, shRX: -2.2, elR: -2.0, shLX: -0.55, shLY: -0.35, elL: -2.3, spY: -0.3 },
  ], { props: ['gloves'], events: [[0.25, 'punch'], [0.47, 'punch'], [0.69, 'punch'], [0.91, 'punch']] }),
  slip: keyAnim({ dur: 2.4, reps: 3, props: ['gloves'], plantFeet: true, base: BASES.guard,
    a: { spZ: 0.35, spX: 0.35, knL: 0.6, knR: 0.6, bz: 0.08 }, b: { spZ: -0.35, spX: 0.35, knL: 0.6, knR: 0.6, bz: -0.08 } }),
  // golf
  golf: { dur: 2.6, props: ['club', 'gball'], releaseAt: 0.56, target: [0, 6, 45], events: [[0.56, 'punch']], fn: golfFn },
  putt: { dur: 2.4, props: ['club', 'pball'], releaseAt: 0.55, target: [0, 0.03, 4.2], fn: puttFn },
};
Object.assign(ANIMS, PRO_ANIMS);
