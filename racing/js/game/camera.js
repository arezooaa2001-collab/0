// Race cameras: spring-damped chase cameras, hood and bumper views, plus cinematic orbits for
// the grid intro and the finish.

import * as THREE from 'three';
import { damp, clamp, lerp, wrapAngle } from '../core/utils.js';

export const CAMERA_MODES = [
  { id: 'far', name: 'دنبال (دور)', dist: 7.6, height: 2.7, look: 1.15, fov: 62 },
  { id: 'near', name: 'دنبال (نزدیک)', dist: 5.4, height: 1.9, look: 1.0, fov: 64 },
  { id: 'hood', name: 'روی کاپوت', hood: true, fov: 72 },
  { id: 'bumper', name: 'سپر', bumper: true, fov: 76 },
];

export class RaceCamera {
  constructor(camera) {
    this.camera = camera;
    this.mode = 0;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.yaw = 0;
    this.shake = 0;
    this.fov = 62;
    this.cinematic = null;
    this.t = 0;
    this.initialized = false;
    this._tmp = new THREE.Vector3();
  }

  setMode(i) {
    this.mode = ((i % CAMERA_MODES.length) + CAMERA_MODES.length) % CAMERA_MODES.length;
    this.initialized = false;
  }

  next() {
    this.setMode(this.mode + 1);
    return CAMERA_MODES[this.mode];
  }

  /** Orbit around a point (intro / results). */
  startOrbit(center, radius, height, speed = 0.18) {
    this.cinematic = { center: center.clone(), radius, height, speed, angle: 0 };
  }

  stopOrbit() {
    this.cinematic = null;
    this.initialized = false;
  }

  addShake(v) {
    this.shake = Math.min(1.5, this.shake + v);
  }

  update(dt, v, opts = {}) {
    const cam = this.camera;
    this.t += dt;
    if (this.cinematic) {
      const c = this.cinematic;
      c.angle += c.speed * dt;
      if (opts.followCenter) c.center.lerp(opts.followCenter, 1 - Math.exp(-3 * dt));
      cam.position.set(c.center.x + Math.sin(c.angle) * c.radius, c.center.y + c.height, c.center.z + Math.cos(c.angle) * c.radius);
      cam.lookAt(c.center.x, c.center.y + 1, c.center.z);
      this.#setFov(55, dt, 4);
      return;
    }
    const m = CAMERA_MODES[this.mode];
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const groundY = v.proj.height;
    const speed = v.speed;
    if (m.hood || m.bumper) {
      const fwd = m.hood ? 0.25 : v.halfLength + 0.05;
      const up = m.hood ? 1.18 : 0.52;
      cam.position.set(v.x + fx * fwd, groundY + up + v.pitch * 0.4, v.z + fz * fwd);
      this.look.set(v.x + fx * 30, groundY + up - 0.2 + v.pitch * 2, v.z + fz * 30);
      cam.lookAt(this.look);
      cam.rotateZ(-v.roll * 0.6);
    } else {
      // camera yaw lags behind the car and blends towards the velocity direction when sliding
      let target = v.heading;
      if (speed > 6) {
        const velYaw = Math.atan2(v.vx, v.vz);
        const fwdDot = (v.vx * fx + v.vz * fz) / speed;
        if (fwdDot > 0.2) target = v.heading + wrapAngle(velYaw - v.heading) * 0.45;
      }
      if (!this.initialized) { this.yaw = target; }
      this.yaw += wrapAngle(target - this.yaw) * (1 - Math.exp(-(opts.reverseLook ? 12 : 5.5) * dt));
      const yaw = opts.reverseLook ? this.yaw + Math.PI : this.yaw;
      const dist = m.dist + clamp(speed / 60, 0, 1) * 1.1;
      const h = m.height + clamp(speed / 80, 0, 1) * 0.15;
      const desired = this._tmp.set(v.x - Math.sin(yaw) * dist, groundY + h, v.z - Math.cos(yaw) * dist);
      if (!this.initialized) {
        this.pos.copy(desired);
        this.initialized = true;
      } else {
        this.pos.x = damp(this.pos.x, desired.x, 14, dt);
        this.pos.z = damp(this.pos.z, desired.z, 14, dt);
        this.pos.y = damp(this.pos.y, desired.y, 7, dt);
      }
      // stay above the road surface on crests
      this.pos.y = Math.max(this.pos.y, groundY + 0.8);
      cam.position.copy(this.pos);
      this.look.set(v.x + fx * 2.2, groundY + m.look, v.z + fz * 2.2);
      cam.lookAt(this.look);
    }
    if (opts.shake && this.shake > 0.001) {
      const s = this.shake * 0.06;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      this.shake = damp(this.shake, 0, 5, dt);
    } else {
      this.shake = 0;
    }
    const fovTarget = m.fov + clamp(speed / 70, 0, 1) * 12 + (v.nitroActive ? 7 : 0);
    this.#setFov(fovTarget, dt, 3);
  }

  #setFov(target, dt, rate) {
    const f = lerp(this.camera.fov, target, 1 - Math.exp(-rate * dt));
    if (Math.abs(f - this.camera.fov) > 0.01) {
      this.camera.fov = f;
      this.camera.updateProjectionMatrix();
    }
  }
}
