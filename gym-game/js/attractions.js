'use strict';
/* The gym wings' interactive attractions: punch machine, reaction wall, juice bar, DJ, body scanner, sprint lane. */

Object.assign(Game, {
  /** Context-button entry for the gym's attraction spots (or null). */
  attractionAction() {
    const g = this.gym;
    if (this.world !== g) return null;
    const sp = g.nearSpot();
    if (!sp) return null;
    if (sp.id === 'reaction') {
      const r = this.react;
      if (r && r.state === 'wait') return { label: '⏳ صبر کن… هنوز نه!', run: () => this.reactPress() };
      if (r && r.state === 'go') return { label: '⚡ الان بزن!', run: () => this.reactPress() };
      return { label: sp.label, run: () => this.reactStart() };
    }
    const runs = {
      watch: () => this.openWatch(),
      punch: () => this.punchMachine(),
      juice: () => this.buyJuice(),
      dj: () => this.toggleDj(),
      scan: () => this.bodyScan(),
      sprintinfo: () => this.toast('🏁 از دروازه‌ی سبز به‌سمت دروازه‌ی قرمز بدو؛ زمانت روی تابلو میاد!', 'gold'),
    };
    return runs[sp.id] ? { label: sp.label, run: runs[sp.id] } : null;
  },

  /* ---------------- punch machine ---------------- */

  punchMachine() {
    const g = this.gym;
    if (!g.canAct()) return;
    const P = this.player;
    P.ch.root.position.set(WING.punch.x + 1.25, 0, WING.punch.z);
    P.ch.root.rotation.y = -Math.PI / 2;
    P.vel.set(0, 0);
    g.onSmash = (ch) => {
      if (ch !== P.ch) return;
      const lv = this.lv();
      const score = Math.min(99999, Math.round(60 + lv * 9 + this.save.runLevel * 2 + rand(0, 25 + lv * 3)));
      const rec = this.save.records;
      const best = score > (rec.punch || 0);
      if (best) rec.punch = score;
      g.drawPunch(score, rec.punch);
      g.shake = Math.max(g.shake, 0.35);
      g.fx.burst({ x: WING.punch.x + 0.25, y: 1.45, z: WING.punch.z }, { count: 40, colors: ['#ffd34d', '#ff7b00', '#ffffff'], speed: 3, up: 2, life: 0.8 });
      if (best) { Sfx.play('win'); this.toast(`🥊 رکورد جدید مشت: ${fa(score)}! • 🪙 ۲۰`, 'gold'); this.addCoins(20); }
      else this.toast(`🥊 قدرت مشت: ${fa(score)} • رکورد ${fa(rec.punch)}`);
      this.gainXp(Math.round(15 * xpMult(this.save.level)));
      this.persist();
    };
    g.playerDo('bigpunch', null);
    Sfx.play('click');
  },

  /* ---------------- reaction wall ---------------- */

  reactStart() {
    this.react = { state: 'wait', t: rand(1.2, 3.4) };
    this.setReactLights('#e63946');
    Sfx.play('tick');
  },

  reactPress() {
    const r = this.react;
    if (!r) return;
    if (r.state === 'wait') {
      Sfx.play('error');
      this.toast('😅 زود زدی! صبر کن چراغ‌ها سبز بشن.', 'warn');
      this.react = null;
      this.setReactLights('#33384a');
      return;
    }
    if (r.state === 'go') {
      const ms = Math.round((performance.now() - r.go) - 0);
      const rec = this.save.records;
      const best = !rec.reaction || ms < rec.reaction;
      if (best) rec.reaction = ms;
      this.react = null;
      this.setReactLights('#ffd34d');
      setTimeout(() => { if (!this.react) this.setReactLights('#33384a'); }, 900);
      const fast = ms < 320;
      Sfx.play(fast ? 'success' : 'click');
      this.toast(`⚡ زمان واکنش: ${fa(ms)} میلی‌ثانیه${best ? ' • رکورد جدید!' : ''}${fast ? ' • 🪙 ۳۰' : ''}`, 'gold');
      if (fast) this.addCoins(30);
      this.persist();
    }
  },

  setReactLights(c) {
    for (const m of this.gym.reactionLights) m.color.set(c);
  },

  tickReact(dt) {
    const r = this.react;
    if (!r) return;
    if (this.world !== this.gym || !this.gym.nearSpot() || this.gym.nearSpot().id !== 'reaction') {
      this.react = null;
      this.setReactLights('#33384a');
      return;
    }
    if (r.state === 'wait') {
      r.t -= dt;
      if (r.t <= 0) {
        r.state = 'go';
        r.go = performance.now();
        this.setReactLights('#2ecc71');
        Sfx.play('go');
      }
    } else if (r.state === 'go' && performance.now() - r.go > 3000) {
      this.react = null;
      this.setReactLights('#33384a');
      this.toast('⏱️ خیلی دیر شد! دوباره امتحان کن.', 'warn');
    }
  },

  /* ---------------- juice bar, DJ, scanner ---------------- */

  buyJuice() {
    if (this.save.coins < 40) { Sfx.play('error'); this.toast('🪙 ۴۰ سکه لازم داری.', 'warn'); return; }
    this.save.coins -= 40;
    this.drinkUntil = Math.max(Date.now(), this.drinkUntil || 0) + 60000;
    Sfx.play('buy');
    this.toast('🥤 اسموتی انرژی! ۶۰ ثانیه زور دوبرابر', 'gold');
    const b = this.gym.barista;
    if (!b.busy) b.play('e_wave');
    this.refreshHud(true);
    this.persist();
  },

  toggleDj() {
    const g = this.gym;
    g.party = !g.party;
    this.save.music = g.party;
    Sfx.music(g.party);
    if (g.party) {
      Sfx.play('cheer');
      const F = WING.floor;
      const n = g.gatherFans(F.x, F.z, 30, 10, 25, 'e_dance');
      this.toast(`🎧 مهمونی شروع شد!${n ? ` ${fa(n)} نفر اومدن برقصن` : ''}`, 'gold');
    } else this.toast('🎧 موسیقی خاموش شد.');
    this.persist();
  },

  bodyScan() {
    const g = this.gym;
    if (g.scanning || !g.canAct()) return;
    const P = this.player;
    P.ch.root.position.set(WING.scanner.x, 0, WING.scanner.z);
    P.ch.root.rotation.y = Math.PI;
    P.vel.set(0, 0);
    g.scanning = true;
    Sfx.play('charge');
    g.playerDo('e_flex', null);
    setTimeout(() => {
      g.scanning = false;
      const s = this.save;
      const muscle = Math.round(muscleFor(this.lv()) * 100);
      const speed = (runSpeedFor(s.runLevel) * (this.owns('shoes') ? 1.15 : 1)).toFixed(1);
      Sfx.play('success');
      this.showBanner('🔬 اسکن بدن', `${fa(muscle)}٪ عضله`);
      this.toast(`🔬 سطح زور ${fa(this.lv())} • ${titleFor(this.lv())} • سرعت ${fa(speed)} متر بر ثانیه • ${fa(s.stats.reps)} تمرین • ${fa(s.wins)} برد کشتی`, 'gold');
    }, 2600);
  },

  /* ---------------- sprint lane ---------------- */

  tickSprintLane() {
    const g = this.gym;
    if (this.world !== g || this.mode !== 'play') return;
    const S = WING.sprint;
    const p = this.player.ch.root.position;
    const inLane = Math.abs(p.z - S.z) < 1.6;
    const ln = this.lane || (this.lane = { lastX: p.x, run: null });
    if (inLane && ln.lastX < S.x1 && p.x >= S.x1) {
      ln.run = { t0: this.clock };
      Sfx.play('go');
      g.drawSprintBoard('برو! 🏃', '');
    }
    if (ln.run) {
      if (!inLane || p.x < S.x1 - 2) {
        ln.run = null;
        g.drawSprintBoard('آماده‌ای؟', '');
      } else if (p.x >= S.x2) {
        const t = this.clock - ln.run.t0;
        ln.run = null;
        const rec = this.save.records;
        const best = !rec.sprint || t < rec.sprint;
        if (best) rec.sprint = t;
        g.sprintBest = rec.sprint;
        g.drawSprintBoard(`${fa(t.toFixed(2))} ثانیه`, best ? '🎉 رکورد جدید!' : '');
        Sfx.play(best ? 'win' : 'success');
        this.toast(`🏁 ۳۰ متر در ${fa(t.toFixed(2))} ثانیه${best ? ' • رکورد جدید! 🪙 ۲۵' : ''}`, 'gold');
        if (best) this.addCoins(25);
        this.gainRun(10);
        this.persist();
      }
    }
    ln.lastX = p.x;
  },

  /** Statues, trophies and boards in the wings. */
  tickWings(dt) {
    this.tickReact(dt);
    this.tickSprintLane();
    this.wingsT = (this.wingsT || 0) - dt;
    if (this.wingsT > 0) return;
    this.wingsT = 3;
    const rows = this.leaderboardAll();
    this.gym.refreshWings(rows.slice(0, 3), this.save.stage);
  },
});
