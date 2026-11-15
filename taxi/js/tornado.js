import * as THREE from 'three';
import { regionAt } from './world.js';
import { fa, clamp } from './util.js';

const H = 140; // funnel height
const DEBRIS = 40;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

/** A tornado that sometimes touches down in the desert or the farmland during bad weather. */
export class Tornado {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.checkT = 60;
    this.build();
  }
  build() {
    const g = this.g;
    // swirling dust texture, wrapped around stacked open cylinders
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 256;
    const c = cv.getContext('2d');
    c.fillStyle = 'rgba(0,0,0,0)';
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const y = Math.random() * 256, x = Math.random() * 256, w = 20 + Math.random() * 70;
      const a = 0.04 + Math.random() * 0.12;
      c.fillStyle = `rgba(${90 + Math.random() * 50},${80 + Math.random() * 40},${70 + Math.random() * 30},${a})`;
      c.fillRect(x, y, w, 2 + Math.random() * 5);
      c.fillRect(x - 256, y, w, 2 + Math.random() * 5);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.tex = tex;
    this.mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0, color: 0x9b8f80 });
    const grp = new THREE.Group();
    this.layers = [];
    for (let i = 0; i < 3; i++) {
      // narrow at the ground, wide in the clouds
      const geo = new THREE.CylinderGeometry(42 - i * 6, 5 + i * 2.5, H, 28, 8, true);
      geo.translate(0, H / 2, 0);
      const m = new THREE.Mesh(geo, this.mat);
      m.renderOrder = 4;
      grp.add(m);
      this.layers.push(m);
    }
    // the dark cloud it hangs from
    const cloud = new THREE.Mesh(new THREE.CylinderGeometry(110, 80, 22, 32, 1), new THREE.MeshBasicMaterial({ color: 0x3c4148, transparent: true, opacity: 0, depthWrite: false }));
    cloud.position.y = H + 6;
    grp.add(cloud);
    this.cloud = cloud;
    grp.visible = false;
    g.scene.add(grp);
    this.grp = grp;
    // debris whirling round the funnel
    const dm = new THREE.MeshStandardMaterial({ color: 0x6d5a45, roughness: 0.9 });
    this.debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.4, 1.6), dm, DEBRIS);
    this.debris.frustumCulled = false;
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debris.visible = false;
    g.scene.add(this.debris);
    this.bits = [];
    for (let i = 0; i < DEBRIS; i++) this.bits.push({ r: 6 + Math.random() * 26, h: Math.random() * 90, a: Math.random() * 6.28, s: 0.4 + Math.random() * 1.4, sp: 1.2 + Math.random() * 1.5 });
  }
  canSpawn() {
    const g = this.g, f = g.focus();
    const reg = regionAt(f.pos.x, f.pos.z);
    if (reg !== 'desert' && reg !== 'farm') return false;
    if (g.race.state !== 'idle' || g.crazy.state !== 'idle' || g.drag.state !== 'idle' || g.parking.state !== 'idle') return false;
    return true;
  }
  spawn(force = false) {
    const g = this.g, f = g.focus();
    if (this.active || (!force && !this.canSpawn())) return false;
    // touch down 280-380 m away, then wander towards you
    const a = Math.random() * Math.PI * 2, d = 280 + Math.random() * 100;
    this.x = f.pos.x + Math.cos(a) * d;
    this.z = f.pos.z + Math.sin(a) * d;
    const to = Math.atan2(f.pos.x - this.x, f.pos.z - this.z) + (Math.random() - 0.5) * 0.7;
    this.vx = Math.sin(to) * 8;
    this.vz = Math.cos(to) * 8;
    this.t = 0;
    this.life = 85 + Math.random() * 25;
    this.active = true;
    this.lifted = false;
    this.closest = 1e9;
    this.grp.visible = this.debris.visible = true;
    g.ui.toast('🌪️ هشدار! یه گردباد توی دشت نشسته! ازش دور شو… یا اگه جراتش رو داری نزدیکش شو 😱', 'bad');
    [0, 0.45, 0.9].forEach((t) => g.audio.tone(620, 0.35, 0.12, 'sawtooth', t));
    // dark skies, but no sandstorm: you want to see it coming
    g.weather.set('cloudy', false);
    g.stats.tornados = (g.stats.tornados || 0) + 1;
    return true;
  }
  end() {
    const g = this.g;
    this.active = false;
    this.grp.visible = this.debris.visible = false;
    g.audio.setStorm(0);
    // storm chaser: you got close and lived to tell the tale
    if (this.closest < 70 && g.player.health > 0 && g.state !== 'jail') {
      g.coins += 15;
      g.addXp(60);
      g.stats.stormChased = (g.stats.stormChased || 0) + 1;
      g.ui.achievement('🌪️', 'از گردباد جون سالم به در بردی!', 15, '⛈️ شکارچی طوفان');
    } else g.ui.toast('🌪️ گردباد آروم شد و از بین رفت', 'info');
  }
  update(dt) {
    const g = this.g;
    if (!this.active) {
      if (g.state !== 'play') return;
      this.checkT -= dt;
      if (this.checkT > 0) return;
      this.checkT = 40;
      const w = g.weather;
      const chance = w.kind === 'storm' ? 0.3 : w.kind === 'cloudy' || w.kind === 'rain' ? 0.08 : 0.02;
      if (Math.random() < chance) this.spawn();
      return;
    }
    if (g.state !== 'play') return;
    this.t += dt;
    const p = g.player, f = g.focus();
    // wander, with a slow pull towards whoever is watching
    const to = Math.atan2(f.pos.x - this.x, f.pos.z - this.z);
    this.vx += (Math.sin(to) * 2 + (Math.random() - 0.5) * 6) * dt;
    this.vz += (Math.cos(to) * 2 + (Math.random() - 0.5) * 6) * dt;
    const sp = Math.hypot(this.vx, this.vz);
    if (sp > 11) {
      this.vx *= 11 / sp;
      this.vz *= 11 / sp;
    }
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    const k = clamp(Math.min(this.t / 6, (this.life - this.t) / 6), 0, 1);
    const gy = g.world.heightAt(this.x, this.z);
    this.grp.position.set(this.x, gy - 2, this.z);
    this.layers.forEach((l, i) => (l.rotation.y -= dt * (1.6 + i * 0.7)));
    this.tex.offset.y -= dt * 0.35;
    this.mat.opacity = 0.75 * k;
    this.cloud.material.opacity = 0.6 * k;
    this.grp.scale.set(0.4 + 0.6 * k, 1, 0.4 + 0.6 * k);
    // debris and dust
    for (let i = 0; i < DEBRIS; i++) {
      const b = this.bits[i];
      b.a += dt * b.sp * (40 / (b.r + 10));
      b.h += dt * (6 + b.sp * 4);
      if (b.h > 110) b.h = 0;
      const r = (b.r + b.h * 0.18) * k;
      _p.set(this.x + Math.cos(b.a) * r, gy + b.h * k, this.z + Math.sin(b.a) * r);
      _e.set(b.a * 2, b.a * 3, b.h);
      _s.setScalar(b.s * k);
      _m.compose(_p, _q.setFromEuler(_e), _s);
      this.debris.setMatrixAt(i, _m);
    }
    this.debris.instanceMatrix.needsUpdate = true;
    if (Math.random() < 0.7 * k) {
      const a = Math.random() * 6.28, r = 6 + Math.random() * 12;
      g.nature.dust.emit(this.x + Math.cos(a) * r, gy + 0.5, this.z + Math.sin(a) * r, -Math.sin(a) * 12, 3 + Math.random() * 4, Math.cos(a) * 12, 2.2, 4, 2, 0.5, 0.6);
    }
    // what it does to you
    const dx = p.pos.x - this.x, dz = p.pos.z - this.z, d = Math.hypot(dx, dz) || 1;
    this.closest = Math.min(this.closest, d);
    const near = clamp(1 - d / 260, 0, 1);
    g.audio.setStorm(near * k);
    g.shake = Math.max(g.shake || 0, clamp(1 - d / 90, 0, 1) * 0.9 * k);
    if (!g.onfoot.active && d < 75 && k > 0.5) {
      // swirl round and get sucked in
      const pull = (1 - d / 75) * 14 * dt;
      p.ext.x += (-dz / d) * pull * 1.3 - (dx / d) * pull * 0.7;
      p.ext.y += (dx / d) * pull * 1.3 - (dz / d) * pull * 0.7;
      p.dirt = Math.min(1, (p.dirt || 0) + dt * 0.05);
      if (d < 13 && !p.air) {
        // up it goes!
        p.air = true;
        p.vy = 17 + Math.random() * 5;
        p.airT = 0.3;
        p.airMax = 0;
        p.geyserLaunch = true;
        p.airSpin = (p.airSpin || 0) + (Math.random() < 0.5 ? 1 : -1) * 0.3;
        p.health = Math.max(0, p.health - 8);
        p.ext.x += (-dz / d) * 9;
        p.ext.y += (dx / d) * 9;
        if (!this.lifted) {
          this.lifted = true;
          g.stats.tornadoLift = (g.stats.tornadoLift || 0) + 1;
          g.ui.toast('🌪️ گردباد تاکسی رو برد هوا!!! 😱', 'bad');
          g.replay.offer();
        }
      }
    }
    // traffic gets tossed about too
    for (const c of g.traffic.cars) {
      if (!c.active) continue;
      const cx = c.pos.x - this.x, cz = c.pos.z - this.z, cd = Math.hypot(cx, cz);
      if (cd < 30 && k > 0.5) {
        c.knock.x += (-cz / (cd || 1)) * 30 * dt;
        c.knock.y += (cx / (cd || 1)) * 30 * dt;
        c.spin += dt * 3;
        if (c.state === 'drive') c.state = 'hit';
        c.hitTimer = 3;
      }
    }
    if (this.t > this.life || Math.hypot(this.x - f.pos.x, this.z - f.pos.z) > 900) this.end();
  }
  mapIcon() {
    return this.active ? { x: this.x, z: this.z, col: '#6d4c41', txt: '🌪️' } : null;
  }
  /** for the weather app */
  warning() {
    return this.active ? `🌪️ گردباد فعال! ${fa(Math.round(Math.hypot(this.x - this.g.player.pos.x, this.z - this.g.player.pos.z)))} متر از تو` : '';
  }
}
