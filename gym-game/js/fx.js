'use strict';
/* Pooled additive particles (sparkles, dust, confetti) */

const SPARK_TEX = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 64);

class Particles {
  constructor(scene, max = 700, size = 0.22) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo = g;
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      size, map: SPARK_TEX, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -999;
  }

  emit(x, y, z, vx, vy, vz, color, life, grav) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    const o = i * 3;
    this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z;
    this.vel[o] = vx; this.vel[o + 1] = vy; this.vel[o + 2] = vz;
    this.base[o] = color.r; this.base[o + 1] = color.g; this.base[o + 2] = color.b;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grav[i] = grav;
  }

  burst(p, { count = 40, colors = ['#ffd34d'], speed = 4, up = 2, life = 1.1, grav = 6, spread = 0.3 } = {}) {
    const cols = colors.map((c) => new THREE.Color(c));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.emit(
        p.x + rand(-spread, spread), p.y + rand(-spread, spread), p.z + rand(-spread, spread),
        Math.cos(a) * s, up + Math.random() * up, Math.sin(a) * s,
        pick(cols), life * (0.6 + Math.random() * 0.6), grav,
      );
    }
  }

  ring(p, { count = 50, color = '#ffd34d', radius = 0.5, speed = 5, life = 0.8 } = {}) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      this.emit(p.x + Math.cos(a) * radius, p.y, p.z + Math.sin(a) * radius,
        Math.cos(a) * speed, rand(0.2, 1.2), Math.sin(a) * speed, c, life, 1);
    }
  }

  dust(p, count = 14) {
    const c = new THREE.Color('#8f8577');
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const s = rand(0.8, 2);
      this.emit(p.x, p.y + 0.05, p.z, Math.cos(a) * s, rand(0.3, 1.2), Math.sin(a) * s, c, rand(0.35, 0.6), 2);
    }
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      const o = i * 3;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[o + 1] = -999;
        this.col[o] = this.col[o + 1] = this.col[o + 2] = 0;
        continue;
      }
      this.vel[o + 1] -= this.grav[i] * dt;
      this.vel[o] *= 0.985; this.vel[o + 2] *= 0.985;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
      if (this.pos[o + 1] < 0.03) { this.pos[o + 1] = 0.03; this.vel[o + 1] *= -0.3; }
      const f = this.life[i] / this.maxLife[i];
      this.col[o] = this.base[o] * f;
      this.col[o + 1] = this.base[o + 1] * f;
      this.col[o + 2] = this.base[o + 2] * f;
    }
    if (any || this.dirty) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
    }
    this.dirty = any;
  }
}
