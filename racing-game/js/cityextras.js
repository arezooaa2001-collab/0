// قابلیت‌های تازه شهر آزاد: ماشین آتش‌نشانی با آب‌پاش، ماشین پلیس با چراغ گردان، بالن‌های هوای گرم، هلیکوپتر،
// توپ فوتبال و دروازه، سگ همراه، رقصنده خیابانی، چمن متحرک، چاله‌های آب باران و سکوهای سرعت
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32, TAU, clamp, lerp, damp, wrapAngle, toFa } from './utils.js';
import { buildHuman } from './human.js';
import { blockRect, CITY } from './cityworld.js';
import { WIND } from './cityfx.js';
import { mat } from './furniture.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const mesh = (g, m, x = 0, y = 0, z = 0, p) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; if (p) p.add(o); return o; };
const rb = (w, h, d, r = 0.08) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));

// ---------- ماشین آتش‌نشانی ----------
export class FireTruck {
  constructor(g, house) {
    this.g = g; this.t = 0; const grp = new THREE.Group(); this.root = grp;
    const red = mat(0xc1121f, 0.35, 0.3), white = mat(0xf1f1f1, 0.4), dark = mat(0x1a1a1a, 0.8), chrome = mat(0xcfd3d8, 0.2, 0.9);
    mesh(rb(2.5, 1.5, 7.2, 0.15), red, 0, 1.25, -0.6, grp); mesh(rb(2.5, 1.7, 2.2, 0.25), red, 0, 1.55, 3.7, grp);
    mesh(new THREE.BoxGeometry(2.3, 0.75, 0.05), new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.6, roughness: 0.1 }), 0, 2.0, 4.82, grp);
    mesh(new THREE.BoxGeometry(2.56, 0.18, 7.3), white, 0, 1.0, -0.6, grp);
    for (const x of [-0.6, 0.6]) mesh(new THREE.BoxGeometry(0.08, 0.08, 6.4), chrome, x, 2.25, -0.9, grp);
    for (let k = 0; k < 12; k++) mesh(new THREE.BoxGeometry(1.2, 0.05, 0.05), chrome, 0, 2.25, -3.9 + k * 0.55, grp);
    for (const [z, x] of [[3.2, 1.1], [3.2, -1.1], [-1.8, 1.1], [-1.8, -1.1], [-3.3, 1.1], [-3.3, -1.1]]) { const w = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 18), dark, x * 1.08, 0.5, z, grp); w.rotation.z = Math.PI / 2; }
    this.cannon = mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.1, 10), chrome, 0, 2.55, -3.6, grp); this.cannon.rotation.x = -1.0;
    this.lights = [0xff2020, 0x2060ff].map((c, i) => { const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false }); mesh(new THREE.BoxGeometry(0.5, 0.18, 0.25), m, i ? 0.4 : -0.4, 2.5, 3.9, grp); return m; });
    // جای توقف: روی خیابان روبروی خانه
    const stop = house.toWorld(-2.5, 0, 21.5); const fwd = house.toWorld(30, 0, 21.5).sub(stop).normalize();
    this.stop = stop.setY(0); this.yaw = Math.atan2(fwd.x, fwd.z); this.from = stop.clone().addScaledVector(fwd, -60);
    grp.position.copy(this.from); grp.rotation.y = this.yaw; g.scene.add(grp);
    this.target = house.toWorld(0, 4.2, 0);
    this.water = []; this.sirenT = 0;
  }
  update(dt) {
    const g = this.g; this.t += dt; const u = clamp(this.t / 4, 0, 1); const e = 1 - (1 - u) ** 3;
    this.root.position.lerpVectors(this.from, this.stop, e);
    const on = Math.sin(this.t * 14) > 0; this.lights[0].color.setHex(on ? 0xff2020 : 0x300000); this.lights[1].color.setHex(on ? 0x000830 : 0x2060ff);
    this.sirenT -= dt; if (this.sirenT <= 0 && this.t < 8) { this.sirenT = 1.6; if (g.playerWorldPos(V()).distanceTo(this.root.position) < 90) g.sfx('siren'); }
    if (this.t > 4.2 && this.t < 14) {
      // آب‌پاشی: قوس آب از توپ آب‌پاش به سمت سقف
      const src = this.cannon.getWorldPosition(V()); const d = this.target.clone().sub(src); const L = d.length();
      const c = new THREE.Color(0.75, 0.88, 1);
      for (let k = 0; k < 6; k++) { const v = d.clone().multiplyScalar(1.05 / Math.max(1, L / 14)).add(V((Math.random() - 0.5) * 0.8, 4 + Math.random(), (Math.random() - 0.5) * 0.8)); g.fx.water.emit(src, v, c, 0.22, 1.3, 0.7); }
      if (Math.random() < 0.4) g.fx.steam.emit(this.target.clone().add(V((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6)), V(0, 1.2, 0), new THREE.Color(0.92, 0.92, 0.92), 1.4, 2.5, 0.35);
    }
    return this.t < 22;
  }
  dispose() { this.root.parent?.remove(this.root); }
}

