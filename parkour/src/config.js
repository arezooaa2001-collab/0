// تنظیمات و داده‌های ثابت بازی
export const GAME_TITLE = 'پارکور اوج';
export const MAX_LEVEL = 1000;

export const PHYS = {
  gravity: 28,
  fallMult: 1.22,
  baseSpeed: 7.4,
  speedPerUpgrade: 0.06,
  baseJump: 10.2,
  jumpPerUpgrade: 0.035,
  doubleJumpMult: 0.86,
  groundAccel: 75,
  groundDecel: 55,
  airAccel: 26,
  iceAccel: 7,
  coyote: 0.13,
  jumpBuffer: 0.15,
  jumpCut: 0.58,
  maxFall: 42,
  radius: 0.34,
  height: 1.78,
  slideHeight: 0.95,
  slideTime: 0.78,
  slideBoost: 1.28,
  slideCooldown: 0.35,
  wallRunTime: 1.35,
  wallRunGravity: 0.16,
  wallJumpPush: 6.5,
  bounceV: 21.5,
  stepHeight: 0.38,
  mantleMin: 0.25,
  mantleMax: 1.6,
  mantleTime: 0.34,
};

// محاسبهٔ زمان پرواز برای پرش با اختلاف ارتفاع dh (مثبت = بالا)
export function airTime(v0, dh, g = PHYS.gravity, fm = PHYS.fallMult) {
  const H = (v0 * v0) / (2 * g);
  if (dh > H) return -1;
  const tr = v0 / g;
  const tf = Math.sqrt((2 * (H - dh)) / (g * fm));
  return tr + tf;
}
export function jumpReach(dh, speed = PHYS.baseSpeed, v0 = PHYS.baseJump) {
  const t = airTime(v0, dh);
  return t < 0 ? 0 : speed * t;
}

export const MODES = [
  { id: 'forward', name: 'رو به جلو', desc: 'پارکور مستقیم به سمت جلو، از روی پشت‌بوم‌ها و سکوها.', unlock: 0, icon: '➜' },
  { id: 'down', name: 'از بالا به پایین', desc: 'از نوک برج‌های بلند شروع کن و سقوط‌کنان به پایین برس.', unlock: 10, icon: '⬇' },
  { id: 'up', name: 'از پایین به بالا', desc: 'از پایین یک برج غول‌پیکر شروع کن و تا ابرها بالا برو.', unlock: 20, icon: '⬆' },
];

export const SHOP_ITEMS = [
  { id: 'speed', name: 'سرعت دویدن', desc: 'هر سطح ۶٪ سریع‌تر می‌دوی.', max: 10, icon: '⚡', price: (lv) => Math.round(60 * Math.pow(1.62, lv)) },
  { id: 'jump', name: 'قدرت پرش', desc: 'هر سطح پرشت بلندتر و دورتر می‌شود.', max: 10, icon: '🦘', price: (lv) => Math.round(60 * Math.pow(1.62, lv)) },
  { id: 'doubleJump', name: 'پرش دوبل', desc: 'وسط هوا یک بار دیگر بپر (با پشتک!).', max: 1, icon: '🌀', price: () => 900 },
  { id: 'magnet', name: 'آهنربای سکه', desc: 'سکه‌های اطراف خودشان به سمتت می‌آیند.', max: 5, icon: '🧲', price: (lv) => Math.round(120 * Math.pow(1.8, lv)) },
];

