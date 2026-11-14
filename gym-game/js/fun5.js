'use strict';
/*
 * Round eleven: an energy shield and moon gravity, four trampolines in the gym, a star hunt,
 * a disco party, the crowd cheering when you level up, a baby dragon pet, a spin and a karate
 * kick, and medals for all of it.
 */

POWERS.push(
  { id: 'shield', name: 'سپر انرژی', icon: '🛡️', level: 80, cd: 30, xp: 40, key: '8' },
  { id: 'moon', name: 'جاذبه‌ی ماه', icon: '🌙', level: 150, cd: 40, xp: 50, key: '9' },
);
for (const p of POWERS) POWER_BY_ID[p.id] = p;

SHOP.push({ id: 'dragon', cat: 'pet', name: 'بچه‌اژدها', icon: '🐲', price: 900, once: true, desc: 'دورت پرواز می‌کنه و گاهی آتیش فوت می‌کنه' });
for (const it of SHOP) SHOP_BY_ID[it.id] = it;

const EMOTES5 = [['e_spin', 'چرخ باله', '💫'], ['e_kick', 'لگد کاراته', '🥋']]
  .map(([id, name, icon]) => ({ id, name, icon, level: 1, cat: 'fun', emote: true }));
MOVES.push(...EMOTES5);
for (const e of EMOTES5) MOVE_BY_ID[e.id] = e;

Object.assign(ANIMS, {
  e_spin: {
    dur: 1.7,
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.12)) * (1 - smooth(seg(t, 0.88, 1)));
      p.by = TAU * 2 * smooth(seg(t, 0.1, 0.85));
      p.shLZ = 1.35 * k + 0.1; p.shRZ = -1.35 * k - 0.1;
      p.shLX = p.shRX = -0.2 * k;
      p.elL = p.elR = -0.2;
      p.anL = p.anR = 0.35 * k;
      p.y = 0.04 * k;
      p.nkX = -0.15 * k;
    },
  },
  e_kick: {
    dur: 1.5,
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.15)) * (1 - smooth(seg(t, 0.85, 1)));
      // guard up, then chamber the knee, snap the leg out and back
      p.shLX = p.shRX = -1.2 * k;
      p.elL = p.elR = -1.9 * k;
      p.shLZ = 0.15; p.shRZ = -0.15;
      const ch = smooth(seg(t, 0.15, 0.35)) * (1 - smooth(seg(t, 0.65, 0.85)));
      const ex = smooth(seg(t, 0.35, 0.45)) * (1 - smooth(seg(t, 0.52, 0.65)));
      p.hpRX = -1.5 * ch - 0.2 * ex;
      p.knR = 1.9 * ch * (1 - ex);
      p.anR = 0.4 * ch;
      p.knL = 0.25 * k;
      p.hpLX = -0.15 * k;
      p.bx = -0.18 * ch;
      p.nkX = 0.1 * ch;
    },
  },
});

ACHIEVEMENTS.push(
  { id: 'shield', name: 'سپر فولادی', icon: '🛡️', desc: 'با سپر انرژی یه ضربه رو دفع کن', test: (s) => (s.stats.shieldBlocks || 0) >= 1 },
  { id: 'moonjump', name: 'فضانورد', icon: '🌙', desc: 'با جاذبه‌ی ماه بالای ۵ متر بپر', test: (s) => (s.stats.moonHigh || 0) >= 1 },
  { id: 'tramp', name: 'پشتک‌باز', icon: '🤸', desc: 'روی ترامپولین سه پشتک یه‌جا بزن', test: (s) => (s.stats.trampTriple || 0) >= 1 },
  { id: 'hunt', name: 'شکارچی ستاره', icon: '⭐', desc: 'توی شکار ستاره هر ۱۲ تا رو بگیر', test: (s) => (s.stats.huntAll || 0) >= 1 },
  { id: 'disco', name: 'سلطان دیسکو', icon: '🪩', desc: 'توی یه مهمونی دیسکو ۳ بار برقص', test: (s) => (s.stats.discoBest || 0) >= 3 },
  { id: 'cheered', name: 'محبوب باشگاه', icon: '👏', desc: '۱۰ بار مردم برات دست بزنن', test: (s) => (s.stats.cheers || 0) >= 10 },
  { id: 'dragon', name: 'اژدهاسوار', icon: '🐲', desc: 'بچه‌اژدها رو با خودت ببر', test: (s) => s.shop && s.shop.pet === 'dragon' },
);

