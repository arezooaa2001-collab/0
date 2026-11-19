// Visual effects: pooled GPU particles, shockwave rings, sonic booms, boost trail ribbon; post-processing pipeline
// (bloom, GTAO, DOF, speed blur, god rays, grading, colour-blind correction, SMAA/FXAA/MSAA) with dynamic resolution.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { G } from './game.js';
import { clamp, lerp } from './util.js';

const SURF_COL = { grass: 0x7a8a4a, sand: 0xe0c48a, snow: 0xf4f8ff, rock: 0x9a9088, metal: 0xffd27a, water: 0xbfe6ff, lava: 0xff7a2a };

export class FX {
  constructor(scene, preset) {
    this.scene = scene; this.setPreset(preset);
    this.rings = []; this.ringGeo = new THREE.RingGeometry(0.85, 1, 48);
    for (let i = 0; i < 20; i++) {
      const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.visible = false; scene.add(m); this.rings.push({ m, t: 0, life: 0, scale: 1 });
    }
    this.flashLight = new THREE.PointLight(0xffaa55, 0, 40, 2); scene.add(this.flashLight); this.flashT = 0;
    this.trail = new Trail(scene, preset.trail);
    this.leafT = 0;
  }
  setPreset(p) {
    this.mult = p.particles;
    const n = Math.floor(clamp(2500 * p.particles, 600, 9000));
    if (this.points) { this.scene.remove(this.points); this.points.geometry.dispose(); }
    this.n = n; this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n); this.grav = new Float32Array(n); this.drag = new Float32Array(n); this.s0 = new Float32Array(n);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      uniforms: { uScale: { value: innerHeight * 0.5 } },
      vertexShader: 'attribute float aSize; attribute float aAlpha; varying vec3 vC; varying float vA; uniform float uScale; void main(){ vC = color; vA = aAlpha; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = aSize * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord-0.5; float d = dot(c,c); if (d>0.25) discard; float a = vA*smoothstep(0.25,0.0,d); gl_FragColor = vec4(vC*a, a); }',
    });
    this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; this.points.renderOrder = 5; this.scene.add(this.points);
    this.tmpC = new THREE.Color();
    if (this.trail) this.trail.setLength(p.trail);
  }
  emit(x, y, z, vx, vy, vz, color, size, life, grav = 0, drag = 0.5) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    const c = this.tmpC.set(color); this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    this.size[i] = size; this.s0[i] = size; this.life[i] = life; this.max[i] = life; this.grav[i] = grav; this.drag[i] = drag; this.alpha[i] = 1;
  }
  count(n) { return Math.max(1, Math.round(n * this.mult)); }
  burst(p, color, n = 12, speed = 5, size = 0.35, life = 0.7, grav = 0) {
    n = this.count(n);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), s = speed * (0.4 + Math.random() * 0.6); this.emit(p.x, p.y + 0.5, p.z, Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s, color, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), grav, 1.5); }
  }
  dust(p, surface, n = 4) {
    const c = SURF_COL[surface] || 0x9a9088; n = this.count(n);
    for (let i = 0; i < n; i++) this.emit(p.x + (Math.random() - 0.5) * 0.6, p.y + 0.15, p.z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, c, 0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.4, -2, 2);
  }
  landing(p, surface, k = 1) { this.dust(p, surface, 10 * k); this.ring(p, SURF_COL[surface] || 0xffffff, 1.6 * k, 0.35); }
  splash(p, k = 1) { const n = this.count(16 * k); for (let i = 0; i < n; i++) this.emit(p.x, p.y + 0.2, p.z, (Math.random() - 0.5) * 5 * k, 4 + Math.random() * 6 * k, (Math.random() - 0.5) * 5 * k, 0xcfeeff, 0.3, 0.8, 22, 0.3); if (k >= 1) this.ring(p, 0xcfeeff, 2, 0.5); }
  sparks(p, dir, n = 2) { n = this.count(n); for (let i = 0; i < n; i++) this.emit(p.x, p.y + 0.05, p.z, -dir.x * 6 + (Math.random() - 0.5) * 5, 2 + Math.random() * 4, -dir.z * 6 + (Math.random() - 0.5) * 5, Math.random() < 0.5 ? 0xffd27a : 0xff9a3a, 0.18, 0.35, 25, 0.5); }
  ringSparkle(p) { const n = this.count(6); for (let i = 0; i < n; i++) this.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 4, Math.random() * 4, (Math.random() - 0.5) * 4, Math.random() < 0.5 ? 0xffe680 : 0xffffff, 0.28, 0.45, 0, 2); }
  explosion(p, color = 0xff9a3a, scale = 1) {
    this.burst(p, color, 26 * scale, 10 * scale, 0.5 * scale, 0.8, 6);
    this.burst(p, 0xffffff, 10 * scale, 14 * scale, 0.35, 0.35);
    const n = this.count(10 * scale); for (let i = 0; i < n; i++) this.emit(p.x + (Math.random() - 0.5), p.y + 0.6, p.z + (Math.random() - 0.5), (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3, 0x3a3634, 1.2 * scale, 1.3, -1.5, 1);
    this.ring(p, color, 3 * scale, 0.45);
    if (G.preset.lights > 0) { this.flashLight.position.copy(p).y += 1; this.flashLight.color.set(color); this.flashLight.intensity = 400 * scale; this.flashT = 0.25; }
  }
  ring(p, color, scale = 1, life = 0.4, normal) {
    const r = this.rings.find((x) => x.t <= 0) || this.rings[0];
    r.m.visible = true; r.m.position.copy(p).y += 0.2; r.m.material.color.set(color); r.t = life; r.life = life; r.scale = scale;
    if (normal) r.m.lookAt(r.m.position.clone().add(normal)); else r.m.rotation.set(-Math.PI / 2, 0, 0);
  }
  sonicBoom(p, dir, k = 1) {
    const c = p.clone(); c.y += 0.7;
    this.ring(c, 0xcfefff, 3.5 * k, 0.4, dir); this.ring(c.clone().addScaledVector(dir, 1.5), 0xffffff, 2.2 * k, 0.3, dir);
    const n = this.count(14 * k); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; const side = new THREE.Vector3(-dir.z, 0, dir.x); const u = new THREE.Vector3(0, 1, 0); const v = side.multiplyScalar(Math.cos(a)).add(u.multiplyScalar(Math.sin(a))).multiplyScalar(8 * k); this.emit(c.x, c.y, c.z, v.x, v.y, v.z, 0xdff4ff, 0.3, 0.35, 0, 3); }
  }
  playerTrail(pl, dt) {
    const on = pl.boosting || pl.prism || pl.speed > 42 || !!pl.homing || pl.airDashT > 0 || pl.mode === 'ride';
    const col = pl.prism ? 0xfff2a0 : (pl.info && pl.info.colors ? pl.info.colors.accent || pl.info.colors.primary : 0x9fe8ff);
    this.trail.update(dt, pl.container.position, on, col);
    if (pl.boosting && Math.random() < 0.7) this.emit(pl.pos.x + (Math.random() - 0.5) * 0.6, pl.pos.y + 0.6 + Math.random() * 0.4, pl.pos.z + (Math.random() - 0.5) * 0.6, -pl.vel.x * 0.1, 0.5, -pl.vel.z * 0.1, col, 0.35, 0.35, 0, 3);
  }
  update(dt) {
    const n = this.n, P = this.pos, V = this.vel;
    for (let i = 0; i < n; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; } continue; }
      this.life[i] -= dt; const t = this.life[i] / this.max[i];
      const dr = Math.exp(-this.drag[i] * dt);
      V[i * 3] *= dr; V[i * 3 + 1] = V[i * 3 + 1] * dr - this.grav[i] * dt; V[i * 3 + 2] *= dr;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      this.alpha[i] = Math.max(0, t); this.size[i] = this.s0[i] * (0.5 + 0.5 * t);
    }
    const g = this.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.aSize.needsUpdate = true; g.attributes.aAlpha.needsUpdate = true;
    for (const r of this.rings) {
      if (r.t <= 0) { r.m.visible = false; continue; }
      r.t -= dt; const k = 1 - r.t / r.life; r.m.scale.setScalar(r.scale * (0.3 + k * 1.7)); r.m.material.opacity = (1 - k) * 0.8;
    }
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flashLight.intensity = 0; else this.flashLight.intensity *= 0.85; }
    // ambient: falling leaves in forests / meadows, embers near the volcano
    const pl = G.player; if (pl && G.region) {
      this.leafT -= dt;
      if (this.leafT <= 0) {
        this.leafT = 0.15 / this.mult; const id = G.region.id;
        const x = pl.pos.x + (Math.random() - 0.5) * 30, z = pl.pos.z + (Math.random() - 0.5) * 30, y = pl.pos.y + 8 + Math.random() * 6;
        if (id === 'forest' || id === 'meadow') this.emit(x, y, z, 1 + Math.random(), -1.2, Math.random() - 0.5, Math.random() < 0.5 ? 0x6aa53a : 0xd6a23a, 0.25, 6, 0, 0.1);
        else if (id === 'volcano') this.emit(x, y - 8, z, (Math.random() - 0.5), 2 + Math.random() * 2, (Math.random() - 0.5), 0xff7a2a, 0.18, 3, 0, 0.1);
        else if (id === 'canyon' || id === 'ruins') this.emit(x, y - 6, z, 0.3, 0.1, 0.2, 0xffe6b0, 0.1, 5, 0, 0); // floating dust
      }
    }
  }
}

