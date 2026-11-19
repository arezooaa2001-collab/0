// Third-person camera: smooth follow, auto-align, speed FOV, collision, rail/loop/boss/underwater/interior modes,
// first-person (experimental), cinematic orbits, photo free-cam, shake.
import * as THREE from 'three';
import { G } from './game.js';
import { clamp, lerp, damp, dampAngle, angDiff } from './util.js';
import { heightAt, waterLevelAt } from './world/terrain.js';

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
export const CAM_MODES = ['follow', 'close', 'far', 'free', 'first'];

export class CameraRig {
  constructor(camera) {
    this.camera = camera; this.yaw = Math.PI; this.pitch = 0.26; this.dist = 6.5; this.zoom = 1;
    this.target = new THREE.Vector3(); this.pos = new THREE.Vector3(0, 10, 10);
    this.forwardXZ = new THREE.Vector3(0, 0, -1); this.rightXZ = new THREE.Vector3(1, 0, 0);
    this.shakeAmt = 0; this.manualT = 9; this.modeIndex = 0; this.mode = 'follow'; this.fov = 64; this.collideDist = 99;
    this.cine = null; this.photo = null; this.lookAtOverride = null; this.underwater = false; this.interior = 0;
  }
  get modeName() { return CAM_MODES[this.modeIndex]; }
  cycleMode() { this.modeIndex = (this.modeIndex + 1) % CAM_MODES.length; G.hud && G.hud.toast('cam_' + this.modeName, 'info'); }
  shake(a) { const s = G.settings.camera.shake * (G.settings.access.reduceMotion ? 0.25 : 1); this.shakeAmt = Math.min(1.2, this.shakeAmt + a * s); }
  snapBehind(p) { this.yaw = Math.atan2(-p.facing.x, -p.facing.z); this.target.copy(p.pos).y += 1.3; this.manualT = 9; this.updateVectors(); this.place(1e9, p); }
  reset() { if (G.player) { this.snapBehind(G.player); this.pitch = 0.26; this.zoom = 1; } }
  updateVectors() { const s = Math.sin(this.yaw), c = Math.cos(this.yaw); this.forwardXZ.set(-s, 0, -c); this.rightXZ.set(c, 0, -s); }
  cinematic(center, radius, height, duration, onDone, startAng) { this.cine = { center: center.clone(), radius, height, t: 0, duration, onDone, a0: startAng ?? this.yaw }; }

