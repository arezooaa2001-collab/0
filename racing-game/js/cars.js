// فهرست ماشین‌ها و سازنده مدل سه‌بعدی ماشین با فضای داخلی کامل
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, mergeGeos, mergeStaticByMaterial } from './utils.js';
import { buildHuman, patternMaterial } from './human.js';
import * as T from './textures.js';

// ---------- فهرست ماشین‌ها (از ضعیف‌ترین به قوی‌ترین) ----------
export const CARS = [
  { id: 'c1', name: 'ستاره ۵۸', en: 'Setareh 58', style: 'classic', unlock: 1, price: 0, top: 158, acc: 4.4, grip: 0.92, brake: 8.5, color: '#b8202a', class: 'کلاسیک' },
  { id: 'c2', name: 'باد صبا ۶۱', en: 'Saba 61', style: 'roadster', unlock: 20, price: 800, top: 172, acc: 5.0, grip: 0.97, brake: 9, color: '#e8e1c8', class: 'کلاسیک' },
  { id: 'c3', name: 'کهکشان ۶۴', en: 'Kahkeshan 64', style: 'classic', unlock: 20, price: 1200, top: 182, acc: 5.4, grip: 1.0, brake: 9.2, color: '#1f5fa8', class: 'کلاسیک' },
  { id: 'c4', name: 'تندر ۶۸', en: 'Tondar 68', style: 'muscle', unlock: 20, price: 1800, top: 198, acc: 6.0, grip: 1.02, brake: 9.4, color: '#f2a20c', class: 'ماسل' },
  { id: 'c5', name: 'شاهین ۷۲', en: 'Shahin 72', style: 'gt', unlock: 40, price: 2600, top: 212, acc: 6.4, grip: 1.08, brake: 9.8, color: '#2e7d4f', class: 'جی‌تی' },
  { id: 'c6', name: 'یوز ۷۶', en: 'Yuz 76', style: 'wedge', unlock: 60, price: 3500, top: 228, acc: 6.9, grip: 1.12, brake: 10.2, color: '#ff5a1f', class: 'اسپرت' },
  { id: 'c7', name: 'گردباد ۸۲', en: 'Gerdbad 82', style: 'wedge', unlock: 80, price: 4500, top: 245, acc: 7.4, grip: 1.17, brake: 10.6, color: '#f4f4f4', class: 'اسپرت' },
  { id: 'c8', name: 'پلنگ ۸۸', en: 'Palang 88', style: 'super', unlock: 100, price: 6000, top: 262, acc: 7.9, grip: 1.23, brake: 11, color: '#d8111b', class: 'سوپراسپرت' },
  { id: 'c9', name: 'عقاب ۹۴', en: 'Oghab 94', style: 'gt', unlock: 150, price: 8000, top: 278, acc: 8.3, grip: 1.28, brake: 11.4, color: '#1a1a1f', class: 'جی‌تی' },
  { id: 'c10', name: 'رعد ۹۹', en: 'Raad 99', style: 'super', unlock: 200, price: 10000, top: 294, acc: 8.8, grip: 1.33, brake: 11.8, color: '#ffd500', class: 'سوپراسپرت' },
  { id: 'c11', name: 'آذرخش ۰۴', en: 'Azarakhsh 04', style: 'super', unlock: 250, price: 13000, top: 308, acc: 9.2, grip: 1.38, brake: 12.2, color: '#3d7bff', class: 'سوپراسپرت' },
  { id: 'c12', name: 'طوفان ۰۸', en: 'Toofan 08', style: 'gt', unlock: 300, price: 16000, top: 322, acc: 9.6, grip: 1.43, brake: 12.6, color: '#7a2cff', class: 'جی‌تی' },
  { id: 'c13', name: 'شهاب ۱۲', en: 'Shahab 12', style: 'hyper', unlock: 400, price: 20000, top: 336, acc: 10.0, grip: 1.48, brake: 13, color: '#00b3a7', class: 'هایپر' },
  { id: 'c14', name: 'تیزرو ۱۶', en: 'Tizro 16', style: 'super', unlock: 500, price: 25000, top: 350, acc: 10.4, grip: 1.54, brake: 13.4, color: '#ff2d6f', class: 'هایپر' },
  { id: 'c15', name: 'اژدها ۲۰', en: 'Ejdeha 20', style: 'hyper', unlock: 600, price: 30000, top: 364, acc: 10.8, grip: 1.6, brake: 13.8, color: '#0d8f2f', class: 'هایپر' },
  { id: 'c16', name: 'ققنوس ۲۳', en: 'Ghoghnoos 23', style: 'hyper', unlock: 700, price: 36000, top: 378, acc: 11.2, grip: 1.66, brake: 14.2, color: '#ff6a00', class: 'هایپر' },
  { id: 'c17', name: 'رخش ۲۵', en: 'Rakhsh 25', style: 'hyper', unlock: 800, price: 42000, top: 392, acc: 11.6, grip: 1.72, brake: 14.6, color: '#c9a227', class: 'افسانه‌ای' },
  { id: 'c18', name: 'سیمرغ ۲۶', en: 'Simorgh 26', style: 'proto', unlock: 900, price: 50000, top: 408, acc: 12.0, grip: 1.79, brake: 15, color: '#18c8ff', class: 'افسانه‌ای' },
  { id: 'c19', name: 'کیهان X', en: 'Keyhan X', style: 'proto', unlock: 950, price: 60000, top: 425, acc: 12.5, grip: 1.86, brake: 15.5, color: '#e9e9f2', class: 'افسانه‌ای' },
  { id: 'c20', name: 'افسانه ۱۰۰۰', en: 'Afsaneh 1000', style: 'proto', unlock: 1000, price: 75000, top: 450, acc: 13.2, grip: 1.95, brake: 16, color: '#ffbf00', class: 'اسطوره' }
];
export const carById = (id) => CARS.find((c) => c.id === id) || CARS[0];
export const carIndex = (id) => Math.max(0, CARS.findIndex((c) => c.id === id));

// ---------- ارتقاها و شخصی‌سازی ----------
export const UPGRADES = [
  { key: 'engine', name: 'موتور', desc: 'سرعت نهایی و شتاب بیشتر', icon: '⚙️' },
  { key: 'turbo', name: 'توربو', desc: 'شتاب انفجاری', icon: '🌀' },
  { key: 'tires', name: 'لاستیک', desc: 'چسبندگی بیشتر در پیچ', icon: '🛞' },
  { key: 'brakes', name: 'ترمز', desc: 'ترمزگیری قوی‌تر', icon: '🛑' },
  { key: 'weight', name: 'کاهش وزن', desc: 'سبک‌تر و چابک‌تر', icon: '🪶' },
  { key: 'nitro', name: 'نیترو', desc: 'مخزن نیتروی بزرگ‌تر', icon: '🔥' }
];
export const MAX_UP = 5;
export function upgradeCost(car, key, lvl) {
  const base = 60 + car.price * 0.06;
  const k = { engine: 1.3, turbo: 1.15, tires: 1, brakes: 0.8, weight: 1.1, nitro: 1.2 }[key];
  return Math.round((base * k * Math.pow(1.75, lvl)) / 10) * 10;
}
export const PAINTS = ['#b8202a', '#e8e1c8', '#1f5fa8', '#f2a20c', '#2e7d4f', '#ff5a1f', '#f4f4f4', '#1a1a1f', '#ffd500', '#3d7bff', '#7a2cff', '#00b3a7', '#ff2d6f', '#c9a227', '#18c8ff', '#6b6f75', '#5a2d0c', '#ff8fd0'];
export const CUSTOM = {
  paint: { name: 'رنگ بدنه', cost: 80, look: 1 },
  finish: { name: 'نوع رنگ', options: ['براق', 'متالیک', 'مات', 'صدفی'], costs: [0, 150, 220, 400], look: [0, 2, 2, 4] },
  rims: { name: 'رینگ', options: ['کاسه‌ای کلاسیک', 'پره‌ای سیمی', 'پنج پره', 'چند پره', 'توربینی'], costs: [0, 200, 260, 340, 420], look: [0, 3, 3, 4, 5] },
  rimColor: { name: 'رنگ رینگ', options: ['کروم', 'نقره‌ای', 'طلایی', 'مشکی', 'قرمز'], costs: [0, 60, 300, 120, 160], look: [1, 1, 4, 2, 3], hex: ['#e8e8ee', '#b9bcc4', '#d4a531', '#18181c', '#c4161c'] },
  spoiler: { name: 'اسپویلر', options: ['ندارد', 'دم اردکی', 'بال کوتاه', 'بال مسابقه'], costs: [0, 180, 320, 520], look: [0, 2, 3, 5] },
  stripes: { name: 'خط مسابقه', options: ['ندارد', 'دو خط وسط', 'یک خط پهن', 'خطوط کناری'], costs: [0, 150, 150, 120], look: [0, 3, 3, 2] },
  stripeColor: { name: 'رنگ خط', cost: 40, look: 0 },
  tint: { name: 'شیشه', options: ['شفاف', 'دودی', 'مشکی', 'آینه‌ای'], costs: [0, 80, 120, 260], look: [0, 1, 2, 3] },
  neon: { name: 'نئون زیر ماشین', options: ['ندارد', 'آبی', 'قرمز', 'سبز', 'بنفش', 'رنگین‌کمان'], costs: [0, 300, 300, 300, 300, 900], look: [0, 4, 4, 4, 4, 7], hex: ['#000', '#2aa8ff', '#ff2a3a', '#2aff7a', '#b03aff', 'rainbow'] },
  smoke: { name: 'رنگ دود لاستیک', options: ['سفید', 'قرمز', 'آبی', 'سبز', 'زرد', 'بنفش'], costs: [0, 120, 120, 120, 120, 120], look: [0, 1, 1, 1, 1, 1], hex: ['#f2f2f2', '#ff3030', '#3080ff', '#30ff70', '#ffe030', '#b040ff'] },
  suit: { name: 'لباس راننده', options: ['آتشین', 'آبی', 'سفید', 'مشکی', 'طلایی'], costs: [0, 80, 80, 80, 250], look: [1, 0, 0, 1, 2], hex: ['fire', '#1d4fd8', '#f4f4f4', '#151518', '#d4a531'] }
};
export function defaultCustom(car) {
  return { paint: car.color, finish: 0, rims: car.style === 'classic' || car.style === 'roadster' ? 0 : 2, rimColor: 0, spoiler: 0, stripes: 0, stripeColor: '#ffffff', tint: 0, neon: 0, smoke: 0, suit: 0, number: 7 };
}
export function defaultUpgrades() { return { engine: 0, turbo: 0, tires: 0, brakes: 0, weight: 0, nitro: 0 }; }

