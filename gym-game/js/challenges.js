'use strict';
/*
 * Challenges: short timed tests with bronze / silver / gold scores and a saved best.
 * They run in whatever world you are in; travelling, wrestling or racing cancels them.
 */

const CHALLENGES = [
  { id: 'reps60', name: '۶۰ ثانیه تمرین', icon: '⏱️', desc: 'در ۶۰ ثانیه هر چند تا ورزش که می‌تونی انجام بده', unit: 'تمرین', tiers: [8, 13, 18], dur: 60 },
  { id: 'rings', name: 'حلقه‌های طلایی', icon: '💍', desc: 'از وسط حلقه‌های طلایی یکی‌یکی رد شو', unit: 'حلقه', tiers: [4, 6, 8], dur: 50 },
  { id: 'coins', name: 'شکار سکه', icon: '🪙', desc: 'در ۳۰ ثانیه تا می‌تونی سکه جمع کن', unit: 'سکه', tiers: [12, 22, 32], dur: 30 },
  { id: 'combo', name: 'استاد کمبو', icon: '🔥', desc: 'پشت سر هم ورزش کن و بزرگ‌ترین کمبو رو بگیر', unit: 'کمبو', tiers: [4, 7, 10], dur: 45 },
  { id: 'sprint', name: 'دوی ۲۰۰ متر', icon: '🏃', desc: '۲۰۰ متر رو هر چی سریع‌تر بدو (دویدن رو روشن کن!)', unit: 'ثانیه', lower: true, tiers: [45, 36, 29], dur: 90 },
  { id: 'coach', name: 'مربی می‌گه', icon: '📣', desc: 'هر حرکتی که مربی گفت رو سریع انجام بده', unit: 'امتیاز', tiers: [3, 5, 7], rounds: 8 },
  { id: 'quake', name: 'زلزله', icon: '🌋', desc: 'با قدرت‌های ویژه ورزشکارها رو بنداز زمین', unit: 'نفر', tiers: [6, 12, 20], dur: 30, level: 10 },
];
const CHALLENGE_BY_ID = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));
const TIER_ICONS = ['🥉', '🥈', '🥇'];
const TIER_NAMES = ['برنز', 'نقره', 'طلا'];
const TIER_COINS = [60, 120, 250];

ACHIEVEMENTS.push(
  { id: 'chal1', name: 'چالش‌گر', icon: '🎯', desc: 'یه مدال طلای چالش بگیر', test: (s) => Object.values(s.challenges || {}).some((c) => c.tier >= 3) },
  { id: 'chalall', name: 'سلطان چالش‌ها', icon: '👑', desc: 'طلای همه‌ی چالش‌ها', test: (s) => CHALLENGES.every((c) => s.challenges && s.challenges[c.id] && s.challenges[c.id].tier >= 3) },
);
MISSION_TYPES.push({ type: 'challenge', targets: [1, 2], text: (n) => `${fa(n)} بار توی چالش‌ها مدال بگیر` });

