'use strict';
/*
 * Round ten: a hoverboard, a jetpack, "the floor is lava" in the gym, dodgeball survival,
 * a fire monster that throws fireballs, an ultimate energy beam, an appearance editor,
 * a treasure chest every 100 levels, a choice of songs, and medals for all of it.
 */

/* ---------- moves and powers ---------- */

const RIDE_MOVES = [
  { id: 'board', name: 'هاوربرد', icon: '🛹', toggle: true, level: 20, cat: 'base', hint: 'سوار شو و تندتر برو؛ وسط پرش ترفند بزن' },
  { id: 'jetpack', name: 'جت‌پک', icon: '🎒', toggle: true, level: 120, cat: 'base', hint: 'پرش رو نگه دار تا پرواز کنی' },
];
MOVES.splice(4, 0, ...RIDE_MOVES);
for (const m of RIDE_MOVES) MOVE_BY_ID[m.id] = m;

POWERS.push({ id: 'beam', name: 'پرتو نهایی', icon: '🌟', level: 300, cd: 25, xp: 80, key: '7' });
POWER_BY_ID.beam = POWERS[POWERS.length - 1];

const LOOK_COLORS = {
  skin: ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a1e'],
  hair: ['#1b1b1b', '#4a2e1a', '#a0522d', '#e8c06b', '#d94a2b', '#7fe0ff'],
  shorts: ['#111111', '#1d2433', '#2f6fed', '#e63946', '#2ecc71', '#ffd34d'],
  shoes: ['#ffffff', '#111111', '#e63946', '#2f6fed', '#ffd34d', '#ff4da6'],
};
const LOOK_NAMES = { skin: 'رنگ پوست', hair: 'رنگ مو', shorts: 'شلوارک', shoes: 'کفش' };

ACHIEVEMENTS.push(
  { id: 'board', name: 'موج‌سوار', icon: '🛹', desc: 'سوار هاوربرد شو و یه ترفند هوایی بزن', test: (s) => (s.stats.boardTricks || 0) >= 1 },
  { id: 'jet', name: 'خلبان', icon: '🎒', desc: 'با جت‌پک بالای ۶ متر پرواز کن', test: (s) => (s.stats.jetHigh || 0) >= 1 },
  { id: 'lava', name: 'پای نسوز', icon: '🌋', desc: 'از «زمین گدازه‌ست» سالم بیرون بیا', test: (s) => (s.stats.lavaWins || 0) >= 1 },
  { id: 'dodge', name: 'جاخالی‌باز', icon: '🎯', desc: 'بازی جاخالی رو تا آخر دووم بیار', test: (s) => (s.stats.dodgeWins || 0) >= 1 },
  { id: 'fireboss', name: 'آتش‌نشان', icon: '🔥', desc: 'غول آتشین رو شکست بده', test: (s) => (s.stats.fireBossWins || 0) >= 1 },
  { id: 'beam', name: 'پرتوی قهرمان', icon: '🌟', desc: 'با پرتو نهایی ۵ نفر رو یه‌جا بنداز', test: (s) => (s.stats.beamMax || 0) >= 5 },
  { id: 'look', name: 'خوش‌تیپ', icon: '🎨', desc: 'ظاهرت رو عوض کن', test: (s) => !!s.look },
  { id: 'chest100', name: 'صدتایی', icon: '🎁', desc: 'صندوق جایزه‌ی هر ۱۰۰ سطح رو بگیر', test: (s) => (s.stats.levelChests || 0) >= 1 },
);

