// Vehicle dynamics: planar two-axle (bicycle) model with a Pacejka-style tyre curve, friction
// circle, longitudinal load transfer, aerodynamic drag/downforce, automatic gearbox, nitro,
// slipstream, slopes, surfaces and impulse-based collisions. Pure JS (no three.js).

import { clamp, lerp, sign, approach } from '../core/utils.js';

const G = 9.81;
const RHO = 1.2;
const DRIVE_EFF = 0.88;
const REVERSE_RATIO = 3.2;

export const SURFACE = { ROAD: 0, CURB: 1, OFF: 2 };

const TF = { fx: 0, fy: 0, slide: 0 };
const TR = { fx: 0, fy: 0, slide: 0 };

/**
 * Combines longitudinal and lateral tyre demand inside the friction circle.
 * Assisted (TCS/ABS) keeps cornering force and trims Fx; unassisted lets the tyre slide.
 */
function combine(fx, fy, maxF, assisted, out) {
  const tot = Math.hypot(fx, fy);
  if (tot <= maxF) {
    out.fx = fx; out.fy = fy; out.slide = 0;
    return out;
  }
  if (assisted) {
    const lat = clamp(fy, -maxF, maxF);
    const cap = Math.sqrt(Math.max(0, maxF * maxF - lat * lat));
    out.fx = clamp(fx, -cap, cap);
    out.fy = lat;
    out.slide = Math.min(1, (tot - maxF) / maxF) * 0.3;
  } else {
    const k = (maxF * 0.9) / tot;
    out.fx = fx * k; out.fy = fy * k;
    out.slide = Math.min(1, (tot - maxF) / maxF + 0.2);
  }
  return out;
}

function magic(alpha, B, C, E) {
  const x = B * alpha;
  return Math.sin(C * Math.atan(x - E * (x - Math.atan(x))));
}

export class Vehicle {
  /**
   * @param {object} phys   tuned physics (config.tunedPhysics)
   * @param {object} dims   { length, width }
   */
  constructor(phys, dims) {
    this.p = phys;
    this.mass = phys.mass;
    this.L = phys.wheelbase;
    this.a = this.L * (1 - phys.frontWeight); // CG -> front axle
    this.b = this.L * phys.frontWeight; // CG -> rear axle
    this.halfLength = dims.length / 2;
    this.halfWidth = dims.width / 2;
    this.radius = this.halfWidth * 1.02;
    this.circleOffset = Math.max(0.2, this.halfLength - this.radius);
    this.Iz = (this.mass * (dims.length ** 2 + dims.width ** 2)) / 12 * 1.25;
    this.controls = { steer: 0, throttle: 0, brake: 0, handbrake: false, nitro: false };
    this.proj = { index: 0, t: 0, s: 0, d: 0, height: 0, grade: 0, nx: 1, nz: 0, tx: 0, tz: 1, curb: 0, kappa: 0 };
    this.reset(0, 0, 0, 0);
  }

  reset(x, z, heading, y = 0) {
    this.x = x;
    this.z = z;
    this.y = y;
    this.heading = heading;
    this.vx = 0;
    this.vz = 0;
    this.yawRate = 0;
    this.delta = 0;
    this.gear = 1;
    this.rpm = this.p.idleRpm;
    this.shiftTimer = 0;
    this.reverseTimer = 0;
    this.nitroLevel = 1;
    this.nitroActive = false;
    this.ax = 0;
    this.ay = 0;
    this.u = 0;
    this.w = 0;
    this.speed = 0;
    this.slipF = 0;
    this.slipR = 0;
    this.wheelspin = 0;
    this.lockup = 0;
    this.skid = 0;
    this.surface = SURFACE.ROAD;
    this.wheelAngle = 0;
    this.roll = 0; this.rollVel = 0;
    this.pitch = 0; this.pitchVel = 0;
    this.heave = 0;
    this.tireTemp = 0.25;
    this.throttleOut = 0;
    this.draft = 0;
    this.impact = 0; // strongest impact speed in the current frame (m/s)
    this.impactX = 0; this.impactZ = 0;
    this.scrape = 0;
    this.hint = -1;
    this.ghost = 0;
  }