Object.assign(Game, {
  chal: null,

  challengeTier(c, score) {
    let t = 0;
    c.tiers.forEach((v, i) => { if (c.lower ? score <= v : score >= v) t = i + 1; });
    return t;
  },

  openChallenges() {
    if (this.mode !== 'play') return;
    this.closeModal('menuModal');
    const list = $('chalList');
    list.innerHTML = '';
    const saved = this.save.challenges;
    for (const c of CHALLENGES) {
      const rec = saved[c.id];
      const locked = c.level && !this.save.unlocked && this.lv() < c.level;
      const card = document.createElement('div');
      card.className = 'chal-card' + (locked ? ' locked' : '');
      const ic = document.createElement('div');
      ic.className = 'chal-icon';
      ic.textContent = locked ? '🔒' : c.icon;
      const mid = document.createElement('div');
      const n = document.createElement('b');
      n.textContent = c.name;
      const d = document.createElement('small');
      d.textContent = locked ? `از سطح ${fa(c.level)} باز می‌شه` : c.desc;
      const goals = document.createElement('div');
      goals.className = 'chal-goals';
      goals.textContent = c.tiers.map((v, i) => `${TIER_ICONS[i]} ${fa(v)}`).join('  ') + ` ${c.unit}`;
      mid.append(n, d, goals);
      const right = document.createElement('div');
      right.className = 'chal-right';
      const best = document.createElement('div');
      best.className = 'chal-best';
      best.textContent = rec ? `${rec.tier ? TIER_ICONS[rec.tier - 1] : '—'} رکورد: ${fa(rec.best)}` : 'هنوز نرفتی';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shop-btn';
      btn.textContent = 'شروع!';
      btn.disabled = !!locked;
      btn.addEventListener('click', () => this.startChallenge(c.id));
      right.append(best, btn);
      card.append(ic, mid, right);
      list.appendChild(card);
    }
    this.openModal('chalModal');
  },

  startChallenge(id) {
    const c = CHALLENGE_BY_ID[id];
    this.closeModal('chalModal');
    if (!c || this.chal || this.race || this.arm || this.mode !== 'play') return;
    Sfx.init();
    Sfx.play('whistle');
    const ch = { c, t: c.dur || 0, score: 0, count: 3, run: 0, startT: 0, rings: [], ring: 0, round: 0, target: null, roundT: 0 };
    this.chal = ch;
    this.showBanner(c.icon + ' ' + c.name, 'آماده');
    $('chalHud').hidden = false;
    $('chalHud').textContent = `${c.icon} ${c.name} • آماده…`;
  },

  /** Called once the 3-second countdown ends. */
  beginChallenge() {
    const ch = this.chal;
    const c = ch.c;
    const p = this.player.ch.root.position;
    const w = this.world;
    Sfx.play('go');
    this.showBanner(c.name, 'برو!');
    if (c.id === 'coins' && w.pickups) w.pickups.rain(p.x, p.z, 40);
    if (c.id === 'rings') this.spawnRing();
    if (c.id === 'combo') this.combo = 0;
    if (c.id === 'coach') this.nextCoachRound();
    if (c.id === 'sprint' && this.player.mode === 'walk') this.toast('🏃 برای سریع‌تر شدن دکمه‌ی «دویدن» رو روشن کن!', 'gold');
  },

  spawnRing() {
    const ch = this.chal;
    const w = this.world;
    const p = this.player.ch.root.position;
    let pos = null;
    for (let k = 0; k < 40 && !pos; k++) {
      const a = rand(0, TAU);
      const r = rand(7, 14);
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      if (w.inBounds(x, z, 2) && !w.colliders.some((c) => x > c.x1 - 1.2 && x < c.x2 + 1.2 && z > c.z1 - 1.2 && z < c.z2 + 1.2)) pos = { x, z };
    }
    if (!pos) pos = w.freeSpot();
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.1, 10, 36), new THREE.MeshBasicMaterial({ color: '#ffd34d', toneMapped: false }));
    mesh.position.set(pos.x, 1.3, pos.z);
    mesh.rotation.y = Math.atan2(pos.x - p.x, pos.z - p.z);
    w.scene.add(mesh);
    ch.rings.push(mesh);
    ch.ringPos = pos;
    w.guideTo({ ax: pos.x, az: pos.z });
    this.player.guide.t = 60;
  },

  nextCoachRound() {
    const ch = this.chal;
    if (ch.round >= ch.c.rounds) { this.endChallenge(); return; }
    ch.round++;
    const opts = MOVES.filter((m) => !m.toggle && !m.equip && !m.emote && !m.custom && this.isUnlocked(m) && m.level <= Math.max(3, this.lv()));
    ch.target = pick(opts);
    ch.roundT = 8;
    Sfx.play('whistle');
    this.showBanner(`📣 مربی می‌گه (${fa(ch.round)}/${fa(ch.c.rounds)})`, ch.target.name);
    this.toast(`📣 «${ch.target.name}» ${ch.target.icon} — زود باش!`, 'gold');
    const tabs = { base: 'base', new: 'new', pro: 'pro' };
    if (tabs[ch.target.cat]) this.setTab(tabs[ch.target.cat]);
  },

  /** Hooks from the rest of the game. */
  chalEvent(kind, v) {
    const ch = this.chal;
    if (!ch || ch.count > 0) return;
    const id = ch.c.id;
    if (kind === 'rep' && id === 'reps60') ch.score++;
    else if (kind === 'coin' && id === 'coins') ch.score++;
    else if (kind === 'combo' && id === 'combo') ch.score = Math.max(ch.score, v);
    else if (kind === 'knock' && id === 'quake') ch.score += v;
    else if (kind === 'run' && id === 'sprint') ch.run += v;
    else if (kind === 'rep' && id === 'coach' && ch.target && v.id === ch.target.id) {
      ch.score++;
      Sfx.play('success');
      this.floatText('✔', 'fl-combo');
      ch.target = null;
      ch.roundT = 1.2;
    }
  },

  tickChallenge(dt) {
    const ch = this.chal;
    if (!ch) return;
    const c = ch.c;
    const hud = $('chalHud');
    if (ch.count > 0) {
      const before = Math.ceil(ch.count);
      ch.count -= dt;
      const now = Math.ceil(ch.count);
      if (now !== before && now > 0) { Sfx.play('tick'); this.showBanner(c.name, fa(now)); }
      if (ch.count <= 0) this.beginChallenge();
      else hud.textContent = `${c.icon} ${c.name} • ${fa(Math.ceil(ch.count))}`;
      return;
    }
    ch.startT += dt;
    if (c.dur) ch.t -= dt;
    if (c.id === 'rings' && ch.ringPos) {
      const p = this.player.ch.root.position;
      const ring = ch.rings[ch.rings.length - 1];
      ring.rotation.z += dt * 2;
      ring.scale.setScalar(1 + 0.06 * Math.sin(ch.startT * 6));
      if (Math.hypot(p.x - ch.ringPos.x, p.z - ch.ringPos.z) < 1.3) {
        ch.score++;
        Sfx.play('gem');
        this.world.fx.ring({ x: ch.ringPos.x, y: 1.3, z: ch.ringPos.z }, { count: 40, color: '#ffd34d', radius: 0.6, speed: 4, life: 0.6 });
        this.world.scene.remove(ring);
        ring.geometry.dispose();
        ch.ringPos = null;
        if (ch.score >= 8) { this.endChallenge(); return; }
        this.spawnRing();
      }
    }
    if (c.id === 'coach') {
      ch.roundT -= dt;
      if (ch.roundT <= 0) {
        if (ch.target) { Sfx.play('fail'); this.toast('⏱️ دیر شد!', 'warn'); }
        this.nextCoachRound();
        if (!this.chal) return;
      }
      hud.textContent = ch.target ? `📣 «${ch.target.name}» • ${fa(Math.ceil(ch.roundT))} • امتیاز ${fa(ch.score)}` : `📣 امتیاز ${fa(ch.score)}`;
      return;
    }
    if (c.id === 'sprint') {
      const m = Math.min(200, Math.floor(ch.run));
      hud.textContent = `🏃 ${fa(m)} / ۲۰۰ متر • ${fa(ch.startT.toFixed(1))} ثانیه`;
      if (ch.run >= 200) { ch.score = Math.round(ch.startT * 10) / 10; this.endChallenge(); return; }
      if (ch.t <= 0) { ch.score = 0; this.endChallenge(); }
      return;
    }
    hud.textContent = `${c.icon} ${fa(ch.score)} ${c.unit} • ${fa(Math.max(0, Math.ceil(ch.t)))} ثانیه`;
    if (ch.t <= 0) this.endChallenge();
  },

  clearChallenge() {
    const ch = this.chal;
    if (!ch) return;
    for (const r of ch.rings) { this.world.scene.remove(r); r.geometry.dispose(); }
    if (this.player.guide) this.player.guide = null;
    this.chal = null;
    $('chalHud').hidden = true;
  },

  cancelChallenge() {
    if (!this.chal) return;
    this.clearChallenge();
    this.toast('چالش لغو شد.', 'warn');
  },

  endChallenge() {
    const ch = this.chal;
    const c = ch.c;
    const score = ch.score;
    this.clearChallenge();
    const valid = !c.lower || score > 0;
    const tier = valid ? this.challengeTier(c, score) : 0;
    const rec = this.save.challenges[c.id] || { best: 0, tier: 0 };
    const better = valid && (!rec.best || (c.lower ? score < rec.best : score > rec.best));
    if (better) rec.best = score;
    let coins = 10;
    const newTier = tier > rec.tier;
    if (newTier) {
      for (let t = rec.tier; t < tier; t++) coins += TIER_COINS[t];
      rec.tier = tier;
    }
    this.save.challenges[c.id] = rec;
    const scoreText = valid ? `${fa(score)} ${c.unit}` : 'به خط پایان نرسیدی';
    if (tier) {
      Sfx.play(tier === 3 ? 'jackpot' : 'win');
      this.showBanner(`${TIER_ICONS[tier - 1]} ${TIER_NAMES[tier - 1]}!`, scoreText);
      this.missionProgress('challenge', 1);
      if (tier === 3) this.confetti();
    } else {
      Sfx.play('lose');
      this.showBanner('مدال نگرفتی', scoreText);
    }
    this.toast(`${c.icon} ${c.name}: ${scoreText}${better ? ' • رکورد جدید! 🎉' : ''} • 🪙 ${fa(coins)}`, 'gold');
    this.addCoins(coins);
    this.gainXp(Math.round((20 + 30 * tier) * xpMult(this.save.level)), 'reward');
    this.checkAchievements();
    this.persist();
  },
});
