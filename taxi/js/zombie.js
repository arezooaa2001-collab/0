import * as THREE from 'three';
import { concatGeometries, clamp, fa, pick } from './util.js';

const $ = (id) => document.getElementById(id);
const N = 16;
const DAWN = 5.5;
const HOSPITAL_MIN = 10; // the ambulance takes ten minutes

/* ---------------- the (deliberately cute) zombies ---------------- */
function painted(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = c.r;
    a[i * 3 + 1] = c.g;
    a[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const at = (geo, x, y, z, sx = 1, sy = 1, sz = 1) => {
  geo.scale(sx, sy, sz);
  geo.translate(x, y, z);
  return geo;
};
/** body: legs, puffy coat, round mint head, big friendly eyes, rosy cheeks, smile, beanie and scarf */
function bodyGeometry(coat, hat, scarf) {
  const skin = 0xa8e6a1;
  const parts = [
    painted(at(new THREE.CylinderGeometry(0.11, 0.12, 0.62, 8), -0.12, 0.31, 0), 0x3b4a6b),
    painted(at(new THREE.CylinderGeometry(0.11, 0.12, 0.62, 8), 0.12, 0.31, 0), 0x3b4a6b),
    painted(at(new THREE.SphereGeometry(0.14, 8, 6), -0.12, 0.04, 0.05, 1, 0.6, 1.4), 0x5d4037),
    painted(at(new THREE.SphereGeometry(0.14, 8, 6), 0.12, 0.04, 0.05, 1, 0.6, 1.4), 0x5d4037),
    painted(at(new THREE.SphereGeometry(0.33, 14, 10), 0, 0.98, 0, 1, 1.2, 0.85), coat),
    painted(new THREE.TorusGeometry(0.2, 0.07, 8, 16).rotateX(Math.PI / 2).translate(0, 1.33, 0), scarf),
    painted(at(new THREE.BoxGeometry(0.12, 0.3, 0.05), 0.1, 1.18, 0.22), scarf),
    painted(at(new THREE.SphereGeometry(0.3, 18, 14), 0, 1.66, 0), skin),
    // big round eyes with a glint (friendly, not creepy)
    painted(at(new THREE.SphereGeometry(0.095, 12, 10), -0.11, 1.7, 0.24), 0xffffff),
    painted(at(new THREE.SphereGeometry(0.095, 12, 10), 0.11, 1.7, 0.24), 0xffffff),
    painted(at(new THREE.SphereGeometry(0.05, 10, 8), -0.1, 1.71, 0.32), 0x1b1b2f),
    painted(at(new THREE.SphereGeometry(0.05, 10, 8), 0.12, 1.71, 0.32), 0x1b1b2f),
    painted(at(new THREE.SphereGeometry(0.018, 6, 4), -0.085, 1.73, 0.36), 0xffffff),
    painted(at(new THREE.SphereGeometry(0.018, 6, 4), 0.135, 1.73, 0.36), 0xffffff),
    painted(at(new THREE.SphereGeometry(0.05, 8, 6), -0.19, 1.6, 0.22, 1, 0.6, 0.4), 0xff9eb5),
    painted(at(new THREE.SphereGeometry(0.05, 8, 6), 0.19, 1.6, 0.22, 1, 0.6, 0.4), 0xff9eb5),
    painted(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI).rotateZ(Math.PI).translate(0, 1.58, 0.28), 0x5a2a2a),
    // bobble hat
    painted(at(new THREE.SphereGeometry(0.31, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.74, 0, 1, 0.75, 1), hat),
    painted(at(new THREE.CylinderGeometry(0.31, 0.31, 0.07, 16), 0, 1.75, 0), 0xffffff),
    painted(at(new THREE.SphereGeometry(0.08, 8, 6), 0, 2.0, 0), 0xffffff),
  ];
  return concatGeometries(parts);
}
function armsGeometry(coat) {
  const skin = 0xa8e6a1;
  return concatGeometries([
    painted(new THREE.CylinderGeometry(0.075, 0.08, 0.5, 8).rotateX(Math.PI / 2).translate(-0.3, 0, 0.25), coat),
    painted(new THREE.CylinderGeometry(0.075, 0.08, 0.5, 8).rotateX(Math.PI / 2).translate(0.3, 0, 0.25), coat),
    painted(new THREE.SphereGeometry(0.09, 8, 6).translate(-0.3, 0, 0.53), skin),
    painted(new THREE.SphereGeometry(0.09, 8, 6).translate(0.3, 0, 0.53), skin),
  ]);
}

const CONTACTS = [
  ['👵', 'مامان‌بزرگ', 'plead'], ['🧑‍🔧', 'اوستا رضا', 'friend'], ['👮', 'پلیس راهنمایی', 'trick'], ['🧔', 'همسایه طبقه بالا', 'plead'],
  ['🕶️', 'ناشناس', 'threat'], ['🧳', 'مسافر عجول', 'fare'], ['👩‍⚕️', 'دکتر شیفت شب', 'trick'], ['🎅', 'یه آدم برفی', 'threat'],
  ['🍕', 'پیک پیتزا', 'fare'], ['🧑‍🎤', 'دوستت علی', 'plead'],
];
const LINES = {
  plead: {
    open: ['سلام! بیرون خیلی سرده 🥶 میشه در رو باز کنی بیام تو؟', 'تو رو خدا در رو باز کن، دارم یخ می‌زنم!', 'من پشت ماشینتم، فقط یه لحظه در رو باز کن 🙏'],
    no: ['چرا؟ من که آشنام! فقط یه لحظه...', 'باشه... ولی خیلی بی‌معرفتی 😢', 'قول میدم کاری نکنم، فقط گرم شم!'],
    yes: ['آخ جون! پس قفل رو باز کن، الان میام 😃', 'مرسی!! زود قفل رو باز کن 🏃'],
    any: ['هوا خیلی سرده... در رو باز کنی همه چی درست میشه 🥺', 'من کنار ماشینتم ها، فقط قفل رو بزن', 'گوشیم داره خاموش میشه، زود باش!'],
  },
  trick: {
    open: ['سلام، از طرف اداره هستیم. برای بازرسی لطفاً در خودرو را باز کنید.', 'سلام، من پزشکم. باید معاینه‌ت کنم، در رو باز کن.', 'این یه پیام رسمیه: قفل درها رو باز کنید.'],
    no: ['این یه دستور رسمیه! باید باز کنی.', 'اگه همکاری نکنی برات بد میشه... (جدی میگم 😅)', 'خب... کارت شناسایی‌م رو از پشت شیشه نشونت میدم.'],
    yes: ['ممنون از همکاری. قفل رو باز کنید لطفاً.', 'عالیه، منتظرم قفل رو باز کنی.'],
    any: ['آدرس دقیقت رو داریم، کنار ماشینتیم.', 'مدارکت رو چک کردیم، فقط در رو باز کن.', 'نترس، من واقعاً پلیسم 👮 (شاید)'],
  },
  threat: {
    open: ['اگه در رو باز نکنی، فردا کل ماشینت رو زیر برف قایم می‌کنم ☃️', 'می‌دونم کجایی! زود در رو باز کن 😤', 'باز نکنی همه جا میگم تاکسیت بوی جوراب میده! 🧦'],
    no: ['باشه... یادم می‌مونه! 😤', 'هه! فکر کردی ترسیدم؟ من که نترسیدم... تو هم نترس 😅', 'پس منم تا صبح برات گوله برفی پرت می‌کنم! ❄️'],
    yes: ['آهان! حالا شد. قفل رو باز کن ببینم 😏', 'زود باش دیگه!'],
    any: ['من الان دقیقاً کنار ماشینتم 👀', 'تهدیدم جدیه ها... (یه کم)', 'برف‌بازی رو بهت نشون میدم!'],
  },
  fare: {
    open: ['سلام آقای راننده! یه مسافرم، کرایه‌ت ۱۰ برابر! فقط در رو باز کن 💰', 'یه پیتزای داغ دارم برات! در رو باز کن تحویل بدم 🍕', 'من دربستی می‌خوام، هر چی بگی میدم!'],
    no: ['۲۰ برابر؟ ۵۰ برابر؟ 💸', 'آخه کی پول به این خوبی رو رد می‌کنه؟!', 'پیتزات داره سرد میشه ها 🍕🥶'],
    yes: ['ایول! قفل رو باز کن سوار شم 😁', 'عالیه! زود قفل رو باز کن'],
    any: ['پیشنهاد آخرم: ۱۰۰ برابر کرایه!', 'کنار ماشینتم، منتظرم...', 'تاکسی! تاکسی! 🚕'],
  },
  friend: {
    open: ['سلام پسرم! امشب عجیبه... درها رو قفل نگه دار و به هیچکی اعتماد نکن 🔒', 'شیشه‌ها دودیه، بیرون تو رو نمی‌بینن. اگه کسی کنار ماشینه، شیشه رو شفاف نکن!'],
    no: ['آفرین! همینه 👍', 'خوبه، محکم باش.'],
    yes: ['نه نه نه! برای هیچکی باز نکن، حتی برای من!', 'گفتم که! هیچکی!'],
    any: ['تا صبح چیزی نمونده، طاقت بیار 🌅', 'بخاری رو روشن کن، ولی در رو باز نکن 😄', 'هر وقت خسته شدی می‌تونی از این حالت بیای بیرون، از توی گوشیت.'],
  },
};

/** "Frozen Night": a freezing night full of (cute) zombies. Keep the doors locked, trust nobody. */
export class ZombieNight {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.pool = [];
    this.chats = [];
    this.thread = null;
    this.draft = '';
    this.pulseT = 90;
    this.wire();
  }
  get infected() {
    return !!this.g.stats.infected;
  }
  wire() {
    $('zLock').onclick = () => this.toggleLock();
    $('zTint').onclick = () => this.cycleTint();
    $('zLeave').onclick = () => this.exit();
    $('zSkip').onclick = () => this.skipWait();
  }
  /* ---------------- building ---------------- */
  build() {
    if (this.built) return;
    this.built = true;
    const g = this.g;
    const coats = [0x7e57c2, 0x26a69a, 0xffa726, 0x42a5f5, 0xef5350, 0x8d6e63];
    const hats = [0xff4081, 0xffd54f, 0x4fc3f7, 0x81c784, 0xff8a65, 0xba68c8];
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
    this.variants = coats.map((c, i) => ({ body: bodyGeometry(c, hats[i], hats[(i + 2) % hats.length]), arms: armsGeometry(c) }));
    for (let i = 0; i < N; i++) this.pool.push(this.makeZombie(this.variants[i % this.variants.length]));
  }
  makeZombie(v) {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(v.body, this.mat);
    body.castShadow = true;
    grp.add(body);
    const arms = new THREE.Mesh(v.arms, this.mat);
    arms.position.y = 1.18;
    grp.add(arms);
    grp.visible = false;
    this.g.scene.add(grp);
    return { grp, arms, x: 0, z: 0, h: 0, state: 'wander', t: Math.random() * 10, ph: Math.random() * 6, tx: 0, tz: 0, fall: 0, contact: null, label: null };
  }
  nameLabel(text) {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 64;
    const c = cv.getContext('2d');
    c.fillStyle = 'rgba(30,30,60,0.8)';
    c.beginPath();
    c.roundRect(4, 6, 248, 52, 20);
    c.fill();
    c.fillStyle = '#fff';
    c.font = 'bold 30px Vazirmatn, Tahoma, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 128, 34);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthWrite: false }));
    sp.scale.set(2.4, 0.6, 1);
    sp.position.y = 2.5;
    return sp;
  }
  /* ---------------- entering and leaving ---------------- */
  canEnter() {
    const g = this.g;
    if (this.active || g.state !== 'play') return false;
    if (g.rides.ride) return g.ui.toast('اول مسافرت رو برسون 🧳', 'warn'), false;
    if (g.race.state !== 'idle' || g.crazy.state !== 'idle' || g.parking.state !== 'idle' || g.drag.state !== 'idle' || g.soccer.state !== 'idle' || g.bounty.state !== 'idle' || g.events.job) return g.ui.toast('اول کار فعلیت رو تموم کن', 'warn'), false;
    if (g.police.state !== 'none') return g.ui.toast('با پلیس پشت سرت؟! 🚨', 'warn'), false;
    if (g.onfoot.active || g.onfoot.busy || g.player.burning) return g.ui.toast('اول سوار ماشین شو 🚗', 'warn'), false;
    return true;
  }
  enter() {
    const g = this.g, p = g.player;
    if (!this.canEnter()) return;
    this.build();
    if (g.rides.state === 'offer') g.rides.decline();
    if (g.cruise) g.setCruise(false);
    this.saved = { hour: g.hour, day: g.day, kind: g.weather.kind, next: g.weather.next, trafficBase: g.trafficBase, tint: p.tint || 0, cooldown: g.rides.cooldown };
    this.active = true;
    this.crossed = false;
    this.locked = true;
    this.tintMode = 'oneway';
    this.knockT = 0;
    this.msgT = 4;
    this.caughtT = 0;
    this.doorT = 0;
    g.hour = 21;
    g.weather.forceSnow = true;
    g.weather.set('rain', false);
    g.weather.next = 'rain';
    g.trafficBase = 0;
    g.traffic.setCount(0);
    for (const c of g.traffic.cars) c.deactivate();
    g.rides.cooldown = 1e9;
    if (g.guide && g.guide.custom) g.clearGuide();
    this.applyTint();
    // the zombies wander in the snow around the taxi
    this.pool.forEach((z, i) => this.place(z, 18 + (i % 4) * 12));
    this.chats = CONTACTS.map(([icon, name, kind], i) => ({ id: i, icon, name, kind, msgs: [], unread: 0, near: false }));
    this.thread = null;
    document.body.classList.add('znight');
    this.hud();
    g.stats.zNights = (g.stats.zNights || 0) + 1;
    g.ui.toast('❄️🧟 شب یخ‌زده شروع شد! درها قفله، شیشه‌ها دودیه. تا طلوع آفتاب زنده بمون 🌅', 'info');
    setTimeout(() => this.incoming(1, 'open'), 2500);
    g.audio.tone(392, 0.5, 0.08, 'sine');
    g.audio.tone(523, 0.6, 0.08, 'sine', 0.3);
  }
  exit(survived = false) {
    const g = this.g, p = g.player, S = this.saved;
    if (!this.active) return;
    this.active = false;
    g.hour = S.hour;
    g.day = S.day;
    g.weather.forceSnow = false;
    g.weather.set(S.kind || 'clear', false);
    g.weather.next = S.next;
    g.trafficBase = S.trafficBase;
    g.traffic.setCount(S.trafficBase);
    g.rides.cooldown = Math.min(S.cooldown, 10);
    p.tint = S.tint;
    p.applyMods();
    for (const z of this.pool) {
      z.grp.visible = false;
      this.dropLabel(z);
    }
    for (const k of Object.keys(p.car.doors)) p.car.doors[k].target = 0;
    document.body.classList.remove('znight', 'zblack', 'zclear');
    if (g.ui.panelOpen) g.ui.closePanel();
    g.updateEnv(0.016, true);
    g.camInit = true;
    if (survived) {
      g.coins += 40;
      g.addXp(150);
      g.stats.zSurvived = (g.stats.zSurvived || 0) + 1;
      g.ui.achievement('🌅', 'صبح شد! شب یخ‌زده رو زنده موندی', 40, '🧟 قهرمان شب');
    } else g.ui.toast('🚪 از حالت شب یخ‌زده اومدی بیرون', 'info');
    g.save();
  }
  /* ---------------- doors and windows ---------------- */
  toggleLock() {
    if (!this.active) return;
    const g = this.g;
    this.locked = !this.locked;
    g.audio.tone(this.locked ? 880 : 520, 0.08, 0.12, 'square');
    g.audio.tone(this.locked ? 1100 : 400, 0.08, 0.12, 'square', 0.1);
    g.ui.toast(this.locked ? '🔒 همه درها قفل شد. هیچکی نمی‌تونه بیاد تو' : '🔓 قفل درها باز شد! هر کی کنار ماشین باشه می‌تونه در رو باز کنه ⚠️', this.locked ? 'good' : 'warn');
    this.hud();
  }
  cycleTint() {
    if (!this.active) return;
    const order = ['oneway', 'blackout', 'clear'];
    this.tintMode = order[(order.indexOf(this.tintMode) + 1) % order.length];
    this.applyTint();
    const g = this.g;
    g.audio.tone(700, 0.06, 0.08, 'sine');
    g.ui.toast(this.tintMode === 'oneway' ? '🕶️ شیشه‌ها دودی شد: تو بیرون رو می‌بینی، اونا تو رو نه' : this.tintMode === 'blackout' ? '⬛ شیشه‌ها کاملاً سیاه شد: نه اونا تو رو می‌بینن نه تو اونا رو' : '🔆 شیشه‌ها شفاف شد: همه تو رو می‌بینن! 👀', 'info');
    this.hud();
  }
  applyTint() {
    const p = this.g.player;
    p.tint = this.tintMode === 'clear' ? 0 : 3;
    p.applyMods();
    document.body.classList.toggle('zblack', this.tintMode === 'blackout');
    document.body.classList.toggle('zclear', this.tintMode === 'clear');
  }
  hud() {
    const L = $('zLock'), T = $('zTint');
    L.textContent = this.locked ? '🔒 قفل' : '🔓 باز';
    L.classList.toggle('open', !this.locked);
    T.textContent = this.tintMode === 'oneway' ? '🕶️ دودی' : this.tintMode === 'blackout' ? '⬛ سیاه' : '🔆 شفاف';
  }
  /** the 🚪 button / V key while in this mode */
  tryExit() {
    const g = this.g;
    if (this.locked) return g.ui.toast('🔒 درها قفله و بیرون یخ‌بندونه! 🥶 اینجا نمیشه پیاده شد', 'warn');
    g.ui.panel(`<h2>🥶 بیرون یخ‌بندونه!</h2><p>بیرون اونقدر سرده که آدم یخ می‌زنه، و پر از زامبیه 🧟. واقعاً می‌خوای پیاده شی؟</p>
      <div class="btnrow"><button data-a="stay" class="big">🚗 نه، توی ماشین می‌مونم</button><button data-a="go" class="ghost">🚶 آره، پیاده میشم</button></div>`, (el) => {
      el.querySelector('[data-a=stay]').onclick = () => g.ui.closePanel();
      el.querySelector('[data-a=go]').onclick = () => {
        g.ui.closePanel();
        this.caught('🥶 بیرون یخ زدی و زامبی‌ها دورت جمع شدن!');
      };
    });
  }
  /* ---------------- the zombies ---------------- */
  place(z, d) {
    const p = this.g.player.pos, a = Math.random() * Math.PI * 2;
    z.x = p.x + Math.cos(a) * d;
    z.z = p.z + Math.sin(a) * d;
    z.h = Math.random() * 6.28;
    z.state = 'wander';
    z.fall = 0;
    z.t = Math.random() * 5;
    z.grp.visible = true;
    z.grp.rotation.set(0, z.h, 0);
  }
  dropLabel(z) {
    if (z.label) {
      z.grp.remove(z.label);
      z.label.material.map.dispose();
      z.label.material.dispose();
      z.label = null;
    }
    if (z.contact) z.contact.near = false;
    z.contact = null;
  }
  /** driver-side door, in the world */
  doorPos() {
    const p = this.g.player, h = p.heading;
    return { x: p.pos.x + Math.cos(h) * 1.6, z: p.pos.z - Math.sin(h) * 1.6 };
  }
  updateZombies(dt) {
    const g = this.g, p = g.player, w = g.world, t = g.time;
    const sp = Math.abs(p.speed);
    const door = this.doorPos();
    let knocking = 0, atDoor = null;
    for (const z of this.pool) {
      const dx = z.x - p.pos.x, dz = z.z - p.pos.z, d = Math.hypot(dx, dz);
      // a "contact" you drove away from loses track of you
      if (z.contact && d > 150) {
        const c = z.contact;
        this.dropLabel(z);
        this.receive(c, pick(['کجا رفتی؟! 😤', 'باشه برو... ولی دوباره پیدات می‌کنم! ☃️', 'ای بابا، رفتی که!']));
      }
      // far behind: pop up again somewhere ahead
      if (d > 110 && !z.contact) {
        const a = p.heading + (Math.random() - 0.5) * 2;
        z.x = p.pos.x + Math.sin(a) * (45 + Math.random() * 40);
        z.z = p.pos.z + Math.cos(a) * (45 + Math.random() * 40);
        z.state = 'wander';
      }
      if (z.fall > 0) {
        // bonked by the taxi: lie back in the snow, stars spinning, then up again
        z.fall -= dt;
        z.x += z.fvx * dt;
        z.z += z.fvz * dt;
        z.fvx *= 0.92;
        z.fvz *= 0.92;
        z.grp.position.set(z.x, w.heightAt(z.x, z.z) + 0.25, z.z);
        z.grp.rotation.set(-Math.PI / 2 * Math.min(1, z.fall * 2), z.h, 0);
        continue;
      }
      // who comes to the car: anyone who can see you through clear glass, or a "contact" who said they're near
      const sees = this.tintMode === 'clear' && d < 45;
      const want = z.contact || sees;
      if (want) z.state = d < 2.6 ? 'knock' : 'approach';
      else if (z.state !== 'wander') z.state = 'wander';
      let tx, tz, speed;
      if (z.state === 'wander') {
        z.t -= dt;
        if (z.t <= 0) {
          z.t = 3 + Math.random() * 5;
          z.tx = z.x + (Math.random() - 0.5) * 16;
          z.tz = z.z + (Math.random() - 0.5) * 16;
        }
        tx = z.tx;
        tz = z.tz;
        speed = 0.7;
      } else {
        tx = door.x;
        tz = door.z;
        speed = 1.6;
      }
      const ex = tx - z.x, ez = tz - z.z, el = Math.hypot(ex, ez);
      if (z.state === 'knock') {
        knocking++;
        z.h = Math.atan2(p.pos.x - z.x, p.pos.z - z.z);
        if (Math.hypot(z.x - door.x, z.z - door.z) < 2.2) atDoor = z;
      } else if (el > 0.4) {
        z.h = Math.atan2(ex, ez);
        z.x += (ex / el) * speed * dt;
        z.z += (ez / el) * speed * dt;
      }
      // the taxi bumps them over (they're fine, just dizzy)
      if (sp > 3 && d < 2.1) {
        z.fall = 2.2;
        z.fvx = (dx / (d || 1)) * Math.min(9, sp * 0.6);
        z.fvz = (dz / (d || 1)) * Math.min(9, sp * 0.6);
        g.audio.tone(660, 0.12, 0.08, 'sine');
        g.audio.tone(330, 0.2, 0.08, 'sine', 0.1);
        g.stats.zBonks = (g.stats.zBonks || 0) + 1;
        continue;
      }
      if (d < 1.9 && sp <= 3) {
        // nobody gets through the car body
        z.x = p.pos.x + (dx / (d || 1)) * 1.9;
        z.z = p.pos.z + (dz / (d || 1)) * 1.9;
      }
      const bob = Math.abs(Math.sin(t * 4 + z.ph)) * 0.06;
      z.grp.position.set(z.x, w.heightAt(z.x, z.z) + bob, z.z);
      z.grp.rotation.set(0, z.h, Math.sin(t * 4 + z.ph) * 0.08);
      z.arms.rotation.x = z.state === 'knock' ? -0.3 + Math.sin(t * 9 + z.ph) * 0.35 : Math.sin(t * 2 + z.ph) * 0.12;
    }
    // knock knock (soft, friendly)
    this.knockT -= dt;
    if (knocking && this.knockT <= 0) {
      this.knockT = 1.1;
      g.audio.tone(240, 0.05, 0.12, 'triangle');
      g.audio.tone(240, 0.05, 0.12, 'triangle', 0.14);
    }
    this.knocking = knocking;
    // an unlocked door is all they need
    if (atDoor && !this.locked) {
      this.doorT += dt;
      if (this.doorT > 1.2) {
        p.car.doors.fl.target = 1;
        g.audio.door();
        this.caught(atDoor.contact ? `🚪 ${atDoor.contact.name} در قفل‌نشده رو باز کرد...` : '🚪 یه زامبی در قفل‌نشده رو باز کرد!');
      }
    } else this.doorT = 0;
    // contacts who came to the window and can't see you give up after a while
    for (const z of this.pool) {
      if (!z.contact || z.state !== 'knock') continue;
      z.wait = (z.wait || 0) + dt;
      if (this.tintMode !== 'clear' && z.wait > 14) {
        const c = z.contact;
        this.receive(c, pick(['نیستی؟ حتماً یه ماشین دیگه‌ست... 🤔 من رفتم', 'شیشه‌ها دودیه، هیچی نمی‌بینم! باشه میرم 😒', 'کسی اینجا نیست... برم یه جای دیگه']));
        this.dropLabel(z);
        z.state = 'wander';
        z.wait = 0;
      } else if (this.tintMode === 'clear' && !z.seen) {
        z.seen = true;
        this.receive(z.contact, 'دیدمت!! 😄 می‌بینمت از پشت شیشه! در رو باز کن دیگه');
      }
    }
  }
  /* ---------------- the messenger ---------------- */
  incoming(id = null, phase = 'any') {
    const c = id !== null ? this.chats[id] : pick(this.chats);
    const L = LINES[c.kind];
    this.receive(c, pick(c.msgs.length ? L.any : L[phase] || L.open));
    // some say they're right next to you — and they are
    if (c.kind !== 'friend' && !c.near && Math.random() < 0.35) {
      const z = this.pool.find((q) => !q.contact && q.fall <= 0);
      if (z) {
        c.near = true;
        z.contact = c;
        z.seen = false;
        z.wait = 0;
        z.label = this.nameLabel(`${c.icon} ${c.name}`);
        z.grp.add(z.label);
        const p = this.g.player.pos, a = Math.random() * Math.PI * 2;
        z.x = p.x + Math.cos(a) * 16;
        z.z = p.z + Math.sin(a) * 16;
        setTimeout(() => this.active && this.receive(c, 'من الان دقیقاً کنار ماشینتم 👀 ببین'), 2500);
      }
    }
  }
  receive(c, text) {
    const g = this.g;
    if (!this.active || !c) return;
    c.msgs.push({ me: false, text });
    if (this.thread !== c.id || !g.ui.panelOpen) c.unread++;
    g.audio.tone(1320, 0.07, 0.07, 'sine');
    g.audio.tone(1760, 0.1, 0.07, 'sine', 0.09);
    if (this.thread === c.id && g.ui.panelOpen && g.phone.app === 'zchat') this.refresh();
    else g.ui.toast(`📱 ${c.icon} ${c.name}: ${text.length > 44 ? text.slice(0, 44) + '…' : text}`, 'info');
    g.career.badge();
  }
  reply(c, text) {
    const g = this.g;
    if (!text.trim()) return;
    c.msgs.push({ me: true, text: text.trim().slice(0, 200) });
    g.stats.zReplies = (g.stats.zReplies || 0) + 1;
    const s = text.replace(/\s+/g, ' ');
    const L = LINES[c.kind];
    const yes = /باشه|باز می|بیا|اوکی|ok|آره|چشم/i.test(s);
    const no = /نه|نمی|هرگز|عمرا|برو|ولم/i.test(s);
    const line = pick(yes ? L.yes : no ? L.no : L.any);
    setTimeout(() => this.receive(c, line), 1500 + Math.random() * 2000);
  }
  unread() {
    return this.active ? this.chats.reduce((a, c) => a + c.unread, 0) : 0;
  }
  refresh() {
    const g = this.g;
    const inp = document.querySelector('[data-zin]');
    // don't wipe what you're typing
    if (inp && document.activeElement === inp) return;
    g.phone.render();
  }
  chatHtml() {
    if (!this.active) return '<p class="note">پیام‌رسان شب یخ‌زده فقط وقتی کار می‌کنه که توی اون حالت باشی 🧟❄️</p>';
    const c = this.thread !== null ? this.chats[this.thread] : null;
    if (!c) {
      const list = this.chats.filter((x) => x.msgs.length);
      if (!list.length) return '<p class="note">هنوز کسی پیام نداده... 📭</p>';
      return `<p class="note">⚠️ به هیچکی اعتماد نکن و برای هیچکی در رو باز نکن. هر چی بخوای می‌تونی جواب بدی.</p><div class="zlist">${list.map((x) => `<button data-zc="${x.id}"><span>${x.icon}</span><b>${x.name}</b><small>${x.msgs[x.msgs.length - 1].text.slice(0, 34)}</small>${x.unread ? `<em>${fa(x.unread)}</em>` : ''}</button>`).join('')}</div>`;
    }
    c.unread = 0;
    this.g.career.badge();
    const esc = (t) => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
    return `<button class="pback" data-zback>‹ همه پیام‌ها</button><h4>${c.icon} ${c.name}${c.near ? ' • 👀 کنار ماشین' : ''}</h4>
      <div class="zthread">${c.msgs.map((m) => `<p class="${m.me ? 'me' : ''}">${esc(m.text)}</p>`).join('')}</div>
      <div class="zsend"><input data-zin maxlength="200" placeholder="هر چی می‌خوای بنویس..." value="${esc(this.draft)}"><button data-zgo>ارسال</button></div>`;
  }
  bindChat(el) {
    el.querySelectorAll('[data-zc]').forEach((b) => (b.onclick = () => {
      this.thread = +b.dataset.zc;
      this.g.phone.render();
    }));
    const back = el.querySelector('[data-zback]');
    if (back) back.onclick = () => {
      this.thread = null;
      this.g.phone.render();
    };
    const inp = el.querySelector('[data-zin]');
    const th = el.querySelector('.zthread');
    if (th) th.scrollTop = th.scrollHeight;
    if (inp) {
      inp.oninput = () => (this.draft = inp.value);
      const send = () => {
        const c = this.chats[this.thread];
        if (!c || !inp.value.trim()) return;
        this.reply(c, inp.value);
        this.draft = '';
        this.g.phone.render();
      };
      el.querySelector('[data-zgo]').onclick = send;
      inp.onkeydown = (e) => {
        if (e.key === 'Enter') send();
        e.stopPropagation();
      };
    }
  }
  modeHtml() {
    const s = this.g.stats;
    return `<div class="zmode"><div class="zhero">🌙❄️⛄</div>
      <p>یه شب خیلی سرد که بیرون هر کی بره یخ می‌زنه و همه جا پر از زامبی‌های بامزه‌ست! زامبی‌ها ترسناک نیستن، ولی اگه از ماشین پیاده بشی یا در قفل نباشه، می‌گیرنت.</p>
      <ul><li>🔒 درها رو قفل نگه دار (خودکار قفله)</li><li>🕶️ شیشه‌ها خودکار دودی‌ان: تو بیرون رو می‌بینی، اونا تو رو نه. می‌تونی سیاه کامل یا شفافشون کنی</li><li>💬 خیلیا بهت پیام میدن؛ هر چی خواستی جواب بده، ولی برای هیچکی در رو باز نکن</li><li>🌅 تا طلوع آفتاب زنده بمون تا جایزه بگیری • هر وقت خواستی می‌تونی بیای بیرون</li><li>🚑 اگه بگیرنت ۱۰ دقیقه طول می‌کشه آمبولانس بیاد، و اثر زامبی برای همیشه توی وجودت می‌مونه!</li></ul>
      <div class="statrow"><span>🌙 شب‌ها: ${fa(s.zNights || 0)}</span><span>🌅 زنده موندی: ${fa(s.zSurvived || 0)}</span><span>${this.infected ? '🧟 آلوده‌ای!' : '💚 سالمی'}</span></div>
      ${this.active ? '<button data-zm="exit" class="big">🚪 خروج از شب یخ‌زده</button>' : '<button data-zm="enter" class="big">🌙 ورود به شب یخ‌زده</button>'}</div>`;
  }
  bindMode(el) {
    const b = el.querySelector('[data-zm]');
    if (!b) return;
    b.onclick = () => {
      this.g.ui.closePanel();
      if (b.dataset.zm === 'enter') this.enter();
      else this.exit();
    };
  }
  /* ---------------- getting caught ---------------- */
  caught(reason) {
    const g = this.g;
    if (!this.active || g.state !== 'play') return;
    if (g.ui.panelOpen) g.ui.closePanel();
    g.stats.zCaught = (g.stats.zCaught || 0) + 1;
    g.state = 'zdead';
    g.audio.setEngine(0, 0, false);
    this.wait = HOSPITAL_MIN * 60;
    $('zdeadWhy').textContent = reason;
    $('zdead').classList.remove('hidden');
    document.body.classList.add('zdeadmode');
    this.deadText = '';
  }
  /** the ambulance clock runs ten times faster than real time (ten minutes = one minute) */
  deadUpdate(dt) {
    this.wait -= dt * 10;
    const m = Math.max(0, Math.floor(this.wait / 60)), s = Math.max(0, Math.floor(this.wait % 60));
    const txt = `${fa(String(m).padStart(2, '0'))}:${fa(String(s).padStart(2, '0'))}`;
    if (txt !== this.deadText) $('zdeadClock').textContent = this.deadText = txt;
    const g = this.g;
    $('zSkip').disabled = g.coins < 20;
    if (this.wait <= 0) this.hospital();
  }
  skipWait() {
    const g = this.g;
    if (g.state !== 'zdead' || g.coins < 20) return;
    g.coins -= 20;
    this.hospital();
  }
  hospital() {
    const g = this.g, p = g.player;
    $('zdead').classList.add('hidden');
    document.body.classList.remove('zdeadmode');
    g.state = 'play';
    this.exit(false);
    const H = g.world.places.find((pl) => pl.name.includes('بیمارستان')) || g.world.places[0];
    p.placeAt(H.x, H.z, Math.atan2(-(H.nx || 0), -(H.nz || 1)));
    p.repair();
    g.stats.infected = true;
    g.career.message('👩‍⚕️ بیمارستان مرکزی', 'خوب شدی و مرخصی! ولی... یه چیز سبزرنگ توی خونت مونده که هیچ دارویی پاکش نمی‌کنه 🧟 مواظب مسافرهات باش.');
    g.ui.toast('🏥 آمبولانس اومد و خوب شدی... ولی اثر زامبی توی وجودت موند 🧟', 'warn');
    g.save();
  }
  /* ---------------- the lingering infection ---------------- */
  /** called from the ride loop: now and then the zombie inside wakes up */
  rideTick(dt, r) {
    const g = this.g;
    if (!this.infected || this.active || r.o.kind) return;
    if (!r.zRolled && r.t > 12) {
      r.zRolled = true;
      if (Math.random() < 0.14) r.zAt = r.t + 5;
    }
    if (!r.zAt) return;
    if (!r.zWarned && r.t > r.zAt - 4) {
      r.zWarned = true;
      this.pulse();
      g.ui.toast('🧟 یه حس عجیب داری... دستات دارن سبز میشن!', 'warn');
    }
    if (r.t > r.zAt) this.attackPassenger();
  }
  attackPassenger() {
    const g = this.g, R = g.rides, r = R.ride, p = g.player;
    if (!r) return;
    this.build();
    // the passenger turns into a little zombie and waddles off into the night
    const side = r.door && r.door[1] === 'l' ? 1 : -1;
    const h = p.heading, x = p.pos.x + Math.cos(h) * side * 2.2, z = p.pos.z - Math.sin(h) * side * 2.2;
    const zz = this.makeZombie(pick(this.variants));
    zz.x = x;
    zz.z = z;
    zz.grp.visible = true;
    this.walkers = this.walkers || [];
    this.walkers.push({ z: zz, t: 0, h: h + side * Math.PI / 2 });
    this.pulse();
    g.stats.zAttacks = (g.stats.zAttacks || 0) + 1;
    g.audio.tone(200, 0.4, 0.1, 'sawtooth');
    R.cancel(`🧟 اثر زامبی بیدار شد و به ${r.o.name} حمله کردی... حالا اونم یه زامبی بامزه‌ست 😵`, false);
  }
  pulse() {
    const el = $('zpulse');
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
    this.g.audio.tone(110, 0.6, 0.08, 'sine');
  }
  /* ---------------- per frame ---------------- */
  update(dt) {
    const g = this.g;
    // infected passengers waddling away after an attack
    if (this.walkers && this.walkers.length) {
      for (let i = this.walkers.length - 1; i >= 0; i--) {
        const W = this.walkers[i];
        W.t += dt;
        W.z.x += Math.sin(W.h) * 1.2 * dt;
        W.z.z += Math.cos(W.h) * 1.2 * dt;
        W.z.grp.position.set(W.z.x, g.world.heightAt(W.z.x, W.z.z) + Math.abs(Math.sin(W.t * 4)) * 0.06, W.z.z);
        W.z.grp.rotation.set(0, W.h, Math.sin(W.t * 4) * 0.08);
        if (W.t > 12) {
          W.z.grp.removeFromParent();
          this.walkers.splice(i, 1);
        }
      }
    }
    $('zbadge').classList.toggle('hidden', !this.infected);
    if (!this.active) {
      if (this.infected && g.state === 'play') {
        this.pulseT -= dt;
        if (this.pulseT <= 0) {
          this.pulseT = 70 + Math.random() * 80;
          this.pulse();
        }
      }
      return;
    }
    if (g.state !== 'play') return;
    g.rides.cooldown = 1e9;
    if (g.police.state !== 'none') g.police.state = 'none';
    this.updateZombies(dt);
    // messages keep coming
    this.msgT -= dt;
    if (this.msgT <= 0) {
      this.msgT = 9 + Math.random() * 10;
      this.incoming();
    }
    // dawn
    if (this.crossed && g.hour >= DAWN) {
      this.exit(true);
      return;
    }
    const left = this.crossed ? DAWN - g.hour : 24 - g.hour + DAWN;
    const hh = Math.floor(g.hour), mm = Math.floor((g.hour % 1) * 60);
    const info = `❄️ ${fa(String(hh).padStart(2, '0'))}:${fa(String(mm).padStart(2, '0'))} • تا طلوع ${fa(Math.ceil(left))} ساعت${this.knocking ? ` • ✊ ${fa(this.knocking)} نفر در می‌زنن` : ''}${!this.locked ? ' • 🔓 قفل بازه!' : ''}`;
    if (info !== this.infoText) $('zinfo').textContent = this.infoText = info;
  }
  /** midnight while in the mode: no new day for the normal game */
  midnight() {
    this.crossed = true;
  }
}