  update(dt, p) {
    const S = G.settings.camera, inp = G.input;
    const cam = this.camera;
    if (this.photo) return this.photoUpdate(dt);
    if (this.cine) {
      const c = this.cine; c.t += dt; const a = c.a0 + c.t * 0.5;
      cam.position.set(c.center.x + Math.sin(a) * c.radius, c.center.y + c.height, c.center.z + Math.cos(a) * c.radius);
      cam.lookAt(c.center); cam.fov = damp(cam.fov, 55, 3, dt); cam.updateProjectionMatrix();
      if (c.t >= c.duration) { this.cine = null; c.onDone && c.onDone(); this.snapBehind(p); }
      return;
    }
    // manual look input
    const sens = S.sens * 2.6;
    const lx = inp.look.x, ly = inp.look.y;
    if (Math.abs(lx) + Math.abs(ly) > 0.0001) { this.manualT = 0; this.yaw -= lx * sens; this.pitch = clamp(this.pitch + ly * sens * (S.invertY ? -1 : 1), -0.75, 1.25); }
    else this.manualT += dt;
    if (inp.zoom) { this.zoom = clamp(this.zoom * (1 + inp.zoom), 0.55, 2.0); }
    const mode = this.modeName;
    const speed = p.speed;
    // auto align behind movement direction
    const autoAlign = S.autoAlign && mode !== 'free';
    let behind = Math.atan2(-p.facing.x, -p.facing.z);
    if (p.mode === 'rail' || p.mode === 'ride') behind = Math.atan2(-p.heading.x, -p.heading.z);
    const boss = G.bosses && G.bosses.active;
    if (boss && boss.focus) { v1.copy(boss.focus).sub(p.pos); behind = Math.atan2(-v1.x, -v1.z); }
    if ((autoAlign && this.manualT > 0.7 && (speed > 3 || p.mode === 'rail')) || boss) {
      const k = boss ? 2.2 : p.mode === 'rail' || p.mode === 'ride' ? 4 : clamp(speed / 30, 0.15, 1) * 2.4;
      this.yaw = dampAngle(this.yaw, behind, k, dt);
      if (this.manualT > 1.5) this.pitch = damp(this.pitch, p.mode === 'air' && p.vel.y < -12 ? 0.5 : 0.22 + clamp(speed / 200, 0, 0.1), 1.5, dt);
    }
    this.updateVectors();
    // distance by mode / speed
    const base = (mode === 'close' ? 4.4 : mode === 'far' ? 9.5 : 6.2) * S.dist * this.zoom;
    let want = base + clamp(speed / 55, 0, 1) * 2.6 + (p.boosting ? 1.2 : 0) + (boss ? 6 : 0);
    // interior: low ceiling overhead
    this.interiorCheckT = (this.interiorCheckT || 0) - dt;
    if (this.interiorCheckT <= 0) { this.interiorCheckT = 0.25; v1.copy(p.pos).y += 1.2; const up = G.physics.raycast(v1, v2.set(0, 1, 0), 8, {}, false); this.interior = up < 7 ? 1 : 0; }
    if (this.interior) want = Math.min(want, 4.2);
    this.dist = damp(this.dist, want, 3, dt);
    // target follow: vertical motion smoothed more in the air (jump camera)
    const ty = p.container.position.y + 1.25 + (p.mode === 'ride' ? 0 : 0);
    const fk = lerp(36, 7, S.smooth);
    this.target.x = damp(this.target.x, p.container.position.x, fk, dt);
    this.target.z = damp(this.target.z, p.container.position.z, fk, dt);
    this.target.y = damp(this.target.y, ty, (p.mode === 'air' ? 5 : 14) * fk / 22, dt);
    if (Math.abs(this.target.x - p.pos.x) > 30 || Math.abs(this.target.z - p.pos.z) > 30) this.target.copy(p.pos).y += 1.25;
    if (mode === 'first') return this.firstPerson(dt, p);
    p.visual.visible = true;
    // loop mode: side view while on a loop
    if (p.mode === 'ride' && p.ride && p.ride.kind === 'loop' && p.ride.side) {
      const r = p.ride; v1.copy(r.center).addScaledVector(r.side, -(r.radius * 2.4 + 6)); v1.y += r.radius * 0.3;
      cam.position.lerp(v1, 1 - Math.exp(-5 * dt)); cam.lookAt(p.container.position);
      this.setFov(dt, speed, p, S); this.pos.copy(cam.position); return;
    }
    this.place(dt, p);
    this.setFov(dt, speed, p, S);
  }
  place(dt, p) {
    const cam = this.camera;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = v1.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
    // collision: ray from target toward desired camera spot
    const hitD = G.physics.raycast(this.target, dir, this.dist + 0.6, {}, true);
    const d = Math.max(1.4, Math.min(this.dist, hitD - 0.5));
    this.collideDist = d < this.collideDist ? d : damp(this.collideDist, d, 4, Math.min(dt, 1));
    const want = v2.copy(this.target).addScaledVector(dir, this.collideDist);
    const th = heightAt(want.x, want.z) + 0.6; if (want.y < th) want.y = th;
    if (dt > 100) cam.position.copy(want); else cam.position.copy(want);
    // shake
    if (this.shakeAmt > 0.001) {
      const t = G.realTime * 40; const a = this.shakeAmt * 0.35;
      cam.position.x += Math.sin(t * 1.1) * a; cam.position.y += Math.sin(t * 1.7 + 1) * a; cam.position.z += Math.cos(t * 1.3) * a;
      this.shakeAmt = Math.max(0, this.shakeAmt - (dt > 1 ? 1 : dt) * 2.2);
    }
    const look = v3.copy(this.target);
    const boss = G.bosses && G.bosses.active;
    if (boss && boss.focus) look.lerp(boss.focus, 0.3);
    cam.lookAt(look);
    this.pos.copy(cam.position);
    this.underwater = cam.position.y < waterLevelAt(cam.position.x, cam.position.z) - 0.1;
  }
  setFov(dt, speed, p, S) {
    let f = S.fov;
    if (S.speedFov && !G.settings.access.reduceMotion) f += clamp(speed / 60, 0, 1) * 12 + (p.boosting ? 10 : 0);
    this.camera.fov = damp(this.camera.fov, f, 4, dt); this.camera.updateProjectionMatrix();
  }
  firstPerson(dt, p) {
    const cam = this.camera; p.visual.visible = false;
    cam.position.copy(p.container.position).y += 1.05;
    const cp = Math.cos(this.pitch * 0.8);
    v1.set(-Math.sin(this.yaw) * cp, -Math.sin(this.pitch * 0.8) + 0.1, -Math.cos(this.yaw) * cp);
    cam.lookAt(v2.copy(cam.position).add(v1));
    if (this.manualT > 0.7 && p.speed > 3) this.yaw = dampAngle(this.yaw, Math.atan2(-p.facing.x, -p.facing.z), 3, dt);
    this.setFov(dt, p.speed, p, G.settings.camera);
    this.pos.copy(cam.position);
  }
  // ---- photo mode free camera ----
  startPhoto() { this.photo = { pos: this.camera.position.clone(), yaw: this.yaw, pitch: -this.pitch * 0.6 }; }
  stopPhoto() { this.photo = null; }
  photoUpdate(dt) {
    const ph = this.photo, inp = G.input, cam = this.camera;
    ph.yaw -= inp.look.x * 2.4; ph.pitch = clamp(ph.pitch - inp.look.y * 2.4, -1.4, 1.4);
    const f = v1.set(-Math.sin(ph.yaw) * Math.cos(ph.pitch), Math.sin(ph.pitch), -Math.cos(ph.yaw) * Math.cos(ph.pitch));
    const r = v2.set(Math.cos(ph.yaw), 0, -Math.sin(ph.yaw));
    const sp = (inp.held('boost') ? 30 : 8) * dt;
    ph.pos.addScaledVector(f, inp.move.y * sp).addScaledVector(r, inp.move.x * sp);
    if (inp.held('jump')) ph.pos.y += sp; if (inp.held('spin')) ph.pos.y -= sp;
    // keep the free camera near the player
    const P = G.player.pos; const off = v3.copy(ph.pos).sub(P); if (off.length() > 40) ph.pos.copy(P).addScaledVector(off.normalize(), 40);
    const th = heightAt(ph.pos.x, ph.pos.z) + 0.3; if (ph.pos.y < th) ph.pos.y = th;
    cam.position.copy(ph.pos); cam.lookAt(v3.copy(ph.pos).add(f));
  }
}
