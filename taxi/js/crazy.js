import { Walker } from './people.js';
import { buildBeacon } from './models.js';
import { fa, faMoney, faDist, pick } from './util.js';

const $ = (id) => document.getElementById(id);
const START_TIME = 60;
const RING = { g: 0x39e07a, y: 0xffd23a, r: 0xff4040 };
const HI = ['سلام! سریع برو', 'زود باش! دیرم شده', 'بزن بریم داداش!', 'گازشو بگیر!', 'عجله دارم، پرواز کن!'];
const FAST = ['واااای! عالی بود! 🤩', 'ایول! چه سریع! 😎', 'تو دیگه کی هستی؟! 🔥'];
const SLOW = ['رسیدیم بالاخره...', 'یه کم دیر شد ولی باشه'];

/** "Crazy taxi": a timed rush. Grab nearby passengers, drop them off fast, earn extra seconds. */
export class Crazy {
  constructor(game) {
    this.g = game;
    this.state = 'idle';
    const w = game.world;
    const ne = w.nearestEdge(-200, 100, (e) => e.road.type === 'city');
    const rs = w.roadside(ne, 1, 12);
    this.spot = { kind: 'crazy', padX: rs.x, padZ: rs.z, name: 'تاکسی دیوانه' };
    this.beacon = buildBeacon(0xff6a00);
    this.beacon.position.set(rs.x, w.heightAt(rs.x, rs.z), rs.z);
    this.beacon.children[0].scale.y = 0.35;
    game.scene.add(this.beacon);
    // where the current passenger wants to go
    this.destBeacon = buildBeacon(0x39e07a);
    this.destBeacon.visible = false;
    game.scene.add(this.destBeacon);
    this.waiting = [];
    this.ride = null;
  }
  canStart() {
    const g = this.g;
    if (this.state !== 'idle') return false;
    if (g.rides.ride) return g.ui.toast('اول سفر مسافرت رو تموم کن 🧳', 'warn'), false;
    if (g.race.state !== 'idle' || g.parking.state !== 'idle') return false;
    if (g.police.state !== 'none') return g.ui.toast('با پلیس پشت سرت؟! اول گمشون کن 🚨', 'warn'), false;
    if (g.player.burning || g.onfoot.active) return false;
    return true;
  }
  offer() {
    const g = this.g, best = g.stats.crazyBest || 0;
    if (!this.canStart()) return;
    g.ui.panel(`<h2>🔥 تاکسی دیوانه</h2>
      <div class="raceoffer"><p class="prize">${fa(START_TIME)} ثانیه وقت داری! هر چی مسافر می‌تونی برسون 🚕💨</p>
      <p class="note">🟢 سفر کوتاه • 🟡 متوسط • 🔴 دور. کنار مسافر ترمز کن تا بپره بالا، جلوی مقصد ترمز کن تا بپره پایین. هر مسافر که برسونی وقت اضافه می‌گیری؛ اگه سریع برسونی بیشتر! پرش، دریفت و «نزدیک بود!» وسط سفر انعام دارن.</p>
      <div class="statrow"><span>🏆 رکورد: ${faMoney(best)} تومان</span><span>🎟️ ورودی: رایگان</span></div>
      <div class="btnrow"><button data-a="go">شروع کن! 🔥</button><button data-a="no" class="ghost">بی‌خیال</button></div></div>`, (el) => {
      el.querySelector('[data-a=go]').onclick = () => {
        g.ui.closePanel();
        if (this.canStart()) this.start();
      };
      el.querySelector('[data-a=no]').onclick = () => g.ui.closePanel();
    });
  }
  start() {
    const g = this.g;
    if (g.rides.state === 'offer') g.rides.decline();
    this.state = 'run';
    this.time = START_TIME;
    this.earned = 0;
    this.count = 0;
    this.spawnT = 0;
    if (g.guide && g.guide.custom) g.clearGuide();
    this.prevGuide = g.guideOn;
    g.guideOn = true;
    $('crazyHud').classList.remove('hidden');
    g.ui.toast('🔥 تاکسی دیوانه شروع شد! برو دنبال مسافرها!', 'good');
    g.audio.tone(523, 0.15, 0.2, 'square');
    g.audio.tone(784, 0.3, 0.2, 'square', 0.15);
    for (let i = 0; i < 3; i++) this.spawn();
  }
  spawn() {
    const g = this.g, w = g.world, p = g.player.pos;
    if (this.waiting.length >= 4) return;
    const at = w.randomRoadside(p, 50, 260, true);
    if (!at) return;
    // where they want to go: a landmark or a street address in the city
    let dest;
    for (let k = 0; k < 10 && !dest; k++) {
      if (Math.random() < 0.5) {
        const pl = pick(w.places.filter((q) => q.region === 'city'));
        if (pl && Math.hypot(pl.x - at.x, pl.z - at.z) > 220) dest = { x: pl.x, z: pl.z, name: pl.name };
      } else {
        const r = w.randomRoadside(at, 220, 950, true);
        if (r) dest = { x: r.x, z: r.z, name: w.addressOf(r.roadX, r.roadZ) };
      }
    }
    if (!dest) return;
    const len = w.routeLength(w.route(at.x, at.z, dest.x, dest.z));
    const col = len < 450 ? 'g' : len < 750 ? 'y' : 'r';
    const walker = new Walker(g.scene, { female: Math.random() < 0.5 });
    walker.setPos(at.x, at.z, Math.atan2(-at.nx, -at.nz));
    const beacon = buildBeacon(RING[col]);
    beacon.children[0].scale.y = 0.2;
    beacon.position.set(at.x, w.heightAt(at.x, at.z), at.z);
    g.scene.add(beacon);
    this.waiting.push({ walker, beacon, at, dest, len, col, fare: Math.round((15000 + len * 45) / 1000) * 1000, limit: Math.round(len / 15 + 12) });
  }
  removeWaiting(c) {
    c.walker.dispose();
    this.g.scene.remove(c.beacon);
    this.waiting = this.waiting.filter((x) => x !== c);
  }
  /** stunt bonus while a passenger is aboard */
  tip(amount, label) {
    if (this.state !== 'run' || !this.ride) return;
    this.ride.tips += amount;
    this.g.ui.toast(`🔥 ${label} انعام +${faMoney(amount)}`, 'good');
  }
  end(reason) {
    const g = this.g, s = g.stats;
    if (this.state !== 'run') return;
    this.state = 'idle';
    if (this.ride) this.dropOff(false, true);
    for (const c of this.waiting.slice()) this.removeWaiting(c);
    $('crazyHud').classList.add('hidden');
    g.guideOn = this.prevGuide;
    if (!g.rides.ride) g.clearGuide();
    g.rides.cooldown = Math.max(g.rides.cooldown, 10);
    s.crazyRuns = (s.crazyRuns || 0) + 1;
    const record = this.earned > (s.crazyBest || 0);
    if (record) s.crazyBest = this.earned;
    g.addXp(this.count * 15);
    g.audio.tone(392, 0.2, 0.2, 'square');
    g.audio.tone(330, 0.4, 0.2, 'square', 0.2);
    if (reason) g.ui.toast(reason, 'warn');
    g.ui.panel(`<h2>🔥 تاکسی دیوانه تموم شد!</h2>
      <div class="raceoffer"><div class="rv">${record ? '🏆' : '🚕'}<b>${faMoney(this.earned)} تومان</b><small>${record ? 'رکورد جدید!! 🎉' : `رکورد: ${faMoney(s.crazyBest || 0)} تومان`}</small></div>
      <div class="statrow"><span>🧍 ${fa(this.count)} مسافر رسوندی</span></div>
      <div class="btnrow"><button data-a="again">یه دور دیگه! 🔥</button><button data-a="no" class="ghost">بستن</button></div></div>`, (el) => {
      el.querySelector('[data-a=again]').onclick = () => {
        g.ui.closePanel();
        if (this.canStart()) this.start();
      };
      el.querySelector('[data-a=no]').onclick = () => g.ui.closePanel();
    });
    if (record && this.earned > 0) g.fireworks.show(g.player.pos.x + Math.sin(g.player.heading) * 160, g.player.pos.z + Math.cos(g.player.heading) * 160, 7);
    g.save();
  }
  pickUp(c) {
    const g = this.g, p = g.player;
    this.removeWaitingOnly(c);
    const side = Math.random() < 0.5 ? 'rearL' : 'rearR';
    c.walker.sitIn(p.group, p.car.seats[side].clone(), 0);
    p.occupied = true;
    g.audio.door();
    this.ride = { ...c, t: 0, tips: 0 };
    this.destBeacon.position.set(c.dest.x, g.world.heightAt(c.dest.x, c.dest.z), c.dest.z);
    this.destBeacon.visible = true;
    g.setGuide({ x: c.dest.x, z: c.dest.z, label: c.dest.name, addr: faDist(c.len) });
    g.ui.say('مسافر', `${pick(HI)}! ${c.dest.name} 🏁`, { mood: 'hurry' });
    g.audio.speak(pick(HI));
  }
  removeWaitingOnly(c) {
    this.g.scene.remove(c.beacon);
    this.waiting = this.waiting.filter((x) => x !== c);
  }
  dropOff(ok, silent = false) {
    const g = this.g, p = g.player, r = this.ride;
    this.ride = null;
    this.destBeacon.visible = false;
    p.occupied = false;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    r.walker.standOut(p.pos.x + fz * 2, p.pos.z - fx * 2, p.heading);
    r.walker.walkTo(p.pos.x + fz * 6, p.pos.z - fx * 6, 1.6, () => r.walker.dispose());
    this.leaving = this.leaving || [];
    this.leaving.push(r.walker);
    g.audio.door();
    if (!ok) {
      if (!silent) g.ui.say('مسافر', 'دیر شد! همینجا پیاده میشم 😤', { mood: 'grumpy' });
      return;
    }
    const fast = r.t < r.limit * 0.6;
    const pay = r.fare + r.tips + (fast ? Math.round(r.fare * 0.5 / 1000) * 1000 : 0);
    const bonus = fast ? 12 : 7;
    g.money += pay;
    this.earned += pay;
    this.count++;
    this.time += bonus;
    g.audio.cash();
    g.ui.say('مسافر', pick(fast ? FAST : SLOW), { mood: fast ? 'chatty' : 'normal' });
    g.stunts.pop(`⏱ +${fa(bonus)} ثانیه • +${faMoney(pay)}`);
    g.clearGuide();
  }
  update(dt) {
    const g = this.g, p = g.player;
    this.beacon.visible = this.state === 'idle';
    this.beacon.userData.ring.rotation.z += dt;
    this.destBeacon.userData.ring.rotation.z -= dt * 2;
    for (const w of (this.leaving || []).slice()) {
      w.update(dt, g.world);
      if (!w.root.parent) this.leaving = this.leaving.filter((x) => x !== w);
    }
    if (this.state !== 'run') return;
    if (g.state === 'jail' || g.police.state === 'chase' || g.police.state === 'arrest') return this.end('🚨 پلیس اومد! تاکسی دیوانه تموم شد');
    if (g.onfoot.active || g.onfoot.busy) return this.end('از ماشین پیاده شدی؛ دور تموم شد');
    if (p.burning) return this.end('ماشین آتیش گرفت! 🔥');
    if (g.state !== 'play') return;
    g.rides.cooldown = Math.max(g.rides.cooldown, 5);
    this.time -= dt;
    const sp = p.groundSpeed ?? Math.abs(p.speed);
    // waiting passengers
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 3;
      this.spawn();
    }
    let nearest = null, nd = Infinity;
    for (const c of this.waiting.slice()) {
      c.walker.update(dt, g.world);
      c.beacon.userData.ring.rotation.z += dt * 2;
      const d = Math.hypot(c.at.x - p.pos.x, c.at.z - p.pos.z);
      if (d > 420) {
        this.removeWaiting(c);
        continue;
      }
      c.walker.mode = d < 70 ? 'wave' : 'idle';
      if (d < 70) c.walker.lookAt(p.pos.x, p.pos.z);
      if (!this.ride && d < 10 && sp < 4) this.pickUp(c);
      else if (d < nd) {
        nd = d;
        nearest = c;
      }
    }
    if (!this.ride) {
      // the arrow points at the closest waiting passenger
      if (nearest && (!g.guide || g.guide.crazyTarget !== nearest)) g.setGuide({ x: nearest.at.x, z: nearest.at.z, label: '🧍 مسافر', addr: 'برو سوارش کن!', crazyTarget: nearest });
    } else {
      const r = this.ride;
      r.t += dt;
      const d = Math.hypot(r.dest.x - p.pos.x, r.dest.z - p.pos.z);
      if (d < 16 && sp < 4) this.dropOff(true);
      else if (r.t > r.limit) this.dropOff(false);
    }
    if (this.time <= 0) {
      this.time = 0;
      this.end();
      return;
    }
    const hud = $('crazyHud');
    const r = this.ride;
    hud.className = this.time < 10 ? 'low' : '';
    hud.innerHTML = `<b>⏱ ${fa(Math.ceil(this.time))}</b><span>💰 ${faMoney(this.earned)}</span><span>🧍 ${fa(this.count)}</span>${r ? `<span class="rt ${r.limit - r.t < 8 ? 'warn' : ''}">🚕 ${fa(Math.max(0, Math.ceil(r.limit - r.t)))} ث</span>` : ''}`;
    if (this.time < 10 && Math.ceil(this.time) !== this.lastBeep) {
      this.lastBeep = Math.ceil(this.time);
      g.audio.beep();
    }
  }
}