// آمار نهایی ماشین با ارتقاها
export function carStats(car, up = defaultUpgrades()) {
  const u = (k) => up[k] || 0;
  return {
    vmax: (car.top * (1 + 0.035 * u('engine') + 0.01 * u('weight'))) / 3.6,
    acc: car.acc * (1 + 0.05 * u('engine') + 0.06 * u('turbo') + 0.035 * u('weight')),
    grip: car.grip * (1 + 0.045 * u('tires') + 0.02 * u('weight')),
    brake: car.brake * (1 + 0.07 * u('brakes')),
    nitro: u('nitro') > 0 ? 2.5 + u('nitro') * 1.1 : 0
  };
}
export function looksScore(custom) {
  let s = 0;
  for (const k of ['finish', 'rims', 'rimColor', 'spoiler', 'stripes', 'tint', 'neon', 'smoke', 'suit']) {
    const def = CUSTOM[k]; const v = custom[k] || 0; if (def.look && Array.isArray(def.look)) s += def.look[v] || 0;
  }
  return s; // تقریباً ۰ تا ۳۰
}

// ---------- شکل بدنه بر اساس سبک ----------
function shapeFor(style) {
  const base = {
    classic: { L: 4.45, W: 1.78, wb: 2.6, wr: 0.33, tw: 0.2, sill: 0.3, hood: 0.86, deck: 0.84, belt: 0.92, roof: 1.42, nose: 0.72, tail: 0.7, wsF: 0.62, roofF: 0.5, roofR: 0.24, wsR: 0.14, taper: 0.2, fender: 0.06, pinch: 0.04, round: 2.6, lights: 'round', bumper: 'chrome', grille: 'classic', exhaust: 1, interior: 'classic', seatX: 0.36 },
    roadster: { L: 4.2, W: 1.7, wb: 2.45, wr: 0.32, tw: 0.19, sill: 0.28, hood: 0.8, deck: 0.8, belt: 0.86, roof: 1.25, nose: 0.62, tail: 0.66, wsF: 0.6, roofF: 0.5, roofR: 0.34, wsR: 0.3, taper: 0.15, fender: 0.08, pinch: 0.06, round: 2.4, lights: 'round', bumper: 'chrome', grille: 'oval', exhaust: 2, interior: 'classic', seatX: 0.34 },
    muscle: { L: 4.75, W: 1.9, wb: 2.75, wr: 0.35, tw: 0.25, sill: 0.3, hood: 0.92, deck: 0.9, belt: 0.95, roof: 1.36, nose: 0.82, tail: 0.84, wsF: 0.6, roofF: 0.47, roofR: 0.27, wsR: 0.16, taper: 0.18, fender: 0.04, pinch: 0.01, round: 4.2, lights: 'quad', bumper: 'chrome', grille: 'wide', exhaust: 2, interior: 'classic', seatX: 0.38, scoop: true },
    gt: { L: 4.55, W: 1.88, wb: 2.65, wr: 0.34, tw: 0.25, sill: 0.25, hood: 0.84, deck: 0.86, belt: 0.88, roof: 1.3, nose: 0.62, tail: 0.76, wsF: 0.66, roofF: 0.52, roofR: 0.3, wsR: 0.12, taper: 0.22, fender: 0.05, pinch: 0.02, round: 3.2, lights: 'rect', bumper: 'body', grille: 'mesh', exhaust: 2, interior: 'modern', seatX: 0.37 },
    wedge: { L: 4.3, W: 1.85, wb: 2.5, wr: 0.33, tw: 0.25, sill: 0.22, hood: 0.74, deck: 0.86, belt: 0.82, roof: 1.21, nose: 0.5, tail: 0.84, wsF: 0.66, roofF: 0.48, roofR: 0.34, wsR: 0.2, taper: 0.26, fender: 0.03, pinch: 0.0, round: 5, lights: 'popup', bumper: 'body', grille: 'slot', exhaust: 2, interior: 'modern', seatX: 0.37 },
    super: { L: 4.6, W: 2.0, wb: 2.7, wr: 0.35, tw: 0.3, sill: 0.2, hood: 0.72, deck: 0.84, belt: 0.8, roof: 1.21, nose: 0.48, tail: 0.8, wsF: 0.7, roofF: 0.5, roofR: 0.34, wsR: 0.16, taper: 0.28, fender: 0.07, pinch: 0.03, round: 3.6, lights: 'slim', bumper: 'body', grille: 'mesh', exhaust: 4, interior: 'modern', seatX: 0.38 },
    hyper: { L: 4.7, W: 2.05, wb: 2.75, wr: 0.36, tw: 0.32, sill: 0.17, hood: 0.68, deck: 0.82, belt: 0.77, roof: 1.18, nose: 0.42, tail: 0.8, wsF: 0.74, roofF: 0.54, roofR: 0.38, wsR: 0.22, taper: 0.32, fender: 0.09, pinch: 0.05, round: 3.0, lights: 'slim', bumper: 'body', grille: 'mesh', exhaust: 2, interior: 'race', seatX: 0.37 },
    proto: { L: 4.85, W: 2.08, wb: 2.85, wr: 0.36, tw: 0.33, sill: 0.15, hood: 0.66, deck: 0.8, belt: 0.75, roof: 1.16, nose: 0.4, tail: 0.8, wsF: 0.76, roofF: 0.56, roofR: 0.4, wsR: 0.24, taper: 0.34, fender: 0.1, pinch: 0.06, round: 2.8, lights: 'slim', bumper: 'body', grille: 'mesh', exhaust: 2, interior: 'race', seatX: 0.37, wing: true }
  };
  return { ...base[style], style };
}

// ---------- متریال‌های مشترک ----------
const M = {};
function mats() {
  if (M.chrome) return M;
  M.chrome = new THREE.MeshStandardMaterial({ color: 0xf2f2f6, metalness: 1, roughness: 0.08 });
  M.black = new THREE.MeshStandardMaterial({ color: 0x0d0d10, metalness: 0.2, roughness: 0.55 });
  M.blackGloss = new THREE.MeshPhysicalMaterial({ color: 0x08080a, metalness: 0.3, roughness: 0.2, clearcoat: 1 });
  M.rubber = new THREE.MeshStandardMaterial({ color: 0x141416, metalness: 0, roughness: 0.92 });
  M.whitewall = new THREE.MeshStandardMaterial({ color: 0xf0ede4, roughness: 0.7 });
  M.disc = new THREE.MeshStandardMaterial({ color: 0x8a8d93, metalness: 0.9, roughness: 0.38 });
  M.under = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.95 });
  M.carpet = new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 1 });
  M.dash = new THREE.MeshStandardMaterial({ color: 0x1a1a1d, roughness: 0.75 });
  M.wood = new THREE.MeshStandardMaterial({ color: 0x5a2f14, roughness: 0.35, metalness: 0.05 });
  M.leatherBrown = new THREE.MeshStandardMaterial({ color: 0x6b3a1f, roughness: 0.55 });
  M.leatherBlack = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });
  M.leatherRed = new THREE.MeshStandardMaterial({ color: 0x8e1015, roughness: 0.5 });
  M.alcantara = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.95 });
  M.carbon = new THREE.MeshPhysicalMaterial({ map: T.carbon(), color: 0xffffff, metalness: 0.3, roughness: 0.3, clearcoat: 1 });
  M.headGlass = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d6, emissiveIntensity: 2.2, roughness: 0.1 });
  M.redGlass = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1010, emissiveIntensity: 0.6, roughness: 0.2 });
  M.orangeGlass = new THREE.MeshStandardMaterial({ color: 0x663300, emissive: 0xff8a00, emissiveIntensity: 0.5, roughness: 0.2 });
  M.aluminium = new THREE.MeshStandardMaterial({ color: 0xc8cad0, metalness: 0.9, roughness: 0.3 });
  M.pedal = new THREE.MeshStandardMaterial({ color: 0x9a9da3, metalness: 0.8, roughness: 0.35 });
  M.grilleBg = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.6, metalness: 0.4 });
  return M;
}
const TINTS = [
  { color: 0xcfe6f0, opacity: 0.22 }, { color: 0x405060, opacity: 0.5 }, { color: 0x101418, opacity: 0.72 }, { color: 0x9fb8c8, opacity: 0.62, metal: 0.9 }
];
function glassMat(tint = 0) {
  const t = TINTS[tint] || TINTS[0];
  return new THREE.MeshPhysicalMaterial({ color: t.color, metalness: t.metal || 0.1, roughness: 0.04, transparent: true, opacity: t.opacity, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6, clearcoat: 1 });
}

