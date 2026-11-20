'use strict';
/*
 * Round fifteen: go-kart races round the gym track (drifts, mini-turbos, boost pads, four
 * laps against three drivers), a claw machine full of plushies and one golden star, a
 * lightning-storm power, a hula hoop and the worm, and medals for all of it.
 */

POWERS.push({ id: 'storm', name: 'طوفان رعد', icon: '⚡', level: 340, cd: 40, xp: 90, key: ']' });
for (const p of POWERS) POWER_BY_ID[p.id] = p;

const EMOTES9 = [['e_hula', 'حلقه‌ی هولاهوپ', '⭕'], ['e_worm', 'رقص کرمی', '🐛']]
  .map(([id, name, icon]) => ({ id, name, icon, level: 1, cat: 'fun', emote: true }));
MOVES.push(...EMOTES9);
for (const e of EMOTES9) MOVE_BY_ID[e.id] = e;
if (typeof DANCE_POOL !== 'undefined') DANCE_POOL.push('e_hula', 'e_worm');

Object.assign(EXTRA_PROPS, {
  hoop(ch, pr) {
    const holder = new THREE.Group();
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.022, 6, 32), new THREE.MeshStandardMaterial({ color: '#ff4da6', roughness: 0.4, emissive: '#5a0f35' }));
    hoop.rotation.x = Math.PI / 2;
    holder.add(hoop);
    holder.position.y = 0.05;
    ch.B.body.add(holder);
    pr.meshes.push(holder);
    pr.tick = (c) => {
      const t = c.actionT || 0;
      // the hoop circles the waist, tilted a little, faster than the hips move
      holder.position.set(Math.cos(t * 13) * 0.12, 0.05 + Math.sin(t * 2) * 0.02, Math.sin(t * 13) * 0.12);
      holder.rotation.set(Math.sin(t * 13) * 0.12, 0, -Math.cos(t * 13) * 0.12);
    };
  },
});

Object.assign(ANIMS, {
  e_hula: {
    dur: 3.2,
    props: ['hoop'],
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.08)) * (1 - smooth(seg(t, 0.92, 1)));
      const a = t * 3.2 * 13;
      const q = makePose();
      // hips go round and round, arms up out of the way
      q.x = Math.cos(a) * 0.05; q.z = Math.sin(a) * 0.05;
      q.bz = Math.cos(a) * 0.06; q.bx = Math.sin(a) * 0.05;
      q.spZ = -Math.cos(a) * 0.08; q.spX = -Math.sin(a) * 0.06;
      q.shLZ = 2.5; q.shRZ = -2.5; q.elL = q.elR = -0.5;
      q.knL = q.knR = 0.18; q.hpLX = q.hpRX = -0.1;
      mixInto(p, q, k);
    },
  },
  e_worm: {
    dur: 3.4,
    move: (t) => (t > 0.18 && t < 0.85 ? 0.7 : 0),
    events: [[0.16, 'land']],
    fn(p, t) {
      const down = smooth(seg(t, 0, 0.16)) * (1 - smooth(seg(t, 0.86, 1)));
      const w = Math.sin(t * TAU * 5);
      const q = makePose();
      // flat on the floor face down, a wave running from the chest to the toes
      q.bx = 1.45 * down; q.y = -0.78 * down;
      q.spX = (-0.35 + 0.3 * w) * down;
      q.hpLX = q.hpRX = (0.3 - 0.35 * w) * down;
      q.knL = q.knR = (0.4 + 0.4 * Math.sin(t * TAU * 5 - 1.2)) * down;
      q.shLX = q.shRX = (-2.9) * down; q.elL = q.elR = -0.4;
      q.nkX = -0.7 * down;
      q.y += 0.08 * Math.max(0, w) * down;
      mixInto(p, q, Math.max(down, 0.001));
      p.bx = q.bx; p.y = q.y;
    },
  },
});

ACHIEVEMENTS.push(
  { id: 'kartwin', name: 'قهرمان کارتینگ', icon: '🏎️', desc: 'یه مسابقه‌ی کارتینگ رو اول شو', test: (s) => (s.stats.kartWins || 0) >= 1 },
  { id: 'drifter', name: 'استاد دریفت', icon: '💨', desc: '۱۰ بار با دریفت توربو بگیر', test: (s) => (s.stats.miniTurbos || 0) >= 10 },
  { id: 'claw', name: 'شکارچی عروسک', icon: '🧸', desc: 'با دستگاه عروسک یه جایزه بگیر', test: (s) => (s.stats.clawPrizes || 0) >= 1 },
  { id: 'clawgold', name: 'ستاره‌ی طلایی', icon: '🌟', desc: 'ستاره‌ی طلایی دستگاه عروسک رو بگیر', test: (s) => (s.stats.clawGold || 0) >= 1 },
  { id: 'thunder', name: 'خدای رعد', icon: '⚡', desc: 'با طوفان رعد ۷ نفر رو یه‌جا بزن', test: (s) => (s.stats.stormBest || 0) >= 7 },
  { id: 'hula', name: 'هولاهوپ‌باز', icon: '⭕', desc: 'هولاهوپ بزن', test: (s) => (s.stats.hulas || 0) >= 1 },
);

const KART = { laps: 4, lane: 1.2, vmax: 11.5, accel: 7, grass: 0.55, boost: 1.45 };
const CLAW = [{ x: 34, z: -6.4 }, { x: 37.6, z: -6.4 }];
const KART_COLORS = ['#e63946', '#2f6fed', '#2ecc71', '#ffd34d'];
GYM_SPOTS.push(['🏎️', 'کارتینگ (خط شروع)', TRACK.cx + TRACK.a + 1.2, TRACK.cz - 4], ['🕹️', 'دستگاه عروسک', 36, -3.5]);

/** Where on the track: the angle round the oval and the distance from the middle of the lane. */
function trackAt(x, z) {
  const A = TRACK.a + KART.lane, B = TRACK.b + KART.lane;
  const th = Math.atan2((z - TRACK.cz) / B, (x - TRACK.cx) / A);
  const r = Math.hypot((x - TRACK.cx) / A, (z - TRACK.cz) / B);
  return { th, off: (r - 1) * (A + B) * 0.5 };
}
function trackPoint(th, lane) {
  return { x: TRACK.cx + (TRACK.a + lane) * Math.cos(th), z: TRACK.cz + (TRACK.b + lane) * Math.sin(th) };
}

