import * as THREE from 'three';
import { buildCar, poseWalk, poseIdle, box, cyl } from './models.js';
import { TrafficCar } from './traffic.js';
import { Walker } from './people.js';
import { clamp, damp, dampAngle, wrapAngle, faMoney, collideCircle, pick, canvasTexture, boxCol, circleCol } from './util.js';

const ANGRY = [
  'هوی! چیکار کردی؟! ماشینمو داغون کردی!',
  'مگه کوری؟! ببین چه بلایی سر ماشینم آوردی!',
  'خسارتمو باید بدی، همین الان!',
  'گواهینامه‌تو از کجا گرفتی آخه؟!',
  'تا پول خسارتمو ندی نمی‌ذارم بری!',
];
const _res = { nx: 0, nz: 0, pen: 0 };
const OFFS = [-1.45, 0, 1.45];

export class Police {
  constructor(game) {
    this.game = game;
    this.state = 'none';
    const tpl = buildCar({ type: 'police', color: 0xf7f7f7 });
    this.tpl = tpl;
    this.unit = new TrafficCar(game.traffic, tpl.root);
    this.unit.isPolice = true;
    this.sirenMats = tpl.sirenMats;
    this.light = new THREE.PointLight(0xff2020, 0, 40, 1.6);
    game.scene.add(this.light);
    this.path = [];
    this.inc = null;
    this.fine = 0;
    this.jail = new Jail(game);
  }

  /* ---------------- incident ---------------- */
  startIncident(car, impact) {
    const g = this.game;
    if (this.state !== 'none' || g.state !== 'play') return;
    const amount = Math.round((90000 + impact * 32000) / 10000) * 10000;
    car.state = 'incident';
    const w = new Walker(g.scene, { female: Math.random() < 0.3 });
    w.setPos(car.pos.x + Math.cos(car.heading) * 1.5, car.pos.z - Math.sin(car.heading) * 1.5, car.heading);
    this.inc = { car, amount, walker: w, t: 0, spot: car.pos.clone(), shout: 0, phase: 'approach' };
    this.state = 'incident';
    g.ui.showIncident(amount, g.wallet() >= amount, () => this.pay(), () => this.refuse('refuse'));
    g.ui.say('راننده عصبانی', pick(ANGRY), { mood: 'grumpy' });
    g.audio.speak('هوی! چیکار کردی؟');
  }
  pay() {
    const g = this.game, inc = this.inc;
    if (!inc) return;
    g.topUp(inc.amount);
    if (g.money < inc.amount) {
      g.ui.toast('پول کافی نداری! 😟', 'warn');
      g.audio.bad();
      return;
    }
    g.money -= inc.amount;
    g.audio.cash();
    g.ui.hideIncident();
    g.ui.say('راننده', 'باشه... این دفعه رو بخشیدم. مواظب باش!', { mood: 'normal' });
    g.ui.toast(`خسارت پرداخت شد: ${faMoney(inc.amount)} تومان`, 'info');
    this.walkBack();
    this.state = 'none';
    g.save();
  }
  walkBack() {
    const inc = this.inc;
    if (!inc) return;
    const w = inc.walker, car = inc.car;
    w.mode = 'idle';
    w.face = null;
    w.walkTo(car.pos.x + Math.cos(car.heading) * 1.5, car.pos.z - Math.sin(car.heading) * 1.5, 1.3, () => {
      w.dispose();
      car.state = 'drive';
    });
    this.leaving = w;
    this.inc = null;
  }
  refuse(reason) {
    const g = this.game, inc = this.inc;
    if (!inc) return;
    g.ui.hideIncident();
    this.fine = inc.amount + 250000;
    const w = inc.walker;
    w.mode = 'phone';
    w.target = null;
    g.ui.say('راننده عصبانی', reason === 'fled' ? 'داره فرار می‌کنه! الو پلیس؟ یه تاکسی زد به ماشینم و در رفت!' : 'باشه! زنگ می‌زنم پلیس! 📞 الو، ۱۱۰؟', { mood: 'grumpy' });
    g.audio.speak('الو پلیس؟');
    this.state = 'dispatch';
    this.dispatchT = 6;
    this.phoneT = 5;
  }