  get forwardX() { return Math.sin(this.heading); }
  get forwardZ() { return Math.cos(this.heading); }

  /**
   * Advances the vehicle by `dt` seconds.
   * env = { track, roadGrip, offGrip, weatherGrip, realism, assists }
   */
  step(dt, env) {
    const p = this.p;
    const c = this.controls;
    const track = env.track;
    const assists = this.assists ?? env.assists;
    const realism = env.realism;
    const proj = track.project(this.x, this.z, this.hint, this.proj);
    this.hint = proj.index;

    // ----- surface ----------------------------------------------------------------------
    const ad = Math.abs(proj.d);
    let surfGrip, crr;
    if (ad <= track.halfWidth) {
      this.surface = SURFACE.ROAD; surfGrip = env.roadGrip * env.weatherGrip; crr = 0.014;
    } else if (proj.curb && ad <= track.halfWidth + track.curbWidth) {
      this.surface = SURFACE.CURB; surfGrip = env.roadGrip * env.weatherGrip * 0.93; crr = 0.02;
    } else {
      this.surface = SURFACE.OFF; surfGrip = env.offGrip; crr = 0.09;
    }

    // ----- local frame ------------------------------------------------------------------
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const lx = fz, lz = -fx;
    const u = this.vx * fx + this.vz * fz;
    const w = this.vx * lx + this.vz * lz;
    const r = this.yawRate;
    const speed = Math.hypot(this.vx, this.vz);
    this.u = u; this.w = w; this.speed = speed;

    // ----- steering -----------------------------------------------------------------------
    const absU = Math.abs(u);
    const lock = (p.steerLock) / (1 + (absU / 30) ** 2 * 1.25);
    let deltaTarget = -c.steer * lock;
    if (assists > 0 && absU > 6) {
      const beta = Math.atan2(w, absU);
      deltaTarget += clamp(beta * (assists === 2 ? 0.55 : 0.3), -0.25, 0.25);
    }
    this.delta = approach(this.delta, deltaTarget, (3.2 + 1.2 * (p.steerRate || 1)) * dt);
    const delta = this.delta;

    // ----- loads ------------------------------------------------------------------------
    const dirty = realism.dirtyAir ? 1 - 0.3 * this.draft : 1;
    const downforce = 0.5 * RHO * p.clA * u * u * dirty;
    const h = p.cgHeight;
    const transfer = clamp((this.mass * this.ax * h) / this.L, -this.mass * G * 0.35, this.mass * G * 0.35);
    const staticF = this.mass * G * p.frontWeight;
    const staticR = this.mass * G * (1 - p.frontWeight);
    const Fzf = Math.max(staticF * 0.15, staticF + downforce * 0.45 - transfer);
    const Fzr = Math.max(staticR * 0.15, staticR + downforce * 0.55 + transfer);

    let tempFactor = 1;
    if (realism.tireTemperature) tempFactor = 0.93 + 0.09 * Math.min(1, this.tireTemp);
    const baseMu = 1.05 * p.grip * surfGrip * tempFactor;
    let muF = baseMu, muR = baseMu;
    if (realism.loadSensitivity) {
      muF *= clamp(1 - 0.09 * (Fzf / staticF - 1), 0.82, 1.08);
      muR *= clamp(1 - 0.09 * (Fzr / staticR - 1), 0.82, 1.08);
    }

    // ----- gearbox & engine ---------------------------------------------------------------
    const gears = p.gears;
    const R = p.wheelRadius;
    let driveIn = c.throttle;
    let brakeIn = c.brake;
    if (this.gear === -1) {
      driveIn = c.brake;
      brakeIn = c.throttle;
      if (c.throttle > 0.1 && u > -0.8) this.gear = 1;
    } else if (absU < 0.8 && c.brake > 0.2 && c.throttle < 0.05) {
      this.reverseTimer += dt;
      if (this.reverseTimer > 0.4) { this.gear = -1; this.reverseTimer = 0; }
    } else {
      this.reverseTimer = 0;
    }
    const ratio = this.gear === -1 ? REVERSE_RATIO : gears[this.gear - 1];
    const toRpm = (60 / (2 * Math.PI)) * p.finalDrive;
    const wheelRpm = (absU / R) * ratio * toRpm;
    if (this.gear > 0) {
      if (this.shiftTimer > 0) this.shiftTimer -= dt;
      else if (this.gear < gears.length && wheelRpm > p.redline * 0.93) {
        this.gear++;
        this.shiftTimer = realism.shiftTime;
        this.shifted = 1;
      } else if (this.gear > 1) {
        const lowerRpm = (absU / R) * gears[this.gear - 2] * toRpm;
        if (wheelRpm < p.redline * 0.45 && lowerRpm < p.redline * 0.82) {
          this.gear--;
          this.shiftTimer = realism.shiftTime * 0.6;
        }
      }
    }
    const launchRpm = p.idleRpm + driveIn * (p.redline * 0.55 - p.idleRpm);
    const engineRpm = clamp(Math.max(wheelRpm, this.gear === 1 || this.gear === -1 ? launchRpm : p.idleRpm), p.idleRpm, p.redline * 1.02);
    this.rpm = lerp(this.rpm, engineRpm, 1 - Math.exp(-18 * dt));

    const x = engineRpm / p.redline;
    const shape = x < 0.65 ? 0.62 + 0.38 * Math.sin(clamp((x - 0.1) / 0.55, 0, 1) * Math.PI * 0.5) : 1 - 0.25 * ((x - 0.65) / 0.35) ** 2;
    const omega = Math.max(50, (engineRpm * 2 * Math.PI) / 60);
    const nitroOn = c.nitro && this.nitroLevel > 0.002 && driveIn > 0.1 && this.gear > 0;
    this.nitroActive = nitroOn;
    const powerLimit = p.powerKW * 1000 * (nitroOn ? 1 + p.nitroBoost : 1);
    let torque = Math.min(p.torqueNm * shape * (nitroOn ? 1 + p.nitroBoost : 1), powerLimit / omega);
    if (engineRpm >= p.redline * 1.0) torque *= 0.15; // limiter
    if (this.shiftTimer > 0) torque *= 0.2;
    let driveForce = (torque * ratio * p.finalDrive * DRIVE_EFF * driveIn) / R;
    if (this.gear === -1) driveForce = -Math.min(driveForce, this.mass * G * 0.35);
    if (driveIn < 0.05 && this.gear > 0 && absU > 1) {
      driveForce = -sign(u) * this.mass * G * 0.035 * (0.4 + x); // engine braking
    }
    this.throttleOut = driveIn;
    if (nitroOn) this.nitroLevel = Math.max(0, this.nitroLevel - dt / p.nitroTime);

    // split drive torque between axles
    let driveF = 0, driveR = 0;
    if (p.drive === 'FWD') driveF = driveForce;
    else if (p.drive === 'AWD') { driveF = driveForce * 0.4; driveR = driveForce * 0.6; }
    else driveR = driveForce;

    // brakes
    const brakeTotal = brakeIn * p.brake * this.mass * G * 1.15;
    const moveSign = absU > 0.05 ? sign(u) : 0;
    let brakeF = -moveSign * brakeTotal * 0.64;
    let brakeR = -moveSign * brakeTotal * 0.36;
    let hbFactor = 1;
    if (c.handbrake && absU > 0.5) {
      brakeR += -moveSign * muR * Fzr * 1.1;
      hbFactor = 0.6;
    }

    // ----- tyres (friction circle per axle) ---------------------------------------------------
    const cd = Math.cos(delta), sd = Math.sin(delta);
    const vyf = w + this.a * r;
    const vLongF = u * cd + vyf * sd;
    const vLatF = -u * sd + vyf * cd;
    const alphaF = Math.atan2(vLatF, Math.max(Math.abs(vLongF), 1.2));
    const maxF = muF * Fzf;
    const assisted = assists > 0;
    combine(driveF + brakeF, -magic(alphaF, 11, 1.5, 0.2) * maxF, maxF, assisted, TF);
    const FxF = TF.fx, FyF = TF.fy;
    const FxCarF = FxF * cd - FyF * sd;
    const FyCarF = FxF * sd + FyF * cd;

    const vyr = w - this.b * r;
    const alphaR = Math.atan2(vyr, Math.max(absU, 1.2));
    const maxR = muR * Fzr;
    combine(driveR + brakeR, -magic(alphaR, 12, 1.5, 0.2) * maxR * hbFactor, maxR, assisted && !c.handbrake, TR);
    const FxR = TR.fx, FyR = TR.fy;
    const driving = Math.abs(driveF + driveR) > Math.abs(brakeF + brakeR);
    const spin = driving ? Math.max(TF.slide * (p.drive !== 'RWD' ? 1 : 0), TR.slide * (p.drive !== 'FWD' ? 1 : 0)) : 0;
    const lockF = !driving && TF.slide > 0.25 ? 1 : 0;
    const lockR = !driving && TR.slide > 0.25 ? 1 : 0;

    // ----- resistances ------------------------------------------------------------------------
    const draftFactor = realism.drafting ? 1 - 0.32 * this.draft : 1;
    const drag = 0.5 * RHO * p.cdA * u * absU * draftFactor;
    const rolling = absU > 0.1 ? crr * this.mass * G * sign(u) : 0;
    const along = fx * proj.tx + fz * proj.tz;
    const slope = this.mass * G * proj.grade * along;

    let Fx = FxCarF + FxR - drag - rolling - slope;
    let Fy = FyCarF + FyR - 0.5 * RHO * 1.6 * w * Math.abs(w) - (absU > 0.1 ? 0 : 0);
    let Mz = this.a * FyCarF - this.b * FyR;

    // stability control (ESC) and handling upgrades
    const stability = (assists === 2 ? 0.9 : assists === 1 ? 0.35 : 0) + (p.stability || 0);
    if (stability > 0 && absU > 5) {
      const rRef = clamp((u * Math.tan(delta)) / this.L, -(muR * G) / absU, (muR * G) / absU);
      const err = r - rRef;
      if (Math.abs(err) > 0.05) Mz -= stability * this.Iz * 2.2 * (err - sign(err) * 0.05);
    }
    // yaw damping from tyres scrubbing at very low speed
    Mz -= this.Iz * r * (absU < 3 ? 2.5 : 0.15);

    // ----- integrate (world frame) --------------------------------------------------------------
    const ax = Fx / this.mass;
    const ay = Fy / this.mass;
    this.vx += (ax * fx + ay * lx) * dt;
    this.vz += (ax * fz + ay * lz) * dt;
    this.yawRate += (Mz / this.Iz) * dt;

    // low-speed kinematic blend keeps parking-speed behaviour sane
    const newU = this.vx * fx + this.vz * fz;
    if (Math.abs(newU) < 4) {
      const k = 1 - Math.abs(newU) / 4;
      const blend = 1 - Math.exp(-k * 18 * dt);
      const rKin = (newU * Math.tan(delta)) / this.L;
      this.yawRate = lerp(this.yawRate, rKin, blend);
      const newW = this.vx * lx + this.vz * lz;
      const wDamped = newW * (1 - blend);
      this.vx += (wDamped - newW) * lx;
      this.vz += (wDamped - newW) * lz;
      if (Math.abs(newU) < 0.25 && driveIn < 0.05) {
        const stop = Math.exp(-10 * dt);
        this.vx *= stop; this.vz *= stop; this.yawRate *= stop;
      }
    }
    this.heading += this.yawRate * dt;
    if (this.heading > Math.PI) this.heading -= Math.PI * 2;
    else if (this.heading < -Math.PI) this.heading += Math.PI * 2;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // ----- bookkeeping for gameplay / visuals ---------------------------------------------------
    this.ax = lerp(this.ax, ax, 1 - Math.exp(-10 * dt));
    this.ay = lerp(this.ay, ay, 1 - Math.exp(-10 * dt));
    this.slipF = alphaF;
    this.slipR = alphaR;
    this.wheelspin = spin;
    this.lockup = Math.max(lockF, lockR, c.handbrake && absU > 3 ? 1 : 0);
    const lateralSlide = Math.max(0, Math.abs(alphaR) - 0.11) * 4 + Math.max(0, Math.abs(alphaF) - 0.16) * 2;
    this.skid = absU > 3 ? clamp(Math.max(lateralSlide, spin * 0.8, this.lockup * 0.9), 0, 1) : spin * 0.8;
    this.wheelAngle += ((spin > 0.2 ? u + 12 * spin : u) / R) * dt;

    if (realism.tireTemperature) {
      const heat = 0.02 * absU / 40 + this.skid * 0.25;
      this.tireTemp = clamp(this.tireTemp + (heat - 0.015) * dt, 0, 1.2);
    }
    // nitro recharge: slowly, faster while drifting or in a slipstream
    if (!nitroOn) {
      this.nitroLevel = Math.min(1, this.nitroLevel + dt * (0.018 + (lateralSlide > 0.1 && absU > 12 ? 0.09 : 0) + 0.07 * this.draft));
    }

    // body motion springs (visual only)
    if (realism.bodyMotion) {
      const wn = 2 * Math.PI * 1.5, zeta = 0.42;
      const rollT = clamp(ay * 0.011, -0.075, 0.075);
      const pitchT = clamp(-ax * 0.009, -0.06, 0.06);
      this.rollVel += (wn * wn * (rollT - this.roll) - 2 * zeta * wn * this.rollVel) * dt;
      this.roll += this.rollVel * dt;
      this.pitchVel += (wn * wn * (pitchT - this.pitch) - 2 * zeta * wn * this.pitchVel) * dt;
      this.pitch += this.pitchVel * dt;
    } else {
      this.roll = 0; this.pitch = 0;
    }
    if (this.ghost > 0) this.ghost -= dt;
  }

