'use strict';
/*
 * The Gym Monster: every few minutes a giant stomps into the middle of the gym. Punch it (the
 * button next to you, or E), hit it with your powers (slam, dash, super jump landing), and the
 * athletes around you join the fight. Every few seconds it jumps and stomps: be in the air when
 * it lands or you get knocked down. Beat it before it gets bored and leaves.
 */

const BOSS = { scale: 3.2, spot: { x: 0, z: 2 }, secs: 150, every: [300, 480], first: 120, reach: 3.8, stompR: 7.5 };
const BOSS_OUTFIT = {
  skin: '#7bc96f', hair: '#2f5d2a', shirt: '#5a2a82', accent: '#ffd34d', shorts: '#2c3140', shoes: '#1d1d1d',
  sole: '#ffd34d', socks: '#5a2a82', style: 'tank', band: '#e63946', number: false, muscle: 1,
};

/** A quick hard jab with the right arm. */
ANIMS.bosspunch = {
  dur: 0.7,
  events: [[0.45, 'punch']],
  fn(p, t) {
    const wind = smooth(seg(t, 0, 0.35));
    const hit = smooth(seg(t, 0.35, 0.5)) * (1 - smooth(seg(t, 0.7, 1)));
    p.hpLX = -0.3; p.hpRX = 0.15; p.knL = p.knR = 0.35;
    p.y = -0.06;
    p.spY = 0.35 * wind - 0.6 * hit;
    p.shLX = -1.2; p.elL = -1.9; p.shLZ = 0.25;
    p.shRX = lerp(0.2 * wind - 0.9, -1.55, hit);
    p.elR = lerp(-2.1, -0.05, hit);
    p.shRZ = -0.2;
  },
};

const FIRE_OUTFIT = { skin: '#e2582b', hair: '#ffd34d', shirt: '#2c1810', accent: '#ff7b00', band: '#ffd34d', socks: '#ff7b00' };

ACHIEVEMENTS.push(
  { id: 'boss', name: 'غول‌کش', icon: '🐉', desc: 'غول باشگاه رو شکست بده', test: (s) => (s.stats.bossWins || 0) >= 1 },
  { id: 'boss5', name: 'شکارچی غول', icon: '⚔️', desc: '۵ بار غول باشگاه رو شکست بده', test: (s) => (s.stats.bossWins || 0) >= 5 },
);

/* helpers come to fight: they walk up to the monster and punch */
Object.assign(GymWorld.prototype, {
  bossNpc(n, dt) {
    const B = this.boss;
    const ch = n.ch;
    const pos = ch.root.position;
    if (!B || B.dead) { n.state = 'idle'; n.timer = rand(0.5, 2); n.ch.setLabel(n.name, 'سطح ' + fa(n.level), '#7fe0ff'); return [0, 0, 0]; }
    const bp = B.ch.root.position;
    // around its back and sides, leaving your side open
    const pp = this.player.ch.root.position;
    const a = Math.atan2(pp.z - bp.z, pp.x - bp.x) + n.bossA;
    const tx = bp.x + Math.cos(a) * 3.3;
    const tz = bp.z + Math.sin(a) * 3.3;
    const dx = tx - pos.x;
    const dz = tz - pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.6) return [dx / d, dz / d, Math.min(3.2, d * 2)];
    ch.root.rotation.y = angleLerp(ch.root.rotation.y, Math.atan2(bp.x - pos.x, bp.z - pos.z), damp(8, dt));
    if (!ch.busy && ch.grounded) ch.play('bosspunch', () => { if (this.boss && !this.boss.dead) this.bossHurt(0.8 + n.level / 400, n); });
    return [0, 0, 0];
  },

  /** Damage from anyone. */
  bossHurt(dmg, who) {
    const B = this.boss;
    if (!B || B.dead) return;
    B.hp = Math.max(0, B.hp - dmg);
    B.flash = 0.15;
    const p = B.ch.root.position;
    this.fx.burst({ x: p.x + rand(-0.8, 0.8), y: rand(2, 4.5), z: p.z + rand(-0.8, 0.8) }, { count: 10, colors: ['#ffd34d', '#ffffff', '#7bc96f'], speed: 3, up: 2, life: 0.4 });
    if (this.onBossHurt) this.onBossHurt(dmg, who);
  },
});

