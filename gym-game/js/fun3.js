'use strict';
/*
 * Round of new things:
 *  code 2929 (choose any amount of strength, counted as cheat strength), quick travel inside the
 *  big gym, a radar, "my stats", camera views, a slow-motion power, high fives, people talking,
 *  snowball fights, hats (and a crown from level 1000), new trails, fireworks, volume sliders,
 *  a giant beach ball, new emotes, double jump, a training buddy, a victory dance after wins,
 *  and new medals.
 */

const CHEAT_CODE = '2929';

/* ---------- data: hats, trails, emotes, the slow-motion power, medals ---------- */

SHOP.push(
  { id: 'hat_cap', cat: 'hat', name: 'کلاه کپ', icon: '🧢', price: 120, once: true, color: '#2f6fed', desc: 'کلاه ورزشی' },
  { id: 'hat_top', cat: 'hat', name: 'کلاه شاپو', icon: '🎩', price: 220, once: true, color: '#1d1d1d', desc: 'خیلی رسمی' },
  { id: 'hat_party', cat: 'hat', name: 'کلاه جشن', icon: '🥳', price: 150, once: true, color: '#ff4da6', desc: 'همیشه جشنه' },
  { id: 'hat_crown', cat: 'hat', name: 'تاج طلایی', icon: '👑', price: 900, once: true, color: '#ffd34d', desc: 'تاج قهرمانی (از سطح ۱۰۰۰ خودش میاد)' },
  { id: 'trail_star', cat: 'trail', name: 'رد ستاره‌ها', icon: '⭐', price: 450, once: true, color: '#ffd34d', desc: 'ستاره‌های طلایی پشت سرت' },
  { id: 'trail_heart', cat: 'trail', name: 'رد قلب‌ها', icon: '💖', price: 450, once: true, color: '#ff4da6', desc: 'دونه‌های صورتی' },
);
for (const it of SHOP) SHOP_BY_ID[it.id] = it;
const TRAIL_COLORS = { trail_star: ['#ffd34d', '#fff1b0', '#ffffff'], trail_heart: ['#ff4da6', '#ff8fab', '#ffffff'] };
const CAM_VIEWS = [['معمولی', 7.2, 0.3], ['نزدیک', 4.2, 0.18], ['دور', 12, 0.45], ['از بالا', 17, 1.05]];

POWERS.push({ id: 'slowmo', name: 'حرکت آهسته', icon: '🐢', level: 60, cd: 30, xp: 40, key: '6' });
POWER_BY_ID.slowmo = POWERS[POWERS.length - 1];

const NEW_EMOTES = [['e_floss', 'فلاس', '🕺'], ['e_heart', 'قلب', '🫶'], ['e_think', 'متفکر', '🤔']]
  .map(([id, name, icon]) => ({ id, name, icon, level: 1, cat: 'fun', emote: true }));
MOVES.push(...NEW_EMOTES);
for (const e of NEW_EMOTES) MOVE_BY_ID[e.id] = e;

Object.assign(ANIMS, {
  e_floss: {
    dur: 2.4,
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.08)) * (1 - smooth(seg(t, 0.92, 1)));
      const s = Math.sin(t * TAU * 4);
      p.x = 0.08 * s * k;
      p.bz = -0.12 * s * k;
      p.shLX = p.shRX = (0.5 * Math.sign(Math.sin(t * TAU * 8)) * 0.6) * k;
      p.shLZ = (0.3 + 0.5 * s) * k + 0.12; p.shRZ = (-0.3 + 0.5 * s) * k - 0.12;
      p.elL = p.elR = -0.15;
      p.knL = p.knR = 0.2 * k;
    },
  },
  e_heart: {
    dur: 2.2,
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.2)) * (1 - smooth(seg(t, 0.85, 1)));
      p.shLX = p.shRX = -2.9 * k;
      p.shLZ = 0.55 * k + 0.1; p.shRZ = -0.55 * k - 0.1;
      p.elL = p.elR = -1.6 * k - 0.15;
      p.nkX = -0.2 * k;
      p.y = 0.03 * Math.sin(t * TAU * 3) * k;
    },
  },
  e_think: {
    dur: 2.6,
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.18)) * (1 - smooth(seg(t, 0.85, 1)));
      p.shRX = -1.25 * k; p.elR = -2.4 * k - 0.18; p.shRZ = -0.25 * k - 0.12;
      p.shLX = -0.5 * k; p.elL = -1.6 * k - 0.18; p.shLZ = 0.35 * k + 0.12;
      p.nkX = 0.25 * k; p.nkY = 0.25 * Math.sin(t * 3) * k;
      p.spX = 0.12 * k;
    },
  },
  e_highfive: {
    dur: 1.2,
    events: [[0.45, 'clap']],
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.3)) * (1 - smooth(seg(t, 0.75, 1)));
      p.shRX = -2.6 * k; p.shRZ = -0.25 - 0.2 * k; p.elR = -0.3;
      p.spX = 0.1 * k;
      p.y = 0.08 * Math.sin(Math.PI * seg(t, 0.3, 0.6));
    },
  },
  throwball: {
    dur: 0.8,
    fn(p, t) {
      const wind = smooth(seg(t, 0, 0.4));
      const go = smooth(seg(t, 0.4, 0.6)) * (1 - smooth(seg(t, 0.75, 1)));
      p.shRX = lerp(-2.6 * wind, -1.0, go); p.elR = lerp(-1.6 * wind, -0.1, go);
      p.spY = 0.4 * wind - 0.5 * go;
      p.hpLX = -0.35 * go; p.knL = 0.3 * go;
    },
  },
});

