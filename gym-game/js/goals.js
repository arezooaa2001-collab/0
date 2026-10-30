'use strict';
/*
 * The champion's path: the game's goal. Eleven steps from your first real levels to the
 * Olympus peak. Only levels you earned by exercising count. Finish them all and you become
 * «قهرمانِ قهرمانان», with a golden crown, a finale, and endless play after that.
 */

const GOALS = [
  { id: 'lv10', icon: '💪', text: 'با ورزش به سطح ۱۰ برس', reward: 100, test: (s) => s.level >= 10, prog: (s) => [s.level, 10] },
  { id: 'stage3', icon: '🤼', text: 'دو حریف اول کشتی رو شکست بده', reward: 150, test: (s) => s.stage >= 3, prog: (s) => [s.stage - 1, 2] },
  { id: 'g2', icon: '⚙️', text: `در سطح ${fa(G2_LEVEL)} برو باشگاه فولاد`, reward: 200, test: (s) => s.stats.visited.includes('gym2'), prog: (s) => [Math.min(s.level, G2_LEVEL), G2_LEVEL] },
  { id: 'lv100', icon: '🌥️', text: 'با ورزش به سطح ۱۰۰ برس', reward: 400, test: (s) => s.level >= 100, prog: (s) => [s.level, 100] },
  { id: 'g2lv20', icon: '🔥', text: 'در باشگاه فولاد به سطح ۲۰ برس', reward: 400, test: (s) => s.g2.best >= 20, prog: (s) => [s.g2.best, 20] },
  { id: 'stage10', icon: '🏆', text: 'هر ۱۰ حریف کشتی رو شکست بده', reward: 600, test: (s) => s.stage > MAIN_STAGES, prog: (s) => [s.stage - 1, MAIN_STAGES] },
  { id: 'g2lv50', icon: '🏗️', text: 'در باشگاه فولاد به سطح ۵۰ برس', reward: 800, test: (s) => s.g2.best >= 50, prog: (s) => [s.g2.best, 50] },
  { id: 'lv500', icon: '🏛️', text: 'با ورزش به سطح ۵۰۰ برس', reward: 1500, test: (s) => s.level >= 500, prog: (s) => [s.level, 500] },
  { id: 'titan', icon: '⚡', text: 'یه ورزش میدان تایتان رو انجام بده', reward: 1500, test: (s) => !!s.goals.titanDone, prog: (s) => [s.goals.titanDone ? 1 : 0, 1] },
  { id: 'lv1000', icon: '🌌', text: 'با ورزش به سطح ۱۰۰۰ برس', reward: 3000, test: (s) => s.level >= 1000, prog: (s) => [s.level, 1000] },
  { id: 'olympus', icon: '👑', text: 'یه ورزش قله‌ی المپ رو انجام بده', reward: 5000, test: (s) => !!s.goals.olympusDone, prog: (s) => [s.goals.olympusDone ? 1 : 0, 1] },
];