// ---------- چراغ گردان ماشین پلیس روی یکی از ماشین‌های ترافیک ----------
export function makePolice(g, car) {
  const bar = new THREE.Group(); const sh = car.model.shape; bar.position.set(0, (sh.roof || 1.3) + 0.08, -0.2);
  const ms = [0xff1a1a, 0x1a4dff].map((c, i) => { const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false }); const o = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.24), m); o.position.x = i ? 0.26 : -0.26; bar.add(o); return m; });
  car.model.root.add(bar); car.police = true; car.vmax = 15;
  let t = 0, sirenT = 6;
  return { update(dt) { t += dt; const p = Math.floor(t * 6) % 4; ms[0].color.setHex(p < 2 ? 0xff1a1a : 0x220000); ms[1].color.setHex(p >= 2 ? 0x1a4dff : 0x000622); sirenT -= dt; if (sirenT <= 0) { sirenT = 18 + Math.random() * 10; if (car.pos.distanceTo(g.playerWorldPos(V())) < 45) g.sfx('siren'); } } };
}

// ---------- بالن هوای گرم ----------
function balloonGeo(colA, colB) {
  const prof = []; for (let k = 0; k <= 20; k++) { const t = k / 20; const y = t * 16; const r = Math.sin(Math.min(1, t * 1.05) * Math.PI * 0.92) * 6.5 * (t < 0.2 ? 0.55 + t * 2.2 : 1) + (t < 0.05 ? 0.6 : 0); prof.push(new THREE.Vector2(Math.max(0.6, r), y)); }
  const g = new THREE.LatheGeometry(prof, 24); const c = new THREE.Color(), col = [];
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const s = Math.floor(((a + Math.PI) / TAU) * 12) % 2; c.setHex(s ? colA : colB); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
}
export class Balloons {
  constructor(g, n = 3) {
    this.g = g; const rng = mulberry32(8); this.list = [];
    const cols = [[0xe63946, 0xffd166], [0x3a86ff, 0xffffff], [0x8338ec, 0x06d6a0], [0xff7a00, 0x1d3557]];
    for (let k = 0; k < n; k++) {
      const grp = new THREE.Group(); const [a, b] = cols[k % cols.length];
      mesh(balloonGeo(a, b), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }), 0, 4, 0, grp);
      mesh(rb(1.6, 1.1, 1.6, 0.1), mat(0x8a5a33, 0.9), 0, 0, 0, grp);
      const ropes = []; for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) ropes.push(new THREE.Vector3(x, 0.5, z), new THREE.Vector3(x * 1.4, 4.2, z * 1.4));
      grp.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ropes), new THREE.LineBasicMaterial({ color: 0x333333 })));
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 10), new THREE.MeshBasicMaterial({ color: 0xffa030, toneMapped: false, transparent: true, opacity: 0.9 })); flame.position.y = 1.6; flame.visible = false; grp.add(flame);
      const d = { grp, flame, a: rng() * TAU, R: 120 + rng() * 160, h: 85 + rng() * 60, sp: 0.012 + rng() * 0.01, ft: rng() * 6 };
      grp.traverse((o) => { o.castShadow = false; }); g.scene.add(grp); this.list.push(d);
    }
  }
  update(dt, t) { for (const d of this.list) { d.a += d.sp * dt; d.grp.position.set(Math.cos(d.a) * d.R, d.h + Math.sin(t * 0.2 + d.R) * 4, Math.sin(d.a) * d.R); d.grp.rotation.y = t * 0.03; d.ft -= dt; if (d.ft < 0) { d.ft = 5 + Math.random() * 7; d.burn = 1.2; } d.burn = Math.max(0, (d.burn || 0) - dt); d.flame.visible = d.burn > 0; d.flame.scale.setScalar(0.8 + Math.random() * 0.4); } }
}

