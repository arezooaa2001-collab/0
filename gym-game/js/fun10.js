'use strict';
/*
 * Round sixteen: a chicken chase (eight runaway chickens, sixty seconds, a coop to bring them
 * back to), a portal power (two glowing rings: whoever walks into one comes out of the other),
 * an energy blast and a juggling act, and medals.
 */

POWERS.push({ id: 'portal', name: 'دروازه‌ی جادویی', icon: '🌀', level: 380, cd: 45, xp: 90, key: '[' });
for (const p of POWERS) POWER_BY_ID[p.id] = p;

const EMOTES10 = [['e_energy', 'موج انرژی', '🔆'], ['e_juggle', 'تردستی', '🤹']]
  .map(([id, name, icon]) => ({ id, name, icon, level: 1, cat: 'fun', emote: true }));
MOVES.push(...EMOTES10);
for (const e of EMOTES10) MOVE_BY_ID[e.id] = e;
if (typeof DANCE_POOL !== 'undefined') DANCE_POOL.push('e_energy', 'e_juggle');

Object.assign(EXTRA_PROPS, {
  juggle(ch, pr) {
    const holder = new THREE.Group();
    const balls = ['#e63946', '#ffd34d', '#2f6fed'].map((c) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }));
      holder.add(m);
      return m;
    });
    ch.root.add(holder);
    pr.meshes.push(holder);
    pr.tick = (c) => {
      // a three-ball cascade over the hands, in front of the chest
      const t = (c.actionT || 0) * 2.2;
      balls.forEach((b, i) => {
        const u = (t + i / 3) % 1;
        const side = Math.floor(t + i / 3) % 2 ? 1 : -1;
        b.position.set(side * (0.22 - 0.44 * u), 1.18 + Math.sin(Math.PI * u) * 0.55, 0.32);
      });
    };
  },
});

Object.assign(ANIMS, {
  e_energy: {
    dur: 3.0,
    events: [[0.1, 'charge'], [0.62, 'blast']],
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.1)) * (1 - smooth(seg(t, 0.9, 1)));
      const charge = smooth(seg(t, 0.08, 0.55));
      const push = smooth(seg(t, 0.58, 0.66));
      const q = makePose();
      // cupped hands at the hip, gathering… then both palms thrust forward
      q.hpLX = -0.45; q.knL = 0.55; q.hpRX = 0.35; q.knR = 0.25; q.y = -0.12;
      q.spY = lerp(0.6 * charge, -0.1, push);
      q.shLX = lerp(-0.4, -1.55, push); q.shRX = lerp(-0.4, -1.55, push);
      q.shLZ = lerp(-0.35, 0.12, push); q.shRZ = lerp(0.35, -0.12, push);
      q.elL = q.elR = lerp(-1.9, -0.05, push);
      q.spX = 0.15 - 0.2 * push; q.nkX = 0.1;
      mixInto(p, q, k);
    },
  },
  e_juggle: {
    dur: 3.4,
    props: ['juggle'],
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.08)) * (1 - smooth(seg(t, 0.92, 1)));
      const a = t * 3.4 * 2.2 * TAU;
      const q = makePose();
      q.shLX = -0.75 + 0.18 * Math.sin(a); q.shRX = -0.75 - 0.18 * Math.sin(a);
      q.elL = -1.25 + 0.2 * Math.cos(a); q.elR = -1.25 - 0.2 * Math.cos(a);
      q.shLZ = 0.25; q.shRZ = -0.25;
      q.nkX = -0.35; q.knL = q.knR = 0.1;
      mixInto(p, q, k);
    },
  },
});

