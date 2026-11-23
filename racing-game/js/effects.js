// جلوه‌ها: دود لاستیک، گرد و خاک، جرقه، رد لاستیک، شعله اگزوز، کاغذ رنگی و آتش‌بازی
import * as THREE from 'three';
import * as T from './textures.js';

const vs = `
  attribute float aSize; attribute float aAlpha; attribute vec3 aColor; attribute float aRot;
  varying float vAlpha; varying vec3 vColor; varying float vRot;
  uniform float uScale;
  void main(){
    vAlpha = aAlpha; vColor = aColor; vRot = aRot;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const fs = `
  uniform sampler2D tMap; varying float vAlpha; varying vec3 vColor; varying float vRot;
  void main(){
    vec2 p = gl_PointCoord - 0.5; float c = cos(vRot), s = sin(vRot);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
    vec4 t = texture2D(tMap, p);
    gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export class Particles {
  constructor(scene, max = 600, { additive = false, tex = T.smokePuff(), gravity = 0, drag = 1.5, grow = 1.2 } = {}) {
    this.max = max; this.gravity = gravity; this.drag = drag; this.grow = grow;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max); this.color = new Float32Array(max * 3); this.rot = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.a0 = new Float32Array(max); this.spin = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tMap: { value: tex }, uScale: { value: 500 } }, vertexShader: vs, fragmentShader: fs,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false;
    scene.add(this.points);
    this.cursor = 0;
  }
  emit(p, v, color, size, life, alpha = 0.6) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3);
    this.color.set([color.r, color.g, color.b], i * 3);
    this.size[i] = size; this.life[i] = life; this.maxLife[i] = life; this.a0[i] = alpha; this.alpha[i] = alpha;
    this.rot[i] = Math.random() * 6.28; this.spin[i] = (Math.random() - 0.5) * 2;
    this.alive = Math.max(this.alive || 0, 1); this.hi = Math.max(this.hi || 0, i + 1); if (this.cursor === 0) this.hi = this.max;
  }
  update(dt, viewportH = 800) {
    // اگر هیچ ذره‌ای زنده نیست، هیچ محاسبه یا ارسال داده‌ای انجام نمی‌شود
    if (!this.alive) { this.points.visible = false; return; }
    this.points.visible = true;
    this.mat.uniforms.uScale.value = viewportH * 0.9;
    const k = Math.exp(-this.drag * dt);
    let alive = 0; const hi = this.hi || this.max;
    for (let i = 0; i < hi; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      alive++;
      this.life[i] -= dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.gravity * dt; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] *= 1 + this.grow * dt;
      this.rot[i] += this.spin[i] * dt;
      this.alpha[i] = this.a0[i] * (1 - t) * Math.min(1, t * 8 + 0.2);
    }
    const g = this.points.geometry;
    for (const n of ['position', 'aSize', 'aAlpha', 'aColor', 'aRot']) g.attributes[n].needsUpdate = true;
    g.setDrawRange(0, hi);
    this.alive = alive;
    if (!alive) { this.hi = 0; this.cursor = 0; }
  }
  clear() { this.life.fill(0); this.alpha.fill(0); this.alive = 0; this.hi = 0; this.cursor = 0; this.points.visible = false; }
}

