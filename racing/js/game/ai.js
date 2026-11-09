// AI drivers. They drive the very same Vehicle model as the player (no cheating physics):
// pure-pursuit steering on a minimum-curvature racing line, a grip-aware speed profile,
// overtaking / side-by-side avoidance, mistakes, recovery and gentle rubber-banding.

import { clamp, lerp, damp } from '../core/utils.js';

const RHO = 1.2;

export class AIDriver {
  /**
   * @param {Vehicle} vehicle
   * @param {Track} track
   * @param {object} opts { skill (0.7..1), rng, aggression }
   */
  constructor(vehicle, track, opts) {
    this.v = vehicle;
    this.track = track;
    this.skill = opts.skill;
    this.rng = opts.rng;
    this.aggression = opts.aggression ?? 0.5;
    this.personalOffset = this.rng.range(-1.2, 1.2);
    this.offset = 0;
    this.avoid = 0;
    this.mistake = 0;
    this.mistakeTimer = this.rng.range(4, 14);
    this.stuckTimer = 0;
    this.recoverTimer = 0;
    this.launchDelay = this.rng.range(0.05, 0.45) * (1.3 - this.skill);
    this.rubber = 1;
    this.line = track.racingLine();
    const p = vehicle.p;
    const mu = 1.05 * p.grip * opts.roadGrip * opts.weatherGrip * 0.93;
    this.profile = track.speedProfile(mu, (0.5 * RHO * p.clA * 0.55) / p.mass, mu * 9.81 * Math.min(1, p.brake) * 0.82);
    this.targetSpeed = 0;
  }

  /**
   * Computes controls for this tick.
   * @param {number} dt
   * @param {Vehicle[]} others all vehicles (including self)
   * @param {object} ctx { started, raceTime, playerProgress, myProgress }
   */
  update(dt, others, ctx) {
    const v = this.v;
    const c = v.controls;
    const track = this.track;
    if (!ctx.started) {
      c.throttle = 0.35 + 0.3 * Math.sin(ctx.time * 3 + this.personalOffset * 4); // revving on the grid
      c.brake = 1;
      c.steer = 0;
      c.nitro = false;
      return;
    }
    if (ctx.raceTime < this.launchDelay) {
      c.throttle = 0; c.brake = 1;
      return;
    }

    const i = v.proj.index >= 0 ? v.proj.index : 0;
    const n = track.n;
    const u = v.u;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);

    // ----- recovery when stuck against a wall or facing the wrong way --------------------------
    const tdot = fx * v.proj.tx + fz * v.proj.tz;
    if (this.recoverTimer > 0) {
      this.recoverTimer -= dt;
      c.throttle = 0;
      c.brake = 0.9; // reverse gear engages automatically
      // reversing: steer so the nose swings back towards the direction of travel
      const trackHeading = Math.atan2(v.proj.tx, v.proj.tz);
      let e = v.heading - trackHeading;
      e = Math.atan2(Math.sin(e), Math.cos(e));
      c.steer = Math.abs(e) > 0.15 ? -Math.sign(e) : clamp(-v.proj.d * 0.2, -1, 1);
      c.nitro = false;
      c.handbrake = false;
      return;
    }
    if (Math.abs(u) < 1.5 && ctx.raceTime > 3) this.stuckTimer += dt;
    else this.stuckTimer = Math.max(0, this.stuckTimer - dt * 2);
    if (this.stuckTimer > 1.6) {
      this.stuckTimer = 0;
      this.recoverTimer = 1.1;
      this.stuckCount = (this.stuckCount || 0) + 1;
      return;
    }

    // ----- lateral planning ----------------------------------------------------------------
    const lookDist = clamp(7 + Math.abs(u) * 0.55, 8, 46);
    const ahead = Math.round(lookDist / track.ds);
    const j = (i + ahead) % n;
    const lineOff = this.line.offset[j];
    this.#planAvoidance(dt, others, fx, fz);
    const lim = track.halfWidth - 1.25;
    const wantOffset = clamp(lineOff * (0.75 + 0.25 * this.skill) + this.personalOffset * 0.35 + this.avoid, -lim, lim);
    this.offset = damp(this.offset, wantOffset, 2.2, dt);
    const tx = track.px[j] + track.nx[j] * this.offset;
    const tz = track.pz[j] + track.nz[j] * this.offset;
    // target in car frame (forward / left)
    const dx = tx - v.x, dz = tz - v.z;
    const lf = dx * fx + dz * fz;
    const ll = dx * fz - dz * fx;
    const ld2 = Math.max(4, lf * lf + ll * ll);
    const curvature = (2 * ll) / ld2;
    let steerAngle = Math.atan(curvature * v.L);
    // translate desired wheel angle into a steering input (negative wheel angle = right)
    const lock = v.p.steerLock / (1 + (Math.abs(u) / 30) ** 2 * 1.25);
    let steer = clamp(-steerAngle / Math.max(0.02, lock), -1, 1);
    if (lf < 0) steer = ll > 0 ? -1 : 1; // target behind us: turn hard towards it