// ---------- هلیکوپتر ----------
export class Helicopter {
  constructor(g) {
    this.g = g; const grp = new THREE.Group(); this.root = grp;
    const body = mat(0x1d4ed8, 0.35, 0.4), dark = mat(0x111111, 0.6), glass = new THREE.MeshStandardMaterial({ color: 0x9fd0ff, metalness: 0.7, roughness: 0.1 });
    const cap = mesh(new THREE.CapsuleGeometry(1.1, 2.2, 6, 16), body, 0, 0, 0, grp); cap.rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(1.0, 14, 10, 0, TAU, 0, Math.PI / 2), glass, 0, 0.1, 1.5, grp).rotation.x = Math.PI / 2;
    const boom = mesh(new THREE.CylinderGeometry(0.18, 0.35, 4.5, 10), body, 0, 0.3, -3.6, grp); boom.rotation.x = Math.PI / 2;
    mesh(new THREE.BoxGeometry(0.1, 1.2, 0.8), body, 0, 0.8, -5.7, grp);
    for (const x of [-0.8, 0.8]) mesh(new THREE.BoxGeometry(0.08, 0.08, 3), dark, x, -1.35, 0, grp);
    this.rotor = new THREE.Group(); this.rotor.position.y = 1.35; grp.add(this.rotor);
    for (let k = 0; k < 4; k++) { const bl = mesh(new THREE.BoxGeometry(0.3, 0.05, 5.2), dark, 0, 0, 0, this.rotor); bl.rotation.y = k * Math.PI / 2; bl.position.set(Math.sin(k * Math.PI / 2) * 2.6, 0, Math.cos(k * Math.PI / 2) * 2.6); }
    this.tail = new THREE.Group(); this.tail.position.set(0.15, 0.8, -5.8); grp.add(this.tail); for (let k = 0; k < 2; k++) { const b = mesh(new THREE.BoxGeometry(0.04, 1.3, 0.14), dark, 0, 0, 0, this.tail); b.rotation.x = k * Math.PI / 2; }
    this.blink = new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false }); mesh(new THREE.SphereGeometry(0.12, 8, 6), this.blink, 0, -0.5, -5.9, grp);
    this.a = 0; grp.traverse((o) => { o.castShadow = false; }); g.scene.add(grp);
  }
  update(dt, t) {
    this.a += dt * 0.07; const R = 220; const x = Math.cos(this.a) * R, z = Math.sin(this.a) * R * 0.7;
    const nx = Math.cos(this.a + 0.01) * R, nz = Math.sin(this.a + 0.01) * R * 0.7;
    this.root.position.set(x, 70 + Math.sin(t * 0.3) * 6, z); this.root.rotation.set(0.08, Math.atan2(nx - x, nz - z), -0.18);
    this.rotor.rotation.y += dt * 38; this.tail.rotation.x += dt * 50; this.blink.color.setHex(Math.sin(t * 6) > 0.7 ? 0xff2020 : 0x220000);
  }
}

