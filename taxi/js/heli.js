import * as THREE from 'three';
import { damp, dampAngle } from './util.js';

const DOWN = new THREE.Vector3(0, -1, 0);

/** Police helicopter that joins long chases, with a searchlight sweeping over the taxi. */
export class Heli {
  constructor(game) {
    this.g = game;
    const g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.45, metalness: 0.4 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf1f1f1, roughness: 0.5 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.1, metalness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
    const cab = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), body);
    cab.scale.set(1, 0.9, 1.6);
    g.add(cab);
    const win = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    win.scale.set(1.05, 0.8, 1.3);
    win.position.set(0, 0.25, 0.9);
    win.rotation.x = 0.5;
    g.add(win);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.35, 3.2), white);
    stripe.position.y = -0.2;
    g.add(stripe);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 5, 10), body);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 0.3, -4);
    g.add(boom);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.8), body);
    fin.position.set(0, 0.9, -6.3);
    g.add(fin);
    for (const x of [0.9, -0.9]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.6), dark);
      skid.position.set(x, -1.6, 0);
      g.add(skid);
      for (const z of [0.9, -0.9]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), dark);
        leg.position.set(x * 0.8, -1.35, z);
        g.add(leg);
      }
    }
    const rotor = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 11), dark);
      b.rotation.y = (i * Math.PI) / 2;
      rotor.add(b);
    }
    rotor.position.y = 1.55;
    g.add(rotor);
    const tail = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.6, 0.18), dark);
      b.rotation.x = (i * Math.PI) / 2;
      tail.add(b);
    }
    tail.position.set(0.25, 0.9, -6.4);
    g.add(tail);
    // blinking lights
    this.redMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
    this.blueMat = new THREE.MeshBasicMaterial({ color: 0x2060ff });
    const l1 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), this.redMat);
    l1.position.set(0, -1.2, 1.6);
    const l2 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), this.blueMat);
    l2.position.set(0, 1.0, -6.7);
    g.add(l1, l2);
    // searchlight: a soft cone and a bright pool on the ground (no real light, stays cheap)
    this.coneMat = new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const coneG = new THREE.CylinderGeometry(0.25, 5.5, 1, 24, 1, true);
    coneG.translate(0, -0.5, 0);
    this.cone = new THREE.Mesh(coneG, this.coneMat);
    this.cone.renderOrder = 3;
    game.scene.add(this.cone);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c2 = cv.getContext('2d');
    const grd = c2.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.5)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    c2.fillStyle = grd;
    c2.fillRect(0, 0, 128, 128);
    this.poolMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), color: 0xfff1c0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), this.poolMat);
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.renderOrder = 3;
    game.scene.add(this.pool);
    g.traverse((o) => { if (o.isMesh) o.castShadow = o !== this.cone; });
    g.visible = false;
    this.cone.visible = this.pool.visible = false;
    game.scene.add(g);
    this.group = g;
    this.rotor = rotor;
    this.tail = tail;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.state = 'off';
    this.aim = new THREE.Vector3();
    this.t = 0;
  }
  update(dt) {
    const g = this.g, pol = g.police, f = g.focus();
    if (pol.state === 'arrest' || g.state === 'jail' || g.state === 'cutscene') {
      if (this.state !== 'off') {
        this.state = 'off';
        this.group.visible = this.cone.visible = this.pool.visible = false;
        g.audio.setHeli && g.audio.setHeli(0);
      }
      return;
    }
    const want = pol.state === 'chase' && pol.stars >= 3;
    this.t += dt;
    if (want && this.state !== 'on') {
      if (this.state === 'off') {
        // fly in from far behind
        const a = f.heading + Math.PI + (Math.random() - 0.5);
        this.pos.set(f.pos.x + Math.sin(a) * 260, 90, f.pos.z + Math.cos(a) * 260);
        this.aim.set(f.pos.x, 0, f.pos.z);
        g.ui.toast('🚁 هلی‌کوپتر پلیس اومد! از بالا داره می‌بینتت!', 'bad');
      }
      this.state = 'on';
    } else if (!want && this.state === 'on') {
      // climb away along the current heading (a fixed direction, so it never runs away with itself)
      this.state = 'leave';
      this.leaveDir = { x: Math.sin(this.group.rotation.y), z: Math.cos(this.group.rotation.y) };
    }
    if (this.state === 'off') {
      g.audio.setHeli && g.audio.setHeli(0);
      return;
    }
    const fy = f.onFoot ? g.world.heightAt(f.pos.x, f.pos.z) : g.player.y;
    let tx, ty, tz;
    if (this.state === 'on') {
      // hover behind and above, lagging a little
      const back = 16 + Math.min(20, Math.abs(f.speed || 0) * 0.4);
      tx = f.pos.x - Math.sin(f.heading) * back + Math.sin(this.t * 0.4) * 8;
      tz = f.pos.z - Math.cos(f.heading) * back + Math.cos(this.t * 0.33) * 8;
      ty = Math.max(fy, g.world.heightAt(tx, tz)) + 30;
    } else {
      // climb away
      tx = this.pos.x + this.leaveDir.x * 40;
      tz = this.pos.z + this.leaveDir.z * 40;
      ty = this.pos.y + 25;
    }
    const k = this.state === 'on' ? 1.1 : 0.6;
    const nx = damp(this.pos.x, tx, k, dt), ny = damp(this.pos.y, ty, k, dt), nz = damp(this.pos.z, tz, k, dt);
    this.vel.set((nx - this.pos.x) / Math.max(dt, 1e-4), (ny - this.pos.y) / Math.max(dt, 1e-4), (nz - this.pos.z) / Math.max(dt, 1e-4));
    this.pos.set(nx, ny, nz);
    const G = this.group;
    G.visible = true;
    G.position.copy(this.pos);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 1) G.rotation.y = dampAngle(G.rotation.y, Math.atan2(this.vel.x, this.vel.z), 2, dt);
    G.rotation.x = Math.min(0.35, sp * 0.012);
    G.rotation.z = Math.sin(this.t * 0.7) * 0.05;
    this.rotor.rotation.y += dt * 38;
    this.tail.rotation.x += dt * 60;
    const blink = Math.floor(this.t * 2.5) % 2;
    this.redMat.color.setHex(blink ? 0xff2020 : 0x300000);
    this.blueMat.color.setHex(blink ? 0x000830 : 0x2060ff);
    // searchlight sweeps toward the taxi
    if (this.state === 'on') this.aim.set(damp(this.aim.x, f.pos.x, 3, dt), fy, damp(this.aim.z, f.pos.z, 3, dt));
    const night = g.env ? g.env.night : 0;
    const on = this.state === 'on';
    this.cone.visible = this.pool.visible = on;
    if (on) {
      const top = (this._top = this._top || new THREE.Vector3()).set(this.pos.x, this.pos.y - 1.3, this.pos.z);
      const dir = (this._dir = this._dir || new THREE.Vector3()).subVectors(this.aim, top);
      const len = dir.length();
      this.cone.position.copy(top);
      this.cone.scale.set(1, len, 1);
      this.cone.quaternion.setFromUnitVectors(DOWN, dir.normalize());
      this.coneMat.opacity = 0.03 + night * 0.16;
      this.pool.position.set(this.aim.x, g.world.heightAt(this.aim.x, this.aim.z) + 0.12, this.aim.z);
      this.poolMat.opacity = 0.15 + night * 0.5;
    }
    const d = Math.hypot(this.pos.x - g.player.pos.x, this.pos.z - g.player.pos.z, this.pos.y - g.player.y);
    const playing = g.state === 'play';
    g.audio.setHeli && g.audio.setHeli(playing ? Math.max(0, 1 - d / 260) : 0);
    if (this.state === 'leave' && (this.pos.y > 140 || d > 400)) {
      this.state = 'off';
      G.visible = false;
      g.audio.setHeli && g.audio.setHeli(0);
    }
  }
}