function paintMat(custom) {
  const fin = custom.finish || 0;
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(custom.paint),
    metalness: [0.15, 0.65, 0.05, 0.4][fin], roughness: [0.22, 0.32, 0.62, 0.25][fin],
    clearcoat: fin === 2 ? 0 : 1, clearcoatRoughness: 0.04, side: THREE.DoubleSide,
    iridescence: fin === 3 ? 1 : 0, iridescenceIOR: 1.6, sheen: 0
  });
  return m;
}

// تکسچر طرح بدنه (خط مسابقه)
function liveryTexture(custom) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 512, 512);
  const st = custom.stripes || 0; ctx.fillStyle = custom.stripeColor || '#ffffff';
  // u: دور مقطع (۰.۵ = بالای بدنه)، v: طول ماشین
  if (st === 1) { ctx.fillRect(512 * 0.465, 0, 512 * 0.025, 512); ctx.fillRect(512 * 0.51, 0, 512 * 0.025, 512); }
  if (st === 2) { ctx.fillRect(512 * 0.47, 0, 512 * 0.06, 512); }
  if (st === 3) { ctx.fillRect(512 * 0.215, 0, 512 * 0.02, 512); ctx.fillRect(512 * 0.765, 0, 512 * 0.02, 512); ctx.fillRect(512 * 0.245, 0, 512 * 0.008, 512); ctx.fillRect(512 * 0.747, 0, 512 * 0.008, 512); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = T.TEX.aniso;
  return t;
}
function multiplyHex(hex, paint) { return hex; }

// ---------- ساخت بدنه به روش Loft (مقطع مستطیل گرد با شانه، قوس گلگیر و فضای باز کابین) ----------
function bodyProfile(s) {
  const L = s.L, hz = L / 2;
  const fz = s.wb / 2, rz = -s.wb / 2;
  const zA = -hz + s.wsF * L, zB = -hz + s.roofF * L, zC = -hz + s.roofR * L, zD = -hz + s.wsR * L;
  const sm = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const top = (z) => {
    const t = (z + hz) / L;
    let y;
    if (z < zD) y = lerp(lerp(s.tail, s.deck, sm(0, 0.14, t)), s.belt, sm(zD - 0.35, zD, z));
    else if (z <= zA) y = s.belt;
    else { const tf = clamp((z - zA) / (hz - zA), 0, 1); y = lerp(s.belt, s.hood, sm(0, 0.18, tf)); y = lerp(y, s.nose, Math.pow(tf, 2.2)); }
    const endT = Math.min(t, 1 - t);
    y -= (1 - Math.sqrt(clamp(endT / 0.05, 0, 1))) * 0.1;
    return y;
  };
  const bottom = (z) => {
    const t = (z + hz) / L;
    let y = s.sill;
    for (const wz of [fz, rz]) {
      const R = s.wr + 0.065, dz = z - wz;
      if (Math.abs(dz) < R) y = Math.max(y, s.wr + Math.sqrt(R * R - dz * dz));
    }
    const endT = Math.min(t, 1 - t);
    return Math.max(y, s.sill + (1 - clamp(endT / 0.06, 0, 1)) * 0.14);
  };
  const halfW = (z) => {
    const t = (z + hz) / L;
    let w = s.W / 2 - s.fender;
    for (const wz of [fz, rz]) w += s.fender * Math.exp(-(((z - wz) / 0.6) ** 2));
    w -= s.pinch * Math.exp(-((z / 0.7) ** 2));
    const endT = Math.min(t, 1 - t);
    return w * (0.86 + 0.14 * Math.sqrt(clamp(endT / 0.1, 0, 1)));
  };
  const rs0 = { classic: 0.2, roadster: 0.2, muscle: 0.1 }[s.style] ?? (s.round > 4 ? 0.08 : 0.12);
  const aB = Math.acos(0.55);
  // نقاط یک مقطع: از وسط پایین به سمت چپ (+x)، بالا، سمت راست و برگشت
  const ring = (z) => {
    const hw = halfW(z), tp = top(z);
    let bump = 0;
    for (const wz of [fz, rz]) bump = Math.max(bump, Math.max(0, s.wr * 2 + 0.11 - tp) * Math.exp(-(((z - wz) / 0.5) ** 2)));
    const bt = Math.min(bottom(z), tp + bump - 0.04);
    const crown = z > zA ? 0.035 : z < zD ? 0.02 : 0;
    const rs = Math.min(rs0, hw * 0.45, (tp - bt) * 0.9);
    let rb = 0.06; let sideBot = bt + rb;
    if (sideBot > tp - rs) { rb = Math.max(0.005, tp - rs - bt); sideBot = bt + rb; }
    const half = []; // [x, y, tag] tag: 0 normal, 1 belt vertex, 2 open-top
    for (let i = 0; i < 3; i++) half.push([(hw - rb) * i / 3, bt, 0]);
    for (let i = 0; i < 4; i++) { const a = -Math.PI / 2 + (Math.PI / 2) * i / 4; half.push([hw - rb + rb * Math.cos(a), bt + rb + rb * Math.sin(a), 0]); }
    for (let i = 0; i < 4; i++) half.push([hw, lerp(sideBot, tp - rs, i / 4), 0]);
    const arcA = [0, aB * 0.5, aB, aB + (Math.PI / 2 - aB) / 3, aB + (Math.PI / 2 - aB) * 2 / 3];
    arcA.forEach((a, i) => half.push([hw - rs + rs * Math.cos(a), tp - rs + rs * Math.sin(a), i === 2 ? 1 : i > 2 ? 2 : 0]));
    for (let i = 0; i <= 5; i++) { const x = (hw - rs) * (1 - i / 5); half.push([x, tp + crown * (1 - (x / hw) ** 2), 2]); }
    const H = Math.max(0.05, tp - bt);
    for (const p of half) {
      const f = clamp((p[1] - bt) / H, 0, 1); p[0] *= 1 - s.taper * 0.22 * f * f;
      if (bump > 0 && p[1] > bt + 0.02) p[1] += bump * clamp((Math.abs(p[0]) / hw - 0.35) / 0.45, 0, 1);
    }
    const full = half.map((p) => [p[0], p[1], p[2]]);
    for (let i = half.length - 2; i >= 0; i--) full.push([-half[i][0], half[i][1], half[i][2]]);
    let len = 0; const us = [0];
    for (let i = 1; i < full.length; i++) { len += Math.hypot(full[i][0] - full[i - 1][0], full[i][1] - full[i - 1][1]); us.push(len); }
    return full.map((p, i) => ({ x: p[0], y: p[1], tag: p[2], u: us[i] / len }));
  };
  const belt = (z) => { const r = ring(z); const p = r.find((q) => q.tag === 1); return p; };
  return { top, bottom, halfW, ring, belt, zA, zB, zC, zD };
}

