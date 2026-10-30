'use strict';
/*
 * The fun layer: super powers, coins and treasure on the floor, the golden star,
 * surprise events, the wheel of fortune, daily streaks, arm wrestling, show-off moves,
 * titles, trails, photo mode and settings.
 */

Object.assign(Game, {
  initFun() {
    this.chestT = rand(35, 55);
    this.eventT = rand(70, 110);
    this.event = null;
    this.dash = null;
    this.powerAir = null;
    this.arm = null;
    this.photo = false;
    this.wheelRot = 0;
    this.buildPowers();
    const on = (id, fn) => $(id).addEventListener('click', fn);
    on('wheelChip', () => { Sfx.init(); this.openWheel(); });
    on('chalBtn', () => { Sfx.init(); this.openChallenges(); });
    $('fbShoot').addEventListener('pointerdown', (e) => { e.preventDefault(); Sfx.init(); this.fbShoot(); });
    $('fbPass').addEventListener('pointerdown', (e) => { e.preventDefault(); Sfx.init(); this.fbPass(); });
    on('wheelSpin', () => this.spinWheel());
    on('photoShot', () => this.takePhoto());
    on('photoExit', () => this.exitPhoto());
    $('photoSave').addEventListener('click', (e) => {
      // inside claude.ai the page saves through the downloads capability; elsewhere the link downloads
      if (!(window.claude && window.claude.use)) return;
      e.preventDefault();
      this.savePhoto();
    });
    $('armTap').addEventListener('pointerdown', (e) => { e.preventDefault(); this.armTap(); });
    $('armTap').addEventListener('click', (e) => { if (e.detail === 0) this.armTap(); });
    document.querySelectorAll('#qualitySeg button').forEach((b) => b.addEventListener('click', () => {
      this.save.settings.quality = b.dataset.q;
      this.applySettings();
      this.openSettings(true);
      this.persist();
    }));
    $('sensInput').addEventListener('input', () => { this.save.settings.sens = clamp(Number($('sensInput').value) || 1, 0.4, 2); this.persist(); });
    $('namesInput').addEventListener('change', () => { this.save.settings.names = $('namesInput').checked; this.applySettings(); this.persist(); });
    $('shakeInput').addEventListener('change', () => { this.save.settings.shake = $('shakeInput').checked; this.applySettings(); this.persist(); });
    this.applySettings();
  },

  /* ---------------- super powers ---------------- */

  powerUnlocked(pw) { return this.save.unlocked || this.lv() >= pw.level; },

  buildPowers() {
    const box = $('powers');
    box.innerHTML = '';
    this.powerBtns = {};
    this.powerCd = {};
    this.powerKey = {};
    for (const pw of POWERS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pw-btn';
      b.dataset.id = pw.id;
      b.title = `${pw.name} (کلید ${pw.key})`;
      b.setAttribute('aria-label', pw.name);
      const ic = document.createElement('span');
      ic.textContent = pw.icon;
      const k = document.createElement('span');
      k.className = 'pw-key';
      b.append(ic, k);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.usePower(pw.id); });
      b.addEventListener('click', (e) => { if (e.detail === 0) this.usePower(pw.id); });
      box.appendChild(b);
      this.powerBtns[pw.id] = b;
      this.powerCd[pw.id] = 0;
    }
    this.refreshPowers(true);
  },

  refreshPowers(force) {
    for (const pw of POWERS) {
      const b = this.powerBtns[pw.id];
      const un = this.powerUnlocked(pw);
      const cd = un ? clamp(this.powerCd[pw.id] / pw.cd, 0, 1) : 0;
      const key = `${un}|${cd.toFixed(2)}`;
      if (!force && this.powerKey[pw.id] === key) continue;
      const wasCd = this.powerKey[pw.id] && !this.powerKey[pw.id].endsWith('0.00');
      this.powerKey[pw.id] = key;
      b.classList.toggle('locked', !un);
      b.style.setProperty('--cd', cd);
      b.querySelector('.pw-key').textContent = un ? fa(pw.key) : `🔒${fa(pw.level)}`;
      if (un && wasCd && cd === 0) {
        b.classList.remove('ready');
        void b.offsetWidth;
        b.classList.add('ready');
      }
    }
  },

  usePower(id) {
    const pw = POWER_BY_ID[id];
    if (!pw || this.mode !== 'play' || this.modals.size || this.race || this.arm || this.photo) return;
    Sfx.init();
    if (!this.powerUnlocked(pw)) {
      Sfx.play('error');
      this.toast(`🔒 قدرت «${pw.name}» در سطح ${fa(pw.level)} باز می‌شه.`, 'warn');
      return;
    }
    if (this.powerCd[id] > 0) return;
    const P = this.player;
    const ch = P.ch;
    const w = this.world;
    if (ch.busy || P.anchor || this.powerAir) return;
    if (id !== 'dash' && !ch.grounded) return;
    const p = ch.root.position;
    if (id === 'superjump') {
      const v = Math.min(13.5, Math.sqrt(40 * Math.max(1.5, (w.ceiling || 30) - 2.8)));
      ch.jump(v);
      ch.airFlip = { t: 0, dur: (v / 10) * 0.95, turns: 1, dir: 1 };
      this.powerAir = { id, slam: false };
      Sfx.play('charge');
      Sfx.play('whoosh');
      w.fx.ring({ x: p.x, y: 0.15, z: p.z }, { count: 40, color: '#7fb2ff', radius: 0.4, speed: 4, life: 0.6 });
    } else if (id === 'slam') {
      ch.jump(9.5);
      ch.airFlip = { t: 0, dur: 0.85, turns: 0, dir: 1, spin: 1 };
      this.powerAir = { id, slam: false };
      Sfx.play('charge');
    } else {
      this.dash = { t: 0.3, yaw: ch.root.rotation.y, hit: new Set() };
      Sfx.play('zap');
    }
    this.powerCd[id] = pw.cd;
    this.save.stats.powers++;
    this.gainXp(Math.round(pw.xp * xpMult(this.save.level)));
    this.missionProgress('power', 1);
    this.checkAchievements();
    this.refreshPowers();
  },

  /** Runs before the world moves the player. */
  tickPowers(dt) {
    for (const pw of POWERS) if (this.powerCd[pw.id] > 0) this.powerCd[pw.id] = Math.max(0, this.powerCd[pw.id] - dt);
    if (this.mode !== 'play') return;
    const P = this.player;
    const ch = P.ch;
    const w = this.world;
    const p = ch.root.position;
    const pa = this.powerAir;
    if (pa) {
      const col = new THREE.Color(pa.id === 'slam' ? pick(['#ff7b3d', '#ffd34d']) : pick(['#7fb2ff', '#ffffff']));
      for (let i = 0; i < 2; i++) w.fx.emit(p.x + rand(-0.3, 0.3), ch.airY + rand(0.5, 1.5), p.z + rand(-0.3, 0.3), 0, -0.5, 0, col, 0.5, 0);
      if (pa.id === 'slam' && !pa.slam && ch.vy < 0) {
        pa.slam = true;
        ch.vy = -26;
        Sfx.play('whoosh');
      }
      if (ch.grounded) {
        this.powerAir = null;
        const big = pa.id === 'slam';
        this.shockwave(p.x, p.z, big ? 6.5 : 3.6, big);
      }
    }
    const d = this.dash;
    if (d) {
      d.t -= dt;
      const sp = 24;
      ch.root.rotation.y = d.yaw;
      p.x += Math.sin(d.yaw) * sp * dt;
      p.z += Math.cos(d.yaw) * sp * dt;
      w.resolve(p, 0.34);
      for (let i = 0; i < 4; i++) {
        w.fx.emit(p.x + rand(-0.25, 0.25), ch.airY + rand(0.2, 1.7), p.z + rand(-0.25, 0.25), 0, 0, 0, new THREE.Color(pick(['#ffe066', '#7fe0ff', '#ffffff'])), 0.35, 0);
      }
      for (const n of w.npcs) {
        if (d.hit.has(n) || n.state === 'knocked' || n.anchored || !n.ch.grounded) continue;
        const q = n.ch.root.position;
        if (Math.hypot(q.x - p.x, q.z - p.z) < 1.3) { d.hit.add(n); w.knockNpc(n, p.x, p.z); }
      }
      if (d.t <= 0) {
        this.dash = null;
        P.vel.set(Math.sin(d.yaw) * 5, Math.cos(d.yaw) * 5);
        this.noteKnock(d.hit.size);
      }
    }
    // the golden star knocks over anyone you run into
    if (this.starActive() && P.vel.length() > 2) {
      for (const n of w.npcs) {
        if (n.state === 'knocked' || n.anchored || !n.ch.grounded) continue;
        const q = n.ch.root.position;
        if (Math.hypot(q.x - p.x, q.z - p.z) < 0.85) { w.knockNpc(n, p.x, p.z); Sfx.play('punch'); }
      }
    }
  },

  shockwave(x, z, r, big) {
    const w = this.world;
    const n = w.knockAround(x, z, r);
    w.fx.ring({ x, y: 0.15, z }, { count: big ? 120 : 60, color: big ? '#ff7b3d' : '#7fb2ff', radius: 0.4, speed: big ? 11 : 7, life: 0.8 });
    w.fx.dust({ x, y: 0, z }, big ? 40 : 20);
    if (big) w.fx.burst({ x, y: 0.3, z }, { count: 60, colors: ['#ffb347', '#ff5a1f', '#ffffff'], speed: 5, up: 4, life: 1 });
    w.shake = Math.max(w.shake, big ? 0.9 : 0.4);
    Sfx.play(big ? 'boom' : 'land');
    this.noteKnock(n);
  },

  noteKnock(n) {
    if (!n) return;
    this.chalEvent('knock', n);
    const st = this.save.stats;
    if (n > st.maxKnock) st.maxKnock = n;
    this.toast(n === 1 ? '💥 یه نفر رو انداختی! (نگران نباش، پا می‌شه)' : `💥 ${fa(n)} نفر رو انداختی!`, 'gold');
    this.checkAchievements();
  },

  /* ---------------- coins, gems, star, chests ---------------- */

  starActive() { return Date.now() < (this.starUntil || 0); },

  giveStar(secs = 15) {
    this.starUntil = Math.max(Date.now(), this.starUntil || 0) + secs * 1000;
    Sfx.play('boost');
    this.showBanner('⭐ قدرت ستاره', `${fa(secs)} ثانیه`);
    this.toast('⭐ سریع‌تر می‌دوی، سکه‌ها به‌سمتت میان و هر کی بهت بخوره می‌افته!', 'gold');
  },

  tickPickups(dt) {
    const w = this.world;
    if (!w.fx || w.env === 'football') return;
    if (!w.pickups) w.pickups = new Pickups(w);
    const auto = this.mode === 'play' && !this.arm;
    const got = w.pickups.update(dt, this.player, auto, w === this.gym ? 12 : 9, this.starActive() ? 6 : 0);
    for (const it of got) this.onPickup(it);
    if (!auto || this.race) return;
    this.chestT -= dt;
    if (this.chestT <= 0) {
      this.chestT = rand(100, 160);
      if (!w.pickups.chest && w.pickups.spawnChest()) {
        Sfx.play('unlock');
        this.toast('🎁 یه صندوق گنج یه جایی ظاهر شد! دنبال ستون نور طلایی بگرد', 'gold');
      }
    }
  },

  onPickup(it) {
    const st = this.save.stats;
    const w = this.world;
    if (it.type === 'coin') {
      st.picked++;
      this.chalEvent('coin');
      this.addCoins(2, true);
      this.missionProgress('pickup', 1);
    } else if (it.type === 'gem') {
      st.gems++;
      Sfx.play('gem');
      this.addCoins(25, true);
      w.fx.burst({ x: it.x, y: 1, z: it.z }, { count: 40, colors: ['#4de8ff', '#ffffff', '#9ff3ff'], speed: 3, up: 3, life: 1 });
      this.checkAchievements();
    } else if (it.type === 'star') {
      w.fx.burst({ x: it.x, y: 1, z: it.z }, { count: 60, colors: ['#ffd34d', '#ff7b00', '#ffffff'], speed: 4, up: 4, life: 1.2 });
      this.giveStar(15);
    }
  },

  openChest() {
    const pk = this.world.pickups;
    if (!pk || !pk.openChest()) return;
    const c = pk.chest;
    const w = this.world;
    Sfx.play('chest');
    this.save.stats.chests++;
    setTimeout(() => {
      w.fx.burst({ x: c.x, y: 0.8, z: c.z }, { count: 90, colors: ['#ffd34d', '#ffffff', '#ff7b00', '#4de8ff'], speed: 4, up: 6, life: 1.6 });
      const r = Math.random();
      let text;
      if (r < 0.4) { const n = randi(8, 20) * 10; this.addCoins(n, true); text = `🪙 ${fa(n)} سکه`; }
      else if (r < 0.6) { this.drinkUntil = Math.max(Date.now(), this.drinkUntil || 0) + 60000; text = '🥤 ۶۰ ثانیه زور دوبرابر'; }
      else if (r < 0.75) { this.addTempLevels(3, 'chest'); text = '💪 +۳ سطح زور موقت (۵ دقیقه)'; }
      else if (r < 0.9) { this.addCoins(300, true); Sfx.play('gem'); text = '💎 کیسه‌ی الماس: ۳۰۰ سکه'; }
      else { this.giveStar(20); text = '⭐ قدرت ستاره'; }
      this.showBanner('🎁 صندوق گنج', text);
      this.toast(`🎁 توی صندوق: ${text}!`, 'gold');
      this.confetti();
      this.checkAchievements();
      this.persist();
    }, 650);
  },

  /* ---------------- surprise events ---------------- */

  /** XP multiplier for exercises and running (not for rewards). */
  xpBoost() {
    return (this.drinkActive() ? 2 : 1) * (this.event && this.event.id === 'golden' ? 2 : 1) * (this.starActive() ? 1.5 : 1);
  },

  tickEvents(dt) {
    const ev = this.event;
    if (ev) {
      ev.t -= dt;
      if (ev.id === 'rain' && this.mode === 'play') {
        ev.drop -= dt;
        if (ev.drop <= 0 && this.world.pickups) {
          ev.drop = 1.5;
          const p = this.player.ch.root.position;
          this.world.pickups.rain(p.x, p.z, 4);
        }
      }
      if (ev.t <= 0) this.endEvent(false);
      return;
    }
    if (this.mode !== 'play' || this.arm || this.race || this.modals.size) return;
    this.eventT -= dt;
    if (this.eventT > 0) return;
    this.eventT = rand(150, 230);
    this.startEvent(pick(['golden', 'rain', 'challenge']));
  },

  startEvent(id) {
    Sfx.play('whistle');
    if (id === 'golden') {
      this.event = { id, t: 45 };
      this.showBanner('رویداد ویژه', '⚡ ساعت طلایی');
      this.toast('⚡ ساعت طلایی! ۴۵ ثانیه هر تمرینی زور دوبرابر می‌ده', 'gold');
    } else if (id === 'rain') {
      this.event = { id, t: 20, drop: 1.5 };
      const p = this.player.ch.root.position;
      if (this.world.pickups) this.world.pickups.rain(p.x, p.z, 26);
      this.showBanner('رویداد ویژه', '🪙 باران سکه');
      this.toast('🪙 باران سکه! بدو و تا می‌تونی جمع کن', 'gold');
    } else {
      const n = randi(6, 9);
      this.event = { id, t: 45, n, p: 0 };
      this.showBanner('چالش سرعت', `${fa(n)} تمرین`);
      this.toast(`⏱️ چالش: ${fa(n)} تمرین در ۴۵ ثانیه انجام بده و ۱۵۰ سکه ببر!`, 'gold');
    }
  },

  endEvent(success) {
    const ev = this.event;
    if (!ev) return;
    this.event = null;
    if (ev.id === 'challenge') {
      if (success) {
        Sfx.play('win');
        this.showBanner('چالش رو بردی!', '🪙 ۱۵۰');
        this.addCoins(150);
        this.gainXp(Math.round(80 * xpMult(this.save.level)), 'reward');
        this.confetti();
      } else this.toast('⏱️ وقت چالش تموم شد. دفعه‌ی بعد سریع‌تر!', 'warn');
    } else this.toast(ev.id === 'golden' ? '⚡ ساعت طلایی تموم شد.' : '🪙 باران سکه تموم شد.');
  },

  noteEventRep() {
    const ev = this.event;
    if (!ev || ev.id !== 'challenge') return;
    ev.p++;
    if (ev.p >= ev.n) this.endEvent(true);
  },

  /** Countdown chips for the star and the current event. */
  tickBadges() {
    const sb = $('starBadge');
    if (this.starActive()) {
      sb.hidden = false;
      sb.textContent = `⭐ ستاره • ${fa(Math.ceil((this.starUntil - Date.now()) / 1000))}`;
    } else sb.hidden = true;
    const eb = $('eventBadge');
    const ev = this.event;
    if (ev) {
      eb.hidden = false;
      const left = fa(Math.ceil(ev.t));
      eb.textContent = ev.id === 'golden' ? `⚡ زور ×۲ • ${left}` : ev.id === 'rain' ? `🪙 باران سکه • ${left}` : `⏱️ ${fa(ev.p)}/${fa(ev.n)} تمرین • ${left}`;
    } else eb.hidden = true;
    $('wheelChip').hidden = !this.freeSpin();
  },

  /* ---------------- trails ---------------- */

  tickTrail(dt) {
    const id = this.save.shop.trail;
    if (!id || this.mode !== 'play' || !this.owns(id)) return;
    const P = this.player;
    if (P.vel.length() < 3 && !this.dash) return;
    this.trailT = (this.trailT || 0) + dt;
    if (this.trailT < 0.03) return;
    this.trailT = 0;
    const p = P.ch.root.position;
    let c;
    if (id === 'trail_rainbow') c = new THREE.Color().setHSL((this.clock * 0.6) % 1, 0.9, 0.6);
    else if (id === 'trail_fire') c = new THREE.Color(pick(['#ff5a1f', '#ffb347', '#ffd34d']));
    else c = new THREE.Color(pick(['#7fe0ff', '#ffffff', '#4d8bff']));
    for (let i = 0; i < 2; i++) {
      this.world.fx.emit(p.x + rand(-0.15, 0.15), 0.1 + P.ch.airY + rand(0, 0.3), p.z + rand(-0.15, 0.15), rand(-0.3, 0.3), id === 'trail_fire' ? 1.2 : 0.3, rand(-0.3, 0.3), c, 0.7, id === 'trail_fire' ? -0.5 : 0.5);
    }
  },

  /* ---------------- wheel of fortune & daily streak ---------------- */

  dayKey(t = Date.now()) {
    const d = new Date(t);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  },
  freeSpin() { return this.save.fun.wheelDay !== this.dayKey(); },

  dailyLogin() {
    const f = this.save.fun;
    const today = this.dayKey();
    if (f.lastDay === today) return;
    f.streak = f.lastDay === this.dayKey(Date.now() - 864e5) ? f.streak + 1 : 1;
    f.lastDay = today;
    const coins = 30 * Math.min(7, f.streak);
    setTimeout(() => {
      Sfx.play('medal');
      this.toast(f.streak > 1 ? `📅 روز ${fa(f.streak)} پشت سر هم! جایزه: 🪙 ${fa(coins)}` : `📅 جایزه‌ی ورود امروز: 🪙 ${fa(coins)} • فردا هم بیا!`, 'gold');
      this.addCoins(coins);
      if (this.freeSpin()) setTimeout(() => this.toast('🎡 گردونه‌ی شانس امروز یه چرخش رایگان داره!', 'gold'), 1600);
      this.checkAchievements();
    }, 1800);
  },

  drawWheel() {
    const cv = $('wheelCanvas');
    const ctx = cv.getContext('2d');
    const W = cv.width;
    const R = W / 2;
    const seg = TAU / WHEEL.length;
    ctx.clearRect(0, 0, W, W);
    WHEEL.forEach((s, i) => {
      const a0 = -Math.PI / 2 + i * seg;
      ctx.beginPath();
      ctx.moveTo(R, R);
      ctx.arc(R, R, R - 4, a0, a0 + seg);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.save();
      ctx.translate(R, R);
      ctx.rotate(a0 + seg / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 30px ${UI_FONT}`;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText(s.label, R - 22, 0);
      ctx.restore();
    });
    ctx.beginPath();
    ctx.arc(R, R, 44, 0, TAU);
    ctx.fillStyle = '#ffc23d';
    ctx.fill();
    ctx.font = `48px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎡', R, R + 2);
  },

  openWheel() {
    if (this.mode !== 'play') return;
    this.closeModal('menuModal');
    if (!this.wheelDrawn) { this.drawWheel(); this.wheelDrawn = true; }
    this.updateWheelUi();
    $('wheelMsg').textContent = '';
    this.openModal('wheelModal');
  },

  updateWheelUi() {
    const f = this.save.fun;
    $('wheelStreak').textContent = `📅 ${fa(f.streak || 1)} روز پشت سر هم اومدی • هر روز یه چرخش رایگان`;
    const btn = $('wheelSpin');
    btn.textContent = this.freeSpin() ? '🎁 چرخش رایگان!' : `بچرخون • 🪙 ${fa(WHEEL_PRICE)}`;
    btn.disabled = this.spinning || (!this.freeSpin() && this.save.coins < WHEEL_PRICE);
  },

  spinWheel() {
    if (this.spinning) return;
    Sfx.init();
    if (this.freeSpin()) this.save.fun.wheelDay = this.dayKey();
    else if (this.save.coins >= WHEEL_PRICE) { this.save.coins -= WHEEL_PRICE; this.refreshHud(true); }
    else { Sfx.play('error'); return; }
    this.spinning = true;
    const total = WHEEL.reduce((a, s) => a + s.w, 0);
    let r = Math.random() * total;
    let idx = 0;
    while (idx < WHEEL.length - 1 && (r -= WHEEL[idx].w) > 0) idx++;
    const seg = 360 / WHEEL.length;
    const target = (((-(idx + 0.5) * seg + rand(-seg * 0.35, seg * 0.35)) % 360) + 360) % 360;
    const cur = ((this.wheelRot % 360) + 360) % 360;
    this.wheelRot += 360 * 6 + ((target - cur + 360) % 360);
    $('wheelCanvas').style.transform = `rotate(${this.wheelRot}deg)`;
    $('wheelMsg').textContent = '…';
    this.updateWheelUi();
    let delay = 40;
    let tt = 0;
    while (tt < 4200) { setTimeout(() => Sfx.play('spin'), tt); tt += delay; delay *= 1.12; }
    this.persist();
    setTimeout(() => this.wheelReward(WHEEL[idx]), 4750);
  },

  wheelReward(s) {
    this.spinning = false;
    let text = s.label;
    if (s.id === 'c50') this.addCoins(50);
    else if (s.id === 'c100') this.addCoins(100);
    else if (s.id === 'c250') this.addCoins(250);
    else if (s.id === 'c1000') {
      this.addCoins(1000);
      this.save.stats.jackpots++;
      Sfx.play('jackpot');
      text = '💎 جایزه‌ی بزرگ! ۱۰۰۰ سکه';
      this.confetti();
    } else if (s.id === 'drink') { this.drinkUntil = Math.max(Date.now(), this.drinkUntil || 0) + 90000; text = '🥤 ۹۰ ثانیه زور دوبرابر'; }
    else if (s.id === 'lv1') this.addTempLevels(1, 'wheel');
    else if (s.id === 'lv3') { this.addTempLevels(3, 'wheel'); this.confetti(); }
    else if (s.id === 'star') this.giveStar(20);
    if (s.id !== 'c1000') Sfx.play('success');
    $('wheelMsg').textContent = `جایزه: ${text}`;
    this.checkAchievements();
    this.persist();
    this.updateWheelUi();
  },

  /* ---------------- arm wrestling ---------------- */

  openArm() {
    if (this.mode !== 'play' || this.arm || this.world !== this.gym) return;
    const L = this.lv();
    const names = [...NPC_NAMES].sort(() => Math.random() - 0.5);
    const opps = [
      { d: 'easy', tag: 'آسون', icon: '🙂', name: names[0], level: Math.max(1, L - 4), coins: 25 },
      { d: 'mid', tag: 'هم‌زور', icon: '💪', name: names[1], level: L + 1, coins: 60 },
      { d: 'hard', tag: 'قهرمان مچ', icon: '👑', name: names[2], level: L + 7, coins: 150, champ: true },
    ];
    const list = $('armList');
    list.innerHTML = '';
    for (const o of opps) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'arm-card';
      const i = document.createElement('span');
      i.className = 'ac-icon';
      i.textContent = o.icon;
      const mid = document.createElement('span');
      const n = document.createElement('b');
      n.textContent = o.name;
      const sm = document.createElement('small');
      sm.textContent = `سطح زور ${fa(o.level)} • جایزه 🪙 ${fa(o.coins)}`;
      mid.append(n, sm);
      const tag = document.createElement('span');
      tag.className = 'ac-tag ' + o.d;
      tag.textContent = o.tag;
      b.append(i, mid, tag);
      b.addEventListener('click', () => this.startArm(o));
      list.appendChild(b);
    }
    this.openModal('armModal');
  },

  startArm(opp) {
    this.closeModal('armModal');
    if (this.arm || !this.world.canAct()) return;
    this.cancelChallenge();
    this.releasePlayer();
    Sfx.play('whistle');
    const A = new ArmMatch(this.gym, this.player, opp, this.lv());
    A.onSurge = () => {
      const m = $('armMsg');
      m.textContent = 'حریف زور زد! 😤 تندتر بزن!';
      m.className = 'arm-msg warn';
      Sfx.play('groan');
    };
    this.arm = A;
    this.armCount = 0;
    $('hud').classList.add('arm-on');
    $('armHud').hidden = false;
    $('armTitle').textContent = `مچ‌اندازی با ${opp.name} • سطح ${fa(opp.level)}`;
    $('armMsg').className = 'arm-msg';
    $('armFill').style.width = '50%';
    this.gym.gatherFans(ARM_TABLE.x, ARM_TABLE.z, 14, 6, 30);
  },

  armTap() {
    const A = this.arm;
    if (!A) return;
    A.tap();
    const b = $('armTap');
    b.classList.remove('bump');
    void b.offsetWidth;
    b.classList.add('bump');
  },

  tickArm(dt) {
    const A = this.arm;
    const res = A.update(dt);
    $('armFill').style.width = `${clamp((A.theta + 1) / 2, 0, 1) * 100}%`;
    const msg = $('armMsg');
    if (A.state === 'count') {
      const c = Math.ceil(2.4 - A.t);
      if (c !== this.armCount && c > 0) { this.armCount = c; Sfx.play('tick'); msg.textContent = `آماده… ${fa(c)}`; }
    } else if (A.state === 'pull' && this.armCount !== 0) {
      this.armCount = 0;
      Sfx.play('go');
      msg.textContent = 'برو! بزن! بزن!';
    } else if (A.state === 'pull' && A.surge <= 0 && msg.classList.contains('warn')) {
      msg.className = 'arm-msg';
      msg.textContent = A.theta > 0.4 ? 'داری می‌بری! 🔥' : A.theta < -0.4 ? 'داری می‌بازی! زور بزن!' : 'بزن! بزن!';
    }
    if (res) this.armEnded(res, A.opp);
    if (A.state === 'done' && A.t > 2.6) this.closeArm();
  },

  armEnded(res, opp) {
    const s = this.save;
    Sfx.play('slam');
    this.gym.shake = Math.max(this.gym.shake, 0.35);
    const msg = $('armMsg');
    msg.className = 'arm-msg';
    if (res.win) {
      Sfx.play('win');
      Sfx.play('cheer');
      const xp = Math.round((25 + opp.level * 2) * xpMult(s.level));
      msg.textContent = `🏆 بردی! +${fa(xp)} زور • 🪙 ${fa(opp.coins)}`;
      s.stats.armWins++;
      this.addCoins(opp.coins);
      this.gainXp(xp, 'reward');
      this.missionProgress('arm', 1);
      this.showBanner('مچ‌اندازی', '🏆 بردی!');
      if (opp.champ) this.confetti();
    } else {
      Sfx.play('lose');
      const xp = Math.round((6 + opp.level * 0.5) * xpMult(s.level));
      msg.textContent = `😓 باختی! ولی +${fa(xp)} زور گرفتی`;
      this.gainXp(xp, 'reward');
      this.showBanner('مچ‌اندازی', 'باختی!');
    }
    this.checkAchievements();
    this.persist();
  },

  closeArm() {
    const A = this.arm;
    if (!A) return;
    A.dispose();
    this.arm = null;
    this.labelPlayer();
    $('hud').classList.remove('arm-on');
    $('armHud').hidden = true;
    this.refreshMoves();
  },

  /* ---------------- show-off moves ---------------- */

  doEmote(m) {
    if (!this.world.canAct() || this.player.anchor) return;
    if (this.world.playerDo(m.id, () => this.emoteDone(m))) Sfx.play('click');
  },

  emoteDone(m) {
    const p = this.player.ch.root.position;
    const fans = this.world.gatherFans(p.x, p.z, 9, 5, 4);
    this.save.stats.emotes++;
    this.missionProgress('emote', 1);
    if (fans) {
      Sfx.play('cheer');
      if (this.clock - (this.fanCoinT || -99) > 10) {
        this.fanCoinT = this.clock;
        this.addCoins(fans, true);
        this.toast(`👏 ${fa(fans)} نفر برات دست زدن! 🪙 ${fa(fans)}`, 'gold');
      } else this.toast(`👏 ${fa(fans)} نفر برات دست زدن!`);
    }
    this.checkAchievements();
  },

  /* ---------------- titles, belts, celebrations ---------------- */

  labelPlayer() {
    const ch = this.player.ch;
    ch.setLabel(this.playerName(), this.save.goals.champion ? '👑 قهرمانِ قهرمانان' : '🎖️ ' + titleFor(this.lv()), '#ffd34d');
    ch.label.position.y = 2.85;
    ch.label.visible = !WorldBase.hideNames;
  },

  onLevelsFun(from, to) {
    const a = titleFor(from);
    const b = titleFor(to);
    if (a !== b) {
      setTimeout(() => { Sfx.play('medal'); this.toast(`🎖️ عنوان جدید: «${b}»`, 'gold'); this.confetti(); }, 1000);
    }
    this.labelPlayer();
    this.refreshPowers(true);
    for (const pw of POWERS) {
      if (!this.save.unlocked && from < pw.level && to >= pw.level) {
        setTimeout(() => { Sfx.play('unlock'); this.toast(`${pw.icon} قدرت ویژه‌ی «${pw.name}» باز شد! کلید ${fa(pw.key)} یا دکمه‌ی گرد کنار دسته`, 'gold'); }, 2600);
      }
    }
  },

  confetti() {
    const box = document.createElement('div');
    box.className = 'confetti';
    const cols = ['#ffc23d', '#e63946', '#2f6fed', '#2ecc71', '#ff4da6', '#7fe0ff', '#ffffff'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('i');
      c.style.left = `${Math.random() * 100}%`;
      c.style.background = pick(cols);
      c.style.animationDuration = `${rand(1.6, 3.2)}s`;
      c.style.animationDelay = `${rand(0, 0.5)}s`;
      c.style.transform = `rotate(${rand(0, 360)}deg)`;
      box.appendChild(c);
    }
    $('app').appendChild(box);
    setTimeout(() => box.remove(), 4000);
  },

  /* ---------------- photo mode ---------------- */

  enterPhoto() {
    if (this.mode !== 'play') return;
    this.closeModal('menuModal');
    this.photo = true;
    this.keys.clear();
    this.resetJoy();
    $('hud').classList.add('photo-on');
    $('photoBar').hidden = false;
    this.toast('📸 حالت عکس: صفحه رو بکش، با دو انگشت زوم کن، بعد عکس بگیر');
  },

  exitPhoto() {
    this.photo = false;
    $('hud').classList.remove('photo-on');
    $('photoBar').hidden = true;
  },

  takePhoto() {
    let url = '';
    try {
      this.renderer.render(this.world.scene, this.camera);
      url = this.renderer.domElement.toDataURL('image/jpeg', 0.9);
    } catch (e) { url = ''; }
    const f = $('flash');
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
    Sfx.play('clap');
    if (!url || url.length < 100) { this.toast('نشد عکس بگیرم. دوباره امتحان کن.', 'warn'); return; }
    $('photoImg').src = url;
    $('photoSave').href = url;
    this.openModal('photoModal');
  },

  async savePhoto() {
    const url = $('photoSave').href;
    let dl = null;
    try { dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
    if (!dl) { this.toast('روی عکس انگشتت رو نگه دار (یا راست‌کلیک کن) تا ذخیره‌اش کنی.', 'warn'); return; }
    try {
      const bin = atob(url.split(',')[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await dl.save({ filename: 'champion-gym.jpg', data: new Blob([bytes]) });
      this.toast('📸 عکس ذخیره شد!', 'gold');
    } catch (err) {
      if (err && err.code === 'declined') return;
      this.toast('ذخیره نشد. روی عکس انگشتت رو نگه دار تا ذخیره‌اش کنی.', 'warn');
    }
  },

  /* ---------------- settings ---------------- */

  openSettings(keep) {
    const st = this.save.settings;
    document.querySelectorAll('#qualitySeg button').forEach((b) => b.classList.toggle('on', b.dataset.q === st.quality));
    $('sensInput').value = String(st.sens);
    $('namesInput').checked = st.names;
    $('shakeInput').checked = st.shake;
    if (keep) return;
    this.closeModal('menuModal');
    this.openModal('settingsModal');
  },

  applySettings() {
    const st = this.save.settings;
    WorldBase.hideNames = !st.names;
    WorldBase.shakeScale = st.shake ? 1 : 0;
    const dpr = window.devicePixelRatio || 1;
    this.pixelRatio = st.quality === 'low' ? 0.75 : st.quality === 'high' ? Math.min(dpr, 2) : Math.min(dpr, 1.75);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.resize();
    if (this.player) this.labelPlayer();
  },
});
