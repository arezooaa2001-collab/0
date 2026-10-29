import * as THREE from 'three';
import { Walker } from './people.js';
import { buildBeacon } from './models.js';
import { REGION_NAMES } from './world.js';
import { faMoney, faDist, fa, pick, clamp } from './util.js';

const MALE = ['علی', 'رضا', 'محمد', 'حسین', 'امیر', 'مهدی', 'سعید', 'کامران', 'بهرام', 'پیمان', 'داریوش', 'مجید', 'کیان', 'آرش'];
const FEMALE = ['مریم', 'سارا', 'زهرا', 'نرگس', 'لیلا', 'شیرین', 'پریسا', 'نازنین', 'فاطمه', 'الهام', 'مینا', 'آزاده', 'ترانه', 'یاسمن'];
const FAMILY = ['احمدی', 'رضایی', 'کریمی', 'حسینی', 'موسوی', 'جعفری', 'نوری', 'صادقی', 'رحیمی', 'کاظمی', 'تهرانی', 'شیرازی', 'اصفهانی', 'یزدی'];
const MOODS = {
  normal: { label: 'معمولی', icon: '🙂' },
  hurry: { label: 'عجله داره', icon: '⏱️' },
  scared: { label: 'ترسو', icon: '😰' },
  chatty: { label: 'پرحرف', icon: '💬' },
  grumpy: { label: 'بداخلاق', icon: '😠' },
};
const CHAT = [
  'هوا امروز عالیه، نه؟',
  'راستی شما چند ساله راننده‌اید؟',
  'ترافیک شهر هر روز بدتر میشه...',
  'این جاده رو خیلی دوست دارم، منظره‌اش محشره.',
  'یه آهنگ خوب نمی‌ذارید؟',
  'بچه که بودم با بابام همیشه از این مسیر می‌رفتیم.',
  'می‌دونستید کویر شب‌ها پر از ستاره‌ست؟',
  'قیمت بنزین هم که دیگه نگو...',
];

export class Rides {
  constructor(game) {
    this.game = game;
    this.state = 'idle';
    this.cooldown = 4;
    this.offer = null;
    this.ride = null;
    this.beacon = buildBeacon(0xffd23a);
    this.beacon.visible = false;
    game.scene.add(this.beacon);
  }
  get busy() {
    return this.state !== 'idle' && this.state !== 'offer';
  }
  makeOffer() {
    const g = this.game, w = g.world;
    const p = g.player.pos;
    let pickup;
    const outerPickup = Math.random() < 0.25 || !(Math.abs(p.x) < 600 && Math.abs(p.z) < 600);
    if (outerPickup) {
      // somewhere near the player outside the city, or an outer landmark
      pickup = w.randomRoadside(p, 120, 700, false) || w.randomRoadside(p, 100, 1500, false);
    } else pickup = w.randomRoadside(p, 120, 600, true);
    if (!pickup) return null;
    const cands = w.places.filter((pl) => pl.region !== pickup.region && Math.hypot(pl.x - pickup.x, pl.z - pickup.z) > 700);
    const dest = pick(cands.length ? cands : w.places);
    const route = w.route(pickup.x, pickup.z, dest.x, dest.z);
    const len = w.routeLength(route);
    const toPick = w.routeLength(w.route(p.x, p.z, pickup.x, pickup.z));
    const female = Math.random() < 0.5;
    const moodKey = pick(['normal', 'normal', 'hurry', 'scared', 'chatty', 'grumpy']);
    const vip = Math.random() < 0.15;
    let fare = 35000 + len * 78;
    if (moodKey === 'hurry') fare *= 1.3;
    if (vip) fare *= 3;
    fare = Math.round(fare / 1000) * 1000;
    const name = (female ? pick(FEMALE) : pick(MALE)) + ' ' + pick(FAMILY);
    return {
      name,
      female,
      mood: moodKey,
      pickup,
      dest,
      len,
      toPick,
      fare,
      pickupAddr: w.addressOf(pickup.roadX, pickup.roadZ),
      destAddr: `${dest.name} (${REGION_NAMES[dest.region]}) — ${dest.road}`,
      fuelNeed: Math.ceil((len + toPick) / 120),
      rating: (3.6 + Math.random() * 1.4).toFixed(1),
      expected: vip ? len / 17 + 20 : len / 14 + 25,
      vip,
    };
  }
  update(dt) {
    const g = this.game;
    const car = g.player;
    if (this.state === 'idle') {
      if (g.police.state !== 'none' || g.state !== 'play') return;
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        const o = this.makeOffer();
        this.cooldown = 3;
        if (!o) return;
        this.offer = o;
        this.state = 'offer';
        this.offerT = 25;
        g.audio.beep();
        g.ui.showOffer(o, () => this.accept(false), () => this.decline(), () => this.accept(true));
      }
      return;
    }
    if (this.state === 'offer') {
      this.offerT -= dt;
      g.ui.setOfferTimer(this.offerT / 25);
      if (this.offerT <= 0) {
        g.ui.hideOffer();
        g.ui.toast('درخواست سفر منقضی شد', 'warn');
        this.state = 'idle';
        this.cooldown = 6;
      }
      return;
    }
    const r = this.ride;
    r.t += dt;
    r.walker.update(dt, g.world);
    this.beacon.userData.ring.rotation.z += dt;
    const bp = 0.5 + 0.5 * Math.sin(r.t * 4);
    this.beacon.userData.ringMat.opacity = 0.4 + bp * 0.4;
    const sp = Math.abs(car.speed);