// ---------- توپ فوتبال و دروازه در میدان ----------
function ballTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#f7f7f7'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#111';
  for (let i = 0; i < 10; i++) { const cx = (i * 53) % 256, cy = 20 + ((i * 37) % 90); x.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; x.lineTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14); } x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export class Soccer {
  constructor(g) {
    this.g = g; const W = g.world; const f = W.fountain ? W.fountain.pos : V(); this.home = V(f.x + 24, 0.37, f.z - 8);
    this.ball = mesh(new THREE.SphereGeometry(0.22, 24, 16), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.45 }), 0, 0, 0); g.scene.add(this.ball);
    this.p = this.home.clone(); this.v = V(); this.goals = 0; this.cool = 0;
    // دروازه
    const gp = V(f.x + 36, 0.15, f.z - 8); this.goal = gp; const gm = mat(0xffffff, 0.4);
    const grp = new THREE.Group(); grp.position.copy(gp); grp.rotation.y = -Math.PI / 2; g.scene.add(grp);
    for (const x of [-1.8, 1.8]) mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 10), gm, x, 0.95, 0, grp);
    const cb = mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.7, 10), gm, 0, 1.9, 0, grp); cb.rotation.z = Math.PI / 2;
    const net = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.9, 12, 6), new THREE.MeshBasicMaterial({ color: 0xdddddd, wireframe: true, transparent: true, opacity: 0.6 })); net.position.set(0, 0.95, -0.9); net.rotation.x = -0.25; grp.add(net);
    W.colliders.circle(gp.x + 0.01, gp.z - 1.8, 0.1, 3); W.colliders.circle(gp.x + 0.01, gp.z + 1.8, 0.1, 3);
    this.inter = W.inter.add({ pos: this.p.clone(), r: 1.6, pri: 1, label: 'شوت کردن توپ فوتبال ⚽', act: (gm2) => this.kick(true) });
  }
  kick(strong) {
    const g = this.g; const dir = V(Math.sin(g.p.yaw), 0, Math.cos(g.p.yaw));
    if (strong) { g.act('kick', 0.6, {}); g.timers.push({ t: 0.25, fn: () => { this.v.copy(dir).multiplyScalar(11).setY(3.5); g.sfx('thumpBall'); } }); }
    else { this.v.addScaledVector(dir, 3 + g.p.speed * 1.1).setY(Math.max(this.v.y, 1.2)); g.sfx('thumpBall'); }
    this.cool = 0.35;
  }
  update(dt) {
    const g = this.g; const W = g.world; const p = this.p, v = this.v; this.cool -= dt;
    // ضربه با راه رفتن یا ماشین
    if (g.state === 'foot' && this.cool <= 0 && Math.hypot(g.p.pos.x - p.x, g.p.pos.z - p.z) < 0.55 && g.p.speed > 1) this.kick(false);
    if (g.state === 'drive') { const c = g.veh; const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z); if (d < c.model.shape.W / 2 + 0.5 && this.cool <= 0) { const n = V(p.x - c.pos.x, 0, p.z - c.pos.z).normalize(); v.copy(n).multiplyScalar(Math.abs(c.vf) * 1.3 + 3).setY(Math.abs(c.vf) * 0.25 + 1.5); this.cool = 0.4; g.sfx('thumpBall'); } }
    v.y -= 9.81 * dt; p.addScaledVector(v, dt);
    const gy = W.groundAt(p.x, p.z) + 0.22;
    if (p.y < gy) { p.y = gy; if (v.y < -1.2) { v.y = -v.y * 0.55; } else v.y = 0; v.x *= Math.exp(-1.2 * dt); v.z *= Math.exp(-1.2 * dt); }
    const hit = W.colliders.resolve(p, 0.22, 2, p.y); if (hit) { const vn = v.x * hit.nx + v.z * hit.nz; if (vn < 0) { v.x -= 1.6 * vn * hit.nx; v.z -= 1.6 * vn * hit.nz; } }
    const sp = Math.hypot(v.x, v.z); if (sp > 0.02) { const ax = V(v.z, 0, -v.x).normalize(); this.ball.rotateOnWorldAxis(ax, -sp * dt / 0.22); }
    this.ball.position.copy(p);
    W.inter.move(this.inter, p.clone().setY(p.y + 0.6));
    // گل!
    const gx = this.goal.x, gz = this.goal.z; if (p.x > gx - 0.2 && p.x < gx + 0.9 && Math.abs(p.z - gz) < 1.75 && p.y < 2) { this.goals++; g.addCoins(5, `گل! ⚽🥅 (${toFa(this.goals)}) +۵ سکه`); g.ach?.unlock('goal'); g.burstSparkle(V(gx, 1.2, gz)); g.effects.confettiBurst(V(gx, 0, gz), 120); this.p.copy(this.home); this.v.set(0, 0, 0); }
    if (Math.hypot(p.x - this.home.x, p.z - this.home.z) > 120) { this.p.copy(this.home); this.v.set(0, 0, 0); }
  }
}

