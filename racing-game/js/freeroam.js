// حالت شهر آزاد: راه رفتن، دویدن، پرش، سوار شدن ماشین و موتور، ترافیک، عابرها، تعامل با همه چیز و ماموریت‌ها
import * as THREE from 'three';
import { Outdoor } from './engine.js';
import { CityWorld, CITY, roadCenter } from './cityworld.js';
import { buildHuman, createWalkers } from './human.js';
import { buildCar, carStats, defaultCustom, defaultUpgrades, CARS, carById, PAINTS } from './cars.js';
import { buildBike, bikeById, bikeStats } from './bikes.js';
import { Effects, Particles } from './effects.js';
import { FireSystem } from './fire.js';
import { Missions } from './missions.js';
import { CityFX, Weather } from './cityfx.js';
import * as T from './textures.js';
import { clamp, lerp, damp, wrapAngle, mulberry32, TAU, toFa, fmtNum, isTouch } from './utils.js';

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
const $ = (id) => document.getElementById(id);
const fwd = (yaw, out = new THREE.Vector3()) => out.set(Math.sin(yaw), 0, Math.cos(yaw));
const rightOf = (yaw, out = new THREE.Vector3()) => out.set(-Math.cos(yaw), 0, Math.sin(yaw));
const ONE_SHOT = new Set(['pickup', 'throw', 'press', 'reach', 'drink', 'kick']);