  /** someone called the police (arson etc.) */
  report(fine, msg) {
    const g = this.game;
    if (this.state === 'chase' || this.state === 'dispatch') {
      this.fine += fine;
      g.ui.toast(msg, 'bad');
      return;
    }
    if (this.state !== 'none') return;
    this.fine = fine;
    this.inc = null;
    this.state = 'dispatch';
    this.dispatchT = 7;
    g.ui.toast(msg, 'bad');
  }

  /* ---------------- chase ---------------- */
  spawnUnit() {
    const g = this.game, w = g.world, p = g.player.pos;
    const u = this.unit;
    let best = null;
    for (let k = 0; k < 60; k++) {
      const rs = w.randomRoadside(p, 170, 280, false);
      if (!rs) continue;
      // prefer behind the player
      const behind = (rs.roadX - p.x) * Math.sin(g.player.heading) + (rs.roadZ - p.z) * Math.cos(g.player.heading);
      if (!best || behind < best.behind) best = { rs, behind };
      if (behind < -50) break;
    }
    const rs = best.rs;
    u.pos.set(rs.roadX, 0, rs.roadZ);
    u.heading = Math.atan2(p.x - rs.roadX, p.z - rs.roadZ);
    u.speed = 10;
    u.active = true;
    u.state = 'drive';
    u.group.visible = true;
    u.knock.set(0, 0);
    this.path = [];
    this.repath = 0;
    this.stuckT = 0;
    this.reverseT = 0;
    this.stuckCount = 0;
    this.arrestT = 0;
    this.escapeT = 0;
    this.flash = 0;
  }
  despawnUnit() {
    this.unit.active = false;
    this.unit.group.visible = false;
    this.light.intensity = 0;
    this.game.audio.siren(false);
  }
  chase(dt) {
    const g = this.game, pl = g.focus(), u = this.unit, w = g.world;
    const dx = pl.pos.x - u.pos.x, dz = pl.pos.z - u.pos.z;
    const d = Math.hypot(dx, dz);
    this.repath -= dt;
    let tx, tz;
    if (d > 55) {
      if (this.repath <= 0 || !this.path.length) {
        this.path = w.route(u.pos.x, u.pos.z, pl.pos.x, pl.pos.z);
        this.repath = 1.4;
      }
      while (this.path.length > 1 && Math.hypot(this.path[0].x - u.pos.x, this.path[0].z - u.pos.z) < 10) this.path.shift();
      tx = this.path[0].x;
      tz = this.path[0].z;
    } else {
      tx = pl.pos.x + Math.sin(pl.heading) * pl.speed * 0.5;
      tz = pl.pos.z + Math.cos(pl.heading) * pl.speed * 0.5;
    }
    const err = wrapAngle(Math.atan2(tx - u.pos.x, tz - u.pos.z) - u.heading);
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      u.speed = damp(u.speed, -6, 3, dt);
      u.heading -= clamp(err * 2, -1, 1) * dt;
    } else {
      let target = d > 55 ? 46 : Math.max(9, Math.abs(pl.speed) + 7);
      if (Math.abs(err) > 1.1) target = Math.min(target, 10);
      u.speed += clamp(target - u.speed, -10 * dt, 7.5 * dt);
      const maxRate = Math.abs(u.speed) / 5 + 0.5;
      u.heading += clamp(err * 3, -maxRate, maxRate) * dt;
    }
    const fx = Math.sin(u.heading), fz = Math.cos(u.heading);
    u.pos.x += (fx * u.speed + u.knock.x) * dt;
    u.pos.z += (fz * u.speed + u.knock.y) * dt;
    u.knock.x = damp(u.knock.x, 0, 3, dt);
    u.knock.y = damp(u.knock.y, 0, 3, dt);
    const q = this._q || (this._q = []);
    for (const off of OFFS) {
      const cx = u.pos.x + fx * off, cz = u.pos.z + fz * off;
      w.statics.query(cx, cz, 2, q);
      for (const o of q) {
        if (o.soft || !collideCircle(cx, cz, 0.95, o, _res)) continue;
        u.pos.x += _res.nx * _res.pen;
        u.pos.z += _res.nz * _res.pen;
        u.speed *= 0.85;
      }
    }
    if (Math.abs(u.speed) < 1.5 && d > 14 && this.reverseT <= 0) {
      this.stuckT += dt;
      if (this.stuckT > 2.2) {
        this.reverseT = 1.3;
        this.stuckT = 0;
        if (++this.stuckCount > 4) {
          this.spawnUnit();
          return;
        }
      }
    } else this.stuckT = 0;
    u.sync(dt);
    // light bar & siren
    this.flash += dt;
    const ph = Math.floor(this.flash / 0.14) % 2;
    this.sirenMats[0].emissiveIntensity = ph ? 4 : 0.2;
    this.sirenMats[1].emissiveIntensity = ph ? 0.2 : 4;
    this.light.position.set(u.pos.x, u.group.position.y + 2.4, u.pos.z);
    this.light.color.setHex(ph ? 0xff2020 : 0x2050ff);
    this.light.intensity = 60;
    g.audio.siren(true, clamp(1 - d / 500, 0.15, 1));
    // arrest / escape
    const sp = Math.abs(pl.speed);
    const car = g.player;
    if ((d < (pl.onFoot ? 6 : 9) && sp < (pl.onFoot ? 5 : 2.5)) || (!pl.onFoot && (car.health <= 0 || car.fuelTotal() <= 0) && d < 60)) this.arrestT += dt;
    else this.arrestT = Math.max(0, this.arrestT - dt * 0.5);
    if (d > 420) this.escapeT += dt;
    else this.escapeT = Math.max(0, this.escapeT - dt * 2);
    g.ui.setWanted(true, this.arrestT / 1.6, this.escapeT / 15);
    if (this.arrestT > 1.6) this.startArrest();
    else if (this.escapeT > 15) {
      this.despawnUnit();
      this.state = 'none';
      g.ui.setWanted(false);
      g.ui.toast('🎉 پلیس رو گم کردی! ولی حواست باشه...', 'good');
      g.stats.escapes = (g.stats.escapes || 0) + 1;
    }
  }

  update(dt) {
    const g = this.game;
    if (this.leaving) {
      this.leaving.update(dt, g.world);
      if (!this.leaving.root.parent) this.leaving = null;
    }
    if (this.state === 'incident') {
      const inc = this.inc, w = inc.walker, pl = g.player;
      inc.t += dt;
      const side = { x: pl.pos.x + Math.cos(pl.heading) * 2, z: pl.pos.z - Math.sin(pl.heading) * 2 };
      const dd = Math.hypot(w.pos.x - side.x, w.pos.z - side.z);
      if (dd > 1.2) {
        if (!w.target || Math.hypot(w.target.x - side.x, w.target.z - side.z) > 0.8) w.walkTo(side.x, side.z, 2.2);
      } else {
        w.mode = 'angry';
        w.lookAt(pl.pos.x, pl.pos.z);
      }
      inc.shout -= dt;
      if (inc.shout <= 0 && dd < 4) {
        inc.shout = 5;
        g.ui.say('راننده عصبانی', pick(ANGRY), { mood: 'grumpy' });
      }
      w.update(dt, g.world);
      if (Math.hypot(pl.pos.x - inc.spot.x, pl.pos.z - inc.spot.z) > 55) this.refuse('fled');
      else if (inc.t > 40) this.refuse('timeout');
      return;
    }
    if (this.state === 'dispatch') {
      const inc = this.inc;
      if (inc) {
        inc.walker.update(dt, g.world);
        this.phoneT -= dt;
        if (this.phoneT <= 0) this.walkBack();
      }
      this.dispatchT -= dt;
      if (this.dispatchT <= 0) {
        if (this.inc) this.walkBack();
        this.spawnUnit();
        this.state = 'chase';
        g.ui.toast('🚨 پلیس دنبالته! یا فرار کن یا وایسا تسلیم شو', 'bad');
      }
      return;
    }
    if (this.state === 'chase') this.chase(dt);
    if (this.state === 'arrest') this.updateArrest(dt);
    if (this.state === 'jail') this.jail.update(dt);
  }

  /* ---------------- arrest cutscene ---------------- */
  startArrest() {
    const g = this.game;
    this.state = 'arrest';
    g.state = 'cutscene';
    g.ui.setWanted(false);
    g.ui.hideIncident();
    g.ui.setHud(false);
    g.ui.toast('🚔 دستگیر شدی!', 'bad');
    if (g.rides.ride || g.rides.state === 'offer') g.rides.cancel('مسافر ترسید و پیاده شد...', true);
    this.step = -1;
    if (g.arson) g.arson.clearVictim();
    g.fade(1, 0.45, () => {
      g.onfoot.instantIn();
      this.setupArrest();
    });
  }
  setupArrest() {
    const g = this.game, pl = g.player, u = this.unit;
    pl.speed = 0;
    pl.ext.set(0, 0);
    const fx = Math.sin(pl.heading), fz = Math.cos(pl.heading);
    u.pos.set(pl.pos.x - fx * 8, 0, pl.pos.z - fz * 8);
    u.heading = pl.heading;
    u.speed = 0;
    u.knock.set(0, 0);
    u.sync(0);
    this.officer = new Walker(g.scene, { female: false, shirt: 0x34503a, pants: 0x2a3a2a, cap: 0x34503a, uniform: true, mustache: true, skin: 0xe0ac86 });
    const lx = Math.cos(u.heading), lz = -Math.sin(u.heading);
    this.officer.setPos(u.pos.x + lx * 1.5 + fx * 0.6, u.pos.z + lz * 1.5 + fz * 0.6, u.heading);
    this.step = 0;
    this.t = 0;
    g.cinematic = true;
    g.fade(0, 0.6);
    g.ui.cinema(true, 'پلیس: «از ماشین پیاده شو! دستا بالا!»');
    g.audio.speak('از ماشین پیاده شو! دستا بالا!');
  }
  updateArrest(dt) {
    const g = this.game, pl = g.player, u = this.unit;
    if (this.step < 0) return;
    this.t += dt;
    const fx = Math.sin(pl.heading), fz = Math.cos(pl.heading);
    const lx = Math.cos(pl.heading), lz = -Math.sin(pl.heading);
    const off = this.officer;
    off.update(dt, g.world);
    if (this.prisoner) this.prisoner.update(dt, g.world);
    // flashing lights continue
    this.flash += dt;
    const ph = Math.floor(this.flash / 0.14) % 2;
    this.sirenMats[0].emissiveIntensity = ph ? 4 : 0.2;
    this.sirenMats[1].emissiveIntensity = ph ? 0.2 : 4;
    this.light.position.set(u.pos.x, u.group.position.y + 2.4, u.pos.z);
    this.light.color.setHex(ph ? 0xff2020 : 0x2050ff);
    const doorOut = { x: pl.pos.x + lx * 1.9 + fx * 0.2, z: pl.pos.z + lz * 1.9 + fz * 0.2 };
    const pRear = { x: u.pos.x + lx * 1.8 - fx * 0.6, z: u.pos.z + lz * 1.8 - fz * 0.6 };
    if (this.step === 0) {
      if (off.mode !== 'walk' && this.t < 0.3) off.walkTo(doorOut.x + fx * 1.2 + lx * 0.4, doorOut.z + fz * 1.2 + lz * 0.4, 1.6, () => {
        this.step = 1;
        this.t = 0;
        off.lookAt(pl.pos.x, pl.pos.z);
        pl.car.doors.fl.target = 1;
        g.audio.door();
      });
    } else if (this.step === 1 && this.t > 0.8) {
      pl.driver.root.visible = false;
      this.prisoner = new Walker(g.scene, g.driverLook);
      this.prisoner.setPos(doorOut.x, doorOut.z, pl.heading + Math.PI / 2);
      this.prisoner.handsUp = true;
      this.prisoner.mode = 'idle';
      g.ui.cinema(true, 'تو: «باشه باشه... تسلیمم!»');
      this.step = 2;
      this.t = 0;
    } else if (this.step === 2 && this.t > 1.0) {
      this.prisoner.walkTo(pRear.x, pRear.z, 1.0, () => {
        this.step = 4;
        this.t = 0;
        this.prisoner.dispose();
        g.audio.door();
        off.walkTo(u.pos.x + lx * 1.5 + fx * 0.6, u.pos.z + lz * 1.5 + fz * 0.6, 1.5, () => {
          off.dispose();
          this.step = 5;
          this.t = 0;
          g.ui.cinema(true, 'ماشین پلیس به سمت کلانتری حرکت کرد...');
        });
      });
      this.step = 3;
      pl.car.doors.fl.target = 0;
    } else if (this.step === 3) {
      // officer escorts behind the prisoner
      const pr = this.prisoner;
      const hx = Math.sin(pr.heading), hz = Math.cos(pr.heading);
      const tx = pr.pos.x - hx * 1.1 + Math.cos(pr.heading) * 0.3, tz = pr.pos.z - hz * 1.1;
      if (Math.hypot(off.pos.x - tx, off.pos.z - tz) > 0.4) off.walkTo(tx, tz, 1.25);
    } else if (this.step === 5) {
      u.speed = Math.min(12, u.speed + dt * 4);
      u.pos.x += Math.sin(u.heading) * u.speed * dt;
      u.pos.z += Math.cos(u.heading) * u.speed * dt;
      u.sync(dt);
      if (this.t > 3.2 && !this.fading) {
        this.fading = true;
        g.fade(1, 0.9, () => {
          this.fading = false;
          this.despawnUnit();
          this.state = 'jail';
          g.ui.cinema(false);
          g.startJail();
          this.jail.start(10);
        });
      }
    }
    // camera
    const mx = (pl.pos.x + u.pos.x) / 2, mz = (pl.pos.z + u.pos.z) / 2;
    const cam = g.camera;
    const target = this.step >= 5 ? u.pos : { x: mx, z: mz };
    const desired = new THREE.Vector3(mx + lx * 11 + fx * 4, g.world.heightAt(mx, mz) + 3.4, mz + lz * 11 + fz * 4);
    cam.position.lerp(desired, 1 - Math.exp(-3 * dt));
    cam.lookAt(target.x, g.world.heightAt(target.x, target.z) + 1.1, target.z);
  }
  arrestDone() {
    const g = this.game;
    g.topUp(this.fine);
    const paid = Math.min(g.money, this.fine);
    g.money -= paid;
    this.state = 'none';
    return paid;
  }
}

