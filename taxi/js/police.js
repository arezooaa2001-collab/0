import * as THREE from 'three';
import { buildCar, buildPerson, poseSit, box, cyl } from './models.js';
import { TrafficCar } from './traffic.js';
import { Walker } from './people.js';
import { clamp, damp, wrapAngle, faMoney, collideCircle, pick, canvasTexture } from './util.js';

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
    g.ui.showIncident(amount, g.money >= amount, () => this.pay(), () => this.refuse('refuse'));
    g.ui.say('راننده عصبانی', pick(ANGRY), { mood: 'grumpy' });
    g.audio.speak('هوی! چیکار کردی؟');
  }
  pay() {
    const g = this.game, inc = this.inc;
    if (!inc) return;
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
    const g = this.game, pl = g.player, u = this.unit, w = g.world;
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
    if ((d < 9 && sp < 2.5) || ((pl.health <= 0 || pl.fuelTotal() <= 0) && d < 60)) this.arrestT += dt;
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
    g.fade(1, 0.45, () => this.setupArrest());
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
    const paid = Math.min(g.money, this.fine);
    g.money -= paid;
    this.state = 'none';
    return paid;
  }
}

/* =========================================================
   Jail scene (separate THREE.Scene)
   ========================================================= */
class Jail {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0c0e);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    const s = this.scene;
    const conc = new THREE.MeshStandardMaterial({
      color: 0x8a8680,
      roughness: 0.95,
      map: canvasTexture(256, 256, (g, w, h) => {
        g.fillStyle = '#8a8680';
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 3000; i++) {
          g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
          g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
        g.strokeStyle = 'rgba(40,40,40,0.4)';
        g.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          g.beginPath();
          const x = Math.random() * w;
          g.moveTo(x, 0);
          g.lineTo(x + Math.random() * 40 - 20, h * 0.6);
          g.stroke();
        }
        g.fillStyle = 'rgba(30,30,30,0.6)';
        g.font = '28px Vazirmatn, Tahoma, sans-serif';
        g.fillText('|||| ||||', 30, 200);
      }, { repeat: [2, 1] }),
    });
    const floor = box(7, 0.2, 6, conc, 0, -0.1, 0, s);
    void floor;
    box(7, 4, 0.3, conc, 0, 2, -3, s);
    box(0.3, 4, 6, conc, -3.5, 2, 0, s);
    box(0.3, 4, 6, conc, 3.5, 2, 0, s);
    box(7, 0.3, 6, conc, 0, 4, 0, s);
    // window with bars
    this.winMat = new THREE.MeshBasicMaterial({ color: 0x8fb8e0 });
    box(1.2, 0.8, 0.05, this.winMat, 1.2, 3.1, -2.84, s);
    const metal = new THREE.MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.8, roughness: 0.35 });
    for (let i = 0; i < 5; i++) {
      const b = cyl(0.025, 0.025, 0.8, metal, 8, s);
      b.position.set(0.7 + i * 0.25, 3.1, -2.8);
    }
    // bars at front
    for (let i = 0; i < 16; i++) {
      const b = cyl(0.03, 0.03, 4, metal, 8, s);
      b.position.set(-3.4 + i * 0.45, 2, 3);
    }
    box(7, 0.12, 0.12, metal, 0, 3.9, 3, s);
    box(7, 0.12, 0.12, metal, 0, 0.15, 3, s);
    // bed
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 });
    box(2, 0.45, 0.9, metal, -2.3, 0.22, -1.9, s);
    box(2, 0.15, 0.85, new THREE.MeshStandardMaterial({ color: 0x5a6a5a, roughness: 1 }), -2.3, 0.52, -1.9, s);
    box(0.5, 0.12, 0.6, new THREE.MeshStandardMaterial({ color: 0xd8d4c8 }), -3.0, 0.65, -1.9, s);
    box(0.6, 0.5, 0.45, wood, 2.6, 0.25, -2.4, s);
    const toilet = cyl(0.22, 0.18, 0.45, new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.3 }), 14, s);
    toilet.position.set(2.8, 0.22, 1.5);
    // lights
    this.hemi = new THREE.HemisphereLight(0xb8c0d0, 0x403830, 0.8);
    s.add(this.hemi);
    this.bulb = new THREE.PointLight(0xffe0a0, 14, 14, 1.2);
    this.bulb.position.set(0, 3.6, 0);
    s.add(this.bulb);
    sphere(s);
    this.sun = new THREE.SpotLight(0xfff0d0, 0, 20, 0.35, 0.6, 1);
    this.sun.position.set(1.2, 3.1, -3.5);
    this.sun.target.position.set(-0.5, 0, 1);
    s.add(this.sun, this.sun.target);
    this.prisoner = buildPerson(game.driverLook);
    s.add(this.prisoner.root);
    this.camera.position.set(0.9, 2.3, 4.6);
    this.camera.lookAt(-0.8, 0.9, -1.2);
  }
  start(days) {
    this.days = days;
    this.t = 0;
    this.dayLen = 1.8;
    this.speed = 1;
    this.done = false;
    this.game.ui.showJail(true);
  }
  update(dt) {
    if (this.done) return;
    this.t += dt * this.speed;
    const total = this.days * this.dayLen;
    const day = Math.min(this.days, 1 + Math.floor(this.t / this.dayLen));
    const frac = (this.t % this.dayLen) / this.dayLen;
    const hour = frac * 24;
    const sun = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    this.sun.intensity = sun * 40;
    this.winMat.color.setRGB(0.1 + sun * 0.5, 0.12 + sun * 0.62, 0.2 + sun * 0.7);
    this.bulb.intensity = sun > 0.3 ? 6 : 14;
    this.hemi.intensity = 0.45 + sun * 0.5;
    // prisoner routine
    const p = this.prisoner;
    const act = day % 3;
    if (act === 0 || hour < 7 || hour > 21) {
      poseSit(p);
      p.root.position.set(-2.2, 0.62, -1.75);
      p.root.rotation.y = 0;
      p.spine.rotation.x = 0.35;
      p.head.rotation.x = 0.4;
      p.shL.rotation.set(-1.9, 0, 0.3);
      p.shR.rotation.set(-1.9, 0, -0.3);
      p.elL.rotation.set(-1.4, 0, 0);
      p.elR.rotation.set(-1.4, 0, 0);
    } else {
      const k = (Math.sin(this.t * 1.6) + 1) / 2;
      p.root.position.set(-1.5 + k * 3, 0, 0.4);
      p.root.rotation.y = Math.cos(this.t * 1.6) > 0 ? Math.PI / 2 : -Math.PI / 2;
      p.hips.position.y = 0.95;
      p.hpL.rotation.set(Math.sin(this.t * 7) * 0.4, 0, 0);
      p.hpR.rotation.set(-Math.sin(this.t * 7) * 0.4, 0, 0);
      p.knL.rotation.set(0.2, 0, 0);
      p.knR.rotation.set(0.2, 0, 0);
      p.shL.rotation.set(-Math.sin(this.t * 7) * 0.3, 0, 0.1);
      p.shR.rotation.set(Math.sin(this.t * 7) * 0.3, 0, -0.1);
      p.elL.rotation.set(-0.2, 0, 0);
      p.elR.rotation.set(-0.2, 0, 0);
      p.spine.rotation.x = 0.1;
      p.head.rotation.x = 0.25;
    }
    this.game.ui.setJail(day, this.days, frac);
    if (this.t >= total) {
      this.done = true;
      this.game.ui.showJail(false);
      this.game.releaseFromJail();
    }
  }
}
function sphere(s) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
  m.position.set(0, 3.75, 0);
  s.add(m);
}
