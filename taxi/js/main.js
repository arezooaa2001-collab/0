import * as THREE from 'three';
import { World, regionAt, REGION_NAMES } from './world.js';
import { Sky } from './sky.js';
import { PlayerCar } from './vehicle.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Rides } from './missions.js';
import { Pedestrians } from './people.js';
import { AudioSys } from './audio.js';
import { Particles } from './effects.js';
import { UI } from './ui.js';
import { buildArrow } from './models.js';
import { OnFoot, normalizeCode } from './onfoot.js';
import { PassengerChat } from './chat.js';
import { Arson } from './arson.js';
import { Weather } from './weather.js';
import { Pickups } from './pickups.js';
import { Achievements } from './achievements.js';
import { Stunts } from './stunts.js';
import { Race } from './race.js';
import { Skids } from './skids.js';
import { Photo } from './photo.js';
import { Props } from './props.js';
import { clamp, damp, dampAngle, wrapAngle, faMoney, fa, lerp, levelFor, levelTitle } from './util.js';

const SAVE_KEY = 'taxiCity.save.v1';
const SET_KEY = 'taxiCity.settings.v1';
const DAY_SECONDS = 720;
const COIN = 10000;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

class Game {
  constructor() {
    this.state = 'loading';
    this.money = 150000;
    this.coins = 0;
    this.day = 1;
    this.hour = 8.5;
    this.stats = { trips: 0, ratingSum: 0, earned: 0 };
    this.camMode = 'third';
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.lookIdle = 0;
    this.guide = null;
    this.guideOn = false;
    this.guideRel = 0;
    this.route = [];
    this.routeT = 0;
    this.shake = 0;
    this.cinematic = false;
    this.zoneAuto = null;
    this.fines = new Map();
    this.time = 0;
    this.driverLook = { female: false, shirt: 0x34495e, pants: 0x222831, mustache: true, skin: 0xe0ac86, hair: 0x1a1210 };
    this.settings = Object.assign(
      { quality: matchMedia('(pointer: coarse)').matches ? 'medium' : 'high', sound: true, voice: true, sens: 1, steer: 'buttons', auto: false, cam: 'third' },
      (() => {
        try {
          return JSON.parse(localStorage.getItem(SET_KEY) || '{}') || {};
        } catch (e) {
          return {};
        }
      })()
    );
  }

