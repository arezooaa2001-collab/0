import { fa, faMoney, faDist, clamp } from './util.js';
import { GEAR_LABEL } from './vehicle.js';
import { HALF, REGION_NAMES, regionAt } from './world.js';
import { MOODS } from './missions.js';

const $ = (id) => document.getElementById(id);
const STAR = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

export class UI {
  constructor(game) {
    this.g = game;
    this.keys = {};
    this.touch = { steer: 0, gas: 0, brake: 0, hand: false };
    this.tilt = 0;
    this.toastTimers = [];
    this.talkT = 0;
    this.resultT = 0;
    this.mm = $('minimap');
    this.mmCtx = this.mm.getContext('2d');
    this.coarse = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    document.body.classList.toggle('touch', this.coarse);
    this.bindControls();
    this.bindKeys();
  }

  /* ---------------- input ---------------- */
  bindControls() {
    const g = this.g;
    const zone = $('steerZone');
    const wheel = $('steerWheel');
    let sid = null, sx = 0, sy = 0, base = 0;
    zone.addEventListener('pointerdown', (e) => {
      sid = e.pointerId;
      sx = e.clientX;
      sy = e.clientY;
      base = this.touch.steer;
      zone.setPointerCapture(sid);
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== sid) return;
      const w = zone.clientWidth * 0.32 / (g.settings.sens || 1);
      this.touch.steer = clamp(base + (e.clientX - sx) / w, -1, 1);
      this.touch.jx = clamp((e.clientX - sx) / 60, -1, 1);
      this.touch.jy = clamp((sy - e.clientY) / 60, -1, 1);
    });
    const end = (e) => {
      if (e.pointerId !== sid) return;
      sid = null;
      this.touch.steer = 0;
      this.touch.jx = this.touch.jy = 0;
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
    this.wheelEl = wheel;
    this.steerHeld = () => sid !== null;
    this.releaseSteer = () => {
      sid = null;
      this.touch.steer = 0;
      this.touch.jx = this.touch.jy = 0;
    };

    const hold = (id, key, on = 1) => {
      const el = $(id);
      const set = (v) => (e) => {
        e.preventDefault();
        this.touch[key] = v ? on : key === 'hand' ? false : 0;
        el.classList.toggle('on', !!v);
        if (v) g.audio.init();
      };
      el.addEventListener('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        set(true)(e);
      });
      el.addEventListener('pointerup', set(false));
      el.addEventListener('pointercancel', set(false));
      el.addEventListener('lostpointercapture', set(false));
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    hold('btnGas', 'gas');
    hold('btnBrake', 'brake');
    hold('btnHand', 'hand', true);

    document.querySelectorAll('#gearbox [data-g]').forEach((b) => {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        g.player.requestGear(parseInt(b.dataset.g, 10));
      });
    });
    $('btnAuto').addEventListener('click', () => this.toggleAuto());
    $('btnCam').addEventListener('click', () => g.cycleCamera());
    $('btnDoor').addEventListener('click', () => g.onfoot.toggle());
    $('btnGuide').addEventListener('click', () => g.toggleGuide());
    $('btnLights').addEventListener('click', () => {
      g.player.lights = !g.player.lights;
      $('btnLights').classList.toggle('active', g.player.lights);
    });
    const horn = $('btnHorn');
    horn.addEventListener('pointerdown', (e) => { e.preventDefault(); g.audio.init(); g.audio.horn(true); g.honk(); });
    horn.addEventListener('pointerup', () => g.audio.horn(false));
    horn.addEventListener('pointercancel', () => g.audio.horn(false));
    $('btnMap').addEventListener('click', () => this.toggleBigMap());
    $('btnMenu').addEventListener('click', () => g.pause(true));
    $('bigmap').addEventListener('click', () => this.toggleBigMap(false));
    $('talkGuide').addEventListener('click', () => {
      g.guideOn = true;
      $('btnGuide').classList.add('active');
      this.toast('فلش راهنما روشن شد 🧭 دنبالش برو', 'info');
      $('talk').classList.add('hidden');
    });
    $('zoneBtn').addEventListener('click', () => g.zoneAction());
    $('jailSkip').addEventListener('click', () => (g.police.jail.speed = 4));

    // look around (drag on the 3D view)
    const gl = $('gl');
    let lid = null, lx = 0, ly = 0;
    gl.addEventListener('pointerdown', (e) => {
      lid = e.pointerId;
      lx = e.clientX;
      ly = e.clientY;
      gl.setPointerCapture(lid);
      g.lookActive = true;
    });
    gl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lid) return;
      g.lookYaw -= (e.clientX - lx) * 0.006;
      g.lookPitch = clamp(g.lookPitch - (e.clientY - ly) * 0.004, -0.6, 0.5);
      lx = e.clientX;
      ly = e.clientY;
      g.lookIdle = 0;
    });
    const lend = (e) => {
      if (e.pointerId !== lid) return;
      lid = null;
      g.lookActive = false;
    };
    gl.addEventListener('pointerup', lend);
    gl.addEventListener('pointercancel', lend);
    gl.addEventListener('dblclick', () => { g.lookYaw = 0; g.lookPitch = 0; });

    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return;
      const landscape = window.innerWidth > window.innerHeight;
      const ang = landscape ? (screen.orientation && screen.orientation.angle === 270 ? -e.beta : e.beta) : e.gamma;
      this.tilt = clamp(ang / 28, -1, 1);
    });
  }
  toggleAuto(v) {
    const p = this.g.player;
    p.auto = v === undefined ? !p.auto : v;
    $('btnAuto').textContent = p.auto ? 'خودکار' : 'دستی';
    $('btnAuto').classList.toggle('active', p.auto);
    this.g.settings.auto = p.auto;
    this.toast(p.auto ? 'گیربکس خودکار: راننده خودش دنده عوض می‌کنه' : 'گیربکس دستی: دنده رو خودت انتخاب کن', 'info');
  }
  bindKeys() {
    const g = this.g;
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      this.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      g.audio.init();
      const p = g.player;
      const map = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5, KeyR: -1, KeyN: 0, Numpad1: 1, Numpad2: 2, Numpad3: 3, Numpad4: 4, Numpad5: 5 };
      const dm = /^(Digit|Numpad)([0-9])$/.exec(e.code);
      if (dm) {
        const now = performance.now();
        if (now - (this.codeT || 0) > 2500) this.codeBuf = '';
        this.codeT = now;
        this.codeBuf = ((this.codeBuf || '') + dm[2]).slice(-4);
        if (this.codeBuf === '1818' || this.codeBuf === '1717') {
          const c = this.codeBuf;
          this.codeBuf = '';
          g.cheat(c);
        }
      }
      if (e.code === 'KeyV') g.onfoot.toggle();
      const walking = g.onfoot.active || g.onfoot.busy;
      if (e.code in map && g.state === 'play' && !walking) p.requestGear(map[e.code]);
      if (!walking && (e.code === 'KeyE' || e.code === 'ShiftLeft')) this.gearStep(1);
      if (!walking && (e.code === 'KeyQ' || e.code === 'ControlLeft')) this.gearStep(-1);
      if (e.code === 'KeyC') g.cycleCamera();
      if (e.code === 'KeyG') g.toggleGuide();
      if (e.code === 'KeyL') { p.lights = !p.lights; $('btnLights').classList.toggle('active', p.lights); }
      if (e.code === 'KeyH') { g.audio.horn(true); g.honk(); }
      if (e.code === 'KeyM') this.toggleBigMap();
      if (e.code === 'KeyT') this.toggleAuto();
      if (e.code === 'KeyF') g.zoneAction();
      if (e.code === 'KeyP' || e.code === 'Escape') g.pause(g.state !== 'pause');
      if (e.code === 'Enter' && this.offerCb) this.offerCb.accept();
      if (e.code === 'KeyY' && this.offerCb) this.offerCb.guide();
      if (e.code === 'Backspace' && this.offerCb) this.offerCb.decline();
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'KeyH') g.audio.horn(false);
    });
    window.addEventListener('blur', () => (this.keys = {}));
  }
  gearStep(dir) {
    const p = this.g.player;
    const t = p.targetGear;
    let n;
    if (dir > 0) n = t === -1 ? 0 : t === 0 ? 1 : Math.min(5, t + 1);
    else n = t === 1 ? 0 : t === 0 ? -1 : t === -1 ? -1 : t - 1;
    p.requestGear(n);
  }
  input() {
    const k = this.keys, t = this.touch;
    let steer = t.steer;
    if (k.ArrowLeft || k.KeyA) steer -= 1;
    if (k.ArrowRight || k.KeyD) steer += 1;
    if (this.g.settings.tilt && this.coarse) steer = this.tilt;
    let mx = t.jx || 0, my = t.jy || 0;
    if (k.ArrowLeft || k.KeyA) mx -= 1;
    if (k.ArrowRight || k.KeyD) mx += 1;
    if (k.ArrowUp || k.KeyW) my += 1;
    if (k.ArrowDown || k.KeyS) my -= 1;
    return {
      moveX: clamp(mx, -1, 1),
      moveY: clamp(my, -1, 1),
      run: !!(k.ShiftLeft || k.ShiftRight),
      steer: clamp(steer, -1, 1),
      gas: Math.max(t.gas, k.ArrowUp || k.KeyW ? 1 : 0),
      brake: Math.max(t.brake, k.ArrowDown || k.KeyS ? 1 : 0),
      handbrake: t.hand || !!k.Space,
    };
  }

  /* ---------------- HUD ---------------- */
  setHud(on) {
    $('hud').classList.toggle('off', !on);
  }
  update(dt) {
    const g = this.g, p = g.player;
    $('money').textContent = faMoney(g.money);
    $('coinPill').classList.toggle('hidden', !g.coins);
    $('coins').textContent = fa(g.coins);
    const tank = p.tank;
    $('fuelBar').style.width = (p.fuel / tank) * 100 + '%';
    $('superBar').style.width = (p.superFuel / tank) * 100 + '%';
    $('fuelBar').parentElement.parentElement.classList.toggle('low', p.fuelTotal() / tank < 0.15);
    $('fuelText').textContent = fa(Math.round(p.fuelTotal())) + 'L';
    $('healthBar').style.width = p.health + '%';
    $('healthBar').parentElement.parentElement.classList.toggle('low', p.health < 30);
    const h = Math.floor(g.hour), m = Math.floor((g.hour - h) * 60);
    $('clock').textContent = fa(String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
    $('day').textContent = fa(g.day);
    const avg = g.stats.trips ? g.stats.ratingSum / g.stats.trips : 5;
    $('stars').textContent = '★ ' + fa(avg.toFixed(1)).replace('.', '٫');
    const kmh = Math.round(Math.abs(p.speed) * 3.6);
    $('speed').textContent = fa(kmh);
    $('gearNow').textContent = GEAR_LABEL[p.gear] + (p.shift ? '…' : '');
    $('gearNow').classList.toggle('rev', p.gear === -1);
    $('rpmBar').style.width = clamp(p.rpm / 7000, 0, 1) * 100 + '%';
    $('rpmBar').classList.toggle('red', p.rpm > 6300);
    let hint = '';
    if (!p.auto && !p.shift) {
      if (p.gear === 0) hint = 'دنده خلاصه! یه دنده بزن';
      else if (p.rpm > 6400 && p.gear > 0 && p.gear < 5) hint = '⬆ دنده رو بالا ببر';
      else if (p.gear > 2 && p.rpm < 1700 && p.throttle > 0.5) hint = '⬇ دنده سنگینه، کم کن';
    }
    if (p.superRatio() > 0.25) hint = hint || '🚀 بنزین سوپر فعاله';
    $('shiftHint').textContent = hint;
    document.querySelectorAll('#gearbox [data-g]').forEach((b) => {
      const v = parseInt(b.dataset.g, 10);
      b.classList.toggle('cur', v === p.gear && !p.shift);
      b.classList.toggle('tgt', !!p.shift && v === p.targetGear);
    });
    // steering wheel graphic
    if (g.onfoot.active) {
      this.wheelEl.style.transform = `translate(${(this.touch.jx || 0) * 30}px, ${-(this.touch.jy || 0) * 30}px)`;
    } else {
      const st = this.coarse ? this.touch.steer : this.input().steer;
      this.wheelEl.style.transform = `rotate(${st * 110}deg)`;
    }
    $('btnDoor').classList.toggle('active', g.onfoot.active);
    // ride status
    $('status').textContent = g.rides.statusText();
    $('status').classList.toggle('hidden', !$('status').textContent);
    // guidance
    const gd = g.guide;
    const ge = $('guide');
    if (gd) {
      ge.classList.remove('hidden');
      $('guideTitle').textContent = gd.label;
      $('guideDist').textContent = faDist(g.guideDist || 0) + ' • ' + gd.addr;
      $('guideArrow').style.transform = `rotate(${(-g.guideRel * 180) / Math.PI}deg)`;
      $('guideArrow').classList.toggle('dim', !g.guideOn);
    } else ge.classList.add('hidden');
    $('btnGuide').classList.toggle('active', g.guideOn);
    // timers
    if (this.talkT > 0 && (this.talkT -= dt) <= 0) $('talk').classList.add('hidden');
    if (this.resultT > 0 && (this.resultT -= dt) <= 0) $('result').classList.add('hidden');
    this.mmT = (this.mmT || 0) - dt;
    if (this.mmT <= 0) {
      this.mmT = 0.08;
      this.drawMinimap();
      if (!$('bigmap').classList.contains('hidden')) this.drawBigMap();
    }
  }

  /* ---------------- minimap ---------------- */
  drawMinimap() {
    const g = this.g, w = g.world, p = g.focus();
    const c = this.mm, ctx = this.mmCtx, S = c.width;
    const k = w.minimapScale;
    const R = 230 + Math.abs(p.speed) * 4;
    const sc = S / 2 / R / k;
    ctx.save();
    ctx.clearRect(0, 0, S, S);
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#2a3a2a';
    ctx.fillRect(0, 0, S, S);
    ctx.translate(S / 2, S / 2);
    ctx.rotate(p.heading - Math.PI);
    ctx.scale(sc, sc);
    ctx.translate(-(p.pos.x + HALF) * k, -(p.pos.z + HALF) * k);
    ctx.drawImage(w.minimapBase, 0, 0);
    const P = (x, z) => [(x + HALF) * k, (z + HALF) * k];
    if (g.guide && g.guideOn && g.route && g.route.length) {
      ctx.strokeStyle = '#38e07e';
      ctx.lineWidth = 5 / sc;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(...P(p.pos.x, p.pos.z));
      for (const q of g.route) ctx.lineTo(...P(q.x, q.z));
      ctx.stroke();
    }
    const icon = (x, z, col, r, txt) => {
      const [X, Y] = P(x, z);
      ctx.save();
      ctx.translate(X, Y);
      ctx.rotate(-(p.heading - Math.PI));
      ctx.scale(1 / sc, 1 / sc);
      ctx.fillStyle = col;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (txt) {
        ctx.font = `${r * 1.3}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, 0, 1);
      }
      ctx.restore();
    };
    for (const s of w.stations) icon(s.padX, s.padZ, '#1f8a4c', 11, '⛽');
    for (const s of w.garages) icon(s.padX, s.padZ, '#d68910', 11, '🔧');
    icon(w.police.padX, w.police.padZ, '#1f4fa0', 11, '🚓');
    for (const c2 of g.traffic.cars) if (c2.active && c2.state === 'incident') icon(c2.pos.x, c2.pos.z, '#ff4040', 6);
    if (g.police.unit.active) icon(g.police.unit.pos.x, g.police.unit.pos.z, Math.floor(performance.now() / 200) % 2 ? '#ff3030' : '#3060ff', 9);
    if (g.guide) {
      // clamp target to minimap edge
      const dx = g.guide.x - p.pos.x, dz = g.guide.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      const lim = R * 0.88;
      const f = d > lim ? lim / d : 1;
      icon(p.pos.x + dx * f, p.pos.z + dz * f, g.rides.state === 'toDest' ? '#34e07a' : '#ffd23a', 12, g.rides.state === 'toDest' ? '🏁' : '🧍');
    }
    ctx.restore();
    // player arrow
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.fillStyle = '#ffd21a';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(11, 12);
    ctx.lineTo(0, 6);
    ctx.lineTo(-11, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    // north marker
    const na = -(p.heading - Math.PI) - Math.PI / 2;
    const nx = S / 2 + Math.cos(na + Math.PI) * (S / 2 - 16), ny = S / 2 + Math.sin(na + Math.PI) * (S / 2 - 16);
    ctx.fillStyle = '#ff5050';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny);
    if (g.player.car.screen.material.map) g.player.car.screen.material.map.needsUpdate = true;
    // region label
    $('region').textContent = REGION_NAMES[regionAt(p.pos.x, p.pos.z)];
  }
  toggleBigMap(v) {
    const el = $('bigmap');
    const show = v === undefined ? el.classList.contains('hidden') : v;
    el.classList.toggle('hidden', !show);
    if (show) this.drawBigMap();
  }
  drawBigMap() {
    const g = this.g, w = g.world, p = g.focus();
    const c = $('bigmapCanvas'), ctx = c.getContext('2d');
    const S = c.width;
    const k = (S / (HALF * 2));
    ctx.drawImage(w.minimapBase, 0, 0, S, S);
    const P = (x, z) => [(x + HALF) * k, (z + HALF) * k];
    if (g.route && g.guide) {
      ctx.strokeStyle = '#38e07e';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(...P(p.pos.x, p.pos.z));
      for (const q of g.route) ctx.lineTo(...P(q.x, q.z));
      ctx.stroke();
    }
    ctx.font = '13px Vazirmatn, Tahoma, sans-serif';
    ctx.textAlign = 'center';
    for (const pl of w.places) {
      const [X, Y] = P(pl.x, pl.z);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(X, Y, 3, 0, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      const tw = ctx.measureText(pl.name).width;
      ctx.fillRect(X - tw / 2 - 4, Y - 22, tw + 8, 16);
      ctx.fillStyle = '#fff';
      ctx.fillText(pl.name, X, Y - 10);
    }
    const dot = (x, z, col, txt, r = 9) => {
      const [X, Y] = P(x, z);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(X, Y, r, 0, 7);
      ctx.fill();
      ctx.font = `${r * 1.2}px sans-serif`;
      ctx.fillText(txt, X, Y + r * 0.45);
    };
    for (const s of w.stations) dot(s.padX, s.padZ, '#1f8a4c', '⛽');
    for (const s of w.garages) dot(s.padX, s.padZ, '#d68910', '🔧');
    dot(w.police.padX, w.police.padZ, '#1f4fa0', '🚓');
    if (g.guide) dot(g.guide.x, g.guide.z, '#ffd23a', g.rides.state === 'toDest' ? '🏁' : '🧍', 11);
    const [X, Y] = P(p.pos.x, p.pos.z);
    ctx.save();
    ctx.translate(X, Y);
    ctx.rotate(-p.heading + Math.PI);
    ctx.fillStyle = '#ffd21a';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(8, 9);
    ctx.lineTo(0, 4);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.font = 'bold 22px Vazirmatn, Tahoma, sans-serif';
    for (const [name, x, z] of [['جنگل', 0, -1500], ['کویر', 300, 1500], ['کوهستان و دریاچه', 1500, -300], ['روستا و مزرعه', -1450, 350], ['شهر', 0, -470]]) {
      const [a, b] = P(x, z);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(name, a + 1, b + 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(name, a, b);
    }
  }

  /* ---------------- messages ---------------- */
  toast(msg, kind = 'info') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    $('toasts').appendChild(el);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    setTimeout(() => el.classList.add('out'), 3600);
    setTimeout(() => el.remove(), 4200);
  }
  say(name, text, o = {}) {
    $('talkName').textContent = name;
    $('talkText').textContent = text;
    $('talkFace').textContent = o.mood === 'grumpy' ? '😠' : o.female ? '👩' : o.mood && MOODS[o.mood] ? (o.mood === 'normal' ? '👨' : MOODS[o.mood].icon) : '👨';
    $('talkGuide').classList.toggle('hidden', !o.guide);
    $('talk').classList.remove('hidden');
    this.talkT = o.guide ? 11 : 7;
  }
  showOffer(o, accept, decline, guide) {
    const el = $('offer');
    const md = MOODS[o.mood];
    el.innerHTML = `
      <div class="ohead"><span class="ava">${o.female ? '👩' : '👨'}</span><div><b>${o.name}</b><small>★ ${fa(o.rating).replace('.', '٫')} • ${md.icon} ${md.label}</small></div><span class="ofare">${faMoney(o.fare)}<small>تومان</small></span></div>
      <div class="orow"><i>🧍</i><div><small>مبدا (${faDist(o.toPick)} از تو)</small><b>${o.pickupAddr}</b></div></div>
      <div class="orow"><i>🏁</i><div><small>مقصد • ${faDist(o.len)}</small><b>${o.destAddr}</b></div></div>
      <div class="ometa">⛽ حدود ${fa(o.fuelNeed)} لیتر بنزین لازمه ${o.fuelNeed > this.g.player.fuelTotal() ? '<em>— بنزینت کمه!</em>' : ''}</div>
      <div class="obtns"><button class="ok">✅ قبول</button><button class="guide">🧭 قبول + فلش</button><button class="no">❌ رد</button></div>
      <div class="otimer"><i id="offerTimer"></i></div>`;
    el.classList.remove('hidden');
    this.offerCb = { accept, decline, guide };
    el.querySelector('.ok').onclick = accept;
    el.querySelector('.no').onclick = decline;
    el.querySelector('.guide').onclick = guide;
  }
  setOfferTimer(k) {
    const t = $('offerTimer');
    if (t) t.style.width = clamp(k, 0, 1) * 100 + '%';
  }
  hideOffer() {
    $('offer').classList.add('hidden');
    this.offerCb = null;
  }
  showResult(r) {
    const el = $('result');
    el.innerHTML = `<div class="rt">سفر تموم شد 🎉</div><div class="rs">${STAR(r.stars)}</div>
      <div class="rr"><span>کرایه</span><b>${faMoney(r.fare)}</b></div>
      <div class="rr"><span>انعام</span><b>${faMoney(r.tip)}</b></div>
      <div class="rr tot"><span>جمع</span><b>${faMoney(r.total)} تومان</b></div>
      <small>${r.name} • ${r.dest}</small>`;
    el.classList.remove('hidden');
    this.resultT = 6;
  }
  showIncident(amount, canPay, onPay, onRefuse) {
    const el = $('incident');
    el.innerHTML = `<div class="ih">😡 تصادف کردی!</div>
      <p>راننده اون ماشین شاکیه و خسارت می‌خواد.</p>
      <div class="iam">خسارت: <b>${faMoney(amount)}</b> تومان</div>
      <div class="ibtns"><button class="pay" ${canPay ? '' : 'disabled'}>💸 ${canPay ? 'پرداخت خسارت' : 'پول کافی نداری'}</button><button class="ref">🙅 نمیدم!</button></div>
      <small>اگه ندی یا فرار کنی، پلیس میاد دنبالت و ممکنه ۱۰ روز بری زندان!</small>`;
    el.classList.remove('hidden');
    el.querySelector('.pay').onclick = onPay;
    el.querySelector('.ref').onclick = onRefuse;
  }
  hideIncident() {
    $('incident').classList.add('hidden');
  }
  setWanted(on, a = 0, e = 0) {
    $('wanted').classList.toggle('hidden', !on);
    if (on) {
      $('arrestBar').style.width = clamp(a, 0, 1) * 100 + '%';
      $('escapeBar').style.width = clamp(e, 0, 1) * 100 + '%';
    }
  }
  cinema(on, text = '') {
    $('cinema').classList.toggle('hidden', !on);
    $('cinemaText').textContent = text;
  }
  showJail(on) {
    $('jail').classList.toggle('hidden', !on);
  }
  setJail(day, days, frac) {
    $('jailDay').textContent = `روز ${fa(day)} از ${fa(days)}`;
    $('jailBar').style.width = ((day - 1 + frac) / days) * 100 + '%';
  }
  zone(text) {
    const z = $('zoneBtn');
    if (!text) z.classList.add('hidden');
    else {
      z.classList.remove('hidden');
      if (z.textContent !== text) z.textContent = text;
    }
  }
  flash() {
    const f = $('flash');
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  }

  /* ---------------- panels ---------------- */
  /** true while a finger/key is on the driving controls */
  controlsHeld() {
    const t = this.touch, k = this.keys;
    return this.steerHeld() || t.gas > 0 || t.brake > 0 || t.hand || Object.values(k).some(Boolean);
  }
  /** forget every held touch/key so nothing stays "stuck" after a dialog */
  resetInputs() {
    this.releaseSteer();
    this.touch.gas = 0;
    this.touch.brake = 0;
    this.touch.hand = false;
    this.keys = {};
    for (const id of ['btnGas', 'btnBrake', 'btnHand']) $(id).classList.remove('on');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  panel(html, bind) {
    const el = $('panel');
    if (!this.panelOpen) this.resetInputs();
    el.innerHTML = `<div class="pbox">${html}<button class="pclose">✕</button></div>`;
    el.classList.remove('hidden');
    el.querySelector('.pclose').onclick = () => this.closePanel();
    el.onclick = (e) => { if (e.target === el) this.closePanel(); };
    if (bind) bind(el);
    this.panelOpen = true;
  }
  closePanel() {
    $('panel').classList.add('hidden');
    this.panelOpen = false;
    this.resetInputs();
    if (this.onPanelClose) {
      const f = this.onPanelClose;
      this.onPanelClose = null;
      f();
    }
  }
  openStation(s) {
    const g = this.g, p = g.player;
    const PR = 1500, PS = 3000;
    const render = () => {
      const space = p.tank - p.fuelTotal();
      const fullR = Math.ceil(space) * PR, fullS = Math.ceil(space) * PS;
      this.panel(`
        <h2>⛽ ${s.name}</h2>
        <div class="tank"><div class="tr"><i style="width:${(p.fuel / p.tank) * 100}%"></i><i class="s" style="width:${(p.superFuel / p.tank) * 100}%"></i></div>
        <span>${fa(p.fuelTotal().toFixed(1)).replace('.', '٫')} / ${fa(p.tank)} لیتر</span></div>
        <div class="grid2">
          <div class="card r"><h3>بنزین معمولی</h3><p>${faMoney(PR)} تومان / لیتر</p>
            <button data-a="r10">+۱۰ لیتر • ${faMoney(Math.min(10, Math.ceil(space)) * PR)}</button>
            <button data-a="rf">باک رو پر کن • ${faMoney(fullR)}</button></div>
          <div class="card s"><h3>🚀 بنزین سوپر</h3><p>${faMoney(PS)} تومان / لیتر</p>
            <button data-a="s10">+۱۰ لیتر • ${faMoney(Math.min(10, Math.ceil(space)) * PS)}</button>
            <button data-a="sf">باک رو پر کن • ${faMoney(fullS)}</button></div>
        </div>
        <p class="note">بنزین سوپر تا وقتی توی باکه، سرعت ماشین رو تا ۲۰٪ و شتاب رو تا ۳۰٪ بیشتر می‌کنه. برای سفرهای خیلی دور عالیه!</p>
        <p class="money">موجودی: ${faMoney(g.money)} تومان${g.coins ? ` + 🪙 ${fa(g.coins)} سکه` : ''}</p>`, (el) => {
        el.querySelectorAll('[data-a]').forEach((b) => {
          b.onclick = () => {
            const a = b.dataset.a;
            const sup = a[0] === 's';
            const price = sup ? PS : PR;
            let L = a[1] === 'f' ? p.tank - p.fuelTotal() : Math.min(10, p.tank - p.fuelTotal());
            g.topUp(Math.ceil(L * price));
            L = Math.floor(Math.min(L, g.money / price) * 10) / 10;
            if (L < 0.1) {
              this.toast(p.tank - p.fuelTotal() < 0.1 ? 'باک پره!' : 'پول کافی نداری', 'warn');
              g.audio.bad();
              return;
            }
            g.money -= Math.round(L * price);
            if (sup) p.superFuel += L;
            else p.fuel += L;
            g.audio.cash();
            this.toast(`${fa(L.toFixed(1)).replace('.', '٫')} لیتر ${sup ? 'سوپر' : 'معمولی'} زدی ⛽`, 'good');
            g.save();
            render();
          };
        });
      });
    };
    render();
  }
  openGarage(s) {
    const g = this.g, p = g.player;
    const ENG = [300000, 650000, 1100000, 1700000, 2600000];
    const TANK = [[55, 250000], [65, 500000], [80, 900000]];
    const render = () => {
      const rc = Math.ceil((100 - p.health) * 3500 / 1000) * 1000;
      const lvl = p.engineLevel;
      const ti = TANK.findIndex((t) => t[0] > p.tank);
      this.panel(`
        <h2>🔧 ${s.name}</h2>
        <div class="grid2">
          <div class="card"><h3>تعمیر بدنه و موتور</h3><div class="hb"><i style="width:${p.health}%"></i></div><p>سلامت: ${fa(Math.round(p.health))}٪</p>
            <button data-a="rep" ${p.health >= 99.5 ? 'disabled' : ''}>تعمیر کامل • ${faMoney(rc)}</button></div>
          <div class="card"><h3>ارتقای موتور (درجه سرعت)</h3><p>سطح ${fa(lvl)} از ۵ • حداکثر سرعت ${fa(Math.round(p.topSpeed() * 3.6))} km/h</p>
            ${lvl < 5 ? `<button data-a="eng">سطح ${fa(lvl + 1)} • ${faMoney(ENG[lvl])}</button>` : '<button disabled>حداکثر سطح ✔</button>'}</div>
          <div class="card"><h3>باک بزرگ‌تر</h3><p>ظرفیت فعلی ${fa(p.tank)} لیتر</p>
            ${ti >= 0 ? `<button data-a="tank">${fa(TANK[ti][0])} لیتری • ${faMoney(TANK[ti][1])}</button>` : '<button disabled>بزرگ‌ترین باک ✔</button>'}</div>
        </div>
        <p class="money">موجودی: ${faMoney(g.money)} تومان${g.coins ? ` + 🪙 ${fa(g.coins)} سکه` : ''}</p>`, (el) => {
        el.querySelectorAll('[data-a]').forEach((b) => {
          b.onclick = () => {
            const a = b.dataset.a;
            let cost = 0;
            if (a === 'rep') cost = rc;
            if (a === 'eng') cost = ENG[lvl];
            if (a === 'tank') cost = TANK[ti][1];
            g.topUp(cost);
            if (g.money < cost) {
              this.toast('پول کافی نداری 😟', 'warn');
              g.audio.bad();
              return;
            }
            g.money -= cost;
            if (a === 'rep') p.repair();
            if (a === 'eng') p.engineLevel++;
            if (a === 'tank') p.tank = TANK[ti][0];
            g.audio.cash();
            this.toast(a === 'rep' ? 'ماشین مثل روز اولش شد ✨' : a === 'eng' ? 'موتور ارتقا پیدا کرد! 🏎️' : 'باک بزرگ‌تر نصب شد ⛽', 'good');
            g.save();
            render();
          };
        });
      });
    };
    render();
  }
  openPolice() {
    const g = this.g;
    const wanted = g.police.state === 'chase';
    this.panel(`<h2>🚓 کلانتری مرکزی</h2>
      ${wanted ? `<p>داری تعقیب میشی. اگه خودت رو معرفی کنی و جریمه رو بدی، زندان نمیری.</p><p class="money">جریمه: ${faMoney(g.police.fine)} تومان • موجودی: ${faMoney(g.money)}</p><button data-a="surrender" ${g.wallet() >= g.police.fine ? '' : 'disabled'}>معرفی و پرداخت جریمه</button>`
        : '<p>سلام! اینجا کلانتریه. اگه یه روز تحت تعقیب بودی می‌تونی بیای اینجا خودتو معرفی کنی و فقط جریمه بدی.</p>'}`, (el) => {
      const b = el.querySelector('[data-a=surrender]');
      if (b) b.onclick = () => {
        g.topUp(g.police.fine);
        g.money -= g.police.fine;
        g.police.despawnUnit();
        g.police.state = 'none';
        this.setWanted(false);
        this.toast('جریمه رو دادی و آزاد شدی ✅', 'good');
        g.audio.cash();
        this.closePanel();
        g.save();
      };
    });
  }
  openMenu() {
    const g = this.g, s = g.settings;
    this.panel(`<h2>⏸️ توقف</h2>
      <div class="menu">
        <button data-a="resume" class="big">▶ ادامه بازی</button>
        <label>کیفیت گرافیک <select data-s="quality"><option value="low">پایین</option><option value="medium">متوسط</option><option value="high">بالا</option></select></label>
        <label>دید دوربین <select data-s="cam"><option value="third">سوم شخص</option><option value="first">اول شخص (داخل ماشین)</option><option value="far">دور</option></select></label>
        <label>گیربکس <select data-s="auto"><option value="0">دستی</option><option value="1">خودکار</option></select></label>
        <label>حساسیت فرمان <input type="range" min="0.5" max="2" step="0.1" data-s="sens"></label>
        <label><input type="checkbox" data-s="tilt"> فرمان با شیب گوشی</label>
        <label><input type="checkbox" data-s="sound"> صدا</label>
        <label><input type="checkbox" data-s="voice"> صدای مسافرها (اگه مرورگر فارسی بلد باشه)</label>
        <div class="help"><b>کیبورد:</b> W/S یا ↑↓ گاز و ترمز • A/D فرمان • ۱ تا ۵ و R و N دنده • Q/E دنده پایین/بالا • Space ترمز دستی • C دوربین • G فلش راهنما • M نقشه • H بوق • L چراغ • F ورود به پمپ/تعمیرگاه</div>
        <label>🔑 کد مخفی <span class="code"><input type="text" inputmode="numeric" maxlength="8" placeholder="۱۸۱۸ یا ۱۷۱۷" data-code><button data-a="code">ثبت</button></span></label>
        <button data-a="reset" class="danger">🗑️ شروع دوباره از اول</button>
      </div>`, (el) => {
      el.querySelector('[data-a=resume]').onclick = () => this.closePanel();
      const codeIn = el.querySelector('[data-code]');
      const submit = () => {
        if (g.cheat(codeIn.value)) this.closePanel();
        codeIn.value = '';
      };
      el.querySelector('[data-a=code]').onclick = submit;
      codeIn.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') submit(); };
      el.querySelector('[data-a=reset]').onclick = () => {
        if (confirm('همه پیشرفتت پاک میشه. مطمئنی؟')) g.resetSave();
      };
      el.querySelectorAll('[data-s]').forEach((inp) => {
        const k = inp.dataset.s;
        if (inp.type === 'checkbox') inp.checked = !!s[k];
        else if (k === 'auto') inp.value = g.player.auto ? '1' : '0';
        else if (k === 'cam') inp.value = g.camMode;
        else inp.value = s[k];
        inp.onchange = () => {
          const v = inp.type === 'checkbox' ? inp.checked : inp.value;
          if (k === 'auto') return this.toggleAuto(v === '1');
          if (k === 'cam') return g.setCamera(v);
          s[k] = k === 'sens' ? parseFloat(v) : v;
          if (k === 'sound') g.audio.setEnabled(!!v);
          if (k === 'voice') g.audio.voice = !!v;
          if (k === 'quality') {
            g.saveSettings();
            if (confirm('برای اعمال کیفیت جدید بازی دوباره بارگذاری میشه. باشه؟')) {
              g.save();
              location.reload();
            }
          }
          if (k === 'tilt' && v && typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().catch(() => {});
          g.saveSettings();
        };
      });
    });
    this.onPanelClose = () => g.pause(false);
  }
}
