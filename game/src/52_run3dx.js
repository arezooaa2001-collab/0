/* ============================ 3D RUNNER: MORE OBSTACLES + RIVAL RUNNERS ============================ */
// New obstacle types are described by their moving parts at time t (boxes, discs, beams, turning bars). The same
// parts drive collisions, the autopilot / rival AI, the three.js view and both 2D chase views.
const X3 = {
  // a laser across the road at jump height that blinks on and off
  beam: {
    gen: (s, r) => [{ type: 'beam', s0: s, s1: s + .35, x0: -5, x1: 5, y1: 1, on: 1.1, off: .9 + r() * .4, ph: r() * 2 }],
    parts: (o, t) => [{ sh: 'beam', x0: -5, x1: 5, y0: .45, y1: .95, s0: o.s0, s1: o.s1, on: ((t + o.ph) % (o.on + o.off)) < o.on },
      { sh: 'box', x0: -5.6, x1: -5.1, y0: 0, y1: 1.3, s0: o.s0 - .1, s1: o.s1 + .1, col: 0x2a2540, nocol: true }, { sh: 'box', x0: 5.1, x1: 5.6, y0: 0, y1: 1.3, s0: o.s0 - .1, s1: o.s1 + .1, col: 0x2a2540, nocol: true }],
  },
  // a big saw blade rolling left and right across the road
  saw: {
    gen: (s, r) => [{ type: 'saw', s0: s, s1: s + .5, x0: -5, x1: 5, y1: 1.7, amp: 3.6, om: 2 + r() * 1.2, ph: r() * 6.28 }],
    parts: (o, t) => { const c = Math.sin(t * o.om + o.ph) * o.amp; return [{ sh: 'disc', x0: c - .85, x1: c + .85, y0: 0, y1: 1.7, s0: o.s0, s1: o.s1, cx: c, rot: t * 12, heavy: true }]; },
  },
  // a hammer swinging across the road from a frame overhead
  hammer: {
    gen: (s, r) => [{ type: 'hammer', s0: s, s1: s + 1, x0: -5, x1: 5, y1: 2, L: 6, A: .95, om: 1.6 + r() * .6, ph: r() * 6.28 }],
    parts: (o, t) => {
      const th = o.A * Math.sin(t * o.om + o.ph), x = o.L * Math.sin(th), yb = o.L * (1 - Math.cos(th)), sm = (o.s0 + o.s1) / 2;
      return [{ sh: 'box', x0: x - .9, x1: x + .9, y0: yb, y1: yb + 1.5, s0: o.s0, s1: o.s1, col: 0x8a8aa8, heavy: true },
        { sh: 'arm', cx: x / 2, cy: o.L + 1.5 - (o.L - yb) / 2 - .02, len: o.L, rz: th, s0: sm - .15, s1: sm + .15, nocol: true },
        { sh: 'box', x0: -5.9, x1: -5.4, y0: 0, y1: o.L + 1.8, s0: sm - .25, s1: sm + .25, col: 0x2a2540, nocol: true }, { sh: 'box', x0: 5.4, x1: 5.9, y0: 0, y1: o.L + 1.8, s0: sm - .25, s1: sm + .25, col: 0x2a2540, nocol: true },
        { sh: 'box', x0: -5.9, x1: 5.9, y0: o.L + 1.5, y1: o.L + 1.9, s0: sm - .25, s1: sm + .25, col: 0x2a2540, nocol: true }];
    },
  },
  // a wall with a hole that slides from side to side: steer through the hole
  slide: {
    gen: (s, r) => [{ type: 'slide', s0: s, s1: s + 1.2, x0: -5, x1: 5, y1: 3.4, amp: 2.6, om: 1.3 + r() * .7, ph: r() * 6.28, hw: 1.4 }],
    parts: (o, t) => { const c = Math.sin(t * o.om + o.ph) * o.amp; return [{ sh: 'box', x0: -5, x1: c - o.hw, y0: 0, y1: 3.4, s0: o.s0, s1: o.s1, col: 0xff7a45, heavy: true }, { sh: 'box', x0: c + o.hw, x1: 5, y0: 0, y1: 3.4, s0: o.s0, s1: o.s1, col: 0xff7a45, heavy: true }]; },
  },
  // a bar turning around a post in the middle of the road: jump it as it sweeps past
  spin: {
    gen: (s, r) => [{ type: 'spin', s0: s, s1: s + 9.2, x0: -5, x1: 5, y1: 1, sc: s + 4.6, om: (r() < .5 ? -1 : 1) * (1.5 + r() * .7), ph: r() * 6.28 }],
    parts: (o, t) => [{ sh: 'rbar', cx: 0, cs: o.sc, len: 9.2, th: t * o.om + o.ph, y0: .4, y1: 1, s0: o.s0, s1: o.s1 },
      { sh: 'box', x0: -.3, x1: .3, y0: 0, y1: .9, s0: o.sc - .3, s1: o.sc + .3, col: 0x2a2540 }],
  },
  // three stone pillars slamming down in turn: stay in a lane whose pillar is up
  pillar: {
    gen: (s, r) => [{ type: 'pillar', s0: s, s1: s + 1.8, x0: -5, x1: 5, y1: 7, per: 2.2 + r() * .6, ph: r() }],
    parts: (o, t) => { const out = []; for (let i = 0; i < 3; i++) { const u = ((t / o.per + o.ph + i / 3) % 1 + 1) % 1, x = (i - 1) * 3.4;
      const yb = u < .55 ? 7 : u < .65 ? 7 * (1 - (u - .55) / .1) : u < .82 ? 0 : 7 * ((u - .82) / .18);
      out.push({ sh: 'box', x0: x - 1.45, x1: x + 1.45, y0: yb, y1: yb + 6, s0: o.s0, s1: o.s1, col: u > .4 && u < .65 ? 0xa04a6a : 0x6a5a8a, heavy: true, warn: u > .4 && u < .65 }); } return out; },
  },
};
const X3_TYPES = Object.keys(X3);
// does the runner p (x, s, y) touch one of the obstacle's parts at time t? returns the part
function x3Hit(o, t, p, pad = .35) {
  for (const q of X3[o.type].parts(o, t)) {
    if (q.nocol || q.on === false) continue;
    if (!(p.y < q.y1 && p.y + 1.4 > q.y0)) continue;
    if (q.sh === 'rbar') {
      const c = Math.cos(q.th), sn = Math.sin(q.th), dx = p.x - q.cx, ds = p.s - q.cs, along = clamp(dx * c + ds * sn, -q.len / 2, q.len / 2);
      if (Math.hypot(dx - along * c, ds - along * sn) < pad + .15) return q;
    } else if (p.x + pad > q.x0 && p.x - pad < q.x1 && p.s + pad > q.s0 && p.s - pad < q.s1) return q;
  }
  return null;
}