ACHIEVEMENTS.push(
  { id: 'highfive10', name: 'رفیق همه', icon: '✋', desc: '۱۰ تا بزن قدش', test: (s) => (s.stats.highFives || 0) >= 10 },
  { id: 'snow10', name: 'جنگجوی برفی', icon: '❄️', desc: '۱۰ گلوله‌برفی به هدف بزن', test: (s) => (s.stats.snowHits || 0) >= 10 },
  { id: 'ball20', name: 'توپ‌باز', icon: '🏐', desc: '۲۰ بار به توپ غول‌پیکر ضربه بزن', test: (s) => (s.stats.ballKicks || 0) >= 20 },
  { id: 'dj50', name: 'پرش دوبل', icon: '🦘', desc: '۵۰ بار پرش دوبل بزن', test: (s) => (s.stats.doubleJumps || 0) >= 50 },
  { id: 'buddy', name: 'هم‌تمرینی', icon: '🤝', desc: 'با یه هم‌تمرینی ورزش کن', test: (s) => (s.stats.buddyReps || 0) >= 5 },
  { id: 'hat', name: 'کلاه‌به‌سر', icon: '🧢', desc: 'یه کلاه بپوش', test: (s) => !!s.shop.hat },
  { id: 'slowmo', name: 'ماتریکس', icon: '🐢', desc: 'از حرکت آهسته استفاده کن', test: (s) => (s.stats.slowmo || 0) >= 1 },
  { id: 'fireworks', name: 'شب جشن', icon: '🎆', desc: 'یه آتش‌بازی راه بنداز', test: (s) => (s.stats.fireworks || 0) >= 1 },
  { id: 'gold5', name: 'نیمه‌گنج', icon: '🥇', desc: '۵ دمبل طلایی پیدا کن', test: (s) => (s.goldFound || []).length >= 5 },
  { id: 'hour', name: 'یک ساعت ورزش', icon: '⏰', desc: 'یک ساعت توی بازی ورزش کن', test: (s) => (s.stats.playSec || 0) >= 3600 },
);

/* quick-travel spots inside the big gym */
const GYM_SPOTS = [
  ['🏟️', 'وسط باشگاه', 0, 8], ['🧗', 'دیوار سنگ‌نوردی', 22, -27], ['🔨', 'قدرت‌سنج', 0, -25.5],
  ['🚲', 'کلاس اسپینینگ', -61, 18], ['🏋️', 'وزنه‌ها', -62, 4], ['🏃', 'کاردیو', 62, 4],
  ['🌿', 'باغ الهام', -112, 8], ['🥷', 'پیست نینجا', 106, 0], ['⚡', 'تالار انرژی و دو', 150, 0],
  ['💪', 'مچ‌اندازی', null, null, 'arm'], ['🕺', 'سکوی رقص', 63, 18], ['🥤', 'آبمیوه‌بار', -60, 24],
];

const SPEECH = [
  'امروز روز توئه! 💪', 'یه ست دیگه!', 'آب یادت نره 💧', 'بدن‌سازی یعنی صبر', 'بیا با هم تمرین کنیم!', 'وای چه زوری داری!',
  'من دیروز ۱۰۰ تا شنا رفتم 😎', 'غول باشگاه رو دیدی؟ 🐉', 'دمبل طلایی کجاست؟ 🏆', 'پیست یک‌میلیونی خیلی درازه!',
  'کلاس اسپینینگ بیا 🚲', 'هیچ‌وقت تسلیم نشو... یعنی ادامه بده! 🔥', 'گرم کردن یادت نره', 'امروز پا تمرین دارم 🦵',
];

/* ---------- the giant beach ball ---------- */

