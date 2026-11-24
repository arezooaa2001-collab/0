import * as THREE from 'three';
import { clamp, fa } from './util.js';
import { regionAt } from './world.js';

const AURORA_VS = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const AURORA_FS = `
uniform float uT;
uniform float uK;
uniform float uSeed;
uniform vec3 uC1;
uniform vec3 uC2;
varying vec2 vUv;
void main() {
  float x = vUv.x, y = vUv.y;
  float t = uT + uSeed * 17.0;
  // hanging curtain folds that drift and shimmer
  float fold = sin(x * 11.0 + t * 0.21 + sin(x * 3.0 - t * 0.13) * 2.0);
  float rays = 0.55 + 0.45 * sin(x * 140.0 + t * 1.1 + fold * 5.0);
  rays *= 0.65 + 0.35 * sin(x * 47.0 - t * 1.7);
  float base = smoothstep(0.0, 0.1, y) * pow(1.0 - y, 1.4);
  float bright = 0.45 + 0.55 * (0.5 + 0.5 * sin(x * 5.0 + t * 0.09 + uSeed * 3.0));
  float edge = smoothstep(0.0, 0.12, x) * smoothstep(1.0, 0.88, x);
  vec3 col = mix(uC1, uC2, smoothstep(0.3, 1.0, y));
  col += vec3(0.6, 1.0, 0.8) * smoothstep(0.12, 0.0, y) * 0.6; // bright lower hem
  float a = base * rays * bright * edge * uK;
  gl_FragColor = vec4(col * a * 1.5, 1.0);
}`;

function glowTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.35, outer);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Night-sky spectacles: aurora curtains on clear nights, and meteor showers whose fireballs
 *  crash down near you and leave glowing space rocks to collect. */