// ---------- سگ همراه ----------
export class Dog {
  constructor(g) {
    this.g = g; const W = g.world; const f = W.fountain ? W.fountain.pos : V(); this.p = V(f.x - 16, 0.15, f.z + 6); this.yaw = 0; this.t = 0; this.follow = false; this.state = 'sit'; this.barkT = 4;
    const fur = mat(0xc8873e, 0.9), dark = mat(0x5a3a1a, 0.9), nose = mat(0x111111, 0.4);
    const grp = new THREE.Group(); this.root = grp; g.scene.add(grp);
    this.body = new THREE.Group(); this.body.position.y = 0.5; grp.add(this.body);
    const b = mesh(new THREE.CapsuleGeometry(0.17, 0.5, 6, 12), fur, 0, 0, 0, this.body); b.rotation.x = Math.PI / 2;
    this.head = new THREE.Group(); this.head.position.set(0, 0.2, 0.42); this.body.add(this.head);
    mesh(new THREE.SphereGeometry(0.15, 14, 10), fur, 0, 0.02, 0, this.head); const sn = mesh(new THREE.CapsuleGeometry(0.06, 0.12, 4, 8), fur, 0, -0.03, 0.14, this.head); sn.rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.035, 8, 6), nose, 0, -0.01, 0.24, this.head);
    for (const x of [-0.06, 0.06]) mesh(new THREE.SphereGeometry(0.022, 8, 6), nose, x, 0.06, 0.12, this.head);
    this.ears = [-1, 1].map((s) => { const e = mesh(new THREE.BoxGeometry(0.05, 0.14, 0.09), dark, s * 0.1, 0.12, -0.02, this.head); e.rotation.z = s * 0.4; return e; });
    this.tail = new THREE.Group(); this.tail.position.set(0, 0.08, -0.42); this.body.add(this.tail); const tl = mesh(new THREE.CapsuleGeometry(0.03, 0.25, 4, 6), fur, 0, 0.12, -0.04, this.tail); tl.rotation.x = -0.6;
    this.legs = [[-0.09, 0.28], [0.09, 0.28], [-0.09, -0.26], [0.09, -0.26]].map(([x, z]) => { const lg = new THREE.Group(); lg.position.set(x, -0.08, z); this.body.add(lg); mesh(new THREE.CapsuleGeometry(0.04, 0.3, 4, 6), fur, 0, -0.2, 0, lg); return lg; });
    this.inter = W.inter.add({ pos: this.p.clone().setY(0.8), r: 1.6, pri: 1.2, label: () => (this.follow ? 'گفتن «بشین» به سگ 🐕' : 'نوازش سگ و بردنش همراه خودت 🐶'), act: () => this.toggle() });
  }
  toggle() { const g = this.g; this.follow = !this.follow; g.act('pickup', 1.0, { text: this.follow ? 'سگ دمش را تکان داد و دنبالت می‌آید! 🐶' : 'سگ نشست و منتظرت می‌ماند 🐕' }); this.bark(); g.ach?.unlock('dog'); }
  bark() { this.g.sfx('bark'); this.barkAnim = 0.5; }
  update(dt) {
    const g = this.g; const W = g.world; this.t += dt; const target = g.playerWorldPos(V());
    const vis = this.follow || target.distanceTo(this.p) < 140; if (this.root.visible !== vis) this.root.visible = vis; if (!vis) return;
    let speed = 0;
    if (this.follow && g.state !== 'drive' && g.state !== 'ride') {
      const d = Math.hypot(target.x - this.p.x, target.z - this.p.z);
      if (d > 30) { this.p.set(target.x - 2, 0, target.z - 2); }
      if (d > 1.8) { const want = Math.atan2(target.x - this.p.x, target.z - this.p.z); this.yaw += wrapAngle(want - this.yaw) * Math.min(1, dt * 6); speed = clamp((d - 1.5) * 2.2, 0, 7.5); this.p.x += Math.sin(this.yaw) * speed * dt; this.p.z += Math.cos(this.yaw) * speed * dt; W.colliders.resolve(this.p, 0.3, 1, this.p.y); }
    }
    this.p.y = damp(this.p.y, W.groundAt(this.p.x, this.p.z), 15, dt);
    this.barkT -= dt; if (this.barkT <= 0) { this.barkT = 8 + Math.random() * 12; if (target.distanceTo(this.p) < 25) this.bark(); }
    // انیمیشن: نشستن، راه رفتن، دویدن، تکان دادن دم و پارس کردن
    const R = this.root; R.position.copy(this.p); R.rotation.y = this.yaw;
    const run = speed > 3.5, ph = this.t * (run ? 14 : 9);
    const sit = speed < 0.2 && !this.follow;
    this.sitK = damp(this.sitK || 0, sit ? 1 : 0, 5, dt);
    this.legs.forEach((l, i) => { const s = (i === 0 || i === 3) ? 1 : -1; l.rotation.x = speed > 0.2 ? Math.sin(ph) * s * (run ? 0.9 : 0.55) : (i >= 2 ? -this.sitK * 1.2 : 0); });
    this.body.rotation.x = -this.sitK * 0.45 + (run ? Math.sin(ph * 2) * 0.05 : 0); this.body.position.y = 0.5 - this.sitK * 0.12 + (run ? Math.abs(Math.sin(ph)) * 0.05 : 0);
    this.tail.rotation.y = Math.sin(this.t * (this.follow ? 16 : 8)) * 0.6; this.tail.rotation.x = this.follow ? -0.3 : 0;
    this.barkAnim = Math.max(0, (this.barkAnim || 0) - dt); this.head.rotation.x = this.barkAnim > 0 ? -Math.abs(Math.sin(this.barkAnim * 25)) * 0.3 : Math.sin(this.t * 1.3) * 0.08;
    this.head.rotation.y = Math.sin(this.t * 0.7) * 0.3; this.ears.forEach((e, i) => { e.rotation.x = Math.sin(this.t * 3 + i) * 0.15; });
    W.inter.move(this.inter, this.p.clone().setY(this.p.y + 0.8));
  }
}