const TRAMPS = { z: -12, xs: [-5.1, -1.7, 1.7, 5.1], r: 1.35, top: 0.36 };
const CHEERS = ['آفرین قهرمان!', 'ایول! سطح بالا!', 'دمت گرم!', 'چه زوری!', 'بزن بریم!', 'تو بهترینی!', 'وای! چقدر قوی شدی!'];
const DISCO_COLORS = ['#ff4da6', '#7fe0ff', '#ffd34d', '#2ecc71', '#c77dff', '#ff7b00'];
const DANCES = ['e_dance', 'e_robot', 'e_moon', 'e_floss', 'e_dab', 'e_spin'];

/** A baby dragon that flies beside you, flapping, and now and then puffs a little fire. */
class DragonPet {
  constructor() {
    this.kind = 'dragon';
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const b = new Batch();
    const g = '#2ecc71', dk = '#1e8a4c', belly = '#ffe08a';
    b.add(UnitGeo.capsule(0.13, 0.3, 4, 10), 0, 0, 0, g, Math.PI / 2, 0, 0, 1, 1, 1);
    b.sphere(0.1, 0, -0.05, 0.05, belly, 0.6);
    b.sphere(0.13, 0, 0.12, 0.28, g);
    b.sphere(0.07, 0, 0.08, 0.4, dk, 0.8);
    b.sphere(0.028, 0.06, 0.18, 0.37, '#111111');
    b.sphere(0.028, -0.06, 0.18, 0.37, '#111111');
    for (const s of [-1, 1]) b.add(UnitGeo.cone(8), s * 0.06, 0.27, 0.22, belly, -0.5, 0, s * -0.3, 0.03, 0.1, 0.03);
    b.add(UnitGeo.cone(8), 0, 0.02, -0.38, g, -Math.PI / 2, 0, 0, 0.07, 0.3, 0.07);
    for (let i = 0; i < 3; i++) b.add(UnitGeo.cone(6), 0, 0.13, 0.05 - i * 0.12, dk, 0, 0, 0, 0.025, 0.07, 0.025);
    this.body.add(new THREE.Mesh(mergeParts(b.parts, false), MATTE_MAT));
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.42, 0.12);
    shape.lineTo(0.36, -0.06);
    shape.lineTo(0.22, -0.02);
    shape.lineTo(0.12, -0.12);
    shape.closePath();
    const wingGeo = new THREE.ShapeGeometry(shape);
    wingGeo.rotateX(-Math.PI / 2);
    this.wingMat = new THREE.MeshStandardMaterial({ color: '#7bed9f', side: THREE.DoubleSide, roughness: 0.6 });
    this.wings = [-1, 1].map((s) => {
      const w = new THREE.Mesh(wingGeo, this.wingMat);
      w.scale.x = s;
      w.position.set(s * 0.08, 0.1, 0.02);
      this.body.add(w);
      return w;
    });
    const shadow = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT);
    shadow.scale.set(0.5, 1, 0.6);
    shadow.position.y = 0.015;
    this.root.add(shadow);
    this.fireT = rand(5, 9);
    this.h = 1.9;
  }

  place(p) { this.root.position.set(p.x + 1, p.y || 0, p.z + 1); }

  update(dt, player, time) {
    const ch = player.ch;
    const pp = ch.root.position;
    const yaw = ch.root.rotation.y;
    const tx = pp.x - Math.sin(yaw) * 0.6 + Math.cos(yaw) * 1.0;
    const tz = pp.z - Math.cos(yaw) * 0.6 - Math.sin(yaw) * 1.0;
    const pos = this.root.position;
    const dx = tx - pos.x, dz = tz - pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 25) pos.set(tx, pp.y, tz);
    const k = damp(4, dt);
    pos.x += dx * k;
    pos.z += dz * k;
    pos.y += (pp.y - pos.y) * k;
    this.h += (1.7 + ch.airY + 0.6 * ch.root.scale.y - this.h) * damp(3, dt);
    this.body.position.y = this.h + Math.sin(time * 3) * 0.12;
    const face = d > 0.4 ? Math.atan2(dx, dz) : yaw;
    this.root.rotation.y = angleLerp(this.root.rotation.y, face, damp(5, dt));
    const flap = Math.sin(time * (d > 0.4 ? 18 : 11));
    this.wings[0].rotation.z = 0.25 + flap * 0.7;
    this.wings[1].rotation.z = -0.25 - flap * 0.7;
    this.body.rotation.x = clamp(d * 0.12, 0, 0.35);
    // a little puff of fire now and then
    this.fireT -= dt;
    const w = Game.world;
    if (this.fireT <= 0 && w && w.fx) {
      this.fireT = rand(6, 11);
      this.puff = 0.5;
    }
    if (this.puff > 0 && w && w.fx) {
      this.puff -= dt;
      const ry = this.root.rotation.y;
      for (let i = 0; i < 2; i++) w.fx.emit(pos.x + Math.sin(ry) * 0.5, pos.y + this.body.position.y + 0.08, pos.z + Math.cos(ry) * 0.5, Math.sin(ry) * 2.5 + rand(-0.3, 0.3), rand(0, 0.6), Math.cos(ry) * 2.5 + rand(-0.3, 0.3), new THREE.Color(pick(['#ff6a00', '#ffd34d', '#ff3300'])), 0.4, -0.2);
    }
  }
}