export const OUTFITS = [
  { id: 'default', name: 'دونده', price: 0, colors: { shirt: '#ff6a3d', pants: '#1d2338', shoes: '#f4f4f4', accent: '#3de1ff', skin: '#e0ac86', hair: '#2a1a12' } },
  { id: 'ninja', name: 'نینجا', price: 400, colors: { shirt: '#16161d', pants: '#101015', shoes: '#22222a', accent: '#ff2a4d', skin: '#d9a17b', hair: '#0d0d0d' } },
  { id: 'gold', name: 'طلایی', price: 1500, colors: { shirt: '#f5c242', pants: '#5a3d12', shoes: '#fff1c2', accent: '#fff07a', skin: '#e3b089', hair: '#3b2414' } },
  { id: 'ice', name: 'یخی', price: 900, colors: { shirt: '#bfeeff', pants: '#2b5d8a', shoes: '#ffffff', accent: '#7af2ff', skin: '#f0c7a6', hair: '#d8f6ff' } },
  { id: 'toxic', name: 'سمی', price: 1200, colors: { shirt: '#4dff6a', pants: '#132a17', shoes: '#0c0c0c', accent: '#c6ff3d', skin: '#c99b78', hair: '#183d1e' } },
  { id: 'royal', name: 'سلطنتی', price: 2500, colors: { shirt: '#7a3dff', pants: '#24124f', shoes: '#f5c242', accent: '#ff3dd9', skin: '#e2b08b', hair: '#1c0f2b' } },
];