function beachBallMesh(r) {
  const tex = makeCanvasTexture(256, 128, (ctx, w, h) => {
    const cols = ['#e63946', '#ffffff', '#ffd34d', '#ffffff', '#2f6fed', '#ffffff'];
    cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect((i * w) / cols.length, 0, w / cols.length + 1, h); });
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }));
  m.userData.noSolid = true;
  return m;
}

Object.assign(Game, {
  /* ---------- code 2929 ---------- */

  openCheatAmount() {
    $('cheatAmt').value = String(this.save.cheatAmt || 100);
    this.closeModal('codeModal');
    this.openModal('cheatModal');
  },

  addCheatStrength() {
    const n = clamp(Math.floor(Number(digitsOnly($('cheatAmt').value)) || 0), 0, 1e12);
    this.closeModal('cheatModal');
    if (!(n > 0)) return;
    const s = this.save;
    s.cheatAmt = n;
    const from = this.lv();
    s.level += n;
    s.cheatLv = (s.cheatLv || 0) + n;
    setPlayerLevelLook(this.player, this.lv());
    this.labelPlayer();
    this.levelTemp = true;
    try { this.levelsGained(from, this.lv(), false, 'main'); } finally { this.levelTemp = false; }
    this.toast(`🔑 +${fa(n)} سطح زور با کد ۲۹۲۹ (تقلبی حساب می‌شه؛ از منو با «پاک کردن زور تقلبی» برمی‌گرده).`, 'gold');
    this.refreshPowers(true);
    this.refreshMoves();
    this.refreshHud(true);
    this.persist();
  },

  /* ---------- quick travel inside the gym ---------- */

  openQuickTravel() {
    this.closeModal('menuModal');
    const box = $('qtList');
    box.innerHTML = '';
    for (const [icon, name, x, z, special] of GYM_SPOTS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'menu-btn';
      b.textContent = `${icon} ${name}`;
      b.addEventListener('click', () => this.quickTravel(x, z, special));
      box.appendChild(b);
    }
    this.openModal('qtModal');
  },

  quickTravel(x, z, special) {
    this.closeModal('qtModal');
    // no teleporting mid-race (a lap could be "run" that way), arm wrestling, building or photos
    if (this.race || this.arm || this.build || this.photo) { this.toast('اول کاری که می‌کنی رو تموم کن.', 'warn'); return; }
    const g = this.gym;
    if (this.world === g && this.loop) this.stopLoop(true);
    if (special === 'arm') { x = ARM_TABLE.x; z = ARM_TABLE.z + 2.2; }
    const go = () => {
      const P = this.player;
      g.ensureSolids();
      let tx = x, tz = z;
      outer: for (let r = 0; r < 8; r += 0.5) {
        for (let a = 0; a < TAU; a += Math.PI / 8) {
          const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
          if (g.inBounds(px, pz, 0.8) && g.spotFree(px, pz, 0.45)) { tx = px; tz = pz; break outer; }
          if (r === 0) break;
        }
      }
      P.ch.stopAction();
      P.ch.root.position.set(tx, 0, tz);
      P.vel.set(0, 0);
      g.cam.tx = tx; g.cam.tz = tz;
      g.fx.burst({ x: tx, y: 1, z: tz }, { count: 40, colors: ['#7fe0ff', '#ffffff', '#ffd34d'], speed: 3, up: 3, life: 0.8 });
      Sfx.play('whoosh');
    };
    if (this.world === g) go();
    else this.toast('اول از نقشه 🗺️ برگرد باشگاه، بعد این‌جا رو بزن.', 'warn');
  },

  /* ---------- my stats ---------- */

  openStats() {
    this.closeModal('menuModal');
    const s = this.save;
    const st = s.stats;
    const hours = Math.floor((st.playSec || 0) / 3600);
    const mins = Math.floor(((st.playSec || 0) % 3600) / 60);
    const rows = [
      ['💪 سطح زور', fa(this.lv())], ['🏃 سطح دویدن', fa(this.runLv())], ['⚡ سطح انرژی', fa(this.energyLv())],
      ['⚙️ سطح باشگاه فولاد', fa(s.g2.level)], ['🔁 کل تمرین‌ها', fa(st.reps)], ['🎯 ورزش‌های مختلف', fa(Object.keys(st.moves).length)],
      ['🚶 مسافت راه رفته', `${fa(Math.floor((st.meters || 0) / 1000))} کیلومتر`], ['🏁 رکورد پیست', `${fa(Math.floor(s.runBest || 0))} متر`],
      ['🤼 کشتی', `${fa(s.wins)} برد • ${fa(s.losses)} باخت`], ['💪 مچ‌اندازی', `${fa(st.armWins)} برد`],
      ['🐉 غول باشگاه', `${fa(st.bossWins || 0)} بار شکست دادی`], ['🏆 دمبل طلایی', `${fa((s.goldFound || []).length)} از ${fa(GOLD_SPOTS.length)}`],
      ['🏅 مدال‌ها', `${fa(s.achievements.length)} از ${fa(ACHIEVEMENTS.length)}`], ['🪙 سکه‌ی جمع‌شده', fa(st.coinsEarned)],
      ['✋ بزن قدش', fa(st.highFives || 0)], ['🦘 پرش دوبل', fa(st.doubleJumps || 0)],
      ['⏰ زمان ورزش', `${fa(hours)} ساعت و ${fa(mins)} دقیقه`],
    ];
    const box = $('statsList');
    box.innerHTML = '';
    for (const [k, v] of rows) {
      const li = document.createElement('li');
      li.innerHTML = '<span></span><b></b>';
      li.firstChild.textContent = k;
      li.lastChild.textContent = v;
      box.appendChild(li);
    }
    this.openModal('statsModal');
  },

  /* ---------- camera views ---------- */

  cycleCamera() {
    const i = ((this.save.settings.cam || 0) + 1) % CAM_VIEWS.length;
    this.save.settings.cam = i;
    this.applyCamView();
    this.toast(`🎥 دوربین: ${CAM_VIEWS[i][0]}`);
    this.persist();
  },

  /** The chosen view follows you to every place (and after reloading). */
  applyCamView() {
    const w = this.world;
    this.camWorld = w;
    const v = CAM_VIEWS[this.save.settings.cam || 0];
    if (!w || !w.cam || !v) return;
    if (!w.cam0) w.cam0 = { dist: w.cam.dist, pitch: w.cam.pitch };
    // "normal" is each place's own view
    w.cam.dist = this.save.settings.cam ? v[1] : w.cam0.dist;
    w.cam.pitch = this.save.settings.cam ? v[2] : w.cam0.pitch;
  },

  /* ---------- slow motion ---------- */

  startSlowmo() {
    const pw = POWER_BY_ID.slowmo;
    if (this.mode !== 'play' || this.modals.size || this.race || this.arm || this.photo || this.build) return;
    if (!this.powerUnlocked(pw)) { Sfx.play('error'); this.toast(`🔒 قدرت «${pw.name}» در سطح ${fa(pw.level)} باز می‌شه.`, 'warn'); return; }
    if (this.powerCd.slowmo > 0 || this.slowmo) return;
    Sfx.init();
    this.slowmo = { t: 6 };
    this.powerCd.slowmo = pw.cd;
    this.save.stats.slowmo = (this.save.stats.slowmo || 0) + 1;
    this.save.stats.powers++;
    $('slowFx').hidden = false;
    Sfx.play('charge');
    this.showBanner('همه‌چیز آهسته شد...', '🐢 حرکت آهسته');
    this.missionProgress('power', 1);
    this.gainXp(Math.round(pw.xp * xpMult(this.save.level)));
    this.checkAchievements();
    this.refreshPowers();
  },

  /** Real seconds in, game seconds out. */
  timeScale(dt) {
    const S = this.slowmo;
    if (!S) return dt;
    S.t -= dt;
    if (S.t <= 0) { this.slowmo = null; $('slowFx').hidden = true; return dt; }
    return dt * 0.35;
  },

  /* ---------- high fives and a training buddy ---------- */

  highFiveAction() {
    const w = this.world;
    const p = this.player.ch.root.position;
    let best = null;
    let bd = 1.9;
    for (const n of w.npcs) {
      if (!['idle', 'walk', 'jog', 'chat'].includes(n.state) || n.anchored || n.ch.busy) continue;
      const d = Math.hypot(n.ch.root.position.x - p.x, n.ch.root.position.z - p.z);
      if (d < bd) { bd = d; best = n; }
    }
    if (!best) return null;
    return { label: `✋ بزن قدش با ${best.name}`, run: () => this.highFive(best) };
  },

  highFive(n) {
    const P = this.player;
    const p = P.ch.root.position;
    const q = n.ch.root.position;
    P.ch.root.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
    n.vel.set(0, 0);
    n.state = 'fan';
    n.fan = { x: p.x, z: p.z, t: 1.1, anim: 'e_highfive' };
    if (!P.ch.play('e_highfive')) return;
    const st = this.save.stats;
    st.highFives = (st.highFives || 0) + 1;
    const now = this.clock;
    n.fiveT = n.fiveT || -99;
    if (now - n.fiveT > 60) { n.fiveT = now; setTimeout(() => { this.addCoins(5); this.floatText('+۵ 🪙', ''); }, 500); }
    this.say(n, pick(['قدش! ✋', 'ایول! 🔥', 'دمت گرم!', 'رفیق! 😄']));
    // sometimes they want to train with you
    if (!this.buddy && Math.random() < 0.35) setTimeout(() => this.askBuddy(n), 1300);
    this.checkAchievements();
  },

  askBuddy(n) {
    if (this.buddy || n.world !== this.world || !['idle', 'walk', 'fan', 'jog'].includes(n.state)) return;
    this.buddy = { n, t: 180 };
    n.state = 'buddy';
    n.ch.setLabel(n.name, '🤝 هم‌تمرینی تو', '#2ecc71');
    this.toast(`🤝 ${n.name} می‌خواد ۳ دقیقه باهات تمرین کنه! هر ورزشی بکنی، اونم کنارت انجام می‌ده.`, 'gold');
  },

  tickBuddy(dt) {
    const B = this.buddy;
    if (!B) return;
    const n = B.n;
    B.t -= dt;
    if (B.t <= 0 || n.world !== this.world || n.state !== 'buddy') {
      if (n.state === 'buddy') { n.state = 'idle'; n.timer = 1; n.ch.setLabel(n.name, 'سطح ' + fa(n.level), '#7fe0ff'); this.say(n, 'مرسی، خوش گذشت! 👋'); }
      this.buddy = null;
      return;
    }
    // copy what you are doing
    const L = this.loop;
    if (L && !L.st && !n.ch.busy && n.ch.grounded && n.buddyNear && ANIMS[L.anim]) {
      n.ch.play(L.anim, () => { this.save.stats.buddyReps = (this.save.stats.buddyReps || 0) + 1; this.world.npcGain(n, L.anim); this.checkAchievements(); });
    }
  },

  say(n, text) {
    n.ch.setLabel(n.name, '💬 ' + text, '#ffffff');
    n.sayT = 3.5;
  },

  /* people around you chat now and then */
  tickSpeech(dt) {
    const w = this.world;
    if (!w || this.mode !== 'play') return;
    for (const n of w.npcs) {
      if (n.sayT > 0) {
        n.sayT -= dt;
        if (n.sayT <= 0 && !['class', 'race', 'boss', 'buddy', 'leave', 'knocked'].includes(n.state)) n.ch.setLabel(n.name, 'سطح ' + fa(n.level), '#7fe0ff');
      }
    }
    this.speechT = (this.speechT ?? 6) - dt;
    if (this.speechT > 0) return;
    this.speechT = rand(5, 10);
    const p = this.player.ch.root.position;
    const near = w.npcs.filter((n) => ['idle', 'walk', 'exercise', 'jog', 'chat'].includes(n.state) && !(n.sayT > 0) && n.ch.root.position.distanceTo(p) < 16);
    if (near.length) this.say(pick(near), pick(SPEECH));
  },

  /* ---------- snowball fights (snowy places) ---------- */

  snowyHere() { return this.world && (this.world.env === 'snow' || this.world.env === 'ice'); },

  throwSnowball() {
    if (!this.snowyHere() || this.mode !== 'play' || this.modals.size) return;
    const P = this.player;
    if (P.ch.busy || P.anchor || !P.ch.grounded) return;
    P.ch.play('throwball');
    setTimeout(() => this.launchSnowball(P.ch, true), 330);
  },

  launchSnowball(ch, mine) {
    const w = this.world;
    if (!w || !ch.root.parent) return;
    const yaw = ch.root.rotation.y;
    const p = ch.root.position;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }));
    m.userData.noSolid = true;
    m.position.set(p.x + Math.sin(yaw) * 0.5, p.y + 1.5, p.z + Math.cos(yaw) * 0.5);
    w.scene.add(m);
    (this.snowballs || (this.snowballs = [])).push({ m, w, vx: Math.sin(yaw) * 15, vy: 1.6, vz: Math.cos(yaw) * 15, mine, from: ch, t: 0 });
    Sfx.play('whoosh');
  },

  tickSnowballs(dt) {
    const list = this.snowballs;
    if (!list || !list.length) return;
    for (const b of [...list]) {
      const done = () => { b.w.scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); list.splice(list.indexOf(b), 1); };
      if (b.w !== this.world) { done(); continue; }
      b.t += dt;
      b.vy -= 9.8 * dt;
      const q = b.m.position;
      q.x += b.vx * dt; q.y += b.vy * dt; q.z += b.vz * dt;
      let hit = null;
      if (b.mine) {
        for (const n of b.w.npcs) {
          const c = n.ch.root.position;
          if (['idle', 'walk', 'exercise', 'jog', 'chat', 'fan'].includes(n.state) && !n.anchored && Math.hypot(c.x - q.x, c.z - q.z) < 0.45 && q.y > c.y && q.y < c.y + 1.9) { hit = n; break; }
        }
      } else {
        const c = this.player.ch.root.position;
        if (Math.hypot(c.x - q.x, c.z - q.z) < 0.45 && q.y > c.y && q.y < c.y + 1.9) hit = 'me';
      }
      const blocked = q.y <= 0.05 || b.t > 3 || !b.w.spotFree(q.x, q.z, 0.05);
      if (hit || blocked) {
        b.w.fx.burst({ x: q.x, y: Math.max(0.1, q.y), z: q.z }, { count: 20, colors: ['#ffffff', '#dfefff'], speed: 2, up: 1.5, life: 0.5 });
        if (hit === 'me') {
          this.toast('❄️ خوردی! تلافی کن 😄');
        } else if (hit) {
          this.save.stats.snowHits = (this.save.stats.snowHits || 0) + 1;
          b.w.knockNpc(hit, b.from.root.position.x, b.from.root.position.z);
          this.floatText('❄️ بزن!', 'fl-combo');
          this.checkAchievements();
          // they throw one back after getting up
          if (Math.random() < 0.5) setTimeout(() => { if (hit.world === this.world && this.snowyHere() && this.mode === 'play' && !this.modals.size && !hit.anchored && ['idle', 'walk', 'fan', 'jog', 'chat'].includes(hit.state)) { const a = hit.ch.root.position; const me = this.player.ch.root.position; hit.ch.root.rotation.y = Math.atan2(me.x - a.x, me.z - a.z); if (hit.ch.play('throwball')) setTimeout(() => this.launchSnowball(hit.ch, false), 330); } }, 3300);
        }
        done();
      }
    }
  },

  /* ---------- hats (and a crown from level 1000) ---------- */

  tickHat() {
    const P = this.player;
    if (!P) return;
    const sh = this.save.shop;
    const want = sh.hat && this.owns(sh.hat) ? sh.hat : (this.save.level >= 1000 ? 'hat_crown' : null);
    if (P.hatId === want && P.hatMesh && P.hatMesh.parent === P.ch.B.head) return;
    if (P.hatMesh) { if (P.hatMesh.parent) P.hatMesh.parent.remove(P.hatMesh); P.hatMesh.geometry.dispose(); }
    P.hatMesh = null;
    P.hatId = want;
    if (!want) return;
    const b = new Batch();
    const col = SHOP_BY_ID[want].color;
    if (want === 'hat_cap') { b.sphere(0.165, 0, 0.27, 0, col, 0.6); b.box(0.2, 0.025, 0.16, 0, 0.26, 0.15, col); }
    else if (want === 'hat_top') { b.cyl(0.13, 0.26, 0, 0.42, 0, col, 0, 0, 0, 18); b.cyl(0.22, 0.02, 0, 0.3, 0, col, 0, 0, 0, 20); b.cyl(0.135, 0.05, 0, 0.33, 0, '#e63946', 0, 0, 0, 18); }
    else if (want === 'hat_party') { b.add(UnitGeo.cone(14), 0, 0.46, 0, col, 0, 0, 0, 0.12, 0.3, 0.12); b.sphere(0.04, 0, 0.62, 0, '#ffd34d'); }
    else {
      b.cyl(0.15, 0.1, 0, 0.36, 0, col, 0, 0, 0, 16);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; b.add(UnitGeo.cone(4), Math.cos(a) * 0.12, 0.45, Math.sin(a) * 0.12, col, 0, 0, 0, 0.04, 0.09, 0.04); b.sphere(0.022, Math.cos(a) * 0.15, 0.36, Math.sin(a) * 0.15, i % 2 ? '#e63946' : '#2f6fed'); }
    }
    P.hatMesh = new THREE.Mesh(mergeParts(b.parts, false), METAL_MAT);
    P.ch.B.head.add(P.hatMesh);
  },

  /* ---------- fireworks ---------- */

  fireworks(secs = 10) {
    this.fw = { t: secs, next: 0 };
    this.save.stats.fireworks = (this.save.stats.fireworks || 0) + 1;
    this.checkAchievements();
  },

  tickFireworks(dt) {
    const F = this.fw;
    if (!F) return;
    F.t -= dt;
    F.next -= dt;
    if (F.t <= 0) { this.fw = null; return; }
    if (F.next > 0) return;
    F.next = rand(0.25, 0.5);
    const w = this.world;
    const p = this.player.ch.root.position;
    const top = Math.min((w.ceiling || 30) - 1.5, 16);
    const x = p.x + rand(-12, 12);
    const z = p.z + rand(-12, 12);
    const y = rand(Math.min(6, top - 1), top);
    const hue = Math.random();
    const cols = [0, 0.08, 0.16].map((h) => '#' + new THREE.Color().setHSL((hue + h) % 1, 0.9, 0.6).getHexString());
    w.fx.burst({ x, y, z }, { count: 70, colors: [...cols, '#ffffff'], speed: 6, up: 1, life: 1.4 });
    for (let i = 0; i < 6; i++) w.fx.emit(x, y - i * (y / 6), z, 0, 2, 0, new THREE.Color('#ffd34d'), 0.4, 0);
    Sfx.play(Math.random() < 0.5 ? 'boom' : 'pop');
  },

  /* ---------- the giant beach ball in the gym ---------- */

  tickBall(dt) {
    const g = this.gym;
    if (!g) return;
    if (!g.ball) {
      const r = 0.6;
      const mesh = beachBallMesh(r);
      g.scene.add(mesh);
      g.ball = { mesh, r, pos: new THREE.Vector3(9, r, 9), vel: new THREE.Vector3(), kickT: 0 };
    }
    if (this.world !== g) return;
    const B = g.ball;
    B.kickT -= dt;
    // anyone running into it gives it a kick
    const kickers = [this.player.ch, ...g.npcs.map((n) => n.ch)];
    for (const ch of kickers) {
      const c = ch.root.position;
      const dx = B.pos.x - c.x, dz = B.pos.z - c.z;
      const d = Math.hypot(dx, dz);
      if (d < B.r + 0.35 && B.pos.y < 1.6 + c.y) {
        const P = ch === this.player.ch ? this.player : null;
        const sp = P ? P.vel.length() : 2;
        const push = Math.max(3, sp * 1.4);
        B.vel.x = (dx / (d || 1)) * push;
        B.vel.z = (dz / (d || 1)) * push;
        B.vel.y = Math.max(B.vel.y, 2 + sp * 0.4);
        B.pos.x = c.x + (dx / (d || 1)) * (B.r + 0.36);
        B.pos.z = c.z + (dz / (d || 1)) * (B.r + 0.36);
        if (P && B.kickT <= 0) { B.kickT = 0.4; this.save.stats.ballKicks = (this.save.stats.ballKicks || 0) + 1; Sfx.play('pop'); this.checkAchievements(); }
      }
    }
    B.vel.y -= 14 * dt;
    const before = B.pos.clone();
    B.pos.addScaledVector(B.vel, dt);
    if (B.pos.y < B.r) { B.pos.y = B.r; B.vel.y = Math.abs(B.vel.y) > 1.2 ? -B.vel.y * 0.6 : 0; B.vel.x *= 0.985; B.vel.z *= 0.985; }
    // bounce off walls and machines (its real outline)
    const q = new THREE.Vector3(B.pos.x, 0, B.pos.z);
    g.resolve(q, B.r);
    const nx = q.x - B.pos.x, nz = q.z - B.pos.z;
    const nl = Math.hypot(nx, nz);
    if (nl > 1e-4) {
      const ux = nx / nl, uz = nz / nl;
      const vn = B.vel.x * ux + B.vel.z * uz;
      if (vn < 0) { B.vel.x -= 1.7 * vn * ux; B.vel.z -= 1.7 * vn * uz; }
      B.pos.x = q.x; B.pos.z = q.z;
    }
    const dist = Math.hypot(B.pos.x - before.x, B.pos.z - before.z);
    B.mesh.position.copy(B.pos);
    if (dist > 1e-4) B.mesh.rotateOnWorldAxis(new THREE.Vector3(B.vel.z, 0, -B.vel.x).normalize(), dist / B.r);
  },

  /* ---------- a little dance after a big win ---------- */

  victoryDance(delay = 900) {
    setTimeout(() => {
      const P = this.player;
      if (this.mode === 'play' && P && !P.anchor && !P.ch.busy && P.ch.grounded && !this.loop) P.ch.play(pick(['e_victory', 'e_dance', 'e_floss']));
    }, delay);
  },

  /* ---------- the radar ---------- */

  tickRadar() {
    const cv = $('radar');
    const on = this.mode === 'play' && this.save.settings.radar !== false && !this.photo && !this.build;
    cv.hidden = !on;
    if (!on) return;
    this.radarT = (this.radarT || 0) + 1;
    if (this.radarT % 4) return;
    const ctx = cv.getContext('2d');
    const S = cv.width;
    const R = S / 2;
    const range = 30;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(10, 16, 34, 0.72)';
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(127, 224, 255, 0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(127, 224, 255, 0.18)';
    ctx.beginPath(); ctx.arc(R, R, R / 2, 0, TAU); ctx.stroke();
    const w = this.world;
    const p = this.player.ch.root.position;
    const yaw = w.cam.yaw;
    // the top of the radar is where the camera looks
    const toR = (x, z) => {
      const dx = x - p.x, dz = z - p.z;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const u = (dx * rx + dz * rz) / range, v = (dx * fx + dz * fz) / range;
      const L = Math.hypot(u, v);
      const k = L > 0.92 ? 0.92 / L : 1;
      return [R + u * k * R, R - v * k * R, L <= 1];
    };
    const dot = (x, z, col, r) => { const [a, b] = toR(x, z); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(a, b, r, 0, TAU); ctx.fill(); };
    for (const n of w.npcs) dot(n.ch.root.position.x, n.ch.root.position.z, n.state === 'buddy' ? '#2ecc71' : '#7fe0ff', 2.6);
    // golden dumbbells: a star when close, a star on the rim pointing the way when far (treasure compass)
    if (w.goldItems) for (const it of w.goldItems) {
      const [a, b, inR] = toR(it.mesh.position.x, it.mesh.position.z);
      ctx.globalAlpha = inR ? 1 : 0.55 + 0.45 * Math.sin(this.clock * 5);
      ctx.fillStyle = '#ffd34d';
      ctx.font = `${inR ? 14 : 12}px sans-serif`;
      ctx.fillText('★', a - 5, b + 5);
      ctx.globalAlpha = 1;
    }
    if (w === this.gym && this.gym.boss) { const q = this.gym.boss.ch.root.position; dot(q.x, q.z, '#7bc96f', 6); }
    if (w.ball) dot(w.ball.pos.x, w.ball.pos.z, '#ff4da6', 3.5);
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath(); ctx.moveTo(R, R - 7); ctx.lineTo(R - 5, R + 5); ctx.lineTo(R + 5, R + 5); ctx.closePath(); ctx.fill();
  },

  /* ---------- odds and ends every frame ---------- */

  tickFun3(dt) {
    if (this.mode === 'play') {
      if (this.camWorld !== this.world && !this.watch) this.applyCamView();
      const st = this.save.stats;
      st.playSec = (st.playSec || 0) + dt;
      if (Math.floor(st.playSec) % 60 === 0 && Math.floor(st.playSec - dt) % 60 !== 0) this.checkAchievements();
      const P = this.player;
      st.meters = (st.meters || 0) + (P.anchor ? 0 : P.vel.length() * dt);
    }
    this.tickHat();
    this.tickBuddy(dt);
    this.tickSpeech(dt);
    this.tickSnowballs(dt);
    this.tickFireworks(dt);
    this.tickBall(dt);
    this.tickRadar();
    $('snowBtn').hidden = !(this.mode === 'play' && this.snowyHere());
  },
});