ACHIEVEMENTS.push(
  { id: 'chicken', name: 'مرغ‌گیر', icon: '🐔', desc: 'یه مرغ فراری رو بگیر و ببر توی لونه', test: (s) => (s.stats.chickens || 0) >= 1 },
  { id: 'farmer', name: 'کشاورز نمونه', icon: '👨‍🌾', desc: 'هر ۸ تا مرغ رو توی یه بازی بگیر', test: (s) => (s.stats.chickenAll || 0) >= 1 },
  { id: 'portal', name: 'مسافر دروازه', icon: '🌀', desc: 'از یه دروازه‌ی جادویی رد شو', test: (s) => (s.stats.portals || 0) >= 1 },
  { id: 'energy', name: 'موج انرژی', icon: '🔆', desc: 'یه موج انرژی شلیک کن', test: (s) => (s.stats.energyBlasts || 0) >= 1 },
);

const COOP = { x: -33, z: 27.2, w: 3.4, d: 2.4 };
const CHICK_AREA = { x1: -44, x2: -18, z1: 16, z2: 30 };
GYM_SPOTS.push(['🐔', 'مرغ‌های فراری', -31, 22]);

function chickenMesh() {
  const g = new THREE.Group();
  const b = new Batch();
  b.add(UnitGeo.sphere(12, 10), 0, 0.26, 0, '#fbfbf7', 0, 0, 0, 0.17, 0.15, 0.21);
  b.add(UnitGeo.sphere(10, 8), 0, 0.31, -0.2, '#f1f1ea', -0.6, 0, 0, 0.07, 0.11, 0.05);
  b.add(UnitGeo.cone(6), 0, 0.27, 0.27, '#ffb000', Math.PI / 2, 0, 0, 0.03, 0.07, 0.03);
  const body = new THREE.Mesh(mergeParts(b.parts, false), MATTE_MAT);
  g.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.42, 0.13);
  const hb = new Batch();
  hb.sphere(0.085, 0, 0, 0, '#fbfbf7');
  hb.add(UnitGeo.cone(6), 0, -0.01, 0.1, '#ffb000', Math.PI / 2, 0, 0, 0.025, 0.06, 0.02);
  hb.add(UnitGeo.sphere(8, 6), 0, 0.08, 0.01, '#e63946', 0, 0, 0, 0.02, 0.05, 0.06);
  hb.add(UnitGeo.sphere(8, 6), 0, -0.07, 0.07, '#e63946', 0, 0, 0, 0.018, 0.03, 0.015);
  hb.sphere(0.014, 0.05, 0.02, 0.07, '#111111');
  hb.sphere(0.014, -0.05, 0.02, 0.07, '#111111');
  head.add(new THREE.Mesh(mergeParts(hb.parts, false), MATTE_MAT));
  g.add(head);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: '#eeeee4', roughness: 0.8 }));
    w.scale.set(0.03, 0.09, 0.14);
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.15, 0.3, 0);
    w.position.y = -0.06;
    pivot.add(w);
    g.add(pivot);
    wings.push(pivot);
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 5).translate(0, -0.07, 0), new THREE.MeshStandardMaterial({ color: '#ffb000' }));
    l.position.set(s * 0.06, 0.14, 0.02);
    g.add(l);
    legs.push(l);
  }
  const sh = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT);
  sh.scale.set(0.45, 1, 0.5);
  sh.position.y = 0.012;
  g.add(sh);
  g.traverse((o) => { o.userData.noSolid = true; });
  return { g, head, wings, legs };
}

