import * as THREE from 'three';
import { clamp, damp } from './util.js';
import { regionAt } from './world.js';

const KINDS = ['clear', 'clear', 'cloudy', 'rain', 'storm'];
const NAMES = { clear: '☀️ هوا صافه', cloudy: '☁️ هوا ابری شد', rain: '🌧️ بارون گرفت! جاده لیزه، مواظب باش', storm: '⛈️ طوفان و رعد و برق!' };
const DROPS = 1800;
const BOX = 70, HEIGHT = 34;

/** Clouds, rain, storms with thunder, wet roads. */
export class Weather {
  constructor(game) {
    this.g = game;
    this.kind = 'clear';
    this.cloud = 0;
    this.rain = 0;
    this.target = { cloud: 0, rain: 0 };
    this.snow = 0;
    // snowflakes for the mountains
    const FL = 1400;
    this.flakes = new Float32Array(FL * 3);
    for (let i = 0; i < FL; i++) {
      this.flakes[i * 3] = (Math.random() - 0.5) * BOX;
      this.flakes[i * 3 + 1] = Math.random() * HEIGHT;
      this.flakes[i * 3 + 2] = (Math.random() - 0.5) * BOX;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FL * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const fc = document.createElement('canvas');
    fc.width = fc.height = 32;
    const fx = fc.getContext('2d');
    const grd = fx.createRadialGradient(16, 16, 1, 16, 16, 15);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    fx.fillStyle = grd;
    fx.fillRect(0, 0, 32, 32);
    this.snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, map: new THREE.CanvasTexture(fc), transparent: true, opacity: 0, depthWrite: false });
    this.snowPts = new THREE.Points(sg, this.snowMat);
    this.snowPts.frustumCulled = false;
    this.snowPts.visible = false;
    game.scene.add(this.snowPts);
    // sandstorm dust for the desert
    this.sand = 0;
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FL * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.dustMat = new THREE.PointsMaterial({ color: 0xc9a46a, size: 0.45, map: this.snowMat.map, transparent: true, opacity: 0, depthWrite: false });
    this.dustPts = new THREE.Points(dg, this.dustMat);
    this.dustPts.frustumCulled = false;
    this.dustPts.visible = false;
    game.scene.add(this.dustPts);
    this.sandColor = new THREE.Color(0xc29a62);
    this.timer = 90 + Math.random() * 120;
    this.thunderT = 8;
    const pos = new Float32Array(DROPS * 6);
    this.drops = new Float32Array(DROPS * 3);
    for (let i = 0; i < DROPS; i++) {
      this.drops[i * 3] = (Math.random() - 0.5) * BOX;
      this.drops[i * 3 + 1] = Math.random() * HEIGHT;
      this.drops[i * 3 + 2] = (Math.random() - 0.5) * BOX;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.LineBasicMaterial({ color: 0xaab8c8, transparent: true, opacity: 0, depthWrite: false });
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.lines.frustumCulled = false;
    game.scene.add(this.lines);
    this.grey = new THREE.Color(0x7c8590);
    this.dark = new THREE.Color(0x4a5058);
  }
  set(kind, announce = true) {
    this.kind = kind;
    this.target.cloud = kind === 'clear' ? 0 : kind === 'cloudy' ? 0.6 : kind === 'rain' ? 0.85 : 1;
    this.target.rain = kind === 'rain' ? 0.75 : kind === 'storm' ? 1 : 0;
    if (announce) this.g.ui.toast(NAMES[kind], kind === 'clear' ? 'good' : 'info');
  }
  /** called after the sky/env update each frame */
  update(dt) {
    const g = this.g;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 120 + Math.random() * 180;
      let k = KINDS[Math.floor(Math.random() * KINDS.length)];
      if (k === this.kind) k = 'clear';
      if (k !== this.kind) this.set(k);
    }
    this.cloud = damp(this.cloud, this.target.cloud, 0.25, dt);
    this.rain = damp(this.rain, this.target.rain, 0.3, dt);
    // up in the mountains the clouds bring snow instead of rain
    const f = g.focus();
    const cold = regionAt(f.pos.x, f.pos.z) === 'lake' && this.target.rain > 0;
    this.snow = damp(this.snow, cold ? 1 : 0, 0.4, dt);
    if (cold && !this.snowSaid && this.snow > 0.3 && g.state === 'play') {
      this.snowSaid = true;
      g.ui.toast('❄️ داره برف میاد! جاده لیز شده، آروم برون', 'info');
    } else if (!cold && this.snow < 0.05) this.snowSaid = false;
    // ...and in the desert they whip up a sandstorm
    const dusty = regionAt(f.pos.x, f.pos.z) === 'desert' && this.target.cloud >= 0.85;
    this.sand = damp(this.sand, dusty ? 1 : 0, 0.35, dt);
    if (dusty && !this.sandSaid && this.sand > 0.3 && g.state === 'play') {
      this.sandSaid = true;
      g.ui.toast('🌪️ طوفان شن! جلوت رو درست نمی‌بینی، آروم برون', 'warn');
    } else if (!dusty && this.sand < 0.05) this.sandSaid = false;
    const c = this.cloud, r = this.rain * (1 - this.snow) * (1 - this.sand);
    this.wet = r;
    // darken the world
    g.sun.intensity *= 1 - 0.75 * c;
    g.hemi.intensity *= 1 - 0.25 * c;
    const u = g.sky.uniforms;
    const gc = this.grey.clone().lerp(this.dark, r).multiplyScalar(1 - g.env.night * 0.85);
    u.top.value.lerp(gc, c * 0.85);
    u.horizon.value.lerp(gc, c * 0.8);
    u.sunColor.value.multiplyScalar(1 - 0.85 * c);
    g.scene.fog.color.lerp(gc, c * 0.8);
    g.scene.fog.far = g.fogFar * (1 - 0.55 * r) * (1 - 0.72 * this.sand);
    // wet roads reflect
    for (const k in g.world.roadMats) {
      const m = g.world.roadMats[k];
      m.roughness = 0.92 - 0.55 * r;
      m.metalness = 0.25 * r;
    }
    // rain streaks follow the camera
    this.mat.opacity = 0.42 * r;
    this.lines.visible = r > 0.05;
    // snowy whiteout
    if (this.snow > 0.01) g.scene.fog.color.lerp(this.white || (this.white = new THREE.Color(0xe8eef4)), 0.55 * this.snow * (1 - g.env.night * 0.8));
    if (this.sand > 0.01) {
      const k = 0.8 * this.sand * (1 - g.env.night * 0.7);
      g.scene.fog.color.lerp(this.sandColor, k);
      u.horizon.value.lerp(this.sandColor, k);
      u.top.value.lerp(this.sandColor, k * 0.7);
    }
    if (this.lines.visible) {
      const cam = g.camera.position;
      const p = this.lines.geometry.attributes.position.array;
      const fall = 26 * dt, len = 0.9;
      for (let i = 0; i < DROPS; i++) {
        let y = this.drops[i * 3 + 1] - fall;
        if (y < 0) y += HEIGHT;
        this.drops[i * 3 + 1] = y;
        const x = cam.x + this.drops[i * 3], z = cam.z + this.drops[i * 3 + 2];
        const yy = cam.y - 8 + y;
        p[i * 6] = x; p[i * 6 + 1] = yy; p[i * 6 + 2] = z;
        p[i * 6 + 3] = x + 0.08; p[i * 6 + 4] = yy - len; p[i * 6 + 5] = z;
      }
      this.lines.geometry.attributes.position.needsUpdate = true;
    }
    g.audio.setRain(Math.max(r, this.sand * 0.75));
    this.updateSnow(dt);
    this.updateDust(dt);
    // thunder in storms
    if (this.kind === 'storm' && r > 0.6) {
      this.thunderT -= dt;
      if (this.thunderT <= 0) {
        this.thunderT = 6 + Math.random() * 12;
        g.ui.flash();
        g.flashT = 0.35; // the lightning lights up the whole scene for a moment
        setTimeout(() => { if (g.state === 'play' || g.state === 'cutscene') g.audio.thunder(); }, 400 + Math.random() * 1200);
      }
    }
  }
  updateSnow(dt) {
    const s = this.snow, g = this.g;
    this.snowPts.visible = s > 0.02;
    this.snowMat.opacity = 0.9 * s;
    if (!this.snowPts.visible) return;
    const cam = g.camera.position, F = this.flakes;
    const p = this.snowPts.geometry.attributes.position.array, t = g.time;
    for (let i = 0; i < F.length / 3; i++) {
      let y = F[i * 3 + 1] - 2.6 * dt;
      if (y < 0) y += HEIGHT;
      F[i * 3 + 1] = y;
      p[i * 3] = cam.x + F[i * 3] + Math.sin(t * 0.9 + i) * 0.6;
      p[i * 3 + 1] = cam.y - 8 + y;
      p[i * 3 + 2] = cam.z + F[i * 3 + 2] + Math.cos(t * 0.7 + i * 1.3) * 0.6;
    }
    this.snowPts.geometry.attributes.position.needsUpdate = true;
  }
  updateDust(dt) {
    const s = this.sand, g = this.g;
    this.dustPts.visible = s > 0.02;
    this.dustMat.opacity = 0.75 * s;
    if (!this.dustPts.visible) return;
    const cam = g.camera.position, F = this.flakes;
    const p = this.dustPts.geometry.attributes.position.array, t = g.time;
    // sand blows sideways, fast
    const wx = 14 * dt, half = BOX / 2;
    for (let i = 0; i < F.length / 3; i++) {
      let x = F[i * 3] + wx;
      if (x > half) x -= BOX;
      F[i * 3] = x;
      p[i * 3] = cam.x + x;
      p[i * 3 + 1] = cam.y - 8 + ((F[i * 3 + 1] * 0.5 + Math.sin(t * 2 + i) * 0.8 + HEIGHT) % (HEIGHT * 0.6));
      p[i * 3 + 2] = cam.z + F[i * 3 + 2];
    }
    this.dustPts.geometry.attributes.position.needsUpdate = true;
  }
  grip() {
    return 1 - 0.12 * this.rain * (1 - this.snow) * (1 - this.sand) - 0.22 * this.snow - 0.08 * this.sand;
  }
}
export { clamp };
