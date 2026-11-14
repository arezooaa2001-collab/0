'use strict';
/*
 * Two new powers: 🍄 Giant (2.6 times taller for 20 s: big strides, the floor shakes, people
 * come to look, low doorways and tree tops get in the way) and 🐜 Tiny (0.4 times). Collision
 * still uses the real body, so a giant's head bumps into what is above it. Also speed effects:
 * speed lines and a wider view when running very fast.
 */

const MORPHS = {
  giant: { scale: 2.6, speed: 1.7, secs: 20 },
  tiny: { scale: 0.4, speed: 0.8, secs: 20 },
};
POWERS.push(
  { id: 'tiny', name: 'کوچولو', icon: '🐜', level: 15, cd: 25, xp: 30, key: '4' },
  { id: 'giant', name: 'غول‌پیکر', icon: '🍄', level: 40, cd: 30, xp: 50, key: '5' },
);
for (const p of POWERS) POWER_BY_ID[p.id] = p;

const _usePower = Game.usePower;

Object.assign(Game, {
  usePower(id) {
    if (!MORPHS[id]) { _usePower.call(this, id); return; }
    const pw = POWER_BY_ID[id];
    if (!pw || this.mode !== 'play' || this.modals.size || this.race || this.arm || this.photo || this.build) return;
    Sfx.init();
    if (!this.powerUnlocked(pw)) {
      Sfx.play('error');
      this.toast(`🔒 قدرت «${pw.name}» در سطح ${fa(pw.level)} باز می‌شه.`, 'warn');
      return;
    }
    const M = this.morph;
    // pressing it again turns you back
    if (M && M.player === this.player && M.id === id) { M.t = 0; return; }
    if (this.powerCd[id] > 0) return;
    const P = this.player;
    if (P.anchor || P.ch.busy || this.loop) {
      this.toast('اول ورزش رو تموم کن (⏹ توقف)، بعد قدرت رو بزن.', 'warn');
      return;
    }
    this.morph = { id, player: P, t: MORPHS[id].secs, stepT: 0 };
    this.powerCd[id] = pw.cd;
    this.save.stats.powers++;
    this.save.stats[id] = (this.save.stats[id] || 0) + 1;
    Sfx.play(id === 'giant' ? 'charge' : 'whoosh');
    const p = P.ch.root.position;
    this.world.fx.burst({ x: p.x, y: 1, z: p.z }, { count: 60, colors: id === 'giant' ? ['#ff4da6', '#ffd34d', '#ffffff'] : ['#7fe0ff', '#2ecc71', '#ffffff'], speed: 3, up: 3, life: 0.9 });
    this.showBanner(id === 'giant' ? 'مواظب سرت باش!' : 'حواست باشه زیر پا نری!', id === 'giant' ? '🍄 غول شدی!' : '🐜 کوچولو شدی!');
    if (id === 'giant') this.world.gatherFans(p.x, p.z, 14, 6, 6, 'fanclap');
    this.gainXp(Math.round(pw.xp * this.mult()));
    this.missionProgress('power', 1);
    this.checkAchievements();
    this.refreshPowers();
  },

  /** How big you are right now (1 = normal). */
  morphSize() { return (this.player && this.player.ch.root.scale.x) || 1; },
  morphSpeed() {
    const M = this.morph;
    if (!M || M.player !== this.player) return 1;
    const s = this.morphSize();
    return s > 1 ? 1 + (MORPHS.giant.speed - 1) * (s - 1) / (MORPHS.giant.scale - 1) : 1 - (1 - MORPHS.tiny.speed) * (1 - s) / (1 - MORPHS.tiny.scale);
  },

  tickMorph(dt) {
    const M = this.morph;
    const P = this.player;
    if (!P) return;
    if (!M || M.player !== P) {
      if (M) this.morph = null;
      if (P.ch.root.scale.x !== 1) P.ch.root.scale.setScalar(1);
      return;
    }
    if (!this.modals.size && !this.watch && !this.photo) M.t -= dt;
    const target = M.t > 0 ? MORPHS[M.id].scale : 1;
    const ch = P.ch;
    let s = ch.root.scale.x;
    s += (target - s) * damp(4, dt);
    if (Math.abs(target - s) < 0.01) s = target;
    ch.root.scale.setScalar(s);
    if (M.t <= 0 && s === 1) {
      this.morph = null;
      this.toast('به اندازه‌ی عادی برگشتی.');
      return;
    }
    // a giant's footsteps shake the floor
    if (s > 1.5 && ch.grounded && P.vel.length() > 1) {
      M.stepT -= dt;
      if (M.stepT <= 0) {
        M.stepT = 0.5;
        const p = ch.root.position;
        this.world.shake = Math.max(this.world.shake || 0, 0.12);
        this.world.fx.dust({ x: p.x, y: p.y, z: p.z }, 10);
        Sfx.play('land');
      }
    }
    if (M.t > 0 && M.t < 3 && Math.floor(M.t * 4) !== Math.floor((M.t + dt) * 4)) this.floatText(`⏳ ${fa(Math.ceil(M.t))}`, '');
  },

  /** Speed lines and a wider view when you go really fast. */
  tickSpeedFx(dt) {
    const P = this.player;
    const sp = P && this.mode === 'play' ? P.vel.length() : 0;
    const k = clamp((sp - 10) / 18, 0, 1);
    this.speedK = (this.speedK || 0) + (k - (this.speedK || 0)) * damp(5, dt);
    const el = $('speedFx');
    const o = this.speedK > 0.02 ? this.speedK : 0;
    if (Math.abs((this.speedO || 0) - o) > 0.01) {
      this.speedO = o;
      el.style.opacity = o.toFixed(2);
      el.hidden = o === 0;
    }
    // phones held upright see wider (as resize() sets it)
    const fov = (this.camera.aspect < 1 ? 68 : 55) + 16 * this.speedK;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  },
});

