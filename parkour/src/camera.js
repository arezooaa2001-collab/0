// دوربین سوم‌شخص نرم با فنر، تکان، تغییر FOV با سرعت، و حالت‌های سینمایی
import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp, easeInOutCubic } from './util.js';

const V3 = THREE.Vector3;

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.yaw = 0;
    this.pitch = 0.3;
    this.dist = 6.3;
    this.target = new V3();
    this.look = new V3();
    this.shakeAmt = 0;
    this.fov = 62;
    this.manualT = 10;
    this.mode = 'follow';
    this.t = 0;
    this.orbitCenter = new V3();
    this.fly = null;
  }
  snap(pos, yaw) {
    this.yaw = yaw;
    this.target.set(pos.x, pos.y + 1.55, pos.z);
    this.place(1);
  }
  shake(a) {
    this.shakeAmt = Math.max(this.shakeAmt, a);
  }
  place(k = 1) {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const desired = new V3(this.target.x - fx * this.dist * cp, this.target.y + this.dist * sp, this.target.z - fz * this.dist * cp);
    this.cam.position.lerp(desired, k);
  }

  update(dt, player, input, opts) {
    this.t += dt;
    if (this.mode === 'orbit') return this.updateOrbit(dt);
    if (this.mode === 'fly') return this.updateFly(dt);
    const sens = opts.sens || 1;
    if (input && (Math.abs(input.camDX) > 0.01 || Math.abs(input.camDY) > 0.01)) {
      this.yaw -= input.camDX * 0.0042 * sens;
      this.pitch += input.camDY * 0.0034 * sens * (opts.invertY ? -1 : 1);
      this.manualT = 0;
    } else this.manualT += dt;
    const hs = Math.hypot(player.vel.x, player.vel.z);
    const sn = clamp(hs / player.maxSpeed, 0, 1.4);
    // همراستا شدن خودکار پشت بازیکن
    if (this.manualT > 0.9 && hs > 1.2 && player.knockT <= 0) {
      const mvYaw = Math.atan2(player.vel.x, player.vel.z);
      const rate = (player.wall ? 3.5 : 1.7) * Math.min(1, sn) * Math.min(1, (this.manualT - 0.9) * 1.5);
      this.yaw = dampAngle(this.yaw, mvYaw, rate, dt);
    }
    const basePitch = opts.mode === 'down' ? 0.42 : opts.mode === 'up' ? 0.22 : 0.3;
    if (this.manualT > 2.5) this.pitch = damp(this.pitch, basePitch, 0.8, dt);
    this.pitch = clamp(this.pitch, -0.45, 1.25);
    const falling = !player.grounded && player.vel.y < -12;
    const wantDist = 6.2 * (opts.camDist || 1) + sn * 0.9 + (falling ? 1.5 : 0);
    this.dist = damp(this.dist, wantDist, 3, dt);
    // هدف: کمی جلوتر از بازیکن
    const tx = player.pos.x + player.vel.x * 0.08, tz = player.pos.z + player.vel.z * 0.08;
    const ty = player.pos.y + 1.55 + (player.slideT > 0 ? -0.5 : 0);
    this.target.x = damp(this.target.x, tx, 16, dt);
    this.target.z = damp(this.target.z, tz, 16, dt);
    const yl = player.grounded ? 9 : player.vel.y < -6 ? 14 : 5;
    this.target.y = damp(this.target.y, ty, yl, dt);
    this.place(1);
    // جلوگیری از رفتن دوربین زیر سکوی بازیکن
    if (player.grounded && this.cam.position.y < player.pos.y + 0.4) this.cam.position.y = player.pos.y + 0.4;
    // تکان
    if (this.shakeAmt > 0.001 && !opts.reduceMotion) {
      const s = this.shakeAmt;
      this.cam.position.x += (Math.sin(this.t * 61) + Math.sin(this.t * 37)) * 0.5 * s;
      this.cam.position.y += (Math.sin(this.t * 53) + Math.sin(this.t * 29)) * 0.5 * s;
    }
    this.shakeAmt = damp(this.shakeAmt, 0, 7, dt);
    this.look.copy(this.target);
    this.cam.lookAt(this.look);
    const fovT = 62 + (opts.reduceMotion ? 0 : sn * sn * 7 + (falling ? 6 : 0) + (player.slideT > 0 ? 4 : 0));
    this.fov = damp(this.fov, fovT, 4, dt);
    if (Math.abs(this.cam.fov - this.fov) > 0.01) {
      this.cam.fov = this.fov;
      this.cam.updateProjectionMatrix();
    }
  }

  startOrbit(center, radius = 9, height = 3.5, speed = 0.12) {
    this.mode = 'orbit';
    this.orbitCenter.copy(center);
    this.orbitR = radius;
    this.orbitH = height;
    this.orbitS = speed;
    this.orbitA = this.yaw + Math.PI;
  }
  updateOrbit(dt) {
    this.orbitA += dt * this.orbitS;
    const c = this.orbitCenter;
    const p = new V3(c.x + Math.sin(this.orbitA) * this.orbitR, c.y + this.orbitH + Math.sin(this.t * 0.3) * 0.6, c.z + Math.cos(this.orbitA) * this.orbitR);
    this.cam.position.lerp(p, 1 - Math.exp(-dt * 2.5));
    this.look.lerp(new V3(c.x, c.y + 1.2, c.z), 1 - Math.exp(-dt * 4));
    this.cam.lookAt(this.look);
    if (Math.abs(this.cam.fov - 55) > 0.05) { this.cam.fov = damp(this.cam.fov, 55, 3, dt); this.cam.updateProjectionMatrix(); }
  }
  // پرواز سینمایی روی مسیر قبل از شروع
  startFly(points, duration, onDone) {
    const pts = points.map((p) => new V3(p.x, p.y, p.z));
    this.fly = { curve: new THREE.CatmullRomCurve3(pts, false, 'centripetal'), T: duration, t: 0, onDone };
    this.mode = 'fly';
  }
  updateFly(dt) {
    const f = this.fly;
    f.t += dt;
    const k = easeInOutCubic(Math.min(1, f.t / f.T));
    const p = f.curve.getPointAt(k);
    const ahead = f.curve.getPointAt(Math.max(0, k - 0.06));
    const side = new V3().subVectors(p, ahead).normalize();
    const camPos = p.clone().add(new V3(side.z * 9, 7 + Math.sin(k * Math.PI) * 6, -side.x * 9));
    this.cam.position.lerp(camPos, f.t < 0.05 ? 1 : 1 - Math.exp(-dt * 5));
    this.look.lerp(p, f.t < 0.05 ? 1 : 1 - Math.exp(-dt * 6));
    this.cam.lookAt(this.look);
    if (Math.abs(this.cam.fov - 58) > 0.05) { this.cam.fov = 58; this.cam.updateProjectionMatrix(); }
    if (f.t >= f.T) {
      this.mode = 'follow';
      const cb = f.onDone;
      this.fly = null;
      cb && cb();
    }
  }
}
