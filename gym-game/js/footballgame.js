'use strict';
/* The football match's HUD, controls, rewards and the secret code. */

Object.assign(Game, {
  inFootball() { return this.world && this.world.env === 'football'; },

  unlockFootball() {
    const first = !this.save.secretFootball;
    this.save.secretFootball = true;
    this.persist();
    Sfx.play('unlock');
    return first;
  },

  footballEnter() {
    const w = this.world;
    $('hud').classList.add('fb-on');
    $('fbHud').hidden = false;
    $('fbBtns').hidden = false;
    Sfx.crowd(true, 0.05);
    w.onEvent = (text) => this.fbMessage(text);
    w.onGoal = (team, scorer) => {
      const mine = scorer && scorer.user;
      this.showBanner(team === 0 ? 'گل!' : 'گل خوردیم!', `${fa(w.score[0])} – ${fa(w.score[1])}`);
      if (team === 0) this.confetti();
      if (mine) {
        this.addCoins(30, true);
        this.gainXp(Math.round(60 * xpMult(this.save.level)), 'reward');
        this.save.stats.goals = (this.save.stats.goals || 0) + 1;
        this.toast('⚽ گل زدی! 🪙 ۳۰', 'gold');
      }
    };
    w.onOver = (score) => {
      const [a, b] = score;
      const res = a > b ? 'win' : a === b ? 'draw' : 'lose';
      const coins = { win: 200, draw: 80, lose: 30 }[res];
      this.showBanner('پایان بازی', `${fa(a)} – ${fa(b)}`);
      this.toast(`${res === 'win' ? '🏆 بردی' : res === 'draw' ? '🤝 مساوی' : '😓 باختی'} • 🪙 ${fa(coins)} • بازی بعدی چند ثانیه‌ی دیگه شروع می‌شه`, 'gold');
      this.addCoins(coins);
      this.gainXp(Math.round({ win: 300, draw: 150, lose: 60 }[res] * xpMult(this.save.level)), 'reward');
      if (res === 'win') this.save.stats.fbWins = (this.save.stats.fbWins || 0) + 1;
      this.checkAchievements();
      this.persist();
    };
    this.fbMessage('⚽ بازی شروع می‌شه! با دویدن به توپ برس، بعد شوت یا پاس بده');
  },

  footballLeave() {
    $('hud').classList.remove('fb-on');
    $('fbHud').hidden = true;
    $('fbBtns').hidden = true;
    Sfx.crowd(false);
  },

  fbMessage(text) {
    const m = $('fbMsg');
    m.textContent = text;
    m.classList.remove('pop');
    void m.offsetWidth;
    m.classList.add('pop');
    clearTimeout(this.fbMsgT);
    this.fbMsgT = setTimeout(() => { m.textContent = ''; }, 2600);
  },

  tickFootball() {
    const w = this.world;
    if (!this.inFootball()) return;
    w.userSkill = 1 + this.lv() / 100;
    w.playerLevel = this.lv();
    const t = Math.max(0, Math.ceil(w.clock));
    const key = `${w.score[0]}|${w.score[1]}|${t}`;
    if (key !== this.fbKey) {
      this.fbKey = key;
      $('fbRed').textContent = fa(w.score[0]);
      $('fbBlue').textContent = fa(w.score[1]);
      $('fbClock').textContent = fa(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
    }
    const holding = w.ball.holder === w.userEnt;
    $('fbShoot').querySelector('span').textContent = holding ? 'شوت' : 'تکل';
    $('fbPass').disabled = !holding;
  },

  fbShoot() { if (this.inFootball() && !this.modals.size) this.world.userShoot(); },
  fbPass() { if (this.inFootball() && !this.modals.size) this.world.userPass(); },
});