function loftBody(s, prof) {
  const hz = s.L / 2;
  const NZ = 80;
  const zs = [];
  for (let i = 0; i <= NZ; i++) zs.push(-hz + (i / NZ) * s.L);
  // قرار دادن دقیق ایستگاه‌ها روی لبه کابین
  for (const zc of [prof.zA, prof.zD]) { let bi = 0, bd = 1e9; zs.forEach((z, i) => { if (Math.abs(z - zc) < bd) { bd = Math.abs(z - zc); bi = i; } }); zs[bi] = zc; }
  const pos = [], uv = [], idx = [];
  const rings = zs.map((z) => prof.ring(z));
  const NR = rings[0].length;
  const open = s.openCabin !== false;
  zs.forEach((z, i) => { for (const p of rings[i]) { pos.push(p.x, p.y, z); uv.push(p.u, i / NZ); } });
  const inCab = (z) => z >= prof.zD - 1e-4 && z <= prof.zA + 1e-4;
  for (let i = 0; i < NZ; i++) for (let k = 0; k < NR - 1; k++) {
    if (open && inCab(zs[i]) && inCab(zs[i + 1]) && (rings[i][k].tag === 2 || rings[i][k + 1].tag === 2)) continue;
    const a = i * NR + k, b = a + NR;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  for (const end of [0, NZ]) {
    const start = end * NR; let cy = 0;
    for (let k = 0; k < NR; k++) cy += pos[(start + k) * 3 + 1];
    cy /= NR; const ci = pos.length / 3;
    pos.push(0, cy, zs[end]); uv.push(0.5, end ? 1 : 0);
    for (let k = 0; k < NR - 1; k++) end ? idx.push(ci, start + k, start + k + 1) : idx.push(ci, start + k + 1, start + k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// اتاقک شیشه‌ای، سقف، ستون‌ها
function cabinGeometry(s, prof) {
  const { zA, zB, zC, zD } = prof;
  const roadster = s.style === 'roadster';
  const z0 = roadster ? zB - 0.02 : zD;
  const roofY = (z) => {
    const yA = prof.belt(zA).y, yD = prof.belt(zD).y;
    if (z >= zB) { const t = (z - zB) / (zA - zB); return lerp(s.roof, yA, Math.pow(t, 1.1)); }
    if (z <= zC) { const t = (zC - z) / (zC - zD); return lerp(s.roof, yD, Math.pow(t, 0.85)); }
    const t = (z - zC) / (zB - zC); return s.roof + Math.sin(t * Math.PI) * 0.012;
  };
  const beltW = (z) => Math.abs(prof.belt(z).x);
  const NZ = 30, NR = 16;
  const glass = [], gi = [], roof = [], ri = [];
  const pts = [];
  for (let i = 0; i <= NZ; i++) {
    const z = z0 + (zA - z0) * (i / NZ);
    const bp = prof.belt(z);
    const y0 = bp.y - 0.004, w0 = Math.abs(bp.x) - 0.004; const y1 = Math.max(y0, roofY(z));
    const w1 = w0 * (0.8 - s.taper * 0.22);
    const ring = [];
    for (let k = 0; k <= NR; k++) {
      const a = (k / NR) * Math.PI;
      const ca = Math.cos(a);
      const x = ca * lerp(w1, w0, Math.pow(Math.abs(ca), 2.5));
      const y = y0 + (y1 - y0) * Math.pow(Math.sin(a), 0.32);
      ring.push([x, y, z]);
    }
    pts.push(ring);
    for (const p of ring) glass.push(...p);
  }
  for (let i = 0; i < NZ; i++) for (let k = 0; k < NR; k++) { const a = i * (NR + 1) + k, b = a + NR + 1; gi.push(a, b, a + 1, a + 1, b, b + 1); }
  const kr0 = 3, kr1 = NR - 3;
  const rIdx = [];
  if (!roadster) for (let i = 0; i <= NZ; i++) { const z = pts[i][0][2]; if (z >= zC - 0.06 && z <= zB + 0.06) rIdx.push(i); }
  rIdx.forEach((i) => { for (let k = kr0; k <= kr1; k++) { const p = pts[i][k]; roof.push(p[0] * 1.012, p[1] + 0.01, p[2]); } });
  const rw = kr1 - kr0 + 1;
  for (let n = 0; n < rIdx.length - 1; n++) for (let k = 0; k < rw - 1; k++) { const a = n * rw + k, b = a + rw; ri.push(a, b, a + 1, a + 1, b, b + 1); }
  const mk = (p, i) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); if (i.length) g.setIndex(i); g.computeVertexNormals(); return g; };
  const pillars = [];
  const tube = (list, r) => { const c = new THREE.CatmullRomCurve3(list.map((p) => new THREE.Vector3(...p))); return new THREE.TubeGeometry(c, Math.max(4, list.length * 2), r, 6, false); };
  const zi = (z) => clamp(Math.round(NZ * ((z - z0) / (zA - z0))), 0, NZ);
  const iB = zi(zB), iC = zi(zC);
  for (const k of [kr0 - 1, kr1 + 1]) {
    const aPts = []; for (let i = iB; i <= NZ; i++) aPts.push(pts[i][k]); if (aPts.length > 1) pillars.push(tube(aPts, 0.028));
    if (!roadster) {
      const cPts = []; for (let i = 0; i <= iC; i++) cPts.push(pts[i][k]); if (cPts.length > 1) pillars.push(tube(cPts, 0.045));
      const mid = clamp(Math.round(iC + (iB - iC) * 0.42), 1, NZ - 1);
      const kk = k < NR / 2 ? 0 : NR;
      pillars.push(tube([pts[mid][kk], pts[mid][k]], 0.026));
      const rl = []; for (let i = iC; i <= iB; i++) rl.push(pts[i][k]); if (rl.length > 1) pillars.push(tube(rl, 0.022));
    }
  }
  if (roadster) { const top = []; for (let k = kr0 - 1; k <= kr1 + 1; k++) top.push(pts[iB][k]); pillars.push(tube(top, 0.02)); }
  const trims = [];
  for (const k of [0, NR]) { const l = []; for (let i = 0; i <= NZ; i++) l.push(pts[i][k]); trims.push(tube(l, 0.011)); }
  // در رودستر، شیشه فقط جلو است
  let glassGeo = mk(glass, gi);
  if (roadster) {
    const gi2 = []; for (let i = iB; i < NZ; i++) for (let k = 0; k < NR; k++) { const a = i * (NR + 1) + k, b = a + NR + 1; gi2.push(a, b, a + 1, a + 1, b, b + 1); }
    glassGeo = mk(glass, gi2);
  }
  return { glass: glassGeo, roof: rIdx.length ? mk(roof, ri) : null, pillars: mergeGeos(pillars), trims: mergeGeos(trims), zA, zB, zC, zD, roofY, beltW };
}

// ---------- چرخ ----------
const wheelCache = new Map();
function wheelGeos(s, rimStyle) {
  const key = s.wr + '_' + s.tw + '_' + rimStyle;
  if (wheelCache.has(key)) return wheelCache.get(key);
  const R = s.wr, W = s.tw, rr = R * 0.66;
  const prof = [[rr, -W / 2], [R - 0.035, -W / 2 - 0.005], [R - 0.008, -W / 2 + 0.02], [R, -W / 2 + 0.05], [R, W / 2 - 0.05], [R - 0.008, W / 2 - 0.02], [R - 0.035, W / 2 + 0.005], [rr, W / 2]];
  const tire = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 40); tire.rotateZ(Math.PI / 2);
  // آج لاستیک
  const tread = [];
  for (let i = 0; i < 36; i++) { const b = new THREE.BoxGeometry(W * 0.84, 0.012, 0.03); b.translate(0, R + 0.002, 0); b.rotateX((i / 36) * Math.PI * 2); tread.push(b); }
  const rim = [];
  const barrel = new THREE.CylinderGeometry(rr, rr, W * 0.86, 32, 1, true); barrel.rotateZ(Math.PI / 2); rim.push(barrel);
  const face = (g) => { g.rotateZ(Math.PI / 2); g.translate(W * 0.3, 0, 0); return g; };
  if (rimStyle === 0) {
    rim.push(face(new THREE.CylinderGeometry(rr * 0.98, rr * 0.98, 0.02, 32)));
    const cap = new THREE.SphereGeometry(rr * 0.62, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.32); cap.scale(1, 0.55, 1); cap.rotateZ(-Math.PI / 2); cap.translate(W * 0.31, 0, 0); rim.push(cap);
    const ring = new THREE.TorusGeometry(rr * 0.82, 0.012, 6, 32); ring.rotateY(Math.PI / 2); ring.translate(W * 0.32, 0, 0); rim.push(ring);
  } else if (rimStyle === 1) {
    for (let i = 0; i < 28; i++) { const sp = new THREE.CylinderGeometry(0.0035, 0.0035, rr * 0.92, 4); sp.translate(0, rr * 0.46, 0); sp.rotateZ(((i % 2) - 0.5) * 0.35); sp.rotateX((i / 28) * Math.PI * 2); sp.translate(W * 0.18 + (i % 2) * 0.04, 0, 0); rim.push(sp); }
    const hub = new THREE.CylinderGeometry(rr * 0.22, rr * 0.28, 0.12, 12); hub.rotateZ(Math.PI / 2); hub.translate(W * 0.28, 0, 0); rim.push(hub);
    const knock = new THREE.TorusGeometry(rr * 0.2, 0.02, 4, 3); knock.rotateY(Math.PI / 2); knock.translate(W * 0.36, 0, 0); rim.push(knock);
  } else {
    const n = rimStyle === 2 ? 5 : rimStyle === 3 ? 10 : 14;
    for (let i = 0; i < n; i++) {
      const w = rimStyle === 2 ? 0.07 : rimStyle === 3 ? 0.032 : 0.022;
      const sp = new THREE.BoxGeometry(0.035, rr * 0.86, w); sp.translate(0, rr * 0.48, 0);
      if (rimStyle === 4) sp.rotateY(0.6);
      sp.rotateX((i / n) * Math.PI * 2); sp.translate(W * 0.3, 0, 0); rim.push(sp);
    }
    const hub = new THREE.CylinderGeometry(rr * 0.24, rr * 0.26, 0.05, 20); hub.rotateZ(Math.PI / 2); hub.translate(W * 0.3, 0, 0); rim.push(hub);
    const lip = new THREE.TorusGeometry(rr * 0.98, 0.012, 6, 40); lip.rotateY(Math.PI / 2); lip.translate(W * 0.36, 0, 0); rim.push(lip);
  }
  const nuts = [];
  for (let i = 0; i < 5; i++) { const n = new THREE.CylinderGeometry(0.011, 0.011, 0.03, 6); n.rotateZ(Math.PI / 2); n.translate(W * 0.34, Math.cos(i / 5 * Math.PI * 2) * rr * 0.14, Math.sin(i / 5 * Math.PI * 2) * rr * 0.14); nuts.push(n); }
  const disc = new THREE.CylinderGeometry(rr * 0.82, rr * 0.82, 0.025, 32); disc.rotateZ(Math.PI / 2); disc.translate(-W * 0.05, 0, 0);
  const res = { tire: mergeGeos([tire, ...tread]), rim: mergeGeos(rim), nuts: mergeGeos(nuts), disc, ww: new THREE.RingGeometry(R * 0.74, R * 0.88, 40) };
  res.ww.rotateY(Math.PI / 2); res.ww.translate(W / 2 + 0.006, 0, 0);
  wheelCache.set(key, res);
  return res;
}

function buildWheel(s, custom, side, front, modern) {
  const m = mats();
  const g = wheelGeos(s, custom.rims ?? 0);
  const root = new THREE.Group(); root.userData.dynamic = true;
  const spin = new THREE.Group(); root.add(spin);
  const tire = new THREE.Mesh(g.tire, m.rubber); tire.castShadow = true; spin.add(tire);
  const rimMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(CUSTOM.rimColor.hex[custom.rimColor || 0]), metalness: (custom.rimColor === 3) ? 0.5 : 1, roughness: custom.rimColor === 0 ? 0.08 : 0.28 });
  const rim = new THREE.Mesh(g.rim, rimMat); rim.castShadow = true; spin.add(rim);
  spin.add(new THREE.Mesh(g.nuts, m.chrome));
  if (!modern && (custom.rims ?? 0) <= 1) { const ww = new THREE.Mesh(g.ww, m.whitewall); spin.add(ww); }
  if (modern) {
    const disc = new THREE.Mesh(g.disc, m.disc); spin.add(disc);
    const cal = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.16, 0.12, 2, 0.02), new THREE.MeshStandardMaterial({ color: 0xd11a1a, roughness: 0.4 }));
    cal.position.set(-s.tw * 0.02, s.wr * 0.4, front ? -0.1 : 0.1); root.add(cal);
  }
  if (side < 0) root.scale.x = -1;
  return { root, spin, rimMat };
}