Object.assign(Game, {
  /* ---------- the coop ---------- */

  buildFun10(g) {
    g.fun10 = true;
    const add = (m, solid) => { if (!solid) m.userData.noSolid = true; g.scene.add(m); return m; };
    const wood = new THREE.MeshStandardMaterial({ color: '#a0703c', roughness: 0.85 });
    const C = COOP;
    // straw on the floor, a little house at the back, a low fence with the front open
    const straw = add(new THREE.Mesh(new THREE.PlaneGeometry(C.w, C.d), new THREE.MeshStandardMaterial({
      map: makeCanvasTexture(128, 96, (ctx, w, h) => { ctx.fillStyle = '#d9b45a'; ctx.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { ctx.strokeStyle = `rgba(${150 + rand(0, 80)},${110 + rand(0, 60)},40,0.8)`; const x = rand(0, w), y = rand(0, h), a = rand(0, TAU); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); ctx.stroke(); } }),
      roughness: 0.95,
    })));
    straw.rotation.x = -Math.PI / 2;
    straw.position.set(C.x, 0.013, C.z);
    const house = add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.9), new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.8 })), true);
    house.position.set(C.x, 0.5, C.z + C.d / 2 + 0.2);
    const roof = add(new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.6, 4), wood));
    roof.position.set(C.x, 1.3, C.z + C.d / 2 + 0.2);
    roof.rotation.y = Math.PI / 4;
    const door = add(new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), new THREE.MeshStandardMaterial({ color: '#2a1a10' })));
    door.position.set(C.x, 0.25, C.z + C.d / 2 - 0.26);
    door.rotation.y = Math.PI;
    for (const [x1, z1, x2, z2] of [[-1, -1, -1, 1], [1, -1, 1, 1], [-1, 1, 1, 1]]) {
      const ax = C.x + x1 * C.w / 2, az = C.z + z1 * C.d / 2, bx = C.x + x2 * C.w / 2, bz = C.z + z2 * C.d / 2;
      const len = Math.hypot(bx - ax, bz - az);
      const rail = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, len), wood));
      rail.position.set((ax + bx) / 2, 0.5, (az + bz) / 2);
      rail.rotation.y = Math.atan2(bx - ax, bz - az);
      for (let k = 0; k <= Math.round(len / 0.6); k++) {
        const u = k / Math.round(len / 0.6);
        add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.06), wood), true).position.set(ax + (bx - ax) * u, 0.31, az + (bz - az) * u);
      }
    }
    this.hangSign(g, 'مرغ‌های فراری 🐔', '#ffd34d', C.x, 6.1, C.z - 1.6, 4.4);
    g.solids = null;
  },

  nearCoop() {
    const p = this.player.ch.root.position;
    return Math.hypot(p.x - COOP.x, p.z - (COOP.z - COOP.d / 2 - 0.6)) < 2.2;
  },

  /* ---------- the chicken chase ---------- */

  startChickens() {
    if (!this.arcadeFree() || this.world !== this.gym) return;
    if (this.loop) this.stopLoop(true);
    const g = this.gym;
    const list = [];
    for (let i = 0; i < 8; i++) {
      const M = chickenMesh();
      let x = 0, z = 0;
      for (let k = 0; k < 30; k++) {
        x = rand(CHICK_AREA.x1 + 1, CHICK_AREA.x2 - 1); z = rand(CHICK_AREA.z1 + 1, CHICK_AREA.z2 - 3);
        if (g.spotFree(x, z, 0.3) && Math.hypot(x - COOP.x, z - COOP.z) > 4) break;
      }
      M.g.position.set(x, 0, z);
      M.g.rotation.y = rand(-Math.PI, Math.PI);
      g.scene.add(M.g);
      list.push({ M, x, z, h: M.g.rotation.y, v: 0, state: 'wander', t: rand(0.5, 2), phase: rand(0, TAU), hop: 0 });
    }
    this.chick = { list, t: 60, caught: 0, carry: null, cluckT: 1 };
    $('chickPanel').hidden = false;
    Sfx.play('whistle');
    this.toast('🐔 به مرغ‌ها برس تا بپرن روی سرت، بعد ببرشون توی لونه (جلوش باز است). ۶۰ ثانیه وقت داری!', 'gold');
  },

  tickChickens(dt) {
    const C = this.chick;
    if (!C) return;
    const g = this.gym;
    if (this.world !== g || this.mode !== 'play' || this.race || this.arm) { this.endChickens(null); return; }
    if (this.modals.size || this.watch || this.photo) return;
    const P = this.player;
    const pp = P.ch.root.position;
    C.t -= dt;
    this.setText('chickHead', `🐔 ${fa(C.caught)} از ۸ · ⏱️ ${fa(Math.max(0, Math.ceil(C.t)))}${C.carry ? ' · ببرش توی لونه!' : ''}`);
    C.cluckT -= dt;
    if (C.cluckT <= 0) { C.cluckT = rand(0.6, 1.6); Sfx.note(rand(700, 950), 0.07, { type: 'square', vol: 0.03, to: rand(500, 650) }); }
    const inPen = (x, z) => Math.abs(x - COOP.x) < COOP.w / 2 - 0.25 && Math.abs(z - COOP.z) < COOP.d / 2 - 0.2;
    for (const K of C.list) {
      const M = K.M;
      if (K.state === 'carried') {
        // sitting on your head, flapping
        P.ch.root.updateMatrixWorld(true);
        P.ch.B.head.getWorldPosition(_chickV);
        M.g.position.set(_chickV.x, _chickV.y + 0.17 * P.ch.root.scale.y, _chickV.z);
        M.g.rotation.y = P.ch.root.rotation.y;
        for (const w of M.wings) w.rotation.z = (w.position.x > 0 ? -1 : 1) * (0.4 + 0.6 * Math.abs(Math.sin(this.clock * 18)));
        if (Math.random() < dt * 6) this.world.fx.emit(M.g.position.x, M.g.position.y + 0.2, M.g.position.z, rand(-0.6, 0.6), rand(0.2, 0.8), rand(-0.6, 0.6), FEATHER, 0.7, 2);
        // into the coop: hop down onto the straw
        if (Math.hypot(pp.x - COOP.x, pp.z - COOP.z) < 2.2) {
          K.state = 'home';
          K.x = COOP.x + rand(-1, 1); K.z = COOP.z + rand(-0.6, 0.6);
          C.carry = null;
          C.caught++;
          const st = this.save.stats;
          st.chickens = (st.chickens || 0) + 1;
          if (st.chickens === 1) this.checkAchievements();
          this.addCoins(12, true);
          this.floatText(`🐔 ${fa(C.caught)}/۸`, 'fl-coin');
          Sfx.play('success');
          if (C.caught >= 8) { this.endChickens(true); return; }
        }
        continue;
      }
      const d = Math.hypot(K.x - pp.x, K.z - pp.z);
      if (K.state === 'home') {
        // pecking about in the coop
        K.t -= dt;
        if (K.t <= 0) { K.t = rand(0.8, 2.5); K.h = rand(-Math.PI, Math.PI); K.v = rand(0, 0.5); }
        const nx = K.x + Math.sin(K.h) * K.v * dt, nz = K.z + Math.cos(K.h) * K.v * dt;
        if (inPen(nx, nz)) { K.x = nx; K.z = nz; } else K.h += Math.PI;
      } else {
        // free: wander, and run (zig-zagging, wings out) when you come close
        if (d < 4.5) {
          K.state = 'flee';
          const away = Math.atan2(K.x - pp.x, K.z - pp.z);
          K.h = angleLerp(K.h, away + Math.sin(this.clock * 5 + K.phase) * 0.7, damp(5, dt));
          K.v += (4.6 - K.v) * damp(4, dt);
        } else {
          K.state = 'wander';
          K.t -= dt;
          if (K.t <= 0) { K.t = rand(1, 3); K.h += rand(-1.5, 1.5); K.v = Math.random() < 0.4 ? 0 : rand(0.5, 1.1); }
          K.v += ((K.v > 1.2 ? 1 : K.v) - K.v) * damp(2, dt);
        }
        const pos = { x: K.x, z: K.z, y: 0 };
        this.world.moveBody(pos, Math.sin(K.h) * K.v * dt, Math.cos(K.h) * K.v * dt, K.h, 0, 0.8);
        // stay in the barnyard; bump off things by turning round
        if (pos.x < CHICK_AREA.x1 || pos.x > CHICK_AREA.x2 || pos.z < CHICK_AREA.z1 || pos.z > CHICK_AREA.z2 || inPen(pos.x, pos.z)) { K.h += Math.PI * rand(0.6, 1.2); }
        else if (Math.hypot(pos.x - K.x - Math.sin(K.h) * K.v * dt, pos.z - K.z - Math.cos(K.h) * K.v * dt) > 0.01) { K.h += rand(1, 2.5); K.x = pos.x; K.z = pos.z; }
        else { K.x = pos.x; K.z = pos.z; }
        // caught: you touch it with nothing on your head
        if (!C.carry && d < 0.85 && !P.ch.busy) {
          K.state = 'carried';
          C.carry = K;
          Sfx.play('punch');
          Sfx.note(1100, 0.12, { type: 'square', vol: 0.06, to: 700 });
          this.floatText('🐔 گرفتمش!', 'fl-combo');
          this.world.fx.burst({ x: K.x, y: 0.5, z: K.z }, { count: 18, colors: ['#ffffff', '#fbfbf7', '#ffd34d'], speed: 2, up: 2, life: 0.8 });
          continue;
        }
      }
      // legs, head bob, wings out when running
      K.phase += dt * (6 + K.v * 5);
      const run = clamp(K.v / 4, 0, 1);
      M.legs[0].rotation.x = Math.sin(K.phase) * 0.8 * Math.min(1, K.v);
      M.legs[1].rotation.x = -Math.sin(K.phase) * 0.8 * Math.min(1, K.v);
      M.head.position.z = 0.13 + Math.sin(K.phase * 2) * 0.03 * Math.min(1, K.v + 0.3);
      M.head.rotation.x = K.v < 0.1 ? Math.max(0, Math.sin(this.clock * 3 + K.phase)) * 0.9 : 0;
      for (const w of M.wings) w.rotation.z = (w.position.x > 0 ? -1 : 1) * run * (0.5 + 0.5 * Math.sin(this.clock * 22 + K.phase));
      M.g.position.set(K.x, Math.abs(Math.sin(K.phase)) * 0.04 * run, K.z);
      M.g.rotation.y = angleLerp(M.g.rotation.y, K.h, damp(10, dt));
    }
    if (C.t <= 0) this.endChickens(true);
  },

  endChickens(done) {
    const C = this.chick;
    if (!C) return;
    this.chick = null;
    $('chickPanel').hidden = true;
    for (const K of C.list) { K.M.g.removeFromParent(); disposeDeep(K.M.g); }
    if (!done) return;
    const st = this.save.stats;
    const all = C.caught >= 8;
    if (all) {
      st.chickenAll = (st.chickenAll || 0) + 1;
      this.addCoins(60, true);
      this.confetti();
      Sfx.play('cheer');
    }
    st.chickenBest = Math.max(st.chickenBest || 0, C.caught);
    this.gainXp(Math.round(C.caught * 40 * this.mult()));
    this.showBanner(all ? 'همه‌ی مرغ‌ها برگشتن خونه! +۶۰ سکه' : `${fa(C.caught)} از ۸ مرغ برگشتن`, all ? '👨‍🌾 کشاورز نمونه!' : '🐔 تموم شد');
    this.checkAchievements();
    this.persist();
  },

  /* ---------- portals ---------- */

  startPortal() {
    const pw = POWER_BY_ID.portal;
    if (this.mode !== 'play' || this.modals.size || this.race || this.arm || this.photo || this.build) return;
    if (!this.powerUnlocked(pw)) { Sfx.play('error'); this.toast(`🔒 قدرت «${pw.name}» در سطح ${fa(pw.level)} باز می‌شه.`, 'warn'); return; }
    if (this.powerCd.portal > 0 || this.portals || this.cannon || this.meter || this.lockMove) return;
    const P = this.player;
    if (P.anchor || !P.ch.grounded) return;
    const w = this.world;
    const p = P.ch.root.position;
    const yaw = P.ch.root.rotation.y;
    // the near one just in front of you, the far one up to 35 m ahead (or anywhere open)
    const near = { x: p.x + Math.sin(yaw) * 2.2, z: p.z + Math.cos(yaw) * 2.2 };
    if (!w.inBounds(near.x, near.z, 1) || !w.spotFree(near.x, near.z, 0.8)) { Sfx.play('error'); this.toast('🌀 جلوت جا برای دروازه نیست!', 'warn'); return; }
    let far = null;
    for (let d = 35; d >= 9 && !far; d -= 2) {
      for (const da of [0, 0.4, -0.4, 0.8, -0.8]) {
        const x = p.x + Math.sin(yaw + da) * d, z = p.z + Math.cos(yaw + da) * d;
        if (w.inBounds(x, z, 1.5) && w.spotFree(x, z, 1)) { far = { x, z }; break; }
      }
    }
    if (!far) { const s = w.freeSpot(); far = { x: s.x, z: s.z }; }
    const mk = (pos, color, face) => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.08, 10, 40), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
      ring.position.y = 1.15;
      g.add(ring);
      const swirl = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40), new THREE.MeshBasicMaterial({
        map: PORTAL_TEX[color] || (PORTAL_TEX[color] = makeCanvasTexture(128, 128, (ctx, W, H) => {
          const gr = ctx.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, W / 2);
          gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, color); gr.addColorStop(1, 'rgba(10,10,30,0.9)');
          ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
          for (let a = 0; a < 4; a++) { ctx.beginPath(); for (let t = 0; t < 1; t += 0.02) { const r = t * W / 2, ang = a * Math.PI / 2 + t * 7; ctx.lineTo(W / 2 + Math.cos(ang) * r, H / 2 + Math.sin(ang) * r); } ctx.stroke(); }
        })),
        transparent: true, opacity: 0.9, side: THREE.DoubleSide, toneMapped: false, depthWrite: false,
      }));
      swirl.position.y = 1.15;
      g.add(swirl);
      const pad = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.0, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.02;
      g.add(pad);
      g.position.set(pos.x, 0, pos.z);
      g.rotation.y = face;
      g.traverse((o) => { o.userData.noSolid = true; });
      w.scene.add(g);
      w.fx.burst({ x: pos.x, y: 1.1, z: pos.z }, { count: 50, colors: [color, '#ffffff'], speed: 4, up: 2, life: 0.8 });
      return { g, swirl, ring, x: pos.x, z: pos.z, face, color };
    };
    const A = mk(near, '#36c9ff', yaw);
    const B = mk(far, '#ff8a1f', Math.atan2(p.x - far.x, p.z - far.z));
    this.portals = { w, A, B, t: 25, cool: new Map(), uses: 0 };
    this.powerCd.portal = pw.cd;
    this.save.stats.powers++;
    this.missionProgress('power', 1);
    Sfx.play('zap');
    Sfx.play('whoosh');
    this.showBanner('از حلقه‌ی آبی برو تو، از نارنجی میای بیرون!', '🌀 دروازه‌ی جادویی');
    this.gainXp(Math.round(pw.xp * this.mult()));
    this.refreshPowers();
  },

  tickPortals(dt) {
    const T = this.portals;
    if (!T) return;
    if (T.w !== this.world || this.mode !== 'play') { this.endPortals(); return; }
    if (this.modals.size || this.watch || this.photo) return;
    T.t -= dt;
    const fade = Math.min(1, T.t / 1);
    for (const Q of [T.A, T.B]) {
      Q.swirl.rotation.z -= dt * 3;
      Q.ring.scale.setScalar(Math.max(0.05, fade) * (1 + Math.sin(this.clock * 6) * 0.03));
      Q.swirl.scale.setScalar(Math.max(0.05, fade));
      if (Math.random() < dt * 20) {
        const a = rand(0, TAU);
        this.world.fx.emit(Q.x + Math.cos(a) * 0.9 * Math.cos(Q.face), 1.15 + Math.sin(a) * 0.9, Q.z - Math.cos(a) * 0.9 * Math.sin(Q.face), 0, rand(0.2, 0.6), 0, new THREE.Color(Q.color), 0.6, 0);
      }
    }
    for (const [k, v] of T.cool) { const n = v - dt; if (n <= 0) T.cool.delete(k); else T.cool.set(k, n); }
    // whoever steps into one ring comes out of the other, the way it faces
    const tryPass = (who, pos, onMove) => {
      if (T.cool.has(who)) return;
      for (const [from, to] of [[T.A, T.B], [T.B, T.A]]) {
        if (Math.hypot(pos.x - from.x, pos.z - from.z) < 0.7) {
          const x = to.x + Math.sin(to.face) * 1.3, z = to.z + Math.cos(to.face) * 1.3;
          onMove(x, z, to.face);
          T.cool.set(who, 1.2);
          this.world.fx.burst({ x: from.x, y: 1.1, z: from.z }, { count: 30, colors: [from.color, '#ffffff'], speed: 3, up: 1.5, life: 0.6 });
          this.world.fx.burst({ x, y: 1.1, z }, { count: 30, colors: [to.color, '#ffffff'], speed: 3, up: 1.5, life: 0.6 });
          return true;
        }
      }
      return false;
    };
    const P = this.player;
    if (!P.anchor && !this.miniBusy() && !this.cannon) {
      tryPass('player', P.ch.root.position, (x, z, face) => {
        P.ch.root.position.set(x, P.ch.root.position.y, z);
        P.ch.root.rotation.y = face;
        this.world.cam.tx = x; this.world.cam.tz = z;
        Sfx.play('whoosh');
        const st = this.save.stats;
        st.portals = (st.portals || 0) + 1;
        if (st.portals === 1) this.checkAchievements();
        T.uses++;
      });
    }
    for (const n of this.world.npcs) {
      if (n.anchored || !['idle', 'walk', 'jog', 'fan', 'flung'].includes(n.state)) continue;
      tryPass(n, n.ch.root.position, (x, z, face) => { n.ch.root.position.set(x, 0, z); n.ch.root.rotation.y = face; if (n.state === 'walk') n.target = this.world.freeSpot(); });
    }
    if (T.t <= 0) this.endPortals();
  },

  endPortals() {
    const T = this.portals;
    if (!T) return;
    this.portals = null;
    for (const Q of [T.A, T.B]) {
      if (T.w === this.world) this.world.fx.burst({ x: Q.x, y: 1.1, z: Q.z }, { count: 30, colors: [Q.color, '#ffffff'], speed: 3, up: 1, life: 0.6 });
      Q.g.removeFromParent();
      Q.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    }
  },

  /* ---------- the menu ---------- */

  goChickens() {
    this.closeModal('menuModal');
    if (this.world !== this.gym) { this.toast('مرغ‌های فراری توی باشگاه اولن (سمت غرب، کنار دیوار جنوبی)؛ اول برگرد باشگاه.', 'warn'); return; }
    this.quickTravel(COOP.x, COOP.z - COOP.d / 2 - 1.4);
    const p = this.player.ch.root.position;
    if (this.world === this.gym && Math.hypot(p.x - COOP.x, p.z - (COOP.z - COOP.d / 2 - 1.4)) < 3) this.startChickens();
  },

  /* ---------- every frame ---------- */

  tickFun10(dt) {
    const g = this.gym;
    if (g && !g.fun10) this.buildFun10(g);
    this.tickChickens(dt);
    this.tickPortals(dt);
  },
});
const _chickV = new THREE.Vector3();
const FEATHER = new THREE.Color('#ffffff');
const PORTAL_TEX = {};

