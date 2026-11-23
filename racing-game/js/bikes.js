// موتورسیکلت‌ها: فهرست و سازنده مدل سه‌بعدی با موتورسوار، دوشاخ و فرمان متحرک و کج شدن در پیچ
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, mergeGeos, optimizeStatic, fillAttr, vertexPBRMaterial } from './utils.js';
import { buildHuman, patternMaterial, reachIK } from './human.js';
import * as T from './textures.js';

export const BIKES = [
  { id: 'b1', name: 'اسکوتر نسیم', style: 'scooter', top: 150, acc: 6.2, grip: 0.95, brake: 9, color: '#3fb7a6', class: 'اسکوتر' },
  { id: 'b2', name: 'کلاسیک ۶۵', style: 'cafe', top: 205, acc: 7.2, grip: 1.0, brake: 10, color: '#1f3d7a', class: 'کلاسیک' },
  { id: 'b3', name: 'چاپر طوفان', style: 'chopper', top: 215, acc: 7.0, grip: 0.98, brake: 9.5, color: '#111114', class: 'چاپر' },
  { id: 'b4', name: 'تریل کوهستان', style: 'dirt', top: 195, acc: 8.0, grip: 1.08, brake: 10, color: '#ff7a00', class: 'تریل' },
  { id: 'b5', name: 'کروزر جاده', style: 'cruiser', top: 230, acc: 7.4, grip: 1.02, brake: 10.5, color: '#7a0f16', class: 'کروزر' },
  { id: 'b6', name: 'تورینگ کاروان', style: 'touring', top: 240, acc: 7.6, grip: 1.05, brake: 11, color: '#c9ccd4', class: 'تورینگ' },
  { id: 'b7', name: 'نیکد شیر', style: 'naked', top: 260, acc: 8.8, grip: 1.12, brake: 11.5, color: '#f5c400', class: 'نیکد' },
  { id: 'b8', name: 'اسپرت آذرخش', style: 'sport', top: 285, acc: 9.4, grip: 1.18, brake: 12, color: '#d40f1f', class: 'اسپرت' },
  { id: 'b9', name: 'سوپربایک شهاب', style: 'sport', top: 310, acc: 10.0, grip: 1.25, brake: 12.6, color: '#0b5bd3', class: 'سوپربایک' },
  { id: 'b10', name: 'رخش سیاه', style: 'naked', top: 325, acc: 10.6, grip: 1.3, brake: 13, color: '#1a1a1f', class: 'هایپرنیکد' },
  { id: 'b11', name: 'سیمرغ جی‌پی', style: 'gp', top: 345, acc: 11.2, grip: 1.38, brake: 13.6, color: '#00b3a7', class: 'مسابقه‌ای' },
  { id: 'b12', name: 'افسانه نور', style: 'gp', top: 365, acc: 11.8, grip: 1.45, brake: 14, color: '#ffbf00', class: 'افسانه‌ای' }
];
export const bikeById = (id) => BIKES.find((b) => b.id === id) || BIKES[0];
export function bikeStats(b) { return { vmax: b.top / 3.6, acc: b.acc, grip: b.grip, brake: b.brake, nitro: 4 }; }
export function bikeLooks(b) { return 8 + BIKES.indexOf(b) * 1.4; }

