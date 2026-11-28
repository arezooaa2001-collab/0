// سیستم ذرات با استخر ثابت: گردوخاک، جرقه، کانفتی، دود، برق
import * as THREE from 'three';

class Pool {
  constructor(count, additive, map, pr) {
    this.n = count;
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 4);
    this.size = new Float32Array(count);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.max = new Float32Array(count);
    this.s0 = new Float32Array(count);
    this.s1 = new Float32Array(count);
    this.grav = new Float32Array(count);
    this.drag = new Float32Array(count);
    this.a0 = new Float32Array(count);
    this.flut = new Float32Array(count);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    g.setAttribute('aColor', this.colAttr);
    g.setAttribute('aSize', this.sizeAttr);
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uMap: { value: map }, uPR: { value: pr } },
      vertexShader: /* glsl */ `
        attribute vec4 aColor; attribute float aSize; uniform float uPR; varying vec4 vC;
        void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPR * 520.0 / max(0.5, -mv.z); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying vec4 vC;
        void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a * t.a); if (gl_FragColor.a < 0.003) discard; }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav, drag, flut = 0) {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life;
    this.s0[i] = s0; this.s1[i] = s1;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.a0[i] = a;
    this.grav[i] = grav; this.drag[i] = drag; this.flut[i] = flut;
  }
  update(dt, t) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) {
        if (this.size[i] !== 0) { this.size[i] = 0; this.col[i * 4 + 3] = 0; }
        continue;
      }
      this.life[i] -= dt;
      const k = 1 - this.life[i] / this.max[i];
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= dr; this.vel[i * 3 + 2] *= dr;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt;
      if (this.flut[i]) {
        this.vel[i * 3] += Math.sin(t * 7 + i) * this.flut[i] * dt;
        this.vel[i * 3 + 2] += Math.cos(t * 6 + i * 1.3) * this.flut[i] * dt;
      }
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
      this.col[i * 4 + 3] = this.a0[i] * (k < 0.1 ? k / 0.1 : 1 - Math.pow((k - 0.1) / 0.9, 1.5));
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }
}

export class Particles {
  constructor(scene, sprites, quality, pixelRatio) {
    const q = quality.particles;
    this.q = q;
    this.add = new Pool(Math.floor(2400 * Math.max(0.5, q)), true, sprites.soft, pixelRatio);
    this.norm = new Pool(Math.floor(1600 * Math.max(0.5, q)), false, sprites.soft, pixelRatio);
    scene.add(this.add.points, this.norm.points);
    this.t = 0;
  }
  setPixelRatio(pr) {
    this.add.mat.uniforms.uPR.value = pr;
    this.norm.mat.uniforms.uPR.value = pr;
  }
  n(c) {
    return Math.max(1, Math.round(c * this.q));
  }
  dust(p, amount = 1, color = [0.85, 0.8, 0.72]) {
    for (let i = 0, c = this.n(10 * amount); i < c; i++) {
      const a = Math.random() * Math.PI * 2, s = 1.2 + Math.random() * 2.5 * amount;
      this.norm.spawn(p.x + Math.cos(a) * 0.2, p.y + 0.08, p.z + Math.sin(a) * 0.2, Math.cos(a) * s, 0.4 + Math.random() * 1.2, Math.sin(a) * s,
        0.5 + Math.random() * 0.5, 0.18, 0.75 + amount * 0.4, color[0], color[1], color[2], 0.45, -0.4, 3.5);
    }
  }
  step(p, color = [0.8, 0.78, 0.72]) {
    this.norm.spawn(p.x, p.y + 0.05, p.z, (Math.random() - 0.5) * 0.8, 0.3, (Math.random() - 0.5) * 0.8, 0.35, 0.12, 0.35, color[0], color[1], color[2], 0.28, 0, 4);
  }
  sparkle(p, color = [1, 0.85, 0.3], n = 14) {
    for (let i = 0, c = this.n(n); i < c; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(2 + Math.random() * 4);
      this.add.spawn(p.x, p.y, p.z, v.x, v.y, v.z, 0.4 + Math.random() * 0.5, 0.22, 0.02, color[0] * 2, color[1] * 2, color[2] * 2, 1, 5, 2.5);
    }
    this.add.spawn(p.x, p.y, p.z, 0, 0, 0, 0.3, 0.5, 1.6, color[0] * 1.5, color[1] * 1.5, color[2] * 1.5, 0.8, 0, 0);
  }
  burst(p, color, n = 60, speed = 9) {
    for (let i = 0, c = this.n(n); i < c; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      this.add.spawn(p.x, p.y, p.z, v.x, v.y + 3, v.z, 0.8 + Math.random() * 0.9, 0.3, 0.03, color[0] * 2.5, color[1] * 2.5, color[2] * 2.5, 1, 6, 1.4);
    }
  }
  ring(p, color, n = 40, speed = 7) {
    for (let i = 0, c = this.n(n); i < c; i++) {
      const a = (i / c) * Math.PI * 2;
      this.add.spawn(p.x, p.y + 0.15, p.z, Math.cos(a) * speed, 0.4, Math.sin(a) * speed, 0.6, 0.35, 0.05, color[0] * 2, color[1] * 2, color[2] * 2, 1, 0, 2.2);
    }
  }
  confetti(p, n = 120, spread = 6) {
    const cols = [[1, 0.3, 0.4], [0.3, 0.8, 1], [1, 0.85, 0.2], [0.5, 1, 0.4], [0.8, 0.4, 1], [1, 0.55, 0.2]];
    for (let i = 0, c = this.n(n); i < c; i++) {
      const col = cols[i % cols.length];
      this.norm.spawn(p.x + (Math.random() - 0.5) * spread, p.y + Math.random() * 2, p.z + (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * 7, 7 + Math.random() * 9, (Math.random() - 0.5) * 7, 2.5 + Math.random() * 2, 0.16, 0.12, col[0], col[1], col[2], 1, 6, 1.6, 10);
    }
  }
  poof(p, color = [1, 1, 1]) {
    for (let i = 0, c = this.n(22); i < c; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).normalize().multiplyScalar(1 + Math.random() * 3);
      this.norm.spawn(p.x, p.y + 0.9, p.z, v.x, v.y, v.z, 0.6 + Math.random() * 0.4, 0.35, 1.3, color[0], color[1], color[2], 0.55, -0.5, 3);
    }
    this.sparkle({ x: p.x, y: p.y + 1, z: p.z }, [0.7, 0.9, 1], 16);
  }
  zap(p) {
    for (let i = 0, c = this.n(40); i < c; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize().multiplyScalar(4 + Math.random() * 7);
      this.add.spawn(p.x, p.y + 1, p.z, v.x, v.y, v.z, 0.25 + Math.random() * 0.3, 0.14, 0.02, 3, 0.5, 0.6, 1, 2, 1);
    }
  }
  trail(p, color, size = 0.35) {
    this.add.spawn(p.x, p.y, p.z, 0, 0, 0, 0.35, size, 0.02, color[0], color[1], color[2], 0.6, 0, 0);
  }
  firework(p) {
    const cols = [[1, 0.4, 0.2], [0.3, 0.7, 1], [1, 0.9, 0.3], [0.8, 0.3, 1], [0.3, 1, 0.5]];
    const col = cols[Math.floor(Math.random() * cols.length)];
    this.burst(p, col, 80, 12);
  }
  update(dt) {
    this.t += dt;
    this.add.update(dt, this.t);
    this.norm.update(dt, this.t);
  }
}