export class SkyFx {
  constructor(game) {
    this.g = game;
    const scene = game.scene;
    // aurora: three bent ribbons far to the north
    this.aurora = new THREE.Group();
    this.auroraMats = [];
    const cols = [[0x2bff88, 0x9a4dff], [0x35ffb0, 0xff4fa3], [0x6bff5a, 0x4d7dff]];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.PlaneGeometry(2600, 520, 96, 1);
      const p = geo.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const x = p.getX(k);
        p.setZ(k, Math.sin(x / 520 + i * 1.7) * 260 + Math.cos(x / 230 + i) * 60);
        p.setY(k, p.getY(k) + Math.sin(x / 400 + i) * 40);
      }
      const m = new THREE.ShaderMaterial({
        vertexShader: AURORA_VS,
        fragmentShader: AURORA_FS,
        uniforms: { uT: { value: 0 }, uK: { value: 0 }, uSeed: { value: i * 0.37 }, uC1: { value: new THREE.Color(cols[i][0]) }, uC2: { value: new THREE.Color(cols[i][1]) } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set((i - 1) * 420, 420 + i * 70, -i * 160);
      mesh.frustumCulled = false;
      mesh.renderOrder = -50;
      this.aurora.add(mesh);
      this.auroraMats.push(m);
    }
    this.aurora.visible = false;
    scene.add(this.aurora);
    this.auroraK = 0;
    this.auroraNight = Math.random() < 0.5;
    // shower streaks
    this.streakMat = [];
    this.streaks = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 70), m);
      s.visible = false;
      s.frustumCulled = false;
      scene.add(s);
      this.streaks.push({ s, m, life: 0 });
    }
    // fireball and rock glow sprites
    this.fireTex = glowTexture('rgba(255,255,230,1)', 'rgba(255,140,40,0.7)');
    this.rockTex = glowTexture('rgba(230,200,255,1)', 'rgba(150,80,255,0.55)');
    this.falling = [];
    this.rocks = [];
    this.rockGeo = new THREE.IcosahedronGeometry(0.75, 0);
    this.rockMat = new THREE.MeshStandardMaterial({ color: 0x3a2f4a, emissive: 0xa45cff, emissiveIntensity: 1.2, roughness: 0.5, metalness: 0.3, flatShading: true });
    this.craterMat = new THREE.MeshBasicMaterial({ color: 0x241b14, transparent: true, opacity: 0.8, depthWrite: false });
    this.rimMat = new THREE.MeshBasicMaterial({ color: 0x7a6650, transparent: true, opacity: 0.55, depthWrite: false });
    this.shower = 0;
    this.nightKey = -1;
  }
  /** start a meteor shower now (also used by the night roll) */
  startShower(drops = 3) {
    const g = this.g;
    this.shower = 70;
    this.toDrop = drops;
    this.dropT = 4;
    g.ui.toast('☄️ بارون شهاب‌سنگ! چندتا شون نزدیک تو می‌افتن؛ برو سنگ‌های درخشانشون رو جمع کن 🪨', 'info');
  }
  /** a fireball heading for a free spot near the player */
  dropMeteor() {
    const g = this.g, w = g.world, f = g.focus();
    let spot = null;
    for (let k = 0; k < 40 && !spot; k++) {
      const a = Math.random() * Math.PI * 2, d = 140 + Math.random() * (k < 25 ? 180 : 420);
      const x = f.pos.x + Math.cos(a) * d, z = f.pos.z + Math.sin(a) * d;
      if (regionAt(x, z) === 'city' || !w.freeSpot(x, z, 14)) continue;
      spot = { x, z };
    }
    if (!spot) return false;
    const y = w.heightAt(spot.x, spot.z);
    const a = Math.random() * Math.PI * 2;
    const from = new THREE.Vector3(spot.x + Math.cos(a) * 520, y + 420, spot.z + Math.sin(a) * 520);
    const to = new THREE.Vector3(spot.x, y, spot.z);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.fireTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    sp.scale.setScalar(26);
    sp.position.copy(from);
    g.scene.add(sp);
    this.falling.push({ from, to, t: 0, dur: 3.6, sp });
    const d = Math.hypot(spot.x - f.pos.x, spot.z - f.pos.z);
    // a rising whistle when it's coming down near you
    if (d < 400) for (let i = 0; i < 6; i++) g.audio.tone(1400 - i * 170, 0.5, 0.03 * (1 - d / 400), 'sine', i * 0.5);
    return true;
  }
  impact(M) {
    const g = this.g, w = g.world, f = g.focus(), p = M.to;
    M.sp.removeFromParent();
    M.sp.material.dispose();
    const d = Math.hypot(p.x - f.pos.x, p.z - f.pos.z);
    // boom, shake and a flash for the ones close by
    const k = clamp(1 - d / 600, 0, 1);
    if (k > 0) {
      g.audio.crash(4 + k * 10);
      g.audio.tone(38, 1.2, 0.35 * k, 'sine');
      g.shake = Math.max(g.shake || 0, k * k * 1.1);
      if (d < 250) g.flashT = Math.max(g.flashT || 0, 0.12 * k);
    }
    for (let i = 0; i < 40; i++) g.fx.spark.emit(p.x, p.y + 0.5, p.z, (Math.random() - 0.5) * 22, 6 + Math.random() * 12, (Math.random() - 0.5) * 22, 0.8 + Math.random() * 0.8, 0.14, 0, 1, 0.8);
    for (let i = 0; i < 18; i++) g.fx.dust.emit(p.x + (Math.random() - 0.5) * 4, p.y + 0.4, p.z + (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 9, 3 + Math.random() * 4, (Math.random() - 0.5) * 9, 2.6, 2.2, 3.5, 0.6, 0.7);
    // a scorched crater and the glowing rock in it
    const crater = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), this.craterMat);
    crater.rotation.x = -Math.PI / 2;
    crater.position.set(p.x, w.heightAt(p.x, p.z) + 0.04, p.z);
    crater.renderOrder = 1;
    // thrown-up dirt around the hole
    const rim = new THREE.Mesh(new THREE.RingGeometry(3.0, 5.4, 28), this.rimMat);
    rim.position.z = 0.01;
    crater.add(rim);
    g.scene.add(crater);
    const rock = new THREE.Mesh(this.rockGeo, this.rockMat);
    rock.position.set(p.x, w.heightAt(p.x, p.z) + 0.35, p.z);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    rock.castShadow = true;
    g.scene.add(rock);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.rockTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.scale.setScalar(5);
    glow.position.set(p.x, rock.position.y + 0.6, p.z);
    g.scene.add(glow);
    this.rocks.push({ x: p.x, z: p.z, rock, glow, crater, smokeT: 25, ph: Math.random() * 6 });
    if (d < 500) g.ui.toast(`☄️ یه شهاب‌سنگ ${fa(Math.round(d))} متر اون‌طرف‌تر افتاد! روی نقشه 🪨`, 'warn');
  }
  remove(R, i) {
    for (const o of [R.rock, R.glow, R.crater]) o.removeFromParent();
    R.glow.material.dispose();
    R.crater.geometry.dispose();
    R.crater.children[0].geometry.dispose();
    this.rocks.splice(i, 1);
  }
  /** forget everything on the ground (a loaded or new game) */
  clear() {
    for (let i = this.rocks.length - 1; i >= 0; i--) this.remove(this.rocks[i], i);
    for (const M of this.falling) {
      M.sp.removeFromParent();
      M.sp.material.dispose();
    }
    this.falling.length = 0;
    this.shower = 0;
    this.toDrop = 0;
  }
  collect(R, i) {
    const g = this.g;
    this.remove(R, i);
    g.coins += 25;
    g.addXp(80);
    g.stats.meteors = (g.stats.meteors || 0) + 1;
    g.audio.cash();
    for (const [fq, t] of [[880, 0], [1175, 0.1], [1568, 0.2]]) g.audio.tone(fq, 0.25, 0.08, 'triangle', t);
    g.ui.toast(`🪨✨ سنگ شهاب‌سنگ رو برداشتی! +۲۵ سکه • مجموعه‌ات: ${fa(g.stats.meteors)} تا`, 'good');
  }
  mapIcons() {
    const out = this.rocks.map((R) => ({ x: R.x, z: R.z, col: '#7e57c2', txt: '🪨' }));
    for (const M of this.falling) out.push({ x: M.to.x, z: M.to.z, col: '#ef6c00', txt: '☄️' });
    return out;
  }
  update(dt) {
    const g = this.g, cam = g.camera, f = g.focus();
    if (!dt) return;
    const night = g.env ? g.env.night : 0;
    const W = g.weather || { cloud: 0, rain: 0 };
    const zombie = g.zombie && g.zombie.active;
    // decide tonight's sky once each evening
    if (g.hour > 20.5 && this.nightKey !== g.day && !zombie) {
      this.nightKey = g.day;
      this.auroraNight = Math.random() < 0.5;
      this.showerAt = Math.random() < 0.3 ? 21.5 + Math.random() * 2.3 : -1;
      this.auroraSaid = false;
    }
    if (this.showerAt > 0 && g.hour > this.showerAt && g.hour < 23.9 && this.shower <= 0 && g.state === 'play' && !zombie) {
      this.showerAt = -1;
      this.startShower();
    }
    // the frozen night has its own snowy sky: no aurora, no shower
    if (zombie) {
      this.auroraK = 0;
      if (this.shower || this.rocks.length || this.falling.length) this.clear();
    }
    /* ---- aurora ---- */
    const clear = W.cloud < 0.45 && W.rain < 0.15 && !zombie;
    const want = this.auroraNight && clear && night > 0.55 ? 1 : 0;
    this.auroraK += (want - this.auroraK) * Math.min(1, dt * 0.25);
    this.aurora.visible = this.auroraK > 0.01;
    if (this.aurora.visible) {
      this.aurora.position.set(cam.position.x + 150, 0, cam.position.z - 1450);
      for (const m of this.auroraMats) {
        m.uniforms.uT.value = g.time;
        m.uniforms.uK.value = this.auroraK * clamp((night - 0.55) / 0.3, 0, 1);
      }
      if (this.auroraMats[0].uniforms.uK.value > 0.6 && !this.auroraSaid && g.state === 'play') {
        this.auroraSaid = true;
        g.ui.toast('🌌 شفق قطبی! یه نگاه به آسمون شمال بنداز ✨', 'info');
        g.stats.auroras = (g.stats.auroras || 0) + 1;
      }
    }
    /* ---- meteor shower ---- */
    if (this.shower > 0) {
      this.shower = Math.max(0, this.shower - dt);
      // lots of streaks across the sky
      if (Math.random() < dt * 3) {
        const S = this.streaks.find((o) => !o.s.visible);
        if (S) {
          const a = Math.random() * Math.PI * 2;
          S.s.position.set(cam.position.x + Math.cos(a) * 750, cam.position.y + 300 + Math.random() * 220, cam.position.z + Math.sin(a) * 750);
          S.s.lookAt(cam.position);
          S.s.rotateZ(0.5 + Math.random() * 0.4);
          S.life = 0;
          S.dur = 0.6 + Math.random() * 0.6;
          S.s.visible = true;
        }
      }
      this.dropT -= dt;
      if (this.toDrop > 0 && this.dropT <= 0 && g.state === 'play') {
        this.dropT = 12 + Math.random() * 10;
        if (this.dropMeteor()) this.toDrop--;
      }
    }
    for (const S of this.streaks) {
      if (!S.s.visible) continue;
      S.life += dt;
      S.s.translateY(-dt * 520);
      S.m.opacity = Math.sin(Math.min(1, S.life / S.dur) * Math.PI) * 0.95;
      if (S.life > S.dur) S.s.visible = false;
    }
    // falling fireballs with a burning trail
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const M = this.falling[i];
      M.t += dt;
      const k = Math.min(1, M.t / M.dur), e = k * k;
      M.sp.position.lerpVectors(M.from, M.to, e);
      M.sp.scale.setScalar(26 - k * 14);
      const P = M.sp.position;
      for (let j = 0; j < 3; j++) g.fx.fire.emit(P.x + (Math.random() - 0.5) * 3, P.y + (Math.random() - 0.5) * 3, P.z + (Math.random() - 0.5) * 3, 0, 0, 0, 1.1, 5, 2.5, 0.9, 1);
      if (Math.random() < 0.6) g.fx.smoke.emit(P.x, P.y, P.z, 0, 0.5, 0, 3.5, 6, 3, 0.45, 0.9);
      if (k >= 1) {
        this.falling.splice(i, 1);
        this.impact(M);
      }
    }
    // glowing rocks: pulse, smoulder, and get picked up when you're close
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const R = this.rocks[i];
      R.ph += dt;
      // the morning sun takes them: uncollected rocks crumble away after dawn
      if (night < 0.15 && R.ph > 60) {
        this.remove(R, i);
        continue;
      }
      R.glow.material.opacity = 0.55 + Math.sin(R.ph * 2.4) * 0.25;
      R.rock.rotation.y += dt * 0.4;
      if (R.smokeT > 0) {
        R.smokeT -= dt;
        if (Math.random() < dt * 5) g.fx.smoke.emit(R.x + (Math.random() - 0.5), R.rock.position.y + 0.5, R.z + (Math.random() - 0.5), 0, 1.5, 0, 3, 1.5, 3, 0.4, 0.8);
      }
      if (Math.hypot(f.pos.x - R.x, f.pos.z - R.z) < 7 && g.state === 'play') this.collect(R, i);
    }
    this.rockMat.emissiveIntensity = 0.9 + Math.sin(g.time * 2.4) * 0.35;
  }
}