// ---------- فضای داخلی: صندلی‌های جلو، فرمان، دنده، پدال، داشبورد ----------
function seatGeo(style) {
  const parts = [];
  const cush = new RoundedBoxGeometry(0.5, 0.12, 0.5, 3, 0.05); cush.translate(0, 0.06, 0); parts.push(cush);
  const back = new RoundedBoxGeometry(0.5, 0.62, 0.12, 3, 0.05); back.translate(0, 0.36, -0.26); back.rotateX(-0.18); parts.push(back);
  if (style !== 'classic') {
    for (const sx of [1, -1]) {
      const b1 = new RoundedBoxGeometry(0.08, 0.16, 0.46, 2, 0.035); b1.translate(sx * 0.24, 0.12, 0); parts.push(b1);
      const b2 = new RoundedBoxGeometry(0.08, 0.46, 0.14, 2, 0.035); b2.translate(sx * 0.25, 0.36, -0.24); b2.rotateX(-0.18); parts.push(b2);
    }
  }
  const head = new RoundedBoxGeometry(style === 'race' ? 0.42 : 0.28, style === 'race' ? 0.3 : 0.2, 0.1, 2, 0.04);
  head.translate(0, style === 'race' ? 0.82 : 0.8, -0.38); head.rotateX(-0.18); parts.push(head);
  return mergeGeos(parts);
}

