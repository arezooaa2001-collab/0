/* ============================ 3D CHASE MODE ============================ */
// Runner levels: the player auto-runs down a long track through a huge landscape while giants chase.
// Steer left/right, jump bars/gaps/spikes/logs, dodge walls. If the lead giant closes the gap you are caught.
const LV3 = o => Object.assign({ kind: '3d', types: [], dens: 1, zig: 0, gs: 0.97 }, o);
const ALL3 = ['bar', 'wall', 'gap', 'mover', 'spikes', 'roller'];
const D3 = [
  { spd: 0.9, gapM: 1.35, gsAdd: -0.04, pen: 0.6, dens: 0.7, ck: true },
  { spd: 1, gapM: 1, gsAdd: 0, pen: 1, dens: 1, ck: true },
  { spd: 1.05, gapM: 0.92, gsAdd: 0.004, pen: 1.15, dens: 1.1, ck: true },
  { spd: 1.1, gapM: 0.85, gsAdd: 0.007, pen: 1.3, dens: 1.2, ck: false },
  { spd: 1.15, gapM: 0.78, gsAdd: 0.01, pen: 1.45, dens: 1.3, ck: false },
];
const THEMES3 = {
  dusk:   { sky: [0x0b0826, 0x3a1c5e, 0xd0608a], fog: 0x4a2462, fogN: 45, fogF: 230, hemi: [0xa89cff, 0x2a1840, 1.05], sun: [0xffc9a0, 0.7], ground: 0x2a1f47, road: 0x4f4580, side: 0x2c2550, edge: 0x6ff3c4, tree: 'pine', treeC: 0x2f6b5b, trunk: 0x3b2a3a, rock: 0x4a3d6a, mtn: 0x2e2150, mist: 0x8a6fb0, giant: [0x6a5a8a, 0x8a6a7a], eye: 0xff5d8a, moon: 0xffd9b0, cloud: 0x9d86c9 },
  forest: { sky: [0x3f86d8, 0x9fd0ef, 0xf2e9c8], fog: 0xbfd9d6, fogN: 60, fogF: 290, hemi: [0xdff2ff, 0x4a6a3a, 1.0], sun: [0xfff1cf, 0.9], ground: 0x4f7d3c, road: 0x9a8a72, side: 0x6a5a48, edge: 0xffd36e, tree: 'pine', treeC: 0x2f6e3a, trunk: 0x5a3b26, rock: 0x7d7a70, mtn: 0x5f8a72, mist: 0xe8f4f0, giant: [0x6f7d5a, 0x7a6a55], eye: 0xffd36e, sunDisc: 0xfff6d8, cloud: 0xffffff },
  desert: { sky: [0x2f5fb8, 0xe0a46e, 0xffd9a0], fog: 0xe6b483, fogN: 60, fogF: 290, hemi: [0xffe3c0, 0x9a6a3a, 1.0], sun: [0xfff0d0, 1.0], ground: 0xd0924e, road: 0xa8744c, side: 0x7a5236, edge: 0xff7a45, tree: 'cactus', treeC: 0x5f8a3a, trunk: 0x5f8a3a, rock: 0xb07a48, mtn: 0xb8743e, mist: 0xf3d3a8, giant: [0x9a6a4a, 0x8a5a3a], eye: 0xff3d1f, sunDisc: 0xfff2d0, cloud: 0xfff3e0 },
  snow:   { sky: [0x4a6fa8, 0xb4cdea, 0xf2f6ff], fog: 0xd4e3f3, fogN: 50, fogF: 250, hemi: [0xffffff, 0x9ab0cc, 1.0], sun: [0xffffff, 0.8], ground: 0xeaf2fb, road: 0x9fb2cc, side: 0x6f84a6, edge: 0x8fd3ff, tree: 'pine', treeC: 0x2d5a55, trunk: 0x4a3a3a, rock: 0xb8c6d8, mtn: 0xdbe6f4, mist: 0xffffff, giant: [0x7a8fb0, 0x9aaccc], eye: 0x6ff3ff, sunDisc: 0xffffff, cloud: 0xffffff },
  lava:   { sky: [0x0c0406, 0x3a0c10, 0xb0361a], fog: 0x2e0c0c, fogN: 40, fogF: 210, hemi: [0xff9a70, 0x2a0a0a, 0.95], sun: [0xff7a40, 0.8], ground: 0x2a1416, road: 0x4a3438, side: 0x22181c, edge: 0xff7a2a, tree: 'crystal', treeC: 0xff5a2a, trunk: 0x1a0f0f, rock: 0x3a2224, mtn: 0x2a1414, mist: 0xff5a1a, mistGlow: true, giant: [0x3a2a2a, 0x4a2a22], eye: 0xffd36e, cloud: 0x5a2a2a },
  night:  { sky: [0x02030c, 0x0a1238, 0x2c4182], fog: 0x0e1636, fogN: 40, fogF: 210, hemi: [0x8f9fff, 0x101830, 0.95], sun: [0xc0d0ff, 0.6], ground: 0x18203e, road: 0x323c6a, side: 0x1c2448, edge: 0xb18cff, tree: 'crystal', treeC: 0x8a6fff, trunk: 0x1a1a26, rock: 0x26305a, mtn: 0x18214a, mist: 0x3a4a8a, giant: [0x3a4270, 0x2a3460], eye: 0x6ff3c4, moon: 0xdfe8ff, cloud: 0x3a4a7a },
  storm:  { sky: [0x141922, 0x343e52, 0x687388], fog: 0x485266, fogN: 40, fogF: 210, hemi: [0xb0bccc, 0x2a3038, 0.9], sun: [0xdde6ff, 0.5], ground: 0x2e3542, road: 0x535c70, side: 0x2c3240, edge: 0xffd36e, tree: 'dead', treeC: 0x2a2a2a, trunk: 0x2a2222, rock: 0x3a4250, mtn: 0x363e4e, mist: 0x8090a0, giant: [0x4a5060, 0x5a5a66], eye: 0xff3d71, cloud: 0x5a6478, storm: true },
  ash:    { sky: [0x1a1014, 0x5a3a3a, 0xc08060], fog: 0x6a4a44, fogN: 40, fogF: 220, hemi: [0xffc0a0, 0x2a1a1a, 0.95], sun: [0xffb080, 0.7], ground: 0x3a2c2c, road: 0x5a4a4c, side: 0x2a2024, edge: 0xffa040, tree: 'dead', treeC: 0x2a2020, trunk: 0x2a2020, rock: 0x4a3a3a, mtn: 0x3a2a2a, mist: 0xb08070, giant: [0x4a3a3a, 0x5a4a44], eye: 0xff7a2a, sunDisc: 0xffd0a0, cloud: 0x6a4a4a },
  doom:   { sky: [0x0a0208, 0x4a0a2a, 0xff4a2a], fog: 0x3a0a1e, fogN: 40, fogF: 230, hemi: [0xff9a9a, 0x200818, 1.0], sun: [0xff5a3a, 0.9], ground: 0x24101c, road: 0x4a2c4e, side: 0x22122a, edge: 0xff3d71, tree: 'crystal', treeC: 0xff3d71, trunk: 0x1a0a12, rock: 0x2a1222, mtn: 0x2a0f22, mist: 0xff4a2a, mistGlow: true, giant: [0x3a1a2a, 0x2a1a1a], eye: 0xff2a2a, moon: 0xff8a6a, cloud: 0x4a1a2a, islands: true, storm: true },
};
const PG3 = 28, JV3 = 10, LATV = 8.5, ROADW = 10, BRW = 3.6;
let R3renderer = null, R3fail = false;
const flatG = g => { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; };
function getRenderer3() {
  if (R3renderer || R3fail) return R3renderer;
  try {
    if (!window.THREE) throw new Error('no three');
    const cnv = document.getElementById('c3');
    R3renderer = new THREE.WebGLRenderer({ canvas: cnv, antialias: !!GFX.aa, powerPreference: 'high-performance' });
    R3renderer.setClearColor(0x000000, 1);
    R3renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    cnv.addEventListener('webglcontextlost', e => e.preventDefault());
    cnv.addEventListener('webglcontextrestored', () => { if (typeof app !== 'undefined') { resize3(); app.dirty = true; } });
  } catch (e) { R3fail = true; R3renderer = null; }
  return R3renderer;
}

