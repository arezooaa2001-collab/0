// Particles (tyre smoke, dust, spray, sparks, backfire) and dynamic skid marks.

import * as THREE from 'three';
import { smokeTexture, glowTexture } from './textures.js';

const PARTICLE_VS = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  attribute float aRot;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vRot;
  #include <fog_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uScale / max(0.5, -mvPosition.z);
    vAlpha = aAlpha;
    vColor = aColor;
    vRot = aRot;
    #include <fog_vertex>
  }`;

const PARTICLE_FS = /* glsl */ `
  uniform sampler2D map;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vRot;
  #include <fog_pars_fragment>
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float s = sin(vRot), co = cos(vRot);
    c = mat2(co, -s, s, co) * c + 0.5;
    vec4 t = texture2D(map, c);
    gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
    if (gl_FragColor.a < 0.004) discard;
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

class ParticlePool {
  constructor(max, texture, blending) {
    this.max = Math.max(16, max);
    const n = this.max;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n).fill(1);
    this.size0 = new Float32Array(n);
    this.size1 = new Float32Array(n);
    this.alpha0 = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.spin = new Float32Array(n);
    this.sizeAttr = new Float32Array(n);
    this.alphaAttr = new Float32Array(n);
    this.colorAttr = new Float32Array(n * 3);
    this.rotAttr = new Float32Array(n);
    this.cursor = 0;
    this.alive = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.sizeAttr, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphaAttr, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.colorAttr, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aRot', new THREE.BufferAttribute(this.rotAttr, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry = g;
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: texture }, uScale: { value: 400 } }]),
      vertexShader: PARTICLE_VS,
      fragmentShader: PARTICLE_FS,
      transparent: true,
      depthWrite: false,
      blending,
      fog: true,
    });
    this.material.uniforms.map.value = texture;
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  spawn(x, y, z, vx, vy, vz, life, s0, s1, alpha, r, g, b, drag = 1.5, grav = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size0[i] = s0; this.size1[i] = s1;
    this.alpha0[i] = alpha;
    this.drag[i] = drag;
    this.grav[i] = grav;
    this.spin[i] = (Math.random() - 0.5) * 2;
    this.rotAttr[i] = Math.random() * 6.28;
    this.colorAttr[i * 3] = r; this.colorAttr[i * 3 + 1] = g; this.colorAttr[i * 3 + 2] = b;
  }

  update(dt) {
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.alphaAttr[i] = 0;
        continue;
      }
      alive++;
      this.life[i] -= dt;
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
      this.sizeAttr[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
      this.alphaAttr[i] = this.alpha0[i] * (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88);
      this.rotAttr[i] += this.spin[i] * dt;
    }
    this.alive = alive;
    const a = this.geometry.attributes;
    a.position.needsUpdate = true;
    a.aSize.needsUpdate = true;
    a.aAlpha.needsUpdate = true;
    a.aColor.needsUpdate = true;
    a.aRot.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.points.removeFromParent();
  }
}

