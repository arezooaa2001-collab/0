// آتش واقعی: شعله‌های شیدری متحرک (همه در یک draw call)، دود، جرقه و نور لرزان
import * as THREE from 'three';
import { Particles } from './effects.js';
import * as T from './textures.js';

const vs = `
  attribute vec3 iPos; attribute vec2 iSize; attribute float iSeed; attribute float iInt;
  varying vec2 vUv; varying float vSeed; varying float vInt;
  void main(){
    vUv = uv; vSeed = iSeed; vInt = iInt;
    vec3 toCam = cameraPosition - iPos; toCam.y = 0.0; toCam = normalize(toCam + vec3(1e-4));
    vec3 right = vec3(toCam.z, 0.0, -toCam.x);
    vec3 wp = iPos + right * (position.x * iSize.x) + vec3(0.0, 1.0, 0.0) * (position.y * iSize.y);
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
    if (iInt <= 0.001) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }`;
const fs = `
  uniform float uTime; varying vec2 vUv; varying float vSeed; varying float vInt;
  float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * n2(p); p *= 2.07; a *= 0.5; } return s; }
  void main(){
    float t = uTime * 1.5 + vSeed * 13.0;
    vec2 uv = vUv;
    // آشفتگی شعله
    float n1 = fbm(vec2(uv.x * 2.6 + vSeed, uv.y * 2.2 - t * 1.9));
    float n2 = fbm(vec2(uv.x * 5.0 - vSeed * 2.0, uv.y * 4.4 - t * 2.9));
    vec2 q = uv + vec2((n1 - 0.5) * 0.38 * (0.25 + uv.y), (n2 - 0.5) * 0.12);
    // نیم‌پهنای شعله: پهن در پایین و باریک در بالا، با چند زبانه
    float tongues = 0.5 + 0.5 * sin(q.x * 18.0 + t * 3.0 + vSeed * 5.0);
    float hw = 0.47 * pow(max(0.0, 1.0 - q.y), 0.8) + 0.02 + tongues * 0.05 * q.y;
    float d = abs(q.x - 0.5) / max(hw, 0.001);
    float body = 1.0 - d;
    float vert = 1.0 - smoothstep(0.15, 1.0, q.y + (n2 - 0.5) * 0.5);
    float dens = body * vert + (n1 - 0.5) * 0.35 * (1.0 - q.y);
    dens *= smoothstep(0.0, 0.05, uv.y) * (1.0 - smoothstep(0.8, 0.99, uv.y)) * smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.92, uv.x);
    float f = clamp(dens * 1.7, 0.0, 1.0);
    vec3 col = mix(vec3(0.45, 0.03, 0.0), vec3(0.95, 0.28, 0.02), smoothstep(0.02, 0.35, f));
    col = mix(col, vec3(1.0, 0.62, 0.1), smoothstep(0.35, 0.7, f));
    col = mix(col, vec3(1.0, 0.93, 0.62), smoothstep(0.78, 1.0, f));
    float a = smoothstep(0.0, 0.28, f) * vInt;
    gl_FragColor = vec4(col * (1.15 + f * 1.6), a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export class FireSystem {
  constructor(scene, max = 220) {
    this.max = max; this.count = 0;
    const base = new THREE.PlaneGeometry(1, 1); base.translate(0, 0.5, 0);
    const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
    this.iPos = new Float32Array(max * 3); this.iSize = new Float32Array(max * 2); this.iSeed = new Float32Array(max); this.iInt = new Float32Array(max);
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.iPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iSize', new THREE.InstancedBufferAttribute(this.iSize, 2).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iSeed', new THREE.InstancedBufferAttribute(this.iSeed, 1));
    g.setAttribute('iInt', new THREE.InstancedBufferAttribute(this.iInt, 1).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = 0;
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5; this.mesh.visible = false;
    scene.add(this.mesh);
    this.smoke = new Particles(scene, 900, { drag: 0.45, grow: 0.6 });
    this.embers = new Particles(scene, 300, { additive: true, tex: T.softDot(), gravity: -1.8, drag: 0.6, grow: -0.4 });
    this.light = new THREE.PointLight(0xff7a20, 0, 26, 1.6); scene.add(this.light);
    this.sources = [];
    this._v = new THREE.Vector3(); this._vel = new THREE.Vector3(); this._c = new THREE.Color();
  }
  // افزودن شعله؛ خروجی شناسه برای تغییر شدت
  add(pos, w = 1.2, h = 2.2, intensity = 1) {
    const i = this.count < this.max ? this.count++ : (Math.random() * this.max) | 0;
    this.iPos.set([pos.x, pos.y, pos.z], i * 3); this.iSize.set([w, h], i * 2); this.iSeed[i] = Math.random() * 10; this.iInt[i] = intensity;
    this.geo.instanceCount = this.count; this.mesh.visible = true;
    for (const n of ['iPos', 'iSize', 'iSeed', 'iInt']) this.geo.attributes[n].needsUpdate = true;
    // اگر جای خالی نبود و یک شعله قدیمی جایگزین شد، منبع قبلی هم حذف شود
    for (let k = this.sources.length - 1; k >= 0; k--) if (this.sources[k].i === i) this.sources.splice(k, 1);
    this.sources.push({ i, pos: pos.clone(), w, h, base: intensity });
    return i;
  }
  setGroupIntensity(ids, k) { for (const i of ids) { const s = this.sources.find((x) => x.i === i); if (s) this.iInt[i] = s.base * k; } this.geo.attributes.iInt.needsUpdate = true; }
  clear() { this.count = 0; this.geo.instanceCount = 0; this.mesh.visible = false; this.sources.length = 0; this.light.intensity = 0; this.smoke.clear(); this.embers.clear(); }
  update(dt, t, camPos) {
    this.mat.uniforms.uTime.value = t;
    if (!this.sources.length) { this.light.intensity = 0; this.smoke.update(dt); this.embers.update(dt); return; }
    // نزدیک‌ترین آتش به دوربین نور لرزان می‌دهد
    let best = null, bd = 1e9;
    for (const s of this.sources) { const d = s.pos.distanceToSquared(camPos); if (this.iInt[s.i] > 0.05 && d < bd) { bd = d; best = s; } }
    if (best && bd < 120 * 120) {
      this.light.position.copy(best.pos).y += best.h * 0.5;
      this.light.intensity = (22 + Math.sin(t * 23) * 4 + Math.sin(t * 37) * 3 + Math.random() * 3) * this.iInt[best.i];
    } else this.light.intensity = 0;
    for (const s of this.sources) {
      const k = this.iInt[s.i]; if (k < 0.05) continue;
      if (s.pos.distanceToSquared(camPos) > 220 * 220) continue;
      if (Math.random() < dt * 11 * k) {
        const g = 0.05 + Math.random() * 0.1; this._c.setRGB(g, g * 0.97, g * 0.95);
        this.smoke.emit(this._v.set(s.pos.x + (Math.random() - 0.5) * s.w, s.pos.y + s.h * 0.75, s.pos.z + (Math.random() - 0.5) * s.w), this._vel.set((Math.random() - 0.5) * 0.7 + 0.35, 2.4 + Math.random() * 1.6, (Math.random() - 0.5) * 0.7), this._c, 2.0 + s.w * 1.2, 5 + Math.random() * 3, 0.8);
      }
      if (Math.random() < dt * 10 * k) this.embers.emit(this._v.set(s.pos.x + (Math.random() - 0.5) * s.w, s.pos.y + s.h * 0.3, s.pos.z + (Math.random() - 0.5) * s.w), this._vel.set((Math.random() - 0.5) * 1.2, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 1.2), this._c.setRGB(2.5, 1.0, 0.2), 0.12, 1.4 + Math.random(), 1);
    }
    this.smoke.update(dt); this.embers.update(dt);
  }
}
