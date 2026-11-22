// مدیریت مسابقه: فیزیک، هوش مصنوعی رقبا، دوربین‌ها، شمارش معکوس، رئیس کل، ضبط و پخش ویدیو
import * as THREE from 'three';
import { Track, DS, TEAM_COLORS, TEAM_NAMES } from './track.js';
import { buildCar, CARS, carStats, defaultCustom, looksScore, CUSTOM } from './cars.js';
import { buildHuman, patternMaterial, PATTERN_UNIFORMS } from './human.js';
import { Outdoor, TIME_ORDER } from './engine.js';
import { Effects } from './effects.js';
import { clamp, lerp, damp, wrapAngle, mulberry32, toFa, fmtTime, TAU } from './utils.js';

export const COINS = [150, 100, 50, 20, 10, 5, 2];
const RIVAL_NAMES = ['آرش', 'کاوه', 'سارا', 'نیما', 'رها', 'بهرام', 'مانی', 'تینا', 'سهراب', 'یاسمن', 'داریوش', 'پریا'];
const TIER_KNOTS = [[1, 0], [20, 1], [40, 3.6], [60, 4.6], [80, 5.6], [100, 6.6], [150, 7.6], [200, 8.6], [250, 9.6], [300, 10.6], [400, 11.6], [500, 12.6], [600, 13.6], [700, 14.6], [800, 15.6], [900, 16.6], [950, 17.6], [1000, 18.6]];

export function stageInfo(level, lightTime = 'auto') {
  const bossLevel = level % 100 === 0;
  const judged = level === 500 || level === 1000;
  const bossTeam = bossLevel ? (judged ? 0 : 1 + ((level / 100) % 6)) : -1;
  const laps = level < 100 ? 1 : 2;
  let time = lightTime !== 'auto' ? lightTime : TIME_ORDER[Math.floor((level - 1) / 3) % 4];
  if (lightTime === 'auto' && level === 1000) time = 'night';
  if (lightTime === 'auto' && level === 500) time = 'sunset';
  return { level, bossLevel, judged, bossTeam, laps, time };
}

function tierAt(level) {
  for (let k = 0; k < TIER_KNOTS.length - 1; k++) {
    const [l0, t0] = TIER_KNOTS[k], [l1, t1] = TIER_KNOTS[k + 1];
    if (level <= l1) { const f = (level - l0) / (l1 - l0); return { t: lerp(t0, t1, f), within: f }; }
  }
  return { t: 18.6, within: 1 };
}

export function rivalProfiles(level) {
  const rng = mulberry32(level * 101 + 7);
  const { t, within } = tierAt(level);
  const out = [];
  for (let k = 0; k < 6; k++) {
    const tt = clamp(t - 0.3 + (k - 2.5) * 0.12 + (rng() - 0.5) * 0.2, 0, CARS.length - 1);
    const i0 = Math.floor(tt), i1 = Math.min(CARS.length - 1, i0 + 1), f = tt - i0;
    const a = CARS[i0], b = CARS[i1];
    const skill = 0.8 + 0.12 * within + 0.035 * rng() + (level / 1000) * 0.06;
    const look = clamp(Math.round(tt + (rng() - 0.5) * 1.2), 0, Math.min(CARS.length - 1, Math.ceil(t)));
    out.push({
      team: k + 1, name: RIVAL_NAMES[(level * 3 + k * 5) % RIVAL_NAMES.length], carDef: CARS[look],
      stats: { vmax: lerp(a.top, b.top, f) / 3.6 * skill, acc: lerp(a.acc, b.acc, f) * (0.9 + 0.1 * skill), grip: lerp(a.grip, b.grip, f) * (0.88 + 0.12 * skill), brake: lerp(a.brake, b.brake, f), nitro: 0 },
      looks: Math.round(rng() * 10 + tt), skill
    });
  }
  return out;
}

export function judgeScore(stats, looks) {
  return stats.vmax * 3.6 * 0.6 + stats.acc * 12 + stats.grip * 70 + looks * 6;
}

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);