// anti-aliasing is fixed when a WebGL context is created, so changing it needs a fresh canvas
function resetRenderer3() {
  if (!R3renderer) return;
  const old = document.getElementById('c3'), fresh = old.cloneNode(false);
  try { R3renderer.dispose(); R3renderer.forceContextLoss(); } catch (e) {}
  old.replaceWith(fresh); R3renderer = null; R3fail = false; getRenderer3(); resize3();
  const f = moodFilter(); fresh.style.filter = f && (GFX.filt || CFG.mood === 'custom') ? f : 'none';
}
const hexNum = h => parseInt(String(h).replace('#', ''), 16) || 0;
/* the player character as a three.js group (used by the 3D chase and the 3D platformer view) */
function buildHeroMesh(keep) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(keep(new THREE.SphereGeometry(0.5, 18, 14)), keep(new THREE.MeshLambertMaterial({ color: hexNum(colOf('player')) })));
  body.scale.set(1, 1.18, 0.95); body.position.y = 0.78; g.add(body);
  const scarfM = keep(new THREE.MeshLambertMaterial({ color: hexNum(colOf('scarf')) }));
  const scarf = new THREE.Mesh(keep(new THREE.TorusGeometry(0.47, 0.11, 6, 18)), scarfM);
  scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.55; g.add(scarf);
  const tailG = keep(new THREE.BoxGeometry(0.16, 0.1, 0.34));
  const tail = []; for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(tailG, scarfM); t.position.set(0.15, 0.55, 0.5 + i * 0.3); g.add(t); tail.push(t); }
  const eyeG = keep(new THREE.SphereGeometry(0.12, 10, 8)), pupG = keep(new THREE.SphereGeometry(0.07, 8, 6));
  const white = keep(new THREE.MeshBasicMaterial({ color: 0xffffff })), dark = keep(new THREE.MeshBasicMaterial({ color: 0x231536 }));
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(eyeG, white); e.position.set(sx * 0.18, 0.98, -0.4); g.add(e);
    const pp = new THREE.Mesh(pupG, dark); pp.position.set(sx * 0.18, 0.98, -0.5); g.add(pp);
  }
  const sprout = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 4)), keep(new THREE.MeshLambertMaterial({ color: hexNum(colOf('moss')) })));
  sprout.position.set(0, 1.48, 0); g.add(sprout);
  const leaf = new THREE.Mesh(keep(new THREE.SphereGeometry(0.12, 8, 6)), keep(new THREE.MeshLambertMaterial({ color: hexNum(mixHex(colOf('moss'), '#ffffff', .25)) })));
  leaf.scale.set(1.4, 0.5, 0.8); leaf.position.set(0.1, 1.64, 0); g.add(leaf);
  const legG = keep(new THREE.SphereGeometry(0.16, 8, 6)), legM = keep(new THREE.MeshLambertMaterial({ color: 0x3b2a52 }));
  const legs = [-1, 1].map(sx => { const l = new THREE.Mesh(legG, legM); l.scale.set(1, 0.8, 1.3); l.position.set(sx * 0.2, 0.14, 0); g.add(l); return l; });
  const glowMat = keep(new THREE.MeshBasicMaterial({ map: keep(Run3D.prototype.radialTex('rgba(255,226,176,0.5)', 'rgba(255,226,176,0)')), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const glow = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), glowMat); glow.scale.set(3.2, 3.2, 1); glow.position.y = 0.8; glow.visible = GFX.glow > 0; g.add(glow);
  g.traverse(o => { if (o.isMesh && o !== glow) o.castShadow = GFX.sh === 2; });
  return { g, body, tail, legs, glow };
}

class Run3D {
  constructor(def, diff, opt = {}) {
    this.def = def; this.d = diff; this.DD = D3[diff]; this.headless = !!opt.headless; this.noScene = this.headless || !!opt.noScene;
    this.gems = 0; this.freezeT = 0; this.curV = 0;
    this.speed = def.speed * this.DD.spd;
    this.len = def.len;
    this.gap0 = def.gap * this.DD.gapM;
    this.gs = def.noObst ? 1 + (this.gap0 - 7) / this.len : Math.min(0.995, def.gs + this.DD.gsAdd);
    this.generate();
    this.checkpoints = [];
    // insane: no checkpoints on short runs, a single one halfway on the very long ones (3800 m and up)
    { const step = [700, 700, 750, 1500, 2500][this.d], n = this.d === 4 ? Math.round(this.len / step) : Math.max(2, Math.round(this.len / step)); for (let i = 1; i < n; i++) this.checkpoints.push(Math.round(this.len * i / n)); }
    this.ckS = 0; this.firstIntro = true;
    this.time = 0; this.shake = 0; this.flash = 0;
    if (!this.noScene) this.buildScene();
    this.respawn(true);
  }

  /* ---------------- course generation (deterministic) ---------------- */
  generate() {
    const def = this.def, rng = srand(def.seed * 7919 + 17 + this.d * 101);
    const roads = [], bridges = [], obs = [], gaps = [];
    const dd = (def.dens || 1) * this.DD.dens;
    const v = this.speed, minSp = v * (dd > 1.6 ? 0.92 : dd > 1.25 ? 0.98 : 1.1) + 4, extra = 20 / dd;
    const types = def.types.length ? def.types.concat(dd >= 1 ? ['combo'] : []) : [];
    let cur = 70, roadStart = 0;
    const zigP = def.zig || 0;
    while (cur < this.len - 60) {
      if (zigP && rng() < zigP && cur < this.len - 170) {
        roads.push([roadStart, cur]);
        const pieces = 4 + Math.floor(rng() * (def.noObst ? 7 : 4));
        let cx = 0;
        for (let k = 0; k < pieces; k++) {
          const L = 11 + rng() * 5;
          if (k > 0) {
            let nx = cx + (rng() < .5 ? -1 : 1) * (1.2 + rng() * 1.0);
            if (Math.abs(nx) > 2.6) nx = cx - Math.sign(nx) * (1.2 + rng());
            cx = clamp(nx, -2.6, 2.6);
          }
          bridges.push({ s0: cur, s1: cur + L, cx, w: BRW });
          cur += L;
        }
        roadStart = cur; cur += minSp * 0.8; continue;
      }
      if (!types.length) { cur += 30; continue; }
      const t = types[Math.floor(rng() * types.length)];
      if (t === 'gap') {
        const gl = clamp(3.2 + rng() * 3.2 * (v / 16), 3, Math.min(6.5, v * 0.42));
        roads.push([roadStart, cur]); gaps.push({ s0: cur, s1: cur + gl });
        obs.push({ type: 'gap', s0: cur, s1: cur + gl });
        cur += gl; roadStart = cur; cur += minSp + rng() * extra; continue;
      }
      const s = cur;
      if (t === 'combo') {
        const fx = (rng() * 2 - 1) * 2.6, hole = 1.6;
        obs.push({ type: 'wall', x0: -5, x1: fx - hole, y1: 3.6, s0: s, s1: s + 1.4 });
        obs.push({ type: 'wall', x0: fx + hole, x1: 5, y1: 3.6, s0: s, s1: s + 1.4 });
        obs.push({ type: 'bar', x0: fx - hole, x1: fx + hole, y1: 1.0, s0: s + 0.5, s1: s + 0.95 });
      } else if (t === 'wall') {
        const fx = (rng() * 2 - 1) * 3.0, hole = 1.5;
        const both = rng() < 0.55;
        const pieces = [];
        if (fx - hole > -4.6) pieces.push([-5, fx - hole]);
        if (fx + hole < 4.6) pieces.push([fx + hole, 5]);
        const use = both ? pieces : [pieces[Math.floor(rng() * pieces.length)]];
        for (const [a, b] of use) if (b - a > 0.8) obs.push({ type: 'wall', x0: a, x1: b, y1: 3.6, s0: s, s1: s + 1.4 });
      } else if (t === 'bar') {
        if (rng() < 0.55) obs.push({ type: 'bar', x0: -5, x1: 5, y1: 1.0, s0: s, s1: s + 0.45 });
        else { const w = 4 + rng() * 2.5, c = (rng() * 2 - 1) * (5 - w / 2); obs.push({ type: 'bar', x0: c - w / 2, x1: c + w / 2, y1: 1.0, s0: s, s1: s + 0.45 }); }
      } else if (t === 'spikes') {
        const w = 3 + rng() * 3.5, c = (rng() * 2 - 1) * (5 - w / 2);
        obs.push({ type: 'spikes', x0: c - w / 2, x1: c + w / 2, y1: 0.6, s0: s, s1: s + 2 });
      } else if (t === 'mover') {
        obs.push({ type: 'mover', w: 3.2, amp: 3.4, om: 1.4 + rng() * 1.1, ph: rng() * 6.28, y1: 3.4, s0: s, s1: s + 1.2, x0: 0, x1: 0 });
      } else if (t === 'roller') {
        const w = 7 + rng() * 3, c = (rng() * 2 - 1) * (5 - w / 2);
        obs.push({ type: 'roller', x0: c - w / 2, x1: c + w / 2, y1: 1.1, s0: s + 12, s1: s + 13.1, base: s + 12, rs: 5 });
      }
      cur += minSp + rng() * extra;
    }
    roads.push([roadStart, this.len + 80]);
    this.roads = roads; this.bridges = bridges; this.obs = obs; this.gaps = gaps;
    // collectibles: gem lines in the free stretches between obstacle rows, gem arcs over gaps, a power-up every ~300 m
    const pr = srand(def.seed * 131 + 7 + this.d), picks = [];
    const rows = obs.map(o => [o.s0, o.type === 'roller' ? o.s1 - 12 : o.s1]).sort((a, b) => a[0] - b[0]);
    const kinds = ['shield', 'boost', 'freeze']; let lastPow = 120, ki = Math.floor(pr() * 3);
    let prevEnd = 40;
    for (const r of rows.concat([[this.len - 10, this.len - 10]])) {
      const a = prevEnd + 4, b = r[0] - 5;
      if (b - a > 6 && !this.bridgeAt(a) && !this.bridgeAt(b) && this.roadAt(a) && this.roadAt(b)) {
        const x = [-3, 0, 3][Math.floor(pr() * 3)];
        if (a - lastPow > 260 && pr() < .7) { picks.push({ k: kinds[ki++ % 3], x, y: 0.9, s: (a + b) / 2 }); lastPow = a; }
        else { const n = Math.min(5, Math.floor((b - a) / 2.2)); for (let i = 0; i < n; i++) picks.push({ k: 'gem', x, y: 0.7, s: a + i * 2.2 }); }
      }
      prevEnd = Math.max(prevEnd, r[1]);
    }
    for (const g of gaps) { const m = (g.s0 + g.s1) / 2; picks.push({ k: 'gem', x: 0, y: 1.3, s: g.s0 - 1.2 }, { k: 'gem', x: 0, y: 1.9, s: m }, { k: 'gem', x: 0, y: 1.3, s: g.s1 + 1.2 }); }
    this.picks = picks;
  }