  /** Car-centre height on the track (used for rendering). */
  groundHeight() {
    return this.proj.height;
  }
}

// -------------------------------------------------------------------------------------------
// Collisions
// -------------------------------------------------------------------------------------------

function circleCenters(v, out) {
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  out[0] = v.x + fx * v.circleOffset; out[1] = v.z + fz * v.circleOffset;
  out[2] = v.x - fx * v.circleOffset; out[3] = v.z - fz * v.circleOffset;
  return out;
}

const cA = new Float64Array(4);
const cB = new Float64Array(4);

/** Resolves car-vs-car contacts. Returns number of contacts (for tests/telemetry). */
export function collideVehicles(cars) {
  let contacts = 0;
  const n = cars.length;
  for (let i = 0; i < n; i++) {
    const A = cars[i];
    if (A.ghost > 0) continue;
    for (let j = i + 1; j < n; j++) {
      const B = cars[j];
      if (B.ghost > 0) continue;
      const reach = A.halfLength + B.halfLength + 0.5;
      const dx0 = A.x - B.x, dz0 = A.z - B.z;
      if (dx0 * dx0 + dz0 * dz0 > reach * reach) continue;
      circleCenters(A, cA);
      circleCenters(B, cB);
      for (let ia = 0; ia < 2; ia++) {
        for (let ib = 0; ib < 2; ib++) {
          const ax = cA[ia * 2], az = cA[ia * 2 + 1];
          const bx = cB[ib * 2], bz = cB[ib * 2 + 1];
          let dx = ax - bx, dz = az - bz;
          const rs = A.radius + B.radius;
          const d2 = dx * dx + dz * dz;
          if (d2 >= rs * rs) continue;
          const dist = Math.sqrt(d2) || 1e-4;
          const nx = dx / dist, nz = dz / dist;
          const pen = rs - dist;
          const mA = A.mass, mB = B.mass;
          const tot = mA + mB;
          A.x += nx * pen * (mB / tot); A.z += nz * pen * (mB / tot);
          B.x -= nx * pen * (mA / tot); B.z -= nz * pen * (mA / tot);
          // contact point between the circles
          const px = bx + nx * B.radius, pz = bz + nz * B.radius;
          resolveImpulse(A, B, px, pz, nx, nz, 0.25, 0.3);
          contacts++;
          // refresh centers after push
          circleCenters(A, cA);
          circleCenters(B, cB);
        }
      }
    }
  }
  return contacts;
}

