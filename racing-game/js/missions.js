// ماموریت‌های شهر آزاد: ۵۰٪ نجات (خفگی با مانور هایملیخ، آتش‌سوزی خانه) و ۵۰٪ پاکسازی آشغال‌ها
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildHuman } from './human.js';
import { FireTruck } from './cityextras.js';
import { clamp, lerp, damp, mulberry32, TAU, toFa, fmtNum, wrapAngle } from './utils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DIFF = ['آسان', 'متوسط', 'سخت', 'خیلی سخت', 'افسانه‌ای'];
const SKINS = [0xe0b08a, 0xc68d5f, 0x8d5a3b, 0xf1c9a5, 0x6b4430];
const SHIRTS = [0x3a86ff, 0x2a9d8f, 0xe9c46a, 0x8338ec, 0xef476f, 0x06d6a0, 0x264653, 0xffffff];

// ---------------- آشغال‌های واقعی ----------------
let TRASH = null;
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function crumple(geo, amt, seed) { const r = mulberry32(seed); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (r() - 0.5) * amt; p.setXYZ(i, p.getX(i) * k, p.getY(i) * (1 + (r() - 0.5) * amt), p.getZ(i) * k); } geo.computeVertexNormals(); return geo; }
function trashLib() {
  if (TRASH) return TRASH;
  const L = {};
  // بطری پلاستیکی
  { const prof = [[0, 0], [0.032, 0], [0.035, 0.01], [0.035, 0.14], [0.03, 0.17], [0.014, 0.205], [0.013, 0.225], [0, 0.225]].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(prof, 16); g.translate(0, -0.11, 0); g.rotateZ(Math.PI / 2);
    const m = new THREE.MeshStandardMaterial({ color: 0xbfe6f5, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.55 });
    const cap = new THREE.CylinderGeometry(0.015, 0.015, 0.018, 12); cap.rotateZ(Math.PI / 2); cap.translate(-0.12, 0, 0);
    const label = new THREE.CylinderGeometry(0.0355, 0.0355, 0.06, 16, 1, true); label.rotateZ(Math.PI / 2); label.translate(0.01, 0, 0);
    const lt = canvasTex(256, 64, (x) => { x.fillStyle = '#1d6fd8'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#fff'; x.font = "900 34px 'Vazirmatn', sans-serif"; x.textAlign = 'center'; x.fillText('آب معدنی', 128, 44); });
    L.bottle = { name: 'بطری پلاستیکی', parts: [[g, m], [cap, new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 })], [label, new THREE.MeshStandardMaterial({ map: lt, roughness: 0.5 })]], rest: 0.035 }; }
  // قوطی نوشابه له‌شده
  { const g = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 18, 4); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 - Math.max(0, 0.25 - Math.abs(y)) * 0.6 * (Math.sin(Math.atan2(p.getZ(i), p.getX(i)) * 3) * 0.5 + 0.5); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k * 0.8); } g.computeVertexNormals(); g.rotateZ(Math.PI / 2);
    const t = canvasTex(256, 128, (x) => { const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#d90429'); gr.addColorStop(1, '#8d0801'); x.fillStyle = gr; x.fillRect(0, 0, 256, 128); x.fillStyle = '#fff'; x.font = "900 46px 'Vazirmatn', sans-serif"; x.textAlign = 'center'; x.fillText('نوشابه', 128, 82); x.fillStyle = '#c0c0c0'; x.fillRect(0, 0, 256, 10); x.fillRect(0, 118, 256, 10); });
    L.can = { name: 'قوطی نوشابه', parts: [[g, new THREE.MeshStandardMaterial({ map: t, metalness: 0.75, roughness: 0.3 })]], rest: 0.03 }; }
  // کاغذ مچاله
  { const g = crumple(new THREE.IcosahedronGeometry(0.055, 2), 0.55, 3); L.paper = { name: 'کاغذ مچاله', parts: [[g, new THREE.MeshStandardMaterial({ color: 0xf3f0e6, roughness: 0.95 })]], rest: 0.045 }; }
  // پاکت کاغذی خرید
  { const g = crumple(new THREE.BoxGeometry(0.16, 0.22, 0.1, 4, 6, 3), 0.18, 5); g.rotateX(Math.PI / 2);
    const t = canvasTex(128, 128, (x) => { x.fillStyle = '#b5895a'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(80,50,20,${Math.random() * 0.15})`; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); } x.fillStyle = '#5a3a1a'; x.font = "700 22px 'Vazirmatn', sans-serif"; x.textAlign = 'center'; x.fillText('نانوایی', 64, 70); });
    L.bag = { name: 'پاکت کاغذی', parts: [[g, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 })]], rest: 0.05 }; }
  // جعبه پیتزا
  { const g = new RoundedBoxGeometry(0.32, 0.04, 0.32, 1, 0.006);
    const t = canvasTex(256, 256, (x) => { x.fillStyle = '#d9b98a'; x.fillRect(0, 0, 256, 256); x.strokeStyle = '#8a5a33'; x.lineWidth = 6; x.strokeRect(10, 10, 236, 236); x.fillStyle = '#c1121f'; x.beginPath(); x.arc(128, 110, 60, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = "900 40px 'Vazirmatn', sans-serif"; x.textAlign = 'center'; x.fillText('پیتزا', 128, 124); x.fillStyle = '#5a3a1a'; x.font = "700 24px 'Vazirmatn', sans-serif"; x.fillText('داغ و خوشمزه', 128, 210); x.fillStyle = 'rgba(120,70,20,0.35)'; x.beginPath(); x.arc(190, 190, 26, 0, 7); x.fill(); });
    const cm = new THREE.MeshStandardMaterial({ color: 0xc9a77a, roughness: 0.9 });
    L.pizza = { name: 'جعبه پیتزا', parts: [[g, [cm, cm, new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }), cm, cm, cm]]], rest: 0.02 }; }
  // پوست موز
  { const parts = []; const ym = new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.7 }); const bm = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.8 });
    const c = new THREE.QuadraticBezierCurve3(V(-0.08, 0.02, 0), V(0, 0.05, 0.02), V(0.08, 0.02, 0)); const g = new THREE.TubeGeometry(c, 12, 0.018, 8); parts.push([g, ym]);
    for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + 0.4; const pc = new THREE.QuadraticBezierCurve3(V(0.07, 0.025, 0), V(0.12, 0.02, Math.sin(a) * 0.05), V(0.15 + Math.cos(a) * 0.03, 0.005, Math.sin(a) * 0.09)); const pg = new THREE.TubeGeometry(pc, 8, 0.012, 6); pg.scale(1, 0.4, 1); parts.push([pg, ym]); }
    const tip = new THREE.SphereGeometry(0.012, 8, 6); tip.translate(-0.085, 0.02, 0); parts.push([tip, bm]);
    L.banana = { name: 'پوست موز', parts, rest: 0.0 }; }
  // کیسه پلاستیکی
  { const g = crumple(new THREE.SphereGeometry(0.11, 14, 10), 0.6, 9); g.scale(1, 0.45, 0.85); const h = new THREE.TorusGeometry(0.04, 0.008, 6, 14, Math.PI); h.translate(0.1, 0.02, 0); h.rotateY(0.3);
    const m = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.4, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    L.plastic = { name: 'کیسه پلاستیکی', parts: [[g, m], [h, m]], rest: 0.04 }; }
  // لیوان کاغذی قهوه
  { const g = new THREE.CylinderGeometry(0.045, 0.032, 0.12, 16, 1); g.rotateZ(Math.PI / 2); const lid = new THREE.CylinderGeometry(0.048, 0.048, 0.015, 16); lid.rotateZ(Math.PI / 2); lid.translate(0.065, 0, 0);
    const t = canvasTex(256, 64, (x) => { x.fillStyle = '#fafafa'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#6b3e1e'; x.fillRect(0, 18, 256, 28); x.fillStyle = '#fff'; x.font = "700 20px 'Vazirmatn', sans-serif"; x.textAlign = 'center'; x.fillText('کافه قهرمان ☕', 128, 39); });
    L.cup = { name: 'لیوان یک‌بار مصرف', parts: [[g, new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 })], [lid, new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.5 })]], rest: 0.04 }; }
  // پاکت چیپس
  { const g = crumple(new THREE.BoxGeometry(0.18, 0.025, 0.24, 6, 2, 6), 0.25, 11);
    const t = canvasTex(128, 128, (x) => { const gr = x.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, '#ff9f1c'); gr.addColorStop(1, '#e85d04'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); x.fillStyle = '#ffd60a'; x.beginPath(); x.arc(64, 64, 34, 0, 7); x.fill(); x.fillStyle = '#7b2c00'; x.font = "900 26px 'Vazirmatn', sans-serif"; x.textAlign = 'center'; x.fillText('چیپس', 64, 74); });
    L.chips = { name: 'پاکت چیپس', parts: [[g, new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, metalness: 0.45 })]], rest: 0.015 }; }
  TRASH = L; return L;
}
function makeTrash(kind) {
  const d = trashLib()[kind]; const g = new THREE.Group(); g.scale.setScalar(1.35);
  for (const [geo, m] of d.parts) { const me = new THREE.Mesh(geo, m); me.castShadow = true; g.add(me); }
  return { mesh: g, name: d.name, rest: d.rest, kind };
}

// سطل زباله چرخ‌دار واقعی با درب لولادار، دسته، چرخ‌ها و برچسب بازیافت
function realBin(color = 0x2e7d32, label = 'زباله') {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.8 });
  const shape = new THREE.Shape(); shape.moveTo(-0.3, 0); shape.lineTo(0.3, 0); shape.lineTo(0.35, 0.98); shape.lineTo(-0.35, 0.98); shape.lineTo(-0.3, 0);
  const sides = new THREE.CylinderGeometry(0.42, 0.33, 0.98, 4, 3, true); sides.rotateY(Math.PI / 4); sides.scale(1, 1, 1.18); sides.translate(0, 0.56, 0);
  const bm = new THREE.Mesh(sides, new THREE.MeshStandardMaterial({ color, roughness: 0.55, side: THREE.DoubleSide })); bm.castShadow = true; g.add(bm);
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.55), body); bottom.position.y = 0.08; g.add(bottom);
  for (let k = 0; k < 4; k++) { const rib = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.85, 0.05), body); rib.position.set(-0.25 + k * 0.166, 0.55, 0.405); rib.rotation.x = -0.05; g.add(rib); }
  // لبه بالایی به شکل قاب (نه صفحه پر) تا داخل سطل دیده شود
  for (const z of [-0.39, 0.39]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.05), body); r.position.set(0, 1.04, z); g.add(r); }
  for (const x of [-0.34, 0.34]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.82), body); r.position.set(x, 1.04, 0); g.add(r); }
  const liner = new THREE.CylinderGeometry(0.4, 0.31, 0.92, 4, 1, true); liner.rotateY(Math.PI / 4); liner.scale(1, 1, 1.18); liner.translate(0, 0.58, 0);
  g.add(new THREE.Mesh(liner, new THREE.MeshStandardMaterial({ color: 0x4d4d4d, roughness: 0.85, side: THREE.DoubleSide })));
  const floor = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.03, 0.54), new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.9 })); floor.position.y = 0.12; g.add(floor);
  for (const x of [-0.28, 0.28]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 18), dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.1, -0.36); g.add(w); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.065, 10), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.6, roughness: 0.4 })); hub.rotation.z = Math.PI / 2; hub.position.copy(w.position); g.add(hub); }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 8), dark); axle.rotation.z = Math.PI / 2; axle.position.set(0, 0.1, -0.36); g.add(axle);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.58, 10), dark); handle.rotation.z = Math.PI / 2; handle.position.set(0, 1.02, -0.47); g.add(handle);
  const lt = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.beginPath(); x.arc(128, 110, 70, 0, 7); x.fill(); x.fillStyle = '#' + new THREE.Color(color).getHexString(); x.font = "900 90px sans-serif"; x.textAlign = 'center'; x.fillText('♻', 128, 140); x.fillStyle = '#fff'; x.font = "900 40px 'Vazirmatn', sans-serif"; x.fillText(label, 128, 230); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshStandardMaterial({ map: lt, transparent: true, roughness: 0.6 })); lab.position.set(0, 0.62, 0.43); lab.rotation.x = -0.05; g.add(lab);
  const lid = new THREE.Group(); lid.position.set(0, 1.06, -0.42); g.add(lid);
  const lm = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.06, 0.86, 2, 0.02), body); lm.position.set(0, 0.03, 0.42); lm.castShadow = true; lid.add(lm);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.05), body); lip.position.set(0, 0.0, 0.85); lid.add(lip);
  return { group: g, lid };
}

// ---------------- مدیریت ماموریت‌ها ----------------
export class Missions {
  constructor(game) {
    this.g = game; this.active = null; this.offerData = null; this.rng = mulberry32((Date.now() & 0xfff) + 3);
    const S = game.app.save.data.settings; this.enabled = S.missions !== false; this.every = (S.missionEvery || 10) * 60;
    this.timer = 30; this.bins = [];
  }
  start() { if (this.enabled) this.g.toast(`ماموریت‌ها روشن‌اند: هر ${toFa(this.every / 60)} دقیقه یک ماموریت جدید می‌گیری`); }
  difficulty() {
    const lv = this.g.app.save.data.maxStage; const base = Math.floor(lv / 220);
    return clamp(1 + base + Math.floor(this.rng() * 3), 1, 5);
  }
  makeOffer(force) {
    const r = this.rng(); const kind = force || (r < 0.5 ? (this.rng() < 0.5 ? 'choke' : 'fire') : 'trash');
    const d = this.difficulty();
    const reward = Math.round(({ choke: 60, fire: 90, trash: 50 }[kind]) * [1, 1.9, 3.2, 5, 7.5][d - 1] / 5) * 5;
    const limit = { choke: [170, 145, 120, 100, 85], fire: [220, 190, 165, 145, 125], trash: [260, 280, 300, 320, 330] }[kind][d - 1];
    const info = {
      choke: { title: '🚑 نجات از خفگی', desc: 'یک نفر در خانه‌اش غذا در گلویش گیر کرده و نمی‌تواند نفس بکشد! سریع برو و با مانور هایملیخ نجاتش بده.' },
      fire: { title: '🔥 خانه آتش گرفته!', desc: 'یک خانه در آتش می‌سوزد و آدم‌هایی داخلش گیر افتاده‌اند. وارد شو، آن‌ها را بلند کن و به جای امن ببر. مراقب شعله‌ها باش!' },
      trash: { title: '🧹 پاکسازی محله', desc: 'یک جای شهر پر از آشغال شده. آشغال‌ها را یکی‌یکی بردار و داخل سطل زباله بینداز.' }
    }[kind];
    this.offerData = { kind, diff: d, diffName: DIFF[d - 1], reward, limit, t: 25, ...info };
    this.g.app.cityHud?.offer(this.offerData); this.g.sfx('mission');
  }
  accept() {
    const o = this.offerData; if (!o) return; this.offerData = null; this.g.app.cityHud?.offer(null);
    const M = o.kind === 'choke' ? ChokeMission : o.kind === 'fire' ? FireMission : TrashMission;
    this.active = new M(this, o); this.active.title = o.title; this.active.limit = o.limit; this.active.timeLeft = o.limit; this.active.reward = o.reward; this.active.diff = o.diff;
    if (!this.active.start()) { this.active = null; this.timer = 10; return; }
    this.g.toast('ماموریت شروع شد! دنبال نشانگر زرد برو');
  }
  decline() { if (!this.offerData) return; this.offerData = null; this.g.app.cityHud?.offer(null); this.timer = this.every; this.g.toast('ماموریت رد شد؛ ماموریت بعدی بعداً می‌آید'); }
  // فعالیت‌های اختیاری (مثل مسابقه خیابانی) از همین سیستم استفاده می‌کنند
  startActivity(act) { if (this.active || this.offerData) return false; this.active = act; if (!act.start()) { this.active = null; return false; } return true; }
  complete() {
    const m = this.active; const S = this.g.app.save.data;
    S.coins += m.reward; if (!m.activity) S.stats.missions = (S.stats.missions || 0) + 1; this.g.app.save.save(); this.g.app.refreshMenu();
    if (!m.activity) { this.g.ach?.unlock('mission1'); if (S.stats.missions >= 5) this.g.ach?.unlock('mission5'); this.g.ach?.unlock(m instanceof ChokeMission ? 'choke' : m instanceof FireMission ? 'fire' : 'clean'); }
    this.g.effects?.confettiBurst(this.g.playerWorldPos(new THREE.Vector3()), 260);
    this.g.app.cityHud?.big('ماموریت انجام شد! 🎉', '+' + fmtNum(m.reward) + ' سکه'); this.g.sfx('coin'); this.g.sfx('mission');
    m.cleanup(); this.active = null; if (!m.activity) this.timer = this.every;
  }
  fail(reason) {
    const m = this.active; this.g.app.cityHud?.big('ماموریت ناموفق شد', reason || 'زمان تمام شد'); this.g.sfx('fail');
    m.cleanup(); this.active = null; if (!m.activity) this.timer = this.every;
  }
  cleanup() { this.active?.cleanup(); this.active = null; this.g.app.cityHud?.offer(null); }
  update(dt) {
    if (!this.active && !this.offerData && this.enabled) { this.timer -= dt; if (this.timer <= 0) this.makeOffer(); }
    if (this.offerData) { this.offerData.t -= dt; if (this.offerData.t <= 0) { this.offerData = null; this.g.app.cityHud?.offer(null); this.timer = this.every; } }
    const m = this.active; if (!m) return;
    m.timeLeft -= dt; m.update(dt);
    if (this.active && m.timeLeft <= 0 && !m.finishing) this.fail(m.failText || 'زمان تمام شد');
  }
  prompt() { return this.active?.prompt?.() || null; }
  stepPlayer(dt, input) { this.active?.stepPlayer?.(dt, input); }
  onBinned(item, bin) { this.active?.onBinned?.(item, bin); }
  onDropped(item) { this.active?.onDropped?.(item); }
  pickHouse(minD = 70, maxD = 380) {
    const g = this.g; const p = g.playerWorldPos(new THREE.Vector3());
    const list = g.world.houses.filter((h) => { const d = Math.hypot(h.cx - p.x, h.cz - p.z); return d > minD && d < maxD && !h.busy; });
    const arr = list.length ? list : g.world.houses; return arr[(this.rng() * arr.length) | 0];
  }
}

function freeHuman(h) { h.root.parent?.remove(h.root); h.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.material.userData?.vpbr) o.material.dispose?.(); }); }
// کارهای زمان‌دار یک ماموریت فقط وقتی اجرا می‌شوند که همان ماموریت هنوز فعال باشد
function alive(m) { return m.M.active === m && !m.ended; }
function makeVictim(rng, detail = 'hi') {
  const h = buildHuman({ detail, skin: SKINS[(rng() * SKINS.length) | 0], shirt: SHIRTS[(rng() * SHIRTS.length) | 0], pants: [0x223344, 0x4a3b2a, 0x1a1a1a, 0x5a6b7a][(rng() * 4) | 0], hair: [0x2a1a10, 0x111111, 0x6b4a2a, 0x9a9a9a][(rng() * 4) | 0], hairStyle: rng() < 0.4 ? 'long' : 'short' });
  return h;
}

// ---------------- ماموریت خفگی ----------------
class ChokeMission {
  constructor(M, o) { this.M = M; this.g = M.g; this.o = o; this.state = 'choking'; this.t = 0; this.thrusts = 0; this.need = 2 + o.diff; this.pulse = 9; this.coughT = 0; this.gaspT = 0; }
  start() {
    const g = this.g; const h = this.M.pickHouse(); if (!h) return false;
    this.house = h; h.busy = true; h.lockInterior = true; g.world.buildInterior(h);
    this.v = makeVictim(this.M.rng); g.scene.add(this.v.root);
    this.vpos = h.toWorld(-1.6, 0.3, 2.6); this.vpos.y = 0.45; this.vyaw = h.rot + Math.PI * 0.85;
    this.v.root.position.copy(this.vpos); this.v.root.rotation.y = this.vyaw;
    this.food = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc89b5a, roughness: 0.8 }));
    return true;
  }
  objective() { return this.state === 'choking' ? (this.g.inside?.h === this.house ? 'پشت مصدوم برو و دکمه تعامل را بزن' : 'سریع به خانه مصدوم برو (نشانگر زرد)') : this.state === 'heimlich' ? 'پشت سر هم دکمه تعامل را بزن تا غذا بیرون بیاید!' : 'مصدوم دارد سرفه می‌کند و نفسش برمی‌گردد...'; }
  progress() { return this.state === 'heimlich' ? `فشار: ${toFa(this.thrusts)} از ${toFa(this.need)}` : this.state === 'choking' ? 'سختی: ' + DIFF[this.o.diff - 1] : 'نجات یافت ✓'; }
  target() { const g = this.g; return g.inside?.h === this.house || this.state !== 'choking' ? this.vpos : this.house.front; }
  get usesHealth() { return false; }
  prompt() {
    const g = this.g; if (g.state !== 'foot' && g.state !== 'mission') return null;
    const d = g.p.pos.distanceTo(this.vpos);
    if (this.state === 'choking' && d < 1.7) return { label: 'نجات با مانور هایملیخ 🫁 (پشت مصدوم و فشار به شکم)', act: () => this.beginHeimlich(), pri: 2 };
    if (this.state === 'heimlich') return { label: `فشار محکم به شکم! 💪 (${toFa(this.thrusts)}/${toFa(this.need)})`, act: () => this.thrust(), pri: 2 };
    return null;
  }
  beginHeimlich() {
    const g = this.g; this.state = 'heimlich'; g.state = 'mission';
    const f = new THREE.Vector3(Math.sin(this.vyaw), 0, Math.cos(this.vyaw));
    g.p.pos.copy(this.vpos).addScaledVector(f, -0.32); g.p.yaw = this.vyaw; g.p.vel.set(0, 0, 0);
    g.say('کمک...! نمی‌تونم نفس بکشم!', this.v.j.head); g.toast('دست‌هایت را دور شکمش حلقه کردی؛ حالا محکم فشار بده!');
  }
  thrust() { if (this.state !== 'heimlich' || this.expelQ || this.pulse < 0.3) return; this.pulse = 0; this.thrusts++; this.g.sfx('gasp'); if (this.thrusts >= this.need) { this.expelQ = true; this.g.timers.push({ t: 0.25, fn: () => { if (alive(this)) this.expel(); } }); } }
  expel() {
    const g = this.g; this.state = 'cough'; this.t = 0; this.finishing = true;
    const mouth = new THREE.Vector3(); this.v.j.head.localToWorld(mouth.set(0, 0.05, 0.12));
    this.food.position.copy(mouth); g.scene.add(this.food);
    const f = new THREE.Vector3(Math.sin(this.vyaw), 0, Math.cos(this.vyaw));
    g.projectiles.push({ mesh: this.food, p0: mouth.clone(), p1: mouth.clone().addScaledVector(f, 1.4).setY(0.47), h: 0.35, t: 0, dur: 0.55, spin: 10 });
    g.sfx('cough'); g.say('اوهو! اوهو!', this.v.j.head);
    g.state = 'foot'; g.toast('غذا بیرون پرید! 👏 مصدوم دارد سرفه می‌کند');
  }
  stepPlayer(dt) {
    const g = this.g; const H = g.human; this.pulse += dt;
    H.root.position.copy(g.p.pos); H.root.rotation.set(0, g.p.yaw, 0);
    H.anim('heimlich', Math.min(this.pulse, 0.449));
  }
  update(dt) {
    this.t += dt; const v = this.v; const g = this.g;
    const near = g.p.pos.distanceTo(this.vpos) < 18;
    if (this.state === 'choking' || this.state === 'heimlich') {
      v.root.position.copy(this.vpos); v.root.rotation.y = this.vyaw;
      v.anim('choke', this.t);
      if (this.state === 'heimlich') { const th = Math.max(0, Math.sin(Math.min(this.pulse, 0.449) * 7)) ** 3; const f = new THREE.Vector3(Math.sin(this.vyaw), 0, Math.cos(this.vyaw)); v.root.position.addScaledVector(f, th * 0.05).y += th * 0.04; v.j.spine.rotation.x += th * 0.35; v.j.head.rotation.x += th * 0.3; }
      this.gaspT -= dt; if (near && this.gaspT <= 0) { this.gaspT = 1.6 + Math.random(); g.sfx('gasp'); if (this.state === 'choking') g.say(['کمک!... خ... خ...', '(دست‌هایش روی گلویش است)', 'نفسم... بالا نمیاد!'][(Math.random() * 3) | 0], v.j.head); }
    } else if (this.state === 'cough') {
      v.anim('cough', this.t); this.coughT -= dt;
      if (this.coughT <= 0) { this.coughT = 0.55 + Math.random() * 0.35; g.sfx('cough'); }
      if (this.t > 5) { this.state = 'thanks'; this.t = 0; g.say('خیلی ممنونم! جانم را نجات دادی 🙏', v.j.head); }
    } else if (this.state === 'thanks') {
      v.anim('wave', this.t); const a = Math.atan2(g.p.pos.x - this.vpos.x, g.p.pos.z - this.vpos.z); v.root.rotation.y += wrapAngle(a - v.root.rotation.y) * Math.min(1, dt * 4);
      if (this.t > 2.8 && !this.done) { this.done = true; this.handed = true; g.chat?.addFriend(v, { kind: 'choke', pos: this.vpos, yaw: v.root.rotation.y }); this.M.complete(); }
    }
    if (this.state !== 'heimlich') v.blend(dt, 10);
  }
  cleanup() {
    const g = this.g; this.ended = true; if (!this.handed) freeHuman(this.v); g.scene.remove(this.food); this.food.geometry.dispose(); g.say('');
    if (g.state === 'act' && g.actS) { g.actS.opts.mid = null; g.actS.opts.after = null; }
    if (!g.world.lru?.includes(this.house)) (g.world.lru = g.world.lru || []).push(this.house);
    this.house.busy = false; this.house.lockInterior = false; if (g.state === 'mission') g.state = 'foot';
  }
}

// ---------------- ماموریت آتش‌سوزی ----------------
class FireMission {
  constructor(M, o) { this.M = M; this.g = M.g; this.o = o; this.t = 0; this.victims = []; this.flames = []; this.inner = []; this.k = 0.55; this.coughT = 0; this.helpT = 0; }
  get usesHealth() { return true; }
  start() {
    const g = this.g; const h = this.M.pickHouse(); if (!h) return false;
    this.house = h; h.busy = true; h.lockInterior = true; g.world.buildInterior(h); g.health = 100;
    const F = g.fire; const W = (x, y, z) => h.toWorld(x, y, z);
    const add = (p, w, hh, k = 1, inner = false) => { const id = F.add(p, w, hh, k); this.flames.push(id); if (inner) this.inner.push({ id, pos: p.clone(), r: w * 0.55 }); return id; };
    // شعله از پنجره‌ها و در
    for (const [x, z] of [[2.0, 5.12], [4.1, 5.12], [-3.9, -5.12], [-0.5, -5.12], [3.0, -5.12], [4.7, -5.12]]) add(W(x, 1.25, z), 1.3, 2.4, 0.9);
    for (const [x, z] of [[-6.12, -2.9], [-6.12, 2.3], [6.12, 2.9], [6.12, -2.3]]) add(W(x, 1.25, z), 1.2, 2.2, 0.85);
    // شعله روی سقف
    for (const x of [-4.2, -1.4, 1.4, 4.2]) add(W(x, 4.3, 0), 2.6, 3.6 + Math.random(), 1);
    for (const x of [-3, 0, 3]) for (const z of [-2.8, 2.8]) add(W(x, 3.6, z), 2.0, 2.6, 0.8);
    // شعله داخل خانه (بسته به سختی)
    const inside = [[5.0, 4.2], [-5.0, 0.9], [-5.1, -1.4], [4.6, 0.7], [-1.0, -4.3], [2.0, 4.3], [-4.5, 4.2]];
    for (let k = 0; k < 2 + this.o.diff; k++) { const [x, z] = inside[k]; add(W(x, 0.3, z), 0.95, 1.7, 1, true); }
    // آدم‌های گیرافتاده
    const n = this.o.diff <= 2 ? 1 : this.o.diff <= 4 ? 2 : 3;
    const spots = [[-3.0, -2.2, 0.4], [3.4, -2.6, 2.2], [3.0, 1.4, -2.6]];
    for (let k = 0; k < n; k++) {
      const [x, z, ry] = spots[k]; const v = makeVictim(this.M.rng, k === 0 ? 'hi' : 'mid'); const pos = W(x, 0.3, z); pos.y = 0.45;
      v.root.position.copy(pos); v.root.rotation.y = h.rot + ry; g.scene.add(v.root);
      this.victims.push({ h: v, pos, home: pos.clone(), yaw: h.rot + ry, state: 'trapped', t: Math.random() * 5 });
    }
    this.safe = h.safe.clone();
    return true;
  }
  objective() {
    const g = this.g;
    if (g.carrying) return 'مصدوم را از خانه بیرون ببر و به دایره امن جلوی حیاط برسان';
    const left = this.victims.filter((v) => v.state === 'trapped').length;
    if (!left) return 'همه نجات پیدا کردند! آتش‌نشانی دارد آتش را خاموش می‌کند 🚒';
    return g.inside?.h === this.house ? 'آدم‌های گیرافتاده را پیدا کن (صدای کمک‌خواهی را دنبال کن)' : 'به خانه آتش‌گرفته برو و وارد شو (نشانگر زرد)';
  }
  progress() { const s = this.victims.filter((v) => v.state === 'saved' || v.state === 'ok').length; return `نجات: ${toFa(s)} از ${toFa(this.victims.length)}`; }
  target() {
    const g = this.g; if (g.carrying) return this.safe;
    const tv = this.victims.filter((v) => v.state === 'trapped'); if (!tv.length) return null;
    if (g.inside?.h !== this.house) return this.house.front;
    let best = tv[0], bd = 1e9; for (const v of tv) { const d = v.pos.distanceTo(g.p.pos); if (d < bd) { bd = d; best = v; } } return best.pos;
  }
  prompt() {
    const g = this.g; if (g.state !== 'foot' || g.carrying) return null;
    for (const v of this.victims) if (v.state === 'trapped' && v.pos.distanceTo(g.p.pos) < 1.6) return { label: 'بلند کردن و نجات دادن مصدوم 🧑‍🚒', act: () => this.pick(v), pri: 2 };
    return null;
  }
  pick(v) {
    const g = this.g; v.state = 'lifting';
    g.act('pickup', 1.0, { mid: () => { if (!alive(this) || v.state !== 'lifting') return; v.state = 'carried'; g.carrying = v; g.human.root.add(v.h.root); v.h.root.position.set(-0.16, 1.6, 0.92); v.h.root.quaternion.setFromAxisAngle(V(1, 0, 0), -Math.PI / 2).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI)); g.toast('مصدوم را روی شانه‌ات گذاشتی؛ سریع بیرون برو!'); } });
    g.say('');
  }
  drop(v) {
    const g = this.g; g.carrying = null; g.scene.attach(v.h.root);
    const p = this.safe.clone().add(V((Math.random() - 0.5) * 2.2, 0, (Math.random() - 0.5) * 1.2)); p.y = g.world.groundAt(p.x, p.z);
    v.pos.copy(p); v.state = 'saved'; v.t = 0; v.h.root.position.copy(p).add(V(0, 0.14, 0));
    v.h.root.quaternion.setFromAxisAngle(V(0, 1, 0), this.house.rot).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2));
    g.toast('آفرین! مصدوم را به جای امن رساندی 💪'); g.sfx('mission');
    if (!this.victims.some((x) => x.state === 'trapped' || x.state === 'carried' || x.state === 'lifting')) { this.ending = 0; this.finishing = true; g.toast('همه نجات پیدا کردند! ماشین آتش‌نشانی دارد می‌رسد 🚒'); g.extras.push(new FireTruck(g, this.house)); }
  }
  update(dt) {
    const g = this.g; this.t += dt;
    // شدت آتش: آرام بیشتر می‌شود و در پایان خاموش می‌شود
    if (this.ending !== undefined) { this.ending += dt; this.k = Math.max(0, 1 - Math.max(0, this.ending - 4) / 6); if (this.ending > 10.5 && !this.done) { this.done = true; for (const v of this.victims) if (v.state === 'saved' || v.state === 'ok') { v.handed = true; g.chat?.addFriend(v.h, { kind: 'fire', pos: v.pos.clone().setY(g.world.groundAt(v.pos.x, v.pos.z)), yaw: this.house.rot }); } this.M.complete(); return; } }
    else this.k = Math.min(1.15, 0.55 + this.t * 0.012);
    g.fire.setGroupIntensity(this.flames, this.k * (0.9 + Math.sin(this.t * 3) * 0.05));
    // صدای آتش
    const d = g.playerWorldPos(new THREE.Vector3()).distanceTo(this.house.center);
    g.app.audio.setFire(clamp(1 - d / 45, 0, 1) * this.k);
    // آسیب گرما و دود
    if (g.state !== 'drive' && this.k > 0.2) {
      let dmg = 0; for (const f of this.inner) { const dd = Math.hypot(f.pos.x - g.p.pos.x, f.pos.z - g.p.pos.z); if (dd < f.r + 0.55) dmg += 32 * this.k; }
      if (g.inside?.h === this.house) dmg += (1.2 + this.o.diff * 0.6) * this.k;
      if (dmg > 0) { g.health -= dmg * dt; g.shake = Math.min(0.4, (g.shake || 0) + dmg * dt * 0.02); this.coughT -= dt; if (this.coughT <= 0) { this.coughT = 2.2; g.sfx('cough'); } }
      else g.health = Math.min(100, g.health + 6 * dt);
      if (g.health <= 0) this.faint();
    }
    // انیمیشن مصدوم‌ها
    for (const v of this.victims) {
      v.t += dt;
      if (v.state === 'trapped') {
        v.h.root.position.copy(v.pos);
        const ph = (v.t % 6); if (ph < 4) v.h.anim('help', v.t); else v.h.anim('cough', v.t);
        const dd = v.pos.distanceTo(g.p.pos); this.helpT -= dt;
        if (dd < 14 && this.helpT <= 0) { this.helpT = 2.4; g.say(['کمک! کمکم کنید! 🔥', 'اینجام! گیر افتادم!', 'اوهو اوهو... دود همه جا رو گرفته!'][(Math.random() * 3) | 0], v.h.j.head); g.sfx(ph < 4 ? 'scream' : 'cough'); }
        const a = Math.atan2(g.p.pos.x - v.pos.x, g.p.pos.z - v.pos.z); if (dd < 6) v.h.root.rotation.y += wrapAngle(a - v.h.root.rotation.y) * Math.min(1, dt * 3);
      } else if (v.state === 'carried') {
        v.h.anim('carried', v.t);
        if (g.p.pos.distanceTo(this.safe) < 3.2) this.drop(v);
      } else if (v.state === 'saved') {
        if (v.t < 2.2) { v.h.anim('lie', v.t, { seatY: 0.1 }); }
        else if (!v.up) { v.up = true; v.h.root.quaternion.identity(); v.h.root.position.copy(v.pos); v.h.root.rotation.y = this.house.rot; }
        else if (v.t < 7) { v.h.anim('cough', v.t); if (Math.random() < dt * 1.6) g.sfx('cough'); }
        else { v.state = 'ok'; g.say('ممنونم قهرمان! زندگی‌ام را مدیون تو هستم 🙏', v.h.j.head); }
      } else if (v.state === 'ok') v.h.anim('wave', v.t);
      if (v.state !== 'saved' || v.up) v.h.blend(dt, 10);
    }
  }
  faint() {
    const g = this.g; g.health = 60; g.app.cityHud?.fade(1, 0.4); g.toast('از گرما و دود بیهوش شدی! 😵 کمی از وقتت کم شد');
    this.timeLeft -= 15;
    const c = g.carrying; if (c) { g.carrying = null; g.scene.attach(c.h.root); c.h.root.quaternion.identity(); c.pos.copy(c.home); c.h.root.position.copy(c.home); c.h.root.rotation.y = c.yaw; c.state = 'trapped'; }
    for (const v of this.victims) if (v.state === 'lifting') { v.state = 'trapped'; v.h.root.position.copy(v.home); }
    if (g.state !== 'foot') g.standUp(true);
    g.timers.push({ t: 0.6, fn: () => { if (!alive(this)) { g.app.cityHud?.fade(0, 0.4); return; } g.p.pos.copy(this.house.safe).add(V(0, 0, 0)); g.p.pos.y = g.world.groundAt(g.p.pos.x, g.p.pos.z); g.p.vy = 0; g.camInit = false; g.app.cityHud?.fade(0, 0.8); } });
  }
  cleanup() {
    const g = this.g; this.ended = true; g.fire.clear(); g.app.audio.setFire(0); g.say('');
    if (g.state === 'act' && g.actS) { g.actS.opts.mid = null; g.actS.opts.after = null; }
    if (g.carrying) { g.carrying = null; }
    for (const v of this.victims) { if (!v.handed) freeHuman(v.h); }
    if (!g.world.lru?.includes(this.house)) (g.world.lru = g.world.lru || []).push(this.house);
    this.house.busy = false; this.house.lockInterior = false; g.health = 100;
  }
}

// ---------------- ماموریت پاکسازی آشغال ----------------
class TrashMission {
  constructor(M, o) { this.M = M; this.g = M.g; this.o = o; this.items = []; this.count = 0; this.bins = []; this.stains = []; }
  get usesHealth() { return false; }
  start() {
    const g = this.g; const W = g.world; const p = g.playerWorldPos(new THREE.Vector3());
    const spots = W.trashSpots.filter((s) => { const d = s.pos.distanceTo(p); return d > 50 && d < 420 && !(s.house && s.house.busy); });
    const spot = (spots.length ? spots : W.trashSpots)[(this.M.rng() * (spots.length || W.trashSpots.length)) | 0];
    this.spot = spot; this.center = spot.pos.clone();
    const n = [6, 9, 12, 16, 20][this.o.diff - 1]; const R = spot.big ? 11 : spot.area ? 9 : 6;
    const kinds = Object.keys(trashLib()); const rng = this.M.rng;
    let tries = 0;
    while (this.items.length < n && tries++ < n * 30) {
      const a = rng() * TAU, r = Math.sqrt(rng()) * R; const x = this.center.x + Math.cos(a) * r, z = this.center.z + Math.sin(a) * r;
      if (W.colliders.inside(x, z, 1) || W.colliders.inside(x, z, 2) && !spot.area) continue;
      const it = makeTrash(kinds[(rng() * kinds.length) | 0]);
      it.mesh.position.set(x, W.groundAt(x, z) + it.rest * 1.35, z); it.mesh.rotation.set(0, rng() * TAU, 0); it.rx = 0; it.rz = 0;
      g.scene.add(it.mesh); this.items.push(it);
    }
    if (!this.items.length) return false;
    // لکه‌های کثیفی روی زمین
    const sm = new THREE.MeshStandardMaterial({ color: 0x3b2f22, transparent: true, opacity: 0.35, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(new THREE.CircleGeometry(0.4 + rng() * 0.7, 16), sm); s.rotation.x = -Math.PI / 2; const a = rng() * TAU, r = rng() * R; s.position.set(this.center.x + Math.cos(a) * r, W.groundAt(this.center.x + Math.cos(a) * r, this.center.z + Math.sin(a) * r) + 0.012, this.center.z + Math.sin(a) * r); s.scale.set(1, 0.6 + rng() * 0.6, 1); g.scene.add(s); this.stains.push(s); }
    // دو سطل زباله واقعی کنار محل
    const colors = [[0x2e7d32, 'زباله'], [0x1d4ed8, 'بازیافت']];
    for (let k = 0; k < 2; k++) {
      let x = this.center.x + (k ? 1 : -1) * (R + 1.2), z = this.center.z + 1; for (let t = 0; t < 10 && W.colliders.inside(x, z, 1); t++) { x += (this.center.x - x) * 0.25; z += 0.5; }
      const b = realBin(colors[k][0], colors[k][1]); b.group.position.set(x, W.groundAt(x, z), z); const yaw = Math.atan2(this.center.x - x, this.center.z - z); b.group.rotation.y = yaw; g.scene.add(b.group);
      const bin = { pos: b.group.position.clone(), yaw, t: 0, open: 0, own: b, count: 0 };
      bin.col = W.colliders.circle(x, z, 0.45, 3);
      bin.inter = W.inter.add({ pos: V(x + Math.sin(yaw) * 0.6, 1, z + Math.cos(yaw) * 0.6), r: 1.9, pri: 1, label: (gm) => (gm.holding ? 'انداختن آشغال در سطل 🗑️' : 'باز کردن درب سطل زباله'), act: (gm) => gm.useBin(bin) });
      this.bins.push(bin);
    }
    this.total = this.items.length;
    return this.items.length > 0;
  }
  objective() { const g = this.g; return g.holding ? 'آشغال را ببر و داخل سطل زباله بینداز' : this.count === 0 && this.center.distanceTo(g.playerWorldPos(new THREE.Vector3())) > 25 ? 'به محل کثیف برو (نشانگر زرد)' : 'آشغال‌های روی زمین را یکی‌یکی بردار'; }
  progress() { return `جمع شده: ${toFa(this.count)} از ${toFa(this.total)}`; }
  target() {
    const g = this.g; const p = g.playerWorldPos(new THREE.Vector3());
    if (g.holding) { let best = null, bd = 1e9; for (const b of [...this.bins, ...g.world.bins]) { const d = b.pos.distanceToSquared(p); if (d < bd) { bd = d; best = b; } } return best.pos.clone().setY(1.2); }
    if (this.center.distanceTo(p) > 25) return this.center;
    let best = null, bd = 1e9; for (const it of this.items) { if (it.held) continue; const d = it.mesh.position.distanceToSquared(p); if (d < bd) { bd = d; best = it; } } return best ? best.mesh.position : this.center;
  }
  prompt() {
    const g = this.g; if (g.state !== 'foot' || g.holding || g.carrying) return null;
    let best = null, bd = 1.35; for (const it of this.items) { if (it.held) continue; const d = Math.hypot(it.mesh.position.x - g.p.pos.x, it.mesh.position.z - g.p.pos.z); if (d < bd) { bd = d; best = it; } }
    if (best) return { label: 'برداشتن ' + best.name + ' 🫳', act: () => this.pick(best), pri: 2 };
    return null;
  }
  pick(it) {
    const g = this.g; it.held = true;
    const a = Math.atan2(it.mesh.position.x - g.p.pos.x, it.mesh.position.z - g.p.pos.z); g.p.yaw = a;
    g.act('pickup', 1.1, { mid: () => { if (!alive(this)) return; g.human.j.wristR.add(it.mesh); it.mesh.position.set(0, -0.12, 0.03); it.mesh.rotation.set(0.3, 0, 0.2); g.holding = it; g.sfx('pickup'); } });
  }
  onDropped(it) { it.held = false; }
  onBinned(it, bin) {
    if (!this.items.includes(it)) return;
    this.count++; const i = this.items.indexOf(it); if (i >= 0) this.items.splice(i, 1);
    this.g.toast(this.count < this.total ? `آفرین! ${toFa(this.count)} از ${toFa(this.total)} آشغال داخل سطل رفت 🗑️` : 'همه آشغال‌ها جمع شد! محله تمیز شد ✨');
    if (this.count >= this.total && !this.done) { this.done = true; this.finishing = true; this.g.burstSparkle(this.center.clone().setY(1)); this.g.timers.push({ t: 1.2, fn: () => this.M.complete() }); }
  }
  update(dt) {
    // انیمیشن درب سطل‌های ماموریت
    for (const b of this.bins) {
      if (b.t > 0) b.t -= dt;
      const target = b.t > 0 ? -1.95 : 0; const before = b.open;
      b.open += (target - b.open) * Math.min(1, dt * 9); b.own.lid.rotation.x = b.open;
      if (before < -0.3 && b.open >= -0.3 && target === 0) this.g.sfx('lid');
    }
    // پرواز آرام کیسه‌ها با باد
    for (const it of this.items) if (!it.held && it.kind === 'plastic') { it.mesh.rotation.y += Math.sin(this.g.t * 0.8 + it.mesh.position.x) * dt * 0.3; }
  }
  cleanup() {
    const g = this.g; this.ended = true;
    if (g.state === 'act' && g.actS) { g.actS.opts.mid = null; g.actS.opts.after = null; }
    for (const it of this.items) it.mesh.parent?.remove(it.mesh);
    if (g.holding) { g.holding.mesh.parent?.remove(g.holding.mesh); g.holding = null; }
    for (const s of this.stains) { g.scene.remove(s); s.geometry.dispose(); }
    if (this.stains[0]) this.stains[0].material.dispose();
    for (const b of this.bins) { g.scene.remove(b.own.group); g.world.colliders.remove(b.col); g.world.inter.remove(b.inter); b.own.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } }); }
  }
}

// ---------- مسابقه خیابانی: عبور از حلقه‌های آتشین در خیابان‌های شهر ----------
export class StreetRace {
  constructor(M, startNode) { this.M = M; this.g = M.g; this.activity = true; this.start0 = startNode; this.i = 0; this.rings = []; this.t = 0; }
  start() {
    const g = this.g; const L = g.world.lane; const rng = this.M.rng;
    let n = this.start0, prev = null; const pts = [];
    for (let k = 0; k < 9; k++) { const outs = n.out.filter((e) => e.b !== prev && !pts.includes(e.b)); const e = outs.length ? outs[(rng() * outs.length) | 0] : n.out[0]; prev = n; n = e.b; pts.push(n); }
    const geo = new THREE.TorusGeometry(5.2, 0.32, 10, 40);
    pts.forEach((p, k) => {
      const nx = k + 1 < pts.length ? pts[k + 1] : p; const from = k ? pts[k - 1] : this.start0;
      const yaw = Math.atan2(p.x - from.x, p.z - from.z);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: k === pts.length - 1 ? 0x2fd27a : 0xff8a00, toneMapped: false, transparent: true, opacity: 0.85 }));
      m.position.set(p.x, 5.4, p.z); m.rotation.y = yaw; g.scene.add(m); this.rings.push({ m, p: new THREE.Vector3(p.x, 0, p.z) });
      void nx;
    });
    this.title = '🏁 مسابقه خیابانی'; this.limit = 25 + pts.length * 11; this.timeLeft = this.limit; this.reward = 0; this.diff = 3;
    g.toast('۳... ۲... ۱... برو! از حلقه‌ها عبور کن 🏁'); g.sfx('mission');
    return true;
  }
  objective() { return this.g.state === 'drive' ? 'با ماشین از وسط حلقه‌های نارنجی رد شو!' : 'سوار ماشین شو و از حلقه‌ها رد شو'; }
  progress() { return `حلقه ${toFa(this.i)} از ${toFa(this.rings.length)}`; }
  target() { const r = this.rings[this.i]; return r ? r.p : null; }
  get usesHealth() { return false; }
  update(dt) {
    const g = this.g; this.t += dt;
    this.rings.forEach((r, k) => { r.m.visible = k >= this.i && k < this.i + 3; r.m.material.opacity = k === this.i ? 0.95 : 0.35; r.m.scale.setScalar(k === this.i ? 1 + Math.sin(this.t * 6) * 0.04 : 0.9); });
    const r = this.rings[this.i]; const v = g.veh;
    if (r && v && Math.hypot(v.pos.x - r.p.x, v.pos.z - r.p.z) < 6.5) {
      this.i++; g.sfx('coin'); g.burstSparkle(r.p.clone().setY(3));
      if (this.i >= this.rings.length && !this.done) { this.done = true; this.finishing = true; const bonus = Math.round(this.timeLeft * 1.5); this.reward = 40 + bonus; const S = g.app.save.data; const tm = this.limit - this.timeLeft; const best = S.stats.streetBest; if (!best || tm < best) { S.stats.streetBest = tm; g.toast(`رکورد جدید! ${toFa(tm.toFixed(1))} ثانیه 🏆`); } g.ach?.unlock('street'); this.M.complete(); }
      else g.toast(`حلقه ${toFa(this.i)} از ${toFa(this.rings.length)} ✓`);
    }
  }
  cleanup() { for (const r of this.rings) { this.g.scene.remove(r.m); } }
}