/** Standing sideways on the board, knees bent, arms out; leaning into turns. */
function boardPose(p, lean, t) {
  copyPose(p, STAND);
  p.by = 0.9;
  p.y = 0.12 - 0.07;
  p.hpLX = p.hpRX = -0.45;
  p.knL = p.knR = 0.8;
  p.hpLZ = 0.28; p.hpRZ = -0.28;
  p.autoAnkle = true;
  p.spX = 0.2;
  p.bz = clamp(lean, -0.35, 0.35);
  p.shLZ = 0.95 + 0.08 * Math.sin(t * 2); p.shRZ = -0.95 - 0.08 * Math.sin(t * 2 + 1);
  p.elL = p.elR = -0.4;
  p.nkY = -0.7;
  // stand exactly on the deck: lift the body until the soles touch its top
  p.y = 0;
  Contact.FK.set(p);
  const sole = Math.min(Contact.FK.at('anL', 0, -0.07, 0.05).y, Contact.FK.at('anR', 0, -0.07, 0.05).y);
  p.y = BOARD_TOP - sole;
}
const BOARD_TOP = 0.135;

function boardMesh() {
  const b = new Batch();
  b.box(0.95, 0.06, 0.32, 0, 0, 0, '#2f6fed');
  b.box(0.95, 0.012, 0.3, 0, 0.034, 0, '#111317');
  for (const s of [-1, 1]) b.cyl(0.09, 0.05, s * 0.33, -0.05, 0, '#7fe0ff', 0, 0, 0, 14);
  const m = new THREE.Mesh(mergeParts(b.parts, false), METAL_MAT);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: '#7fe0ff', transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -0.09;
  const g = new THREE.Group();
  g.add(m, glow);
  return g;
}

function jetpackMesh() {
  const b = new Batch();
  for (const s of [-1, 1]) {
    b.cyl(0.07, 0.34, s * 0.09, 0, 0, '#c9ced6', 0, 0, 0, 12);
    b.add(UnitGeo.cone(12), s * 0.09, -0.22, 0, '#e63946', Math.PI, 0, 0, 0.07, 0.1, 0.07);
  }
  b.box(0.3, 0.28, 0.08, 0, 0.02, 0.06, '#2c3140');
  return new THREE.Mesh(mergeParts(b.parts, false), METAL_MAT);
}