/* ---------- hooks into what is already there ---------- */

const _usePower10 = Game.usePower;
Game.usePower = function (id) {
  if (id === 'portal') { if (!this.miniBusy()) this.startPortal(); return; }
  _usePower10.call(this, id);
};

const _quickTravel10 = Game.quickTravel;
Game.quickTravel = function (x, z, special) {
  // the chase follows you: quick travel inside the gym doesn't end it, but leaving the barnyard does
  _quickTravel10.call(this, x, z, special);
  if (this.chick) {
    const p = this.player.ch.root.position;
    if (p.x < CHICK_AREA.x1 - 6 || p.x > CHICK_AREA.x2 + 6 || p.z < CHICK_AREA.z1 - 6) { this.endChickens(true); }
  }
};

/* no karts, claws or bowling in the middle of a chicken chase */
const _arcadeFree10 = Game.arcadeFree;
Game.arcadeFree = function () { return !this.chick && _arcadeFree10.call(this); };

const _ctx10 = Game.contextAction;
Game.contextAction = function () {
  if (!this.chick && this.world === this.gym && this.gym.fun10 && this.arcadeFree() && this.nearCoop()) return { label: '🐔 مرغ‌ها رو آزاد کن (بازی)', run: () => this.startChickens() };
  return _ctx10.call(this);
};

