// موتور رندر: رندرر، پس‌پردازش (Bloom، MSAA، تاری سرعت، وینیت)، آسمان، نور و زمان روز
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { TEX } from './textures.js';
import { clamp, lerp } from './utils.js';

export const QUALITY = {
  low: { pr: 0.8, shadow: 1024, shadowOn: true, bloom: false, msaa: 0, fans: 0.18, trees: 0.4, label: 'کم' },
  medium: { pr: 1.0, shadow: 1536, shadowOn: true, bloom: true, msaa: 2, fans: 0.35, trees: 0.65, label: 'متوسط' },
  high: { pr: 1.35, shadow: 2048, shadowOn: true, bloom: true, msaa: 4, fans: 0.6, trees: 1, label: 'بالا' },
  ultra: { pr: 2.0, shadow: 4096, shadowOn: true, bloom: true, msaa: 4, fans: 0.85, trees: 1.3, label: 'فوق‌العاده' }
};

export const TIMES = {
  morning: { label: 'صبح', elev: 14, azim: 70, sun: '#ffd2a8', sunI: 2.6, top: '#3f7fd0', hor: '#cfe0f0', ground: '#6b6f5c', hemiS: '#c4dcff', hemiG: '#566346', hemiI: 0.62, fog: '#d9dde0', clouds: 0.45, stars: 0, exp: 1.0, cloudB: 1.0 },
  noon: { label: 'ظهر', elev: 58, azim: 140, sun: '#fff6ea', sunI: 3.1, top: '#2466c4', hor: '#b4d3f0', ground: '#6b7466', hemiS: '#c9e0ff', hemiG: '#5d6b4a', hemiI: 0.7, fog: '#c7d9ea', clouds: 0.35, stars: 0, exp: 0.95, cloudB: 1.05 },
  sunset: { label: 'غروب', elev: 4, azim: 255, sun: '#ff9550', sunI: 2.3, top: '#24386f', hor: '#e9a27a', ground: '#4a3a3a', hemiS: '#ffb38a', hemiG: '#3b3030', hemiI: 0.5, fog: '#d99a78', clouds: 0.55, stars: 0.05, exp: 1.05, cloudB: 0.9 },
  night: { label: 'شب', elev: 38, azim: 200, sun: '#9fb4ff', sunI: 0.7, top: '#01030a', hor: '#0b1830', ground: '#05070a', hemiS: '#4a64a8', hemiG: '#1c2026', hemiI: 0.85, fog: '#0a1224', clouds: 0.25, stars: 1, exp: 1.25, cloudB: 0.12 }
};
export const TIME_ORDER = ['morning', 'noon', 'sunset', 'night'];

const SkyShader = {
  uniforms: {
    topColor: { value: new THREE.Color() }, horizonColor: { value: new THREE.Color() }, groundColor: { value: new THREE.Color() },
    sunColor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, starAmt: { value: 0 }, cloudAmt: { value: 0.4 }, cloudBright: { value: 1 }, time: { value: 0 }
  },
  vertexShader: `varying vec3 vDir; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vDir = wp.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * wp; gl_Position.z = gl_Position.w * 0.99999; }`,
  fragmentShader: `
    uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 groundColor; uniform vec3 sunColor; uniform vec3 sunDir;
    uniform float starAmt; uniform float cloudAmt; uniform float cloudBright; uniform float time;
    varying vec3 vDir;
    float hash(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }
    void main(){
      vec3 d = normalize(vDir); float h = d.y;
      vec2 hd = normalize(d.xz + 1e-5); vec2 hs = normalize(sunDir.xz + 1e-5);
      float glow = pow(max(dot(hd, hs), 0.0), 5.0) * (1.0 - smoothstep(0.05, 0.7, sunDir.y));
      vec3 hor = mix(horizonColor, sunColor * 0.85 + horizonColor * 0.35, glow * 0.75);
      vec3 col = mix(hor, topColor, pow(clamp(h, 0.0, 1.0), 0.55));
      col = mix(col, groundColor, smoothstep(0.0, -0.12, h));
      float sd = max(dot(d, sunDir), 0.0);
      col += sunColor * (pow(sd, 6.0) * 0.12 + pow(sd, 64.0) * 0.45);
      col += sunColor * smoothstep(0.99935, 0.99965, sd) * 14.0;
      if (h > 0.0) {
        vec2 uv = d.xz / (h + 0.1) * 0.55 + vec2(time * 0.0035, time * 0.0015);
        float c = fbm(uv * 1.3);
        c = smoothstep(0.62 - cloudAmt * 0.32, 0.95, c);
        vec3 cc = mix(vec3(0.92, 0.94, 0.98), sunColor * 1.3, pow(sd, 3.0) * 0.65) * cloudBright * (0.55 + 0.45 * h);
        col = mix(col, cc, c * smoothstep(0.0, 0.15, h) * 0.92);
      }
      if (starAmt > 0.0) {
        vec3 p = d * 420.0; vec3 ip = floor(p); float r = hash(ip);
        float st = step(0.9965, r) * smoothstep(0.02, 0.25, h);
        col += vec3(0.9, 0.95, 1.0) * st * starAmt * (0.55 + 0.45 * sin(time * 2.0 + r * 200.0)) * 2.0;
        // ماه
        vec3 md = normalize(vec3(-sunDir.x, sunDir.y, -sunDir.z));
        col += vec3(0.9, 0.95, 1.0) * smoothstep(0.9993, 0.9996, dot(d, sunDir)) * 3.0 * starAmt;
      }
      gl_FragColor = vec4(col, 1.0);
    }`
};