/* new medals for the new things */
ACHIEVEMENTS.push(
  { id: 'tiny', name: 'مورچه', icon: '🐜', desc: 'کوچولو شو', test: (s) => (s.stats.tiny || 0) >= 1 },
  { id: 'giant', name: 'غول بی‌شاخ و دم', icon: '🍄', desc: 'غول‌پیکر شو', test: (s) => (s.stats.giant || 0) >= 1 },
  { id: 'spinclass', name: 'رکاب‌زن کلاس', icon: '🚲', desc: 'توی کلاس اسپینینگ رکاب بزن', test: (s) => (s.stats.moves.spin || 0) >= 1 },
  { id: 'spinmaster', name: 'شاگرد اول', icon: '🎓', desc: 'هر ۵ حرکت مربی اسپینینگ رو یاد بگیر', test: (s) => (s.spinLearned || []).length >= 5 },
  { id: 'trick', name: 'بندباز هوا', icon: '🌀', desc: 'پرش چرخشی هوایی بزن', test: (s) => (s.stats.moves.aerialx || 0) >= 1 },
  { id: 'km1', name: 'یک کیلومتری', icon: '🏁', desc: 'توی پیست ۱٬۰۰۰ متر بدو', test: (s) => (s.runBest || 0) >= 1000 },
  { id: 'km10', name: 'ده کیلومتری', icon: '🏃', desc: 'توی پیست ۱۰٬۰۰۰ متر بدو', test: (s) => (s.runBest || 0) >= 10000 },
  { id: 'km100', name: 'ماراتن‌باز', icon: '🦅', desc: 'توی پیست ۱۰۰٬۰۰۰ متر بدو', test: (s) => (s.runBest || 0) >= 100000 },
  { id: 'runwin', name: 'اول پیست', icon: '🥇', desc: 'مسابقه‌ی پیست رو با حریف اول شو', test: (s) => (s.stats.runWins || 0) >= 1 },
  { id: 'energy10', name: 'پرانرژی', icon: '⚡', desc: 'سطح انرژی ۱۰', test: (s) => !!s.energy && s.energy.level >= 10 },
  { id: 'energy50', name: 'باتری تموم‌نشدنی', icon: '🔋', desc: 'سطح انرژی ۵۰', test: (s) => !!s.energy && s.energy.level >= 50 },
);