function shape(style) {
  const S = {
    scooter: { wb: 1.32, wrF: 0.25, wrR: 0.25, twF: 0.11, twR: 0.12, rake: 0.42, headY: 0.92, barY: 1.06, barW: 0.66, seatY: 0.8, seatZ: -0.28, lean: 0.05, fairing: 'scooter', spoked: false, chrome: false, tank: 'none' },
    cafe: { wb: 1.42, wrF: 0.32, wrR: 0.32, twF: 0.1, twR: 0.13, rake: 0.45, headY: 0.98, barY: 0.94, barW: 0.62, seatY: 0.82, seatZ: -0.32, lean: 0.45, fairing: 'none', spoked: true, chrome: true, tank: 'round' },
    chopper: { wb: 1.78, wrF: 0.34, wrR: 0.33, twF: 0.08, twR: 0.2, rake: 0.62, headY: 1.0, barY: 1.36, barW: 0.82, seatY: 0.68, seatZ: -0.4, lean: -0.08, fairing: 'none', spoked: true, chrome: true, tank: 'drop' },
    dirt: { wb: 1.46, wrF: 0.37, wrR: 0.35, twF: 0.09, twR: 0.13, rake: 0.47, headY: 1.12, barY: 1.2, barW: 0.82, seatY: 0.95, seatZ: -0.25, lean: 0.25, fairing: 'dirt', spoked: true, chrome: false, tank: 'slim', knobby: true },
    cruiser: { wb: 1.64, wrF: 0.33, wrR: 0.33, twF: 0.13, twR: 0.18, rake: 0.55, headY: 1.0, barY: 1.12, barW: 0.86, seatY: 0.7, seatZ: -0.35, lean: 0.0, fairing: 'none', spoked: false, chrome: true, tank: 'drop', fat: true },
    touring: { wb: 1.62, wrF: 0.33, wrR: 0.33, twF: 0.13, twR: 0.18, rake: 0.5, headY: 1.05, barY: 1.12, barW: 0.84, seatY: 0.76, seatZ: -0.32, lean: 0.05, fairing: 'touring', spoked: false, chrome: true, tank: 'drop', bags: true },
    naked: { wb: 1.43, wrF: 0.31, wrR: 0.31, twF: 0.12, twR: 0.19, rake: 0.42, headY: 1.0, barY: 1.03, barW: 0.76, seatY: 0.83, seatZ: -0.3, lean: 0.32, fairing: 'naked', spoked: false, chrome: false, tank: 'angular' },
    sport: { wb: 1.4, wrF: 0.31, wrR: 0.31, twF: 0.12, twR: 0.19, rake: 0.42, headY: 0.98, barY: 0.9, barW: 0.64, seatY: 0.84, seatZ: -0.3, lean: 0.62, fairing: 'full', spoked: false, chrome: false, tank: 'angular' },
    gp: { wb: 1.4, wrF: 0.31, wrR: 0.31, twF: 0.12, twR: 0.2, rake: 0.4, headY: 0.96, barY: 0.86, barW: 0.6, seatY: 0.86, seatZ: -0.3, lean: 0.78, fairing: 'full', spoked: false, chrome: false, tank: 'angular', wings: true }
  };
  return S[style] || S.naked;
}

const M = {};
function mats() {
  if (M.chrome) return M;
  M.chrome = new THREE.MeshStandardMaterial({ color: 0xf2f2f6, metalness: 1, roughness: 0.08 });
  M.black = new THREE.MeshStandardMaterial({ color: 0x0f0f12, metalness: 0.3, roughness: 0.5 });
  M.engine = new THREE.MeshStandardMaterial({ color: 0x55585f, metalness: 0.85, roughness: 0.35 });
  M.alu = new THREE.MeshStandardMaterial({ color: 0xc4c7cd, metalness: 0.9, roughness: 0.3 });
  M.seat = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.7 });
  M.brown = new THREE.MeshStandardMaterial({ color: 0x5a3018, roughness: 0.55 });
  M.head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d6, emissiveIntensity: 2.2, roughness: 0.1 });
  M.amber = new THREE.MeshStandardMaterial({ color: 0x663300, emissive: 0xff8a00, emissiveIntensity: 0.8 });
  M.glass = new THREE.MeshPhysicalMaterial({ color: 0x9fb8c8, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide });
  M.carbon = new THREE.MeshStandardMaterial({ map: T.carbon(), roughness: 0.35, metalness: 0.3 });
  return M;
}