  async init() {
    const setLoad = (t, k) => {
      document.getElementById('loadText').textContent = t;
      document.getElementById('loadBar').style.width = k * 100 + '%';
    };
    setLoad('در حال آماده کردن فونت‌ها...', 0.05);
    try {
      await Promise.race([document.fonts.load('bold 40px Vazirmatn'), new Promise((r) => setTimeout(r, 2500))]);
    } catch (e) { /* fonts optional */ }
    await nextFrame();
    const q = this.settings.quality;
    const canvas = document.getElementById('gl');
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q !== 'low', powerPreference: 'high-performance' }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === 'high' ? 2 : q === 'medium' ? 1.35 : 1));
    renderer.shadowMap.enabled = q !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    const scene = (this.scene = new THREE.Scene());
    scene.fog = new THREE.Fog(0xbcd2e6, 160, q === 'low' ? 800 : q === 'medium' ? 1050 : 1350);
    this.fogFar = scene.fog.far;
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 3200);
    this.sky = new Sky();
    scene.add(this.sky.mesh);
    this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5a5040, 0.9);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = q !== 'low';
    const sm = q === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -70;
    sc.right = sc.top = 70;
    sc.near = 1;
    sc.far = 500;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envScene.add(new THREE.Mesh(this.sky.mesh.geometry, this.sky.material));
    this.envT = 0;

    setLoad('در حال ساختن شهر، جاده‌ها، جنگل و کویر...', 0.15);
    await nextFrame();
    this.world = new World(scene, { quality: q });
    setLoad('در حال آماده کردن تاکسی...', 0.6);
    await nextFrame();
    this.audio = new AudioSys();
    this.audio.enabled = this.settings.sound;
    this.audio.voice = this.settings.voice;
    this.player = new PlayerCar(this);
    this.ui = new UI(this);
    setLoad('ماشین‌ها و آدم‌ها دارن میان تو خیابون...', 0.75);
    await nextFrame();
    this.traffic = new Traffic(this, q === 'low' ? 16 : q === 'medium' ? 22 : 28);
    this.police = new Police(this);
    this.rides = new Rides(this);
    this.peds = new Pedestrians(this, q === 'low' ? 8 : 14);
    this.onfoot = new OnFoot(this);
    this.chat = new PassengerChat(this);
    this.arson = new Arson(this);
    this.weather = new Weather(this);
    this.pickups = new Pickups(this);
    this.ach = new Achievements(this);
    this.stunts = new Stunts(this);
    this.race = new Race(this);
    this.skids = new Skids(this);
    this.photo = new Photo(this);
    this.props = new Props(this);
    this.arrow = buildArrow();
    this.player.group.add(this.arrow.group);
    this.fx = {
      smoke: new Particles(scene, { max: 160, color: 0x3a3a3a }),
      dust: new Particles(scene, { max: 260, color: 0xc9b08a }),
      exhaust: new Particles(scene, { max: 120, color: 0x9a9a9a }),
      spark: new Particles(scene, { max: 120, color: 0xffb040, additive: true }),
      nitro: new Particles(scene, { max: 160, color: 0x5aa8ff, additive: true }),
      fire: new Particles(scene, { max: 80, color: 0xff7a1a, additive: true }),
      tyre: new Particles(scene, { max: 140, color: 0xdedede }),
    };
    // nav screen in the dashboard shows the minimap
    const tex = new THREE.CanvasTexture(this.ui.mm);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.navTex = tex;
    this.player.car.screen.material = new THREE.MeshBasicMaterial({ map: tex });
    this.load();
    this.ui.toggleAuto(!!this.settings.auto);
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    this.setCamera(this.settings.cam || 'third', true);
    this.traffic.init(this.player.pos);
    setLoad('آماده!', 1);
    await nextFrame();
    // compile shaders up-front to avoid hitches
    this.updateEnv(0.016, true);
    this.camera.position.set(this.player.pos.x + 8, 4, this.player.pos.z + 8);
    this.camera.lookAt(this.player.pos);
    renderer.compile(scene, this.camera);
    document.getElementById('loading').classList.add('hidden');
    this.state = 'menu';
    this.showMenu();
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
    this.clock = new THREE.Clock();
    this.saveT = 0;
    renderer.setAnimationLoop(() => this.frame());
  }

  /* ---------------- persistence ---------------- */
  save() {
    if (this.resetting) return;
    const p = this.player;
    const d = {
      money: Math.round(this.money), coins: this.coins, day: this.day, hour: this.hour, stats: this.stats,
      fuel: p.fuel, superFuel: p.superFuel, tank: p.tank, health: p.burning ? 100 : p.health, engine: p.engineLevel, paint: p.paintHex ?? null, nitro: p.nitro, model: p.model, owned: p.owned, neon: p.neon || null, paints: p.paints,
      x: p.pos.x, z: p.pos.z, h: p.heading,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch (e) { /* storage may be blocked */ }
  }
  saveSettings() {
    this.settings.cam = this.camMode;
    try { localStorage.setItem(SET_KEY, JSON.stringify(this.settings)); } catch (e) { /* ignore */ }
  }
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { d = null; }
    const p = this.player;
    if (d) {
      this.money = d.money; this.coins = d.coins || 0; this.day = d.day; this.hour = d.hour; this.stats = d.stats;
      p.fuel = d.fuel; p.superFuel = d.superFuel; p.tank = d.tank; p.health = d.health; p.engineLevel = d.engine;
      if (Array.isArray(d.owned)) p.owned = d.owned;
      if (d.paints && typeof d.paints === 'object') p.paints = d.paints;
      if (d.model && d.model !== p.model) p.buildModel(d.model);
      const paint = p.paints[p.model] ?? d.paint;
      if (paint !== null && paint !== undefined) p.setPaint(paint);
      if (d.neon) p.setNeon(d.neon);
      if (d.nitro !== undefined) p.nitro = d.nitro;
      this.hasSave = true;
      if (this.world.roadDist(d.x, d.z) < 9) {
        p.placeAt(d.x, d.z, d.h);
        return;
      }
    }
    p.placeAt(3, 160, Math.PI);
  }
  resetSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    location.reload();
  }

  /* ---------------- flow ---------------- */
  showMenu() {
    const m = document.getElementById('menu');
    m.classList.remove('hidden');
    const cont = document.getElementById('menuContinue');
    cont.classList.toggle('hidden', !this.hasSave);
    if (this.hasSave) cont.querySelector('small').textContent = `${faMoney(this.money)} تومان • روز ${fa(this.day)}`;
    const start = (fresh) => {
      this.audio.init();
      if (fresh && this.hasSave) {
        try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
        location.reload();
        return;
      }
      m.classList.add('hidden');
      this.ui.setHud(true);
      this.state = 'play';
      this.tutorial();
      try {
        if (this.ui.coarse && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      } catch (e) { /* optional */ }
    };
    document.getElementById('menuStart').onclick = () => start(!this.hasSave ? false : true);
    cont.onclick = () => start(false);
  }
  tutorial() {
    if (this.hasSave && this.stats.trips > 0) {
      this.ui.toast('خوش برگشتی! 🚕 منتظر درخواست سفر باش', 'good');
      if (!this.stats.seenV3) {
        this.stats.seenV3 = true;
        setTimeout(() => this.ui.toast('🆕 جدید: مسابقه خیابونی 🏁، پارک پرش 🚀، دریفت 🌀، نمایشگاه ماشین 🏎️ و حالت عکاسی 📸!', 'info'), 3500);
      }
      return;
    }
    this.stats.seenV3 = true;
    const tips = [
      ['به تاکسی‌ران شهر خوش اومدی! 🚕', 0],
      [this.ui.coarse ? 'با دکمه‌های ◀ ▶ فرمون بده، پدال گاز و ترمز سمت راسته' : 'با W/A/S/D یا کلیدهای جهت رانندگی کن', 3.5],
      ['دنده دستیه! روی ۱ تا ۷ بزن؛ راننده خودش با دست دنده رو جا می‌زنه 👋', 7.5],
      ['با دکمه 🎥 برو داخل ماشین و از پشت شیشه رانندگی کن', 12],
      ['به‌زودی یه مسافر درخواست میده. آدرس رو می‌گه؛ اگه بلد نبودی 🧭 رو بزن', 16.5],
      ['روی نقشه 🗺️ دنبال 🏁 مسابقه خیابونی و 🚀 پارک پرش بگرد! با ترمز دستی هم دریفت بزن 🌀', 22],
    ];
    for (const [t, d] of tips) setTimeout(() => this.ui.toast(t, 'info'), d * 1000);
  }
  pause(on) {
    if (on && this.state === 'play') {
      this.state = 'pause';
      this.ui.openMenu();
      this.audio.setEngine(0, 0, false);
      this.audio.siren(false);
      this.audio.setRain(0);
      this.audio.setSkid(0);
      this.audio.setWater(0);
      this.audio.setWind(0, false);
    } else if (!on && this.state === 'pause') {
      this.state = 'play';
      if (this.ui.panelOpen) {
        this.ui.onPanelClose = null;
        this.ui.closePanel();
      }
    }
  }
  fade(to, dur, cb) {
    const f = document.getElementById('fade');
    f.style.transition = `opacity ${dur}s`;
    f.style.opacity = to;
    if (cb) setTimeout(cb, dur * 1000 + 30);
  }
  startJail() {
    this.state = 'jail';
    this.cinematic = false;
    this.audio.siren(false);
    this.audio.setRain(0);
    this.audio.setSkid(0);
    this.audio.setWater(0);
    this.audio.setWind(0, false);
    this.audio.setEngine(0, 0, false);
    this.fade(0, 0.8);
  }
  releaseFromJail() {
    this.fade(1, 0.6, () => {
      const p = this.player, pol = this.world.police;
      if (this.arson.burning) this.arson.restore();
      this.arson.clearVictim();
      p.placeAt(pol.padX, pol.padZ, pol.rot);
      p.driver.root.visible = true;
      p.car.doors.fl.target = 0;
      const paid = this.police.arrestDone();
      this.day += 10;
      this.stats.jailed = (this.stats.jailed || 0) + 1;
      this.hour = 9;
      this.state = 'play';
      this.ui.setHud(true);
      this.cinematic = false;
      this.setCamera(this.camMode, true);
      this.fade(0, 0.8);
      this.ui.toast(`۱۰ روز زندان تموم شد! جریمه: ${faMoney(paid)} تومان`, 'bad');
      setTimeout(() => this.ui.toast('ماشینت توی پارکینگ کلانتریه. دیگه فرار نکن! 😅', 'info'), 1800);
      this.save();
    });
  }

  /* ---------------- camera ---------------- */
  cycleCamera() {
    const order = ['third', 'first', 'far'];
    this.setCamera(order[(order.indexOf(this.camMode) + 1) % order.length]);
  }
  setCamera(mode, silent) {
    this.camMode = mode;
    this.lookYaw = 0;
    this.lookPitch = 0;
    const fp = mode === 'first';
    this.camera.near = fp ? 0.03 : 0.15;
    this.camera.updateProjectionMatrix();
    this.player.driver.head.visible = !fp;
    this.arrow.group.position.set(0, fp ? 1.02 : 2.6, fp ? 0.62 : 0);
    this.arrow.group.scale.setScalar(fp ? 0.075 : 0.85);
    this.camInit = true;
    if (!silent) this.ui.toast(fp ? '👁️ دید اول شخص — داخل ماشین' : mode === 'far' ? '🎥 دید دور' : '🎥 دید سوم شخص', 'info');
    this.saveSettings();
  }
  /** total buying power: cash plus coins (1 coin = 10,000 tomans) */
  /** driver experience: rides, stunts, races and mayhem all level you up */
  addXp(n) {
    const s = this.stats;
    s.xp = (s.xp || 0) + Math.max(0, Math.round(n));
    const lv = levelFor(s.xp);
    if (lv > (s.level || 1)) {
      s.level = lv;
      const reward = lv * 5;
      this.coins += reward;
      this.audio.tone(523, 0.15, 0.15, 'triangle');
      this.audio.tone(659, 0.15, 0.15, 'triangle', 0.12);
      this.audio.tone(784, 0.15, 0.15, 'triangle', 0.24);
      this.audio.tone(1047, 0.4, 0.18, 'triangle', 0.36);
      this.ui.achievement('🎖️', `سطح ${fa(lv)}: «${levelTitle(lv)}»`, reward, '⬆️ سطح جدید!');
      this.save();
    }
  }
  wallet() {
    return this.money + this.coins * COIN;
  }
  /** converts just enough coins into cash so that `cost` can be paid */
  topUp(cost) {
    if (this.money >= cost || this.coins <= 0) return;
    const need = Math.min(this.coins, Math.ceil((cost - this.money) / COIN));
    this.coins -= need;
    this.money += need * COIN;
  }
  /** what the player currently controls (the taxi, or the driver on foot) */
  focus() {
    const f = this.onfoot;
    if (f && f.active) return { pos: f.walker.pos, heading: f.walker.heading, speed: f.speed, onFoot: true };
    return this.player;
  }
  cheat(raw) {
    const code = normalizeCode(raw);
    if (code === '1818') {
      const p = this.player;
      this.coins += 100;
      p.health = 100;
      if (p.fuelTotal() <= 0.01) p.fuel = 5;
      this.audio.cash();
      this.ui.flash();
      this.ui.toast('🪙 کد ۱۸۱۸: ۱۰۰ سکه رایگان گرفتی! (و ماشین هم تعمیر شد ✨)', 'good');
      setTimeout(() => this.ui.toast('هر سکه = ۱۰٬۰۰۰ تومان؛ هر وقت پولت کم بیاد خودکار خرج میشه', 'info'), 1500);
      this.save();
      return true;
    }
    if (code === '1515') {
      const p = this.player;
      this.coins += 1100;
      p.health = 100;
      p.fuel = Math.max(0, p.tank - p.superFuel);
      this.audio.cash();
      this.ui.flash();
      this.ui.toast('🪙 کد ۱۵۱۵: ۱۱۰۰ سکه گرفتی، باک پر شد ⛽ و ماشین تعمیر شد 🔧', 'good');
      this.save();
      return true;
    }
    if (code === '1717') {
      this.ui.toast('🔄 کد ۱۷۱۷: همه تغییرات پاک شد، بازی از اول شروع میشه...', 'warn');
      this.resetting = true;
      try {
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem(SET_KEY);
      } catch (e) { /* storage may be blocked */ }
      this.fade(1, 1, () => location.reload());
      return true;
    }
    this.ui.toast('کد اشتباهه ❌', 'warn');
    return false;
  }
  updateFootCamera(dt) {
    const cam = this.camera, w = this.onfoot.walker;
    const cy = this.onfoot.yaw + this.lookYaw;
    const base = w.root.position;
    if (this.camMode === 'first') {
      cam.position.set(base.x + Math.sin(w.heading) * 0.1, base.y + 1.66, base.z + Math.cos(w.heading) * 0.1);
      cam.rotation.set(this.lookPitch, cy + Math.PI, 0, 'YXZ');
      cam.fov = damp(cam.fov, 72, 3, dt);
    } else {
      const far = this.camMode === 'far';
      const d = far ? 8 : 4.2, hgt = far ? 4 : 1.9;
      this.camYaw = this.camInit ? cy : dampAngle(this.camYaw ?? cy, cy, 8, dt);
      const desired = new THREE.Vector3(base.x - Math.sin(this.camYaw) * d, base.y + hgt - this.lookPitch * 3, base.z - Math.cos(this.camYaw) * d);
      const gy = this.world.heightAt(desired.x, desired.z) + 0.5;
      if (desired.y < gy) desired.y = gy;
      if (this.camInit) cam.position.copy(desired);
      else cam.position.lerp(desired, 1 - Math.exp(-10 * dt));
      cam.lookAt(base.x, base.y + 1.4, base.z);
      cam.fov = damp(cam.fov, 62, 3, dt);
    }
    this.camInit = false;
    cam.updateProjectionMatrix();
  }
  updateCamera(dt) {
    const cam = this.camera, p = this.player;
    if (this.onfoot.active) return this.updateFootCamera(dt);
    if (!this.lookActive && !this.onfoot.active) {
      this.lookIdle += dt;
      if (this.lookIdle > 1.6) {
        this.lookYaw = damp(this.lookYaw, 0, 2.5, dt);
        this.lookPitch = damp(this.lookPitch, 0, 2.5, dt);
      }
    }
    const spd = Math.abs(p.speed);
    if (this.camMode === 'first') {
      const eye = p.driver.head.localToWorld(new THREE.Vector3(0, 0.12, 0.09));
      cam.position.copy(eye);
      const q = p.group.quaternion.clone();
      const e = new THREE.Euler(-0.19 + this.lookPitch, Math.PI + this.lookYaw - p.steer * 0.25, 0, 'YXZ');
      q.multiply(new THREE.Quaternion().setFromEuler(e));
      cam.quaternion.copy(q);
      cam.fov = damp(cam.fov, 76 + spd * 0.12 + (p.nitroOn ? 10 : 0), 3, dt);
    } else {
      const far = this.camMode === 'far';
      const dist = far ? 13 : 7.4, hgt = far ? 5.2 : 2.7;
      const yaw = p.heading + this.lookYaw + (p.speed < -0.5 ? 0 : 0);
      this.camYaw = this.camInit ? yaw : dampAngle(this.camYaw ?? yaw, yaw, 4.5, dt);
      let d = dist;
      const base = p.group.position;
      // pull in when blocked by a building
      const q2 = [];
      const res = { nx: 0, nz: 0, pen: 0 };
      for (let i = 0; i < 6; i++) {
        const x = base.x - Math.sin(this.camYaw) * d, z = base.z - Math.cos(this.camYaw) * d;
        this.world.statics.query(x, z, 1, q2);
        if (!q2.some((o) => o.building && o.t === 1 && Math.abs((x - o.x) * o.c - (z - o.z) * o.s) < o.hx + 0.5 && Math.abs((x - o.x) * o.s + (z - o.z) * o.c) < o.hz + 0.5)) break;
        d *= 0.7;
      }
      void res;
      const desired = new THREE.Vector3(base.x - Math.sin(this.camYaw) * d, base.y + hgt + this.lookPitch * -4, base.z - Math.cos(this.camYaw) * d);
      const gy = this.world.heightAt(desired.x, desired.z) + 0.8;
      if (desired.y < gy) desired.y = gy;
      if (this.camInit) cam.position.copy(desired);
      else cam.position.lerp(desired, 1 - Math.exp(-9 * dt));
      const fwd = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
      const look = base.clone().addScaledVector(fwd, 2.5);
      look.y += 1.3;
      cam.lookAt(look);
      cam.fov = damp(cam.fov, 60 + spd * 0.25 + (p.nitroOn ? 14 : 0), 3, dt);
    }
    this.camInit = false;
    if (this.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.25;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.2;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    cam.updateProjectionMatrix();
  }

  /* ---------------- guidance ---------------- */
  setGuide(g) {
    this.guide = g;
    this.routeT = 0;
  }
  clearGuide() {
    this.guide = null;
    this.route = [];
  }
  toggleGuide() {
    this.guideOn = !this.guideOn;
    this.ui.toast(this.guideOn ? 'فلش راهنما روشن 🧭' : 'فلش راهنما خاموش', 'info');
  }
  updateGuide(dt) {
    const p = this.focus();
    const a = this.arrow;
    if (!this.guide) {
      a.group.visible = false;
      return;
    }
    this.routeT -= dt;
    if (this.routeT <= 0) {
      this.route = this.world.route(p.pos.x, p.pos.z, this.guide.x, this.guide.z);
      this.routeT = 1;
    }
    // drop passed points
    while (this.route.length > 1 && Math.hypot(this.route[0].x - p.pos.x, this.route[0].z - p.pos.z) < 14) this.route.shift();
    let dist = 0, prev = p.pos;
    for (const q of this.route) {
      dist += Math.hypot(q.x - prev.x, q.z - prev.z);
      prev = q;
    }
    this.guideDist = dist;
    if (this.guide.custom && Math.hypot(this.guide.x - p.pos.x, this.guide.z - p.pos.z) < 22) {
      this.clearGuide();
      if (this.guidePrev !== undefined) {
        this.guideOn = this.guidePrev;
        this.guidePrev = undefined;
        document.getElementById('btnGuide').classList.toggle('active', this.guideOn);
      }
      this.ui.toast('📍 به مقصد دلخواهت رسیدی!', 'good');
      this.audio.cash();
      return;
    }
    // look-ahead point
    let tgt = this.route[this.route.length - 1] || this.guide;
    let acc = 0;
    prev = p.pos;
    for (const q of this.route) {
      acc += Math.hypot(q.x - prev.x, q.z - prev.z);
      prev = q;
      if (acc > 22) { tgt = q; break; }
    }
    const heading = Math.atan2(tgt.x - p.pos.x, tgt.z - p.pos.z);
    this.guideRel = wrapAngle(heading - p.heading);
    a.group.visible = this.guideOn && this.state === 'play' && !this.onfoot.active;
    a.group.rotation.y = this.guideRel;
    a.mat.opacity = 0.75 + Math.sin(this.time * 5) * 0.2;
    a.group.position.y = (this.camMode === 'first' ? 1.02 : 2.6) + Math.sin(this.time * 3) * (this.camMode === 'first' ? 0.005 : 0.08);
  }

  /* ---------------- zones (stations, garages, cameras) ---------------- */
  zoneAction() {
    const z = this.currentZone;
    if (!z || this.state !== 'play') return;
    if (z.kind === 'enter') return this.onfoot.enter();
    if (z.kind === 'gas') this.ui.openStation(z);
    else if (z.kind === 'garage') this.ui.openGarage(z);
    else if (z.kind === 'police') this.ui.openPolice();
    else if (z.kind === 'race') this.race.offer(z);
    else if (z.kind === 'fuelHelp') {
      const cost = 80000;
      this.topUp(cost);
      if (this.money >= cost) {
        this.money -= cost;
        this.ui.toast('امداد خودرو ۸ لیتر بنزین آورد ⛽', 'good');
      } else this.ui.toast('امداد خودرو دلش سوخت و مجانی ۸ لیتر بنزین داد 😅', 'info');
      this.player.fuel += 8;
      this.audio.cash();
    } else if (z.kind === 'tow') {
      if (this.towing) return;
      this.towing = true;
      const cost = 150000;
      this.topUp(cost);
      this.money = Math.max(0, this.money - cost);
      let best = this.world.garages[0], bd = Infinity;
      for (const gr of this.world.garages) {
        const d = Math.hypot(gr.padX - this.player.pos.x, gr.padZ - this.player.pos.z);
        if (d < bd) { bd = d; best = gr; }
      }
      this.fade(1, 0.4, () => {
        this.player.placeAt(best.padX, best.padZ, best.rot);
        this.player.health = 25;
        this.towing = false;
        this.fade(0, 0.6);
        this.ui.toast('یدک‌کش ماشین رو آورد تعمیرگاه 🛻', 'info');
      });
    }
  }
  updateZones(dt) {
    const p = this.player, w = this.world;
    const sp = (p.groundSpeed ?? Math.abs(p.speed));
    let zone = null;
    if (this.onfoot.active || this.onfoot.busy) {
      this.currentZone = this.onfoot.active && !this.onfoot.busy && !this.player.burning && this.onfoot.nearCar() ? { kind: 'enter' } : null;
      this.ui.zone(this.currentZone ? '🚗 سوار ماشین شو' : null);
      return;
    }
    for (const s of [...w.stations, ...w.garages, w.police, ...(this.race.state === 'idle' ? this.race.spots : [])]) {
      if (Math.hypot(p.pos.x - s.padX, p.pos.z - s.padZ) < 12) zone = s;
    }
    // stranded: roadside help beats every pad except a pump or a garage that can fix it right here
    const pad = zone && (zone.kind === 'gas' || zone.kind === 'garage');
    if (!pad && p.fuelTotal() <= 0.01) zone = { kind: 'fuelHelp' };
    else if (!pad && p.health <= 0) zone = { kind: 'tow' };
    this.currentZone = zone;
    if (zone && !this.ui.panelOpen) {
      const txt = zone.kind === 'gas' ? '⛽ بزن تا بنزین بزنی' : zone.kind === 'garage' ? '🔧 تعمیر و ارتقای ماشین' : zone.kind === 'police' ? '🚓 کلانتری' : zone.kind === 'race' ? `🏁 ${zone.name} • مسابقه بده!` : zone.kind === 'fuelHelp' ? '⛽ بنزین تموم شد! زنگ بزن امداد خودرو (۸۰٬۰۰۰)' : '🛻 ماشین خراب شد! یدک‌کش تا تعمیرگاه (۱۵۰٬۰۰۰)';
      this.ui.zone(txt);
      this.stopT = sp < 0.6 && !this.ui.controlsHeld() ? (this.stopT || 0) + dt : 0;
      if (this.stopT > 0.5 && this.zoneAuto !== zone && (zone.kind === 'gas' || zone.kind === 'garage')) {
        this.zoneAuto = zone;
        this.zoneAction();
      }
    } else this.ui.zone(null);
    if (!zone) this.zoneAuto = null;

    // speed cameras
    for (const c of w.speedCams) {
      const d = Math.hypot(p.pos.x - c.x, p.pos.z - c.z);
      const kmh = sp * 3.6;
      if (d < 18 && kmh > c.limit + 10 && !this.fineCooling('cam' + c.x, 20)) this.fine(120000, `📸 دوربین سرعت! ${fa(Math.round(kmh))} km/h در ${c.name}`);
    }
    // red light cameras
    for (const n of w.lightNodes) {
      const dx = p.pos.x - n.x, dz = p.pos.z - n.z;
      const inside = Math.abs(dx) < 6 && Math.abs(dz) < 6;
      if (!inside) {
        if (this.inNode === n) this.inNode = null;
        continue;
      }
      if (this.inNode === n) continue;
      this.inNode = n;
      if (!n.redCam || sp < 4) continue;
      const vx = Math.sin(p.heading), vz = Math.cos(p.heading);
      const axis = Math.abs(vx) > Math.abs(vz) ? 'x' : 'z';
      if (w.lightState(n, axis, this.time) === 'r' && !this.fineCooling('red' + n.id, 8)) this.fine(150000, '📸 جریمه عبور از چراغ قرمز!');
    }
  }
  fineCooling(key, sec) {
    const t = this.fines.get(key);
    if (t && this.time - t < sec) return true;
    this.fines.set(key, this.time);
    return false;
  }
  fine(amount, msg) {
    this.topUp(amount);
    this.money = Math.max(0, this.money - amount);
    this.ui.flash();
    this.audio.bad();
    this.ui.toast(`${msg} — ${faMoney(amount)} تومان`, 'bad');
  }
  honk() {
    // people nearby look / step away
    if (this.rides.ride && this.rides.state === 'toPickup') {
      const w = this.rides.ride.walker;
      if (Math.hypot(w.pos.x - this.player.pos.x, w.pos.z - this.player.pos.z) < 80) this.ui.say(this.rides.ride.o.name, 'دیدمتون! اینجام! 👋', { female: this.rides.ride.o.female });
    }
  }
  onTrafficHit(car, impact) {
    if (impact > 3.2 && this.police.state === 'none' && this.state === 'play') this.police.startIncident(car, impact);
  }

  /* ---------------- environment ---------------- */
  updateEnv(dt, force) {
    const env = (this.env = this.sky.update(this.hour, dt));
    const p = this.player.pos;
    this.sun.color.copy(env.sunColor).lerp(new THREE.Color(1, 1, 1), 0.5);
    this.sun.intensity = env.sunI;
    const sd = env.sunDir.y > 0.05 ? env.sunDir : new THREE.Vector3(-env.sunDir.x, 0.6, 0.3).normalize();
    const T = 140 / (this.sun.shadow.mapSize.x || 1024);
    const tx = Math.round(p.x / T) * T, tz = Math.round(p.z / T) * T;
    this.sun.position.set(tx + sd.x * 200, sd.y * 200, tz + sd.z * 200);
    this.sun.target.position.set(tx, 0, tz);
    this.hemi.intensity = env.hemi;
    this.hemi.color.copy(this.sky.uniforms.top.value).lerp(env.night > 0.5 ? new THREE.Color(0.55, 0.62, 0.9) : new THREE.Color(1, 1, 1), 0.55);
    this.hemi.groundColor.setRGB(0.32, 0.29, 0.24).multiplyScalar(0.4 + env.hemi);
    this.scene.fog.color.copy(env.fog);
    this.renderer.toneMappingExposure = 1.0 + env.night * 0.35;
    this.envT -= dt;
    if (force || this.envT <= 0) {
      this.envT = this.settings.quality === 'low' ? 60 : 12;
      const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 3000);
      if (this.envRT) this.envRT.dispose();
      this.envRT = rt;
      this.scene.environment = rt.texture;
      this.envBase = 0.35 + (1 - env.night) * 0.65;
    }
    // storms dim the reflections too
    this.scene.environmentIntensity = this.envBase * (1 - 0.6 * (this.weather ? this.weather.cloud : 0));
  }

  /* ---------------- effects ---------------- */
  updateFx(dt) {
    const p = this.player, fx = this.fx;
    const s = Math.sin(p.heading), c = Math.cos(p.heading);
    const sp = Math.abs(p.speed);
    if (p.throttle > 0.2 && Math.random() < p.throttle * 0.7 && this.state === 'play') {
      const x = p.pos.x - s * 2.35 + c * 0.5, z = p.pos.z - c * 2.35 - s * 0.5;
      fx.exhaust.emit(x, p.y + 0.3, z, -s * 1.5 + (Math.random() - 0.5), 0.6, -c * 1.5 + (Math.random() - 0.5), 0.9, 0.25, 4, 0.35);
    }
    if (p.offroad && sp > 4) {
      const n = Math.min(3, sp / 8);
      for (let i = 0; i < n; i++) {
        const side = Math.random() < 0.5 ? 1 : -1;
        const x = p.pos.x - s * 1.5 + c * side * 0.8, z = p.pos.z - c * 1.5 - s * side * 0.8;
        const sand = regionAt(p.pos.x, p.pos.z) === 'desert';
        fx.dust.uniforms.uColor.value.setHex(sand ? 0xd2b582 : 0x8a7a5a);
        fx.dust.emit(x, p.y + 0.2, z, (Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2, 1.4, 0.9, 3, sand ? 0.45 : 0.25);
      }
    }
    if (p.health < 35 && Math.random() < 0.5) {
      const x = p.pos.x + s * 1.8, z = p.pos.z + c * 1.8;
      fx.smoke.emit(x, p.y + 1, z, (Math.random() - 0.5) * 0.5, 1.6, (Math.random() - 0.5) * 0.5, 2.2, 0.6, 4, p.health < 15 ? 0.7 : 0.4);
    }
    fx.smoke.update(dt);
    fx.dust.update(dt);
    fx.exhaust.update(dt);
    fx.spark.update(dt, 9.8);
    if (p.nitroOn) {
      for (const side of [0.5, 0.35]) {
        const x = p.pos.x - s * 2.4 + c * side, z = p.pos.z - c * 2.4 - s * side;
        fx.nitro.emit(x, p.y + 0.3, z, -s * 6 + (Math.random() - 0.5), 0.3, -c * 6 + (Math.random() - 0.5), 0.25, 0.45, -0.5, 0.9, 1);
      }
    }
    fx.nitro.update(dt);
    // tyre marks + squeal + smoke
    const marking = this.skids.update();
    const slide = marking ? Math.min(1, (sp + Math.hypot(p.ext.x, p.ext.y)) / 22) : 0;
    this.audio.setSkid(this.state === 'play' && sp + Math.hypot(p.ext.x, p.ext.y) > 5 ? slide : 0);
    if (marking && Math.random() < slide * 0.9) {
      const side = Math.random() < 0.5 ? 0.74 : -0.74, rr = (p.car.P.wheelZ || 1.4);
      const x = p.pos.x - s * rr - c * side, z = p.pos.z - c * rr + s * side;
      fx.tyre.emit(x, p.y + 0.25, z, (Math.random() - 0.5) * 1.5, 0.8 + Math.random(), (Math.random() - 0.5) * 1.5, 1.6, 0.8, 4, 0.35);
    }
    fx.tyre.update(dt);
    // exhaust backfire on fast upshifts and when lifting off at high revs
    const gas = this.lastInput ? this.lastInput.gas : 0, g0 = this.prevGas ?? 0;
    const upshift = p.shift && !this.prevShift && p.targetGear > p.gear && p.gear >= 1;
    if (this.state === 'play' && !this.onfoot.active && ((upshift && p.rpm > 4300 && sp > 9) || (g0 > 0.8 && gas < 0.1 && p.rpm > 5000 && Math.random() < 0.6))) this.backfire();
    this.prevShift = !!p.shift;
    this.prevGas = gas;
    fx.fire.update(dt, -2);
  }
  backfire() {
    const p = this.player, fx = this.fx;
    const s = Math.sin(p.heading), c = Math.cos(p.heading);
    const back = p.car.P.len / 2 + 0.1;
    const pipes = p.model === 'sport' ? [0.35, -0.35] : [0.5];
    for (const side of pipes) {
      const x = p.pos.x - s * back + c * side, z = p.pos.z - c * back - s * side;
      for (let i = 0; i < 7; i++) fx.fire.emit(x, p.y + 0.32, z, -s * (3 + Math.random() * 4) + (Math.random() - 0.5), 0.2 + Math.random() * 0.6, -c * (3 + Math.random() * 4) + (Math.random() - 0.5), 0.12 + Math.random() * 0.12, 0.35 + Math.random() * 0.3, 1.5, 1, 2);
    }
    this.audio.backfire(0.7 + Math.random() * 0.5);
  }
  crashFx(e) {
    const p = this.player;
    const s = Math.sin(p.heading), c = Math.cos(p.heading);
    const n = Math.min(40, e.impact * 4);
    const x = p.pos.x + s * 2, z = p.pos.z + c * 2;
    for (let i = 0; i < n; i++) this.fx.spark.emit(x, p.y + 0.6, z, (Math.random() - 0.5) * 8, Math.random() * 5, (Math.random() - 0.5) * 8, 0.5 + Math.random() * 0.4, 0.07, 0, 1, 0.5);
    this.shake = Math.min(1.2, e.impact / 8);
    this.audio.crash(e.impact);
    if (e.impact > 5 && (!this.lastDmgToast || this.time - this.lastDmgToast > 3)) {
      this.lastDmgToast = this.time;
      this.ui.toast(`💥 ماشین آسیب دید! سلامت: ${fa(Math.round(p.health))}٪`, 'bad');
    }
  }

  /* ---------------- loop ---------------- */
  onResize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.police.jail.camera.aspect = w / h;
    this.police.jail.camera.updateProjectionMatrix();
    const ph = h * this.renderer.getPixelRatio();
    for (const k in this.fx) this.fx[k].setScale(ph, 65);
    this.arson.setScale(ph, 65);
    if (this.props) this.props.water.setScale(ph, 65);
  }
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta()) * (this.timeScale || 1) * (this.state === 'play' ? this.slowmo || 1 : 1);
    const st = this.state;
    this.audio.update(dt);
    if (st === 'jail') {
      this.police.update(dt);
      this.ui.update(dt);
      this.renderer.render(this.police.jail.scene, this.police.jail.camera);
      return;
    }
    if (st === 'menu') {
      this.time += dt;
      this.updateEnv(dt);
      this.world.update(dt, this.env, this.time);
      this.player.update(dt, { steer: 0, gas: 0, brake: 1, handbrake: true }, this.world, [], false);
      const a = this.time * 0.15;
      const p = this.player.pos;
      this.camera.position.set(p.x + Math.sin(a) * 9, p.y + 2.6, p.z + Math.cos(a) * 9);
      this.camera.lookAt(p.x, p.y + 0.9, p.z);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (st === 'pause') {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (st === 'photo') {
      this.photo.update(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.time += dt;
    this.hour += (dt * 24) / DAY_SECONDS;
    if (this.hour >= 24) {
      this.hour -= 24;
      this.day++;
      this.ui.toast(`🌅 روز ${fa(this.day)} شروع شد`, 'info');
    }
    this.updateEnv(dt);
    this.weather.update(dt);
    this.world.update(dt, this.env, this.time);
    const inp = this.ui.input();
    this.lastInput = inp;
    const driving = st === 'play' && !this.onfoot.active && !this.onfoot.busy;
    if (st === 'play') this.onfoot.update(dt, inp);
    if (driving) {
      this.player.update(dt, inp, this.world, this.traffic.dynamics(), true);
      for (const e of this.player.events) {
        if (e.type === 'crash') {
          this.crashFx(e);
          this.rides.onCrash(e.impact);
        }
      }
    } else {
      this.player.update(dt, inp, this.world, [], false);
    }
    this.traffic.update(dt, this.time);
    this.police.update(dt);
    if (this.state === 'jail') return;
    this.arson.update(dt);
    this.race.update(dt);
    if (st === 'play') {
      this.pickups.update(dt);
      this.props.update(dt);
      this.stunts.update(dt);
      this.ach.track(dt);
    }
    this.rides.update(dt);
    this.chat.update(dt);
    this.peds.update(dt);
    if (st === 'play') this.updateZones(dt);
    this.updateGuide(dt);
    this.updateFx(dt);
    const p = this.player;
    this.audio.setEngine(p.rpm, p.throttle, p.health > 0 && p.fuelTotal() > 0);
    this.audio.setWind((p.groundSpeed ?? Math.abs(p.speed)), p.offroad);
    if (!this.cinematic || st === 'play') this.updateCamera(dt);
    this.sky.mesh.position.copy(this.camera.position);
    this.ui.update(dt);
    this.saveT += dt;
    if (this.saveT > 10 && st === 'play') {
      this.saveT = 0;
      this.save();
    }
    this.renderer.render(this.scene, this.camera);
  }
}

const game = new Game();
window.game = game;
game.init().catch((e) => {
  console.error(e);
  const lt = document.getElementById('loadText');
  if (lt) lt.textContent = 'خطا در اجرای بازی: ' + e.message;
});
