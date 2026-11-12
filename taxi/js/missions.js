import * as THREE from 'three';
import { Walker } from './people.js';
import { buildBeacon, buildCar } from './models.js';
import { TrafficCar } from './traffic.js';
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
const ALIASES = ['سایه', 'شبح', 'کلاه‌مشکی', 'دست‌کج', 'گربه', 'روباه'];
const ROBBER_LINES = ['تندتر! تندتر! 😰', 'از کوچه پس‌کوچه‌ها برو!', 'اگه بگیرنمون جفتمون می‌ریم زندان!', 'نیترو داری؟ الان وقتشه! 🔥', 'آژیرشون رو می‌شنوی؟! گازشو بگیر!', 'فقط گمشون کن، پولش با من! 💰'];
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
    const vip = Math.random() < (g.player.spec.vip ? 0.45 : 0.15);
    let fare = 35000 + len * 78;
    if (moodKey === 'hurry') fare *= 1.3;
    if (vip) fare *= 3;
    // surge pricing: rain, night and rush hour
    const surge = [];
    if (g.weather && (g.weather.wet ?? g.weather.rain) > 0.3) surge.push(['☔', 1.25]);
    if (g.env && g.env.night > 0.6) surge.push(['🌙', 1.2]);
    if ((g.hour >= 7 && g.hour < 9.5) || (g.hour >= 17 && g.hour < 20)) surge.push(['🚦', 1.15]);
    const surgeK = surge.reduce((k, s) => k * s[1], 1);
    fare *= surgeK;
    fare = Math.round(fare / 1000) * 1000;
    let name = (female ? pick(FEMALE) : pick(MALE)) + ' ' + pick(FAMILY);
    // special jobs
    const roll = Math.random();
    if (g.police.state === 'none' && roll < 0.08) {
      const hide = w.places.filter((pl) => pl.region !== 'city' && Math.hypot(pl.x - pickup.x, pl.z - pickup.z) > 800);
      const hd = pick(hide.length ? hide : w.places);
      const hl = w.routeLength(w.route(pickup.x, pickup.z, hd.x, hd.z));
      return {
        kind: 'robber', name: pick(MALE) + ' «' + pick(ALIASES) + '»', female: false, mood: 'grumpy', pickup, dest: hd, len: hl, toPick,
        fare: Math.round(((35000 + hl * 78) * 3.5) / 1000) * 1000,
        pickupAddr: w.addressOf(pickup.roadX, pickup.roadZ),
        destAddr: `یه جای خلوت نزدیک ${hd.name} (${REGION_NAMES[hd.region]})`,
        fuelNeed: Math.ceil((hl + toPick) / 120), rating: '۱٫۲', expected: hl / 14 + 60, vip: false,
      };
    }
    if (roll >= 0.17 && roll < 0.24) {
      // a tourist who wants to see three landmarks, one after another
      const pool = w.places.filter((pl) => Math.hypot(pl.x - pickup.x, pl.z - pickup.z) > 250);
      const stops = [];
      while (stops.length < 3 && pool.length) stops.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      if (stops.length === 3) {
        let tl = 0, from = pickup;
        for (const st of stops) {
          tl += w.routeLength(w.route(from.x, from.z, st.x, st.z));
          from = st;
        }
        const tf = Math.random() < 0.5;
        return {
          kind: 'tour', name: 'توریست ' + pick(['ژاپنی', 'آلمانی', 'ایتالیایی', 'فرانسوی', 'اسپانیایی', 'برزیلی']) + ' ' + (tf ? pick(['ماریا', 'یوکی', 'آنا', 'سوفی']) : pick(['هانس', 'لوکا', 'پیر', 'کارلوس'])), female: tf, mood: 'chatty', pickup, dest: stops[0], stops, len: tl, toPick,
          fare: Math.round(((35000 + tl * 78) * 1.6) / 1000) * 1000,
          pickupAddr: w.addressOf(pickup.roadX, pickup.roadZ),
          destAddr: '📸 تور: ' + stops.map((st) => st.name).join(' ← '),
          fuelNeed: Math.ceil((tl + toPick) / 120), rating: (4.3 + Math.random() * 0.7).toFixed(1), expected: tl / 14 + 60, vip: false,
        };
      }
    }
    if (roll < 0.17 && pickup.region === 'city') {
      return {
        kind: 'follow', name: pick(['کارآگاه ', 'بازرس ']) + (female ? pick(FEMALE) : pick(MALE)), female, mood: 'normal', pickup, dest: pickup, len: 0, toPick,
        fare: Math.round((380000 + Math.random() * 280000) / 1000) * 1000,
        pickupAddr: w.addressOf(pickup.roadX, pickup.roadZ),
        destAddr: '«اون ماشین رو تعقیب کن!» — مقصد معلوم نیست',
        fuelNeed: 3, rating: (4 + Math.random()).toFixed(1), expected: 200, vip: false,
      };
    }
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
      surge: surge.length ? `${surge.map((x) => x[0]).join('')} ×${surgeK.toFixed(2)}` : '',
      likes: pick(['pop', 'sonati', 'electro', null, null]),
    };
  }
  update(dt) {
    const g = this.game;
    const car = g.player;
    this.updateLost();
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
    const sp = car.groundSpeed ?? Math.abs(car.speed);

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
      if (r.follow && !r.follow.done) return this.updateFollow(dt);
      const d = Math.hypot(car.pos.x - r.o.dest.x, car.pos.z - r.o.dest.z);
      if (r.o.kind === 'robber') {
        // police busy with a fender-bender? the robbery gets reported as soon as they're free
        if (!r.reported && g.police.state === 'none') this.reportRobbery();
        else if (!r.reported && (g.police.state === 'dispatch' || g.police.state === 'chase')) {
          // already wanted for something else: the robbery joins the same chase
          r.reported = true;
          g.police.robbery = true;
        }
        const hot = g.police.state === 'chase' || g.police.state === 'dispatch' || !r.reported;
        if (hot) r.wasHot = true;
        else if (r.wasHot && !r.freeSaid) {
          r.freeSaid = true;
          this.say('ایول!! گمشون کردی! 😎 حالا برو سمت مخفیگاه.');
        }
        r.chatT -= dt;
        if (hot && r.chatT <= 0) {
          r.chatT = 13 + Math.random() * 8;
          this.say(pick(ROBBER_LINES));
        }
        if (d < 13 && sp < 1.6) {
          if (!hot) this.startAlight();
          else if (r.t - (r.warnT ?? -99) > 6) {
            r.warnT = r.t;
            this.say('هنوز پلیس دنبالمونه!! اینجا نه! اول گمشون کن! 😱');
          }
        }
        return;
      }
      if (r.follow) this.updateTargetLeaving(dt);
      if (!r.dirtSaid && r.t > 6 && (car.dirt || 0) > 0.6) {
        r.dirtSaid = true;
        r.complaints++;
        this.say(pick(['ببخشیدا، ولی ماشینتون چقدر کثیفه! 😒', 'اوه، این صندلی‌ها چرا گلیه؟ 🤢', 'یه کارواش هم بد نیست بری‌ها!']));
      }
      r.chatT -= dt;
      // favourite radio station
      if (r.o.likes && !r.likeSaid && r.t > 6) {
        r.likeSaid = true;
        this.say({ pop: 'میشه رادیو پاپ رو بذاری؟ عاشق آهنگای شادم! 🎶', sonati: 'اگه رادیو سنتی رو بذاری حال می‌کنم... 🎻', electro: 'یه رادیو الکترو بذار، حوصله‌م سر رفته! 🎧' }[r.o.likes] + ' (📻 کلید K)');
      }
      if (r.o.likes && g.radio === r.o.likes) r.likedT = (r.likedT || 0) + dt;
      // carsick passengers: too many hard, fast turns
      const lat = Math.abs(car.speed * car.yawRate);
      r.sickT = lat > 7 ? (r.sickT || 0) + dt : Math.max(0, (r.sickT || 0) - dt * 0.3);
      if (r.sickT > 4 && !r.sick) {
        r.sick = true;
        r.complaints += 2;
        car.dirt = Math.min(1, (car.dirt || 0) + 0.35);
        car.applyDirt();
        g.stats.sick = (g.stats.sick || 0) + 1;
        this.say(pick(['وای... حالم بد شد! 🤢 مگه مسابقه‌ست؟!', 'نگه دار! دارم بالا میارم! 🤮', 'این چه طرز رانندگیه... حالم خراب شد 🤢']));
      }
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
      if (r.follow && sp < 1.6) {
        // "stop right here": anywhere is fine once the tail is over; walk away from the door side
        const dp = this.doorWorld(r.door || 'rr', 1.4);
        const nl = Math.hypot(dp.x - car.pos.x, dp.z - car.pos.z) || 1;
        Object.assign(r.o.dest, { x: car.pos.x, z: car.pos.z, nx: (dp.x - car.pos.x) / nl, nz: (dp.z - car.pos.z) / nl });
        this.startAlight();
      } else if (r.o.kind === 'tour' && (r.photoT > 0 || r.stop < r.o.stops.length - 1)) {
        this.updateTour(dt, d, sp);
      } else if (d < 13 && sp < 1.6) this.startAlight();
    } else if (this.state === 'alighting') {
      if (r.follow) this.updateTargetLeaving(dt);
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
    if (r.o.kind === 'follow' && this.spawnTarget()) {
      const T = this.target;
      r.follow = { t: 0, need: 55 + Math.random() * 30, lost: 0, close: 0, warned: 0, spotted: false, done: false };
      this.beacon.visible = false;
      g.setGuide({ x: T.pos.x, z: T.pos.z, label: '🚗 ماشین هدف', addr: 'تعقیبش کن، ولی زیاد نزدیک نشو!', follow: true });
      g.guideOn = true;
      this.say('اون ماشین قرمز رو می‌بینی؟ 🕵️ دنبالش کن! ولی زیادی نزدیک نشو که بو نبره!', true);
      return;
    }
    if (r.o.kind === 'robber') {
      r.chatT = 14;
      this.reportRobbery();
    }
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
    if (r.o.kind === 'tour') {
      r.stop = 0;
      r.photoT = 0;
      this.say(`هِلو! سلام! 😊 من اولین بارمه ایرانم! می‌خوام اینا رو ببینم: ${r.o.stops.map((st) => st.name).join('، ')}. اول بریم ${r.o.stops[0].name}!`, true);
    } else if (r.o.kind === 'robber') this.say('برو برو برو!! 💰 همین الان بانک رو زدم! پلیس تو راهه! منو برسون مخفیگاه، کرایه‌ت چند برابر! 😈', true);
    else this.say(lines[r.o.mood], true);
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
    if (r.o.kind === 'robber') stars = 5;
    if (r.follow) stars = r.follow.lost > 8 ? Math.min(stars, 2) : r.follow.spotted ? Math.min(stars, 4) : stars;
    stars = clamp(Math.round(stars), 1, 5);
    let fare = r.o.fare;
    const failed = r.follow && r.follow.lost > 8;
    // a lost tail only pays a small call-out fee for the time spent following
    if (failed) fare = Math.min(r.o.fare * 0.5 * clamp(r.follow.t / r.follow.need, 0, 1), 60000);
    else if (r.follow && r.follow.spotted) fare *= 0.8;
    if (stars <= 1) fare *= 0.6;
    if (r.o.vip && r.t > r.o.expected) {
      fare *= 0.5;
      g.ui.toast('⭐ مسافر VIP دیر رسید؛ نصف کرایه رو داد', 'warn');
    } else if (r.o.vip) g.ui.toast('⭐ مسافر VIP راضی بود! کرایه سه‌برابر 💰', 'good');
    let tip = stars >= 4 ? Math.round((r.o.fare * (stars - 3) * 0.08 * (g.player.spec.tips || 1)) / 1000) * 1000 : 0;
    if (g.player.spec.tips && stars >= 3) tip += 5000;
    if (r.likedT > 20) {
      tip += Math.round((r.o.fare * 0.15) / 1000) * 1000;
      setTimeout(() => g.ui.toast('🎶 مسافر عاشق آهنگای رادیو شد و انعام بیشتری داد!', 'good'), 1200);
    }
    const total = Math.round(fare / 1000) * 1000 + tip;
    g.money += total;
    g.stats.trips++;
    if (!failed) g.stats.completed = (g.stats.completed || 0) + 1;
    if (r.o.kind === 'tour') g.stats.tours = (g.stats.tours || 0) + 1;
    g.stats.earned += total;
    g.stats.today = (g.stats.today || 0) + total;
    if (!failed && (r.o.kind || r.o.vip)) g.stats.specialRides = (g.stats.specialRides || 0) + 1;
    g.stats.ratingSum += stars;
    if (stars === 5) g.stats.fiveStars = (g.stats.fiveStars || 0) + 1;
    g.addXp(failed ? 10 : 30 + stars * 10 + (r.o.vip ? 40 : 0) + (r.o.kind ? 80 : 0));
    if (g.env && g.env.night > 0.5) g.stats.nightRides = (g.stats.nightRides || 0) + 1;
    if (g.weather && (g.weather.wet ?? g.weather.rain) > 0.3) g.stats.rainRides = (g.stats.rainRides || 0) + 1;
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
    this.endTarget();
    const r = this.ride;
    // sometimes the passenger leaves something behind
    if (r && (!r.o.kind || r.o.kind === 'tour') && !this.lost && Math.random() < 0.14) {
      const item = pick(['📱 گوشیش', '👛 کیف پولش', '☂️ چترش', '🎒 کوله‌ش', '🔑 کلیدهاش']);
      const d = r.o.dest;
      this.lost = { x: d.x + (d.nx || 0) * 6, z: d.z + (d.nz || 0) * 6, item, name: r.o.name, until: this.game.time + 240 };
      this.game.ui.toast(`${item.split(' ')[0]} ${r.o.name} ${item.split(' ')[1]} رو توی ماشین جا گذاشت! برگرد پسش بده (۴ دقیقه وقت داری)`, 'info');
    }
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
    this.endTarget();
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
    this.endTarget();
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
  reportRobbery() {
    const g = this.game, r = this.ride;
    if (!r || g.police.state !== 'none') return;
    g.police.report(600000, '🚨 یه دزد بانک سوار تاکسی تو شده! پلیس داره میاد!');
    if (g.police.state === 'dispatch') {
      g.police.robbery = true;
      r.reported = true;
    }
  }
  /** point the arrow at whatever this ride needs next (used after a race borrowed it) */
  restoreGuide() {
    const g = this.game, r = this.ride;
    if (!r) return g.clearGuide();
    if (this.state === 'toPickup' || this.state === 'boarding') g.setGuide({ x: r.o.pickup.x, z: r.o.pickup.z, label: 'مسافر: ' + r.o.name, addr: r.o.pickupAddr });
    else if (r.follow && !r.follow.done && this.target) g.setGuide({ x: this.target.pos.x, z: this.target.pos.z, label: '🚗 ماشین هدف', addr: 'تعقیبش کن!', follow: true });
    else g.setGuide({ x: r.o.dest.x, z: r.o.dest.z, label: r.o.dest.name, addr: r.o.destAddr || '' });
  }
  /** returning a forgotten item */
  updateLost() {
    const g = this.game, L = this.lost;
    if (!L) return;
    const car = g.player, sp = car.groundSpeed ?? Math.abs(car.speed);
    const free = !this.ride && (this.state === 'idle' || this.state === 'offer') && g.race.state === 'idle' && g.crazy.state === 'idle' && g.parking.state === 'idle' && g.drag.state === 'idle';
    if (free && !g.guide) g.setGuide({ x: L.x, z: L.z, label: `${L.item.split(' ')[0]} پس دادن به ${L.name}`, addr: 'بیرون منتظرته', lost: true });
    if (g.time > L.until) {
      this.lost = null;
      if (g.guide && g.guide.lost) g.clearGuide();
      g.ui.toast(`${L.name} دیگه منتظر نموند... 😕`, 'warn');
      return;
    }
    const dl = Math.hypot(car.pos.x - L.x, car.pos.z - L.z);
    // you only notice it after driving off: the return counts once you've been away and come back
    if (dl > 60) L.armed = true;
    if (free && L.armed && !g.onfoot.active && dl < 16 && sp < 2) {
      this.lost = null;
      if (g.guide && g.guide.lost) g.clearGuide();
      g.money += 60000;
      g.coins += 10;
      g.addXp(40);
      g.stats.returned = (g.stats.returned || 0) + 1;
      g.audio.cash();
      g.ui.say(L.name, 'وای مرسی!! 🙏 فکر کردم دیگه پیداش نمی‌کنم! این شیرینیت 💐');
      g.ui.toast('🙏 وسیله رو پس دادی: +۶۰٬۰۰۰ تومان و ۱۰ سکه', 'good');
    }
  }
  /* ---------- sightseeing tour ---------- */
  updateTour(dt, d, sp) {
    const g = this.game, r = this.ride;
    if (r.photoT > 0) {
      r.photoT -= dt;
      if (sp > 3 && !r.rushSaid) {
        r.rushSaid = true;
        r.complaints++;
        this.say('صبر کن! هنوز عکسم رو نگرفتم! 😩');
      }
      if (r.photoT <= 0) {
        // on to the next landmark
        r.stop++;
        r.rushSaid = false;
        const st = r.o.stops[r.stop];
        r.o.dest = st;
        this.beacon.position.set(st.x, g.world.heightAt(st.x, st.z), st.z);
        g.setGuide({ x: st.x, z: st.z, label: st.name, addr: `📸 جای ${fa(r.stop + 1)} از ${fa(r.o.stops.length)}` });
        this.say(pick(['عالی بود! حالا بریم ', 'وااای! مرسی! بعدی: ', 'چه عکسایی شد! حالا ']) + st.name + '! 🚕');
      }
      return;
    }
    if (d < 14 && sp < 1.6) {
      r.photoT = 4;
      g.ui.flash();
      g.audio.burst(0.06, 3000, 'highpass', 0.4);
      g.stats.tourStops = (g.stats.tourStops || 0) + 1;
      this.say(pick(['📸 وای چه جای قشنگی! چند تا عکس بگیرم...', '📸 بیوتیفول! یه سلفی هم بگیرم!', '📸 عجب معماری‌ای! صبر کن عکس بگیرم']));
    }
  }
  /* ---------- "follow that car" ---------- */
  spawnTarget() {
    const g = this.game, w = g.world, p = g.player, G = w.graph;
    if (!this.target) {
      const T = new TrafficCar(g.traffic, buildCar({ type: 'sedan', color: 0xc62828 }).root);
      T.isTarget = true;
      const mk = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 12), mat);
      cone.rotation.x = Math.PI;
      mk.add(cone);
      mk.position.y = 2.9;
      T.group.add(mk);
      T.marker = mk;
      this.target = T;
    }
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const ne = w.nearestEdge(p.pos.x + fx * 40, p.pos.z + fz * 40);
    if (!ne) return null;
    const e = ne.edge, A = G.nodes[e.a], B = G.nodes[e.b];
    const fwd = (B.x - A.x) * fx + (B.z - A.z) * fz >= 0;
    this.target.spawnOn(e.id, fwd ? e.a : e.b, fwd ? ne.t : 1 - ne.t);
    this.target.persona = 1.15;
    this.targetT = 0;
    return this.target;
  }
  endTarget() {
    if (this.target && this.target.active) this.target.deactivate();
  }
  onTargetHit() {
    const r = this.ride;
    if (!r || !r.follow || r.follow.done) return;
    r.follow.spotted = true;
    r.follow.lost = 99;
    this.target.persona = 1.7;
    this.say('زدی بهش؟!! 🤦 لو رفتیم! همه چی خراب شد!');
  }
  updateFollow(dt) {
    const g = this.game, r = this.ride, f = r.follow, T = this.target, car = g.player;
    T.update(dt, g.time);
    T.marker.position.y = 2.9 + Math.sin(g.time * 4) * 0.2;
    T.marker.rotation.y += dt * 2;
    if (g.guide && g.guide.follow) {
      g.guide.x = T.pos.x;
      g.guide.z = T.pos.z;
    }
    const d = Math.hypot(T.pos.x - car.pos.x, T.pos.z - car.pos.z);
    if (d < 130) {
      f.t += dt;
      f.lost = Math.max(0, f.lost - dt);
    } else {
      f.lost += dt;
      if (f.lost > 2 && r.t - f.warned > 8) {
        f.warned = r.t;
        this.say(pick(['داره دور میشه! تندتر! 😬', 'گمش نکنی‌ها!', 'کجا رفت؟! بجنب!']));
      }
    }
    if (d < 9) {
      f.close += dt;
      if (f.close > 2.5 && !f.spotted) {
        f.spotted = true;
        T.persona = 1.6;
        this.say('ای وای! خیلی نزدیک شدی، فهمید! داره در میره! 😱');
      }
    } else f.close = Math.max(0, f.close - dt);
    const lost = f.lost > 8;
    if (lost || f.t >= f.need) {
      f.done = true;
      r.o.dest = { x: car.pos.x, z: car.pos.z, nx: 0, nz: 0, name: 'همینجا', region: 'city' };
      this.beacon.visible = true;
      this.beacon.position.set(car.pos.x, g.world.heightAt(car.pos.x, car.pos.z), car.pos.z);
      this.beacon.userData.beamMat.color.setHex(0x34e07a);
      this.beacon.userData.ringMat.color.setHex(0x34e07a);
      g.clearGuide();
      if (lost) this.say('گمش کردی! 😤 بی‌خیال... همینجا نگه دار پیاده شم.');
      else {
        this.say('ایول! دیدم کجا رفت! 🕵️✨ کارمون تموم شد، همینجا نگه دار.');
        g.addXp(60);
      }
    }
  }
  /** after the chase the target drives off and disappears */
  updateTargetLeaving(dt) {
    const T = this.target;
    if (!T || !T.active) return;
    T.update(dt, this.game.time);
    this.targetT += dt;
    if (this.targetT > 25) T.deactivate();
  }
  statusText() {
    const r = this.ride;
    if (this.state === 'toPickup') return `🧍 برو دنبال ${r.o.name}`;
    if (this.state === 'boarding') return '🚪 مسافر داره سوار میشه...';
    if (this.state === 'toDest' && r.follow && !r.follow.done) {
      const f = r.follow, T = this.target, car = this.game.player;
      const d = T ? Math.hypot(T.pos.x - car.pos.x, T.pos.z - car.pos.z) : 0;
      return `🕵️ تعقیب ${fa(Math.min(99, Math.floor((f.t / f.need) * 100)))}٪ • فاصله ${fa(Math.round(d))} متر${d > 130 ? ' • ⚠️ داره گمت می‌کنه!' : d < 9 ? ' • ⚠️ خیلی نزدیکی!' : ''}`;
    }
    if (this.state === 'toDest' && r.follow) return '🛑 همینجا نگه دار تا مسافر پیاده شه';
    if (this.state === 'toDest' && r.o.kind === 'tour') return `📸 ${r.o.name} • جای ${fa(r.stop + 1)} از ${fa(r.o.stops.length)} ← ${r.o.dest.name}${r.photoT > 0 ? ' • داره عکس می‌گیره...' : ''}`;
    if (this.state === 'toDest' && r.o.kind === 'robber') {
      const hot = this.game.police.state === 'chase' || this.game.police.state === 'dispatch';
      return `🕶️ ${r.o.name} ← مخفیگاه${hot ? ' • 🚨 اول پلیس رو گم کن!' : ''}`;
    }
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