// ظاهر محیط‌ها؛ هر ۸ مرحله محیط عوض می‌شود
export const THEMES = [
  {
    id: 'sunset', name: 'غروب طلایی',
    sky: { top: '#3a4ca8', horizon: '#ff9a62', bottom: '#5b3a5c' },
    sun: { color: '#ffd2a1', intensity: 3.2, elev: 9, azim: 200, size: 1.0 },
    hemi: { sky: '#9db4ff', ground: '#704a48', intensity: 0.8 },
    fog: 0.0042, exposure: 1.0, bloom: [0.5, 0.55, 0.88],
    ground: 'ocean', groundColor: ['#1b2a4a', '#ff9a62'], scenery: 'city', column: 'building', weather: 'dust',
    clouds: 0.55, stars: 0, night: 0.25, palette: ['#e8e2d6', '#d2c8b6', '#f0b58a'], trim: '#ffb46b',
  },
  {
    id: 'neon', name: 'شهر نئونی',
    sky: { top: '#05040f', horizon: '#3a0f5c', bottom: '#0a0618' },
    sun: { color: '#b388ff', intensity: 1.2, elev: 35, azim: 140, size: 0.5 },
    hemi: { sky: '#5d3dff', ground: '#ff2aa0', intensity: 0.55 },
    fog: 0.006, exposure: 1.15, bloom: [0.85, 0.55, 0.86],
    ground: 'grid', groundColor: ['#07040f', '#ff2ad4'], scenery: 'city', column: 'building', weather: 'none',
    clouds: 0.15, stars: 1, night: 1, palette: ['#1d1a33', '#2a2347', '#191630'], trim: '#ff2ad4',
  },
  {
    id: 'morning', name: 'آسمان صبح',
    sky: { top: '#2f7fe0', horizon: '#bfe3ff', bottom: '#e9f4ff' },
    sun: { color: '#fff6e5', intensity: 3.6, elev: 52, azim: 120, size: 0.8 },
    hemi: { sky: '#bfe0ff', ground: '#e8f1ff', intensity: 1.1 },
    fog: 0.0032, exposure: 0.95, bloom: [0.35, 0.4, 0.9],
    ground: 'clouds', groundColor: ['#ffffff', '#cfe6ff'], scenery: 'islands', column: 'rock', weather: 'none',
    clouds: 0.45, stars: 0, night: 0, palette: ['#f4f7fb', '#dfe9f5', '#7fd0ff'], trim: '#38bdf8',
  },
  {
    id: 'desert', name: 'دره کویر',
    sky: { top: '#4f8fd6', horizon: '#ffd6a0', bottom: '#d9a36b' },
    sun: { color: '#fff0d0', intensity: 3.8, elev: 40, azim: 230, size: 1.1 },
    hemi: { sky: '#bcd8ff', ground: '#c98b52', intensity: 0.9 },
    fog: 0.0038, exposure: 0.95, bloom: [0.3, 0.4, 0.92],
    ground: 'sand', groundColor: ['#d49a5d', '#f3c78f'], scenery: 'mesas', column: 'rock', weather: 'dust',
    clouds: 0.2, stars: 0, night: 0, palette: ['#e9c79a', '#d8a877', '#c97f4f'], trim: '#ff8a3d',
  },
  {
    id: 'frozen', name: 'قله‌های یخی',
    sky: { top: '#1d3b6b', horizon: '#a9d6f5', bottom: '#e8f6ff' },
    sun: { color: '#e6f4ff', intensity: 2.6, elev: 22, azim: 160, size: 0.9 },
    hemi: { sky: '#cfe9ff', ground: '#ffffff', intensity: 1.0 },
    fog: 0.0034, exposure: 1.0, bloom: [0.45, 0.5, 0.9],
    ground: 'snow', groundColor: ['#e9f5ff', '#a9cbe6'], scenery: 'mountains', column: 'ice', weather: 'snow',
    clouds: 0.5, stars: 0.2, night: 0.1, aurora: 0.6, palette: ['#e8f6ff', '#bfe3f7', '#8fd3ff'], trim: '#7af2ff',
  },
  {
    id: 'volcano', name: 'آتشفشان',
    sky: { top: '#140507', horizon: '#ff4d1a', bottom: '#2a0805' },
    sun: { color: '#ff8a4d', intensity: 2.0, elev: 14, azim: 250, size: 1.4 },
    hemi: { sky: '#ff6a3d', ground: '#ff2a00', intensity: 0.6 },
    fog: 0.0052, exposure: 1.0, bloom: [0.7, 0.55, 0.88],
    ground: 'lava', groundColor: ['#1a0503', '#ff5a1a'], scenery: 'mountains', column: 'basalt', weather: 'embers',
    clouds: 0.35, stars: 0.3, night: 0.6, palette: ['#3b3634', '#2e2a29', '#4a3f3b'], trim: '#ff5a1a',
  },
  {
    id: 'space', name: 'ایستگاه فضایی',
    sky: { top: '#000004', horizon: '#120d2e', bottom: '#000002' },
    sun: { color: '#ffffff', intensity: 3.0, elev: 30, azim: 60, size: 0.6 },
    hemi: { sky: '#6d7dff', ground: '#25163f', intensity: 0.45 },
    fog: 0.0016, exposure: 1.05, bloom: [0.75, 0.5, 0.85],
    ground: 'none', groundColor: ['#000000', '#000000'], scenery: 'planet', column: 'none', weather: 'stars',
    clouds: 0, stars: 1, night: 1, nebula: 1, palette: ['#c9ced8', '#9aa3b5', '#e6e9f0'], trim: '#3de1ff',
  },
  {
    id: 'forest', name: 'جنگل جادویی',
    sky: { top: '#0b2a2a', horizon: '#5fbf9a', bottom: '#0a1f1a' },
    sun: { color: '#d8ffcf', intensity: 2.2, elev: 28, azim: 300, size: 0.9 },
    hemi: { sky: '#8fffd0', ground: '#1c4a2a', intensity: 0.75 },
    fog: 0.0068, exposure: 1.05, bloom: [0.7, 0.55, 0.85],
    ground: 'swamp', groundColor: ['#0d2a1d', '#3cffb0'], scenery: 'trees', column: 'tree', weather: 'fireflies',
    clouds: 0.3, stars: 0.5, night: 0.5, palette: ['#7a5a3a', '#6b8f4e', '#8f6e48'], trim: '#3cffb0',
  },
  {
    id: 'tropic', name: 'جزیرهٔ استوایی',
    sky: { top: '#1e78d6', horizon: '#9ff0ff', bottom: '#c8fbff' },
    sun: { color: '#fffbe8', intensity: 3.8, elev: 60, azim: 90, size: 0.9 },
    hemi: { sky: '#a8e8ff', ground: '#2fd0c0', intensity: 1.0 },
    fog: 0.0028, exposure: 0.95, bloom: [0.3, 0.4, 0.92],
    ground: 'ocean', groundColor: ['#0b8fb0', '#7ff7ff'], scenery: 'islands', column: 'rock', weather: 'none',
    clouds: 0.5, stars: 0, night: 0, palette: ['#fff3d6', '#ffd9a8', '#ff8f6b'], trim: '#ff5a8a',
  },
  {
    id: 'synth', name: 'سایبر سانست',
    sky: { top: '#12022b', horizon: '#ff3d8b', bottom: '#2a0a3d' },
    sun: { color: '#ffb36b', intensity: 1.6, elev: 6, azim: 180, size: 2.4 },
    hemi: { sky: '#ff3dd9', ground: '#3d1aff', intensity: 0.6 },
    fog: 0.005, exposure: 1.1, bloom: [0.9, 0.6, 0.82],
    ground: 'grid', groundColor: ['#0d0221', '#00f0ff'], scenery: 'mountainsWire', column: 'none', weather: 'none',
    clouds: 0.1, stars: 1, night: 0.9, palette: ['#1a0b33', '#2a0f4a', '#140829'], trim: '#00f0ff',
  },
];

