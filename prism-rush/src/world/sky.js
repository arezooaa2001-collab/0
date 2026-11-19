// Procedural sky (scattering approximation, clouds, stars, moon), sun/moon lights, day-night cycle, fog, env-map.
import * as THREE from 'three';
import { clamp, lerp, smooth } from '../util.js';

const skyVS = `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = vec4(p.xy, p.w*0.99999, p.w); }`;
const skyFS = `
precision highp float;
varying vec3 vDir;
uniform vec3 uSun, uMoon, uZenith, uHorizon, uGround, uSunCol;
uniform float uTime, uCloud, uNight, uSpace, uStorm, uFlash, uStars, uCloudDark;
float hash(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<OCT;i++){ s+=a*vnoise(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(h,0.0,1.0), 0.5));
  col = mix(col, uGround, smoothstep(0.0,-0.2,h));
  float sd = max(dot(d,uSun),0.0);
  float sunUp = smoothstep(-0.12, 0.05, uSun.y);
  col += uSunCol * (pow(sd,6.0)*0.28 + pow(sd,64.0)*0.6) * sunUp * (1.0-uStorm*0.8);
  col += uSunCol * smoothstep(0.99935,0.99965,sd) * 14.0 * sunUp * (1.0-uCloud*0.7);
  // stars
  float starVis = max(uNight, uSpace) * (1.0-uCloud*0.85) * smoothstep(-0.05,0.15,h);
  if (starVis > 0.01) {
    vec3 sp = d * 380.0; vec3 cell = floor(sp); float s = hash(cell);
    float th = 1.0 - uStars;
    if (s > th) { vec3 f = fract(sp)-0.5; float st = smoothstep(0.32,0.0,length(f)); float tw = 0.6+0.4*sin(uTime*3.0 + s*80.0); col += vec3(0.9,0.95,1.0)*st*tw*starVis*2.2; }
    // milky band
    col += vec3(0.18,0.16,0.3)*starVis*0.35*smoothstep(0.6,0.0,abs(dot(d, normalize(vec3(0.3,0.5,0.8)))))*fbm(d.xz*6.0);
  }
  // moon
  float md = dot(d,uMoon);
  float moonVis = max(uNight, uSpace*0.6) * (1.0-uCloud*0.6);
  col += vec3(0.9,0.94,1.0) * smoothstep(0.9988,0.99915,md) * 3.0 * moonVis;
  col += vec3(0.4,0.5,0.8) * pow(max(md,0.0),200.0) * 0.35 * moonVis;
  // clouds
  if (h > -0.02 && uCloud > 0.001) {
    vec2 uv = d.xz / (h + 0.12) * 0.9 + vec2(uTime*0.006, uTime*0.0025);
    float n = fbm(uv*1.4);
    float cover = smoothstep(1.0-uCloud*0.95, 1.05-uCloud*0.6, n + 0.15*uCloud);
    float lit = clamp(dot(normalize(vec3(uSun.x, max(uSun.y,0.05), uSun.z)), vec3(0,1,0))*0.6+0.4, 0.0, 1.0);
    vec3 cc = mix(vec3(0.55,0.58,0.65), vec3(1.0), lit*(1.0-uCloudDark));
    cc = mix(cc, uHorizon*1.1, 0.25);
    cc *= mix(1.0, 0.18, uNight);
    cc += uSunCol*pow(sd,8.0)*0.6*sunUp;
    col = mix(col, cc, cover*smoothstep(-0.02,0.15,h)*(1.0-uSpace));
  }
  col = mix(col, vec3(0.0,0.0,0.012) + col*0.15, uSpace*0.85);
  col += vec3(0.75,0.8,1.0)*uFlash*0.9;
  gl_FragColor = vec4(col,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const C = (h) => new THREE.Color(h);
const KEY = [ // [sunElevation, zenith, horizon, sunColor, sunIntensity, hemiSky, hemiGround, hemiInt]
  [-0.35, C(0x02040c), C(0x0a1224), C(0x6680ff), 0.0, C(0x1a2a55), C(0x0b0e14), 0.32],
  [-0.08, C(0x0b1430), C(0x3a2a48), C(0xff7a40), 0.0, C(0x30385e), C(0x161214), 0.4],
  [0.02, C(0x2a3f7a), C(0xff9a5c), C(0xff8a45), 1.2, C(0x8a8fb8), C(0x4a3a30), 0.75],
  [0.15, C(0x3a6fc4), C(0xffd2a0), C(0xffc890), 2.4, C(0xa9c4ef), C(0x6a5a44), 1.0],
  [0.45, C(0x2f6fd6), C(0xa9d6ff), C(0xfff2dc), 3.1, C(0xb6d6ff), C(0x7a6a52), 1.15],
  [1.0, C(0x2465d0), C(0x9fd0ff), C(0xffffff), 3.3, C(0xbad8ff), C(0x7d6c55), 1.2],
];

export class Sky {
  constructor(scene, renderer, preset) {
    this.scene = scene; this.renderer = renderer;
    this.hours = 9.5; this.dayLength = 16 * 60; this.fixed = null;
    this.uniforms = {
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uMoon: { value: new THREE.Vector3(0, -1, 0) },
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color(0x3a3a40) }, uSunCol: { value: new THREE.Color() },
      uTime: { value: 0 }, uCloud: { value: 0.3 }, uNight: { value: 0 }, uSpace: { value: 0 }, uStorm: { value: 0 }, uFlash: { value: 0 }, uStars: { value: 0.004 }, uCloudDark: { value: 0 },
    };
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), null);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -10; this.mesh.name = 'sky';
    scene.add(this.mesh);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.target = new THREE.Object3D(); scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbad8ff, 0x7d6c55, 1.1); scene.add(this.hemi);
    this.fog = new THREE.Fog(0xcde8ff, 100, 1000); scene.fog = this.fog;
    this.regionFog = new THREE.Color(0xcde8ff);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene(); this.envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), null); this.envScene.add(this.envSky);
    this.envTimer = 0; this.envRT = null;
    this.weatherCloud = 0.3; this.weatherDark = 0; this.weatherFog = 0;
    this.space = 0; this.flash = 0;
    this.setPreset(preset);
  }
  setPreset(p) {
    this.p = p;
    const mat = new THREE.ShaderMaterial({ vertexShader: skyVS, fragmentShader: skyFS, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false, defines: { OCT: p.skyOct } });
    if (this.mesh.material) this.mesh.material.dispose();
    this.mesh.material = mat; this.envSky.material = mat;
    this.uniforms.uStars.value = clamp(p.stars / 600000, 0.0006, 0.012);
    const s = this.sun;
    s.castShadow = p.shadow > 0;
    if (p.shadow > 0) {
      const max = this.renderer.capabilities.maxTextureSize || 4096;
      const size = Math.min(p.shadow, max);
      if (s.shadow.map) { s.shadow.map.dispose(); s.shadow.map = null; }
      s.shadow.mapSize.set(size, size);
      const d = p.shadowDist; const cam = s.shadow.camera;
      cam.left = -d; cam.right = d; cam.top = d; cam.bottom = -d; cam.near = 1; cam.far = 600; cam.updateProjectionMatrix();
      s.shadow.bias = -0.0004; s.shadow.normalBias = 0.04 * (d / 40);
      s.shadow.radius = p.index >= 2 ? 2.5 : 1;
    }
    this.renderer.shadowMap.enabled = p.shadow > 0;
    this.renderer.shadowMap.type = p.index >= 2 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.renderer.shadowMap.needsUpdate = true;
    if (!p.env) { this.scene.environment = null; if (this.envRT) { this.envRT.dispose(); this.envRT = null; } }
    this.envTimer = 0;
  }
  isNight() { return this.uniforms.uNight.value > 0.5; }
  update(dt, focus, camera, drawDist) {
    const set = this.fixed;
    if (set === null) this.hours = (this.hours + dt * 24 / this.dayLength) % 24; else this.hours = set;
    const u = this.uniforms; u.uTime.value += dt;
    const th = (this.hours - 6) / 12 * Math.PI;
    const sun = u.uSun.value.set(-Math.cos(th), Math.sin(th) * 0.92, 0.38).normalize();
    u.uMoon.value.set(Math.cos(th) * 0.9, -Math.sin(th) * 0.85 + 0.15, -0.4).normalize();
    const e = sun.y;
    // interpolate key frames
    let a = KEY[0], b = KEY[KEY.length - 1];
    for (let i = 0; i < KEY.length - 1; i++) if (e >= KEY[i][0] && e <= KEY[i + 1][0]) { a = KEY[i]; b = KEY[i + 1]; break; }
    if (e < KEY[0][0]) b = a; if (e > 1) a = b;
    const t = a === b ? 0 : smooth(clamp((e - a[0]) / (b[0] - a[0]), 0, 1));
    const storm = this.weatherDark;
    const grey = new THREE.Color(0x70757e);
    u.uZenith.value.copy(a[1]).lerp(b[1], t).lerp(grey, storm * 0.7);
    u.uHorizon.value.copy(a[2]).lerp(b[2], t).lerp(grey, storm * 0.6);
    u.uSunCol.value.copy(a[3]).lerp(b[3], t);
    const night = clamp(1 - (e + 0.12) / 0.2, 0, 1); u.uNight.value = night;
    u.uCloud.value = damp1(u.uCloud.value, this.weatherCloud, dt);
    u.uCloudDark.value = storm; u.uStorm.value = storm;
    this.flash = Math.max(0, this.flash - dt * 4); u.uFlash.value = this.flash;
    u.uSpace.value = this.space;
    // sun / moon light
    const sunI = lerp(a[4], b[4], t) * (1 - storm * 0.65);
    const moonI = 0.45 * night;
    const useMoon = sunI < 0.3;
    const dir = useMoon ? u.uMoon.value : sun;
    this.sun.intensity = useMoon ? moonI : sunI;
    this.sun.color.copy(useMoon ? new THREE.Color(0x9fb4ff) : u.uSunCol.value);
    this.sun.intensity += this.flash * 3;
    // shadow camera follows the player, snapped to texels to avoid shimmer
    const d = this.p.shadowDist || 60;
    const texel = (2 * d) / (this.sun.shadow.mapSize.x || 1024);
    const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx + dir.x * 260, focus.y + Math.max(0.15, dir.y) * 260, fz + dir.z * 260);
    this.hemi.color.copy(a[5]).lerp(b[5], t).lerp(grey, storm * 0.5);
    this.hemi.groundColor.copy(a[6]).lerp(b[6], t);
    this.hemi.intensity = lerp(a[7], b[7], t) * (1 - storm * 0.35) + this.flash * 1.5 + this.space * 0.3;
    // fog
    const fogC = this.fog.color.copy(u.uHorizon.value).lerp(this.regionFog, 0.35 * (1 - night)).multiplyScalar(lerp(1, 0.35, night * 0.9));
    if (this.space > 0) fogC.lerp(new THREE.Color(0x02030a), this.space);
    const wf = this.weatherFog;
    this.fog.far = lerp(drawDist * 0.95, Math.min(drawDist, 160), wf) * (1 + this.space * 2);
    this.fog.near = lerp(drawDist * 0.25, 4, wf);
    this.mesh.position.copy(camera.position);
    this.mesh.scale.setScalar(Math.min(10, camera.far / 120));
    // environment map refresh
    if (this.p.env) {
      this.envTimer -= dt;
      if (this.envTimer <= 0) {
        this.envTimer = this.p.envEvery || 20;
        if (this.envRT) this.envRT.dispose();
        this.envSky.scale.setScalar(1);
        this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 200);
        this.scene.environment = this.envRT.texture;
        this.scene.environmentIntensity = 0.55;
      }
    }
  }
  sunScreenPos(camera, out) {
    const p = new THREE.Vector3().copy(this.uniforms.uSun.value).multiplyScalar(1000).add(camera.position).project(camera);
    out.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
    return Math.max(0, fwd.dot(this.uniforms.uSun.value)) * smooth(clamp(this.uniforms.uSun.value.y * 6 + 0.3, 0, 1)) * (1 - this.weatherDark);
  }
}
function damp1(a, b, dt) { return a + (b - a) * (1 - Math.exp(-0.6 * dt)); }
