// Weather: GPU rain / snow / sand / ash particles around the camera, lightning, rainbow, wind, wetness, snow cover.
import * as THREE from 'three';
import { clamp, lerp, rng } from '../util.js';
import { G, bus } from '../game.js';

export const WEATHER_TYPES = ['clear', 'cloudy', 'lightRain', 'heavyRain', 'storm', 'snow', 'blizzard', 'sandstorm', 'fog', 'mist', 'ash'];
const DEF = {
  clear: { cloud: 0.18, dark: 0, fog: 0, rain: 0, snow: 0, sand: 0, ash: 0, wind: 0.25 },
  cloudy: { cloud: 0.78, dark: 0.18, fog: 0.05, rain: 0, snow: 0, sand: 0, ash: 0, wind: 0.4 },
  lightRain: { cloud: 0.85, dark: 0.35, fog: 0.12, rain: 0.35, snow: 0, sand: 0, ash: 0, wind: 0.35 },
  heavyRain: { cloud: 0.95, dark: 0.55, fog: 0.3, rain: 1, snow: 0, sand: 0, ash: 0, wind: 0.55 },
  storm: { cloud: 1, dark: 0.78, fog: 0.25, rain: 1, snow: 0, sand: 0, ash: 0, wind: 0.85, lightning: 1 },
  snow: { cloud: 0.7, dark: 0.2, fog: 0.18, rain: 0, snow: 0.6, sand: 0, ash: 0, wind: 0.3 },
  blizzard: { cloud: 1, dark: 0.4, fog: 0.62, rain: 0, snow: 1, sand: 0, ash: 0, wind: 1 },
  sandstorm: { cloud: 0.35, dark: 0.22, fog: 0.66, rain: 0, snow: 0, sand: 1, ash: 0, wind: 0.95 },
  fog: { cloud: 0.5, dark: 0.12, fog: 0.78, rain: 0, snow: 0, sand: 0, ash: 0, wind: 0.1 },
  mist: { cloud: 0.4, dark: 0.05, fog: 0.42, rain: 0, snow: 0, sand: 0, ash: 0, wind: 0.15 },
  ash: { cloud: 0.62, dark: 0.42, fog: 0.32, rain: 0, snow: 0, sand: 0, ash: 0.8, wind: 0.35 },
};