class Trail {
  constructor(scene, len) {
    this.scene = scene; this.mat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexColors: true });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat); this.mesh.frustumCulled = false; scene.add(this.mesh);
    this.setLength(len); this.fade = 0;
  }
  setLength(n) {
    this.n = Math.max(8, n); this.pts = []; const g = this.mesh.geometry;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.n * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.n * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < this.n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
  }
  update(dt, p, on, color) {
    this.fade = clamp(this.fade + (on ? dt * 5 : -dt * 3), 0, 1);
    if (this.fade <= 0) { this.mesh.visible = false; this.pts.length = 0; return; }
    this.mesh.visible = true; this.mat.color.set(color);
    this.pts.unshift(p.clone().add(new THREE.Vector3(0, 0.65, 0))); if (this.pts.length > this.n) this.pts.length = this.n;
    const cam = G.camera; const pos = this.mesh.geometry.attributes.position.array, col = this.mesh.geometry.attributes.color.array;
    const side = new THREE.Vector3(), d = new THREE.Vector3(), toCam = new THREE.Vector3();
    for (let i = 0; i < this.n; i++) {
      const a = this.pts[Math.min(i, this.pts.length - 1)] || p; const b = this.pts[Math.min(i + 1, this.pts.length - 1)] || a;
      d.copy(a).sub(b); if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
      toCam.copy(cam.position).sub(a); side.crossVectors(d, toCam).normalize();
      const k = 1 - i / this.n; const w = 0.45 * k;
      pos[i * 6] = a.x + side.x * w; pos[i * 6 + 1] = a.y + side.y * w; pos[i * 6 + 2] = a.z + side.z * w;
      pos[i * 6 + 3] = a.x - side.x * w; pos[i * 6 + 4] = a.y - side.y * w; pos[i * 6 + 5] = a.z - side.z * w;
      const c = k * k * this.fade; for (let j = 0; j < 6; j++) col[i * 6 + j] = c;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.attributes.color.needsUpdate = true;
  }
}