    // ----- longitudinal planning -----------------------------------------------------------
    const react = Math.round(clamp(Math.abs(u) * 0.35, 2, 30) / track.ds);
    let vt = Infinity;
    for (let k = 0; k <= react; k += 2) vt = Math.min(vt, this.profile[(i + k) % n]);
    // the profile already includes braking zones; skill scales how close to the limit we drive
    const skillPace = this.skill;
    // rubber banding (subtle): keeps the field together without feeling unfair
    const gap = ctx.myProgress - ctx.playerProgress;
    const rubberTarget = gap > 120 ? 0.97 : gap < -160 ? 1.03 : 1;
    this.rubber = damp(this.rubber, rubberTarget, 0.4, dt);
    // occasional mistakes (late braking / running wide), rarer for skilled drivers
    this.mistakeTimer -= dt;
    if (this.mistakeTimer <= 0) {
      this.mistakeTimer = this.rng.range(6, 20) * (0.6 + this.skill);
      if (this.rng.chance(0.55 - this.skill * 0.4)) this.mistake = this.rng.range(0.6, 1.4);
    }
    let pace = skillPace * this.rubber;
    if (this.mistake > 0) {
      this.mistake -= dt;
      pace *= 1.07;
    }
    if (v.surface === 2) pace *= 0.9;
    // far from the planned line (pushed wide, after contact): slow down to regain it
    const lineErr = Math.abs(v.proj.d - this.offset);
    if (lineErr > 2.5) pace *= clamp(1 - (lineErr - 2.5) * 0.045, 0.62, 1);
    if (Math.abs(v.proj.d) > track.halfWidth + 1) pace *= 0.9;
    vt *= pace;
    vt = Math.min(vt, this.blockSpeed ?? Infinity);
    this.targetSpeed = vt;

    const err = vt - u;
    let throttle = 0, brake = 0;
    if (err > 0) throttle = clamp(0.35 + err * 0.35, 0, 1);
    else if (err < -1.2) brake = clamp((-err - 1.2) * 0.22, 0, 1);
    else throttle = 0.25;
    // traction-aware throttle on exit
    if (Math.abs(v.slipR) > 0.16 || Math.abs(v.slipF) > 0.17) throttle *= 0.6;
    if (Math.abs(tdot) < 0.3 && Math.abs(u) > 5) throttle *= 0.5;

    // nitro on long straights when far from the limit
    const straight = vt > u + 8 && Math.abs(steer) < 0.15 && v.nitroLevel > 0.25;
    c.nitro = straight && u > 18 && this.aggression > 1.15 - this.skill;
    c.throttle = throttle;
    c.brake = brake;
    c.handbrake = false;
    c.steer = lerp(c.steer, steer, 1 - Math.exp(-14 * dt));
  }

  /** Looks for cars ahead/beside and shifts the lateral target to pass or avoid them. */
  #planAvoidance(dt, others, fx, fz) {
    const v = this.v;
    let push = 0;
    let block = Infinity;
    for (const o of others) {
      if (o === v) continue;
      const dx = o.x - v.x, dz = o.z - v.z;
      const fwd = dx * fx + dz * fz;
      if (fwd < -6 || fwd > 30) continue;
      const side = dx * fz - dz * fx; // + = left
      if (Math.abs(side) > 4.2) continue;
      const closing = v.u - o.u;
      if (fwd > 2.5) {
        // car ahead in our lane
        if (Math.abs(side) < 2.4 && closing > -1) {
          const d = v.proj.d;
          const roomLeft = this.track.halfWidth - 1.5 - d;
          const roomRight = this.track.halfWidth - 1.5 + d;
          let dir = side > 0 ? -1 : 1; // move away from the car in front
          if (dir > 0 && roomLeft < 2.5) dir = -1;
          else if (dir < 0 && roomRight < 2.5) dir = 1;
          const room = dir > 0 ? roomLeft : roomRight;
          push += dir * (3.1 - Math.abs(side)) * clamp(1.15 - fwd / 30, 0, 1) * 1.8;
          // only match the other car's speed when a pass is impossible or contact is imminent
          const safeGap = 4.5 + Math.max(0, closing) * 0.75;
          if ((room < 2.5 && fwd < 14) || (fwd < safeGap && Math.abs(side) < 2.0)) {
            block = Math.min(block, o.u - 0.3 + Math.max(0, fwd - 4) * 0.7);
          }
        }
      } else {
        // alongside: keep a car's width apart
        if (Math.abs(side) < 2.9) push += (side > 0 ? -1 : 1) * (2.9 - Math.abs(side)) * 1.5;
      }
    }
    this.avoid = damp(this.avoid, clamp(push, -4, 4), 3, dt);
    this.blockSpeed = block;
  }
}