export function themeForLevel(level, mode) {
  const off = mode === 'down' ? 3 : mode === 'up' ? 6 : 0;
  return THEMES[(Math.floor((level - 1) / 8) + off) % THEMES.length];
}

// پالت‌های رنگ پارکور (پولی)
export const PALETTES = [
  { id: 'theme', name: 'پیش‌فرض محیط', price: 0, colors: null, trim: null, rough: 0.72, metal: 0.05 },
  { id: 'neon', name: 'نئون شب', price: 350, colors: ['#151226', '#1c1733', '#120f20'], trim: '#ff2ad4', rough: 0.35, metal: 0.4, trimBoost: 2.2 },
  { id: 'pastel', name: 'پاستیلی', price: 350, colors: ['#ffd1dc', '#c8f0ff', '#d6ffd1', '#fff2b3', '#e6d1ff'], trim: '#ffffff', rough: 0.8, metal: 0 },
  { id: 'gold', name: 'طلای سلطنتی', price: 900, colors: ['#e8b84a', '#d9a23a', '#f5d27a'], trim: '#fff1a8', rough: 0.28, metal: 0.85 },
  { id: 'ice', name: 'یخ کریستالی', price: 650, colors: ['#bfefff', '#9fdcff', '#e3f8ff'], trim: '#7af2ff', rough: 0.12, metal: 0.1, glassy: true },
  { id: 'lava', name: 'سنگ گدازه', price: 650, colors: ['#2b2422', '#3a2d29', '#221c1a'], trim: '#ff5a1a', rough: 0.85, metal: 0.05, trimBoost: 2.5 },
  { id: 'rainbow', name: 'رنگین‌کمان', price: 1200, colors: 'rainbow', trim: '#ffffff', rough: 0.5, metal: 0.1 },
  { id: 'marble', name: 'مرمر سفید', price: 800, colors: ['#f7f5f2', '#ecebe8', '#fbfaf7'], trim: '#c9a24a', rough: 0.22, metal: 0.05 },
  { id: 'cyber', name: 'سایبرپانک', price: 1000, colors: ['#0f1a2a', '#1a0f2a', '#0f2a24'], trim: '#00f0ff', rough: 0.3, metal: 0.6, trimBoost: 2.4 },
  { id: 'candy', name: 'آب‌نباتی', price: 750, colors: ['#ff5c8a', '#ffb13d', '#5ce1ff', '#9d5cff', '#5cff9d'], trim: '#ffffff', rough: 0.4, metal: 0 },
];
export const CUSTOM_COLOR_PRICE = 1500;