/* the training buddy follows you around */
Object.assign(WorldBase.prototype, {
  buddyNpc(n, dt) {
    const P = this.player;
    const pos = n.ch.root.position;
    const p = P.ch.root.position;
    const yaw = P.ch.root.rotation.y;
    // at your side, a little behind
    const tx = p.x + Math.cos(yaw) * 1.3 - Math.sin(yaw) * 0.6;
    const tz = p.z - Math.sin(yaw) * 1.3 - Math.cos(yaw) * 0.6;
    const dx = tx - pos.x;
    const dz = tz - pos.z;
    const d = Math.hypot(dx, dz);
    n.buddyNear = d < 1.2;
    if (d > 0.4 && !n.ch.busy) return [dx / d, dz / d, Math.min(d > 6 ? 5 : 2.6, d * 2.5)];
    if (!n.ch.busy) n.ch.root.rotation.y = angleLerp(n.ch.root.rotation.y, yaw, damp(6, dt));
    return [0, 0, 0];
  },
});

/* code 2929, the slow-motion power and double-jump counting plug into what is already there */
const _submitCode = Game.submitCode;
Game.submitCode = function () {
  if (digitsOnly($('codeInput').value) === CHEAT_CODE) { this.openCheatAmount(); return; }
  _submitCode.call(this);
};
const _usePower3 = Game.usePower;
Game.usePower = function (id) {
  if (id === 'slowmo') { this.startSlowmo(); return; }
  _usePower3.call(this, id);
};
WorldBase.prototype.onDoubleJump = function () {
  const s = Game.save.stats;
  s.doubleJumps = (s.doubleJumps || 0) + 1;
  if (s.doubleJumps % 10 === 0) Game.checkAchievements();
};
