// Race session: builds the world for a stage, runs the fixed-step simulation for 20 cars,
// handles countdown, laps, positions, finish, results and every per-frame visual update.

import * as THREE from 'three';
import {
  STAGES, THEMES, CARS, FIELD_SIZE, DRIVER_NAMES, PAINT_COLORS, tunedPhysics, carById, emptyUpgrades,
  MAX_UPGRADE,
} from '../core/config.js';
import { RNG, clamp, fa, formatTime, wait } from '../core/utils.js';
import { Track } from './track.js';
import { Vehicle, collideVehicles, collideWalls } from './physics.js';
import { AIDriver } from './ai.js';
import { RaceCamera } from './camera.js';
import { Environment, DETAIL_LAYER } from '../gfx/environment.js';
import { CarVisual, createSharedCarMaterials } from '../gfx/carModel.js';
import { Effects } from '../gfx/effects.js';
import { Hud } from '../ui/hud.js';

const PLAYER_SLOT = 9; // starts 10th on the grid
const MS_TO_KMH = 3.6;

export class Race {
  constructor(app, stageIndex) {
    this.app = app;
    this.stage = STAGES[stageIndex];
    this.stageIndex = stageIndex;
    this.tier = app.tier;
    this.realism = this.tier.realism;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, app.gfx.width / app.gfx.height, 0.15, 2000);
    this.camera.layers.enable(DETAIL_LAYER);
    this.state = 'loading';
    this.time = 0; // time since green light
    this.clock = 0; // total time
    this.paused = false;
    this.cars = [];
    this.acc = 0;
    this.aiAcc = 0;
    this.frame = 0;
    this.timeScale = 1;
    this.results = null;
  }

  async build(onProgress = () => {}) {
    const app = this.app;
    const tier = this.tier;
    const stage = this.stage;
    const timings = (this.timings = {});
    let tMark = performance.now();
    const mark = (name) => { const t = performance.now(); timings[name] = Math.round(t - tMark); tMark = t; };
    onProgress(0.05, 'ساخت پیست...');
    await wait(16);
    tMark = performance.now();
    this.track = new Track(stage);
    mark('track');
    this.theme = THEMES[stage.theme];
    this.weatherGrip = stage.weather === 'rain' ? 0.84 : stage.weather === 'snow' ? 0.92 : 1;
    onProgress(0.2, 'ساخت محیط و گرافیک...');
    await wait(16);
    this.env = new Environment(app.gfx, this.scene, stage, this.track, tier);
    mark('environment');
    this.camera.far = this.env.viewFar;
    this.camera.updateProjectionMatrix();
    app.gfx.renderer.toneMappingExposure = this.env.exposure;
    app.gfx.setGrade(this.env.grade);
    onProgress(0.55, 'آماده‌سازی ماشین‌ها...');
    await wait(16);
    this.shared = createSharedCarMaterials(tier);
    this.#buildField();
    mark('cars');
    this.effects = new Effects(this.scene, tier, this.env.look);
    this.raceCam = new RaceCamera(this.camera);
    this.raceCam.setMode(app.profile.settings.camera);
    this.#nightLights();
    this.#reflections();
    this.hud = new Hud(app.ui.hudHost, { onAction: (a) => this.#hudAction(a) });
    this.hud.buildMinimap(this.track);
    this.hud.setMinimap(app.profile.settings.minimap);
    mark('effects+hud');
    onProgress(0.8, 'کامپایل سایه‌زن‌ها...');
    await wait(16);
    tMark = performance.now();
    try {
      app.gfx.setView(this.scene, this.camera);
      if (app.gfx.renderer.compileAsync) await app.gfx.renderer.compileAsync(this.scene, this.camera);
      else app.gfx.renderer.compile(this.scene, this.camera);
    } catch (e) {
      console.warn('shader precompile failed', e);
    }
    mark('compile');
    onProgress(1, 'آماده!');
    this.#placeOnGrid();
    this.state = 'intro';
    this.stateTime = 0;
    const p = this.player.vehicle;
    this.raceCam.startOrbit(new THREE.Vector3(p.x, p.proj.height, p.z), 14, 4.5, 0.35);
    app.audio.startRace(this.player.def.phys.cylinders, this.realism.aiVoices);
    this.hud.setVisible(true);
    this.hud.message(stage.name, `مرحله‌ی ${fa(stage.index + 1)} | ${fa(stage.laps)} دور`, 2.4, 'title');
  }

  // ---------------------------------------------------------------------------------------------
  #buildField() {
    const app = this.app;
    const stage = this.stage;
    const rng = new RNG(stage.seed ^ 0x51ed);
    const names = rng.shuffle([...DRIVER_NAMES]);
    const env = { roadGrip: this.theme.roadGrip, weatherGrip: this.weatherGrip };
    const entries = [];
    // AI opponents
    for (let k = 0; k < FIELD_SIZE - 1; k++) {
      const ci = rng.int(stage.ai.carMin, stage.ai.carMax);
      const def = CARS[ci];
      const up = emptyUpgrades();
      for (const key of Object.keys(up)) up[key] = clamp(rng.int(stage.ai.upgMin, stage.ai.upgMax), 0, MAX_UPGRADE);
      const phys = tunedPhysics(def, up);
      const skill = clamp(stage.ai.skill + rng.range(-0.035, 0.03), 0.68, 0.98);
      entries.push({ def, phys, skill, name: names[k % names.length], color: PAINT_COLORS[rng.int(0, PAINT_COLORS.length - 1)], pace: skill * (1 + phys.powerKW / phys.mass) });
    }
    // strongest drivers start at the front
    entries.sort((a, b) => b.pace - a.pace);
    const prof = app.profile;
    const pdef = carById(prof.data.selected);
    const playerEntry = {
      def: pdef,
      phys: tunedPhysics(pdef, prof.upgradesOf(pdef.id)),
      skill: 0.95,
      name: 'شما',
      color: prof.paintOf(pdef.id),
      isPlayer: true,
    };
    entries.splice(PLAYER_SLOT, 0, playerEntry);
    const castCars = this.tier.shadowType !== 'none';
    entries.forEach((e, slot) => {
      const vehicle = new Vehicle(e.phys, e.def.body);
      if (!e.isPlayer) vehicle.assists = 2; // AI drivers always use full stability aids
      const visual = new CarVisual(e.def, e.color, this.tier, this.shared, { castShadow: castCars });
      this.scene.add(visual.root);
      const ai = new AIDriver(vehicle, this.track, { skill: e.skill, rng: new RNG(rng.int(1, 1e9)), roadGrip: env.roadGrip, weatherGrip: env.weatherGrip, aggression: rng.next() });
      const car = {
        id: slot,
        slot,
        def: e.def,
        name: e.name,
        color: e.color,
        isPlayer: !!e.isPlayer,
        vehicle,
        visual,
        ai,
        progress: 0,
        lastS: null,
        lap: 1,
        lapStart: 0,
        bestLap: 0,
        lapTimes: [],
        finished: false,
        finishTime: 0,
        rank: slot + 1,
        wheels: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
      };
      this.cars.push(car);
      if (car.isPlayer) this.player = car;
    });
    this.vehicles = this.cars.map((c) => c.vehicle);
    this.aiCars = this.cars.filter((c) => !c.isPlayer);
  }

  #placeOnGrid() {
    const t = this.track;
    for (const car of this.cars) {
      const slot = t.gridSlot(car.slot);
      const p = t.pointAt(slot.s, slot.d);
      car.vehicle.reset(p.x, p.z, p.heading, p.y);
      car.vehicle.hint = p.index;
      car.vehicle.step(0, this.#simEnv()); // initialise projection
      car.progress = -slot.back;
      car.lastS = car.vehicle.proj.s;
      car.visual.update(car.vehicle, 0, this.realism, 0);
    }
  }

  #simEnv() {
    if (!this._simEnv) {
      this._simEnv = {
        track: this.track,
        roadGrip: this.theme.roadGrip,
        offGrip: this.theme.offGrip,
        weatherGrip: this.weatherGrip,
        realism: this.realism,
        assists: this.app.profile.settings.assists,
      };
    }
    return this._simEnv;
  }

  #nightLights() {
    if (!this.env.look.night) return;
    for (const c of this.cars) c.visual.addHeadlightBeams(this.shared);
    const pv = this.player.visual;
    const b = this.player.def.body;
    const spot = new THREE.SpotLight(0xfff1dc, 1600, 90, 0.55, 0.55, 2);
    spot.position.set(0, b.noseY, b.length / 2 - 0.2);
    spot.target.position.set(0, 0, 30);
    pv.body.add(spot, spot.target);
    if (this.tier.headlightShadows) {
      spot.castShadow = true;
      spot.shadow.mapSize.set(1024, 1024);
      spot.shadow.bias = -0.0005;
      spot.shadow.camera.near = 0.5;
      spot.shadow.camera.far = 90;
    }
    this.headlight = spot;
  }

  #reflections() {
    const size = this.tier.dynamicReflections;
    if (!size || this.tier.material === 0) return;
    const rt = new THREE.WebGLCubeRenderTarget(Math.min(size, this.app.gfx.caps.maxTexture), {
      type: THREE.HalfFloatType,
      generateMipmaps: false,
    });
    this.cubeRT = rt;
    this.cubeCam = new THREE.CubeCamera(0.5, 450, rt);
    this.scene.add(this.cubeCam);
    this.player.visual.paint.envMap = rt.texture;
    this.player.visual.paint.envMapIntensity = 1.25;
    this.player.visual.paint.needsUpdate = true;
    this.reflectionTimer = 0;
  }

  #hudAction(a) {
    if (a === 'pause') this.app.togglePause();
    else if (a === 'camera') this.cycleCamera();
    else if (a === 'respawn') this.respawnPlayer();
  }

  cycleCamera() {
    const m = this.raceCam.next();
    this.app.profile.setSetting('camera', this.raceCam.mode);
    this.hud.message(m.name, '', 0.8, 'small');
  }

  respawnPlayer() {
    if (this.state !== 'racing' || this.player.finished) return;
    this.#respawn(this.player);
    this.hud.message('بازگشت به مسیر', '', 0.8, 'small');
  }

  #respawn(car) {
    const v = car.vehicle;
    const p = this.track.pointAt(v.proj.s + 4, 0);
    v.reset(p.x, p.z, p.heading, p.y);
    v.hint = p.index;
    v.ghost = 2.5;
    v.step(0, this.#simEnv());
    car.lastS = v.proj.s;
    car.stuckTime = 0;
  }

  setPaused(p) {
    this.paused = p;
    this.app.input.setEnabled(!p && (this.state === 'countdown' || this.state === 'racing'));
  }

  // ---------------------------------------------------------------------------------------------
  update(rawDt) {
    if (this.state === 'loading') return;
    const dt = Math.min(0.1, rawDt) * this.timeScale;
    if (this.paused) return;
    this.clock += dt;
    this.stateTime += dt;
    this.frame++;
    const input = this.app.input;

    switch (this.state) {
      case 'intro':
        this.env.setCrowdExcitement(0.4);
        if (this.stateTime > 2.6) {
          this.state = 'countdown';
          this.stateTime = 0;
          this.raceCam.stopOrbit();
          this.countStep = -1;
          this.goAt = 3 + 0.25 + Math.random() * 0.6;
          input.setEnabled(true);
          input.calibrateTilt();
        }
        break;
      case 'countdown': {
        const step = Math.floor(this.stateTime);
        if (step !== this.countStep && step < 3) {
          this.countStep = step;
          this.hud.message(fa(3 - step), '', 0.9, 'count');
          this.app.audio.beep(false);
        }
        this.env.setStartLights(Math.min(5, Math.floor(this.stateTime / 0.6) + 1), false);
        this.env.setCrowdExcitement(0.6);
        if (this.stateTime >= this.goAt) {
          this.state = 'racing';
          this.stateTime = 0;
          this.time = 0;
          this.env.setStartLights(5, true);
          this.hud.message('حرکت!', '', 1, 'go');
          this.app.audio.beep(true);
          for (const c of this.cars) c.lapStart = 0;
        }
        break;
      }
      case 'racing':
      case 'finished':
        this.time += dt;
        if (this.state === 'finished') this.env.setCrowdExcitement(1);
        else this.env.setCrowdExcitement(0.25);
        break;
      default:
        break;
    }

    // ----- controls ----------------------------------------------------------------------------
    const pv = this.player.vehicle;
    const controls = input.update(dt, pv.speed);
    const started = this.state === 'racing' || this.state === 'finished';
    if (this.autopilot || this.player.finished) {
      // AI drives the player's car after the finish (and in automated tests)
    } else if (started) {
      Object.assign(pv.controls, controls);
    } else {
      pv.controls.throttle = controls.throttle;
      pv.controls.brake = 1;
      pv.controls.steer = 0;
    }

    // ----- simulation -----------------------------------------------------------------------------
    for (const v of this.vehicles) { v.impact = 0; v.scrape = 0; }
    if (started) this.#simulate(dt);
    else this.#idleEngines(dt);

    this.#raceLogic(dt);
    this.#visuals(dt);
  }

  #idleEngines(dt) {
    for (const c of this.cars) {
      const v = c.vehicle;
      const thr = c.isPlayer ? v.controls.throttle : 0.3 + 0.25 * Math.sin(this.clock * 3 + c.slot);
      const target = v.p.idleRpm + thr * (v.p.redline * 0.82 - v.p.idleRpm);
      v.rpm += (target - v.rpm) * Math.min(1, dt * 6);
      v.throttleOut = thr;
    }
  }

  #simulate(dt) {
    const h = 1 / this.tier.physicsHz;
    this.acc = Math.min(this.acc + dt, 0.1);
    const env = this.#simEnv();
    env.assists = this.app.profile.settings.assists;
    this.player.vehicle.assists = this.autopilot || this.player.finished ? 2 : undefined;
    const aiStep = 1 / 60;
    const playerProgress = this.player.progress;
    let steps = 0;
    while (this.acc >= h && steps < 400) {
      this.acc -= h;
      steps++;
      this.aiAcc += h;
      if (this.aiAcc >= aiStep) {
        this.#computeDrafting();
        for (const c of this.cars) {
          if (c.isPlayer && !this.autopilot && !c.finished) continue;
          c.ai.update(this.aiAcc, this.vehicles, {
            started: true,
            time: this.clock,
            raceTime: this.time,
            playerProgress,
            myProgress: c.progress,
          });
        }
        this.aiAcc = 0;
      }
      for (const v of this.vehicles) v.step(h, env);
      collideVehicles(this.vehicles);
      for (const c of this.cars) {
        collideWalls(c.vehicle, this.track);
        this.#trackProgress(c);
      }
    }
  }

  #computeDrafting() {
    const vs = this.vehicles;
    for (const a of vs) {
      let best = 0;
      if (a.speed > 15) {
        const fx = Math.sin(a.heading), fz = Math.cos(a.heading);
        for (const b of vs) {
          if (a === b) continue;
          const dx = b.x - a.x, dz = b.z - a.z;
          const fwd = dx * fx + dz * fz;
          if (fwd < 2 || fwd > 28) continue;
          const lat = Math.abs(dx * fz - dz * fx);
          if (lat > 2.2) continue;
          best = Math.max(best, (1 - fwd / 28) * (1 - lat / 2.2));
        }
      }
      a.draft = best;
    }
  }

  #trackProgress(c) {
    const v = c.vehicle;
    const L = this.track.length;
    const s = v.proj.s;
    if (c.lastS !== null) {
      let ds = s - c.lastS;
      if (ds < -L / 2) ds += L;
      else if (ds > L / 2) ds -= L;
      c.progress += ds;
    }
    c.lastS = s;
    if (c.finished) return;
    const laps = this.stage.laps;
    const lapNow = Math.floor(c.progress / L) + 1;
    if (lapNow > c.lap && c.progress > 0) {
      const lt = this.time - c.lapStart;
      c.lapTimes.push(lt);
      if (!c.bestLap || lt < c.bestLap) c.bestLap = lt;
      c.lapStart = this.time;
      c.lap = lapNow;
      if (c.lap > laps) {
        c.finished = true;
        c.finishTime = this.time;
        c.lap = laps;
        if (c.isPlayer) this.#playerFinished();
      } else if (c.isPlayer) {
        if (c.lap === laps) this.hud.message('دور آخر!', `زمان دور: ${formatTime(lt)}`, 1.8, 'lap');
        else this.hud.message(`دور ${fa(c.lap)}`, `زمان دور: ${formatTime(lt)}`, 1.5, 'lap');
      }
    }
  }

  #standings() {
    const arr = [...this.cars];
    arr.sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    arr.forEach((c, i) => (c.rank = i + 1));
    return arr;
  }

  #raceLogic(dt) {
    const standings = this.#standings();
    this.standings = standings;
    const p = this.player;
    const v = p.vehicle;
    if (this.state !== 'racing') return;
    // wrong way & stuck detection for the player
    const tdot = Math.sin(v.heading) * v.proj.tx + Math.cos(v.heading) * v.proj.tz;
    if (!p.finished) {
      if (tdot < -0.35 && v.speed > 3) p.wrongTime = (p.wrongTime || 0) + dt; else p.wrongTime = 0;
      if (p.wrongTime > 1.2 && this.hud.msgTimer <= 0) this.hud.message('مسیر اشتباه!', 'دور بزنید', 1, 'warn');
      if (v.speed < 1.5) p.stuckTime = (p.stuckTime || 0) + dt; else p.stuckTime = 0;
    }
    // AI cars that get hopelessly stuck are quietly recovered (never in front of the camera)
    for (const c of this.aiCars) {
      const av = c.vehicle;
      if (av.speed < 1) c.stuckTime = (c.stuckTime || 0) + dt; else c.stuckTime = 0;
      if (c.stuckTime > 6) {
        const d2 = (av.x - v.x) ** 2 + (av.z - v.z) ** 2;
        if (d2 > 900) this.#respawn(c);
      }
    }
  }

  #playerFinished() {
    const p = this.player;
    this.state = 'finished';
    this.stateTime = 0;
    this.app.input.setEnabled(false);
    this.autopilot = true;
    const standings = this.#standings();
    const rank = standings.indexOf(p) + 1;
    // results table: unfinished cars get an estimated time from their pace
    const L = this.track.length * this.stage.laps;
    const rows = standings.map((c, i) => {
      let time = c.finishTime;
      let estimated = false;
      if (!c.finished) {
        const pace = Math.max(8, c.progress / Math.max(1, this.time));
        time = this.time + Math.max(0, L - c.progress) / pace;
        estimated = true;
      }
      return { rank: i + 1, name: c.name, car: c.def.name, color: c.color, time, estimated, isPlayer: c.isPlayer, best: c.bestLap };
    });
    // keep the estimated part of the table monotonic
    for (let i = 1; i < rows.length; i++) if (rows[i].time < rows[i - 1].time) rows[i].time = rows[i - 1].time + 0.15;
    const reward = this.app.profile.recordRace(this.stageIndex, rank, p.finishTime);
    this.results = { rank, time: p.finishTime, bestLap: p.bestLap, rows, reward, stage: this.stage };
    this.hud.message(rank === 1 ? 'قهرمان شدید! 🏆' : `رتبه ${fa(rank)}`, 'پایان مسابقه', 3, 'finish');
    this.app.audio.fanfare(rank <= 3);
    const pv = p.vehicle;
    this.raceCam.startOrbit(new THREE.Vector3(pv.x, pv.proj.height, pv.z), 9, 2.6, 0.25);
    setTimeout(() => this.app.showResults(this.results), 2200);
  }

  // ---------------------------------------------------------------------------------------------
  #visuals(dt) {
    const app = this.app;
    const p = this.player.vehicle;
    const tier = this.tier;
    const camPos = this.camera.position;
    for (const c of this.cars) {
      const v = c.vehicle;
      c.visual.update(v, dt, this.realism, this.clock);
      // ghost flicker after a respawn
      c.visual.root.visible = v.ghost > 0 ? Math.floor(this.clock * 12) % 2 === 0 : true;
      const dist2 = (v.x - camPos.x) ** 2 + (v.z - camPos.z) ** 2;
      if (dist2 < 180 * 180) {
        this.#wheelPositions(c);
        this.effects.carEffects(c.id, v, c.wheels, dt, this.stage.weather, c.isPlayer);
        if (v.nitroActive && this.frame % 2 === 0) this.effects.exhaustFlash(this.#exhaustWorld(c), v, true);
      }
      if (v.shifted) {
        v.shifted = 0;
        if (c.isPlayer && v.rpm > v.p.redline * 0.8) {
          app.audio.backfire();
          this.effects.exhaustFlash(this.#exhaustWorld(c), v, false);
        }
      }
      if (v.impact > 3.5) {
        if (tier.realism.damage && dist2 < 120 * 120) c.visual.deform(v.impactX, v.impactZ, v.proj.height + 0.5, v.impact, this.clock);
        if (c.isPlayer) {
          app.audio.hit(v.impact);
          app.input.vibrate(Math.min(80, 15 + v.impact * 5));
          if (tier.realism.cameraShake) this.raceCam.addShake(Math.min(1, v.impact / 10));
          if (v.impact > 9) app.gfx.flash = Math.min(0.25, v.impact / 60);
        }
      }
    }
    // kerb rumble
    if (tier.realism.cameraShake && p.surface !== 0 && p.speed > 10) this.raceCam.addShake(p.surface === 1 ? 0.02 : 0.05);
    if (p.surface === 1 && p.speed > 8 && this.frame % 6 === 0) app.input.vibrate(6);
    this.effects.update(dt);

    // camera
    const lookBack = !!app.input.keys?.has('KeyB');
    this.raceCam.update(dt, p, { shake: tier.realism.cameraShake, reverseLook: lookBack, followCenter: this.state === 'finished' ? new THREE.Vector3(p.x, p.proj.height, p.z) : null });
    this.effects.setViewport(app.gfx.height * app.gfx.pixelRatio, this.camera.fov);
    this.env.update(dt, this.camera, this._focus || (this._focus = new THREE.Vector3()));
    this._focus.set(p.x + Math.sin(p.heading) * this.tier.shadowRange * 0.35, p.proj.height, p.z + Math.cos(p.heading) * this.tier.shadowRange * 0.35);

    // dynamic reflections on the player's car
    if (this.cubeCam && (this.reflectionTimer = this.reflectionTimer - 1) <= 0) {
      this.reflectionTimer = tier.reflectionInterval;
      const vis = this.player.visual.root;
      vis.visible = false;
      this.cubeCam.position.set(p.x, p.proj.height + 0.9, p.z);
      // the probe skips small scenery (layer) and reuses this frame's shadow map
      const sm = app.gfx.renderer.shadowMap;
      const auto = sm.autoUpdate;
      sm.autoUpdate = false;
      this.cubeCam.update(app.gfx.renderer, this.scene);
      sm.autoUpdate = auto;
      this.cubeRT.texture.needsPMREMUpdate = true;
      vis.visible = true;
    }

    // speed blur
    app.gfx.speedBlur = tier.motionBlur > 0 ? clamp((p.speed - 28) / 70, 0, 1) * 0.055 + (p.nitroActive ? 0.03 : 0) : 0;

    // audio
    app.audio.updateRace(p, this.aiCars.map((c) => c.vehicle), p);

    // HUD
    const s = app.profile.settings;
    const speed = p.speed * (s.units === 'mph' ? 2.23694 : MS_TO_KMH);
    const pc = this.player;
    const hudState = {
      rank: pc.rank,
      lap: pc.lap,
      laps: this.stage.laps,
      time: this.state === 'racing' || this.state === 'finished' ? (pc.finished ? pc.finishTime : this.time) : 0,
      bestLap: pc.bestLap,
      speed,
      units: s.units,
      rpm: p.rpm,
      redline: p.p.redline,
      gear: p.gear,
      nitro: p.nitroLevel,
      nitroActive: p.nitroActive,
      stuck: this.state === 'racing' && (pc.stuckTime > 3 || pc.wrongTime > 3),
      fps: s.showFps ? app.fps : 0,
    };
    if (this.frame % 3 === 0) {
      hudState.mapCars = this.cars.map((c) => ({ x: c.vehicle.x, z: c.vehicle.z, heading: c.vehicle.heading, color: c.color, player: c.isPlayer }));
      if (this.standings) hudState.board = this.#board();
    }
    this.hud.update(dt, hudState);
  }

  #board() {
    const st = this.standings;
    const me = st.indexOf(this.player);
    const from = clamp(me - 2, 0, st.length - 5);
    const rows = [];
    const pv = this.player.progress;
    for (let i = from; i < Math.min(st.length, from + 5); i++) {
      const c = st[i];
      let gap = '';
      if (!c.isPlayer) {
        const dm = c.progress - pv;
        const sec = Math.abs(dm) / Math.max(10, this.player.vehicle.speed || 10);
        gap = `${dm > 0 ? '+' : '-'}${fa(sec.toFixed(1))}`;
      }
      rows.push({ rank: i + 1, name: c.name, gap, player: c.isPlayer });
    }
    return rows;
  }

  #wheelPositions(c) {
    const v = c.vehicle;
    const b = c.def.body;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const lx = fz, lz = -fx;
    const off = (v.a - v.b) / 2;
    const th = b.width / 2 - b.wheelWidth / 2;
    const y = v.proj.height;
    const zs = [b.wheelbase / 2 + off, b.wheelbase / 2 + off, -b.wheelbase / 2 + off, -b.wheelbase / 2 + off];
    const xs = [th, -th, th, -th];
    for (let k = 0; k < 4; k++) c.wheels[k].set(v.x + fx * zs[k] + lx * xs[k], y, v.z + fz * zs[k] + lz * xs[k]);
  }

  #exhaustWorld(c) {
    const v = c.vehicle;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const lx = fz, lz = -fx;
    const off = (v.a - v.b) / 2;
    return c.visual.model.exhaustPoints.map((e) => ({
      x: v.x + fx * (e.z + off - 0.2) + lx * e.x,
      y: v.proj.height + e.y,
      z: v.z + fz * (e.z + off - 0.2) + lz * e.x,
    }));
  }

  // -- testing helpers --------------------------------------------------------------------------
  /** Lets the AI drive the player's car (used by automated tests / attract mode). */
  setAutopilot(on) {
    this.autopilot = on;
  }

  dispose() {
    this.app.audio.stopRace();
    this.hud?.dispose();
    for (const c of this.cars) c.visual.dispose();
    this.effects?.dispose();
    this.env?.dispose();
    if (this.shared) for (const m of Object.values(this.shared)) m.dispose?.();
    this.cubeRT?.dispose();
    this.headlight?.shadow?.map?.dispose();
    this.scene.clear();
  }
}
