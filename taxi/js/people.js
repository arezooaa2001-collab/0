import * as THREE from 'three';
import { buildPerson, poseWalk, poseIdle, poseWave, poseAngry, posePhone, poseHandsUp, poseSit } from './models.js';
import { dampAngle, rr } from './util.js';
import { GRID } from './world.js';

export class Walker {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.opts = opts;
    this.p = buildPerson(opts);
    this.root = this.p.root;
    // only torso/legs cast shadows
    this.root.traverse((o) => { if (o.isMesh) o.castShadow = o.parent === this.p.spine || o.parent === this.p.hpL || o.parent === this.p.hpR; });
    scene.add(this.root);
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.target = null;
    this.speed = 1.4;
    this.mode = 'idle';
    this.t = Math.random() * 10;
    this.handsUp = false;
    this.attached = false;
    this.face = null;
  }
  setPos(x, z, heading = this.heading) {
    this.pos.set(x, 0, z);
    this.heading = heading;
  }
  walkTo(x, z, speed = 1.4, onArrive = null) {
    this.target = { x, z };
    this.speed = speed;
    this.onArrive = onArrive;
    this.mode = 'walk';
  }
  lookAt(x, z) {
    this.face = { x, z };
  }
  update(dt, world) {
    this.t += dt;
    if (this.attached) return;
    const p = this.p;
    if (this.mode === 'walk' && this.target) {
      const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.25) {
        this.mode = 'idle';
        const cb = this.onArrive;
        this.onArrive = null;
        this.target = null;
        if (cb) cb(this);
      } else {
        this.heading = dampAngle(this.heading, Math.atan2(dx, dz), 8, dt);
        const s = Math.min(this.speed, d * 3);
        this.pos.x += Math.sin(this.heading) * s * dt;
        this.pos.z += Math.cos(this.heading) * s * dt;
        if (this.handsUp) poseHandsUp(p, this.t, s, dt);
        else poseWalk(p, dt, s);
      }
    }
    if (this.mode !== 'walk') {
      if (this.face) this.heading = dampAngle(this.heading, Math.atan2(this.face.x - this.pos.x, this.face.z - this.pos.z), 5, dt);
      if (this.mode === 'idle') this.handsUp ? poseHandsUp(p, this.t) : poseIdle(p, this.t);
      else if (this.mode === 'wave') poseWave(p, this.t);
      else if (this.mode === 'angry') poseAngry(p, this.t);
      else if (this.mode === 'phone') posePhone(p, this.t);
    }
    this.root.position.set(this.pos.x, world.heightAt(this.pos.x, this.pos.z) + 0.03, this.pos.z);
    this.root.rotation.y = this.heading;
  }
  /** parent into a car at a seat (local position) */
  sitIn(group, seat, headingLocal = 0) {
    this.attached = true;
    poseSit(this.p);
    group.add(this.root);
    this.root.position.copy(seat);
    this.root.rotation.set(0, headingLocal, 0);
  }
  standOut(x, z, heading) {
    this.attached = false;
    this.scene.add(this.root);
    this.root.rotation.set(0, heading, 0);
    this.setPos(x, z, heading);
    poseIdle(this.p, 0);
  }
  dispose() {
    if (this.root.parent) this.root.parent.remove(this.root);
  }
}

/** sidewalk pedestrians walking around city blocks */
export class Pedestrians {
  constructor(game, count = 14) {
    this.game = game;
    this.list = [];
    for (let i = 0; i < count; i++) {
      const w = new Walker(game.scene);
      w.root.visible = false;
      w.active = false;
      this.list.push(w);
    }
  }
  corners(bi, bj) {
    const o = 7.9;
    const x0 = GRID[bi] + o, x1 = GRID[bi + 1] - o, z0 = GRID[bj] + o, z1 = GRID[bj + 1] - o;
    return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  }
  spawn(w, near) {
    const bi = Math.max(0, Math.min(7, Math.floor((near.x + 400) / 100) + Math.floor(rr(-1.5, 2.5, Math.random))));
    const bj = Math.max(0, Math.min(7, Math.floor((near.z + 400) / 100) + Math.floor(rr(-1.5, 2.5, Math.random))));
    const cs = this.corners(bi, bj);
    const k = Math.floor(Math.random() * 4);
    const t = Math.random();
    const a = cs[k], b = cs[(k + 1) % 4];
    w.setPos(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
    w.cs = cs;
    w.dir = Math.random() < 0.5 ? 1 : -1;
    w.k = w.dir > 0 ? (k + 1) % 4 : k;
    w.active = true;
    w.root.visible = true;
    w.speed = rr(1.0, 1.6, Math.random);
    const c = w.cs[w.k];
    w.walkTo(c[0], c[1], w.speed);
  }
  update(dt) {
    const g = this.game;
    const p = g.player.pos;
    const inCity = Math.abs(p.x) < 520 && Math.abs(p.z) < 520;
    for (const w of this.list) {
      if (!w.active) {
        if (inCity) this.spawn(w, p);
        continue;
      }
      const d = Math.hypot(w.pos.x - p.x, w.pos.z - p.z);
      if (d > 230) {
        if (inCity) this.spawn(w, p);
        else {
          w.active = false;
          w.root.visible = false;
        }
        continue;
      }
      if (w.mode !== 'walk') {
        w.k = (w.k + w.dir + 4) % 4;
        const c = w.cs[w.k];
        w.walkTo(c[0], c[1], w.speed);
      }
      // dodge the taxi
      const cx = w.pos.x - p.x, cz = w.pos.z - p.z;
      const cd = Math.hypot(cx, cz);
      if (cd < 3.2 && cd > 0.01) {
        w.pos.x += (cx / cd) * (3.2 - cd);
        w.pos.z += (cz / cd) * (3.2 - cd);
      }
      if (d < 150) w.update(dt, g.world);
      w.root.visible = d < 150;
    }
  }
}