Object.assign(Game, {
  /* ---------- energy shield ---------- */

  startShield() {
    const pw = POWER_BY_ID.shield;
    if (this.mode !== 'play' || this.modals.size || this.race || this.arm || this.photo || this.build) return;
    if (!this.powerUnlocked(pw)) { Sfx.play('error'); this.toast(`🔒 قدرت «${pw.name}» در سطح ${fa(pw.level)} باز می‌شه.`, 'warn'); return; }
    const P = this.player;
    if (this.powerCd.shield > 0 || P.shield) return;
    Sfx.init();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: '#7fe0ff', transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    mesh.userData.noSolid = true;
    mesh.scale.set(0.8, 1.1, 0.8);
    P.shield = { t: 8, mesh };
    P.ch.root.add(mesh);
    this.powerCd.shield = pw.cd;
    this.save.stats.powers++;
    this.missionProgress('power', 1);
    Sfx.play('charge');
    this.showBanner('۸ ثانیه هیچ‌چی بهت نمی‌خوره!', '🛡️ سپر انرژی');
    this.gainXp(Math.round(pw.xp * this.mult()));
    this.refreshPowers();
  },

  endShield() {
    const P = this.player;
    const S = P && P.shield;
    if (!S) return;
    S.mesh.removeFromParent();
    S.mesh.geometry.dispose();
    S.mesh.material.dispose();
    P.shield = null;
  },

  tickShield(dt) {
    const P = this.player;
    const S = P && P.shield;
    if (!S) return;
    if (!this.modals.size && !this.watch && !this.photo) S.t -= dt;
    if (S.t <= 0 || this.mode === 'arena') { this.endShield(); return; }
    const ch = P.ch;
    // a rebuilt body gets the bubble back
    if (S.mesh.parent !== ch.root) ch.root.add(S.mesh);
    S.mesh.position.y = 0.95 + ch.airY / (ch.root.scale.y || 1);
    S.mesh.material.opacity = (S.t < 2 ? 0.12 + 0.12 * Math.abs(Math.sin(this.clock * 12)) : 0.22 + 0.06 * Math.sin(this.clock * 6));
    // people you run into bounce off
    const w = this.world;
    const p = ch.root.position;
    if (P.vel.length() > 1.5) {
      for (const q of w.npcs) {
        if (['knocked', 'class', 'race', 'boss', 'buddy', 'leave', 'dodge'].includes(q.state) || q.anchored) continue;
        const d = Math.hypot(q.ch.root.position.x - p.x, q.ch.root.position.z - p.z);
        if (d < 1.1 * ch.root.scale.x) {
          w.knockNpc(q, p.x, p.z);
          this.noteKnock && this.noteKnock(1);
          w.fx.burst({ x: q.ch.root.position.x, y: 1, z: q.ch.root.position.z }, { count: 16, colors: ['#7fe0ff', '#ffffff'], speed: 2, up: 1.5, life: 0.4 });
        }
      }
    }
  },

  shieldBlock() {
    const P = this.player;
    const p = P.ch.root.position;
    this.world.fx.burst({ x: p.x, y: p.y + P.ch.airY + 1, z: p.z }, { count: 30, colors: ['#7fe0ff', '#ffffff'], speed: 3, up: 2, life: 0.5 });
    Sfx.play('clank');
    this.floatText('🛡️ دفع شد!', 'fl-combo');
    this.save.stats.shieldBlocks = (this.save.stats.shieldBlocks || 0) + 1;
    if (this.save.stats.shieldBlocks === 1) this.checkAchievements();
  },

  /* ---------- moon gravity ---------- */

  startMoon() {
    const pw = POWER_BY_ID.moon;
    if (this.mode !== 'play' || this.modals.size || this.race || this.arm || this.photo || this.build) return;
    if (!this.powerUnlocked(pw)) { Sfx.play('error'); this.toast(`🔒 قدرت «${pw.name}» در سطح ${fa(pw.level)} باز می‌شه.`, 'warn'); return; }
    if (this.powerCd.moon > 0 || this.moonG) return;
    Sfx.init();
    this.moonG = { t: 12, w: this.world };
    this.powerCd.moon = pw.cd;
    this.save.stats.powers++;
    this.missionProgress('power', 1);
    $('moonFx').hidden = false;
    Sfx.play('charge');
    this.showBanner('همه سبک شدن؛ بپر و پرواز کن!', '🌙 جاذبه‌ی ماه');
    this.gainXp(Math.round(pw.xp * this.mult()));
    this.refreshPowers();
  },

  endMoon() {
    const M = this.moonG;
    if (!M) return;
    this.moonG = null;
    $('moonFx').hidden = true;
    for (const w of new Set([M.w, this.world])) if (w) for (const n of w.npcs) delete n.ch.grav;
    for (const c of M.light || []) delete c.grav;
    if (this.player) delete this.player.ch.grav;
  },

  tickMoon(dt) {
    const M = this.moonG;
    if (!M) return;
    if (!this.modals.size && !this.watch && !this.photo) M.t -= dt;
    if (M.t <= 0 || this.world !== M.w || this.mode === 'arena') { this.endMoon(); return; }
    const ch = this.player.ch;
    ch.grav = 6;
    M.light = M.light || new Set();
    for (const n of M.w.npcs) { n.ch.grav = 6; M.light.add(n.ch); }
    if (ch.airY > 5 && !this.save.stats.moonHigh) { this.save.stats.moonHigh = 1; this.checkAchievements(); }
  },

  /* ---------- trampolines ---------- */

  buildTramps(g) {
    g.tramps = [];
    const frame = new THREE.MeshStandardMaterial({ color: '#2f6fed', roughness: 0.5, metalness: 0.2 });
    const matMat = new THREE.MeshStandardMaterial({ color: '#15171c', roughness: 0.9 });
    const pad = new THREE.MeshStandardMaterial({ color: '#ffd34d', roughness: 0.6 });
    TRAMPS.xs.forEach((x, i) => {
      const z = TRAMPS.z;
      // the body you can stand on (the solid); the mat and pads are only looks
      const body = new THREE.Mesh(new THREE.CylinderGeometry(TRAMPS.r, TRAMPS.r * 0.96, TRAMPS.top, 28), frame);
      body.position.set(x, TRAMPS.top / 2, z);
      g.scene.add(body);
      const mat = new THREE.Mesh(new THREE.CircleGeometry(TRAMPS.r - 0.2, 28), matMat);
      mat.rotation.x = -Math.PI / 2;
      mat.position.set(x, TRAMPS.top + 0.004, z);
      mat.userData.noSolid = true;
      g.scene.add(mat);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(TRAMPS.r - 0.1, 0.09, 8, 32), i % 2 ? pad : new THREE.MeshStandardMaterial({ color: DISCO_COLORS[i], roughness: 0.6 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, TRAMPS.top + 0.02, z);
      ring.userData.noSolid = true;
      g.scene.add(ring);
      g.tramps.push({ x, z, mat, sq: 0 });
    });
    // a sign hanging from the ceiling on two cables (the gym's own sign maker only works while it is being built)
    const sw = 5, sy = 4.2, sz = TRAMPS.z - 2.6;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 0.25), new THREE.MeshBasicMaterial({
      map: signTexture([{ text: 'ترامپولین 🤸', size: 130, display: true, color: '#ff4da6' }], { w: 1024, h: 256, border: '#ff4da6', bg1: '#10142a', bg2: '#1b1f3d' }),
      toneMapped: false,
    }));
    sign.position.set(0, sy, sz);
    sign.userData.noSolid = true;
    g.scene.add(sign);
    // the same face on the back, so it never reads mirrored
    const back = new THREE.Mesh(sign.geometry, sign.material);
    back.position.copy(sign.position);
    back.rotation.y = Math.PI;
    back.userData.noSolid = true;
    g.scene.add(back);
    const cableLen = (g.ceiling || 11) - sy - sw * 0.125;
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, cableLen, 6), frame);
      c.position.set(s * sw * 0.4, sy + sw * 0.125 + cableLen / 2, sz);
      c.userData.noSolid = true;
      g.scene.add(c);
    }
    g.solids = null;
  },

  tickTramps(dt) {
    const g = this.gym;
    if (!g) return;
    if (!g.tramps) this.buildTramps(g);
    if (this.world !== g) return;
    const P = this.player;
    const ch = P.ch;
    const p = ch.root.position;
    const grav = ch.grav || 20;
    for (const T of g.tramps) {
      if (T.sq > 0) { T.sq = Math.max(0, T.sq - dt * 3); T.mat.position.y = TRAMPS.top + 0.004 - 0.12 * Math.sin(T.sq * Math.PI); }
      // the player bounces higher and higher, with flips from the second bounce
      const d = Math.hypot(p.x - T.x, p.z - T.z);
      if (this.mode === 'play' && d < TRAMPS.r - 0.2 && ch.grounded && p.y > TRAMPS.top - 0.08 && !P.anchor && !ch.busy && !this.loop) {
        // bouncing again right after landing from the last bounce keeps the combo going
        const n = Math.abs(this.clock - (P.trampT ?? -9)) < 0.6 ? Math.min(4, (P.trampN || 1) + 1) : 1;
        P.trampN = n;
        const v = [9, 10.5, 12, 13.5][n - 1];
        P.trampT = this.clock + 2 * v / grav; // when this bounce should land
        ch.vy = v;
        ch.grounded = false;
        P.dj = false;
        if (n >= 2) ch.airFlip = { t: 0, dur: Math.min(1.6, (2 * v / grav) * 0.8), turns: n - 1, dir: 1 };
        T.sq = 1;
        Sfx.play(n >= 3 ? 'whoosh' : 'land');
        const st = this.save.stats;
        st.trampBounces = (st.trampBounces || 0) + 1;
        if (n >= 2) { this.floatText(['', '', '🤸 پشتک!', '🤸🤸 دو پشتک!', '🤸🤸🤸 سه پشتک!'][n], 'fl-combo'); this.gainXp(Math.round(3 * n * this.mult())); }
        if (n === 4 && !st.trampTriple) { st.trampTriple = 1; this.checkAchievements(); }
      }
      // people bounce too
      for (const q of g.npcs) {
        const c = q.ch;
        if (!c.grounded || c.busy || q.anchored) continue;
        const qp = c.root.position;
        if (qp.y > TRAMPS.top - 0.08 && Math.hypot(qp.x - T.x, qp.z - T.z) < TRAMPS.r - 0.2) {
          c.vy = rand(7, 9.5);
          c.grounded = false;
          if (Math.random() < 0.5) c.airFlip = { t: 0, dur: 0.7, turns: 1, dir: 1 };
          T.sq = 1;
        }
      }
    }
    // nobody flies through the ceiling
    if (!ch.grounded && g.ceiling) {
      const top = g.ceiling - 2.1 * ch.root.scale.y;
      if (p.y + ch.airY > top) { ch.airY = top - p.y; ch.vy = Math.min(ch.vy, 0); }
    }
  },

  /* ---------- star hunt ---------- */

  /** Is this point free of anything solid? */
  pointClear(w, x, y, z) {
    w.ensureSolids();
    return !w.solids.some((s) => x > s.x1 - 0.5 && x < s.x2 + 0.5 && z > s.z1 - 0.5 && z < s.z2 + 0.5 && y > s.bottom - 0.6 && y < s.top + 0.6);
  },

  startHunt() {
    this.closeModal('menuModal');
    const w = this.world;
    if (this.mode !== 'play' || this.race || this.arm || this.build || this.dodge || this.hunt || this.cannon || this.meter || this.danceOff || this.miniBusy() || this.inFootball() || w.allowTurbo) {
      this.toast('شکار ستاره وقتی کار دیگه‌ای نمی‌کنی شروع می‌شه (توی پیست دو و فوتبال نه).', 'warn');
      return;
    }
    if (this.loop) this.stopLoop(true);
    const p = this.player.ch.root.position;
    const top = (w.ceiling || 40) - 1.4;
    if (!this.huntGeo) this.huntGeo = starGeometry().scale(1.4, 1.4, 1.4);
    if (!this.huntRayMat) this.huntRayMat = new THREE.MeshBasicMaterial({ color: '#ffd34d', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const stars = [];
    for (let i = 0; i < 12; i++) {
      for (let k = 0; k < 40; k++) {
        const a = rand(0, TAU);
        const r = rand(4, 20);
        const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
        const ground = w.groundAt ? w.groundAt(x, z) || 0 : 0;
        const tier = i % 3;
        const y = Math.min(top, ground + (tier === 0 ? 1.2 : tier === 1 ? rand(2.6, 3.4) : rand(4.4, 5.8)));
        if (!w.inBounds(x, z, 1) || !w.spotFree(x, z, 0.4) || !this.pointClear(w, x, y, z)) continue;
        if (stars.some((s) => Math.hypot(s.x - x, s.z - z) < 2.5)) continue;
        const m = new THREE.Mesh(this.huntGeo, STAR_MAT);
        m.position.set(x, y, z);
        m.userData.noSolid = true;
        w.scene.add(m);
        const ray = new THREE.Mesh(this.huntRayGeo || (this.huntRayGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 8).translate(0, 0.5, 0)), this.huntRayMat);
        ray.position.set(x, ground, z);
        ray.scale.y = y - ground;
        ray.userData.noSolid = true;
        w.scene.add(ray);
        stars.push({ x, y, z, m, ray });
        break;
      }
    }
    if (stars.length < 6) { for (const s of stars) { s.m.removeFromParent(); s.ray.removeFromParent(); } this.toast('این‌جا جای کافی برای ستاره‌ها نیست؛ برو جای بازتر.', 'warn'); return; }
    this.hunt = { w, stars, n: stars.length, got: 0, t: 60 };
    $('huntPanel').hidden = false;
    Sfx.play('whistle');
    this.showBanner(`${fa(stars.length)} ستاره دورت پخش شد؛ ۶۰ ثانیه وقت داری!`, '⭐ شکار ستاره');
  },

  tickHunt(dt) {
    const H = this.hunt;
    if (!H) return;
    if (this.world !== H.w || this.mode === 'arena' || this.race || this.arm) { this.endHunt(null); return; }
    if (this.modals.size || this.watch || this.photo) return;
    H.t -= dt;
    const P = this.player;
    const c = P.ch.root.position;
    const cy = c.y + P.ch.airY + 0.95 * P.ch.root.scale.y;
    let near = null, nd = 1e9;
    for (const s of [...H.stars]) {
      s.m.rotation.y += dt * 2.5;
      s.m.position.y = s.y + Math.sin(this.clock * 2 + s.x) * 0.1;
      const d = Math.hypot(c.x - s.x, c.z - s.z);
      if (d < 1.0 && Math.abs(cy - s.y) < 1.1) {
        H.got++;
        H.w.fx.burst({ x: s.x, y: s.y, z: s.z }, { count: 30, colors: ['#ffd34d', '#ffffff'], speed: 3, up: 2, life: 0.6 });
        Sfx.play('xp');
        this.addCoins(15, true);
        this.floatText(`⭐ ${fa(H.got)}/${fa(H.n)}`, 'fl-combo');
        s.m.removeFromParent();
        s.ray.removeFromParent();
        H.stars.splice(H.stars.indexOf(s), 1);
        continue;
      }
      if (d < nd) { nd = d; near = s; }
    }
    const hint = near ? ` • نزدیک‌ترین: ${fa(Math.round(nd))} متر${near.y - c.y > 2 ? ' (بالا!)' : ''}` : '';
    $('huntHead').textContent = `⭐ ${fa(H.got)}/${fa(H.n)} • ⏱️ ${fa(Math.ceil(Math.max(0, H.t)))}${hint}`;
    if (!H.stars.length) this.endHunt(true);
    else if (H.t <= 0) this.endHunt(false);
  },

  endHunt(all) {
    const H = this.hunt;
    if (!H) return;
    this.hunt = null;
    $('huntPanel').hidden = true;
    for (const s of H.stars) { s.m.removeFromParent(); s.ray.removeFromParent(); }
    if (all === null) return;
    const st = this.save.stats;
    st.huntBest = Math.max(st.huntBest || 0, H.got);
    if (all) {
      st.huntAll = (st.huntAll || 0) + 1;
      this.addCoins(250);
      this.gainXp(Math.round(150 * this.mult()));
      this.confetti();
      this.victoryDance(400);
      this.showBanner(`🪙 ۲۵۰ جایزه + ${fa(H.got * 15)} از ستاره‌ها`, '⭐ همه رو گرفتی!');
    } else this.showBanner(`${fa(H.got)} از ${fa(H.n)} ستاره • رکورد: ${fa(st.huntBest)}`, '⏱️ وقت تموم شد');
    this.checkAchievements();
    this.persist();
  },

  /* ---------- disco party ---------- */

  startDisco(byHand) {
    if (byHand) this.closeModal('menuModal');
    const w = this.world;
    if (this.disco || this.mode !== 'play' || this.race || this.arm || this.build || this.dodge || this.inFootball() || w.allowTurbo || (w === this.gym && this.gym.boss)) {
      if (byHand) this.toast(this.disco ? 'مهمونی همین الان داره برگزار می‌شه! 🪩' : 'الان نمی‌شه مهمونی گرفت؛ اول کاری که می‌کنی رو تموم کن.', 'warn');
      return;
    }
    const p = this.player.ch.root.position;
    const y = Math.min((w.ceiling || 12) - 1.4, 6.5);
    const grp = new THREE.Group();
    grp.userData.noSolid = true;
    grp.position.set(p.x, y, p.z);
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshStandardMaterial({ color: '#e8eef5', metalness: 1, roughness: 0.15, flatShading: true, emissive: '#555555' }));
    grp.add(ball);
    const beams = new THREE.Group();
    grp.add(beams);
    const beamGeo = new THREE.ConeGeometry(1.1, y, 16, 1, true).translate(0, -y / 2, 0);
    DISCO_COLORS.forEach((c, i) => {
      const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      const piv = new THREE.Group();
      piv.rotation.set(0.55, (i / DISCO_COLORS.length) * TAU, 0, 'YXZ');
      piv.add(m);
      beams.add(piv);
    });
    const spots = [];
    const spotGeo = new THREE.CircleGeometry(1, 24);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(spotGeo, new THREE.MeshBasicMaterial({ color: DISCO_COLORS[i % DISCO_COLORS.length], transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      m.rotation.x = -Math.PI / 2;
      m.userData.noSolid = true;
      w.scene.add(m);
      spots.push({ m, a: rand(0, TAU), r: rand(2, 10), sp: rand(0.4, 1.2) * (Math.random() < 0.5 ? -1 : 1) });
    }
    w.scene.add(grp);
    grp.traverse((o) => { o.userData.noSolid = true; });
    // people nearby start dancing
    const dancers = w.npcs.filter((n) => ['idle', 'walk', 'jog', 'chat', 'fan'].includes(n.state) && !n.anchored && n.ch.root.position.distanceTo(p) < 30);
    for (const n of dancers) { if (n.ch.busy) n.ch.stopAction(); n.state = 'party'; n.partyT = rand(0, 1); n.ch.setLabel(n.name, '🪩 مهمونی!', '#ff4da6'); }
    this.disco = { t: 30, w, grp, ball, beams, spots, beamGeo, spotGeo, dancers, cx: p.x, cz: p.z, danced: 0 };
    this.discoSong = this.save.settings.song || 0;
    Sfx.setSong(1);
    Sfx.play('cheer');
    this.showBanner('۳۰ ثانیه برقص؛ هر رقص سه برابر جایزه داره!', '🪩 مهمونی دیسکو!');
  },

  tickDisco(dt) {
    const g = this.gym;
    const D = this.disco;
    if (!D) {
      // now and then the gym throws a party by itself
      if (this.world !== g || this.mode !== 'play' || this.race || this.arm || this.build || this.dodge || this.lava || g.boss || this.hunt || this.cannon || this.meter || this.danceOff || this.miniBusy() || this.modals.size || this.watch || this.photo) return;
      this.discoTimer = (this.discoTimer ?? rand(300, 480)) - dt;
      if (this.discoTimer <= 0) { this.discoTimer = rand(480, 720); this.startDisco(false); }
      return;
    }
    if (this.world !== D.w || this.mode === 'arena') { this.endDisco(); return; }
    if (this.modals.size || this.watch || this.photo) return;
    D.t -= dt;
    D.ball.rotation.y += dt * 1.5;
    D.beams.rotation.y += dt * 0.9;
    for (const s of D.spots) {
      s.a += s.sp * dt;
      s.m.position.set(D.cx + Math.cos(s.a) * s.r, 0.03, D.cz + Math.sin(s.a) * s.r);
    }
    if (D.t <= 0) this.endDisco(true);
  },

  endDisco(done) {
    const D = this.disco;
    if (!D) return;
    this.disco = null;
    D.grp.removeFromParent();
    D.grp.traverse((o) => { if (o.isMesh) { if (o.geometry !== D.beamGeo) o.geometry.dispose(); o.material.dispose(); } });
    D.beamGeo.dispose();
    for (const s of D.spots) { s.m.removeFromParent(); s.m.material.dispose(); }
    D.spotGeo.dispose();
    for (const n of D.dancers) if (n.state === 'party') { n.state = 'idle'; n.timer = rand(0.5, 2); n.ch.setLabel(n.name, 'سطح ' + fa(n.level), '#7fe0ff'); }
    Sfx.setSong(this.save.settings.song || 0);
    const st = this.save.stats;
    st.discoBest = Math.max(st.discoBest || 0, D.danced);
    if (done) this.toast(D.danced ? `🪩 مهمونی تموم شد! ${fa(D.danced)} بار رقصیدی.` : '🪩 مهمونی تموم شد. دفعه‌ی بعد از زبانه‌ی «نمایشی» یه رقص بزن!', 'gold');
    this.checkAchievements();
  },

  /* ---------- the crowd cheers when you level up ---------- */

  crowdCheer() {
    const w = this.world;
    if (!w || this.mode !== 'play' || this.clock - (this.cheerT || -99) < 8) return;
    const p = this.player.ch.root.position;
    const fans = w.npcs.filter((n) => ['idle', 'walk', 'jog', 'chat', 'fan'].includes(n.state) && !n.anchored && !n.ch.busy && n.ch.grounded && n.ch.root.position.distanceTo(p) < 10).slice(0, 5);
    if (!fans.length) return;
    this.cheerT = this.clock;
    for (const n of fans) {
      const q = n.ch.root.position;
      n.ch.root.rotation.y = Math.atan2(p.x - q.x, p.z - q.z);
      n.ch.play(pick(['e_clap', 'e_victory', 'e_clap']));
      this.say(n, pick(CHEERS));
    }
    Sfx.play('cheer');
    const st = this.save.stats;
    st.cheers = (st.cheers || 0) + 1;
    if (st.cheers === 10) this.checkAchievements();
  },

  /* ---------- every frame ---------- */

  tickFun5(dt) {
    this.tickShield(dt);
    this.tickMoon(dt);
    this.tickTramps(dt);
    this.tickHunt(dt);
    this.tickDisco(dt);
  },
});