Object.assign(Game, {
  nextGoal() { return GOALS.find((g) => !this.save.goals[g.id]); },

  checkGoals() {
    const s = this.save;
    if (!s || !s.goals) return;
    let got = 0;
    for (const g of GOALS) {
      if (s.goals[g.id] || !g.test(s)) continue;
      s.goals[g.id] = Date.now();
      got++;
      setTimeout(() => {
        Sfx.play('medal');
        this.addCoins(g.reward, true);
        this.toast(`🎯 هدف «${g.text}» انجام شد! +${fa(g.reward)} 🪙`, 'gold');
        this.confetti();
      }, 900 + got * 1200);
    }
    if (got) {
      this.renderGoalChip();
      this.persist();
      if (!this.nextGoal() && !s.goals.champion) setTimeout(() => this.championEnding(), 2600 + got * 1200);
    }
  },

  renderGoalChip() {
    const g = this.nextGoal();
    const chip = $('goalChip');
    if (!g) { chip.textContent = '👑 قهرمانِ قهرمانان!'; return; }
    const [a, b] = g.prog(this.save);
    chip.textContent = `🎯 هدف: ${g.icon} ${g.text} (${fa(Math.min(a, b))}/${fa(b)})`;
  },

  openGoals() {
    const list = $('goalList');
    list.innerHTML = '';
    const next = this.nextGoal();
    GOALS.forEach((g, i) => {
      const done = !!this.save.goals[g.id];
      const [a, b] = g.prog(this.save);
      const row = document.createElement('div');
      row.className = 'goal-row' + (done ? ' done' : '') + (g === next ? ' now' : '');
      const n = document.createElement('span');
      n.className = 'goal-n';
      n.textContent = done ? '✅' : fa(i + 1);
      const t = document.createElement('div');
      t.className = 'goal-t';
      const b1 = document.createElement('b');
      b1.textContent = `${g.icon} ${g.text}`;
      const bar = document.createElement('div');
      bar.className = 'goal-bar';
      const fill = document.createElement('i');
      fill.style.width = `${clamp(done ? 1 : a / b, 0, 1) * 100}%`;
      bar.appendChild(fill);
      t.append(b1, bar);
      const r = document.createElement('small');
      r.textContent = done ? 'انجام شد' : `🪙 ${fa(g.reward)}`;
      row.append(n, t, r);
      list.appendChild(row);
    });
    $('goalSub').textContent = this.save.goals.champion
      ? '👑 تو قهرمانِ قهرمانانی! حالا رکوردهات رو بشکن و سطحت رو هر چقدر می‌تونی بالا ببر.'
      : 'فقط سطحی که با ورزش گرفتی حساب می‌شه (سطح موقت حساب نیست). همه رو تموم کن تا قهرمانِ قهرمانان بشی!';
    this.closeModal('menuModal');
    this.openModal('goalModal');
  },

  /** The finale: crown, fireworks and the champion's title. */
  championEnding() {
    const s = this.save;
    s.goals.champion = Date.now();
    this.persist();
    Sfx.play('win');
    this.confetti();
    setTimeout(() => this.confetti(), 900);
    setTimeout(() => this.confetti(), 1800);
    const p = this.player.ch.root.position;
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        if (!this.world.fx) return;
        this.world.fx.burst({ x: p.x + rand(-4, 4), y: rand(4, 8), z: p.z + rand(-4, 4) }, { count: 80, colors: ['#ffd34d', '#ff4da6', '#7fe0ff', '#2ecc71', '#ffffff'], speed: 5, up: 2, life: 1.8 });
        Sfx.play('boom');
      }, i * 450);
    }
    this.labelPlayer();
    $('endStats').textContent = `سطح زور ${fa(s.level)} • باشگاه فولاد ${fa(s.g2.best)} • ${fa(s.wins)} برد کشتی • ${fa(s.stats.reps)} تمرین`;
    setTimeout(() => this.openModal('endModal'), 1200);
  },

  gymWelcome(e) {
    const s = this.save;
    if (!s.stats.visited.includes(e.id)) s.stats.visited.push(e.id);
    this.missionProgress('visit', 1, e.id);
    if (e.id === 'gym2') this.toast('⚙️ به باشگاه فولاد خوش اومدی! یه باشگاه کاملاً جدید با ورزش‌های آهنی. این‌جا از سطح ۱ شروع می‌کنی!', 'gold');
    else if (e.id === 'gym3') this.toast(`🏛️ به معبد تایتان‌ها خوش اومدی! وسط معبد «میدان تایتان» هست: فقط با سطح ${fa(TITAN_LEVEL)}+ برو سراغ وزنه‌هاش، وگرنه ${fa(ZONE_PENALTY)} سطح جریمه می‌شی.`, 'gold');
    else this.toast(`🌌 به المپ کیهانی خوش اومدی! «قله‌ی المپ» فقط برای سطح ${fa(OLYMPUS_LEVEL)}+ هست. کمتر باشی و امتحان کنی ${fa(ZONE_PENALTY)} سطح جریمه می‌شی!`, 'gold');
    Sfx.play('win');
    this.checkAchievements();
    this.checkGoals();
  },

  /** A zone lift done for real. */
  zoneDone(m) {
    const g = this.save.goals;
    if (m.zone >= OLYMPUS_LEVEL) g.olympusDone = (g.olympusDone || 0) + 1;
    else g.titanDone = (g.titanDone || 0) + 1;
    const p = this.player.ch.root.position;
    this.world.fx.ring({ x: p.x, y: 0.2, z: p.z }, { count: 90, color: m.zone >= OLYMPUS_LEVEL ? '#7fe0ff' : '#ffcf33', radius: 0.6, speed: 8, life: 1.0 });
    this.world.shake = Math.max(this.world.shake || 0, 0.35);
    this.checkGoals();
  },
});

/* ---------- the champion gyms, game side ---------- */