/* ---------- the autopilot (tests) and the rival runners share this planner ---------- */
// lateral target and jump for a runner p moving at speed v; skip(i) lets a rival "miss" some obstacles
function botFor(run, p, v, skip) {
  const inp = { left: false, right: false, jump: false }, OB = run.obs;
  let W0 = 0; { let a = 0, e = OB.length; while (a < e) { const m = (a + e) >> 1; if (OB[m].s1 < p.s - 4) a = m + 1; else e = m; } W0 = Math.max(0, a - 12); }
  let W1 = W0; while (W1 < OB.length && OB[W1].s0 <= p.s + 65) W1++;
  const look = Math.max(18, v * 1.7);
  let target = p.x;
  const cb = run.bridgeAt(p.s);
  let ahead = null; for (let k = 0.5; k <= v * 0.9; k += 0.5) { const b = run.bridgeAt(p.s + k); if (b) { ahead = b; break; } }
  // X3 parts as lateral ranges at the time the runner gets there
  const x3Ranges = (o, tall) => {
    const tA = run.time + Math.max(0, (o.s0 - p.s) / Math.max(v, 1)), out = [];
    for (let dt = -0.3; dt <= 0.31; dt += 0.15) for (const q of X3[o.type].parts(o, tA + dt)) {
      if (q.nocol || q.on === false || q.sh === 'rbar') continue;
      const isTall = q.y1 > 1.25 && q.y0 < 1.5; if (isTall !== tall) continue; out.push([q.x0, q.x1]);
    }
    return out;
  };
  if (cb) {
    const nb = run.bridgeAt(cb.s1 + 0.05);
    target = (nb && nb !== cb && cb.s1 - p.s < v * 0.2) ? clamp(nb.cx, cb.cx - cb.w / 2 + 0.35, cb.cx + cb.w / 2 - 0.35) : cb.cx;
  } else if (ahead) target = ahead.cx;
  else {
    let best = p.x, bestScore = 1e9; const xr = new Map();
    for (let i = W0; i < W1; i++) { const o = OB[i]; if (X3[o.type] && !o.hit && o.s1 >= p.s - 0.4 && o.s0 <= p.s + look && !(skip && skip(i))) xr.set(i, x3Ranges(o, true)); }
    for (let x = -4.4; x <= 4.4; x += 0.2) {
      let score = Math.abs(x - p.x) * 0.15;
      for (let i = W0; i < W1; i++) { const o = OB[i];
        if (o.type === 'gap' || o.hit || o.s1 < p.s - 0.4 || o.s0 > p.s + look || (skip && skip(i))) continue;
        if (X3[o.type]) {
          const near = 1000 / (1 + (o.s0 - p.s) * 0.05);
          for (const [a, b] of xr.get(i) || []) if (x > a - .75 && x < b + .75) score += near;
          continue;
        }
        let x0 = o.x0, x1 = o.x1;
        if (o.type === 'mover') {
          const tA = run.time + Math.max(0, (o.s0 - p.s) / Math.max(v, 1));
          x0 = 1e9; x1 = -1e9;
          for (let dt = -0.3; dt <= 0.3; dt += 0.1) { const c = Math.sin((tA + dt) * o.om + o.ph) * o.amp; x0 = Math.min(x0, c - o.w / 2); x1 = Math.max(x1, c + o.w / 2); }
        }
        const pad = o.type === 'wall' || o.type === 'mover' ? 0.75 : 0.55;
        if (x > x0 - pad && x < x1 + pad) score += (o.type === 'wall' || o.type === 'mover') ? 1000 / (1 + (o.s0 - p.s) * 0.05) : (o.type === 'spikes' ? 40 : 25);
      }
      if (score < bestScore) { bestScore = score; best = x; }
    }
    target = best;
  }
  if (target > p.x + 0.12) inp.right = true; else if (target < p.x - 0.12) inp.left = true;
  // jump decisions
  if (p.ground || p.coy > 0) {
    for (let i = W0; i < W1; i++) { const o = OB[i];
      const d = o.s0 - p.s;
      if (d < -0.5 || d > 12 || (skip && skip(i))) continue;
      if (o.type === 'gap') { if (d < 1.2 && d > -0.3) inp.jump = true; continue; }
      if (o.type === 'wall' || o.type === 'mover' || o.hit) continue;
      if (X3[o.type]) {
        // low parts (beams, the turning bar, hubs) are jumped when we reach them
        const tA = run.time + Math.max(0, d / Math.max(v, 1)), low = X3[o.type].parts(o, tA).filter(q => !q.nocol && q.on !== false && q.y1 <= 1.25);
        if (!low.length) continue;
        if (o.type === 'spin') { const q = low[0]; const tt = run.time + .3, c = Math.cos(q.th + o.om * .3), sn = Math.sin(q.th + o.om * .3), dx = p.x, ds = p.s + v * .3 - o.sc, al = clamp(dx * c + ds * sn, -4.6, 4.6);
          if (Math.hypot(dx - al * c, ds - al * sn) < 1.4 && tt) inp.jump = true; continue; }
        const want = v * 0.36 - (o.s1 - o.s0) / 2;
        if (d <= want + 0.3 && d >= want - 2.4) inp.jump = true;
        continue;
      }
      const lo = Math.min(p.x, target) - 0.45, hi = Math.max(p.x, target) + 0.45;
      if (hi < o.x0 || lo > o.x1) continue;
      const vv = o.type === 'roller' ? v + o.rs : v;
      const want = vv * 0.36 - (o.s1 - o.s0) / 2;
      if (d <= want + 0.3 && d >= want - 2.4) inp.jump = true;
    }
  }
  if (inp.jump && p.jumpHeld) inp.jump = false;
  return inp;
}

