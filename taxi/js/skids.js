import * as THREE from 'three';

const N = 900; // segments in the ring buffer

/** Tyre marks left on the ground while drifting, handbraking or braking hard. */
export class Skids {
  constructor(game) {
    this.g = game;
    this.pos = new Float32Array(N * 4 * 3);
    const idx = new Uint16Array(N * 6);
    for (let i = 0; i < N; i++) {
      const v = i * 4, k = i * 6;
      idx[k] = v; idx[k + 1] = v + 1; idx[k + 2] = v + 2;
      idx[k + 3] = v + 2; idx[k + 4] = v + 1; idx[k + 5] = v + 3;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geo = geo;
    const mat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    game.scene.add(this.mesh);
    this.next = 0;
    this.last = [null, null];
    this.dirty = false;
  }
  segment(a, b, w) {
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
    const nx = (-dz / l) * w, nz = (dx / l) * w;
    const P = this.pos, o = this.next * 12;
    P[o] = a.x + nx; P[o + 1] = a.y; P[o + 2] = a.z + nz;
    P[o + 3] = a.x - nx; P[o + 4] = a.y; P[o + 5] = a.z - nz;
    P[o + 6] = b.x + nx; P[o + 7] = b.y; P[o + 8] = b.z + nz;
    P[o + 9] = b.x - nx; P[o + 10] = b.y; P[o + 11] = b.z - nz;
    this.next = (this.next + 1) % N;
    this.dirty = true;
  }
  update() {
    const g = this.g, p = g.player;
    const sp = Math.abs(p.speed), ext = Math.hypot(p.ext.x, p.ext.y);
    const inp = g.lastInput || {};
    const marking = g.state === 'play' && !g.onfoot.active && !p.air &&
      ((p.sliding && sp + ext > 4) || (inp.handbrake && sp > 4) || (inp.brake > 0.8 && sp > 12) || ext > 3.5 || (p.nitroOn && sp < 14));
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const rear = (p.car.P.wheelZ || 1.4) - 0.05;
    for (let i = 0; i < 2; i++) {
      if (!marking) {
        this.last[i] = null;
        continue;
      }
      const side = i ? 0.74 : -0.74;
      const x = p.pos.x - fx * rear - fz * side, z = p.pos.z - fz * rear + fx * side;
      const cur = { x, z, y: g.world.heightAt(x, z) + 0.04 };
      const l = this.last[i];
      if (!l) this.last[i] = cur;
      else if (Math.hypot(cur.x - l.x, cur.z - l.z) > 0.45) {
        if (Math.hypot(cur.x - l.x, cur.z - l.z) < 4) this.segment(l, cur, 0.13);
        this.last[i] = cur;
      }
    }
    if (this.dirty) {
      this.geo.attributes.position.needsUpdate = true;
      this.dirty = false;
    }
    return marking;
  }
}
