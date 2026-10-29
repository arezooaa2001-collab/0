import * as THREE from 'three';
import { buildCar } from './models.js';
import { clamp, damp, wrapAngle, pick } from './util.js';
import { LANE } from './world.js';

const COLORS = [0xf4f4f2, 0xbfc3c8, 0x1c1d20, 0x8c1c1c, 0x1f3f7a, 0x2f5a3a, 0x6a6e74, 0xd8d0b8, 0x7a1f3f, 0x2a6aa8];
const OFFS = [-1.45, 0, 1.45];

export class TrafficCar {
  constructor(mgr, tpl) {
    this.mgr = mgr;
    this.group = tpl.clone();
    this.group.rotation.order = 'YXZ';
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.queue = [];
    this.active = false;
    this.state = 'drive';
    this.knock = new THREE.Vector2();
    this.spin = 0;
    this.isPolice = false;
    this.hitTimer = 0;
    this.persona = 1;
    this.group.visible = false;
    mgr.game.scene.add(this.group);
  }
  circles(out) {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    for (let i = 0; i < 3; i++) {
      out[i * 2] = this.pos.x + fx * OFFS[i];
      out[i * 2 + 1] = this.pos.z + fz * OFFS[i];
    }
    return out;
  }
  push(dx, dz) {
    this.pos.x += dx;
    this.pos.z += dz;
  }
  hit(jx, jz, impact, by) {
    this.knock.x += jx;
    this.knock.y += jz;
    if (this.isRival) {
      // a racing rival shrugs off light bumps
      this.speed *= Math.max(0.6, 1 - impact * 0.03);
      return;
    }
    this.spin += (Math.random() - 0.5) * impact * 0.15;
    this.speed *= 0.2;
    if (this.state !== 'incident' && this.state !== 'parked') {
      this.state = 'hit';
      this.hitTimer = 2.5;
    }
    this.mgr.onHit(this, impact, by);
  }
  spawnOn(edgeId, fromNode, t = 0) {
    const G = this.mgr.world.graph;
    const e = G.edges[edgeId];
    this.queue.length = 0;
    this.lastEdge = e;
    this.lastNode = fromNode;
    this.pushEdge(e, fromNode);
    const A = G.nodes[fromNode], B = G.nodes[G.other(e, fromNode)];
    const dx = (B.x - A.x) / e.len, dz = (B.z - A.z) / e.len;
    this.pos.set(A.x + (B.x - A.x) * t - dz * LANE, 0, A.z + (B.z - A.z) * t + dx * LANE);
    this.heading = Math.atan2(dx, dz);
    // drop queue points already behind us
    while (this.queue.length > 1) {
      const q = this.queue[0];
      const f = (q.x - this.pos.x) * dx + (q.z - this.pos.z) * dz;
      if (f < 1) this.queue.shift();
      else break;
    }
    this.speed = e.road.type === 'city' ? 8 : 15;
    this.active = true;
    this.state = 'drive';
    this.knock.set(0, 0);
    this.spin = 0;
    this.persona = 0.85 + Math.random() * 0.3;
    this.group.visible = true;
  }
  pushEdge(e, from) {
    const G = this.mgr.world.graph;
    const to = G.other(e, from);
    const A = G.nodes[from], B = G.nodes[to];
    const dx = (B.x - A.x) / e.len, dz = (B.z - A.z) / e.len;
    const rx = -dz * LANE, rz = dx * LANE;
    const insA = A.inter ? (A.city ? 8.5 : 7) : 0;
    const insB = B.inter ? (B.city ? 8.5 : 7) : 0;
    this.queue.push({ x: A.x + dx * insA + rx, z: A.z + dz * insA + rz, dx, dz });
    this.queue.push({ x: B.x - dx * insB + rx, z: B.z - dz * insB + rz, dx, dz, node: B.light ? B : null, axis: Math.abs(dx) > Math.abs(dz) ? 'x' : 'z' });
    this.lastEdge = e;
    this.lastNode = to;
  }
  extend() {
    const G = this.mgr.world.graph;
    const n = G.nodes[this.lastNode];
    let opts = n.edges.filter((id) => G.edges[id] !== this.lastEdge);
    if (!opts.length) opts = [this.lastEdge.id];
    let pickId;
    if (opts.length > 1) {
      // prefer going straight
      const ld = this.queue[this.queue.length - 1];
      let best = null, bd = -2;
      for (const id of opts) {
        const e = G.edges[id];
        const o = G.nodes[G.other(e, this.lastNode)];
        const d = ((o.x - n.x) * ld.dx + (o.z - n.z) * ld.dz) / e.len;
        if (d > bd) { bd = d; best = id; }
      }
      pickId = Math.random() < 0.55 ? best : pick(opts);
    } else pickId = opts[0];
    this.pushEdge(G.edges[pickId], this.lastNode);
  }
  update(dt, time) {
    const mgr = this.mgr;
    const world = mgr.world;
    if (this.state === 'hit' || this.state === 'incident' || this.state === 'parked') {
      this.pos.x += this.knock.x * dt;
      this.pos.z += this.knock.y * dt;
      this.heading += this.spin * dt;
      this.knock.x = damp(this.knock.x, 0, 2.5, dt);
      this.knock.y = damp(this.knock.y, 0, 2.5, dt);
      this.spin = damp(this.spin, 0, 2.5, dt);
      this.speed = damp(this.speed, 0, 3, dt);
      if (this.state === 'hit') {
        this.hitTimer -= dt;
        if (this.hitTimer <= 0) this.state = 'drive';
      }
      this.sync(dt);
      return;
    }
    while (this.queue.length < 4) this.extend();
    let tgt = this.queue[0];
    const dxT = tgt.x - this.pos.x, dzT = tgt.z - this.pos.z;
    const dist = Math.hypot(dxT, dzT);
    const isCity = this.lastEdge.road.type === 'city';
    let target = (isCity ? 12.5 : 21) * this.persona;
    // traffic light
    let holdAtLight = false;
    if (tgt.node) {
      const st = world.lightState(tgt.node, tgt.axis, time);
      if ((st === 'r' || (st === 'y' && dist > 14)) && dist < 45) {
        target = Math.min(target, Math.max(0, (dist - 1.5) * 0.55));
        holdAtLight = true;
      }
    }
    // corner slowdown
    const nxt = this.queue[1];
    if (nxt && dist < 28) {
      const ang = Math.abs(wrapAngle(Math.atan2(nxt.x - tgt.x, nxt.z - tgt.z) - Math.atan2(tgt.dx, tgt.dz)));
      if (ang > 0.3) target = Math.min(target, 13 - ang * 6);
    }
    // vehicles ahead
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    for (const o of mgr.obstacles) {
      if (o === this) continue;
      const rx = o.pos.x - this.pos.x, rz = o.pos.z - this.pos.z;
      const f = rx * fx + rz * fz;
      if (f <= 0 || f > 32) continue;
      const l = Math.abs(rx * fz - rz * fx);
      if (l > 2.3) continue;
      const gap = f - 4.8;
      target = Math.min(target, Math.max(0, gap - 1.5) * 0.85);
    }
    const acc = target > this.speed ? 2.8 : 8;
    this.speed = damp(this.speed, Math.max(0, target), acc * 0.5, dt);
    if (target <= 0.05 && this.speed < 0.5) this.speed = Math.max(0, this.speed - 4 * dt);

    const desired = Math.atan2(dxT, dzT);
    const err = wrapAngle(desired - this.heading);
    const maxRate = this.speed / 4.2 + 0.15;
    this.heading += clamp(err * 3.2, -maxRate, maxRate) * dt;
    this.pos.x += fx * this.speed * dt;
    this.pos.z += fz * this.speed * dt;
    const reach = Math.max(2.4, this.speed * 0.3);
    const ahead = (tgt.x - this.pos.x) * tgt.dx + (tgt.z - this.pos.z) * tgt.dz;
    if (!holdAtLight && (dist < reach || ahead < -1)) this.queue.shift();
    this.sync(dt);
  }
  sync(dt) {
    const w = this.mgr.world;
    const y = w.heightAt(this.pos.x, this.pos.z);
    this.group.position.set(this.pos.x, y, this.pos.z);
    this.group.rotation.set(0, this.heading, 0);
  }
  deactivate() {
    this.active = false;
    this.group.visible = false;
  }
}

