import * as THREE from 'three';
import { fa, pick } from './util.js';
import { regionAt } from './world.js';

const REGIONS = ['forest', 'desert', 'lake', 'farm'];

function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 64, 0, 0);
  gr.addColorStop(0, 'rgba(255,230,140,0.9)');
  gr.addColorStop(1, 'rgba(255,230,140,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 8, 64);
  return new THREE.CanvasTexture(c);
}
function xTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(200,20,20,0.95)';
  g.lineWidth = 22;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(22, 22);
  g.lineTo(106, 106);
  g.moveTo(106, 22);
  g.lineTo(22, 106);
  g.stroke();
  return new THREE.CanvasTexture(c);
}

/** A treasure hunt: three pieces of an old map lie hidden around the country, each marked by a
 *  beam of light. Find all three and an X appears on the map; go there on foot and dig up the
 *  chest. A new hunt starts a while after each one. */
export class Treasure {
  constructor(game) {
    this.g = game;
    const scene = game.scene;
    this.beamMat = new THREE.MeshBasicMaterial({ map: beamTexture(), color: 0xffc860, opacity: 0.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    this.scrollMat = new THREE.MeshStandardMaterial({ color: 0xf0dfb4, emissive: 0x7a5a20, emissiveIntensity: 0.4, roughness: 0.8 });
    this.ribbonMat = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.6 });
    this.items = [];
    for (let i = 0; i < 3; i++) {
      const grp = new THREE.Group();
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 12), this.scrollMat);
      roll.rotation.z = Math.PI / 2;
      grp.add(roll);
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 12), this.ribbonMat);
      rib.rotation.z = Math.PI / 2;
      grp.add(rib);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.9, 70, 10, 1, true), this.beamMat);
      beam.position.y = 35;
      grp.add(beam);
      grp.visible = false;
      scene.add(grp);
      this.items.push(grp);
    }
    // the X and the chest
    this.x = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: xTexture(), transparent: true, depthWrite: false }));
    this.x.rotation.x = -Math.PI / 2;
    this.x.visible = false;
    scene.add(this.x);
    this.chest = this.buildChest();
    this.chest.root.visible = false;
    scene.add(this.chest.root);
    this.digT = 0;
    this.open = 0;
    this.spin = 0;
  }
  buildChest() {
    const root = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x6d3f1f, roughness: 0.8 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc107, metalness: 0.9, roughness: 0.25, emissive: 0x6b4a00, emissiveIntensity: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), wood);
    body.position.y = 0.35;
    root.add(body);
    for (const x of [-0.45, 0.45]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.82), gold);
      band.position.set(x, 0.35, 0);
      root.add(band);
    }
    // the treasure glows inside
    const coins = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.12, 0.65), new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0xffb300, emissiveIntensity: 1.4, metalness: 0.8, roughness: 0.3 }));
    coins.position.y = 0.66;
    root.add(coins);
    const lid = new THREE.Group();
    lid.position.set(0, 0.7, -0.4);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 14, 1, false, 0, Math.PI), wood);
    top.rotation.z = Math.PI / 2;
    top.position.z = 0.4;
    lid.add(top);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.06), gold);
    lock.position.set(0, 0.05, 0.82);
    lid.add(lock);
    root.add(lid);
    root.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    return { root, lid };
  }
  get data() {
    const s = this.g.stats;
    if (!s.treasure || typeof s.treasure !== 'object' || !Array.isArray(s.treasure.pieces)) s.treasure = { pieces: [], x: null, found: 0, next: 30 };
    return s.treasure;
  }
  /** a hidden spot in a region: off the roads, on open ground */
  spot(region, minRoad = 25) {
    const w = this.g.world;
    for (let k = 0; k < 300; k++) {
      const x = (Math.random() * 2 - 1) * 1800, z = (Math.random() * 2 - 1) * 1800;
      if (regionAt(x, z) !== region) continue;
      if (!w.freeSpot(x, z, minRoad) || w.roadDist(x, z) > 220) continue;
      return { x: Math.round(x), z: Math.round(z) };
    }
    return null;
  }
  newHunt() {
    const D = this.data;
    const regs = [...REGIONS].sort(() => Math.random() - 0.5).slice(0, 3);
    D.pieces = regs.map((r) => this.spot(r)).filter(Boolean).map((p) => ({ ...p, got: false, hx: p.x + Math.round((Math.random() - 0.5) * 70), hz: p.z + Math.round((Math.random() - 0.5) * 70) }));
    D.x = null;
    if (D.pieces.length < 3) return false;
    this.g.ui.toast('🏴‍☠️ یه نقشه گنج پاره شده! ۳ تیکه‌اش یه جایی توی جنگل و کویر و کوهستان افتاده؛ دنبال ستون‌های نور بگرد 📜', 'info');
    return true;
  }
  /** on foot near the X: the zone button digs */
  digZone() {
    const D = this.data, g = this.g;
    if (!D.x || !g.onfoot.active || this.digT > 0 || this.open > 0) return false;
    return Math.hypot(g.onfoot.walker.pos.x - D.x.x, g.onfoot.walker.pos.z - D.x.z) < 3.5;
  }
  dig() {
    if (!this.digZone()) return;
    this.digT = 3;
    this.g.ui.toast('⛏️ داری می‌کنی...', 'info');
  }
  mapIcons() {
    const D = this.data, out = [];
    for (const p of D.pieces) if (!p.got) out.push({ x: p.hx, z: p.hz, col: '#8d6e63', txt: '📜' });
    if (D.x) out.push({ x: D.x.x, z: D.x.z, col: '#b71c1c', txt: '🏴‍☠️' });
    return out;
  }
  update(dt) {
    const g = this.g, w = g.world, D = this.data;
    if (!dt) return;
    const zombie = g.zombie && g.zombie.active;
    // start a hunt when there's none going on
    if (!D.pieces.length && !D.x && g.state === 'play' && !zombie) {
      D.next = (D.next ?? 30) - dt;
      if (D.next <= 0) {
        D.next = 300;
        this.newHunt();
      }
    }
    const f = g.focus(), t = g.time;
    // the scrolls bob and turn under their light beams
    this.items.forEach((it, i) => {
      const p = D.pieces[i];
      it.visible = !!p && !p.got && !zombie;
      if (!it.visible) return;
      it.position.set(p.x, w.heightAt(p.x, p.z) + 1.1 + Math.sin(t * 2 + i) * 0.15, p.z);
      it.children[0].rotation.y = it.children[1].rotation.y = 0;
      it.rotation.y = t * 0.8 + i;
      if (Math.hypot(f.pos.x - p.x, f.pos.z - p.z) < 6 && g.state === 'play') {
        p.got = true;
        const n = D.pieces.filter((q) => q.got).length;
        g.audio.cash();
        for (const [fq, dl] of [[523, 0], [659, 0.12], [784, 0.24]]) g.audio.tone(fq, 0.25, 0.08, 'triangle', dl);
        g.coins += 5;
        if (n < 3) g.ui.toast(`📜 تیکه ${fa(n)} از ۳ نقشه گنج رو پیدا کردی! +۵ سکه`, 'good');
        else {
          // the map is whole: the X appears somewhere remote
          const reg = pick(REGIONS);
          D.x = this.spot(reg, 40) || this.spot('desert', 30);
          D.pieces = [];
          g.ui.toast('🗺️ نقشه کامل شد! جای گنج با 🏴‍☠️ روی نقشه معلومه. پیاده شو و بکنش ⛏️', 'good');
        }
        g.save();
      }
    });
    // the X on the ground
    this.x.visible = !!D.x && !zombie && this.open <= 0;
    if (D.x) {
      this.x.position.set(D.x.x, w.heightAt(D.x.x, D.x.z) + 0.06, D.x.z);
      if (!g.onfoot.active && Math.hypot(g.player.pos.x - D.x.x, g.player.pos.z - D.x.z) < 10 && !this.carSaid) {
        this.carSaid = true;
        g.ui.toast('🚶 گنج همین‌جاست! برای کندن باید پیاده شی (V)', 'info');
      }
    }
    // digging: dirt flies, then the chest rises and opens
    if (this.digT > 0) {
      this.digT -= dt;
      const wk = g.onfoot.walker;
      if (Math.random() < dt * 12) g.fx.dust.emit(D.x.x + (Math.random() - 0.5), w.heightAt(D.x.x, D.x.z) + 0.3, D.x.z + (Math.random() - 0.5), (Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3, 1, 0.5, 1.5, 0.8, 0.9);
      if (Math.random() < dt * 3) g.audio.burst(0.12, 900, 'lowpass', 0.3);
      if (wk) wk.heading = Math.atan2(D.x.x - wk.pos.x, D.x.z - wk.pos.z);
      if (this.digT <= 0) {
        this.open = 0.01;
        this.chest.root.visible = true;
        this.chest.root.position.set(D.x.x, w.heightAt(D.x.x, D.x.z) - 0.8, D.x.z);
        this.chest.root.rotation.y = Math.random() * 6;
        g.audio.tone(392, 0.3, 0.1, 'triangle');
      }
    }
    if (this.open > 0) {
      this.open += dt;
      const C = this.chest, gy = w.heightAt(D.x.x, D.x.z);
      C.root.position.y = gy - 0.8 + Math.min(1, this.open / 1.2) * 0.8;
      C.lid.rotation.x = -Math.min(1, Math.max(0, (this.open - 1.3) / 0.6)) * 1.9;
      if (this.open > 1.9 && !this.paid) {
        this.paid = true;
        for (let i = 0; i < 40; i++) g.fx.spark.emit(D.x.x, gy + 0.8, D.x.z, (Math.random() - 0.5) * 5, 4 + Math.random() * 5, (Math.random() - 0.5) * 5, 1.2, 0.14, 0, 1, 0.9);
        const coins = 120 + Math.floor(Math.random() * 61);
        g.coins += coins;
        g.addXp(300);
        D.found = (D.found || 0) + 1;
        g.stats.treasures = D.found;
        g.audio.cash();
        for (const [fq, dl] of [[523, 0], [659, 0.15], [784, 0.3], [1047, 0.45]]) g.audio.tone(fq, 0.35, 0.1, 'triangle', dl);
        g.ui.toast(`🏴‍☠️💰 گنج! ${fa(coins)} سکه طلا پیدا کردی!`, 'good');
        g.shake = Math.max(g.shake || 0, 0.3);
      }
      if (this.open > 9) {
        // the chest sinks back and the next hunt is on its way
        this.open = 0;
        this.paid = false;
        this.carSaid = false;
        C.root.visible = false;
        D.x = null;
        D.next = 300;
        g.save();
      }
    }
  }
}