// رد لاستیک روی آسفالت
export class Skidmarks {
  constructor(scene, max = 2400) {
    this.max = max;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 4 * 3); this.alphaA = new Float32Array(max * 4);
    const idx = new Uint32Array(max * 6);
    for (let i = 0; i < max; i++) { const b = i * 4; idx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6); }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aA', new THREE.BufferAttribute(this.alphaA, 1).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(0.02,0.02,0.02, vA); }',
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
    });
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.visible = false; scene.add(this.mesh);
    this.cursor = 0; this.last = new Map();
  }
  add(key, p, side, strength) {
    const prev = this.last.get(key);
    if (!prev || prev.p.distanceToSquared(p) > 9) { this.last.set(key, { p: p.clone(), side: side.clone() }); return; }
    if (prev.p.distanceToSquared(p) < 0.25) return;
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    const w = 0.13;
    const a = [prev.p.x - prev.side.x * w, prev.p.y, prev.p.z - prev.side.z * w, prev.p.x + prev.side.x * w, prev.p.y, prev.p.z + prev.side.z * w,
      p.x - side.x * w, p.y, p.z - side.z * w, p.x + side.x * w, p.y, p.z + side.z * w];
    this.pos.set(a, i * 12);
    const al = Math.min(0.55, strength);
    this.alphaA.set([al, al, al, al], i * 4);
    prev.p.copy(p); prev.side.copy(side);
    const pa = this.mesh.geometry.attributes.position, aa = this.mesh.geometry.attributes.aA;
    pa.clearUpdateRanges(); pa.addUpdateRange(i * 12, 12); pa.needsUpdate = true;
    aa.clearUpdateRanges(); aa.addUpdateRange(i * 4, 4); aa.needsUpdate = true;
    this.mesh.visible = true;
  }
  break(key) { this.last.delete(key); }
  clear() { this.alphaA.fill(0); const aa = this.mesh.geometry.attributes.aA; aa.clearUpdateRanges(); aa.needsUpdate = true; this.last.clear(); this.mesh.visible = false; }
}

