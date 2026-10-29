import * as THREE from 'three';
import { GRID } from './world.js';
import { Particles } from './effects.js';
import { concatGeometries, mulberry32 } from './util.js';

const OFFS = [-1.45, 0, 1.45];

function part(geo, hex, x = 0, y = 0, z = 0, rz = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const GEOS = {
  cone: () => concatGeometries([
    part(new THREE.BoxGeometry(0.6, 0.05, 0.6), 0xd84315, 0, 0.025, 0),
    part(new THREE.ConeGeometry(0.27, 0.72, 12), 0xff6d00, 0, 0.41, 0),
    part(new THREE.CylinderGeometry(0.165, 0.2, 0.12, 12), 0xf5f5f5, 0, 0.36, 0),
  ]),
  bin: () => concatGeometries([
    part(new THREE.CylinderGeometry(0.38, 0.32, 0.95, 14), 0x2e7d32, 0, 0.475, 0),
    part(new THREE.CylinderGeometry(0.41, 0.41, 0.08, 14), 0x1b5e20, 0, 0.99, 0),
    part(new THREE.BoxGeometry(0.3, 0.05, 0.06), 0xdddddd, 0, 0.8, 0.36),
  ]),
  hydrant: () => concatGeometries([
    part(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 12), 0x8e1b1b, 0, 0.03, 0),
    part(new THREE.CylinderGeometry(0.16, 0.19, 0.62, 12), 0xd32f2f, 0, 0.36, 0),
    part(new THREE.SphereGeometry(0.17, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xd32f2f, 0, 0.67, 0),
    part(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), 0xc0c0c0, 0, 0.47, 0, Math.PI / 2),
    part(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8), 0xc0c0c0, 0, 0.82, 0),
  ]),
};
const SPEC = { cone: { r: 0.32, mass: 0.25 }, bin: { r: 0.42, mass: 0.8 }, hydrant: { r: 0.28, mass: 2.5 } };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();

