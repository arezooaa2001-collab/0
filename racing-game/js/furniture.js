// مبلمان و وسایل داخل خانه؛ هر وسیله با دکمه تعامل کاری انجام می‌دهد
// خروجی هر سازنده: { group, box: [[x0,z0,x1,z1]...], inter: [{ at:[x,y,z], label, act(game, it) }], update? }
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as T from './textures.js';

const mats = new Map();
export function mat(hex, rough = 0.6, metal = 0) {
  const k = hex + '_' + rough + '_' + metal;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal }));
  return mats.get(k);
}
const rb = (w, h, d, r = 0.03, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
function mesh(g, m, x = 0, y = 0, z = 0, parent) { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; if (parent) parent.add(me); return me; }
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// نوار متحرک تلویزیون و لپ‌تاپ (یک تکسچر مشترک)
let tvTex = null;
export function tvTexture() {
  if (tvTex) return tvTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 144; const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  tvTex = { tex, ctx, t: 0, channel: 0 };
  tvTex.draw = (t, ch) => {
    const g = ctx.createLinearGradient(0, 0, 256, 144);
    const hues = [[200, 30], [20, 50], [120, 90], [280, 330]][ch % 4];
    g.addColorStop(0, `hsl(${hues[0] + Math.sin(t) * 20},70%,45%)`); g.addColorStop(1, `hsl(${hues[1] + Math.cos(t) * 20},70%,30%)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 144);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.1 * Math.sin(t * 2 + i)})`; ctx.beginPath(); ctx.arc(128 + Math.sin(t * 0.8 + i * 1.3) * 90, 72 + Math.cos(t * 1.1 + i) * 45, 12 + i * 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.font = "700 22px 'Vazirmatn', sans-serif"; ctx.textAlign = 'center';
    ctx.fillText(['اخبار', 'فوتبال', 'کارتون', 'مسابقه ماشین'][ch % 4], 128, 130);
    tex.needsUpdate = true;
  };
  tvTex.draw(0, 0);
  return tvTex;
}

export const F = {
  sofa(color = 0x6b7c93) {
    const g = new THREE.Group(); const m = mat(color, 0.9);
    mesh(rb(2.2, 0.42, 0.9, 0.08), m, 0, 0.3, 0, g); mesh(rb(2.2, 0.7, 0.22, 0.08), m, 0, 0.62, -0.38, g);
    for (const x of [-1.05, 1.05]) mesh(rb(0.22, 0.62, 0.9, 0.08), m, x, 0.4, 0, g);
    for (const x of [-0.5, 0.5]) mesh(rb(0.95, 0.14, 0.7, 0.06), mat(color - 0x080808, 0.95), x, 0.56, 0.06, g);
    mesh(rb(0.4, 0.32, 0.12, 0.05), mat(0xe9c46a, 0.9), -0.7, 0.75, -0.2, g).rotation.x = -0.25;
    return { group: g, box: [[-1.15, -0.45, 1.15, 0.45]], inter: [
      { at: [-0.5, 0.6, 0.2], label: 'نشستن روی مبل', act: (game) => game.sit({ local: [-0.5, 0.48, 0.15], yaw: 0, from: g }) },
      { at: [0.5, 0.6, 0.2], label: 'دراز کشیدن روی مبل', act: (game) => game.lie({ local: [0.1, 0.5, 0.05], yaw: Math.PI / 2, from: g }) }] };
  },
  armchair(color = 0x8c4a3a) {
    const g = new THREE.Group(); const m = mat(color, 0.9);
    mesh(rb(0.85, 0.42, 0.85, 0.08), m, 0, 0.3, 0, g); mesh(rb(0.85, 0.65, 0.2, 0.08), m, 0, 0.62, -0.33, g);
    for (const x of [-0.38, 0.38]) mesh(rb(0.16, 0.55, 0.85, 0.06), m, x, 0.42, 0, g);
    return { group: g, box: [[-0.45, -0.45, 0.45, 0.45]], inter: [{ at: [0, 0.6, 0.2], label: 'نشستن روی مبل تکی', act: (game) => game.sit({ local: [0, 0.48, 0.1], yaw: 0, from: g }) }] };
  },
  coffeeTable() {
    const g = new THREE.Group(); const wood = mat(0x7a4b2a, 0.45);
    mesh(rb(1.2, 0.06, 0.6, 0.02), wood, 0, 0.42, 0, g);
    for (const [x, z] of [[-0.52, -0.24], [0.52, -0.24], [-0.52, 0.24], [0.52, 0.24]]) mesh(box(0.05, 0.4, 0.05), wood, x, 0.2, z, g);
    const cup = mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 12), mat(0xffffff, 0.3), 0.2, 0.5, 0.05, g); cup.userData.dynamic = true;
    const book = mesh(box(0.22, 0.04, 0.16), mat(0xb5332e, 0.7), -0.25, 0.47, -0.05, g);
    return { group: g, box: [[-0.62, -0.32, 0.62, 0.32]], inter: [
      { at: [0.2, 0.55, 0.05], label: 'نوشیدن چای', act: (game) => game.act('drink', 2.2, { text: 'چای خوش‌طعم بود ☕' }) },
      { at: [-0.25, 0.5, -0.05], label: 'ورق زدن مجله', act: (game) => game.act('read', 2.5, { text: 'یک مقاله درباره مسابقه خواندی 📖' }) }] };
  },
  tv() {
    const g = new THREE.Group(); const dark = mat(0x18181c, 0.4);
    mesh(rb(1.6, 0.5, 0.45, 0.03), mat(0x3a2a1e, 0.5), 0, 0.25, 0, g);
    mesh(box(1.3, 0.78, 0.06), dark, 0, 1.0, 0, g);
    const tvt = tvTexture();
    const scrM = new THREE.MeshBasicMaterial({ color: 0x050505 });
    const scr = mesh(new THREE.PlaneGeometry(1.22, 0.7), scrM, 0, 1.0, 0.032, g); scr.userData.dynamic = true; scr.castShadow = false;
    const st = { on: false, ch: 0 };
    return { group: g, box: [[-0.82, -0.25, 0.82, 0.25]], inter: [{ at: [0, 1.0, 0.1], label: () => (st.on ? 'عوض کردن کانال / خاموش' : 'روشن کردن تلویزیون'), act: (game) => {
      if (!st.on) { st.on = true; scrM.map = tvt.tex; scrM.color.setHex(0xffffff); scrM.needsUpdate = true; game.act('press', 0.6, { text: 'تلویزیون روشن شد 📺' }); }
      else if (st.ch < 3) { st.ch++; tvt.channel = st.ch; game.act('press', 0.5, { text: 'کانال عوض شد' }); }
      else { st.on = false; st.ch = 0; scrM.map = null; scrM.color.setHex(0x050505); scrM.needsUpdate = true; game.act('press', 0.5, { text: 'تلویزیون خاموش شد' }); }
    } }], update: (dt, t) => { if (st.on) { tvt.t += dt; if (Math.floor(tvt.t * 12) !== tvt.f) { tvt.f = Math.floor(tvt.t * 12); tvt.draw(tvt.t, tvt.channel); } } } };
  },
  floorLamp() {
    const g = new THREE.Group(); const metal = mat(0x2b2b30, 0.4, 0.6);
    mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.04, 16), metal, 0, 0.02, 0, g); mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5, 8), metal, 0, 0.77, 0, g);
    const shadeM = new THREE.MeshStandardMaterial({ color: 0xf2e6c9, roughness: 0.8, emissive: 0xffd9a0, emissiveIntensity: 0, side: THREE.DoubleSide });
    const shade = mesh(new THREE.CylinderGeometry(0.16, 0.25, 0.32, 18, 1, true), shadeM, 0, 1.55, 0, g); shade.userData.dynamic = true;
    const st = { on: false };
    return { group: g, box: [[-0.2, -0.2, 0.2, 0.2]], inter: [{ at: [0, 1.2, 0], label: () => (st.on ? 'خاموش کردن چراغ' : 'روشن کردن چراغ'), act: (game) => { st.on = !st.on; shadeM.emissiveIntensity = st.on ? 2.2 : 0; game.roomLight?.(st.on); game.act('press', 0.5, { text: st.on ? 'چراغ روشن شد 💡' : 'چراغ خاموش شد' }); } }] };
  },
  bookshelf() {
    const g = new THREE.Group(); const wood = mat(0x6b4226, 0.55);
    mesh(box(1.2, 2.0, 0.35), wood, 0, 1.0, -0.02, g);
    const cols = [0xb5332e, 0x2a6f97, 0x2d6a4f, 0xe9c46a, 0x6d597a, 0xf4a261];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 9; k++) { const h = 0.24 + ((k * 7 + r * 3) % 5) * 0.025; mesh(box(0.1, h, 0.24), mat(cols[(k + r) % 6], 0.7), -0.48 + k * 0.12, 0.22 + r * 0.46 + h / 2, 0.06, g); }
    return { group: g, box: [[-0.62, -0.2, 0.62, 0.2]], inter: [{ at: [0, 1.2, 0.2], label: 'برداشتن و خواندن کتاب', act: (game) => game.act('read', 3, { text: ['کتاب «سفر به ماه» را خواندی 📚', 'یک شعر از حافظ خواندی ✨', 'کتاب آشپزی را ورق زدی 🍲'][Math.floor(Math.random() * 3)] }) }] };
  },
  plant() {
    const g = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.35, 14), mat(0xb5653a, 0.8), 0, 0.17, 0, g);
    const leaves = new THREE.Group(); leaves.position.y = 0.35; leaves.userData.dynamic = true; g.add(leaves);
    for (let k = 0; k < 9; k++) { const l = mesh(new THREE.SphereGeometry(0.16, 8, 6), mat(0x2f7a32, 0.8), Math.cos(k) * 0.14, 0.2 + (k % 3) * 0.18, Math.sin(k) * 0.14, leaves); l.scale.set(1, 1.6, 0.6); l.rotation.set(Math.cos(k), k, 0); }
    return { group: g, box: [[-0.22, -0.22, 0.22, 0.22]], inter: [{ at: [0, 0.6, 0], label: 'آب دادن به گلدان', act: (game) => { game.act('water', 2.4, { text: 'گلدان آب خورد و شاداب شد 🌿' }); game.spray?.(leaves, 0.6); leaves.userData.grow = 1; } }],
      update: (dt) => { if (leaves.userData.grow) { leaves.userData.grow -= dt; const s = 1 + Math.sin(leaves.userData.grow * 6) * 0.06; leaves.scale.set(s, s, s); if (leaves.userData.grow <= 0) { leaves.userData.grow = 0; leaves.scale.set(1, 1, 1); } } } };
  },
  rug(color = 0x8e3b46) {
    const g = new THREE.Group(); const r = mesh(new THREE.BoxGeometry(2.4, 0.015, 1.6), mat(color, 1), 0, 0.008, 0, g); r.castShadow = false; r.userData.dynamic = true;
    mesh(new THREE.BoxGeometry(2.0, 0.017, 1.2), mat(0xe9d8a6, 1), 0, 0.009, 0, g).castShadow = false;
    return { group: g, box: [], inter: [{ at: [0.9, 0.2, 0.6], label: 'تکاندن فرش', act: (game) => game.act('shake', 2.2, { text: 'فرش تمیز شد ✨', dust: true }) }] };
  },
  painting(seed = 1) {
    const g = new THREE.Group();
    mesh(box(1.0, 0.75, 0.05), mat(0x5b3a1a, 0.4, 0.2), 0, 0, 0, g);
    const p = mesh(new THREE.PlaneGeometry(0.88, 0.63), new THREE.MeshStandardMaterial({ map: T.painting(seed), roughness: 0.6 }), 0, 0, 0.027, g); p.castShadow = false;
    return { group: g, box: [], inter: [{ at: [0, 0, 0.2], label: 'تماشای تابلو', act: (game) => game.act('idle', 2.2, { text: 'چه تابلوی زیبایی! 🖼️' }) }] };
  },
  ceilingLamp() { const g = new THREE.Group(); mesh(new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xfff8e8, emissive: 0xfff1d0, emissiveIntensity: 0.6, side: THREE.DoubleSide }), 0, -0.02, 0, g).rotation.x = Math.PI; return { group: g, box: [], inter: [] }; },
  fridge() {
    const g = new THREE.Group(); const white = mat(0xe8eaee, 0.25, 0.3);
    mesh(rb(0.75, 1.9, 0.7, 0.04), white, 0, 0.95, 0, g);
    mesh(box(0.7, 1.75, 0.6), mat(0xf6f8fb, 0.5), 0, 0.95, 0.02, g);
    const door = new THREE.Group(); door.position.set(0.37, 0, 0.35); door.userData.dynamic = true; g.add(door);
    mesh(rb(0.74, 1.88, 0.06, 0.03), white, -0.37, 0.95, 0.03, door); mesh(box(0.03, 0.5, 0.04), mat(0xb0b4bb, 0.2, 0.9), -0.68, 1.15, 0.08, door);
    for (const [x, y, c] of [[-0.15, 1.1, 0xd62828], [0.1, 1.1, 0xf77f00], [-0.05, 0.6, 0x2a9d8f]]) mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 10), mat(c, 0.4), x, y, 0.1, g);
    const st = { open: false, a: 0 };
    return { group: g, box: [[-0.4, -0.38, 0.4, 0.38]], inter: [{ at: [0, 1.1, 0.45], label: () => (st.open ? 'بستن در یخچال' : 'باز کردن یخچال و برداشتن نوشیدنی'), act: (game) => { st.open = !st.open; game.act(st.open ? 'reach' : 'press', 0.8, { text: st.open ? 'یک نوشابه خنک برداشتی 🥤' : 'در یخچال بسته شد' }); } }],
      update: (dt) => { st.a += ((st.open ? -1.7 : 0) - st.a) * Math.min(1, dt * 6); door.rotation.y = st.a; } };
  },
  counter(len = 1.6) {
    const g = new THREE.Group();
    mesh(box(len, 0.86, 0.6), mat(0xf1efe8, 0.6), 0, 0.43, 0, g);
    mesh(box(len + 0.04, 0.05, 0.64), mat(0x3d3d45, 0.25, 0.1), 0, 0.885, 0, g);
    for (let k = 0; k < Math.round(len / 0.6); k++) mesh(box(0.15, 0.02, 0.02), mat(0x9aa0a8, 0.2, 0.9), -len / 2 + 0.3 + k * 0.6, 0.75, 0.31, g);
    return { group: g, box: [[-len / 2, -0.3, len / 2, 0.3]], inter: [{ at: [0, 0.95, 0.3], label: 'درست کردن ساندویچ', act: (game) => game.act('reach', 2.5, { text: 'یک ساندویچ خوشمزه درست کردی 🥪' }) }] };
  },
  sink(bathroom = false) {
    const g = new THREE.Group();
    if (!bathroom) { mesh(box(0.8, 0.86, 0.6), mat(0xf1efe8, 0.6), 0, 0.43, 0, g); mesh(box(0.84, 0.05, 0.64), mat(0x3d3d45, 0.25), 0, 0.885, 0, g); }
    else { mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.8, 12), mat(0xffffff, 0.2), 0, 0.4, 0, g); }
    const basin = mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.14, 20, 1, true), mat(0xdfe3e8, 0.15, 0.6), 0, bathroom ? 0.86 : 0.86, 0, g); basin.material.side = THREE.DoubleSide;
    mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 12, Math.PI), mat(0xd0d4da, 0.1, 1), 0, 1.0, -0.18, g).rotation.y = Math.PI / 2;
    const water = mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.7, roughness: 0.05 }), 0, 0.93, -0.12, g); water.visible = false; water.userData.dynamic = true; water.castShadow = false;
    const st = { on: false };
    return { group: g, box: [[-0.42, -0.32, 0.42, 0.32]], inter: [{ at: [0, 1.0, 0.2], label: () => (st.on ? 'بستن شیر آب' : 'باز کردن شیر آب و شستن دست'), act: (game) => { st.on = !st.on; water.visible = st.on; game.act('reach', 1.2, { text: st.on ? 'دست‌هایت را شستی 💧' : 'شیر آب بسته شد' }); game.sfx?.('water'); } }],
      update: (dt, t) => { if (st.on) water.scale.set(1 + Math.sin(t * 40) * 0.1, 1, 1); } };
  },
  stove() {
    const g = new THREE.Group();
    mesh(box(0.75, 0.86, 0.62), mat(0x2b2d33, 0.35, 0.5), 0, 0.43, 0, g);
    mesh(box(0.74, 0.02, 0.6), mat(0x0c0c0e, 0.15, 0.2), 0, 0.875, 0, g);
    const flames = [];
    for (const [x, z] of [[-0.18, -0.15], [0.18, -0.15], [-0.18, 0.15], [0.18, 0.15]]) {
      mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 16), mat(0x777777, 0.4, 0.8), x, 0.89, z, g).rotation.x = Math.PI / 2;
      const f = mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 16), new THREE.MeshBasicMaterial({ color: 0x3a8bff }), x, 0.9, z, g); f.rotation.x = Math.PI / 2; f.visible = false; f.userData.dynamic = true; f.castShadow = false; flames.push(f);
    }
    mesh(box(0.6, 0.4, 0.02), mat(0x111111, 0.1), 0, 0.42, 0.31, g);
    const st = { on: false };
    return { group: g, box: [[-0.4, -0.32, 0.4, 0.32]], inter: [{ at: [0, 0.95, 0.3], label: () => (st.on ? 'خاموش کردن اجاق' : 'روشن کردن اجاق گاز'), act: (game) => { st.on = !st.on; flames.forEach((f) => { f.visible = st.on; }); game.act('press', 0.7, { text: st.on ? 'شعله‌ها روشن شدند 🔥' : 'اجاق خاموش شد' }); } }],
      update: (dt, t) => { if (st.on) flames.forEach((f, i) => f.scale.setScalar(1 + Math.sin(t * 25 + i) * 0.08)); } };
  },
  microwave() {
    const g = new THREE.Group();
    mesh(rb(0.5, 0.3, 0.36, 0.02), mat(0xdfe2e6, 0.3, 0.4), 0, 0.15, 0, g);
    const winM = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffc870, emissiveIntensity: 0 });
    mesh(box(0.3, 0.2, 0.01), winM, -0.06, 0.15, 0.181, g).userData.dynamic = true;
    const st = { t: 0 };
    return { group: g, box: [], inter: [{ at: [0, 0.2, 0.2], label: 'گرم کردن غذا در مایکروویو', act: (game) => { st.t = 4; game.act('press', 0.6, { text: 'غذا گرم شد! دینگ 🔔' }); } }],
      update: (dt) => { if (st.t > 0) { st.t -= dt; winM.emissiveIntensity = st.t > 0 ? 1.5 : 0; } } };
  },
  kettle() {
    const g = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 16), mat(0xc0c4ca, 0.15, 0.9), 0, 0.11, 0, g);
    mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 12, Math.PI), mat(0x222222, 0.5), 0, 0.2, 0, g);
    return { group: g, box: [], inter: [{ at: [0, 0.2, 0.1], label: 'جوش آوردن آب کتری', act: (game) => { game.act('reach', 1, { text: 'آب جوش آمد و چای دم کردی ☕' }); game.steam?.(g, 3); } }] };
  },
  trashCan() {
    const g = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.45, 16), mat(0xa9adb3, 0.25, 0.9), 0, 0.225, 0, g);
    const lid = new THREE.Group(); lid.position.set(0, 0.46, -0.15); lid.userData.dynamic = true; g.add(lid);
    mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.03, 16), mat(0x8d9197, 0.25, 0.9), 0, 0, 0.15, lid);
    const st = { t: 0 };
    return { group: g, box: [[-0.17, -0.17, 0.17, 0.17]], inter: [{ at: [0, 0.4, 0.15], label: 'باز کردن سطل آشغال', act: (game) => { st.t = 2.2; game.act('kick', 0.6, { text: 'در سطل باز شد 🗑️' }); } }],
      update: (dt) => { st.t = Math.max(0, st.t - dt); lid.rotation.x += ((st.t > 0 ? -1.2 : 0) - lid.rotation.x) * Math.min(1, dt * 8); } };
  },
  diningTable() {
    const g = new THREE.Group(); const wood = mat(0x8a5a33, 0.45);
    mesh(rb(1.6, 0.06, 0.9, 0.02), wood, 0, 0.76, 0, g);
    for (const [x, z] of [[-0.72, -0.37], [0.72, -0.37], [-0.72, 0.37], [0.72, 0.37]]) mesh(box(0.06, 0.74, 0.06), wood, x, 0.37, z, g);
    mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 20), mat(0xffffff, 0.2), -0.35, 0.8, 0.15, g);
    mesh(new THREE.SphereGeometry(0.09, 12, 8), mat(0xd62828, 0.5), 0.3, 0.84, -0.1, g);
    return { group: g, box: [[-0.82, -0.47, 0.82, 0.47]], inter: [{ at: [0, 0.85, 0.3], label: 'خوردن میوه', act: (game) => game.act('eat', 2.2, { text: 'یک سیب خوشمزه خوردی 🍎' }) }] };
  },
  chair(color = 0x7a4b2a) {
    const g = new THREE.Group(); const m = mat(color, 0.5);
    mesh(box(0.45, 0.05, 0.45), m, 0, 0.46, 0, g); mesh(box(0.45, 0.5, 0.05), m, 0, 0.72, -0.2, g);
    for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) mesh(box(0.04, 0.45, 0.04), m, x, 0.22, z, g);
    return { group: g, box: [[-0.23, -0.23, 0.23, 0.23]], inter: [{ at: [0, 0.5, 0.1], label: 'نشستن روی صندلی', act: (game) => game.sit({ local: [0, 0.48, 0.05], yaw: 0, from: g }) }] };
  },
  bed() {
    const g = new THREE.Group(); const wood = mat(0x5b3a24, 0.5);
    mesh(box(1.7, 0.3, 2.1), wood, 0, 0.2, 0, g); mesh(box(1.7, 1.0, 0.08), wood, 0, 0.55, -1.05, g);
    mesh(rb(1.6, 0.22, 2.0, 0.08), mat(0xf4f1ea, 0.95), 0, 0.44, 0, g);
    mesh(rb(1.62, 0.08, 1.4, 0.04), mat(0x3a5a8c, 0.95), 0, 0.57, 0.28, g);
    for (const x of [-0.4, 0.4]) mesh(rb(0.62, 0.14, 0.35, 0.07), mat(0xffffff, 0.95), x, 0.6, -0.78, g);
    return { group: g, box: [[-0.86, -1.1, 0.86, 1.05]], inter: [
      { at: [0.3, 0.6, 0.3], label: 'خوابیدن روی تخت', act: (game) => game.lie({ local: [0.35, 0.62, 0.05], yaw: 0, from: g, sleep: true }) },
      { at: [-0.5, 0.6, 0.9], label: 'مرتب کردن تخت', act: (game) => game.act('reach', 2.2, { text: 'تخت مرتب شد 🛏️' }) }] };
  },
  nightstand(lamp = true) {
    const g = new THREE.Group(); mesh(box(0.45, 0.5, 0.4), mat(0x5b3a24, 0.5), 0, 0.25, 0, g);
    const st = { on: false };
    const shadeM = new THREE.MeshStandardMaterial({ color: 0xf2e6c9, roughness: 0.8, emissive: 0xffd9a0, emissiveIntensity: 0 });
    if (lamp) { mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.2, 10), mat(0xc9a227, 0.3, 0.8), 0, 0.6, 0, g); mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.18, 14, 1, true), shadeM, 0, 0.78, 0, g).userData.dynamic = true; }
    return { group: g, box: [[-0.23, -0.21, 0.23, 0.21]], inter: [{ at: [0, 0.7, 0.2], label: () => (st.on ? 'خاموش کردن آباژور' : 'روشن کردن آباژور'), act: (game) => { st.on = !st.on; shadeM.emissiveIntensity = st.on ? 2 : 0; game.act('press', 0.5, { text: st.on ? 'آباژور روشن شد' : 'آباژور خاموش شد' }); } }] };
  },
  wardrobe() {
    const g = new THREE.Group(); const wood = mat(0x7d5a3c, 0.5);
    mesh(box(1.4, 2.1, 0.6), wood, 0, 1.05, 0, g);
    const doors = [];
    for (const sx of [-1, 1]) {
      const d = new THREE.Group(); d.position.set(sx * 0.7, 0, 0.31); d.userData.dynamic = true; g.add(d);
      mesh(box(0.68, 2.0, 0.03), mat(0x8b6748, 0.45), -sx * 0.34, 1.05, 0, d); mesh(box(0.03, 0.3, 0.04), mat(0xc9a227, 0.3, 0.9), -sx * 0.62, 1.05, 0.03, d); doors.push({ d, sx });
    }
    for (let k = 0; k < 6; k++) mesh(box(0.05, 0.8, 0.4), mat([0xd62828, 0x1d3557, 0xf4a261, 0x2a9d8f, 0xffffff, 0x6d597a][k], 0.9), -0.5 + k * 0.2, 1.4, 0, g);
    const st = { open: false };
    return { group: g, box: [[-0.72, -0.32, 0.72, 0.32]], inter: [{ at: [0, 1.2, 0.4], label: () => (st.open ? 'بستن کمد' : 'باز کردن کمد لباس'), act: (game) => { st.open = !st.open; game.act('reach', 0.8, { text: st.open ? 'لباس‌ها مرتب آویزان‌اند 👕' : 'کمد بسته شد' }); } }],
      update: (dt) => { for (const { d, sx } of doors) d.rotation.y += ((st.open ? sx * 1.6 : 0) - d.rotation.y) * Math.min(1, dt * 6); } };
  },
  desk() {
    const g = new THREE.Group(); const wood = mat(0xa0784f, 0.45);
    mesh(box(1.2, 0.05, 0.6), wood, 0, 0.75, 0, g); for (const x of [-0.56, 0.56]) mesh(box(0.05, 0.74, 0.58), wood, x, 0.37, 0, g);
    mesh(box(0.36, 0.015, 0.25), mat(0x2b2b30, 0.3, 0.6), 0, 0.78, 0.05, g);
    const lid = new THREE.Group(); lid.position.set(0, 0.79, -0.07); lid.userData.dynamic = true; g.add(lid);
    mesh(box(0.36, 0.25, 0.012), mat(0x2b2b30, 0.3, 0.6), 0, 0.125, 0, lid);
    const scrM = new THREE.MeshBasicMaterial({ color: 0x050505 }); const scr = mesh(new THREE.PlaneGeometry(0.32, 0.2), scrM, 0, 0.125, 0.008, lid); scr.castShadow = false;
    const st = { open: false };
    lid.rotation.x = 1.5;
    return { group: g, box: [[-0.62, -0.32, 0.62, 0.32]], inter: [{ at: [0, 0.85, 0.3], label: () => (st.open ? 'بستن لپ‌تاپ' : 'باز کردن لپ‌تاپ و بازی کردن'), act: (game) => { st.open = !st.open; if (st.open) { scrM.map = tvTexture().tex; scrM.color.setHex(0xffffff); } else { scrM.map = null; scrM.color.setHex(0x050505); } scrM.needsUpdate = true; game.act('reach', 1.2, { text: st.open ? 'در لپ‌تاپ یک بازی مسابقه‌ای باز کردی 💻' : 'لپ‌تاپ بسته شد' }); } }],
      update: (dt) => { lid.rotation.x += ((st.open ? -0.25 : 1.5) - lid.rotation.x) * Math.min(1, dt * 6); } };
  },
  mirror() {
    const g = new THREE.Group(); mesh(box(0.7, 1.0, 0.04), mat(0x8a6a3a, 0.4, 0.5), 0, 0, 0, g);
    mesh(new THREE.PlaneGeometry(0.6, 0.9), new THREE.MeshStandardMaterial({ color: 0xdfe8ee, metalness: 1, roughness: 0.02 }), 0, 0, 0.022, g).castShadow = false;
    return { group: g, box: [], inter: [{ at: [0, 0, 0.3], label: 'نگاه کردن در آینه', act: (game) => game.act('idle', 2, { text: 'چه قهرمان خوش‌تیپی! 😎' }) }] };
  },
  curtain(w = 1.6) {
    const g = new THREE.Group(); mesh(new THREE.CylinderGeometry(0.015, 0.015, w + 0.3, 8), mat(0x8a6a3a, 0.4, 0.6), 0, 1.25, 0, g).rotation.z = Math.PI / 2;
    const panels = [];
    for (const sx of [-1, 1]) { const p = new THREE.Group(); p.position.set(sx * (w / 2 + 0.1), 0, 0); p.userData.dynamic = true; g.add(p); const cg = new THREE.PlaneGeometry(w * 0.5, 2.2, 10, 1); const pos = cg.attributes.position; for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 18) * 0.04); cg.computeVertexNormals(); cg.translate(-sx * w * 0.25, 0.15, 0); const m = mesh(cg, new THREE.MeshStandardMaterial({ color: 0xc9a58a, roughness: 0.95, side: THREE.DoubleSide }), 0, 0, 0, p); m.castShadow = false; panels.push({ p, sx }); }
    const st = { closed: false };
    return { group: g, box: [], inter: [{ at: [0, 0.3, 0.3], label: () => (st.closed ? 'کنار زدن پرده' : 'کشیدن پرده'), act: (game) => { st.closed = !st.closed; game.act('reach', 0.8, {}); } }],
      update: (dt) => { for (const { p, sx } of panels) { const target = st.closed ? 1 : 0.32; p.scale.x += (target - p.scale.x) * Math.min(1, dt * 5); } } };
  },
  toilet() {
    const g = new THREE.Group(); const w = mat(0xffffff, 0.15);
    mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.4, 16), w, 0, 0.2, 0.05, g); mesh(rb(0.42, 0.4, 0.18, 0.04), w, 0, 0.62, -0.24, g);
    const lid = new THREE.Group(); lid.position.set(0, 0.42, -0.15); lid.userData.dynamic = true; g.add(lid);
    const lm = mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 16), w, 0, 0, 0.2, lid); lm.scale.set(1, 1, 1.15);
    const st = { t: 0 };
    return { group: g, box: [[-0.22, -0.33, 0.22, 0.25]], inter: [{ at: [0, 0.6, 0.2], label: 'کشیدن سیفون', act: (game) => { st.t = 2; game.act('press', 0.6, { text: 'شررررر... 🚽' }); game.sfx?.('water'); } }],
      update: (dt) => { st.t = Math.max(0, st.t - dt); lid.rotation.x += ((st.t > 0 ? -1.4 : 0) - lid.rotation.x) * Math.min(1, dt * 6); } };
  },
  bathtub() {
    const g = new THREE.Group(); const w = mat(0xfafafa, 0.15);
    const outer = mesh(rb(1.7, 0.6, 0.8, 0.12), w, 0, 0.3, 0, g);
    mesh(rb(1.5, 0.05, 0.6, 0.02), mat(0xd6eaf5, 0.1), 0, 0.58, 0, g);
    const water = mesh(new THREE.BoxGeometry(1.48, 0.02, 0.58), new THREE.MeshStandardMaterial({ color: 0x8ccff0, transparent: true, opacity: 0.0, roughness: 0.02, metalness: 0.1 }), 0, 0.35, 0, g); water.userData.dynamic = true; water.castShadow = false;
    const st = { fill: 0, on: false };
    return { group: g, box: [[-0.86, -0.41, 0.86, 0.41]], inter: [{ at: [0, 0.7, 0.3], label: () => (st.on ? 'بستن شیر وان' : 'پر کردن وان حمام'), act: (game) => { st.on = !st.on; game.act('reach', 1, { text: st.on ? 'آب گرم در وان می‌ریزد 🛁' : 'شیر وان بسته شد' }); if (st.on) game.steam?.(g, 4); } }],
      update: (dt) => { if (st.on) st.fill = Math.min(1, st.fill + dt * 0.15); water.material.opacity = st.fill * 0.75; water.position.y = 0.35 + st.fill * 0.2; } };
  },
  washer() {
    const g = new THREE.Group(); mesh(rb(0.6, 0.85, 0.6, 0.04), mat(0xf2f3f5, 0.3), 0, 0.425, 0, g);
    const drum = new THREE.Group(); drum.position.set(0, 0.45, 0.301); drum.userData.dynamic = true; g.add(drum);
    mesh(new THREE.TorusGeometry(0.19, 0.03, 8, 24), mat(0xb8bcc3, 0.2, 0.9), 0, 0, 0, drum);
    const glassM = new THREE.MeshStandardMaterial({ color: 0x324a5f, roughness: 0.1, metalness: 0.2 }); mesh(new THREE.CircleGeometry(0.17, 20), glassM, 0, 0, 0.005, drum);
    for (let k = 0; k < 3; k++) mesh(new THREE.BoxGeometry(0.06, 0.03, 0.01), mat([0xd62828, 0x2a9d8f, 0xf4a261][k], 0.8), Math.cos(k * 2) * 0.08, Math.sin(k * 2) * 0.08, 0.008, drum);
    const st = { t: 0 };
    return { group: g, box: [[-0.31, -0.31, 0.31, 0.31]], inter: [{ at: [0, 0.6, 0.35], label: 'روشن کردن ماشین لباسشویی', act: (game) => { st.t = 8; game.act('press', 0.6, { text: 'لباس‌ها در حال شسته شدن‌اند 🧺' }); } }],
      update: (dt) => { if (st.t > 0) { st.t -= dt; drum.rotation.z += dt * 9; g.position.x = (g.userData.bx ?? (g.userData.bx = g.position.x)) + Math.sin(st.t * 60) * 0.004; } } };
  },
  towel() { const g = new THREE.Group(); mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 8), mat(0xc0c4ca, 0.2, 0.9), 0, 0, 0, g).rotation.z = Math.PI / 2; mesh(new THREE.BoxGeometry(0.5, 0.6, 0.03), mat(0x2a9d8f, 0.95), 0, -0.3, 0.02, g); return { group: g, box: [], inter: [{ at: [0, -0.2, 0.25], label: 'خشک کردن دست‌ها با حوله', act: (game) => game.act('reach', 1.5, { text: 'دست‌هایت خشک شد' }) }] }; }
};