    if (this.state === 'toPickup') {
      const d = Math.hypot(car.pos.x - r.o.pickup.x, car.pos.z - r.o.pickup.z);
      if (d < 70) {
        r.walker.mode = 'wave';
        r.walker.lookAt(car.pos.x, car.pos.z);
      } else r.walker.mode = 'idle';
      if (d < 11 && sp < 1.6) this.startBoarding();
      if (r.t > 300) this.cancel('مسافر خسته شد و سفر رو لغو کرد 😕', true);
    } else if (this.state === 'boarding') {
      const off = Math.hypot(car.pos.x - r.boardPos.x, car.pos.z - r.boardPos.z);
      if (off > 5 && !r.walker.attached) {
        // driver left, passenger goes back to the curb
        r.walker.walkTo(r.o.pickup.x, r.o.pickup.z, 1.6);
        this.state = 'toPickup';
        car.car.doors[r.door].target = 0;
        g.ui.say(r.o.name, 'کجا میری؟! صبر کن سوار شم!', { mood: 'grumpy' });
        r.complaints++;
      } else if (r.walker.mode === 'walk') {
        // follow the door as the car settles
        const dp = this.doorWorld(r.door, 1.35);
        r.walker.target = { x: dp.x, z: dp.z };
      }
      if (r.enterT !== undefined) {
        r.enterT += dt;
        const k = clamp(r.enterT / 0.8, 0, 1);
        r.walker.root.position.lerpVectors(r.enterFrom, r.seat, k);
        if (k >= 1 && !r.seated) {
          r.seated = true;
          car.car.doors[r.door].target = 0;
          g.audio.door();
          setTimeout(() => this.startTrip(), 450);
        }
      }
    } else if (this.state === 'toDest') {
      const d = Math.hypot(car.pos.x - r.o.dest.x, car.pos.z - r.o.dest.z);
      r.chatT -= dt;
      if (r.o.mood === 'chatty' && r.chatT <= 0) {
        r.chatT = 22 + Math.random() * 15;
        this.say(pick(CHAT));
      }
      if (r.o.mood === 'scared' && sp > 25) {
        r.fast += dt;
        if (r.fast > 2 && r.t - r.lastScare > 8) {
          r.lastScare = r.t;
          r.complaints++;
          this.say('تو رو خدا یواش‌تر! دارم سکته می‌کنم! 😱');
        }
      }
      if (r.o.mood === 'hurry' && r.t > r.o.expected && !r.lateSaid) {
        r.lateSaid = true;
        r.complaints++;
        this.say('دیر شد! گفتم که عجله دارم!');
      }
      if (d < 13 && sp < 1.6) this.startAlight();
    } else if (this.state === 'alighting') {
      r.outT += dt;
      if (r.outT > 7) this.finish();
    }
  }
  doorWorld(door, out) {
    const car = this.game.player;
    const side = door[1] === 'l' ? 1 : -1;
    const z = door[0] === 'f' ? 0.3 : -0.6;
    const v = new THREE.Vector3(side * out, 0, z);
    v.applyAxisAngle(new THREE.Vector3(0, 1, 0), car.heading);
    return { x: car.pos.x + v.x, z: car.pos.z + v.z };
  }
  accept(guide) {
    const g = this.game;
    const o = this.offer;
    g.ui.hideOffer();
    const walker = new Walker(g.scene, { female: o.female });
    walker.setPos(o.pickup.x, o.pickup.z, Math.atan2(-o.pickup.nx, -o.pickup.nz));
    this.ride = { o, walker, t: 0, complaints: 0, crashes: 0, chatT: 12, fast: 0, lastScare: -99 };
    this.state = 'toPickup';
    this.beacon.visible = true;
    this.beacon.userData.beamMat.color.setHex(0xffd23a);
    this.beacon.userData.ringMat.color.setHex(0xffd23a);
    this.beacon.position.set(o.pickup.x, g.world.heightAt(o.pickup.x, o.pickup.z), o.pickup.z);
    g.setGuide({ x: o.pickup.x, z: o.pickup.z, label: 'مسافر: ' + o.name, addr: o.pickupAddr });
    if (guide) g.guideOn = true;
    g.ui.say(o.name, `سلام! من ${o.pickupAddr} منتظرتونم.`, { mood: o.mood, female: o.female, guide: true });
    g.audio.beep();
  }
  decline() {
    this.game.ui.hideOffer();
    this.state = 'idle';
    this.cooldown = 5 + Math.random() * 4;
  }
  startBoarding() {
    const g = this.game, r = this.ride, car = g.player;
    this.state = 'boarding';
    r.boardPos = car.pos.clone();
    // pick the rear door on the side the passenger stands
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const lx = (r.walker.pos.x - car.pos.x) * -fz + (r.walker.pos.z - car.pos.z) * fx; // >0 means to the right
    r.door = lx > 0 ? 'rr' : 'rl';
    r.seat = car.car.seats[r.door === 'rr' ? 'rearR' : 'rearL'].clone();
    const dp = this.doorWorld(r.door, 1.35);
    r.walker.face = null;
    r.walker.walkTo(dp.x, dp.z, 1.7, () => {
      if (this.state !== 'boarding') return;
      car.car.doors[r.door].target = 1;
      g.audio.door();
      setTimeout(() => {
        if (this.state !== 'boarding') return;
        const side = r.door === 'rl' ? 1 : -1;
        r.walker.sitIn(car.group, new THREE.Vector3(side * 1.2, 0.53, -0.75), 0);
        r.walker.p.root.visible = true;
        r.enterFrom = new THREE.Vector3(side * 1.2, 0.53, -0.75);
        r.enterT = 0;
      }, 550);
    });
  }
  startTrip() {
    const g = this.game, r = this.ride;
    if (this.state !== 'boarding') return;
    this.state = 'toDest';
    r.t = 0;
    g.player.occupied = true;
    this.beacon.userData.beamMat.color.setHex(0x34e07a);
    this.beacon.userData.ringMat.color.setHex(0x34e07a);
    this.beacon.position.set(r.o.dest.x, g.world.heightAt(r.o.dest.x, r.o.dest.z), r.o.dest.z);
    g.setGuide({ x: r.o.dest.x, z: r.o.dest.z, label: r.o.dest.name, addr: r.o.destAddr });
    const lines = {
      normal: `سلام آقا، خسته نباشید. لطفاً منو ببرید ${r.o.dest.name}، منطقه ${REGION_NAMES[r.o.dest.region]}.`,
      hurry: `سلام! خیلی عجله دارم! سریع برو ${r.o.dest.name}، ${REGION_NAMES[r.o.dest.region]}!`,
      scared: `سلام... لطفاً آروم برونید. می‌خوام برم ${r.o.dest.name}، ${REGION_NAMES[r.o.dest.region]}.`,
      chatty: `سلااام! چه ماشین تمیزی! بریم ${r.o.dest.name} توی ${REGION_NAMES[r.o.dest.region]}، راه درازیه، کلی حرف داریم!`,
      grumpy: `برو ${r.o.dest.name}. ${REGION_NAMES[r.o.dest.region]}. زودم برو.`,
    };
    this.say(lines[r.o.mood], true);
    g.ui.toast(`مقصد: ${r.o.dest.name} • ${faDist(r.o.len)}`, 'info');
  }
  say(text, guide = false) {
    const r = this.ride;
    this.game.ui.say(r.o.name, text, { mood: r.o.mood, female: r.o.female, guide });
    this.game.audio.speak(text);
  }
  onCrash(impact) {
    const r = this.ride;
    if (!r || this.state !== 'toDest' || impact < 3.5) return;
    r.crashes++;
    this.say(pick(['وای! چیکار می‌کنی؟! 😨', 'حواست کجاست؟!', 'آخ سرم! یواش!', 'می‌خوای منو بکشی؟!']));
  }
  startAlight() {
    const g = this.game, r = this.ride, car = g.player;
    this.state = 'alighting';
    r.outT = 0;
    car.car.doors[r.door].target = 1;
    g.audio.door();
    setTimeout(() => {
      if (this.ride !== r) return;
      const dp = this.doorWorld(r.door, 1.4);
      r.walker.standOut(dp.x, dp.z, car.heading);
      r.walker.walkTo(r.o.dest.x + r.o.dest.nx * 6, r.o.dest.z + r.o.dest.nz * 6, 1.4);
      setTimeout(() => {
        car.car.doors[r.door].target = 0;
        g.audio.door();
      }, 900);
    }, 500);
    this.pay();
  }
  pay() {
    const g = this.game, r = this.ride;
    let stars = 5 - Math.min(3, r.crashes) - Math.min(2, r.complaints);
    if (r.o.mood === 'grumpy') stars -= 1;
    if (r.t < r.o.expected * 0.8) stars += 1;
    if (r.t > r.o.expected * 1.6) stars -= 1;
    stars = clamp(Math.round(stars), 1, 5);
    let fare = r.o.fare;
    if (stars <= 1) fare *= 0.6;
    if (r.o.vip && r.t > r.o.expected) {
      fare *= 0.5;
      g.ui.toast('⭐ مسافر VIP دیر رسید؛ نصف کرایه رو داد', 'warn');
    } else if (r.o.vip) g.ui.toast('⭐ مسافر VIP راضی بود! کرایه سه‌برابر 💰', 'good');
    const tip = stars >= 4 ? Math.round((r.o.fare * (stars - 3) * 0.08) / 1000) * 1000 : 0;
    const total = Math.round(fare / 1000) * 1000 + tip;
    g.money += total;
    g.stats.trips++;
    g.stats.completed = (g.stats.completed || 0) + 1;
    g.stats.earned += total;
    g.stats.ratingSum += stars;
    if (stars === 5) g.stats.fiveStars = (g.stats.fiveStars || 0) + 1;
    if (g.env && g.env.night > 0.5) g.stats.nightRides = (g.stats.nightRides || 0) + 1;
    if (g.weather && g.weather.rain > 0.3) g.stats.rainRides = (g.stats.rainRides || 0) + 1;
    g.player.occupied = false;
    const msg = stars >= 4 ? 'مرسی! عالی رانندگی کردید. 🌟' : stars >= 3 ? 'ممنون، رسیدیم.' : 'دیگه هیچ‌وقت با شما نمیام!';
    this.say(msg);
    g.audio.cash();
    g.ui.showResult({ name: r.o.name, fare: Math.round(fare / 1000) * 1000, tip, total, stars, dest: r.o.dest.name, time: r.t });
    g.clearGuide();
    this.beacon.visible = false;
    g.save();
  }
  finish() {
    if (this.ride) this.ride.walker.dispose();
    this.ride = null;
    this.state = 'idle';
    this.cooldown = 5 + Math.random() * 5;
  }
  cancel(msg, byPassenger = false) {
    const g = this.game;
    if (this.state === 'offer') {
      g.ui.hideOffer();
      this.state = 'idle';
      return;
    }
    if (!this.ride) return;
    const r = this.ride;
    if (r.walker.attached) {
      const dp = this.doorWorld(r.door || 'rr', 1.4);
      r.walker.standOut(dp.x, dp.z, g.player.heading);
    }
    if (r.door) g.player.car.doors[r.door].target = 0;
    r.walker.dispose();
    g.player.occupied = false;
    this.beacon.visible = false;
    g.clearGuide();
    if (!byPassenger) {
      g.stats.ratingSum += 1;
      g.stats.trips++;
    }
    g.ui.toast(msg || 'سفر لغو شد', 'warn');
    this.ride = null;
    this.state = 'idle';
    this.cooldown = 8;
  }
  /** the seated passenger leaves the ride (e.g. the taxi is on fire) */
  abandon() {
    const r = this.ride;
    if (!r || !(this.state === 'toDest' || (this.state === 'boarding' && r.walker.attached))) return null;
    const g = this.game;
    this.beacon.visible = false;
    g.clearGuide();
    g.player.occupied = false;
    g.stats.trips++;
    g.stats.ratingSum += 1;
    this.ride = null;
    this.state = 'idle';
    this.cooldown = 45;
    return { walker: r.walker, door: r.door || 'rr', o: r.o };
  }
  statusText() {
    const r = this.ride;
    if (this.state === 'toPickup') return `🧍 برو دنبال ${r.o.name}`;
    if (this.state === 'boarding') return '🚪 مسافر داره سوار میشه...';
    if (this.state === 'toDest') {
      let s = `🧳 ${r.o.name} ← ${r.o.dest.name}`;
      if (r.o.mood === 'hurry' || r.o.vip) s += ` • ⏱️ ${fa(Math.max(0, Math.ceil(r.o.expected - r.t)))} ثانیه`;
      if (r.o.vip) s = '⭐ VIP • ' + s;
      return s;
    }
    if (this.state === 'alighting') return '💰 مسافر پیاده شد';
    return '';
  }
}
export { MOODS, faMoney };
