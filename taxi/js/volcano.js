import * as THREE from 'three';
import { clamp, fa, canvasTexture } from './util.js';
import { Particles } from './effects.js';

function lavaTexture() {
  const t = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#ff7a10';
    g.fillRect(0, 0, w, h);
    // bright veins and dark cooling crust
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 6 + Math.random() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const hot = Math.random() < 0.45;
      gr.addColorStop(0, hot ? 'rgba(255,240,140,0.9)' : 'rgba(40,14,6,0.85)');
      gr.addColorStop(1, hot ? 'rgba(255,160,40,0)' : 'rgba(90,30,10,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }, { repeat: [3, 3] });
  return t;
}

/** The volcano east of the lake: a glowing lava lake in the crater, lava rivers down the flanks,
 *  a smoke plume, and eruptions that hurl glowing lava bombs onto the slopes. Drive to the rim,
 *  collect cooled volcanic glass, and don't stand where the bombs land. */
export class Volcano {
  constructor(game) {
    this.g = game;
    const w = game.world, V = (this.V = w.volcano);
    this.top = w.heightAt(V.x, V.z);
    // the coarse terrain grid makes the crater floor and the rim uneven: sample rings
    const ring = (r) => Array.from({ length: 24 }, (_, i) => w.heightAt(V.x + Math.cos((i / 24) * Math.PI * 2) * r, V.z + Math.sin((i / 24) * Math.PI * 2) * r));
    this.rimY = Math.min(...ring(V.cr));
    this.floorY = Math.max(this.top, ...ring(V.cr * 0.62), ...ring(V.cr * 0.3));
    this.tex = lavaTexture();
    this.lavaMat = new THREE.MeshStandardMaterial({ color: 0x220800, emissive: 0xffffff, emissiveMap: this.tex, map: this.tex, emissiveIntensity: 1.6, roughness: 0.9 });
    // the lava lake
    const lake = new THREE.Mesh(new THREE.CircleGeometry(V.cr * 0.62, 32), this.lavaMat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(V.x, this.floorY + 0.6, V.z);
    game.scene.add(lake);
    this.lakeY = this.floorY + 0.6;
    // lava rivers down three flanks
    this.flowTex = lavaTexture();
    this.flowTex.repeat.set(1, 6);
    this.flowMat = new THREE.MeshStandardMaterial({ color: 0x220800, emissive: 0xffffff, emissiveMap: this.flowTex, map: this.flowTex, emissiveIntensity: 1.3, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    for (const a0 of [0.6, 2.5, 4.4]) game.scene.add(this.flow(a0));
    // smoke and sparks
    this.smoke = new Particles(game.scene, { max: 220, color: 0x6a625c });
    this.embers = new Particles(game.scene, { max: 160, color: 0xff7a1a, additive: true });
    // a soft round glow over the crater (lights up the smoke at night)
    const gc = document.createElement('canvas');
    gc.width = gc.height = 64;
    const gx = gc.getContext('2d'), grd = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,170,80,1)');
    grd.addColorStop(0.4, 'rgba(255,90,20,0.45)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    gx.fillStyle = grd;
    gx.fillRect(0, 0, 64, 64);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glow.scale.set(140, 60, 1);
    this.glow.position.set(V.x, this.top + 22, V.z);
    game.scene.add(this.glow);
    this.bombs = [];
    this.rocks = [];
    this.rockGeo = new THREE.DodecahedronGeometry(0.7, 0);
    this.next = 50 + Math.random() * 60;
    this.smokeT = 0;
    this.rumbleT = 0;
    this.erupting = 0;
    this.topSaid = false;
  }
  /** a glowing ribbon running down the slope from the rim */
  flow(a0) {
    const w = this.g.world, V = this.V;
    const pos = [], uv = [], idx = [];
    const N = 40;
    let a = a0;
    for (let i = 0; i <= N; i++) {
      const d = V.cr * 0.95 + (i / N) * V.r * 0.55;
      a += Math.sin(i * 0.7 + a0 * 3) * 0.018;
      const x = V.x + Math.cos(a) * d, z = V.z + Math.sin(a) * d;
      const wid = 3.2 + (i / N) * 4 + Math.sin(i * 1.3) * 0.8;
      const nx = -Math.sin(a), nz = Math.cos(a);
      // five vertices across so the ribbon follows the slope instead of cutting through it
      for (let c = 0; c < 5; c++) {
        const s = c / 2 - 1;
        const px = x + nx * wid * s, pz = z + nz * wid * s;
        pos.push(px, w.heightAt(px, pz) + 0.6, pz);
        uv.push(c / 4, i / N);
      }
      if (i < N) {
        for (let c = 0; c < 4; c++) {
          const k = i * 5 + c;
          idx.push(k, k + 5, k + 1, k + 1, k + 5, k + 6);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, this.flowMat);
    m.material.side = THREE.DoubleSide;
    return m;
  }
  dist() {
    const f = this.g.focus();
    return Math.hypot(f.pos.x - this.V.x, f.pos.z - this.V.z);
  }
  erupt() {
    const g = this.g, d = this.dist();
    this.erupting = 9;
    this.toThrow = 10 + Math.floor(Math.random() * 6);
    this.throwT = 0;
    const k = clamp(1 - d / 1600, 0, 1);
    if (k > 0) {
      g.audio.tone(32, 2.5, 0.45 * k, 'sine');
      g.audio.burst(2, 180, 'lowpass', 0.8 * k);
      g.shake = Math.max(g.shake || 0, k * k * 1.4);
    }
    if (d < 900) g.ui.toast(d < 400 ? '🌋🔥 آتشفشان فوران کرد! مواظب سنگ‌های داغ باش!' : '🌋 آتشفشان داره فوران می‌کنه!', 'warn');
    g.stats.eruptions = (g.stats.eruptions || 0) + 1;
  }
  throwBomb() {
    const V = this.V, g = this.g;
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 190;
    const tx = V.x + Math.cos(a) * d, tz = V.z + Math.sin(a) * d;
    const T = 3 + Math.random() * 1.5;
    const sx = V.x + (Math.random() - 0.5) * 10, sz = V.z + (Math.random() - 0.5) * 10, sy = this.lakeY + 2;
    const ty = g.world.heightAt(tx, tz);
    // ballistic: pick vy so it lands at time T (gravity 20)
    const vy = (ty - sy + 10 * T * T) / T;
    const mesh = new THREE.Mesh(this.rockGeo, new THREE.MeshStandardMaterial({ color: 0x3a1a0a, emissive: 0xff6a10, emissiveIntensity: 2.2, roughness: 0.8, flatShading: true }));
    mesh.position.set(sx, sy, sz);
    mesh.scale.setScalar(0.9 + Math.random() * 1.2);
    g.scene.add(mesh);
    this.bombs.push({ mesh, vx: (tx - sx) / T, vy, vz: (tz - sz) / T, spin: (Math.random() - 0.5) * 6 });
  }
  land(B) {
    const g = this.g, p = B.mesh.position, f = g.focus();
    for (let i = 0; i < 14; i++) this.embers.emit(p.x, p.y + 0.5, p.z, (Math.random() - 0.5) * 12, 4 + Math.random() * 8, (Math.random() - 0.5) * 12, 1 + Math.random(), 0.5, 0.2, 1, 0.8);
    for (let i = 0; i < 4; i++) this.smoke.emit(p.x, p.y + 1, p.z, (Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3, 5, 3, 3, 0.6, 0.8);
    const d = Math.hypot(f.pos.x - p.x, f.pos.z - p.z);
    if (d < 250) g.audio.burst(0.4, 500, 'lowpass', 0.5 * (1 - d / 250));
    // a direct hit on the taxi
    const pl = g.player;
    if (!g.onfoot.active && Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < 4.5) {
      pl.health = Math.max(0, pl.health - 12);
      if (pl.bump) pl.bump(-2.4, 0.5, (Math.random() - 0.5) * 2);
      g.crashFx({ impact: 12 });
      g.ui.toast('🔥 یه سنگ داغ آتشفشان خورد به ماشینت!', 'bad');
    } else if (g.onfoot.active && Math.hypot(f.pos.x - p.x, f.pos.z - p.z) < 3) {
      // a walker just gets a fright and jumps back
      const w = g.onfoot.walker;
      if (w) {
        w.pos.x += (w.pos.x - p.x) * 0.8;
        w.pos.z += (w.pos.z - p.z) * 0.8;
      }
      g.ui.toast('😱 وای! نزدیک بود!', 'warn');
    }
    // it cools into a piece of volcanic glass you can pick up
    B.mesh.position.y = g.world.heightAt(p.x, p.z) + 0.3;
    this.rocks.push({ mesh: B.mesh, t: 0 });
    while (this.rocks.length > 24) {
      const R = this.rocks.shift();
      R.mesh.removeFromParent();
      R.mesh.material.dispose();
    }
  }
  update(dt) {
    const g = this.g, V = this.V;
    if (!dt) return;
    const d = this.dist();
    const near = d < 2600;
    const t = g.time;
    // the lava churns and flows
    this.tex.offset.set(Math.sin(t * 0.05) * 0.2, t * 0.01);
    this.flowTex.offset.y = -t * 0.06;
    const night = g.env ? g.env.night : 0;
    this.lavaMat.emissiveIntensity = 1.4 + Math.sin(t * 1.7) * 0.25 + (this.erupting > 0 ? 1 : 0);
    this.flowMat.emissiveIntensity = 1.0 + night * 0.8;
    this.glow.material.opacity = (0.25 + night * 0.5) * (this.erupting > 0 ? 1.6 : 1) * (0.85 + Math.sin(t * 2.3) * 0.15);
    if (near) {
      // a steady plume, much thicker while it erupts
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = this.erupting > 0 ? 0.05 : 0.18;
        // a column that drifts downwind and spreads out as it rises
        this.smoke.emit(V.x + (Math.random() - 0.5) * 16, this.lakeY + 6, V.z + (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 2 + 2.5, 6 + Math.random() * 4 + (this.erupting > 0 ? 10 : 0), (Math.random() - 0.5) * 2, 18, 22, 4.5, 0.5, 0.1);
        if (Math.random() < (this.erupting > 0 ? 1 : 0.3)) this.embers.emit(V.x + (Math.random() - 0.5) * 10, this.lakeY + 1, V.z + (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6, 8 + Math.random() * (this.erupting > 0 ? 30 : 8), (Math.random() - 0.5) * 6, 2.2, 0.8, 0.2, 1, 0.9);
      }
      // the odd rumble when you're on the mountain
      this.rumbleT -= dt;
      if (this.rumbleT <= 0 && d < 700) {
        this.rumbleT = 8 + Math.random() * 10;
        g.audio.tone(40, 1.6, 0.12 * (1 - d / 700), 'sine');
      }
    }
    this.smoke.update(dt, -0.4);
    this.embers.update(dt, 14);
    // eruptions now and then (more fun when you're around to see them)
    this.next -= dt * (d < 1500 ? 1 : 0.25);
    if (this.next <= 0 && !(g.zombie && g.zombie.active)) {
      this.next = 120 + Math.random() * 120;
      this.erupt();
    }
    if (this.erupting > 0) {
      this.erupting -= dt;
      this.throwT -= dt;
      if (this.toThrow > 0 && this.throwT <= 0) {
        this.throwT = 0.25 + Math.random() * 0.4;
        this.toThrow--;
        this.throwBomb();
      }
    }
    // flying lava bombs
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const B = this.bombs[i], p = B.mesh.position;
      B.vy -= 20 * dt;
      p.x += B.vx * dt;
      p.y += B.vy * dt;
      p.z += B.vz * dt;
      B.mesh.rotation.x += B.spin * dt;
      B.mesh.rotation.z += B.spin * 0.7 * dt;
      if (Math.random() < 0.7) this.smoke.emit(p.x, p.y, p.z, 0, 0.5, 0, 2.5, 2.5, 2.5, 0.5, 0.9);
      if (B.vy < 0 && p.y <= g.world.heightAt(p.x, p.z) + 0.3) {
        this.bombs.splice(i, 1);
        this.land(B);
      }
    }
    // cooling rocks: pick them up when they're dark enough to touch
    const f = g.focus();
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const R = this.rocks[i];
      R.t += dt;
      R.mesh.material.emissiveIntensity = Math.max(0.15, 2.2 - R.t * 0.08);
      if (R.t > 12 && g.state === 'play' && Math.hypot(f.pos.x - R.mesh.position.x, f.pos.z - R.mesh.position.z) < 5) {
        R.mesh.removeFromParent();
        R.mesh.material.dispose();
        this.rocks.splice(i, 1);
        g.coins += 8;
        g.stats.obsidian = (g.stats.obsidian || 0) + 1;
        g.audio.cash();
        g.ui.toast(`🌋 سنگ آتشفشانی جمع کردی! +۸ سکه • ${fa(g.stats.obsidian)} تا`, 'good');
      }
    }
    // standing on the rim
    const P = g.focus();
    const pd = Math.hypot(P.pos.x - V.x, P.pos.z - V.z);
    const py = P.onFoot ? g.world.heightAt(P.pos.x, P.pos.z) : g.player.y;
    if (pd < V.cr + 14 && py > this.rimY - 12 && g.state === 'play') {
      if (!this.topSaid) {
        this.topSaid = true;
        g.stats.volcanoTop = (g.stats.volcanoTop || 0) + 1;
        const first = g.stats.volcanoTop === 1;
        if (first) g.coins += 25;
        g.ui.toast(first ? '🌋🏔️ رسیدی به لبه دهانه آتشفشان! چه منظره‌ای! +۲۵ سکه' : '🌋 دوباره لبه دهانه! چه گرمه اینجا 🥵', 'good');
      }
      // too close to the lava: it's hot!
      if (pd < V.cr * 0.66 && !P.onFoot && g.player.health > 0) {
        g.player.health = Math.max(0, g.player.health - dt * 6);
        if (Math.random() < dt * 2) g.ui.toast('🔥 داغه!! از گدازه دور شو!', 'bad');
      }
    } else if (pd > V.r) this.topSaid = false;
  }
  mapIcons() {
    return [{ x: this.V.x, z: this.V.z, col: '#bf360c', txt: '🌋' }];
  }
}