export class Effects {
  constructor(scene) {
    this.smoke = new Particles(scene, 700, { drag: 1.6, grow: 1.0 });
    this.dust = new Particles(scene, 400, { drag: 1.2, grow: 1.4 });
    this.sparks = new Particles(scene, 300, { additive: true, tex: T.softDot(), gravity: 9, drag: 0.6, grow: -0.6 });
    this.flames = new Particles(scene, 200, { additive: true, tex: T.softDot(), drag: 3, grow: -1.5 });
    this.confetti = new Particles(scene, 900, { additive: false, tex: T.softDot(), gravity: 2.2, drag: 1.0, grow: 0 });
    this.fireworks = new Particles(scene, 1200, { additive: true, tex: T.softDot(), gravity: 3, drag: 0.8, grow: -0.3 });
    this.skids = new Skidmarks(scene);
    this._v = new THREE.Vector3(); this._c = new THREE.Color();
  }
  tireSmoke(p, vel, color, amount) {
    const v = this._v.set(vel.x * 0.2 + (Math.random() - 0.5) * 1.5, 0.6 + Math.random() * 1.2, vel.z * 0.2 + (Math.random() - 0.5) * 1.5);
    this.smoke.emit(p, v, color, 1.4 + Math.random() * 1.2, 1.6 + Math.random() * 1.4, 0.32 * amount + 0.08);
  }
  dirt(p, vel, gravel) {
    const c = gravel ? this._c.setRGB(0.75, 0.66, 0.5) : this._c.setRGB(0.45, 0.38, 0.25);
    const v = this._v.set(vel.x * 0.3 + (Math.random() - 0.5) * 2, 0.8 + Math.random() * 1.6, vel.z * 0.3 + (Math.random() - 0.5) * 2);
    this.dust.emit(p, v, c, 1.6 + Math.random(), 1.4 + Math.random(), 0.5);
  }
  spark(p, dir) {
    for (let k = 0; k < 6; k++) {
      const v = this._v.set(dir.x * 6 + (Math.random() - 0.5) * 8, 1 + Math.random() * 5, dir.z * 6 + (Math.random() - 0.5) * 8);
      this.sparks.emit(p, v, this._c.setRGB(1.6, 0.9, 0.3), 0.25 + Math.random() * 0.2, 0.4 + Math.random() * 0.4, 1);
    }
  }
  flame(p, back, blue) {
    const v = this._v.copy(back).multiplyScalar(4 + Math.random() * 3);
    const c = blue ? this._c.setRGB(0.4, 0.7, 2.2) : this._c.setRGB(2.4, 1.1, 0.25);
    this.flames.emit(p, v, c, 0.45 + Math.random() * 0.3, 0.12 + Math.random() * 0.08, 1);
  }
  confettiBurst(center, n = 300) {
    const cols = [[1, 0.1, 0.1], [1, 0.5, 0], [1, 0.85, 0], [0.2, 0.6, 1], [0.3, 1, 0.4], [1, 0.3, 0.8]];
    for (let k = 0; k < n; k++) {
      const c = cols[k % cols.length];
      const p = this._v.set(center.x + (Math.random() - 0.5) * 16, center.y + 6 + Math.random() * 6, center.z + (Math.random() - 0.5) * 16);
      const pp = p.clone();
      this.confetti.emit(pp, this._v.set((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4), this._c.setRGB(...c), 0.28, 4 + Math.random() * 2, 1);
    }
  }
  firework(center) {
    const hue = Math.random();
    const c = new THREE.Color().setHSL(hue, 1, 0.6).multiplyScalar(2.2);
    for (let k = 0; k < 140; k++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = 14 + Math.random() * 6;
      const v = this._v.set(Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp);
      this.fireworks.emit(center, v, c, 1.2, 1.4 + Math.random() * 0.8, 1);
    }
  }
  update(dt, h) {
    for (const p of [this.smoke, this.dust, this.sparks, this.flames, this.confetti, this.fireworks]) p.update(dt, h);
  }
  clear() { for (const p of [this.smoke, this.dust, this.sparks, this.flames, this.confetti, this.fireworks]) p.clear(); this.skids.clear(); }
}

// باران: قطره‌های کشیده دور دوربین، شتک روی زمین و رعد و برق (یک draw call)
export class Rain {
  constructor(scene, n = 1600) {
    this.n = n; this.pos = new Float32Array(n * 6); this.d = new Float32Array(n * 4);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xd6e4f2, transparent: true, opacity: 0.5, depthWrite: false }));
    this.lines.frustumCulled = false; scene.add(this.lines);
    this.splash = new Particles(scene, 260, { tex: T.softDot(), gravity: 5, drag: 1.5, grow: 0.6 });
    this.init = false; this.wind = 1.6; this.flashT = 8 + Math.random() * 10; this._c = new THREE.Color(0.75, 0.82, 0.9); this._v = new THREE.Vector3(); this._u = new THREE.Vector3();
  }
  spawn(i, cam, top) { const d = this.d; d[i * 4] = cam.x + (Math.random() - 0.5) * 50; d[i * 4 + 1] = cam.y + (top ? 8 + Math.random() * 16 : -4 + Math.random() * 28); d[i * 4 + 2] = cam.z + (Math.random() - 0.5) * 50; d[i * 4 + 3] = 17 + Math.random() * 6; }
  update(dt, cam, ground = null, onFlash = null) {
    const d = this.d, p = this.pos; if (!this.init) { for (let i = 0; i < this.n; i++) this.spawn(i, cam, false); this.init = true; }
    for (let i = 0; i < this.n; i++) {
      const o = i * 4; d[o + 1] -= d[o + 3] * dt; d[o] += this.wind * dt;
      const gy = ground ? ground(d[o], d[o + 2]) : cam.y - 6;
      if (d[o + 1] < gy || Math.abs(d[o] - cam.x) > 28 || Math.abs(d[o + 2] - cam.z) > 28) {
        if (d[o + 1] < gy && i % 6 === 0) this.splash.emit(this._v.set(d[o], gy + 0.03, d[o + 2]), this._u.set((Math.random() - 0.5) * 0.8, 1.2, (Math.random() - 0.5) * 0.8), this._c, 0.08, 0.25, 0.55);
        this.spawn(i, cam, true);
      }
      const q = i * 6; p[q] = d[o]; p[q + 1] = d[o + 1]; p[q + 2] = d[o + 2]; p[q + 3] = d[o] - this.wind * 0.045; p[q + 4] = d[o + 1] + 0.85; p[q + 5] = d[o + 2];
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.splash.update(dt);
    this.flashT -= dt; if (this.flashT <= 0) { this.flashT = 12 + Math.random() * 18; onFlash?.(); }
  }
  dispose() { this.lines.parent?.remove(this.lines); this.lines.geometry.dispose(); }
}