// استوانه بین دو نقطه
function rod(a, b, r, seg = 10, r2 = r) {
  const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
  const g = new THREE.CylinderGeometry(r2, r, len, seg); g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate(a.x, a.y, a.z); return g;
}
function tube(points, r, seg = 24) { return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), seg, r, 8, false); }
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// چرخ موتور: یک هندسه با رنگ رأسی (لاستیک، رینگ، دیسک)
const wheelCache = new Map();
function bikeWheel(R, W, spoked, knobby, discs) {
  const key = [R, W, spoked, knobby, discs].join('_');
  if (wheelCache.has(key)) return wheelCache.get(key);
  const col = (g, hex, m, r) => { const c = new THREE.Color(hex); fillAttr(g, 'color', [c.r, c.g, c.b]); fillAttr(g, 'aMR', [m, r]); return g; };
  const parts = [];
  const rr = R - W * 0.75;
  const prof = [[rr, -W * 0.3], [R - W * 0.35, -W * 0.5], [R - W * 0.1, -W * 0.42], [R, -W * 0.18], [R + 0.004, 0], [R, W * 0.18], [R - W * 0.1, W * 0.42], [R - W * 0.35, W * 0.5], [rr, W * 0.3]];
  const tire = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32); tire.rotateZ(Math.PI / 2);
  parts.push(col(tire, 0x131316, 0, 0.9));
  if (knobby) for (let i = 0; i < 30; i++) { const b = new THREE.BoxGeometry(W * 0.9, 0.025, 0.035); b.translate(0, R + 0.008, 0); b.rotateX(i / 30 * Math.PI * 2); parts.push(col(b, 0x18181b, 0, 0.95)); }
  const rim = new THREE.TorusGeometry(rr, 0.018, 6, 36); rim.rotateY(Math.PI / 2); parts.push(col(rim, spoked ? 0xe8e8ee : 0x1d1d22, spoked ? 1 : 0.6, spoked ? 0.1 : 0.35));
  if (spoked) {
    for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; const s = rod(V((i % 2 ? 1 : -1) * 0.04, 0, 0), V(0, Math.cos(a) * rr, Math.sin(a) * rr), 0.0028, 4); parts.push(col(s, 0xe8e8ee, 1, 0.1)); }
  } else {
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const s = new THREE.BoxGeometry(0.02, rr - 0.04, 0.045); s.translate(0, (rr - 0.04) / 2 + 0.04, 0); s.rotateX(a); parts.push(col(s, 0x1d1d22, 0.6, 0.35)); }
  }
  const hub = new THREE.CylinderGeometry(0.055, 0.055, W * 0.9, 16); hub.rotateZ(Math.PI / 2); parts.push(col(hub, 0x9a9da3, 0.9, 0.3));
  for (let d = 0; d < discs; d++) { const disc = new THREE.CylinderGeometry(R * 0.62, R * 0.62, 0.008, 28); disc.rotateZ(Math.PI / 2); disc.translate((d ? -1 : 1) * W * 0.32, 0, 0); parts.push(col(disc, 0xa7aab0, 0.9, 0.3)); }
  const geo = mergeGeos(parts, ['position', 'normal', 'uv', 'color', 'aMR']);
  wheelCache.set(key, geo);
  return geo;
}