const BOX = 70;
const rainVS = `
attribute vec4 aSeed; attribute float aEnd;
uniform vec3 uCam; uniform float uTime, uSpeed, uLen, uBox; uniform vec2 uWind;
varying float vA;
void main(){
  vec3 p = aSeed.xyz * uBox;
  p.y = mod(p.y - uTime*uSpeed*(0.8+aSeed.w*0.4), uBox);
  p.xz = mod(p.xz + uWind*uTime - uCam.xz + uBox*0.5, uBox) - uBox*0.5 + uCam.xz;
  p.y = uCam.y + p.y - uBox*0.45;
  vec3 dir = normalize(vec3(uWind.x, -uSpeed, uWind.y));
  p -= dir * uLen * aEnd;
  vA = (1.0 - aEnd) * 0.65 + 0.15;
  vec4 mv = modelViewMatrix * vec4(p,1.0);
  vA *= smoothstep(uBox*0.5, uBox*0.2, length(mv.xyz));
  gl_Position = projectionMatrix * mv;
}`;
const rainFS = `uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA*uOpacity); }`;
const flakeVS = `
attribute vec4 aSeed;
uniform vec3 uCam; uniform float uTime, uSpeed, uBox, uSize, uSwirl; uniform vec2 uWind;
varying float vA;
void main(){
  vec3 p = aSeed.xyz * uBox;
  float t = uTime*(0.7+aSeed.w*0.6);
  p.y = mod(p.y - t*uSpeed, uBox);
  p.x += sin(t*1.3 + aSeed.w*30.0)*uSwirl; p.z += cos(t*1.1 + aSeed.x*20.0)*uSwirl;
  p.xz = mod(p.xz + uWind*uTime - uCam.xz + uBox*0.5, uBox) - uBox*0.5 + uCam.xz;
  p.y = uCam.y + p.y - uBox*0.45;
  vec4 mv = modelViewMatrix * vec4(p,1.0);
  vA = smoothstep(uBox*0.5, uBox*0.15, length(mv.xyz));
  gl_PointSize = uSize * (0.6+aSeed.w) * (300.0 / max(1.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;
const flakeFS = `uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c); if (d>0.5) discard; gl_FragColor = vec4(uColor, vA*uOpacity*smoothstep(0.5,0.1,d)); }`;

export class Weather {
  constructor(scene, preset) {
    this.scene = scene; this.type = 'clear'; this.cur = Object.assign({}, DEF.clear); this.target = DEF.clear;
    this.windDir = new THREE.Vector2(1, 0.3).normalize(); this.wind = new THREE.Vector3();
    this.wet = 0; this.snowCover = 0; this.timer = 60; this.lightTimer = 6; this.rainbow = 0; this.wasRaining = false;
    this.strikes = [];
    this.group = new THREE.Group(); this.group.name = 'weather'; scene.add(this.group);
    this.build(preset);
    // lightning bolt (reused)
    this.bolt = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 1, fog: false }));
    this.bolt.visible = false; this.bolt.frustumCulled = false; scene.add(this.bolt);
    // rainbow
    const rbMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uA: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
      fragmentShader: `varying vec2 vUv; uniform float uA; vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0,4,2),6.0)-3.0)-1.0,0.0,1.0);} void main(){ float r = vUv.y; vec3 c = hue(0.8 - r*0.8); float a = smoothstep(0.0,0.15,r)*smoothstep(1.0,0.85,r)*uA*0.35; gl_FragColor = vec4(c*a, a); }`,
    });
    this.rainbowMesh = new THREE.Mesh(new THREE.RingGeometry(380, 440, 64, 1, 0, Math.PI), rbMat);
    this.rainbowMesh.visible = false; scene.add(this.rainbowMesh);
    // strike warning ring pool
    this.warnMat = new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.6, depthWrite: false });
  }
  build(p) {
    this.p = p;
    while (this.group.children.length) { const m = this.group.children.pop(); m.geometry.dispose(); m.material.dispose(); }
    const n = Math.max(200, p.weatherP | 0);
    const r = rng(3);
    // rain: line segments
    const seeds = new Float32Array(n * 2 * 4), ends = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { const s = [r(), r(), r(), r()]; for (let e = 0; e < 2; e++) { seeds.set(s, (i * 2 + e) * 4); ends[i * 2 + e] = e; } }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
    rg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4)); rg.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
    this.rainU = { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uSpeed: { value: 32 }, uLen: { value: 1.1 }, uBox: { value: BOX }, uWind: { value: new THREE.Vector2() }, uColor: { value: new THREE.Color(0xaec6e8) }, uOpacity: { value: 0.5 } };
    this.rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({ vertexShader: rainVS, fragmentShader: rainFS, uniforms: this.rainU, transparent: true, depthWrite: false }));
    this.rain.frustumCulled = false; this.rain.visible = false; this.group.add(this.rain); this.rainN = n;
    // flakes (snow / sand / ash) share geometry type
    const mk = (color, speed, size, swirl, op) => {
      const g = new THREE.BufferGeometry(); const sd = new Float32Array(n * 4); for (let i = 0; i < n * 4; i++) sd[i] = r();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4));
      const u = { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uSpeed: { value: speed }, uBox: { value: BOX }, uSize: { value: size }, uSwirl: { value: swirl }, uWind: { value: new THREE.Vector2() }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: op } };
      const m = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: flakeVS, fragmentShader: flakeFS, uniforms: u, transparent: true, depthWrite: false }));
      m.frustumCulled = false; m.visible = false; m.userData.u = u; this.group.add(m); return m;
    };
    this.snowP = mk(0xffffff, 2.4, 0.5, 1.2, 0.9);
    this.sandP = mk(0xd9a866, 1.0, 0.35, 0.4, 0.55);
    this.ashP = mk(0x3a3330, 1.4, 0.45, 0.8, 0.8);
  }
  set(type, instant) {
    if (!DEF[type]) type = 'clear';
    this.type = type; this.target = DEF[type];
    if (instant) Object.assign(this.cur, this.target);
    bus.emit('weather', type);
  }
  pickFor(region) {
    const mode = G.settings.gameplay.weather;
    if (mode !== 'dynamic') { if (this.type !== mode) this.set(mode); return; }
    const list = region.weather; const w = list[Math.floor(Math.random() * list.length)];
    this.set(w);
  }
  update(dt, cam, focus, sky, region) {
    const c = this.cur, t = this.target, k = 1 - Math.exp(-dt / 6);
    for (const key in c) if (key !== 'lightning') c[key] = lerp(c[key], t[key] || 0, k);
    // region change / periodic re-roll
    if (region !== this.lastRegion) { this.lastRegion = region; this.pickFor(region); this.timer = 150 + Math.random() * 120; }
    this.timer -= dt; if (this.timer < 0) { this.timer = 150 + Math.random() * 150; this.pickFor(region); }
    // wind
    const ang = Math.sin(G.time * 0.01) * 1.2; this.windDir.set(Math.cos(ang), Math.sin(ang));
    const ws = c.wind * 14; this.wind.set(this.windDir.x * ws, 0, this.windDir.y * ws);
    const indoor = G.player && G.player.underwater;
    // particles
    const tm = G.time;
    const setU = (u, op) => { u.uCam.value.copy(cam.position); u.uTime.value = tm; u.uWind.value.set(this.wind.x * 0.6, this.wind.z * 0.6); u.uOpacity.value = op; };
    const rv = c.rain > 0.02 && !indoor; this.rain.visible = rv;
    if (rv) { setU(this.rainU, 0.55 * Math.min(1, c.rain * 1.5)); this.rain.geometry.setDrawRange(0, Math.floor(this.rainN * c.rain) * 2); }
    for (const [m, v] of [[this.snowP, c.snow], [this.sandP, c.sand], [this.ashP, c.ash]]) {
      m.visible = v > 0.02 && !indoor; if (m.visible) { setU(m.userData.u, Math.min(1, v * 1.4)); m.geometry.setDrawRange(0, Math.floor(this.rainN * v)); }
    }
    // sky + fog coupling
    sky.weatherCloud = c.cloud; sky.weatherDark = c.dark; sky.weatherFog = c.fog;
    if (c.sand > 0.1) sky.regionFog.lerp(new THREE.Color(0xd8a76a), c.sand * 0.5); else sky.regionFog.set(region.fog);
    // wet & snow
    this.wet = clamp(this.wet + (c.rain > 0.2 ? dt * 0.05 : -dt * 0.012), 0, 1);
    this.snowCover = clamp(this.snowCover + (c.snow > 0.3 ? dt * 0.02 : -dt * 0.01), 0, 0.85);
    if (G.terrain) { G.terrain.uniforms.uWet.value = this.wet * 0.8; G.terrain.uniforms.uSnow.value = this.snowCover; }
    // lightning
    if (t.lightning) {
      this.lightTimer -= dt;
      if (this.lightTimer < 0) { this.lightTimer = 4 + Math.random() * 9; this.strike(focus, sky); }
    }
    if (this.bolt.visible) { this.bolt.material.opacity -= dt * 5; if (this.bolt.material.opacity <= 0) this.bolt.visible = false; }
    this.updateStrikes(dt);
    // rainbow after rain in daylight
    const raining = c.rain > 0.3;
    if (this.wasRaining && !raining && sky.uniforms.uSun.value.y > 0.1) this.rainbow = 70;
    this.wasRaining = raining;
    this.rainbow = Math.max(0, this.rainbow - dt);
    const ra = Math.min(1, this.rainbow / 8) * (1 - c.cloud * 0.7);
    this.rainbowMesh.visible = ra > 0.01;
    if (this.rainbowMesh.visible) {
      const s = sky.uniforms.uSun.value; const anti = new THREE.Vector3(-s.x, 0, -s.z).normalize();
      this.rainbowMesh.position.copy(cam.position).addScaledVector(anti, 900); this.rainbowMesh.position.y = cam.position.y - 60;
      this.rainbowMesh.lookAt(cam.position.x, this.rainbowMesh.position.y, cam.position.z);
      this.rainbowMesh.material.uniforms.uA.value = ra;
    }
    // audio beds
    if (G.audio) {
      const a = G.audio;
      a.ambient('rain', indoor ? 0 : c.rain * (1 - c.lightning) * 0.9);
      a.ambient('storm', t.lightning ? c.rain : 0);
      a.ambient('wind', clamp(c.wind * 0.7 + (G.player ? G.player.speed / 140 : 0), 0, 1) * (c.sand > 0.2 ? 0.3 : 1));
      a.ambient('sand', c.sand);
    }
  }
  strike(focus, sky) {
    const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 300;
    const x = focus.x + Math.cos(a) * d, z = focus.z + Math.sin(a) * d;
    const pts = []; let px = x, pz = z, py = 380;
    while (py > focus.y - 10) { pts.push(new THREE.Vector3(px, py, pz)); py -= 18 + Math.random() * 20; px += (Math.random() - 0.5) * 22; pz += (Math.random() - 0.5) * 22; }
    this.setBolt(pts); this.bolt.visible = true; this.bolt.material.opacity = 1;
    sky.flash = 1;
    const delay = d / 340;
    setTimeout(() => G.audio && G.audio.play('thunder', { vol: clamp(1.4 - d / 450, 0.3, 1.4) }), delay * 1000);
    // occasional targeted strike near the player as a gameplay hazard
    if (G.player && G.state === 'play' && Math.random() < 0.35 && !G.player.inSafeZone) this.warnStrike(G.player.pos);
  }
  setBolt(pts) { this.bolt.geometry.dispose(); this.bolt.geometry = new THREE.BufferGeometry().setFromPoints(pts); }
  warnStrike(p) {
    const x = p.x + (Math.random() - 0.5) * 16, z = p.z + (Math.random() - 0.5) * 16;
    const y = G.player.groundY ?? p.y;
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 4, 32), this.warnMat.clone());
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, y + 0.15, z); this.scene.add(ring);
    this.strikes.push({ x, y, z, t: 1.6, ring });
    G.hud && G.hud.toast('weather_strike_warn', 'warn');
  }
  updateStrikes(dt) {
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i]; s.t -= dt; s.ring.material.opacity = 0.35 + 0.35 * Math.sin(s.t * 20);
      if (s.t <= 0) {
        const pts = [new THREE.Vector3(s.x, s.y + 300, s.z), new THREE.Vector3(s.x + 3, s.y + 150, s.z - 2), new THREE.Vector3(s.x - 2, s.y + 60, s.z + 2), new THREE.Vector3(s.x, s.y, s.z)];
        this.setBolt(pts); this.bolt.visible = true; this.bolt.material.opacity = 1;
        G.sky.flash = 1; G.audio && G.audio.play('thunder', { vol: 1.6 }); G.fx && G.fx.explosion(new THREE.Vector3(s.x, s.y, s.z), 0xbfd4ff, 1.2);
        G.cam && G.cam.shake(0.6);
        if (G.player && Math.hypot(G.player.pos.x - s.x, G.player.pos.z - s.z) < 4 && Math.abs(G.player.pos.y - s.y) < 5) G.player.hurt(new THREE.Vector3(s.x, s.y, s.z), 'lightning');
        this.scene.remove(s.ring); s.ring.geometry.dispose(); s.ring.material.dispose(); this.strikes.splice(i, 1);
      }
    }
  }
  frictionMul() { return 1 - this.wet * 0.12 - this.snowCover * 0.15; }
}