/* ---------- hooks into what is already there ---------- */

const _usePower5 = Game.usePower;
Game.usePower = function (id) {
  if (id === 'shield') { this.startShield(); return; }
  if (id === 'moon') { this.startMoon(); return; }
  _usePower5.call(this, id);
};

const _playerHit5 = Game.playerHit;
Game.playerHit = function (kind) {
  if (this.player && this.player.shield) { this.shieldBlock(); return; }
  _playerHit5.call(this, kind);
};

const _bossStomp5 = Game.bossStomp;
Game.bossStomp = function () {
  const P = this.player;
  const B = this.gym && this.gym.boss;
  const near = B && P && Math.hypot(P.ch.root.position.x - B.ch.root.position.x, P.ch.root.position.z - B.ch.root.position.z) < BOSS.stompR;
  if (P && P.shield && P.ch.grounded && near && !P.anchor && this.world === this.gym) {
    // the bubble takes the stomp
    P.ch.grounded = false;
    const ft = this.floatText;
    this.floatText = () => {}; // no "dodged!" on top of "blocked!"
    try { _bossStomp5.call(this); } finally { P.ch.grounded = true; this.floatText = ft; }
    this.shieldBlock();
    return;
  }
  _bossStomp5.call(this);
};

const _emoteDone5 = Game.emoteDone;
Game.emoteDone = function (m) {
  _emoteDone5.call(this, m);
  const D = this.disco;
  if (D && this.world === D.w) {
    D.danced++;
    this.addCoins(10, true);
    this.gainXp(Math.round(30 * this.mult()));
    this.floatText(`🪩 ×۳ • ${fa(D.danced)}`, 'fl-combo');
    if (D.danced === 3) this.checkAchievements();
  }
};

const _levelsGained5 = Game.levelsGained;
Game.levelsGained = function (from, to, quiet, track = 'main') {
  _levelsGained5.call(this, from, to, quiet, track);
  if (!quiet && !this.levelTemp && to > from) this.crowdCheer();
};

const _rebuild5 = Game.rebuildPlayer;
Game.rebuildPlayer = function () {
  const sh = this.player && this.player.shield;
  _rebuild5.call(this);
  // the bubble moves to the new body (tickShield re-attaches the mesh)
  if (sh && this.player && !this.player.shield) this.player.shield = sh;
};

/* dancing at the party */
Object.assign(WorldBase.prototype, {
  partyNpc(n, dt) {
    const D = Game.disco;
    if (!D || D.w !== this) { n.state = 'idle'; n.timer = 1; return [0, 0, 0]; }
    if (!n.ch.busy && n.ch.grounded) {
      n.partyT -= dt;
      if (n.partyT <= 0) {
        n.partyT = rand(0.1, 0.8);
        const q = n.ch.root.position;
        n.ch.root.rotation.y = Math.atan2(D.cx - q.x, D.cz - q.z) + rand(-0.6, 0.6);
        n.ch.play(pick(DANCES));
      }
    }
    return [0, 0, 0];
  },
});