// پس‌پردازش نهایی: تاری حرکتی شعاعی + وینیت + اشباع
const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uSpeed: { value: 0 }, uVig: { value: 0.35 }, uSat: { value: 1.08 }, uFlash: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uSpeed; uniform float uVig; uniform float uSat; uniform float uFlash; varying vec2 vUv;
    void main(){
      vec2 dir = vUv - vec2(0.5, 0.55);
      vec4 c = texture2D(tDiffuse, vUv);
      if (uSpeed > 0.01) {
        float w = smoothstep(0.15, 0.6, length(dir)) * uSpeed;
        vec4 acc = c;
        for (int i = 1; i <= 6; i++) { acc += texture2D(tDiffuse, vUv - dir * (float(i) * 0.012 * w)); }
        c = acc / 7.0;
      }
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      float v = smoothstep(0.95, 0.25, length(vUv - 0.5) * (1.0 + uVig));
      c.rgb *= mix(1.0, v, uVig * 1.6);
      c.rgb += uFlash;
      gl_FragColor = c;
    }`
};

export class Engine {
  constructor(container, settings) {
    this.container = container;
    this.settings = settings;
    const r = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);
    this.renderer = r;
    TEX.aniso = Math.min(8, r.capabilities.getMaxAnisotropy());
    this.pmrem = new THREE.PMREMGenerator(r);
    this.dynScale = 1;
    this.frameTimes = [];
    this.applyQuality(settings.quality || 'high');
    window.addEventListener('resize', () => this.resize());
  }

  applyQuality(q) {
    this.q = QUALITY[q] || QUALITY.high;
    this.qualityName = q;
    const r = this.renderer;
    r.shadowMap.enabled = this.q.shadowOn && (this.light?.shadows !== false);
    this.buildComposer();
    this.resize();
  }

  buildComposer() {
    const r = this.renderer;
    if (this.composer) this.composer.dispose?.();
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(Math.max(2, size.x), Math.max(2, size.y), { type: THREE.HalfFloatType, samples: this.q.msaa });
    this.composer = new EffectComposer(r, rt);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.55, 0.88);
    this.bloom.enabled = this.q.bloom;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.finalPass = new ShaderPass(FinalShader);
    this.composer.addPass(this.finalPass);
  }

  setBloom(strength) { if (this.bloom) { this.bloom.strength = strength; this.bloom.enabled = this.q.bloom && strength > 0.01; } }

  resize() {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.q.pr) * this.dynScale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.composer?.setPixelRatio(pr);
    this.composer?.setSize(w, h);
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    this.aspect = w / h;
  }

  // مقیاس پویا برای حفظ روانی
  trackPerf(dt) {
    this.frameTimes.push(dt); if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length; this.frameTimes.length = 0;
    const fps = 1 / avg;
    if (fps < 38 && this.dynScale > 0.55) { this.dynScale = Math.max(0.55, this.dynScale - 0.12); this.resize(); }
    else if (fps > 58 && this.dynScale < 1) { this.dynScale = Math.min(1, this.dynScale + 0.06); this.resize(); }
  }

  render(scene, camera, dt = 0.016) {
    this.camera = camera;
    if (Math.abs(camera.aspect - this.aspect) > 1e-3) { camera.aspect = this.aspect; camera.updateProjectionMatrix(); }
    this.renderPass.scene = scene; this.renderPass.camera = camera;
    this.composer.render(dt);
  }
}

// محیط بیرونی: آسمان، خورشید، مه، نقشه محیطی
export class Outdoor {
  constructor(engine, scene) {
    this.engine = engine; this.scene = scene;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), new THREE.ShaderMaterial({ ...SkyShader, uniforms: THREE.UniformsUtils.clone(SkyShader.uniforms), side: THREE.BackSide, depthWrite: false, fog: false }));
    this.sky.frustumCulled = false; this.sky.renderOrder = -10;
    scene.add(this.sky);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0003; this.sun.shadow.normalBias = 0.035;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog(0xcccccc, 300, 4200);
    this.sunDir = new THREE.Vector3();
    this.setShadowSize(engine.q.shadow);
  }
  setShadowSize(size) {
    const s = this.sun.shadow; s.mapSize.set(size, size);
    const ext = size >= 4096 ? 85 : size >= 2048 ? 70 : 55;
    s.camera.left = -ext; s.camera.right = ext; s.camera.top = ext; s.camera.bottom = -ext; s.camera.near = 10; s.camera.far = 700;
    s.camera.updateProjectionMatrix(); this.shadowExt = ext;
    if (s.map) { s.map.dispose(); s.map = null; }
  }
  apply(timeKey, light = {}) {
    const P = TIMES[timeKey] || TIMES.noon; this.time = timeKey; this.preset = P;
    const el = THREE.MathUtils.degToRad(P.elev), az = THREE.MathUtils.degToRad(P.azim);
    this.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
    const u = this.sky.material.uniforms;
    u.topColor.value.set(P.top); u.horizonColor.value.set(P.hor); u.groundColor.value.set(P.ground); u.sunColor.value.set(P.sun);
    u.sunDir.value.copy(this.sunDir); u.starAmt.value = P.stars; u.cloudAmt.value = P.clouds * (light.clouds ?? 1); u.cloudBright.value = P.cloudB;
    const sunMul = light.sun ?? 1;
    this.sun.color.set(P.sun); this.sun.intensity = P.sunI * sunMul;
    this.hemi.color.set(P.hemiS); this.hemi.groundColor.set(P.hemiG); this.hemi.intensity = P.hemiI * (light.ambient ?? 1);
    this.scene.fog.color.set(P.fog);
    const fogMul = light.fog ?? 1;
    this.scene.fog.near = 250 / Math.max(0.2, fogMul); this.scene.fog.far = (timeKey === 'night' ? 2600 : 4800) / Math.max(0.2, fogMul);
    this.engine.renderer.toneMappingExposure = P.exp * (light.exposure ?? 1);
    this.engine.setBloom((light.bloom ?? 0.5) * (timeKey === 'night' ? 1.4 : 0.8));
    const shadowsOn = (light.shadows ?? true) && this.engine.q.shadowOn;
    this.sun.castShadow = shadowsOn; this.engine.renderer.shadowMap.enabled = shadowsOn;
    this.updateEnv();
  }
  updateEnv() {
    const envScene = new THREE.Scene();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), this.sky.material);
    envScene.add(sky);
    // زمین تیره در پایین برای انعکاس واقعی‌تر
    const g = new THREE.Mesh(new THREE.CircleGeometry(90, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(this.preset.ground).multiplyScalar(0.6) }));
    g.rotation.x = -Math.PI / 2; g.position.y = -8; envScene.add(g);
    const rt = this.engine.pmrem.fromScene(envScene, 0.02, 0.1, 400);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
    sky.geometry.dispose(); g.geometry.dispose();
  }
  update(dt, focus, camera) {
    this.sky.position.copy(camera.position);
    this.sky.material.uniforms.time.value += dt;
    // سایه همراه با ماشین (با گام به اندازه تکسل برای جلوگیری از لرزش)
    const ext = this.shadowExt; const texel = (ext * 2) / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx + this.sunDir.x * 350, focus.y + this.sunDir.y * 350, fz + this.sunDir.z * 350);
    this.sun.target.updateMatrixWorld();
  }
}
