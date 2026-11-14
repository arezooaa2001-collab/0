import * as THREE from 'three';
import { buildCar, buildPerson, poseWave, poseIdle } from './models.js';
import { TrafficCar } from './traffic.js';
import { regionAt } from './world.js';
import { fa, faMoney, pick, circleCol } from './util.js';

const $ = (id) => document.getElementById(id);
const SHOPS = ['کبابی حاج‌علی 🍢', 'پیتزا ناپل 🍕', 'آش‌فروشی مادر 🥣', 'فلافل جنوب 🧆', 'جگرکی شبانه 🍖', 'برگر دودی 🍔', 'شیرینی‌فروشی گل‌ها 🍰', 'سوشی کوچه 🍣'];
const FOODS = ['۲ پرس چلوکباب', 'یه پیتزای خانواده', '۳ کاسه آش رشته', 'ساندویچ فلافل', '۱۰ سیخ جگر', 'دوتا همبرگر دوبل', 'یه جعبه شیرینی', 'سینی سوشی'];
const PROBLEMS = [
  ['battery', '🔋', 'باتری ماشینم خوابیده! میشه باتری به باتری کنیم؟', 'باتری به باتری', 7],
  ['tyre', '🛞', 'پنچر کردم و جک ندارم... کمکم می‌کنی زاپاس رو ببندم؟', 'لاستیک رو عوض کن', 9],
  ['fuel', '⛽', 'بنزینم تموم شده! چند لیتر بنزین بهم میدی؟ پولش رو میدم', 'بهش ۵ لیتر بنزین بده', 0],
];