function kartMesh(color, number) {
  const g = new THREE.Group();
  const b = new Batch();
  b.box(0.95, 0.16, 1.55, 0, 0.2, 0, '#22252e');
  b.box(0.8, 0.12, 0.5, 0, 0.3, 0.55, color);
  b.add(UnitGeo.cone(4), 0, 0.3, 0.88, color, Math.PI / 2, Math.PI / 4, 0, 0.3, 0.25, 0.12);
  b.box(0.98, 0.1, 0.3, 0, 0.28, -0.55, color);
  b.box(0.5, 0.3, 0.42, 0, 0.42, -0.25, '#15161c');
  b.box(0.08, 0.32, 0.08, 0.38, 0.45, -0.7, '#9aa0a8');
  b.box(0.08, 0.32, 0.08, -0.38, 0.45, -0.7, '#9aa0a8');
  b.box(1.0, 0.05, 0.22, 0, 0.62, -0.72, color);
  b.cyl(0.03, 0.4, 0, 0.42, 0.28, '#9aa0a8', -0.9, 0, 0);
  b.cyl(0.04, 0.22, 0.2, 0.25, -0.82, '#9aa0a8', Math.PI / 2, 0, 0);
  b.cyl(0.04, 0.22, -0.2, 0.25, -0.82, '#9aa0a8', Math.PI / 2, 0, 0);
  const body = new THREE.Mesh(mergeParts(b.parts, false), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.35 }));
  g.add(body);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.08, 6, 14), new THREE.MeshStandardMaterial({ color: '#15161c', roughness: 0.9 }));
  const wheels = [];
  for (const [x, z] of [[0.52, 0.55], [-0.52, 0.55], [0.52, -0.55], [-0.52, -0.55]]) {
    const holder = new THREE.Group();
    holder.position.set(x, 0.2, z);
    const w = wheel.clone();
    w.rotation.y = Math.PI / 2;
    holder.add(w);
    g.add(holder);
    wheels.push({ holder, w, front: z > 0 });
  }
  const wheelSteer = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 6, 16), new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.5 }));
  wheelSteer.position.set(0, 0.62, 0.15);
  wheelSteer.rotation.x = -0.9;
  g.add(wheelSteer);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), new THREE.MeshBasicMaterial({
    map: makeCanvasTexture(96, 64, (ctx, w, h) => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#111'; ctx.font = `bold 44px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(number), w / 2, h / 2 + 2); }),
  }));
  plate.position.set(0, 0.36, 0.81);
  plate.rotation.x = -0.35;
  g.add(plate);
  g.traverse((o) => { o.userData.noSolid = true; });
  return { g, wheels, wheelSteer };
}

/** Sitting in a kart: legs out in front, hands on the wheel. */
function kartPose(pose, steer, bump) {
  copyPose(pose, STAND);
  pose.y = -0.5 + bump;
  pose.hpLX = pose.hpRX = -1.35; pose.knL = pose.knR = 0.45;
  pose.hpLZ = 0.12; pose.hpRZ = -0.12;
  pose.spX = -0.12;
  pose.shLX = pose.shRX = -1.15; pose.elL = pose.elR = -0.55;
  pose.shLZ = 0.2 + steer * 0.25; pose.shRZ = -0.2 + steer * 0.25;
  pose.spY = -steer * 0.18; pose.nkY = -steer * 0.25;
  pose.autoAnkle = true;
}

