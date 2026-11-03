import * as THREE from 'three';
import { Particles } from './effects.js';
import { LANE, regionAt } from './world.js';
import { fa, faMoney, mulberry32, collideCircle, circleCol } from './util.js';

const circleColAt = (x, z) => circleCol(x, z, 0.3);

export const GOLD = 0xd4af37;
const STATUES = 12;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _y = new THREE.Vector3(0, 1, 0);

/** Fire hoops in the stunt park, boost pads on the highways and hidden golden statues. */
export class Thrills {
  constructor(game) {
    this.g = game;
    this.buildHoops();
    this.buildPads();
    this.buildStatues();
    this.buildTraps();
  }

  /* ---------------- speed traps (Burnout style, no fines) ---------------- */
  buildTraps() {
    const g = this.g, w = g.world;
    this.traps = [];
    const postMat = new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.6, roughness: 0.4 });
    w.roads.filter((r) => r.type === 'highway').forEach((r, i) => {
      if (i % 2 !== 1 || r.pts.length < 12) return;
      const k = Math.floor(r.pts.length * 0.35);
      const a = r.pts[k], b = r.pts[k + 1];
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const dx = (b.x - a.x) / l, dz = (b.z - a.z) / l;
      const y = w.heightAt(a.x, a.z);
      const grp = new THREE.Group();
      grp.position.set(a.x, y, a.z);
      grp.rotation.y = Math.atan2(dx, dz);
      for (const s of [-8, 8]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 7, 0.35), postMat);
        post.position.set(s, 3.5, 0);
        grp.add(post);
        w.statics.insert(circleColAt(a.x + Math.cos(grp.rotation.y) * s, a.z - Math.sin(grp.rotation.y) * s));
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.4, 0.4), postMat);
      beam.position.y = 6.8;
      grp.add(beam);
      const cv = document.createElement('canvas');
      cv.width = 256;
      cv.height = 72;
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const board = new THREE.Mesh(new THREE.BoxGeometry(6, 1.7, 0.2), [postMat, postMat, postMat, postMat, new THREE.MeshBasicMaterial({ map: tex }), new THREE.MeshBasicMaterial({ map: tex })]);
      board.position.y = 5.7;
      grp.add(board);
      g.scene.add(grp);
      const trap = { id: 't' + i, name: r.name, x: a.x, z: a.z, dx, dz, cv, tex, prev: null, showT: 0 };
      this.drawTrap(trap, null);
      this.traps.push(trap);
    });
  }
  drawTrap(t, kmh) {
    const c = t.cv.getContext('2d');
    c.fillStyle = '#050505';
    c.fillRect(0, 0, 256, 72);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (kmh === null) {
      const best = (this.g.stats.speedTraps || {})[t.id];
      c.fillStyle = '#ffb300';
      c.font = 'bold 26px Vazirmatn, Tahoma, sans-serif';
      c.fillText('📸 تله سرعت', 128, 24);
      c.font = 'bold 20px Vazirmatn, Tahoma, sans-serif';
      c.fillStyle = '#66ff88';
      c.fillText(best ? `رکورد: ${fa(best)} km/h` : 'سریع رد شو!', 128, 54);
    } else {
      c.fillStyle = kmh >= 200 ? '#ff4040' : kmh >= 150 ? '#ffb300' : '#66ff88';
      c.font = 'bold 48px Vazirmatn, Tahoma, sans-serif';
      c.fillText(`${fa(kmh)} km/h`, 128, 38);
    }
    t.tex.needsUpdate = true;
  }
  updateTraps(dt) {
    const g = this.g, p = g.player;
    for (const t of this.traps) {
      if (t.showT > 0) {
        t.showT -= dt;
        if (t.showT <= 0) this.drawTrap(t, null);
      }
      const rx = p.pos.x - t.x, rz = p.pos.z - t.z;
      if (rx * rx + rz * rz > 900) {
        t.prev = null;
        continue;
      }
      const along = rx * t.dx + rz * t.dz, lat = Math.abs(rx * t.dz - rz * t.dx);
      const prev = t.prev;
      t.prev = along;
      if (prev === null || Math.sign(prev) === Math.sign(along) || along === 0 || lat > 8 || g.state !== 'play' || g.onfoot.active) continue;
      const kmh = Math.round((p.groundSpeed ?? Math.abs(p.speed)) * 3.6);
      if (kmh < 30) continue;
      this.drawTrap(t, kmh);
      t.showT = 6;
      const S = (g.stats.speedTraps = g.stats.speedTraps || {});
      const best = S[t.id] || 0;
      g.stats.maxTrap = Math.max(g.stats.maxTrap || 0, kmh);
      g.audio.burst(0.08, 3000, 'highpass', 0.5);
      if (kmh > best) {
        S[t.id] = kmh;
        const cash = Math.round((kmh * kmh * 2) / 1000) * 1000; // 100 km/h → 20k, 200 km/h → 80k
        g.money += cash;
        g.addXp(kmh / 6);
        g.audio.cash();
        g.stunts.banner(`📸 تله سرعت ${t.name}: ${fa(kmh)} km/h • رکورد جدید! +${faMoney(cash)}`);
      } else g.stunts.pop(`📸 ${fa(kmh)} km/h (رکورد ${fa(best)})`);
    }
  }

  /* ---------------- fire hoops ---------------- */
  buildHoops() {
    const g = this.g, w = g.world;
    this.hoops = [];
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff5a00, emissiveIntensity: 2.2, roughness: 0.6 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 });
    // above the landing zones of the three biggest park ramps: [ramp index, distance past the lip, height above the lip]
    for (const [idx, past, up] of [[1, 9, 1.0], [2, 11, 1.4], [4, 12, 1.9]]) {
      const r = w.ramps[idx];
      if (!r || !r.park) continue;
      const fx = Math.sin(r.rot), fz = Math.cos(r.rot);
      const x = r.x + fx * (r.len + past), z = r.z + fz * (r.len + past);
      const y = r.y + r.h + up;
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.28, 10, 40), ringMat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = r.rot;
      g.scene.add(mesh);
      // posts holding the ring
      for (const s of [1, -1]) {
        const px = x + Math.cos(r.rot) * 3.6 * s, pz = z - Math.sin(r.rot) * 3.6 * s;
        const gy = w.heightAt(px, pz);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, y - gy, 6), postMat);
        post.position.set(px, (y + gy) / 2, pz);
        g.scene.add(post);
      }
      this.hoops.push({ x, y, z, fx, fz, rx: Math.cos(r.rot), rz: -Math.sin(r.rot), prev: null, cool: 0 });
    }
    this.flames = new Particles(g.scene, { max: 360, color: 0xff7a1a, additive: true });
  }
  updateHoops(dt) {
    const g = this.g, p = g.player;
    for (const h of this.hoops) {
      // flames licking around the ring
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        const ox = Math.cos(a) * 3.4, oy = Math.sin(a) * 3.4;
        this.flames.emit(h.x + h.rx * ox, h.y + oy, h.z + h.rz * ox, (Math.random() - 0.5) * 0.6, 1.5 + Math.random(), (Math.random() - 0.5) * 0.6, 0.45 + Math.random() * 0.3, 1.1, 0.6, 0.85, 1);
      }
      h.cool -= dt;
      // signed distance of the car to the hoop plane
      const dx = p.pos.x - h.x, dz = p.pos.z - h.z;
      const along = dx * h.fx + dz * h.fz;
      const prev = h.prev;
      h.prev = along;
      if (prev === null || h.cool > 0 || !(prev < 0 && along >= 0)) continue;
      const lat = dx * h.rx + dz * h.rz, up = p.y + 0.7 - h.y;
      if (g.state !== 'play' || g.onfoot.active || Math.hypot(lat, up) > 3.1) continue;
      h.cool = 3;
      const cash = 60000;
      g.money += cash;
      g.stats.hoops = (g.stats.hoops || 0) + 1;
      g.addXp(30);
      g.audio.burst(0.5, 500, 'lowpass', 0.6);
      g.audio.tone(880, 0.3, 0.15, 'triangle');
      g.stunts.banner(`🔥 از حلقه آتیش رد شدی! +${faMoney(cash)} تومان`);
      g.crazy.tip(20000, '🔥 حلقه آتیش');
      for (let i = 0; i < 40; i++) g.fx.spark.emit(h.x, h.y, h.z, (Math.random() - 0.5) * 10, Math.random() * 6, (Math.random() - 0.5) * 10, 0.7, 0.12, 0, 1, 0.5);
    }
    this.flames.update(dt, -3);
  }

  /* ---------------- boost pads ---------------- */
  buildPads() {
    const g = this.g, w = g.world;
    const rnd = mulberry32(4242);
    this.pads = [];
    for (const r of w.roads) {
      if (r.type !== 'highway') continue;
      for (let i = 6; i < r.pts.length - 3; i += 11) {
        const a = r.pts[i], b = r.pts[i + 1];
        const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        const dx = (b.x - a.x) / l, dz = (b.z - a.z) / l;
        // alternate lanes / directions along the road
        const dir = rnd() < 0.5 ? 1 : -1;
        const fx = dx * dir, fz = dz * dir;
        const x = (a.x + b.x) / 2 - fz * LANE, z = (a.z + b.z) / 2 + fx * LANE;
        this.pads.push({ x, z, fx, fz, y: w.heightAt(x, z), cool: 0 });
      }
    }
    const tex = (() => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 128;
      const x = c.getContext('2d');
      x.fillStyle = '#062033';
      x.fillRect(0, 0, 64, 128);
      x.fillStyle = '#29e3ff';
      for (let k = 0; k < 2; k++) {
        const y0 = k * 64;
        x.beginPath();
        x.moveTo(8, y0 + 50);
        x.lineTo(32, y0 + 14);
        x.lineTo(56, y0 + 50);
        x.lineTo(44, y0 + 50);
        x.lineTo(32, y0 + 32);
        x.lineTo(20, y0 + 50);
        x.closePath();
        x.fill();
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    tex.repeat.set(1, 2);
    this.padTex = tex;
    const geo = new THREE.PlaneGeometry(3.4, 7);
    geo.rotateX(-Math.PI / 2);
    // the arrow texture points to +z after this
    geo.rotateY(Math.PI);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.InstancedMesh(geo, mat, this.pads.length);
    this.pads.forEach((pd, i) => {
      _q.setFromAxisAngle(_y, Math.atan2(pd.fx, pd.fz));
      _p.set(pd.x, pd.y + 0.05, pd.z);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
    });
    mesh.frustumCulled = false;
    g.scene.add(mesh);
    this.padMesh = mesh;
  }
  updatePads(dt) {
    const g = this.g, p = g.player;
    this.padTex.offset.y -= dt * 1.6;
    if (g.state !== 'play' || g.onfoot.active || p.air) return;
    const hx = Math.sin(p.heading), hz = Math.cos(p.heading);
    for (const pd of this.pads) {
      pd.cool -= dt;
      const dx = p.pos.x - pd.x, dz = p.pos.z - pd.z;
      if (dx * dx + dz * dz > 30 || pd.cool > 0) continue;
      const along = dx * pd.fx + dz * pd.fz, lat = dx * pd.fz - dz * pd.fx;
      if (Math.abs(along) > 3.6 || Math.abs(lat) > 2.2) continue;
      if (hx * pd.fx + hz * pd.fz < 0.5 || p.speed < 3) continue;
      pd.cool = 2;
      p.speed = Math.min(p.speed + 14, p.topSpeed() * 1.3);
      g.shake = Math.max(g.shake || 0, 0.4);
      g.audio.burst(0.7, 1400, 'bandpass', 0.6);
      g.audio.tone(440, 0.4, 0.1, 'sawtooth');
      g.stats.boosts = (g.stats.boosts || 0) + 1;
      g.stunts.pop('⚡ بوست!');
      for (let i = 0; i < 14; i++) g.fx.nitro.emit(p.pos.x - hx * 2.4, p.y + 0.4, p.pos.z - hz * 2.4, -hx * 6 + (Math.random() - 0.5) * 2, Math.random(), -hz * 6 + (Math.random() - 0.5) * 2, 0.4, 0.6, -0.5, 0.9, 1);
    }
  }

  /* ---------------- golden statues ---------------- */
  buildStatues() {
    const g = this.g, w = g.world;
    const rnd = mulberry32(9090);
    // two per region (plus extras in the big outer regions), off the beaten track
    const q = [], res = { nx: 0, nz: 0, pen: 0 };
    const regions = ['city', 'city', 'forest', 'forest', 'forest', 'desert', 'desert', 'desert', 'lake', 'lake', 'farm', 'farm'];
    this.statues = [];
    for (let i = 0; i < STATUES; i++) {
      const reg = regions[i];
      for (let k = 0; k < 400; k++) {
        const x = (rnd() - 0.5) * 3600, z = (rnd() - 0.5) * 3600;
        if (regionAt(x, z) !== reg) continue;
        const rd = w.roadDist(x, z);
        if (reg === 'city') {
          // tucked inside a park or behind a block, away from the street
          if (rd < 14 || rd > 40) continue;
        } else if (rd < 35 || rd > 160 || !w.freeSpot(x, z, 35)) continue;
        if (this.statues.some((s) => Math.hypot(s.x - x, s.z - z) < 300)) continue;
        // not inside a building, rock or tree
        w.statics.query(x, z, 3, q);
        if (q.some((o) => !o.soft && collideCircle(x, z, 1.4, o, res))) continue;
        this.statues.push({ id: i, x, z, y: w.heightAt(x, z) });
        break;
      }
    }
    const goldMat = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.22, emissive: 0x5a3a00, emissiveIntensity: 0.5 });
    const parts = [
      new THREE.CylinderGeometry(0.55, 0.65, 0.35, 12).translate(0, 0.18, 0),
      new THREE.CylinderGeometry(0.25, 0.4, 1.1, 10).translate(0, 0.9, 0),
      new THREE.SphereGeometry(0.32, 12, 10).translate(0, 1.7, 0),
      new THREE.BoxGeometry(1.2, 0.16, 0.16).translate(0, 1.25, 0),
    ];
    this.statueMeshes = [];
    for (const s of this.statues) {
      const grp = new THREE.Group();
      for (const geo of parts) grp.add(new THREE.Mesh(geo, goldMat));
      grp.position.set(s.x, s.y, s.z);
      grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.scene.add(grp);
      s.mesh = grp;
    }
    this.sparkle = new Particles(g.scene, { max: 120, color: 0xffe27a, additive: true });
    this.statueT = 0;
  }
  found() {
    const s = this.g.stats;
    return (s.statues = Array.isArray(s.statues) ? s.statues : []);
  }
  updateStatues(dt) {
    const g = this.g, f = g.focus(), got = this.found();
    this.statueT += dt;
    for (const s of this.statues) {
      const have = got.includes(s.id);
      s.mesh.visible = !have;
      if (have) continue;
      s.mesh.rotation.y += dt * 1.2;
      s.mesh.position.y = s.y + 0.3 + Math.sin(this.statueT * 2 + s.id) * 0.15;
      const d = Math.hypot(f.pos.x - s.x, f.pos.z - s.z);
      if (d < 120 && Math.random() < 0.3) this.sparkle.emit(s.x + (Math.random() - 0.5) * 1.6, s.y + 0.4 + Math.random() * 2, s.z + (Math.random() - 0.5) * 1.6, 0, 0.6, 0, 0.9, 0.4, -0.5, 1, 1);
      if (d < 4.5 && g.state === 'play') {
        got.push(s.id);
        g.coins += 25;
        g.addXp(80);
        g.audio.cash();
        g.audio.tone(1568, 0.5, 0.15, 'sine', 0.15);
        g.ui.achievement('🗿', `مجسمه طلایی ${fa(got.length)} از ${fa(this.statues.length)}`, 25, '✨ گنج پیدا کردی!');
        if (got.length >= this.statues.length) {
          g.ui.toast('🏆 همه مجسمه‌ها رو پیدا کردی! رنگ طلایی توی تعمیرگاه باز شد ✨', 'good');
          g.fireworks.show(f.pos.x + Math.sin(f.heading) * 150, f.pos.z + Math.cos(f.heading) * 150, 10);
        }
        g.save();
      }
    }
    this.sparkle.update(dt, -0.2);
  }
  setScale(h, fov) {
    this.flames.setScale(h, fov);
    this.sparkle.setScale(h, fov);
  }
  update(dt) {
    this.updateTraps(dt);
    this.updateHoops(dt);
    this.updatePads(dt);
    this.updateStatues(dt);
  }
}
