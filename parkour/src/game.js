// هستهٔ بازی: رندر، پس‌پردازش، حلقهٔ اصلی، وضعیت‌ها، مراحل، پاداش‌ها
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';
import { PHYS, MODES, QUALITY, PALETTES, LIGHTINGS, OUTFITS, BOT_LOOKS, themeForLevel, MAX_LEVEL } from './config.js';
import { SaveData } from './save.js';
import { World } from './world.js';
import { Course } from './course.js';
import { generateLevel, anchorWorld } from './level.js';
import { Player } from './player.js';
import { BotManager } from './bots.js';
import { CameraRig } from './camera.js';
import { Input } from './input.js';
import { Particles } from './particles.js';
import { AudioFX } from './audio.js';
import { AIChat } from './ai.js';
import { ChatSystem, BOT_PERSONAS } from './chat.js';
import { UI } from './ui.js';
import { makeSurfaceSet, makeFacade, makeRock, makeStripes, makeConveyor, makeSprite } from './textures.js';
import { clamp, damp, lerp, fa, faNum, isTouchDevice } from './util.js';

const V3 = THREE.Vector3;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVig: { value: 0.32 },
    uSat: { value: 1.08 },
    uContrast: { value: 1.05 },
    uSpeed: { value: 0 },
    uAberr: { value: 0 },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 0.2, 0.3) },
    uGrain: { value: 0.025 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uVig, uSat, uContrast, uSpeed, uAberr, uTime, uFlash, uGrain; uniform vec3 uFlashColor;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      float ab = uAberr * r2 * 0.06;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - c * ab).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + c * ab).b;
      if (uSpeed > 0.02) {
        vec3 acc = col;
        for (int i = 1; i < 7; i++) acc += texture2D(tDiffuse, vUv - c * float(i) * 0.011 * uSpeed).rgb;
        col = mix(col, acc / 7.0, smoothstep(0.015, 0.16, r2) * min(1.0, uSpeed));
        // خطوط سرعت
        float ang = atan(c.y, c.x);
        float id = floor(ang * 38.0);
        float ln = step(0.82, h(vec2(id, floor(uTime * 9.0)))) * smoothstep(0.08, 0.3, r2) * fract(r2 * 8.0 - uTime * 6.0 + h(vec2(id, 1.0)));
        col += vec3(1.0) * ln * 0.14 * uSpeed;
      }
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      col = max(vec3(0.0), (col - 0.18) * uContrast + 0.18);
      col *= 1.0 - uVig * smoothstep(0.08, 0.55, r2 * 1.5);
      col = mix(col, uFlashColor, uFlash);
      col += (h(vUv * 800.0 + fract(uTime)) - 0.5) * uGrain * (0.4 + l);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.save = new SaveData();
    this.isTouch = isTouchDevice();
    this.state = 'boot';
    this.t = 0;
    this.raceTime = 0;
    this.level = this.save.data.level;
    this.renderScale = 1;
    this.fpsAcc = 0;
    this.fpsN = 0;
    this.fps = 60;
    this.slowT = 0;
    this.fastT = 0;
    this.lastHud = 0;
    this.timers = [];
  }
  // تایمر بر اساس زمان بازی (با توقف، متوقف می‌شود)
  after(sec, fn) {
    this.timers.push({ at: (this.simClock || 0) + sec, fn });
  }
  runTimers(dt) {
    this.simClock = (this.simClock || 0) + dt;
    if (!this.timers.length) return;
    const due = this.timers.filter((x) => x.at <= this.simClock);
    if (!due.length) return;
    this.timers = this.timers.filter((x) => x.at > this.simClock);
    for (const x of due) x.fn();
  }

  // ---------- راه‌اندازی ----------
  async boot() {
    this.audio = new AudioFX();
    this.audio.setVolumes(this.save.s.sfx, this.save.s.music);
    this.ai = new AIChat(this.save);
    this.chat = new ChatSystem(this, this.ai);
    this.ui = new UI(this);
    this.ui.setLoading(0.05, 'در حال آماده‌سازی موتور گرافیک…');
    await nextFrame();

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance', stencil: false }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 6000);
    this.camera.position.set(0, 8, -12);
    this.rig = new CameraRig(this.camera);
    this.pickQuality();

    this.ui.setLoading(0.15, 'ساختن بافت‌های سکوها…');
    await nextFrame();
    const aniso = Math.min(8, r.capabilities.getMaxAnisotropy());
    this.assets = {
      tiles: makeSurfaceSet('tiles', 512, 7),
      metal: makeSurfaceSet('metal', 512, 13),
      concrete: makeSurfaceSet('concrete', 256, 21),
      facade: makeFacade(512, 11),
      rock: makeRock(256, 31),
      stripes: makeStripes(),
      conveyor: makeConveyor(),
      soft: makeSprite('soft'),
      star: makeSprite('star'),
    };
    this.assets.crack = this.makeCrack();
    this.assets.chevron = this.makeChevron();
    this.assets.checker = this.makeChecker();
    for (const v of Object.values(this.assets)) {
      for (const t of v.isTexture ? [v] : Object.values(v)) if (t && t.isTexture) t.anisotropy = aniso;
    }
    this.ui.setLoading(0.35, 'ساختن آسمان و محیط…');
    await nextFrame();
    this.world = new World(r, this.scene, this.quality);
    this.world.onThunder = () => this.audio.thunder();
    this.particles = new Particles(this.scene, { soft: this.assets.soft }, this.quality, r.getPixelRatio());
    this.setupComposer();
    this.onResize();
    addEventListener('resize', () => this.onResize());

    if (this.isTouch) document.body.classList.add('touch');
    this.input = new Input(this.canvas, this.isTouch ? this.ui.touchUI() : null);
    this.input.onPause = () => {
      if (this.ui.chatOpen) return this.ui.toggleChat(false);
      if (this.state === 'play' || this.state === 'countdown') this.pause();
      else if (this.state === 'paused') this.resume();
    };
    this.input.onChat = () => {
      if (this.state === 'play' || this.state === 'menu' || this.state === 'countdown') this.ui.toggleChat(true);
    };
    if (this.isTouch) {
      // روی لمسی ورودی متن کیبورد مجازی را باز می‌کند؛ باید بتوانیم بنویسیم
    }

    this.player = new Player(this.outfitLook(), this.playerEvents());
    this.scene.add(this.player.char.root);
    this.scene.add(this.player.char.scarf);
    this.applyUpgrades();

    this.chat.onMessage = (m) => this.ui.addMessage(m);
    this.chat.onTyping = (p, on) => this.ui.typing(p, on);
    this.ai.detect().then(() => this.ui.updateChatMode());

    // صدا فقط بعد از اولین لمس/کلیک
    const unlock = () => {
      this.audio.init();
      this.audio.setVolumes(this.save.s.sfx, this.save.s.music);
    };
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state === 'play' || this.state === 'countdown') this.pause();
        this.audio.suspend();
      } else this.audio.resume();
    });
    addEventListener('androidpause', () => {
      if (this.state === 'play' || this.state === 'countdown') this.pause();
      this.audio.suspend();
    });
    addEventListener('androidresume', () => this.audio.resume());
    window.__onAndroidBack = () => this.onBack();

    this.ui.setLoading(0.6, 'تولید اولین پارکور…');
    await nextFrame();
    this.loadLevel(this.save.data.level, this.save.s.mode, true);
    this.ui.setLoading(0.85, 'گرم کردن شیدرها…');
    await nextFrame();
    try {
      if (this.renderer.compileAsync) await this.renderer.compileAsync(this.scene, this.camera);
      else this.renderer.compile(this.scene, this.camera);
    } catch (e) { /* ignore */ }
    this.ui.setLoading(1, 'آماده!');
    this.clock = new THREE.Clock();
    this.enterMenu();
    this.renderer.setAnimationLoop(() => this.frame());
    setTimeout(() => this.chat.event('welcome', null, 1), 2500);
  }

  makeCrack() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#fff';
    g.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      let x = Math.random() * 256, y = Math.random() * 256;
      g.lineWidth = 1.5 + Math.random() * 2.5;
      g.beginPath();
      g.moveTo(x, y);
      for (let i = 0; i < 7; i++) {
        x += (Math.random() - 0.5) * 70;
        y += (Math.random() - 0.5) * 70;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  makeChevron() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#fff';
    g.lineWidth = 14;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(40, 24);
    g.lineTo(84, 64);
    g.lineTo(40, 104);
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 0.25);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  makeChecker() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 64;
    const g = c.getContext('2d');
    for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) {
      g.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4';
      g.fillRect(x * 32, y * 32, 32, 32);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  pickQuality() {
    let k = this.save.s.quality;
    if (k === 'auto' || !QUALITY[k]) k = this.isTouch ? 'medium' : 'high';
    this.qualityKey = k;
    this.quality = QUALITY[k];
    this.autoRes = this.save.s.quality === 'auto' || true;
    this.renderScale = 1;
    const r = this.renderer;
    r.shadowMap.enabled = this.quality.shadows > 0;
  }
  basePixelRatio() {
    return Math.min(devicePixelRatio || 1, this.quality.pixelRatio);
  }
  setupComposer() {
    const r = this.renderer;
    if (this.composer) {
      this.composer.renderTarget1.dispose();
      this.composer.renderTarget2.dispose();
      this.composer = null;
    }
    this.grade = this.bloom = this.fxaa = null;
    if (!this.quality.post) return;
    const w = innerWidth, hgt = innerHeight;
    const isGL2 = r.capabilities.isWebGL2;
    const rt = new THREE.WebGLRenderTarget(w, hgt, { type: THREE.HalfFloatType, samples: isGL2 ? this.quality.msaa : 0 });
    const comp = new EffectComposer(r, rt);
    comp.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, hgt / 2), 0.6, 0.55, 0.85);
    comp.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    comp.addPass(this.grade);
    comp.addPass(new OutputPass());
    if (this.quality.fxaa) {
      this.fxaa = new FXAAPass();
      comp.addPass(this.fxaa);
    } else this.fxaa = null;
    this.composer = comp;
  }
  onResize() {
    const w = innerWidth, hgt = innerHeight;
    const pr = this.basePixelRatio() * this.renderScale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, hgt, false);
    this.camera.aspect = w / hgt;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(pr);
      this.composer.setSize(w, hgt);
    }
    if (this.particles) this.particles.setPixelRatio(pr);
  }
  applyQuality() {
    this.pickQuality();
    this.world.quality = this.quality;
    this.world.setShadows(this.quality.shadows);
    this.setupComposer();
    this.onResize();
    this.applyLook(true);
  }

  outfitLook() {
    const o = OUTFITS.find((x) => x.id === this.save.s.outfit) || OUTFITS[0];
    return { ...o.colors, hairStyle: 'short', hat: o.id === 'ninja' ? 'beanie' : 'none' };
  }
  applyOutfit() {
    const old = this.player.char;
    this.scene.remove(old.root);
    if (old.scarf) this.scene.remove(old.scarf);
    old.dispose();
    const ch = new (old.constructor)(this.outfitLook(), { scarf: true });
    ch.stepCb = old.stepCb;
    this.player.char = ch;
    this.scene.add(ch.root, ch.scarf);
    ch.root.position.copy(this.player.pos);
    this.player.char.stepCb = (sn) => this.onStep(sn);
  }
  applyUpgrades() {
    this.player.setAbilities(this.save.data.upgrades);
  }

  // ---------- مراحل ----------
  lightingPreset() {
    const s = this.save.s;
    const L = LIGHTINGS.find((x) => x.id === s.lighting && this.save.data.owned.lightings.includes(x.id));
    return L || LIGHTINGS[0];
  }
  palette() {
    const s = this.save.s;
    const P = PALETTES.find((x) => x.id === s.palette && this.save.data.owned.palettes.includes(x.id));
    return P || PALETTES[0];
  }
  courseCtx() {
    const s = this.save.s, own = this.save.data.owned;
    return {
      scene: this.scene,
      world: this.world,
      assets: this.assets,
      palette: this.palette(),
      customColor: own.customColor ? s.customColor : null,
      groundY: this.world.groundY,
      quality: this.quality,
      onCrumble: () => {},
      onCrumbleFall: () => this.audio.crumble(),
    };
  }
  loadLevel(level, mode, showcase = false) {
    if (this.course) this.course.dispose();
    if (this.bots) this.bots.removeFrom(this.scene);
    this.ui.clearTags();
    this.timers = [];
    this.respawning = false;
    this.level = level;
    this.mode = mode;
    const salt = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    const L = (this.L = generateLevel(level, mode, salt));
    this.theme = L.theme;
    const s = this.save.s;
    this.world.apply(L.theme, this.lightingPreset(), this.save.data.owned.customLight ? s.customLight : null, L.bounds);
    this.renderer.toneMappingExposure = this.world.exposure;
    if (this.bloom) {
      this.bloom.strength = this.world.bloom[0];
      this.bloom.radius = this.world.bloom[1];
      this.bloom.threshold = this.world.bloom[2];
    }
    this.course = new Course(L, this.courseCtx());
    this.bots = new BotManager(L, this.course, BOT_PERSONAS, BOT_LOOKS, { scarf: this.quality.botScarf, events: this.botEvents() });
    this.bots.addTo(this.scene);
    this.bots.reset();
    for (const b of this.bots.bots) this.ui.ensureTag(b.persona.id, b.persona.name, b.color);
    this.t = 0;
    this.raceTime = 0;
    this.picked = 0;
    this.falls = 0;
    this.finished = false;
    this.checkpoint = { plat: L.start.plat, order: -1 };
    this.audio.setMood(THEMES_INDEX(L.theme));
    this.spawnAtStart();
    this.course.updateColliders(0);
    this.lastRankOrder = null;
    this.cpFracs = L.checkpoints.map((id) => this.bots.platRoute.get(id) / L.route.length);
  }
  spawnAtStart() {
    const L = this.L;
    const w = anchorWorld(L, { p: L.start.plat, lx: 0.95, lz: -3 }, 0);
    this.player.spawn(w, L.start.yaw);
    this.player.lastGround = this.course ? this.course.colliders[L.start.plat] : null;
    this.player.groundCol = this.player.lastGround;
    this.player.grounded = true;
    this.player.char.stepCb = (sn) => this.onStep(sn);
    this.rig.snap(this.player.pos, L.start.yaw);
  }

  enterMenu() {
    this.state = 'menu';
    this.ui.show('menu');
    this.ui.setPlaying(false);
    this.ui.hideResults();
    this.ui.showPause(false);
    this.ui.countdown(-1);
    this.input.allowLock = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.player.cele = false;
    this.player.frozen = true;
    this.bots.reset();
    this.bots.start();
    for (const b of this.bots.bots) this.ui.ensureTag(b.persona.id, b.persona.name, b.color);
    this.showcaseT = 0;
    this.rig.mode = 'orbit';
    this.rig.startOrbit(this.player.pos, 10, 3.2, 0.1);
  }
  onModeChanged() {
    if (this.state === 'menu') {
      this.loadLevel(this.save.data.level, this.save.s.mode, true);
      this.enterMenu();
    }
  }
  applyLook(rebuildCourse = false) {
    const s = this.save.s;
    this.world.apply(this.L.theme, this.lightingPreset(), this.save.data.owned.customLight ? s.customLight : null, this.L.bounds);
    this.renderer.toneMappingExposure = this.world.exposure;
    if (this.bloom) {
      this.bloom.strength = this.world.bloom[0];
      this.bloom.radius = this.world.bloom[1];
      this.bloom.threshold = this.world.bloom[2];
    }
    if (rebuildCourse) {
      const gid = this.player.groundCol ? this.player.groundCol.id : -9;
      const lid = this.player.lastGround ? this.player.lastGround.id : -9;
      const coinState = this.course.coinState;
      const cpVis = Object.entries(this.course.checkpointVis).filter(([, v]) => v.active).map(([k]) => +k);
      this.course.dispose();
      this.course = new Course(this.L, this.courseCtx());
      if (coinState) {
        this.course.coinState.forEach((c, i) => Object.assign(c, coinState[i]));
      }
      cpVis.forEach((id) => this.course.activateCheckpoint(id));
      this.bots.course = this.course;
      this.course.updateColliders(this.t);
      this.player.groundCol = this.course.colliders.find((c) => c.id === gid) || null;
      this.player.lastGround = this.course.colliders.find((c) => c.id === lid) || null;
      if (!this.player.groundCol) this.player.grounded = false;
    }
  }

  startLevel(level) {
    level = clamp(level, 1, Math.min(MAX_LEVEL, this.save.data.maxLevel));
    this.audio.init();
    this.save.data.level = level;
    this.save.save();
    this.ui.show('none');
    this.ui.hideResults();
    this.ui.showPause(false);
    this.loadLevel(level, this.save.s.mode);
    this.ui.setPlaying(true);
    this.ui.hudStatic(level, this.modeName(), this.bots.bots.length + 1, this.cpFracs);
    this.player.frozen = true;
    this.input.allowLock = !this.isTouch;
    // پرواز سینمایی از پایان به شروع
    const pts = [];
    const P = this.L.platforms;
    const step = Math.max(1, Math.floor(P.length / 7));
    for (let i = P.length - 1; i >= 0; i -= step) pts.push({ x: P[i].x, y: P[i].top + 1, z: P[i].z });
    pts.push({ x: this.player.pos.x, y: this.player.pos.y + 1.5, z: this.player.pos.z });
    this.state = 'intro';
    const dur = this.save.s.reduceMotion ? 1.2 : Math.min(4.2, 2.4 + P.length * 0.02);
    this.rig.startFly(pts, dur, () => this.beginCountdown());
    this.ui.skipButton(true, () => { this.rig.fly && (this.rig.fly.t = this.rig.fly.T); });
    this.chat.event('levelStart', null, 0.7);
  }
  beginCountdown() {
    this.ui.skipButton(false);
    this.rig.mode = 'follow';
    this.rig.snap(this.player.pos, this.L.start.yaw);
    this.state = 'countdown';
    this.cd = 3;
    this.cdT = 0;
    this.ui.countdown(3);
    this.audio.count(3);
    this.course.setStartLights(1, false);
    if (!this.save.data.seenTutorial) {
      this.ui.hint(this.isTouch
        ? 'سمت چپ صفحه را بکش تا حرکت کنی · دکمهٔ «پرش» برای پریدن (دوبار: پرش دوبل) · «سُر» برای رد شدن از زیر میله‌ها · سمت راست را بکش تا دوربین بچرخد'
        : '<kbd>W A S D</kbd> حرکت · <kbd>Space</kbd> پرش · <kbd>Shift</kbd> سُر خوردن · موس: دوربین · <kbd>Enter</kbd> چت · <kbd>Esc</kbd> توقف', 9);
      this.save.data.seenTutorial = true;
      this.save.save();
    }
  }
  go() {
    this.state = 'play';
    this.player.frozen = false;
    this.bots.start();
    this.raceTime = 0;
    this.course.setStartLights(3, true);
    this.ui.countdown(0);
    this.audio.count(0);
    this.after(0.9, () => this.state !== 'countdown' && this.ui.countdown(-1));
  }
  restart() {
    this.startLevel(this.level);
  }
  nextLevel() {
    this.startLevel(Math.min(MAX_LEVEL, this.level + 1));
  }
  toMenu() {
    this.loadLevel(this.save.data.level, this.save.s.mode, true);
    this.enterMenu();
  }
  pause() {
    if (this.state !== 'play' && this.state !== 'countdown') return;
    this.prevState = this.state;
    this.state = 'paused';
    this.ui.showPause(true);
    if (document.pointerLockElement) document.exitPointerLock();
  }
  resume() {
    if (this.state !== 'paused') return;
    this.ui.showPause(false);
    if (this.ui.screen === 'settings') this.ui.show('none');
    this.state = this.prevState || 'play';
    this.clock.getDelta();
  }
  onBack() {
    if (!this.ui) return false;
    if (!document.getElementById('modal').hidden) { document.getElementById('modalCancel').click(); return true; }
    if (this.ui.chatOpen) { this.ui.toggleChat(false); return true; }
    if (this.state === 'play' || this.state === 'countdown') { this.pause(); return true; }
    if (this.state === 'paused') {
      if (this.ui.screen === 'settings') { this.ui.back(); return true; }
      this.resume();
      return true;
    }
    if (this.state === 'results') { this.toMenu(); return true; }
    if (this.state === 'intro') { this.rig.fly && (this.rig.fly.t = this.rig.fly.T); return true; }
    if (this.ui.screen !== 'menu') { this.ui.back(); return true; }
    return false;
  }

  modeName() {
    return MODES.find((m) => m.id === this.mode)?.name || '';
  }
  themeName() {
    return this.theme ? this.theme.name : '';
  }
  raceSummary() {
    if (!this.bots) return '';
    const prog = this.bots.playerProgress(this.player.lastGround ? this.player.lastGround.p : null);
    const list = this.bots.ranking(prog, this.finished, this.raceTime);
    const names = list.map((x, i) => `${i + 1}. ${x.bot ? x.bot.name : this.save.s.playerName + ' (the human)'}`).join(', ');
    const state = this.state === 'menu' ? 'The human is in the main menu, between races.' : this.state === 'results' ? 'The race just ended.' : `Race in progress, ${Math.round(this.raceTime)} seconds in.`;
    return `${state} Current order: ${names}. The human has fallen ${this.falls} times this race.`;
  }

  // ---------- رویدادهای بازیکن ----------
  haptic(ms) {
    if (!this.save.s.haptics) return;
    try {
      if (window.AndroidBridge && window.AndroidBridge.vibrate) window.AndroidBridge.vibrate(ms);
      else if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { /* ignore */ }
  }
  onStep(sn) {
    this.audio.step(sn);
    if (Math.random() < 0.5) this.particles.step(this.player.pos);
  }
  playerEvents() {
    return {
      onJump: (kind) => {
        this.audio.jump(kind);
        const p = this.player.pos;
        if (kind === 'ground') this.particles.dust(p, 0.5);
        else if (kind === 'double') { this.particles.ring(p, [0.4, 0.9, 1], 30, 4); this.haptic(12); }
        else this.particles.sparkle({ x: p.x, y: p.y + 1, z: p.z }, [0.5, 0.9, 1], 12);
      },
      onLand: (impact, drop) => {
        const k = clamp((impact - 4) / 20, 0, 1);
        this.audio.land(k);
        this.particles.dust(this.player.pos, 0.4 + k * 1.4);
        if (impact > 16) { this.rig.shake(0.05 + k * 0.18); this.haptic(20 + k * 30); }
      },
      onBounce: (p) => {
        this.audio.bounce();
        this.course.bouncePlat(p);
        this.particles.ring(this.player.pos, [0.6, 1, 0.3], 40, 6);
        this.rig.shake(0.08);
        this.haptic(25);
      },
      onSlide: () => { this.audio.slide(); this.particles.dust(this.player.pos, 0.6); },
      onWallrun: () => { this.audio.jump('wall'); this.haptic(10); },
      onMantle: () => this.audio.step(1),
      onKnock: () => {
        this.audio.knock();
        this.rig.shake(0.25);
        this.ui.flash();
        this.haptic(60);
        this.chat.event('playerFell', null, 0.35);
      },
      onZap: () => {
        if (this.respawning) return;
        this.audio.zap();
        this.particles.zap(this.player.pos);
        this.ui.flash();
        this.haptic(80);
        this.respawnPlayer(true, 0.35);
      },
      onCrumbleTouch: (c) => this.course.touchCrumble(c),
      onPad: () => {},
    };
  }
  botEvents() {
    return {
      botFell: (b) => {
        this.particles.poof(b.pos, [0.9, 0.9, 1]);
        if (this.state === 'play') this.chat.event('botFell', b.persona.id, 0.45);
      },
      botRespawn: (b) => this.particles.sparkle({ x: b.pos.x, y: b.pos.y + 1, z: b.pos.z }, [0.6, 0.9, 1], 10),
      botFinished: (b) => {
        if (this.state === 'play') this.chat.event('botFinished', b.persona.id, 0.55);
        this.particles.confetti(b.pos, 30, 2);
      },
      botKnocked: (b) => this.state === 'play' && this.chat.event('botFell', b.persona.id, 0.4),
      botLanded: () => {},
      botJump: () => {},
    };
  }
  onBotChat(id) {
    const b = this.bots && this.bots.bots.find((x) => x.persona.id === id);
    if (b && b.mode !== 'arc' && b.mode !== 'fall') b.char.wave();
  }

  respawnPlayer(death = true, delay = 0.55) {
    if (this.respawning) return;
    this.respawning = true;
    const pl = this.player;
    if (death) {
      this.falls++;
      this.save.data.totalFalls++;
      this.audio.fall();
      this.ui.flash();
      this.chat.event('playerFell', null, 0.45);
    }
    pl.frozen = true;
    this.after(delay, () => {
      const L = this.L;
      const cpPlat = L.platforms[this.checkpoint.plat];
      const isStart = this.checkpoint.plat === L.start.plat;
      const a = isStart ? { p: cpPlat.id, lx: 0.95, lz: -3 } : { p: cpPlat.id, lx: 0, lz: -1 };
      const w = anchorWorld(L, a, this.t);
      pl.spawn(w, cpPlat.yaw);
      pl.groundCol = this.course.colliders[cpPlat.id];
      pl.lastGround = pl.groundCol;
      pl.grounded = true;
      pl.char.stepCb = (sn) => this.onStep(sn);
      this.rig.snap(pl.pos, cpPlat.yaw);
      this.particles.poof(pl.pos, [0.7, 0.95, 1]);
      this.respawning = false;
      if (this.state === 'play') pl.frozen = false;
    });
  }

  finishRace() {
    if (this.finished) return;
    this.finished = true;
    const pl = this.player;
    const rank = 1 + this.bots.bots.filter((b) => b.finished).length;
    this.finalRank = rank;
    this.audio.finish(rank === 1);
    this.particles.confetti(pl.pos, 160, 8);
    for (let i = 0; i < 3; i++) this.after(0.3 + i * 0.45, () => this.particles.firework({ x: pl.pos.x + (Math.random() - 0.5) * 12, y: pl.pos.y + 8 + Math.random() * 5, z: pl.pos.z + (Math.random() - 0.5) * 12 }));
    pl.vel.set(0, 0, 0);
    pl.frozen = true;
    this.chat.event(rank === 1 ? 'playerFinishedFirst' : 'playerFinished', null, 0.9);
    pl.cele = true;
    this.haptic(40);
    // پاداش
    const lv = this.level;
    const base = Math.round((10 + lv * 1.25) * (this.mode === 'down' ? 1.15 : this.mode === 'up' ? 1.3 : 1));
    const mult = rank === 1 ? 2 : rank === 2 ? 1.6 : rank === 3 ? 1.3 : 1;
    const coinValue = 1 + Math.floor(lv / 40);
    const pickedCoins = this.picked * coinValue;
    const total = Math.round(base * mult + pickedCoins);
    this.save.addCoins(total);
    const unlocks = this.save.completeLevel(lv, rank, this.raceTime);
    if (lv >= this.save.data.level && lv < MAX_LEVEL) this.save.data.level = lv + 1;
    this.save.save();
    this.after(1.4, () => {
      this.state = 'results';
      this.ui.setPlaying(false);
      if (document.pointerLockElement) document.exitPointerLock();
      this.rig.yaw = pl.yaw;
      this.rig.startOrbit(pl.pos, 5.5, 1.6, 0.25);
      // رتبه‌بندی نهایی با تخمین زمان رقبای در راه
      const standings = [{ name: this.save.s.playerName || 'تو', color: '#ff7a3d', time: this.raceTime, me: true, sort: this.raceTime }];
      for (const b of this.bots.bots) {
        const est = b.finished ? b.finishTime : this.raceTime + (this.L.route.length - b.entry) * (0.9 + (1 - b.skill)) + 2;
        standings.push({ name: b.name, color: b.color, time: b.finished ? b.finishTime : 0, sort: est });
      }
      standings.sort((a, b) => a.sort - b.sort);
      this.ui.results({ level: lv, modeName: this.modeName(), rank, total: standings.length, time: this.raceTime, falls: this.falls, standings, coins: total, base, mult, picked: pickedCoins, unlocks });
      unlocks.forEach((m) => this.ui.toast(`🔓 حالت «${m.name}» باز شد!`, 'gold'));
    });
  }

  // ---------- حلقهٔ اصلی ----------
  frame() {
    let dt = this.clock.getDelta();
    if (dt > 0.1) dt = 0.1;
    const realDt = dt;
    this.trackFps(realDt);
    const st = this.state;
    if (st === 'paused') {
      this.render(0);
      return;
    }
    const inp = this.input.read(this.rig.yaw);
    const simulate = st !== 'boot';
    if (simulate) {
      if (inp.jump) this.player.jumpBuf = PHYS.jumpBuffer;
      const n = Math.max(1, Math.ceil(dt / (1 / 120)));
      const h = dt / n;
      let slide = inp.slide;
      for (let i = 0; i < n; i++) {
        const tt = this.t + h * (i + 1);
        this.course.updateColliders(tt);
        if (st === 'play') {
          this.player.step(h, { ...inp, slide }, this.course, tt);
          slide = false;
        }
      }
      this.t += dt;
      this.runTimers(dt);
      if (st === 'play') this.raceTime += dt;
      this.course.update(this.t, dt);
      this.player.updateVisual(dt);
      if (st === 'play' || st === 'menu' || st === 'results') this.bots.update(dt, this.t);
      else this.bots.update(dt, this.t);
    }

    if (st === 'countdown') {
      this.cdT += dt;
      if (this.cdT >= 0.85) {
        this.cdT = 0;
        this.cd--;
        if (this.cd > 0) {
          this.ui.countdown(this.cd);
          this.audio.count(this.cd);
          this.course.setStartLights(4 - this.cd, false);
        } else this.go();
      }
    }
    if (st === 'play') this.gameplayChecks(dt);
    if (st === 'menu') this.updateShowcase(dt);

    // دوربین
    this.rig.update(dt, this.player, st === 'play' || st === 'countdown' ? inp : null, { sens: this.save.s.sens, invertY: this.save.s.invertY, camDist: this.save.s.camDist, mode: this.mode, reduceMotion: this.save.s.reduceMotion });
    const focus = st === 'menu' && this.showFocus ? this.showFocus : this.player.pos;
    this.world.update(dt, this.camera, focus);
    this.particles.update(dt);
    this.updateTags();
    // باد بر اساس سرعت سقوط
    const fallSpeed = Math.max(0, -this.player.vel.y);
    this.audio.setWind(st === 'play' ? clamp((fallSpeed - 6) / 25 + Math.hypot(this.player.vel.x, this.player.vel.z) / 40, 0, 1) : 0);
    this.render(dt);
  }

  gameplayChecks(dt) {
    const pl = this.player, L = this.L;
    // سکه‌ها
    this.course.collectCoins(pl.pos, pl.magnet, dt, (c) => {
      this.picked++;
      this.audio.coin(this.coinCombo = (performance.now() - (this.lastCoinT || 0) < 600 ? (this.coinCombo || 0) + 1 : 0));
      this.lastCoinT = performance.now();
      this.particles.sparkle(c, [1, 0.82, 0.25], 10);
    });
    // پرچم و خط پایان
    if (pl.grounded && pl.groundCol && pl.groundCol.p) {
      const p = pl.groundCol.p;
      if (p.kind === 'checkpoint' && p.order > this.checkpoint.order) {
        this.checkpoint = { plat: p.id, order: p.order };
        this.course.activateCheckpoint(p.id);
        this.audio.checkpoint();
        this.particles.burst({ x: p.x, y: p.top + 1, z: p.z }, [0.3, 1, 0.55], 50, 8);
        this.ui.flash('cp');
        this.ui.toast('🚩 پرچم ذخیره شد', 'good');
        this.chat.event('checkpoint', null, 0.3);
        this.haptic(20);
      }
      if (p.kind === 'finish' && !this.finished) this.finishRace();
    }
    // سقوط
    if (!this.respawning && !this.finished) {
      const seg = pl.lastGround && pl.lastGround.p ? pl.lastGround.p.seg : 0;
      const killY = L.killY[Math.min(L.killY.length - 1, seg)] ?? -40;
      if (pl.pos.y < killY || pl.pos.y < this.world.groundY + 3) this.respawnPlayer(true);
    }
    // پیشرفت و رتبه
    this.hudT = (this.hudT || 0) + dt;
    if (this.hudT > 0.1) {
      this.hudT = 0;
      const total = L.route.length;
      const prog = this.bots.playerProgress(pl.lastGround ? pl.lastGround.p : null);
      const list = this.bots.ranking(prog, this.finished, this.raceTime);
      const rank = list.findIndex((x) => x.bot === null) + 1;
      const racers = this.bots.bots.map((b) => ({ color: b.color, prog: b.finished ? 1 : b.progress / total, me: false }));
      racers.push({ prog: this.finished ? 1 : prog / total, me: true });
      this.ui.hud({ time: this.raceTime, coins: this.picked, rank, racers, fps: this.fps });
      // تشخیص سبقت
      const order = list.map((x) => (x.bot ? x.bot.persona.id : 'me'));
      if (this.lastRankOrder && this.raceTime > 4) {
        const prevMe = this.lastRankOrder.indexOf('me'), nowMe = order.indexOf('me');
        if (nowMe > prevMe) {
          const passer = order[nowMe - 1];
          if (passer !== 'me') this.chat.event('botOvertakesPlayer', passer, 0.35);
        } else if (nowMe < prevMe) {
          const passed = order[nowMe + 1];
          if (passed && passed !== 'me') this.chat.event('playerOvertakesBot', passed, 0.35);
        }
      }
      this.lastRankOrder = order;
      // صحبت‌های تصادفی
      if (Math.random() < 0.004) this.chat.event('idle', null, 0.6);
      // نزدیک شدن به بخش سخت
      const next = pl.lastGround && pl.lastGround.p ? L.route[this.bots.platRoute.get(pl.lastGround.p.id) + 2] : null;
      if (next && next.type === 'run' && (next.wait === 'laser' || next.wait === 'hammer') && !this['_hard' + next.a.p]) {
        this['_hard' + next.a.p] = true;
        this.chat.event('hardPart', null, 0.4);
      }
    }
  }

  updateShowcase(dt) {
    // دوربین سینمایی دنبال نفر اول
    this.showcaseT += dt;
    const lead = this.bots.bots.slice().sort((a, b) => b.progress - a.progress)[0];
    if (lead) {
      this.showFocus = this.showFocus || lead.pos.clone();
      this.showFocus.lerp(lead.pos, 1 - Math.exp(-dt * 2));
      this.rig.orbitCenter.copy(this.showFocus);
      this.rig.orbitR = 9;
      this.rig.orbitH = 3.4;
    }
    if (this.bots.bots.every((b) => b.finished) || this.showcaseT > 90) {
      this.showcaseT = 0;
      this.bots.reset();
      this.bots.start();
    }
  }

  updateTags() {
    if (!this.bots) return;
    const show = this.state !== 'boot';
    const cam = this.camera;
    const v = this._tagV || (this._tagV = new V3());
    const w = innerWidth, hh = innerHeight;
    for (const b of this.bots.bots) {
      if (!show || !b.char.root.visible) { this.ui.placeTag(b.persona.id, 0, 0, 1, false); continue; }
      b.char.headWorld(v);
      v.y += 0.42;
      const dist = v.distanceTo(cam.position);
      v.project(cam);
      const vis = v.z < 1 && v.z > -1 && dist < 55 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      const scale = clamp(1.25 - dist / 45, 0.55, 1.1);
      this.ui.placeTag(b.persona.id, (v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * hh, scale, vis);
    }
  }

  trackFps(dt) {
    this.fpsAcc += dt;
    this.fpsN++;
    if (this.fpsAcc >= 0.5) {
      this.fps = this.fpsN / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsN = 0;
      // وضوح پویا برای روان ماندن
      if (this.state === 'play' || this.state === 'menu') {
        if (this.fps < 48) {
          this.slowT += 0.5;
          this.fastT = 0;
          if (this.slowT >= 1.5 && this.renderScale > 0.55) {
            this.renderScale = Math.max(0.55, this.renderScale - 0.1);
            this.slowT = 0;
            this.onResize();
          }
        } else if (this.fps > 57) {
          this.fastT += 0.5;
          this.slowT = 0;
          if (this.fastT >= 5 && this.renderScale < 1) {
            this.renderScale = Math.min(1, this.renderScale + 0.05);
            this.fastT = 0;
            this.onResize();
          }
        } else { this.slowT = 0; this.fastT = 0; }
      }
    }
  }

  render(dt) {
    const pl = this.player;
    if (this.grade && this.composer) {
      const u = this.grade.uniforms;
      u.uTime.value = this.t;
      const fall = clamp((-pl.vel.y - 14) / 20, 0, 1);
      const hs = Math.hypot(pl.vel.x, pl.vel.z);
      const fast = clamp((hs - pl.maxSpeed * 0.95) / (pl.maxSpeed * 0.5), 0, 1);
      const sp = this.state === 'play' && this.quality.fx && !this.save.s.reduceMotion ? Math.max(fall, fast * 0.8, pl.slideT > 0 ? 0.35 : 0) : 0;
      u.uSpeed.value = damp(u.uSpeed.value, sp, 6, dt || 0.016);
      u.uAberr.value = u.uSpeed.value * 1.5 + 0.15;
      u.uSat.value = 1.08 * (this.world.saturation || 1);
      u.uContrast.value = 1.05 * (this.world.contrast || 1);
      u.uVig.value = 0.3 + u.uSpeed.value * 0.25;
      u.uFlash.value = this.world.flash * 0.25;
      u.uFlashColor.value.setRGB(0.8, 0.85, 1);
      this.composer.render(dt);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

function THEMES_INDEX(theme) {
  return theme.id.length % 4;
}