/** Knockable street furniture: traffic cones, trash bins and fire hydrants that burst into geysers. */
export class Props {
  constructor(game) {
    this.g = game;
    const w = game.world;
    const rnd = mulberry32(777);
    const list = { cone: [], bin: [], hydrant: [] };
    const lamps = w.lampPositions || [];
    const nearLamp = (x, z) => {
      for (let i = 0; i < lamps.length; i += 3) if (Math.abs(lamps[i] - x) < 2.5 && Math.abs(lamps[i + 2] - z) < 2.5) return true;
      return false;
    };
    const add = (type, x, z, rot) => {
      if (nearLamp(x, z)) return;
      list[type].push({ type, hx: x, hz: z, hrot: rot });
    };
    for (let bi = 0; bi < 8; bi++)
      for (let bj = 0; bj < 8; bj++) {
        if (w.special.get(bi + ',' + bj)) continue;
        const x0 = GRID[bi] + 6, x1 = GRID[bi + 1] - 6, z0 = GRID[bj] + 6, z1 = GRID[bj + 1] - 6;
        // one or two pieces of furniture per block side, just inside the curb
        for (const [side, ax, az, bx, bz, nx, nz] of [['n', x0, z0, x1, z0, 0, 1], ['s', x0, z1, x1, z1, 0, -1], ['w', x0, z0, x0, z1, 1, 0], ['e', x1, z0, x1, z1, -1, 0]]) {
          const n = rnd() < 0.7 ? 1 : 2;
          for (let k = 0; k < n; k++) {
            const t = 0.15 + rnd() * 0.7;
            const x = ax + (bx - ax) * t + nx * 0.6, z = az + (bz - az) * t + nz * 0.6;
            add(rnd() < 0.45 ? 'hydrant' : 'bin', x, z, Math.atan2(nx, nz));
          }
        }
      }
    // road works: a few rows of cones in the gutter
    for (let k = 0; k < 16; k++) {
      const alongX = rnd() < 0.5;
      const line = GRID[1 + Math.floor(rnd() * 7)], seg = Math.floor(rnd() * 8);
      const a = GRID[seg] + 20 + rnd() * 50, side = rnd() < 0.5 ? 1 : -1;
      for (let i = 0; i < 5; i++) {
        const u = a + i * 2.6;
        if (alongX) list.cone.push({ type: 'cone', hx: u, hz: line + side * 5.1, hrot: 0 });
        else list.cone.push({ type: 'cone', hx: line + side * 5.1, hz: u, hrot: 0 });
      }
    }
    this.items = [];
    this.meshes = {};
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 });
    for (const type of Object.keys(list)) {
      const arr = list[type];
      const mesh = new THREE.InstancedMesh(GEOS[type](), mat, arr.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      arr.forEach((it, i) => {
        Object.assign(it, SPEC[type], { idx: i, mesh, state: 'rest', x: it.hx, z: it.hz, y: w.heightAt(it.hx, it.hz) + 0.04, rx: 0, ry: it.hrot, rz: 0, t: 0 });
        this.items.push(it);
        this.write(it);
      });
      mesh.instanceMatrix.needsUpdate = true;
      game.scene.add(mesh);
      this.meshes[type] = mesh;
    }
    this.water = new Particles(game.scene, { max: 260, color: 0xd6ecff });
    this.geysers = [];
  }
  write(it) {
    _e.set(it.rx, it.ry, it.rz, 'YXZ');
    _q.setFromEuler(_e);
    _p.set(it.x, it.y, it.z);
    _m.compose(_p, _q, _s);
    it.mesh.setMatrixAt(it.idx, _m);
  }
  kick(it, vx, vz, sp) {
    const g = this.g;
    it.state = 'fly';
    it.vx = vx * (1.15 + Math.random() * 0.3) + (Math.random() - 0.5) * 3;
    it.vz = vz * (1.15 + Math.random() * 0.3) + (Math.random() - 0.5) * 3;
    it.vy = 2.5 + sp * (0.22 / it.mass) + Math.random() * 2;
    it.wx = (Math.random() - 0.5) * sp * 0.8;
    it.wz = (Math.random() - 0.5) * sp * 0.8;
    it.wy = (Math.random() - 0.5) * sp * 0.4;
    it.t = 0;
    const s = g.stats;
    s.smashed = (s.smashed || 0) + 1;
    g.addXp && g.addXp(2);
    if (it.type === 'cone') g.audio.burst(0.08, 1400, 'bandpass', 0.5);
    else if (it.type === 'bin') {
      g.audio.burst(0.25, 700, 'lowpass', 0.6);
      g.audio.tone(160, 0.2, 0.15, 'square');
    } else {
      g.audio.tone(320, 0.5, 0.2, 'triangle');
      g.audio.tone(470, 0.4, 0.12, 'triangle', 0.02);
      g.audio.burst(0.3, 600, 'lowpass', 0.6);
      this.geysers.push({ x: it.hx, z: it.hz, y: it.y - 0.04, t: 0, life: 18 });
      if (!this.hydrantToast || g.time - this.hydrantToast > 20) {
        this.hydrantToast = g.time;
        g.ui.toast('💦 شیر آتش‌نشانی رو شکوندی! آب فواره زد!', 'info');
      }
    }
  }
  update(dt) {
    const g = this.g, p = g.player, w = g.world;
    const driving = g.state === 'play' && !g.onfoot.active;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const vx = fx * p.speed + p.ext.x, vz = fz * p.speed + p.ext.y;
    const sp = Math.hypot(vx, vz);
    const dirty = new Set();
    for (const it of this.items) {
      const dx = it.x - p.pos.x, dz = it.z - p.pos.z;
      if (driving && !p.air && it.state !== 'fly' && dx * dx + dz * dz < 16) {
        for (const off of OFFS) {
          const cx = p.pos.x + fx * off, cz = p.pos.z + fz * off;
          const d = Math.hypot(it.x - cx, it.z - cz);
          if (d > 0.95 + it.r) continue;
          if (sp > 2.5) {
            this.kick(it, vx, vz, sp);
            p.speed *= 1 - Math.min(0.25, it.mass * 0.035);
            if (it.type === 'hydrant') p.health = Math.max(0, p.health - 1.5);
            if (g.rides.ride && it.type !== 'cone' && g.rides.state === 'toDest') g.rides.onCrash(4);
          } else {
            // slow nudge: just push it aside
            const k = (0.95 + it.r - d) / (d || 1);
            it.x += (it.x - cx) * k;
            it.z += (it.z - cz) * k;
            it.y = w.heightAt(it.x, it.z) + 0.04;
            if (it.state === 'rest') it.state = 'moved';
            dirty.add(it.mesh);
            this.write(it);
          }
          break;
        }
      }
      if (it.state === 'fly') {
        it.t += dt;
        it.vy -= 20 * dt;
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        it.z += it.vz * dt;
        it.rx += it.wx * dt;
        it.ry += it.wy * dt;
        it.rz += it.wz * dt;
        const gy = w.heightAt(it.x, it.z) + 0.04;
        if (it.y <= gy) {
          it.y = gy;
          if (it.vy < -3 && it.t < 4) {
            // bounce
            it.vy *= -0.3;
            it.vx *= 0.5;
            it.vz *= 0.5;
            it.wx *= 0.5;
            it.wz *= 0.5;
          } else {
            // come to rest lying on its side
            it.state = 'down';
            it.t = 0;
            it.rx = Math.PI / 2;
            it.rz = 0;
          }
        }
        dirty.add(it.mesh);
        this.write(it);
      } else if (it.state === 'down' || it.state === 'moved') {
        it.t += dt;
        // tidy up when the player is far away
        if (it.t > 45 && dx * dx + dz * dz > 90 * 90) {
          it.state = 'rest';
          it.x = it.hx;
          it.z = it.hz;
          it.y = w.heightAt(it.hx, it.hz) + 0.04;
          it.rx = it.rz = 0;
          it.ry = it.hrot;
          dirty.add(it.mesh);
          this.write(it);
        }
      }
    }
    for (const m of dirty) m.instanceMatrix.needsUpdate = true;
    // water geysers from broken hydrants
    let near = 0;
    for (let i = this.geysers.length - 1; i >= 0; i--) {
      const gz = this.geysers[i];
      gz.t += dt;
      const k = gz.t < gz.life - 3 ? 1 : Math.max(0, (gz.life - gz.t) / 3);
      for (let n = 0; n < 4 * k; n++) {
        this.water.emit(gz.x + (Math.random() - 0.5) * 0.2, gz.y + 0.6, gz.z + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 1.6, 9 + Math.random() * 4 * k, (Math.random() - 0.5) * 1.6, 1.5, 0.35, 2.5, 0.65, 0.2);
      }
      const d = Math.hypot(p.pos.x - gz.x, p.pos.z - gz.z);
      near = Math.max(near, k * Math.max(0, 1 - d / 40));
      // driving through the jet throws the car into the air!
      if (driving && k > 0.5 && d < 1.8 && !p.air && Math.abs(p.speed) < 22) {
        p.air = true;
        p.vy = 7.5;
        p.airT = 0;
        p.airMax = 0;
        g.ui.toast('💦 فواره ماشین رو پرت کرد هوا!', 'info');
      }
      if (gz.t > gz.life) this.geysers.splice(i, 1);
    }
    this.water.update(dt, 9.8);
    g.audio.setWater && g.audio.setWater(g.state === 'play' ? near : 0);
  }
}
