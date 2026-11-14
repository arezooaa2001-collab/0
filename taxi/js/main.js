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
import { Fireworks } from './fireworks.js';
import { Crazy } from './crazy.js';
import { Heli } from './heli.js';
import { Thrills } from './thrills.js';
import { Parking } from './parking.js';
import { Fleet } from './fleet.js';
import { Ambient } from './ambient.js';
import { Post } from './post.js';
import { CarLights } from './lights.js';
import { Nature } from './nature.js';
import { RoadLife } from './roadlife.js';
import { Career } from './career.js';
import { Drag } from './drag.js';
import { RoadEvents } from './events.js';
import { Replay } from './replay.js';
import { Bounty } from './bounty.js';
import { Extras } from './extras.js';
import { Phone } from './phone.js';
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
    const q0 = this.settings.quality;
    const q = q0 === 'ultra' ? 'high' : q0; // ultra = high world detail + full post effects + sharper shadows
    const canvas = document.getElementById('gl');
    // medium and up render through the post chain, whose scene target is multisampled already;
    // without float targets the chain switches off, so the canvas itself must anti-alias then
    let floatOk = false;
    try {
      const tc = document.createElement('canvas').getContext('webgl2');
      floatOk = !!tc && !!(tc.getExtension('EXT_color_buffer_half_float') || tc.getExtension('EXT_color_buffer_float'));
      const lose = tc && tc.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    } catch (e) { floatOk = false; }
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q !== 'low' && !floatOk, powerPreference: 'high-performance' }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === 'high' ? 2 : q === 'medium' ? 1.35 : 1));
    this.post = new Post(renderer, { low: 0, medium: 1, high: 2, ultra: 3 }[q0] ?? 0);
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
    const sm = q0 === 'ultra' ? 4096 : q === 'high' ? 2048 : 1024;
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
    this.trafficBase = q === 'low' ? 16 : q === 'medium' ? 22 : 28;
    // the pool has room for rush hour; how many drive at once depends on the time of day
    this.traffic = new Traffic(this, Math.round(this.trafficBase * 1.4));
    this.traffic.setCount(this.trafficBase);
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
    this.fireworks = new Fireworks(this);
    this.crazy = new Crazy(this);
    this.heli = new Heli(this);
    this.thrills = new Thrills(this);
    this.parking = new Parking(this);
    this.fleet = new Fleet(this);
    this.drag = new Drag(this);
    this.events = new RoadEvents(this);
    this.replay = new Replay(this);
    this.bounty = new Bounty(this);
    this.extras = new Extras(this);
    this.ambient = new Ambient(this);
    this.carLights = new CarLights(this);
    this.nature = new Nature(this);
    this.roadLife = new RoadLife(this);
    this.career = new Career(this);
    this.phone = new Phone(this);
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
    // boards show the loaded records
    for (const t of this.thrills.traps) this.thrills.drawTrap(t, null);
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
      fuel: p.fuel, superFuel: p.superFuel, tank: p.tank, health: p.burning ? 100 : p.health, engine: p.engineLevel, paint: p.paintHex ?? null, nitro: p.nitro, model: p.model, owned: p.owned, neon: p.neon || null, paints: p.paints, mods: { tint: p.tint || 0, rim: p.rim || 'silver', plate: p.plateText || '', spoiler: !!p.spoiler, exhaust: !!p.sportExhaust, livery: p.livery || '', owned: p.modsOwned || [] }, dirt: +(p.dirt || 0).toFixed(2), horn: p.horn, horns: p.horns, perf: p.perf || [], flat: !!p.flat, otherTank: p.otherTank || null,
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
      p.perf = Array.isArray(d.perf) ? d.perf : [];
      p.flat = !!d.flat;
      if (d.otherTank && typeof d.otherTank === 'object') p.otherTank = { fuel: +d.otherTank.fuel || 0, superFuel: +d.otherTank.superFuel || 0 };
      if (d.model && d.model !== p.model) p.buildModel(d.model);
      else p.applyPerf();
      const paint = p.paints[p.model] ?? d.paint;
      if (paint !== null && paint !== undefined) p.setPaint(paint);
      if (d.neon) p.setNeon(d.neon);
      if (d.mods) {
        p.tint = d.mods.tint || 0;
        p.rim = d.mods.rim || 'silver';
        p.plateText = d.mods.plate || '';
        p.spoiler = !!d.mods.spoiler;
        p.livery = typeof d.mods.livery === 'string' ? d.mods.livery : '';
        p.sportExhaust = this.audio.sportExhaust = !!d.mods.exhaust;
        p.modsOwned = Array.isArray(d.mods.owned) ? d.mods.owned : [];
        p.applyMods();
      }
      if (d.dirt) {
        p.dirt = d.dirt;
        p.dirtWarned = d.dirt > 0.6;
        p.applyDirt();
      }
      if (Array.isArray(d.horns)) p.horns = d.horns;
      if (d.horn && p.horns.includes(d.horn)) p.setHorn(d.horn);
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
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem('taxiCity.ghosts.v1');
    } catch (e) { /* ignore */ }
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
        try {
          localStorage.removeItem(SAVE_KEY);
          localStorage.removeItem('taxiCity.ghosts.v1');
        } catch (e) { /* ignore */ }
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
  /** a little present for coming back every day (streaks grow the gift) */
  /** a new in-game day: keep a week of earnings for the bank app, the rival drivers work too */
  newDay() {
    const s = this.stats;
    s.hist = (Array.isArray(s.hist) ? s.hist : []).concat([s.today || 0]).slice(-6);
    s.today = 0;
    this.career.board();
    const r = this.career.rank();
    this.career.message('اتحادیه تاکسی‌رانی', `📊 گزارش روز ${fa(this.day - 1)}: الان نفر ${fa(r)} رتبه‌بندی راننده‌های شهری${r === 1 ? ' 👑' : '. ادامه بده!'}`, true);
  }
  loginBonus() {
    const s = this.stats, d = new Date();
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (s.lastLogin === key) return;
    const y = new Date(d.getTime() - 86400000);
    const yKey = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
    s.streak = s.lastLogin === yKey ? (s.streak || 0) + 1 : 1;
    s.lastLogin = key;
    const gift = Math.min(7, s.streak) * 5;
    this.coins += gift;
    setTimeout(() => this.ui.achievement('🎁', `هدیه ورود روزانه • روز ${fa(s.streak)} پشت سر هم`, gift, '📅 خوش اومدی!'), 2500);
    this.save();
  }
  tutorial() {
    this.loginBonus();
    if (this.hasSave && this.stats.trips > 0) {
      this.ui.toast('خوش برگشتی! 🚕 منتظر درخواست سفر باش', 'good');
      if (!this.stats.seenV3) {
        this.stats.seenV3 = true;
        setTimeout(() => this.ui.toast('🆕 جدید: مسابقه خیابونی 🏁، پارک پرش 🚀، دریفت 🌀، نمایشگاه ماشین 🏎️ و حالت عکاسی 📸!', 'info'), 3500);
      }
      if (!this.stats.seenV10) {
        this.stats.seenV10 = true;
        setTimeout(() => this.ui.toast('🆕 جدید: 🎬 ریپلی سینمایی، 🎯 شکار مجرم‌های فراری، 🚧 میخ پلیس، 🌀 چرخش ۳۶۰ توی هوا، 📻 خبر رادیو، 🎆 جشن شب جمعه، 🌈 رنگین‌کمان و 🔥 برچسب بدنه!', 'info'), 35000);
      }
      if (!this.stats.seenV9) {
        this.stats.seenV9 = true;
        setTimeout(() => this.ui.toast('🆕 جدید: 📱 گوشی (Z) با 📖 حالت داستانی و رتبه‌بندی، 🚦 پیست درگ کویر، 🚗 ۴ ماشین جدید (برقی، شاسی‌بلند، لیموزین، پیکان)، 🏁 قطعات مسابقه‌ای، 🚑 آمبولانس، 🆘 ماشین خراب و 🍔 غذارسانی!', 'info'), 30500);
      }
      if (!this.stats.seenV8) {
        this.stats.seenV8 = true;
        setTimeout(() => this.ui.toast('🆕 جدید: ✨ گرافیک سینمایی (کیفیت «خیلی بالا» از منو)، 🚦 راهنما و چراغ‌های ماشین‌ها، 🛠️ تیونینگ، 🎚️ کروز کنترل، 💍 عروسی، 🚧 راه‌بندان پلیس، 👽 بشقاب پرنده و کلی چیز دیگه!', 'info'), 26000);
      }
      if (!this.stats.seenV7) {
        this.stats.seenV7 = true;
        setTimeout(() => this.ui.toast('🆕 جدید: 🎬 دوربین تلویزیونی و دوربین سپر (دکمه 🎥)، 🚕 تاکسیمتر، 🚦 ساعت شلوغی، ✈️ هواپیما، 🐦 پرنده‌ها و 🎈 بالن‌های کویر!', 'info'), 21500);
      }
      if (!this.stats.seenV6) {
        this.stats.seenV6 = true;
        setTimeout(() => this.ui.toast('🆕 جدید: 💼 شرکت تاکسیرانی خودت، 🧽 کارواش، 📯 بوق‌های باحال، 📸 مسافر توریست، 👻 ماشین شبح توی مسابقه، 🌪️ طوفان شن و 📡 هشدار دوربین!', 'info'), 17000);
      }
      if (!this.stats.seenV5) {
        this.stats.seenV5 = true;
        setTimeout(() => this.ui.toast('🆕 جدید: 🅿️ چالش پارک، 🔥 حلقه‌های آتیش توی پارک پرش، ⚡ سکوهای بوست، 🗿 ۱۲ مجسمه طلایی مخفی، ❄️ برف توی کوهستان و 📻 رادیو الکترو!', 'info'), 12500);
      }
      if (!this.stats.seenV4) {
        this.stats.seenV4 = true;
        setTimeout(() => this.ui.toast('🆕 جدید: 🔥 تاکسی دیوانه (روی نقشه)، 😱 «نزدیک بود!»، 🎆 آتش‌بازی، 🚁 هلی‌کوپتر پلیس و 📅 چالش‌های روزانه!', 'info'), 8000);
      }
      return;
    }
    this.stats.seenV3 = true;
    this.stats.seenV4 = true;
    this.stats.seenV5 = true;
    this.stats.seenV6 = true;
    this.stats.seenV7 = true;
    this.stats.seenV8 = true;
    this.stats.seenV9 = true;
    this.stats.seenV10 = true;
    const tips = [
      ['به تاکسی‌ران شهر خوش اومدی! 🚕', 0],
      [this.ui.coarse ? 'با دکمه‌های ◀ ▶ فرمون بده، پدال گاز و ترمز سمت راسته' : 'با W/A/S/D یا کلیدهای جهت رانندگی کن', 3.5],
      ['دنده دستیه! روی ۱ تا ۷ بزن؛ راننده خودش با دست دنده رو جا می‌زنه 👋', 7.5],
      ['با دکمه 🎥 برو داخل ماشین و از پشت شیشه رانندگی کن', 12],
      ['به‌زودی یه مسافر درخواست میده. آدرس رو می‌گه؛ اگه بلد نبودی 🧭 رو بزن', 16.5],
      ['روی نقشه 🗺️ دنبال 🏁 مسابقه خیابونی، 🔥 تاکسی دیوانه و 🚀 پارک پرش بگرد! با ترمز دستی هم دریفت بزن 🌀', 22],
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
      this.audio.setHeli(0);
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
    this.audio.setHeli(0);
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
    const order = ['third', 'first', 'far', 'bumper', 'tv'];
    this.setCamera(order[(order.indexOf(this.camMode) + 1) % order.length]);
  }
  setCamera(mode, silent) {
    this.camMode = mode;
    this.lookYaw = 0;
    this.lookPitch = 0;
    const fp = mode === 'first';
    this.camera.near = fp ? 0.03 : 0.15;
    this.camera.updateProjectionMatrix();

    // where the guide arrow floats: dashboard in first person, ahead of the bonnet for the bumper cam, above the roof otherwise
    const bump = mode === 'bumper';
    this.arrowY = fp ? 1.02 : bump ? 1.15 : 2.6;
    this.arrow.group.position.set(0, this.arrowY, fp ? 0.62 : bump ? this.player.car.P.len / 2 + 4 : 0);
    this.arrow.group.scale.setScalar(fp ? 0.075 : bump ? 0.35 : 0.85);
    this.camInit = true;
    this.tvCam = null;
    if (!silent) this.ui.toast(fp ? '👁️ دید اول شخص — داخل ماشین' : mode === 'far' ? '🎥 دید دور' : mode === 'bumper' ? '🎥 دوربین سپر — خیلی نزدیک به جاده!' : mode === 'tv' ? '🎬 دوربین تلویزیونی — مثل پخش زنده مسابقه!' : '🎥 دید سوم شخص', 'info');
    this.saveSettings();
  }
  /** total buying power: cash plus coins (1 coin = 10,000 tomans) */
  /** driver experience: rides, stunts, races and mayhem all level you up */
  addXp(n) {
    const s = this.stats;
    s.xp = (s.xp || 0) + Math.max(0, Math.round(n));
    const lv = levelFor(s.xp);
    if (lv > (s.level || 1)) {
      let reward = 0;
      for (let l = (s.level || 1) + 1; l <= lv; l++) reward += l * 5;
      s.level = lv;
      this.coins += reward;
      this.audio.tone(523, 0.15, 0.15, 'triangle');
      this.audio.tone(659, 0.15, 0.15, 'triangle', 0.12);
      this.audio.tone(784, 0.15, 0.15, 'triangle', 0.24);
      this.audio.tone(1047, 0.4, 0.18, 'triangle', 0.36);
      this.ui.achievement('🎖️', `سطح ${fa(lv)}: «${levelTitle(lv)}»`, reward, '⬆️ سطح جدید!');
      const p = this.player;
      this.fireworks.show(p.pos.x + Math.sin(p.heading) * 170, p.pos.z + Math.cos(p.heading) * 170, 6);
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
        localStorage.removeItem('taxiCity.ghosts.v1');
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
    if (this.camMode === 'bumper') {
      // low camera on the front bumper
      const T = this._camTmp || (this._camTmp = { v: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, 'YXZ') });
      cam.position.copy(T.v.set(0, 0.62, p.car.P.len / 2 + 0.15).applyQuaternion(p.group.quaternion).add(p.group.position));
      T.e.set(-0.04 + this.lookPitch, Math.PI + this.lookYaw, 0, 'YXZ');
      cam.quaternion.copy(p.group.quaternion).multiply(T.q.setFromEuler(T.e));
      cam.fov = damp(cam.fov, 72 + spd * 0.3 + (p.nitroOn ? 14 : 0), 3, dt);
    } else if (this.camMode === 'tv') {
      this.updateTvCamera(dt);
    } else if (this.camMode === 'first') {
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

  setCruise(on) {
    const p = this.player;
    this.cruise = on && p.speed > 6 && !this.onfoot.active ? p.speed : 0;
    document.getElementById('btnCruise').classList.toggle('active', !!this.cruise);
    this.ui.toast(this.cruise ? `🎚️ کروز کنترل روی ${fa(Math.round(this.cruise * 3.6))} km/h` : '🎚️ کروز کنترل خاموش', 'info');
  }
  /** busy streets at rush hour, quiet roads late at night */
  updateRushHour(dt) {
    this.rushT = (this.rushT || 0) - dt;
    if (this.rushT > 0 || this.state !== 'play') return;
    this.rushT = 3;
    const h = this.hour;
    const rush = (h >= 7 && h < 9.5) || (h >= 17 && h < 20);
    const k = rush ? 1.4 : h >= 23 || h < 5 ? 0.5 : 1;
    this.traffic.setCount(Math.round(this.trafficBase * k));
    if (rush !== this.wasRush) {
      if (rush && this.wasRush !== undefined) this.ui.toast('🚦 ساعت شلوغی! خیابون‌ها پر از ماشینه', 'info');
      this.wasRush = rush;
    }
  }
  /** roadside "live broadcast" cameras: one waits ahead, follows the car past, then cuts to the next */
  updateTvCamera(dt) {
    const cam = this.camera, p = this.player, w = this.world;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const tc = this.tvCam;
    const d = tc ? Math.hypot(tc.x - p.pos.x, tc.z - p.pos.z) : Infinity;
    const behind = tc ? (tc.x - p.pos.x) * fx + (tc.z - p.pos.z) * fz < -45 : true;
    if (!tc || behind || d > 160 || this.camInit) {
      // place the next camera ahead, off to one side
      const ahead = 35 + Math.min(60, Math.abs(p.speed) * 1.6);
      const side = Math.random() < 0.5 ? 1 : -1;
      let x = p.pos.x + fx * ahead + fz * side * (8 + Math.random() * 6), z = p.pos.z + fz * ahead - fx * side * (8 + Math.random() * 6);
      let h = 1.6 + Math.random() * 3.5;
      const q = [];
      w.statics.query(x, z, 2, q);
      if (q.some((o) => o.building)) h = 22 + Math.random() * 10; // rooftop camera in the city
      this.tvCam = { x, z, y: w.heightAt(x, z) + h };
      cam.position.set(this.tvCam.x, this.tvCam.y, this.tvCam.z);
    }
    const T = this.tvCam;
    cam.position.set(T.x, T.y, T.z);
    const look = (this._tvLook = this._tvLook || new THREE.Vector3()).set(p.pos.x, p.y + 0.9, p.pos.z);
    cam.lookAt(look);
    // telephoto zoom: keep the car a similar size on screen
    const dist = Math.max(4, cam.position.distanceTo(look));
    cam.fov = damp(cam.fov, THREE.MathUtils.clamp((Math.atan(5 / dist) * 360) / Math.PI, 14, 70), 4, dt);
  }

  /* ---------------- guidance ---------------- */
  setGuide(g) {
    if (this.guide && this.guide.custom && !g.custom) this.dropCustomGuide();
    this.guide = g;
    this.routeT = 0;
  }
  clearGuide() {
    if (this.guide && this.guide.custom) this.dropCustomGuide();
    this.guide = null;
    this.route = [];
  }
  /** a map waypoint forced the arrow on; put the player's own setting back */
  dropCustomGuide() {
    if (this.guidePrev === undefined) return;
    this.guideOn = this.guidePrev;
    this.guidePrev = undefined;
    document.getElementById('btnGuide').classList.toggle('active', this.guideOn);
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
      this.route = this.guide.direct ? [{ x: this.guide.x, z: this.guide.z }] : this.world.route(p.pos.x, p.pos.z, this.guide.x, this.guide.z);
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
    a.group.position.y = (this.arrowY ?? 2.6) + Math.sin(this.time * 3) * (this.camMode === 'first' ? 0.005 : this.camMode === 'bumper' ? 0.03 : 0.08);
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
    else if (z.kind === 'crazy') this.crazy.offer();
    else if (z.kind === 'parking') this.parking.offer();
    else if (z.kind === 'drag') this.drag.offer();
    else if (z.kind === 'help') this.events.help();
    else if (z.kind === 'helping') return;
    else if (z.kind === 'fuelHelp') {
      const cost = 80000;
      this.topUp(cost);
      if (this.money >= cost) {
        this.money -= cost;
        this.ui.toast(this.player.spec.ev ? 'امداد خودرو باتری رو ۸ واحد شارژ کرد 🔋' : 'امداد خودرو ۸ لیتر بنزین آورد ⛽', 'good');
      } else this.ui.toast(this.player.spec.ev ? 'امداد خودرو دلش سوخت و مجانی شارژت کرد 😅🔋' : 'امداد خودرو دلش سوخت و مجانی ۸ لیتر بنزین داد 😅', 'info');
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
    const free = this.race.state === 'idle' && this.crazy.state === 'idle' && this.parking.state === 'idle' && this.drag.state === 'idle' && !this.events.job && this.bounty.state === 'idle';
    for (const s of [...w.stations, ...w.garages, w.police, ...(free ? [...this.race.spots, this.crazy.spot, this.parking.spot, this.drag.spot] : [])]) {
      if (Math.hypot(p.pos.x - s.padX, p.pos.z - s.padZ) < 12) zone = s;
    }
    if (!zone) zone = this.events.zone();
    // stranded: roadside help beats every pad except a pump or a garage that can fix it right here
    // a pump fixes an empty tank and a garage fixes a wreck; anything else needs roadside help
    if (zone?.kind !== 'gas' && p.fuelTotal() <= 0.01) zone = { kind: 'fuelHelp' };
    else if (zone?.kind !== 'garage' && p.health <= 0) zone = { kind: 'tow' };
    this.currentZone = zone;
    if (zone && !this.ui.panelOpen) {
      const txt = zone.kind === 'gas' ? '⛽ بزن تا بنزین بزنی' : zone.kind === 'garage' ? '🔧 تعمیر و ارتقای ماشین' : zone.kind === 'police' ? '🚓 کلانتری' : zone.kind === 'race' ? `🏁 ${zone.name} • مسابقه بده!` : zone.kind === 'crazy' ? '🔥 تاکسی دیوانه • شروع کن!' : zone.kind === 'parking' ? '🅿️ چالش پارک • شروع کن!' : zone.kind === 'drag' ? '🚦 درگ ۴۰۰ متری • مسابقه بده!' : zone.kind === 'help' ? `🆘 کمک به راننده: ${this.events.strand.prob[3]}` : zone.kind === 'helping' ? zone.text : zone.kind === 'fuelHelp' ? (p.spec.ev ? '🔋 باتری تموم شد! زنگ بزن امداد خودرو (۸۰٬۰۰۰)' : '⛽ بنزین تموم شد! زنگ بزن امداد خودرو (۸۰٬۰۰۰)') : '🛻 ماشین خراب شد! یدک‌کش تا تعمیرگاه (۱۵۰٬۰۰۰)';
      this.ui.zone(txt);
      this.stopT = sp < 0.6 && !this.ui.controlsHeld() ? (this.stopT || 0) + dt : 0;
      if (this.stopT > 0.5 && this.zoneAuto !== zone && (zone.kind === 'gas' || zone.kind === 'garage')) {
        this.zoneAuto = zone;
        this.zoneAction();
      }
    } else this.ui.zone(null);
    if (!zone) this.zoneAuto = null;

    // speed cameras
    this.radarT = (this.radarT || 0) - dt;
    for (const c of w.speedCams) {
      const d = Math.hypot(p.pos.x - c.x, p.pos.z - c.z);
      const kmh = sp * 3.6;
      // 📡 radar detector: beeps faster as you close in on a camera while speeding
      if (d < 160 && d > 18 && kmh > c.limit && (c.x - p.pos.x) * Math.sin(p.heading) + (c.z - p.pos.z) * Math.cos(p.heading) > 0) {
        if (this.radarT <= 0) {
          this.radarT = Math.max(0.15, (d / 160) * 0.9);
          this.audio.tone(1500, 0.07, 0.1, 'square');
        }
        if (this.radarCam !== c) {
          this.radarCam = c;
          this.ui.toast(`📡 دوربین سرعت جلوته! حداکثر ${fa(c.limit)} km/h`, 'warn');
        }
      } else if (this.radarCam === c && d > 200) this.radarCam = null;
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
    this.stats.finesTotal = (this.stats.finesTotal || 0) + amount;
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
    if (this.flashT > 0) {
      // lightning flash
      this.flashT = Math.max(0, this.flashT - dt);
      this.hemi.intensity += this.flashT * 9 * (Math.random() < 0.7 ? 1 : 0.3);
    }
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
    if (p.throttle > 0.2 && Math.random() < p.throttle * 0.7 && this.state === 'play' && !p.spec.ev) {
      const hl = p.car.P.len / 2 + 0.1;
      const x = p.pos.x - s * hl + c * 0.5, z = p.pos.z - c * hl - s * 0.5;
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
    if (p.flat && sp > 6 && !p.air && this.state === 'play' && Math.random() < 0.6) {
      for (const side of [1, -1]) {
        const x = p.pos.x + c * side * 0.8 - s * 1.3, z = p.pos.z - s * side * 0.8 - c * 1.3;
        fx.spark.emit(x, p.y + 0.1, z, -s * 3 + (Math.random() - 0.5) * 2, 1 + Math.random() * 2, -c * 3 + (Math.random() - 0.5) * 2, 0.35, 0.18, 1, 1);
      }
      this.flatT = (this.flatT || 0) - 1 / 60;
      if (this.flatT <= 0) {
        this.flatT = Math.max(0.08, 2.4 / sp);
        this.audio.burst(0.04, 900, 'bandpass', 0.18);
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
    // spray from the tyres on wet roads
    const W = this.weather;
    if (W && (W.wet ?? W.rain) > 0.3 && sp > 8 && !p.air && Math.random() < 0.7) {
      for (const side of [0.75, -0.75]) {
        const x = p.pos.x - s * 1.5 + c * side, z = p.pos.z - c * 1.5 - s * side;
        fx.tyre.emit(x, p.y + 0.3, z, -s * sp * 0.15 + (Math.random() - 0.5), 0.9 + Math.random(), -c * sp * 0.15 + (Math.random() - 0.5), 0.7, 0.5, 3, 0.25);
      }
    }
    // steam from a boiling engine
    if (p.overheat && Math.random() < 0.6) {
      const hx = p.pos.x + s * 1.6, hz = p.pos.z + c * 1.6;
      fx.tyre.emit(hx + (Math.random() - 0.5) * 0.6, p.y + 1.1, hz + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 1.8, (Math.random() - 0.5) * 0.6, 1.4, 0.7, 3, 0.4);
    }
    fx.tyre.update(dt);
    // exhaust backfire on fast upshifts and when lifting off at high revs
    const gas = this.lastInput ? this.lastInput.gas : 0, g0 = this.prevGas ?? 0;
    const upshift = p.shift && !this.prevShift && p.targetGear > p.gear && p.gear >= 1;
    if (this.state === 'play' && !this.onfoot.active && !p.spec.ev && ((upshift && p.rpm > 4300 && sp > 9) || (g0 > 0.8 && gas < 0.1 && p.rpm > 5000 && Math.random() < (p.sportExhaust ? 0.95 : 0.6)))) this.backfire();
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
    if (e.impact > 14) this.replay.offer();
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
    if (this.post) this.post.setSize();
    const ph = h * this.renderer.getPixelRatio();
    for (const k in this.fx) this.fx[k].setScale(ph, 65);
    this.arson.setScale(ph, 65);
    if (this.props) this.props.water.setScale(ph, 65);
    if (this.fireworks) this.fireworks.setScale(ph, 65);
    if (this.thrills) this.thrills.setScale(ph, 65);
    if (this.nature) this.nature.setScale(ph, 65);
  }
  frame() {
    // the driver's head is hidden only while the camera really sits inside it (first person, driving);
    // photo mode, cutscenes, jail and walking all show it
    const head = this.player.driver.head;
    const st0 = this.state;
    const inside = this.camMode === 'first' && !this.onfoot.active && (st0 === 'play' || st0 === 'pause' || (st0 === 'cutscene' && !this.cinematic));
    if (head.visible === inside) head.visible = !inside;
    const dt = Math.min(0.05, this.clock.getDelta()) * (this.timeScale || 1) * (this.state === 'play' ? this.slowmo || 1 : 1);
    const st = this.state;
    this.audio.update(dt);
    if (st !== 'play' && st !== 'cutscene') this.post.calm();
    if (st === 'jail') {
      this.police.update(dt);
      this.ui.update(dt);
      this.post.render(this.police.jail.scene, this.police.jail.camera);
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
      this.post.render(this.scene, this.camera);
      return;
    }
    if (st === 'pause') {
      this.post.render(this.scene, this.camera);
      return;
    }
    if (st === 'photo') {
      this.photo.update(dt);
      this.post.render(this.scene, this.camera);
      return;
    }
    if (st === 'replay') {
      this.replay.update(Math.min(0.05, dt));
      this.post.render(this.scene, this.camera);
      return;
    }
    this.time += dt;
    this.hour += (dt * 24) / DAY_SECONDS;
    if (this.hour >= 24) {
      this.hour -= 24;
      this.day++;
      this.ui.toast(`🌅 روز ${fa(this.day)} شروع شد`, 'info');
      this.newDay();
    }
    this.updateEnv(dt);
    this.weather.update(dt);
    this.world.update(dt, this.env, this.time);
    const inp = this.ui.input();
    // cruise control holds the speed until you brake (or press gas yourself)
    if (this.cruise) {
      const cp = this.player;
      // a gear change passes through neutral; only a real neutral/reverse, a dead car or leaving the wheel cancels
      const offGear = (!cp.gear || cp.gear < 1) && !cp.shift;
      if (inp.brake > 0.1 || inp.handbrake || offGear || st !== 'play' || this.onfoot.active || this.onfoot.busy || cp.health <= 0 || cp.fuelTotal() <= 0 || cp.burning) this.setCruise(false);
      else if (inp.gas < 0.05) inp.gas = this.player.speed < this.cruise - 0.3 ? 0.7 : 0;
    }
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
    this.crazy.update(dt);
    this.parking.update(dt);
    this.drag.update(dt);
    this.events.update(dt);
    this.bounty.update(dt);
    this.extras.update(dt);
    this.fleet.update(dt);
    this.ambient.update(dt);
    this.updateRushHour(dt);
    this.heli.update(dt);
    if (st === 'play') {
      this.pickups.update(dt);
      this.props.update(dt);
      this.thrills.update(dt);
      this.roadLife.update(dt);
      this.stunts.update(dt);
      this.ach.track(dt);
      this.career.update(dt);
    }
    this.rides.update(dt);
    this.chat.update(dt);
    this.peds.update(dt);
    if (st === 'play') this.updateZones(dt);
    this.updateGuide(dt);
    this.updateFx(dt);
    this.carLights.update(dt);
    this.nature.update(dt);
    this.fireworks.update(dt);
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
    if (st === 'play') this.replay.record(dt / (this.slowmo || 1) / (this.timeScale || 1));
    const env = this.env || { night: 0, sunDir: { y: 1 } };
    this.post.tune({ night: env.night, dusk: Math.max(0, 1 - Math.abs(env.sunDir.y) * 4) * (1 - env.night), speed: this.player.groundSpeed || 0, nitro: this.player.nitroOn, time: this.time, flash: this.flashT > 0 ? this.flashT : 0 });
    this.post.render(this.scene, this.camera);
  }
}

const game = new Game();
window.game = game;
game.init().catch((e) => {
  console.error(e);
  const lt = document.getElementById('loadText');
  if (lt) lt.textContent = 'خطا در اجرای بازی: ' + e.message;
});