export class Race {
  constructor(app, cfg) {
    this.app = app; this.cfg = cfg;
    this.info = stageInfo(cfg.level, app.save.data.light.time);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 14000);
    this.phase = 'loading'; this.t = 0; this.raceTime = 0; this.phaseT = 0;
    this.camMode = app.save.data.settings.camera || 'chase';
    this.racers = [];
    this.tmpLoc = {};
    this.record = { frames: [], dt: 1 / 30, acc: 0 };
    this.replayWatched = false;
    this.messages = [];
  }

  async build(progress = () => {}) {
    const app = this.app; const q = app.engine.qualityName; const Q = app.engine.q;
    progress(0.05, 'ساخت پیست');
    await tick();
    this.outdoor = new Outdoor(app.engine, this.scene);
    this.track = new Track(this.cfg.level, { quality: q, fanFill: Q.fans, trees: Q.trees, bossTeam: this.info.bossTeam });
    progress(0.15, 'ساخت جاده و دیوارها'); await tick();
    this.track.buildRoad(); this.track.buildKerbs(); this.track.buildShoulders(); this.track.buildBarriers();
    progress(0.3, 'ساخت زمین و کوه‌ها'); await tick();
    this.track.buildTerrain(); this.track.buildMountains();
    progress(0.45, 'ساخت جایگاه تماشاگران'); await tick();
    this.track.buildStartArea(); this.track.buildStands();
    progress(0.6, 'ساخت ساختمان‌ها'); await tick();
    this.track.buildPit(); this.track.buildBillboards(); this.track.buildTowers(); this.track.buildBridge(); this.track.buildMarshals();
    progress(0.7, 'کاشت درخت‌ها'); await tick();
    this.track.buildTrees();
    progress(0.76, 'بهینه‌سازی صحنه'); await tick();
    this.track.optimize();
    this.scene.add(this.track.group);
    this.outdoor.apply(this.info.time, app.save.data.light);
    this.night = this.info.time === 'night';
    this.track.setNight(this.night);
    if (this.night && app.engine.q.nightLights > 0) this.addFloodlights(app.engine.q.nightLights);
    progress(0.8, 'آماده‌سازی ماشین‌ها'); await tick();
    this.buildRacers();
    this.effects = new Effects(this.scene);
    if (this.info.bossTeam >= 0 && this.track.reservedSeat) this.buildBoss();
    this.buildMinimap();
    this.tvSpots = this.makeTvSpots();
    progress(1, 'آماده'); await tick();
    // کامپایل پیش از شروع برای روانی
    try { app.engine.renderer.compile(this.scene, this.camera); } catch (e) { /* نادیده */ }
  }

  buildRacers() {
    const save = this.app.save.data; const sel = save.selected; const def = CARS.find((c) => c.id === sel) || CARS[0];
    const custom = save.custom[sel] || defaultCustom(def); const up = save.upgrades[sel] || {};
    const rivals = rivalProfiles(this.cfg.level);
    const slots = this.track.gridSlots;
    const order = [...rivals.map((r, k) => ({ ...r, k })), { player: true }];
    order.forEach((r, gi) => {
      const slot = slots[gi];
      const isP = !!r.player;
      const team = isP ? 0 : r.team;
      const color = isP ? 0xff5a00 : new THREE.Color(TEAM_COLORS[team]).getHex();
      const carDef = isP ? def : r.carDef;
      const cust = isP ? custom : { ...defaultCustom(carDef), paint: TEAM_COLORS[team] === '#eef2f6' ? '#e9edf2' : TEAM_COLORS[team], stripes: (r.k % 3) + 1, stripeColor: '#ffffff', rims: carDef.style === 'classic' || carDef.style === 'roadster' ? (r.k % 2) : 2 + (r.k % 3) };
      const model = buildCar(carDef, cust, { isPlayer: isP, team: color, number: isP ? (custom.number || 7) : [3, 11, 22, 44, 5, 88][r.k], lowDetail: !isP && this.app.engine.qualityName === 'low' });
      this.scene.add(model.root);
      const stats = isP ? carStats(def, up) : r.stats;
      const p = this.track.pointAt(slot.s, slot.d);
      const racer = {
        id: isP ? 'player' : 'ai' + r.k, isPlayer: isP, team, name: isP ? 'تو' : r.name, teamName: TEAM_NAMES[team], model, def: carDef, stats, custom: cust,
        looks: isP ? looksScore(custom) : r.looks,
        pos: p.clone(), heading: this.track.headingAt(slot.s), vel: new THREE.Vector3(), yawRate: 0, vf: 0, vl: 0, steer: 0, throttle: 0, brake: 0, hand: false,
        P: slot.s, d: slot.d, v: 0, dv: 0, hint: this.track.idx(Math.round(slot.s / DS)), gear: 1, rpm: 900, shiftT: 0, nitro: stats.nitro, nitroOn: false,
        roll: 0, pitch: 0, bounce: 0, spin: 0, slip: 0, surface: 0, latAcc: 0, longAcc: 0, finished: false, finishTime: 0, place: gi + 1, lap: 0,
        ai: isP ? null : { lane: (r.k % 3 - 1) * 0.9, skill: r.skill, wob: Math.random() * 10 }, wrongT: 0, lastHit: 0
      };
      this.racers.push(racer);
      this.placeModel(racer, 0);
    });
    this.player = this.racers.find((r) => r.isPlayer);
    this.buildWheelBatches();
    // چراغ جلو در شب
    if (this.night) {
      for (const r of this.racers) {
        const beam = new THREE.Mesh(new THREE.ConeGeometry(3.2, 22, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        beam.rotation.x = -Math.PI / 2; beam.position.set(0, 0.7, r.model.shape.L / 2 + 11); r.model.root.add(beam);
      }
      if (this.app.engine.q.headlight) {
        const spot = new THREE.SpotLight(0xfff1d0, 120, 120, 0.5, 0.5, 1.4);
        spot.position.set(0, 0.8, 2); spot.target.position.set(0, 0, 30);
        this.player.model.root.add(spot, spot.target);
      }
    }
  }

  // نورافکن‌های شب روی جایگاه اصلی، خط شروع و کنار ساختمان پیت
  addFloodlights(count = 5) {
    const tr = this.track;
    const spots = [[0, tr.wallL[0] + 9, 1], [0, 0, 0], [-60 / DS, tr.wallL[0] + 9, 1], [60 / DS, tr.wallL[0] + 9, 1], [-40 / DS, -(tr.wallR[0] + 10), 0]].slice(0, count);
    for (const [i, d, stand] of spots) {
      const p = tr.wp(Math.round(i), d, 0);
      const l = new THREE.SpotLight(0xfff2d6, stand ? 420 : 300, 90, stand ? 0.8 : 0.7, 0.7, 1.6);
      l.position.set(p.x, p.y + 26, p.z);
      const t = tr.wp(Math.round(i), stand ? d + 4 : d, 0); l.target.position.copy(t);
      this.scene.add(l, l.target);
    }
  }

  // همه چرخ‌های همه ماشین‌ها با چند InstancedMesh رسم می‌شوند (به جای ۲۸ مش جدا)
  buildWheelBatches() {
    const groups = new Map();
    for (const r of this.racers) for (const w of r.model.wheels) {
      const mesh = w.spin.children.find((c) => c.isMesh); if (!mesh) continue;
      const key = mesh.geometry.uuid;
      if (!groups.has(key)) groups.set(key, { geo: mesh.geometry, mat: mesh.material, list: [] });
      w.spin.remove(mesh);
      const proxy = new THREE.Object3D(); w.spin.add(proxy);
      groups.get(key).list.push(proxy);
    }
    this.wheelBatches = [...groups.values()].map((g) => {
      const im = new THREE.InstancedMesh(g.geo, g.mat, g.list.length);
      im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
      this.scene.add(im);
      return { im, list: g.list };
    });
  }
  updateWheelBatches() {
    if (!this.wheelBatches) return;
    for (const b of this.wheelBatches) {
      for (let i = 0; i < b.list.length; i++) { const p = b.list[i]; p.updateWorldMatrix(true, false); b.im.setMatrixAt(i, p.matrixWorld); }
      b.im.instanceMatrix.needsUpdate = true;
    }
  }

  buildBoss() {
    const rs = this.track.reservedSeat; const lvl = this.cfg.level;
    const rb = patternMaterial('rainbow');
    const boss = buildHuman({ shirtMat: rb, pantsMat: rb, skin: 0xd9a77e, hair: 0x111111, glasses: true, crown: lvl === 1000, belly: 0.03, build: 1.08, longSleeve: true, shoes: 0xffd700 });
    boss.root.scale.setScalar(lvl === 1000 ? 1.12 : 1.05);
    this.scene.add(boss.root);
    // برچسب نام
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 512, 0); ['#ff004c', '#ff9900', '#ffe600', '#33ff66', '#33aaff', '#aa44ff'].forEach((col, k) => g.addColorStop(k / 5, col));
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, 512, 128); ctx.fillStyle = g; ctx.font = "900 64px 'Vazirmatn', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(lvl === 1000 ? '👑 رئیس کل پیست' : 'رئیس کل پیست', 256, 66);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); tag.scale.set(2.6, 0.65, 1); tag.position.y = 2.3; boss.root.add(tag);
    boss.tag = tag;
    // مسیر راه رفتن: از ابتدای ردیف تا صندلی
    boss.path = [rs.startWorld.clone(), rs.world.clone().add(new THREE.Vector3().subVectors(rs.startWorld, rs.world).setY(0).normalize().multiplyScalar(0.0))];
    boss.seat = rs.world.clone(); boss.yaw = rs.yaw;
    boss.root.position.copy(rs.startWorld);
    boss.state = 'wait';
    this.boss = boss;
    this.sitBoss();
  }
  sitBoss() { const b = this.boss; b.root.position.copy(b.seat); b.root.rotation.y = b.yaw; b.pose('sit'); b.state = 'sit'; }

  makeTvSpots() {
    const spots = []; const n = this.track.n; const step = Math.round(110 / DS);
    for (let i = 0; i < n; i += step) {
      const sd = (i / step) % 2 ? 1 : -1; const tr = this.track;
      const wall = sd > 0 ? tr.wallL[i] : tr.wallR[i];
      const p = tr.wp(i, sd * (wall + 6), 0); p.y = tr.terrainHeight(p.x, p.z) + 3.5 + ((i * 7) % 5);
      spots.push({ p, s: i * DS });
    }
    return spots;
  }

  buildMinimap() {
    const tr = this.track; const b = tr.bounds; const S = 200;
    const sc = (S - 24) / Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    this.mm = { sc, ox: (S - (b.maxX - b.minX) * sc) / 2 - b.minX * sc, oz: (S - (b.maxZ - b.minZ) * sc) / 2 - b.minZ * sc, S };
    const c = document.createElement('canvas'); c.width = S; c.height = S; const ctx = c.getContext('2d');
    const P = (i) => [this.mm.ox + tr.px[i] * sc, this.mm.oz + tr.pz[i] * sc];
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [w, col] of [[9, 'rgba(0,0,0,0.55)'], [5, '#e9edf3'], [2, '#4b5563']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
      for (let i = 0; i <= tr.n; i += 2) { const [x, y] = P(i % tr.n); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath(); ctx.stroke();
    }
    const [sx, sy] = P(0); ctx.fillStyle = '#fff'; ctx.fillRect(sx - 4, sy - 4, 8, 8);
    this.mm.base = c;
  }

  // ---------------- حلقه اصلی ----------------
  begin() {
    this.setPhase(this.boss ? 'boss' : 'intro');
    this.app.audio.init();
    if (this.boss) { const b = this.boss; b.root.position.copy(b.path[0]); b.state = 'walk'; }
  }
  setPhase(p) { this.phase = p; this.phaseT = 0; this.app.ui.onPhase?.(p, this); }

  update(dt) {
    dt = Math.min(dt, 0.05);
    this.t += dt; this.phaseT += dt;
    PATTERN_UNIFORMS.uTime.value += dt;
    let input = this.app.input.update();
    if (this.app.autoDrive && this.player && !this.player.finished) input = this.autopilot(this.player);
    if (this.phase === 'replay') { this.updateReplay(dt); return; }
    if (this.app.input.consume('Escape') || this.app.input.consume('KeyP')) this.app.ui.togglePause?.();
    if (this.paused) { this.app.engine.render(this.scene, this.camera, dt); return; }
    const ph = this.phase;
    if (ph === 'boss') {
      this.updateBossIntro(dt);
      if (this.phaseT > 7 || this.app.input.consume('Enter') || this.skipFlag) { this.skipFlag = false; if (this.boss.state !== 'sit') this.sitBoss(); this.setPhase('intro'); }
    } else if (ph === 'intro') {
      if (this.phaseT > 3.2 || this.app.input.consume('Enter') || this.skipFlag) { this.skipFlag = false; this.setPhase('countdown'); this.track.setStartLights(0); this.lastCount = 4; }
    } else if (ph === 'countdown') {
      const c = 3 - Math.floor(this.phaseT);
      if (c !== this.lastCount && c >= 1) { this.lastCount = c; this.track.setStartLights(4 - c); this.app.audio.beep(520, 0.22); this.app.ui.countdown(c); }
      if (this.phaseT >= 3) { this.track.setStartLights(4); this.app.audio.beep(1040, 0.5, 0.3); this.app.ui.countdown(0); this.setPhase('race'); this.raceTime = 0; }
    } else if (ph === 'race' || ph === 'finish' || ph === 'judge' || ph === 'results') {
      this.raceTime += dt;
      if (ph === 'finish' && this.phaseT > 3.8) { if (this.info.judged) this.startJudge(); else this.showResults(); }
      if (ph === 'judge' && this.phaseT > 7.5) this.showResults();
    }
    // فیزیک با گام ثابت
    const racing = ph === 'race' || ph === 'finish' || ph === 'judge' || ph === 'results';
    const steps = Math.ceil(dt / (1 / 120)); const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (const r of this.racers) {
        if (r.isPlayer && !r.finished) this.stepPlayer(r, h, racing ? input : { steer: 0, throttle: input.throttle, brake: 1, handbrake: true, nitro: false }, racing);
        else this.stepAI(r, h, racing);
      }
      if (racing) this.collide(h);
    }
    if (racing) this.updateStandings();
    // کلیدها
    if (this.app.input.consume('KeyC')) this.cycleCamera();
    if (this.app.input.consume('KeyR') && ph === 'race') this.resetPlayer();
    // رکورد ویدیو
    if (ph !== 'boss' && ph !== 'intro' && !this.recordStopped) this.recordFrame(dt);
    this.render(dt);
  }

  render(dt) {
    const app = this.app;
    for (const r of this.racers) this.placeModel(r, dt);
    if (this.boss) this.updateBoss(dt);
    this.updateCamera(dt);
    if (this.skipDraw) { this.effects.update(dt, 800); return; }
    this.updateWheelBatches();
    this.outdoor.update(dt, this.player.pos, this.camera);
    if (!this._carsInfo) this._carsInfo = this.racers.map((r) => ({ pos: r.pos, team: r.team, place: 0, finished: false }));
    this.racers.forEach((r, k) => { const c = this._carsInfo[k]; c.place = r.place; c.finished = r.finished; c.pos = r.pos; });
    this.track.update(this.t, this._carsInfo, this.camera.position, this.player);
    this.effects.update(dt, app.engine.renderer.domElement.height);
    // صداها
    const p = this.player;
    app.audio.setEngine({ rpm: p.rpm, throttle: p.throttle, speed: Math.abs(p.vf) * 3.6, cyl: p.def.style === 'muscle' ? 8 : p.def.style === 'classic' ? 6 : 10, on: this.phase !== 'boss' });
    app.audio.setSkid(this.phase === 'replay' ? 0 : clamp((p.slip - 2) / 6, 0, 1));
    let nd = 999, nrpm = 0; for (const r of this.racers) if (!r.isPlayer) { const d = r.pos.distanceTo(p.pos); if (d < nd) { nd = d; nrpm = r.rpm; } }
    app.audio.setOthers(nd, nrpm);
    let crowd = 0; for (const c of this.track.crowds) { const d = c.center.distanceTo(this.camera.position); crowd = Math.max(crowd, (c.excite || 0) * clamp(1 - d / 160, 0, 1)); }
    app.audio.setCrowd(crowd);
    // پس‌پردازش سرعت
    const sp = Math.abs(p.vf);
    app.engine.finalPass.uniforms.uSpeed.value = this.phase === 'race' ? clamp((sp - 30) / 60, 0, 1) * (this.camMode === 'cockpit' ? 0.5 : 0.8) + (p.nitroOn ? 0.35 : 0) : 0;
    app.engine.finalPass.uniforms.uFlash.value = damp(app.engine.finalPass.uniforms.uFlash.value, 0, 6, dt);
    app.engine.render(this.scene, this.camera, dt);
    app.ui.hud?.(this, dt);
  }

  // ---------------- فیزیک بازیکن ----------------
  stepPlayer(r, dt, inp, racing) {
    const st = r.stats; const tr = this.track;
    const nitroOn = racing && inp.nitro && r.nitro > 0 && inp.throttle > 0;
    r.nitroOn = nitroOn;
    if (nitroOn) r.nitro = Math.max(0, r.nitro - dt); else if (st.nitro > 0) r.nitro = Math.min(st.nitro, r.nitro + dt * 0.08);
    const steerRate = Math.abs(inp.steer) > Math.abs(r.steer) ? 5.5 : 9;
    r.steer = damp(r.steer, inp.steer, steerRate, dt);
    r.throttle = damp(r.throttle, inp.throttle, 10, dt); r.brake = damp(r.brake, inp.brake, 12, dt); r.hand = inp.handbrake;
    let fx = Math.sin(r.heading), fz = Math.cos(r.heading);
    let vf = r.vel.x * fx + r.vel.z * fz;
    const speed = Math.abs(vf);
    // سطح زیر چرخ
    const surfGrip = r.surface === 0 ? 1 : r.surface === 1 ? 0.95 : r.surface === 2 ? 0.62 : r.surface === 3 ? 0.48 : 0.9;
    const maxSteer = lerp(0.62, 0.1, clamp(speed / (st.vmax * 0.85), 0, 1));
    const sa = r.steer * maxSteer;
    const wb = r.model.shape.wb;
    let yawT = (vf / wb) * Math.tan(sa);
    const gripLat = st.grip * 9.81 * surfGrip;
    const yawMax = (gripLat / Math.max(speed, 3)) * (r.hand ? 1.6 : 1.12);
    yawT = clamp(yawT, -yawMax, yawMax);
    if (r.hand && speed > 8) yawT *= 1.35;
    r.yawRate = damp(r.yawRate, yawT, r.hand ? 6 : 9, dt);
    r.heading += r.yawRate * dt;
    fx = Math.sin(r.heading); fz = Math.cos(r.heading);
    const lx = fz, lz = -fx;
    vf = r.vel.x * fx + r.vel.z * fz; let vl = r.vel.x * lx + r.vel.z * lz;
    // نیروی طولی
    const vmax = st.vmax * (nitroOn ? 1.12 : 1);
    let acc = 0;
    if (r.shiftT > 0) r.shiftT -= dt;
    if (racing && r.throttle > 0.02 && vf > -0.5) {
      const curve = Math.max(0, 1 - Math.pow(Math.max(0, vf) / vmax, 2.3));
      acc += st.acc * (1.15 - 0.15 * (vf / vmax)) * curve * r.throttle * (nitroOn ? 1.6 : 1) * (r.shiftT > 0 ? 0.35 : 1) * (0.55 + 0.45 * surfGrip);
    }
    if (r.brake > 0.02) {
      if (vf > 0.6) acc -= st.brake * r.brake * (0.6 + 0.4 * surfGrip);
      else if (racing) acc -= st.acc * 0.55 * r.brake * (vf > -9 ? 1 : 0);
    }
    if (r.hand) acc -= Math.sign(vf) * 3.5;
    acc -= vf * (0.005 + (r.surface === 2 ? 0.45 : r.surface === 3 ? 0.85 : r.surface === 4 ? 0.12 : 0));
    if (!racing && Math.abs(vf) < 0.3) { vf = 0; acc = 0; }
    const vfOld = vf;
    vf += acc * dt;
    if (vfOld > 0 && vf < 0 && r.brake > 0 && !(racing && r.brake > 0.5 && Math.abs(vfOld) < 0.7)) vf = Math.max(vf, 0);
    // نیروی جانبی (کشش لاستیک)
    const latGrip = gripLat * (r.hand ? 0.32 : 1) * 1.05;
    const dvl = Math.min(Math.abs(vl), latGrip * dt);
    vl -= Math.sign(vl) * dvl;
    r.slip = Math.abs(vl) + (r.brake > 0.85 && speed > 18 ? 3 : 0) + (r.throttle > 0.9 && speed < 10 && st.acc > 5 ? 3 : 0);
    r.latAcc = vf * r.yawRate; r.longAcc = acc;
    r.vel.set(fx * vf + lx * vl, 0, fz * vf + lz * vl);
    r.vf = vf; r.vl = vl;
    r.pos.x += r.vel.x * dt; r.pos.z += r.vel.z * dt;
    // موقعیت روی پیست
    const loc = tr.locate(r.pos.x, r.pos.z, r.hint, this.tmpLoc);
    const ds = loc.s - (r.hint * DS); r.hint = loc.i;
    this.advanceProgress(r, loc.s);
    r.d = loc.d;
    const ad = Math.abs(loc.d);
    const kerb = (loc.d > 0 ? tr.kerbL : tr.kerbR)[loc.i];
    const surf = (loc.d > 0 ? tr.surfL : tr.surfR)[loc.i];
    if (ad <= loc.hw) r.surface = 0; else if (ad <= loc.hw + 1.3 && kerb) r.surface = 1; else if (ad <= loc.hw + 0.4) r.surface = 0; else r.surface = surf === 1 ? 3 : surf === 2 ? 4 : (ad <= loc.hw + 3.5 && !kerb ? 2 : 2);
    if (surf === 2 && ad > loc.hw + 0.4) r.surface = 4;
    // دیوارها
    const half = r.model.shape.W / 2;
    const wl = loc.wallL - half - 0.1, wr = -(loc.wallR - half - 0.1);
    if (loc.d > wl || loc.d < wr) {
      const over = loc.d > wl ? loc.d - wl : loc.d - wr; const sgn = Math.sign(over);
      r.pos.x -= loc.lx * over; r.pos.z -= loc.lz * over;
      const vn = r.vel.x * loc.lx * sgn + r.vel.z * loc.lz * sgn;
      if (vn > 0) {
        r.vel.x -= loc.lx * sgn * vn * 1.35; r.vel.z -= loc.lz * sgn * vn * 1.35;
        const loss = clamp(vn / 25, 0.04, 0.5); r.vel.multiplyScalar(1 - loss);
        if (vn > 2 && this.t - r.lastHit > 0.15) {
          r.lastHit = this.t; this.app.audio.thump(clamp(vn / 15, 0.2, 0.8)); this.shake = Math.min(1, (this.shake || 0) + vn / 12);
          _v1.copy(r.pos).add(_v2.set(loc.lx * sgn * half, 0.5, loc.lz * sgn * half));
          this.effects.spark(_v1, _v2.set(fx, 0, fz));
        }
        // چرخاندن ماشین در امتداد دیوار
        const th = tr.heading[loc.i]; const da = wrapAngle(th - r.heading); const along = Math.abs(da) < Math.PI / 2 ? th : th + Math.PI;
        r.heading += wrapAngle(along - r.heading) * clamp(vn / 30, 0.05, 0.35);
      }
    }
    // ارتفاع و شیب
    r.pos.y = loc.y + (r.surface === 1 ? 0.05 : 0);
    const dirDot = fx * loc.tx + fz * loc.tz;
    r.pitch = -Math.atan(loc.slope * dirDot);
    // دنده و دور موتور
    this.gearbox(r, vf, st);
    // جهت اشتباه
    if (racing && dirDot < -0.4 && speed > 4) r.wrongT += dt; else r.wrongT = Math.max(0, r.wrongT - dt * 2);
  }

  // خلبان خودکار (برای آزمایش تعادل بازی)
  autopilot(r) {
    const tr = this.track; const v = Math.max(0, r.vf); const st = r.stats;
    const look = 7 + v * 0.45;
    const s = ((r.P % tr.length) + tr.length) % tr.length;
    const iA = tr.idx(Math.floor((s + look) / DS));
    const tgt = tr.pointAt(s + look, tr.rl[iA] * (tr.hw[iA] - 1.7) * 0.85, _v3);
    const want = Math.atan2(tgt.x - r.pos.x, tgt.z - r.pos.z);
    const err = wrapAngle(want - r.heading);
    let vt = st.vmax; const brake = st.brake * 0.9;
    for (let x = 0; x < (v * v) / (2 * brake) + 30; x += 6) {
      const i = tr.idx(Math.floor((s + x) / DS)); const k = Math.abs(tr.ks[i]) + Math.abs(tr.kappa[i]) * 0.25;
      const vc = Math.sqrt((st.grip * 9.81 * 0.97) / Math.max(k, 1e-4)); vt = Math.min(vt, Math.sqrt(vc * vc + 2 * brake * x));
    }
    return { steer: clamp(err * 3.2, -1, 1), throttle: v < vt ? 1 : 0, brake: v > vt + 1.5 ? 1 : 0, handbrake: false, nitro: true };
  }

  gearbox(r, vf, st) {
    const v = Math.abs(vf); const top = st.vmax; const g = vf < -0.5 ? 0 : clamp(1 + Math.floor(v / (top / 5.6)), 1, 6);
    if (g > r.gear && r.gear > 0 && this.phase === 'race') { r.shiftT = 0.12; if (r.isPlayer) { this.app.audio.pop(); this.popFlame = 0.18; } }
    r.gear = g;
    const lo = (g - 1) * (top / 5.6), hi = g * (top / 5.6);
    const f = g === 0 ? v / 10 : clamp((v - lo) / (hi - lo), 0, 1);
    const target = 1100 + f * 6000 + (r.throttle > 0.1 && v < 2 ? 3000 * r.throttle : 0);
    r.rpm = lerp(r.rpm, target, 0.2);
  }

  advanceProgress(r, s) {
    const L = this.track.length;
    const cur = ((r.P % L) + L) % L;
    let ds = s - cur; if (ds > L / 2) ds -= L; if (ds < -L / 2) ds += L;
    r.P += ds;
    const laps = this.info.laps;
    if (!r.finished && r.P >= laps * L && (this.phase === 'race' || this.phase === 'finish' || this.phase === 'judge' || this.phase === 'results')) this.finishRacer(r);
    r.lap = clamp(Math.floor(r.P / L) + 1, 1, laps);
  }

  // ---------------- هوش مصنوعی ----------------
  stepAI(r, dt, racing) {
    const tr = this.track; const st = r.stats; const L = tr.length;
    if (!r.ai) r.ai = { lane: 0, skill: 1, wob: 0, auto: true };
    const ai = r.ai;
    if (r.isPlayer && !ai.init) { ai.init = true; r.v = Math.max(0, r.vf); r.d = r.d || 0; r.dv = 0; }
    let v = r.v;
    const iNow = tr.idx(Math.floor(r.P / DS));
    if (racing) {
      const vmax = st.vmax * (r.finished ? 0.75 : 1) * (ai.boost || 1);
      const brake = st.brake * 0.92;
      let vt = vmax;
      const look = (v * v) / (2 * brake) + 30;
      for (let x = 0; x < look; x += 6) {
        const i = tr.idx(Math.floor((r.P + x) / DS));
        const k = Math.abs(tr.ks[i]) + Math.abs(tr.kappa[i]) * 0.25;
        const vc = Math.sqrt((st.grip * 9.81) / Math.max(k, 1e-4));
        const allowed = Math.sqrt(vc * vc + 2 * brake * x);
        if (allowed < vt) vt = allowed;
      }
      // اجتناب و سبقت
      let target = tr.rl[iNow] * (tr.hw[iNow] - 1.7) * 0.85 + ai.lane;
      for (const o of this.racers) {
        if (o === r) continue;
        let gap = o.P - r.P; if (gap > L / 2) gap -= L; if (gap < -L / 2) gap += L;
        const dd = o.d - r.d;
        if (gap > -2 && gap < 28 && Math.abs(dd) < 2.4) {
          const ov = o.isPlayer && !o.finished ? o.vf : o.v;
          if (ov < v - 0.3) {
            const room = tr.hw[iNow] - 1.2;
            const left = o.d + 2.9, right = o.d - 2.9;
            target = (Math.abs(left) < room && (Math.abs(right) >= room || Math.abs(left - target) < Math.abs(right - target))) ? left : right;
            if (gap < 9) vt = Math.min(vt, ov + 1.5);
          } else if (gap < 10) vt = Math.min(vt, ov);
        }
        if (Math.abs(gap) < 5.5 && Math.abs(dd) < 2.5) target -= Math.sign(dd || 1) * 1.6;
      }
      const accel = st.acc * Math.max(0, 1 - Math.pow(Math.max(0, v) / vmax, 2.3)) * 1.1;
      if (v < vt) v = Math.min(vt, v + accel * dt); else v = Math.max(vt, v - brake * dt);
      ai.target = clamp(target, -(tr.hw[iNow] - 1.0), tr.hw[iNow] - 1.0);
    } else { v = Math.max(0, v - 8 * dt); ai.target = r.d; }
    const latRate = 2.2 + v * 0.04;
    const dd = clamp(ai.target - r.d, -latRate * dt, latRate * dt);
    r.d += dd + r.dv * dt; r.dv *= Math.exp(-3 * dt);
    const lim = Math.min(tr.wallL[iNow], tr.wallR[iNow]) - 1.2;
    r.d = clamp(r.d, -lim, lim);
    r.v = v; r.P += v * dt;
    const p = tr.pointAt(r.P, r.d, _v1);
    const prev = r.pos.clone();
    r.pos.copy(p);
    const lat = dd / Math.max(dt, 1e-4);
    const kk = tr.ks[iNow];
    const slipVis = clamp(kk * v * v * 0.0035, -0.12, 0.12);
    const th = tr.headingAt(r.P) + Math.atan2(lat, Math.max(v, 1)) * 0.6 + slipVis;
    const oldH = r.heading;
    r.heading = oldH + wrapAngle(th - oldH) * Math.min(1, dt * 12);
    r.yawRate = wrapAngle(r.heading - oldH) / dt;
    r.vf = v; r.vl = lat; r.vel.subVectors(r.pos, prev).divideScalar(dt); r.vel.y = 0;
    r.latAcc = v * r.yawRate; r.longAcc = 0;
    r.steer = clamp(kk * 40 + lat * 0.1, -1, 1);
    r.slip = Math.abs(slipVis) > 0.09 ? 4 : 0;
    r.throttle = racing ? 0.8 : 0; r.brake = 0;
    const loc = tr.locate(r.pos.x, r.pos.z, r.hint, this.tmpLoc); r.hint = loc.i;
    r.pitch = -Math.atan(loc.slope);
    r.surface = Math.abs(r.d) > tr.hw[iNow] ? 1 : 0;
    this.gearbox(r, v, st);
    if (!r.isPlayer || r.finished) {
      const laps = this.info.laps;
      if (!r.finished && r.P >= laps * L && racing) this.finishRacer(r);
      r.lap = clamp(Math.floor(r.P / L) + 1, 1, laps);
    }
  }

  collide(dt) {
    const rs = this.racers;
    for (let a = 0; a < rs.length; a++) for (let b = a + 1; b < rs.length; b++) {
      const A = rs[a], B = rs[b];
      if (Math.abs(A.pos.x - B.pos.x) > 7 || Math.abs(A.pos.z - B.pos.z) > 7) continue;
      for (const oa of [-1.15, 1.15]) for (const ob of [-1.15, 1.15]) {
        const ax = A.pos.x + Math.sin(A.heading) * oa, az = A.pos.z + Math.cos(A.heading) * oa;
        const bx = B.pos.x + Math.sin(B.heading) * ob, bz = B.pos.z + Math.cos(B.heading) * ob;
        let nx = bx - ax, nz = bz - az; const d = Math.hypot(nx, nz); const R = 1.9;
        if (d >= R || d < 1e-4) continue;
        nx /= d; nz /= d; const over = R - d;
        this.pushRacer(A, -nx * over * 0.5, -nz * over * 0.5);
        this.pushRacer(B, nx * over * 0.5, nz * over * 0.5);
        const rel = (B.vel.x - A.vel.x) * nx + (B.vel.z - A.vel.z) * nz;
        if (rel < 0) {
          const j = -rel * 0.6;
          this.impulse(A, -nx * j * 0.5, -nz * j * 0.5); this.impulse(B, nx * j * 0.5, nz * j * 0.5);
          if (-rel > 2 && (A.isPlayer || B.isPlayer) && this.t - (this.lastBump || 0) > 0.25) {
            this.lastBump = this.t; this.app.audio.thump(clamp(-rel / 12, 0.2, 0.7)); this.shake = Math.min(1, (this.shake || 0) + 0.4);
            this.effects.spark(_v1.set((ax + bx) / 2, Math.max(A.pos.y, B.pos.y) + 0.5, (az + bz) / 2), _v2.set(nz, 0, -nx));
          }
        }
      }
    }
  }
  pushRacer(r, x, z) {
    if (r.isPlayer && !r.finished) { r.pos.x += x; r.pos.z += z; return; }
    const i = r.hint; const lx = this.track.tz[i], lz = -this.track.tx[i];
    r.d += x * lx + z * lz; r.P += x * this.track.tx[i] + z * this.track.tz[i];
  }
  impulse(r, x, z) {
    if (r.isPlayer && !r.finished) { r.vel.x += x; r.vel.z += z; return; }
    const i = r.hint; const lx = this.track.tz[i], lz = -this.track.tx[i];
    r.dv += (x * lx + z * lz) * 0.8; r.v = Math.max(0, r.v + (x * this.track.tx[i] + z * this.track.tz[i]));
  }

  resetPlayer() {
    const r = this.player; const tr = this.track;
    const s = ((r.P % tr.length) + tr.length) % tr.length;
    const p = tr.pointAt(s, 0); r.pos.copy(p); r.heading = tr.headingAt(s); r.vel.set(0, 0, 0); r.yawRate = 0; r.d = 0;
    this.app.ui.toast?.('ماشین به پیست برگشت');
  }

  finishRacer(r) {
    r.finished = true; r.finishTime = this.raceTime;
    if (r.isPlayer) {
      this.playerFinishTime = this.raceTime;
      r.ai = { lane: 0, skill: 1, auto: true };
      r.v = Math.max(8, r.vf);
      this.setPhase('finish');
      this.app.audio.cheer(4);
      const place = this.racers.filter((o) => o.finished).length;
      if (place <= 3 && !this.info.judged) this.effects.confettiBurst(this.track.wp(0, 0, 0), 400);
    }
  }

  updateStandings() {
    const arr = [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1; if (b.finished) return 1;
      return b.P - a.P;
    });
    arr.forEach((r, k) => { r.place = k + 1; });
    this.standings = arr;
    // نمایشگر بزرگ پیست
    if ((!this._scrT || this.t - this._scrT > 1.5) && this.track.screenMesh && this.camera.position.distanceToSquared(this.track.screenMesh.getWorldPosition(_v3)) < 600 * 600) {
      this._scrT = this.t;
      const L = this.track.length; const lead = arr[0];
      this.track.drawScreen(arr.map((r) => ({ pos: toFa(r.place), name: r.isPlayer ? 'تو (قهرمان)' : r.name + ' - ' + r.teamName, player: r.isPlayer, info: r.finished ? fmtTime(r.finishTime) : (r === lead ? 'دور ' + toFa(r.lap) : '+' + toFa(Math.max(0, Math.round(lead.P - r.P))) + 'm') })), 'مرحله ' + toFa(this.cfg.level) + ' • ' + this.track.name);
    }
  }

  // ---------------- قرار دادن مدل‌ها ----------------
  placeModel(r, dt) {
    const m = r.model; const root = m.root;
    root.position.copy(r.pos);
    m.setLOD(r.pos.distanceTo(this.camera.position));
    _e.set(r.pitch, r.heading, 0, 'YXZ'); root.quaternion.setFromEuler(_e);
    const roll = clamp(r.latAcc * 0.011, -0.085, 0.085);
    const pitchB = clamp(-r.longAcc * 0.005, -0.05, 0.05);
    r.roll = damp(r.roll, roll, 6, dt || 0.016); r.bodyPitch = damp(r.bodyPitch || 0, pitchB, 6, dt || 0.016);
    const kerbShake = r.surface === 1 ? (Math.random() - 0.5) * 0.02 : r.surface >= 2 ? (Math.random() - 0.5) * 0.015 * Math.min(1, Math.abs(r.vf) / 20) : 0;
    r.spin += (r.vf / m.shape.wr) * (dt || 0);
    m.setVisualState({ steer: r.steer, spin: r.spin, gear: r.gear, throttle: r.throttle, brake: r.brake, speedKmh: Math.abs(r.vf) * 3.6, rpm: r.rpm, roll: r.roll, pitch: r.bodyPitch, bounce: kerbShake });
    if (dt) this.carEffects(r, dt);
  }

  carEffects(r, dt) {
    const m = r.model; const sp = Math.abs(r.vf);
    const camD = r.pos.distanceTo(this.camera.position);
    if (camD > 140) return;
    const fx = Math.sin(r.heading), fz = Math.cos(r.heading), lx = fz, lz = -fx;
    const rearZ = -m.shape.wb / 2, wx = m.shape.W / 2 - 0.25;
    const smokeCol = this._smokeCol || (this._smokeCol = new THREE.Color());
    const sliding = r.slip > 2.4 && r.surface <= 1;
    for (const sx of [1, -1]) {
      const wp = _v3.set(r.pos.x + fx * rearZ + lx * wx * sx, r.pos.y + 0.12, r.pos.z + fz * rearZ + lz * wx * sx);
      const key = r.id + sx;
      if (sliding) {
        smokeCol.set(r.isPlayer ? CUSTOM.smoke.hex[r.custom.smoke || 0] : '#eeeeee');
        if (Math.random() < 0.7) this.effects.tireSmoke(wp, r.vel, smokeCol, clamp((r.slip - 2) / 6, 0.2, 1));
        _v2.set(lx, 0, lz); this.effects.skids.add(key, _v1.copy(wp).setY(r.pos.y + 0.06), _v2, clamp((r.slip - 2) / 5, 0.15, 0.55));
      } else this.effects.skids.break(key);
      if (r.surface >= 2 && sp > 4 && Math.random() < 0.6) this.effects.dirt(wp, r.vel, r.surface === 3);
    }
    // شعله اگزوز
    if ((r.isPlayer && (r.nitroOn || this.popFlame > 0)) && m.exhaust.length) {
      for (const e of m.exhaust) {
        _v1.copy(e); _v1.z -= 0.1; m.root.localToWorld(_v1);
        this.effects.flame(_v1, _v2.set(-fx, 0, -fz), r.nitroOn);
      }
      if (this.popFlame > 0) this.popFlame -= dt;
    }
  }

  // ---------------- رئیس کل ----------------
  updateBossIntro(dt) {
    const b = this.boss; if (!b) return;
    if (b.state === 'walk') {
      const target = b.seat; const dir = _v1.subVectors(target, b.root.position); dir.y = 0;
      const dist = dir.length();
      if (dist < 0.08) { b.state = 'turn'; b.turnT = 0; }
      else { dir.normalize(); b.root.position.addScaledVector(dir, Math.min(dist, 1.2 * dt)); b.root.rotation.y = Math.atan2(dir.x, dir.z); b.walk(dt, 1.2); }
    } else if (b.state === 'turn') {
      b.turnT += dt; b.root.rotation.y += wrapAngle(b.yaw - b.root.rotation.y) * Math.min(1, dt * 6);
      b.pose('stand'); b.j.shoulderR.rotation.x = -2.8 + Math.sin(this.t * 8) * 0.3; b.j.shoulderR.rotation.z = -0.3;
      if (b.turnT > 1.4) this.sitBoss();
    }
  }
  updateBoss(dt) {
    const b = this.boss;
    if (this.phase === 'judge') {
      b.root.position.copy(b.seat); b.root.rotation.y = b.yaw;
      if (this.phaseT < 1.2) b.pose('stand'); else b.cheer(this.t);
      b.root.updateMatrixWorld(); b.lookAtWorld(this.player.pos);
      if (this.cfg.level === 1000 && Math.random() < dt * 2.5) this.effects.firework(_v1.copy(b.seat).add(_v2.set((Math.random() - 0.5) * 120, 40 + Math.random() * 30, (Math.random() - 0.5) * 120)));
    } else if (b.state === 'sit') {
      b.pose('sit'); b.root.updateMatrixWorld(); b.lookAtWorld(this.player.pos);
      if (this.player.place === 1 && this.phase === 'race' && Math.sin(this.t * 0.7) > 0.6) { b.j.shoulderL.rotation.x = b.j.shoulderR.rotation.x = -1.0; b.j.elbowL.rotation.x = b.j.elbowR.rotation.x = -0.8; b.j.shoulderL.rotation.z = -0.25 - Math.sin(this.t * 12) * 0.1; b.j.shoulderR.rotation.z = 0.25 + Math.sin(this.t * 12) * 0.1; }
    }
    b.tag.visible = this.camera.position.distanceTo(b.root.position) < 120;
  }

  startJudge() {
    // داوری: رتبه فقط بر اساس قدرت، سرعت و ظاهر ماشین
    const rows = this.racers.map((r) => ({ r, score: judgeScore(r.stats, r.looks) }));
    rows.sort((a, b) => b.score - a.score);
    this.judgeRows = rows;
    this.setPhase('judge');
    this.app.audio.cheer(6);
    if (this.cfg.level === 1000) for (let k = 0; k < 4; k++) this.effects.firework(_v1.copy(this.boss.seat).add(_v2.set((k - 1.5) * 30, 45, -40)));
  }

  showResults() {
    if (this.phase === 'results') return;
    // تخمین زمان کسانی که هنوز نرسیده‌اند
    const L = this.track.length * this.info.laps;
    const res = this.racers.map((r) => ({ r, time: r.finished ? r.finishTime : this.raceTime + Math.max(0, L - r.P) / Math.max(15, r.isPlayer ? Math.abs(r.vf) : r.v) }));
    res.sort((a, b) => a.time - b.time);
    let order = res;
    if (this.info.judged && this.judgeRows) order = this.judgeRows.map((j) => res.find((x) => x.r === j.r));
    const place = order.findIndex((x) => x.r.isPlayer) + 1;
    this.result = { order, place, coins: COINS[place - 1] || 0, judged: this.info.judged, judgeRows: this.judgeRows };
    this.setPhase('results');
    if (place <= 3) { this.effects.confettiBurst(this.player.pos, 500); this.app.audio.cheer(3); }
    setTimeout(() => { this.recordStopped = true; }, 2500);
    this.app.onRaceResult?.(this.result, this);
  }

  // ---------------- دوربین ----------------
  cycleCamera() {
    const modes = ['chase', 'cockpit', 'top'];
    this.camMode = modes[(modes.indexOf(this.camMode) + 1) % modes.length];
    this.app.ui.toast?.({ chase: 'دید سوم شخص', cockpit: 'دید اول شخص (داخل ماشین)', top: 'دید از بالا' }[this.camMode]);
    this.camInit = false;
  }

  updateCamera(dt) {
    const cam = this.camera; const ph = this.phase;
    const p = this.player;
    if (this.player.model.driver) this.player.model.driver.j.head.visible = !(this.camMode === 'cockpit' && (ph === 'race' || ph === 'countdown' || ph === 'finish'));
    this.shake = damp(this.shake || 0, 0, 4, dt);
    if (ph === 'boss' && this.boss) {
      const b = this.boss; const yaw = b.yaw;
      const fwd = _v1.set(Math.sin(yaw), 0, Math.cos(yaw));
      const target = _v2.copy(b.root.position).add(_v3.set(0, 1.3, 0));
      const t = clamp(this.phaseT / 7, 0, 1);
      const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
      // دوربین بین توری ایمنی و جایگاه قرار می‌گیرد
      cam.position.copy(b.seat).addScaledVector(fwd, 3.0).addScaledVector(side, 2.6 - t * 4.2).add(_v3.set(0, 2.4 - t * 0.6, 0));
      cam.lookAt(target); cam.fov = 58; cam.updateProjectionMatrix();
      return;
    }
    if (ph === 'intro') {
      // حرکت کرین روی پیست از جلوی خط استارت به سمت ماشین‌ها
      const t = clamp(this.phaseT / 3.2, 0, 1); const e = t * t * (3 - 2 * t);
      const pos = this.track.pointAt(lerp(25, -50, e), Math.sin(e * Math.PI) * 4.5, _v3);
      cam.position.set(pos.x, pos.y + lerp(9, 2.4, e), pos.z);
      const c = this.track.pointAt(lerp(-30, -66, e), 0, _v1);
      cam.lookAt(c.x, c.y + 0.8, c.z); cam.fov = 55; cam.updateProjectionMatrix();
      return;
    }
    if (ph === 'judge' && this.boss) {
      const b = this.boss; const t = this.phaseT;
      if (t < 3.5) {
        const fwd = _v1.set(Math.sin(b.yaw), 0, Math.cos(b.yaw));
        const tg = _v2.copy(b.seat).add(_v3.set(0, 1.4, 0));
        cam.position.copy(tg).addScaledVector(fwd, 3.0).add(_v3.set(Math.sin(t) * 1.5, 0.7, 0)); cam.lookAt(tg); cam.fov = 55;
      } else {
        const a = t * 0.6; cam.position.set(p.pos.x + Math.sin(a) * 7, p.pos.y + 2.5, p.pos.z + Math.cos(a) * 7); cam.lookAt(p.pos.x, p.pos.y + 0.8, p.pos.z); cam.fov = 50;
      }
      cam.updateProjectionMatrix(); return;
    }
    if (ph === 'results' || (ph === 'finish' && this.phaseT > 0.6)) {
      const a = this.t * 0.25; const d = 9;
      _v1.set(p.pos.x + Math.sin(a) * d, p.pos.y + 3, p.pos.z + Math.cos(a) * d);
      cam.position.lerp(_v1, Math.min(1, dt * 2)); cam.lookAt(p.pos.x, p.pos.y + 0.9, p.pos.z); cam.fov = 50; cam.updateProjectionMatrix();
      return;
    }
    this.followCam(p, this.camMode, dt);
  }

  followCam(r, mode, dt) {
    const cam = this.camera; const m = r.model; const s = m.shape;
    const fx = Math.sin(r.heading), fz = Math.cos(r.heading);
    const sp = Math.abs(r.vf);
    const shake = (this.shake || 0) * 0.08 + (r.surface >= 1 ? 0.012 * Math.min(1, sp / 20) : 0);
    const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
    if (mode === 'cockpit') {
      m.root.updateMatrixWorld(true);
      this.app.input.look = damp(this.app.input.look, this.app.input.lookTarget + (this.dragLook || 0), 6, dt);
      this.lookPitch = damp(this.lookPitch || 0, this.dragPitch || 0, 6, dt);
      const eye = _v1.copy(m.eye).add(_v2.set(0, 0.07, 0.04)); m.body.localToWorld(eye);
      cam.position.set(eye.x + sx, eye.y + sy, eye.z);
      const q = m.body.getWorldQuaternion(_q);
      this._ce = this._ce || new THREE.Euler(); this._cq = this._cq || new THREE.Quaternion();
      cam.quaternion.copy(q).multiply(this._cq.setFromEuler(this._ce.set(-0.2 + this.lookPitch, Math.PI + this.app.input.look * 1.3, 0, 'YXZ')));
      cam.fov = 80 + clamp(sp / 8, 0, 6); cam.near = 0.05; cam.updateProjectionMatrix();
      return;
    }
    cam.near = 0.1;
    if (!this.camInit) { this.camYaw = r.heading; this.camInit = true; this.camPos = null; }
    // جهت دوربین به آرامی جهت ماشین (و کمی جهت حرکت) را دنبال می‌کند
    let targetYaw = r.heading;
    if (sp > 6) { const vy = Math.atan2(r.vel.x, r.vel.z); targetYaw = r.heading + wrapAngle(vy - r.heading) * 0.35; }
    if (r.vf < -2) targetYaw = r.heading;
    this.camYaw += wrapAngle(targetYaw - this.camYaw) * Math.min(1, dt * (mode === 'top' ? 5 : 4.2));
    const cfx = Math.sin(this.camYaw), cfz = Math.cos(this.camYaw);
    let desired, look;
    if (mode === 'top') {
      const back = s.L / 2 + 2.0, up = s.roof + 2.0;
      desired = _v1.set(r.pos.x - cfx * back, r.pos.y + up, r.pos.z - cfz * back);
      look = _v2.set(r.pos.x + cfx * 1.2, r.pos.y + 0.4, r.pos.z + cfz * 1.2);
      cam.fov = 70;
    } else {
      const dist = 6.2 + s.L * 0.18 + clamp(sp / 30, 0, 1.4); const h = 2.0 + s.roof * 0.35;
      desired = _v1.set(r.pos.x - cfx * dist, r.pos.y + h, r.pos.z - cfz * dist);
      look = _v2.set(r.pos.x + cfx * 4, r.pos.y + 1.0, r.pos.z + cfz * 4);
      cam.fov = 60 + clamp((sp - 10) / 4, 0, 14) + (r.nitroOn ? 7 : 0);
    }
    if (!this.camPos) this.camPos = desired.clone();
    this.camPos.lerp(desired, Math.min(1, dt * (mode === 'top' ? 12 : 9)));
    const gy = this.track.locate(this.camPos.x, this.camPos.z, r.hint, this._camLoc || (this._camLoc = {})).y + 0.6;
    if (this.camPos.y < gy) this.camPos.y = gy;
    cam.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
    cam.lookAt(look);
    cam.updateProjectionMatrix();
  }

  // ---------------- ضبط و پخش ویدیو ----------------
  recordFrame(dt) {
    const rec = this.record; rec.acc += dt;
    while (rec.acc >= rec.dt) {
      rec.acc -= rec.dt;
      const f = new Float32Array(this.racers.length * 12 + 2);
      f[0] = this.phase === 'countdown' ? -1 : this.raceTime; f[1] = this.phase === 'judge' ? 2 : this.phase === 'results' ? 3 : this.phase === 'finish' ? 1 : 0;
      this.racers.forEach((r, k) => {
        const o = 2 + k * 12;
        f[o] = r.pos.x; f[o + 1] = r.pos.y; f[o + 2] = r.pos.z; f[o + 3] = r.heading; f[o + 4] = r.pitch; f[o + 5] = r.latAcc; f[o + 6] = r.steer;
        f[o + 7] = r.vf; f[o + 8] = r.slip; f[o + 9] = r.place; f[o + 10] = r.brake; f[o + 11] = (r.nitroOn ? 1 : 0) + (r.finished ? 2 : 0) + r.surface * 4;
      });
      rec.frames.push(f);
      if (rec.frames.length > 30 * 60 * 12) rec.frames.shift();
    }
  }

  startReplay() {
    if (this.replayWatched || !this.record.frames.length) return false;
    this.replayWatched = true;
    this.prevPhase = this.phase; this.phase = 'replay';
    this.rp = { t: 0, speed: 1, playing: true, cam: 'auto', target: 0, dirT: 0, dirMode: 'tv', spot: null };
    this.effects.clear();
    if (this.boss) this.sitBoss();
    return true;
  }
  endReplay() { this.phase = 'results'; this.app.ui.onReplayEnd?.(); }

  updateReplay(dt) {
    const rp = this.rp; const fr = this.record.frames; const F = fr.length;
    if (rp.playing) rp.t += dt * rp.speed;
    const total = (F - 1) * this.record.dt;
    if (rp.t >= total) { rp.t = total; rp.playing = false; this.app.ui.replayDone?.(); }
    const fi = rp.t / this.record.dt; const i0 = Math.min(F - 1, Math.floor(fi)), i1 = Math.min(F - 1, i0 + 1), f = fi - i0;
    const A = fr[i0], B = fr[i1];
    this.racers.forEach((r, k) => {
      const o = 2 + k * 12;
      const prevX = r.pos.x, prevZ = r.pos.z;
      r.pos.set(lerp(A[o], B[o], f), lerp(A[o + 1], B[o + 1], f), lerp(A[o + 2], B[o + 2], f));
      r.heading = A[o + 3] + wrapAngle(B[o + 3] - A[o + 3]) * f; r.pitch = lerp(A[o + 4], B[o + 4], f); r.latAcc = lerp(A[o + 5], B[o + 5], f);
      r.steer = lerp(A[o + 6], B[o + 6], f); r.vf = lerp(A[o + 7], B[o + 7], f); r.slip = A[o + 8]; r.place = A[o + 9]; r.brake = A[o + 10];
      const fl = A[o + 11]; r.nitroOn = (fl % 2) >= 1; r.finished = (fl % 4) >= 2; r.surface = Math.floor(fl / 4);
      r.vel.set((r.pos.x - prevX) / Math.max(dt, 1e-3), 0, (r.pos.z - prevZ) / Math.max(dt, 1e-3));
      r.rpm = 1200 + (Math.abs(r.vf) % 20) * 300;
      r.throttle = r.brake > 0.2 ? 0 : 0.8;
      r.longAcc = 0;
    });
    const ph = A[1];
    this.t += dt * rp.speed; PATTERN_UNIFORMS.uTime.value += dt * rp.speed;
    // کارگردان خودکار
    const target = this.racers[rp.target] || this.player;
    rp.dirT -= dt * rp.speed;
    const mode = rp.cam === 'auto' ? rp.dirMode : rp.cam;
    if (rp.cam === 'auto' && rp.dirT <= 0) {
      const opts = ['tv', 'tv', 'chase', 'heli', 'cockpit', 'wheel', 'fans'];
      rp.dirMode = opts[Math.floor(Math.random() * opts.length)]; rp.dirT = 4 + Math.random() * 3; this.camInit = false; rp.spot = null;
    }
    const savedPhase = this.phase;
    for (const r of this.racers) this.placeModel(r, dt * rp.speed);
    if (this.boss) { if (ph >= 2) { this.phase = 'judge'; this.phaseT = 2; } this.updateBoss(dt); this.phase = savedPhase; }
    this.replayCam(target, mode, dt);
    if (this.skipDraw) { this.effects.update(dt * rp.speed, 800); return; }
    this.updateWheelBatches();
    this.outdoor.update(dt, target.pos, this.camera);
    if (!this._carsInfo) this._carsInfo = this.racers.map((r) => ({ pos: r.pos, team: r.team, place: 0, finished: false }));
    this.racers.forEach((r, k) => { const c = this._carsInfo[k]; c.place = r.place; c.finished = r.finished; c.pos = r.pos; });
    this.track.update(this.t, this._carsInfo, this.camera.position, target);
    this.effects.update(dt * rp.speed, this.app.engine.renderer.domElement.height);
    const p = target;
    this.app.audio.setEngine({ rpm: 1500 + Math.abs(p.vf) * 60, throttle: 0.6, speed: Math.abs(p.vf) * 3.6, cyl: 8, on: rp.playing });
    let crowd = 0; for (const c of this.track.crowds) { const d = c.center.distanceTo(this.camera.position); crowd = Math.max(crowd, (c.excite || 0) * clamp(1 - d / 160, 0, 1)); }
    this.app.audio.setCrowd(crowd); this.app.audio.setSkid(0);
    this.app.engine.finalPass.uniforms.uSpeed.value = 0;
    this.app.engine.render(this.scene, this.camera, dt);
    this.app.ui.replayHud?.(this, rp.t, total);
  }

  replayCam(r, mode, dt) {
    const cam = this.camera;
    if (mode === 'chase' || mode === 'cockpit' || mode === 'top') { this.followCam(r, mode, dt); return; }
    cam.near = 0.1;
    if (mode === 'tv') {
      let best = null, bd = 1e9;
      for (const sp of this.tvSpots) { const d = sp.p.distanceTo(r.pos); if (d < bd) { bd = d; best = sp; } }
      if (!this.rp.spot || this.rp.spot.p.distanceTo(r.pos) > 150) this.rp.spot = best;
      cam.position.copy(this.rp.spot.p); cam.lookAt(r.pos.x, r.pos.y + 0.7, r.pos.z);
      const d = cam.position.distanceTo(r.pos); cam.fov = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(7 / d)), 6, 55);
    } else if (mode === 'heli') {
      const a = this.t * 0.15; cam.position.set(r.pos.x + Math.sin(a) * 30, r.pos.y + 22, r.pos.z + Math.cos(a) * 30); cam.lookAt(r.pos); cam.fov = 40;
    } else if (mode === 'wheel') {
      const fx = Math.sin(r.heading), fz = Math.cos(r.heading);
      cam.position.set(r.pos.x + fz * 1.6 - fx * 1.0, r.pos.y + 0.35, r.pos.z - fx * 1.6 - fz * 1.0); cam.lookAt(r.pos.x + fx * 6, r.pos.y + 0.4, r.pos.z + fz * 6); cam.fov = 60;
    } else if (mode === 'fans') {
      let best = null, bd = 1e9; for (const c of this.track.crowds) { const d = c.center.distanceTo(r.pos); if (d < bd) { bd = d; best = c; } }
      if (best && bd < 200) {
        const st = best.stand; const yaw = st ? st.rotation.y : 0;
        const f = _v1.set(Math.sin(yaw), 0, Math.cos(yaw));
        cam.position.copy(best.center).addScaledVector(f, 9).add(_v2.set(0, 2.5, 0)); cam.lookAt(best.center.x, best.center.y + 1.5, best.center.z); cam.fov = 50;
      } else { this.rp.dirMode = 'tv'; }
    }
    cam.updateProjectionMatrix();
  }

  dispose() {
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); });
    this.outdoor.envRT?.dispose();
    this.app.audio.silence();
  }
}

function tick() { return new Promise((r) => setTimeout(r, 0)); }
