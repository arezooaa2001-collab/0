import { fa, faMoney, faDist, clamp, levelFor, xpFor, levelTitle } from './util.js';
import { GEAR_LABEL, TOP_GEAR, CAR_MODELS, PERF, LIVERIES } from './vehicle.js';
import { HALF, REGION_NAMES, regionAt } from './world.js';
import { MOODS } from './missions.js';

const $ = (id) => document.getElementById(id);
const WASH_COST = 40000, INS_COST = 300000;
const TINTS = ['شفاف', 'دودی', 'تیره', 'لیموزینی'];
const RIMS = [['silver', '#c4c8ce', 'نقره‌ای'], ['black', '#1a1a1a', 'مشکی'], ['gold', '#d4af37', 'طلایی'], ['red', '#c62828', 'قرمز'], ['neon', '#00e5ff', 'نئونی ✨']];
const HORNS = [['classic', '📯', 'بوق معمولی', 0], ['bike', '🚲', 'زنگ دوچرخه', 60000], ['dingdong', '🔔', 'دینگ دانگ', 80000], ['duck', '🦆', 'اردکی', 100000], ['ship', '🚢', 'بوق کشتی', 150000], ['cucaracha', '🎺', 'کوکاراچا', 250000]];
const PAINT_COST = 120000, NOS_COST = 60000, NEON_COST = 250000, RAINBOW_COST = 600000;
const NEONS = [[0x00e5ff, 'آبی یخی'], [0xff2bd6, 'صورتی'], [0x39ff14, 'سبز فسفری'], [0xa040ff, 'بنفش'], [0xff2a2a, 'قرمز'], [0xffd21a, 'طلایی'], ['rainbow', 'رنگین‌کمان 🌈']];
const PAINTS = [[0xf3c614, 'زرد تاکسی'], [0x1f8a4c, 'سبز تاکسی'], [0xf2f2f2, 'سفید'], [0x15171a, 'مشکی'], [0xc62828, 'قرمز'], [0x1f5fbf, 'آبی'], [0xff7a1a, 'نارنجی'], [0x8e44ad, 'بنفش'], [0xb8bcc2, 'نقره‌ای']];
const STATIONS = [null, 'pop', 'sonati', 'electro'];
const STATION_NAME = { pop: '📻 رادیو پاپ ۹۸٫۵', sonati: '📻 رادیو سنتی (دستگاه شور) ۱۰۲٫۷', electro: '📻 رادیو الکترو ۱۰۷٫۱ ⚡' };
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
    this.mmZoom = 1;
    this.mm.style.pointerEvents = 'auto';
    this.mm.addEventListener('click', () => {
      const Z = [1, 1.9, 0.55];
      this.mmZoom = Z[(Z.indexOf(this.mmZoom) + 1) % Z.length];
      this.toast(this.mmZoom > 1 ? '🔍 نقشه دور' : this.mmZoom < 1 ? '🔍 نقشه نزدیک' : '🔍 نقشه معمولی', 'info');
    });
    this.mmCtx = this.mm.getContext('2d');
    this.coarse = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    document.body.classList.toggle('touch', this.coarse);
    this.bindControls();
    this.bindKeys();
    this.applySteerMode();
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
    hold('btnLeft', 'left');
    hold('btnNos', 'nitro');
    hold('btnRight', 'right');
    hold('btnGas', 'gas');
    hold('btnBrake', 'brake');
    hold('btnHand', 'hand', true);

    document.querySelectorAll('#gearbox [data-g]').forEach((b) => {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.pickGear(parseInt(b.dataset.g, 10));
        // on phones the gate folds away again after shifting
        clearTimeout(this.gearFold);
        this.gearFold = setTimeout(() => $('gearbox').classList.remove('open'), 1400);
      });
    });
    $('gearCur').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      $('gearbox').classList.toggle('open');
      clearTimeout(this.gearFold);
      this.gearFold = setTimeout(() => $('gearbox').classList.remove('open'), 5000);
    });
    $('btnAuto').addEventListener('click', () => this.toggleAuto());
    $('btnCam').addEventListener('click', () => g.cycleCamera());
    $('btnDoor').addEventListener('click', () => g.onfoot.toggle());
    $('btnBag').addEventListener('click', () => this.openInventory());
    $('btnRadio').addEventListener('click', () => this.cycleRadio());
    $('btnPhone').addEventListener('click', () => (this.panelOpen ? this.closePanel() : g.phone.open()));
    $('storyChip').addEventListener('click', () => g.phone.open('story'));
    $('btnCruise').addEventListener('click', () => g.setCruise(!g.cruise));
    $('btnShift').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      g.drag.shift(1);
    });
    $('btnGuide').addEventListener('click', () => g.toggleGuide());
    $('btnLights').addEventListener('click', () => {
      g.player.lights = !g.player.lights;
      $('btnLights').classList.toggle('active', g.player.lights);
    });
    const horn = $('btnHorn');
    horn.addEventListener('pointerdown', (e) => { e.preventDefault(); horn.setPointerCapture(e.pointerId); g.audio.init(); g.audio.horn(true); g.honk(); });
    horn.addEventListener('lostpointercapture', () => g.audio.horn(false));
    horn.addEventListener('pointerup', () => g.audio.horn(false));
    horn.addEventListener('pointercancel', () => g.audio.horn(false));
    $('btnMap').addEventListener('click', () => this.toggleBigMap());
    $('btnMenu').addEventListener('click', () => g.pause(true));
    $('bigmap').addEventListener('click', (e) => {
      if (e.target.id === 'bigmapCanvas') return this.mapWaypoint(e);
      this.toggleBigMap(false);
    });
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
  applySteerMode() {
    const m = this.g.settings.steer || 'buttons';
    document.body.classList.remove('steer-buttons', 'steer-wheel', 'steer-tilt');
    document.body.classList.add('steer-' + m);
  }
  toggleAuto(v) {
    const p = this.g.player;
    if (this.g.drag.state !== 'idle') return this.toast('🚦 توی درگ باید خودت دنده عوض کنی!', 'warn');
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
      const map = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5, Digit6: 6, Digit7: 7, KeyR: -1, KeyN: 0, Numpad1: 1, Numpad2: 2, Numpad3: 3, Numpad4: 4, Numpad5: 5, Numpad6: 6, Numpad7: 7 };
      const dm = /^(Digit|Numpad)([0-9])$/.exec(e.code);
      if (dm) {
        const now = performance.now();
        if (now - (this.codeT || 0) > 2500) this.codeBuf = '';
        this.codeT = now;
        this.codeBuf = ((this.codeBuf || '') + dm[2]).slice(-4);
        if (this.codeBuf === '1818' || this.codeBuf === '1717' || this.codeBuf === '1515') {
          const c = this.codeBuf;
          this.codeBuf = '';
          g.cheat(c);
        }
      }
      if (e.code === 'KeyV') g.onfoot.toggle();
      if (e.code === 'KeyK') this.cycleRadio();
      if (e.code === 'KeyX') g.state === 'photo' ? g.photo.close() : g.state === 'play' && !this.panelOpen && g.photo.open();
      if (e.code === 'KeyU' && g.state === 'play') g.setCruise(!g.cruise);
      if (e.code === 'KeyJ' && g.state === 'play') this.panelOpen ? this.closePanel() : g.fleet.open();
      if (e.code === 'KeyO' && g.state === 'play') this.panelOpen ? this.closePanel() : this.openAchievements();
      if (e.code === 'KeyZ' && g.state === 'play') this.panelOpen ? this.closePanel() : g.phone.open();
      if (e.code === 'KeyI' && g.state === 'play') this.panelOpen ? this.closePanel() : this.openInventory();
      const walking = g.onfoot.active || g.onfoot.busy;
      if (e.code in map && g.state === 'play' && !walking) this.pickGear(map[e.code]);
      if (g.state === 'play' && !walking && (e.code === 'KeyE' || e.code === 'ShiftLeft')) this.gearStep(1);
      if (g.state === 'play' && !walking && (e.code === 'KeyQ' || e.code === 'ControlLeft')) this.gearStep(-1);
      if (e.code === 'KeyC') g.cycleCamera();
      if (e.code === 'KeyG') g.toggleGuide();
      if (e.code === 'KeyL') { p.lights = !p.lights; $('btnLights').classList.toggle('active', p.lights); }
      if (e.code === 'KeyH') { g.audio.horn(true); g.honk(); }
      if (e.code === 'KeyM') this.toggleBigMap();
      if (e.code === 'KeyT') this.toggleAuto();
      if (e.code === 'KeyF') g.zoneAction();
      if (e.code === 'Backquote' && (g.state === 'play' || g.state === 'replay')) g.state === 'replay' ? g.replay.close() : g.replay.open();
      if ((e.code === 'KeyP' || e.code === 'Escape') && g.state === 'replay') g.replay.close();
      else if ((e.code === 'KeyP' || e.code === 'Escape') && g.state === 'photo') g.photo.close();
      else if (e.code === 'KeyP' || e.code === 'Escape') g.pause(g.state !== 'pause');
      if (e.code === 'Enter' && this.offerCb && !this.panelOpen) this.offerCb.accept();
      if (e.code === 'KeyY' && this.offerCb && !this.panelOpen) this.offerCb.guide();
      if (e.code === 'Backspace' && this.offerCb) this.offerCb.decline();
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'KeyH') g.audio.horn(false);
    });
    window.addEventListener('blur', () => {
      this.keys = {};
      g.audio.horn(false);
    });
  }
  gearStep(dir) {
    const p = this.g.player;
    const t = p.targetGear;
    let n;
    if (dir > 0) n = t === -1 ? 0 : t === 0 ? 1 : Math.min(TOP_GEAR, t + 1);
    else n = t === 1 ? 0 : t === 0 ? -1 : t === -1 ? -1 : t - 1;
    this.pickGear(n);
  }
  /** every gear request goes through here, so the drag race can take over the shifting */
  pickGear(n) {
    const g = this.g, p = g.player;
    if (g.drag.state !== 'idle') return g.drag.shift(n > p.gear ? 1 : -1);
    p.requestGear(n);
  }
  input() {
    const k = this.keys, t = this.touch;
    let steer = t.steer + (t.right ? 1 : 0) - (t.left ? 1 : 0);
    if (k.ArrowLeft || k.KeyA) steer -= 1;
    if (k.ArrowRight || k.KeyD) steer += 1;
    // tilt only when nothing else is steering
    if (this.g.settings.steer === 'tilt' && steer === 0) steer = this.tilt;
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
      nitro: !!(t.nitro || k.KeyB),
    };
  }

  /* ---------------- HUD ---------------- */
  setHud(on) {
    $('hud').classList.toggle('off', !on);
  }
  /** tap on the big map: drop (or remove) a custom GPS waypoint */
  /** custom waypoint (the phone's apps use it): the guide arrow shows the way */
  navTo(x, z, label, addr = '') {
    const g = this.g;
    if (g.rides.ride || g.race.state !== 'idle' || g.crazy.state !== 'idle' || g.parking.state !== 'idle' || g.drag.state !== 'idle' || g.events.job || g.bounty.state !== 'idle') {
      this.toast('الان مسیرت معلومه؛ اول کارت رو تموم کن', 'warn');
      return false;
    }
    if (!(g.guide && g.guide.custom)) g.guidePrev = g.guideOn;
    g.setGuide({ x, z, label, addr: addr || REGION_NAMES[regionAt(x, z)], custom: true });
    g.guideOn = true;
    $('btnGuide').classList.add('active');
    return true;
  }
  mapWaypoint(e) {
    const g = this.g;
    const c = $('bigmapCanvas'), r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * HALF * 2 - HALF, z = ((e.clientY - r.top) / r.height) * HALF * 2 - HALF;
    if (g.rides.ride || g.race.state !== 'idle' || g.crazy.state !== 'idle' || g.parking.state !== 'idle' || g.drag.state !== 'idle' || g.events.job || g.bounty.state !== 'idle') {
      this.toast('الان مسیرت معلومه؛ اول کارت رو تموم کن', 'warn');
      return;
    }
    if (g.guide && g.guide.custom && Math.hypot(g.guide.x - x, g.guide.z - z) < 60) {
      g.clearGuide();
      if (g.guidePrev !== undefined) {
        g.guideOn = g.guidePrev;
        g.guidePrev = undefined;
        $('btnGuide').classList.toggle('active', g.guideOn);
      }
      this.toast('📍 مقصد دلخواه پاک شد', 'info');
    } else {
      if (!(g.guide && g.guide.custom)) g.guidePrev = g.guideOn;
      g.setGuide({ x, z, label: '📍 مقصد دلخواه', addr: REGION_NAMES[regionAt(x, z)], custom: true });
      g.guideOn = true;
      $('btnGuide').classList.add('active');
      this.toast('📍 مقصد دلخواه روی نقشه گذاشته شد؛ فلش 🧭 راه رو نشونت میده', 'good');
    }
    g.audio.beep();
    this.drawBigMap();
  }
  /** analog speedometer with a rev counter arc */
  drawGauge(p) {
    const c = $('gauge');
    if (!c) return;
    const kmh = Math.min(260, (p.groundSpeed ?? Math.abs(p.speed)) * 3.6), rpm = Math.min(1, p.rpm / 7000);
    const key = Math.round(kmh) + ':' + Math.round(rpm * 50);
    if (key === this.gaugeKey) return;
    this.gaugeKey = key;
    const x = c.getContext('2d'), S = 160, R = 70;
    x.clearRect(0, 0, S, S);
    x.save();
    x.translate(80, 80);
    x.fillStyle = 'rgba(10,12,20,0.72)';
    x.beginPath();
    x.arc(0, 0, R + 6, 0, Math.PI * 2);
    x.fill();
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    // rev arc
    x.lineWidth = 6;
    x.strokeStyle = 'rgba(255,255,255,0.12)';
    x.beginPath();
    x.arc(0, 0, R - 2, a0, a1);
    x.stroke();
    x.strokeStyle = rpm > 0.9 ? '#ff4040' : rpm > 0.75 ? '#ffb020' : '#38e07e';
    x.beginPath();
    x.arc(0, 0, R - 2, a0, a0 + (a1 - a0) * rpm);
    x.stroke();
    // speed ticks every 20 km/h
    x.strokeStyle = '#fff';
    x.fillStyle = '#ddd';
    x.font = 'bold 12px sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    for (let v = 0; v <= 260; v += 20) {
      const a = a0 + ((a1 - a0) * v) / 260;
      x.lineWidth = v % 40 === 0 ? 2.5 : 1.2;
      x.beginPath();
      x.moveTo(Math.cos(a) * (R - 10), Math.sin(a) * (R - 10));
      x.lineTo(Math.cos(a) * (R - (v % 40 === 0 ? 20 : 15)), Math.sin(a) * (R - (v % 40 === 0 ? 20 : 15)));
      x.stroke();
      if (v % 40 === 0) x.fillText(String(v), Math.cos(a) * (R - 31), Math.sin(a) * (R - 31));
    }
    // needle
    const a = a0 + ((a1 - a0) * kmh) / 260;
    x.strokeStyle = '#ff3b3b';
    x.lineWidth = 3.5;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-Math.cos(a) * 8, -Math.sin(a) * 8);
    x.lineTo(Math.cos(a) * (R - 14), Math.sin(a) * (R - 14));
    x.stroke();
    x.fillStyle = '#222';
    x.beginPath();
    x.arc(0, 0, 7, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  makeDrops() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const x = c.getContext('2d');
    for (let i = 0; i < 160; i++) {
      const px = Math.random() * 512, py = Math.random() * 512, r = 1.5 + Math.random() * 5;
      const grd = x.createRadialGradient(px - r * 0.3, py - r * 0.3, 0, px, py, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.75)');
      grd.addColorStop(0.6, 'rgba(200,220,240,0.25)');
      grd.addColorStop(1, 'rgba(120,140,160,0.05)');
      x.fillStyle = grd;
      x.beginPath();
      x.ellipse(px, py, r, r * 1.25, 0, 0, Math.PI * 2);
      x.fill();
      if (Math.random() < 0.25) {
        x.strokeStyle = 'rgba(255,255,255,0.18)';
        x.lineWidth = r * 0.5;
        x.beginPath();
        x.moveTo(px, py);
        x.lineTo(px + (Math.random() - 0.5) * 4, py + 10 + Math.random() * 30);
        x.stroke();
      }
    }
    $('drops').style.backgroundImage = `url(${c.toDataURL()})`;
    this.dropsReady = true;
  }
  makeCracks() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 576;
    const ctx = c.getContext('2d');
    ctx.lineCap = 'round';
    const crack = (x, y, a, len, w, depth) => {
      if (depth > 5 || len < 8) return;
      let px = x, py = y;
      const steps = 6;
      for (let i = 0; i < steps; i++) {
        a += (Math.random() - 0.5) * 0.5;
        const nx = px + Math.cos(a) * (len / steps), ny = py + Math.sin(a) * (len / steps);
        ctx.strokeStyle = `rgba(255,255,255,${0.55 - depth * 0.07})`;
        ctx.lineWidth = Math.max(0.6, w);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = Math.max(0.4, w * 0.5);
        ctx.beginPath();
        ctx.moveTo(px + 1, py + 1);
        ctx.lineTo(nx + 1, ny + 1);
        ctx.stroke();
        px = nx;
        py = ny;
        if (Math.random() < 0.3) crack(px, py, a + (Math.random() < 0.5 ? 0.8 : -0.8), len * 0.5, w * 0.7, depth + 1);
      }
    };
    for (const [x, y] of [[300, 210], [720, 150], [560, 330]]) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, 7);
      ctx.fill();
      for (let k = 0; k < 9; k++) crack(x, y, (k / 9) * Math.PI * 2 + Math.random() * 0.4, 120 + Math.random() * 200, 2.4, 0);
      // spider-web rings
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      for (const rr of [22, 45]) {
        ctx.beginPath();
        for (let k = 0; k <= 12; k++) {
          const a = (k / 12) * Math.PI * 2, q = rr * (0.8 + Math.random() * 0.4);
          k ? ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) : ctx.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
        }
        ctx.stroke();
      }
    }
    $('cracks').style.backgroundImage = `url(${c.toDataURL()})`;
    this.cracksReady = true;
  }
  update(dt) {
    const g = this.g, p = g.player;
    // cracked windshield inside the car when the taxi is badly damaged
    const crack = g.camMode === 'first' && !g.onfoot.active && p.health < 50 ? Math.round(Math.min(0.9, (50 - p.health) / 40) * 20) / 20 : 0;
    if (crack !== this.crackShown) {
      if (crack && !this.cracksReady) this.makeCracks();
      this.crackShown = crack;
      $('cracks').style.opacity = crack;
      $('cracks').classList.toggle('hidden', !crack);
    }
    this.drawGauge(p);
    // raindrops on the windshield from the driver's seat
    const W = g.weather;
    const drops = g.camMode === 'first' && !g.onfoot.active && g.state === 'play' && W ? Math.round(Math.min(1, ((W.wet ?? W.rain) + W.snow * 0.6) * 1.3) * 10) / 10 : 0;
    if (drops !== this.dropsShown) {
      if (drops && !this.dropsReady) this.makeDrops();
      this.dropsShown = drops;
      $('drops').style.opacity = drops * 0.85;
      $('drops').classList.toggle('hidden', !drops);
    }
    // taximeter: the fare ticks up as you get closer to the destination
    const rd = g.rides, rr = rd.ride;
    let meter = '';
    if (rr && rd.state === 'toDest') {
      if (!rr.o.kind && rr.o.len > 0 && g.guide) meter = Math.round((rr.o.fare * clamp(1 - (g.guideDist || 0) / rr.o.len, 0.05, 1)) / 500) * 500;
      else meter = rr.o.fare;
    } else if (g.crazy.ride) meter = g.crazy.ride.fare + g.crazy.ride.tips;
    const mt = meter === '' ? '' : `🚕 ${faMoney(meter)}`;
    if (mt !== this.meterShown) {
      this.meterShown = mt;
      $('meter').textContent = mt;
      $('meter').classList.toggle('hidden', !mt);
      document.body.classList.toggle('metered', !!mt);
    }
    $('money').textContent = faMoney(g.money);
    $('coinPill').classList.toggle('hidden', !g.coins);
    $('coins').textContent = fa(g.coins);
    const tank = p.tank;
    $('fuelBar').style.width = (p.fuel / tank) * 100 + '%';
    $('superBar').style.width = (p.superFuel / tank) * 100 + '%';
    $('fuelBar').parentElement.parentElement.classList.toggle('low', p.fuelTotal() / tank < 0.15);
    $('fuelText').textContent = p.spec.ev ? fa(Math.round((p.fuelTotal() / tank) * 100)) + '٪' : fa(Math.round(p.fuelTotal())) + 'L';
    if (this.fuelIcon !== !!p.spec.ev) {
      this.fuelIcon = !!p.spec.ev;
      $('fuelText').parentElement.firstElementChild.textContent = p.spec.ev ? '🔋' : '⛽';
    }
    $('healthBar').style.width = p.health + '%';
    $('healthBar').parentElement.parentElement.classList.toggle('low', p.health < 30);
    const h = Math.floor(g.hour), m = Math.floor((g.hour - h) * 60);
    $('clock').textContent = fa(String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
    $('day').textContent = fa(g.day);
    {
      const xp = g.stats.xp || 0, lv = levelFor(xp), a = xpFor(lv), b = xpFor(lv + 1);
      if (lv !== this.lvShown) {
        this.lvShown = lv;
        $('lvl').textContent = '🎖️' + fa(lv);
      }
      $('xpBar').style.width = ((xp - a) / (b - a)) * 100 + '%';
    }
    const avg = g.stats.trips ? g.stats.ratingSum / g.stats.trips : 5;
    $('stars').textContent = '★ ' + fa(avg.toFixed(1)).replace('.', '٫');
    const kmh = Math.round((p.groundSpeed ?? Math.abs(p.speed)) * 3.6);
    $('speed').textContent = fa(kmh);
    $('gearNow').textContent = GEAR_LABEL[p.gear] + (p.shift ? '…' : '');
    $('gearCur').textContent = GEAR_LABEL[p.shift ? p.targetGear : p.gear];
    $('gearNow').classList.toggle('rev', p.gear === -1);
    $('rpmBar').style.width = clamp(p.rpm / 7000, 0, 1) * 100 + '%';
    $('nosBar').style.width = p.nitro + '%';
    $('btnNos').classList.toggle('empty', p.nitro < 3);
    $('btnNos').classList.toggle('on', p.nitroOn);
    $('rpmBar').classList.toggle('red', p.rpm > 6300);
    let hint = '';
    if (!p.auto && !p.shift) {
      if (p.gear === 0) hint = 'دنده خلاصه! یه دنده بزن';
      else if (p.rpm > 6400 && p.gear > 0 && p.gear < TOP_GEAR) hint = '⬆ دنده رو بالا ببر';
      else if (p.gear > 2 && p.rpm < 1700 && p.throttle > 0.5) hint = '⬇ دنده سنگینه، کم کن';
    }
    if (p.flat) hint = hint || '🛞 پنچری! برو تعمیرگاه';
    if (p.superRatio() > 0.25) hint = hint || '🚀 بنزین سوپر فعاله';
    if (p.temp > 0.75) hint = p.overheat ? '🌡️ موتور جوش آورده!' : '🌡️ موتور داره داغ میشه...';
    $('shiftHint').textContent = hint;
    document.querySelectorAll('#gearbox [data-g]').forEach((b) => {
      const v = parseInt(b.dataset.g, 10);
      b.classList.toggle('cur', v === p.gear && !p.shift);
      b.classList.toggle('tgt', !!p.shift && v === p.targetGear);
    });
    // steering wheel graphic
    if (document.body.classList.contains('onfoot')) {
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
    const R = (230 + Math.abs(p.speed) * 4) * (this.mmZoom || 1);
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
    if (g.race.state !== 'idle' && g.race.pts) {
      ctx.strokeStyle = 'rgba(255,176,32,0.75)';
      ctx.lineWidth = 7 / sc;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      g.race.pts.forEach((q, i) => (i ? ctx.lineTo(...P(q.x, q.z)) : ctx.moveTo(...P(q.x, q.z))));
      ctx.stroke();
    }
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
    for (const it of g.pickups.items) {
      if (Math.abs(it.x - p.pos.x) > R || Math.abs(it.z - p.pos.z) > R) continue;
      const [X, Y] = P(it.x, it.z);
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath();
      ctx.arc(X, Y, 4 / sc, 0, 7);
      ctx.fill();
    }
    for (const s of w.stations) icon(s.padX, s.padZ, '#1f8a4c', 11, '⛽');
    for (const s of w.garages) icon(s.padX, s.padZ, '#d68910', 11, '🔧');
    icon(w.police.padX, w.police.padZ, '#1f4fa0', 11, '🚓');
    const race = g.race;
    if (race.state === 'idle') {
      if (g.crazy.state === 'idle' && g.parking.state === 'idle' && g.drag.state === 'idle') {
        for (const s of race.spots) icon(s.padX, s.padZ, '#8e24aa', 11, '🏁');
        icon(g.drag.spot.padX, g.drag.spot.padZ, '#c62828', 11, '🚦');
      }
      for (const ic of g.events.mapIcons()) icon(ic.x, ic.z, ic.col, 11, ic.txt);
      const bi = g.bounty.mapIcon();
      if (bi) icon(bi.x, bi.z, bi.col, 12, bi.txt);
    }
    else {
      for (let i = race.cp; i < race.cps.length; i++) icon(race.cps[i].x, race.cps[i].z, i === race.cp ? '#ffb020' : '#8a6a20', i === race.cp ? 9 : 6);
      if (race.rival && race.rival.active) icon(race.rival.pos.x, race.rival.pos.z, '#b04dff', 8);
    }
    // golden statues show up as a sparkle when you're close
    const got = g.stats.statues || [];
    for (const s of g.thrills.statues) if (!got.includes(s.id) && Math.hypot(s.x - p.pos.x, s.z - p.pos.z) < 160) icon(s.x, s.z, '#ffd54a', 7, '✨');
    const pk = g.parking, cz = g.crazy;
    const modesIdle = pk.state === 'idle' && cz.state === 'idle' && race.state === 'idle';
    if (modesIdle) icon(pk.spot.padX, pk.spot.padZ, '#1565c0', 10, '🅿️');
    else if (pk.state !== 'idle') icon(pk.bay.x, pk.bay.z, '#39e07a', 7);
    if (modesIdle) icon(cz.spot.padX, cz.spot.padZ, '#ff6a00', 11, '🔥');
    for (const c of cz.waiting) icon(c.at.x, c.at.z, c.col === 'g' ? '#39e07a' : c.col === 'y' ? '#ffd23a' : '#ff4040', 8, '🧍');
    for (const c2 of g.traffic.cars) if (c2.active && c2.state === 'incident') icon(c2.pos.x, c2.pos.z, '#ff4040', 6);
    icon(w.stuntPark.x, w.stuntPark.z, '#e65100', 10, '🚀');
    if (g.police.unit.active) icon(g.police.unit.pos.x, g.police.unit.pos.z, Math.floor(performance.now() / 200) % 2 ? '#ff3030' : '#3060ff', 9);
    if (g.guide) {
      // clamp target to minimap edge
      const dx = g.guide.x - p.pos.x, dz = g.guide.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      const lim = R * 0.88;
      const f = d > lim ? lim / d : 1;
      icon(p.pos.x + dx * f, p.pos.z + dz * f, g.rides.state === 'toDest' || g.guide.custom ? '#34e07a' : '#ffd23a', 12, g.guide.custom ? '📍' : g.guide.race ? '🚩' : g.rides.state === 'toDest' ? '🏁' : '🧍');
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
    for (const s of g.race.spots) dot(s.padX, s.padZ, '#8e24aa', '🏁');
    dot(g.crazy.spot.padX, g.crazy.spot.padZ, '#ff6a00', '🔥');
    dot(g.parking.spot.padX, g.parking.spot.padZ, '#1565c0', '🅿️');
    dot(g.drag.spot.padX, g.drag.spot.padZ, '#c62828', '🚦');
    for (const ic of g.events.mapIcons()) dot(ic.x, ic.z, ic.col, ic.txt);
    const bi = g.bounty.mapIcon();
    if (bi) dot(bi.x, bi.z, bi.col, bi.txt);
    {
      const sp = w.stuntPark;
      dot(sp.x, sp.z, '#e65100', '🚀', 10);
    }
    if (g.guide) dot(g.guide.x, g.guide.z, '#ffd23a', g.guide.custom ? '📍' : g.guide.race ? '🚩' : g.rides.state === 'toDest' ? '🏁' : '🧍', 11);
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
    // short (phone) screens keep only two toasts so they never reach the passenger bubble
    const max = innerHeight <= 480 ? 2 : 4;
    while ($('toasts').children.length > max) $('toasts').firstChild.remove();
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
      <div class="ohead"><span class="ava">${o.female ? '👩' : '👨'}</span><div><b>${o.vip ? '⭐ VIP • ' : o.kind === 'robber' ? '🕶️ مسافر مشکوک • ' : o.kind === 'follow' ? '🕵️ ' : o.kind === 'tour' ? '📸 ' : ''}${o.name}</b><small>★ ${fa(o.rating).replace('.', '٫')} • ${md.icon} ${md.label}${o.vip ? ' • کرایه ۳ برابر، ولی باید سریع برسی!' : o.kind === 'robber' ? ' • کرایه خیلی بالا... ولی یه کیف پر پول دستشه! 💰' : o.kind === 'follow' ? ' • یه ماشین رو باید تعقیب کنی!' : o.kind === 'tour' ? ' • تور گردشگری: ۳ جای دیدنی، کرایه خوب!' : ''}</small></div><span class="ofare">${faMoney(o.fare)}<small>تومان</small></span></div>
      ${o.surge ? `<div class="osurge">⚡ کرایه ویژه ${o.surge}</div>` : ''}<div class="orow"><i>🧍</i><div><small>مبدا (${faDist(o.toPick)} از تو)</small><b>${o.pickupAddr}</b></div></div>
      <div class="orow"><i>${o.kind === 'follow' ? '🚗' : '🏁'}</i><div><small>${o.kind === 'follow' ? 'ماموریت' : 'مقصد • ' + faDist(o.len)}</small><b>${o.destAddr}</b></div></div>
      <div class="ometa">⛽ حدود ${fa(o.fuelNeed)} لیتر بنزین لازمه ${o.fuelNeed > this.g.player.fuelTotal() ? '<em>— بنزینت کمه!</em>' : ''}</div>
      <div class="obtns"><button class="ok">✅ قبول</button><button class="guide">🧭 قبول + فلش</button><button class="no">❌ رد</button></div>
      <div class="otimer"><i id="offerTimer"></i></div>`;
    el.classList.remove('hidden');
    el.classList.toggle('vip', !!o.vip);
    el.classList.toggle('special', !!o.kind);
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
  setWanted(on, a = 0, e = 0, stars = 1) {
    $('wanted').classList.toggle('hidden', !on);
    if (on) {
      if (stars !== this.starsShown) {
        this.starsShown = stars;
        $('wantedStars').textContent = '⭐'.repeat(Math.max(1, stars));
      }
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
    return this.steerHeld() || t.gas > 0 || t.brake > 0 || t.hand || t.left || t.right || Object.values(k).some(Boolean);
  }
  /** forget every held touch/key so nothing stays "stuck" after a dialog */
  resetInputs() {
    this.releaseSteer();
    this.touch.gas = 0;
    this.touch.brake = 0;
    this.touch.left = this.touch.right = 0;
    this.touch.nitro = 0;
    this.touch.hand = false;
    this.keys = {};
    for (const id of ['btnGas', 'btnBrake', 'btnHand', 'btnLeft', 'btnRight']) $(id).classList.remove('on');
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
    const ev = !!p.spec.ev, U = ev ? 'کیلووات' : 'لیتر';
    const PR = ev ? 600 : 1500, PS = 3000;
    const render = () => {
      const space = p.tank - p.fuelTotal();
      const fullR = Math.ceil(space) * PR, fullS = Math.ceil(space) * PS;
      this.panel(`
        <h2>⛽ ${s.name}</h2>
        <div class="tank"><div class="tr"><i style="width:${(p.fuel / p.tank) * 100}%"></i><i class="s" style="width:${(p.superFuel / p.tank) * 100}%"></i></div>
        <span>${fa(p.fuelTotal().toFixed(1)).replace('.', '٫')} / ${fa(p.tank)} ${U}</span></div>
        <div class="grid2">
          <div class="card r"><h3>${ev ? '⚡ شارژ باتری' : 'بنزین معمولی'}</h3><p>${faMoney(PR)} تومان / ${U}</p>
            <button data-a="r10">+۱۰ ${U} • ${faMoney(Math.min(10, Math.ceil(space)) * PR)}</button>
            <button data-a="rf">باک رو پر کن • ${faMoney(fullR)}</button></div>
          <div class="card wash"><h3>🧽 کارواش</h3><div class="hb"><i style="width:${(1 - (p.dirt || 0)) * 100}%"></i></div><p>تمیزی: ${fa(Math.round((1 - (p.dirt || 0)) * 100))}٪ • ماشین تمیز = مسافر راضی</p>
            <button data-wash="1" ${(p.dirt || 0) < 0.03 ? 'disabled' : ''}>شستن ماشین • ${faMoney(WASH_COST)}</button></div>
          ${ev ? '<div class="card"><h3>🔌 ماشین برقی</h3><p>ماشین برقیه، بنزین نمی‌خواد! شارژش خیلی ارزون‌تره 🌱</p></div>' : `<div class="card s"><h3>🚀 بنزین سوپر</h3><p>${faMoney(PS)} تومان / لیتر</p>
            <button data-a="s10">+۱۰ لیتر • ${faMoney(Math.min(10, Math.ceil(space)) * PS)}</button>
            <button data-a="sf">باک رو پر کن • ${faMoney(fullS)}</button></div>`}
        </div>
        <p class="note">${ev ? '⚡ هر ' + U + ' شارژ حدوداً به اندازه یه لیتر بنزین راه میره.' : ''} بنزین سوپر تا وقتی توی باکه، سرعت ماشین رو تا ۲۰٪ و شتاب رو تا ۳۰٪ بیشتر می‌کنه. برای سفرهای خیلی دور عالیه!</p>
        <p class="money">موجودی: ${faMoney(g.money)} تومان${g.coins ? ` + 🪙 ${fa(g.coins)} سکه` : ''}</p>`, (el) => {
        const wb = el.querySelector('[data-wash]');
        if (wb) wb.onclick = () => {
          if (wb.disabled) return;
          wb.disabled = true;
          g.topUp(WASH_COST);
          if (g.money < WASH_COST) {
            this.toast('پول کافی نداری 😟', 'warn');
            wb.disabled = false;
            return;
          }
          g.money -= WASH_COST;
          g.audio.burst(1.2, 2500, 'highpass', 0.3);
          g.fade(1, 0.35, () => {
            p.wash();
            g.stats.washes = (g.stats.washes || 0) + 1;
            g.fade(0, 0.5);
            this.toast('✨ ماشینت برق می‌زنه! مسافرها کیف می‌کنن', 'good');
            g.save();
            if (this.panelOpen && g.state === 'play') render();
          });
        };
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
            g.stats.fuelBuys = (g.stats.fuelBuys || 0) + 1;
            g.audio.cash();
            this.toast(ev ? `⚡ ${fa(L.toFixed(1)).replace('.', '٫')} کیلووات شارژ شد` : `${fa(L.toFixed(1)).replace('.', '٫')} لیتر ${sup ? 'سوپر' : 'معمولی'} زدی ⛽`, 'good');
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
      const rc = Math.ceil((100 - p.health) * 3500 / 1000) * 1000 + (p.flat ? 80000 : 0);
      const lvl = p.engineLevel;
      const ti = TANK.findIndex((t) => t[0] > p.tank);
      this.panel(`
        <h2>🔧 ${s.name}</h2>
        <div class="grid2">
          <div class="card"><h3>تعمیر بدنه و موتور</h3><div class="hb"><i style="width:${p.health}%"></i></div><p>سلامت: ${fa(Math.round(p.health))}٪</p>
            ${p.flat ? '<p>🛞 لاستیک‌ها پنچرن! (۸۰٬۰۰۰ تومان)</p>' : ''}<button data-a="rep" ${p.health >= 99.5 && !p.flat ? 'disabled' : ''}>تعمیر کامل • ${(g.stats.insurance || 0) > 0 ? '🛡️ رایگان (بیمه)' : faMoney(rc)}</button></div>
          <div class="card"><h3>ارتقای موتور (درجه سرعت)</h3><p>سطح ${fa(lvl)} از ۵ • حداکثر سرعت ${fa(Math.round(p.topSpeed() * 3.6))} km/h</p>
            ${lvl < 5 ? `<button data-a="eng">سطح ${fa(lvl + 1)} • ${faMoney(ENG[lvl])}</button>` : '<button disabled>حداکثر سطح ✔</button>'}</div>
          <div class="card perf"><h3>🏁 قطعات مسابقه‌ای</h3><p>روی همه ماشین‌هات کار می‌کنه</p><div class="perfrow">${PERF.map(([id, icon, name, desc, price]) => `<div class="${p.hasPerf(id) ? 'got' : ''}"><b>${icon} ${name}</b><small>${desc}</small><button data-perf="${id}" ${p.hasPerf(id) ? 'disabled' : ''}>${p.hasPerf(id) ? '✔ نصب شده' : faMoney(price)}</button></div>`).join('')}</div></div>
          <div class="card showroom"><h3>🚗 نمایشگاه ماشین</h3><div class="cars">${Object.entries(CAR_MODELS).map(([id, m]) => {
            const owned = p.owned.includes(id), cur = p.model === id;
            const bar = (label, v, max) => `<div class="cs"><span>${label}</span><i><b style="width:${Math.min(100, (v / max) * 100)}%"></b></i></div>`;
            return `<div class="carcard ${cur ? 'cur' : ''}"><div class="ct"><span>${m.icon}</span><div><b>${m.name}</b><small>${m.desc}</small></div></div>
              ${bar('سرعت', m.speed, 1.35)}${bar('شتاب', m.acc, 1.5)}${bar('فرمون', m.grip, 1.25)}${bar('کم‌مصرفی', 1 / m.fuel, 1.6)}
              <button data-car="${id}" ${cur ? 'disabled' : ''}>${cur ? '✓ ماشین فعلی' : owned ? 'سوار شو' : 'خرید • ' + faMoney(m.price)}</button></div>`;
          }).join('')}</div></div>
          <div class="card paint"><h3>🎨 رنگ ماشین</h3><p>هر رنگ ${faMoney(PAINT_COST)} تومان</p>
            <div class="swatches">${[...PAINTS, ...(g.stats.statues && g.stats.statues.length >= g.thrills.statues.length ? [[0xd4af37, 'طلایی (جایزه مجسمه‌ها) ✨']] : [])].map(([hex, name]) => `<button data-paint="${hex}" title="${name}" style="background:#${hex.toString(16).padStart(6, '0')}" class="${p.paintHex === hex || (!p.paintHex && hex === CAR_MODELS[p.model].color) ? 'cur' : ''}"></button>`).join('')}</div></div>
          <div class="card neon"><h3>💡 نئون زیر ماشین</h3><p>هر رنگ ${faMoney(NEON_COST)} • رنگین‌کمان ${faMoney(RAINBOW_COST)} تومان</p>
            <div class="swatches">${NEONS.map(([v, name]) => `<button data-neon="${v}" title="${name}" class="${p.neon === v ? 'cur' : ''} ${v === 'rainbow' ? 'rainbow' : ''}" style="${v === 'rainbow' ? '' : `background:#${v.toString(16).padStart(6, '0')};box-shadow:0 0 12px #${v.toString(16).padStart(6, '0')}`}"></button>`).join('')}
            <button data-neon="off" class="off ${p.neon ? '' : 'cur'}" title="خاموش">✕</button></div></div>
          <div class="card"><h3>🛡️ بیمه بدنه</h3><p>${(g.stats.insurance || 0) > 0 ? `${fa(g.stats.insurance)} تعمیر رایگان باقی مونده` : 'تعمیرهای بعدی مجانی میشه'}</p>
            <button data-a="ins">۳ تعمیر رایگان • ${faMoney(INS_COST)}</button></div>
          <div class="card tune"><h3>🛠️ تیونینگ</h3>
            <div class="tunerow"><b>🪟 شیشه دودی</b>${TINTS.map((t, i) => `<button data-tint="${i}" class="${(p.tint || 0) === i ? 'cur' : ''}">${t}</button>`).join('')}<small>${faMoney(150000)}</small></div>
            <div class="tunerow"><b>⚙️ رینگ</b>${RIMS.map(([id, col, name]) => `<button data-rim="${id}" class="${(p.rim || 'silver') === id ? 'cur' : ''}" title="${name}" style="background:${col};color:${id === 'black' ? '#fff' : '#111'}">${name}</button>`).join('')}<small>${faMoney(100000)}</small></div>
            <div class="tunerow"><b>🔥 برچسب بدنه</b>${LIVERIES.map(([id, icon, name]) => `<button data-liv="${id}" class="${(p.livery || '') === id ? 'cur' : ''}" title="${name}">${icon} ${name}</button>`).join('')}<small>${faMoney(120000)}</small></div>
            <div class="tunerow"><b>🔤 پلاک شخصی</b><input data-plate maxlength="10" placeholder="مثلاً ۷۷ ب ۷۷۷" value="${p.plateText || ''}"><button data-a2="plate">ثبت • ${faMoney(50000)}</button></div>
            <div class="tunerow"><b>🪽 بال عقب</b><button data-a2="spoiler" class="${p.spoiler ? 'cur' : ''}">${(p.modsOwned || []).includes('spoiler') ? (p.spoiler ? 'برداشتن' : 'نصب') : 'خرید • ' + faMoney(200000)}</button>
              <b>💨 اگزوز اسپرت</b><button data-a2="exhaust" class="${p.sportExhaust ? 'cur' : ''}">${(p.modsOwned || []).includes('exhaust') ? (p.sportExhaust ? 'خاموش' : 'روشن') : 'خرید • ' + faMoney(400000)}</button></div>
          </div>
          <div class="card horns"><h3>📯 بوق ماشین</h3><div class="hornrow">${HORNS.map(([id, icon, name, price]) => `<button data-horn="${id}" class="${p.horn === id ? 'cur' : ''}">${icon} ${name}<small>${p.horns.includes(id) ? (p.horn === id ? '✓ فعال' : 'انتخاب') : faMoney(price)}</small></button>`).join('')}</div></div>
          <div class="card nos"><h3>🔥 شارژ نیترو</h3><div class="hb"><i style="width:${p.nitro}%"></i></div><p>نیترو: ${fa(Math.round(p.nitro))}٪ (خودش آروم شارژ میشه)</p>
            <button data-a="nos" ${p.nitro >= 99 ? 'disabled' : ''}>پر کردن • ${faMoney(NOS_COST)}</button></div>
          <div class="card"><h3>باک بزرگ‌تر</h3><p>ظرفیت فعلی ${fa(p.tank)} لیتر</p>
            ${ti >= 0 ? `<button data-a="tank">${fa(TANK[ti][0])} لیتری • ${faMoney(TANK[ti][1])}</button>` : '<button disabled>بزرگ‌ترین باک ✔</button>'}</div>
        </div>
        <p class="money">موجودی: ${faMoney(g.money)} تومان${g.coins ? ` + 🪙 ${fa(g.coins)} سکه` : ''}</p>`, (el) => {
        el.querySelectorAll('[data-car]').forEach((b) => {
          b.onclick = () => {
            const id = b.dataset.car, m = CAR_MODELS[id];
            const r = g.rides;
            if ((r.ride && r.state !== 'toPickup') || g.crazy.ride) {
              this.toast('مسافر توی ماشینه! اول سفر رو تموم کن', 'warn');
              return;
            }
            if (g.race.state !== 'idle' || g.crazy.state !== 'idle' || g.parking.state !== 'idle' || g.drag.state !== 'idle') {
              this.toast('وسط مسابقه که نمیشه ماشین عوض کرد! 😅', 'warn');
              return;
            }
            if (p.burning) return;
            if (!p.owned.includes(id)) {
              g.topUp(m.price);
              if (g.money < m.price) {
                this.toast('پول کافی نداری 😟', 'warn');
                g.audio.bad();
                return;
              }
              g.money -= m.price;
              p.owned.push(id);
              g.audio.cash();
              this.toast(`🎉 ${m.name} مال تو شد!`, 'good');
            }
            p.setModel(id);
            this.toast(`${m.icon} سوار ${m.name} شدی`, 'info');
            g.save();
            render();
          };
        });
        const buy = (cost) => {
          g.topUp(cost);
          if (g.money < cost) {
            this.toast('پول کافی نداری 😟', 'warn');
            g.audio.bad();
            return false;
          }
          g.money -= cost;
          if (cost) g.audio.cash();
          return true;
        };
        const done = (msg) => {
          p.applyMods();
          this.toast(msg, 'good');
          g.save();
          render();
        };
        el.querySelectorAll('[data-perf]').forEach((b) => {
          b.onclick = () => {
            const part = PERF.find((x) => x[0] === b.dataset.perf);
            if (!part || p.hasPerf(part[0]) || !buy(part[4])) return;
            p.perf = [...(p.perf || []), part[0]];
            p.applyPerf();
            if (part[0] === 'turbo') {
              g.audio.burst(0.5, 2600, 'highpass', 0.25);
              g.audio.tone(2200, 0.4, 0.05, 'sine');
            }
            done(`${part[1]} ${part[2]} نصب شد! 🔧`);
          };
        });
        el.querySelectorAll('[data-liv]').forEach((b) => {
          b.onclick = () => {
            const v = b.dataset.liv;
            if ((p.livery || '') === v || (v && !buy(120000))) return;
            p.livery = v;
            done(v ? `${LIVERIES.find((l) => l[0] === v)[1]} برچسب جدید چسبید!` : 'برچسب‌ها کنده شد');
          };
        });
        el.querySelectorAll('[data-tint]').forEach((b) => {
          b.onclick = () => {
            const v = +b.dataset.tint;
            if ((p.tint || 0) === v || !buy(150000)) return;
            p.tint = v;
            done(`🪟 شیشه‌ها ${TINTS[v]} شدن`);
          };
        });
        el.querySelectorAll('[data-rim]').forEach((b) => {
          b.onclick = () => {
            const v = b.dataset.rim;
            if ((p.rim || 'silver') === v || !buy(100000)) return;
            p.rim = v;
            done('⚙️ رینگ‌های جدید نصب شد!');
          };
        });
        const plateIn = el.querySelector('[data-plate]');
        plateIn.onkeydown = (e) => e.stopPropagation();
        el.querySelector('[data-a2=plate]').onclick = () => {
          const v = plateIn.value.trim().slice(0, 10);
          if (!v || v === p.plateText || !buy(50000)) return;
          p.plateText = v;
          done(`🔤 پلاک «${v}» نصب شد!`);
        };
        for (const [id, prop, cost, on, off] of [['spoiler', 'spoiler', 200000, '🪽 بال عقب نصب شد!', 'بال برداشته شد'], ['exhaust', 'sportExhaust', 400000, '💨 اگزوز اسپرت! صدای موتور رو بشنو 🔥', 'اگزوز معمولی']]) {
          el.querySelector(`[data-a2=${id}]`).onclick = () => {
            p.modsOwned = p.modsOwned || [];
            if (!p.modsOwned.includes(id)) {
              if (!buy(cost)) return;
              p.modsOwned.push(id);
            }
            p[prop] = !p[prop];
            if (id === 'exhaust') g.audio.sportExhaust = p.sportExhaust;
            done(p[prop] ? on : off);
          };
        }
        el.querySelectorAll('[data-horn]').forEach((b) => {
          b.onclick = () => {
            const h = HORNS.find((x) => x[0] === b.dataset.horn);
            if (!h) return;
            if (!p.horns.includes(h[0])) {
              g.topUp(h[3]);
              if (g.money < h[3]) {
                this.toast('پول کافی نداری 😟', 'warn');
                g.audio.bad();
                return;
              }
              g.money -= h[3];
              p.horns.push(h[0]);
              g.audio.cash();
            }
            p.setHorn(h[0]);
            g.audio.init();
            g.audio.horn(true);
            setTimeout(() => g.audio.horn(false), 400);
            g.save();
            render();
          };
        });
        el.querySelectorAll('[data-neon]').forEach((b) => {
          b.onclick = () => {
            const raw = b.dataset.neon;
            const v = raw === 'off' ? null : raw === 'rainbow' ? 'rainbow' : parseInt(raw, 10);
            if (p.neon === v || (!p.neon && !v)) return;
            const cost = v === null ? 0 : v === 'rainbow' ? RAINBOW_COST : NEON_COST;
            if (cost) {
              g.topUp(cost);
              if (g.money < cost) {
                this.toast('پول کافی نداری 😟', 'warn');
                g.audio.bad();
                return;
              }
              g.money -= cost;
              g.audio.cash();
            }
            p.setNeon(v);
            this.toast(v ? '💡 نئون نصب شد! شب‌ها حسابی می‌درخشه ✨' : 'نئون خاموش شد', v ? 'good' : 'info');
            g.save();
            render();
          };
        });
        el.querySelectorAll('[data-paint]').forEach((b) => {
          b.onclick = () => {
            const hex = parseInt(b.dataset.paint, 10);
            if (p.paintHex === hex) return;
            g.topUp(PAINT_COST);
            if (g.money < PAINT_COST) {
              this.toast('پول کافی نداری 😟', 'warn');
              return;
            }
            g.money -= PAINT_COST;
            p.setPaint(hex);
            g.audio.cash();
            this.toast('🎨 ماشین رنگ شد!', 'good');
            g.save();
            render();
          };
        });
        el.querySelectorAll('[data-a]').forEach((b) => {
          b.onclick = () => {
            const a = b.dataset.a;
            let cost = 0;
            if (a === 'rep') cost = (g.stats.insurance || 0) > 0 ? 0 : rc;
            if (a === 'ins') cost = INS_COST;
            if (a === 'eng') cost = ENG[lvl];
            if (a === 'tank') cost = TANK[ti][1];
            if (a === 'nos') cost = NOS_COST;
            g.topUp(cost);
            if (g.money < cost) {
              this.toast('پول کافی نداری 😟', 'warn');
              g.audio.bad();
              return;
            }
            g.money -= cost;
            if (a === 'rep') {
              if ((g.stats.insurance || 0) > 0 && rc > 0) {
                g.stats.insurance--;
                setTimeout(() => this.toast(`🛡️ بیمه پرداخت کرد! (${fa(g.stats.insurance)} تعمیر رایگان دیگه)`, 'good'), 600);
              }
              p.repair();
            }
            if (a === 'ins') g.stats.insurance = (g.stats.insurance || 0) + 3;
            if (a === 'eng') p.engineLevel++;
            if (a === 'tank') p.tank = TANK[ti][0];
            if (a === 'nos') p.nitro = 100;
            g.audio.cash();
            this.toast(a === 'ins' ? '🛡️ بیمه بدنه خریدی: ۳ تعمیر رایگان!' : a === 'rep' ? 'ماشین مثل روز اولش شد ✨' : a === 'eng' ? 'موتور ارتقا پیدا کرد! 🏎️' : a === 'nos' ? 'کپسول نیترو پر شد! 🔥' : 'باک بزرگ‌تر نصب شد ⛽', 'good');
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
        : `<p>سلام! اینجا کلانتریه. اگه یه روز تحت تعقیب بودی می‌تونی بیای اینجا خودتو معرفی کنی و فقط جریمه بدی.</p>
          <h3>🎯 فهرست تحت تعقیب‌ها</h3>${g.bounty.boardHtml()}`}`, (el) => {
      g.bounty.bind(el);
      const b = el.querySelector('[data-a=surrender]');
      if (b) b.onclick = () => {
        if (g.state !== 'play' || g.police.state !== 'chase' || g.wallet() < g.police.fine) {
          this.closePanel();
          return;
        }
        g.topUp(g.police.fine);
        g.money -= g.police.fine;
        g.police.despawnUnit();
        g.police.state = 'none';
        g.police.robbery = false;
        this.setWanted(false);
        this.toast('جریمه رو دادی و آزاد شدی ✅', 'good');
        g.audio.cash();
        this.closePanel();
        g.save();
      };
    });
  }
  cycleRadio() {
    const g = this.g;
    this.setRadio(STATIONS[(STATIONS.indexOf(g.radio || null) + 1) % STATIONS.length]);
  }
  setRadio(st) {
    const g = this.g;
    g.audio.init();
    g.radio = STATIONS.includes(st) ? st : null;
    g.audio.setRadio(g.radio);
    $('btnRadio').classList.toggle('active', !!g.radio);
    this.toast(g.radio ? STATION_NAME[g.radio] : '📻 رادیو خاموش', 'info');
  }
  /** big reward popups are queued and shown one after another */
  achievement(icon, title, reward, head = '🏆 افتخار جدید!') {
    (this.achQ = this.achQ || []).push({ icon, title, reward, head });
    if (!this.achBusy) this.nextAch();
  }
  nextAch() {
    const a = this.achQ.shift();
    if (!a) {
      this.achBusy = false;
      return;
    }
    this.achBusy = true;
    const el = document.createElement('div');
    el.className = 'achpop';
    el.innerHTML = `<span>${a.icon}</span><div><small>${a.head}</small><b>${a.title}</b><em>+${fa(a.reward)} سکه 🪙</em></div>`;
    document.body.appendChild(el);
    const k = this.achQ.length ? 0.6 : 1; // hurry up when more are waiting
    setTimeout(() => el.classList.add('out'), 3200 * k);
    setTimeout(() => {
      el.remove();
      this.nextAch();
    }, 3800 * k);
  }
  openAchievements() {
    const g = this.g;
    if (g.state !== 'play') return;
    const n = g.ach.done().length, total = g.ach.list.length;
    const s = g.stats;
    this.panel(`<h2>🏆 افتخارات (${fa(n)} از ${fa(total)})</h2>
      <div class="statrow"><span>🎖️ سطح ${fa(levelFor(s.xp || 0))} • ${levelTitle(levelFor(s.xp || 0))}</span><span>🧳 ${fa(s.completed ?? s.trips)} سفر</span><span>🚀 ${fa(s.jumps || 0)} پرش</span><span>🌀 رکورد دریفت ${fa(Math.round(s.bestDrift || 0))}</span><span>🛣️ ${fa(((s.km || 0)).toFixed(1)).replace('.', '٫')} کیلومتر</span><span>💨 رکورد ${fa(Math.round(s.maxKmh || 0))} km/h</span><span>🪙 ${fa(g.coins)} سکه</span></div>
      ${g.ach.dailyHtml()}
      <details class="stats"><summary>📊 آمار رانندگی</summary><div class="statgrid">${[
        ['💰', 'کل درآمد', faMoney(s.earned || 0)], ['🧳', 'سفرهای کامل', fa(s.completed || 0)], ['🛣️', 'کیلومتر', fa((s.km || 0).toFixed(1)).replace('.', '٫')],
        ['💨', 'سریع‌ترین', fa(Math.round(s.maxKmh || 0)) + ' km/h'], ['🚀', 'پرش‌ها', fa(s.jumps || 0)], ['✈️', 'طولانی‌ترین پرش', fa((s.bestAir || 0).toFixed(1)).replace('.', '٫') + ' ث'],
        ['🌀', 'رکورد دریفت', fa(Math.round(s.bestDrift || 0))], ['😱', 'نزدیک بود', fa(s.nearMiss || 0)], ['🏁', 'مسابقه‌های برده', fa(s.racesWon || 0)],
        ['🔥', 'رکورد تاکسی دیوانه', faMoney(s.crazyBest || 0)], ['🅿️', 'پارک موفق', fa(s.parks || 0)], ['🗿', 'مجسمه‌ها', fa((s.statues || []).length)],
        ['💥', 'خراب‌کاری', fa(s.smashed || 0)], ['🧽', 'کارواش', fa(s.washes || 0)], ['🏃', 'فرار از پلیس', fa(s.escapes || 0)],
        ['🔒', 'زندان', fa(s.jailed || 0)], ['🎁', 'روز پشت سر هم', fa(s.streak || 0)], ['🙏', 'وسیله پس داده', fa(s.returned || 0)],
      ].map(([i, t, v]) => `<div><span>${i}</span><small>${t}</small><b>${v}</b></div>`).join('')}</div></details>
      <h3 class="achh">🏆 افتخارات</h3>
      <div class="achs">${g.ach.html()}</div>`);
  }
  openInventory() {
    const g = this.g;
    if (g.state !== 'play') return;
    const empty = '<div class="slot empty"></div>'.repeat(6);
    this.panel(`<h2>🎒 کوله‌پشتی</h2>
      <div class="inv">
        <div class="slot item"><span class="ic">🔥</span><b>کبریت برقی</b>
          <small>فندک الکتریکی. باهاش می‌تونی تاکسی رو آتیش بزنی! ماشین ۴۰ ثانیه بعد خودش ترمیم میشه.</small>
          <button data-use="lighter">⚡ روشن کن و آتیش بزن</button></div>
        <div class="slot item"><span class="ic">🪙</span><b>سکه</b><small>${fa(g.coins)} سکه (هر سکه ۱۰٬۰۰۰ تومان)</small></div>
        ${empty}
      </div>
      <p class="note">⚠️ اگه مسافر توی ماشین باشه می‌ترسه و فرار می‌کنه و بعد با مشت میاد دنبالت! اگه به موقع پیاده نشه می‌سوزه. اگه کسی ببینه به پلیس خبر میده.</p>`, (el) => {
      el.querySelector('[data-use=lighter]').onclick = () => {
        this.closePanel();
        g.arson.useLighter();
      };
    });
  }
  openMenu() {
    const g = this.g, s = g.settings;
    this.panel(`<h2>⏸️ توقف</h2>
      <div class="menu">
        <button data-a="resume" class="big">▶ ادامه بازی</button>
        <label>کیفیت گرافیک <select data-s="quality"><option value="low">پایین</option><option value="medium">متوسط</option><option value="high">بالا</option><option value="ultra">خیلی بالا ✨ (افکت‌های سینمایی)</option></select></label>
        <label>دید دوربین <select data-s="cam"><option value="third">سوم شخص</option><option value="first">اول شخص (داخل ماشین)</option><option value="far">دور</option><option value="bumper">دوربین سپر</option><option value="tv">🎬 دوربین تلویزیونی</option></select></label>
        <label>گیربکس <select data-s="auto"><option value="0">دستی</option><option value="1">خودکار</option></select></label>
        <label>حساسیت فرمان <input type="range" min="0.5" max="2" step="0.1" data-s="sens"></label>
        <label>نوع فرمون <select data-s="steer"><option value="buttons">دکمه‌های ◀ ▶ (پیشنهادی)</option><option value="wheel">کشیدن فرمون</option><option value="tilt">شیب گوشی</option></select></label>
        <label><input type="checkbox" data-s="sound"> صدا</label>
        <label><input type="checkbox" data-s="voice"> صدای مسافرها (اگه مرورگر فارسی بلد باشه)</label>
        <div class="help"><b>کیبورد:</b> W/S یا ↑↓ گاز و ترمز • A/D فرمان • ۱ تا ۷ و R و N دنده • Q/E دنده پایین/بالا • Space ترمز دستی • C دوربین • G فلش راهنما • M نقشه • H بوق • L چراغ • B نیترو • K رادیو • Z گوشی 📱 • O افتخارات • I کوله • V پیاده شدن • X عکاسی • J شرکت تاکسیرانی • U کروز کنترل • F ورود به پمپ/تعمیرگاه</div>
        <label>🔑 کد مخفی <span class="code"><input type="text" inputmode="numeric" maxlength="8" placeholder="مثلاً ۱۵۱۵" data-code><button data-a="code">ثبت</button></span></label>
        <label>🤖 کلید API جمنای (برای چت با مسافر) <span class="code"><input type="password" dir="ltr" placeholder="AIza..." data-gkey><button data-a="gkey">ذخیره</button></span></label>
        <button data-a="photo">📸 حالت عکاسی (X)</button>
        <button data-a="replay">🎬 ریپلی ۱۲ ثانیه آخر (کلید \`)</button>
        <button data-a="reset" class="danger">🗑️ شروع دوباره از اول</button>
      </div>`, (el) => {
      el.querySelector('[data-a=resume]').onclick = () => this.closePanel();
      el.querySelector('[data-a=photo]').onclick = () => {
        this.closePanel();
        g.photo.open();
      };
      el.querySelector('[data-a=replay]').onclick = () => {
        this.closePanel();
        if (g.state === 'pause') g.pause(false);
        g.replay.open();
      };
      const codeIn = el.querySelector('[data-code]');
      const submit = () => {
        if (g.cheat(codeIn.value)) this.closePanel();
        codeIn.value = '';
      };
      el.querySelector('[data-a=code]').onclick = submit;
      const gk = el.querySelector('[data-gkey]');
      gk.value = g.chat.cfg.key;
      gk.onkeydown = (e) => e.stopPropagation();
      el.querySelector('[data-a=gkey]').onclick = () => {
        g.chat.cfg.key = gk.value.trim();
        g.chat.saveCfg();
        this.toast(g.chat.cfg.key ? '🤖 کلید جمنای ذخیره شد' : 'کلید پاک شد؛ چت آفلاین فعاله', 'good');
      };
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
          if (k === 'steer') {
            this.applySteerMode();
            if (v === 'tilt' && typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().catch(() => {});
          }
          g.saveSettings();
        };
      });
    });
    this.onPanelClose = () => g.pause(false);
  }
}
