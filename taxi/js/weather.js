import * as THREE from 'three';
import { clamp, damp } from './util.js';

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
    const c = this.cloud, r = this.rain;
    // darken the world
    g.sun.intensity *= 1 - 0.75 * c;
    g.hemi.intensity *= 1 - 0.25 * c;
    const u = g.sky.uniforms;
    const gc = this.grey.clone().lerp(this.dark, r).multiplyScalar(1 - g.env.night * 0.85);
    u.top.value.lerp(gc, c * 0.85);
    u.horizon.value.lerp(gc, c * 0.8);
    u.sunColor.value.multiplyScalar(1 - 0.85 * c);
    g.scene.fog.color.lerp(gc, c * 0.8);
    g.scene.fog.far = g.fogFar * (1 - 0.55 * r);
    // wet roads reflect
    for (const k in g.world.roadMats) {
      const m = g.world.roadMats[k];
      m.roughness = 0.92 - 0.55 * r;
      m.metalness = 0.25 * r;
    }
    // rain streaks follow the camera
    this.mat.opacity = 0.42 * r;
    this.lines.visible = r > 0.02;
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
    g.audio.setRain(r);
    // thunder in storms
    if (this.kind === 'storm' && r > 0.6) {
      this.thunderT -= dt;
      if (this.thunderT <= 0) {
        this.thunderT = 6 + Math.random() * 12;
        g.ui.flash();
        setTimeout(() => { if (g.state === 'play' || g.state === 'cutscene') g.audio.thunder(); }, 400 + Math.random() * 1200);
      }
    }
  }
  grip() {
    return 1 - 0.12 * this.rain;
  }
}
export { clamp };