Object.assign(Game, {
  /* ---------- hoverboard ---------- */

  toggleBoard() {
    const P = this.player;
    if (P.board) { this.endBoard(); return; }
    if (this.loop) this.stopLoop(true);
    if (P.anchor || P.ch.busy || this.race || this.arm) { this.toast('الان نمی‌شه سوار شد.', 'warn'); return; }
    if (P.jet) this.endJet();
    P.board = { mesh: boardMesh(), trick: 0 };
    P.ch.root.add(P.board.mesh);
    // the deck runs along the line between the feet (the body stands turned 0.9 rad)
    P.board.mesh.position.y = BOARD_TOP - 0.042;
    P.board.mesh.rotation.y = 0.9;
    P.ch.manual = true;
    P.ch.manualSnap = false;
    Sfx.play('whoosh');
    this.toast('🛹 سوار هاوربرد شدی! تندتر می‌ری؛ وسط پرش یه ترفند می‌زنه. دوباره بزن تا پیاده شی.');
    this.refreshMoves();
  },

  endBoard() {
    const P = this.player;
    if (!P || !P.board) return;
    P.board.mesh.removeFromParent();
    P.board.mesh.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== METAL_MAT) o.material.dispose(); } });
    P.board = null;
    P.ch.manual = false;
    this.refreshMoves();
  },

  tickBoard(dt) {
    const P = this.player;
    const B = P && P.board;
    if (!B) return;
    if (P.anchor || this.race || this.arm || this.mode === 'arena') { this.endBoard(); return; }
    const ch = P.ch;
    boardPose(ch.manualPose, -ch.turn * 0.12, this.clock);
    // a kickflip on every jump
    if (!ch.grounded) {
      if (!B.inAir) { B.inAir = true; B.trick = 0; }
      B.trick = Math.min(1, B.trick + dt * 1.8);
      B.mesh.rotation.x = TAU * smooth(B.trick);
    } else if (B.inAir) {
      B.inAir = false;
      B.mesh.rotation.x = 0;
      if (B.trick > 0.9) {
        this.save.stats.boardTricks = (this.save.stats.boardTricks || 0) + 1;
        this.floatText('🛹 کیک‌فلیپ!', 'fl-combo');
        this.gainXp(Math.round(6 * this.mult()));
        if (this.save.stats.boardTricks === 1) this.checkAchievements();
      }
    }
    const glow = B.mesh.children[1];
    glow.material.opacity = 0.25 + 0.15 * Math.sin(this.clock * 8);
  },

  boardMult() { return this.player && this.player.board ? 2 : 1; },

  /* ---------- jetpack ---------- */

  toggleJet() {
    const P = this.player;
    if (P.jet) { this.endJet(); return; }
    if (this.loop) this.stopLoop(true);
    if (P.anchor || P.ch.busy || this.race || this.arm) { this.toast('الان نمی‌شه جت‌پک بست.', 'warn'); return; }
    if (P.board) this.endBoard();
    P.jet = { mesh: jetpackMesh(), fuel: 1, flameT: 0 };
    P.ch.B.spine.add(P.jet.mesh);
    P.jet.mesh.position.set(0, 0.3, -0.2);
    Sfx.play('charge');
    this.toast('🎒 جت‌پک بستی! پرش رو نگه دار (Space یا دکمه‌ی ⤴️) تا بری بالا. سوختش روی زمین پر می‌شه.');
    $('jetFuel').hidden = false;
    this.refreshMoves();
  },

  endJet() {
    const P = this.player;
    if (!P || !P.jet) return;
    P.jet.mesh.removeFromParent();
    P.jet.mesh.geometry.dispose();
    P.jet = null;
    $('jetFuel').hidden = true;
    this.refreshMoves();
  },

  jumpHeldNow() { return this.keys.has('Space') || !!this.jumpHeld; },

  tickJet(dt) {
    const P = this.player;
    const J = P && P.jet;
    if (!J) return;
    if (P.anchor || this.race || this.arm || this.mode === 'arena') { this.endJet(); return; }
    const ch = P.ch;
    const w = this.world;
    P.dj = true; // no double jump with a jetpack: holding jump flies
    const top = (w.ceiling || 40) - 2.4;
    if (this.mode === 'play' && this.jumpHeldNow() && J.fuel > 0 && !ch.busy) {
      if (ch.grounded) { ch.grounded = false; ch.vy = 3; }
      ch.vy = Math.min(ch.vy + 34 * dt, 6.5);
      if (ch.airY > top) { ch.airY = top; ch.vy = Math.min(ch.vy, 0); }
      J.fuel = Math.max(0, J.fuel - dt / 6);
      J.flameT -= dt;
      if (J.flameT <= 0) {
        J.flameT = 0.03;
        const p = ch.root.position;
        const yaw = ch.root.rotation.y;
        for (const s of [-1, 1]) w.fx.emit(p.x - Math.sin(yaw) * 0.25 + Math.cos(yaw) * 0.09 * s, p.y + ch.airY + 0.95, p.z - Math.cos(yaw) * 0.25 - Math.sin(yaw) * 0.09 * s, 0, -4, 0, new THREE.Color(pick(['#ff7b00', '#ffd34d', '#ffffff'])), 0.35, 0);
      }
      if (ch.airY > 6 && !this.save.stats.jetHigh) { this.save.stats.jetHigh = 1; this.checkAchievements(); }
    } else if (ch.grounded) J.fuel = Math.min(1, J.fuel + dt / 3);
    $('jetFill').style.width = `${J.fuel * 100}%`;
  },

  /* ---------- the ultimate beam ---------- */

  fireBeam() {
    const pw = POWER_BY_ID.beam;
    if (this.mode !== 'play' || this.modals.size || this.race || this.arm || this.photo || this.build) return;
    if (!this.powerUnlocked(pw)) { Sfx.play('error'); this.toast(`🔒 قدرت «${pw.name}» در سطح ${fa(pw.level)} باز می‌شه.`, 'warn'); return; }
    const P = this.player;
    if (this.powerCd.beam > 0 || P.anchor || P.ch.busy || !P.ch.grounded || this.loop) return;
    this.powerCd.beam = pw.cd;
    this.save.stats.powers++;
    P.vel.set(0, 0);
    P.ch.play('e_heart');
    Sfx.play('charge');
    const w = this.world;
    setTimeout(() => {
      if (this.world !== w || this.player !== P) return;
      const p = P.ch.root.position;
      const yaw = P.ch.root.rotation.y;
      const L = 20;
      const geo = new THREE.CylinderGeometry(0.45, 0.6, L, 16, 1, true);
      geo.rotateX(Math.PI / 2);
      geo.translate(0, 0, L / 2);
      const mat = new THREE.MeshBasicMaterial({ color: '#7fe0ff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const beam = new THREE.Mesh(geo, mat);
      beam.userData.noSolid = true;
      beam.position.set(p.x + Math.sin(yaw) * 0.5, p.y + 1.3, p.z + Math.cos(yaw) * 0.5);
      beam.rotation.y = yaw;
      w.scene.add(beam);
      this.beam = { mesh: beam, t: 1.1, w };
      w.shake = Math.max(w.shake, 0.8);
      Sfx.play('boom');
      // everyone in its path falls over
      let n = 0;
      for (const q of w.npcs) {
        if (['knocked', 'class', 'race', 'boss', 'buddy', 'leave'].includes(q.state) || q.anchored) continue;
        const dx = q.ch.root.position.x - p.x;
        const dz = q.ch.root.position.z - p.z;
        const along = dx * Math.sin(yaw) + dz * Math.cos(yaw);
        const side = Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw));
        if (along > 0 && along < L && side < 1.4) { w.knockNpc(q, p.x, p.z); n++; }
      }
      const B = w === this.gym && this.gym.boss;
      if (B && !B.dead) {
        const dx = B.ch.root.position.x - p.x, dz = B.ch.root.position.z - p.z;
        const along = dx * Math.sin(yaw) + dz * Math.cos(yaw);
        if (along > 0 && along < L && Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw)) < 2) { this.gym.bossHurt(40, null); this.floatText(`−${fa(40)} 🐉`, 'fl-combo'); }
      }
      const st = this.save.stats;
      st.beamMax = Math.max(st.beamMax || 0, n);
      if (n) this.noteKnock(n);
      this.gainXp(Math.round(pw.xp * xpMult(this.save.level)));
      this.checkAchievements();
    }, 650);
    this.refreshPowers();
  },

  tickBeam(dt) {
    const b = this.beam;
    if (!b) return;
    b.t -= dt;
    b.mesh.material.opacity = Math.max(0, b.t) * 0.8;
    b.mesh.scale.x = b.mesh.scale.y = 1 + 0.25 * Math.sin(this.clock * 40);
    if (b.t <= 0 || b.w !== this.world) {
      b.mesh.removeFromParent();
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
      this.beam = null;
    }
  },

  /* ---------- flying balls (dodgeball, the fire monster's fireballs) ---------- */

  /** Throw something from (x, y, z) at the player, landing near where they will be. */
  throwAt(from, kind) {
    const w = this.world;
    const P = this.player;
    const tp = P.ch.root.position;
    const lead = 0.5;
    const tx = tp.x + P.vel.x * lead + rand(-0.8, 0.8);
    const tz = tp.z + P.vel.y * lead + rand(-0.8, 0.8);
    const ty = tp.y + 1.1;
    const speed = kind === 'fire' ? 11 : 13;
    const d = Math.hypot(tx - from.x, tz - from.z) || 1;
    const t = d / speed;
    const fire = kind === 'fire';
    const m = new THREE.Mesh(new THREE.SphereGeometry(fire ? 0.3 : 0.17, 12, 10), new THREE.MeshBasicMaterial({ color: fire ? '#ff6a00' : '#e63946', toneMapped: false }));
    m.userData.noSolid = true;
    m.position.set(from.x, from.y, from.z);
    w.scene.add(m);
    (this.balls || (this.balls = [])).push({ m, w, kind, vx: (tx - from.x) / t, vz: (tz - from.z) / t, vy: (ty - from.y) / t + 0.5 * 9.8 * t, t: 0 });
    Sfx.play('whoosh');
  },

  tickBalls(dt) {
    const list = this.balls;
    if (!list || !list.length) return;
    const P = this.player;
    for (const b of [...list]) {
      const done = () => { b.m.removeFromParent(); b.m.geometry.dispose(); b.m.material.dispose(); list.splice(list.indexOf(b), 1); };
      if (b.w !== this.world) { done(); continue; }
      b.t += dt;
      b.vy -= 9.8 * dt;
      const q = b.m.position;
      q.x += b.vx * dt; q.y += b.vy * dt; q.z += b.vz * dt;
      if (b.kind === 'fire') b.w.fx.emit(q.x, q.y, q.z, rand(-0.3, 0.3), 0.5, rand(-0.3, 0.3), new THREE.Color(pick(['#ff6a00', '#ffd34d', '#e63946'])), 0.4, -0.5);
      const c = P.ch.root.position;
      const hit = Math.hypot(c.x - q.x, c.z - q.z) < 0.45 && q.y > c.y + P.ch.airY && q.y < c.y + P.ch.airY + 1.9 * P.ch.root.scale.x && !P.anchor;
      if (hit || q.y <= 0.05 || b.t > 4 || !b.w.spotFree(q.x, q.z, 0.05)) {
        b.w.fx.burst({ x: q.x, y: Math.max(0.1, q.y), z: q.z }, { count: 18, colors: b.kind === 'fire' ? ['#ff6a00', '#ffd34d'] : ['#e63946', '#ffffff'], speed: 2, up: 1.5, life: 0.5 });
        if (hit) this.playerHit(b.kind);
        done();
      }
    }
  },

  playerHit(kind) {
    const P = this.player;
    Sfx.play('punch');
    this.world.shake = Math.max(this.world.shake, 0.3);
    if (this.dodge) {
      this.dodge.lives--;
      this.floatText('💔', '');
      if (this.dodge.lives <= 0) { this.endDodge(false); return; }
    } else this.toast(kind === 'fire' ? '🔥 گلوله‌ی آتش خوردی! جاخالی بده.' : 'خوردی!', 'warn');
    if (P.ch.grounded && !P.ch.busy && !P.board && !P.jet) { this.stopLoop(true); P.ch.play('knock'); }
  },

  /* ---------- dodgeball survival ---------- */

  startDodge() {
    this.closeModal('menuModal');
    const w = this.world;
    if (w !== this.gym || this.mode !== 'play' || this.race || this.arm || this.dodge || this.lava || this.gym.boss) {
      this.toast('بازی جاخالی توی باشگاه اصلی، وقتی کار دیگه‌ای نمی‌کنی، شروع می‌شه.', 'warn');
      return;
    }
    if (this.loop) this.stopLoop(true);
    const p = this.player.ch.root.position;
    const throwers = w.npcs.filter((n) => ['idle', 'walk', 'exercise', 'jog', 'chat', 'fan'].includes(n.state) && !n.anchored)
      .sort((a, b) => a.ch.root.position.distanceTo(p) - b.ch.root.position.distanceTo(p)).slice(0, 6);
    if (throwers.length < 2) { this.toast('آدم کافی این دور و بر نیست؛ برو جای شلوغ‌تر.', 'warn'); return; }
    throwers.forEach((n, i) => {
      if (n.ch.busy) n.ch.stopAction();
      w.leaveStation(n);
      n.state = 'dodge';
      n.dodgeA = (i / throwers.length) * TAU;
      n.throwT = rand(1.5, 3);
      n.ch.setLabel(n.name, '🎯 آماده‌ی پرتاب!', '#ff7b00');
    });
    this.dodge = { t: 40, lives: 3, cx: p.x, cz: p.z, throwers };
    $('dodgePanel').hidden = false;
    Sfx.play('whistle');
    this.showBanner('۴۰ ثانیه دووم بیار؛ بدو، بپر، جاخالی بده!', '🎯 جاخالی!');
  },

  tickDodge(dt) {
    const D = this.dodge;
    if (!D) return;
    if (this.world !== this.gym) { this.endDodge(null); return; }
    D.t -= dt;
    $('dodgeHead').textContent = `🎯 جاخالی • ⏱️ ${fa(Math.ceil(Math.max(0, D.t)))} • ${'❤️'.repeat(Math.max(0, D.lives))}`;
    if (D.t <= 0) { this.endDodge(true); return; }
    for (const n of D.throwers) {
      if (n.state !== 'dodge') continue;
      n.throwT -= dt;
      if (n.throwT <= 0 && !n.ch.busy && n.ch.grounded) {
        n.throwT = rand(1.4, 2.8) * (D.t < 15 ? 0.7 : 1);
        const q = n.ch.root.position;
        const me = this.player.ch.root.position;
        n.ch.root.rotation.y = Math.atan2(me.x - q.x, me.z - q.z);
        if (n.ch.play('throwball')) setTimeout(() => { if (this.dodge === D && n.state === 'dodge') this.throwAt({ x: q.x, y: q.y + 1.5, z: q.z }, 'ball'); }, 330);
      }
    }
  },

  endDodge(won) {
    const D = this.dodge;
    if (!D) return;
    this.dodge = null;
    $('dodgePanel').hidden = true;
    for (const n of D.throwers) if (n.state === 'dodge') { n.state = 'idle'; n.timer = rand(0.5, 2); n.ch.setLabel(n.name, 'سطح ' + fa(n.level), '#7fe0ff'); }
    if (won === null) return;
    if (won) {
      this.save.stats.dodgeWins = (this.save.stats.dodgeWins || 0) + 1;
      const coins = 120 + 60 * D.lives;
      this.addCoins(coins);
      this.gainXp(Math.round(120 * this.mult()));
      this.confetti();
      this.victoryDance(500);
      this.showBanner(`🪙 ${fa(coins)} • ${'❤️'.repeat(D.lives)}`, '🎯 دووم آوردی!');
      this.checkAchievements();
    } else this.showBanner('سه بار خوردی؛ دوباره امتحان کن!', '🎯 باختی');
  },

  /* ---------- the floor is lava ---------- */

  tickLava(dt) {
    const g = this.gym;
    const L = this.lava;
    const here = this.world === g && this.mode === 'play';
    if (!L) {
      if (!here || this.race || this.arm || this.dodge || this.build || g.boss || this.lv() < 15) return;
      this.lavaTimer = (this.lavaTimer ?? rand(240, 360)) - dt;
      if (this.lavaTimer <= 0) { this.lavaTimer = rand(360, 540); this.startLava(); }
      return;
    }
    if (!here) { this.endLava(null); return; }
    L.t -= dt;
    const mat = g.floorMesh.material;
    if (!L.color) { L.color = mat.color.clone(); }
    mat.color.set(L.phase === 'warn' ? '#ff9a6b' : '#ff5a2a');
    if (L.phase === 'warn') {
      mat.emissive.set('#ff3300');
      mat.emissiveIntensity = 0.25 + 0.25 * Math.sin(this.clock * 10);
      if (L.t <= 0) { L.phase = 'hot'; L.t = 20; Sfx.play('boom'); this.showBanner('روی زمین نمون: تشک، سکو یا وسیله!', '🌋 زمین گدازه‌ست!'); }
      return;
    }
    mat.emissive.set('#ff3300');
    mat.emissiveIntensity = 0.7 + 0.2 * Math.sin(this.clock * 6);
    const P = this.player;
    const p = P.ch.root.position;
    if (Math.random() < dt * 30) g.fx.emit(p.x + rand(-6, 6), 0.05, p.z + rand(-6, 6), 0, rand(1, 2.5), 0, new THREE.Color(pick(['#ff3300', '#ff7b00', '#ffd34d'])), 0.8, -0.3);
    // standing on the bare floor burns (mats, platforms, machines and being in the air are safe)
    L.burnT -= dt;
    const onFloor = !P.anchor && P.ch.grounded && P.ch.airY <= 0.01 && p.y < 0.02 && !P.board && !P.jet;
    if (onFloor && L.burnT <= 0) {
      L.burnT = 1;
      L.burns++;
      Sfx.play('fail');
      this.floatText('🔥 داغه!', '');
      g.fx.burst({ x: p.x, y: 0.3, z: p.z }, { count: 20, colors: ['#ff3300', '#ffd34d'], speed: 2, up: 2.5, life: 0.5 });
      if (P.ch.grounded && !P.ch.busy) P.ch.jump(5);
    }
    if (L.t <= 0) this.endLava(L.burns <= 2);
  },

  startLava() {
    this.lava = { phase: 'warn', t: 6, burns: 0, burnT: 0 };
    Sfx.play('whistle');
    this.toast('🌋 زمین داره داغ می‌شه! تا ۶ ثانیه‌ی دیگه برو روی یه تشک، سکو یا وسیله.', 'warn');
  },

  endLava(won) {
    const L = this.lava;
    if (!L) return;
    this.lava = null;
    const mat = this.gym.floorMesh.material;
    mat.emissive.set('#000000');
    mat.emissiveIntensity = 1;
    if (L.color) mat.color.copy(L.color);
    if (won === null) return;
    if (won) {
      this.save.stats.lavaWins = (this.save.stats.lavaWins || 0) + 1;
      this.addCoins(150);
      this.confetti();
      this.showBanner('🪙 ۱۵۰ سکه', '🌋 زمین سرد شد! سالم موندی');
      this.checkAchievements();
    } else this.showBanner(`${fa(L.burns)} بار پات سوخت`, '🌋 زمین سرد شد');
  },

  /* ---------- appearance ---------- */

  openLook() {
    this.closeModal('menuModal');
    const box = $('lookRows');
    box.innerHTML = '';
    const cur = Object.assign({}, this.outfit());
    for (const key of Object.keys(LOOK_COLORS)) {
      const row = document.createElement('div');
      row.className = 'look-row';
      const label = document.createElement('span');
      label.textContent = LOOK_NAMES[key];
      row.appendChild(label);
      const sw = document.createElement('div');
      sw.className = 'look-sw';
      for (const c of LOOK_COLORS[key]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'swatch' + (cur[key] === c ? ' on' : '');
        b.style.background = c;
        b.setAttribute('aria-label', `${LOOK_NAMES[key]} ${c}`);
        b.addEventListener('click', () => this.setLook(key, c));
        sw.appendChild(b);
      }
      row.appendChild(sw);
      box.appendChild(row);
    }
    this.openModal('lookModal');
  },

  setLook(key, c) {
    if (this.race || this.arm || this.inFootball()) { this.toast('اول مسابقه رو تموم کن، بعد ظاهرت رو عوض کن.', 'warn'); return; }
    this.save.look = Object.assign({}, this.save.look, { [key]: c });
    this.rebuildPlayer();
    Sfx.play('click');
    this.persist();
    this.checkAchievements();
    this.openLook();
  },

  /* ---------- a treasure chest every 100 levels ---------- */

  levelChest(from, to) {
    if (Math.floor(to / 100) <= Math.floor(from / 100) || from < 1) return;
    const w = this.world;
    const pk = w.pickups;
    this.save.stats.levelChests = (this.save.stats.levelChests || 0) + 1;
    setTimeout(() => {
      if (pk && !pk.chest) {
        const c = pk.spawnChest();
        if (c) {
          const p = this.player.ch.root.position;
          const yaw = this.player.ch.root.rotation.y;
          let x = p.x + Math.sin(yaw) * 2.5, z = p.z + Math.cos(yaw) * 2.5;
          if (!w.spotFree(x, z, 0.6)) { x = p.x - Math.sin(yaw) * 2.5; z = p.z - Math.cos(yaw) * 2.5; }
          if (w.spotFree(x, z, 0.6)) { c.x = x; c.z = z; c.g.position.set(x, 0, z); }
          w.fx.burst({ x: c.x, y: 1, z: c.z }, { count: 60, colors: ['#ffd34d', '#ffffff'], speed: 3, up: 4, life: 1 });
        }
      }
      this.toast(`🎁 سطح ${fa(Math.floor(to / 100) * 100)}! یه صندوق جایزه کنارت ظاهر شد؛ برو بازش کن.`, 'gold');
      this.checkAchievements();
    }, 1500);
  },

  /* ---------- every frame ---------- */

  tickFun4(dt) {
    this.tickBoard(dt);
    this.tickJet(dt);
    this.tickBeam(dt);
    this.tickBalls(dt);
    this.tickDodge(dt);
    this.tickLava(dt);
  },
});