  roadAt(s) { for (const r of this.roads) if (s >= r[0] && s <= r[1]) return true; return false; }
  bridgeAt(s) { for (const b of this.bridges) if (s >= b.s0 && s <= b.s1) return b; return null; }
  supportAt(s, x) {
    if (this.roadAt(s)) return true;
    const b = this.bridgeAt(s);
    return !!(b && Math.abs(x - b.cx) <= b.w / 2 + 0.25);
  }

  respawn(first) {
    const sc = first ? 0 : this.ckS;
    this.p = { s: sc, x: 0, y: 0, vy: 0, vx: 0, ground: true, buf: 0, jumpHeld: true, stum: 1, inv: 0, run: 0, falling: false, phase: 0, sq: 1 };
    this.gS = sc - this.gap0; this.gV = 0; this.surgeT = 4 + (this.def.seed % 3); this.surge = 0; this.surgeMode = 0;
    this.state = 'intro'; this.introT = this.firstIntro ? 2.4 : 0.9; this.introMax = this.introT; this.firstIntro = false;
    for (const o of this.obs) { o.hit = false; if (o.type === 'roller') { o.s0 = o.base; o.s1 = o.base + 1.1; o.act = false; o.rot = 0; } }
    for (const k of this.picks) if (k.s > sc) k.got = false;
    this.p.shield = false; this.p.boostT = 0; this.freezeT = 0;
    this.deadT = 0; this.winT = 0; this.cause = null; this.runT = 0; this.p.coy = 0;
  }