/** Things that just happen on the road: ambulances to make way for, stranded drivers, and food delivery side jobs. */
export class RoadEvents {
  constructor(game) {
    this.g = game;
    this.t = 45 + Math.random() * 30;
    this.amb = null;
    this.strand = null;
    this.job = null;
    this.orders = null;
    this.ordersT = 0;
    this.buildAmbulance();
    this.buildStranded();
  }
  /* ---------------- ambulance ---------------- */
  buildAmbulance() {
    const g = this.g;
    const car = buildCar({ type: 'van', color: 0xf8f8f8 });
    const root = car.root;
    const red = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.5 });
    const P = car.P;
    for (const side of [1, -1]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, P.len - 0.6), red);
      s.position.set(side * (P.W + 0.02), 0.85, 0);
      root.add(s);
      // a red crescent-and-cross badge stand-in: red square on the side
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.42, 0.42), red);
      b.position.set(side * (P.W + 0.025), 1.45, -0.9);
      root.add(b);
    }
    this.ambLights = [new THREE.MeshBasicMaterial({ color: 0xff2020 }), new THREE.MeshBasicMaterial({ color: 0x2060ff })];
    const bar = new THREE.Group();
    this.ambLights.forEach((m, i) => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.26), m);
      l.position.set(i ? -0.32 : 0.32, 0, 0);
      bar.add(l);
    });
    bar.position.set(0, P.roof + 0.1, P.roofF - 0.3);
    root.add(bar);
    this.ambCar = new TrafficCar(g.traffic, root);
    this.ambCar.isEmergency = true;
  }
  spawnAmbulance() {
    const g = this.g, p = g.player, w = g.world;
    const ne = w.nearestEdge(p.pos.x, p.pos.z);
    if (!ne || ne.dist > 7 || Math.abs(p.speed) < 4) return false;
    const e = ne.edge, fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const dot = fx * ne.dx + fz * ne.dz;
    if (Math.abs(dot) < 0.8) return false;
    // come up from behind in the player's direction
    const from = dot > 0 ? e.a : e.b;
    const along = dot > 0 ? ne.t * e.len : (1 - ne.t) * e.len;
    const back = Math.min(60, along - 5);
    if (back < 35) return false;
    const c = this.ambCar;
    c.spawnOn(e.id, from, (along - back) / e.len);
    c.persona = e.road.type === 'city' ? 1.55 : 1.3;
    c.speed = 14;
    this.amb = { life: 80, behind: false, blockT: 0, fined: false, warned: false, passed: false, wail: 0 };
    return true;
  }
  updateAmbulance(dt) {
    const g = this.g, A = this.amb, c = this.ambCar;
    if (!A) return;
    A.life -= dt;
    const p = g.player;
    const d = Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z);
    if (A.life <= 0 || d > 450 || !c.active) {
      c.deactivate();
      this.amb = null;
      return;
    }
    c.update(dt, g.time);
    // flashing bar and the wail of the siren
    const ph = Math.floor(g.time * 6) % 2;
    this.ambLights[0].color.setHex(ph ? 0xff2020 : 0x330000);
    this.ambLights[1].color.setHex(ph ? 0x001033 : 0x2060ff);
    A.wail -= dt;
    if (A.wail <= 0 && d < 220 && g.state === 'play') {
      A.wail = 0.55;
      const v = 0.1 * (1 - d / 220);
      g.audio.tone(A.hi ? 960 : 720, 0.5, v, 'sawtooth');
      A.hi = !A.hi;
    }
    // where is the player relative to the ambulance?
    const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
    const rx = p.pos.x - c.pos.x, rz = p.pos.z - c.pos.z;
    const f = rx * fx + rz * fz, l = Math.abs(rx * fz - rz * fx);
    if (g.onfoot.active) return;
    if (f > 0 && f < 60 && l < 3) {
      A.behind = true;
      if (!A.warned) {
        A.warned = true;
        g.ui.toast('🚑 آمبولانس پشت سرته! بکش کنار تا رد شه', 'warn');
      }
    }
    // blocking: right in front of it while it has to crawl
    if (f > 0 && f < 25 && l < 2.3 && c.speed < 6) A.blockT += dt;
    else A.blockT = Math.max(0, A.blockT - dt * 0.5);
    if (A.blockT > 5 && !A.fined) {
      A.fined = true;
      g.fine(200000, '🚑 راه آمبولانس رو بستی!');
    }
    if (A.behind && !A.passed && f < -6) {
      A.passed = true;
      if (!A.fined) {
        g.stats.yielded = (g.stats.yielded || 0) + 1;
        g.coins += 5;
        g.addXp(40);
        g.audio.cash();
        g.ui.toast('👏 دمت گرم! به آمبولانس راه دادی • +🪙۵', 'good');
      }
    }
  }
  /* ---------------- stranded drivers ---------------- */
  buildStranded() {
    const g = this.g;
    const car = buildCar({ type: 'sedan', color: 0x8d6e63 });
    this.sCar = car;
    // bonnet up
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 1.1), new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.5 }));
    hood.position.set(0, 1.25, 1.55);
    hood.rotation.x = -0.9;
    car.root.add(hood);
    this.sHood = hood.material;
    this.hazard = new THREE.MeshBasicMaterial({ color: 0x331a00 });
    for (const [x, z] of [[0.7, 2.27], [-0.7, 2.27], [0.7, -2.27], [-0.7, -2.27]]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.04), this.hazard);
      h.position.set(x, 0.66, z);
      car.root.add(h);
    }
    // warning triangle on the road behind it
    const tri = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 3), new THREE.MeshStandardMaterial({ color: 0xff3d00, emissive: 0x661100, roughness: 0.5 }));
    tri.position.set(0, 0.3, -7);
    car.root.add(tri);
    car.root.visible = false;
    g.scene.add(car.root);
    this.sPerson = buildPerson({ female: false });
    this.sPerson.root.visible = false;
    g.scene.add(this.sPerson.root);
  }
  spawnStranded() {
    const g = this.g, p = g.player, w = g.world;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const ne = w.nearestEdge(p.pos.x + fx * 220, p.pos.z + fz * 220);
    if (!ne || ne.dist > 60) return false;
    const dd = Math.hypot(ne.x - p.pos.x, ne.z - p.pos.z);
    if (dd < 140 || dd > 320) return false;
    // keep clear of pumps, garages and the mini-game pads
    const pads = [...w.stations, ...w.garages, w.police, ...g.race.spots, g.crazy.spot, g.parking.spot, g.drag.spot];
    if (pads.some((s) => Math.hypot(s.padX - ne.x, s.padZ - ne.z) < 40)) return false;
    const rs = w.roadside(ne, 1, 6.2);
    const h = Math.atan2(ne.dx, ne.dz);
    const prob = pick(PROBLEMS);
    const car = this.sCar.root;
    car.position.set(rs.x, w.heightAt(rs.x, rs.z), rs.z);
    car.rotation.set(0, h, 0);
    car.visible = true;
    this.sCar.paint.color && this.sCar.paint.color.setHex(pick([0x8d6e63, 0x546e7a, 0x9e9d24, 0xbdbdbd, 0x6d4c41]));
    const px = rs.x + rs.nx * 1.8 + ne.dx * 2.6, pz = rs.z + rs.nz * 1.8 + ne.dz * 2.6;
    const pr = this.sPerson.root;
    pr.position.set(px, w.heightAt(px, pz) + 0.03, pz);
    pr.visible = true;
    this.strand = { x: rs.x, z: rs.z, h, prob, life: 170, state: 'wait', t: 0, px, pz, said: false, dir: { x: ne.dx, z: ne.dz } };
    this.col = circleCol(rs.x, rs.z, 2.3);
    w.statics.insert(this.col);
    g.ui.toast(`🆘 جلوتر یه ماشین خراب شده و راننده‌ش کمک می‌خواد ${prob[1]}`, 'info');
    return true;
  }
  clearStranded() {
    const g = this.g;
    this.sCar.root.visible = false;
    this.sPerson.root.visible = false;
    this.dropCol();
    this.strand = null;
  }
  /** zone for the main loop: stop next to the car to help */
  zone() {
    const S = this.strand, p = this.g.player;
    if (!S || S.state !== 'wait') return null;
    if (Math.hypot(p.pos.x - S.x, p.pos.z - S.z) > 13) return null;
    return { kind: 'help', padX: S.x, padZ: S.z };
  }
  help() {
    const g = this.g, S = this.strand, p = g.player;
    if (!S || S.state !== 'wait') return;
    const [id, icon, ask, act, sec] = S.prob;
    g.ui.say('راننده 🧔', ask);
    if (id === 'fuel') {
      if (p.spec.ev) return g.ui.toast('ماشینت برقیه! بنزین نداری که بدی 😅', 'warn');
      if (p.fuelTotal() < 8) return g.ui.toast('⛽ خودتم بنزین کم داری!', 'warn');
      p.fuel = Math.max(0, p.fuel - 5);
      if (p.fuel <= 0) p.superFuel = Math.max(0, p.superFuel - 5);
      return this.helped();
    }
    S.state = 'fixing';
    S.t = sec;
    g.ui.toast(`${icon} ${act}... نزدیک ماشین بمون (${fa(sec)} ثانیه)`, 'info');
  }
  helped() {
    const g = this.g, S = this.strand, s = g.stats;
    S.state = 'leave';
    S.t = 0;
    const pay = pick([60000, 80000, 100000, 120000]);
    g.money += pay;
    g.coins += 3;
    g.addXp(50);
    s.helped = (s.helped || 0) + 1;
    g.audio.cash();
    g.ui.say('راننده 🧔', pick(['خدا خیرت بده داداش! 🙏', 'مرسی رفیق، نجاتم دادی! 🙏', 'دمت گرم! اینم یه شیرینی 💐']));
    g.ui.toast(`🙏 کمک کردی! +${faMoney(pay)} تومان و 🪙۳`, 'good');
    // the driver gets back in
    this.sPerson.root.visible = false;
    this.dropCol();
  }
  /** the spatial hash can't remove, so the old collider is moved far out of the world */
  dropCol() {
    if (!this.col) return;
    this.col.x = this.col.z = 1e7;
    this.col = null;
  }
  updateStranded(dt) {
    const g = this.g, S = this.strand, p = g.player;
    if (!S) return;
    S.life -= dt;
    const blink = Math.floor(g.time * 2.2) % 2 === 0;
    this.hazard.color.setHex(blink ? 0xffa000 : 0x331a00);
    const d = Math.hypot(p.pos.x - S.x, p.pos.z - S.z);
    if (S.state === 'wait' || S.state === 'fixing') {
      const pr = this.sPerson;
      if (S.state === 'wait') {
        poseWave(pr, g.time);
        pr.root.rotation.y = Math.atan2(p.pos.x - S.px, p.pos.z - S.pz);
      } else poseIdle(pr, g.time);
      if ((S.life <= 0 && d > 60) || d > 600) return this.clearStranded();
    }
    if (S.state === 'fixing') {
      if (d > 16 || g.onfoot.active) {
        S.state = 'wait';
        return g.ui.toast('از ماشینش دور شدی! دوباره کنارش وایسا', 'warn');
      }
      S.t -= dt;
      g.ui.zone(`🔧 داری کمک می‌کنی… ${fa(Math.max(0, Math.ceil(S.t)))}`);
      if (S.t <= 0) this.helped();
    } else if (S.state === 'leave') {
      // the fixed car pulls away and disappears down the road
      S.t += dt;
      const car = this.sCar.root, sp = Math.min(14, S.t * 3);
      car.position.x += S.dir.x * sp * dt;
      car.position.z += S.dir.z * sp * dt;
      car.position.y = g.world.heightAt(car.position.x, car.position.z);
      this.hazard.color.setHex(0x331a00);
      if (S.t > 10) this.clearStranded();
    }
  }
  /* ---------------- food delivery side job ---------------- */
  makeOrders() {
    const g = this.g, w = g.world, p = g.player.pos;
    const city = w.places.filter((pl) => pl.region === 'city');
    const out = [];
    for (let k = 0; k < 40 && out.length < 3; k++) {
      const shop = pick(city), dest = pick(w.places.filter((pl) => pl !== shop && pl.region === 'city' || (pl !== shop && Math.random() < 0.15)));
      if (!dest || shop === dest) continue;
      const dist = Math.hypot(dest.x - shop.x, dest.z - shop.z);
      if (dist < 250 || dist > 1300) continue;
      const toShop = Math.hypot(shop.x - p.x, shop.z - p.z);
      const i = Math.floor(Math.random() * SHOPS.length);
      out.push({ shop, dest, name: SHOPS[i], food: FOODS[i], dist, toShop, pay: Math.round((45000 + dist * 85) / 1000) * 1000, limit: Math.round(dist / 9 + 45) });
    }
    return out;
  }
  ordersList() {
    const g = this.g;
    if (!this.orders || g.time > this.ordersT) {
      this.orders = this.makeOrders();
      this.ordersT = g.time + 120;
    }
    return this.orders;
  }
  phoneHtml() {
    const J = this.job;
    if (J) {
      return `<div class="jobnow"><b>${J.o.name}</b><p>${J.o.food} برای ${J.o.dest.name}</p>
        <p>${J.state === 'toShop' ? '🛵 برو رستوران و غذا رو بگیر' : `⏱ ${fa(Math.max(0, Math.ceil(J.left)))} ثانیه تا تحویل • 🔥 کیفیت غذا ${fa(Math.round(J.q * 100))}٪`}</p>
        <button data-job="cancel" class="ghost">❌ لغو سفارش</button></div>`;
    }
    const L = this.ordersList();
    if (!L.length) return '<p class="note">فعلاً سفارشی نیست، بعداً سر بزن 🛵</p>';
    return `<p class="note">غذا رو از رستوران بگیر و داغ داغ برسون! تصادف = غذا می‌ریزه 😬</p>
      <div class="jobs">${L.map((o, i) => `<div class="card"><h3>${o.name}</h3><p>📦 ${o.food}</p><p>📍 ${o.dest.name} • ${fa((o.dist / 1000).toFixed(1)).replace('.', '٫')} کیلومتر</p><p>💰 ${faMoney(o.pay)} • ⏱ ${fa(o.limit)} ثانیه</p><button data-job="${i}">قبول ✅</button></div>`).join('')}</div>`;
  }
  bindPhone(el, phone) {
    el.querySelectorAll('[data-job]').forEach((b) => (b.onclick = () => {
      const v = b.dataset.job;
      if (v === 'cancel') {
        this.endJob(false, '❌ سفارش رو لغو کردی');
        return phone.render();
      }
      const o = this.ordersList()[+v];
      if (o && this.startJob(o)) {
        this.orders.splice(+v, 1);
        this.g.ui.closePanel();
      }
    }));
  }
  startJob(o) {
    const g = this.g;
    if (this.job) return false;
    if (g.rides.ride) return g.ui.toast('اول مسافرت رو برسون 🧳', 'warn'), false;
    if (g.race.state !== 'idle' || g.crazy.state !== 'idle' || g.parking.state !== 'idle' || g.drag.state !== 'idle' || g.bounty.state !== 'idle') return g.ui.toast('اول مسابقه‌ت رو تموم کن 🏁', 'warn'), false;
    if (g.onfoot.active || g.onfoot.busy) return g.ui.toast('اول سوار ماشین شو 🚗', 'warn'), false;
    if (g.rides.state === 'offer') g.rides.decline();
    this.job = { o, state: 'toShop', left: o.limit, q: 1, crashT: 0 };
    g.setGuide({ x: o.shop.x, z: o.shop.z, label: o.name, addr: o.shop.name });
    g.rides.cooldown = Math.max(g.rides.cooldown, 20);
    $('jobHud').classList.remove('hidden');
    g.ui.toast(`🛵 سفارش ${o.name} رو قبول کردی! برو غذا رو بگیر`, 'good');
    return true;
  }
  endJob(ok, msg) {
    const g = this.g, J = this.job;
    if (!J) return;
    this.job = null;
    $('jobHud').classList.add('hidden');
    if (g.guide && !g.guide.custom) g.clearGuide();
    if (!ok) {
      if (msg) g.ui.toast(msg, 'warn');
      g.audio.bad();
      return;
    }
    const s = g.stats;
    const fast = J.left > 0;
    let pay = J.o.pay * (0.35 + 0.65 * J.q) * (fast ? 1 : 0.5);
    const tip = fast && J.q > 0.85 ? Math.round((J.o.pay * 0.25) / 1000) * 1000 : 0;
    pay = Math.round(pay / 1000) * 1000;
    g.money += pay + tip;
    s.earned = (s.earned || 0) + pay + tip;
    s.today = (s.today || 0) + pay + tip;
    s.deliveries = (s.deliveries || 0) + 1;
    g.addXp(30 + Math.round(J.q * 30));
    g.audio.cash();
    g.ui.say('مشتری 😋', fast ? (J.q > 0.85 ? 'وای چه داغ! مرسی، اینم انعامت 😍' : 'مرسی، ولی یه کم ریخته بود 😕') : 'چقدر دیر کردی! غذا یخ کرده 🥶');
    g.stunts.banner(`🛵 تحویل شد! +${faMoney(pay)}${tip ? ` • انعام ${faMoney(tip)}` : ''}${fast ? '' : ' (دیر رسیدی)'}`);
    g.save();
  }
  updateJob(dt) {
    const g = this.g, J = this.job, p = g.player;
    if (!J) return;
    if (g.state === 'jail') return this.endJob(false, '🔒 دستگیر شدی؛ سفارش غذا لغو شد');
    if (g.state !== 'play') return;
    g.rides.cooldown = Math.max(g.rides.cooldown, 5);
    const sp = p.groundSpeed ?? Math.abs(p.speed);
    const tgt = J.state === 'toShop' ? J.o.shop : J.o.dest;
    const d = Math.hypot(p.pos.x - tgt.x, p.pos.z - tgt.z);
    if (J.state === 'toCust') {
      J.left -= dt;
      // food cools down slowly, crashes spill it
      J.q = Math.max(0.2, J.q - dt * 0.0015 - (J.left < 0 ? dt * 0.004 : 0));
      J.crashT -= dt;
      if (J.crashT <= 0 && p.events.some((e) => e.type === 'crash' && e.impact > 3)) {
        J.crashT = 1;
        J.q = Math.max(0.2, J.q - 0.15);
        g.ui.toast('🍝 غذا ریخت! یواش‌تر برو', 'bad');
      }
    }
    if (d < 11 && sp < 2.5 && !g.onfoot.active) {
      if (J.state === 'toShop') {
        J.state = 'toCust';
        g.audio.tone(880, 0.1, 0.1, 'sine');
        g.audio.tone(1320, 0.12, 0.1, 'sine', 0.12);
        g.ui.toast(`🍱 ${J.o.food} رو گرفتی! داغه، سریع برسون به ${J.o.dest.name}`, 'good');
        g.setGuide({ x: J.o.dest.x, z: J.o.dest.z, label: '📦 مشتری', addr: J.o.dest.name });
      } else return this.endJob(true);
    }
    const hud = $('jobHud');
    const html = J.state === 'toShop' ? `<b>🛵 ${J.o.name}</b><span>برو غذا رو بگیر • ${fa(Math.round(d))} م</span>`
      : `<b class="${J.left < 15 ? 'low' : ''}">⏱ ${fa(Math.max(0, Math.ceil(J.left)))}</b><span>🔥 ${fa(Math.round(J.q * 100))}٪</span><span>📦 ${fa(Math.round(d))} م</span>`;
    if (html !== this.hudText) hud.innerHTML = this.hudText = html;
  }
  /* ---------------- scheduler ---------------- */
  cars() {
    return this.ambCar.active ? [this.ambCar] : [];
  }
  mapIcons() {
    const out = [];
    if (this.strand && this.strand.state !== 'leave') out.push({ x: this.strand.x, z: this.strand.z, col: '#e53935', txt: '🆘' });
    if (this.job) {
      const t = this.job.state === 'toShop' ? this.job.o.shop : this.job.o.dest;
      out.push({ x: t.x, z: t.z, col: '#ff7043', txt: this.job.state === 'toShop' ? '🍔' : '📦' });
    }
    return out;
  }
  update(dt) {
    const g = this.g;
    this.updateAmbulance(dt);
    this.updateStranded(dt);
    this.updateJob(dt);
    if (g.state !== 'play') return;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 8;
    const busy = g.race.state !== 'idle' || g.crazy.state !== 'idle' || g.parking.state !== 'idle' || g.drag.state !== 'idle' || g.bounty.state !== 'idle' || g.police.state !== 'none' || g.onfoot.active;
    if (busy) return;
    const p = g.player, city = regionAt(p.pos.x, p.pos.z) === 'city';
    const r = Math.random();
    let ok = false;
    if (!this.amb && city && r < 0.45) ok = this.spawnAmbulance();
    else if (!this.strand && !g.rides.ride && !this.job) ok = this.spawnStranded();
    if (ok) this.t = 70 + Math.random() * 70;
  }
}