Object.assign(Game, {
  bossLv() { return 1 + (this.save.stats.bossWins || 0); },

  /** Bring the monster in now (from the menu too). */
  spawnBoss(byHand) {
    const g = this.gym;
    if (g.boss || this.world !== g || this.mode !== 'play') {
      if (byHand) this.toast(this.world !== this.gym ? 'غول فقط توی باشگاه اصلی میاد.' : 'غول همین الان این‌جاست!', 'warn');
      return;
    }
    if (this.race || this.arm || this.build || this.dodge || this.lava) { if (byHand) this.toast('اول کاری که می‌کنی رو تموم کن.', 'warn'); return; }
    if (byHand) this.closeModal('menuModal');
    // every other fight is the fire monster, which also throws fireballs
    const fire = (this.save.stats.bossWins || 0) % 2 === 1;
    const ch = new Character(Object.assign({}, BOSS_OUTFIT, fire ? FIRE_OUTFIT : {}));
    ch.root.scale.setScalar(BOSS.scale);
    ch.root.position.set(BOSS.spot.x, 0, BOSS.spot.z);
    ch.root.rotation.y = Math.PI;
    g.scene.add(ch.root);
    const max = Math.round(220 * (1 + 0.6 * (this.bossLv() - 1)) + this.lv() * 0.6);
    g.boss = { ch, hp: max, max, t: BOSS.secs, stompT: 6, warnT: 0, dead: false, flash: 0, walkT: 0, recruitT: 0, fire, fireT: 4 };
    g.onBossHurt = (dmg) => this.bossHit(dmg);
    ch.setLabel(`${fire ? '🔥 غول آتشین' : '🐉 غول باشگاه'} • مرحله‌ی ${fa(this.bossLv())}`, fire ? 'گلوله‌هاش رو جاخالی بده!' : 'بزنش!', fire ? '#ff7b00' : '#7bc96f');
    g.shake = Math.max(g.shake, 0.8);
    g.fx.burst({ x: BOSS.spot.x, y: 2, z: BOSS.spot.z }, { count: 120, colors: ['#7bc96f', '#5a2a82', '#ffd34d'], speed: 6, up: 5, life: 1.3 });
    Sfx.play('boom');
    if (fire) this.showBanner('گلوله‌های آتیشش رو جاخالی بده، مشتش بزن و وقتی می‌پره تو هم بپر!', '🔥 غول آتشین اومد!');
    else this.showBanner('مشتش بزن، با قدرت‌ها بکوبش، و وقتی می‌پره تو هم بپر!', '🐉 غول باشگاه اومد!');
    this.recruitBossHelpers();
  },

  recruitBossHelpers() {
    const g = this.gym;
    const B = g.boss;
    if (!B) return;
    const bp = B.ch.root.position;
    const fighters = g.npcs.filter((n) => n.state === 'boss').length;
    const free = g.npcs.filter((n) => (n.state === 'idle' || n.state === 'walk' || n.state === 'exercise' || n.state === 'fan') && !n.anchored && n.ch.root.position.distanceTo(bp) < 30);
    for (const n of free.slice(0, Math.max(0, 8 - fighters))) {
      if (n.ch.busy) n.ch.stopAction();
      g.leaveStation(n);
      n.state = 'boss';
      n.bossA = rand(1.1, TAU - 1.1);
      n.ch.setLabel(n.name, '⚔️ کمکت میام!', '#ffd34d');
    }
  },

  bossHit(dmg) {
    const B = this.gym.boss;
    if (B.hp <= 0) this.bossDefeated();
  },

  /** Your punch, when you are next to it. */
  bossAction() {
    const g = this.gym;
    const B = g.boss;
    if (!B || B.dead || this.world !== g) return null;
    const p = this.player.ch.root.position;
    const bp = B.ch.root.position;
    if (Math.hypot(p.x - bp.x, p.z - bp.z) > BOSS.reach + 0.4) return null;
    return { label: '👊 مشت به غول!', run: () => this.punchBoss() };
  },

  punchBoss() {
    const g = this.gym;
    const B = g.boss;
    const P = this.player;
    if (!B || B.dead || P.ch.busy || !P.ch.grounded) return;
    const p = P.ch.root.position;
    const bp = B.ch.root.position;
    P.ch.root.rotation.y = Math.atan2(bp.x - p.x, bp.z - p.z);
    P.vel.set(0, 0);
    if (P.ch.play('bosspunch')) this.bossPunchPending = true;
  },

  /** Every frame. */
  tickBoss(dt) {
    const g = this.gym;
    if (!g) return;
    const here = this.world === g && this.mode === 'play';
    if (!g.boss) {
      $('bossPanel').hidden = true;
      if (!here || this.race || this.arm || this.build || this.dodge || this.lava || this.hunt || this.modals.size || this.watch || this.photo || this.lv() < 10) return;
      this.bossTimer = (this.bossTimer ?? BOSS.first) - dt;
      if (this.bossTimer <= 0) { this.bossTimer = rand(...BOSS.every); this.spawnBoss(false); }
      return;
    }
    const B = g.boss;
    const ch = B.ch;
    // you left the gym: it leaves too (no sounds, panel or pushes in other places)
    if (this.world !== g && this.mode !== 'transition') {
      ch.dispose();
      g.boss = null;
      for (const n of g.npcs) if (n.state === 'boss') { n.state = 'idle'; n.timer = 1; n.ch.setLabel(n.name, 'سطح ' + fa(n.level), '#7fe0ff'); }
      $('bossPanel').hidden = true;
      return;
    }
    const bp = ch.root.position;
    const P = this.player;
    const pp = P.ch.root.position;
    // a dash through it hurts it
    if (this.dash && !this.dash.hitBoss && Math.hypot(pp.x - bp.x, pp.z - bp.z) < 2.2) {
      this.dash.hitBoss = true;
      g.bossHurt(10, null);
      this.floatText(`−${fa(10)} 🐉`, 'fl-combo');
    }
    // your punch lands at the end of the swing
    if (this.bossPunchPending && P.ch.action && P.ch.action.name === 'bosspunch' && P.ch.actionT >= 0.32) {
      this.bossPunchPending = false;
      if (Math.hypot(pp.x - bp.x, pp.z - bp.z) < BOSS.reach + 0.6) {
        const dmg = 6 + Math.min(30, Math.floor(this.lv() / 120));
        g.bossHurt(dmg, null);
        Sfx.play('punch');
        g.shake = Math.max(g.shake, 0.2);
        this.floatText(`−${fa(dmg)} 🐉`, 'fl-combo');
        this.gainXp(Math.round(8 * this.mult()));
      }
    }
    if (B.dead) {
      // no red hurt flash left on while it shrinks away
      if (B.flash) { B.flash = 0; ch.mesh.material = CHAR_MAT; }
      B.deadT -= dt;
      ch.root.scale.setScalar(BOSS.scale * clamp(B.deadT / 1.5, 0.01, 1));
      ch.update(dt);
      if (B.deadT <= 0) { ch.dispose(); g.boss = null; $('bossPanel').hidden = true; }
      return;
    }
    // menus, the camera room and photos pause the fight (you can't move then)
    if (this.modals.size || this.watch || this.photo) { ch.speed = 0; ch.update(dt); return; }
    B.t -= dt;
    if (B.t <= 0) {
      // bored: it leaves
      g.fx.burst({ x: bp.x, y: 2, z: bp.z }, { count: 80, colors: ['#7bc96f', '#5a2a82'], speed: 5, up: 4, life: 1 });
      ch.dispose();
      g.boss = null;
      this.toast(`${B.fire ? '🔥' : '🐉'} غول خسته شد و رفت! دفعه‌ی بعد سریع‌تر بزنش.`, 'warn');
      return;
    }
    // the fire monster throws a fireball every few seconds
    if (B.fire && here && !B.inAir && B.warnT <= 0) {
      B.fireT -= dt;
      if (B.fireT <= 0) {
        B.fireT = rand(3, 4.5);
        const yaw = ch.root.rotation.y;
        this.throwAt({ x: bp.x + Math.sin(yaw) * 1.2, y: bp.y + 4.2, z: bp.z + Math.cos(yaw) * 1.2 }, 'fire');
      }
      if (Math.random() < dt * 20) g.fx.emit(bp.x + rand(-1, 1), bp.y + rand(1, 5), bp.z + rand(-1, 1), 0, 1.5, 0, new THREE.Color(pick(['#ff6a00', '#ffd34d'])), 0.6, -0.4);
    }
    B.recruitT -= dt;
    if (B.recruitT <= 0) { B.recruitT = 6; this.recruitBossHelpers(); }
    // walk towards you (when you are in the gym), then the stomp
    let speed = 0;
    if (!ch.busy && ch.grounded && B.warnT <= 0) {
      const dx = pp.x - bp.x;
      const dz = pp.z - bp.z;
      const d = Math.hypot(dx, dz);
      ch.root.rotation.y = angleLerp(ch.root.rotation.y, Math.atan2(dx, dz), damp(3, dt));
      if (here && d > 3.0 && d < 60) {
        speed = 1.6;
        g.moveBody(bp, Math.sin(ch.root.rotation.y) * speed * dt, Math.cos(ch.root.rotation.y) * speed * dt, ch.root.rotation.y, 0, BOSS.scale);
      }
      // keep the player from walking into it
      if (d < 1.4 && !P.anchor) { pp.x = bp.x + (dx / (d || 1)) * 1.4; pp.z = bp.z + (dz / (d || 1)) * 1.4; }
      B.stompT -= dt;
      if (B.stompT <= 0) { B.warnT = 1.3; B.stompT = rand(6, 9); Sfx.play('charge'); }
    }
    if (B.warnT > 0) {
      B.warnT -= dt;
      if (Math.floor(B.warnT * 10) % 2 === 0) g.fx.ring({ x: bp.x, y: 0.1, z: bp.z }, { count: 30, color: '#e63946', radius: BOSS.stompR * 0.9, speed: 0.5, life: 0.25 });
      if (B.warnT <= 0) { ch.jump(7); B.inAir = true; }
    }
    if (B.inAir && ch.grounded) {
      B.inAir = false;
      this.bossStomp();
    }
    ch.speed = speed;
    ch.update(dt);
    // a hurt flash
    if (B.flash > 0) { B.flash -= dt; ch.mesh.material = B.flash > 0 ? (this.bossFlashMat || (this.bossFlashMat = Object.assign(CHAR_MAT.clone(), { emissive: new THREE.Color('#ff3b3b'), emissiveIntensity: 0.8 }))) : CHAR_MAT; }
    if (here) this.renderBossPanel(B);
  },

  bossStomp() {
    const g = this.gym;
    const B = g.boss;
    const bp = B.ch.root.position;
    const P = this.player;
    const pp = P.ch.root.position;
    g.knockAround(bp.x, bp.z, BOSS.stompR);
    g.fx.ring({ x: bp.x, y: 0.15, z: bp.z }, { count: 140, color: '#7bc96f', radius: 0.6, speed: 12, life: 0.8 });
    g.fx.dust({ x: bp.x, y: 0, z: bp.z }, 50);
    g.shake = Math.max(g.shake, 1);
    Sfx.play('boom');
    const d = Math.hypot(pp.x - bp.x, pp.z - bp.z);
    if (this.world === g && d < BOSS.stompR && P.ch.grounded && P.ch.airY <= 0.05 && !P.anchor) {
      this.stopLoop(true);
      P.ch.stopAction();
      P.vel.set(0, 0);
      P.ch.root.rotation.y = Math.atan2(bp.x - pp.x, bp.z - pp.z);
      P.ch.play('knock');
      this.toast('😵 غول کوبید و افتادی! دفعه‌ی بعد وقتی می‌پره تو هم بپر.', 'warn');
    } else if (this.world === g && d < BOSS.stompR + 2) {
      this.floatText('✨ جاخالی!', 'fl-combo');
    }
  },

  bossDefeated() {
    const g = this.gym;
    const B = g.boss;
    if (B.dead) return;
    B.dead = true;
    B.deadT = 1.6;
    B.ch.stopAction();
    B.ch.play('knock');
    const lvl = this.bossLv();
    const levels = 2 + lvl * 2;
    const coins = 150 + 100 * lvl;
    this.save.stats.bossWins = (this.save.stats.bossWins || 0) + 1;
    if (B.fire) this.save.stats.fireBossWins = (this.save.stats.fireBossWins || 0) + 1;
    const p = B.ch.root.position;
    g.fx.burst({ x: p.x, y: 2.5, z: p.z }, { count: 160, colors: ['#ffd34d', '#7bc96f', '#ff4da6', '#ffffff'], speed: 7, up: 6, life: 1.5 });
    g.shake = Math.max(g.shake, 0.9);
    this.confetti();
    Sfx.play('win');
    this.showBanner(`+${fa(levels)} سطح زور • 🪙 ${fa(coins)}`, '🏆 غول رو شکست دادی!');
    this.addLevels(levels);
    this.addCoins(coins);
    this.fireworks(8);
    this.victoryDance(1700);
    for (const n of g.npcs) if (n.state === 'boss') { n.state = 'fan'; n.fan = { x: p.x, z: p.z, t: 4, anim: 'cheer' }; n.ch.setLabel(n.name, 'سطح ' + fa(n.level), '#7fe0ff'); }
    this.checkAchievements();
    this.persist();
  },

  renderBossPanel(B) {
    const el = $('bossPanel');
    el.hidden = false;
    $('bossFill').style.width = `${(B.hp / B.max) * 100}%`;
    const t = `${B.fire ? '🔥 غول آتشین' : '🐉 غول باشگاه'} • مرحله‌ی ${fa(this.bossLv())} • ⏱️ ${fa(Math.ceil(B.t))} ثانیه`;
    if ($('bossHead').textContent !== t) $('bossHead').textContent = t;
    $('bossHp').textContent = `${fa(Math.ceil(B.hp))} / ${fa(B.max)}`;
  },
});

/* powers hurt the monster too */
const _shockwave = Game.shockwave;
Game.shockwave = function (x, z, r, big) {
  _shockwave.call(this, x, z, r, big);
  const B = this.gym && this.gym.boss;
  if (!B || B.dead || this.world !== this.gym) return;
  const bp = B.ch.root.position;
  if (Math.hypot(bp.x - x, bp.z - z) < r + 1.2) {
    const dmg = big ? 18 : 7;
    this.gym.bossHurt(dmg, null);
    this.floatText(`−${fa(dmg)} 🐉`, 'fl-combo');
  }
};