Object.assign(Game, {
  /** A zone exercise tried below the zone's level: you can't lift it and lose 20 levels. */
  zoneFail(m, st) {
    const started = this.world.useStation(st, 'knock', () => {});
    if (!started) return;
    const lost = this.loseLevels(ZONE_PENALTY);
    Sfx.play('fail');
    this.world.shake = Math.max(this.world.shake || 0, 0.5);
    const p = this.player.ch.root.position;
    this.world.fx.burst({ x: p.x, y: 1.2, z: p.z }, { count: 50, colors: ['#e63946', '#ff7b00', '#2c3140'], speed: 3, up: 3, life: 1.2 });
    this.showBanner('⛔ خیلی سنگین بود!', `−${fa(lost)} سطح`);
    this.toast(`⛔ «${m.name}» فقط از سطح ${fa(m.zone)} شدنیه. نتونستی بلندش کنی و ${fa(lost)} سطح زور جریمه شدی! حالا سطح ${fa(this.lv())} هستی.`, 'warn');
  },

  /** Walking into a zone you aren't strong enough for: warn once per visit. */
  tickZone() {
    const z = this.world.zone;
    if (!z || this.mode !== 'play') { this.zoneWarned = false; return; }
    const p = this.player.ch.root.position;
    const inside = Math.hypot(p.x - z.x, p.z - z.z) < z.r;
    if (inside && !this.zoneWarned) {
      this.zoneWarned = true;
      if (this.lv() < z.level) {
        Sfx.play('error');
        this.toast(`⚠️ این‌جا «${z.name}» است: ورزش‌هاش فقط با سطح ${fa(z.level)} شدنیه. اگه امتحان کنی ${fa(ZONE_PENALTY)} سطح جریمه می‌شی!`, 'warn');
      } else {
        Sfx.play('unlock');
        this.toast(`✨ به «${z.name}» خوش اومدی! زورت کافیه، این وزنه‌های افسانه‌ای مال توئه!`, 'gold');
      }
    } else if (!inside && Math.hypot(p.x - z.x, p.z - z.z) > z.r + 3) this.zoneWarned = false;
  },

  /** Steel Gym level-ups. */
  g2LevelsGained(from, to, quiet) {
    const s = this.save.g2;
    s.best = Math.max(s.best, to);
    if (!quiet) {
      Sfx.play('levelup');
      const b = $('levelBanner');
      b.innerHTML = `<small>⚙️ سطح باشگاه فولاد</small><b>${fa(to)}</b>`;
      b.classList.remove('show');
      void b.offsetWidth;
      b.classList.add('show');
      if (this.mode === 'play') {
        const p = this.player.ch.root.position;
        this.world.fx.burst({ x: p.x, y: 1.4, z: p.z }, { count: 60, colors: ['#ff7b00', '#ffd34d', '#c9ced6'], speed: 3, up: 4, life: 1.4 });
      }
    }
    const opened = GYM_MOVES.filter((m) => m.cat === 'g2' && m.level > from && m.level <= to);
    for (const m of opened) setTimeout(() => { Sfx.play('unlock'); this.toast(`🔓 «${m.name}» در باشگاه فولاد باز شد!`, 'gold'); }, 700);
    this.refreshMoves();
    this.missionProgress('levels', to - from);
    this.checkAchievements();
    this.checkGoals();
    this.persist();
  },

  /** Called by travel(): which level track you are on now. */
  enterTrack(target, item) {
    const e = target === 'env' ? ENV_BY_ID[item] : null;
    const was = this.track;
    this.track = (e && e.track) || 'main';
    const tabs = document.querySelector('.move-tabs');
    for (const t of document.querySelectorAll('.mv-tab[data-gym]')) t.hidden = !e || !e.gym || t.dataset.tab !== e.cat;
    tabs.classList.toggle('gym-only', !!(e && e.gym));
    if (e && e.gym) this.setTab(e.cat);
    else if (/^g\d$/.test(this.save.tab)) this.setTab('base');
    if (was !== this.track) {
      if (this.track === 'g2') setTimeout(() => this.toast(`⚙️ این‌جا سطحت جداست و از ${fa(this.save.g2.level)} شروع می‌شه (و سخت‌تر بالا می‌ره). سطح اصلیت (${fa(this.lv())}) سر جاشه و وقتی برگردی بهت پس داده می‌شه.`, 'gold'), 1600);
      else setTimeout(() => this.toast(`💪 سطح اصلیت برگشت: ${fa(this.lv())}`, 'gold'), 900);
    }
    this.zoneWarned = false;
    this.refreshHud(true);
  },
});