// ---------- رقصنده خیابانی ----------
export class Performer {
  constructor(g) {
    this.g = g; const W = g.world; const f = W.fountain ? W.fountain.pos : V(); this.p = V(f.x - 10, 0.15, f.z - 12); this.t = 0;
    this.h = buildHuman({ detail: 'mid', shirt: 0x8338ec, pants: 0x111111, hair: 0x111111, skin: 0xc68d5f }); this.h.root.position.copy(this.p); this.h.root.rotation.y = 0.6; g.scene.add(this.h.root);
    const box = new THREE.Group(); box.position.set(this.p.x + 1.1, 0.15, this.p.z); g.scene.add(box);
    mesh(rb(0.6, 0.35, 0.22, 0.04), mat(0x222222, 0.5), 0, 0.18, 0, box); for (const x of [-0.16, 0.16]) { const s = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 16), mat(0x888888, 0.3, 0.8), x, 0.18, 0.115, box); s.rotation.x = Math.PI / 2; }
    this.hat = mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.1, 16, 1, true), mat(0x6b3e1e, 0.7), this.p.x - 0.9, 0.2, this.p.z + 0.4); this.hat.material.side = THREE.DoubleSide; g.scene.add(this.hat);
    W.colliders.circle(this.p.x, this.p.z, 0.4, 3);
    W.inter.add({ pos: V(this.p.x - 0.9, 0.8, this.p.z + 0.4), r: 1.8, label: 'انداختن انعام برای رقصنده 🎵', act: (gm) => { gm.act('reach', 1.0, { text: 'رقصنده تعظیم کرد: «ممنونم! این رقص تقدیم به تو» 🕺' }); this.bow = 1.6; gm.sfx('coin'); gm.ach?.unlock('tip'); } });
    this.noteT = 0;
  }
  update(dt) {
    const g = this.g; this.t += dt; const H = this.h; const near = g.playerWorldPos(V()).distanceTo(this.p) < 120;
    if (H.root.visible !== near) H.root.visible = near;
    if (!near) return;
    if (this.bow > 0) { this.bow -= dt; H.anim('reach', this.t, { k: 0.4 }); H.j.spine.rotation.x = 0.7 * Math.sin(Math.min(1, (1.6 - this.bow)) * Math.PI); }
    else H.anim('dance', this.t * 1.1);
    H.root.rotation.y = 0.6 + Math.sin(this.t * 0.5) * 0.6; H.blend(dt, 12);
    this.noteT -= dt; if (this.noteT <= 0) { this.noteT = 0.35; g.fx.sparkle.emit(V(this.p.x + 1.1 + (Math.random() - 0.5) * 0.3, 0.6, this.p.z), V((Math.random() - 0.5) * 0.6, 1.2, (Math.random() - 0.5) * 0.6), new THREE.Color().setHSL(Math.random(), 1, 0.65).multiplyScalar(2), 0.18, 1.6, 1); }
  }
}

