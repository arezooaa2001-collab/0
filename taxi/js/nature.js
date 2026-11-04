import * as THREE from 'three';
import { Particles } from './effects.js';
import { regionAt } from './world.js';
import { concatGeometries, mulberry32 } from './util.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _y = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3();

function part(geo, hex, x = 0, y = 0, z = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.translate(x, y, z);
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/** a herd of simple animals wandering around a centre */
class Herd {
  constructor(game, geo, n, cx, cz, radius, speed, seed) {
    this.g = game;
    const rnd = mulberry32(seed);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), n);
    this.mesh.castShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    game.scene.add(this.mesh);
    this.cx = cx;
    this.cz = cz;
    this.r = radius;
    this.speed = speed;
    this.a = [];
    for (let i = 0; i < n; i++) {
      const ang = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * radius;
      this.a.push({ x: cx + Math.cos(ang) * d, z: cz + Math.sin(ang) * d, h: rnd() * 6, tx: 0, tz: 0, wait: rnd() * 5, ph: rnd() * 6, walk: false });
    }
  }
  update(dt, t, focus) {
    if (Math.abs(focus.pos.x - this.cx) > 700 || Math.abs(focus.pos.z - this.cz) > 700) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    const w = this.g.world;
    this.a.forEach((an, i) => {
      // run away from a car that comes too close
      const dx = an.x - focus.pos.x, dz = an.z - focus.pos.z, d = Math.hypot(dx, dz);
      if (d < 9 && !focus.onFoot) {
        an.tx = an.x + (dx / (d || 1)) * 12;
        an.tz = an.z + (dz / (d || 1)) * 12;
        an.walk = true;
        an.run = 2.6;
      }
      if (!an.walk) {
        an.wait -= dt;
        if (an.wait <= 0) {
          const ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * this.r;
          an.tx = this.cx + Math.cos(ang) * rr;
          an.tz = this.cz + Math.sin(ang) * rr;
          an.walk = true;
          an.run = 1;
        }
      } else {
        const ex = an.tx - an.x, ez = an.tz - an.z, ed = Math.hypot(ex, ez);
        if (ed < 0.5) {
          an.walk = false;
          an.wait = 3 + Math.random() * 8;
        } else {
          const sp = this.speed * (an.run || 1) * dt;
          an.x += (ex / ed) * sp;
          an.z += (ez / ed) * sp;
          const th = Math.atan2(ex, ez);
          an.h += Math.atan2(Math.sin(th - an.h), Math.cos(th - an.h)) * Math.min(1, dt * 4);
        }
      }
      const bob = an.walk ? Math.abs(Math.sin(t * 6 * (an.run || 1) + an.ph)) * 0.08 : 0;
      _p.set(an.x, w.heightAt(an.x, an.z) + bob, an.z);
      _q.setFromAxisAngle(_y, an.h);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Living world: shooting stars, sun glare, fireflies, dust devils, camels, cows and sheep, lake mist and a UFO. */
export class Nature {
  constructor(game) {
    this.g = game;
    const scene = game.scene;
    // shooting stars
    this.starMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.star = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 60), this.starMat);
    this.star.visible = false;
    scene.add(this.star);
    this.starT = 8;
    // sun glare overlay
    this.glare = document.getElementById('glare');
    // fireflies
    this.flies = new Particles(scene, { max: 140, color: 0xc8ff6a, additive: true });
    // dust devils
    this.dust = new Particles(scene, { max: 260, color: 0xd9b98a });
    this.devils = [];
    // camels in the desert
    const camel = concatGeometries([
      part(B(0.9, 0.9, 2.2), 0xc49a5a, 0, 1.75, 0),
      part(B(0.7, 0.55, 0.8), 0xb8894a, 0, 2.35, 0.1),
      part(B(0.32, 1.0, 0.32), 0xc49a5a, 0, 2.1, 1.25),
      part(B(0.36, 0.34, 0.75), 0xb8894a, 0, 2.6, 1.6),
      ...[[-0.3, 0.8], [0.3, 0.8], [-0.3, -0.8], [0.3, -0.8]].map(([x, z]) => part(B(0.2, 1.35, 0.2), 0xa87d45, x, 0.68, z)),
    ]);
    this.camels = new Herd(game, camel, 6, -300, 1300, 70, 1.1, 21);
    // cows and sheep on the farms
    const cow = concatGeometries([
      part(B(0.95, 0.9, 1.9), 0xf2f2f2, 0, 1.1, 0),
      part(B(0.5, 0.35, 0.6), 0x222222, 0.2, 1.3, -0.3),
      part(B(0.55, 0.55, 0.6), 0x2b2b2b, 0, 1.35, 1.1),
      part(B(0.35, 0.25, 0.2), 0xe8a0a0, 0, 1.2, 1.42),
      ...[[-0.32, 0.7], [0.32, 0.7], [-0.32, -0.7], [0.32, -0.7]].map(([x, z]) => part(B(0.18, 0.75, 0.18), 0x333333, x, 0.38, z)),
    ]);
    this.cows = new Herd(game, cow, 8, -1250, 300, 60, 0.7, 33);
    const sheep = concatGeometries([
      part(B(0.75, 0.6, 1.05), 0xf5f1e6, 0, 0.75, 0),
      part(B(0.32, 0.36, 0.42), 0x2a2a2a, 0, 0.9, 0.62),
      ...[[-0.22, 0.35], [0.22, 0.35], [-0.22, -0.35], [0.22, -0.35]].map(([x, z]) => part(B(0.12, 0.5, 0.12), 0x2a2a2a, x, 0.25, z)),
    ]);
    this.sheep = new Herd(game, sheep, 14, -1050, -250, 55, 0.6, 44);
    // morning mist over the lake
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    const grd = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grd;
    c.fillRect(0, 0, 128, 128);
    const mistTex = new THREE.CanvasTexture(cv);
    this.mistMat = new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, opacity: 0, depthWrite: false, color: 0xe8eef5 });
    this.mist = [];
    const mg = new THREE.PlaneGeometry(110, 110);
    mg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(mg, this.mistMat);
      const a = (i / 9) * Math.PI * 2, d = 60 + (i % 3) * 70;
      m.userData = { x: 1350 + Math.cos(a) * d, z: -750 + Math.sin(a) * d, y: 1.5 + (i % 3) * 2, ph: i };
      m.renderOrder = 6;
      scene.add(m);
      this.mist.push(m);
    }
    this.buildUfo();
  }
  buildUfo() {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0xaab4c0, metalness: 0.9, roughness: 0.25, emissive: 0x111822 });
    const disc = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 10), metal);
    disc.scale.y = 0.22;
    g.add(disc);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x66ffcc, emissive: 0x33ff99, emissiveIntensity: 1.5, transparent: true, opacity: 0.8 }));
    dome.position.y = 0.6;
    g.add(dome);
    this.ufoLights = [];
    for (let i = 0; i < 10; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const a = (i / 10) * Math.PI * 2;
      l.position.set(Math.cos(a) * 5.4, -0.2, Math.sin(a) * 5.4);
      g.add(l);
      this.ufoLights.push(l);
    }
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0x9dffd8, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const bg = new THREE.CylinderGeometry(1.5, 7, 1, 24, 1, true);
    bg.translate(0, -0.5, 0);
    this.ufoBeam = new THREE.Mesh(bg, this.beamMat);
    g.add(this.ufoBeam);
    g.visible = false;
    this.g.scene.add(g);
    this.ufo = g;
    this.ufoState = 'off';
    this.ufoNight = -1;
  }
  updateUfo(dt, t, f, night) {
    const g = this.g, U = this.ufo;
    // one chance per night, out in the desert
    if (this.ufoState === 'off') {
      if (night > 0.8 && g.day !== this.ufoNight && regionAt(f.pos.x, f.pos.z) === 'desert' && g.state === 'play') {
        this.ufoNight = g.day;
        if (Math.random() < 0.45) {
          const a = Math.random() * Math.PI * 2;
          this.ufoHome = { x: f.pos.x + Math.cos(a) * 160, z: f.pos.z + Math.sin(a) * 160 };
          U.position.set(this.ufoHome.x, g.world.heightAt(this.ufoHome.x, this.ufoHome.z) + 26, this.ufoHome.z);
          U.visible = true;
          this.ufoState = 'hover';
          g.ui.toast('👽 یه چیز عجیب توی آسمون کویر داره می‌درخشه...', 'info');
        }
      }
      return;
    }
    U.rotation.y += dt * 1.6;
    this.ufoLights.forEach((l, i) => l.material.color.setHSL((t * 0.4 + i / 10) % 1, 1, 0.6));
    if (this.ufoState === 'hover') {
      const h = this.ufoHome;
      U.position.x = h.x + Math.sin(t * 0.3) * 25;
      U.position.z = h.z + Math.cos(t * 0.23) * 25;
      const gy = g.world.heightAt(U.position.x, U.position.z);
      U.position.y = gy + 26 + Math.sin(t * 1.5) * 1.2;
      this.ufoBeam.scale.y = U.position.y - gy;
      this.beamMat.opacity = 0.14 + Math.sin(t * 6) * 0.05;
      const p = g.player, d = Math.hypot(p.pos.x - U.position.x, p.pos.z - U.position.z);
      if (d < 5.5 && !g.onfoot.active && g.state === 'play') {
        // beamed up for a moment... then it panics and leaves
        p.air = true;
        p.vy = 14;
        p.airT = 0;
        p.airMax = 0;
        p.geyserLaunch = true;
        g.stats.ufo = (g.stats.ufo || 0) + 1;
        g.ui.toast('👽 تو رو کشیدن بالا!! ... و ولت کردن 😱', 'warn');
        g.audio.tone(220, 1.2, 0.15, 'sine');
        g.audio.tone(880, 1.2, 0.08, 'triangle', 0.1);
        this.ufoState = 'leave';
      }
      if (night < 0.5 || Math.hypot(f.pos.x - h.x, f.pos.z - h.z) > 900) this.ufoState = 'leave';
    } else if (this.ufoState === 'leave') {
      this.ufoBeam.scale.y = Math.max(0.01, this.ufoBeam.scale.y - dt * 40);
      U.position.y += dt * 60;
      U.position.x += dt * 80;
      if (U.position.y > 900) {
        U.visible = false;
        this.ufoState = 'off';
      }
    }
  }
  update(dt) {
    const g = this.g, f = g.focus(), t = g.time, cam = g.camera;
    const night = g.env ? g.env.night : 0;
    const reg = regionAt(f.pos.x, f.pos.z);
    // shooting stars now and then on clear nights
    if (night > 0.8 && (!g.weather || g.weather.cloud < 0.4)) {
      this.starT -= dt;
      if (this.starT <= 0 && !this.star.visible) {
        this.starT = 6 + Math.random() * 14;
        const a = Math.random() * Math.PI * 2;
        this.star.position.set(cam.position.x + Math.cos(a) * 700, cam.position.y + 320 + Math.random() * 150, cam.position.z + Math.sin(a) * 700);
        this.star.lookAt(cam.position);
        this.star.rotateZ(0.6 + Math.random());
        this.starLife = 0;
        this.star.visible = true;
      }
    }
    if (this.star.visible) {
      this.starLife += dt;
      this.star.translateY(-dt * 420);
      this.starMat.opacity = Math.sin(Math.min(1, this.starLife / 0.8) * Math.PI) * 0.9;
      if (this.starLife > 0.8) this.star.visible = false;
    }
    // sun glare when looking into a low sun
    if (this.glare) {
      let k = 0, sx = 50, sy = 50;
      if (g.env && g.state !== 'jail' && night < 0.5) {
        _v.copy(g.env.sunDir).multiplyScalar(1000).add(cam.position).project(cam);
        const facing = _v.z < 1 && Math.abs(_v.x) < 1.3 && Math.abs(_v.y) < 1.3;
        if (facing) {
          k = (1 - Math.min(1, Math.hypot(_v.x, _v.y) / 1.2)) * (1 - night * 2) * (g.weather ? 1 - g.weather.cloud * 0.85 : 1);
          sx = (_v.x * 0.5 + 0.5) * 100;
          sy = (-_v.y * 0.5 + 0.5) * 100;
        }
      }
      k = Math.max(0, Math.min(0.75, k));
      if (Math.abs(k - (this.glareK || 0)) > 0.01 || Math.abs(sx - (this.glareX || 0)) > 0.5) {
        this.glareK = k;
        this.glareX = sx;
        this.glare.style.opacity = k.toFixed(2);
        this.glare.style.background = `radial-gradient(circle at ${sx}% ${sy}%, rgba(255,246,220,0.95) 0%, rgba(255,214,150,0.35) 9%, rgba(255,190,120,0.08) 26%, rgba(0,0,0,0) 45%), radial-gradient(circle at ${100 - sx}% ${100 - sy}%, rgba(160,200,255,0.18) 0%, rgba(0,0,0,0) 7%)`;
      }
    }
    // fireflies in the forest at night
    if (reg === 'forest' && night > 0.6 && Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 30;
      const x = f.pos.x + Math.cos(a) * d, z = f.pos.z + Math.sin(a) * d;
      this.flies.emit(x, g.world.heightAt(x, z) + 0.5 + Math.random() * 2.5, z, (Math.random() - 0.5) * 0.6, (Math.random() - 0.3) * 0.3, (Math.random() - 0.5) * 0.6, 2.5 + Math.random() * 2, 0.22, 0, 1, 0.3);
    }
    this.flies.update(dt, 0);
    // dust devils swirling across the desert by day
    if (reg === 'desert' && night < 0.3 && this.devils.length < 2 && Math.random() < dt * 0.05) {
      const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 80;
      this.devils.push({ x: f.pos.x + Math.cos(a) * d, z: f.pos.z + Math.sin(a) * d, vx: (Math.random() - 0.5) * 6, vz: (Math.random() - 0.5) * 6, life: 18 + Math.random() * 12, t: 0 });
    }
    for (let i = this.devils.length - 1; i >= 0; i--) {
      const dv = this.devils[i];
      dv.t += dt;
      dv.x += dv.vx * dt;
      dv.z += dv.vz * dt;
      const k = Math.min(1, dv.t / 3, (dv.life - dv.t) / 3);
      const gy = g.world.heightAt(dv.x, dv.z);
      for (let n = 0; n < 5 * k; n++) {
        const h = Math.random() * 14, r = 0.6 + h * 0.18, a = dv.t * 7 + Math.random() * 6.28;
        this.dust.emit(dv.x + Math.cos(a) * r, gy + h, dv.z + Math.sin(a) * r, -Math.sin(a) * 4, 1.5, Math.cos(a) * 4, 1.2, 0.9, 1.5, 0.32, 0.5);
      }
      // drive into one and it shoves the taxi around
      const p = g.player;
      if (Math.hypot(p.pos.x - dv.x, p.pos.z - dv.z) < 3 && !p.air && k > 0.5) {
        p.ext.x += (Math.random() - 0.5) * 1.5;
        p.ext.y += (Math.random() - 0.5) * 1.5;
        p.dirt = Math.min(1, (p.dirt || 0) + dt * 0.1);
      }
      if (dv.t > dv.life) this.devils.splice(i, 1);
    }
    this.dust.update(dt, -0.5);
    // animals
    this.camels.update(dt, t, f);
    this.cows.update(dt, t, f);
    this.sheep.update(dt, t, f);
    // morning mist over the lake (5–9 o'clock)
    const h = g.hour;
    const mist = h > 4.5 && h < 9.5 ? Math.sin(((h - 4.5) / 5) * Math.PI) : 0;
    this.mistMat.opacity = mist * 0.55;
    for (const m of this.mist) {
      m.visible = mist > 0.02;
      if (!m.visible) continue;
      const u = m.userData;
      m.position.set(u.x + Math.sin(t * 0.03 + u.ph) * 20, u.y, u.z + Math.cos(t * 0.025 + u.ph) * 20);
    }
    this.updateUfo(dt, t, f, night);
  }
  setScale(h, fov) {
    this.flies.setScale(h, fov);
    this.dust.setScale(h, fov);
  }
}