/* =========================================================
   Jail: a real prison you walk around in (third/first person)
   ========================================================= */
const FLAT = { heightAt: () => 0 };
const JUMP = { shirt: 0xd9792b, pants: 0xd9792b };
class Jail {
  constructor(game) {
    this.game = game;
    const s = (this.scene = new THREE.Scene());
    s.background = new THREE.Color(0x8fb4d8);
    s.fog = new THREE.Fog(0x8fb4d8, 40, 120);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.05, 300);
    this.cols = [];
    const tex = (base, lines) => canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2500; i++) {
        g.fillStyle = `rgba(0,0,0,${Math.random() * 0.1})`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      if (lines) {
        g.strokeStyle = 'rgba(0,0,0,0.18)';
        g.lineWidth = 2;
        for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      }
    }, { repeat: [1, 1] });
    const conc = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex('#9a958c', true), roughness: 0.95 });
    conc.map.repeat.set(4, 1);
    const floorM = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex('#7f7b74', false), roughness: 1 });
    floorM.map.repeat.set(12, 10);
    const metal = new THREE.MeshStandardMaterial({ color: 0x3c3f44, metalness: 0.8, roughness: 0.35 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4e34, roughness: 0.9 });
    const white = new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.5 });
    const paint = new THREE.MeshStandardMaterial({ color: 0xd8d2b0, roughness: 0.8 });
    const solid = (w, h, d, mat, x, y, z, collide = true) => {
      const m = box(w, h, d, mat, x, y, z, s);
      m.castShadow = m.receiveShadow = true;
      if (collide) this.cols.push(boxCol(x, z, w / 2, d / 2, 0));
      return m;
    };
    // ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(46, 36), floorM);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1 }));
    outside.rotation.x = -Math.PI / 2;
    outside.position.y = -0.02;
    s.add(outside);
    // basketball court paint
    const court = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), new THREE.MeshStandardMaterial({ color: 0x5a7a9a, roughness: 0.9 }));
    court.rotation.x = -Math.PI / 2;
    court.position.set(8, 0.01, 10);
    s.add(court);
    // perimeter walls with barbed wire
    solid(46, 6, 1, conc, 0, 3, -17.5);
    solid(46, 6, 1, conc, 0, 3, 17.5);
    solid(1, 6, 36, conc, -22.5, 3, 0);
    solid(1, 6, 36, conc, 22.5, 3, 0);
    for (const [x, z, w, d] of [[0, -17.5, 46, 0.2], [0, 17.5, 46, 0.2], [-22.5, 0, 0.2, 36], [22.5, 0, 0.2, 36]]) {
      const wire = box(w, 0.25, d, metal, x, 6.4, z, s);
      void wire;
    }
    // main gate (closed bars) in the south wall
    for (let i = 0; i < 12; i++) cyl(0.05, 0.05, 4.5, metal, 6, s).position.set(-2.75 + i * 0.5, 2.25, 17.0);
    box(6, 0.2, 0.2, metal, 0, 4.5, 17.0, s);
    // cell block along the north wall
    const cellX = [-16, -8, 0, 8, 16];
    for (const x of [-20, -12, -4, 4, 12, 20]) solid(0.4, 4.2, 7, conc, x, 2.1, -13.5);
    solid(2, 4.2, 0.4, conc, -21, 2.1, -10);
    solid(2, 4.2, 0.4, conc, 21, 2.1, -10);
    const roof = box(46, 0.4, 8.2, conc, 0, 4.4, -13.4, s);
    roof.castShadow = true;
    this.cellLights = [];
    cellX.forEach((cx, ci) => {
      // bars with an open door
      for (let bx = cx - 3.8; bx <= cx + 3.8; bx += 0.32) {
        if (Math.abs(bx - cx) < 0.85) continue;
        cyl(0.03, 0.03, 4.2, metal, 6, s).position.set(bx, 2.1, -10);
      }
      box(7.8, 0.12, 0.12, metal, cx, 4.15, -10, s);
      box(7.8, 0.12, 0.12, metal, cx, 0.06, -10, s);
      this.cols.push(boxCol((cx - 3.8 + cx - 0.85) / 2, -10, (3.8 - 0.85) / 2, 0.12, 0));
      this.cols.push(boxCol((cx + 0.85 + cx + 3.8) / 2, -10, (3.8 - 0.85) / 2, 0.12, 0));
      // open door swung into the yard
      const door = new THREE.Group();
      door.position.set(cx - 0.85, 0, -10);
      door.rotation.y = -1.3;
      for (let k = 0; k < 6; k++) cyl(0.03, 0.03, 4.0, metal, 6, door).position.set(0.15 + k * 0.28, 2.05, 0);
      box(1.7, 0.1, 0.08, metal, 0.85, 3.9, 0, door);
      box(1.7, 0.1, 0.08, metal, 0.85, 0.2, 0, door);
      s.add(door);
      // furniture
      solid(1.0, 0.45, 2.1, metal, cx - 2.9, 0.25, -15.6);
      box(0.95, 0.15, 2.0, new THREE.MeshStandardMaterial({ color: ci === 2 ? 0x55708a : 0x6a6a5a, roughness: 1 }), cx - 2.9, 0.55, -15.6, s);
      box(0.6, 0.12, 0.45, white, cx - 2.9, 0.68, -16.35, s);
      const t = cyl(0.22, 0.18, 0.45, white, 12, s);
      t.position.set(cx + 3.1, 0.23, -16.4);
      this.cols.push(circleCol(cx + 3.1, -16.4, 0.3));
      box(0.5, 0.1, 0.35, white, cx + 3.2, 0.95, -15.2, s);
      if (ci % 2 === 0) {
        const l = new THREE.PointLight(0xffe2b0, 6, 9, 1.4);
        l.position.set(cx, 3.6, -13.5);
        s.add(l);
        this.cellLights.push(l);
      }
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
      bulb.position.set(cx, 4.1, -13.5);
      s.add(bulb);
    });
    // cell number signs
    cellX.forEach((cx, i) => {
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: canvasTexture(128, 64, (g) => { g.fillStyle = '#e8e2c8'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#222'; g.font = 'bold 40px Vazirmatn, Tahoma, sans-serif'; g.textAlign = 'center'; g.fillText('سلول ' + '۱۲۳۴۵'[i], 64, 46); }) }));
      sg.position.set(cx + 2.5, 3.6, -9.85);
      s.add(sg);
    });
    // yard: basketball hoop, benches, weights, guard tower
    cyl(0.1, 0.1, 3.2, metal, 8, s).position.set(8, 1.6, 15.6);
    this.cols.push(circleCol(8, 15.6, 0.2));
    box(1.8, 1.1, 0.08, white, 8, 3.4, 15.3, s);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.02, 6, 20), new THREE.MeshStandardMaterial({ color: 0xff5a1a }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(8, 3.05, 14.95);
    s.add(ring);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd8641a, roughness: 0.7 }));
    ball.position.set(6, 0.12, 9);
    ball.castShadow = true;
    s.add(ball);
    for (const [x, z] of [[-14, 3], [-14, 8], [15, 0]]) {
      solid(3, 0.12, 0.6, wood, x, 0.48, z);
      box(0.15, 0.45, 0.5, metal, x - 1.3, 0.22, z, s);
      box(0.15, 0.45, 0.5, metal, x + 1.3, 0.22, z, s);
    }
    solid(1.6, 0.4, 0.5, metal, -6, 0.4, 12);
    const bar = cyl(0.03, 0.03, 1.8, metal, 6, s);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(-6, 0.85, 12);
    for (const x of [-6.8, -5.2]) { const w = cyl(0.2, 0.2, 0.08, metal, 14, s); w.rotation.z = Math.PI / 2; w.position.set(x, 0.85, 12); }
    solid(2.4, 8, 2.4, conc, 19.5, 4, 14.5);
    box(3.4, 2.2, 3.4, paint, 19.5, 9.1, 14.5, s);
    box(3.8, 0.3, 3.8, metal, 19.5, 10.3, 14.5, s);
    // painted line & sign
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshBasicMaterial({ map: canvasTexture(512, 100, (g) => { g.fillStyle = '#123'; g.fillRect(0, 0, 512, 100); g.fillStyle = '#fff'; g.font = 'bold 60px Vazirmatn, Tahoma, sans-serif'; g.textAlign = 'center'; g.fillText('زندان مرکزی شهر', 256, 72); }) }));
    sign.position.set(0, 5.1, 16.95);
    sign.rotation.y = Math.PI;
    s.add(sign);
    // light
    this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5a5040, 0.7);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2dd, 2.5);
    this.sun.castShadow = game.settings.quality !== 'low';
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -26;
    sc.right = sc.top = 26;
    sc.near = 1;
    sc.far = 120;
    this.sun.shadow.bias = -0.0005;
    s.add(this.sun, this.sun.target);
    // people
    this.player = new Walker(s, { ...game.driverLook, ...JUMP });
    this.mates = [];
    for (let i = 0; i < 4; i++) {
      const w = new Walker(s, { female: false, ...JUMP, mustache: Math.random() < 0.6 });
      w.setPos(-15 + i * 9, 4 + (i % 2) * 6);
      w.wait = Math.random() * 3;
      this.mates.push(w);
    }
    this.guard = new Walker(s, { female: false, shirt: 0x34503a, pants: 0x2a3a2a, cap: 0x34503a, uniform: true, mustache: true });
    this.guard.setPos(0, 15.6, Math.PI);
    this._r = { nx: 0, nz: 0, pen: 0 };
  }
  start(days) {
    const g = this.game;
    this.days = days;
    this.t = 0;
    this.dayLen = 6;
    this.speed = 1;
    this.done = false;
    this.player.setPos(0, -13.5, 0);
    this.player.mode = 'idle';
    this.yaw = 0;
    g.lookYaw = 0;
    g.lookPitch = 0;
    this.camInit = true;
    document.body.classList.add('injail', 'onfoot');
    g.ui.setHud(true);
    g.ui.showJail(true);
    g.ui.toast('🔒 ۱۰ روز زندان! می‌تونی توی سلول و حیاط زندان راه بری', 'bad');
  }
  collide(w, r) {
    for (const o of this.cols) {
      if (!collideCircle(w.pos.x, w.pos.z, r, o, this._r)) continue;
      w.pos.x += this._r.nx * this._r.pen;
      w.pos.z += this._r.nz * this._r.pen;
    }
  }
  update(dt) {
    if (this.done) return;
    const g = this.game;
    this.t += dt * this.speed;
    const day = Math.min(this.days, 1 + Math.floor(this.t / this.dayLen));
    const frac = (this.t % this.dayLen) / this.dayLen;
    const hour = 6 + frac * 16; // visible part of each day: 06:00 -> 22:00
    const sunH = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const ang = ((hour - 6) / 12) * Math.PI;
    this.sun.position.set(Math.cos(ang) * 40, 10 + Math.sin(ang) * 40, 15);
    this.sun.intensity = 0.3 + sunH * 2.6;
    this.hemi.intensity = 0.35 + sunH * 0.5;
    const sky = new THREE.Color(0x1a2240).lerp(new THREE.Color(0x8fb4d8), Math.min(1, sunH * 1.6));
    this.scene.background.copy(sky);
    this.scene.fog.color.copy(sky);
    for (const l of this.cellLights) l.intensity = sunH > 0.4 ? 3 : 8;
    g.ui.setJail(day, this.days, frac);

    // player movement (same controls as walking in the city)
    const inp = g.ui.input();
    const w = this.player;
    const cy = this.yaw + g.lookYaw;
    const mag = Math.min(1, Math.hypot(inp.moveX, inp.moveY));
    let spd = 0;
    if (mag > 0.12) {
      const fx = Math.sin(cy), fz = Math.cos(cy);
      const dx = fx * inp.moveY - fz * inp.moveX, dz = fz * inp.moveY + fx * inp.moveX;
      const l = Math.hypot(dx, dz);
      spd = (inp.run || mag > 0.92 ? 4.2 : 1.8) * Math.max(0.4, mag);
      w.heading = dampAngle(w.heading, Math.atan2(dx, dz), 10, dt);
      w.pos.x += (dx / l) * spd * dt;
      w.pos.z += (dz / l) * spd * dt;
      poseWalk(w.p, dt, spd);
    } else {
      w.t += dt;
      poseIdle(w.p, w.t);
    }
    this.collide(w, 0.35);
    for (const m of [...this.mates, this.guard]) {
      const dx = w.pos.x - m.pos.x, dz = w.pos.z - m.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.7 && d > 1e-4) {
        w.pos.x += (dx / d) * (0.7 - d);
        w.pos.z += (dz / d) * (0.7 - d);
      }
    }
    w.root.position.set(w.pos.x, 0.02, w.pos.z);
    w.root.rotation.y = w.heading;
    w.p.head.visible = g.camMode !== 'first';

    // other prisoners wander around the yard; the guard watches you
    for (const m of this.mates) {
      if (m.mode !== 'walk') {
        m.wait -= dt;
        if (m.wait <= 0) {
          m.wait = 2 + Math.random() * 5;
          m.walkTo(-19 + Math.random() * 38, -7 + Math.random() * 22, 1.1 + Math.random() * 0.4);
        }
      }
      m.update(dt, FLAT);
      this.collide(m, 0.35);
    }
    this.guard.lookAt(w.pos.x, w.pos.z);
    this.guard.update(dt, FLAT);

    // camera
    const cam = this.camera;
    const base = w.root.position;
    if (g.camMode === 'first') {
      cam.position.set(base.x + Math.sin(w.heading) * 0.1, 1.66, base.z + Math.cos(w.heading) * 0.1);
      cam.rotation.set(g.lookPitch, cy + Math.PI, 0, 'YXZ');
    } else {
      const dist = g.camMode === 'far' ? 8 : 4.5;
      this.camYaw = this.camInit ? cy : dampAngle(this.camYaw ?? cy, cy, 8, dt);
      // shorten the boom when a wall is behind the player
      let d = dist;
      for (let k = 1; k <= 12; k++) {
        const t = (dist * k) / 12;
        const x = base.x - Math.sin(this.camYaw) * t, z = base.z - Math.cos(this.camYaw) * t;
        if (this.cols.some((o) => o.t === 1 && collideCircle(x, z, 0.3, o, this._r))) { d = Math.max(1.2, t - 0.4); break; }
      }
      const desired = new THREE.Vector3(base.x - Math.sin(this.camYaw) * d, 2.1 - g.lookPitch * 3 + (g.camMode === 'far' ? 2.5 : 0), base.z - Math.cos(this.camYaw) * d);
      if (this.camInit) cam.position.copy(desired);
      else cam.position.lerp(desired, 1 - Math.exp(-10 * dt));
      cam.lookAt(base.x, 1.4, base.z);
    }
    this.camInit = false;

    if (this.t >= this.days * this.dayLen) {
      this.done = true;
      document.body.classList.remove('injail', 'onfoot');
      g.ui.showJail(false);
      g.releaseFromJail();
    }
  }
}