class SkidMarks {
  constructor(maxQuads) {
    this.max = Math.max(64, maxQuads);
    const n = this.max;
    this.pos = new Float32Array(n * 4 * 3);
    this.col = new Float32Array(n * 4 * 4);
    const idx = new Uint32Array(n * 6);
    for (let q = 0; q < n; q++) {
      const v = q * 4;
      idx.set([v, v + 2, v + 1, v + 1, v + 2, v + 3], q * 6);
    }
    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    g.setAttribute('color', this.colAttr);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geometry = g;
    this.material = new THREE.MeshBasicMaterial({
      color: 0x0d0d0d, vertexColors: true, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.cursor = 0;
    this.dirtyStart = Infinity;
    this.dirtyEnd = -1;
    this.wheels = new Map();
  }

  /** Adds a strip segment for wheel `key` from its last point to (x,y,z). */
  add(key, x, y, z, dirX, dirZ, width, alpha) {
    const last = this.wheels.get(key);
    const lx = -dirZ * width * 0.5, lz = dirX * width * 0.5;
    if (!last || alpha <= 0.02) {
      this.wheels.set(key, alpha > 0.02 ? { x, y, z, lx, lz, a: alpha } : null);
      return;
    }
    const dx = x - last.x, dz = z - last.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 0.16) return; // ~40 cm segments
    if (d2 > 36) { this.wheels.set(key, { x, y, z, lx, lz, a: alpha }); return; }
    const q = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const p = this.pos, c = this.col;
    const o = q * 12;
    p[o] = last.x + last.lx; p[o + 1] = last.y; p[o + 2] = last.z + last.lz;
    p[o + 3] = last.x - last.lx; p[o + 4] = last.y; p[o + 5] = last.z - last.lz;
    p[o + 6] = x + lx; p[o + 7] = y; p[o + 8] = z + lz;
    p[o + 9] = x - lx; p[o + 10] = y; p[o + 11] = z - lz;
    const oc = q * 16;
    for (let v = 0; v < 4; v++) {
      c[oc + v * 4] = 1; c[oc + v * 4 + 1] = 1; c[oc + v * 4 + 2] = 1;
      c[oc + v * 4 + 3] = (v < 2 ? last.a : alpha) * 0.75;
    }
    this.dirtyStart = Math.min(this.dirtyStart, q);
    this.dirtyEnd = Math.max(this.dirtyEnd, q);
    this.wheels.set(key, { x, y, z, lx, lz, a: alpha });
  }

  flush() {
    if (this.dirtyEnd < 0) return;
    const s = this.dirtyStart, e = this.dirtyEnd;
    this.posAttr.clearUpdateRanges();
    this.colAttr.clearUpdateRanges();
    this.posAttr.addUpdateRange(s * 12, (e - s + 1) * 12);
    this.colAttr.addUpdateRange(s * 16, (e - s + 1) * 16);
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.dirtyStart = Infinity;
    this.dirtyEnd = -1;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
  }
}

export class Effects {
  constructor(scene, tier, look) {
    this.scene = scene;
    this.tier = tier;
    this.look = look;
    const n = tier.particles;
    this.smoke = new ParticlePool(Math.round(n * 0.7), smokeTexture(), THREE.NormalBlending);
    this.glow = new ParticlePool(Math.round(n * 0.3), glowTexture(), THREE.AdditiveBlending);
    this.skids = new SkidMarks(tier.skids);
    scene.add(this.smoke.points, this.glow.points, this.skids.mesh);
    this.rate = Math.min(3, 0.4 + n / 2500);
    this.acc = new Map();
    this.tmp = new THREE.Vector3();
  }

  setViewport(heightPx, fovDeg) {
    const scale = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
    this.smoke.material.uniforms.uScale.value = scale;
    this.glow.material.uniforms.uScale.value = scale;
  }

  #emitCount(key, rate, dt) {
    const v = (this.acc.get(key) || 0) + rate * dt;
    const n = Math.floor(v);
    this.acc.set(key, v - n);
    return n;
  }