  /* ---------------- simulation ---------------- */
  update(dt, inp) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 18); this.flash = Math.max(0, this.flash - dt * 2);
    const p = this.p;
    if (this.state === 'intro') {
      this.introT -= dt;
      if (this.introT <= 0) { this.state = 'run'; if (this.onSay) this.onSay('فرار کن!'); this.sfx('roar'); this.shake = 6; }
      p.jumpHeld = inp.jump;
      this.animGiants(dt, 0.4);
      return;
    }
    if (this.state === 'dead') { this.deadT -= dt; this.animGiants(dt, 0.3); if (p.falling) { p.vy -= PG3 * dt; p.y += p.vy * dt; } if (this.deadT <= 0) this.respawn(false); return; }
    if (this.state === 'win') { this.winT += dt; p.s += this.speed * 0.6 * dt; this.animGiants(dt, 0.2); if (this.winT > 1.0 && !this.winFired) { this.winFired = true; if (this.onWin) this.onWin(); } return; }

    this.runT += dt;
    // forward speed with stumble recovery
    p.run = Math.min(1, p.run + dt * 1.8);
    p.stum = Math.min(1, p.stum + dt / 1.1);
    p.boostT = Math.max(0, (p.boostT || 0) - dt); this.freezeT = Math.max(0, this.freezeT - dt);
    const v = this.speed * p.run * p.stum * (p.boostT > 0 ? 1.4 : 1); this.curV = v;
    if (p.boostT > 0) p.inv = Math.max(p.inv, 0.12);
    p.s += v * dt;
    p.inv = Math.max(0, p.inv - dt);
    // lateral
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const tv = dir * LATV;
    p.vx += clamp(tv - p.vx, -45 * dt, 45 * dt);
    p.x += p.vx * dt;
    const onRoad = this.roadAt(p.s) || this.roadAt(p.s + 0.3) || this.roadAt(p.s - 0.3);
    if (onRoad && !this.bridgeAt(p.s)) { if (p.x < -4.55) { p.x = -4.55; p.vx = 0; } if (p.x > 4.55) { p.x = 4.55; p.vx = 0; } }
    // jump
    if (inp.jump && !p.jumpHeld) p.buf = 0.14;
    p.jumpHeld = inp.jump; p.buf -= dt;
    p.coy = p.ground ? 0.1 : p.coy - dt;
    if (p.buf > 0 && (p.ground || p.coy > 0) && !p.falling && p.y > -0.3) { p.vy = JV3; p.ground = false; p.coy = 0; p.buf = 0; p.sq = 0.7; this.sfx('jump'); }
    // vertical
    const sup = this.supportAt(p.s, p.x);
    if (!p.ground || !sup) {
      p.vy -= PG3 * dt; p.y += p.vy * dt;
      if (p.y <= 0 && sup && !p.falling && p.y > -0.45) { if (p.vy < -6) { this.sfx('land'); p.sq = 1.25; } p.y = 0; p.vy = 0; p.ground = true; }
      else if (p.y <= 0) { p.ground = false; if (p.y < -0.45) p.falling = true; }
    }
    p.sq = lerp(p.sq, 1, Math.min(1, dt * 10));
    p.phase += v * dt * 0.9;
    if (p.falling && p.y < -3) return this.die('fall');
    // obstacles
    const px0 = p.x - 0.35, px1 = p.x + 0.35, ps0 = p.s - 0.35, ps1 = p.s + 0.35;
    for (const o of this.obs) {
      if (o.type === 'gap') continue;
      if (o.s0 > p.s + 60 || o.s1 < p.s - 3) {
        if (o.type === 'roller' && !o.act && o.s0 - p.s < 48 && o.s0 > p.s) o.act = true;
        continue;
      }
      if (o.type === 'roller') { if (!o.act) o.act = true; o.s0 -= o.rs * dt; o.s1 -= o.rs * dt; o.rot = (o.rot || 0) + o.rs * dt / 0.55; }
      if (o.type === 'mover') { const c = Math.sin(this.time * o.om + o.ph) * o.amp; o.x0 = c - o.w / 2; o.x1 = c + o.w / 2; }
      if (o.hit || p.inv > 0) continue;
      if (px1 > o.x0 && px0 < o.x1 && ps1 > o.s0 && ps0 < o.s1 && p.y < o.y1 - 0.02) {
        o.hit = true; const heavy = o.type === 'wall' || o.type === 'mover';
        if (p.shield) { p.shield = false; p.inv = 0.6; this.shake = 5; this.sfx('orb'); if (this.onPick) this.onPick('shieldUsed'); continue; }
        p.stum = Math.max(0.05, 1 - (heavy ? 0.85 : 0.62) * this.DD.pen); p.inv = 0.8; p.run = Math.max(p.run, 0.5);
        this.shake = heavy ? 9 : 6; this.flash = 0.6; this.sfx(heavy ? 'thud' : 'crack');
        if (heavy) p.vx = (p.x > (o.x0 + o.x1) / 2 ? 1 : -1) * 6;
        if (this.onStumble) this.onStumble(heavy);
      }
    }
    // pickups
    for (const k of this.picks) {
      if (k.got || k.s < p.s - 1.2 || k.s > p.s + 1.2) continue;
      if (Math.abs(k.x - p.x) < 0.95 && Math.abs(k.y - (p.y + 0.75)) < 1.25) {
        k.got = true;
        if (k.k === 'gem') { this.gems++; this.sfx('gem'); }
        else if (k.k === 'shield') p.shield = true;
        else if (k.k === 'boost') { p.boostT = 2.6; p.stum = 1; }
        else if (k.k === 'freeze') { this.freezeT = 3.2; }
        if (this.onPick) this.onPick(k.k);
        if (!this.noScene) this.puff(k.x, k.s, 8, 0.6);
      }
    }
    // checkpoints
    for (const c of this.checkpoints) if (p.s >= c && this.ckS < c) { this.ckS = c; if (this.onSay) this.onSay('چک‌پوینت ✓'); this.sfx('spawn'); }
    // giants
    this.surgeT -= dt;
    if (this.surgeT <= 0) {
      if (this.surgeMode === 0) { this.surgeMode = 1; this.surgeT = 1.5; this.sfx('roar'); this.shake = Math.max(this.shake, 4); if (this.onRage) this.onRage(); }
      else if (this.surgeMode === 1) { this.surgeMode = -1; this.surgeT = 1.5; }
      else { this.surgeMode = 0; this.surgeT = 5 + ((this.time * 7.3) % 4); }
    }
    const surge = this.def.noObst ? 0 : this.surgeMode * 0.1;
    const gv = this.speed * this.gs * (1 + surge) * Math.min(1, this.runT / 0.7 + 0.3) * (this.freezeT > 0 ? 0.25 : 1);
    this.gS += gv * dt; this.gV = gv;
    this.animGiants(dt, gv / this.speed);
    const gap = p.s - this.gS;
    if (gap < 2.5) return this.die('caught');
    if (p.s >= this.len) { this.state = 'win'; this.winFired = false; this.sfx('win'); }
  }
  die(cause) {
    if (this.state === 'dead') return;
    this.state = 'dead'; this.cause = cause; this.deadT = cause === 'caught' ? 1.5 : 1.2; this.shake = 14; this.flash = 1;
    this.sfx(cause === 'caught' ? 'roar' : 'die'); if (cause === 'caught') this.sfx('thud');
    if (this.onDeath) this.onDeath(cause);
  }
  sfx(n) { if (!this.headless) Sound.play(n); }
  rebuildScene() { if (this.noScene) return; this.dispose(); this.buildScene(); }
  gapNow() { return this.p.s - this.gS; }

  /* ---------------- scene ---------------- */
  buildScene() {
    const TH = this.TH = THEMES3[this.def.theme] || THEMES3.dusk, def = this.def, rng = srand(def.seed * 31 + 5);
    const sc = this.scene = new THREE.Scene();
    const disp = this.disp = [];
    const keep = o => { disp.push(o); return o; };
    sc.fog = new THREE.Fog(TH.fog, TH.fogN, TH.fogF);
    this.cam = new THREE.PerspectiveCamera(64, 1.6, 0.1, 900);
    this.mcam = new THREE.PerspectiveCamera(58, 1.8, 0.1, 900);
    const hemi = new THREE.HemisphereLight(TH.hemi[0], TH.hemi[1], TH.hemi[2]); sc.add(hemi); this.hemi = hemi;
    const sun = this.sunL = new THREE.DirectionalLight(TH.sun[0], TH.sun[1]); sun.position.set(-0.6, 1, -0.4); sc.add(sun); sc.add(sun.target);
    this.sunDir = new THREE.Vector3(0.35, 0.32, -1).normalize();
    const SH = GFX.sh === 2; R3renderer && (R3renderer.shadowMap.enabled = SH);
    if (SH) { sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc2 = sun.shadow.camera; sc2.left = -26; sc2.right = 26; sc2.top = 30; sc2.bottom = -30; sc2.near = 1; sc2.far = 140; sun.shadow.bias = -0.0008; }
    const C = { road: colSet('road') ? colOf('road') : '#' + new THREE.Color(TH.road).getHexString(), edge: colSet('moss') ? hexNum(colOf('moss')) : TH.edge,
      obst: colSet('obstacle') ? colOf('obstacle') : '#ffd36e', hazard: hexNum(colSet('hazard') ? colOf('hazard') : '#d8dcf2'), giant: colSet('giant') ? [hexNum(colOf('giant')), hexNum(mixHex(colOf('giant'), '#000000', .2))] : TH.giant };
    this.C = C;
    // sky dome
    const skyMat = keep(new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color(TH.sky[0]) }, c1: { value: new THREE.Color(TH.sky[1]) }, c2: { value: new THREE.Color(TH.sky[2]) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.12 ? mix(c1, c0, smoothstep(0.12, 0.75, h)) : mix(c2, c1, smoothstep(-0.05, 0.12, h)); gl_FragColor = vec4(c, 1.0); }',
      side: THREE.BackSide, depthWrite: false, fog: false }));
    this.sky = new THREE.Mesh(keep(new THREE.SphereGeometry(700, 24, 14)), skyMat); this.sky.renderOrder = -10; sc.add(this.sky);
    // sun / moon disc + glow
    const glowTex = keep(this.radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)'));
    const discCol = TH.moon || TH.sunDisc;
    if (discCol) {
      const disc = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), keep(new THREE.MeshBasicMaterial({ map: glowTex, color: discCol, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })));
      disc.scale.set(260, 260, 1); this.disc = disc; sc.add(disc);
      const core = new THREE.Mesh(keep(new THREE.CircleGeometry(1, 32)), keep(new THREE.MeshBasicMaterial({ color: discCol, fog: false })));
      core.scale.set(26, 26, 1); this.discCore = core; sc.add(core);
    }
    // mist sea far below (visible under bridges)
    this.mist = new THREE.Mesh(keep(new THREE.PlaneGeometry(2400, 2400)), keep(new THREE.MeshBasicMaterial({ color: TH.mist, fog: !TH.mistGlow })));
    this.mist.rotation.x = -Math.PI / 2; this.mist.position.y = -7; sc.add(this.mist);

    // textures
    const stoneTex = keep(this.stoneTex(hexNum(C.road))); stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;
    // track (merged geometry with world-space UVs)
    const tb = this.geoBuilder();
    const eb = this.geoBuilder();
    for (const [a, b] of this.roads) {
      tb.box(-5, 5, -0.8, 0, a, b);
      eb.box(-5.1, -4.82, 0, 0.22, a, b); eb.box(4.82, 5.1, 0, 0.22, a, b);
    }
    for (const br of this.bridges) {
      tb.box(br.cx - br.w / 2, br.cx + br.w / 2, -0.8, 0, br.s0, br.s1);
      eb.box(br.cx - br.w / 2 - 0.05, br.cx - br.w / 2 + 0.12, 0, 0.06, br.s0, br.s1); eb.box(br.cx + br.w / 2 - 0.12, br.cx + br.w / 2 + 0.05, 0, 0.06, br.s0, br.s1);
    }
    for (const g of this.gaps) { eb.box(-5, 5, 0, 0.04, g.s0 - 0.35, g.s0); eb.box(-5, 5, 0, 0.04, g.s1, g.s1 + 0.35); }
    const trackMat = keep(new THREE.MeshLambertMaterial({ map: stoneTex }));
    const trackMesh = new THREE.Mesh(keep(tb.build()), trackMat); trackMesh.receiveShadow = SH; sc.add(trackMesh);
    sc.add(new THREE.Mesh(keep(eb.build()), keep(new THREE.MeshBasicMaterial({ color: C.edge }))));
    // ground slabs (absent under bridge zones => chasm with mist)
    const gb = this.geoBuilder(true);
    const zones = this.groundZones = [];
    { let z0 = -200; const brz = []; let cur = null;
      for (const b of this.bridges) { if (cur && Math.abs(b.s0 - cur[1]) < 0.01) cur[1] = b.s1; else { cur = [b.s0, b.s1]; brz.push(cur); } }
      this.chasms = brz;
      for (const c of brz) { zones.push([z0, c[0]]); z0 = c[1]; }
      zones.push([z0, this.len + 400]);
      for (const [a, b] of zones) { gb.box(-450, -5, -2.8, -0.8, a, b); gb.box(5, 450, -2.8, -0.8, a, b); gb.box(-5, 5, -2.8, -0.81, a, b); }
    }
    { const gm = new THREE.Mesh(keep(gb.build()), keep(new THREE.MeshLambertMaterial({ color: TH.ground }))); gm.receiveShadow = SH; sc.add(gm); }
    // pits for gaps
    const pb = this.geoBuilder();
    for (const g of this.gaps) pb.box(-5, 5, -9, -0.78, g.s0, g.s1);
    if (this.gaps.length) sc.add(new THREE.Mesh(keep(pb.build()), keep(new THREE.MeshBasicMaterial({ color: TH.mistGlow ? 0xff5a1a : 0x05030a }))));

    // obstacles
    const unitBox = keep(new THREE.BoxGeometry(1, 1, 1));
    const lam = c => keep(new THREE.MeshLambertMaterial({ color: c }));
    const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); m.count = n; m.frustumCulled = false; sc.add(m); return m; };
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sv = new THREE.Vector3(), E = new THREE.Euler();
    const put = (mesh, i, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { E.set(rx, ry, rz); Q.setFromEuler(E); V.set(x, y, z); Sv.set(sx, sy, sz); M.compose(V, Q, Sv); mesh.setMatrixAt(i, M); };
    this.put = put;
    const walls = this.obs.filter(o => o.type === 'wall'), bars = this.obs.filter(o => o.type === 'bar'), spk = this.obs.filter(o => o.type === 'spikes');
    const wallTex = keep(this.stoneTex(TH.side, true));
    const wm = inst(unitBox, keep(new THREE.MeshLambertMaterial({ map: wallTex })), walls.length);
    const wcap = inst(unitBox, keep(new THREE.MeshBasicMaterial({ color: 0xff5d8a })), walls.length);
    walls.forEach((o, i) => { const w = o.x1 - o.x0; put(wm, i, (o.x0 + o.x1) / 2, o.y1 / 2, -(o.s0 + o.s1) / 2, w, o.y1, o.s1 - o.s0); put(wcap, i, (o.x0 + o.x1) / 2, o.y1 + 0.06, -(o.s0 + o.s1) / 2, w + 0.04, 0.12, o.s1 - o.s0 + 0.04); });
    const stripe = keep(this.stripeTex(C.obst));
    const bm = inst(unitBox, keep(new THREE.MeshLambertMaterial({ map: stripe })), bars.length);
    const bpost = inst(unitBox, lam(0x2a2540), bars.length * 2);
    bars.forEach((o, i) => { const w = o.x1 - o.x0, z = -(o.s0 + o.s1) / 2; put(bm, i, (o.x0 + o.x1) / 2, 0.78, z, w, 0.36, 0.42); put(bpost, i * 2, o.x0 + 0.2, 0.3, z, 0.22, 0.6, 0.22); put(bpost, i * 2 + 1, o.x1 - 0.2, 0.3, z, 0.22, 0.6, 0.22); });
    let nCones = 0; for (const o of spk) nCones += Math.floor((o.x1 - o.x0) / 0.55) * 3;
    const cone = keep(new THREE.ConeGeometry(0.24, 0.7, 6));
    const sm = inst(cone, lam(C.hazard), nCones), splate = inst(unitBox, lam(0x2a2540), spk.length);
    { let k = 0; spk.forEach((o, i) => { put(splate, i, (o.x0 + o.x1) / 2, 0.04, -(o.s0 + o.s1) / 2, o.x1 - o.x0, 0.08, o.s1 - o.s0);
      const n = Math.floor((o.x1 - o.x0) / 0.55); for (let a = 0; a < n; a++) for (let b = 0; b < 3; b++) put(sm, k++, o.x0 + 0.28 + a * 0.55, 0.38, -(o.s0 + 0.35 + b * 0.65), 1, 1, 1); }); }
    this.movers = this.obs.filter(o => o.type === 'mover');
    this.moverMesh = inst(unitBox, keep(new THREE.MeshLambertMaterial({ map: wallTex, color: 0xffd0e0 })), this.movers.length);
    this.moverCap = inst(unitBox, keep(new THREE.MeshBasicMaterial({ color: 0xffd36e })), this.movers.length);
    this.rollers = this.obs.filter(o => o.type === 'roller');
    const logGeo = keep(new THREE.CylinderGeometry(0.55, 0.55, 1, 10)); logGeo.rotateZ(Math.PI / 2);
    this.rollerMesh = inst(logGeo, keep(new THREE.MeshLambertMaterial({ map: keep(this.logTex()) })), this.rollers.length);
    [wm, wcap, bm, bpost, sm, splate].forEach(m => m.instanceMatrix.needsUpdate = true);

    // scenery
    this.buildScenery(rng, inst, put, lam, unitBox, keep);
    // portal at the finish + checkpoint arches
    const tor = keep(new THREE.TorusGeometry(4.2, 0.45, 10, 32));
    const portal = new THREE.Mesh(tor, keep(new THREE.MeshBasicMaterial({ color: 0xffd36e }))); portal.position.set(0, 4.2, -this.len); sc.add(portal);
    const swirl = new THREE.Mesh(keep(new THREE.CircleGeometry(3.9, 40)), keep(new THREE.MeshBasicMaterial({ map: keep(this.swirlTex()), transparent: true, fog: false })));
    swirl.position.set(0, 4.2, -this.len - 0.05); sc.add(swirl); this.swirl = swirl;
    const pg = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), keep(new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffb347, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
    pg.scale.set(30, 30, 1); pg.position.set(0, 4.2, -this.len - 0.2); sc.add(pg);
    if (this.checkpoints.length) {
      const ck = inst(keep(new THREE.TorusGeometry(5.4, 0.22, 6, 24, Math.PI)), keep(new THREE.MeshBasicMaterial({ color: C.edge })), this.checkpoints.length);
      this.checkpoints.forEach((c, i) => put(ck, i, 0, 0, -c, 1, 1, 1)); ck.instanceMatrix.needsUpdate = true;
    }
    // giants + player + blob shadows + dust
    this.buildGiants(keep, rng);
    this.buildPlayer(keep);
    // collectibles
    { const gems = this.picks.filter(k => k.k === 'gem'), pows = this.picks.filter(k => k.k !== 'gem');
      this.gemMesh = inst(keep(new THREE.OctahedronGeometry(0.34, 0)), keep(new THREE.MeshBasicMaterial({ color: 0x7af7ff })), gems.length); this.gemList = gems;
      this.powMesh = inst(keep(flatG(new THREE.IcosahedronGeometry(0.5, 0))), keep(new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x333333 })), pows.length); this.powList = pows;
      const cc = new THREE.Color(); pows.forEach((k, i) => this.powMesh.setColorAt(i, cc.set({ shield: 0x4aa8ff, boost: 0xffd36e, freeze: 0x9ef9ff }[k.k])));
      if (pows.length) this.powMesh.instanceColor.needsUpdate = true;
      this.powRing = inst(keep(new THREE.TorusGeometry(0.75, 0.05, 6, 20)), keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7 })), pows.length); }
    if (SH) sc.traverse(o => { if (o.isInstancedMesh || (o.isMesh && o.geometry && o.geometry.type === 'BufferGeometry')) { if (!o.material.transparent && !(o.material.isMeshBasicMaterial)) { o.castShadow = true; o.receiveShadow = true; } } });
    const shTex = keep(this.radialTex('rgba(0,0,0,0.55)', 'rgba(0,0,0,0)'));
    this.pShadow = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.3, 1.3)), keep(new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }))); this.pShadow.visible = GFX.sh === 1;
    this.pShadow.rotation.x = -Math.PI / 2; sc.add(this.pShadow);
    this.gShadow = inst(keep(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), keep(new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false })), this.gN);
    const dustN = 220; this.dust = { n: dustN, i: 0, life: new Float32Array(dustN), vel: new Float32Array(dustN * 3) };
    const dg = keep(new THREE.BufferGeometry()); dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dustN * 3).fill(-9999), 3));
    this.dustPts = new THREE.Points(dg, keep(new THREE.PointsMaterial({ color: TH.storm ? 0xbfc6d6 : 0xd8c8ff, size: 0.7, map: glowTex, transparent: true, depthWrite: false, opacity: 0.75 })));
    this.dustPts.frustumCulled = false; this.dustPts.visible = !!GFX.dust; sc.add(this.dustPts);
    this.gShadow.visible = GFX.sh === 1;
    this.lightningT = 3;
  }

  buildScenery(rng, inst, put, lam, unitBox, keep) {
    const TH = this.TH, len = this.len, chasm = s => this.chasms.some(c => s > c[0] - 6 && s < c[1] + 6);
    // trees
    const pts = [];
    const scn = Math.max(.25, GFX.scn);
    for (let s = -60; s < len + 300; s += 3.2 / scn) for (const side of [-1, 1]) {
      if (rng() < 0.35 || chasm(s)) continue;
      const far = rng() < 0.7 ? 9 + rng() * 26 : 35 + rng() * 120;
      pts.push([side * far, s + rng() * 3, 0.7 + rng() * 1.1]);
    }
    let crown, trunk;
    if (TH.tree === 'pine') { crown = new THREE.ConeGeometry(2.2, 6, 7); crown.translate(0, 5.5, 0); trunk = new THREE.CylinderGeometry(0.35, 0.45, 2.6, 6); trunk.translate(0, 1.3, 0); }
    else if (TH.tree === 'cactus') { crown = new THREE.CylinderGeometry(0.55, 0.6, 5.5, 8); crown.translate(0, 2.75, 0); trunk = new THREE.CylinderGeometry(0.35, 0.35, 2.2, 6); trunk.rotateZ(Math.PI / 2); trunk.translate(0.9, 2.6, 0); }
    else if (TH.tree === 'crystal') { crown = new THREE.OctahedronGeometry(1.6, 0); crown.scale(0.8, 2.6, 0.8); crown.translate(0, 4.2, 0); trunk = new THREE.CylinderGeometry(0.3, 0.6, 1.4, 5); trunk.translate(0, 0.7, 0); }
    else { crown = new THREE.ConeGeometry(0.25, 6, 4); crown.translate(0, 3, 0); trunk = new THREE.CylinderGeometry(0.12, 0.18, 3, 4); trunk.rotateZ(0.8); trunk.translate(0.8, 3.4, 0); }
    keep(crown); keep(trunk);
    const crownMat = TH.tree === 'crystal' ? keep(new THREE.MeshBasicMaterial({ color: TH.treeC })) : lam(TH.treeC);
    const cm = inst(crown, crownMat, pts.length), tm = inst(trunk, lam(TH.trunk), pts.length);
    pts.forEach((q, i) => { const r = q[2]; put(cm, i, q[0], -0.8, -q[1], r, r * (0.8 + (i % 5) * 0.1), r, 0, i, 0); put(tm, i, q[0], -0.8, -q[1], r, r, r, 0, i, 0); });
    cm.instanceMatrix.needsUpdate = tm.instanceMatrix.needsUpdate = true;
    if (TH.snowy) { const capG = keep(new THREE.ConeGeometry(1.1, 2.2, 7)); capG.translate(0, 7.6, 0); const caps = inst(capG, lam(0xffffff), pts.length); pts.forEach((q, i) => { const r = q[2]; put(caps, i, q[0], -0.8, -q[1], r, r * (0.8 + (i % 5) * 0.1), r, 0, i, 0); }); caps.instanceMatrix.needsUpdate = true; }
    // rocks
    const rocks = []; for (let s = 0; s < len + 200; s += 9 / scn) if (!chasm(s) && rng() < .7) rocks.push([(rng() < .5 ? -1 : 1) * (7 + rng() * 40), s, 0.6 + rng() * 2.4]);
    const rg = keep(new THREE.DodecahedronGeometry(1, 0)); const rm = inst(rg, lam(TH.rock), rocks.length);
    rocks.forEach((q, i) => put(rm, i, q[0], -0.8 + q[2] * 0.3, -q[1], q[2] * 1.3, q[2], q[2], i, i * 2, 0)); rm.instanceMatrix.needsUpdate = true;
    // mountains
    const mts = []; for (let s = -200; s < len + 500; s += 38 / Math.max(.6, scn)) for (const side of [-1, 1]) mts.push([side * (150 + rng() * 220), s + rng() * 30, 50 + rng() * 140, 40 + rng() * 60]);
    const mg = keep(flatG(new THREE.ConeGeometry(1, 1, 6))); mg.translate(0, 0.5, 0);
    const mm = inst(mg, keep(new THREE.MeshLambertMaterial({ color: TH.mtn })), mts.length);
    mts.forEach((q, i) => put(mm, i, q[0], -3, -q[1], q[3], q[2], q[3], 0, i, 0)); mm.instanceMatrix.needsUpdate = true;
    if (TH.snowy || TH.tree === 'pine') { const peak = keep(flatG(new THREE.ConeGeometry(1, 1, 6))); peak.translate(0, 0.5, 0); const pk = inst(peak, keep(new THREE.MeshLambertMaterial({ color: TH.snowy ? 0xffffff : 0xf0f4ff })), mts.length);
      mts.forEach((q, i) => put(pk, i, q[0], -3 + q[2] * 0.72, -q[1], q[3] * 0.28, q[2] * 0.28, q[3] * 0.28, 0, i, 0)); pk.instanceMatrix.needsUpdate = true; }
    // ruined pillars beside the track + stone arches over it
    const pil = []; for (let s = 30; s < len; s += 22 / scn) if (!chasm(s) && rng() < .5) pil.push([(rng() < .5 ? -1 : 1) * (7 + rng() * 6), s, 4 + rng() * 9]);
    const arches = []; for (let s = 120; s < len - 40; s += 150 + rng() * 60) if (!chasm(s)) arches.push(s);
    const pm = inst(unitBox, keep(new THREE.MeshLambertMaterial({ map: keep(this.stoneTex(TH.side, true)) })), pil.length + arches.length * 3);
    pil.forEach((q, i) => put(pm, i, q[0], -0.8 + q[2] / 2, -q[1], 1.6, q[2], 1.6, 0, i * 0.3, (i % 3 - 1) * 0.06));
    arches.forEach((s, k) => { const i = pil.length + k * 3; put(pm, i, -6.4, 4.5, -s, 1.8, 10.6, 1.8); put(pm, i + 1, 6.4, 4.5, -s, 1.8, 10.6, 1.8); put(pm, i + 2, 0, 10.2, -s, 15, 1.6, 2.2); });
    pm.instanceMatrix.needsUpdate = true;
    // clouds / floating islands
    const cl = []; if (GFX.clouds > 0) for (let s = -100; s < len + 400; s += 45 / GFX.clouds) cl.push([(rng() * 2 - 1) * 260, 55 + rng() * 70, s + rng() * 40, 12 + rng() * 22]);
    const cg = keep(new THREE.IcosahedronGeometry(1, 0));
    const cmsh = inst(cg, keep(new THREE.MeshLambertMaterial({ color: TH.cloud, transparent: true, opacity: 0.8 })), cl.length);
    cl.forEach((q, i) => put(cmsh, i, q[0], q[1], -q[2], q[3] * 1.8, q[3] * 0.45, q[3], 0, i, 0)); cmsh.instanceMatrix.needsUpdate = true;
    if (TH.islands) {
      const isl = []; for (let s = 0; s < len + 300; s += 70) isl.push([(rng() < .5 ? -1 : 1) * (25 + rng() * 130), 18 + rng() * 45, s + rng() * 50, 5 + rng() * 10]);
      const ig = keep(flatG(new THREE.ConeGeometry(1, 1.6, 7))); ig.rotateX(Math.PI); ig.translate(0, -0.8, 0);
      const im = inst(ig, keep(new THREE.MeshLambertMaterial({ color: TH.rock })), isl.length);
      const itop = inst(keep(new THREE.CylinderGeometry(1, 1, 0.25, 7)), keep(new THREE.MeshBasicMaterial({ color: TH.treeC })), isl.length);
      isl.forEach((q, i) => { put(im, i, q[0], q[1], -q[2], q[3], q[3], q[3], 0, i, 0); put(itop, i, q[0], q[1] + 0.1, -q[2], q[3] * 0.95, 1, q[3] * 0.95, 0, i, 0); });
      im.instanceMatrix.needsUpdate = itop.instanceMatrix.needsUpdate = true; this.islands = { im, itop, isl };
    }
  }

  buildGiants(keep, rng) {
    const TH = this.TH, n = this.gN = this.def.giants, sc = this.scene;
    const ico = keep(flatG(new THREE.IcosahedronGeometry(1, 1)));
    const limb = (w, l, fw, fl, fd) => { const b = this.geoBuilder(); b.box(-w / 2, w / 2, -l, 0, -w / 2, w / 2, true); b.box(-fw / 2, fw / 2, -l - fl * 0.5, -l + fl * 0.5, -fd * 0.65, fd * 0.35, true); return keep(b.build()); };
    const legG = limb(1.7, 6, 2.1, 0.9, 2.8), armG = limb(1.3, 6.2, 1.8, 1.8, 1.8);
    const stone = keep(new THREE.MeshLambertMaterial({ color: 0xffffff }));
    const mk = (g, m, c) => { const x = new THREE.InstancedMesh(g, m, c); x.frustumCulled = false; sc.add(x); return x; };
    this.gm = { torso: mk(ico, stone, n), head: mk(ico, stone, n), leg: mk(legG, stone, n * 2), arm: mk(armG, stone, n * 2),
      eye: mk(keep(new THREE.SphereGeometry(1, 8, 6)), keep(new THREE.MeshBasicMaterial({ color: TH.eye })), n * 2),
      horn: mk(keep(flatG(new THREE.ConeGeometry(0.5, 2.2, 5))), keep(new THREE.MeshLambertMaterial({ color: 0xe8dcc8 })), n * 2) };
    const c = new THREE.Color();
    // template rig
    const root = new THREE.Object3D(), hips = new THREE.Object3D(), torso = new THREE.Object3D(), head = new THREE.Object3D();
    const eyeL = new THREE.Object3D(), eyeR = new THREE.Object3D(), hornL = new THREE.Object3D(), hornR = new THREE.Object3D();
    const armL = new THREE.Object3D(), armR = new THREE.Object3D(), legL = new THREE.Object3D(), legR = new THREE.Object3D();
    root.add(hips); hips.add(torso, head, armL, armR, legL, legR); head.add(eyeL, eyeR, hornL, hornR);
    torso.position.set(0, 3.2, 0); torso.scale.set(3.3, 3.8, 2.4);
    head.position.set(0, 7.6, -0.6); head.scale.setScalar(1.7);
    eyeL.position.set(-0.42, 0.12, -0.85); eyeR.position.set(0.42, 0.12, -0.85); eyeL.scale.setScalar(0.25); eyeR.scale.setScalar(0.25);
    hornL.position.set(-0.75, 0.75, 0); hornR.position.set(0.75, 0.75, 0); hornL.rotation.z = 0.5; hornR.rotation.z = -0.5;
    armL.position.set(-3.6, 6.2, 0); armR.position.set(3.6, 6.2, 0);
    legL.position.set(-1.4, 0.4, 0); legR.position.set(1.4, 0.4, 0);
    this.rig = { root, hips, torso, head, eyeL, eyeR, hornL, hornR, armL, armR, legL, legR };
    // formation behind the lead giant
    this.gOff = [];
    for (let i = 0; i < n; i++) {
      if (i === 0) this.gOff.push({ x: 0, z: 0, k: 1.05, ph: 0 });
      else {
        const ring = Math.ceil(i / 6), side = i % 2 ? -1 : 1;
        this.gOff.push({ x: side * (9 + rng() * 10 + ring * 4.5), z: 4 + ring * 5 + rng() * 8, k: 0.8 + rng() * 0.45, ph: rng() * 6.28 });
      }
      c.set(this.C.giant[i % 2]).offsetHSL((rng() - .5) * .05, 0, (rng() - .5) * .12);
      for (const key of ['torso', 'head']) this.gm[key].setColorAt(i, c);
      for (const key of ['leg', 'arm']) { this.gm[key].setColorAt(i * 2, c); this.gm[key].setColorAt(i * 2 + 1, c); }
    }
    for (const key of ['torso', 'head', 'leg', 'arm']) this.gm[key].instanceColor.needsUpdate = true;
    this.gPhase = 0; this.stepSide = 1;
  }

  animGiants(dt, speedK) {
    this.gPhase += dt * (2.2 + speedK * 1.6);
    if (this.headless) return;
    // footstep thumps for the lead giant
    const ph = Math.sin(this.gPhase);
    if (Math.sign(ph) !== this.stepSide) {
      this.stepSide = Math.sign(ph) || 1;
      const gap = this.gapNow(), k = clamp(1 - gap / 45, 0.08, 1);
      if (this.state !== 'win') { this.shake = Math.max(this.shake, 5 * k); Sound.stomp(k); }
      this.puff(this.gm ? 0 : 0, this.gS, 18, 2.2);
    }
  }

  puff(x, s, n, spread) {
    if (this.headless || !this.dust) return;
    const D = this.dust, pos = this.dustPts.geometry.attributes.position.array;
    for (let k = 0; k < n; k++) {
      const i = D.i; D.i = (D.i + 1) % D.n;
      pos[i * 3] = x + (Math.random() - .5) * spread * 2; pos[i * 3 + 1] = Math.random() * 0.5; pos[i * 3 + 2] = -s + (Math.random() - .5) * spread;
      D.vel[i * 3] = (Math.random() - .5) * 6; D.vel[i * 3 + 1] = 2 + Math.random() * 4; D.vel[i * 3 + 2] = (Math.random() - .5) * 6;
      D.life[i] = 0.6 + Math.random() * 0.6;
    }
  }

  buildPlayer(keep) {
    const h = buildHeroMesh(keep); this.pl = h.g; this.plBody = h.body; this.tail = h.tail; this.legs = h.legs; this.pglow = h.glow; this.scene.add(h.g);
  }
  posePicks(t) {
    const put = this.put, p = this.p;
    this.gemList.forEach((k, i) => { const vis = !k.got && k.s > p.s - 3 && k.s < p.s + 160; put(this.gemMesh, i, k.x, k.y + Math.sin(t * 3 + k.s) * .12, -k.s, vis ? 1 : 0, vis ? 1.3 : 0, vis ? 1 : 0, 0, t * 2 + k.s, 0); });
    this.powList.forEach((k, i) => { const vis = !k.got && k.s > p.s - 3 && k.s < p.s + 160, sc = vis ? 1 + Math.sin(t * 5) * .08 : 0;
      put(this.powMesh, i, k.x, k.y + Math.sin(t * 2.5 + k.s) * .15, -k.s, sc, sc, sc, t, t * 1.4, 0); put(this.powRing, i, k.x, k.y, -k.s, sc, sc, sc, Math.PI / 2, 0, t * 2); });
    if (this.gemList.length) this.gemMesh.instanceMatrix.needsUpdate = true;
    if (this.powList.length) { this.powMesh.instanceMatrix.needsUpdate = true; this.powRing.instanceMatrix.needsUpdate = true; }
  }

  /* ---------------- per-frame render ---------------- */
  render(dt) {
    const r = getRenderer3(); if (!r) return;
    const p = this.p, t = this.time, TH = this.TH, cam = this.cam;
    // player model
    const pl = this.pl; pl.visible = !(this.state === 'dead' && this.cause === 'caught');
    pl.position.set(p.x, p.y, -p.s);
    const runA = this.state === 'run' ? 1 : 0.2, lean = clamp(-p.vx / LATV, -1, 1);
    pl.rotation.z = lean * 0.25; pl.rotation.x = -0.12 * runA;
    this.plBody.scale.set(1 / Math.sqrt(p.sq), 1.18 * p.sq, 0.95 / Math.sqrt(p.sq));
    this.legs[0].position.z = Math.sin(p.phase * 2.2) * 0.22 * runA; this.legs[1].position.z = -Math.sin(p.phase * 2.2) * 0.22 * runA;
    this.legs[0].position.y = 0.14 + Math.max(0, Math.cos(p.phase * 2.2)) * 0.12 * runA; this.legs[1].position.y = 0.14 + Math.max(0, -Math.cos(p.phase * 2.2)) * 0.12 * runA;
    this.tail.forEach((m, i) => { m.position.x = 0.15 + Math.sin(t * 14 - i) * 0.08 * (i + 1); m.position.y = 0.55 + Math.sin(t * 11 - i * 1.3) * 0.05 * (i + 1); });
    if (this.state === 'win') { const k = Math.max(0.01, 1 - this.winT * 1.2); pl.scale.setScalar(k); pl.rotation.y += dt * 10; } else { pl.scale.setScalar(1); pl.rotation.y = 0; }
    if (p.inv > 0) pl.visible = pl.visible && (Math.floor(t * 20) % 2 === 0);
    this.pShadow.position.set(p.x, 0.02, -p.s); this.pShadow.visible = this.supportAt(p.s, p.x) && !p.falling;
    const shs = 1 / (1 + Math.max(0, p.y) * 0.4); this.pShadow.scale.set(shs, shs, 1);
    if (p.ground && this.state === 'run' && Math.random() < 0.35) this.puff(p.x, p.s + 0.3, 1, 0.3);
    // giants
    this.poseGiants();
    // movers / rollers
    const put = this.put;
    this.movers.forEach((o, i) => { const z = -(o.s0 + o.s1) / 2, c = (o.x0 + o.x1) / 2; put(this.moverMesh, i, c, o.y1 / 2, z, o.w, o.y1, 1.2); put(this.moverCap, i, c, o.y1 + 0.06, z, o.w + 0.04, 0.12, 1.24); });
    if (this.movers.length) { this.moverMesh.instanceMatrix.needsUpdate = true; this.moverCap.instanceMatrix.needsUpdate = true; }
    this.rollers.forEach((o, i) => put(this.rollerMesh, i, (o.x0 + o.x1) / 2, 0.55, -(o.s0 + o.s1) / 2, o.x1 - o.x0, 1, 1, o.rot || 0, 0, 0));
    if (this.rollers.length) this.rollerMesh.instanceMatrix.needsUpdate = true;
    this.swirl.rotation.z = -t * 2;
    // dust
    { const D = this.dust, pos = this.dustPts.geometry.attributes.position.array;
      for (let i = 0; i < D.n; i++) { if (D.life[i] <= 0) continue; D.life[i] -= dt; if (D.life[i] <= 0) { pos[i * 3 + 1] = -9999; continue; }
        pos[i * 3] += D.vel[i * 3] * dt; pos[i * 3 + 1] += D.vel[i * 3 + 1] * dt; pos[i * 3 + 2] += D.vel[i * 3 + 2] * dt; D.vel[i * 3 + 1] -= 6 * dt; }
      this.dustPts.geometry.attributes.position.needsUpdate = true; }
    // storm lightning
    if (TH.storm) { this.lightningT -= dt; if (this.lightningT <= 0) { this.lightningT = 2.5 + Math.random() * 4; this.light = 1; Sound.play('thunder'); } this.light = Math.max(0, (this.light || 0) - dt * 3); this.hemi.intensity = TH.hemi[2] + this.light * 1.6; }
    // camera
    const W3 = innerWidth, H3 = innerHeight, aspect = W3 / H3;
    const sh = this.shake * 0.03, shx = (Math.random() - .5) * sh, shy = (Math.random() - .5) * sh;
    if (this.state === 'intro') {
      // cinematic: start in front of the player looking back at the giants, then swing behind
      const k = 1 - this.introT / this.introMax, e = k * k * (3 - 2 * k);
      const fx = lerp(3.5, p.x * 0.55, e), fy = lerp(2.2, 3.4, e), fz = lerp(-p.s - 9, -p.s + 6.8, e);
      cam.position.set(fx + shx, fy + shy, fz);
      const lz = lerp(-p.s + 14, -p.s - 9, e), ly = lerp(5.5, 1.1, e);
      cam.lookAt(p.x * 0.7, ly, lz);
    } else {
      const sp = this.speed * p.run * p.stum, cz = -p.s + 6.6 + (this.state === 'win' ? this.winT * 6 : 0);
      cam.position.set(p.x * 0.55 + shx, 3.3 + Math.max(0, p.y) * 0.35 + shy, cz);
      cam.lookAt(p.x * 0.75, 1.0 + Math.max(0, p.y) * 0.3, -p.s - 9);
      cam.fov = lerp(cam.fov, (aspect < 1 ? 78 : 62) + sp * 0.45, Math.min(1, dt * 3));
    }
    cam.aspect = aspect; cam.updateProjectionMatrix();
    this.sky.position.copy(cam.position);
    if (this.disc) { const d = this.sunDir; this.disc.position.copy(cam.position).addScaledVector(d, 600); this.disc.lookAt(cam.position); this.discCore.position.copy(cam.position).addScaledVector(d, 594); this.discCore.lookAt(cam.position); }
    if (this.sunL && this.sunL.castShadow) { this.sunL.target.position.set(p.x * 0.5, 0, -p.s - 14); this.sunL.position.set(p.x * 0.5 - 24, 40, -p.s - 14 - 16); this.sunL.target.updateMatrixWorld(); }
    this.posePicks(t);
    this.mist.position.x = cam.position.x; this.mist.position.z = cam.position.z;
    // main pass
    r.setScissorTest(false); r.setViewport(0, 0, W3, H3);
    r.render(this.scene, cam);
    // rear-view mirror: shows the giants behind you
    const m = GFX.mir ? this.mirrorRect() : null;
    const mEl = document.getElementById('mirror'), showM = this.state !== 'intro';
    if (mEl.classList.contains('off') === showM) mEl.classList.toggle('off', !showM);
    if (m && showM) {
      const mc = this.mcam; mc.aspect = m.w / m.h; mc.updateProjectionMatrix();
      mc.position.set(p.x * 0.5, 3.0, -p.s - 2.5); mc.lookAt(p.x * 0.3, 5.5, -p.s + 30);
      this.pl.visible = false;
      r.setScissorTest(true); r.setScissor(m.x, H3 - m.y - m.h, m.w, m.h); r.setViewport(m.x, H3 - m.y - m.h, m.w, m.h);
      r.render(this.scene, mc);
      r.setScissorTest(false); r.setViewport(0, 0, W3, H3);
    }
  }
  mirrorRect() {
    if (mirrorCache) return mirrorCache;
    const el = document.getElementById('mirror'); if (!el) return null;
    const b = el.getBoundingClientRect(); if (!b.width) return null;
    return (mirrorCache = { x: Math.round(b.left + 2), y: Math.round(b.top + 2), w: Math.round(b.width - 4), h: Math.round(b.height - 4) });
  }

  poseGiants() {
    const n = Math.min(this.gN, GFX.giants), rig = this.rig, gm = this.gm, p = this.p, gap = this.gapNow();
    gm.torso.count = gm.head.count = n; gm.leg.count = gm.arm.count = gm.eye.count = gm.horn.count = n * 2; this.gShadow.count = n;
    const reach = clamp(1 - (gap - 3) / 9, 0, 1);
    for (let i = 0; i < n; i++) {
      const o = this.gOff[i], s = this.gS - o.z, ph = this.gPhase + o.ph;
      const inChasm = this.chasms.some(c => s > c[0] && s < c[1]);
      o.y = lerp(o.y ?? -0.8, inChasm ? -6 : -0.8, 0.08);
      const gx = i === 0 ? lerp(o.lx ?? 0, p.x * 0.6, 0.05) : o.x; if (i === 0) o.lx = gx;
      rig.root.position.set(gx, o.y, -s); rig.root.scale.setScalar(o.k); rig.root.rotation.set(0, Math.sin(ph) * 0.08, 0);
      rig.hips.position.y = 6.2 + Math.abs(Math.cos(ph)) * 0.5;
      rig.legL.rotation.x = Math.sin(ph) * 0.55; rig.legR.rotation.x = -Math.sin(ph) * 0.55;
      const rk = i === 0 ? reach : 0;
      rig.armL.rotation.x = lerp(-Math.sin(ph) * 0.5, -1.45 + Math.sin(ph * 2) * 0.12, rk); rig.armR.rotation.x = lerp(Math.sin(ph) * 0.5, -1.45 - Math.sin(ph * 2) * 0.12, rk);
      rig.armL.rotation.z = -0.15; rig.armR.rotation.z = 0.15;
      rig.head.rotation.x = 0.15 + (this.state === 'intro' || this.surgeMode === 1 ? -0.35 : 0);
      rig.root.updateMatrixWorld(true);
      gm.torso.setMatrixAt(i, rig.torso.matrixWorld); gm.head.setMatrixAt(i, rig.head.matrixWorld);
      gm.leg.setMatrixAt(i * 2, rig.legL.matrixWorld); gm.leg.setMatrixAt(i * 2 + 1, rig.legR.matrixWorld);
      gm.arm.setMatrixAt(i * 2, rig.armL.matrixWorld); gm.arm.setMatrixAt(i * 2 + 1, rig.armR.matrixWorld);
      gm.eye.setMatrixAt(i * 2, rig.eyeL.matrixWorld); gm.eye.setMatrixAt(i * 2 + 1, rig.eyeR.matrixWorld);
      gm.horn.setMatrixAt(i * 2, rig.hornL.matrixWorld); gm.horn.setMatrixAt(i * 2 + 1, rig.hornR.matrixWorld);
      this.put(this.gShadow, i, gx, inChasm ? -50 : -0.75, -s + 1, 9 * o.k, 1, 7 * o.k);
    }
    for (const k in gm) gm[k].instanceMatrix.needsUpdate = true;
    this.gShadow.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    if (!this.disp) return;
    for (const o of this.disp) { try { o.dispose(); } catch (e) {} }
    this.scene.traverse(o => { if (o.isInstancedMesh && o.dispose) try { o.dispose(); } catch (e) {} });
    this.disp = null;
  }

  /* ---------------- helpers ---------------- */
  geoBuilder(noUV) {
    const P = [], N = [], U = [];
    const face = (a, b, c, d, n, ua, ub) => {
      P.push(...a, ...b, ...c, ...a, ...c, ...d);
      for (let i = 0; i < 6; i++) N.push(...n);
      U.push(...ua[0], ...ua[1], ...ua[2], ...ua[0], ...ua[2], ...ua[3]);
    };
    return {
      // x0..x1, y0..y1, s0..s1 (s is distance; z = -s). local=true means plain z coords.
      box(x0, x1, y0, y1, s0, s1, local) {
        const z0 = local ? s1 : -s0, z1 = local ? s0 : -s1; // z0 > z1
        const q = 0.5, uv = (a, b) => [a * q, b * q];
        face([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], [uv(x0, -z0), uv(x1, -z0), uv(x1, -z1), uv(x0, -z1)]);
        face([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], [0, -1, 0], [uv(x0, 0), uv(x1, 0), uv(x1, 1), uv(x0, 1)]);
        face([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, 1], [uv(x0, y0), uv(x1, y0), uv(x1, y1), uv(x0, y1)]);
        face([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [0, 0, -1], [uv(x1, y0), uv(x0, y0), uv(x0, y1), uv(x1, y1)]);
        face([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [-1, 0, 0], [uv(-z1, y0), uv(-z0, y0), uv(-z0, y1), uv(-z1, y1)]);
        face([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], [uv(-z0, y0), uv(-z1, y0), uv(-z1, y1), uv(-z0, y1)]);
      },
      build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        if (!noUV) g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
        g.computeBoundingSphere(); return g;
      }
    };
  }
  canvasTex(w, h, draw) { const c = mkC(w, h), g = c.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(c); return t; }
  radialTex(c0, c1) { return this.canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }); }
  stoneTex(col, big) {
    const base = new THREE.Color(col);
    const t = this.canvasTex(128, 128, (g) => {
      const R = srand(big ? 9 : 4);
      g.fillStyle = '#' + base.clone().multiplyScalar(0.55).getHexString(); g.fillRect(0, 0, 128, 128);
      for (let row = 0; row < 4; row++) for (let col2 = -1; col2 < 3; col2++) {
        const x = col2 * 64 + (row % 2 ? 32 : 0), y = row * 32;
        g.fillStyle = '#' + base.clone().multiplyScalar(0.85 + R() * 0.3).getHexString();
        g.fillRect(x + 2, y + 2, 60, 28);
        g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + 4, y + 3, 56, 3);
        g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x + 4, y + 25, 56, 4);
        for (let k = 0; k < 8; k++) { g.fillStyle = R() < .5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.12)'; g.fillRect(x + 4 + R() * 54, y + 5 + R() * 20, 3, 2); }
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  }
  stripeTex(col = '#ffd36e') { const t = this.canvasTex(128, 32, (g) => { g.fillStyle = col; g.fillRect(0, 0, 128, 32); g.fillStyle = '#2a1d3a'; for (let x = -32; x < 160; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 32); g.fill(); } }); return t; }
  logTex() { const t = this.canvasTex(64, 64, (g) => { g.fillStyle = '#7a4a2a'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#5a321a'; g.lineWidth = 3; for (let y = 4; y < 64; y += 9) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y + 3); g.stroke(); } }); return t; }
  swirlTex() { return this.canvasTex(256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 4, 128, 128, 128); gr.addColorStop(0, '#fffbe8'); gr.addColorStop(.3, '#ffd36e'); gr.addColorStop(.7, '#ff7a45'); gr.addColorStop(1, 'rgba(122,31,79,0.9)'); g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 128, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,245,210,.6)'; g.lineWidth = 6; for (let i = 0; i < 4; i++) { g.beginPath(); for (let a = 0; a < 10; a += .2) { const r = a * 11, an = a + i * 1.57; g.lineTo(128 + Math.cos(an) * r, 128 + Math.sin(an) * r); } g.stroke(); } }); }
}

/* Autopilot used to prove each 3D course is beatable (headless). */
function bot3(run) {
  const p = run.p, v = run.curV || run.speed * p.run * p.stum, inp = { left: false, right: false, jump: false };
  if (run.state !== 'run') return inp;
  // lateral target: free x for walls/movers/spikes in the next ~1.6 s, or the bridge centre
  const look = Math.max(18, v * 1.7);
  let target = p.x;
  const cb = run.bridgeAt(p.s);
  let ahead = null; for (let k = 0.5; k <= v * 0.9; k += 0.5) { const b = run.bridgeAt(p.s + k); if (b) { ahead = b; break; } }
  if (cb) {
    const nb = run.bridgeAt(cb.s1 + 0.05);
    target = (nb && nb !== cb && cb.s1 - p.s < v * 0.2) ? clamp(nb.cx, cb.cx - cb.w / 2 + 0.35, cb.cx + cb.w / 2 - 0.35) : cb.cx;
  } else if (ahead) target = ahead.cx;
  else {
    let best = null, bestScore = 1e9;
    for (let x = -4.4; x <= 4.4; x += 0.2) {
      let score = Math.abs(x - p.x) * 0.15;
      for (const o of run.obs) {
        if (o.type === 'gap' || o.hit || o.s1 < p.s - 0.4 || o.s0 > p.s + look) continue;
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
    for (const o of run.obs) {
      const d = o.s0 - p.s;
      if (d < -0.5 || d > 12) continue;
      if (o.type === 'gap') { if (d < 1.2 && d > -0.3) inp.jump = true; continue; }
      if (o.type === 'wall' || o.type === 'mover' || o.hit) continue;
      const lo = Math.min(p.x, target) - 0.45, hi = Math.max(p.x, target) + 0.45;
      if (hi < o.x0 || lo > o.x1) continue;
      const vv = o.type === 'roller' ? v + o.rs : v;
      const want = vv * 0.36 - (o.s1 - o.s0) / 2;
      if (d <= want + 0.3 && d >= want - 2.4) inp.jump = true;
    }
  }
  if (inp.jump && p.jumpHeld) { inp.jump = false; }
  return inp;
}