function buildInterior(s, cab, custom, isPlayer, team, L) {
  const m = mats();
  const grp = new THREE.Group();
  const style = s.interior;
  const seatMat = style === 'classic' ? m.leatherBrown : style === 'race' ? m.alcantara : (isPlayer ? m.leatherRed : m.leatherBlack);
  const { floorY, seatY, seatZ } = L;
  // کف و تونل وسط
  const floor = new THREE.Mesh(new THREE.BoxGeometry(2 * cab.beltW(seatZ) - 0.1, 0.04, cab.zA - cab.zD + 0.3), m.carpet);
  floor.position.set(0, floorY - 0.02, (cab.zA + cab.zD) / 2 + 0.1); grp.add(floor);
  const tunnel = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.24, 1.4, 2, 0.05), m.dash);
  tunnel.position.set(0, floorY + 0.1, seatZ + 0.45); grp.add(tunnel);
  // دیواره پشت صندلی‌ها (فقط دو صندلی جلو)
  const bulkH = s.belt - floorY + 0.05;
  const bulk = new THREE.Mesh(new THREE.BoxGeometry(2 * cab.beltW(seatZ - 0.5) - 0.08, bulkH, 0.05), m.carpet);
  bulk.position.set(0, floorY + bulkH / 2, seatZ - 0.5); grp.add(bulk);
  const shelfD = Math.max(0.15, (seatZ - 0.5) - cab.zD);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(2 * cab.beltW(seatZ - 0.6) - 0.1, 0.03, shelfD), m.carpet);
  shelf.position.set(0, s.belt + 0.02, (seatZ - 0.5) - shelfD / 2); grp.add(shelf);
  // صندلی‌های جلو
  const sg = seatGeo(style);
  for (const sx of [s.seatX, -s.seatX]) {
    const seat = new THREE.Mesh(sg, seatMat); seat.position.set(sx, seatY, seatZ); seat.rotation.x = -L.recline * 0.5; seat.castShadow = true; grp.add(seat);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.4, Math.max(0.03, seatY - floorY), 0.5), m.black); rail.position.set(sx, (seatY + floorY) / 2, seatZ); grp.add(rail);
  }
  // پنل داخلی درها
  for (const sx of [1, -1]) {
    const dz0 = Math.max(cab.zD, seatZ - 0.55), dz1 = cab.zA - 0.02, dzm = (dz0 + dz1) / 2;
    const bx = Math.min(cab.beltW(dz0), cab.beltW(dz1), cab.beltW(dzm)) - 0.05;
    const dp = new THREE.Mesh(new THREE.BoxGeometry(0.04, s.belt - floorY - 0.02, dz1 - dz0), style === 'classic' ? m.leatherBrown : m.dash);
    dp.position.set(sx * bx, (s.belt + floorY) / 2 - 0.02, dzm); grp.add(dp);
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.05, 0.4, 2, 0.02), seatMat); arm.position.set(sx * (bx - 0.05), s.belt - 0.14, seatZ + 0.2); grp.add(arm);
  }
  // داشبورد (باریک تا پدال‌ها هم دیده شوند)
  const dashZ = cab.zA - 0.24;
  const dW = 2 * (cab.beltW(dashZ + 0.15) - 0.06);
  const dash = new THREE.Mesh(new RoundedBoxGeometry(dW, 0.12, 0.3, 3, 0.05), style === 'classic' ? m.wood : style === 'race' ? m.carbon : m.dash);
  dash.position.set(0, s.belt - 0.03, dashZ); grp.add(dash);
  const dashTop = new THREE.Mesh(new RoundedBoxGeometry(dW - 0.02, 0.05, 0.4, 2, 0.02), m.dash);
  dashTop.position.set(0, s.belt + 0.03, dashZ + 0.02); grp.add(dashTop);
  const hood = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.08, 0.16, 2, 0.03), m.dash);
  hood.position.set(s.seatX, s.belt + 0.07, dashZ - 0.06); grp.add(hood);
  // کنسول وسط
  const stack = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.28, 0.1, 2, 0.03), m.dash);
  stack.position.set(0, s.belt - 0.2, dashZ - 0.08); stack.rotation.x = 0.35; grp.add(stack);
  const radio = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.06), new THREE.MeshStandardMaterial({ color: 0x0a2030, emissive: 0x2a9fff, emissiveIntensity: 0.4 }));
  radio.position.set(0, s.belt - 0.15, dashZ - 0.14); radio.rotation.set(0.35, Math.PI, 0); grp.add(radio);
  // صفحه کیلومتر و دور موتور
  const wheelX = s.seatX;
  const gaugeStyle = style === 'classic' ? 'classic' : 'modern';
  const gaugeR = 0.065;
  const gauges = [];
  for (const [ox, tex] of [[-0.075, T.gaugeFace(gaugeStyle, 'km/h', Math.ceil(s.vmaxKmh / 20) * 20 + 20)], [0.075, T.gaugeFace(gaugeStyle, 'x1000 rpm', 8)]]) {
    const g = new THREE.Mesh(new THREE.CircleGeometry(gaugeR, 32), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.4, roughness: 0.3 }));
    g.position.set(wheelX + ox, s.belt + 0.03, dashZ - 0.152); g.rotation.set(-0.25, Math.PI, 0); grp.add(g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(gaugeR + 0.006, 0.007, 6, 32), m.chrome); ring.position.copy(g.position); ring.rotation.copy(g.rotation); grp.add(ring);
    const needle = new THREE.Group(); needle.userData.dynamic = true; needle.position.copy(g.position); needle.rotation.copy(g.rotation);
    const inner = new THREE.Group(); inner.position.z = 0.004; needle.add(inner);
    const nm = new THREE.Mesh(new THREE.BoxGeometry(0.004, gaugeR * 0.85, 0.002), new THREE.MeshBasicMaterial({ color: 0xff3010 })); nm.position.y = gaugeR * 0.38; inner.add(nm);
    grp.add(needle); gauges.push(inner);
  }
  // فرمان (دقیقاً زیر دست‌های راننده)
  const steer = new THREE.Group(); steer.userData.dynamic = true;
  const steerInner = new THREE.Group(); steer.add(steerInner);
  const rimMat = style === 'classic' ? m.wood : m.leatherBlack;
  const wR = L.wheelR;
  steerInner.add(new THREE.Mesh(new THREE.TorusGeometry(wR, 0.017, 10, 44), rimMat));
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i - 1) * (Math.PI * 0.6);
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.022, wR, 0.012), style === 'classic' ? m.chrome : m.aluminium);
    sp.position.set(Math.cos(a) * wR / 2, Math.sin(a) * wR / 2, 0); sp.rotation.z = a + Math.PI / 2; steerInner.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 20), m.black); hub.rotation.x = Math.PI / 2; steerInner.add(hub);
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.03, 20), new THREE.MeshStandardMaterial({ color: 0xd4a531, metalness: 0.8, roughness: 0.2 })); badge.position.z = -0.027; badge.rotation.y = Math.PI; steerInner.add(badge);
  const colLen = clamp(dashZ - L.wheelPos.z, 0.15, 0.42);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, colLen + 0.1, 10), m.black);
  column.rotation.x = Math.PI / 2; column.position.z = (colLen + 0.1) / 2; steer.add(column);
  steer.position.copy(L.wheelPos); steer.rotation.x = L.wheelTilt; grp.add(steer);
  // دنده
  const gear = new THREE.Group(); gear.userData.dynamic = true;
  gear.position.set(0, floorY + 0.22, seatZ + 0.5); grp.add(gear);
  const boot = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.08, 12), m.leatherBlack); gear.add(boot);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.2, 8), m.chrome); stick.position.y = 0.1; gear.add(stick);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), style === 'classic' ? m.wood : m.aluminium); knob.position.y = 0.21; gear.add(knob);
  const plateG = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 0.16), m.aluminium); plateG.position.set(0, floorY + 0.222, seatZ + 0.5); grp.add(plateG);
  // ترمز دستی
  const hb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.22), m.black); hb.position.set(0, floorY + 0.24, seatZ + 0.15); hb.rotation.x = 0.25; grp.add(hb);
  // پدال‌ها: کلاچ، ترمز، گاز (زیر پای راننده)
  const pedals = {};
  for (const [name, ox, w] of [['clutch', 0.11, 0.07], ['brake', 0.0, 0.08], ['gas', -0.12, 0.05]]) {
    const pg = new THREE.Group(); pg.userData.dynamic = true;
    pg.position.set(wheelX + ox, L.pedalY + 0.2, L.pedalZ);
    const armP = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.2, 0.015), m.pedal); armP.position.y = -0.1; pg.add(armP);
    const pad = new THREE.Mesh(new RoundedBoxGeometry(w, name === 'gas' ? 0.13 : 0.07, 0.02, 2, 0.006), m.pedal); pad.position.set(0, -0.2, -0.01); pad.rotation.x = 0.45; pg.add(pad);
    grp.add(pg); pedals[name] = pg;
  }
  const fwZ = Math.min(L.pedalZ + 0.12, cab.zA + 0.25);
  const fwTop = Math.min(s.belt, L.topAt(fwZ) - 0.05);
  const firewall = new THREE.Mesh(new THREE.BoxGeometry(2 * cab.beltW(Math.min(fwZ, cab.zA)) - 0.12, fwTop - floorY, 0.04), m.carpet);
  firewall.position.set(0, (fwTop + floorY) / 2, fwZ); grp.add(firewall);
  // آینه وسط
  const mir = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.06, 0.03, 2, 0.012), m.black);
  mir.position.set(0, cab.roofY(cab.zB + 0.05) - 0.09, cab.zB + 0.06); grp.add(mir);
  const mirGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.045), m.chrome); mirGlass.position.set(0, mir.position.y, mir.position.z - 0.016); mirGlass.rotation.y = Math.PI; grp.add(mirGlass);
  // رول‌کیج برای ماشین‌های مسابقه‌ای
  if (style === 'race') {
    const pts = [[s.W / 2 - 0.26, floorY, seatZ - 0.46], [s.W / 2 - 0.3, s.roof - 0.12, seatZ - 0.42], [-(s.W / 2 - 0.3), s.roof - 0.12, seatZ - 0.42], [-(s.W / 2 - 0.26), floorY, seatZ - 0.46]];
    const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.1);
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(c, 20, 0.02, 6), m.aluminium));
  }
  return { grp, steer: steerInner, gear, pedals, gauges, seatZ, seatY, floorY };
}