// ---------- چمن متحرک اطراف قهرمان (کیفیت بالا و فوق‌العاده) ----------
export class Grass {
  constructor(g, n = 1400) {
    this.g = g; this.n = n; const W = g.world;
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.clearRect(0, 0, 64, 64);
    for (let i = 0; i < 9; i++) { const bx = 6 + i * 6.5 + Math.random() * 3; const h = 30 + Math.random() * 30; const gr = x.createLinearGradient(0, 64, 0, 64 - h); gr.addColorStop(0, '#4d7d33'); gr.addColorStop(1, '#a9de72'); x.fillStyle = gr; x.beginPath(); x.moveTo(bx - 2.5, 64); x.quadraticCurveTo(bx + (Math.random() - 0.5) * 8, 64 - h * 0.6, bx + (Math.random() - 0.5) * 10, 64 - h); x.lineTo(bx + 2.5, 64); x.fill(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const q1 = new THREE.PlaneGeometry(0.6, 0.42); q1.translate(0, 0.21, 0); const q2 = q1.clone().rotateY(Math.PI / 3); const q3 = q1.clone().rotateY(-Math.PI / 3);
    const geo = new THREE.BufferGeometry(); const pos = [], uv = [], nrm = [];
    for (const q of [q1, q2, q3]) { const ni = q.index.array; for (const i of ni) { pos.push(q.attributes.position.getX(i), q.attributes.position.getY(i), q.attributes.position.getZ(i)); uv.push(q.attributes.uv.getX(i), q.attributes.uv.getY(i)); nrm.push(0, 1, 0); } }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95 });
    m.onBeforeCompile = (sh) => { sh.uniforms.uWT = WIND.uTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWT;').replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat hh = position.y / 0.42; float ph = instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 0.7; transformed.x += sin(uWT * 2.2 + ph) * 0.08 * hh * hh; transformed.z += cos(uWT * 1.7 + ph) * 0.05 * hh * hh;'); };
    m.customProgramCacheKey = () => 'grass-tuft';
    this.mesh = new THREE.InstancedMesh(geo, m, n); this.mesh.frustumCulled = false; this.mesh.receiveShadow = true; g.scene.add(this.mesh);
    const rng = mulberry32(3); this.off = Array.from({ length: n }, () => [rng() * 60 - 30, rng() * 60 - 30, rng() * TAU, 0.7 + rng() * 0.7]);
    this.cx = 1e9; this.cz = 1e9; this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = V(); this.pp = V();
  }
  isLawn(x, z) {
    const W = this.g.world; const ST = CITY.BLOCK + CITY.ROAD; const O = -(CITY.N * ST + CITY.ROAD) / 2;
    const bx = Math.floor((x - O) / ST), bz = Math.floor((z - O) / ST); if (bx < 0 || bz < 0 || bx >= CITY.N || bz >= CITY.N) return Math.max(Math.abs(x), Math.abs(z)) > -O + 2;
    const t = W.types[bx + ',' + bz]; if (t !== 'res' && t !== 'park') return false;
    const r = blockRect(bx, bz); if (t === 'park') { const pr = W.parkRect; return x > pr.x0 + 2 && x < pr.x1 - 2 && z > pr.z0 + 2 && z < pr.z1 - 2 && !W.colliders.inside(x, z, 3); }
    if (x < r.x0 + 4.3 || x > r.x1 - 4.3 || z < r.z0 + 4.3 || z > r.z1 - 4.3) return false;
    if (W.colliders.inside(x, z, 3)) return false;
    for (const h of W.houseRects || []) if (x > h.minX - 0.3 && x < h.maxX + 0.3 && z > h.minZ - 0.3 && z < h.maxZ + 0.3) return false;
    return true;
  }
  update() {
    const p = this.g.playerWorldPos(this.pp); const cx = Math.round(p.x / 6) * 6, cz = Math.round(p.z / 6) * 6;
    if (cx === this.cx && cz === this.cz) return; this.cx = cx; this.cz = cz;
    for (let i = 0; i < this.n; i++) {
      const [ox, oz, rot, s] = this.off[i]; const x = cx + ox, z = cz + oz;
      if (!this.isLawn(x, z)) { this.m4.makeScale(0, 0, 0); }
      else { const y = this.g.world.groundAt(x, z) + 0.0; this.q.setFromAxisAngle(V(0, 1, 0), rot); this.m4.compose(V(x, y, z), this.q, this.s.set(s, s * (0.8 + (i % 5) * 0.1), s)); }
      this.mesh.setMatrixAt(i, this.m4);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- چاله‌های آب در هوای بارانی ----------
export function makePuddles(g, n = 60) {
  const W = g.world; const rng = mulberry32(13); const geo = new THREE.CircleGeometry(1, 20); geo.rotateX(-Math.PI / 2);
  const m = new THREE.MeshStandardMaterial({ color: 0x1b2530, roughness: 0.03, metalness: 0.9, transparent: true, opacity: 0.75, polygonOffset: true, polygonOffsetFactor: -3, envMapIntensity: 1.8 });
  const im = new THREE.InstancedMesh(geo, m, n); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const edges = W.lane.edges;
  for (let i = 0; i < n; i++) {
    const e = edges[(rng() * edges.length) | 0]; const u = 0.2 + rng() * 0.6; const x = lerp(e.a.x, e.b.x, u), z = lerp(e.a.z, e.b.z, u);
    const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z; const L = Math.hypot(dx, dz); const off = (rng() - 0.5) * 12;
    const px = x - dz / L * off, pz = z + dx / L * off; const s = 0.6 + rng() * 1.6;
    m4.compose(V(px, W.groundAt(px, pz) + 0.03, pz), q.setFromAxisAngle(V(0, 1, 0), rng() * TAU), V(s * (1 + rng()), 1, s)); im.setMatrixAt(i, m4);
  }
  im.receiveShadow = true; g.scene.add(im); return im;
}

// ---------- سکوهای سرعت در زمین پرش ----------
export class BoostPads {
  constructor(g) {
    this.g = g; const W = g.world; this.pads = [];
    const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#001a33'; x.fillRect(0, 0, 64, 128);
    for (let k = 0; k < 3; k++) { x.fillStyle = '#18c8ff'; x.beginPath(); x.moveTo(8, 40 + k * 40); x.lineTo(32, 10 + k * 40); x.lineTo(56, 40 + k * 40); x.lineTo(48, 46 + k * 40); x.lineTo(32, 26 + k * 40); x.lineTo(16, 46 + k * 40); x.fill(); }
    this.tex = new THREE.CanvasTexture(c); this.tex.wrapT = THREE.RepeatWrapping; this.tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 });
    for (const r of W.ramps) {
      const x = r.x - Math.sin(r.yaw) * (r.l / 2 + 12), z = r.z - Math.cos(r.yaw) * (r.l / 2 + 12);
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6), m); pad.rotation.set(-Math.PI / 2, r.yaw + Math.PI, 0, 'YXZ'); pad.position.set(x, 0.05, z); g.scene.add(pad);
      this.pads.push({ x, z, yaw: r.yaw, cool: 0 });
    }
  }
  update(dt) {
    const g = this.g; this.tex.offset.y -= dt * 1.5; const v = g.veh; if (!v) return;
    for (const p of this.pads) { p.cool -= dt; if (p.cool > 0) continue; if (Math.hypot(v.pos.x - p.x, v.pos.z - p.z) < 3.2) { p.cool = 1.5; const fx = Math.sin(v.heading), fz = Math.cos(v.heading); const add = 14; v.vel.x += fx * add; v.vel.z += fz * add; v.vf += add; g.sfx('whoosh'); g.shake = Math.min(1, (g.shake || 0) + 0.3); g.toast('سکوی سرعت! 🚀'); g.app.engine.finalPass.uniforms.uSpeed.value = 1; g.ach?.unlock('boost'); } }
  }
}
