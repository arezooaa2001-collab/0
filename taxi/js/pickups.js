import * as THREE from 'three';
import { fa } from './util.js';

const COUNT = 50;

/** Spinning gold coins scattered on the roads: drive (or walk) through them. */
export class Pickups {
  constructor(game) {
    this.g = game;
    const geo = new THREE.CylinderGeometry(0.7, 0.7, 0.14, 24);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffc533, metalness: 0.9, roughness: 0.25, emissive: 0x6a4400, emissiveIntensity: 0.6 });
    this.mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    game.scene.add(this.mesh);
    this.items = [];
    for (let i = 0; i < COUNT; i++) this.items.push(this.place({}, null));
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.v = new THREE.Vector3();
    this.one = new THREE.Vector3(1, 1, 1);
    this.Y = new THREE.Vector3(0, 1, 0);
    this.t = 0;
  }
  /** puts a coin on a random road lane, away from `avoid` */
  place(it, avoid) {
    const w = this.g.world, G = w.graph;
    for (let k = 0; k < 50; k++) {
      const e = G.edges[Math.floor(Math.random() * G.edges.length)];
      const A = G.nodes[e.a], B = G.nodes[e.b];
      const t = 0.15 + Math.random() * 0.7;
      const side = Math.random() < 0.5 ? 1 : -1;
      const dx = (B.x - A.x) / e.len, dz = (B.z - A.z) / e.len;
      const x = A.x + (B.x - A.x) * t - dz * 3 * side, z = A.z + (B.z - A.z) * t + dx * 3 * side;
      if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < 250) continue;
      it.x = x;
      it.z = z;
      it.y = w.heightAt(x, z) + 1.1;
      it.phase = Math.random() * 6;
      return it;
    }
    return it;
  }
  update(dt) {
    const g = this.g;
    this.t += dt;
    const f = g.focus();
    const reach = f.onFoot ? 1.4 : 2.8;
    for (let i = 0; i < COUNT; i++) {
      const it = this.items[i];
      if (Math.hypot(f.pos.x - it.x, f.pos.z - it.z) < reach && Math.abs((g.player.y || 0) - it.y) < 4) {
        g.coins += 1;
        g.stats.coinsPicked = (g.stats.coinsPicked || 0) + 1;
        g.audio.cash();
        g.ui.toast(`🪙 +۱ سکه! (${fa(g.coins)})`, 'good');
        this.place(it, f.pos);
      }
      this.q.setFromAxisAngle(this.Y, this.t * 2.5 + it.phase);
      this.v.set(it.x, it.y + Math.sin(this.t * 2 + it.phase) * 0.18, it.z);
      this.m.compose(this.v, this.q, this.one);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