// نورپردازی‌ها (پولی)
export const LIGHTINGS = [
  { id: 'theme', name: 'پیش‌فرض محیط', price: 0, o: {} },
  { id: 'golden', name: 'ساعت طلایی', price: 300, o: { sunColor: '#ffbf7a', sunMul: 1.1, elev: 8, exposure: 1.05, bloomMul: 1.2, tint: '#ff9a5a', tintAmt: 0.35, warmth: 0.25 } },
  { id: 'midnight', name: 'نیمه‌شب نئونی', price: 500, o: { sunColor: '#7d6bff', sunMul: 0.4, elev: 40, exposure: 1.1, bloomMul: 1.8, tint: '#2a1a6b', tintAmt: 0.65, night: 1, stars: 1, warmth: -0.2 } },
  { id: 'aurora', name: 'شفق قطبی', price: 800, o: { sunColor: '#9fffe0', sunMul: 0.6, elev: 25, exposure: 1.1, bloomMul: 1.5, tint: '#0d3a4a', tintAmt: 0.55, night: 0.8, stars: 1, aurora: 1, warmth: -0.15 } },
  { id: 'bloodmoon', name: 'ماه خونین', price: 900, o: { sunColor: '#ff3d3d', sunMul: 0.8, elev: 18, exposure: 1.0, bloomMul: 1.6, tint: '#5a0a0a', tintAmt: 0.6, night: 0.8, stars: 0.6, warmth: 0.3 } },
  { id: 'crystal', name: 'روز کریستالی', price: 400, o: { sunColor: '#ffffff', sunMul: 1.35, elev: 65, exposure: 0.92, bloomMul: 0.8, tint: '#cfeaff', tintAmt: 0.2, warmth: -0.05, contrast: 1.08 } },
  { id: 'storm', name: 'طوفانی', price: 600, o: { sunColor: '#aab4c8', sunMul: 0.55, elev: 30, exposure: 0.95, bloomMul: 0.9, tint: '#3a4254', tintAmt: 0.6, fogMul: 1.7, clouds: 0.95, saturation: 0.75, lightning: true } },
  { id: 'dream', name: 'رؤیایی', price: 1100, o: { sunColor: '#ffc2f0', sunMul: 1.0, elev: 20, exposure: 1.08, bloomMul: 2.0, tint: '#ff9ae0', tintAmt: 0.45, saturation: 1.2, warmth: 0.05 } },
];
export const CUSTOM_LIGHT_PRICE = 1200;

export const QUALITY = {
  low: { label: 'کم', pixelRatio: 0.8, shadows: 0, post: false, msaa: 0, particles: 0.4, scenery: 0.4, bloom: false, fx: false, botScarf: false },
  medium: { label: 'متوسط', pixelRatio: 1, shadows: 1024, post: true, msaa: 0, fxaa: true, particles: 0.7, scenery: 0.7, bloom: true, fx: false, botScarf: false },
  high: { label: 'زیاد', pixelRatio: 1.5, shadows: 2048, post: true, msaa: 4, particles: 1, scenery: 1, bloom: true, fx: true, botScarf: false },
  ultra: { label: 'فوق‌العاده', pixelRatio: 2, shadows: 4096, post: true, msaa: 4, particles: 1.4, scenery: 1.3, bloom: true, fx: true, botScarf: true },
};

export const BOT_LOOKS = [
  { shirt: '#3d7bff', pants: '#14213d', shoes: '#ffffff', accent: '#ffd23d', skin: '#d8a27c', hair: '#1b120c', hairStyle: 'spiky', hat: 'none' },
  { shirt: '#ff5ca8', pants: '#3a1630', shoes: '#ffe3f1', accent: '#ffffff', skin: '#efc19e', hair: '#6b3a1e', hairStyle: 'ponytail', hat: 'none' },
  { shirt: '#ffb13d', pants: '#3b3b3b', shoes: '#ff3d3d', accent: '#3dffb1', skin: '#c48c69', hair: '#2b1b10', hairStyle: 'short', hat: 'cap' },
  { shirt: '#2fd0a0', pants: '#0e2b25', shoes: '#1a1a1a', accent: '#ffffff', skin: '#e2b391', hair: '#0f0f0f', hairStyle: 'short', hat: 'headphones' },
  { shirt: '#b03dff', pants: '#1c0f2e', shoes: '#ffffff', accent: '#ff3d8b', skin: '#dba787', hair: '#c23d3d', hairStyle: 'bun', hat: 'none' },
  { shirt: '#9aa3b5', pants: '#2a3242', shoes: '#3de1ff', accent: '#3de1ff', skin: '#f0c9a8', hair: '#4a3020', hairStyle: 'messy', hat: 'beanie' },
];