export class Traffic {
  constructor(game, count = 26) {
    this.game = game;
    this.world = game.world;
    this.templates = [];
    for (let i = 0; i < 12; i++) {
      const type = i < 7 ? 'sedan' : i < 10 ? 'hatch' : 'van';
      const color = type === 'van' ? pick([0xf4f4f2, 0xd8d0b8, 0x2a6aa8]) : COLORS[i % COLORS.length];
      this.templates.push(buildCar({ type, color }).root);
    }
    this.cars = [];
    for (let i = 0; i < count; i++) this.cars.push(new TrafficCar(this, this.templates[i % this.templates.length]));
    this.obstacles = [];
    this.spawnTimer = 0;
  }
  setCount(n) {
    this.limit = n;
  }
  spawnNear(p, minD, maxD) {
    const car = this.cars.find((c) => !c.active);
    if (!car) return;
    const G = this.world.graph;
    for (let k = 0; k < 40; k++) {
      const e = G.edges[Math.floor(Math.random() * G.edges.length)];
      const A = G.nodes[e.a], B = G.nodes[e.b];
      const t = 0.2 + Math.random() * 0.6;
      const x = A.x + (B.x - A.x) * t, z = A.z + (B.z - A.z) * t;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < minD || d > maxD) continue;
      // keep away from other cars
      if (this.cars.some((c) => c.active && Math.hypot(c.pos.x - x, c.pos.z - z) < 14)) continue;
      const from = Math.random() < 0.5 ? e.a : e.b;
      car.spawnOn(e.id, from, from === e.a ? t : 1 - t);
      return;
    }
  }
  /** clear the road around a point (race start line) */
  clearAround(x, z, r) {
    for (const c of this.cars) if (c.active && c.state !== 'incident' && Math.hypot(c.pos.x - x, c.pos.z - z) < r) c.deactivate();
  }
  init(p) {
    for (let i = 0; i < this.cars.length * 0.8; i++) this.spawnNear(p, 30, 320);
  }
  onHit(car, impact, by) {
    if (car.isTarget) {
      if (by === this.game.player) this.game.rides.onTargetHit();
      return;
    }
    if (by === this.game.player && !car.isPolice && !car.isRival) this.game.onTrafficHit(car, impact);
  }
  update(dt, time) {
    const p = this.game.player.pos;
    const obs = this.obstacles;
    obs.length = 0;
    for (const c of this.cars) if (c.active) obs.push(c);
    obs.push(this.game.player);
    if (this.game.onfoot && this.game.onfoot.active) obs.push(this.game.onfoot.walker);
    if (this.game.police.unit && this.game.police.unit.active) obs.push(this.game.police.unit);
    const rv = this.game.race && this.game.race.rival;
    if (rv && rv.active) obs.push(rv);
    const tg = this.game.rides && this.game.rides.target;
    if (tg && tg.active) obs.push(tg);
    const limit = this.limit ?? this.cars.length;
    let active = 0;
    for (const c of this.cars) {
      if (!c.active) continue;
      const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
      if (d > 430 && c.state !== 'incident') {
        c.deactivate();
        continue;
      }
      active++;
      c.update(dt, time);
    }
    this.spawnTimer -= dt;
    if (active < limit && this.spawnTimer <= 0) {
      this.spawnNear(p, 150, 340);
      this.spawnTimer = 0.25;
    }
  }
  dynamics() {
    return this.obstacles;
  }
}