Object.assign(Game, {
  /* ---------- building: boost pads, the kart garage, the claw machines ---------- */

  buildFun9(g) {
    g.fun9 = true;
    const add = (m, solid) => { if (!solid) m.userData.noSolid = true; g.scene.add(m); return m; };
    // boost pads on the two long sides of the track
    const padTex = makeCanvasTexture(128, 64, (ctx, w, h) => {
      ctx.fillStyle = '#ff7b00'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffe26b';
      for (let i = 0; i < 3; i++) { const x = 18 + i * 36; ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x + 24, h / 2); ctx.lineTo(x, h - 8); ctx.lineTo(x + 10, h / 2); ctx.closePath(); ctx.fill(); }
    });
    g.kartPads = [];
    for (const th of [Math.PI / 2, -Math.PI / 2]) {
      const p = trackPoint(th, KART.lane);
      const m = add(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshStandardMaterial({ map: padTex, emissive: '#ff7b00', emissiveMap: padTex, emissiveIntensity: 0.6, roughness: 0.4 })));
      m.rotation.x = -Math.PI / 2;
      // arrows point the way the karts go (the oval runs anticlockwise seen from above)
      m.rotation.z = th > 0 ? Math.PI : 0;
      m.position.set(p.x, 0.016, p.z);
      g.kartPads.push({ m, x: p.x, z: p.z });
    }
    // a checkered start line and a garage sign
    const sl = trackPoint(0, KART.lane);
    const chk = add(new THREE.Mesh(new THREE.PlaneGeometry(TRACK.w + 0.4, 0.5), new THREE.MeshStandardMaterial({
      map: makeCanvasTexture(128, 16, (ctx, w, h) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; ctx.fillRect(i * 8, j * 8, 8, 8); } }),
      roughness: 0.6,
    })));
    chk.rotation.x = -Math.PI / 2;
    chk.position.set(sl.x, 0.017, sl.z);
    g.kartIdle = [];
    for (let i = 0; i < 2; i++) {
      const K = kartMesh(KART_COLORS[i + 1], i + 2);
      K.g.position.set(TRACK.cx + TRACK.a + TRACK.w + 1.6 + i * 1.3, 0, TRACK.cz - 3.2);
      K.g.rotation.y = 0.3;
      g.scene.add(K.g);
      g.kartIdle.push(K);
    }
    this.hangSign(g, 'کارتینگ 🏎️', '#ff7b00', TRACK.cx + TRACK.a + 2.6, 6.2, TRACK.cz - 4.6, 4.4);

    // the claw machines
    g.claws = CLAW.map((C, i) => this.buildClaw(g, C, i));
    this.hangSign(g, 'دستگاه عروسک 🧸', '#ff4da6', 35.8, 6.2, -8.6, 4.4);
    g.solids = null;
  },

  buildClaw(g, C, i) {
    const add = (m, solid) => { if (!solid) m.userData.noSolid = true; g.scene.add(m); return m; };
    const col = ['#ff4da6', '#2f9bff'][i % 2];
    const base = add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.6), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.2 })), true);
    base.position.set(C.x, 0.5, C.z);
    const glass = add(new THREE.Mesh(new THREE.BoxGeometry(1.56, 1.45, 1.56), new THREE.MeshStandardMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false })));
    glass.position.set(C.x, 1.73, C.z);
    for (const [dx, dz] of [[-0.78, -0.78], [0.78, -0.78], [-0.78, 0.78], [0.78, 0.78]]) add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 0.06), new THREE.MeshStandardMaterial({ color: '#ffd34d', metalness: 0.5, roughness: 0.3 }))).position.set(C.x + dx, 1.73, C.z + dz);
    const top = add(new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.42, 1.64), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, emissive: col, emissiveIntensity: 0.25 })));
    top.position.set(C.x, 2.66, C.z);
    const sign = add(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.36), new THREE.MeshBasicMaterial({ map: signTexture([{ text: '🧸 جایزه بگیر!', size: 80, display: true, color: '#ffffff' }], { w: 512, h: 128, border: '#ffd34d', bg1: col, bg2: '#10142a' }), toneMapped: false })));
    sign.position.set(C.x, 2.66, C.z + 0.83);
    // the control panel at the front, the prize chute in the corner
    const panel = add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.4), new THREE.MeshStandardMaterial({ color: '#15161c', roughness: 0.5 })));
    panel.position.set(C.x, 1.02, C.z + 0.95);
    panel.rotation.x = 0.25;
    const stick = add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), new THREE.MeshStandardMaterial({ color: '#9aa0a8', metalness: 0.6 })));
    stick.position.set(C.x - 0.3, 1.16, C.z + 0.95);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: '#e63946' }))).position.set(C.x - 0.3, 1.26, C.z + 0.95);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 14), new THREE.MeshStandardMaterial({ color: '#2ecc71', emissive: '#2ecc71', emissiveIntensity: 0.5 }))).position.set(C.x + 0.3, 1.1, C.z + 0.97);
    const chute = add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.42), new THREE.MeshStandardMaterial({ color: '#10142a' })));
    chute.position.set(C.x + 0.55, 1.02, C.z + 0.55);
    // the claw: a cable, a hub and three fingers
    const claw = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: '#d5dce6', metalness: 0.8, roughness: 0.25 });
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6).translate(0, 0.5, 0), metal);
    claw.add(cable);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.08, 12), metal);
    claw.add(hub);
    const fingers = [];
    for (let k = 0; k < 3; k++) {
      const f = new THREE.Group();
      f.rotation.y = (k / 3) * TAU;
      const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.025).translate(0, -0.08, 0), metal);
      seg1.position.z = 0.06;
      f.add(seg1);
      claw.add(f);
      fingers.push(seg1);
    }
    claw.traverse((o) => { o.userData.noSolid = true; });
    g.scene.add(claw);
    // the prizes: soft round plushies and one golden star
    const prizes = [];
    for (let k = 0; k < 14; k++) prizes.push(this.newPrize(g, C, k === 0));
    const M = { C, claw, cable, fingers, prizes, x: 0, z: 0, y: 2.3, open: 1 };
    this.placeClaw(M);
    return M;
  },

  newPrize(g, C, gold) {
    const r = gold ? 0.11 : rand(0.1, 0.13);
    const color = gold ? '#ffd34d' : pick(['#ff9aa2', '#a0e7e5', '#b4f8c8', '#fbe7c6', '#c3aed6', '#ffb347', '#7fe0ff']);
    const b = new Batch();
    b.sphere(r, 0, r, 0, color);
    if (!gold) {
      // a bear-ish head: two ears and a nose
      b.sphere(r * 0.35, r * 0.65, r * 1.75, 0, color);
      b.sphere(r * 0.35, -r * 0.65, r * 1.75, 0, color);
      b.sphere(r * 0.18, 0, r * 1.05, r * 0.92, '#3a2a1a');
    } else {
      for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; b.add(UnitGeo.cone(4), Math.cos(a) * r * 1.1, r, Math.sin(a) * r * 1.1, color, 0, 0, -Math.PI / 2 + 0, 0.05, 0.12, 0.05); }
    }
    const m = new THREE.Mesh(mergeParts(b.parts, false), gold ? new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.8, roughness: 0.25, emissive: '#5a4300', emissiveIntensity: 0.6 }) : MATTE_MAT);
    m.userData.noSolid = true;
    const P = { m, gold, r, lx: rand(-0.6, 0.45), lz: rand(-0.6, 0.35), ly: 0, vy: 0, held: false };
    P.ly = rand(0, 0.12);
    m.position.set(C.x + P.lx, 1.0 + P.ly, C.z + P.lz);
    m.rotation.y = rand(-Math.PI, Math.PI);
    g.scene.add(m);
    return P;
  },

  placeClaw(M) {
    const { C } = M;
    M.claw.position.set(C.x + M.x, M.y, C.z + M.z);
    M.cable.scale.y = Math.max(0.05, 2.42 - M.y);
    for (const f of M.fingers) f.rotation.x = -0.15 - 0.55 * M.open;
  },

  /* ---------- karts ---------- */

  nearKartStart() {
    const p = this.player.ch.root.position;
    const s = trackPoint(0, KART.lane);
    return Math.hypot(p.x - (s.x + 2.4), p.z - (s.z - 3.2)) < 2.6 || Math.hypot(p.x - s.x, p.z - s.z) < 1.8;
  },

  startKart() {
    if (!this.arcadeFree() || this.world !== this.gym) return;
    if (this.loop) this.stopLoop(true);
    const P = this.player;
    if (P.board) this.endBoard();
    if (P.jet) this.endJet();
    // a giant (or tiny) body and shadow clones don't fit in a kart or at the claw: back to normal first
    if (this.clones) this.endClones();
    if (this.morph) { this.morph = null; P.ch.root.scale.setScalar(1); }
    P.ch.stopAction();
    const g = this.gym;
    for (const K of g.kartIdle) K.g.visible = false;
    const grid = [[-0.5, 0.45], [-0.5, 1.95], [-1.4, 0.45], [-1.4, 1.95]];
    const make = (i, ch) => {
      const K = kartMesh(KART_COLORS[i], i + 1);
      const [dth, lane] = grid[i];
      const p = trackPoint(dth / (TRACK.a + 1), lane);
      K.g.position.set(p.x, 0, p.z);
      K.g.rotation.y = 0;
      g.scene.add(K.g);
      return { K, ch, x: p.x, z: p.z, h: 0, v: 0, steer: 0, lane, prog: trackAt(p.x, p.z).th, lastTh: trackAt(p.x, p.z).th, lap: 0, boost: 0, done: false, finishT: 0, skill: rand(1.02, 1.1), wob: rand(0, TAU), spin: 0 };
    };
    const me = make(0, P.ch);
    const ai = [1, 2, 3].map((i) => {
      const ch = new Character(Object.assign(randomOutfit(), { muscle: rand(0.2, 0.6) }));
      ch.setLabel(pick(NPC_NAMES), '🏎️ راننده', KART_COLORS[i]);
      ch.manual = true;
      ch.manualSnap = true;
      g.scene.add(ch.root);
      return make(i, ch);
    });
    // each driver keeps to a lane of their own (side by side they would only bump each other)
    ai.forEach((R, i) => { R.aiLane = [1.95, 0.45, 1.2][i]; });
    // the start line is at angle 0: begin with negative progress so the first crossing isn't a lap
    for (const R of [me, ...ai]) { R.prog = R.lastTh = trackAt(R.x, R.z).th; R.start = R.prog; }
    P.ch.manual = true;
    P.ch.manualSnap = true;
    this.kart = { me, ai, all: [me, ...ai], state: 'count', t: 3.2, time: 0, place: 0, finished: [], drift: 0, driftT: 0, turbos: 0, boost: 0, lightsT: 0 };
    $('kartPanel').hidden = false;
    this.drawKart();
    this.follow(me.K.g.position, 5.2, Math.PI, 0.26);
    Sfx.play('click');
    this.toast('🏎️ چپ و راست فرمونه، عقب ترمز. موقع پیچ «پرش» (فاصله) رو نگه دار تا دریفت بزنی و ولش کن تا توربو بگیری!', 'gold');
  },

  drawKart() {
    const K = this.kart;
    if (!K) return;
    const me = K.me;
    const lap = Math.min(KART.laps, Math.max(1, Math.floor((me.prog - me.start) / TAU) + 1));
    const order = this.kartOrder();
    const pos = order.indexOf(me) + 1;
    $('kartHead').textContent = K.state === 'count' ? '🏎️ آماده…' : K.state === 'done' ? `🏁 تموم شد — نفر ${fa(K.place)}` : `🏎️ دور ${fa(lap)} از ${fa(KART.laps)} · نفر ${fa(pos)} از ۴`;
    const n = K.state === 'count' ? Math.min(3, Math.max(0, Math.ceil(K.t - 0.2))) : 0;
    $('kartLights').textContent = K.state === 'count' ? (n === 0 ? '🟢🟢🟢' : '🔴'.repeat(4 - n) + '⚫'.repeat(n - 1)) : K.boost > 0 ? '🔥 توربو!' : K.drift > 0 ? `💨 دریفت ${'▮'.repeat(Math.min(3, Math.floor(K.driftT / 0.45)))}` : '';
  },

  kartOrder() {
    const K = this.kart;
    return [...K.all].sort((a, b) => (b.done ? 1e6 - b.finishT : b.prog - b.start) - (a.done ? 1e6 - a.finishT : a.prog - a.start));
  },

  tickKart(dt) {
    const K = this.kart;
    if (!K) return;
    const g = this.gym;
    if (this.world !== g || this.mode !== 'play' || this.race || this.arm) { this.endKart(null); return; }
    const paused = this.modals.size || this.watch || this.photo;
    const P = this.player;
    if (!paused) {
      if (K.state === 'count') {
        const before = Math.ceil(K.t - 0.2);
        K.t -= dt;
        const now = Math.ceil(K.t - 0.2);
        if (now !== before) Sfx.play(now <= 0 ? 'go' : 'tick');
        if (K.t <= 0.2) { K.state = 'go'; }
      } else K.time += dt;
      const inp = this.kartIn || { x: 0, y: 0 };
      const drifting = (this.keys.has('Space') || !!this.jumpHeld || !!this.kartDriftBtn) && K.state === 'go';
      for (const R of K.all) this.driveKart(R, R === K.me ? inp : null, drifting && R === K.me, dt);
      this.bumpKarts(dt);
    }
    // the player's body sits in its kart; the camera swings round behind it
    const me = K.me;
    P.ch.root.position.set(me.x, 0, me.z);
    P.ch.root.rotation.y = me.h;
    P.ch.airY = 0; P.ch.vy = 0; P.ch.grounded = true;
    P.vel.set(0, 0);
    kartPose(P.ch.manualPose, me.steer, Math.sin(this.clock * 30) * 0.004 * Math.min(1, me.v / 5));
    for (const R of K.ai) { R.ch.root.position.set(R.x, 0, R.z); R.ch.root.rotation.y = R.h; kartPose(R.ch.manualPose, R.steer, 0); R.ch.update(dt); }
    const cam = g.cam;
    cam.yaw = angleLerp(cam.yaw, me.h + Math.PI - me.steer * 0.25, damp(3.5, dt));
    this.drawKart();
    if (K.state === 'done') { K.doneT -= dt; if (K.doneT <= 0) this.endKart(true); }
  },

  driveKart(R, inp, drift, dt) {
    const K = this.kart;
    const going = K.state !== 'count';
    const at = trackAt(R.x, R.z);
    let throttle = going ? 1 : 0, steer = 0;
    if (inp) {
      steer = clamp(inp.x || 0, -1, 1);
      if ((inp.y || 0) > 0.4) throttle = -0.6;
      if (R.done) { throttle = 0; steer = 0; }
    } else if (going) {
      // drivers aim a little way ahead on their own lane, with some rubber band to keep it close
      const ahead = trackPoint(at.th + 0.32, (R.aiLane ?? R.lane) + Math.sin(K.time * 0.7 + R.wob) * 0.35);
      const want = Math.atan2(ahead.x - R.x, ahead.z - R.z);
      steer = clamp(-wrapAngle(want - R.h) * 2.2, -1, 1);
      const gap = (K.me.prog - K.me.start) - (R.prog - R.start);
      R.target = KART.vmax * R.skill * clamp(1 + gap * 0.09, 0.9, 1.3);
      if (R.done) throttle = 0.2;
    }
    // speed: throttle, grass, boosts
    const onGrass = Math.abs(at.off) > TRACK.w * 0.5 + 0.35;
    let vmax = (R.target || KART.vmax) * (onGrass ? KART.grass : 1) * (R.boost > 0 ? KART.boost : 1);
    if (R.spin > 0) { R.spin -= dt; vmax *= 0.3; R.h += dt * 9; }
    R.v += (throttle * vmax - R.v) * Math.min(1, dt * (throttle >= 0 ? KART.accel / Math.max(4, vmax) * 1.4 : 3));
    if (R.boost > 0) R.boost -= dt;
    // steering: sharper in a drift; the kart slides a little sideways
    R.steer += (steer - R.steer) * Math.min(1, dt * 8);
    const turn = (drift ? 2.6 : 1.9) * R.steer * Math.min(1, R.v / 5);
    R.h -= turn * dt;
    if (inp) {
      // a drift starts in a turn; once going it holds as long as the button does
      if (drift && R.v > 3 && (K.drift || Math.abs(R.steer) > 0.35)) {
        K.drift = 1;
        K.driftT += dt;
        if (Math.random() < 0.7) this.world.fx.emit(R.x - Math.sin(R.h) * 0.8 + rand(-0.3, 0.3), 0.1, R.z - Math.cos(R.h) * 0.8 + rand(-0.3, 0.3), rand(-1, 1), rand(0.5, 1.5), rand(-1, 1), new THREE.Color(K.driftT > 0.9 ? '#ff7b00' : K.driftT > 0.45 ? '#7fe0ff' : '#ffffff'), 0.35, 4);
      } else if (K.drift) {
        // let go of a long drift: a mini turbo
        if (K.driftT > 0.45) {
          R.boost = Math.max(R.boost, K.driftT > 0.9 ? 1.2 : 0.7);
          K.turbos++;
          Sfx.play('boost');
          this.floatText(K.driftT > 0.9 ? '🔥 توربوی بزرگ!' : '💨 توربو!', 'fl-combo');
        }
        K.drift = 0;
        K.driftT = 0;
      }
      K.boost = R.boost;
    }
    const side = drift && inp ? R.steer * 0.25 : 0;
    const dx = Math.sin(R.h) * R.v * dt + Math.cos(R.h) * side * R.v * dt * 0.3;
    const dz = Math.cos(R.h) * R.v * dt - Math.sin(R.h) * side * R.v * dt * 0.3;
    const pos = { x: R.x, z: R.z, y: 0 };
    this.world.moveBody(pos, dx, dz, R.h, 0, 2.6);
    // soft walls either side so nobody drives off round the gym
    const at2 = trackAt(pos.x, pos.z);
    if (Math.abs(at2.off) > TRACK.w * 0.5 + 2.2) {
      const back = trackPoint(at2.th, KART.lane + Math.sign(at2.off) * (TRACK.w * 0.5 + 2.2));
      pos.x += (back.x - pos.x) * 0.5; pos.z += (back.z - pos.z) * 0.5;
      R.v *= 0.92;
    }
    if (Math.hypot(pos.x - R.x - dx, pos.z - R.z - dz) > 0.05 && R.v > 3) R.v *= 0.9;
    R.x = pos.x; R.z = pos.z;
    // boost pads
    for (const pad of this.gym.kartPads) {
      if (Math.hypot(pad.x - R.x, pad.z - R.z) < 1.0 && R.boost < 1.2) {
        R.boost = 1.3;
        if (inp) { Sfx.play('boost'); this.floatText('⚡ صفحه‌ی توربو!', 'fl-combo'); }
      }
    }
    // a driver stuck against something for a while is put back on its lane, facing the right way
    if (!inp && going && !R.done) {
      R.stuckT = R.v < 1.5 ? (R.stuckT || 0) + dt : 0;
      if (R.stuckT > 1.2) {
        const at3 = trackAt(R.x, R.z);
        const back = trackPoint(at3.th + 0.05, R.aiLane ?? R.lane);
        if (this.gym.spotFree(back.x, back.z, 0.5)) {
          R.x = back.x; R.z = back.z;
          const ahead = trackPoint(at3.th + 0.2, R.aiLane ?? R.lane);
          R.h = Math.atan2(ahead.x - R.x, ahead.z - R.z);
          R.v = 4;
          this.world.fx.burst({ x: R.x, y: 0.5, z: R.z }, { count: 20, colors: ['#ffffff', '#cfd6e3'], speed: 2, up: 1, life: 0.5 });
        }
        R.stuckT = 0;
      }
    }
    // progress round the oval
    const th = trackAt(R.x, R.z).th;
    R.prog += wrapAngle(th - R.lastTh);
    R.lastTh = th;
    if (!R.done && R.prog - R.start >= KART.laps * TAU) {
      R.done = true;
      R.finishT = K.time;
      K.finished.push(R);
      if (R === K.me) this.finishKart();
    } else if (inp && !R.done) {
      const lap = Math.floor((R.prog - R.start) / TAU);
      if (lap > (R.lap || 0)) { R.lap = lap; Sfx.play('success'); if (lap === KART.laps - 1) this.showBanner('یه دور دیگه مونده!', '🏁 دور آخر'); }
    }
    // the kart itself: body, wheels turning, front wheels steering, people knocked over
    const m = R.K;
    m.g.position.set(R.x, 0, R.z);
    m.g.rotation.y = R.h + (drift && inp ? R.steer * 0.35 : 0);
    m.g.rotation.z = -R.steer * 0.05 * Math.min(1, R.v / 8);
    for (const w of m.wheels) {
      w.w.rotation.x += (R.v / 0.2) * dt;
      if (w.front) w.holder.rotation.y = -R.steer * 0.45;
    }
    m.wheelSteer.rotation.z = R.steer * 1.2;
    if (R.boost > 0 && Math.random() < 0.8) this.world.fx.emit(R.x - Math.sin(R.h) * 0.9, 0.3, R.z - Math.cos(R.h) * 0.9, -Math.sin(R.h) * 2 + rand(-0.4, 0.4), rand(0.2, 0.8), -Math.cos(R.h) * 2 + rand(-0.4, 0.4), new THREE.Color(pick(['#ff7b00', '#ffd34d', '#e63946'])), 0.35, 0);
    else if (R.v > 2 && Math.random() < 0.15) this.world.fx.emit(R.x - Math.sin(R.h) * 0.85, 0.3, R.z - Math.cos(R.h) * 0.85, rand(-0.2, 0.2), rand(0.3, 0.6), rand(-0.2, 0.2), KART_SMOKE, 0.6, -0.3);
    if (R.v > 4) {
      for (const q of this.world.npcs) {
        if (NO_GRAB.includes(q.state) || q.anchored) continue;
        const qp = q.ch.root.position;
        if (Math.hypot(qp.x - R.x, qp.z - R.z) < 0.8) { this.world.knockNpc(q, R.x, R.z); if (inp) Sfx.play('punch'); }
      }
    }
  },

  bumpKarts(dt) {
    const A = this.kart.all;
    for (let i = 0; i < A.length; i++) {
      for (let j = i + 1; j < A.length; j++) {
        const a = A[i], b = A[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.01 && d < 1.15) {
          const push = (1.15 - d) * 0.5;
          a.x -= (dx / d) * push; a.z -= (dz / d) * push;
          b.x += (dx / d) * push; b.z += (dz / d) * push;
          a.v *= 0.993; b.v *= 0.993;
          if (a === this.kart.me || b === this.kart.me) { if (!this.kartBumpT || this.clock - this.kartBumpT > 0.4) { this.kartBumpT = this.clock; Sfx.play('punch'); } }
        }
      }
    }
  },

  finishKart() {
    const K = this.kart;
    const place = K.finished.indexOf(K.me) + 1;
    K.place = place;
    K.state = 'done';
    K.doneT = 3;
    const st = this.save.stats;
    st.kartRaces = (st.kartRaces || 0) + 1;
    st.miniTurbos = (st.miniTurbos || 0) + K.turbos;
    if (place === 1) st.kartWins = (st.kartWins || 0) + 1;
    const coins = [0, 120, 60, 30, 10][place];
    this.addCoins(coins, true);
    this.gainXp(Math.round([0, 400, 220, 120, 60][place] * this.mult()));
    this.showBanner(`${fa(coins)} سکه · ${fa(K.time.toFixed(1))} ثانیه`, place === 1 ? '🏆 اول شدی!' : `🏁 نفر ${fa(place)}`);
    if (place === 1) { this.confetti(); Sfx.play('win'); } else Sfx.play(place === 2 ? 'success' : 'fail');
    this.checkAchievements();
    this.persist();
  },

  endKart(done) {
    const K = this.kart;
    if (!K) return;
    this.kart = null;
    this.kartIn = null;
    $('kartPanel').hidden = true;
    this.unfollow(true);
    for (const R of K.all) {
      R.K.g.removeFromParent();
      disposeDeep(R.K.g);
      if (R !== K.me) R.ch.dispose();
    }
    const g = this.gym;
    if (g && g.kartIdle) for (const k of g.kartIdle) k.g.visible = true;
    const P = this.player;
    if (P) {
      if (!P.board) P.ch.manual = false;
      // out of the kart, beside the track
      if (this.world === g) {
        const p = P.ch.root.position;
        const at = trackAt(p.x, p.z);
        const out = trackPoint(at.th, KART.lane + TRACK.w * 0.5 + 1.4);
        if (g.spotFree(out.x, out.z, 0.4)) p.set(out.x, 0, out.z);
      }
    }
  },

  /* ---------- the claw machine ---------- */

  nearClaw() {
    const p = this.player.ch.root.position;
    let best = null, bd = 1.5;
    for (const M of this.gym.claws || []) {
      const d = Math.hypot(p.x - M.C.x, p.z - (M.C.z + 1.5));
      if (d < bd) { bd = d; best = M; }
    }
    return best;
  },

  startClaw(M) {
    if (!this.arcadeFree() || !M) return;
    if (this.save.coins < 15) { Sfx.play('error'); this.toast('🧸 هر بار بازی ۱۵ سکه‌ست؛ سکه‌ت کافی نیست.', 'warn'); return; }
    if (this.loop) this.stopLoop(true);
    const P = this.player;
    if (P.board) this.endBoard();
    if (P.jet) this.endJet();
    // a giant (or tiny) body and shadow clones don't fit in a kart or at the claw: back to normal first
    if (this.clones) this.endClones();
    if (this.morph) { this.morph = null; P.ch.root.scale.setScalar(1); }
    this.save.coins -= 15;
    this.refreshHud && this.refreshHud(true);
    P.ch.stopAction();
    P.ch.manual = true;
    P.ch.manualSnap = false;
    P.ch.root.position.set(M.C.x, 0, M.C.z + 1.45);
    P.ch.root.rotation.y = Math.PI;
    M.x = 0; M.z = 0.2; M.y = 2.3; M.open = 1;
    this.clawGame = { M, phase: 'move', t: 15, prize: null };
    this.follow(new THREE.Vector3(M.C.x, 1.3, M.C.z + 0.1), 2.7, 0, 0.62);
    if (P.ch.label) P.ch.label.visible = false;
    $('clawPanel').hidden = false;
    Sfx.play('coin');
    this.toast('🕹️ با جهت‌ها چنگک رو ببر بالای یه عروسک و «بنداز!» رو بزن. ستاره‌ی طلایی ۲۵۰ سکه‌ست!', 'gold');
  },

  dropClaw() {
    const G = this.clawGame;
    if (!G || G.phase !== 'move') return;
    G.phase = 'down';
    Sfx.play('whoosh');
  },

  tickClaw(dt) {
    const G = this.clawGame;
    const g = this.gym;
    // the golden star returns to a machine some minutes after it was won
    if (g && g.claws) for (const M of g.claws) if (M.goldBackT && this.clock > M.goldBackT && !M.prizes.some((q) => q.gold)) { M.goldBackT = 0; const n = this.newPrize(g, M.C, true); n.ly = 1.1; M.prizes.push(n); }
    // prizes that were let go fall back into the pile
    if (g && g.claws) for (const M of g.claws) for (const P of M.prizes) {
      if (P.held || P.ly <= 0.0001 && P.vy === 0) continue;
      P.vy -= 9.8 * dt; P.ly += P.vy * dt;
      if (P.ly <= 0) { P.ly = 0; P.vy = Math.abs(P.vy) > 1 ? -P.vy * 0.3 : 0; }
      P.m.position.y = 1.0 + P.ly;
    }
    if (!G) return;
    if (this.world !== g || this.mode !== 'play' || this.race || this.arm) { this.endClaw(); return; }
    const M = G.M;
    const C = M.C;
    const pl = this.player;
    pl.ch.root.position.set(C.x, 0, C.z + 1.45);
    pl.ch.root.rotation.y = Math.PI;
    pl.vel.set(0, 0);
    const pose = pl.ch.manualPose;
    copyPose(pose, STAND);
    pose.shLX = -1.0; pose.elL = -0.7; pose.shRX = -1.0; pose.elR = -0.7; pose.spX = 0.15; pose.nkX = 0.2;
    if (this.modals.size || this.watch || this.photo) return;
    if (G.phase === 'move') {
      G.t -= dt;
      const inp = this.clawIn || { x: 0, y: 0 };
      M.x = clamp(M.x + (inp.x || 0) * 0.55 * dt, -0.62, 0.62);
      M.z = clamp(M.z + (inp.y || 0) * 0.55 * dt, -0.62, 0.5);
      pose.shLX = -1.0 + (inp.y || 0) * 0.15; pose.shLZ = 0.12 - (inp.x || 0) * 0.15;
      $('clawHead').textContent = `🕹️ ${fa(Math.ceil(G.t))} ثانیه · چنگک رو ببر بالای جایزه`;
      if (G.t <= 0) this.dropClaw();
    } else if (G.phase === 'down') {
      M.y -= dt * 0.9;
      const floor = 1.1 + Math.max(0, ...M.prizes.filter((P) => Math.hypot(P.lx - M.x, P.lz - M.z) < 0.15).map((P) => P.ly + P.r * 1.4));
      if (M.y <= floor) { M.y = floor; G.phase = 'close'; G.t = 0.5; Sfx.play('clank'); }
    } else if (G.phase === 'close') {
      G.t -= dt;
      M.open = Math.max(0, M.open - dt * 2.5);
      if (G.t <= 0) {
        // what is right under the claw gets picked up — or slips
        let best = null, bd = 1;
        for (const P of M.prizes) { const d = Math.hypot(P.lx - M.x, P.lz - M.z); if (d < bd) { bd = d; best = P; } }
        const chance = bd < 0.1 ? 0.72 : bd < 0.2 ? 0.3 : 0;
        if (best && Math.random() < chance * (best.gold ? 0.18 : 1)) { G.prize = best; best.held = true; G.slip = Math.random() < 0.2; }
        G.phase = 'up';
        Sfx.play('charge');
      }
    } else if (G.phase === 'up') {
      M.y = Math.min(2.3, M.y + dt * 0.8);
      if (G.prize && G.slip && M.y > 1.75) { this.letGo(G.prize); G.prize = null; this.floatText('😱 از دستش افتاد!', ''); Sfx.play('fail'); }
      if (M.y >= 2.3) { G.phase = 'home'; }
    } else if (G.phase === 'home') {
      // over to the chute
      const tx = 0.55, tz = 0.55;
      M.x += clamp(tx - M.x, -dt * 0.7, dt * 0.7);
      M.z += clamp(tz - M.z, -dt * 0.7, dt * 0.7);
      if (Math.abs(M.x - tx) < 0.01 && Math.abs(M.z - tz) < 0.01) { G.phase = 'release'; G.t = 0.6; M.open = 1; Sfx.play('click'); }
    } else if (G.phase === 'release') {
      G.t -= dt;
      if (G.t <= 0) { this.clawPrize(G.prize); this.endClaw(); return; }
    }
    if (G.prize) {
      const P = G.prize;
      P.lx = M.x; P.lz = M.z; P.ly = M.y - 1.0 - P.r * 2.1;
      P.m.position.set(C.x + P.lx, 1.0 + P.ly, C.z + P.lz);
    }
    this.placeClaw(M);
  },

  letGo(P) {
    P.held = false;
    P.vy = 0;
    P.lx = clamp(P.lx, -0.6, 0.45);
    P.lz = clamp(P.lz, -0.6, 0.35);
  },

  clawPrize(P) {
    const G = this.clawGame;
    const st = this.save.stats;
    if (!P) {
      this.showBanner('یه دفعه‌ی دیگه امتحان کن!', '🧸 چیزی نگرفت');
      Sfx.play('fail');
      return;
    }
    const M = G.M;
    // gone down the chute; a new one drops in from the top
    P.m.removeFromParent();
    if (P.gold) P.m.material.dispose();
    P.m.geometry.dispose();
    M.prizes.splice(M.prizes.indexOf(P), 1);
    // a won star comes back only after a while; a plush takes its place
    const n = this.newPrize(this.gym, M.C, false);
    if (P.gold) M.goldBackT = this.clock + 180;
    n.ly = 1.1; n.vy = 0;
    M.prizes.push(n);
    st.clawPrizes = (st.clawPrizes || 0) + 1;
    const coins = P.gold ? 250 : randi(6, 22);
    if (P.gold) st.clawGold = (st.clawGold || 0) + 1;
    this.addCoins(coins, true);
    this.gainXp(Math.round((P.gold ? 200 : 40) * this.mult()));
    this.showBanner(`+${fa(coins)} سکه`, P.gold ? '🌟 ستاره‌ی طلایی!' : '🧸 جایزه گرفتی!');
    this.confetti();
    Sfx.play(P.gold ? 'jackpot' : 'win');
    this.player.ch.manual = false;
    this.player.ch.play(P.gold ? 'e_victory' : 'e_clap');
    this.checkAchievements();
    this.persist();
  },

  endClaw() {
    const G = this.clawGame;
    if (!G) return;
    this.clawGame = null;
    this.clawIn = null;
    $('clawPanel').hidden = true;
    this.unfollow(true);
    if (G.prize && G.prize.held) this.letGo(G.prize);
    const M = G.M;
    M.x = 0; M.z = 0.2; M.y = 2.3; M.open = 1;
    this.placeClaw(M);
    const P = this.player;
    if (P && !P.board) P.ch.manual = false;
    if (P && P.ch.label) P.ch.label.visible = !WorldBase.hideNames;
  },

  /* ---------- the lightning storm ---------- */

  startStorm() {
    const pw = POWER_BY_ID.storm;
    if (this.mode !== 'play' || this.modals.size || this.race || this.arm || this.photo || this.build) return;
    if (!this.powerUnlocked(pw)) { Sfx.play('error'); this.toast(`🔒 قدرت «${pw.name}» در سطح ${fa(pw.level)} باز می‌شه.`, 'warn'); return; }
    if (this.powerCd.storm > 0 || this.storm || this.cannon || this.meter || this.lockMove) return;
    Sfx.init();
    const w = this.world;
    const p = this.player.ch.root.position;
    const targets = w.npcs.filter((q) => !NO_GRAB.includes(q.state) && !q.anchored && q.ch.root.position.distanceTo(p) < 18)
      .sort((a, b) => a.ch.root.position.distanceTo(p) - b.ch.root.position.distanceTo(p)).slice(0, 7);
    const list = targets.map((q) => ({ q }));
    while (list.length < 4) { const a = rand(0, TAU), r = rand(3, 9); list.push({ x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r }); }
    this.storm = { w, list, i: 0, t: 0.35, bolts: [], hits: 0 };
    this.powerCd.storm = pw.cd;
    this.save.stats.powers++;
    this.missionProgress('power', 1);
    this.showBanner('آسمون می‌غره!', '⚡ طوفان رعد');
    Sfx.play('charge');
    $('flashFx').classList.add('storm');
    this.gainXp(Math.round(pw.xp * this.mult()));
    this.refreshPowers();
  },

  tickStorm(dt) {
    const S = this.storm;
    if (!S) return;
    if (S.w !== this.world || this.mode !== 'play') { this.endStorm(); return; }
    if (this.modals.size || this.watch || this.photo) return;
    for (let i = S.bolts.length - 1; i >= 0; i--) {
      const B = S.bolts[i];
      B.t -= dt;
      B.core.material.opacity = Math.max(0, B.t / 0.3) * (0.6 + 0.4 * Math.random());
      B.glow.material.opacity = Math.max(0, B.t / 0.3) * 0.35;
      if (B.scorch) B.scorch.material.opacity = Math.min(0.6, B.t);
      if (B.t <= -2.5) { for (const m of [B.core, B.glow, B.scorch]) { m.removeFromParent(); m.geometry.dispose(); m.material.dispose(); } S.bolts.splice(i, 1); }
    }
    S.t -= dt;
    if (S.t <= 0 && S.i < S.list.length) {
      S.t = 0.24;
      this.strike(S, S.list[S.i++]);
    }
    if (S.i >= S.list.length && !S.bolts.length) this.endStorm();
  },

  strike(S, T) {
    const w = S.w;
    const q = T.q && w.npcs.includes(T.q) && !NO_GRAB.includes(T.q.state) ? T.q : null;
    const tx = q ? q.ch.root.position.x : T.x, tz = q ? q.ch.root.position.z : T.z;
    const top = Math.min(w.ceiling || 30, 14);
    // a jagged bolt from the sky (or the ceiling) to the target
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const u = k / 10;
      const j = k === 0 || k === 10 ? 0 : 0.55 * (1 - u * 0.4);
      pts.push(new THREE.Vector3(tx + rand(-j, j), top - (top - 0.2) * u + (q ? 0.9 * u : 0), tz + rand(-j, j)));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
    const core = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.045, 4), new THREE.MeshBasicMaterial({ color: '#f4f8ff', transparent: true, opacity: 1, toneMapped: false, depthWrite: false }));
    const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.22, 6), new THREE.MeshBasicMaterial({ color: '#7fb2ff', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, toneMapped: false, depthWrite: false }));
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), new THREE.MeshBasicMaterial({ color: '#1a1a1a', transparent: true, opacity: 0.6, depthWrite: false }));
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.set(tx, 0.02, tz);
    for (const m of [core, glow, scorch]) { m.userData.noSolid = true; w.scene.add(m); }
    S.bolts.push({ core, glow, scorch, t: 0.3 });
    w.fx.burst({ x: tx, y: 0.5, z: tz }, { count: 36, colors: ['#ffffff', '#bcd4ff', '#ffe26b'], speed: 6, up: 3, life: 0.6 });
    w.fx.ring({ x: tx, y: 0.1, z: tz }, { count: 30, color: '#9fc3ff', radius: 0.3, speed: 6, life: 0.5 });
    w.shake = Math.max(w.shake || 0, 0.35);
    Sfx.play('zap');
    setTimeout(() => Sfx.play('boom'), 120);
    const f = $('flashFx');
    f.classList.remove('hit'); void f.offsetWidth; f.classList.add('hit');
    if (q) {
      w.knockNpc(q, tx + rand(-1, 1), tz + rand(-1, 1));
      q.ch.setLabel(q.name, '⚡ جززززز!', '#ffe26b');
      S.hits++;
      const st = this.save.stats;
      if (S.hits > (st.stormBest || 0)) { st.stormBest = S.hits; if (S.hits === 7) this.checkAchievements(); }
    }
  },

  endStorm() {
    const S = this.storm;
    if (!S) return;
    this.storm = null;
    for (const B of S.bolts) for (const m of [B.core, B.glow, B.scorch]) { m.removeFromParent(); m.geometry.dispose(); m.material.dispose(); }
    $('flashFx').classList.remove('storm');
    if (S.hits) this.floatText(`⚡ ${fa(S.hits)} نفر برق‌گرفته!`, 'fl-combo');
  },

  /* ---------- the menu ---------- */

  goKart() {
    this.closeModal('menuModal');
    if (this.world !== this.gym) { this.toast('کارتینگ روی پیست وسط باشگاه اوله؛ اول برگرد باشگاه.', 'warn'); return; }
    const s = trackPoint(0, KART.lane);
    this.quickTravel(s.x + 2.4, s.z - 3.2);
    const p = this.player.ch.root.position;
    if (this.world === this.gym && Math.hypot(p.x - s.x - 2.4, p.z - s.z + 3.2) < 3) this.startKart();
  },

  /* ---------- every frame ---------- */

  tickFun9(dt) {
    const g = this.gym;
    // a wheel prize that was still spinning when the page closed is paid now
    const pw = this.save && this.save.fun && this.save.fun.pendingWheel;
    if (pw != null && this.mode === 'play' && !this.spinning && !this.modals.size) {
      const i = Math.floor(Number(pw));
      if (WHEEL[i]) this.wheelReward(WHEEL[i]); else delete this.save.fun.pendingWheel;
      this.persist();
    }
    if (g && !g.fun9) this.buildFun9(g);
    this.tickKart(dt);
    this.tickClaw(dt);
    this.tickStorm(dt);
  },
});
const KART_SMOKE = new THREE.Color('#cfd6e3');