/* the energy blast: a ball of light in the hands, then a beam */
const _onCharEvent10 = WorldBase.prototype.onCharEvent;
WorldBase.prototype.onCharEvent = function (e, ch, isPlayer) {
  if (e === 'charge' || e === 'blast') {
    ch.root.updateMatrixWorld(true);
    ch.B.haL.getWorldPosition(_chickV);
    const yaw = ch.root.rotation.y;
    if (e === 'charge') {
      if (isPlayer) Sfx.play('charge');
      for (let i = 0; i < 40; i++) {
        const a = rand(0, TAU), r = rand(0.4, 0.9);
        this.fx.emit(_chickV.x + Math.cos(a) * r, _chickV.y + rand(-0.4, 0.4), _chickV.z + Math.sin(a) * r, -Math.cos(a) * r * 1.6, rand(-0.2, 0.2), -Math.sin(a) * r * 1.6, new THREE.Color(pick(['#7fe0ff', '#ffffff', '#bfefff'])), 0.6, 0);
      }
    } else {
      if (isPlayer) { Sfx.play('boom'); Sfx.play('zap'); this.shake = Math.max(this.shake || 0, 0.3); }
      for (let i = 0; i < 90; i++) {
        const d = rand(0, 9);
        this.fx.emit(_chickV.x + Math.sin(yaw) * d + rand(-0.15, 0.15), _chickV.y + rand(-0.15, 0.15), _chickV.z + Math.cos(yaw) * d + rand(-0.15, 0.15), Math.sin(yaw) * 6, rand(-0.3, 0.3), Math.cos(yaw) * 6, new THREE.Color(pick(['#7fe0ff', '#ffffff', '#36c9ff'])), 0.5, 0);
      }
      // people in front get blown over
      const p = ch.root.position;
      for (const q of this.npcs) {
        if (q.ch === ch || NO_GRAB.includes(q.state) || q.anchored) continue;
        const dx = q.ch.root.position.x - p.x, dz = q.ch.root.position.z - p.z;
        const along = dx * Math.sin(yaw) + dz * Math.cos(yaw), side = Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw));
        if (along > 0.3 && along < 9 && side < 1.2) this.knockNpc(q, p.x, p.z);
      }
      if (isPlayer && typeof Game !== 'undefined') {
        const st = Game.save.stats;
        st.energyBlasts = (st.energyBlasts || 0) + 1;
        if (st.energyBlasts === 1) Game.checkAchievements();
        Game.hitStop && Game.hitStop(0.06);
      }
    }
    return;
  }
  return _onCharEvent10.call(this, e, ch, isPlayer);
};
