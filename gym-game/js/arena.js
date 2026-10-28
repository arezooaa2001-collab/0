'use strict';
/* Wrestling arena: mat, crowd, referee, match rules and throw animations */

const TECHS = {
  leg: { id: 'leg', name: 'زیرگیری', pts: 2, zone: 0.3, icon: '🦵', stars: 1 },
  lift: { id: 'lift', name: 'کنده', pts: 4, zone: 0.2, icon: '🏋️', stars: 2, pin: true },
  salto: { id: 'salto', name: 'فن سالتو', pts: 5, zone: 0.13, icon: '🌀', stars: 3, pin: true },
};
const MATCH_TIME = 60;
const TECH_GAP = 10;

const $ = (id) => document.getElementById(id);

function keyLerp(keys, t) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t <= b[0]) {
      const u = (t - a[0]) / (b[0] - a[0]);
      return a.slice(1).map((v, j) => lerp(v, b[j + 1], u));
    }
  }
  return keys[keys.length - 1].slice(1);
}

/* ---------- wrestling poses (local frame: facing +Z) ---------- */

function wStance(p, lean, ph) {
  p.hpLX = -0.55 - 0.08 * Math.sin(ph);
  p.hpRX = -0.25 + 0.08 * Math.sin(ph);
  p.knL = 0.95; p.knR = 0.75;
  p.hpLZ = 0.16; p.hpRZ = -0.16;
  p.spX = 0.55 + lean * 0.22;
  p.spY = 0.06 * Math.sin(ph * 0.7);
  p.nkX = -0.5 - lean * 0.1;
  p.shLX = p.shRX = -1.25 - lean * 0.15;
  p.shLZ = 0.05; p.shRZ = -0.05;
  p.shLY = -0.25; p.shRY = 0.25;
  p.elL = p.elR = -0.55;
  plant(p, false);
  p.autoAnkle = true;
}
function wTop(p, ph = 0) {
  p.bx = 0.55 + 0.04 * Math.sin(ph * 3);
  p.hpLX = -1.25; p.hpRX = -1.0;
  p.knL = 2.3; p.knR = 2.1;
  p.spX = 0.55; p.nkX = -0.3;
  p.shLX = p.shRX = -1.3;
  p.elL = p.elR = -0.35;
  p.shLZ = 0.25; p.shRZ = -0.25;
  plant(p, false);
}
function wLying(p, ph = 0, struggle = 0) {
  p.bx = -Math.PI / 2;
  p.y = 0.17 - HIP_H;
  p.bz = 0.18 * struggle * Math.sin(ph * 5);
  p.hpLX = -0.5 - 0.5 * struggle * Math.max(0, Math.sin(ph * 6));
  p.hpRX = -0.3 - 0.5 * struggle * Math.max(0, -Math.sin(ph * 6));
  p.knL = 0.9; p.knR = 0.6;
  p.shLZ = 1.2; p.shRZ = -1.2;
  p.elL = p.elR = -0.4;
  p.nkX = 0.3;
}
function wKneel(p) {
  p.hpLX = p.hpRX = 0.05;
  p.knL = p.knR = 1.6;
  p.y = 0.53 - HIP_H;
  p.spX = 0.35; p.nkX = 0.6;
  p.shLX = p.shRX = 0.15;
  p.elL = p.elR = -0.2;
  p.autoAnkle = false;
  p.anL = p.anR = 0.7;
}
function wShoot(p) {
  p.hpLX = -1.45; p.knL = 2.1;
  p.hpRX = 0.35; p.knR = 1.5;
  p.spX = 0.95; p.nkX = -0.7;
  p.shLX = p.shRX = -1.15;
  p.elL = p.elR = -0.5;
  p.shLZ = 0.15; p.shRZ = -0.15;
  plant(p, false);
}

/* ---------- technique animations ----------
 * A attacks toward +f, D starts at f = 1 facing A (yaw π).
 * Each sets {f, yaw, pose} on A and D.
 */
function throwAnim(A, D, t, ph, cfg) {
  const s1 = smooth(seg(t, 0, cfg.lock));
  const lift = smooth(seg(t, cfg.lock, cfg.peak));
  const over = smooth(seg(t, cfg.peak - 0.03, cfg.impact));
  const turn = smooth(seg(t, cfg.impact + 0.05, cfg.impact + 0.25));
  const pa = makePose();
  wStance(pa, 0, ph);
  const lock = makePose();
  lock.hpLX = lock.hpRX = -0.5; lock.knL = lock.knR = 0.8;
  lock.spX = 0.25; lock.nkX = -0.2;
  lock.shLX = lock.shRX = -1.35; lock.elL = lock.elR = -1.5;
  lock.shLY = -0.5; lock.shRY = 0.5;
  plant(lock, false);
  mixInto(pa, lock, s1);
  const arch = makePose();
  copyPose(arch, lock);
  arch.bx = -cfg.arch; arch.spX = -0.55;
  arch.shLX = arch.shRX = -2.5;
  arch.hpLX = arch.hpRX = -0.25; arch.knL = arch.knR = 1.0;
  plant(arch, false);
  mixInto(pa, arch, Math.max(lift * 0.35, over));
  const top = makePose();
  wTop(top, ph);
  mixInto(pa, top, turn);
  A.f = 0.42 * s1 - 0.55 * turn;
  A.yaw = Math.PI * turn;
  A.pose = pa;

  const pd = makePose();
  wStance(pd, 0, ph);
  const y0 = pd.y;
  const flail = makePose();
  flail.hpLX = -0.3; flail.hpRX = -0.6; flail.knL = 0.6; flail.knR = 0.9;
  flail.spX = 0.35; flail.shLZ = 1.1; flail.shRZ = -1.1; flail.elL = flail.elR = -0.6;
  mixInto(pd, flail, smooth(seg(t, cfg.lock * 0.6, cfg.lock + 0.12)));
  const lying = makePose();
  wLying(lying, ph);
  mixInto(pd, lying, smooth(seg(t, cfg.impact, cfg.impact + 0.12)));
  const keys = cfg.keys.map((k) => k.slice());
  keys[0][2] = y0;
  keys[1][2] = y0 + keys[1][2];
  const [f, y, bx] = keyLerp(keys, t);
  pd.bx = bx; pd.y = y; pd.z = 0; pd.by = 0; pd.bz = 0;
  D.f = f;
  D.yaw = Math.PI;
  D.pose = pd;
}