// ---------- ساخت کامل ماشین ----------
export function buildCar(car, custom = defaultCustom(car), { isPlayer = false, team = 0xffffff, number = 7, driverOpts = {}, lowDetail = false, noDriver = false } = {}) {
  const m = mats();
  const s = shapeFor(car.style);
  s.vmaxKmh = car.top;
  const modern = !['classic', 'roadster', 'muscle'].includes(car.style);
  const prof = bodyProfile(s);
  const root = new THREE.Group(); root.name = 'car-' + car.id;
  const body = new THREE.Group(); root.add(body);
  const paint = paintMat(custom);
  const livery = liveryTexture(custom); paint.map = livery;
  const bodyGeo = loftBody(s, prof);
  const bodyMesh = new THREE.Mesh(bodyGeo, paint); bodyMesh.castShadow = true; bodyMesh.receiveShadow = true; body.add(bodyMesh);
  // شاسی تیره داخل گلگیرها
  const pan = new THREE.Mesh(new THREE.BoxGeometry(s.W - 2 * s.tw - 0.2, 0.05, s.wb - 0.4), m.under); pan.position.y = Math.max(0.1, s.sill - 0.06); body.add(pan);
  for (const wz of [s.wb / 2, -s.wb / 2]) {
    const well = new THREE.Mesh(new THREE.CylinderGeometry(s.wr + 0.05, s.wr + 0.05, s.W - 0.16, 24, 1, true, 0, Math.PI), m.under);
    well.rotation.z = Math.PI / 2; well.rotation.y = 0; well.position.set(0, s.wr, wz); well.material = m.under; body.add(well);
  }
  // اتاق و شیشه‌ها
  const cab = cabinGeometry(s, prof);
  const glass = new THREE.Mesh(cab.glass, glassMat(custom.tint || 0)); glass.renderOrder = 2; glass.userData.keep = true; body.add(glass);
  if (cab.roof) { const roof = new THREE.Mesh(cab.roof, paint); roof.castShadow = true; body.add(roof); }
  const pillars = new THREE.Mesh(cab.pillars, car.style === 'roadster' ? m.chrome : paint); pillars.castShadow = true; body.add(pillars);
  const trims = new THREE.Mesh(cab.trims, modern ? m.black : m.chrome); body.add(trims);
  const hz = s.L / 2;
  const frontZ = hz - 0.01, rearZ = -hz + 0.01;
  const fy = prof.top(hz - 0.05), ry = prof.top(-hz + 0.05);
  const fBot = prof.bottom(hz - 0.05), rBot = prof.bottom(-hz + 0.05);
  const fW = prof.halfW(hz - 0.04), rW = prof.halfW(-hz + 0.04);
  // چراغ‌های جلو
  const lightY = lerp(fBot, fy, 0.62);
  const headMat = m.headGlass;
  if (s.lights === 'round' || s.lights === 'quad') {
    const xs = s.lights === 'quad' ? [fW * 0.72, fW * 0.48] : [fW * 0.66];
    for (const x of xs) for (const sx of [1, -1]) {
      const r = s.lights === 'quad' ? 0.07 : 0.095;
      const lens = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.35), headMat);
      lens.rotation.x = Math.PI / 2; lens.position.set(sx * x, lightY, frontZ - 0.04); body.add(lens);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 8, 24), m.chrome); ring.position.set(sx * x, lightY, frontZ - 0.01); body.add(ring);
    }
  } else if (s.lights === 'popup') {
    for (const sx of [1, -1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.05), headMat); l.position.set(sx * fW * 0.6, lightY, frontZ - 0.02); body.add(l); }
  } else {
    for (const sx of [1, -1]) {
      const l = new THREE.Mesh(new RoundedBoxGeometry(s.lights === 'rect' ? 0.32 : 0.38, s.lights === 'rect' ? 0.08 : 0.035, 0.05, 2, 0.015), headMat);
      l.position.set(sx * fW * 0.62, lightY + 0.02, frontZ - 0.03); l.rotation.z = sx * 0.08; body.add(l);
      const drl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.02), headMat); drl.position.set(sx * fW * 0.6, lightY - 0.05, frontZ - 0.02); body.add(drl);
    }
  }
  // جلوپنجره
  const gW = s.grille === 'wide' ? fW * 1.1 : s.grille === 'oval' ? fW * 0.55 : fW * 0.7, gH = s.grille === 'slot' ? 0.05 : 0.14;
  const grilleY = lerp(fBot, fy, s.grille === 'slot' ? 0.3 : 0.42);
  const gbg = new THREE.Mesh(new RoundedBoxGeometry(gW, gH, 0.04, 2, 0.02), m.grilleBg); gbg.position.set(0, grilleY, frontZ - 0.015); body.add(gbg);
  if (s.grille === 'classic' || s.grille === 'wide' || s.grille === 'oval') {
    const bars = [];
    for (let i = 0; i < 9; i++) { const b = new THREE.BoxGeometry(0.012, gH * 0.9, 0.02); b.translate(-gW / 2 + gW * (i + 0.5) / 9, 0, 0); bars.push(b); }
    const fr = new THREE.Mesh(mergeGeos(bars), m.chrome); fr.position.set(0, grilleY, frontZ + 0.008); body.add(fr);
  }
  // سپرها
  if (s.bumper === 'chrome') {
    for (const [z, y, w] of [[frontZ + 0.04, fBot + 0.05, fW * 2.05], [rearZ - 0.04, rBot + 0.05, rW * 2.05]]) {
      const b = new THREE.Mesh(new RoundedBoxGeometry(w, 0.08, 0.09, 3, 0.035), m.chrome); b.position.set(0, y, z); b.castShadow = true; body.add(b);
    }
  } else {
    const spl = new THREE.Mesh(new THREE.BoxGeometry(fW * 1.9, 0.025, 0.12), m.carbon); spl.position.set(0, s.sill - 0.04, frontZ - 0.05); body.add(spl);
    const diff = new THREE.Mesh(new THREE.BoxGeometry(rW * 1.6, 0.12, 0.25), m.carbon); diff.position.set(0, s.sill - 0.02, rearZ + 0.1); diff.rotation.x = -0.25; body.add(diff);
    for (const sx of [1, -1]) {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, s.wb - 0.9), m.carbon); skirt.position.set(sx * (s.W / 2 - 0.04), s.sill + 0.02, 0); body.add(skirt);
      const intake = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.1, 0.03, 2, 0.02), m.grilleBg); intake.position.set(sx * fW * 0.62, grilleY - 0.03, frontZ - 0.005); body.add(intake);
    }
  }
  // چراغ‌های عقب
  const brakeMat = m.redGlass.clone(); brakeMat.userData.dynamic = true;
  const tailY = lerp(rBot, ry, 0.6);
  if (!modern) {
    for (const sx of [1, -1]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 20), brakeMat); t.rotation.x = Math.PI / 2; t.position.set(sx * rW * 0.68, tailY, rearZ + 0.005); body.add(t); }
  } else {
    const bar = new THREE.Mesh(new RoundedBoxGeometry(rW * 1.8, 0.04, 0.04, 2, 0.015), brakeMat); bar.position.set(0, tailY, rearZ + 0.01); body.add(bar);
    for (const sx of [1, -1]) { const t = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.08, 0.04, 2, 0.02), brakeMat); t.position.set(sx * rW * 0.7, tailY, rearZ + 0.012); body.add(t); }
  }
  // پلاک
  const plateMat = new THREE.MeshStandardMaterial({ map: T.plate(isPlayer ? 'قهرمان' : car.en.split(' ')[0].toUpperCase().slice(0, 6)), roughness: 0.5 });
  for (const [z, y, rot] of [[frontZ + 0.012, fBot + 0.14, 0], [rearZ - 0.012, rBot + 0.16, Math.PI]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.105), plateMat); p.position.set(0, y, z); p.rotation.y = rot; body.add(p); }
  // اگزوز
  const ex = []; const n = s.exhaust;
  for (let i = 0; i < n; i++) { const x = n === 1 ? rW * 0.5 : (i - (n - 1) / 2) * (n > 2 ? 0.16 : rW * 1.1); const e = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.2, 14, 1, true), m.chrome); e.rotation.x = Math.PI / 2; e.position.set(x, s.sill + 0.03, rearZ - 0.02); body.add(e); ex.push(e.position.clone()); }
  // آینه‌های بغل
  for (const sx of [1, -1]) {
    const mm = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.08, 0.13, 2, 0.025), modern ? paint : m.chrome);
    mm.position.set(sx * (cab.beltW(cab.zA - 0.1) + 0.09), s.belt + 0.07, cab.zA - 0.1); body.add(mm);
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.03), m.black); stalk.position.set(sx * (cab.beltW(cab.zA - 0.1) + 0.03), s.belt + 0.04, cab.zA - 0.08); body.add(stalk);
  }
  // دستگیره درها و خطوط در
  const doorZ1 = cab.zA - 0.05, doorZ2 = (cab.zB + cab.zC) / 2 - 0.45;
  for (const sx of [1, -1]) {
    const x = sx * (prof.halfW((doorZ1 + doorZ2) / 2) * (1 - s.taper * 0.08) + 0.002);
    for (const dz of [doorZ1, doorZ2]) { const ln = new THREE.Mesh(new THREE.BoxGeometry(0.006, s.belt - s.sill - 0.12, 0.006), m.black); ln.position.set(sx * (prof.halfW(dz) * 0.985 + 0.003), (s.belt + s.sill) / 2 + 0.02, dz); body.add(ln); }
    const h = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.025, 0.12, 2, 0.008), m.chrome); h.position.set(x + sx * 0.008, s.belt - 0.08, doorZ2 + 0.12); body.add(h);
    // شماره مسابقه روی در
    const rn = new THREE.Mesh(new THREE.CircleGeometry(0.19, 32), new THREE.MeshStandardMaterial({ map: T.roundel(number, '#' + new THREE.Color(team).getHexString()), roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2 }));
    const rz = (doorZ1 + doorZ2) / 2 + 0.05;
    rn.position.set(sx * (prof.halfW(rz) * 0.99 + 0.012), (s.belt + s.sill) / 2 + 0.04, rz); rn.rotation.y = sx * Math.PI / 2; body.add(rn);
  }
  // کاپوت: دریچه هوا برای ماسل و باله برای هایپر
  if (s.scoop) { const sc = new THREE.Mesh(new RoundedBoxGeometry(0.45, 0.08, 0.6, 2, 0.03), paint); sc.position.set(0, prof.top(cab.zA + 0.6) + 0.02, cab.zA + 0.6); body.add(sc); const sh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.02), m.grilleBg); sh.position.set(0, prof.top(cab.zA + 0.6) + 0.03, cab.zA + 0.9); body.add(sh); }
  if (s.fin) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 1.2), paint); fin.position.set(0, prof.top(-hz + 0.9) + 0.08, -hz + 0.9); body.add(fin); }
  // اسپویلر
  const spoiler = custom.spoiler || (s.wing ? 3 : 0);
  if (spoiler === 1) { const d = new THREE.Mesh(new RoundedBoxGeometry(rW * 1.7, 0.05, 0.22, 2, 0.02), paint); d.position.set(0, ry + 0.04, rearZ + 0.18); d.rotation.x = 0.25; body.add(d); }
  else if (spoiler >= 2) {
    const big = spoiler === 3; const wy = ry + (big ? 0.34 : 0.18);
    const wing = new THREE.Mesh(new RoundedBoxGeometry(rW * (big ? 2.0 : 1.75), 0.035, big ? 0.32 : 0.24, 2, 0.015), big ? m.carbon : paint);
    wing.position.set(0, wy, rearZ + 0.22); wing.rotation.x = -0.12; wing.castShadow = true; body.add(wing);
    for (const sx of [1, -1]) {
      const up = new THREE.Mesh(new THREE.BoxGeometry(0.03, wy - ry + 0.02, 0.12), m.black); up.position.set(sx * rW * 0.55, (wy + ry) / 2, rearZ + 0.25); body.add(up);
      if (big) { const ep = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.2, 0.38), m.carbon); ep.position.set(sx * rW * 1.0, wy, rearZ + 0.22); body.add(ep); }
    }
  }
  // نئون زیر ماشین
  let neon = null;
  if (custom.neon) {
    const hex = CUSTOM.neon.hex[custom.neon];
    const glowTex = T.softDot();
    const nm = hex === 'rainbow' ? patternMaterial('rainbow', { emissive: 0xffffff, emissiveIntensity: 0.0, alphaMap: glowTex }) : new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(2.2), alphaMap: glowTex });
    neon = new THREE.Mesh(new THREE.PlaneGeometry(s.W + 1.2, s.L + 1.0), nm); neon.rotation.x = -Math.PI / 2; neon.position.y = 0.035; neon.userData.keep = true;
    nm.transparent = true; nm.opacity = 0.9; nm.depthWrite = false; nm.blending = THREE.AdditiveBlending;
    // نوار نورانی زیر بدنه
    const tube = new THREE.Mesh(new THREE.BoxGeometry(s.W - 0.5, 0.02, s.L - 1.0), hex === 'rainbow' ? patternMaterial('rainbow') : new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(3) }));
    tube.position.y = s.sill - 0.08; tube.userData.keep = true; root.add(tube);
    root.add(neon);
  }
  // سایه نرم زیر ماشین
  const shadowTex = T.softDot();
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(s.W + 0.5, s.L + 0.6), new THREE.MeshBasicMaterial({ map: shadowTex, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.025; blob.userData.keep = true; root.add(blob);

  // راننده (همیشه ساخته می‌شود تا جای فرمان و پدال از روی دست و پای او تنظیم شود)
  const floorY = Math.max(0.1, s.sill - 0.08);
  const seatZ = (cab.zB + cab.zC) / 2 - 0.1;
  const seatY = floorY + 0.08;
  const suit = CUSTOM.suit.hex[isPlayer ? (custom.suit || 0) : 1];
  const dOpts = { detail: lowDetail ? 'lo' : 'hi', helmet: isPlayer ? 0xffc21a : team, helmetStripe: isPlayer ? 0xff3a00 : 0xffffff, gloves: 0x151515, longSleeve: true, shoes: 0x111111, ...driverOpts };
  if (isPlayer && suit === 'fire') { const fm = patternMaterial('fire'); dOpts.shirtMat = fm; dOpts.pantsMat = fm; }
  else { dOpts.shirt = isPlayer ? new THREE.Color(suit).getHex() : team; dOpts.pants = dOpts.shirt; }
  const driver = buildHuman(dOpts);
  driver.root.scale.setScalar(0.96);
  driver.root.position.set(s.seatX, seatY + 0.13, seatZ + 0.03);
  let recline = { classic: 0.1, modern: 0.22, race: 0.38 }[s.interior];
  const tmp = new THREE.Vector3();
  for (let it = 0; it < 12; it++) {
    driver.pose('drive', { seatY: 0, steer: 0, recline });
    driver.root.updateMatrixWorld(true);
    driver.j.head.localToWorld(tmp.set(0, 0.25, 0));
    const lim = cab.roofY(clamp(tmp.z, cab.zC, cab.zB)) - 0.06;
    if (tmp.y <= lim) break;
    recline += 0.05;
    if (recline > 0.6) { driver.root.position.y -= 0.02; }
  }
  const hl = driver.j.wristL.localToWorld(new THREE.Vector3(0, -0.075, 0.02));
  const hr = driver.j.wristR.localToWorld(new THREE.Vector3(0, -0.075, 0.02));
  const al = driver.j.ankleL.localToWorld(new THREE.Vector3(0, -0.03, 0.17));
  const ar = driver.j.ankleR.localToWorld(new THREE.Vector3(0, -0.03, 0.17));
  const layout = {
    floorY, seatY, seatZ, recline,
    wheelPos: hl.clone().add(hr).multiplyScalar(0.5),
    wheelR: clamp(hl.distanceTo(hr) / 2, 0.15, 0.21),
    wheelTilt: 0.38 + recline * 0.5,
    pedalZ: Math.min(cab.zA + 0.12, (al.z + ar.z) / 2 + 0.02), pedalY: Math.max(floorY, (al.y + ar.y) / 2 - 0.05), topAt: (z) => prof.top(z)
  };
  const interior = buildInterior(s, cab, custom, isPlayer, team, layout);
  body.add(interior.grp);
  body.add(driver.root);
  driver.root.traverse((o) => { o.userData.dynamic = true; });
  driver.root.visible = !noDriver;
  driver.recline = recline;
  const eye = driver.j.head.localToWorld(new THREE.Vector3(0, 0.13, 0.06));
  // چرخ‌ها
  const wheels = [];
  const wx = s.W / 2 - s.tw / 2 - 0.02;
  for (const [x, z, front] of [[wx, s.wb / 2, true], [-wx, s.wb / 2, true], [wx, -s.wb / 2, false], [-wx, -s.wb / 2, false]]) {
    const w = buildWheel(s, custom, Math.sign(x), front, modern);
    w.root.position.set(x, s.wr, z); root.add(w.root);
    wheels.push({ ...w, front, x, z });
  }
  // ادغام قطعات ثابت بدنه
  mergeStaticByMaterial(body);
  // چراغ ترمز و نور
  const api = {
    root, body, wheels, interior, driver, shape: s, paint, brakeMat, neon, exhaust: ex, eye, car, modern, livery,
    steerAngle: 0, wheelSpin: 0,
    setBrake(on) { brakeMat.emissiveIntensity = on ? 3.2 : 0.6; },
    setVisualState({ steer = 0, spin = 0, gear = 1, throttle = 0, brake = 0, speedKmh = 0, rpm = 0, roll = 0, pitch = 0, bounce = 0 }) {
      for (const w of wheels) { w.spin.rotation.x = spin; if (w.front) w.root.rotation.y = steer * 0.55; }
      body.rotation.z = roll; body.rotation.x = pitch; body.position.y = bounce;
      interior.steer.rotation.z = -steer * 2.2;
      const gp = [[0, 0], [-0.04, 0.05], [-0.04, -0.05], [0, 0.05], [0, -0.05], [0.04, 0.05], [0.04, -0.05]][clamp(gear, 0, 6)];
      interior.gear.rotation.z = gp[0] * 4; interior.gear.rotation.x = gp[1] * 4;
      interior.pedals.gas.rotation.x = throttle * 0.35; interior.pedals.brake.rotation.x = brake * 0.35;
      interior.gauges[0].rotation.z = Math.PI * 0.75 - (speedKmh / (Math.ceil(s.vmaxKmh / 20) * 20 + 20)) * Math.PI * 1.5;
      interior.gauges[1].rotation.z = Math.PI * 0.75 - (rpm / 8000) * Math.PI * 1.5;
      if (driver.root.visible) driver.pose('drive', { seatY: 0, steer, recline: driver.recline, gas: throttle });
      this.setBrake(brake > 0.1);
    }
  };
  root.userData.car = api;
  return api;
}

// پوشش پارچه‌ای روی ماشین قفل‌شده (در گاراژ)
export function buildCarCover(car) {
  const s = shapeFor(car.style);
  const prof = bodyProfile(s);
  const cab = cabinGeometry(s, prof);
  const NZ = 70, NR = 48; const hz = s.L / 2 + 0.12;
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= NZ; i++) {
    const t = i / NZ; const z = -hz + t * hz * 2;
    const zc = clamp(z, -s.L / 2 + 0.02, s.L / 2 - 0.02);
    let top = prof.top(zc) + 0.05;
    if (zc > cab.zD && zc < cab.zA) top = Math.max(top, cab.roofY(zc) + 0.05);
    const endF = Math.min(t, 1 - t);
    top *= 0.9 + 0.1 * Math.sqrt(clamp(endF / 0.06, 0, 1));
    const hw = prof.halfW(zc) + 0.07;
    for (let k = 0; k <= NR; k++) {
      const u = k / NR; const a = u * Math.PI; // از چپ تا راست روی سقف
      const c = Math.cos(a), sn = Math.sin(a);
      let x = hw * Math.sign(c) * Math.pow(Math.abs(c), 0.45);
      let y = top * Math.pow(sn, 0.18);
      const edge = Math.pow(Math.abs(c), 6);
      x *= 1 + edge * 0.08;
      y = Math.max(0.02, y - edge * 0.05);
      // چین و چروک پارچه
      const wr = Math.sin(z * 9 + k * 0.6) * 0.012 + Math.sin(z * 23 + k * 1.7) * 0.006;
      const fold = edge * Math.sin(z * 11) * 0.05;
      x += Math.sign(c) * (fold + wr);
      y += wr * (1 - edge);
      pos.push(x, y, z); uv.push(u * 4, t * 8);
    }
  }
  for (let i = 0; i < NZ; i++) for (let k = 0; k < NR; k++) { const a = i * (NR + 1) + k, b = a + NR + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  // دو انتهای جلو و عقب
  for (const end of [0, NZ]) {
    const st = end * (NR + 1); const ci = pos.length / 3; pos.push(0, pos[(st + NR / 2) * 3 + 1] * 0.5, pos[st * 3 + 2] + (end ? 0.06 : -0.06)); uv.push(2, end ? 8 : 0);
    for (let k = 0; k < NR; k++) end ? idx.push(ci, st + k + 1, st + k) : idx.push(ci, st + k, st + k + 1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const fab = T.fabric();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x22262f, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0x8890a0), sheenRoughness: 0.6, normalMap: fab, normalScale: new THREE.Vector2(0.6, 0.6), side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true;
  const grp = new THREE.Group(); grp.add(mesh);
  // بند دور پوشش
  const strap = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 6, 40), new THREE.MeshStandardMaterial({ color: 0xd4a531, metalness: 0.8, roughness: 0.3 }));
  strap.scale.set(s.W / 2 + 0.1, 0.5, 0.6); strap.rotation.y = Math.PI / 2; strap.position.y = 0.4; grp.add(strap);
  return grp;
}