  /**
   * Per-car effects. `wheelsWorld` = 4 world positions [FL, FR, RL, RR] of the contact patches.
   */
  carEffects(id, v, wheelsWorld, dt, weather, isPlayer) {
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const speed = v.speed;
    const skid = v.skid;
    const offroad = v.surface === 2;
    // skid marks (rear wheels; all wheels when locked)
    for (let w = 0; w < 4; w++) {
      const rear = w >= 2;
      const p = wheelsWorld[w];
      let a = 0;
      if (!offroad && speed > 2) a = rear ? skid : v.lockup ? skid * 0.8 : Math.max(0, Math.abs(v.slipF) - 0.2) * 3;
      this.skids.add(`${id}:${w}`, p.x, p.y + 0.015, p.z, fx, fz, 0.24, Math.min(1, a));
    }
    const smokeColor = this.look.id === 'snow' ? [0.95, 0.97, 1] : [0.86, 0.86, 0.88];
    // tyre smoke
    if (skid > 0.28 && speed > 3 && !offroad) {
      const n = this.#emitCount(`${id}:smoke`, skid * 26 * this.rate * (isPlayer ? 1.4 : 1), dt);
      for (let k = 0; k < n; k++) {
        const p = wheelsWorld[2 + (k % 2)];
        this.smoke.spawn(p.x, p.y + 0.25, p.z, v.vx * 0.15 + (Math.random() - 0.5), 0.6 + Math.random(), v.vz * 0.15 + (Math.random() - 0.5),
          1.3 + Math.random() * 0.8, 1.0, 4.8, 0.2 * skid, ...smokeColor, 1.3, -0.25);
      }
    }
    // dust / snow spray off-road
    if (offroad && speed > 4) {
      const c = this.look.id === 'snow' ? [1, 1, 1] : this.look.id === 'desert' ? [0.86, 0.72, 0.5] : [0.55, 0.47, 0.36];
      const n = this.#emitCount(`${id}:dust`, Math.min(30, speed * 1.0) * this.rate, dt);
      for (let k = 0; k < n; k++) {
        const p = wheelsWorld[k % 4];
        this.smoke.spawn(p.x, p.y + 0.2, p.z, -fx * 2 + (Math.random() - 0.5) * 3, 1 + Math.random() * 1.5, -fz * 2 + (Math.random() - 0.5) * 3,
          1.0 + Math.random() * 0.8, 0.7, 3.4, this.look.id === 'snow' ? 0.22 : 0.3, ...c, 1.5, 0.4);
      }
    }
    // rain spray
    if (weather === 'rain' && speed > 12 && !offroad) {
      const n = this.#emitCount(`${id}:spray`, speed * 0.45 * this.rate, dt);
      for (let k = 0; k < n; k++) {
        const p = wheelsWorld[2 + (k % 2)];
        this.smoke.spawn(p.x, p.y + 0.2, p.z, v.vx * 0.3 + (Math.random() - 0.5) * 2, 0.5 + Math.random(), v.vz * 0.3 + (Math.random() - 0.5) * 2,
          0.55, 0.35, 1.6, 0.12, 0.8, 0.84, 0.9, 2.2, 0.5);
      }
    }
    // sparks from impacts / wall scraping
    if (v.impact > 2.5 || v.scrape > 3) {
      const n = Math.min(30, Math.round((v.impact + v.scrape * 0.3) * 2 * this.rate));
      for (let k = 0; k < n; k++) {
        this.glow.spawn(v.impactX || v.x, v.y + 0.4, v.impactZ || v.z,
          (Math.random() - 0.5) * 6 + v.vx * 0.5, Math.random() * 4, (Math.random() - 0.5) * 6 + v.vz * 0.5,
          0.35 + Math.random() * 0.3, 0.25, 0.08, 1, 1.0, 0.62, 0.25, 0.8, 9.8);
      }
    }
  }

  exhaustFlash(points, v, nitro) {
    for (const p of points) {
      const n = nitro ? 2 : 3;
      for (let k = 0; k < n; k++) {
        this.glow.spawn(p.x, p.y, p.z, v.vx * 0.9 - Math.sin(v.heading) * 4, Math.random() * 0.4, v.vz * 0.9 - Math.cos(v.heading) * 4,
          0.12 + Math.random() * 0.08, nitro ? 0.5 : 0.7, nitro ? 0.2 : 0.3, 1, nitro ? 0.45 : 1, nitro ? 0.65 : 0.55, nitro ? 1 : 0.2, 3, 0);
      }
    }
  }

  update(dt) {
    this.smoke.update(dt);
    this.glow.update(dt);
    this.skids.flush();
  }

  dispose() {
    this.smoke.dispose();
    this.glow.dispose();
    this.skids.dispose();
  }
}