function resolveImpulse(A, B, px, pz, nx, nz, restitution, friction) {
  const rAx = px - A.x, rAz = pz - A.z;
  const rBx = px - B.x, rBz = pz - B.z;
  // velocity of contact point: v + ω × r = (vx + ω rz, vz - ω rx)
  const vAx = A.vx + A.yawRate * rAz, vAz = A.vz - A.yawRate * rAx;
  const vBx = B.vx + B.yawRate * rBz, vBz = B.vz - B.yawRate * rBx;
  const rvx = vAx - vBx, rvz = vAz - vBz;
  const vn = rvx * nx + rvz * nz;
  if (vn >= 0) return;
  const rAn = rAz * nx - rAx * nz;
  const rBn = rBz * nx - rBx * nz;
  const invM = 1 / A.mass + 1 / B.mass + (rAn * rAn) / A.Iz + (rBn * rBn) / B.Iz;
  const j = (-(1 + restitution) * vn) / invM;
  A.vx += (j * nx) / A.mass; A.vz += (j * nz) / A.mass; A.yawRate += (j * rAn) / A.Iz;
  B.vx -= (j * nx) / B.mass; B.vz -= (j * nz) / B.mass; B.yawRate -= (j * rBn) / B.Iz;
  // friction
  const tx = rvx - vn * nx, tz = rvz - vn * nz;
  const tl = Math.hypot(tx, tz);
  if (tl > 1e-4) {
    const ux = tx / tl, uz = tz / tl;
    const rAt = rAz * ux - rAx * uz;
    const rBt = rBz * ux - rBx * uz;
    const invMt = 1 / A.mass + 1 / B.mass + (rAt * rAt) / A.Iz + (rBt * rBt) / B.Iz;
    const jt = Math.min(tl / invMt, friction * j);
    A.vx -= (jt * ux) / A.mass; A.vz -= (jt * uz) / A.mass; A.yawRate -= (jt * rAt) / A.Iz;
    B.vx += (jt * ux) / B.mass; B.vz += (jt * uz) / B.mass; B.yawRate += (jt * rBt) / B.Iz;
  }
  const hit = -vn;
  if (hit > A.impact) { A.impact = hit; A.impactX = px; A.impactZ = pz; }
  if (hit > B.impact) { B.impact = hit; B.impactX = px; B.impactZ = pz; }
}