// ----------------------------------------------------------------- post-processing
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uSpeed: { value: 0 }, uVig: { value: 0.25 }, uSat: { value: 1.08 }, uContrast: { value: 1.04 }, uWarm: { value: 0 },
    uSun: { value: new THREE.Vector2(0.5, 0.5) }, uRays: { value: 0 }, uUnder: { value: 0 }, uFlash: { value: 0 }, uCB: { value: 0 }, uGrain: { value: 0 }, uTime: { value: 0 },
    uFilter: { value: 0 }, uIntensity: { value: 1 }, uExposure: { value: 1 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uSpeed, uVig, uSat, uContrast, uWarm, uRays, uUnder, uFlash, uCB, uGrain, uTime, uFilter, uIntensity, uExposure; uniform vec2 uSun; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 uv = vUv;
      if (uUnder > 0.0) uv += vec2(sin(uv.y*30.0+uTime*2.0), cos(uv.x*24.0+uTime*1.6))*0.0025*uUnder;
      vec3 c = texture2D(tDiffuse, uv).rgb;
      // radial speed blur
      #if BLUR > 0
      if (uSpeed > 0.01) {
        vec2 dir = uv - vec2(0.5); float amt = uSpeed * smoothstep(0.08, 0.6, length(dir)) * uIntensity;
        vec3 acc = c; for (int i=1;i<BLUR;i++){ acc += texture2D(tDiffuse, uv - dir*amt*0.06*float(i)/float(BLUR)).rgb; } c = acc/float(BLUR);
      }
      #endif
      // god rays (screen space, from bright pixels toward the sun)
      #if RAYS
      if (uRays > 0.01) {
        vec2 d = (uv - uSun) / 24.0; vec2 p = uv; float acc = 0.0; float w = 1.0;
        for (int i=0;i<24;i++){ p -= d; vec3 s = texture2D(tDiffuse, p).rgb; acc += smoothstep(0.82, 1.0, dot(s, vec3(0.333))) * w; w *= 0.93; }
        c += vec3(1.0,0.92,0.75) * acc * 0.045 * uRays * uIntensity;
      }
      #endif
      c *= uExposure;
      // grading
      float l = dot(c, vec3(0.2126,0.7152,0.0722));
      c = mix(vec3(l), c, mix(1.0, uSat, uIntensity));
      c = (c - 0.5) * mix(1.0, uContrast, uIntensity) + 0.5;
      c += vec3(0.03,0.01,-0.02)*uWarm;
      if (uFilter > 0.5 && uFilter < 1.5) c = vec3(dot(c, vec3(0.299,0.587,0.114)));
      else if (uFilter > 1.5 && uFilter < 2.5) { float g = dot(c, vec3(0.299,0.587,0.114)); c = vec3(g*1.07, g*0.92, g*0.72); }
      else if (uFilter > 2.5 && uFilter < 3.5) c = mix(c, c*vec3(1.08,0.98,0.85), 0.8);
      else if (uFilter > 3.5 && uFilter < 4.5) c = mix(c, c*vec3(0.85,0.98,1.12), 0.8);
      else if (uFilter > 4.5) c = mix(vec3(dot(c,vec3(0.333))), c, 1.5);
      // underwater tint
      c = mix(c, c*vec3(0.35,0.75,0.95) + vec3(0.0,0.05,0.1), uUnder*0.8);
      // colour-blind correction (daltonise)
      if (uCB > 0.5) {
        mat3 sim = uCB < 1.5 ? mat3(0.567,0.558,0.0, 0.433,0.442,0.242, 0.0,0.0,0.758) : uCB < 2.5 ? mat3(0.625,0.7,0.0, 0.375,0.3,0.3, 0.0,0.0,0.7) : mat3(0.95,0.0,0.0, 0.05,0.433,0.475, 0.0,0.567,0.525);
        vec3 s = sim * c; vec3 e = c - s; c += vec3(0.0, e.r*0.7 + e.g, e.r*0.7 + e.b);
      }
      vec2 q = vUv - 0.5; c *= 1.0 - dot(q,q) * uVig * 2.2 * uIntensity;
      c += uFlash;
      if (uGrain > 0.0) c += (rnd(vUv*vec2(1920.0,1080.0) + uTime) - 0.5) * 0.035 * uGrain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export class PostFX {
  constructor(renderer, scene, camera) { this.renderer = renderer; this.scene = scene; this.camera = camera; this.drawScale = 1; this.dynScale = 1; this.dof = null; this.filter = 0; this.exposure = 1; }
  setPreset(p, gfx) {
    this.p = p; this.gfx = gfx || {};
    const o = this.gfx;
    const bloomOn = o.bloom !== null && o.bloom !== undefined ? o.bloom : !!p.bloom;
    const ssaoOn = o.ssao !== null && o.ssao !== undefined ? o.ssao : !!p.ssao;
    const blur = o.motionBlur !== null && o.motionBlur !== undefined ? (o.motionBlur ? Math.max(6, p.motionBlur) : 0) : p.motionBlur;
    const rays = o.godrays !== null && o.godrays !== undefined ? o.godrays : !!p.godrays;
    const aa = o.aa || p.aa;
    this.dofAllowed = o.dof !== null && o.dof !== undefined ? o.dof : true;
    this.useComposer = p.index > 0 || bloomOn || blur || ssaoOn || aa !== 'none';
    this.dispose();
    const r = this.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    if (!this.useComposer) { this.composer = null; return; }
    const size = r.getSize(new THREE.Vector2());
    const msaa = Math.min(p.msaa || 0, r.capabilities.maxSamples || 0);
    const rt = new THREE.WebGLRenderTarget(size.x * r.getPixelRatio(), size.y * r.getPixelRatio(), { type: THREE.HalfFloatType, samples: aa === 'msaa' || msaa ? msaa : 0 });
    const c = new EffectComposer(r, rt); this.composer = c;
    c.addPass(new RenderPass(this.scene, this.camera));
    if (ssaoOn) { try { const g = new GTAOPass(this.scene, this.camera, size.x, size.y); g.output = GTAOPass.OUTPUT.Default; g.blendIntensity = 0.85; c.addPass(g); this.gtao = g; } catch (e) { console.warn('GTAO unavailable', e); } }
    if (bloomOn) { const b = new UnrealBloomPass(new THREE.Vector2(size.x * (p.index >= 2 ? 0.5 : 0.35), size.y * (p.index >= 2 ? 0.5 : 0.35)), 0.55, 0.45, 0.88); c.addPass(b); this.bloom = b; }
    this.bokeh = new BokehPass(this.scene, this.camera, { focus: 8, aperture: 0.004, maxblur: 0.008 }); this.bokeh.enabled = false; c.addPass(this.bokeh);
    c.addPass(new OutputPass());
    const fs = { ...FinalShader, defines: { BLUR: blur | 0, RAYS: rays ? 1 : 0 } };
    this.final = new ShaderPass(fs); c.addPass(this.final);
    if (aa === 'smaa') { this.smaa = new SMAAPass(size.x * r.getPixelRatio(), size.y * r.getPixelRatio()); c.addPass(this.smaa); }
    else if (aa === 'fxaa') { this.fxaa = new ShaderPass(FXAAShader); c.addPass(this.fxaa); }
    this.resize();
  }
  dispose() { if (this.composer) { this.composer.passes.forEach((ps) => ps.dispose && ps.dispose()); this.composer.renderTarget1.dispose(); this.composer.renderTarget2.dispose(); } this.composer = null; this.bloom = this.gtao = this.final = this.smaa = this.fxaa = this.bokeh = null; }
  resize() {
    const r = this.renderer; const w = innerWidth, h = innerHeight;
    r.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(r.getPixelRatio()); this.composer.setSize(w, h);
      if (this.fxaa) this.fxaa.material.uniforms.resolution.value.set(1 / (w * r.getPixelRatio()), 1 / (h * r.getPixelRatio()));
    }
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (G.fx && G.fx.points) G.fx.points.material.uniforms.uScale.value = h * r.getPixelRatio() * 0.5;
  }
  render(dt) {
    if (!this.composer) { this.renderer.render(this.scene, this.camera); return; }
    const u = this.final.material.uniforms; const P = G.player; const S = G.settings;
    u.uTime.value += dt;
    const sp = P && G.state === 'play' ? clamp((P.vel.length() - 30) / 50, 0, 1) * (P.boosting ? 1.2 : 0.8) : 0;
    u.uSpeed.value = S.access.reduceMotion ? 0 : sp;
    u.uIntensity.value = S.postIntensity;
    u.uUnder.value = G.cam && G.cam.underwater ? 1 : 0;
    u.uCB.value = { none: 0, protanopia: 1, deuteranopia: 2, tritanopia: 3 }[S.access.colorblind] || 0;
    u.uContrast.value = S.access.highContrast ? 1.22 : 1.05;
    u.uGrain.value = this.p.grain ? 1 : 0;
    u.uFilter.value = this.filter; u.uExposure.value = this.exposure;
    u.uFlash.value = G.sky ? G.sky.flash * 0.25 : 0;
    if (G.sky) u.uRays.value = G.sky.sunScreenPos(this.camera, u.uSun.value) * 0.9;
    if (this.bloom) this.bloom.strength = 0.5 * S.postIntensity + (P && P.prism ? 0.4 : 0);
    if (this.bokeh) {
      const want = this.dof && this.dofAllowed;
      this.bokeh.enabled = !!want;
      if (want) { this.bokeh.uniforms.focus.value = this.dof.focus; this.bokeh.uniforms.aperture.value = this.dof.aperture; this.bokeh.uniforms.maxblur.value = this.dof.maxblur; }
    }
    this.composer.render(dt);
  }
}