/* ---------- hooks into what is already there ---------- */

const _onMove4 = Game.onMove;
Game.onMove = function (m) {
  if (m.id === 'board' || m.id === 'jetpack') {
    if (this.mode !== 'play' || this.modals.size || this.build) return;
    Sfx.init();
    if (!this.isUnlocked(m)) { Sfx.play('error'); this.toast(`🔒 «${m.name}» در سطح ${fa(m.level)} باز می‌شه.`, 'warn'); return; }
    if (m.id === 'board') this.toggleBoard(); else this.toggleJet();
    return;
  }
  // exercising: get off the board first
  if (this.player.board && !m.toggle) this.endBoard();
  _onMove4.call(this, m);
};

const _refreshMoves4 = Game.refreshMoves;
Game.refreshMoves = function () {
  _refreshMoves4.call(this);
  const P = this.player;
  for (const [id, on] of [['board', P && P.board], ['jetpack', P && P.jet]]) {
    const b = this.moveBtns && this.moveBtns[id];
    if (!b) continue;
    b.classList.toggle('active', !!on);
    const sub = b.querySelector('.mv-sub');
    const t = on ? 'روشن' : 'خاموش';
    if (sub && this.isUnlocked(MOVE_BY_ID[id]) && sub.textContent !== t) sub.textContent = t;
  }
};