/** Keeps a vehicle inside the barriers on both sides of the track. */
export function collideWalls(v, track) {
  const proj = v.proj;
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  const along = fx * proj.nx + fz * proj.nz; // forward component across the track
  let hitAny = false;
  for (let k = 0; k < 2; k++) {
    const off = k === 0 ? v.circleOffset : -v.circleOffset;
    const d = proj.d + off * along;
    const over = Math.abs(d) + v.radius - track.wallDist;
    if (over <= 0) continue;
    hitAny = true;
    const s = d > 0 ? 1 : -1;
    const nx = -s * proj.nx, nz = -s * proj.nz; // points back towards the track centre
    v.x += nx * over;
    v.z += nz * over;
    const cx = v.x + fx * off, cz = v.z + fz * off;
    const px = cx - nx * v.radius, pz = cz - nz * v.radius;
    const rx = px - v.x, rz = pz - v.z;
    const vpx = v.vx + v.yawRate * rz, vpz = v.vz - v.yawRate * rx;
    const vn = vpx * nx + vpz * nz;
    if (vn < 0) {
      const rn = rz * nx - rx * nz;
      const j = (-(1 + 0.18) * vn) / (1 / v.mass + (rn * rn) / v.Iz);
      v.vx += (j * nx) / v.mass; v.vz += (j * nz) / v.mass; v.yawRate += (j * rn) / v.Iz;
      const tx = vpx - vn * nx, tz = vpz - vn * nz;
      const tl = Math.hypot(tx, tz);
      if (tl > 1e-3) {
        const ux = tx / tl, uz = tz / tl;
        const rt = rz * ux - rx * uz;
        const jt = Math.min(tl / (1 / v.mass + (rt * rt) / v.Iz), 0.35 * j);
        v.vx -= (jt * ux) / v.mass; v.vz -= (jt * uz) / v.mass; v.yawRate -= (jt * rt) / v.Iz;
      }
      if (-vn > v.impact) { v.impact = -vn; v.impactX = px; v.impactZ = pz; }
      v.scrape = Math.max(v.scrape, tl);
    }
  }
  return hitAny;
}