export function buildBike(def, { isPlayer = true, team = 0xff5a00, number = 7, rider = true, suit = 'fire' } = {}) {
  const m = mats();
  const s = shape(def.style);
  const root = new THREE.Group(); root.name = 'car-' + def.id;
  const body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(def.color), metalness: 0.5, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05 });
  const trim = s.chrome ? m.chrome : m.black;
  const add = (g, mat, cast = true) => { const me = new THREE.Mesh(g, mat); me.castShadow = cast; body.add(me); return me; };
  const zF = s.wb / 2, zR = -s.wb / 2;
  // محور فرمان (دوشاخ)
  const head = V(0, s.headY, zF - (s.headY - s.wrF) * Math.tan(s.rake));
  const axis = new THREE.Vector3(0, s.headY - s.wrF, head.z - zF).normalize();
  const front = new THREE.Group(); front.position.copy(head); front.userData.dynamic = true; body.add(front);
  const toF = (v) => v.clone().sub(head);
  const fadd = (g, mat) => { const me = new THREE.Mesh(g, mat); me.castShadow = true; front.add(me); return me; };
  const axle = V(0, s.wrF, zF);
  for (const x of [0.1, -0.1]) {
    const top = toF(V(x, s.headY + 0.05, head.z)), bot = toF(V(x, s.wrF + 0.02, zF));
    fadd(rod(top, top.clone().lerp(bot, 0.45), 0.024, 10), s.chrome ? m.chrome : m.alu);
    fadd(rod(top.clone().lerp(bot, 0.45), bot, 0.03, 10), s.style === 'gp' || s.style === 'sport' ? m.alu : trim);
  }
  fadd(new RoundedBoxGeometry(0.3, 0.04, 0.09, 2, 0.015).translate(0, 0.04, 0), m.alu);
  fadd(new RoundedBoxGeometry(0.28, 0.04, 0.08, 2, 0.015).translate(0, -0.12, 0.02), m.alu);
  // فرمان
  const barC = toF(V(0, s.barY, head.z - 0.06));
  const gripL = V(s.barW / 2, s.barY, head.z - (s.style === 'chopper' ? 0.18 : 0.12)), gripR = V(-s.barW / 2, gripL.y, gripL.z);
  fadd(tube([toF(gripL), barC.clone().add(V(0.15, 0, 0.02)), barC.clone().add(V(-0.15, 0, 0.02)), toF(gripR)], 0.012, 20), s.chrome ? m.chrome : m.black);
  if (s.barY > s.headY + 0.08) fadd(rod(V(0, 0.04, 0), barC, 0.016, 8), s.chrome ? m.chrome : m.black);
  for (const g of [gripL, gripR]) { const gg = new THREE.CylinderGeometry(0.019, 0.019, 0.12, 10); gg.rotateZ(Math.PI / 2); gg.translate(toF(g).x * 0.92, toF(g).y, toF(g).z); fadd(gg, m.black); }
  for (const sx of [1, -1]) { const st = toF(V(sx * (s.barW / 2 - 0.06), s.barY + 0.02, gripL.z + 0.02)); fadd(rod(st, st.clone().add(V(sx * 0.07, 0.17, 0.03)), 0.006, 6), m.black); const mm = new THREE.SphereGeometry(0.045, 12, 8); mm.scale(1.2, 0.8, 0.4); mm.translate(st.x + sx * 0.08, st.y + 0.19, st.z + 0.03); fadd(mm, m.black); }
  // صفحه کیلومتر
  const dash = new THREE.CylinderGeometry(0.06, 0.06, 0.03, 20); dash.rotateX(-1.1); dash.translate(0, toF(V(0, s.barY + 0.06, 0)).y, -0.02); fadd(dash, m.black);
  // چراغ جلو
  if (s.fairing === 'none' || s.fairing === 'naked' || s.fairing === 'dirt') {
    const hl = new THREE.SphereGeometry(s.fairing === 'dirt' ? 0.06 : 0.095, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5); hl.rotateX(Math.PI / 2); hl.translate(0, -0.06, 0.12); fadd(hl, m.head);
    const shell = new THREE.SphereGeometry(0.1, 18, 12); shell.scale(1, 1, 0.9); shell.translate(0, -0.06, 0.07); fadd(shell, s.chrome ? m.chrome : m.black);
  }
  // گلگیر جلو
  const ff = new THREE.CylinderGeometry(s.wrF + 0.04, s.wrF + 0.04, s.twF + 0.05, 20, 1, true, s.style === 'dirt' ? Math.PI * 0.2 : Math.PI * 0.12, s.style === 'dirt' ? Math.PI * 0.45 : Math.PI * 0.62); ff.rotateZ(Math.PI / 2); ff.translate(0, s.style === 'dirt' ? 0.1 : 0, 0);
  const ffm = new THREE.Mesh(ff, paint); ffm.position.copy(toF(axle)); ffm.material.side = THREE.DoubleSide; front.add(ffm);
  // چرخ جلو
  const fwRoot = new THREE.Group(); fwRoot.position.copy(toF(axle)); front.add(fwRoot);
  const fwSpin = new THREE.Group(); fwRoot.add(fwSpin);
  fwSpin.add(new THREE.Mesh(bikeWheel(s.wrF, s.twF, s.spoked, s.knobby, s.style === 'gp' || s.style === 'sport' ? 2 : 1), vertexPBRMaterial(THREE.DoubleSide)));
  // تنه، موتور، باک، زین
  const swPivot = V(0, 0.42, -0.08);
  const frameMat = s.chrome ? m.black : (s.style === 'gp' || s.style === 'sport' || s.style === 'naked' ? m.alu : m.black);
  for (const x of [0.09, -0.09]) {
    if (s.style === 'sport' || s.style === 'gp' || s.style === 'naked') add(tube([V(x * 0.6, head.y - 0.02, head.z - 0.03), V(x * 1.4, head.y - 0.12, head.z - 0.35), V(x * 1.3, 0.62, -0.02), V(x, swPivot.y, swPivot.z)], 0.035, 16), frameMat);
    else add(tube([V(x * 0.5, head.y, head.z - 0.04), V(x, head.y - 0.05, head.z - 0.45), V(x, s.seatY - 0.1, s.seatZ + 0.05), V(x, s.seatY - 0.08, s.seatZ - 0.35)], 0.022, 20), frameMat);
    add(tube([V(x * 0.4, head.y - 0.05, head.z - 0.02), V(x, 0.35, head.z - 0.25), V(x, 0.3, -0.05), V(x, swPivot.y, swPivot.z - 0.05)], 0.02, 16), frameMat);
  }
  // موتور
  const engZ = (head.z - 0.3 + swPivot.z) / 2;
  if (s.fairing !== 'scooter') {
    add(new RoundedBoxGeometry(0.32, 0.3, 0.42, 2, 0.05).translate(0, 0.4, engZ), m.engine);
    if (s.chrome || s.style === 'cruiser') {
      for (const a of [0.45, -0.45]) { for (let k = 0; k < 7; k++) { const fin = new THREE.CylinderGeometry(0.085, 0.085, 0.012, 16); fin.rotateX(a); fin.translate(0, 0.58 + k * 0.03 * Math.cos(a), engZ - Math.sin(a) * (0.08 + k * 0.03)); add(fin, m.chrome, false); } }
    } else { add(new RoundedBoxGeometry(0.28, 0.24, 0.2, 2, 0.04).translate(0, 0.6, engZ + 0.08).rotateX(0), m.engine); }
    const cover = new THREE.CylinderGeometry(0.11, 0.11, 0.05, 20); cover.rotateZ(Math.PI / 2); cover.translate(0.18, 0.38, engZ); add(cover, s.chrome ? m.chrome : m.alu);
    const cover2 = cover.clone(); cover2.translate(-0.36, 0, -0.05); add(cover2, s.chrome ? m.chrome : m.alu);
  }
  // باک
  if (s.tank === 'round' || s.tank === 'drop') { const tg = new THREE.SphereGeometry(0.2, 24, 16); tg.scale(s.tank === 'drop' ? 0.85 : 1, 0.7, s.tank === 'drop' ? 1.5 : 1.7); tg.translate(0, head.y - 0.06, head.z - 0.32); add(tg, paint); }
  else if (s.tank === 'angular') add(new RoundedBoxGeometry(0.36, 0.22, 0.5, 3, 0.08).translate(0, head.y - 0.06, head.z - 0.33).rotateX(0), paint);
  else if (s.tank === 'slim') add(new RoundedBoxGeometry(0.3, 0.16, 0.4, 2, 0.06).translate(0, head.y - 0.12, head.z - 0.3), paint);
  // زین و دم
  const seatL = s.style === 'chopper' || s.style === 'cruiser' || s.style === 'touring' ? 0.62 : 0.55;
  add(new RoundedBoxGeometry(0.3, 0.08, seatL, 3, 0.035).translate(0, s.seatY - 0.02, s.seatZ - 0.05), s.style === 'cafe' ? m.brown : m.seat);
  if (s.fairing === 'full' || s.fairing === 'naked') { const tail = new RoundedBoxGeometry(0.22, 0.14, 0.42, 3, 0.05); tail.translate(0, s.seatY + 0.04, s.seatZ - 0.36); tail.rotateX(-0.12); add(tail, paint); }
  else { const rf = new THREE.CylinderGeometry(s.wrR + 0.06, s.wrR + 0.06, s.twR + 0.06, 20, 1, true, Math.PI * 0.42, Math.PI * 0.6); rf.rotateZ(Math.PI / 2); rf.translate(0, s.wrR, zR); const rfm = add(rf, s.chrome ? m.chrome : paint); rfm.material.side = THREE.DoubleSide; }
  // اسکوتر: بدنه کامل
  if (s.fairing === 'scooter') {
    add(new RoundedBoxGeometry(0.44, 0.34, 0.75, 3, 0.15).translate(0, 0.55, -0.4), paint);
    add(new RoundedBoxGeometry(0.34, 0.06, 0.55, 2, 0.02).translate(0, 0.32, 0.12), m.black);
    add(new RoundedBoxGeometry(0.42, 0.62, 0.1, 3, 0.05).translate(0, 0.72, zF - 0.42).rotateX(0), paint);
    const hl = new THREE.CircleGeometry(0.07, 20); hl.translate(0, s.barY - 0.04, zF - 0.33); add(hl, m.head);
  }
  // دوشاخه عقب و کمک فنر
  for (const x of [0.13, -0.13]) add(rod(V(x, swPivot.y, swPivot.z), V(x, s.wrR, zR), 0.025, 8), s.style === 'gp' || s.style === 'sport' ? m.alu : m.black);
  add(rod(V(0, 0.48, -0.2), V(0, s.seatY - 0.12, s.seatZ - 0.15), 0.025, 8), m.black);
  for (let k = 0; k < 7; k++) { const sp = new THREE.TorusGeometry(0.035, 0.006, 4, 12); sp.rotateX(Math.PI / 2); sp.translate(0, lerp(0.5, s.seatY - 0.14, k / 6), lerp(-0.2, s.seatZ - 0.15, k / 6)); add(sp, new THREE.MeshStandardMaterial({ color: 0xd4191f, roughness: 0.4 }), false); }
  // اگزوز
  const exhaust = [];
  const exSide = s.style === 'sport' || s.style === 'gp' ? 0 : -1;
  if (exSide === 0) { const mf = new RoundedBoxGeometry(0.16, 0.12, 0.42, 2, 0.04); mf.translate(-0.18, 0.42, zR + 0.38); mf.rotateX(-0.25); add(mf, m.carbon); exhaust.push(V(-0.18, 0.46, zR + 0.15)); add(tube([V(0, 0.45, engZ + 0.2), V(-0.05, 0.22, engZ), V(-0.15, 0.3, swPivot.z - 0.05), V(-0.18, 0.4, zR + 0.55)], 0.03, 20), m.alu); }
  else {
    const n = s.style === 'cruiser' || s.style === 'touring' || s.style === 'chopper' ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const y = 0.32 + k * 0.1; add(tube([V(0, 0.55, engZ + 0.15), V(-0.16, y + 0.05, engZ - 0.1), V(-0.2, y, -0.4), V(-0.2, y + 0.03, zR - 0.15)], 0.03, 24), s.chrome ? m.chrome : m.alu);
      const mf = new THREE.CylinderGeometry(0.055, 0.045, 0.42, 14); mf.rotateX(Math.PI / 2 - 0.08); mf.translate(-0.2, y + 0.03, zR - 0.02); add(mf, s.chrome ? m.chrome : m.alu);
      exhaust.push(V(-0.2, y + 0.04, zR - 0.24));
    }
  }
  // فیرینگ کامل (موتور اسپرت)
  if (s.fairing === 'full' || s.fairing === 'touring') {
    const pos = [], idx = [];
    const NZ = 10, NR = 14;
    for (let i = 0; i <= NZ; i++) {
      const t = i / NZ; const z = lerp(head.z + 0.42, head.z - 0.55, t);
      const hw = lerp(0.12, 0.27, Math.sqrt(t)); const top = lerp(head.y + 0.02, head.y - 0.05, t) + (s.fairing === 'touring' ? 0.05 : 0); const bot = lerp(head.y - 0.32, 0.28, Math.min(1, t * 1.4));
      for (let k = 0; k <= NR; k++) { const a = -Math.PI * 0.05 + (k / NR) * Math.PI * 1.1; pos.push(Math.cos(a) * hw, bot + (top - bot) * (0.5 + 0.5 * Math.sin(a)), z); }
    }
    for (let i = 0; i < NZ; i++) for (let k = 0; k < NR; k++) { const a = i * (NR + 1) + k, b = a + NR + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setIndex(idx); fg.computeVertexNormals();
    const fm = add(fg, paint); fm.material.side = THREE.DoubleSide;
    const ws = new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI, 0, Math.PI * 0.5); ws.rotateX(-0.5 - (s.fairing === 'touring' ? 0 : 0.35)); ws.scale(0.9, s.fairing === 'touring' ? 1.6 : 1, 1); ws.translate(0, head.y + 0.03, head.z + 0.15); add(ws, m.glass, false).renderOrder = 2;
    for (const sx of [1, -1]) { const hl = new RoundedBoxGeometry(0.1, 0.04, 0.03, 1, 0.01); hl.rotateZ(sx * 0.3); hl.translate(sx * 0.07, head.y - 0.1, head.z + 0.42); add(hl, m.head, false); }
    if (s.wings) for (const sx of [1, -1]) add(new THREE.BoxGeometry(0.12, 0.01, 0.1).rotateZ(sx * 0.4).translate(sx * 0.26, head.y - 0.15, head.z + 0.1), m.carbon);
    const num = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), new THREE.MeshStandardMaterial({ map: T.roundel(number, '#' + new THREE.Color(team).getHexString()), roughness: 0.4 }));
    num.position.set(0, head.y - 0.12, head.z + 0.43); body.add(num);
  }
  if (s.fairing === 'dirt') { const plate = new RoundedBoxGeometry(0.24, 0.2, 0.03, 2, 0.02); plate.rotateX(-0.4); plate.translate(0, -0.02, 0.14); fadd(plate, new THREE.MeshStandardMaterial({ map: T.roundel(number, '#111'), roughness: 0.5 })); }
  if (s.bags) for (const sx of [1, -1]) add(new RoundedBoxGeometry(0.2, 0.32, 0.5, 3, 0.06).translate(sx * 0.27, s.seatY - 0.15, zR + 0.2), paint);
  // چراغ عقب و راهنما
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1010, emissiveIntensity: 0.6, roughness: 0.2 });
  const tl = new RoundedBoxGeometry(0.12, 0.04, 0.04, 1, 0.01); tl.translate(0, s.seatY + 0.04, s.seatZ - (s.fairing === 'full' ? 0.58 : 0.55)); add(tl, brakeMat, false);
  for (const sx of [1, -1]) { const ind = new THREE.SphereGeometry(0.018, 8, 6); ind.scale(1, 0.8, 1.6); ind.translate(sx * 0.12, s.seatY - 0.04, s.seatZ - 0.55); add(ind, m.amber, false); }
  // رکاب
  const pegs = [V(0.17, 0.42, -0.12), V(-0.17, 0.42, -0.12)];
  if (s.style === 'chopper' || s.style === 'cruiser' || s.style === 'touring') { pegs[0].set(0.22, 0.34, 0.35); pegs[1].set(-0.22, 0.34, 0.35); }
  if (s.fairing === 'scooter') { pegs[0].set(0.1, 0.36, 0.1); pegs[1].set(-0.1, 0.36, 0.1); }
  for (const p of pegs) { const pg = new THREE.CylinderGeometry(0.014, 0.014, 0.09, 8); pg.rotateZ(Math.PI / 2); pg.translate(p.x, p.y - 0.03, p.z); add(pg, m.alu, false); }
  // چرخ عقب
  const rwRoot = new THREE.Group(); rwRoot.position.set(0, s.wrR, zR); rwRoot.userData.dynamic = true; body.add(rwRoot);
  const rwSpin = new THREE.Group(); rwRoot.add(rwSpin);
  rwSpin.add(new THREE.Mesh(bikeWheel(s.wrR, s.twR, s.spoked, s.knobby, 1), vertexPBRMaterial(THREE.DoubleSide)));
  const sprocket = new THREE.TorusGeometry(0.13, 0.012, 4, 24); sprocket.rotateY(Math.PI / 2); sprocket.translate(0.11, s.wrR, zR); add(sprocket, m.engine, false);
  add(tube([V(0.11, s.wrR + 0.13, zR), V(0.11, 0.48, engZ - 0.1)], 0.008, 6), m.black, false);
  add(tube([V(0.11, s.wrR - 0.13, zR), V(0.11, 0.32, engZ - 0.1)], 0.008, 6), m.black, false);
  // موتورسوار
  let driver = null; let eye = V(0, s.seatY + 0.75, s.seatZ + 0.15);
  {
    const fm = suit === 'fire' && isPlayer ? patternMaterial('fire') : null;
    driver = buildHuman({ detail: isPlayer ? 'hi' : 'mid', helmet: isPlayer ? 0xffc21a : team, helmetStripe: 0xff3a00, gloves: 0x151515, longSleeve: true, shoes: 0x111111, shirtMat: fm, pantsMat: fm, shirt: isPlayer ? 0xff5a00 : team, pants: 0x1a1a1f });
    driver.root.position.set(0, s.seatY + 0.02, s.seatZ + 0.05);
    driver.pose('ride', { lean: s.lean, seatY: 0 });
    body.add(driver.root);
    body.updateMatrixWorld(true);
    reachIK(driver.j, 'L', gripL); reachIK(driver.j, 'R', gripR);
    reachIK(driver.j, 'L', pegs[0], { limb: 'leg' }); reachIK(driver.j, 'R', pegs[1], { limb: 'leg' });
    driver.root.updateMatrixWorld(true);
    eye = driver.j.head.localToWorld(V(0, 0.14, 0.08));
    driver.rideAngles = {};
    for (const k of ['shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'hipL', 'hipR', 'kneeL', 'kneeR']) driver.rideAngles[k] = driver.j[k].rotation.clone();
    // بدن ثابت ادغام می‌شود؛ سر متحرک می‌ماند
    driver.j.head.userData.dynamic = true;
    optimizeStatic(driver.root);
    driver.j.head.userData.dynamic = false; optimizeStatic(driver.j.head); driver.j.head.userData.dynamic = true;
    driver.root.userData.dynamic = true;
    driver.root.visible = rider;
  }
  // سایه نرم
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.9, s.wb + 0.9), new THREE.MeshBasicMaterial({ map: T.softDot(), color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.025; root.add(blob);
  // ادغام قطعات ثابت
  for (const me of optimizeStatic(body)) if (me.material === m.glass) me.castShadow = false;
  optimizeStatic(front);
  const L = s.wb + s.wrF + s.wrR + 0.1;
  const api = {
    root, body, isBike: true, car: def, shape: { L, W: 0.8, wb: s.wb, wr: s.wrR, tw: s.twR, roof: s.seatY + 0.6, sill: 0.3, interior: 'bike', seatY: s.seatY },
    wheels: [{ root: fwRoot, spin: fwSpin, front: true, x: 0, z: zF }, { root: rwRoot, spin: rwSpin, front: false, x: 0, z: zR }],
    paint, brakeMat, exhaust, eye, driver, interior: { steer: front, gear: new THREE.Group(), pedals: { gas: new THREE.Group(), brake: new THREE.Group() }, gauges: [new THREE.Group(), new THREE.Group()], grp: new THREE.Group() },
    lean: 0, lodNear: true,
    setBrake(on) { const v = on ? 3.2 : 0.6; if (brakeMat.emissiveIntensity !== v) brakeMat.emissiveIntensity = v; },
    setLOD() {},
    setVisualState({ steer = 0, spin = 0, brake = 0, latAcc = 0, bounce = 0, pitch = 0 }) {
      fwSpin.rotation.x = spin; rwSpin.rotation.x = spin;
      front.quaternion.setFromAxisAngle(axis, steer * 0.32);
      const target = clamp(-Math.atan(latAcc / 9.81) * 1.05, -0.85, 0.85);
      this.lean += (target - this.lean) * 0.15;
      body.rotation.z = this.lean; body.rotation.x = pitch * 0.5; body.position.y = bounce;
      if (driver && driver.root.visible) driver.j.head.rotation.z = -this.lean * 0.5;
      this.setBrake(brake > 0.1);
    }
  };
  root.userData.car = api;
  return api;
}