const _usePower4 = Game.usePower;
Game.usePower = function (id) {
  if (id === 'beam') { this.fireBeam(); return; }
  _usePower4.call(this, id);
};

const _stats4 = Game.stats;
Game.stats = function () {
  const s = _stats4.call(this);
  s.speedMult *= this.boardMult();
  s.walkMult = this.boardMult();
  return s;
};

const _outfit4 = Game.outfit;
Game.outfit = function () {
  return Object.assign(_outfit4.call(this), this.save.look || {});
};

const _levelsGained4 = Game.levelsGained;
Game.levelsGained = function (from, to, quiet, track = 'main') {
  _levelsGained4.call(this, from, to, quiet, track);
  if (track === 'main' && !this.levelTemp) this.levelChest(from, to);
};

/* the player object is rebuilt on travel and outfit changes: the board and jetpack go with the old one */
const _rebuild4 = Game.rebuildPlayer;
Game.rebuildPlayer = function () {
  const board = this.player && this.player.board;
  const jet = this.player && this.player.jet;
  if (board) this.endBoard();
  if (jet) this.endJet();
  _rebuild4.call(this);
  if (board) this.toggleBoard();
  if (jet) this.toggleJet();
};
const _release4 = Game.releasePlayer;
Game.releasePlayer = function () {
  if (this.player && this.player.board) this.endBoard();
  if (this.player && this.player.jet) this.endJet();
  _release4.call(this);
};

/* dodgeball throwers stand in a ring around you */
Object.assign(WorldBase.prototype, {
  dodgeNpc(n, dt) {
    const D = Game.dodge;
    const pos = n.ch.root.position;
    if (!D) { n.state = 'idle'; n.timer = 1; return [0, 0, 0]; }
    const tx = D.cx + Math.cos(n.dodgeA) * 7.5;
    const tz = D.cz + Math.sin(n.dodgeA) * 7.5;
    const dx = tx - pos.x;
    const dz = tz - pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.5 && !n.ch.busy) return [dx / d, dz / d, Math.min(3.5, d * 2)];
    return [0, 0, 0];
  },
});