/* ---------- rival runners: other characters racing you to the exit (they fear the giants too) ---------- */
const RIVAL_NAMES = ['سارا', 'آرش', 'نیلو', 'کیان', 'مهسا', 'بردیا', 'پرنیا', 'سامان', 'یاسمن', 'رادین'];
const RIVAL_COLS = ['#ff7a8a', '#7af7ff', '#ffd36e', '#9be05a', '#c59bff', '#ffa94a'];
Run3D.prototype.initRivals = function (n) {
  const r0 = srand(this.def.seed * 17 + (this.def.from || 0) * 3 + 1);
  const names = RIVAL_NAMES.slice().sort(() => r0() - .5);
  this.rivals = []; this.finishCount = 0;
  for (let i = 0; i < n; i++) this.rivals.push({ i, name: names[i], col: RIVAL_COLS[(i + Math.floor(r0() * 6)) % RIVAL_COLS.length], skill: [.8, .88, .94, .97][i % 4] - (this.d >= 3 ? 0 : .04), spd: .955 + r0() * .035, st0: -3 - i * 2.4, x0: [-2.6, 2.6, 0, -1.3][i % 4] });
  this.resetRivals(true);
};
Run3D.prototype.resetRivals = function (first) {
  for (const r of this.rivals || []) {
    if (first) Object.assign(r, { s: r.st0, x: r.x0, y: 0, vy: 0, vx: 0, ground: true, stum: 1, run: 0, inv: 0, falling: false, phase: r.i, sq: 1, buf: 0, coy: 0, jumpHeld: false, state: 'run', deadT: 0, ckS: 0, done: false, place: 0, hits: new Set() });
    else if (!r.done && r.s < this.gS + 6) { r.s = this.gS + 8 + r.i * 1.5; r.state = 'run'; r.falling = false; r.y = 0; r.vy = 0; r.ground = true; }
  }
};
Run3D.prototype.updateRivals = function (dt) {
  if (!this.rivals) return;
  for (const r of this.rivals) {
    if (r.done) { r.s += this.speed * .6 * dt; continue; }
    if (r.state !== 'run') {
      r.deadT -= dt; if (r.falling) { r.vy -= PG3 * dt; r.y += r.vy * dt; }
      if (r.deadT <= 0) { r.s = Math.max(this.gS + 4, Math.min(Math.max(r.ckS, this.gS + 10), this.p.s - 3 - r.i * 1.5)); r.x = 0; r.y = 0; r.vy = 0; r.vx = 0; r.falling = false; r.ground = true; r.stum = 1; r.run = .5; r.inv = 1; r.state = 'run'; }
      continue;
    }
    r.run = Math.min(1, r.run + dt * 1.8); r.stum = Math.min(1, r.stum + dt / 1.1); r.inv = Math.max(0, r.inv - dt);
    // rubber band: a rival far behind runs a little faster, one far ahead a little slower, so the race stays close
    const band = clamp((this.p.s - r.s) / 40, -1, 1) * .045;
    const v = this.speed * (r.spd + band) * r.run * r.stum; r.s += v * dt;
    const skill = r.skill, inp = botFor(this, r, v, i => { const h = Math.sin((i + 1) * 12.9898 + r.i * 78.233) * 43758.5453; return h - Math.floor(h) > skill; });
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    r.vx += clamp(dir * LATV * .95 - r.vx, -42 * dt, 42 * dt); r.x += r.vx * dt;
    const onRoad = this.roadAt(r.s) || this.roadAt(r.s + 0.3) || this.roadAt(r.s - 0.3);
    if (onRoad && !this.bridgeAt(r.s)) r.x = clamp(r.x, -4.55, 4.55);
    if (inp.jump && !r.jumpHeld) r.buf = .14; r.jumpHeld = inp.jump; r.buf -= dt;
    r.coy = r.ground ? .1 : r.coy - dt;
    if (r.buf > 0 && (r.ground || r.coy > 0) && !r.falling && r.y > -.3) { r.vy = JV3; r.ground = false; r.coy = 0; r.buf = 0; r.sq = .7; }
    const sup = this.supportAt(r.s, r.x);
    if (!r.ground || !sup) { r.vy -= PG3 * dt; r.y += r.vy * dt;
      if (r.y <= 0 && sup && !r.falling && r.y > -.45) { r.y = 0; r.vy = 0; r.ground = true; } else if (r.y <= 0) { r.ground = false; if (r.y < -.45) r.falling = true; } }
    r.sq = lerp(r.sq, 1, Math.min(1, dt * 10)); r.phase += v * dt * .9;
    if (r.falling && r.y < -3) { r.state = 'fall'; r.deadT = 1.2; if (this.onRival) this.onRival(r, 'fall'); continue; }
    // obstacles (each one can trip a rival once)
    if (r.inv <= 0) {
      const px0 = r.x - .35, px1 = r.x + .35, OB = this.obs;
      let a = 0, e = OB.length; while (a < e) { const m = (a + e) >> 1; if (OB[m].s1 < r.s - 3) a = m + 1; else e = m; }
      for (let i = Math.max(0, a - 8); i < OB.length && OB[i].s0 <= r.s + 1; i++) {
        const o = OB[i]; if (o.type === 'gap' || r.hits.has(i)) continue;
        let hit = false, heavy = false;
        if (X3[o.type]) { const q = x3Hit(o, this.time, r); if (q) { hit = true; heavy = !!q.heavy; } }
        else { let x0 = o.x0, x1 = o.x1; if (o.type === 'mover') { const c = Math.sin(this.time * o.om + o.ph) * o.amp; x0 = c - o.w / 2; x1 = c + o.w / 2; }
          if (o.type === 'roller') continue;
          if (px1 > x0 && px0 < x1 && r.s + .35 > o.s0 && r.s - .35 < o.s1 && r.y < o.y1 - .02) { hit = true; heavy = o.type === 'wall' || o.type === 'mover'; } }
        if (hit) { r.hits.add(i); r.stum = Math.max(.05, 1 - (heavy ? .85 : .62) * this.DD.pen); r.inv = .8; r.run = Math.max(r.run, .5); if (heavy) r.vx = (r.x > 0 ? 1 : -1) * 6; break; }
      }
    }
    for (const c of this.checkpoints) if (r.s >= c && r.ckS < c) r.ckS = c;
    if (r.s < this.gS + 2.5 && this.state === 'run') { r.state = 'caught'; r.deadT = 1.6; if (this.onRival) this.onRival(r, 'caught'); continue; }
    if (r.s >= this.len) { r.done = true; r.place = ++this.finishCount; if (this.onRival) this.onRival(r, 'done'); }
  }
};
// your place in the race right now (1 = first)
Run3D.prototype.rank = function () { if (!this.rivals) return 0; let n = 1; for (const r of this.rivals) if (r.done || (r.state === 'run' && r.s > this.p.s)) n++; return n; };

