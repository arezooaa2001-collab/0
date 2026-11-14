import * as THREE from 'three';
import { buildCar } from './models.js';
import { TrafficCar } from './traffic.js';
import { fa, faMoney, pick } from './util.js';

const $ = (id) => document.getElementById(id);
const CROOKS = [
  ['اکبر جیب‌بر', '💼', 0x263238, 'sedan', 250000],
  ['باند سارقین طلا', '💰', 0x111111, 'sport', 450000],
  ['قاچاقچی گوشی', '📱', 0x4e342e, 'van', 300000],
  ['رضا دنده‌عقب', '🦹', 0x1a237e, 'hatch', 280000],
  ['سلطان تصادف', '💀', 0x7b1fa2, 'sport', 600000],
];
const TIME = 100;

/** Bounty hunting: a wanted car flees through the city and you ram it until it gives up. */
export class Bounty {
  constructor(game) {
    this.g = game;
    this.state = 'idle';
    this.cars = {};
  }
  car(type, color) {
    const key = type + color;
    if (!this.cars[key]) {
      const root = buildCar({ type, color }).root;
      // a red light flashing on the dash so you can spot it in traffic
      const m = new THREE.MeshBasicMaterial({ color: 0xff1744 });
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), m);
      beacon.position.set(0, type === 'van' ? 2.2 : 1.62, 0);
      root.add(beacon);
      const c = new TrafficCar(this.g.traffic, root);
      c.isFugitive = true;
      c.isEmergency = true;
      c.beaconMat = m;
      this.cars[key] = c;
    }
    return this.cars[key];
  }
  canStart() {
    const g = this.g;
    if (this.state !== 'idle') return false;
    if (g.rides.ride) return g.ui.toast('اول مسافرت رو برسون 🧳', 'warn'), false;
    if (g.race.state !== 'idle' || g.crazy.state !== 'idle' || g.parking.state !== 'idle' || g.drag.state !== 'idle' || g.events.job) return g.ui.toast('اول کار فعلیت رو تموم کن', 'warn'), false;
    if (g.police.state !== 'none') return g.ui.toast('خودت تحت تعقیبی! 🚨', 'warn'), false;
    if (g.onfoot.active || g.onfoot.busy || g.player.burning || g.player.health <= 10) return g.ui.toast('ماشینت آماده نیست', 'warn'), false;
    if (g.time < (this.nextT || 0)) return g.ui.toast(`🎯 پرونده بعدی ${fa(Math.ceil(this.nextT - g.time))} ثانیه دیگه آماده میشه`, 'warn'), false;
    return true;
  }
  /** the wanted list (police station or the phone) */
  boardHtml() {
    const s = this.g.stats;
    if (this.state !== 'idle') return `<p class="note">🎯 الان دنبال ${this.crook[1]} ${this.crook[0]} هستی!</p>`;
    this.list = this.list && this.listT > this.g.time ? this.list : this.pickList();
    return `<p class="note">مجرم فرار می‌کنه؛ اونقدر بهش بکوب تا ماشینش از کار بیفته! ${fa(TIME)} ثانیه وقت داری. پلیس بابت این کار جریمه‌ت نمی‌کنه 😉</p>
      <div class="statrow"><span>🎯 شکارها: ${fa(s.bounties || 0)}</span><span>💰 جایزه‌ها: ${faMoney(s.bountyCash || 0)}</span></div>
      <div class="opps">${this.list.map((c, i) => `<div class="card"><h3>${c[1]} ${c[0]}</h3><p>جایزه: ${faMoney(c[4])} + 🪙${fa(Math.round(c[4] / 50000))}</p><button data-bounty="${i}">شروع شکار 🎯</button></div>`).join('')}</div>`;
  }
  pickList() {
    this.listT = this.g.time + 180;
    const pool = CROOKS.slice(), out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  }
  bind(el) {
    el.querySelectorAll('[data-bounty]').forEach((b) => (b.onclick = () => {
      const c = this.list[+b.dataset.bounty];
      if (!this.canStart()) return;
      this.g.ui.closePanel();
      this.start(c);
    }));
  }
  start(crook) {
    const g = this.g, w = g.world, p = g.player;
    // a road 120-260 m away, preferably in front of you
    let spot = null;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    for (let k = 0; k < 40 && !spot; k++) {
      const a = Math.atan2(fx, fz) + (Math.random() - 0.5) * 2.2, d = 120 + Math.random() * 140;
      const ne = w.nearestEdge(p.pos.x + Math.sin(a) * d, p.pos.z + Math.cos(a) * d);
      if (!ne || ne.edge.len < 40) continue;
      const dd = Math.hypot(ne.x - p.pos.x, ne.z - p.pos.z);
      if (dd > 100 && dd < 300) spot = ne;
    }
    if (!spot) return g.ui.toast('🎯 مجرم رو گم کردیم! یه جای دیگه امتحان کن', 'warn');
    if (g.rides.state === 'offer') g.rides.decline();
    const c = this.car(crook[3], crook[2]);
    const e = spot.edge;
    // drive away from the player along that road
    const towardB = (g.world.graph.nodes[e.b].x - p.pos.x) ** 2 + (g.world.graph.nodes[e.b].z - p.pos.z) ** 2 > (g.world.graph.nodes[e.a].x - p.pos.x) ** 2 + (g.world.graph.nodes[e.a].z - p.pos.z) ** 2;
    c.spawnOn(e.id, towardB ? e.a : e.b, towardB ? spot.t : 1 - spot.t);
    c.fleeFrom = p.pos;
    c.persona = e.road.type === 'city' ? 1.75 : 1.45;
    c.speed = 12;
    this.fug = c;
    this.crook = crook;
    this.hp = 100;
    this.time = TIME;
    this.farT = 0;
    this.hitT = 0;
    this.state = 'chase';
    g.rides.cooldown = Math.max(g.rides.cooldown, 20);
    $('bountyHud').classList.remove('hidden');
    g.ui.say('🚓 بی‌سیم پلیس', `${crook[1]} ${crook[0]} داره فرار می‌کنه! نذار در بره! 🎯`);
    g.audio.tone(700, 0.2, 0.12, 'square');
    g.audio.tone(900, 0.2, 0.12, 'square', 0.25);
  }
  /** called by TrafficCar.hit when anything rams the fugitive */
  onHit(impact, by) {
    const g = this.g;
    if (this.state !== 'chase' || by !== g.player || impact < 2.5 || this.hitT > 0) return;
    this.hitT = 0.5;
    const dmg = Math.min(45, impact * 3.2 + (g.player.nitroOn ? 8 : 0));
    this.hp = Math.max(0, this.hp - dmg);
    g.shake = Math.max(g.shake || 0, 0.5);
    g.audio.burst(0.2, 500, 'lowpass', 0.6);
    const f = this.fug;
    for (let i = 0; i < 12; i++) g.fx.spark.emit(f.pos.x, f.group.position.y + 0.6, f.pos.z, (Math.random() - 0.5) * 8, Math.random() * 5, (Math.random() - 0.5) * 8, 0.5, 0.25, 1, 1);
    if (this.hp <= 0) this.takedown();
    else g.ui.toast(`💥 خورد! سلامت ماشین مجرم: ${fa(Math.round(this.hp))}٪`, 'good');
  }
  takedown() {
    const g = this.g, s = g.stats, c = this.crook, f = this.fug;
    this.state = 'done';
    this.doneT = 0;
    f.state = 'parked';
    f.speed = 0;
    f.spin = 1.2;
    const pay = c[4] + Math.round(this.time) * 2000;
    const coins = Math.round(c[4] / 50000);
    g.money += pay;
    g.coins += coins;
    s.bounties = (s.bounties || 0) + 1;
    s.bountyCash = (s.bountyCash || 0) + pay;
    s.earned = (s.earned || 0) + pay;
    s.today = (s.today || 0) + pay;
    g.addXp(80);
    g.audio.cash();
    g.ui.achievement('🎯', `${c[1]} ${c[0]} رو گرفتی! +${faMoney(pay)}`, coins, '🚔 شکار موفق');
    g.slowmo = 0.3;
    g.replay.offer();
    $('bountyHud').classList.add('hidden');
    g.save();
  }
  end(msg) {
    const g = this.g;
    if (this.state === 'idle') return;
    this.state = 'idle';
    this.nextT = g.time + 40;
    if (this.fug) {
      this.fug.fleeFrom = null;
      this.fug.deactivate();
    }
    $('bountyHud').classList.add('hidden');
    if (msg) {
      g.ui.toast(msg, 'warn');
      g.audio.bad();
    }
  }
  update(dt) {
    const g = this.g, f = this.fug, p = g.player;
    if (this.state === 'idle' || !f) return;
    f.update(dt, g.time);
    const ph = Math.floor(g.time * 5) % 2;
    f.beaconMat.color.setHex(ph ? 0xff1744 : 0x2962ff);
    if (this.state === 'done') {
      // smoke from the wreck, then it's towed away
      this.doneT += dt;
      if (Math.random() < 0.5) g.fx.smoke.emit(f.pos.x, f.group.position.y + 1.2, f.pos.z, (Math.random() - 0.5) * 0.5, 1.5, (Math.random() - 0.5) * 0.5, 2, 0.7, 4, 0.5);
      if (this.doneT > 12 || Math.hypot(f.pos.x - p.pos.x, f.pos.z - p.pos.z) > 300) {
        this.state = 'chase';
        this.end();
      }
      return;
    }
    if (g.state === 'jail' || g.police.state === 'chase' || g.police.state === 'arrest') return this.end('🚨 شکار لغو شد');
    if (g.onfoot.active || p.burning || p.health <= 0) return this.end('🎯 مجرم فرار کرد...');
    if (g.state !== 'play') return;
    g.rides.cooldown = Math.max(g.rides.cooldown, 5);
    this.time -= dt;
    this.hitT -= dt;
    const d = Math.hypot(f.pos.x - p.pos.x, f.pos.z - p.pos.z);
    this.farT = d > 330 ? this.farT + dt : 0;
    if (this.farT > 6) return this.end(`🎯 ${this.crook[0]} از دستت فرار کرد!`);
    if (this.time <= 0) return this.end('⏱ وقت تموم شد؛ مجرم فرار کرد');
    if (d > 420) return this.end(`🎯 ${this.crook[0]} از دستت فرار کرد!`);
    const hud = $('bountyHud');
    const html = `<b>${this.crook[1]} ${this.crook[0]}</b><div class="bhp"><i style="width:${this.hp}%"></i></div><span>⏱ ${fa(Math.ceil(this.time))}</span><span>📏 ${fa(Math.round(d))} م</span>`;
    if (html !== this.hudText) hud.innerHTML = this.hudText = html;
    hud.classList.toggle('far', this.farT > 0);
  }
  mapIcon() {
    return this.state === 'chase' && this.fug ? { x: this.fug.pos.x, z: this.fug.pos.z, col: '#d50000', txt: '🎯' } : null;
  }
}
void pick;