/* ---------- hooks into what is already there ---------- */

const _miniBusy9 = Game.miniBusy;
Game.miniBusy = function () { return !!(this.kart || this.clawGame) || _miniBusy9.call(this); };

const _usePower9 = Game.usePower;
Game.usePower = function (id) {
  if (id === 'storm') { if (!this.miniBusy()) this.startStorm(); return; }
  _usePower9.call(this, id);
};

const _quickTravel9 = Game.quickTravel;
Game.quickTravel = function (x, z, special) {
  if (this.kart) {
    if (this.kart.state !== 'done') { this.closeModal('qtModal'); this.toast('وسط مسابقه‌ی کارتینگ نمی‌شه جابه‌جا شد! 🏎️ (✕ رو بزن تا بیای بیرون)', 'warn'); return; }
    this.endKart(true);
  }
  if (this.world === this.gym && this.mode === 'play' && !this.race && !this.arm && !this.build && !this.photo) this.endClaw();
  _quickTravel9.call(this, x, z, special);
};

const _input9 = Game.input;
Game.input = function () {
  const r = _input9.call(this);
  // the kart and the claw read the stick themselves (the body is held still)
  if (this.kart) this.kartIn = { x: r.x || 0, y: r.y || 0 };
  if (this.clawGame) this.clawIn = { x: r.x || 0, y: r.y || 0 };
  return r;
};