/* ---------- three.js meshes for the new obstacles and the rivals ---------- */
Run3D.prototype.buildX3 = function (keep, inst, unitBox) {
  this.x3list = this.obs.filter(o => X3[o.type]);
  const mk = (geo, mat, n) => { const m = inst(geo, mat, n); m.count = 0; return m; };
  this.x3box = mk(unitBox, keep(new THREE.MeshLambertMaterial({ color: 0xffffff, map: keep(this.stoneTex(0x9a90b8, true)) })), 320);
  const dg = keep(new THREE.CylinderGeometry(1, 1, .16, 26)); dg.rotateX(Math.PI / 2);
  this.x3disc = mk(dg, keep(new THREE.MeshLambertMaterial({ color: 0xc8cbe6, emissive: 0x302838 })), 40);
  const tg = keep(new THREE.ConeGeometry(.16, .36, 4)); this.x3teeth = mk(tg, keep(new THREE.MeshLambertMaterial({ color: 0xff5d8a })), 40 * 10);
  this.x3beam = mk(unitBox, keep(new THREE.MeshBasicMaterial({ color: 0xff3d71, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false })), 60);
  this.x3dim = mk(unitBox, keep(new THREE.MeshBasicMaterial({ color: 0xff3d71, transparent: true, opacity: .18, depthWrite: false })), 60);
  this.x3shadow = mk(unitBox, keep(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .35, depthWrite: false })), 60);
  // rivals: the same little hero in other colours, with a name tag
  this.rivalMesh = [];
  for (const r of this.rivals || []) {
    const h = buildHeroMesh(keep, { col: r.col }); h.g.scale.setScalar(.92); this.scene.add(h.g);
    const c = mkC(256, 64), g = c.getContext('2d'); g.font = 'bold 34px Vazirmatn, Tahoma, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(10,6,24,.6)'; g.beginPath(); g.roundRect ? g.roundRect(28, 6, 200, 52, 22) : g.rect(28, 6, 200, 52); g.fill(); g.fillStyle = r.col; g.fillText(r.name, 128, 34);
    const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(new THREE.CanvasTexture(c)), transparent: true, depthWrite: false }))); sp.scale.set(2.2, .55, 1); sp.position.y = 2.4; h.g.add(sp);
    this.rivalMesh.push(h);
  }
  return [this.x3box, this.x3disc, this.x3teeth, this.x3beam, this.x3dim, this.x3shadow];
};
Run3D.prototype.poseX3 = function (t) {
  const put = this.put, p = this.p, L = this.x3list; if (!L) return;
  let nb = 0, nd = 0, nt = 0, nbe = 0, ndi = 0, ns = 0; const col = this._x3c || (this._x3c = new THREE.Color());
  const B = this.x3box, CAP = 320;
  for (const o of L) {
    if (o.s1 < p.s - 10 || o.s0 > p.s + 150) continue;
    for (const q of X3[o.type].parts(o, t)) {
      if (q.sh === 'box' && nb < CAP) { put(B, nb, (q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, -(q.s0 + q.s1) / 2, q.x1 - q.x0, q.y1 - q.y0, q.s1 - q.s0); B.setColorAt(nb++, col.set(q.col || 0x8a80b0));
        if (o.type === 'pillar' && q.y0 > .5 && ns < 60) put(this.x3shadow, ns++, (q.x0 + q.x1) / 2, .03, -(q.s0 + q.s1) / 2, (q.x1 - q.x0) * (q.warn ? 1 : .6), .02, q.s1 - q.s0); }
      else if (q.sh === 'arm' && nb < CAP) { put(B, nb, q.cx, q.cy, -(q.s0 + q.s1) / 2, .22, q.len, .22, 0, 0, q.rz); B.setColorAt(nb++, col.set(0x4a4466)); }
      else if (q.sh === 'rbar' && nb < CAP) { put(B, nb, q.cx, (q.y0 + q.y1) / 2, -q.cs, q.len, q.y1 - q.y0, .35, 0, q.th, 0); B.setColorAt(nb++, col.set(0xffd36e)); }
      else if (q.sh === 'disc' && nd < 40) { const cz = -(q.s0 + q.s1) / 2; put(this.x3disc, nd++, q.cx, .85, cz, .85, .85, 1, 0, 0, q.rot);
        for (let k = 0; k < 10 && nt < 400; k++) { const a = q.rot + k / 10 * Math.PI * 2; put(this.x3teeth, nt++, q.cx + Math.cos(a) * .95, .85 + Math.sin(a) * .95, cz, 1, 1, 1, 0, 0, a - Math.PI / 2); } }
      else if (q.sh === 'beam') { const m = q.on ? this.x3beam : this.x3dim, i = q.on ? nbe++ : ndi++; if (i < 60) put(m, i, 0, (q.y0 + q.y1) / 2, -(q.s0 + q.s1) / 2, 10.2, q.on ? .14 : .06, q.on ? .14 : .06); }
    }
  }
  const fin = (m, n) => { m.count = n; m.instanceMatrix.needsUpdate = true; };
  fin(B, nb); if (nb && B.instanceColor) B.instanceColor.needsUpdate = true;
  fin(this.x3disc, nd); fin(this.x3teeth, nt); fin(this.x3beam, Math.min(60, nbe)); fin(this.x3dim, Math.min(60, ndi)); fin(this.x3shadow, ns);
  // rivals
  (this.rivalMesh || []).forEach((h, i) => {
    const r = this.rivals[i], g = h.g; g.visible = r.state === 'run' || r.state === 'fall' || (r.done && r.s < this.len + 6);
    if (!g.visible) return;
    g.position.set(r.x, r.y, -r.s); g.rotation.set(-.12, 0, clamp(-r.vx / LATV, -1, 1) * .25);
    if (r.inv > 0 && Math.floor(t * 16) % 2) g.visible = false;
    const ph = r.phase * 2.2; h.legs[0].position.z = Math.sin(ph) * .22; h.legs[1].position.z = -Math.sin(ph) * .22;
    if (r.done) g.scale.setScalar(Math.max(.01, .92 * (1 - (r.s - this.len) / 6)));
  });
};

/* ---------- the 2D chase views draw the same parts ---------- */
function drawX3Side(o, X, Yg, k, kh, c, t) {
  for (const q of X3[o.type].parts(o, t)) {
    if (q.sh === 'beam') { const x = X(o.s0); ctx.strokeStyle = q.on ? '#ff3d71' : 'rgba(255,61,113,.25)'; ctx.lineWidth = q.on ? k * .22 : k * .08; ctx.beginPath(); ctx.moveTo(x, Yg(-5) - .7 * kh); ctx.lineTo(x, Yg(5) - .7 * kh); ctx.stroke(); continue; }
    if (q.sh === 'rbar') { const c2 = Math.cos(q.th) * q.len / 2, s2 = Math.sin(q.th) * q.len / 2; ctx.strokeStyle = '#ffd36e'; ctx.lineWidth = k * .3; ctx.beginPath(); ctx.moveTo(X(q.cs - s2), Yg(q.cx - c2) - .7 * kh); ctx.lineTo(X(q.cs + s2), Yg(q.cx + c2) - .7 * kh); ctx.stroke(); continue; }
    if (q.sh === 'disc') { const x = X((q.s0 + q.s1) / 2), y = Yg(q.cx) - .85 * kh; ctx.fillStyle = '#c8cbe6'; ctx.beginPath(); ctx.arc(x, y, .85 * k, 0, 7); ctx.fill(); ctx.strokeStyle = '#ff5d8a'; ctx.lineWidth = k * .12; ctx.setLineDash([k * .2, k * .15]); ctx.stroke(); ctx.setLineDash([]); continue; }
    if (q.sh === 'arm') continue;
    const a = X(q.s0), b = Math.max(X(q.s1), a + k * .4), h0 = q.y0 * kh, h1 = q.y1 * kh, fc = '#' + (q.col || 0x8a80b0).toString(16).padStart(6, '0');
    ctx.fillStyle = mixHex(fc, '#ffffff', .25); ctx.beginPath(); ctx.moveTo(a, Yg(q.x0) - h1); ctx.lineTo(b, Yg(q.x0) - h1); ctx.lineTo(b, Yg(q.x1) - h1); ctx.lineTo(a, Yg(q.x1) - h1); ctx.fill();
    ctx.fillStyle = fc; ctx.fillRect(a, Yg(q.x1) - h1, b - a, h1 - h0);
    if (o.type === 'pillar' && q.y0 > .5) { ctx.fillStyle = q.warn ? 'rgba(255,40,80,.35)' : 'rgba(0,0,0,.25)'; ctx.fillRect(a, Yg(q.x0), b - a, Yg(q.x1) - Yg(q.x0)); }
  }
}
function drawX3Pseudo(o, proj, c, cam, t) {
  for (const q of X3[o.type].parts(o, t)) {
    if (q.sh === 'beam') { const L = proj(-5, .7, o.s0), R = proj(5, .7, o.s0); if (!L || !R) continue; ctx.strokeStyle = q.on ? '#ff3d71' : 'rgba(255,61,113,.25)'; ctx.lineWidth = Math.max(1, L[2] * (q.on ? .2 : .07)); ctx.beginPath(); ctx.moveTo(L[0], L[1]); ctx.lineTo(R[0], R[1]); ctx.stroke(); continue; }
    if (q.sh === 'rbar') { const c2 = Math.cos(q.th) * q.len / 2, s2 = Math.sin(q.th) * q.len / 2, A = proj(q.cx - c2, .7, q.cs - s2), B = proj(q.cx + c2, .7, q.cs + s2); if (!A || !B) continue; ctx.strokeStyle = '#ffd36e'; ctx.lineWidth = Math.max(2, (A[2] + B[2]) * .15); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); continue; }
    if (q.sh === 'disc') { const P = proj(q.cx, .85, (q.s0 + q.s1) / 2); if (!P) continue; ctx.fillStyle = '#c8cbe6'; ctx.beginPath(); ctx.arc(P[0], P[1], .85 * P[2], 0, 7); ctx.fill(); ctx.strokeStyle = '#ff5d8a'; ctx.lineWidth = P[2] * .12; ctx.stroke(); continue; }
    if (q.sh === 'arm') { const A = proj(0, q.cy + q.len / 2, q.s0), B = proj(q.cx * 2, q.cy - q.len / 2 + .02, q.s0); if (!A || !B) continue; ctx.strokeStyle = '#4a4466'; ctx.lineWidth = Math.max(1, A[2] * .2); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); continue; }
    const fc = '#' + (q.col || 0x8a80b0).toString(16).padStart(6, '0');
    const f00 = proj(q.x0, q.y0, q.s0), f10 = proj(q.x1, q.y0, q.s0), f11 = proj(q.x1, q.y1, q.s0), f01 = proj(q.x0, q.y1, q.s0);
    if (!f00 || !f10 || !f11 || !f01) continue;
    const b01 = proj(q.x0, q.y1, q.s1), b11 = proj(q.x1, q.y1, q.s1);
    if (cam.y > q.y1 && b01 && b11) { ctx.fillStyle = mixHex(fc, '#ffffff', .25); quad4(f01, f11, b11, b01); }
    ctx.fillStyle = fc; quad4(f00, f10, f11, f01);
  }
}
// the rivals in the 2D chase views (drawn like the hero, in their own colours, with their names)
let HERO_OVR = null;
function drawRival2D(r, x, y, sc, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc * r.sq);
  HERO_OVR = r.col; drawHero(t, 1, r.ground, 300, r.vy * 30, r.phase * 2.2, 1, false); HERO_OVR = null; ctx.restore();
  ctx.save(); ctx.font = `bold ${Math.max(10, Math.round(sc * 13))}px Vazirmatn, Tahoma, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(10,6,24,.55)';
  const w = ctx.measureText(r.name).width + 10 * sc; ctx.fillRect(x - w / 2, y - 62 * sc, w, 16 * sc); ctx.fillStyle = r.col; ctx.fillText(r.name, x, y - 50 * sc); ctx.restore();
}

/* ---------- true 3D: any platformer level can be played as a 3D run (mode "3d") ---------- */
// The run keeps the level's rooms, colours (biome -> 3D theme) and difficulty progress; harder levels get more
// obstacle types, more giants and a faster pace. Built once per level and cached.
const RUN3_CACHE = new Map();
function runDefOf(def) {
  if (def.kind === '3d') return def;
  let r = RUN3_CACHE.get(def); if (r) return r;
  const idx = LEVELS.indexOf(def), ri = REALM.indexOf(def), k = clamp(idx >= 0 ? idx / 41 : .85 + ri * .05, 0, 1);
  const rooms = def.rooms || (def.secs ? def.secs.length : 8), b = BIOMES[def.biome] || BIOMES.dusk;
  const types = ['bar', 'wall', 'gap'];
  [[.06, 'mover'], [.14, 'spikes'], [.22, 'slide'], [.3, 'roller'], [.36, 'beam'], [.45, 'saw'], [.55, 'spin'], [.65, 'hammer'], [.75, 'pillar']].forEach(([a, t]) => { if (k >= a) types.push(t); });
  r = { kind: '3d', name: def.name, from: idx, realm: !!def.realm, theme: def.realm ? 'abyss' : b.th3 || 'dusk', rooms,
    len: def.rest ? 1600 : Math.max(1500, rooms * 230), giants: def.rest ? 1 : 1 + Math.round(k * 14), speed: 14 + k * 5.5, gap: 24 - k * 4,
    gs: .962 + k * .016, types: def.rest ? [] : types, noObst: !!def.rest, dens: .6 + k * 1.25, zig: k > .12 ? .1 : 0, seed: 100 + (idx >= 0 ? idx : 60 + ri),
    rivals: idx >= 0 && RIVAL_LV.has(idx) ? 3 : 0 };
  RUN3_CACHE.set(def, r); return r;
}