const TECH_ANIMS = {
  leg: {
    dur: 2.1, impact: 0.66,
    fn(A, D, t, ph) {
      const s1 = smooth(seg(t, 0, 0.22));
      const s2 = smooth(seg(t, 0.2, 0.42));
      const s3 = smooth(seg(t, 0.42, 0.68));
      const pa = makePose();
      wStance(pa, 0, ph);
      const sh = makePose();
      wShoot(sh);
      mixInto(pa, sh, s1);
      const top = makePose();
      wTop(top, ph);
      mixInto(pa, top, s3);
      A.f = 0.45 * s1 + 0.45 * s3;
      A.yaw = 0;
      A.pose = pa;
      const pd = makePose();
      wStance(pd, 0, ph);
      const grab = makePose();
      grab.hpLX = -1.25; grab.knL = 0.45; grab.knR = 0.25;
      grab.spX = 0.1; grab.nkX = 0.2;
      grab.shLX = grab.shRX = -0.3; grab.shLZ = 1.3; grab.shRZ = -1.3;
      grab.elL = grab.elR = -0.3;
      plant(grab, false);
      mixInto(pd, grab, s2);
      const fall = makePose();
      wLying(fall, ph);
      fall.hpLX = -1.0;
      mixInto(pd, fall, s3);
      pd.y = lerp(pd.y, fall.y, s3 * s3);
      D.f = 1.0 + 0.25 * s2 + 0.6 * s3;
      D.yaw = Math.PI;
      D.pose = pd;
    },
  },
  lift: {
    dur: 2.5, impact: 0.7,
    fn(A, D, t, ph) {
      throwAnim(A, D, t, ph, {
        lock: 0.18, peak: 0.45, impact: 0.7, arch: 0.8,
        keys: [[0, 1.0, 0, 0], [0.18, 0.62, 0.0, 0.3], [0.45, 0.42, 0.78, 1.5], [0.6, -0.1, 0.9, 2.9], [0.7, -0.95, -0.77, 4.71], [1, -0.95, -0.77, 4.71]],
      });
    },
  },
  salto: {
    dur: 2.7, impact: 0.7, slow: [0.3, 0.6],
    fn(A, D, t, ph) {
      throwAnim(A, D, t, ph, {
        lock: 0.16, peak: 0.4, impact: 0.7, arch: 1.15,
        keys: [[0, 1.0, 0, 0], [0.16, 0.6, 0.05, 0.3], [0.38, 0.35, 1.5, 1.7], [0.56, -0.35, 1.25, 3.4], [0.7, -1.2, -0.77, 4.71], [1, -1.2, -0.77, 4.71]],
      });
    },
  },
  sprawl: {
    dur: 1.5, impact: 0.42,
    fn(A, D, t, ph) {
      const s1 = smooth(seg(t, 0, 0.25));
      const s2 = smooth(seg(t, 0.25, 0.45));
      const pa = makePose();
      wStance(pa, 0, ph);
      const sh = makePose();
      wShoot(sh);
      mixInto(pa, sh, s1);
      const flat = makePose();
      flat.bx = 1.0; flat.hpLX = flat.hpRX = -1.4; flat.knL = flat.knR = 2.3;
      flat.spX = 0.3; flat.nkX = 0.2; flat.shLX = flat.shRX = -1.6; flat.elL = flat.elR = -0.8;
      plant(flat, false);
      mixInto(pa, flat, s2);
      A.f = 0.35 * s1;
      A.yaw = 0;
      A.pose = pa;
      const pd = makePose();
      wStance(pd, 0, ph);
      const spr = makePose();
      spr.bx = 1.15; spr.hpLX = spr.hpRX = 0.25; spr.knL = spr.knR = 0.15;
      spr.hpLZ = 0.25; spr.hpRZ = -0.25; spr.spX = 0.2; spr.nkX = -0.4;
      spr.shLX = spr.shRX = -1.6; spr.elL = spr.elR = -0.3;
      spr.autoAnkle = false; spr.anL = spr.anR = 0.9;
      plant(spr, false);
      mixInto(pd, spr, s2);
      pd.autoAnkle = s2 < 0.5;
      D.f = 1.0 + 0.35 * s2;
      D.yaw = Math.PI;
      D.pose = pd;
    },
  },
};

/* ---------- Arena ---------- */

