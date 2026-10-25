import * as THREE from 'three';
import { buildCar, buildPerson, poseSit, armIK, sharedMats } from './models.js';
import { clamp, lerp, damp, easeInOut, collideCircle } from './util.js';

// H-pattern: [column, row]; column -1 = left gate (1/2), row +1 = forward
// 7-speed gate: 1-2 | 3-4 | 5-6 | 7-R
export const GEAR_POS = { '-1': [1.5, -1], 0: [0, 0], 1: [-1.5, 1], 2: [-1.5, -1], 3: [-0.5, 1], 4: [-0.5, -1], 5: [0.5, 1], 6: [0.5, -1], 7: [1.5, 1] };
export const TOP_GEAR = 7;
const GEAR_MAX = { '-1': 7.5, 1: 8.5, 2: 14, 3: 20.5, 4: 27, 5: 34, 6: 41, 7: 48 };
const GEAR_ACC = { '-1': 3.8, 1: 5.0, 2: 4.3, 3: 3.6, 4: 3.0, 5: 2.5, 6: 2.1, 7: 1.8 };
export const GEAR_LABEL = { '-1': 'R', 0: 'N', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7' };
const REACH = 0.21, SEG = 0.12, RET = 0.24;
const OFFS = [-1.45, 0, 1.45];
const CAR_R = 0.95;

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _res = { nx: 0, nz: 0, pen: 0 };
const POLE_L = new THREE.Vector3(1, -1.2, -0.4).normalize();
const POLE_R = new THREE.Vector3(-1, -1.2, -0.4).normalize();

export class PlayerCar {
  constructor(game) {
    this.game = game;
    const mats = sharedMats();
    this.lampMat = mats.lampOff.clone();
    this.tailMat = mats.tailOff.clone();
    const c = buildCar({ type: 'taxi', color: 0xf3c614, interior: true, lampMat: this.lampMat, tailMat: this.tailMat });
    this.car = c;
    this.group = c.root;
    this.group.rotation.order = 'YXZ';
    game.scene.add(this.group);

    this.driver = buildPerson({ female: false, shirt: 0x34495e, pants: 0x222831, mustache: true, skin: 0xe0ac86, hair: 0x1a1210 });
    poseSit(this.driver);
    this.driver.root.position.copy(c.seats.driver);
    this.group.add(this.driver.root);

    // headlights (always present so light count never changes)
    this.headlights = [];
    for (const x of [0.6, -0.6]) {
      const l = new THREE.SpotLight(0xfff1d6, 0, 95, 0.5, 0.55, 1.4);
      l.position.set(x, 0.7, 2.2);
      l.target.position.set(x * 2, -0.5, 22);
      this.group.add(l, l.target);
      this.headlights.push(l);
    }
    // soft instrument glow inside the cabin at night
    this.dashLight = new THREE.PointLight(0x9fd4ff, 0, 1.6, 1.5);
    this.dashLight.position.set(0.3, 1.0, 0.4);
    this.group.add(this.dashLight);
    // only the big parts cast shadows (keeps the shadow pass cheap)
    this.group.traverse((o) => {
      if (o.isMesh) o.castShadow = o.material.name === 'paint' || o.material.name === 'tire';
    });
    this.driver.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.ext = new THREE.Vector2();
    this.yawRate = 0;
    this.steer = 0;
    this.throttle = 0;
    this.brake = 0;
    this.clutch = 0;
    this.gear = 1;
    this.targetGear = 1;
    this.auto = false;
    this.shift = null;
    this.lever = { c: GEAR_POS[1][0], r: GEAR_POS[1][1] };
    this.handBlend = 0;
    this.autoCooldown = 0;
    this.brakeHold = 0;
    this.rpm = 900;
    this.fuel = 26;
    this.superFuel = 0;
    this.tank = 45;
    this.health = 100;
    this.engineLevel = 0;
    this.pitch = 0;
    this.roll = 0;
    this.bodyPitch = 0;
    this.bodyRoll = 0;
    this.y = 0;
    this.lights = false;
    this.odometer = 0;
    this.events = [];
    this.lastAccel = 0;
    this.headYaw = 0;
    this.occupied = false;
    this.offroad = false;
    this._q = [];
    this.updateLever();
  }

  fuelTotal() {
    return this.fuel + this.superFuel;
  }
  superRatio() {
    const t = this.fuelTotal();
    return t > 0 ? this.superFuel / t : 0;
  }
  speedMul() {
    return (1 + 0.08 * this.engineLevel) * (1 + 0.2 * this.superRatio()) * (this.health < 30 ? 0.8 : 1);
  }
  accelMul() {
    return (1 + 0.12 * this.engineLevel) * (1 + 0.3 * this.superRatio()) * (this.health < 30 ? 0.75 : 1);
  }
  topSpeed() {
    return GEAR_MAX[TOP_GEAR] * this.speedMul();
  }
  placeAt(x, z, heading) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.ext.set(0, 0);
    this.y = this.game.world.heightAt(x, z);
    this.syncTransform(0);
    this.game.camInit = true;
  }

  /* ---------------- gearbox ---------------- */
  requestGear(g) {
    if (g === this.targetGear && (this.shift || g === this.gear)) return;
    this.targetGear = g;
    if (!this.shift) this.shift = { phase: 'reach', t: 0 };
    else if (this.shift.phase === 'return') this.shift = { phase: 'reach', t: this.handBlend * REACH };
    else if (this.shift.phase === 'move') this.buildPath();
    this.game.audio.click(0.4);
  }
  buildPath() {
    const s = this.shift;
    const [c1, r1] = GEAR_POS[this.targetGear];
    s.path = [[this.lever.c, 0], [c1, 0], [c1, r1]];
    s.seg = 0;
    s.segT = 0;
    s.from = [this.lever.c, this.lever.r];
  }
  updateShift(dt) {
    const s = this.shift;
    if (!s) {
      this.clutch = damp(this.clutch, 0, 10, dt);
      return;
    }
    if (s.phase === 'reach') {
      s.t += dt;
      this.handBlend = easeInOut(clamp(s.t / REACH, 0, 1));
      this.clutch = Math.max(this.clutch, this.handBlend);
      if (s.t >= REACH) {
        s.phase = 'move';
        this.gear = 0;
        this.buildPath();
      }
    } else if (s.phase === 'move') {
      const target = s.path[s.seg];
      const d = Math.hypot(target[0] - s.from[0], target[1] - s.from[1]);
      let advance = d < 1e-3;
      if (!advance) {
        s.segT += dt / (SEG * Math.max(0.6, d));
        const k = easeInOut(clamp(s.segT, 0, 1));
        this.lever.c = lerp(s.from[0], target[0], k);
        this.lever.r = lerp(s.from[1], target[1], k);
        advance = s.segT >= 1;
        if (advance && s.seg === 0) this.game.audio.click(0.25);
      }
      if (advance) {
        s.seg++;
        s.segT = 0;
        s.from = [this.lever.c, this.lever.r];
        if (s.seg >= s.path.length) {
          this.gear = this.targetGear;
          s.phase = 'return';
          s.t = 0;
          this.game.audio.click(0.9);
        }
      }
    } else if (s.phase === 'return') {
      s.t += dt;
      this.handBlend = 1 - easeInOut(clamp(s.t / RET, 0, 1));
      this.clutch = this.handBlend;
      if (s.t >= RET) {
        this.shift = null;
        this.handBlend = 0;
      }
    }
    this.updateLever();
  }
  updateLever() {
    const gp = this.car.gearPivot;
    gp.rotation.x = this.lever.r * 0.3;
    gp.rotation.z = this.lever.c * 0.17;
  }
  autoBox(dt, inp) {
    this.autoCooldown -= dt;
    if (this.shift || this.autoCooldown > 0) return;
    const g = this.gear;
    const v = this.speed;
    if (inp.brake > 0.5 && Math.abs(v) < 0.6) {
      this.brakeHold += dt;
      if (this.brakeHold > 0.35 && g !== -1) {
        this.requestGear(-1);
        this.autoCooldown = 0.8;
      }
      return;
    }
    this.brakeHold = 0;
    if (g === -1) {
      if (inp.gas > 0.5 && v > -0.6) {
        this.requestGear(1);
        this.autoCooldown = 0.8;
      }
      return;
    }
    if (g === 0) {
      this.requestGear(1);
      return;
    }
    const r = Math.abs(v) / (GEAR_MAX[g] * this.speedMul());
    if (r > 0.9 && g < TOP_GEAR && inp.gas > 0.3) {
      this.requestGear(g + 1);
      this.autoCooldown = 0.9;
    } else if (r < 0.32 && g > 1) {
      this.requestGear(Math.max(1, g - 1 - (r < 0.12 && g > 2 ? 1 : 0)));
      this.autoCooldown = 0.6;
    }
  }

  /* ---------------- simulation ---------------- */
  update(dt, inp, world, dynamics, controllable = true) {
    this.events.length = 0;
    const alive = this.health > 0 && this.fuelTotal() > 0;
    if (!controllable) {
      inp = { steer: 0, gas: 0, brake: 1, handbrake: true };
    }
    if (this.auto && controllable) this.autoBox(dt, inp);
    this.updateShift(dt);
    let gas = inp.gas, brk = inp.brake;
    if (this.auto && this.gear === -1) {
      gas = inp.brake;
      brk = inp.gas;
    }
    this.throttle = damp(this.throttle, alive ? gas : 0, 7, dt);
    this.brake = damp(this.brake, brk, 12, dt);

    const absV = Math.abs(this.speed);
    const maxSteer = 0.62 / (1 + absV / 15);
    const pull = this.health < 50 ? (50 - this.health) / 50 * 0.04 : 0;
    this.steer = damp(this.steer, clamp(inp.steer, -1, 1) * maxSteer + pull, inp.steer === 0 ? 6 : 9, dt);

    const g = this.gear;
    const engaged = (!this.shift || this.shift.phase === 'return') && g !== 0;
    const smul = this.speedMul();
    let force = 0;
    let rpmT;
    if (engaged && alive) {
      const gmax = GEAR_MAX[g] * smul;
      const dir = g === -1 ? -1 : 1;
      const r = Math.max(0, this.speed * dir) / gmax;
      let eff;
      if (g === 1 || g === -1) eff = r < 0.92 ? 1 : Math.max(0, (1 - r) * 12);
      else eff = r < 0.25 ? 0.25 + r * 1.8 : r < 0.92 ? 1 : Math.max(0, (1 - r) * 12);
      force = dir * GEAR_ACC[g] * this.accelMul() * eff * this.throttle * (1 - this.clutch * 0.9);
      if (r > 1.02) force -= dir * (r - 1) * 8;
      if (this.throttle < 0.05) force -= Math.sign(this.speed) * Math.min(1.1, absV * 0.25);
      rpmT = 850 + clamp(Math.abs(this.speed) / gmax, 0, 1.06) * 5900;
      if (this.clutch > 0.5) rpmT = lerp(rpmT, 900 + this.throttle * 5000, this.clutch);
    } else {
      rpmT = alive ? 850 + this.throttle * 5400 : 0;
    }
    this.rpm = damp(this.rpm, rpmT, 6, dt);

    const surf = world.surfaceAt(this.pos.x, this.pos.z);
    this.offroad = surf === 'sand' || surf === 'grass';
    let decel = this.brake * 10;
    if (inp.handbrake) decel += 6.5;
    decel += (surf === 'sand' ? 1.7 : surf === 'grass' ? 0.8 : 0.16) + 0.00042 * absV * absV;
    const prevSpeed = this.speed;
    this.speed += force * dt;
    const dv = decel * dt;
    if (Math.abs(this.speed) <= dv) this.speed = 0;
    else this.speed -= Math.sign(this.speed) * dv;
    this.lastAccel = (this.speed - prevSpeed) / Math.max(dt, 1e-4);

    // steering / yaw. When pushing against a wall/pump the speed is ~0, but the
    // driven wheels still scrub the car around, so steering keeps working.
    this.blocked = Math.max(0, (this.blocked || 0) - dt);
    let steerSpeed = this.speed;
    if (this.blocked > 0 && this.throttle > 0.1 && engaged && Math.abs(this.speed) < 2.5) {
      steerSpeed = (g === -1 ? -1 : 1) * Math.max(Math.abs(this.speed), 2.5 * this.throttle);
    }
    let yawRate = (-steerSpeed * Math.tan(this.steer)) / 2.7;
    const grip = surf === 'sand' ? 0.85 : 1;
    if (inp.handbrake && absV > 7) {
      yawRate *= 1.55;
      this.ext.x += Math.cos(this.heading) * yawRate * absV * 0.05 * dt;
      this.ext.y += -Math.sin(this.heading) * yawRate * absV * 0.05 * dt;
    }
    this.yawRate = yawRate * grip;
    this.heading += this.yawRate * dt;

    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const vx = fx * this.speed + this.ext.x, vz = fz * this.speed + this.ext.y;
    this.pos.x += vx * dt;
    this.pos.z += vz * dt;
    const ek = inp.handbrake ? 1.2 : 3.5;
    this.ext.x = damp(this.ext.x, 0, ek, dt);
    this.ext.y = damp(this.ext.y, 0, ek, dt);
    this.odometer += Math.hypot(vx, vz) * dt;

    // fuel
    const used = (Math.abs(this.speed) * dt / 120) * (0.55 + 0.75 * this.throttle) + (alive ? dt * 0.0004 : 0);
    if (used > 0 && this.fuelTotal() > 0) {
      const t = this.fuelTotal();
      const sr = this.superFuel / t;
      this.superFuel = Math.max(0, this.superFuel - used * sr);
      this.fuel = Math.max(0, this.fuel - used * (1 - sr));
    }

    this.collide(world, dynamics);
    this.syncTransform(dt);
    this.animate(dt, inp);
  }

  circles(out) {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    for (let i = 0; i < 3; i++) {
      out[i * 2] = this.pos.x + fx * OFFS[i];
      out[i * 2 + 1] = this.pos.z + fz * OFFS[i];
    }
    return out;
  }
  collide(world, dynamics) {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const hits = this._q;
    let worst = 0, worstObj = null;
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < 3; i++) {
        const cx = this.pos.x + fx * OFFS[i], cz = this.pos.z + fz * OFFS[i];
        world.statics.query(cx, cz, CAR_R + 1, hits);
        for (const o of hits) {
          if (!collideCircle(cx, cz, CAR_R, o, _res)) continue;
          if (o.soft) {
            this.speed *= 0.97;
            continue;
          }
          const imp = this.resolve(_res.nx, _res.nz, _res.pen, fx, fz, 0.2);
          this.blocked = 0.3;
          if (imp > worst) { worst = imp; worstObj = o; }
        }
        for (const d of dynamics) {
          if (d === this || !d.active) continue;
          const dx = d.pos.x - this.pos.x, dz = d.pos.z - this.pos.z;
          if (dx * dx + dz * dz > 49) continue;
          const oc = d.circles(d._c || (d._c = []));
          for (let k = 0; k < 3; k++) {
            const ox = oc[k * 2], oz = oc[k * 2 + 1];
            const ddx = cx - ox, ddz = cz - oz;
            const dist = Math.hypot(ddx, ddz);
            if (dist >= CAR_R * 2 || dist < 1e-4) continue;
            const nx = ddx / dist, nz = ddz / dist, pen = CAR_R * 2 - dist;
            // relative velocity
            const myVx = fx * this.speed + this.ext.x, myVz = fz * this.speed + this.ext.y;
            const ofx = Math.sin(d.heading), ofz = Math.cos(d.heading);
            const rvx = myVx - ofx * d.speed, rvz = myVz - ofz * d.speed;
            const vn = rvx * nx + rvz * nz;
            this.pos.x += nx * pen * 0.6;
            this.pos.z += nz * pen * 0.6;
            this.blocked = 0.3;
            d.push(-nx * pen * 0.4, -nz * pen * 0.4);
            if (vn < 0) {
              const impact = -vn;
              // momentum exchange
              const j = impact * 0.55;
              const nvx = myVx + nx * j, nvz = myVz + nz * j;
              this.speed = nvx * fx + nvz * fz;
              this.ext.x = nvx - fx * this.speed;
              this.ext.y = nvz - fz * this.speed;
              d.hit(-nx * j, -nz * j, impact, this);
              if (impact > worst) { worst = impact; worstObj = d; }
            }
          }
        }
      }
    }
    if (worst > 1.2) {
      this.events.push({ type: 'crash', impact: worst, other: worstObj });
      const dmg = Math.max(0, worst - 2.5) * 2.3 * (worstObj && worstObj.isPolice ? 0.5 : 1);
      this.health = Math.max(0, this.health - dmg);
    }
  }
  resolve(nx, nz, pen, fx, fz, rest) {
    this.pos.x += nx * pen;
    this.pos.z += nz * pen;
    const vx = fx * this.speed + this.ext.x, vz = fz * this.speed + this.ext.y;
    const vn = vx * nx + vz * nz;
    if (vn >= 0) return 0;
    const nvx = vx - nx * vn * (1 + rest), nvz = vz - nz * vn * (1 + rest);
    this.speed = (nvx * fx + nvz * fz) * 0.9;
    this.ext.x = (nvx - fx * this.speed) * 0.5;
    this.ext.y = (nvz - fz * this.speed) * 0.5;
    return -vn;
  }

  syncTransform(dt) {
    const w = this.game.world;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const rx = -fz, rz = fx; // right
    const p = this.pos;
    const hc = w.heightAt(p.x, p.z);
    const hf = w.heightAt(p.x + fx * 1.4, p.z + fz * 1.4), hb = w.heightAt(p.x - fx * 1.4, p.z - fz * 1.4);
    const hr = w.heightAt(p.x + rx * 0.8, p.z + rz * 0.8), hl = w.heightAt(p.x - rx * 0.8, p.z - rz * 0.8);
    const groundY = Math.max(hc, (hf + hb) / 2);
    const k = dt > 0 ? 1 - Math.exp(-14 * dt) : 1;
    this.y += (groundY - this.y) * k;
    this.pitch += (-Math.atan2(hf - hb, 2.8) - this.pitch) * k;
    this.roll += (Math.atan2(hl - hr, 1.6) - this.roll) * k;
    if (dt > 0) {
      const lat = this.speed * this.yawRate;
      this.bodyRoll = damp(this.bodyRoll, clamp(lat * 0.011, -0.07, 0.07), 5, dt);
      this.bodyPitch = damp(this.bodyPitch, clamp(-this.lastAccel * 0.006, -0.05, 0.05), 5, dt);
    }
    let shake = 0;
    if (this.offroad) shake = Math.sin(performance.now() * 0.05) * Math.min(1, Math.abs(this.speed) / 20) * 0.012;
    this.group.position.set(p.x, this.y + shake, p.z);
    this.group.rotation.set(this.pitch + this.bodyPitch, this.heading, this.roll + this.bodyRoll);
    this.p = p;
  }

  animate(dt, inp) {
    const c = this.car;
    for (const w of c.wheels) {
      w.spin.rotation.x += (this.speed / 0.33) * dt;
      if (w.front) w.steer.rotation.y = -this.steer;
    }
    const wheelRot = (this.steer / 0.62) * 2.6;
    c.steering.rotation.z = wheelRot;
    // needles
    const kmh = Math.abs(this.speed) * 3.6;
    c.needles.speed.rotation.z = 0.75 * Math.PI - clamp(kmh / 280, 0, 1) * 1.5 * Math.PI;
    c.needles.rpm.rotation.z = 0.75 * Math.PI - clamp(this.rpm / 8000, 0, 1) * 1.5 * Math.PI;
    const ff = clamp(this.fuelTotal() / this.tank, 0.001, 1);
    c.needles.fuel.scale.x = ff;
    c.needles.fuel.position.x = (1 - ff) * 0.04;
    c.needles.fuel.material.color.setHex(ff < 0.15 ? 0xff3030 : this.superRatio() > 0.3 ? 0x3aa0ff : 0x38d16a);
    c.pedals.gas.rotation.x = 0.35 + this.throttle * 0.35;
    c.pedals.brake.rotation.x = 0.35 + this.brake * 0.3;
    c.pedals.clutch.rotation.x = 0.35 + this.clutch * 0.4;
    c.handbrake.rotation.x = inp.handbrake ? 0.45 : 0.15;
    // doors
    for (const k in c.doors) {
      const d = c.doors[k];
      d.open = damp(d.open, d.target, 5, dt);
      d.pivot.rotation.y = -d.side * 1.1 * easeInOut(clamp(d.open, 0, 1));
    }
    // lights
    const night = this.game.env ? this.game.env.night : 0;
    const on = this.lights || night > 0.5;
    for (const l of this.headlights) l.intensity = on ? 380 : 0;
    this.lampMat.emissiveIntensity = on ? 3 : 0.15;
    this.dashLight.intensity = night * 0.35;
    const braking = this.brake > 0.1 || (this.auto && this.gear === -1 && inp.gas > 0.1);
    this.tailMat.emissiveIntensity = braking ? 4 : on ? 1.2 : 0.25;
    if (c.roofSign) {
      c.roofSign.emissiveIntensity = 0.2 + night * 1.2;
      c.roofSign.emissive.setHex(this.occupied ? 0xff6a50 : 0x9aff9a);
    }
    // driver
    this.group.updateMatrixWorld(true);
    const dr = this.driver;
    if (dr.root.parent === this.group) {
      const R = 0.185;
      const rc = clamp(wheelRot, -1.7, 1.7);
      const gL = c.wheelMount.localToWorld(_v.set(Math.cos(Math.PI / 6 + rc) * R, Math.sin(Math.PI / 6 + rc) * R, -0.025));
      armIK(dr, 1, gL, POLE_L);
      const gR = c.wheelMount.localToWorld(_w.set(Math.cos((5 * Math.PI) / 6 + rc) * R, Math.sin((5 * Math.PI) / 6 + rc) * R, -0.025));
      if (this.handBlend > 0.001) {
        const knob = c.knobTip.getWorldPosition(new THREE.Vector3());
        knob.y += 0.03;
        gR.lerp(knob, this.handBlend);
      }
      armIK(dr, -1, gR, POLE_R);
      this.headYaw = damp(this.headYaw, -this.steer * 0.6 + (this.handBlend > 0.3 ? -0.25 : 0), 4, dt);
      dr.head.rotation.y = this.headYaw;
      dr.head.rotation.x = this.handBlend > 0.3 ? 0.18 : 0;
      // feet on pedals
      dr.knL.rotation.x = 1.3 - this.clutch * 0.25;
      dr.knR.rotation.x = 1.3 - Math.max(this.throttle, this.brake) * 0.2;
      dr.hpR.rotation.y = this.brake > this.throttle ? 0.06 : -0.04;
    }
  }

  repair() {
    this.health = 100;
  }
}