export class FreeRoam {
  constructor(app) {
    this.app = app; this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.08, 3400);
    this.t = 0; this.paused = false; this.state = 'foot';
    const cm = app.save.data.settings.camera || 'chase';
    this.camMode = cm; this.camYaw = 0; this.camPitch = 0.18; this.dragT = 0;
    this.joy = { x: 0, y: 0, active: false }; this.btn = { jump: false, run: false, hand: false, interact: false };
    this.emitters = []; this.projectiles = []; this.timers = [];
    this.health = 100; this.holding = null; this.carrying = null;
    this.rng = mulberry32((Date.now() & 0xffff) + 7);
    this.hudT = 0; this.promptT = 0; this.prompt = null;
  }

  async build(progress = () => {}) {
    const app = this.app; const Q = app.engine.q; const qn = app.engine.qualityName; const S = app.save.data;
    progress(0.05, 'ساخت آسمان و نور'); await tick();
    this.outdoor = new Outdoor(app.engine, this.scene);
    progress(0.12, 'ساخت خیابان‌ها و خانه‌ها'); await tick();
    this.world = new CityWorld({ quality: qn, seed: 4242 });
    this.world.build();
    this.scene.add(this.world.group);
    progress(0.55, 'تنظیم نور شهر'); await tick();
    const lt = S.light.time === 'auto' ? 'noon' : S.light.time;
    this.setTime(lt);
    progress(0.62, 'ساخت قهرمان'); await tick();
    this.effects = new Effects(this.scene);
    this.fire = new FireSystem(this.scene, 260);
    const soft = T.softDot();
    this.fx = {
      water: new Particles(this.scene, 700, { tex: soft, gravity: 9.8, drag: 0.25, grow: 0.3 }),
      leaves: new Particles(this.scene, 200, { tex: soft, gravity: 0.9, drag: 1.8, grow: 0 }),
      dust: new Particles(this.scene, 300, { drag: 1.2, grow: 0.9 }),
      steam: new Particles(this.scene, 200, { drag: 0.6, grow: 1.1 }),
      sparkle: new Particles(this.scene, 200, { tex: soft, additive: true, gravity: -0.5, drag: 1, grow: -0.3 })
    };
    this.buildPlayer();
    progress(0.7, 'آماده‌سازی ماشین‌ها'); await tick();
    this.buildVehicles();
    progress(0.8, 'ترافیک شهر'); await tick();
    this.buildTraffic(qn === 'low' ? 6 : qn === 'medium' ? 10 : qn === 'high' ? 14 : 18);
    progress(0.88, 'مردم شهر'); await tick();
    this.buildWalkers(qn === 'low' ? 50 : qn === 'medium' ? 80 : qn === 'high' ? 120 : 160);
    this.indoorLight = new THREE.PointLight(0xfff0d8, 0, 13, 1.4); this.scene.add(this.indoorLight); this.roomLightOn = true;
    this.buildBeacon();
    this.cfx = new CityFX(this);
    this.weather = new Weather(app, this.scene, this.outdoor, S.light.weather || 'clear'); if (this.weather.on) this.world.setWet(true);
    this.missions = new Missions(this);
    this.lookYaw = 0; this.lookPitch = 0; this.stepPh = 0; this.driftScore = 0; this.driftT = 0; this.emoteI = 0;
    if (this.night && Q.headlight) { this.spot = new THREE.SpotLight(0xfff1d0, 90, 90, 0.55, 0.5, 1.4); this.scene.add(this.spot, this.spot.target); }
    progress(1, 'آماده'); await tick();
    this.updateCamera(0.016, true);
    try { app.engine.renderer.compile(this.scene, this.camera); } catch (e) { /* نادیده */ }
  }

  setTime(time) {
    this.time = time; this.outdoor.apply(time, this.app.save.data.light);
    this.night = time === 'night'; this.world.night = this.night; this.world.setNight(this.night);
    const f = this.scene.fog; f.near = this.night ? 60 : 140; f.far = this.night ? 520 : 1100;
    this.weather?.applyLook();
  }

  // ---------------- بازیکن ----------------
  buildPlayer() {
    this.human = buildHuman({ detail: 'hi', shirt: 0xff5a00, pants: 0x1f2a3a, hair: 0x2a1a10, skin: 0xe0b08a });
    const sp = this.world.spawn;
    this.p = { pos: sp.pos.clone(), yaw: sp.yaw, vel: new THREE.Vector3(), vy: 0, onGround: true, speed: 0, walkT: 0, run: false };
    this.p.pos.y = this.world.groundAt(this.p.pos.x, this.p.pos.z);
    this.camYaw = sp.yaw;
    this.scene.add(this.human.root);
  }
  playerWorldPos(out = new THREE.Vector3()) { if (this.state === 'drive') return out.copy(this.veh.pos); if (this.human.root.parent !== this.scene) return this.human.root.getWorldPosition(out); return out.copy(this.p.pos); }

  // ---------------- ماشین‌ها و موتور ----------------
  makeVehicle(model, def, stats, opts = {}) {
    const v = { model, def, stats, pos: opts.pos.clone(), heading: opts.yaw, vel: new THREE.Vector3(), vf: 0, vl: 0, yawRate: 0, steer: 0, throttle: 0, brake: 0, hand: false, y: 0, vy: 0, air: false, gPrev: 0,
      spin: 0, roll: 0, pitch: 0, bodyPitch: 0, latAcc: 0, longAcc: 0, gear: 1, rpm: 900, shiftT: 0, nitro: stats.nitro, isBike: !!model.isBike, own: !!opts.own, name: opts.name || def.name, slip: 0, lastHit: 0 };
    v.pos.y = this.world.groundAt(v.pos.x, v.pos.z); v.y = v.pos.y; v.gPrev = v.y;
    if (model.driver) model.driver.root.visible = false;
    this.scene.add(model.root);
    this.vehicles.push(v);
    v.inter = this.world.inter.add({ pos: v.pos.clone().setY(v.y + 1), r: (model.shape.W / 2) + 1.7, pri: 0.9, label: () => (v.isBike ? 'سوار شدن موتور ' : 'سوار شدن ') + (v.own ? '(وسیله خودت) ' : '') + v.name, act: () => this.enterVehicle(v), cond: (g) => g.state === 'foot' && !g.carrying });
    this.placeVehicle(v, 0);
    return v;
  }
  buildVehicles() {
    const S = this.app.save.data; this.vehicles = [];
    const sp = this.world.vehicleSpawn;
    const bikesOpen = S.bikesCode || S.maxStage > 100;
    const def = carById(S.selected);
    const carModel = buildCar(def, S.custom[def.id] || defaultCustom(def), { isPlayer: true, team: 0xff5a00, number: (S.custom[def.id] || {}).number || 7 });
    this.ownCar = this.makeVehicle(carModel, def, this.cityStats(carStats(def, S.upgrades[def.id] || defaultUpgrades())), { pos: sp.pos, yaw: sp.yaw, own: true });
    if (bikesOpen) {
      const bd = bikeById(S.bike || 'b1');
      const bm = buildBike(bd, { isPlayer: true, rider: true });
      this.ownBike = this.makeVehicle(bm, bd, this.cityStats(bikeStats(bd)), { pos: _v1.copy(sp.pos).add(fwd(sp.yaw, _v2).multiplyScalar(-7)), yaw: sp.yaw, own: true });
    }
    // ماشین‌های پارک‌شده کنار خیابان (قابل سوار شدن)
    const rng = mulberry32(99); const edges = this.world.lane.edges;
    const n = this.app.engine.qualityName === 'low' ? 4 : 8;
    const used = new Set();
    for (let k = 0; k < n * 3 && used.size < n; k++) {
      const e = edges[(rng() * edges.length) | 0]; const key = [e.a.i, e.a.j, e.b.i, e.b.j].join(); if (used.has(key)) continue; used.add(key);
      const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z; const len = Math.hypot(dx, dz); const yaw = Math.atan2(dx, dz);
      const s = 25 + rng() * (len - 50); const r = rightOf(yaw, _v2);
      const pos = new THREE.Vector3(e.a.x + dx / len * s + r.x * 6.2, 0, e.a.z + dz / len * s + r.z * 6.2);
      const cd = CARS[(rng() * 9) | 0]; const cust = { ...defaultCustom(cd), paint: PAINTS[(rng() * PAINTS.length) | 0] };
      const m = buildCar(cd, cust, { isPlayer: false, number: 1 + ((rng() * 98) | 0), noDriver: true, lowDetail: this.app.engine.qualityName === 'low' });
      this.makeVehicle(m, cd, this.cityStats(carStats(cd)), { pos, yaw });
    }
  }
  cityStats(st) { return { ...st, vmax: Math.min(st.vmax, 62) }; }

  enterVehicle(v) {
    this.veh = v; this.state = 'drive'; this.human.root.visible = false;
    if (v.model.driver) v.model.driver.root.visible = true;
    v.hand = false; this.camInit = false; this.app.audio.sfx('door');
    this.toast(v.isBike ? 'سوار موتور شدی 🏍️' : 'سوار ماشین شدی 🚗');
  }
  exitVehicle() {
    const v = this.veh; if (!v) return;
    if (Math.abs(v.vf) > 6) { this.toast('اول سرعتت را کم کن'); return; }
    const sides = [rightOf(v.heading, _v1).clone().multiplyScalar(-1), rightOf(v.heading, _v2).clone()];
    let out = null;
    for (const s of sides) { const p = v.pos.clone().addScaledVector(s, v.model.shape.W / 2 + 0.7); const test = p.clone(); const hit = this.world.colliders.resolve(test, 0.3, 1, p.y); if (!hit) { out = p; break; } if (!out) out = test; }
    this.p.pos.copy(out); this.p.pos.y = this.world.groundAt(out.x, out.z); this.p.vy = 0; this.p.yaw = v.heading; this.p.vel.set(0, 0, 0);
    this.human.root.visible = true; if (v.model.driver) v.model.driver.root.visible = false;
    this.state = 'foot'; this.veh = null; this.camYaw = v.heading; this.app.audio.setEngine({ on: false }); this.app.audio.sfx('door');
    this.world.inter.move(v.inter, v.pos.clone().setY(v.y + 1));
  }

  stepVehicle(v, dt, inp) {
    const st = v.stats; const driven = v === this.veh;
    if (!driven) { inp = { steer: 0, throttle: 0, brake: 0, reverse: 0, brakeRev: 0, drift: false, nitro: false }; }
    const autoN = this.app.touchDrive && inp.throttle > 0.9 && Math.abs(inp.steer) < 0.25 && Math.abs(v.vf) > st.vmax * 0.45;
    const nitroOn = driven && (inp.nitro || autoN) && v.nitro > 0 && inp.throttle > 0; v.nitroOn = nitroOn;
    if (nitroOn) v.nitro = Math.max(0, v.nitro - dt); else if (st.nitro > 0) v.nitro = Math.min(st.nitro, v.nitro + dt * 0.08);
    v.steer = damp(v.steer, inp.steer, Math.abs(inp.steer) > Math.abs(v.steer) ? 5.5 : 9, dt);
    let fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    let vf = v.vel.x * fx + v.vel.z * fz; const speed = Math.abs(vf);
    const wantBack = Math.max(inp.reverse || 0, inp.brakeRev || 0);
    v.throttle = damp(v.throttle, inp.throttle, 10, dt); v.brake = damp(v.brake, Math.max(inp.brake || 0, vf > 0.6 ? wantBack : 0), 12, dt); v.rev = damp(v.rev || 0, vf <= 0.6 ? wantBack : 0, 10, dt); v.hand = !!inp.drift;
    const g0 = this.world.groundAt(v.pos.x, v.pos.z);
    const grass = g0 > 0.1 && g0 < 0.2 && !this.onRoad(v.pos);
    const surfGrip = v.air ? 0.05 : grass ? 0.8 : 1;
    if (!v.air) {
      const maxSteer = lerp(0.62, 0.12, clamp(speed / (st.vmax * 0.85), 0, 1));
      const wb = v.model.shape.wb;
      let yawT = (vf / wb) * Math.tan(v.steer * maxSteer);
      const gripLat = st.grip * 9.81 * surfGrip;
      const yawMax = (gripLat / Math.max(speed, 3)) * (v.hand ? 1.6 : 1.12);
      yawT = clamp(yawT, -yawMax, yawMax); if (v.hand && speed > 8) yawT *= 1.35;
      v.yawRate = damp(v.yawRate, yawT, v.hand ? 6 : 9, dt);
    } else v.yawRate = damp(v.yawRate, 0, 1, dt);
    v.heading += v.yawRate * dt;
    fx = Math.sin(v.heading); fz = Math.cos(v.heading); const lx = fz, lz = -fx;
    vf = v.vel.x * fx + v.vel.z * fz; let vl = v.vel.x * lx + v.vel.z * lz;
    let acc = 0; const vmax = st.vmax * (nitroOn ? 1.15 : 1);
    if (v.shiftT > 0) v.shiftT -= dt;
    if (!v.air) {
      if (v.throttle > 0.02 && vf > -0.5) { const curve = Math.max(0, 1 - Math.pow(Math.max(0, vf) / vmax, 2.3)); acc += st.acc * (1.15 - 0.15 * (vf / vmax)) * curve * v.throttle * (nitroOn ? 1.6 : 1) * (v.shiftT > 0 ? 0.35 : 1); }
      if (v.brake > 0.02) { if (vf > 0.6) acc -= st.brake * v.brake; else if (vf < -0.6) acc += st.brake * v.brake * 0.8; }
      if (v.rev > 0.02 && vf > -8) acc -= st.acc * 0.55 * v.rev;
      if (v.hand && speed > 3) acc -= Math.sign(vf) * 1.1;
      acc -= vf * (0.01 + (grass ? 0.25 : 0));
      if (!driven) acc -= Math.sign(vf) * Math.min(Math.abs(vf) / dt, 3.5);
      const latGrip = st.grip * 9.81 * surfGrip * (v.hand ? 0.5 : 1) * 1.05;
      vl -= Math.sign(vl) * Math.min(Math.abs(vl), latGrip * dt);
    }
    const vfOld = vf; vf += acc * dt;
    if (vfOld > 0 && vf < 0 && v.rev < 0.05) vf = 0;
    if (vfOld < 0 && vf > 0 && v.throttle < 0.05) vf = 0;
    if (Math.abs(vf) < 0.05 && v.throttle < 0.05 && v.rev < 0.05) vf = 0;
    v.slip = Math.abs(vl) + (v.brake > 0.85 && speed > 18 ? 3 : 0);
    v.latAcc = vf * v.yawRate; v.longAcc = acc;
    v.vel.set(fx * vf + lx * vl, 0, fz * vf + lz * vl); v.vf = vf; v.vl = vl;
    v.pos.x += v.vel.x * dt; v.pos.z += v.vel.z * dt;
    // برخورد با ساختمان‌ها، درخت‌ها و وسایل خیابانی (دو دایره جلو و عقب)
    const s = v.model.shape; const r = s.W / 2 + 0.05; const off = Math.max(0, s.L / 2 - r);
    for (const sgn of [1, -1]) {
      const c = _v1.set(v.pos.x + fx * off * sgn, 0, v.pos.z + fz * off * sgn); const ox = c.x, oz = c.z;
      const hit = this.world.colliders.resolve(c, r, 2, v.y);
      if (hit) this.vehicleHit(v, c.x - ox, c.z - oz, hit.nx, hit.nz);
    }
    // ارتفاع: رمپ‌ها و پرش
    const g = this.world.groundAt(v.pos.x, v.pos.z);
    if (!v.air) {
      if (g < v.y - 0.25 && v.vy > 1.2) { v.air = true; }
      else { const ny = g; v.vy = clamp((ny - v.y) / Math.max(dt, 1e-3), -6, 25); v.y = ny; }
    }
    if (v.air) {
      v.vy -= 9.81 * dt; v.y += v.vy * dt;
      if (v.y <= g) { const impact = -v.vy; v.y = g; v.air = false; v.vy = 0; if (impact > 3 && driven) { this.app.audio.thump(clamp(impact / 10, 0.2, 0.9)); this.shake = Math.min(1, (this.shake || 0) + impact / 12); } }
    }
    v.pos.y = v.y;
    const slope = v.air ? -Math.atan2(v.vy, Math.max(4, Math.abs(vf))) : -Math.atan2(v.vy, Math.max(2, Math.abs(vf))) * (Math.abs(vf) > 1 ? 1 : 0);
    v.pitch = damp(v.pitch, clamp(slope, -0.6, 0.6), v.air ? 3 : 12, dt);
    // دنده و دور موتور
    const top = st.vmax; const gg = vf < -0.5 ? 0 : clamp(1 + Math.floor(Math.abs(vf) / (top / 5.6)), 1, 6);
    if (gg > v.gear && v.gear > 0 && driven) { v.shiftT = 0.12; this.app.audio.pop(); }
    v.gear = gg; const lo = (gg - 1) * (top / 5.6), hi = gg * (top / 5.6); const f = gg === 0 ? Math.abs(vf) / 10 : clamp((Math.abs(vf) - lo) / (hi - lo), 0, 1);
    v.rpm = damp(v.rpm, 1100 + f * 6000 + (v.throttle > 0.1 && Math.abs(vf) < 2 ? 3000 * v.throttle : 0), 8, dt);
  }
  vehicleHit(v, dx, dz, nx, nz) {
    v.pos.x += dx; v.pos.z += dz;
    const vn = v.vel.x * nx + v.vel.z * nz;
    if (vn < 0) {
      v.vel.x -= nx * vn * 1.3; v.vel.z -= nz * vn * 1.3; v.vel.multiplyScalar(1 - clamp(-vn / 30, 0.05, 0.5));
      if (-vn > 2 && this.t - v.lastHit > 0.2 && v === this.veh) {
        v.lastHit = this.t; this.app.audio.thump(clamp(-vn / 15, 0.2, 0.9)); this.shake = Math.min(1, (this.shake || 0) + -vn / 14);
        this.effects.spark(_v3.set(v.pos.x - nx * v.model.shape.W * 0.5, v.y + 0.5, v.pos.z - nz * v.model.shape.W * 0.5), _v2.set(-nx, 0.3, -nz));
      }
    }
  }
  onRoad(p) { const f = (x) => { const k = (x + (CITY.N * (CITY.BLOCK + CITY.ROAD) + CITY.ROAD) / 2) % (CITY.BLOCK + CITY.ROAD); return k < CITY.ROAD; }; return f(p.x) || f(p.z); }

  placeVehicle(v, dt) {
    const m = v.model; m.root.position.copy(v.pos);
    _e.set(v.pitch, v.heading, 0, 'YXZ'); m.root.quaternion.setFromEuler(_e);
    v.roll = damp(v.roll, clamp(v.latAcc * 0.011, -0.085, 0.085), 6, dt || 0.016);
    v.bodyPitch = damp(v.bodyPitch, clamp(-v.longAcc * 0.005, -0.05, 0.05), 6, dt || 0.016);
    v.spin += (v.vf / m.shape.wr) * (dt || 0);
    m.setVisualState({ steer: v.steer, spin: v.spin, gear: v.gear, throttle: v.throttle, brake: v.brake, speedKmh: Math.abs(v.vf) * 3.6, rpm: v.rpm, roll: v.isBike ? 0 : v.roll, pitch: v.bodyPitch, bounce: 0, latAcc: v.latAcc });
  }

  // ---------------- ترافیک ----------------
  buildTraffic(n) {
    const rng = mulberry32(5); const edges = this.world.lane.edges;
    this.traffic = [];
    for (let k = 0; k < n; k++) {
      const e = edges[(rng() * edges.length) | 0];
      const cd = CARS[(rng() * 12) | 0]; const cust = { ...defaultCustom(cd), paint: PAINTS[(rng() * PAINTS.length) | 0] };
      const m = buildCar(cd, cust, { isPlayer: false, number: 1 + ((rng() * 98) | 0), lowDetail: this.app.engine.qualityName !== 'ultra' });
      this.scene.add(m.root);
      const c = { model: m, edge: e, s: 15 + rng() * (this.edgeLen(e) - 40), v: 0, vmax: 10 + rng() * 4, turn: null, spin: 0, pos: new THREE.Vector3(), heading: 0, wait: 0, hornT: 0, rpm: 1500, steer: 0 };
      this.trafficPos(c); this.traffic.push(c);
    }
    // چرخ همه ماشین‌های ترافیک با InstancedMesh
    const groups = new Map();
    for (const c of this.traffic) for (const w of c.model.wheels) {
      const mesh = w.spin.children.find((x) => x.isMesh); if (!mesh) continue;
      const key = mesh.geometry.uuid; if (!groups.has(key)) groups.set(key, { geo: mesh.geometry, mat: mesh.material, list: [] });
      w.spin.remove(mesh); const proxy = new THREE.Object3D(); w.spin.add(proxy); groups.get(key).list.push(proxy);
    }
    this.wheelBatches = [...groups.values()].map((g) => { const im = new THREE.InstancedMesh(g.geo, g.mat, g.list.length); im.frustumCulled = false; im.castShadow = true; this.scene.add(im); return { im, list: g.list }; });
  }
  edgeLen(e) { return Math.hypot(e.b.x - e.a.x, e.b.z - e.a.z); }
  trafficPos(c) {
    const e = c.edge; const len = this.edgeLen(e); const dx = (e.b.x - e.a.x) / len, dz = (e.b.z - e.a.z) / len;
    const yaw = Math.atan2(dx, dz); const r = rightOf(yaw, _v2);
    c.pos.set(e.a.x + dx * c.s + r.x * 2.1, 0, e.a.z + dz * c.s + r.z * 2.1); c.heading = yaw; c.dir = { x: dx, z: dz };
  }
  updateTraffic(dt) {
    const W = this.world; const pl = this.playerWorldPos(_v3).clone();
    const plVeh = this.state === 'drive' ? this.veh : null;
    for (const c of this.traffic) {
      if (c.turn) {
        const tr = c.turn; tr.t = Math.min(1, tr.t + c.v * dt / tr.len);
        const t = tr.t, u = 1 - t;
        const x = u * u * tr.p0.x + 2 * u * t * tr.p1.x + t * t * tr.p2.x, z = u * u * tr.p0.z + 2 * u * t * tr.p1.z + t * t * tr.p2.z;
        const dx = 2 * u * (tr.p1.x - tr.p0.x) + 2 * t * (tr.p2.x - tr.p1.x), dz = 2 * u * (tr.p1.z - tr.p0.z) + 2 * t * (tr.p2.z - tr.p1.z);
        const nh = Math.atan2(dx, dz); c.steer = clamp(wrapAngle(nh - c.heading) * 8, -1, 1); c.heading = nh; c.pos.set(x, 0, z);
        c.v = damp(c.v, tr.straight ? c.vmax : 6.5, 2, dt);
        if (t >= 1) { c.edge = tr.next; c.s = 9.5; c.turn = null; }
      } else {
        const e = c.edge; const len = this.edgeLen(e); const toEnd = len - c.s;
        let target = c.vmax;
        // چراغ راهنمایی
        const tl = W.tlMap?.get(e.b.i + ',' + e.b.j);
        if (tl && toEnd < 30) {
          const axis = Math.abs(c.dir.z) > 0.5 ? 0 : 1; const ph = axis === 0 ? tl.state : (tl.state + 2) % 4;
          const stopAt = toEnd - 11.5;
          if (ph >= 2 || (ph === 1 && stopAt > 6)) target = Math.min(target, Math.max(0, stopAt * 0.9));
        }
        // ماشین جلویی
        for (const o of this.traffic) { if (o === c) continue; const dx = o.pos.x - c.pos.x, dz = o.pos.z - c.pos.z; const ahead = dx * c.dir.x + dz * c.dir.z; const lat = Math.abs(dx * c.dir.z - dz * c.dir.x); if (ahead > 0 && ahead < 16 && lat < 2.2) target = Math.min(target, Math.max(0, (ahead - 6.5) * 1.1)); }
        // بازیکن جلوی ماشین
        { const dx = pl.x - c.pos.x, dz = pl.z - c.pos.z; const ahead = dx * c.dir.x + dz * c.dir.z; const lat = Math.abs(dx * c.dir.z - dz * c.dir.x); if (ahead > 0 && ahead < 18 && lat < (plVeh ? 2.6 : 1.8)) { target = Math.min(target, Math.max(0, (ahead - (plVeh ? 7 : 4.5)) * 1.2)); if (ahead < 9) { c.hornT += dt; if (c.hornT > 2.5 && pl.distanceTo(c.pos) < 25) { c.hornT = -4; this.app.audio.sfx('horn'); } } } }
        if (c.wait > 0) { c.wait -= dt; target = 0; }
        c.v = c.v < target ? Math.min(target, c.v + 3 * dt) : Math.max(target, c.v - 9 * dt);
        c.s += c.v * dt; c.steer = damp(c.steer, 0, 5, dt);
        this.trafficPos(c);
        if (c.s > len - 9.5) {
          const outs = e.b.out.filter((x) => x.b !== e.a); const next = outs.length ? outs[(this.rng() * outs.length) | 0] : e.b.out[0];
          const nl = this.edgeLen(next); const ndx = (next.b.x - next.a.x) / nl, ndz = (next.b.z - next.a.z) / nl;
          const ny = Math.atan2(ndx, ndz); const rIn = rightOf(c.heading, new THREE.Vector3()), rOut = rightOf(ny, new THREE.Vector3());
          const node = new THREE.Vector3(e.b.x, 0, e.b.z);
          const p0 = c.pos.clone(), p2 = new THREE.Vector3(node.x + ndx * 9.5 + rOut.x * 2.1, 0, node.z + ndz * 9.5 + rOut.z * 2.1);
          const straight = Math.abs(ndx * c.dir.x + ndz * c.dir.z) > 0.9;
          const p1 = straight ? p0.clone().lerp(p2, 0.5) : node.clone().addScaledVector(rIn, 2.1).addScaledVector(rOut, 2.1);
          c.turn = { p0, p1, p2, t: 0, len: p0.distanceTo(p1) + p1.distanceTo(p2), next, straight };
        }
      }
      // برخورد با ماشین بازیکن
      if (plVeh) {
        const dx = plVeh.pos.x - c.pos.x, dz = plVeh.pos.z - c.pos.z; const d = Math.hypot(dx, dz); const R = 2.3 + (plVeh.isBike ? -0.6 : 0);
        if (d < R && d > 0.01) { const nx = dx / d, nz = dz / d; this.vehicleHit(plVeh, nx * (R - d), nz * (R - d), nx, nz); c.v = 0; c.wait = 2; }
      } else if (this.state === 'foot') {
        const dx = this.p.pos.x - c.pos.x, dz = this.p.pos.z - c.pos.z; const d = Math.hypot(dx, dz);
        if (d < 1.5 && d > 0.01) { this.p.pos.x += dx / d * (1.5 - d); this.p.pos.z += dz / d * (1.5 - d); c.v = Math.min(c.v, 1); }
      }
      const m = c.model; m.root.position.copy(c.pos); m.root.rotation.set(0, c.heading, 0);
      const cd = c.pos.distanceToSquared(this.camera.position);
      const vis = cd < 330 * 330; if (m.root.visible !== vis) m.root.visible = vis;
      if (vis) { c.spin += c.v / m.shape.wr * dt; m.setLOD(Math.sqrt(cd)); m.setVisualState({ steer: c.steer, spin: c.spin, brake: c.v < 2 ? 1 : 0 }); }
    }
    for (const b of this.wheelBatches) {
      for (let i = 0; i < b.list.length; i++) { const p = b.list[i]; p.updateWorldMatrix(true, false); b.im.setMatrixAt(i, p.matrixWorld); }
      b.im.instanceMatrix.needsUpdate = true;
    }
    // صدای نزدیک‌ترین ماشین
    let nd = 999; for (const c of this.traffic) nd = Math.min(nd, c.pos.distanceTo(pl));
    this.app.audio.setOthers(nd, 1800);
  }

  // ---------------- عابرهای پیاده ----------------
  buildWalkers(n) {
    const W = this.world; this.walkers = createWalkers(n, { rng: mulberry32(31) });
    this.scene.add(this.walkers.mesh);
    const loops = W.walkLoops.map((pts) => { const segs = []; let L = 0; for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push({ a, b, l, s0: L }); L += l; } return { segs, L }; });
    this.walkLoops = loops; const rng = mulberry32(17);
    this.peds = [];
    for (let i = 0; i < n; i++) {
      const lp = (rng() * loops.length) | 0;
      this.peds.push({ lp, s: rng() * loops[lp].L, dir: rng() < 0.5 ? 1 : -1, sp: 1.0 + rng() * 0.6, off: (rng() - 0.5) * 1.4, dodge: 0, pos: new THREE.Vector3(), yaw: 0, wave: 0, idle: rng() < 0.15 ? 2 + rng() * 6 : 0 });
      this.walkers.style(i, 3);
    }
  }
  updateWalkers(dt) {
    const pl = this.playerWorldPos(_v3); const veh = this.state === 'drive' ? this.veh : null;
    for (let i = 0; i < this.peds.length; i++) {
      const w = this.peds[i]; const loop = this.walkLoops[w.lp];
      if (w.wave > 0) { w.wave -= dt; if (w.wave <= 0) this.walkers.style(i, 3); }
      else if (w.idle > 0) { w.idle -= dt; if (w.idle <= 0) this.walkers.style(i, 3); else if (this.walkers.getStyle(i) !== 5) this.walkers.style(i, 5); }
      else { w.s = (w.s + w.dir * w.sp * dt + loop.L) % loop.L; if (this.rng() < dt * 0.01) { w.idle = 2 + this.rng() * 5; } }
      let seg = loop.segs[0]; for (const sg of loop.segs) if (w.s >= sg.s0 && w.s < sg.s0 + sg.l) { seg = sg; break; }
      const u = (w.s - seg.s0) / seg.l; const dx = (seg.b[0] - seg.a[0]) / seg.l, dz = (seg.b[1] - seg.a[1]) / seg.l;
      let x = seg.a[0] + (seg.b[0] - seg.a[0]) * u - dz * (w.off + w.dodge), z = seg.a[1] + (seg.b[1] - seg.a[1]) * u + dx * (w.off + w.dodge);
      // کنار رفتن از جلوی ماشین
      if (veh && Math.abs(veh.vf) > 2) { const d = Math.hypot(veh.pos.x - x, veh.pos.z - z); if (d < 5) { w.dodge = damp(w.dodge, (w.off > 0 ? 1 : -1) * 2.2, 6, dt); if (this.walkers.getStyle(i) === 3) { this.walkers.style(i, 7); w.wave = 1.2; } } else w.dodge = damp(w.dodge, 0, 0.8, dt); }
      else w.dodge = damp(w.dodge, 0, 0.8, dt);
      w.pos.set(x, this.world.groundAt(x, z), z); w.yaw = Math.atan2(dx * w.dir, dz * w.dir);
      if (w.wave > 0 && w.greet) { const a = Math.atan2(pl.x - x, pl.z - z); w.yaw = a; }
      this.walkers.set(i, w.pos, w.yaw);
    }
    this.walkers.update(this.t, this.camera.position);
  }

  // ---------------- نشانگر هدف ماموریت ----------------
  buildBeacon() {
    const g = new THREE.CylinderGeometry(1.4, 1.4, 90, 24, 1, true); g.translate(0, 45, 0);
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(0xffc23d) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uT; uniform vec3 uC; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 1.5) * 0.4 * (0.75 + 0.25 * sin(uT * 3.0 + vUv.y * 20.0)); gl_FragColor = vec4(uC * a, a); }' });
    this.beacon = new THREE.Mesh(g, m); this.beacon.visible = false; this.beacon.renderOrder = 6; this.beacon.frustumCulled = false; this.scene.add(this.beacon);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 40), new THREE.MeshBasicMaterial({ color: 0xffc23d, transparent: true, opacity: 0.8, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; this.beacon.add(ring);
    this.marker = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 4), new THREE.MeshBasicMaterial({ color: 0xffc23d })); this.marker.rotation.x = Math.PI; this.marker.visible = false; this.scene.add(this.marker);
  }

  // ---------------- API تعامل (برای وسایل، مبلمان و شهربازی) ----------------
  sfx(n) { this.app.audio.sfx(n); }
  toast(t) { this.app.cityHud?.toast(t); }
  say(text, obj) { this.app.cityHud?.bubble(text, obj); }
  act(anim, dur, opts = {}) {
    if (this.state === 'drive') return;
    if (this.state !== 'foot' && this.state !== 'act') this.standUp(true);
    this.state = 'act'; this.actS = { anim, dur, t: 0, opts, released: false };
    if (opts.text) this.toast(opts.text);
    if (opts.flash) { this.app.engine.finalPass.uniforms.uFlash.value = 0.9; this.sfx('click'); }
    if (opts.splash) { this.sfx('splash'); this.burstWater(opts.splash, 60, 4); }
    if (opts.fountain) this.emitters.push({ kind: 'hydrant', pos: opts.fountain.clone(), t: 5 });
    if (opts.leaves) this.emitters.push({ kind: 'leaves', pos: opts.leaves.clone(), t: 1.6 });
    if (opts.dust) this.emitters.push({ kind: 'dust', pos: this.p.pos.clone(), t: dur * 0.8 });
    if (opts.coinToss) this.timers.push({ t: dur * 0.45, fn: () => this.throwProp('coin', opts.coinToss, () => { this.burstWater(opts.coinToss, 18, 2); this.sfx('splash'); this.burstSparkle(opts.coinToss); }) });
    if (opts.balloon) this.timers.push({ t: dur * 0.6, fn: () => this.releaseBalloon() });
  }
  sit({ local, yaw = 0, from, world, text }) {
    if (this.state === 'drive') return;
    this.standUp(true);
    let pos, wy;
    if (from) { from.updateMatrixWorld(true); pos = new THREE.Vector3(...local).applyMatrix4(from.matrixWorld); from.getWorldQuaternion(_q); _e.setFromQuaternion(_q, 'YXZ'); wy = _e.y + yaw; }
    else { pos = world.clone(); wy = yaw; }
    this.seatBack = this.p.pos.clone();
    this.state = 'sit'; this.sitS = { pos, yaw: wy, t: 0 };
    this.human.root.position.set(pos.x, pos.y - 0.35, pos.z); this.human.root.rotation.set(0, wy, 0);
    if (text) this.toast(text); else this.toast('نشستی؛ برای بلند شدن دکمه تعامل را بزن');
  }
  lie({ local, yaw = 0, from, sleep }) {
    this.standUp(true);
    from.updateMatrixWorld(true); const pos = new THREE.Vector3(...local).applyMatrix4(from.matrixWorld); from.getWorldQuaternion(_q); _e.setFromQuaternion(_q, 'YXZ');
    const wy = _e.y + yaw; this.seatBack = this.p.pos.clone();
    this.state = 'lie'; this.sitS = { pos, yaw: wy, t: 0, sleep };
    const q = new THREE.Quaternion().setFromAxisAngle(UP, wy).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
    this.human.root.quaternion.copy(q); this.human.root.position.copy(pos).add(_v1.set(0, 0.14, 0));
    if (sleep) { this.app.cityHud?.fade(1, 1.2); this.timers.push({ t: 1.6, fn: () => { this.setTime(this.night ? 'morning' : 'night'); this.toast(this.night ? 'خوابیدی و شب شد 🌙' : 'خوب خوابیدی! صبح شد ☀️'); this.app.cityHud?.fade(0, 1.2); } }); }
    else this.toast('دراز کشیدی؛ برای بلند شدن دکمه تعامل را بزن');
  }
  standUp(silent) {
    if (this.state === 'sit' || this.state === 'lie') {
      this.human.root.quaternion.identity(); this.human.root.rotation.set(0, 0, 0);
      if (this.seatBack) { this.p.pos.copy(this.seatBack); }
      this.p.yaw = this.sitS.yaw; this.state = 'foot';
    }
    if (this.state === 'act') { this.state = 'foot'; this.actS = null; }
    if (!silent) this.sfx('jump');
  }
  spray(obj, dur) { const p = new THREE.Vector3(); obj.getWorldPosition(p); this.emitters.push({ kind: 'spray', pos: p, t: dur + 0.6, from: true }); }
  steam(obj, dur) { const p = new THREE.Vector3(); obj.getWorldPosition(p); p.y += 0.25; this.emitters.push({ kind: 'steam', pos: p, t: dur }); }
  roomLight(on) { this.roomLightOn = on; }
  ride(r) {
    if (this.state !== 'foot' || this.carrying) { if (this.carrying) this.toast('اول مصدوم را به جای امن ببر'); return; }
    if (this.holding) this.dropHolding();
    const seat = r.pick ? r.pick() : r.seat;
    this.state = 'ride'; this.rideS = { r, seat, t: 0, lap0: r.until ? r.until() : 0 };
    this.world.park && (this.world.park.active = true);
    seat.add(this.human.root);
    this.human.root.position.set(0, r.pose === 'drive' ? 0.05 : 0.08 - r.seatY, 0); this.human.root.rotation.set(0, r.yawOff || 0, 0);
    r.onStart?.(this); if (r.text) this.toast(r.text);
    this.camInit = false; this.sfx('whoosh');
  }
  endRide() {
    const R = this.rideS; if (!R) return;
    R.r.onEnd?.(this); this.scene.add(this.human.root);
    this.p.pos.copy(R.r.exit); this.p.pos.y = this.world.groundAt(this.p.pos.x, this.p.pos.z); this.p.vy = 0;
    this.human.root.rotation.set(0, 0, 0); this.state = 'foot'; this.rideS = null; this.world.park && (this.world.park.active = false);
    this.toast('از وسیله پیاده شدی'); this.camInit = false;
  }
  path({ pts, dur, climb = 0, pose, text }) {
    if (this.state !== 'foot') return;
    this.state = 'path'; this.pathS = { curve: new THREE.CatmullRomCurve3(pts), dur, t: 0, climb: climb / Math.max(1, pts.length - 1), pose };
    if (text) this.toast(text);
  }
  useBin(bin) {
    if (this.holding) {
      const item = this.holding; this.holding = null;
      bin.t = 1.8; this.sfx('lid');
      this.act('throw', 1.0, {});
      this.timers.push({ t: 0.42, fn: () => {
        const from = new THREE.Vector3(); item.mesh.getWorldPosition(from); this.scene.attach(item.mesh);
        const to = bin.pos.clone().add(_v1.set(0, 1.05, 0));
        this.projectiles.push({ mesh: item.mesh, p0: from, p1: to, h: 0.7, t: 0, dur: 0.55, spin: 9, onEnd: () => { this.placeInBin(item.mesh, bin); this.sfx('trash'); this.missions.onBinned(item, bin); } });
      } });
    } else { bin.t = 2.2; this.sfx('lid'); this.act('reach', 0.7, { text: 'درب سطل زباله را باز کردی 🗑️' }); }
  }
  // آشغال داخل سطل می‌ماند و روی هم جمع می‌شود (وقتی درب باز است دیده می‌شود)
  placeInBin(mesh, bin) {
    bin.count = (bin.count || 0) + 1; const n = bin.count;
    const a = Math.random() * TAU, r = Math.random() * 0.13; const y = 0.2 + Math.min(n, 11) * 0.065 + (bin.own ? 0 : 0.15);
    if (bin.own) { bin.own.group.add(mesh); mesh.position.set(Math.cos(a) * r, y, Math.sin(a) * r); }
    else { this.scene.add(mesh); mesh.position.set(bin.pos.x + Math.cos(a) * r, bin.pos.y + y + 0.05, bin.pos.z + Math.sin(a) * r); }
    mesh.rotation.set(Math.random() * 3, Math.random() * 6, Math.random() * 3);
    (bin.inside = bin.inside || []).push(mesh);
    if (bin.inside.length > 12) { const old = bin.inside.shift(); old.parent?.remove(old); }
    bin.t = Math.max(bin.t, 1.2);
  }
  dropHolding() { const it = this.holding; if (!it) return; this.scene.attach(it.mesh); it.mesh.position.set(this.p.pos.x + Math.sin(this.p.yaw) * 0.5, this.world.groundAt(this.p.pos.x, this.p.pos.z) + (it.rest || 0.04), this.p.pos.z + Math.cos(this.p.yaw) * 0.5); it.mesh.rotation.set(it.rx || 0, Math.random() * 6, it.rz || 0); this.holding = null; this.missions.onDropped?.(it); }
  throwProp(kind, to, onEnd) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 16), new THREE.MeshStandardMaterial({ color: 0xd4a531, metalness: 1, roughness: 0.25 }));
    const from = new THREE.Vector3(); this.human.j.wristR.getWorldPosition(from); m.position.copy(from); this.scene.add(m);
    this.projectiles.push({ mesh: m, p0: from, p1: to.clone(), h: 1.2, t: 0, dur: 0.8, spin: 14, onEnd: () => { this.scene.remove(m); m.geometry.dispose(); onEnd?.(); } });
  }
  releaseBalloon() {
    const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.25, metalness: 0.1 })); b.scale.y = 1.2; b.position.y = 1.0; g.add(b);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1, 4), new THREE.MeshBasicMaterial({ color: 0xffffff })); s.position.y = 0.4; g.add(s);
    this.human.j.wristR.getWorldPosition(g.position); g.position.y -= 0.3; this.scene.add(g);
    this.emitters.push({ kind: 'balloon', obj: g, t: 14, v: 0 });
  }
  burstWater(p, n = 30, sp = 3) { const c = new THREE.Color(0.75, 0.88, 1); for (let k = 0; k < n; k++) this.fx.water.emit(p, _v1.set((Math.random() - 0.5) * sp, 2 + Math.random() * sp, (Math.random() - 0.5) * sp), c, 0.12 + Math.random() * 0.1, 0.9 + Math.random() * 0.5, 0.7); }
  burstSparkle(p) { const c = new THREE.Color(2.5, 2, 0.6); for (let k = 0; k < 20; k++) this.fx.sparkle.emit(p, _v1.set((Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2), c, 0.12, 1.2, 1); }
  greetWalker(i) { const w = this.peds[i]; w.wave = 2.5; w.greet = true; this.walkers.style(i, 4); this.act('wave', 1.8, { text: ['سلام! روز بخیر 👋', 'رهگذر گفت: «سلام قهرمان!» 😄', 'رهگذر برایت دست تکان داد 👋'][(Math.random() * 3) | 0] }); }

  // سر قهرمان به سمت وسیله‌ای که می‌شود با آن تعامل کرد می‌چرخد
  headLook(dt) {
    const pr = this.prompt; const H = this.human; let ty = 0, tp = 0;
    if (pr && pr.pos && this.state === 'foot') {
      const dx = pr.pos.x - this.p.pos.x, dz = pr.pos.z - this.p.pos.z; const a = wrapAngle(Math.atan2(dx, dz) - this.p.yaw);
      if (Math.abs(a) < 1.6) { ty = clamp(a, -1.0, 1.0); tp = clamp(-Math.atan2(pr.pos.y - (this.p.pos.y + 1.6), Math.hypot(dx, dz)), -0.5, 0.6) * 0.6; }
    }
    this.lookYaw = damp(this.lookYaw, ty, 5, dt); this.lookPitch = damp(this.lookPitch, tp, 5, dt);
    H.j.head.rotation.y += this.lookYaw * 0.7; H.j.neck.rotation.y += this.lookYaw * 0.3; H.j.head.rotation.x += this.lookPitch;
  }
  addCoins(n, text) {
    const S = this.app.save.data; S.coins += n; this.app.save.save(); this.sfx('coin'); if (text) this.toast(text);
  }
  honk() {
    const v = this.veh; this.sfx('horn'); if (!v) return;
    this.cfx.scare(v.pos, 16);
    for (let i = 0; i < this.peds.length; i++) { const w = this.peds[i]; if (w.pos.distanceTo(v.pos) < 14) { w.wave = 1.6; w.greet = false; this.walkers.style(i, Math.random() < 0.5 ? 7 : 4); w.dodge = (w.off > 0 ? 1 : -1) * 2; } }
  }
  emote() {
    if (this.state !== 'foot') return;
    const list = [['dance', 5, 'رقصیدی! 💃 رهگذرها برایت دست می‌زنند'], ['clap', 2.4, 'دست زدی 👏'], ['wave', 2, 'برای همه دست تکان دادی 👋'], ['jump', 0.9, 'یوهو! 🙌']];
    const [a, d, txt] = list[this.emoteI++ % list.length];
    this.act(a, d, { text: txt });
    if (a === 'dance') for (let i = 0; i < this.peds.length; i++) { const w = this.peds[i]; if (w.pos.distanceTo(this.p.pos) < 12) { w.wave = 4.5; w.greet = true; this.walkers.style(i, 6); } }
  }
  // پرش با رمپ و دریفت جایزه سکه دارد
  stuntScore(v, dt) {
    if (v.air) { if (!v.airT) { v.airT = 0; v.air0 = v.pos.clone(); } v.airT += dt; }
    else if (v.airT) {
      const t = v.airT; const d = Math.hypot(v.pos.x - v.air0.x, v.pos.z - v.air0.z); v.airT = 0;
      if (t > 0.55) { const c = Math.round(t * 8 + d * 0.35); this.addCoins(c, `پرش ${toFa(Math.round(d))} متری! ${toFa(t.toFixed(1))} ثانیه در هوا 🚀 +${toFa(c)} سکه`); this.shake = Math.min(1, (this.shake || 0) + 0.4); }
    }
    const sliding = !v.air && Math.abs(v.vf) > 9 && Math.abs(v.vl) > 2.2;
    if (sliding) { this.driftScore += Math.abs(v.vl) * Math.abs(v.vf) * dt * 0.6; this.driftT = 0; }
    else if (this.driftScore > 0) { this.driftT += dt; if (this.driftT > 0.7) { const sc = Math.round(this.driftScore); this.driftScore = 0; if (sc >= 40) { const c = Math.min(60, Math.floor(sc / 40)); this.addCoins(c, `دریفت عالی! امتیاز ${toFa(sc)} 🔥 +${toFa(c)} سکه`); } } }
  }

  // ---------------- پیدا کردن تعامل نزدیک ----------------
  findInteraction() {
    if (this.state === 'drive') return { label: this.veh.isBike ? 'پیاده شدن از موتور' : 'پیاده شدن از ماشین', act: () => this.exitVehicle() };
    if (this.state === 'sit' || this.state === 'lie') return { label: 'بلند شدن', act: () => this.standUp() };
    if (this.state === 'ride') return { label: 'پیاده شدن از وسیله', act: () => this.endRide() };
    const mp = this.missions.prompt(); if (mp) return mp;
    if (this.state !== 'foot') return null;
    const p = this.p.pos; const dir = fwd(this.p.yaw, _v2);
    if (this.holding) { const w = this.world.inter.nearest(p, dir, this); if (w && w.label && /سطل/.test(typeof w.label === 'function' ? w.label(this) : w.label)) return w; }
    const o = this.world.inter.nearest(p, dir, this);
    let bestW = -1, bd = 2.0;
    for (let i = 0; i < this.peds.length; i++) { const d = this.peds[i].pos.distanceTo(p); if (d < bd) { bd = d; bestW = i; } }
    if (bestW >= 0 && (!o || bd < o.pos.distanceTo(p) - 0.3)) return { label: 'سلام کردن به رهگذر 👋', pos: this.peds[bestW].pos, act: () => this.greetWalker(bestW) };
    if (o) return o;
    if (this.holding) return { label: 'زمین گذاشتن آشغال', act: () => this.dropHolding() };
    return null;
  }
  interact() {
    const it = this.prompt || this.findInteraction();
    if (!it) { if (this.state === 'foot') this.act('wave', 1.2, { text: 'اینجا چیزی برای تعامل نیست؛ نزدیک یک وسیله برو' }); return; }
    this.sfx('click'); it.act(this); this.prompt = null; this.promptT = 0;
  }

  // ---------------- حلقه اصلی ----------------
  begin() { this.app.audio.init(); this.missions.start(); this.toast('به شهر آزاد خوش آمدی! 🏙️ با دکمه تعامل از همه چیز استفاده کن'); }
  update(dt) {
    dt = Math.min(dt, 0.05); const app = this.app; const joyDrive = (this.state === 'drive' && app.save.data.settings.drive === 'joystick') || this.state === 'ride';
    const input = app.input.update(joyDrive ? this.joy : null);
    if (app.input.consume('Escape') || app.input.consume('KeyP')) app.toggleCityPause?.();
    if (this.paused) { app.engine.render(this.scene, this.camera, dt); return; }
    this.t += dt;
    if (app.input.consume('KeyF') || app.input.consume('KeyE') || app.input.consume('Enter') || this.btn.interact) { this.btn.interact = false; this.interact(); }
    if (app.input.consume('KeyC')) this.cycleCamera();
    if (app.input.consume('KeyG')) this.emote();
    if (app.input.consume('KeyY')) this.missions.accept(); if (app.input.consume('KeyN')) this.missions.decline();
    // ورودی ترکیبی کیبورد و جوی‌استیک
    const inp = input;
    if (this.state === 'drive' && (app.input.consume('KeyH') || this.btn.horn)) { this.btn.horn = false; this.honk(); }
    for (let k = this.timers.length - 1; k >= 0; k--) { const tm = this.timers[k]; tm.t -= dt; if (tm.t <= 0) { this.timers.splice(k, 1); tm.fn(); } }
    const st = this.state;
    if (st === 'foot') this.stepFoot(dt, input);
    else if (st === 'act') this.stepAct(dt);
    else if (st === 'sit' || st === 'lie') this.stepSit(dt, input);
    else if (st === 'ride') this.stepRide(dt, inp);
    else if (st === 'path') this.stepPath(dt);
    else if (st === 'mission') this.missions.stepPlayer(dt, input);
    if (st !== 'drive') { this.human.blend(dt, st === 'ride' ? 9 : st === 'mission' ? 18 : 13); this.headLook(dt); }
    // وسایل نقلیه
    const steps = Math.ceil(dt / (1 / 90)); const h = dt / steps;
    for (const v of this.vehicles) {
      if (v === this.veh || Math.abs(v.vf) > 0.01 || Math.abs(v.vl) > 0.01 || v.air) for (let s = 0; s < steps; s++) this.stepVehicle(v, h, v === this.veh ? inp : null);
    }
    this.collideVehicles();
    for (const v of this.vehicles) this.placeVehicle(v, dt);
    if (this.veh) this.carEffects(this.veh, dt);
    this.updateTraffic(dt);
    this.updateWalkers(dt);
    // جهان
    const focus = this.playerWorldPos(_v1).clone();
    this.world.focus = focus; this.world.canBuild = this.state !== 'drive' || Math.abs(this.veh.vf) < 9;
    this.world.update(dt, this.t, focus);
    this.cfx.update(dt, this.t);
    this.missions.update(dt);
    if (this.veh) this.stuntScore(this.veh, dt);
    this.updateFx(dt);
    this.updateIndoor(dt, focus);
    this.updateCamera(dt);
    this.outdoor.update(dt, focus, this.camera);
    this.fire.update(dt, this.t, this.camera.position);
    this.weather.update(dt, this.camera, (x, z) => this.world.groundAt(x, z));
    if (this.spot) { const v = this.veh; if (v) { this.spot.position.copy(v.pos).add(_v2.set(0, 1, 0)).addScaledVector(fwd(v.heading, _v3), 1.5); this.spot.target.position.copy(v.pos).addScaledVector(fwd(v.heading, _v3), 25); this.spot.intensity = 90; } else this.spot.intensity = 0; this.spot.target.updateMatrixWorld(); }
    // صدا
    const v = this.veh;
    if (v) { app.audio.setEngine({ rpm: v.rpm, throttle: v.throttle, speed: Math.abs(v.vf) * 3.6, cyl: v.isBike ? 4 : v.def.style === 'muscle' ? 8 : v.def.style === 'classic' ? 6 : 10, on: true }); app.audio.setSkid(clamp((v.slip - 2.4) / 6, 0, 1)); }
    else { app.audio.setEngine({ on: false }); app.audio.setSkid(0); }
    // اعلان تعامل
    this.promptT -= dt; if (this.promptT <= 0) { this.promptT = 0.12; this.prompt = this.findInteraction(); app.cityHud?.setPrompt(this.prompt, this); }
    app.engine.finalPass.uniforms.uFlash.value = damp(app.engine.finalPass.uniforms.uFlash.value, 0, 5, dt);
    app.engine.finalPass.uniforms.uSpeed.value = v ? clamp((Math.abs(v.vf) - 25) / 40, 0, 1) * 0.5 + (v.nitroOn ? 0.3 : 0) : 0;
    if (this.skipDraw) return;
    app.engine.render(this.scene, this.camera, dt);
    this.hudT -= dt; if (this.hudT <= 0) { this.hudT = 0.1; app.cityHud?.update(this); }
  }

  stepFoot(dt, input) {
    const p = this.p; const j = this.joy; const W = this.world;
    let f = input.throttle - input.brakeRev - j.y, s = -input.steer + j.x;
    const mag = Math.min(1, Math.hypot(f, s));
    const run = (input.nitro || this.btn.run || Math.hypot(j.x, j.y) > 0.92) && !this.carrying;
    const maxSp = this.carrying ? 2.4 : run ? 5.8 : 2.1;
    const cf = fwd(this.camYaw, _v1), cr = rightOf(this.camYaw, _v2);
    const dx = cf.x * f + cr.x * s, dz = cf.z * f + cr.z * s; const dl = Math.hypot(dx, dz);
    const tx = dl > 0.01 ? dx / dl * maxSp * mag : 0, tz = dl > 0.01 ? dz / dl * maxSp * mag : 0;
    const k = p.onGround ? 10 : 2;
    p.vel.x = damp(p.vel.x, tx, k, dt); p.vel.z = damp(p.vel.z, tz, k, dt);
    if (dl > 0.01 && mag > 0.05) p.yaw += wrapAngle(Math.atan2(dx, dz) - p.yaw) * Math.min(1, dt * 11);
    const ox = p.pos.x, oz = p.pos.z;
    p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
    // پرش
    if ((this.app.input.consume('Space') || this.btn.jump) && p.onGround) { this.btn.jump = false; p.vy = 4.8; p.onGround = false; this.sfx('jump'); }
    this.btn.jump = false;
    // برخورد
    W.colliders.resolve(p.pos, 0.3, 1, p.pos.y);
    for (const v of this.vehicles) { const sh = v.model.shape; const fx = Math.sin(v.heading), fz = Math.cos(v.heading); const off = Math.max(0, sh.L / 2 - sh.W / 2); for (const sg of [1, 0, -1]) { const cx = v.pos.x + fx * off * sg, cz = v.pos.z + fz * off * sg; const ddx = p.pos.x - cx, ddz = p.pos.z - cz; const d = Math.hypot(ddx, ddz); const R = sh.W / 2 + 0.3; if (d < R && d > 0.001) { p.pos.x += ddx / d * (R - d); p.pos.z += ddz / d * (R - d); } } }
    // ارتفاع
    const g = W.groundAt(p.pos.x, p.pos.z);
    if (g - p.pos.y > 0.42 && p.onGround) { p.pos.x = ox; p.pos.z = oz; }
    p.vy -= 9.81 * 1.5 * dt; p.pos.y += p.vy * dt;
    const g2 = W.groundAt(p.pos.x, p.pos.z);
    if (p.pos.y <= g2) { if (!p.onGround && p.vy < -3) this.sfx('jump'); p.pos.y = g2; p.vy = 0; p.onGround = true; } else if (p.pos.y > g2 + 0.06) p.onGround = false; else { p.pos.y = damp(p.pos.y, g2, 20, dt); p.onGround = true; }
    // انیمیشن
    const sp = Math.hypot(p.vel.x, p.vel.z); p.speed = sp;
    const H = this.human; H.root.position.copy(p.pos); H.root.rotation.set(0, p.yaw, 0);
    if (!p.onGround) H.anim('jump', this.t);
    else if (sp > 0.25) {
      p.walkT += dt * sp * (sp > 3.5 ? 1.75 : 2.9); H.anim(sp > 3.5 ? 'run' : 'walk', p.walkT);
      const ph = Math.floor(p.walkT / Math.PI); if (ph !== this.stepPh) { this.stepPh = ph; this.sfx(sp > 3.5 ? 'stepRun' : 'step'); if (sp > 3.5 && Math.random() < 0.7) this.fx.dust.emit(_v3.set(p.pos.x, p.pos.y + 0.05, p.pos.z), _v2.set((Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4), new THREE.Color(0.8, 0.76, 0.68), 0.25, 0.7, 0.22); if (sp > 3.5) this.cfx.scare(p.pos, 3.2); }
    }
    else H.anim('idle', this.t);
    this.armOverlay();
  }
  armOverlay() {
    const j = this.human.j;
    if (this.holding) { j.shoulderR.rotation.x = -0.55; j.shoulderR.rotation.z = -0.15; j.elbowR.rotation.x = -1.25; j.wristR.rotation.y = 0.3; }
    if (this.carrying) { j.shoulderL.rotation.x = -2.0; j.shoulderL.rotation.z = 0.1; j.elbowL.rotation.x = -1.6; j.shoulderR.rotation.x = -1.0; j.elbowR.rotation.x = -1.2; j.spine.rotation.x = 0.16; }
  }
  stepAct(dt) {
    const a = this.actS; if (!a) { this.state = 'foot'; return; }
    a.t += dt; const H = this.human; const u = clamp(a.t / a.dur, 0, 1);
    H.root.position.copy(this.p.pos); H.root.rotation.set(0, this.p.yaw, 0);
    const k = a.anim === 'throw' ? u : ONE_SHOT.has(a.anim) ? Math.sin(Math.PI * u) : 1;
    H.anim(a.anim, this.t, { k });
    if (a.anim !== 'pickup') this.armOverlay();
    if (a.opts.mid && !a.midDone && u > 0.5) { a.midDone = true; a.opts.mid(); }
    if (u >= 1) { this.state = 'foot'; this.actS = null; a.opts.after?.(); }
  }
  stepSit(dt, input) {
    const S = this.sitS; S.t += dt; const H = this.human;
    if (this.state === 'sit') H.anim('sit', this.t, { seatY: 0.42 });
    else { H.anim('lie', this.t, { seatY: 0.1 }); const b = Math.sin(this.t * 1.6) * 0.012; H.j.spine.rotation.x = b; }
    if (S.t > 0.6 && (input.throttle || input.brakeRev || Math.abs(input.steer) > 0 || Math.hypot(this.joy.x, this.joy.y) > 0.5)) this.standUp();
  }
  stepRide(dt, inp) {
    const R = this.rideS; R.t += dt; const H = this.human; const r = R.r;
    const ex = r.excite ? r.excite(this) : 0.4;
    if (r.pose === 'drive') H.pose('drive', { seatY: 0, steer: inp.steer });
    else H.anim(r.pose || 'ridePark', this.t, { seatY: r.seatY, excite: ex });
    if (r.control) r.control({ throttle: inp.throttle - Math.max(inp.brake, inp.brakeRev, inp.reverse), steer: inp.steer }, dt);
    if (ex > 0.85 && Math.random() < dt * 0.6) this.sfx('scream');
    const done = r.done ? r.done(R.lap0) : R.t > r.dur;
    if (done || (r.done && R.t > r.dur * 1.6)) this.endRide();
  }
  stepPath(dt) {
    const P = this.pathS; P.t += dt; const u = clamp(P.t / P.dur, 0, 1); const H = this.human;
    const pos = P.curve.getPointAt(u); const tg = P.curve.getTangentAt(Math.min(0.999, u));
    H.root.position.copy(pos); const yaw = Math.atan2(tg.x, tg.z); if (Math.hypot(tg.x, tg.z) > 0.2) this.p.yaw = yaw; H.root.rotation.set(0, this.p.yaw, 0);
    if (P.pose === 'climb') { H.anim('walk', this.t * 5); H.j.shoulderL.rotation.x = -2.4 + Math.sin(this.t * 6) * 0.4; H.j.shoulderR.rotation.x = -2.4 - Math.sin(this.t * 6) * 0.4; }
    else if (u < P.climb) { H.anim('walk', this.t * 6); H.j.shoulderL.rotation.x = H.j.shoulderR.rotation.x = -1.8; }
    else H.anim('ridePark', this.t, { seatY: 0.25, excite: 1 });
    if (u >= 1) { this.p.pos.copy(pos); this.p.pos.y = this.world.groundAt(pos.x, pos.z); this.state = 'foot'; this.pathS = null; }
  }

  collideVehicles() {
    const vs = this.vehicles;
    for (let a = 0; a < vs.length; a++) for (let b = a + 1; b < vs.length; b++) {
      const A = vs[a], B = vs[b]; const dx = B.pos.x - A.pos.x, dz = B.pos.z - A.pos.z; const d = Math.hypot(dx, dz);
      const R = (A.model.shape.W + B.model.shape.W) / 2 + 0.9;
      if (d < R && d > 0.001) {
        const nx = dx / d, nz = dz / d; const push = (R - d) / 2;
        A.pos.x -= nx * push; A.pos.z -= nz * push; B.pos.x += nx * push; B.pos.z += nz * push;
        const rv = (B.vel.x - A.vel.x) * nx + (B.vel.z - A.vel.z) * nz;
        if (rv < 0) { const imp = -rv * 0.6; A.vel.x -= nx * imp; A.vel.z -= nz * imp; B.vel.x += nx * imp; B.vel.z += nz * imp; if (imp > 1.5 && (A === this.veh || B === this.veh)) { this.app.audio.thump(clamp(imp / 10, 0.2, 0.8)); this.shake = Math.min(1, (this.shake || 0) + imp / 12); } }
        for (const V of [A, B]) { const ff = fwd(V.heading, _v1); V.vf = V.vel.x * ff.x + V.vel.z * ff.z; }
      }
    }
  }
  carEffects(v, dt) {
    const fx0 = Math.sin(v.heading), fz0 = Math.cos(v.heading);
    if (!v.air && Math.abs(v.vf) > 4 && this.world.groundAt(v.pos.x, v.pos.z) > 0.1 && !this.onRoad(v.pos) && Math.random() < 0.5) this.effects.dirt(_v1.set(v.pos.x - fx0 * v.model.shape.wb / 2, v.y + 0.1, v.pos.z - fz0 * v.model.shape.wb / 2), v.vel, false);
    if (v.model.exhaust.length && v.throttle > 0.15 && Math.abs(v.vf) < 10 && Math.random() < dt * 14) { _v1.copy(v.model.exhaust[0]); _v1.z -= 0.15; v.model.root.localToWorld(_v1); this.effects.smoke.emit(_v1, _v2.set(-fx0 * 0.8 + (Math.random() - 0.5) * 0.3, 0.35, -fz0 * 0.8), this._gray || (this._gray = new THREE.Color(0.55, 0.55, 0.58)), 0.35, 1.1, 0.18); }
    if (v.slip > 2.6 && !v.air && Math.random() < 0.6) {
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      const wp = _v1.set(v.pos.x - fx * v.model.shape.wb / 2, v.y + 0.12, v.pos.z - fz * v.model.shape.wb / 2);
      this.effects.tireSmoke(wp, v.vel, _v2.set(0.92, 0.92, 0.92), clamp((v.slip - 2) / 6, 0.2, 1));
    }
    if (v.nitroOn && v.model.exhaust.length) for (const e of v.model.exhaust) { _v1.copy(e); _v1.z -= 0.1; v.model.root.localToWorld(_v1); this.effects.flame(_v1, _v2.set(-Math.sin(v.heading), 0, -Math.cos(v.heading)), true); }
  }

  updateFx(dt) {
    for (let k = this.emitters.length - 1; k >= 0; k--) {
      const e = this.emitters[k]; e.t -= dt;
      if (e.kind === 'hydrant') { const c = new THREE.Color(0.8, 0.9, 1); for (let i = 0; i < 6; i++) this.fx.water.emit(e.pos, _v1.set((Math.random() - 0.5) * 1.2, 5 + Math.random() * 2, (Math.random() - 0.5) * 1.2), c, 0.16, 1.4, 0.65); }
      else if (e.kind === 'leaves') { if (Math.random() < 0.5) { const c = new THREE.Color().setHSL(0.18 + Math.random() * 0.12, 0.7, 0.35); this.fx.leaves.emit(_v2.copy(e.pos).add(_v1.set((Math.random() - 0.5) * 3, Math.random(), (Math.random() - 0.5) * 3)), _v1.set((Math.random() - 0.5), -0.3, (Math.random() - 0.5)), c, 0.12, 3.5, 0.95); } }
      else if (e.kind === 'dust') { if (Math.random() < 0.6) this.fx.dust.emit(_v2.copy(e.pos).add(_v1.set((Math.random() - 0.5) * 0.8, 0.2, (Math.random() - 0.5) * 0.8)), _v1.set((Math.random() - 0.5) * 0.6, 0.5, (Math.random() - 0.5) * 0.6), new THREE.Color(0.85, 0.8, 0.7), 0.4, 1.2, 0.35); }
      else if (e.kind === 'steam') { if (Math.random() < 0.7) this.fx.steam.emit(e.pos, _v1.set((Math.random() - 0.5) * 0.15, 0.6, (Math.random() - 0.5) * 0.15), new THREE.Color(1, 1, 1), 0.15, 1.5, 0.35); }
      else if (e.kind === 'spray') { const from = new THREE.Vector3(); this.human.j.wristR.getWorldPosition(from); const d = e.pos.clone().sub(from); for (let i = 0; i < 3; i++) this.fx.water.emit(from, _v1.copy(d).multiplyScalar(1.6).add(_v3.set((Math.random() - 0.5) * 0.3, 1.2, (Math.random() - 0.5) * 0.3)), new THREE.Color(0.75, 0.88, 1), 0.05, 0.6, 0.7); }
      else if (e.kind === 'balloon') { e.v = Math.min(2.2, e.v + dt * 1.2); e.obj.position.y += e.v * dt; e.obj.position.x += Math.sin(this.t * 0.7) * dt * 0.5; e.obj.rotation.z = Math.sin(this.t * 1.3) * 0.1; if (e.t <= 0) { this.scene.remove(e.obj); e.obj.traverse((o) => o.geometry?.dispose()); } }
      if (e.t <= 0) this.emitters.splice(k, 1);
    }
    for (let k = this.projectiles.length - 1; k >= 0; k--) {
      const pr = this.projectiles[k]; pr.t += dt; const u = clamp(pr.t / pr.dur, 0, 1);
      pr.mesh.position.lerpVectors(pr.p0, pr.p1, u); pr.mesh.position.y += Math.sin(u * Math.PI) * pr.h; pr.mesh.rotation.x += pr.spin * dt; pr.mesh.rotation.z += pr.spin * 0.6 * dt;
      if (u >= 1) { this.projectiles.splice(k, 1); pr.onEnd?.(); }
    }
    const h = this.app.engine.renderer.domElement.height;
    for (const s of Object.values(this.fx)) s.update(dt, h);
    this.effects.update(dt, h);
  }

  // داخل خانه: چراغ اتاق و تشخیص اتاق
  houseAt(p) {
    for (const h of this.world.houses) {
      const dx = p.x - h.cx, dz = p.z - h.cz; if (Math.abs(dx) > 8 || Math.abs(dz) > 8) continue;
      const lx = dx * Math.cos(h.rot) - dz * Math.sin(h.rot), lz = dx * Math.sin(h.rot) + dz * Math.cos(h.rot);
      if (Math.abs(lx) < 5.9 && Math.abs(lz) < 4.9) return { h, lx, lz };
    }
    return null;
  }
  updateIndoor(dt, focus) {
    const ins = this.state === 'drive' ? null : this.houseAt(focus);
    this.inside = ins; this.world.insideHouse = ins ? ins.h : null;
    const target = ins && this.roomLightOn ? 7 : 0;
    this.indoorLight.intensity = damp(this.indoorLight.intensity, target, 4, dt);
    if (ins) { const rx = ins.lx < 1 ? -2.4 : 3.4, rz = ins.lz > 0 ? 2.4 : -2.4; const wp = ins.h.toWorld(rx, 2.9, rz); this.indoorLight.position.lerp(wp, this.indoorLight.intensity < 0.5 ? 1 : Math.min(1, dt * 6)); }
  }

  // ---------------- دوربین ----------------
  cycleCamera() {
    const modes = ['chase', 'cockpit', 'top'];
    this.camMode = modes[(modes.indexOf(this.camMode) + 1) % modes.length];
    this.toast({ chase: 'دید سوم شخص', cockpit: 'دید اول شخص', top: 'دید از بالا' }[this.camMode]); this.camInit = false;
  }
  updateCamera(dt, snap = false) {
    const cam = this.camera; const W = this.world;
    this.shake = damp(this.shake || 0, 0, 4, dt);
    const sh = (this.shake || 0) * 0.08; const sx = (Math.random() - 0.5) * sh, sy = (Math.random() - 0.5) * sh;
    this.dragT -= dt;
    this.human.j.head.visible = true;
    if (this.state === 'drive') return this.vehicleCam(this.veh, dt, sx, sy);
    const focus = this.playerWorldPos(_v3).clone();
    if (this.state === 'ride') {
      const R = this.rideS;
      if (R.r.cam === 'seat' || this.camMode === 'cockpit') {
        const eye = new THREE.Vector3(); this.human.j.head.getWorldPosition(eye); this.human.j.head.visible = false;
        R.seat.getWorldQuaternion(_q); cam.position.copy(eye).add(_v1.set(0, 0.12, 0));
        cam.quaternion.copy(_q).multiply(new THREE.Quaternion().setFromEuler(_e.set(-0.1 + this.camPitch * 0.3, Math.PI + (R.r.yawOff || 0) + (this.dragYaw || 0), 0, 'YXZ')));
        cam.fov = 80; cam.near = 0.05; cam.updateProjectionMatrix(); return;
      }
      const d = R.r.name === 'wheel' ? 11 : R.r.name === 'drop' ? 12 : 7.5;
      this.camYaw += dt * (this.dragT > 0 ? 0 : 0.15);
      cam.position.set(focus.x - Math.sin(this.camYaw) * d, focus.y + 2.6 + this.camPitch * 6, focus.z - Math.cos(this.camYaw) * d);
      cam.lookAt(focus.x, focus.y + 0.8, focus.z); cam.fov = 60; cam.near = 0.1; cam.updateProjectionMatrix(); return;
    }
    const yaw = this.state === 'foot' || this.state === 'mission' ? this.p.yaw : this.state === 'sit' || this.state === 'lie' ? this.sitS.yaw : this.p.yaw;
    if (this.dragT <= 0 && this.state === 'foot' && this.p.speed > 0.6) this.camYaw += wrapAngle(yaw - this.camYaw) * Math.min(1, dt * 1.6);
    if (this.camMode === 'cockpit' && (this.state === 'foot' || this.state === 'mission' || this.state === 'act')) {
      const eye = new THREE.Vector3(); this.human.j.head.getWorldPosition(eye); this.human.j.head.visible = false;
      if (this.dragT <= 0) this.camYaw = yaw;
      cam.position.copy(eye).addScaledVector(fwd(this.camYaw, _v1), 0.12).add(_v2.set(sx, 0.08 + sy, 0));
      cam.lookAt(_v1.copy(cam.position).add(_v2.set(Math.sin(this.camYaw), -this.camPitch * 0.6 + 0.05, Math.cos(this.camYaw))));
      cam.fov = 75; cam.near = 0.05; cam.updateProjectionMatrix(); return;
    }
    const indoor = this.inside;
    if (this.state === 'mission' && this.dragT <= 0) this.camYaw += wrapAngle(yaw - Math.PI * 0.62 - this.camYaw) * Math.min(1, dt * 3);
    let dist = indoor ? 2.5 : this.camMode === 'top' ? 2.0 : 4.3, up = indoor ? 1.75 : this.camMode === 'top' ? 3.9 : 1.9 + this.camPitch * 3;
    const cf = fwd(this.camYaw, _v1);
    const want = _v2.set(focus.x - cf.x * dist, focus.y + up, focus.z - cf.z * dist);
    if (indoor) {
      const h = indoor.h; const dx = want.x - h.cx, dz = want.z - h.cz;
      let lx = dx * Math.cos(h.rot) - dz * Math.sin(h.rot), lz = dx * Math.sin(h.rot) + dz * Math.cos(h.rot);
      const rx = indoor.lx < 1 ? [-5.6, 0.85] : [1.15, 5.6]; const rz = indoor.lz > 0 ? [0.15, 4.65] : [-4.65, -0.15];
      lx = clamp(lx, rx[0], rx[1]); lz = clamp(lz, rz[0], rz[1]);
      const w = h.toWorld(lx, 0, lz); want.x = w.x; want.z = w.z; want.y = Math.min(want.y, 3.2);
    } else {
      // دوربین داخل دیوار نرود
      for (let k = 0; k < 8 && W.colliders.inside(want.x, want.z, 2); k++) { want.lerp(_v3.set(focus.x, want.y, focus.z), 0.25); }
    }
    if (!this.camPos || snap || !this.camInit) { this.camPos = want.clone(); this.camInit = true; }
    this.camPos.lerp(want, Math.min(1, dt * (indoor ? 10 : 7)));
    const gy = W.groundAt(this.camPos.x, this.camPos.z) + 0.4; if (this.camPos.y < gy) this.camPos.y = gy;
    cam.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
    cam.lookAt(focus.x, focus.y + (this.state === 'lie' ? 0.3 : 1.35), focus.z);
    cam.fov = indoor ? 70 : 62; cam.near = indoor ? 0.08 : 0.15; cam.updateProjectionMatrix();
  }
  vehicleCam(v, dt, sx, sy) {
    const cam = this.camera; const m = v.model; const s = m.shape; const sp = Math.abs(v.vf);
    if (this.camMode === 'cockpit') {
      m.root.updateMatrixWorld(true);
      const eye = _v1.copy(m.eye).add(_v2.set(0, 0.07, 0.04)); m.body.localToWorld(eye);
      if (m.driver) m.driver.j.head.visible = false;
      cam.position.set(eye.x + sx, eye.y + sy, eye.z);
      const q = m.body.getWorldQuaternion(_q);
      cam.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(_e.set(-0.2 - this.camPitch * 0.3, Math.PI + (this.dragYaw || 0), 0, 'YXZ')));
      cam.fov = 80; cam.near = 0.05; cam.updateProjectionMatrix(); return;
    }
    if (m.driver) m.driver.j.head.visible = true;
    cam.near = 0.1;
    if (!this.camInit) { this.camYawV = v.heading; this.camInit = true; this.camPosV = null; }
    let ty = v.heading; if (sp > 6) { const vy = Math.atan2(v.vel.x, v.vel.z); ty = v.heading + wrapAngle(vy - v.heading) * 0.35; }
    if (v.vf < -2) ty = v.heading;
    this.camYawV += wrapAngle(ty + (this.dragYaw || 0) - this.camYawV) * Math.min(1, dt * 4.2);
    const cfx = Math.sin(this.camYawV), cfz = Math.cos(this.camYawV); let desired, look;
    if (this.camMode === 'top') { desired = _v1.set(v.pos.x - cfx * (s.L / 2 + 2), v.pos.y + s.roof + 2, v.pos.z - cfz * (s.L / 2 + 2)); look = _v2.set(v.pos.x + cfx * 1.2, v.pos.y + 0.4, v.pos.z + cfz * 1.2); cam.fov = 70; }
    else { const dist = 6 + s.L * 0.18 + clamp(sp / 30, 0, 1.3); desired = _v1.set(v.pos.x - cfx * dist, v.pos.y + 2.0 + s.roof * 0.35 + this.camPitch * 3, v.pos.z - cfz * dist); look = _v2.set(v.pos.x + cfx * 4, v.pos.y + 1, v.pos.z + cfz * 4); cam.fov = 60 + clamp((sp - 10) / 4, 0, 12) + (v.nitroOn ? 6 : 0); }
    for (let k = 0; k < 8 && this.world.colliders.inside(desired.x, desired.z, 2); k++) desired.lerp(_v3.set(v.pos.x, desired.y, v.pos.z), 0.25);
    if (!this.camPosV) this.camPosV = desired.clone();
    this.camPosV.lerp(desired, Math.min(1, dt * 9));
    const gy = this.world.groundAt(this.camPosV.x, this.camPosV.z) + 0.5; if (this.camPosV.y < gy) this.camPosV.y = gy;
    cam.position.set(this.camPosV.x + sx, this.camPosV.y + sy, this.camPosV.z); cam.lookAt(look); cam.updateProjectionMatrix();
  }

  dispose() {
    this.missions?.cleanup(); this.weather?.dispose();
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); });
    this.outdoor.envRT?.dispose();
    this.app.audio.silence();
  }
}

