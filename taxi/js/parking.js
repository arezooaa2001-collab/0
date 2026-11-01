import * as THREE from 'three';
import { boxCol, fa, faMoney, mulberry32 } from './util.js';

const $ = (id) => document.getElementById(id);
const TIME = 45;

/** Parking challenge: slot the taxi into a marked bay between parked cars, against the clock. */
export class Parking {
  constructor(game) {
    this.g = game;
    this.state = 'idle';
    const w = game.world, L = w.lot;
    const rnd = mulberry32(5150);
    this.bays = w.lotBays();
    // fill most bays with parked cars; a handful stay empty for the challenge
    const empty = new Set();
    while (empty.size < 7) empty.add(1 + Math.floor(rnd() * 22));
    this.empty = [];
    const tpls = game.traffic.templates;
    for (const b of this.bays) {
      if (empty.has(this.bays.indexOf(b))) {
        this.empty.push(b);
        continue;
      }
      const car = tpls[Math.floor(rnd() * tpls.length)].clone();
      const facingIn = rnd() < 0.7;
      // heading along z: row -1 bays open toward +z
      const h = b.row < 0 ? (facingIn ? Math.PI : 0) : facingIn ? 0 : Math.PI;
      const x = b.x + (rnd() - 0.5) * 0.3, z = b.z + (rnd() - 0.5) * 0.3;
      car.position.set(x, w.heightAt(x, z), z);
      car.rotation.y = h + (rnd() - 0.5) * 0.06;
      game.scene.add(car);
      w.statics.insert(boxCol(x, z, 0.95, 2.3, h));
    }
    // start pad at the east end of the aisle
    this.spot = { kind: 'parking', padX: L.x + L.w / 2 - 2, padZ: L.z, name: 'چالش پارک' };
    const sign = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.5 }));
    pole.position.y = 1.7;
    sign.add(pole);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = '#1565c0';
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = '#fff';
    c.lineWidth = 8;
    c.strokeRect(6, 6, 116, 116);
    c.fillStyle = '#fff';
    c.font = 'bold 96px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('P', 64, 70);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 0.08), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.4 }));
    board.position.y = 3.6;
    board.rotation.y = Math.PI / 2;
    sign.add(board);
    sign.position.set(this.spot.padX + 3, w.heightAt(this.spot.padX + 3, L.z + 8), L.z + 8);
    game.scene.add(sign);
    // the target bay outline
    this.mark = new THREE.Group();
    this.markMat = new THREE.MeshBasicMaterial({ color: 0xffd21a, transparent: true, opacity: 0.9, fog: false });
    this.fillMat = new THREE.MeshBasicMaterial({ color: 0xffd21a, transparent: true, opacity: 0.18, depthWrite: false, fog: false });
    for (const [sx, sz, wx, wz] of [[0, -2.8, 3, 0.16], [0, 2.8, 3, 0.16], [-1.5, 0, 0.16, 5.6], [1.5, 0, 0.16, 5.6]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(wx, 0.06, wz), this.markMat);
      m.position.set(sx, 0.08, sz);
      this.mark.add(m);
    }
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(3, 5.6), this.fillMat);
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = 0.07;
    this.mark.add(fill);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 12), this.markMat);
    arrow.rotation.x = Math.PI;
    arrow.position.y = 2.6;
    this.mark.add(arrow);
    this.arrow = arrow;
    this.mark.visible = false;
    game.scene.add(this.mark);
  }
  canStart() {
    const g = this.g;
    if (this.state !== 'idle' || g.race.state !== 'idle' || g.crazy.state !== 'idle') return false;
    if (g.rides.ride) return g.ui.toast('اول سفر مسافرت رو تموم کن 🧳', 'warn'), false;
    if (g.police.state !== 'none') return g.ui.toast('با پلیس پشت سرت؟! 🚨', 'warn'), false;
    if (g.player.burning || g.onfoot.active || g.onfoot.busy) return false;
    return true;
  }
  offer() {
    const g = this.g, s = g.stats;
    if (!this.canStart()) return;
    g.ui.panel(`<h2>🅿️ چالش پارک</h2>
      <div class="raceoffer"><p class="prize">${fa(TIME)} ثانیه وقت داری تاکسی رو توی جای پارک مشخص‌شده بذاری!</p>
      <p class="note">باید ماشین کامل توی خط‌ها باشه و وایسی. به ماشین‌های پارک‌شده نزن (۳ بار بزنی باختی). اگه دنده‌عقب پارک کنی (دماغ ماشین رو به بیرون) جایزه بیشتری داره 😎</p>
      <div class="statrow"><span>🅿️ پارک‌های موفق: ${fa(s.parks || 0)}</span><span>⏱ بهترین زمان: ${s.bestPark ? fa(s.bestPark.toFixed(1)).replace('.', '٫') + ' ثانیه' : '—'}</span></div>
      <div class="btnrow"><button data-a="go">شروع! 🅿️</button><button data-a="no" class="ghost">بی‌خیال</button></div></div>`, (el) => {
      el.querySelector('[data-a=go]').onclick = () => {
        g.ui.closePanel();
        if (this.canStart()) this.start();
      };
      el.querySelector('[data-a=no]').onclick = () => g.ui.closePanel();
    });
  }
  start() {
    const g = this.g, w = g.world, L = w.lot;
    if (g.rides.state === 'offer') g.rides.decline();
    this.state = 'run';
    this.time = TIME;
    this.bumps = 0;
    this.bumpT = 0;
    this.holdT = 0;
    // a bay away from the entrance
    const far = this.empty.filter((b) => b.x < L.x + 12);
    this.bay = far[Math.floor(Math.random() * far.length)] || this.empty[0];
    this.mark.position.set(this.bay.x, w.heightAt(this.bay.x, this.bay.z), this.bay.z);
    this.mark.visible = true;
    g.player.placeAt(L.x + L.w / 2 - 2, L.z, -Math.PI / 2);
    g.player.speed = 0;
    if (g.guide && g.guide.custom) g.clearGuide();
    this.prevGuide = g.guideOn;
    g.setGuide({ x: this.bay.x, z: this.bay.z, label: '🅿️ جای پارک', addr: 'دقیق بین خط‌ها وایسا', direct: true });
    g.rides.cooldown = Math.max(g.rides.cooldown, 10);
    $('parkHud').classList.remove('hidden');
    g.audio.tone(660, 0.15, 0.15, 'square');
  }
  end(ok, reason) {
    const g = this.g, s = g.stats;
    if (this.state !== 'run') return;
    this.state = 'idle';
    this.mark.visible = false;
    $('parkHud').classList.add('hidden');
    g.guideOn = this.prevGuide;
    if (!g.rides.ride) g.clearGuide();
    if (!ok) {
      g.audio.bad();
      if (reason) g.ui.toast(reason, 'warn');
      return;
    }
    const used = TIME - this.time;
    const p = g.player, fz = Math.cos(p.heading);
    const reversed = this.bay.row < 0 ? fz > 0 : fz < 0;
    let pay = Math.max(15000, 40000 + Math.round(this.time) * 1500 - this.bumps * 15000);
    if (reversed) pay += 30000;
    pay = Math.round(pay / 1000) * 1000;
    g.money += pay;
    s.parks = (s.parks || 0) + 1;
    if (!this.bumps) s.cleanParks = (s.cleanParks || 0) + 1;
    const record = !s.bestPark || used < s.bestPark;
    if (record) s.bestPark = +used.toFixed(1);
    g.addXp(40 + (reversed ? 20 : 0));
    g.audio.cash();
    g.stunts.banner(`🅿️ ${reversed ? 'دنده‌عقب حرفه‌ای! ' : ''}پارک شد! ${fa(used.toFixed(1)).replace('.', '٫')} ثانیه • +${faMoney(pay)}${record ? ' • رکورد! 🏆' : ''}`);
    g.save();
  }
  update(dt) {
    const g = this.g, p = g.player;
    if (this.state !== 'run') return;
    if (g.state === 'jail' || g.police.state === 'chase' || g.police.state === 'arrest') return this.end(false, '🚨 چالش پارک لغو شد');
    if (g.onfoot.active || g.onfoot.busy) return this.end(false, 'از ماشین پیاده شدی؛ چالش پارک لغو شد');
    if (p.burning) return this.end(false, 'ماشین آتیش گرفت! 🔥');
    if (g.state !== 'play') return;
    this.time -= dt;
    g.rides.cooldown = Math.max(g.rides.cooldown, 5);
    this.bumpT -= dt;
    if (this.bumpT <= 0 && p.events.some((e) => e.type === 'crash' && e.impact > 1.2)) {
      this.bumpT = 0.8;
      this.bumps++;
      g.ui.toast(`💥 زدی! (${fa(this.bumps)} از ۳)`, 'bad');
      if (this.bumps >= 3) return this.end(false, '💥 سه بار زدی! چالش پارک رو باختی');
    }
    // is the whole car inside the lines?
    const b = this.bay, P = p.car.P;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    let inside = true;
    for (const [a, c] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const cx = p.pos.x + fx * (P.len / 2) * a + fz * P.W * c, cz = p.pos.z + fz * (P.len / 2) * a - fx * P.W * c;
      if (Math.abs(cx - b.x) > b.hw + 0.2 || Math.abs(cz - b.z) > b.hd + 0.25) inside = false;
    }
    const still = (p.groundSpeed ?? Math.abs(p.speed)) < 0.4;
    this.holdT = inside && still ? this.holdT + dt : 0;
    const col = inside ? 0x39e07a : 0xffd21a;
    this.markMat.color.setHex(col);
    this.fillMat.color.setHex(col);
    this.fillMat.opacity = inside ? 0.3 : 0.15 + Math.sin(g.time * 5) * 0.06;
    this.arrow.position.y = 2.6 + Math.sin(g.time * 4) * 0.25;
    this.arrow.visible = !inside;
    const hud = $('parkHud');
    hud.className = this.time < 10 ? 'low' : '';
    hud.innerHTML = `<b>🅿️ ⏱ ${fa(Math.max(0, Math.ceil(this.time)))}</b><span>💥 ${fa(this.bumps)}/۳</span><span>${inside ? (still ? '✅ نگه دار...' : '🛑 وایسا!') : '↔️ برو توی خط‌ها'}</span>`;
    if (this.holdT > 1) return this.end(true);
    if (this.time <= 0) this.end(false, '⏱ وقت تموم شد! پارک نشد');
  }
}