class Arena {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#05070f');
    this.scene.fog = new THREE.Fog('#05070f', 26, 60);
    this.matTop = 0.45;
    this.clock = 0;
    this.shake = 0;
    this.excite = 0;
    this.buildHall();
    this.stage = new THREE.Group();
    this.stage.position.y = this.matTop;
    this.scene.add(this.stage);
    this.fx = new Particles(this.scene, 500, 0.2);
    this.ref = this.makeRef();
    this.camState = { orbit: 0.4, dist: 11, height: 5, tx: 0 };
    this.p = null;
    this.o = null;
    this.state = 'off';
    this.bindUi();
  }

  buildHall() {
    const sc = this.scene;
    sc.add(new THREE.HemisphereLight(0x8fa4ff, 0x1a1020, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.55);
    key.position.set(4, 14, 9);
    sc.add(key);
    for (const [x, z, c] of [[-6, 6, 0xfff1d6], [6, 6, 0xfff1d6], [0, -7, 0xcfe0ff]]) {
      const s = new THREE.SpotLight(c, 0.9, 40, 0.42, 0.6, 1);
      s.position.set(x, 13, z);
      s.target.position.set(0, 0, 0);
      sc.add(s, s.target);
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: '#0b0e18', roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    sc.add(floor);

    const m = new Batch();
    const glow = new Batch();
    const H = this.matTop;
    m.box(12.6, H, 12.6, 0, H / 2, 0, '#173a8c');
    glow.box(12.7, 0.06, 12.7, 0, H - 0.04, 0, '#ffc23d');
    // stands on three sides
    const crowdSpots = [];
    const sides = [
      { ax: 'z', sign: -1, len: 30 },
      { ax: 'x', sign: -1, len: 24 },
      { ax: 'x', sign: 1, len: 24 },
    ];
    for (const s of sides) {
      for (let r = 0; r < 6; r++) {
        const d = 10 + r * 1.3;
        const y = 0.4 + r * 0.65;
        if (s.ax === 'z') m.box(s.len, y, 1.3, 0, y / 2, s.sign * d, r % 2 ? '#232a3d' : '#1c2233');
        else m.box(1.3, y, s.len, s.sign * d, y / 2, -2, r % 2 ? '#232a3d' : '#1c2233');
        const n = Math.floor(s.len / 0.75);
        for (let i = 0; i < n; i++) {
          if (Math.random() < 0.12) continue;
          const u = -s.len / 2 + 0.4 + i * 0.75 + rand(-0.08, 0.08);
          const pos = s.ax === 'z' ? [u, y, s.sign * d] : [s.sign * d, y, u - 2];
          crowdSpots.push({ pos, face: s.ax === 'z' ? 0 : (s.sign > 0 ? -Math.PI / 2 : Math.PI / 2) });
        }
      }
    }
    // trusses and screens
    for (const z of [-6, 6]) m.box(22, 0.4, 0.4, 0, 12.5, z, '#2c3140');
    for (const x of [-8, 8]) m.box(0.4, 0.4, 16, x, 12.5, 0, '#2c3140');
    for (const [x, z] of [[-6, 6], [6, 6], [0, -7]]) glow.cyl(0.35, 0.25, x, 12.9, z, '#fff6dc');
    sc.add(m.build(MATTE_MAT));
    sc.add(glow.build(GLOW_MAT));

    // light cones
    const coneMat = new THREE.MeshBasicMaterial({ color: '#fff3d0', transparent: true, opacity: 0.03, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (const [x, z] of [[-6, 6], [6, 6], [0, -7]]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 12.5, 24, 1, true), coneMat);
      const dir = new THREE.Vector3(-x, -12.5, -z).normalize();
      cone.position.set(x / 2, 12.9 / 2 + 0.3, z / 2);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      sc.add(cone);
    }

    // mat
    const mat = makeCanvasTexture(1024, 1024, (ctx, W) => {
      const s = W / 12;
      ctx.fillStyle = '#2251c5';
      ctx.fillRect(0, 0, W, W);
      ctx.fillStyle = '#d7263d';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1.6 * s, 0); ctx.lineTo(0, 1.6 * s); ctx.fill();
      ctx.fillStyle = '#1238a8';
      ctx.beginPath(); ctx.moveTo(W, W); ctx.lineTo(W - 1.6 * s, W); ctx.lineTo(W, W - 1.6 * s); ctx.fill();
      ctx.fillStyle = '#d7263d';
      ctx.beginPath(); ctx.arc(W / 2, W / 2, 4.5 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffb703';
      ctx.beginPath(); ctx.arc(W / 2, W / 2, 3.5 * s, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(W / 2, W / 2, 0.5 * s, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `70px ${DISPLAY_FONT}`;
      ctx.fillText('لیگ قهرمانان کشتی', W / 2, 0.65 * s);
      ctx.save();
      ctx.translate(W / 2, W - 0.65 * s);
      ctx.rotate(Math.PI);
      ctx.fillText('لیگ قهرمانان کشتی', 0, 0);
      ctx.restore();
    });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(12.6, 12.6), new THREE.MeshStandardMaterial({ map: mat, roughness: 0.75 }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = H + 0.002;
    sc.add(top);

    // big screen
    this.screenTex = makeCanvasTexture(1024, 384, () => {});
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.75), new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false }));
    scr.position.set(0, 8.2, -18.6);
    sc.add(scr);

    // crowd (instanced)
    const n = crowdSpots.length;
    const bodyGeo = new THREE.CapsuleGeometry(0.2, 0.35, 3, 8);
    const headGeo = new THREE.SphereGeometry(0.13, 10, 8);
    const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), n);
    const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), n);
    const col = new THREE.Color();
    crowdSpots.forEach((c, i) => {
      bodies.setColorAt(i, col.set(pick(PALETTE.shirts)));
      heads.setColorAt(i, col.set(pick(PALETTE.skins)));
      c.phase = Math.random() * TAU;
      c.rate = rand(5, 9);
    });
    bodies.instanceColor.needsUpdate = true;
    heads.instanceColor.needsUpdate = true;
    sc.add(bodies, heads);
    this.crowd = { spots: crowdSpots, bodies, heads, dummy: new THREE.Object3D() };
    this.updateCrowd(0);
  }

  updateCrowd(dt) {
    const { spots, bodies, heads, dummy } = this.crowd;
    const ex = this.excite;
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      const bob = (0.03 + ex * 0.35) * Math.abs(Math.sin(this.clock * s.rate * (0.4 + ex * 0.6) + s.phase));
      dummy.position.set(s.pos[0], s.pos[1] + 0.38 + bob, s.pos[2]);
      dummy.rotation.set(0, s.face, 0);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);
      dummy.position.y += 0.42;
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
    }
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    this.excite = Math.max(0, this.excite - dt * 0.35);
  }

  drawScreen() {
    const c = this.cfg;
    redrawCanvasTexture(this.screenTex, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#7a1020');
      g.addColorStop(0.5, '#0b1124');
      g.addColorStop(1, '#0f2a7a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffc23d';
      ctx.font = `64px ${DISPLAY_FONT}`;
      ctx.fillText(`مرحله‌ی ${fa(c.opp.stage)} • ${c.opp.title}`, w / 2, 70);
      ctx.font = `92px ${DISPLAY_FONT}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${c.playerName}  ⚔  ${c.opp.name}`, w / 2, 190);
      ctx.font = `150px ${DISPLAY_FONT}`;
      ctx.fillStyle = '#ff6b7a';
      ctx.fillText(fa(this.score ? this.score.p : 0), w * 0.2, 300);
      ctx.fillStyle = '#7aa2ff';
      ctx.fillText(fa(this.score ? this.score.o : 0), w * 0.8, 300);
    });
  }

  makeRef() {
    const ref = new Character({
      skin: '#e0ac69', hair: '#3b3b3b', shirt: '#f5f5f5', accent: '#111111', shorts: '#111111',
      shoes: '#111111', sole: '#222222', style: 'tee', longPants: true, wrist: '#1f4fd1', wrist2: '#d62828',
    });
    ref.manual = true;
    ref.root.position.set(0, 0, -1.6);
    this.stage.add(ref.root);
    return ref;
  }

  /* ---------- match setup ---------- */

  start(cfg) {
    this.cfg = cfg;
    this.ratio = (cfg.playerLevel + 3) / (cfg.opp.level + 3);
    for (const w of [this.p, this.o]) if (w) { this.stage.remove(w.ch.root); w.ch.mesh.geometry.dispose(); }
    const po = cfg.playerOutfit || {};
    const pch = new Character({
      skin: po.skin || '#e0ac69', hair: po.hair || '#1b1b1b', shirt: '#d62828', shorts: '#d62828', accent: '#ffffff',
      shoes: '#d62828', sole: '#f5f5f5', highShoes: true, style: 'tank', muscle: muscleFor(cfg.playerLevel),
    });
    const och = new Character({
      skin: pick(PALETTE.skins), hair: pick(PALETTE.hair), shirt: '#1f4fd1', shorts: '#1f4fd1', accent: '#ffffff',
      shoes: '#1f4fd1', sole: '#f5f5f5', highShoes: true, style: 'tank', muscle: muscleFor(cfg.opp.level),
    });
    this.p = { ch: pch, f: 0, yaw: 0, pose: makePose(), dir: 1 };
    this.o = { ch: och, f: 0, yaw: 0, pose: makePose(), dir: -1 };
    for (const w of [this.p, this.o]) {
      w.ch.manual = true;
      w.ch.rate = 14;
      this.stage.add(w.ch.root);
    }
    this.score = { p: 0, o: 0 };
    this.zoorGained = 0;
    this.tapZoor = 0;
    $('aZoor').textContent = '💪 هر ضربه و هر امتیاز به زورت اضافه می‌شه';
    this.time = MATCH_TIME;
    this.b = 0;
    this.cx = 0;
    this.lastScorer = null;
    this.overtime = false;
    this.pendingEnd = null;
    this.ended = false;
    this.camState = { orbit: 1.5, dist: 12, height: 6, tx: 0 };
    this.placeNeutral(true);
    this.setState('intro');
    $('ahud').hidden = false;
    $('nameO').textContent = cfg.opp.name;
    $('lvlP').textContent = 'سطح ' + fa(cfg.playerLevel);
    $('lvlO').textContent = 'سطح ' + fa(cfg.opp.level);
    $('stageLbl').textContent = `مرحله‌ی ${fa(cfg.opp.stage)} • ${cfg.opp.title}`;
    $('vsP').textContent = cfg.playerName;
    $('vsPl').textContent = 'سطح زور ' + fa(cfg.playerLevel);
    $('vsO').textContent = cfg.opp.name;
    $('vsOl').textContent = 'سطح زور ' + fa(cfg.opp.level);
    this.updateHud();
    this.drawScreen();
    Sfx.crowd(true, 0.05);
  }

  stop() {
    this.state = 'off';
    $('ahud').hidden = true;
    Sfx.crowd(false);
  }

  setState(s) {
    this.state = s;
    this.st = 0;
    $('struggle').hidden = s !== 'struggle';
    $('choosePanel').hidden = s !== 'choose';
    $('timingPanel').hidden = s !== 'timing';
    $('pinPanel').hidden = s !== 'pin';
    $('vsCard').hidden = s !== 'intro';
  }

  msg(text, cls = '', dur = 1.4) {
    const el = $('aMsg');
    el.textContent = text;
    el.className = 'a-msg show ' + cls;
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => { el.className = 'a-msg'; }, dur * 1000);
  }

  pointPop(who, pts) {
    const el = $('pointPop');
    el.textContent = '+' + fa(pts);
    el.className = 'point-pop ' + (who === 'p' ? 'red' : 'blue');
    void el.offsetWidth;
    el.className += ' show';
  }

  updateHud() {
    $('scoreP').textContent = fa(this.score.p);
    $('scoreO').textContent = fa(this.score.o);
    const t = Math.max(0, Math.ceil(this.time));
    $('timer').textContent = fa(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
    $('timer').classList.toggle('golden', this.overtime);
    $('powerKnob').style.left = `${((this.b + 1) / 2) * 100}%`;
    $('powerRed').style.width = `${((this.b + 1) / 2) * 100}%`;
  }

  /* ---------- input ---------- */

  bindUi() {
    const grid = $('chooseGrid');
    grid.innerHTML = '';
    Object.values(TECHS).forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'tech-btn';
      b.type = 'button';
      b.dataset.tech = t.id;
      b.innerHTML = `<span class="tech-icon">${t.icon}</span><span class="tech-name">${t.name}</span><span class="tech-pts">${fa(t.pts)} امتیاز</span><span class="tech-stars">${'★'.repeat(t.stars)}${'☆'.repeat(3 - t.stars)}</span><kbd>${fa(i + 1)}</kbd>`;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.choose(t.id); });
      grid.appendChild(b);
    });
    const press = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
    press('tapBtn', () => this.tap());
    press('timingBtn', () => this.timingPress());
    press('pinBtn', () => this.pinTap());
  }

  key(code) {
    if (this.state === 'off') return;
    if (code === 'Space' || code === 'Enter') {
      if (this.state === 'struggle') this.tap();
      else if (this.state === 'timing') this.timingPress();
      else if (this.state === 'pin') this.pinTap();
    } else if (this.state === 'choose') {
      const idx = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[code];
      if (idx != null) this.choose(Object.keys(TECHS)[idx]);
    }
  }

  tap() {
    if (this.state !== 'struggle') return;
    this.b = Math.min(1.05, this.b + 0.09 * Math.pow(this.ratio, 0.9));
    this.tapZoor = (this.tapZoor || 0) + 0.6 * (this.cfg.xpMult || 1);
    if (this.tapZoor >= 5) { this.gainZoor(Math.floor(this.tapZoor)); this.tapZoor -= Math.floor(this.tapZoor); }
    this.pushPulse = 0.15;
    Sfx.play('tap');
    const btn = $('tapBtn');
    btn.classList.remove('bump');
    void btn.offsetWidth;
    btn.classList.add('bump');
  }

  choose(id) {
    if (this.state !== 'choose' || !TECHS[id]) return;
    Sfx.play('click');
    this.startTiming('attack', TECHS[id]);
  }

  startTiming(mode, tech) {
    const st = this.cfg.opp.stage;
    const zone = mode === 'attack'
      ? clamp(tech.zone * Math.pow(this.ratio, 0.7), 0.07, 0.55)
      : clamp(0.28 * Math.pow(this.ratio, 0.75), 0.06, 0.55);
    this.timing = {
      mode, tech, zw: zone, zc: rand(0.22 + zone / 2, 0.78 - zone / 2), needle: 0, dir: 1,
      speed: (mode === 'attack' ? 1.05 : 1.15) + Math.min(st, 14) * 0.06, t: 3.2, done: false,
    };
    $('timingTitle').textContent = mode === 'attack' ? `${tech.icon} ${tech.name}! وقتی نشانگر توی ناحیه‌ی سبز بود بزن` : `حریف حمله کرد: ${tech.name}! به‌موقع دفاع کن`;
    $('timingPanel').classList.toggle('defend', mode === 'defend');
    $('timingZone').style.left = `${(this.timing.zc - zone / 2) * 100}%`;
    $('timingZone').style.width = `${zone * 100}%`;
    $('timingBtn').textContent = mode === 'attack' ? 'الان! 💥' : 'دفاع! 🛡️';
    this.setState('timing');
  }

  timingPress() {
    const T = this.timing;
    if (this.state !== 'timing' || !T || T.done) return;
    T.done = true;
    const hit = Math.abs(T.needle - T.zc) <= T.zw / 2 + 0.01;
    this.resolveTiming(hit);
  }

  resolveTiming(hit) {
    const T = this.timing;
    if (T.mode === 'attack') {
      if (hit) {
        Sfx.play('success');
        this.msg(`عالی! ${T.tech.name}`, 'good');
        this.playTech(T.tech.id, 'p', T.tech.pts, T.tech.pin);
      } else {
        Sfx.play('fail');
        this.msg('حریف دفاع کرد!', 'bad');
        this.playTech('sprawl', 'p', 1, false, 'o');
      }
    } else if (hit) {
      Sfx.play('success');
      this.msg('دفاع عالی! +۱', 'good');
      this.playTech('sprawl', 'o', 1, false, 'p');
    } else {
      Sfx.play('fail');
      this.msg(`حریف زد: ${T.tech.name}`, 'bad');
      this.playTech(T.tech.id, 'o', T.tech.pts, T.tech.pin);
    }
  }

  pinTap() {
    if (this.state !== 'pin' || this.pin.done) return;
    this.pin.count++;
    Sfx.play('tap');
    if (this.pin.count >= this.pin.need) this.endPin(true);
    const btn = $('pinBtn');
    btn.classList.remove('bump');
    void btn.offsetWidth;
    btn.classList.add('bump');
  }

  /* ---------- flow ---------- */

  playTech(name, attacker, pts, pin, scorer) {
    const def = TECH_ANIMS[name];
    const A = attacker === 'p' ? this.p : this.o;
    const D = attacker === 'p' ? this.o : this.p;
    this.anim = {
      name, def, t: 0, A, D, attacker, base: A.ch.root.position.x, dir: A.dir,
      pts, pin, scorer: scorer || attacker, impacted: false,
    };
    this.setState('anim');
    if (name !== 'sprawl') Sfx.play('whoosh');
  }

  /** Wrestling makes you stronger too: every tap and every point you score adds strength. */
  gainZoor(amount) {
    if (!(amount > 0) || !this.cfg.onZoor) return;
    this.zoorGained += amount;
    this.cfg.onZoor(amount);
    const el = $('aZoor');
    el.textContent = `💪 زور از این کشتی: +${fa(Math.round(this.zoorGained))}`;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  award(who, pts) {
    if (who === 'p') this.gainZoor(pts * 12 * (this.cfg.xpMult || 1));
    this.score[who] += pts;
    this.lastScorer = who;
    this.pointPop(who, pts);
    this.excite = 1;
    Sfx.play(who === 'p' ? 'cheer' : 'groan');
    this.refSignal = { who, t: 1.4 };
    this.updateHud();
    this.drawScreen();
    if (this.overtime) this.pendingEnd = { who, reason: 'golden' };
    else if (Math.abs(this.score.p - this.score.o) >= TECH_GAP) this.pendingEnd = { who: this.score.p > this.score.o ? 'p' : 'o', reason: 'tech' };
  }

  afterAnim() {
    const a = this.anim;
    if (this.pendingEnd) return this.finish(this.pendingEnd.who, this.pendingEnd.reason);
    if (a.pin && a.name !== 'sprawl') {
      const inv = 1 / this.ratio;
      const by = a.attacker;
      const need = by === 'p'
        ? Math.round(clamp(11 * Math.pow(inv, 0.6) * (a.name === 'salto' ? 0.75 : 1), 5, 24))
        : Math.round(clamp(7 * Math.pow(inv, 0.8), 4, 26));
      for (const w of [this.p, this.o]) {
        const c = w.ch.cur;
        c.bx = wrapAngle(c.bx); c.by = wrapAngle(c.by); c.bz = wrapAngle(c.bz);
      }
      this.pin = { by, need, count: 0, t: 3.0, done: false };
      $('pinTitle').textContent = by === 'p' ? 'ضربه فنی کن! سریع بزن تا پشتش به تشک بچسبه' : 'حریف داره ضربه فنی‌ات می‌کنه! سریع بزن تا فرار کنی';
      $('pinPanel').classList.toggle('danger', by === 'o');
      this.setState('pin');
      Sfx.play('tick');
      return;
    }
    this.startReset();
  }

  endPin(success) {
    const P = this.pin;
    P.done = true;
    if (P.by === 'p') {
      if (success) {
        this.msg('ضربه فنی!', 'good big', 2.2);
        Sfx.play('slam');
        this.refSlap = 0.8;
        return this.finish('p', 'fall', 1.0);
      }
      this.msg('حریف فرار کرد!', 'bad');
    } else {
      if (!success) {
        this.msg('ضربه فنی شدی!', 'bad big', 2.2);
        Sfx.play('slam');
        this.refSlap = 0.8;
        return this.finish('o', 'fall', 1.0);
      }
      Sfx.play('success');
      this.msg('فرار کردی! آفرین', 'good');
    }
    this.startReset();
  }

  startReset() {
    for (const w of [this.p, this.o]) {
      const c = w.ch.cur;
      c.bx = wrapAngle(c.bx); c.by = wrapAngle(c.by); c.bz = wrapAngle(c.bz);
      w.fromX = w.ch.root.position.x;
      w.fromYaw = w.ch.root.rotation.y;
    }
    this.b = 0;
    this.cx = clamp(this.cx * 0.5, -2, 2);
    this.setState('reset');
  }

  timeUp() {
    const s = this.score;
    if (s.p !== s.o) return this.finish(s.p > s.o ? 'p' : 'o', 'points');
    if (this.lastScorer) return this.finish(this.lastScorer, 'criteria');
    if (!this.overtime) {
      this.overtime = true;
      this.time = 20;
      this.msg('وقت اضافه! امتیاز طلایی', 'gold big', 2.2);
      Sfx.play('whistle');
      this.updateHud();
      return;
    }
    return this.finish(this.b >= 0 ? 'p' : 'o', 'decision');
  }

  finish(who, reason, delay = 0) {
    if (this.ended) return;
    this.ended = true;
    this.winner = who;
    this.reason = reason;
    Sfx.play('whistle');
    this.setState('end');
    this.endDelay = delay;
    for (const w of [this.p, this.o]) {
      const c = w.ch.cur;
      c.bx = wrapAngle(c.bx); c.by = wrapAngle(c.by); c.bz = wrapAngle(c.bz);
      w.fromX = w.ch.root.position.x;
      w.fromZ = w.ch.root.position.z;
      w.fromYaw = w.ch.root.rotation.y;
    }
    setTimeout(() => {
      if (this.state !== 'end') return;
      Sfx.play(who === 'p' ? 'win' : 'lose');
      if (who === 'p') this.excite = 1;
    }, 900 + delay * 1000);
    this.resultTimer = setTimeout(() => {
      if (this.state !== 'end') return;
      this.cfg.onEnd({ win: who === 'p', reason, score: Object.assign({}, this.score), zoor: Math.round(this.zoorGained) });
    }, 4200 + delay * 1000);
  }

  /* ---------- placement ---------- */

  place(w, x, yawWorld) {
    w.ch.root.position.set(x, 0, 0);
    w.ch.root.rotation.y = yawWorld;
  }

  placeNeutral(instant) {
    this.place(this.p, this.cx - 0.5, Math.PI / 2);
    this.place(this.o, this.cx + 0.5, -Math.PI / 2);
    if (instant) {
      for (const w of [this.p, this.o]) {
        wStance(w.ch.manualPose, 0, 0);
        copyPose(w.ch.cur, w.ch.manualPose);
        w.ch.apply();
      }
    }
  }

  applyTech(dt) {
    const a = this.anim;
    const A = a.A;
    const D = a.D;
    const ph = this.clock * 4;
    a.def.fn(A, D, Math.min(1, a.t / a.def.dur), ph);
    const base = a.base;
    for (const w of [A, D]) {
      w.ch.root.position.set(base + a.dir * w.f, 0, 0);
      w.ch.root.rotation.y = (a.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + w.yaw;
      copyPose(w.ch.manualPose, w.pose);
      w.ch.manualSnap = true;
    }
  }

  /* ---------- frame ---------- */

  update(dt, camera) {
    if (this.state === 'off') return;
    this.clock += dt;
    this.st += dt;
    const ph = this.clock * 4;
    const P = this.p;
    const O = this.o;
    P.ch.manualSnap = false;
    O.ch.manualSnap = false;

    switch (this.state) {
      case 'intro': {
        const steps = [[1.6, '۳'], [2.2, '۲'], [2.8, '۱']];
        for (const [t, txt] of steps) {
          if (this.st >= t && (this.lastCount || 0) < t) { this.msg(txt, 'count', 0.55); Sfx.play('tick'); this.lastCount = t; }
        }
        if (this.st >= 3.4) {
          this.lastCount = 0;
          this.msg('کشتی!', 'gold big', 1.0);
          Sfx.play('whistle');
          this.excite = 0.7;
          this.setState('struggle');
        }
        this.stancePoses(ph, 0, 0);
        break;
      }
      case 'struggle': {
        const surge = 0.75 + 0.5 * (0.5 + 0.5 * Math.sin(this.clock * 1.9 + Math.sin(this.clock * 0.7) * 2));
        const push = 0.38 * Math.pow(1 / this.ratio, 0.9) * surge * (1 + Math.min(this.cfg.opp.stage, 20) * 0.01);
        this.b -= push * dt;
        this.time -= dt;
        this.pushPulse = Math.max(0, (this.pushPulse || 0) - dt);
        this.cx += (this.b * 1.6 - this.cx) * damp(3, dt);
        this.stancePoses(ph, this.b, this.pushPulse);
        this.placeNeutral(false);
        if (this.b >= 1) {
          this.b = 1;
          Sfx.play('go');
          this.msg('حمله کن!', 'gold');
          this.chooseT = 4;
          this.setState('choose');
        } else if (this.b <= -1) {
          this.b = -1;
          const r = Math.random();
          const big = Math.min(0.45, 0.12 + this.cfg.opp.stage * 0.03);
          const tech = r < big * 0.4 ? TECHS.salto : r < big ? TECHS.lift : TECHS.leg;
          this.startTiming('defend', tech);
        } else if (this.time <= 0) {
          this.time = 0;
          this.timeUp();
        }
        break;
      }
      case 'choose': {
        this.chooseT -= dt;
        $('chooseFill').style.width = `${clamp(this.chooseT / 4, 0, 1) * 100}%`;
        this.stancePoses(ph, 1, 0);
        this.placeNeutral(false);
        if (this.chooseT <= 0) this.choose('leg');
        break;
      }
      case 'timing': {
        const T = this.timing;
        if (!T.done) {
          T.needle += T.dir * T.speed * dt;
          if (T.needle > 1) { T.needle = 2 - T.needle; T.dir = -1; }
          if (T.needle < 0) { T.needle = -T.needle; T.dir = 1; }
          T.t -= dt;
          $('timingNeedle').style.left = `${T.needle * 100}%`;
          if (T.t <= 0) { T.done = true; this.resolveTiming(false); }
        }
        this.stancePoses(ph, T.mode === 'attack' ? 1 : -1, 0);
        this.placeNeutral(false);
        break;
      }
      case 'anim': {
        const a = this.anim;
        let ts = 1;
        if (a.def.slow) {
          const u = a.t / a.def.dur;
          if (u > a.def.slow[0] && u < a.def.slow[1]) ts = 0.45;
        }
        a.t += dt * ts;
        this.applyTech(dt);
        if (!a.impacted && a.t / a.def.dur >= a.def.impact) {
          a.impacted = true;
          if (a.name === 'sprawl') {
            Sfx.play('punch');
            this.shake = 0.15;
          } else {
            Sfx.play('slam');
            this.shake = a.pts >= 4 ? 0.6 : 0.35;
            const dpos = a.D.ch.root.position;
            this.fx.burst({ x: dpos.x, y: this.matTop + 0.2, z: 0 }, { count: a.pts >= 4 ? 60 : 30, colors: ['#ffffff', '#ffc23d'], speed: 3.5, up: 1.5, life: 0.7 });
          }
          this.award(a.scorer, a.pts);
        }
        if (a.t >= a.def.dur) this.afterAnim();
        break;
      }
      case 'pin': {
        const Pn = this.pin;
        const a = this.anim;
        if (!Pn.done) {
          Pn.t -= dt;
          $('pinFill').style.width = `${clamp(Pn.count / Pn.need, 0, 1) * 100}%`;
          $('pinInfo').textContent = `${fa(Pn.count)} از ${fa(Pn.need)} • ${fa(Math.max(0, Pn.t).toFixed(1))} ثانیه`;
          if (Pn.t <= 0) this.endPin(false);
        }
        // hold the final throw frame with a struggle wobble
        a.def.fn(a.A, a.D, 1, ph);
        wLying(a.D.pose, ph, 1);
        wTop(a.A.pose, ph * 2);
        for (const w of [a.A, a.D]) {
          w.ch.root.position.set(a.base + a.dir * w.f, 0, 0);
          w.ch.root.rotation.y = (a.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + w.yaw;
          copyPose(w.ch.manualPose, w.pose);
        }
        a.A.ch.manualSnap = false;
        a.D.ch.manualSnap = false;
        break;
      }
      case 'reset': {
        const u = smooth(this.st / 1.1);
        this.stancePoses(ph, 0, 0);
        P.ch.root.position.x = lerp(P.fromX, this.cx - 0.5, u);
        O.ch.root.position.x = lerp(O.fromX, this.cx + 0.5, u);
        // walk around each other instead of through each other
        const arc = P.fromX > O.fromX - 0.2 ? Math.sin(Math.PI * u) * 0.9 : 0;
        P.ch.root.position.z = -arc;
        O.ch.root.position.z = arc;
        P.ch.root.rotation.y = angleLerp(P.fromYaw, Math.PI / 2, u);
        O.ch.root.rotation.y = angleLerp(O.fromYaw, -Math.PI / 2, u);
        if (this.st >= 1.15) {
          if (this.time <= 0) this.timeUp();
          if (!this.ended) this.setState('struggle');
        }
        break;
      }
      case 'end': {
        const t = this.st - this.endDelay;
        const win = this.winner === 'p' ? P : O;
        const lose = this.winner === 'p' ? O : P;
        if (t < 0) {
          // keep the pin frame while the referee slaps the mat
          const a = this.anim;
          if (a) {
            wLying(a.D.pose, ph, 0.3);
            for (const w of [a.A, a.D]) copyPose(w.ch.manualPose, w.pose);
          }
          break;
        }
        const u = smooth(t / 1.2);
        const winSide = this.winner === 'p' ? -1 : 1;
        win.ch.root.position.x = lerp(win.fromX, winSide * 0.75, u);
        lose.ch.root.position.x = lerp(lose.fromX, -winSide * 0.75, u);
        win.ch.root.position.z = lerp(win.fromZ, 0, u);
        lose.ch.root.position.z = lerp(lose.fromZ, 0, u);
        win.ch.root.rotation.y = angleLerp(win.fromYaw, 0, u);
        lose.ch.root.rotation.y = angleLerp(lose.fromYaw, 0, u);
        const pw = win.ch.manualPose;
        copyPose(pw, STAND);
        if (t > 1.3) {
          const hop = Math.abs(Math.sin((t - 1.3) * 7));
          pw.shLX = pw.shRX = -0.2;
          if (winSide < 0) { pw.shLZ = 2.7; pw.shRZ = -0.6; } else { pw.shLZ = 0.6; pw.shRZ = -2.7; }
          pw.y = t > 2.2 ? 0.18 * hop : 0;
          pw.nkX = -0.25;
        }
        const pl = lose.ch.manualPose;
        copyPose(pl, STAND);
        if (t > 1.0) wKneel(pl);
        break;
      }
      default:
        break;
    }

    this.updateRef(dt, ph);
    P.ch.update(dt);
    O.ch.update(dt);
    this.ref.update(dt);
    this.updateHud();
    this.updateCrowd(dt);
    this.fx.update(dt);
    this.updateCamera(dt, camera);
  }

  stancePoses(ph, b, pulse) {
    wStance(this.p.ch.manualPose, b + pulse * 2, ph);
    wStance(this.o.ch.manualPose, -b, ph + 1.3);
  }

  updateRef(dt, ph) {
    const r = this.ref;
    const p = r.manualPose;
    copyPose(p, STAND);
    const pos = r.root.position;
    let tx = this.cx * 0.7;
    let tz = -1.7;
    let yaw = 0;
    if (this.state === 'end' && this.st - this.endDelay > 0.8) {
      tx = 0;
      tz = 0.05;
      const side = this.winner === 'p' ? -1 : 1;
      if (side < 0) { p.shRZ = -2.5; p.shRX = -0.2; } else { p.shLZ = 2.5; p.shLX = -0.2; }
    } else if (this.state === 'pin' || (this.state === 'end' && this.st < this.endDelay + 0.8)) {
      const a = this.anim;
      if (a) tx = a.base + a.dir * a.D.f + a.dir * 0.5;
      tz = -1.3;
      crouchPose(p, 0.8);
      p.nkX = 0.2;
      if (this.refSlap > 0) {
        this.refSlap -= dt;
        p.shRX = -1.2 + Math.sin(this.refSlap * 20) * 0.8;
      }
    } else if (this.refSignal && this.refSignal.t > 0) {
      this.refSignal.t -= dt;
      if (this.refSignal.who === 'p') { p.shRZ = -2.4; p.elR = -0.3; } else { p.shLZ = 2.4; p.elL = -0.3; }
    } else {
      p.shLX = p.shRX = 0.2;
      p.shLZ = 0.3; p.shRZ = -0.3;
      p.elL = p.elR = -0.9;
      yaw = 0.15 * Math.sin(this.clock * 0.6);
    }
    const k = damp(4, dt);
    const dx = tx - pos.x;
    const dz = tz - pos.z;
    pos.x += dx * k;
    pos.z += dz * k;
    r.speed = Math.hypot(dx, dz) * 4 > 0.6 ? Math.min(2, Math.hypot(dx, dz) * 4) : 0;
    if (r.speed > 0.2) {
      r.phase += dt * 8;
      const g = makePose();
      gait(g, r.phase, 0);
      p.hpLX = g.hpLX; p.hpRX = g.hpRX; p.knL = g.knL; p.knR = g.knR;
    }
    r.root.rotation.y = angleLerp(r.root.rotation.y, yaw, damp(5, dt));
  }

  updateCamera(dt, camera) {
    const c = this.camState;
    let orbit = 0.25 * Math.sin(this.clock * 0.12);
    let dist = 6.6;
    let height = 2.4;
    let tx = this.cx * 0.8;
    if (this.state === 'intro') {
      const u = smooth(this.st / 3.2);
      orbit = lerp(1.5, 0.15, u);
      dist = lerp(12, 6.6, u);
      height = lerp(6, 2.4, u);
    } else if (this.state === 'anim' || this.state === 'pin') {
      const a = this.anim;
      tx = a.base + a.dir * 0.2;
      orbit = 0.45 * (a.dir > 0 ? 1 : -1);
      dist = this.state === 'pin' ? 4.6 : 5.2;
      height = this.state === 'pin' ? 2.8 : 1.9;
    } else if (this.state === 'end') {
      tx = 0;
      orbit = 0.2 * Math.sin(this.clock * 0.3);
      dist = 5.4;
      height = 1.8;
    }
    const k = damp(this.state === 'intro' ? 6 : 3, dt);
    c.orbit += (orbit - c.orbit) * k;
    c.dist += (dist - c.dist) * k;
    c.height += (height - c.height) * k;
    c.tx += (tx - c.tx) * k;
    const ty = this.matTop + 1.0;
    camera.position.set(c.tx + Math.sin(c.orbit) * c.dist, ty + c.height, Math.cos(c.orbit) * c.dist);
    if (this.shake > 0) {
      camera.position.x += rand(-1, 1) * this.shake * 0.25;
      camera.position.y += rand(-1, 1) * this.shake * 0.25;
      this.shake = Math.max(0, this.shake - dt * 1.5);
    }
    camera.lookAt(c.tx, ty - 0.2, 0);
  }
}