const _ctx9 = Game.contextAction;
Game.contextAction = function () {
  if (this.clawGame) return this.clawGame.phase === 'move' ? { label: '⬇️ بنداز!', run: () => this.dropClaw() } : null;
  if (this.kart) return null;
  if (this.world === this.gym && this.gym.fun9 && this.arcadeFree()) {
    if (this.nearKartStart()) return { label: '🏎️ مسابقه‌ی کارتینگ', run: () => this.startKart() };
    const M = this.nearClaw();
    if (M) return { label: '🕹️ دستگاه عروسک (۱۵ سکه)', run: () => this.startClaw(M) };
  }
  return _ctx9.call(this);
};

const _emoteDone9 = Game.emoteDone;
Game.emoteDone = function (m) {
  _emoteDone9.call(this, m);
  if (m && m.id === 'e_hula') {
    const st = this.save.stats;
    st.hulas = (st.hulas || 0) + 1;
    if (st.hulas === 1) this.checkAchievements();
  }
};

const _rebuildPlayer9 = Game.rebuildPlayer;
Game.rebuildPlayer = function (...args) {
  const r = _rebuildPlayer9.apply(this, args);
  if (this.player && (this.kart || this.clawGame)) { this.player.ch.manual = true; this.player.ch.manualSnap = !!this.kart; }
  if (this.player && this.clawGame && this.player.ch.label) this.player.ch.label.visible = false;
  if (this.kart && this.player) this.kart.me.ch = this.player.ch;
  return r;
};

/* the panels' own buttons */
{
  // the drift button: held with one thumb while the other steers (it keeps the press even if the thumb slides off)
  const b = $('kartDrift');
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ } Game.kartDriftBtn = true; });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { Game.kartDriftBtn = false; });
}
$('kartCancel').addEventListener('click', () => { if (Game.kart) { Game.endKart(null); Game.toast('🏎️ از مسابقه اومدی بیرون.'); } });
$('clawCancel').addEventListener('click', () => { if (Game.clawGame) Game.endClaw(); });
$('clawDrop').addEventListener('pointerdown', (e) => { e.preventDefault(); Game.dropClaw(); });