// ---------------- رابط کاربری شهر آزاد ----------------
export function bindCityUI(app) {
  const joy = $('cJoy'), knob = $('cKnob');
  let jid = null, jc = null;
  const city = () => app.city;
  joy.addEventListener('pointerdown', (e) => { e.preventDefault(); jid = e.pointerId; joy.setPointerCapture(jid); const r = joy.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width / 2 }; move(e); });
  const move = (e) => { if (e.pointerId !== jid || !city()) return; let dx = (e.clientX - jc.x) / jc.R, dy = (e.clientY - jc.y) / jc.R; const L = Math.hypot(dx, dy); if (L > 1) { dx /= L; dy /= L; } city().joy.x = dx; city().joy.y = dy; city().joy.active = true; knob.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`; };
  const end = (e) => { if (e.pointerId !== jid) return; jid = null; if (city()) { city().joy.x = 0; city().joy.y = 0; city().joy.active = false; } knob.style.transform = ''; };
  joy.addEventListener('pointermove', move); joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  const hold = (id, key) => { const el = $(id); const on = (e) => { e.preventDefault(); if (city()) city().btn[key] = true; el.classList.add('on'); }; const off = (e) => { e.preventDefault(); if (city() && key !== 'jump') city().btn[key] = false; el.classList.remove('on'); }; el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off); };
  hold('cJump', 'jump'); hold('cRun', 'run');
  app.input.bindTouch($('cTouch'));
  $('cHorn').addEventListener('pointerdown', (e) => { e.preventDefault(); if (city()) city().btn.horn = true; });
  $('cEmote').addEventListener('click', () => city()?.emote());
  $('cInteract').addEventListener('pointerdown', (e) => { e.preventDefault(); if (city()) city().btn.interact = true; });
  $('cCam').addEventListener('click', () => city()?.cycleCamera());
  $('cPause').addEventListener('click', () => app.toggleCityPause());
  $('cAccept').addEventListener('click', () => city()?.missions.accept());
  $('cDecline').addEventListener('click', () => city()?.missions.decline());
  // چرخاندن دوربین با کشیدن روی صفحه
  const el = app.engine.renderer.domElement; let drag = null;
  el.addEventListener('pointerdown', (e) => { if (app.mode === 'city') drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
  window.addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.id) drag = null; });
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || !city()) return; const c = city();
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (c.state === 'drive' || c.camMode === 'cockpit' && c.state === 'ride') c.dragYaw = clamp((c.dragYaw || 0) - dx * 0.005, -2.6, 2.6);
    else c.camYaw -= dx * 0.006;
    c.camPitch = clamp(c.camPitch + dy * 0.004, -0.35, 0.7); c.dragT = 2.5;
  });
  window.addEventListener('pointerup', () => { const c = city(); if (c && c.state === 'drive') c.dragYaw = 0; });
  // HUD
  const mapC = $('cMap'), mctx = mapC.getContext('2d');
  let toastT = null; let bubbleObj = null;
  app.cityHud = {
    toast(t) { const el = $('cToast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600); },
    bubble(text, obj) { const el = $('cBubble'); el.textContent = text; el.hidden = !text; bubbleObj = text ? obj : null; },
    fade(a, dur = 0.6) { const el = $('cFade'); el.style.transition = `opacity ${dur}s`; el.style.opacity = a; },
    big(text, sub = '') { const el = $('cBig'); el.innerHTML = `<b>${text}</b><small>${sub}</small>`; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); },
    setPrompt(p, c) {
      const L = $('cInteractL'), P = $('cPrompt');
      const label = p ? (typeof p.label === 'function' ? p.label(c) : p.label) : '';
      if (P.dataset.l !== label) { P.dataset.l = label; P.textContent = label ? (isTouch() ? label : label + '  (F)') : ''; P.hidden = !label; L.textContent = label ? 'تعامل' : 'تعامل'; $('cInteract').classList.toggle('ready', !!label); }
    },
    offer(o) {
      const el = $('cOffer'); if (!o) { el.hidden = true; return; }
      el.hidden = false; $('coTitle').textContent = o.title; $('coDesc').textContent = o.desc; $('coStars').textContent = '★'.repeat(o.diff) + '☆'.repeat(5 - o.diff) + '  ' + o.diffName;
      $('coReward').textContent = '+' + fmtNum(o.reward) + ' سکه'; $('coTime').textContent = 'زمان: ' + toFa(Math.round(o.limit)) + ' ثانیه';
    },
    update(c) {
      const S = app.save.data; $('cCoinsV').textContent = fmtNum(S.coins);
      const m = c.missions.active; const mp = $('cMission');
      mp.hidden = !m;
      if (m) { $('cmTitle').textContent = m.title; $('cmObj').textContent = m.objective(); $('cmProg').textContent = m.progress(); $('cmLeft').textContent = '⏱ ' + toFa(Math.max(0, Math.ceil(m.timeLeft))); $('cmTime').style.width = clamp(m.timeLeft / m.limit, 0, 1) * 100 + '%'; mp.classList.toggle('urgent', m.timeLeft < 20); }
      const hp = $('cHealth'); hp.hidden = !(m && m.usesHealth); if (!hp.hidden) hp.firstElementChild.style.width = clamp(c.health, 0, 100) + '%';
      const v = c.veh; $('cSpeed').hidden = !v; if (v) $('cSpeedV').textContent = toFa(Math.round(Math.abs(v.vf) * 3.6));
      const cityEl = $('city'); const joyMode = app.save.data.settings.drive === 'joystick';
      cityEl.classList.toggle('driving', !!v); cityEl.classList.toggle('joymode', joyMode); cityEl.classList.toggle('btnmode', !joyMode);
      $('cHorn').hidden = !v;
      // فلش جهت هدف
      const tgt = m && m.target ? m.target() : null; const arrow = $('cArrow');
      const pp = c.playerWorldPos(new THREE.Vector3());
      if (tgt) {
        const d = Math.hypot(tgt.x - pp.x, tgt.z - pp.z); arrow.hidden = d < 4;
        const camF = new THREE.Vector3(); c.camera.getWorldDirection(camF); const cy = Math.atan2(camF.x, camF.z); const ty = Math.atan2(tgt.x - pp.x, tgt.z - pp.z);
        arrow.firstElementChild.style.transform = `rotate(${(-wrapAngle(ty - cy) * 180 / Math.PI) - 90}deg)`; $('cDist').textContent = toFa(Math.round(d)) + ' متر';
        c.beacon.visible = d > 14; c.beacon.position.set(tgt.x, c.world.groundAt(tgt.x, tgt.z) + 0.02, tgt.z); c.beacon.material.uniforms.uT.value = c.t;
        c.marker.visible = d < 40; c.marker.position.set(tgt.x, (tgt.y || 0) + (c.inside ? 2.1 : 2.6) + Math.sin(c.t * 3) * 0.12, tgt.z); c.marker.rotation.y = c.t * 2; c.marker.scale.setScalar(c.inside ? 0.55 : 1);
      } else { arrow.hidden = true; c.beacon.visible = false; c.marker.visible = false; }
      // نقشه کوچک
      const mm = c.world.mm; const W = mapC.width; const range = 260; const sc = mm.sc;
      const cx = (pp.x + mm.off) * sc, cz = (pp.z + mm.off) * sc; const half = range * sc / 2;
      mctx.save(); mctx.clearRect(0, 0, W, W); mctx.beginPath(); mctx.arc(W / 2, W / 2, W / 2 - 2, 0, TAU); mctx.clip();
      mctx.fillStyle = '#5f8f4e'; mctx.fillRect(0, 0, W, W);
      mctx.drawImage(mm.canvas, cx - half, cz - half, half * 2, half * 2, 0, 0, W, W);
      const toM = (x, z) => [W / 2 + (x - pp.x) / range * W, W / 2 + (z - pp.z) / range * W];
      for (const vv of c.vehicles) if (vv.own) { const [x, y] = toM(vv.pos.x, vv.pos.z); mctx.fillStyle = '#1e90ff'; mctx.fillRect(x - 4, y - 4, 8, 8); }
      if (tgt) { let [x, y] = toM(tgt.x, tgt.z); const dx = x - W / 2, dy = y - W / 2; const L = Math.hypot(dx, dy); const R = W / 2 - 12; if (L > R) { x = W / 2 + dx / L * R; y = W / 2 + dy / L * R; } mctx.fillStyle = '#ffc23d'; mctx.beginPath(); mctx.arc(x, y, 8, 0, TAU); mctx.fill(); mctx.strokeStyle = '#000'; mctx.lineWidth = 2; mctx.stroke(); }
      const yaw = c.state === 'drive' ? c.veh.heading : c.p.yaw;
      mctx.translate(W / 2, W / 2); mctx.rotate(-yaw + Math.PI); mctx.fillStyle = '#ff5a00'; mctx.strokeStyle = '#fff'; mctx.lineWidth = 2.5;
      mctx.beginPath(); mctx.moveTo(0, -12); mctx.lineTo(8, 9); mctx.lineTo(0, 4); mctx.lineTo(-8, 9); mctx.closePath(); mctx.fill(); mctx.stroke();
      mctx.restore();
      // حباب گفتار روی سر آدم‌ها
      const B = $('cBubble');
      if (bubbleObj && !B.hidden) { const p = new THREE.Vector3(); bubbleObj.getWorldPosition(p); p.y += 0.45; p.project(c.camera); const vis = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1; B.style.opacity = vis ? 1 : 0; B.style.left = ((p.x * 0.5 + 0.5) * 100) + '%'; B.style.top = ((-p.y * 0.5 + 0.5) * 100) + '%'; }
    }
  };
}

function tick() { return new Promise((r) => setTimeout(r, 0)); }
